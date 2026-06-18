"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getScheduleTasks,
  getScheduleDeps,
  STATUS_CONFIG,
  type ScheduleTask,
  type TaskDependency,
} from "@/lib/mock-data";
import { Card, StatusBadge, Btn } from "@/components/ui/bluq-ui";
import { fetchTasks, fetchProject, isRealProject, createTask, updateTask, deleteTask } from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";
import { useScheduleVersion } from "@/hooks/useScheduleVersion";

const PHASE_ORDER = [
  "Surveys & Investigations","Regulatory Approvals","Land Acquisition","Site Preparation","Earthworks","Civil & Earthworks",
  "Portal Works","Tunnel Excavation","Primary Support","Waterproofing & Lining",
  "Foundation","Foundation & Piling","Reclamation",
  "Marine Works","Marine Structures","Quay & Berth",
  "Structure","Substructure","Superstructure","Viaduct",
  "Rail Infrastructure","Rail Siding","Bridges & Culverts","Stations","Track Works","Signalling & Telecom","Traction & Power","Depot",
  "Runway & Taxiway","Pavement","Pavement & Yard","Yard & Pavement","Road Connectivity","Road / Rail Finishing",
  "Storage Tanks","Pipeline & Piping","Civil Structures",
  "Terminal Buildings","Terminal Building","Warehouse & Sheds","Warehousing & Sheds","Customs Facilities","Intermodal Yard",
  "MEP & Safety","MEP","Mechanical Equipment","Piping & Valves","Fire & Safety Systems","Electrical & Instrumentation",
  "Systems & E&M","Systems & Technology","Systems & Gate","ATC Facilities",
  "Equipment Installation","Navigational Aids",
  "Structures","Deck & Finishes","Approaches","Drainage & Invert","Drainage","Perimeter & Security","Safety & Furniture","Toll & ITS","Utilities",
  "Finishing","Testing & Commissioning","Commissioning & Handover","Handover",
];

const PHASE_COLOR_MAP: Record<string, string> = {
  "Surveys & Investigations":"#64748B","Regulatory Approvals":"#E11D48","Land Acquisition":"#DC2626","Site Preparation":"#64748B",
  "Earthworks":"#B45309","Civil & Earthworks":"#B45309",
  "Portal Works":"#78716C","Tunnel Excavation":"#92400E","Primary Support":"#475569","Waterproofing & Lining":"#4B5563",
  "Foundation":"#78716C","Foundation & Piling":"#78716C","Reclamation":"#D97706",
  "Marine Works":"#0369A1","Marine Structures":"#0369A1","Quay & Berth":"#0891B2",
  "Structure":"#2563EB","Substructure":"#1D4ED8","Superstructure":"#4338CA","Viaduct":"#6D28D9",
  "Rail Infrastructure":"#334155","Rail Siding":"#334155","Bridges & Culverts":"#7C3AED","Stations":"#4338CA","Track Works":"#1E293B","Signalling & Telecom":"#6D28D9","Traction & Power":"#F97316","Depot":"#4B5563",
  "Runway & Taxiway":"#4338CA","Pavement":"#374151","Pavement & Yard":"#374151","Yard & Pavement":"#374151","Road Connectivity":"#374151","Road / Rail Finishing":"#374151",
  "Storage Tanks":"#C2410C","Pipeline & Piping":"#0F766E","Civil Structures":"#1D4ED8",
  "Terminal Buildings":"#7C3AED","Terminal Building":"#7C3AED",
  "Warehouse & Sheds":"#B45309","Warehousing & Sheds":"#B45309","Customs Facilities":"#DC2626","Intermodal Yard":"#374151",
  "MEP & Safety":"#0F766E","MEP":"#0F766E","Mechanical Equipment":"#C2410C","Piping & Valves":"#0F766E",
  "Fire & Safety Systems":"#B91C1C","Electrical & Instrumentation":"#6D28D9",
  "Systems & E&M":"#6D28D9","Systems & Technology":"#6D28D9","Systems & Gate":"#059669","ATC Facilities":"#6D28D9",
  "Equipment Installation":"#C2410C","Navigational Aids":"#2563EB",
  "Structures":"#1D4ED8","Deck & Finishes":"#7C3AED","Approaches":"#475569",
  "Drainage & Invert":"#0891B2","Drainage":"#0891B2","Perimeter & Security":"#475569","Safety & Furniture":"#CA8A04","Toll & ITS":"#059669","Utilities":"#0891B2",
  "Finishing":"#7C3AED","Testing & Commissioning":"#059669","Commissioning & Handover":"#059669","Handover":"#059669",
};
const DEFAULT_PHASE_COLOR = "#94A3B8";
type StatusKey = keyof typeof STATUS_CONFIG;
type StatusFilter = StatusKey | "All";

const effectiveStatus = (t: { status: string; pct: number; endDate?: string }): StatusKey => {
  if (t.status === "completed") return "completed";
  const today = new Date().toISOString().split("T")[0];
  if (t.endDate && t.pct < 100 && t.endDate < today) return "delayed";
  if (t.status === "notStarted" && t.pct > 0) return "inProgress";
  return t.status as StatusKey;
};

const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const avgPct = (ts: ScheduleTask[]) => {
  const parents = ts.filter(t => !t.parentTaskId);
  return parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
};

function ListViewPageContent() {
  const [tasks, setTasks]             = useState<ScheduleTask[]>([]);
  const [deps, setDeps]               = useState<TaskDependency[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [filterContractor, setFilterContractor] = useState("All");
  const [filterSpace, setFilterSpace] = useState("All");
  const [loading, setLoading]         = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    name: "", phase: "", space: "", contractor: "",
    startDate: "", endDate: "", pct: 0,
    status: "notStarted" as StatusKey,
  });
  const [modalError, setModalError] = useState("");
  const [menuOpenTaskId, setMenuOpenTaskId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [projectDates, setProjectDates] = useState<{ startDate: string | null; endDate: string | null }>({ startDate: null, endDate: null });

  const openAddModal = (ctx?: { phase?: string; space?: string }) => {
    setEditingTaskId(null);
    setNewTask({ name: "", phase: ctx?.phase ?? "", space: ctx?.space ?? "", contractor: "", startDate: "", endDate: "", pct: 0, status: "notStarted" });
    setModalError("");
    setIsModalOpen(true);
  };

  const openEditModal = (task: ScheduleTask) => {
    setEditingTaskId(task.id);
    setNewTask({ name: task.name, phase: task.phase || "", space: task.space || "", contractor: task.contractor || "", startDate: task.startDate, endDate: task.endDate, pct: task.pct, status: task.status });
    setModalError("");
    setIsModalOpen(true);
  };

  // 3-level collapse — all expanded by default
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedAreas,  setCollapsedAreas]  = useState<Set<string>>(new Set());
  const [collapsedTasks,  setCollapsedTasks]  = useState<Set<string>>(new Set());

  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;
  const { resolvedVersionId } = useScheduleVersion(projectIdParam, workspaceId, real);
  const selectedTaskData = tasks.find(t => t.id === selectedTask) ?? null;

  useEffect(() => {
    if (wsLoading) return;
    setLoading(true);
    const taskLoader = real
      ? fetchTasks(projectIdParam, workspaceId!, undefined, resolvedVersionId)
      : isDesignMode
        ? getScheduleTasks(Number(projectIdParam))
        : Promise.resolve([]);
    const depLoader = real || !isDesignMode
      ? Promise.resolve([])
      : getScheduleDeps(Number(projectIdParam));
    const projectLoader = real
      ? fetchProject(projectIdParam).then(p => setProjectDates({ startDate: p.startDate, endDate: p.endDate })).catch(() => {})
      : Promise.resolve();
    Promise.all([taskLoader, depLoader, projectLoader]).then(([t, d]) => {
      setTasks(t); setDeps(d); setLoading(false); setSelectedTask(null);
      setCollapsedPhases(new Set());
      setCollapsedAreas(new Set());
      setCollapsedTasks(new Set());
    });
  }, [projectIdParam, workspaceId, wsLoading, isDesignMode, resolvedVersionId]);

  // Refetch tasks when an import completes on the import-csv page
  const refetchTasks = useCallback(() => {
    if (!real) return;
    fetchTasks(projectIdParam, workspaceId!, undefined, resolvedVersionId).then(t => setTasks(t)).catch(console.error);
  }, [real, projectIdParam, workspaceId, resolvedVersionId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { projectId: pid } = (e as CustomEvent).detail;
      if (pid === projectIdParam) refetchTasks();
    };
    window.addEventListener("bluq_tasks_imported", handler);
    return () => window.removeEventListener("bluq_tasks_imported", handler);
  }, [projectIdParam, refetchTasks]);

  const togglePhase = (p: string) =>
    setCollapsedPhases(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  const toggleArea = (k: string) =>
    setCollapsedAreas(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });
  const toggleTask = (id: string) =>
    setCollapsedTasks(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = filteredTasks.filter(t => !t.parentTaskId).map(t => ({
        "WBS": wbsMap[t.id] ?? "",
        "Task Name": t.name,
        "Phase": t.phase ?? "",
        "Space": t.space ?? "",
        "Contractor": t.contractor ?? "",
        "Start Date": t.startDate,
        "End Date": t.endDate,
        "Duration": t.duration ?? "",
        "Progress %": t.pct,
        "Status": STATUS_CONFIG[t.status as StatusKey]?.label ?? t.status,
        "Delay": t.delay ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0] ?? {}).map(k => ({
        wch: Math.max(k.length, ...rows.map(r => String((r as Record<string, unknown>)[k] ?? "").length)) + 2,
      }));
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Schedule");
      XLSX.writeFile(wb, `schedule-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const contractorOptions = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.contractor && !t.parentTaskId).map(t => t.contractor))).sort()], [tasks]);
  const spaceOptions      = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.space && !t.parentTaskId).map(t => t.space))).sort()], [tasks]);

  const headerStats = useMemo(() => {
    const parents = tasks.filter(t => !t.parentTaskId);
    const completed   = parents.filter(t => effectiveStatus(t) === "completed").length;
    const inProgress  = parents.filter(t => effectiveStatus(t) === "inProgress").length;
    const runningLate = parents.filter(t => effectiveStatus(t) === "runningLate").length;
    const delayed     = parents.filter(t => effectiveStatus(t) === "delayed").length;
    const notStarted  = parents.filter(t => effectiveStatus(t) === "notStarted").length;
    const total       = parents.length;
    const overall     = total ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / total) : 0;
    const ends = parents.map(t => t.endDate).filter(Boolean).sort();
    const projectedEnd = ends.length > 0 ? ends[ends.length - 1] : "2026-09-30";
    return { completed, inProgress, runningLate, delayed, notStarted, total, overall, projectedEnd };
  }, [tasks]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const q = search.toLowerCase();
    if (!(t.name.toLowerCase().includes(q) || t.contractor?.toLowerCase().includes(q) || t.space?.toLowerCase().includes(q))) return false;
    if (t.parentTaskId) return true;
    if (filterContractor !== "All" && t.contractor !== filterContractor) return false;
    if (filterSpace      !== "All" && t.space       !== filterSpace)      return false;
    if (filterStatus !== "All" && effectiveStatus(t) !== filterStatus) return false;
    return true;
  }), [tasks, search, filterContractor, filterSpace, filterStatus]);

  // Phase → Area → Tasks
  const groupedData = useMemo(() => {
    const phaseMap: Record<string, Record<string, ScheduleTask[]>> = {};
    filteredTasks.filter(t => !t.parentTaskId).forEach(t => {
      const phase = t.phase || "Other";
      const area  = t.space  || "General";
      if (!phaseMap[phase]) phaseMap[phase] = {};
      if (!phaseMap[phase][area]) phaseMap[phase][area] = [];
      phaseMap[phase][area].push(t);
      filteredTasks.filter(s => s.parentTaskId === t.id).forEach(s => phaseMap[phase][area].push(s));
    });
    const toEntry = (k: string): [string, [string, ScheduleTask[]][]] =>
      [k, Object.entries(phaseMap[k])];
    const ordered = PHASE_ORDER.filter(p => phaseMap[p]).map(toEntry);
    const rest    = Object.keys(phaseMap).filter(k => !PHASE_ORDER.includes(k)).map(toEntry);
    return [...ordered, ...rest];
  }, [filteredTasks]);

  // WBS numbers
  const wbsMap = useMemo(() => {
    const m: Record<string, string> = {};
    let pi = 0;
    groupedData.forEach(([, areas]) => {
      pi++;
      let ai = 0;
      areas.forEach(([, ts]) => {
        ai++;
        let ti = 0;
        ts.filter(t => !t.parentTaskId).forEach(t => {
          ti++;
          const base = `${pi}.${ai}.${ti}`;
          m[t.id] = base;
          let si = 0;
          ts.filter(s => s.parentTaskId === t.id).forEach(s => { si++; m[s.id] = `${base}.${si}`; });
        });
      });
    });
    return m;
  }, [groupedData]);

  if (loading) return (
    <div className="p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-36 bg-[#E2E8F0] rounded" />
        <div className="h-[400px] bg-white border border-[#E2E8F0] rounded-lg" />
      </div>
    </div>
  );

  return (
    <div className="overflow-y-auto h-full bg-[#F8FAFC] flex flex-col">
      {/* Row 1: title + progress + handover */}
      <div className="px-4 py-2.5 border-b border-[#E2E8F0] bg-white flex items-center justify-between flex-wrap gap-3">
        <span className="text-[20px] font-bold text-[#0F172A]">List View</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Progress</span>
            <div className="w-[100px] h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div className="h-full bg-[#2563EB] transition-all" style={{ width: `${headerStats.overall}%` }} />
            </div>
            <span className="text-[13px] font-bold text-[#2563EB] tabular-nums">{headerStats.overall}%</span>
          </div>
          <div className="w-px h-4 bg-[#E2E8F0]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Projected Handover</span>
            <span className="text-[13px] font-bold text-[#0F172A]">
              {new Date(headerStats.projectedEnd).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: search + controls + add */}
      <div className="px-4 py-2 border-b border-[#E2E8F0] bg-white flex items-center justify-end gap-3">
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#2563EB] transition-all">
            <Search size={12} className="text-[#94A3B8] shrink-0" />
            <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
              className="text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] border-none outline-none bg-transparent w-40" />
          </div>
          <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)}
            className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-[#0F172A] border border-[#E2E8F0] rounded-md bg-white shadow-sm appearance-none cursor-pointer outline-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}>
            {contractorOptions.map(c => <option key={c} value={c}>{c === "All" ? "All Contractors" : c}</option>)}
          </select>
          <select value={filterSpace} onChange={e => setFilterSpace(e.target.value)}
            className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-[#0F172A] border border-[#E2E8F0] rounded-md bg-white shadow-sm appearance-none cursor-pointer outline-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}>
            {spaceOptions.map(s => <option key={s} value={s}>{s === "All" ? "All Spaces" : s}</option>)}
          </select>
          <div className="relative">
            {showExportMenu && (
              <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
            )}
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 h-8 text-[13px] font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-md shadow-sm hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <svg className="animate-spin w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
              )}
              {isExporting ? "Downloading…" : "Download"}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-[#94A3B8]"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {showExportMenu && !isExporting && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-1.5 z-30">
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Export as Excel
                </button>
              </div>
            )}
          </div>
          <Btn small primary onClick={openAddModal}>+ Add Task</Btn>
        </div>
      </div>

      {/* Row 3: status filters */}
      <div className="px-4 py-2 border-b border-[#E2E8F0] bg-white flex items-center gap-1 flex-wrap">
        {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => {
          const countMap: Record<StatusKey, number> = {
            completed: headerStats.completed, inProgress: headerStats.inProgress,
            runningLate: headerStats.runningLate, delayed: headerStats.delayed, notStarted: headerStats.notStarted,
          };
          const active = filterStatus === key;
          return (
            <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "All" : key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-all border ${active ? "border-current shadow-sm" : "border-transparent hover:border-[#E2E8F0]"}`}
              style={{ color: cfg.color, background: active ? `${cfg.color}15` : "transparent" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
              <span className="font-semibold tabular-nums">{countMap[key]}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
        {filterStatus !== "All" && (
          <button onClick={() => setFilterStatus("All")} className="ml-1 text-[10px] text-[#64748B] hover:text-[#1E293B] underline">Clear</button>
        )}
      </div>

      <div className="p-5 flex-1 overflow-y-auto">

      {/* Table */}
      <Card className="p-0 overflow-hidden shadow-sm border-[#E2E8F0]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              {["#", "Task Name", "Contractor", "Space", "Start", "End", "%", "Status", ""].map((label, i) => (
                <th key={i}
                  className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-[0.08em] whitespace-nowrap bg-[#F8FAFC] text-[#64748B]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[#475569]">No tasks match your search criteria.</td></tr>
            )}
            {groupedData.map(([phase, areas]) => {
              const phaseCollapsed = collapsedPhases.has(phase);
              const avg = avgPct(areas.flatMap(([, ts]) => ts));

              return (
                <React.Fragment key={`phase-${phase}`}>
                  <tr
                    className="bg-[#F1F5F9] border-b border-[#E2E8F0] cursor-pointer hover:bg-[#e8eaed] transition-colors"
                    onClick={() => togglePhase(phase)}>
                    <td className="py-2 text-[10px] text-[#94A3B8]" style={{ paddingLeft: 0 }}>
                      <div className="flex items-center h-full gap-2">
                        <div className="w-[3px] self-stretch rounded-r" style={{ background: PHASE_COLOR_MAP[phase] ?? DEFAULT_PHASE_COLOR, minHeight: 28 }} />
                        <span>{phaseCollapsed ? "▶" : "▼"}</span>
                      </div>
                    </td>
                    <td colSpan={5} className="px-4 py-2 font-semibold text-[#0F172A] text-[13px]">
                      {phase}
                      <span className="text-[#94A3B8] font-normal ml-2 text-[11px]">— {avg}% avg</span>
                    </td>
                    <td className="px-4 py-2">
                      {(() => { const c = PHASE_COLOR_MAP[phase] ?? DEFAULT_PHASE_COLOR; return (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${avg}%`, background: c }} />
                          </div>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: c }}>{avg}%</span>
                        </div>
                      ); })()}
                    </td>
                    <td colSpan={2} />
                  </tr>

                  {!phaseCollapsed && areas.map(([area, ts]) => {
                    const areaKey = `${phase}__${area}`;
                    const areaCollapsed = collapsedAreas.has(areaKey);
                    const areaAvg = avgPct(ts);
                    const showAreaRow = area !== "General" || areas.length > 1;

                    return (
                      <React.Fragment key={`area-${areaKey}`}>
                        {/* ── Area row — hidden when "General" is the only area ── */}
                        {showAreaRow && (
                        <tr
                          className="bg-[#f8fafc] border-b border-[#E2E8F0] cursor-pointer hover:bg-[#f0f6fc] transition-colors"
                          onClick={() => toggleArea(areaKey)}>
                          <td className="py-1.5 text-[9px] text-[#94A3B8] pl-8">
                            {areaCollapsed ? "▶" : "▼"}
                          </td>
                          <td colSpan={5} className="px-4 py-1.5 text-[12px] font-semibold text-[#475569]">
                            {area}
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${areaAvg}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-[#2563EB] tabular-nums">{areaAvg}%</span>
                            </div>
                          </td>
                          <td colSpan={2} />
                        </tr>
                        )}

                        {/* ── Task + sub-task rows ── */}
                        {(!showAreaRow || !areaCollapsed) && (
                        <>
                        {ts.filter(t => !t.parentTaskId).flatMap(t => {
                          const taskCollapsed = collapsedTasks.has(t.id);
                          const hasChildren   = ts.some(s => s.parentTaskId === t.id);
                          const sc = STATUS_CONFIG[t.status as StatusKey];
                          const rows = [];

                          rows.push(
                            <tr key={t.id}
                              onClick={() => setSelectedTask(selectedTask === t.id ? null : t.id)}
                              className={`border-b border-[#F1F5F9] cursor-pointer transition-colors group ${selectedTask === t.id ? "bg-[#EFF6FF]" : "bg-white hover:bg-[#F8FAFC]"}`}>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-[#94A3B8] w-3 text-center cursor-pointer"
                                    onClick={e => { e.stopPropagation(); if (hasChildren) toggleTask(t.id); }}>
                                    {hasChildren ? (taskCollapsed ? "▶" : "▼") : ""}
                                  </span>
                                  <span className="text-[10px] text-[#94A3B8] font-mono">{wbsMap[t.id]}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-[#0F172A] text-[13px]">
                                {t.name}
                                {t.delay && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                                    style={{ background: t.status === "delayed" ? "#FEF2F2" : "#FFFBEB", color: t.status === "delayed" ? "#DC2626" : "#D97706" }}>
                                    {t.delay}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-[#475569] text-[12px]">{t.contractor}</td>
                              <td className="px-4 py-2.5 text-[#475569] text-[12px]">{t.space}</td>
                              <td className="px-4 py-2.5 text-[12px] text-[#475569]">{fmtD(t.startDate)}</td>
                              <td className="px-4 py-2.5 text-[12px] text-[#475569]">{fmtD(t.endDate)}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: sc.color }} />
                                  </div>
                                  <span className="font-mono font-bold text-[11px]" style={{ color: sc.color }}>{t.pct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                              <td className="px-4 py-2.5 text-right relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setMenuOpenTaskId(menuOpenTaskId === t.id ? null : t.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors opacity-0 group-hover:opacity-100"
                                >⋮</button>
                                {menuOpenTaskId === t.id && (
                                  <>
                                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpenTaskId(null)} />
                                    <div className="absolute right-2 top-8 w-32 bg-white border border-[#E2E8F0] rounded-lg shadow-xl py-1 z-30">
                                      <button
                                        onClick={() => { openEditModal(t); setMenuOpenTaskId(null); }}
                                        className="w-full text-left px-3 py-1.5 text-[12px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2 transition-colors"
                                      >
                                        <Pencil size={11} className="text-[#94A3B8]" /> Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (real) deleteTask(t.id).catch(console.error);
                                          setTasks(p => p.filter(x => x.id !== t.id));
                                          setDeps(p => p.filter(d => d.from !== t.id && d.to !== t.id));
                                          if (selectedTask === t.id) setSelectedTask(null);
                                          setMenuOpenTaskId(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-red-50 flex items-center gap-2 transition-colors"
                                      >
                                        <Trash2 size={11} /> Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </td>
                            </tr>
                          );

                          if (!taskCollapsed) {
                            ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                              const ss = STATUS_CONFIG[s.status as StatusKey];
                              rows.push(
                                <tr key={s.id}
                                  onClick={() => setSelectedTask(selectedTask === s.id ? null : s.id)}
                                  className={`border-b border-[#F1F5F9] cursor-pointer transition-colors ${selectedTask === s.id ? "bg-[#EFF6FF]" : "bg-[#fafbfc] hover:bg-[#F1F5F9]"}`}>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1 pl-5">
                                      <span className="text-[10px] text-[#94A3B8] font-mono">{wbsMap[s.id]}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 pl-8">
                                    <span className="text-[#CBD5E1] mr-1.5 text-[12px]">└</span>
                                    <span className="text-[#475569] font-normal text-[12px]">{s.name}</span>
                                  </td>
                                  <td className="px-4 py-2 text-[#475569] text-[12px]">{s.contractor}</td>
                                  <td className="px-4 py-2 text-[#475569] text-[12px]">{s.space}</td>
                                  <td className="px-4 py-2 text-[12px] text-[#475569]">{fmtD(s.startDate)}</td>
                                  <td className="px-4 py-2 text-[12px] text-[#475569]">{fmtD(s.endDate)}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: ss.color }} />
                                      </div>
                                      <span className="font-mono font-bold text-[11px]" style={{ color: ss.color }}>{s.pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                                  <td />
                                </tr>
                              );
                            });
                          }
                          return rows;
                        })}
                        <tr key={`add-${areaKey}`} className="border-b border-[#F8FAFC]">
                          <td colSpan={9} className="px-4 py-1.5 pl-8">
                            <button
                              onClick={() => openAddModal({ phase, space: area })}
                              className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] hover:text-[#4F46E5] transition-colors group cursor-pointer"
                            >
                              <Plus size={11} className="group-hover:text-[#4F46E5]" />
                              Add task in {area}
                            </button>
                          </td>
                        </tr>
                        </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Side Panel */}
      {selectedTaskData && (
        <div className="fixed right-0 top-[57px] h-[calc(100%-57px)] w-[320px] bg-white border-l border-[#E2E8F0] shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-start">
            <div>
              <div className="text-[13px] font-semibold text-[#0F172A]">{selectedTaskData.name}</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">{selectedTaskData.phase} · {selectedTaskData.contractor} · {selectedTaskData.space}</div>
            </div>
            <button onClick={() => setSelectedTask(null)} className="text-[#94A3B8] hover:text-[#0F172A]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Status</div>
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: `${STATUS_CONFIG[selectedTaskData.status].color}18`, color: STATUS_CONFIG[selectedTaskData.status].color }}>
                {STATUS_CONFIG[selectedTaskData.status].label}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${selectedTaskData.pct}%`, background: STATUS_CONFIG[selectedTaskData.status].color }} />
                </div>
                <span className="text-[12px] font-bold font-mono" style={{ color: STATUS_CONFIG[selectedTaskData.status].color }}>{selectedTaskData.pct}%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Schedule</div>
              <div className="text-[12px] text-[#0F172A]">{fmtD(selectedTaskData.startDate)} → {fmtD(selectedTaskData.endDate)}</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">Duration: {selectedTaskData.duration}</div>
              {selectedTaskData.delay && (
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: "#FEF2F2", color: "#DC2626" }}>{selectedTaskData.delay}</span>
              )}
            </div>
            {deps.filter(d => d.to === selectedTaskData.id).length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Predecessors</div>
                {deps.filter(d => d.to === selectedTaskData.id).map((d, i) => (
                  <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#0F172A]">{tasks.find(t => t.id === d.from)?.name}</span>
                    <span className="text-[#94A3B8] font-mono">({d.type})</span>
                  </div>
                ))}
              </div>
            )}
            {deps.filter(d => d.from === selectedTaskData.id).length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Successors</div>
                {deps.filter(d => d.from === selectedTaskData.id).map((d, i) => (
                  <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#0F172A]">{tasks.find(t => t.id === d.to)?.name}</span>
                    <span className="text-[#94A3B8] font-mono">({d.type})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-[#E2E8F0] flex gap-2">
            <button onClick={() => openEditModal(selectedTaskData)} className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#EFF6FF] border border-[#2563EB] text-[#2563EB] hover:bg-[#b6e3ff] transition-colors">Edit</button>
            <button onClick={() => { if (window.confirm(`Delete "${selectedTaskData.name}"?`)) {
              if (real) deleteTask(selectedTaskData.id).catch(console.error);
              setTasks(p => p.filter(t => t.id !== selectedTaskData.id)); setDeps(p => p.filter(d => d.from !== selectedTaskData.id && d.to !== selectedTaskData.id)); setSelectedTask(null); }}}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#FEF2F2] border border-[#DC2626] text-[#DC2626] hover:bg-[#ffc1bd] transition-colors">Delete</button>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-bold text-[#0F172A]">{editingTaskId ? "Edit Task" : "Add New Task"}</h2>
              <button onClick={() => { setIsModalOpen(false); setModalError(""); }} className="text-[#475569] hover:text-[#0F172A]">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Task Name *</label>
                <input type="text" placeholder="e.g. Column Formwork Level 3"
                  value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]" />
              </div>

              {/* Phase + Space */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Phase *</label>
                  <select value={newTask.phase} onChange={e => setNewTask({ ...newTask, phase: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]">
                    <option value="">Select phase…</option>
                    {PHASE_ORDER.map(p =>
                      <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Space / Zone</label>
                  <input type="text" placeholder="e.g. Zone A — L3"
                    value={newTask.space} onChange={e => setNewTask({ ...newTask, space: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]" />
                </div>
              </div>

              {/* Contractor */}
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Contractor</label>
                <input type="text" placeholder="e.g. Rajesh Kumar"
                  value={newTask.contractor} onChange={e => setNewTask({ ...newTask, contractor: e.target.value })}
                  className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]" />
              </div>

              {/* Start + End */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Start Date *</label>
                  <input type="date" value={newTask.startDate}
                    min={projectDates.startDate || undefined}
                    max={newTask.endDate || undefined}
                    onChange={e => setNewTask({ ...newTask, startDate: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB] text-[#0F172A]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">End Date *</label>
                  <input type="date" value={newTask.endDate}
                    min={newTask.startDate || projectDates.startDate || undefined}
                    onChange={e => setNewTask({ ...newTask, endDate: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB] text-[#0F172A]" />
                </div>
              </div>

              {/* Status + % Complete */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">Status</label>
                  <select value={newTask.status} onChange={e => {
                    const s = e.target.value as StatusKey;
                    setNewTask({ ...newTask, status: s, pct: s === "completed" ? 100 : s === "notStarted" ? 0 : newTask.pct });
                  }}
                    className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]">
                    {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([k, v]) =>
                      <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">% Complete</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} step={5}
                      value={newTask.pct} onChange={e => {
                        const p = Number(e.target.value);
                        setNewTask({ ...newTask, pct: p, status: p === 100 ? "completed" : p === 0 ? "notStarted" : "inProgress" });
                      }}
                      className="flex-1 accent-[#2563EB]" />
                    <span className="text-[13px] font-bold font-mono text-[#2563EB] w-10 text-right">{newTask.pct}%</span>
                  </div>
                </div>
              </div>

              {modalError && <p className="text-[12px] text-[#DC2626] font-semibold">{modalError}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-2.5">
              <button onClick={() => { setIsModalOpen(false); setModalError(""); }}
                className="px-4 py-1.5 text-[13px] font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC]">Cancel</button>
              <button
                onClick={() => {
                  if (!newTask.name.trim()) return setModalError("Task name is required.");
                  if (!newTask.phase) return setModalError("Phase is required.");
                  if (!newTask.startDate || !newTask.endDate) return setModalError("Start and end dates are required.");
                  if (newTask.endDate < newTask.startDate) return setModalError("End date must be after start date.");
                  if (projectDates.startDate && newTask.startDate < projectDates.startDate) return setModalError(`Start date cannot be before project start (${projectDates.startDate}).`);

                  const days = Math.round((new Date(newTask.endDate).getTime() - new Date(newTask.startDate).getTime()) / 86400000);

                  if (editingTaskId) {
                    if (real) {
                      const statusMap: Record<string, string> = { notStarted: "not_started", inProgress: "in_progress", completed: "completed", runningLate: "running_late", delayed: "delayed" };
                      updateTask(editingTaskId, {
                        title: newTask.name.trim(),
                        status: statusMap[newTask.status] ?? "not_started",
                        startDate: newTask.startDate || null,
                        endDate: newTask.endDate || null,
                        percentComplete: String(newTask.pct),
                        contractor: newTask.contractor || null,
                        area: newTask.space || null,
                        phase: newTask.phase || null,
                      }).then(() => {
                        setTasks(prev => prev.map(t => t.id === editingTaskId ? {
                          ...t, name: newTask.name.trim(), phase: newTask.phase, space: newTask.space || "General",
                          contractor: newTask.contractor || "—", startDate: newTask.startDate, endDate: newTask.endDate,
                          duration: `${days}d`, pct: newTask.pct, status: newTask.status,
                        } : t));
                      }).catch(console.error);
                    } else {
                      setTasks(prev => prev.map(t => t.id === editingTaskId ? {
                        ...t, name: newTask.name.trim(), phase: newTask.phase, space: newTask.space || "General",
                        contractor: newTask.contractor || "—", startDate: newTask.startDate, endDate: newTask.endDate,
                        duration: `${days}d`, pct: newTask.pct, status: newTask.status,
                      } : t));
                    }
                  } else {
                    if (real) {
                      const statusMap: Record<string, string> = { notStarted: "not_started", inProgress: "in_progress", completed: "completed", runningLate: "running_late", delayed: "delayed" };
                      createTask({
                        workspaceId: workspaceId!,
                        projectId: projectIdParam,
                        title: newTask.name.trim(),
                        status: statusMap[newTask.status] ?? "not_started",
                        startDate: newTask.startDate || undefined,
                        endDate: newTask.endDate || undefined,
                        percentComplete: newTask.pct,
                        contractor: newTask.contractor || undefined,
                        area: newTask.space || undefined,
                        phase: newTask.phase || undefined,
                        scheduleVersionId: resolvedVersionId,
                      }).then(created => {
                        setTasks(prev => [...prev, {
                          id: created.id, projectId: 0, name: newTask.name.trim(), phase: newTask.phase,
                          space: newTask.space || "General", contractor: newTask.contractor || "—",
                          startDate: newTask.startDate, endDate: newTask.endDate, duration: `${days}d`,
                          pct: newTask.pct, status: newTask.status, critical: false, group: "",
                          delay: null, left: 0, width: 0, photos: [],
                        }]);
                      }).catch(console.error);
                    } else {
                      setTasks(prev => [...prev, {
                        id: `task_${Date.now()}`, projectId: Number(projectIdParam),
                        name: newTask.name.trim(), phase: newTask.phase, space: newTask.space || "General",
                        contractor: newTask.contractor || "—", startDate: newTask.startDate, endDate: newTask.endDate,
                        duration: `${days}d`, pct: newTask.pct, status: newTask.status,
                        critical: false, group: "", delay: null, left: 0, width: 0, photos: [],
                      }]);
                    }
                  }

                  setIsModalOpen(false);
                  setModalError("");
                  setEditingTaskId(null);
                  setNewTask({ name: "", phase: "", space: "", contractor: "", startDate: "", endDate: "", pct: 0, status: "notStarted" });
                }}
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] shadow-sm">
                {editingTaskId ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function ListViewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#94A3B8]">Loading...</div>}>
      <ListViewPageContent />
    </Suspense>
  );
}
