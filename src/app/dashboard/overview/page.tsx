"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Building2, Users, CalendarDays, MoreVertical, Pencil, Trash2, MapPin, AlertTriangle, CheckCircle2, ClipboardList, FileText, Pin, PinOff } from "lucide-react";
import {
  getProjects,
  STATUS_CONFIG,
  type Project,
} from "@/lib/mock-data";
import {
  Card,
  MetricCard,
  StatusBadge,
  ProgressBar,
  SectionTitle,
  Btn,
} from "@/components/ui/bluq-ui";
import ProjectDetailView from "./ProjectDetailView";
import CreateProjectModal from "./CreateProjectModal";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects, fetchTasks, deleteProject, fetchPinnedProjects, updatePinnedProjects, isRealProject } from "@/lib/api-client";
import type { ScheduleTask } from "@/lib/mock-data";

function fmtDate(iso: string): string {
  if (!iso || iso === "TBD") return iso;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const PROJECTS_CACHE_KEY = "bluq_projects_cache";
const PINNED_KEY = "bluq_pinned_projects";
const WS_CACHE_KEY = "bluq_workspace";
const STALE_MS = 5 * 60 * 1000; // 5 minutes

function readPinned(workspaceId: string): string[] {
  try {
    const raw = localStorage.getItem(`${PINNED_KEY}_${workspaceId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writePinned(workspaceId: string, ids: string[]): void {
  try {
    localStorage.setItem(`${PINNED_KEY}_${workspaceId}`, JSON.stringify(ids));
  } catch {}
}

type ProjectsCache = { data: Project[]; lastFetchedAt: number };

function readProjectsCache(workspaceId: string): ProjectsCache | null {
  try {
    const raw = localStorage.getItem(`${PROJECTS_CACHE_KEY}_${workspaceId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeProjectsCache(workspaceId: string, projects: Project[]): void {
  try {
    const entry: ProjectsCache = { data: projects, lastFetchedAt: Date.now() };
    localStorage.setItem(`${PROJECTS_CACHE_KEY}_${workspaceId}`, JSON.stringify(entry));
  } catch {}
}

function isSameProjects(a: Project[], b: Project[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: Project) => `${p.id}:${p.status}:${p.pct}`;
  return JSON.stringify(a.map(key).sort()) === JSON.stringify(b.map(key).sort());
}

// Reads cached projects synchronously from localStorage using the stored workspace ID.
// Called as a lazy useState initializer so state is populated before the first render,
// eliminating the skeleton/flash on hard refresh when localStorage is warm.
function readInitialProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const wsRaw = localStorage.getItem(WS_CACHE_KEY);
    if (!wsRaw) return [];
    const ws = JSON.parse(wsRaw) as { id?: string };
    if (!ws.id) return [];
    return readProjectsCache(ws.id)?.data ?? [];
  } catch { return []; }
}

const STATUS_MAP: Record<string, string> = {
  not_started:  "notStarted",
  in_progress:  "inProgress",
  completed:    "completed",
  running_late: "runningLate",
  delayed:      "delayed",
  // already camelCase (in case backend returns either form)
  notStarted:   "notStarted",
  inProgress:   "inProgress",
  runningLate:  "runningLate",
};

function deriveStatus(raw: string | null, pct: number): string {
  const mapped = raw ? (STATUS_MAP[raw] ?? null) : null;
  // Trust explicit terminal/negative states from backend
  if (mapped === "delayed" || mapped === "runningLate") return mapped;
  if (mapped === "completed") return "completed";
  // Progress always overrides "notStarted" — backend may lag on parent-task avg
  if (pct >= 100) return "completed";
  if (pct > 0)   return "inProgress";
  return mapped ?? "notStarted";
}

function mapBackendProjects(rows: Awaited<ReturnType<typeof fetchProjects>>): Project[] {
  return rows.map((p) => {
    const pct = Number(p.percentComplete ?? 0);
    return {
      id: p.id as any,
      name: p.projectName,
      code: p.projectCode ?? "",
      pct,
      status: deriveStatus(p.status, pct) as any,
      tasks: 0,
      tasksDone: 0,
      workers: 0,
      issues: 0,
      stage: p.stage ?? "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      address: p.address ?? "",
      settingsJson: p.settingsJson ?? undefined,
    };
  });
}

function OverviewContent() {
  const { workspaceId, loading: wsLoading, isDesignMode } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>(readInitialProjects);
  const [loading, setLoading] = useState<boolean>(() => readInitialProjects().length === 0);
  const [fetching, setFetching] = useState(false);
  const [isOutdated, setIsOutdated] = useState(false);
  const [prefetchedTasks, setPrefetchedTasks] = useState<ScheduleTask[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [menuOpenProjectId, setMenuOpenProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    // Show localStorage immediately, then sync from backend
    setPinnedIds(readPinned(workspaceId));
    fetchPinnedProjects(workspaceId)
      .then((ids) => {
        setPinnedIds(ids);
        writePinned(workspaceId, ids);
      })
      .catch(() => {/* keep localStorage value on error */});
  }, [workspaceId]);

  useEffect(() => {
    if (wsLoading) return;

    if (workspaceId && !isDesignMode) {
      // Show cached data immediately
      const cached = readProjectsCache(workspaceId);
      if (cached && cached.data.length > 0) {
        setProjects(cached.data);
        setLoading(false);
      }

      // Fetch fresh in background
      setFetching(true);
      fetchProjects(workspaceId)
        .then((rows) => {
          const fresh = mapBackendProjects(rows);
          writeProjectsCache(workspaceId, fresh);
          setIsOutdated(false);
          // Only re-render if data actually changed
          setProjects(prev => isSameProjects(prev, fresh) ? prev : fresh);
          // Set loading=false in the same synchronous block as setProjects so React
          // batches both updates — prevents a flash of "No projects found" between
          // the two setState calls when no localStorage cache exists on hard refresh.
          setLoading(false);
        })
        .catch((err) => {
          console.error("projects refresh:", err);
          // Surface soft indicator only if cache is stale (> 5 min old)
          const age = cached ? Date.now() - cached.lastFetchedAt : Infinity;
          if (age > STALE_MS) setIsOutdated(true);
        })
        .finally(() => { setLoading(false); setFetching(false); });
    } else if (isDesignMode) {
      getProjects().then((data) => {
        setProjects(data);
      }).finally(() => { setLoading(false); setFetching(false); });
    } else {
      setLoading(false);
      // keep fetching=true — workspace will redirect to onboarding if truly no workspace
    }
  }, [workspaceId, wsLoading, isDesignMode]);

  const handleTogglePin = (id: string) => {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter(x => x !== id)
      : [id, ...pinnedIds];
    setPinnedIds(next);
    if (workspaceId) {
      writePinned(workspaceId, next);
      updatePinnedProjects(workspaceId, next).catch(() => {/* optimistic — ignore transient errors */});
    }
    setMenuOpenProjectId(null);
  };

  // Parallel prefetch: start fetchTasks as soon as workspaceId + projectId are known,
  // without waiting for fetchProjects to complete first.
  useEffect(() => {
    if (!workspaceId || !selectedProjectId || !isRealProject(selectedProjectId)) return;
    setPrefetchedTasks(null);
    fetchTasks(selectedProjectId, workspaceId)
      .then(t => setPrefetchedTasks(t))
      .catch(() => setPrefetchedTasks([]));
  }, [workspaceId, selectedProjectId]);

  const baseFiltered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? p.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });
  // Pinned projects float to top
  const filtered = [
    ...baseFiltered.filter(p => pinnedIds.includes(String(p.id))),
    ...baseFiltered.filter(p => !pinnedIds.includes(String(p.id))),
  ];

  const toggleStatusFilter = (status: string) =>
    setStatusFilter((prev) => (prev === status ? null : status));

  const selectedProject = selectedProjectId
    ? projects.find((p) => String(p.id) === selectedProjectId) ?? null
    : null;

  const selectProject = (id: string | number) => {
    router.push(`/dashboard/overview?projectId=${id}`);
  };

  const goBack = () => {
    router.push("/dashboard/overview");
  };

  const handleDeleteProject = async (p: Project) => {
    if (workspaceId && typeof p.id === "string") {
      try { await deleteProject(p.id); } catch (e) { console.error(e); }
    }
    setProjects(prev => prev.filter(x => x.id !== p.id));
    if (String(p.id) === selectedProjectId) goBack();
    setConfirmDeleteId(null);
    setMenuOpenProjectId(null);
  };


  if (loading || wsLoading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-1 h-20 bg-[#E2E8F0] rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-[#E2E8F0] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full relative">
      {selectedProjectId !== null ? (
        selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            onBack={goBack}
            wrapperClassName="max-w-7xl mx-auto"
            initialTasks={prefetchedTasks}
          />
        ) : (fetching || !workspaceId) ? (
          <div className="animate-pulse space-y-4 p-5">
            <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
            <div className="grid grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-[#E2E8F0] rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="text-[14px] text-[#64748B] mb-3">Project not found.</div>
            <button onClick={goBack} className="text-[13px] text-[#2563EB] font-semibold hover:underline cursor-pointer">← Back to all projects</button>
          </div>
        )
      ) : (
        <>
          {/* ── Soft outdated indicator ── */}
          {isOutdated && (
            <div className="mx-5 mt-4 px-3 py-1.5 bg-[#fff8c5] border border-[#d4a72c40] rounded-md text-[11px] text-[#9a6700] flex items-center gap-2">
              <span>⚠️</span>
              <span>Showing saved data · couldn't reach server</span>
            </div>
          )}

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <SectionTitle>Projects</SectionTitle>
              <p className="text-[13px] text-[#94A3B8] mt-0.5">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white min-w-[200px] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/10 transition-all shadow-sm">
                <Search size={13} className="text-[#94A3B8] shrink-0" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] border-none outline-none bg-transparent w-full"
                />
              </div>
              <Btn primary onClick={() => setIsCreateModalOpen(true)}>
                + New Project
              </Btn>
            </div>
          </div>

          {/* ── Summary Metrics ── */}
          <div className="flex gap-4 mb-6">
            <MetricCard
              label="Total Projects"
              value={projects.length}
              color="#0F172A"
              onClick={() => setStatusFilter(null)}
            />
            <MetricCard
              label="On Track"
              value={projects.filter((p) => p.status === "inProgress").length}
              color="#059669"
              onClick={() => toggleStatusFilter("inProgress")}
            />
            <MetricCard
              label="At Risk"
              value={projects.filter((p) => p.status === "runningLate").length}
              color="#D97706"
              onClick={() => toggleStatusFilter("runningLate")}
            />
            <MetricCard
              label="Delayed"
              value={projects.filter((p) => p.status === "delayed").length}
              color="#DC2626"
              onClick={() => toggleStatusFilter("delayed")}
            />
            <MetricCard
              label="Not Started"
              value={projects.filter((p) => p.status === "notStarted").length}
              color="#6366F1"
              onClick={() => toggleStatusFilter("notStarted")}
            />
          </div>

          {/* ── Project Grid ── */}
          {filtered.length === 0 ? (
            <Card className="!py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <Building2 size={40} className="mb-4 text-[#CBD5E1]" />
                <div className="text-[15px] font-semibold text-[#0F172A] mb-1.5">
                  {search ? "No projects match your search" : "No projects yet"}
                </div>
                <p className="text-[13px] text-[#94A3B8] mb-5">Get started by creating your first project.</p>
                {!search && (
                  <Btn primary onClick={() => setIsCreateModalOpen(true)}>
                    + Create Project
                  </Btn>
                )}
              </div>
            </Card>
          ) : (
            <>
            {menuOpenProjectId && (
              <div className="fixed inset-0 z-20" onClick={() => { setMenuOpenProjectId(null); setConfirmDeleteId(null); }} />
            )}
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm cursor-pointer hover:shadow-md hover:border-[#CBD5E1] transition-all relative overflow-visible group flex flex-col"
                >
                  {/* Status accent */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: STATUS_CONFIG[p.status].color }} />

                  {/* Header */}
                  <div className="flex justify-between items-start px-5 pt-5 pb-0 mt-1">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        {pinnedIds.includes(String(p.id)) && (
                          <Pin size={11} className="shrink-0 text-[#2563EB]" fill="#2563EB" />
                        )}
                        <div className="text-[15px] font-semibold text-[#0F172A] leading-snug group-hover:text-[#2563EB] transition-colors truncate">
                          {p.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-[#94A3B8] font-mono">{p.code}</span>
                        {p.stage && (
                          <span className="text-[10px] font-semibold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">{p.stage}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={p.status} />
                      {/* ⋮ menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setConfirmDeleteId(null); setMenuOpenProjectId(menuOpenProjectId === String(p.id) ? null : String(p.id)); }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {menuOpenProjectId === String(p.id) && (
                          <div className="absolute right-0 top-8 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-2xl py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                            {confirmDeleteId === String(p.id) ? (
                              <div className="px-3 py-2.5">
                                <div className="text-[11px] text-[#475569] font-semibold mb-2">Delete "{p.name}"?</div>
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleDeleteProject(p)} className="flex-1 py-1.5 text-[11px] font-bold bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors">Delete</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 text-[11px] font-bold bg-[#E2E8F0] text-[#475569] rounded-md transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => handleTogglePin(String(p.id))} className="w-full text-left px-3 py-2 text-[12px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors">
                                  {pinnedIds.includes(String(p.id))
                                    ? <><PinOff size={12} className="text-[#94A3B8]" /> Unpin Project</>
                                    : <><Pin size={12} className="text-[#94A3B8]" /> Pin Project</>
                                  }
                                </button>
                                <div className="my-1 border-t border-[#F1F5F9]" />
                                <button onClick={() => { setEditingProject(p); setMenuOpenProjectId(null); }} className="w-full text-left px-3 py-2 text-[12px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors">
                                  <Pencil size={12} className="text-[#94A3B8]" /> Edit Project
                                </button>
                                <div className="my-1 border-t border-[#F1F5F9]" />
                                <button onClick={() => setConfirmDeleteId(String(p.id))} className="w-full text-left px-3 py-2 text-[12px] text-[#DC2626] hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                                  <Trash2 size={12} /> Delete Project
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {p.address && (
                    <div className="px-5 mt-2 flex items-center gap-1.5">
                      <MapPin size={11} className="text-[#94A3B8] shrink-0" />
                      <span className="text-[12px] text-[#64748B] truncate">{p.address}</span>
                    </div>
                  )}

                  {/* Timeline + days remaining */}
                  <div className="px-5 mt-2 flex items-center gap-3 flex-wrap">
                    {p.startDate && p.endDate && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={11} className="text-[#94A3B8]" />
                        <span className="text-[11px] text-[#64748B] font-mono tabular-nums">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</span>
                      </div>
                    )}
                    {p.endDate && (() => {
                      const rem = Math.max(0, Math.round((new Date(p.endDate).getTime() - Date.now()) / 86_400_000));
                      const color = rem > 30 ? "#059669" : rem > 7 ? "#D97706" : "#DC2626";
                      return <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{rem}d left</span>;
                    })()}
                  </div>

                  {/* Progress */}
                  <div className="px-5 mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.06em]">Progress</span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: STATUS_CONFIG[p.status].color }}>{p.pct}%</span>
                    </div>
                    <ProgressBar pct={p.pct} status={p.status} height={6} />
                  </div>

                  {/* Chips: workers + issues */}
                  <div className="px-5 mt-3 flex items-center gap-2 flex-wrap">
                    {p.workers > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F8FAFC] text-[11px] text-[#475569] border border-[#E2E8F0]">
                        <Users size={10} className="text-[#94A3B8]" /> {p.workers} on-site
                      </span>
                    )}
                    {p.issues > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[11px] text-[#DC2626] font-semibold border border-[#FECACA]">
                        <AlertTriangle size={10} /> {p.issues} issues
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[11px] text-[#059669] font-semibold border border-[#A7F3D0] mt-2 mb-2">
                        <CheckCircle2 size={10} /> No issues
                      </span>
                    )}
                  </div>

                  {/* Footer quick actions — stopPropagation so card click doesn't fire */}
                  <div className="mt-auto px-4 py-2.5 border-t border-[#F1F5F9] mt-4 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    {[
                      { icon: <CalendarDays size={12} />, label: "Schedule",      href: `/dashboard/schedule/gantt` },
                      { icon: <ClipboardList size={12} />, label: "Daily Updates", href: `/dashboard/overview/daily-updates` },
                      { icon: <FileText size={12} />,      label: "DPR",           href: `/dashboard/dpr` },
                    ].map(({ icon, label, href }) => (
                      <button
                        key={label}
                        onClick={() => {
                          const endDateParam = p.endDate ? `&projectEndDate=${p.endDate}` : "";
                          const params = workspaceId ? `?projectId=${p.id}&workspaceId=${workspaceId}${endDateParam}` : `?projectId=${p.id}${endDateParam}`;
                          router.push(`${href}${params}`);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </>
      )}

      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(project) => {
            setProjects(prev => {
              const updated = [...prev, project];
              if (workspaceId) writeProjectsCache(workspaceId, updated);
              return updated;
            });
            setIsCreateModalOpen(false);
            selectProject(project.id);
            window.dispatchEvent(new CustomEvent("bluq_project_created"));
          }}
        />
      )}
      {editingProject && (
        <CreateProjectModal
          editingProject={editingProject}
          onClose={() => setEditingProject(null)}
          onCreate={() => {}}
          onUpdate={(updated) => {
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="p-5 animate-pulse space-y-4">
      <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="flex-1 h-20 bg-[#E2E8F0] rounded-lg" />)}
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-[#E2E8F0] rounded-lg" />)}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
