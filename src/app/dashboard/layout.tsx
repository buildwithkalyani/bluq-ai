"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getProjects, Project } from "@/lib/mock-data";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace";
import { fetchProjects, createProject } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// ─── NAV CONFIGURATION ───────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "dashboard",
    icon: "📊",
    label: "Overview",
    href: "/dashboard/overview",
    subTabs: [
      { label: "Projects Dashboard", href: "/dashboard/overview" },
      { label: "Daily Updates", href: "/dashboard/overview/daily-updates" },
    ],
  },
  {
    id: "schedule",
    icon: "📅",
    label: "Schedule",
    href: "/dashboard/schedule/gantt",
    subTabs: [
      { label: "Gantt View", href: "/dashboard/schedule/gantt" },
      { label: "List View", href: "/dashboard/schedule/list-view" },
      { label: "Baseline vs Actual", href: "/dashboard/schedule/baseline" },
      { label: "S-Curve", href: "/dashboard/schedule/s-curve" },
      { label: "Delay Analytics", href: "/dashboard/schedule/delay-analysis" },
      { label: "Import Schedule", href: "/dashboard/schedule/import-csv" },
    ],
  },
  {
    id: "whatsapp",
    icon: "💬",
    label: "WhatsApp",
    href: "/dashboard/whatsapp-feed",
    subTabs: [
      { label: "WhatsApp Feed", href: "/dashboard/whatsapp-feed" },
      { label: "Bot Control",   href: "/dashboard/whatsapp-bot" },
    ],
  },
  {
    id: "documents",
    icon: "📁",
    label: "Documents",
    href: "/dashboard/documents",
    subTabs: [{ label: "Documents", href: "/dashboard/documents" }],
  },
  {
    id: "reports",
    icon: "📄",
    label: "Reports",
    href: "/dashboard/dpr",
    subTabs: [{ label: "Generate DPR", href: "/dashboard/dpr" }],
  },
  {
    id: "settings",
    icon: "⚙️",
    label: "Settings",
    href: "/dashboard/settings",
    subTabs: [
      { label: "Project Settings", href: "/dashboard/settings/project" },
      { label: "Account Settings", href: "/dashboard/settings/account" },
    ],
  },
];

// ─── HELPERS ────────────────────────────────────────────────
function getActiveNav(pathname: string) {
  return (
    NAV_ITEMS.find((n) =>
      n.subTabs.some((t) => pathname.startsWith(t.href))
    ) ?? NAV_ITEMS[0]
  );
}

function getActiveTab(pathname: string, nav: (typeof NAV_ITEMS)[0]) {
  return (
    nav.subTabs
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => pathname.startsWith(t.href)) ?? nav.subTabs[0]
  );
}

// ─── NEW PROJECT MODAL ──────────────────────────────────────
function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const { workspaceId } = useWorkspace();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate code from name
  useEffect(() => {
    if (name) {
      const words = name.trim().split(/\s+/);
      const initials = words
        .map((w) => w[0]?.toUpperCase())
        .join("")
        .slice(0, 3);
      setCode(`${initials}-2026-${String(Math.floor(Math.random() * 900) + 100)}`);
    }
  }, [name]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");

    if (workspaceId) {
      // Real backend
      try {
        const p = await createProject({
          workspaceId,
          projectName: name.trim(),
          projectCode: code || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        onCreated({
          id: p.id as any,
          name: p.projectName,
          code: p.projectCode ?? code,
          pct: 0,
          status: "notStarted",
          tasks: 0,
          tasksDone: 0,
          workers: 0,
          issues: 0,
          stage: p.stage ?? "Pre-construction",
          startDate: startDate || "TBD",
          endDate: endDate || "TBD",
          address: p.address ?? "",
        });
        return;
      } catch (err: any) {
        setError(err.message);
        setCreating(false);
        return;
      }
    }

    // Mock fallback (demo mode)
    const newProject: Project = {
      id: Date.now(),
      name: name.trim(),
      code,
      pct: 0,
      status: "notStarted",
      tasks: 0,
      tasksDone: 0,
      workers: 0,
      issues: 0,
      stage: "Pre-construction",
      startDate: startDate || "TBD",
      endDate: endDate || "TBD",
      address: "",
    };
    setTimeout(() => { setCreating(false); onCreated(newProject); }, 500);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-white rounded-xl shadow-2xl border border-[#D0D7DE] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1e4e8]">
          <div className="text-[14px] font-bold text-[#24292f]">
            Create new project
          </div>
          <div
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-[#f0f1f3] text-[#8C959F] text-sm transition-colors"
          >
            ✕
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3.5">
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-[#57606a] mb-1">
              PROJECT NAME *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marina Bay Tower"
              className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#57606a] mb-1">
              PROJECT CODE
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated"
              className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] font-mono placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">
                START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">
                END DATE
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#e1e4e8] bg-[#f6f8fa] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-semibold text-[#24292f] bg-white border border-[#D0D7DE] rounded-md hover:bg-[#f0f1f3] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#3A4EA2] border-none rounded-md hover:bg-[#0757b5] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── PROJECT DROPDOWN (with + New Project) ───────────────────
function ProjectDropdown() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      // Real backend
      fetchProjects(workspaceId).then((rows) => {
        setProjects(rows.map((p) => ({
          id: p.id as any,
          name: p.projectName,
          code: p.projectCode ?? "",
          pct: Number(p.percentComplete ?? 0),
          status: "notStarted" as const,
          tasks: 0,
          tasksDone: 0,
          workers: 0,
          issues: 0,
          stage: p.stage ?? "",
          startDate: p.startDate ?? "",
          endDate: p.endDate ?? "",
          address: p.address ?? "",
        })));
      }).catch(console.error);
    } else {
      // Mock fallback
      getProjects().then(setProjects);
    }
  }, [workspaceId]);

  const currentId = searchParams.get("projectId") || "0";
  const selected =
    projects.find((p) => String(p.id) === currentId)?.name ||
    "Select Project...";

  const handleSelect = (name: string) => {
    const p = projects.find((proj) => proj.name === name);
    if (p) {
      const params = workspaceId
        ? `?projectId=${p.id}&workspaceId=${workspaceId}`
        : `?projectId=${p.id}`;
      router.push(`${pathname}${params}`);
    }
    setIsOpen(false);
  };

  const handleNewProject = () => {
    setIsOpen(false);
    setShowNewModal(true);
  };

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    setShowNewModal(false);
    const params = workspaceId
      ? `?projectId=${project.id}&workspaceId=${workspaceId}`
      : `?projectId=${project.id}`;
    router.push(`${pathname}${params}`);
  };

  return (
    <>
      <div className="relative w-full">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 border border-[#D0D7DE] rounded-md px-3 py-1.5 bg-white cursor-pointer text-[13px] font-semibold text-[#24292f] hover:bg-[#f6f8fa] transition-colors shadow-sm w-full"
        >
          <span className="w-2 h-2 rounded-full bg-[#3A4EA2] flex-shrink-0" />
          <span className="truncate flex-1">{selected}</span>
          <span className="text-[#8C959F] text-[11px] ml-0.5">▾</span>
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#D0D7DE] rounded-md shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
              {/* + New Project — always first */}
              <div
                onClick={handleNewProject}
                className="px-3 py-2 text-[12px] cursor-pointer hover:bg-[#ddf4ff] flex items-center gap-2 text-[#3A4EA2] font-semibold border-b border-[#f0f1f3] mb-1"
              >
                <span className="text-[14px] leading-none">+</span>
                New Project
              </div>

              <div className="px-3 py-1.5 text-[10px] font-bold text-[#8C959F] uppercase tracking-wider">
                Your projects
              </div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p.name)}
                  className={`px-3 py-2 text-[12px] cursor-pointer hover:bg-[#f0f1f3] flex items-center justify-between ${
                    p.name === selected
                      ? "text-[#3A4EA2] font-bold bg-[#f6f8fa]"
                      : "text-[#24292f]"
                  }`}
                >
                  {p.name}
                  {p.name === selected && (
                    <span className="text-[10px]">✓</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </>
  );
}

// ─── SUB TABS ───────────────────────────────────────────────
function ProjectAwareSubTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "0";
  const activeNav = getActiveNav(pathname);
  const activeTab = getActiveTab(pathname, activeNav);

  if (activeNav.subTabs.length <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-white border-b border-[#D0D7DE]">
      {/* LEFT SIDE: The Tabs */}
      <div className="flex items-center gap-1">
        {activeNav.subTabs.map((tab) => (
          <Link
            key={tab.href}
            href={`${tab.href}?projectId=${projectId}`}
            className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
              tab.href === activeTab.href
                ? "bg-[#ddf4ff] text-[#3A4EA2]"
                : "text-[#57606a] hover:text-[#24292f] hover:bg-[#f6f8fa]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* RIGHT SIDE: The Project Dropdown */}
      {activeNav.id !== "dashboard" && activeNav.id !== "settings" && (
  <div className="w-[220px]">
    <ProjectDropdown />
  </div>
)}
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────
function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeNav = getActiveNav(pathname);
  const projectId = searchParams.get("projectId") || "0";

  return (
    <div className="w-[52px] bg-[#0D1117] flex flex-col items-center pt-3 gap-1 flex-shrink-0">
      {NAV_ITEMS.map((n) => {
        const active = activeNav.id === n.id;
        return (
          <div
            key={n.id}
            onClick={() =>
              router.push(
                `${n.subTabs[0].href}?projectId=${projectId}`
              )
            }
            title={n.label}
            className="w-10 h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors"
            style={{
              background: active ? "#161b22" : "transparent",
              borderLeft: active
                ? "2px solid #3A4EA2"
                : "2px solid transparent",
            }}
          >
            <span className="text-base">{n.icon}</span>
            <span className="text-[7px] text-[#8b949e] mt-0.5">
              {n.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROFILE DROPDOWN ────────────────────────────────────────
function ProfileDropdown() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { orgName } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const initials = userName.split(" ").map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2) || "U";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
    setShowPhotoModal(false);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-7 h-7 rounded-full bg-[#3A4EA2] flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:ring-2 hover:ring-[#3A4EA2] hover:ring-offset-1 transition-all overflow-hidden select-none"
          title="Account"
        >
          {photoUrl ? (
            <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#D0D7DE] rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-[#f0f1f3]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#3A4EA2] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#24292f]">{userName}</div>
                    <div className="text-[11px] text-[#8C959F]">{userEmail}</div>
                    {orgName && <div className="text-[10px] text-[#8C959F] font-mono">{orgName}</div>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                <div
                  onClick={() => { setIsOpen(false); setShowPhotoModal(true); }}
                  className="px-3 py-2 text-[12px] text-[#24292f] cursor-pointer hover:bg-[#f6f8fa] flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-[14px]">🖼️</span>
                  Edit profile photo
                </div>
              </div>

              <div className="border-t border-[#f0f1f3] py-1">
                <div
                  onClick={handleLogout}
                  className="px-3 py-2 text-[12px] text-red-600 cursor-pointer hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-[14px]">🚪</span>
                  Log out
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Photo Modal */}
      {showPhotoModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowPhotoModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[340px] bg-white rounded-xl shadow-2xl border border-[#D0D7DE]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1e4e8]">
              <div className="text-[14px] font-bold text-[#24292f]">Edit profile photo</div>
              <div
                onClick={() => setShowPhotoModal(false)}
                className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-[#f0f1f3] text-[#8C959F] text-sm"
              >
                ✕
              </div>
            </div>

            <div className="px-5 py-6 flex flex-col items-center gap-4">
              {/* Preview */}
              <div className="w-20 h-20 rounded-full bg-[#3A4EA2] flex items-center justify-center text-white text-xl font-bold overflow-hidden border-2 border-[#D0D7DE]">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* File upload button */}
              <label className="cursor-pointer px-4 py-2 bg-[#3A4EA2] text-white text-[13px] font-semibold rounded-md hover:bg-[#0757b5] transition-colors">
                Choose from photos
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <p className="text-[11px] text-[#8C959F]">PNG or JPEG supported</p>
            </div>

            <div className="flex justify-end px-5 py-3.5 border-t border-[#e1e4e8] bg-[#f6f8fa] rounded-b-xl">
              <button
                onClick={() => setShowPhotoModal(false)}
                className="px-4 py-1.5 text-[13px] font-semibold text-[#24292f] bg-white border border-[#D0D7DE] rounded-md hover:bg-[#f0f1f3] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
// ─── MAIN COMPONENTS ────────────────────────────────────────
function TopNav() {
  const pathname = usePathname();
  const nav = getActiveNav(pathname);
  const tab = getActiveTab(pathname, nav);

  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-b border-[#D0D7DE] bg-white flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="tracking-tight">
        <a href="#" className="logo" style={{display:"flex", alignItems:"center", height:"100%"}}>
  <img src="/bluq-logo.png" alt="BluQ" style={{height:"15px", width:"auto"}} />
</a>
        </span>
        <span className="text-[#D0D7DE]">/</span>
        <span className="text-[13px] text-[#57606a]">{nav.label}</span>
        <span className="text-[#D0D7DE]">/</span>
        <span className="text-[13px] text-[#24292f] font-semibold">
          {tab.label}
        </span>
      </div>

      <div className="flex items-center gap-4">

      <ProfileDropdown />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <div className="h-screen flex flex-col bg-[#F6F8FA] text-[#24292f]">
        <Suspense fallback={null}>
          <TopNav />
        </Suspense>
        <div className="flex-1 flex overflow-hidden">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <div className="flex-1 flex flex-col overflow-hidden">
            <Suspense fallback={null}>
              <ProjectAwareSubTabs />
            </Suspense>
            <div className="flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
