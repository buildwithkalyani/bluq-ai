"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { LayoutDashboard, CalendarDays, MessageCircle, Layers, Settings, LogOut, Users, ChevronDown, MoreHorizontal, ClipboardList, User, type LucideIcon } from "lucide-react";
import { getProjects, Project } from "@/lib/mock-data";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace";
import { ActivityFeedProvider } from "@/context/activity-feed";
import { LiveActivityButton, LiveActivityPanel } from "@/components/LiveActivityPanel";
import { PermissionsProvider, usePermissions } from "@/context/permissions";
import { fetchProjects, fetchTasks, createProject, clearAuthTokenCache, isRealProject } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useSchedulePoller } from "@/hooks/useSchedulePoller";

// ─── NAV CONFIGURATION ───────────────────────────────────────
const NAV_ITEMS: { id: string; Icon: LucideIcon; label: string; href: string; subTabs: { label: string; href: string }[] }[] = [
  {
    id: "dashboard",
    Icon: LayoutDashboard,
    label: "Overview",
    href: "/dashboard/overview",
    subTabs: [
      { label: "Projects Dashboard", href: "/dashboard/overview" },
    ],
  },
  {
    id: "daily-updates",
    Icon: ClipboardList,
    label: "Daily Updates",
    href: "/dashboard/overview/daily-updates",
    subTabs: [
      { label: "Daily Updates", href: "/dashboard/overview/daily-updates" },
      { label: "DPR", href: "/dashboard/dpr" },
    ],
  },
  {
    id: "schedule",
    Icon: CalendarDays,
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
    Icon: MessageCircle,
    label: "WhatsApp",
    href: "/dashboard/whatsapp-feed",
    subTabs: [
      { label: "WhatsApp Feed", href: "/dashboard/whatsapp-feed" },
      { label: "Bot Control",   href: "/dashboard/whatsapp-bot" },
    ],
  },
  {
    id: "documents",
    Icon: Layers,
    label: "Documents",
    href: "/dashboard/documents",
    subTabs: [{ label: "Documents", href: "/dashboard/documents" }],
  },
  {
    id: "team",
    Icon: Users,
    label: "Team & roles",
    href: "/dashboard/team",
    subTabs: [{ label: "Team & roles", href: "/dashboard/team" }],
  },
  {
    id: "settings",
    Icon: Settings,
    label: "Settings",
    href: "/dashboard/settings/project",
    subTabs: [
      { label: "Project Settings", href: "/dashboard/settings/project" },
    ],
  },
];

// ─── HELPERS ────────────────────────────────────────────────
function getActiveNav(pathname: string) {
  // Use the most specific (longest href) match to avoid /dashboard/overview
  // swallowing /dashboard/overview/daily-updates etc.
  let best: (typeof NAV_ITEMS)[0] | null = null;
  let bestLen = 0;
  for (const n of NAV_ITEMS) {
    for (const t of n.subTabs) {
      if (pathname.startsWith(t.href) && t.href.length > bestLen) {
        best = n;
        bestLen = t.href.length;
      }
    }
  }
  return best ?? NAV_ITEMS[0];
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
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="text-[16px] font-semibold text-[#0F172A] tracking-tight">
            New project
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#64748B] text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">
              Project Name *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marina Bay Tower"
              className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-[14px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">
              Project Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated"
              className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-[14px] text-[#0F172A] font-mono placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F1F5F9]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-5 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── PROJECT DROPDOWN (topnav version — opens downward) ──────
function TopNavProjectDropdown() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      fetchProjects(workspaceId).then((rows) => {
        setProjects(rows.map((p) => ({
          id: p.id as any,
          name: p.projectName,
          code: p.projectCode ?? "",
          pct: Number(p.percentComplete ?? 0),
          status: "notStarted" as const,
          tasks: 0, tasksDone: 0, workers: 0, issues: 0,
          stage: p.stage ?? "",
          startDate: p.startDate ?? "",
          endDate: p.endDate ?? "",
          address: p.address ?? "",
        })));
      }).catch(console.error);
    } else {
      getProjects().then(setProjects);
    }
  }, [workspaceId]);

  const currentId = searchParams.get("projectId") || "0";

  // Hide on overview (has its own project UI) and team (workspace-level, not project-level)
  if (pathname === "/dashboard/overview" || pathname.startsWith("/dashboard/team")) return null;

  const selected = projects.find((p) => String(p.id) === currentId);
  const selectedName = selected?.name || (projects.length === 0 ? "No projects yet" : "Select project");
  const initials = selected ? selectedName.split(" ").map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2) : "+";

  const handleSelect = (name: string) => {
    const p = projects.find((proj) => proj.name === name);
    if (p) {
      const params = workspaceId ? `?projectId=${p.id}&workspaceId=${workspaceId}` : `?projectId=${p.id}`;
      router.push(`${pathname}${params}`);
    }
    setIsOpen(false);
  };

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    setShowNewModal(false);
    const params = workspaceId ? `?projectId=${project.id}&workspaceId=${workspaceId}` : `?projectId=${project.id}`;
    router.push(`${pathname}${params}`);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors shadow-sm cursor-pointer ${selected ? "border-[#E2E8F0] text-[#0F172A] hover:border-[#CBD5E1]" : "border-dashed border-[#CBD5E1] text-[#94A3B8]"}`}
        >
          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${selected ? "bg-[#2563EB]" : "bg-[#CBD5E1]"}`}>
            {initials || "P"}
          </span>
          <span className="max-w-[160px] truncate">{selectedName}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0 ml-0.5">
            <path d="M1 1L5 5L9 1" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-[#E2E8F0] rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
                <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.08em]">Switch Project</div>
              </div>
              <div className="p-1.5">
                <div
                  onClick={() => { setIsOpen(false); setShowNewModal(true); }}
                  className="px-3 py-2.5 text-[13px] cursor-pointer hover:bg-[#EFF6FF] flex items-center gap-2.5 text-[#2563EB] font-semibold rounded-lg"
                >
                  <span className="w-6 h-6 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[14px] leading-none">+</span>
                  New Project
                </div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p.name)}
                    className={`px-3 py-2.5 text-[13px] cursor-pointer rounded-lg flex items-center gap-2.5 transition-colors ${
                      p.name === selectedName ? "text-[#2563EB] font-semibold bg-[#EFF6FF]" : "text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-md bg-[#2563EB]/10 flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                      {p.name.split(" ").map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2)}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.name === selectedName && <span className="ml-auto text-[#2563EB] text-[11px]">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {showNewModal && (
        <NewProjectModal onClose={() => setShowNewModal(false)} onCreated={handleProjectCreated} />
      )}
    </>
  );
}

// ─── SUB TABS ───────────────────────────────────────────────
function ProjectAwareSubTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "0";
  const workspaceId = searchParams.get("workspaceId");
  const activeNav = getActiveNav(pathname);
  const activeTab = getActiveTab(pathname, activeNav);
  const isSchedule = activeNav.id === "schedule";
  if (activeNav.subTabs.length <= 1) return null;

  const buildHref = (href: string) => {
    const params = new URLSearchParams({ projectId });
    if (workspaceId) params.set("workspaceId", workspaceId);
    return `${href}?${params.toString()}`;
  };

  return (
    <div className="flex items-center px-5 bg-white border-b border-[#E2E8F0] flex-shrink-0">
      {activeNav.subTabs.map((tab) => (
        <Link
          key={tab.href}
          href={buildHref(tab.href)}
          className={`relative px-4 h-[42px] flex items-center text-[14px] font-medium transition-colors border-b-2 -mb-px ${
            tab.href === activeTab.href
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
      {isSchedule && (
        <div className="ml-auto">
          <LiveActivityButton />
        </div>
      )}
      {isSchedule && <LiveActivityPanel />}
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────
const PROJECT_NAV_IDS   = ["dashboard", "daily-updates", "schedule", "whatsapp", "documents"];
const WORKSPACE_NAV_IDS = ["team", "settings"];
const SIDEBAR_LABEL_OVERRIDE: Record<string, string> = { whatsapp: "Site Updates" };

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeNav = getActiveNav(pathname);
  const projectId   = searchParams.get("projectId") || "0";
  const workspaceIdParam = searchParams.get("workspaceId");
  const { orgName, workspaceId: ctxWorkspaceId } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ctxWorkspaceId) return;
    authClient.getSession().then((s) => {
      const token = (s as any)?.data?.session?.token ?? "";
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
      fetch(`${backendUrl}/orgs/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data: any[]) => { if (data?.[0]?.logoUrl) setOrgLogoUrl(data[0].logoUrl); })
        .catch(() => {});
    });
  }, [ctxWorkspaceId]);

  const workspaceInitials = orgName
    ? orgName.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2)
    : "WS";

  const projectItems   = NAV_ITEMS.filter(n => PROJECT_NAV_IDS.includes(n.id));
  const workspaceItems = NAV_ITEMS.filter(n => WORKSPACE_NAV_IDS.includes(n.id));

  const NavItem = ({ n }: { n: typeof NAV_ITEMS[0] }) => {
    const active = activeNav.id === n.id;
    return (
      <div
        onClick={() => {
          // Overview list should never carry a projectId — it shows all projects
          const p = new URLSearchParams(n.id === "dashboard" ? {} : { projectId });
          if (workspaceIdParam) p.set("workspaceId", workspaceIdParam);
          const qs = p.toString();
          router.push(`${n.subTabs[0].href}${qs ? `?${qs}` : ""}`);
        }}
        title={collapsed ? (SIDEBAR_LABEL_OVERRIDE[n.id] ?? n.label) : undefined}
        className={`relative flex items-center gap-3 rounded-lg cursor-pointer transition-all mb-0.5 ${collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2"} ${active ? "bg-[#1E2235]" : "hover:bg-[#ffffff08]"}`}
      >
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#2563EB] rounded-r-full" />}
        <n.Icon size={17} strokeWidth={1.6} className={active ? "text-white shrink-0" : "text-[#6B7280] shrink-0"} />
        {!collapsed && <span className={`text-[13px] font-medium flex-1 truncate ${active ? "text-white" : "text-[#9CA3AF]"}`}>{SIDEBAR_LABEL_OVERRIDE[n.id] ?? n.label}</span>}
      </div>
    );
  };

  return (
    <div className={`${collapsed ? "w-[56px]" : "w-[224px]"} bg-[#0C0E18] flex flex-col flex-shrink-0 border-r border-[#1A1D2E] transition-all duration-200`}>
      {/* Workspace header */}
      <div className="px-2 pt-3 pb-2 border-b border-[#1A1D2E] relative">
        <div
          onClick={() => {
            const p = new URLSearchParams();
            if (workspaceIdParam) p.set("workspaceId", workspaceIdParam);
            const qs = p.toString();
            router.push(`/dashboard/settings/workspace${qs ? `?${qs}` : ""}`);
          }}
          title={collapsed ? (orgName ?? "Workspace Settings") : undefined}
          className={`flex items-center gap-2.5 rounded-lg cursor-pointer hover:bg-[#1E2235] transition-colors ${collapsed ? "justify-center px-1 py-2" : "px-2 py-2"}`}
        >
          {orgLogoUrl ? (
            <img src={orgLogoUrl} alt="Workspace" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center text-white text-[11px] font-bold shrink-0 select-none">
              {workspaceInitials}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest leading-none mb-0.5">Workspace</div>
              <div className="text-[13px] font-semibold text-white truncate leading-tight">{orgName ?? "My Workspace"}</div>
            </div>
          )}
        </div>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#1E2235] border border-[#2D3748] flex items-center justify-center text-[#6B7280] hover:text-white transition-colors z-10"
        >
          <ChevronDown size={12} className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : "rotate-90"}`} />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-1">
        {!collapsed && <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest px-3 mb-2">Project</p>}
        {collapsed && <div className="h-3" />}
        {projectItems.map(n => <NavItem key={n.id} n={n} />)}

        {!collapsed && <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest px-3 mb-2 mt-5">Workspace</p>}
        {collapsed && <div className="h-4" />}
        {workspaceItems.map(n => <NavItem key={n.id} n={n} />)}
      </div>

      {/* Profile */}
      <SidebarProfile collapsed={collapsed} />
    </div>
  );
}

// ─── SIDEBAR PROFILE ────────────────────────────────────────
function SidebarProfile({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { role } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    try { return localStorage.getItem("bluq_profile_photo"); } catch { return null; }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bluq_profile_photo") setPhotoUrl(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const initials = userName.split(" ").map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2) || "U";

  const handleLogout = async () => {
    setIsOpen(false);
    clearAuthTokenCache();
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="relative border-t border-[#1A1D2E] px-3 py-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        title={collapsed ? userName : undefined}
        className={`flex items-center rounded-lg hover:bg-[#1E2235] cursor-pointer transition-colors ${collapsed ? "justify-center px-1 py-2" : "gap-2.5 px-2 py-2"}`}
      >
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[11px] font-bold overflow-hidden shrink-0 select-none">
          {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white truncate leading-tight">{userName}</div>
              <div className="text-[11px] text-[#4B5563] truncate leading-tight capitalize">{role || "Member"}</div>
            </div>
            <MoreHorizontal size={15} className="text-[#4B5563] shrink-0" />
          </>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-full bottom-0 ml-2 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#FAFBFD]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0 overflow-hidden">
                  {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#0F172A] truncate">{userName}</div>
                  <div className="text-[11px] text-[#94A3B8] truncate">{userEmail}</div>
                  {role && <div className="text-[10px] text-[#94A3B8] font-medium mt-0.5 truncate capitalize">{role}</div>}
                </div>
              </div>
            </div>

            <div className="p-1.5">
              <div
                onClick={() => { setIsOpen(false); router.push("/dashboard/settings/account"); }}
                className="px-3 py-2 text-[12px] text-[#475569] cursor-pointer hover:bg-[#F8FAFC] rounded-lg flex items-center gap-2.5 transition-colors"
              >
                <User size={14} strokeWidth={1.6} className="text-[#94A3B8]" />
                My Profile
              </div>
            </div>

            <div className="border-t border-[#F1F5F9] p-1.5">
              <div
                onClick={handleLogout}
                className="px-3 py-2 text-[12px] text-red-500 cursor-pointer hover:bg-red-50 rounded-lg flex items-center gap-2.5 transition-colors"
              >
                <LogOut size={14} strokeWidth={1.6} />
                Log out
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
// ─── BACKGROUND SCHEDULE POLLER ─────────────────────────────
function SchedulePollerMount() {
  useSchedulePoller();
  return null;
}

type KPIData = { projectedEnd: string | null; plannedEnd: string | null; address: string | null };

// ─── MAIN COMPONENTS ────────────────────────────────────────
function ProjectKPIStrip() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const { data: session } = authClient.useSession();
  const sessionReady = session !== undefined;
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const isOverviewList = pathname === "/dashboard/overview";

  const hasRealProject = !wsLoading && sessionReady && isRealProject(projectIdParam) && !!workspaceId && !isDesignMode;
  const hasWorkspace = !wsLoading && !!workspaceId && !isDesignMode;

  // All hooks before any early return
  const [data, setData] = useState<KPIData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (wsLoading) return;

    if (isDesignMode) {
      setData({ projectedEnd: "2026-09-30", plannedEnd: "2026-09-27", address: "Dubai Marina, Dubai, UAE" });
      setReady(true);
      return;
    }

    if (!hasWorkspace || !sessionReady) {
      setData(null);
      setReady(true);
      return;
    }

    setReady(false);
    fetchProjects(workspaceId!).then(projects => {
      if (projects.length === 0) { setReady(true); return; }

      if (hasRealProject) {
        const project = projects.find(p => p.id === projectIdParam);
        if (!project) { setReady(true); return; }
        const plannedEnd = project.endDate ?? null;
        const address = (project as any).address ?? null;
        setData({ projectedEnd: plannedEnd, plannedEnd, address });
        setReady(true);
        return fetchTasks(projectIdParam, workspaceId!).then(tasks => {
          const parents = tasks.filter(t => !t.parentTaskId);
          if (parents.length === 0) return;
          const ends = parents.map(t => t.endDate).filter(Boolean).sort();
          const projectedEnd = ends.length > 0 ? ends[ends.length - 1] : plannedEnd;
          setData({ projectedEnd, plannedEnd, address });
        });
      } else {
        const ends = projects.map(p => p.endDate).filter(Boolean).sort() as string[];
        setData({ projectedEnd: ends[ends.length - 1] ?? null, plannedEnd: ends[ends.length - 1] ?? null, address: null });
        setReady(true);
      }
    }).catch(() => setReady(true));
  }, [projectIdParam, workspaceId, wsLoading, isDesignMode, sessionReady, hasRealProject, hasWorkspace]);

  if (isOverviewList || pathname.startsWith("/dashboard/team")) return null;

  const address = ready && data?.address
    ? data.address
    : (isDesignMode ? "Dubai Marina, Dubai, UAE" : null);

  if (!address) return null;

  return (
    <div className="flex items-center gap-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      <span className="text-[13px] font-medium text-[#475569] tracking-tight">{address}</span>
    </div>
  );
}

// ─── MAIN COMPONENTS ────────────────────────────────────────
function TopNav() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="flex items-center justify-between px-5 h-[52px] border-b border-[#E2E8F0] bg-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", background: "#0C0E18", borderRadius: "6px" }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
              <path d="M4 20 L4 10 L12 4 L20 10 L20 20" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 20 L9 14 L15 14 L15 20" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span style={{ fontWeight: 700, fontSize: "14px", color: "#0F172A", letterSpacing: "-0.04em" }}>blu<span style={{ color: "#2563EB" }}>Q</span></span>
        </a>
        <div className="w-px h-4 bg-[#E2E8F0]" />
        <span className="text-[13px] font-medium text-[#64748B]">{today}</span>
      </div>

      <div className="flex items-center gap-3">
        <Suspense fallback={null}><ProjectKPIStrip /></Suspense>
        <div className="w-px h-4 bg-[#E2E8F0]" />
        <TopNavProjectDropdown />
      </div>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading } = useWorkspace();
  if (loading) return (
    <div className="h-screen bg-[#F6F8FA] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#3A4EA2] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return (
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
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <SchedulePollerMount />
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
