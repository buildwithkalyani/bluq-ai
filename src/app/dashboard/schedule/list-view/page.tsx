"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import {
  getScheduleTasks,
  getScheduleDeps,
  STATUS_CONFIG,
  type ScheduleTask,
  type TaskDependency,
} from "@/lib/mock-data";
import { Card, StatusBadge, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { fetchTasks, isRealProject, createTask, updateTask, deleteTask } from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";

const PHASE_ORDER = ["Site Preparation", "Foundation", "Structure", "MEP", "Finishing", "Handover"];
type StatusKey = keyof typeof STATUS_CONFIG;

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

  const openAddModal = () => {
    setEditingTaskId(null);
    setNewTask({ name: "", phase: "", space: "", contractor: "", startDate: "", endDate: "", pct: 0, status: "notStarted" });
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
  const { isDesignMode, workspaceId: ctxWorkspaceId } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const workspaceId = searchParams.get("workspaceId") ?? ctxWorkspaceId;
  const real = !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;
  const selectedTaskData = tasks.find(t => t.id === selectedTask) ?? null;

  useEffect(() => {
    setLoading(true);
    const taskLoader = real
      ? fetchTasks(projectIdParam, workspaceId!)
      : isDesignMode
        ? getScheduleTasks(Number(projectIdParam))
        : Promise.resolve([]);
    const depLoader = real || !isDesignMode
      ? Promise.resolve([])
      : getScheduleDeps(Number(projectIdParam));
    Promise.all([taskLoader, depLoader]).then(([t, d]) => {
      setTasks(t); setDeps(d); setLoading(false); setSelectedTask(null);
      setCollapsedPhases(new Set());
      setCollapsedAreas(new Set());
      setCollapsedTasks(new Set());
    });
  }, [projectIdParam, workspaceId]);

  const togglePhase = (p: string) =>
    setCollapsedPhases(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  const toggleArea = (k: string) =>
    setCollapsedAreas(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });
  const toggleTask = (id: string) =>
    setCollapsedTasks(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const contractorOptions = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.contractor && !t.parentTaskId).map(t => t.contractor))).sort()], [tasks]);
  const spaceOptions      = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.space && !t.parentTaskId).map(t => t.space))).sort()], [tasks]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const q = search.toLowerCase();
    if (!(t.name.toLowerCase().includes(q) || t.contractor?.toLowerCase().includes(q) || t.space?.toLowerCase().includes(q))) return false;
    if (t.parentTaskId) return true;
    if (filterContractor !== "All" && t.contractor !== filterContractor) return false;
    if (filterSpace      !== "All" && t.space       !== filterSpace)      return false;
    return true;
  }), [tasks, search, filterContractor, filterSpace]);

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
        <div className="h-6 w-36 bg-[#f0f1f3] rounded" />
        <div className="h-[400px] bg-[#f0f1f3] rounded-lg" />
      </div>
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa]">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4">
        <SectionTitle>Task List</SectionTitle>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 border border-[#D0D7DE] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#3A4EA2] transition-all">
            <span className="text-[12px] text-[#8C959F]">🔍</span>
            <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
              className="text-[13px] text-[#24292f] placeholder:text-[#8C959F] border-none outline-none bg-transparent w-40" />
          </div>
          <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)}
            className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-[#24292f] border border-[#D0D7DE] rounded-md bg-white shadow-sm appearance-none cursor-pointer outline-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}>
            {contractorOptions.map(c => <option key={c} value={c}>{c === "All" ? "All Contractors" : c}</option>)}
          </select>
          <select value={filterSpace} onChange={e => setFilterSpace(e.target.value)}
            className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-[#24292f] border border-[#D0D7DE] rounded-md bg-white shadow-sm appearance-none cursor-pointer outline-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}>
            {spaceOptions.map(s => <option key={s} value={s}>{s === "All" ? "All Spaces" : s}</option>)}
          </select>
          <Btn small primary onClick={openAddModal}>+ Add Task</Btn>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden shadow-sm border-[#D0D7DE]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#f6f8fa] border-b border-[#e1e4e8]">
              {["#", "Task Name", "Contractor", "Space", "Start", "End", "%", "Status", ""].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left font-bold text-[#57606a] text-[11px] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[#57606a]">No tasks match your search criteria.</td></tr>
            )}
            {groupedData.map(([phase, areas]) => {
              const phaseCollapsed = collapsedPhases.has(phase);
              const avg = avgPct(areas.flatMap(([, ts]) => ts));

              return (
                <>
                  {/* ── Phase row ── */}
                  <tr key={`phase-${phase}`}
                    className="bg-[#f0f1f3] border-b border-[#e1e4e8] cursor-pointer hover:bg-[#e8eaed] transition-colors"
                    onClick={() => togglePhase(phase)}>
                    <td className="px-4 py-2 text-[10px] text-[#8C959F]">
                      {phaseCollapsed ? "▶" : "▼"}
                    </td>
                    <td colSpan={5} className="px-4 py-2 font-semibold text-[#24292f] text-[12px]">
                      {phase}
                      <span className="text-[#8C959F] font-normal ml-2 text-[11px]">— {avg}% avg</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#3A4EA2]" style={{ width: `${avg}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#3A4EA2] tabular-nums">{avg}%</span>
                      </div>
                    </td>
                    <td colSpan={2} />
                  </tr>

                  {!phaseCollapsed && areas.map(([area, ts]) => {
                    const areaKey = `${phase}__${area}`;
                    const areaCollapsed = collapsedAreas.has(areaKey);
                    const areaAvg = avgPct(ts);

                    return (
                      <>
                        {/* ── Area row ── */}
                        <tr key={`area-${areaKey}`}
                          className="bg-[#f8fafc] border-b border-[#e1e4e8] cursor-pointer hover:bg-[#f0f6fc] transition-colors"
                          onClick={() => toggleArea(areaKey)}>
                          <td className="py-1.5 text-[9px] text-[#8C959F] pl-8">
                            {areaCollapsed ? "▶" : "▼"}
                          </td>
                          <td colSpan={5} className="px-4 py-1.5 text-[11px] font-semibold text-[#57606a]">
                            {area}
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#3A4EA2]" style={{ width: `${areaAvg}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-[#3A4EA2] tabular-nums">{areaAvg}%</span>
                            </div>
                          </td>
                          <td colSpan={2} />
                        </tr>

                        {/* ── Task + sub-task rows ── */}
                        {!areaCollapsed && ts.filter(t => !t.parentTaskId).flatMap(t => {
                          const taskCollapsed = collapsedTasks.has(t.id);
                          const hasChildren   = ts.some(s => s.parentTaskId === t.id);
                          const sc = STATUS_CONFIG[t.status as StatusKey];
                          const rows = [];

                          rows.push(
                            <tr key={t.id}
                              onClick={() => setSelectedTask(selectedTask === t.id ? null : t.id)}
                              className={`border-b border-[#f0f1f3] cursor-pointer transition-colors group ${selectedTask === t.id ? "bg-[#ddf4ff]" : "bg-white hover:bg-[#f6f8fa]"}`}>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-[#8C959F] w-3 text-center cursor-pointer"
                                    onClick={e => { e.stopPropagation(); if (hasChildren) toggleTask(t.id); }}>
                                    {hasChildren ? (taskCollapsed ? "▶" : "▼") : ""}
                                  </span>
                                  <span className="text-[10px] text-[#8C959F] font-mono">{wbsMap[t.id]}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-[#24292f] text-[12px]">
                                {t.name}
                                {t.delay && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                                    style={{ background: t.status === "delayed" ? "#ffebe9" : "#fff8c5", color: t.status === "delayed" ? "#CF222E" : "#9A6700" }}>
                                    {t.delay}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-[#57606a] text-[11px]">{t.contractor}</td>
                              <td className="px-4 py-2.5 text-[#57606a] text-[11px]">{t.space}</td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-[#57606a]">{t.startDate}</td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-[#57606a]">{t.endDate}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-[#e1e4e8] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: sc.color }} />
                                  </div>
                                  <span className="font-mono font-bold text-[11px]" style={{ color: sc.color }}>{t.pct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                              <td className="px-4 py-2.5 text-[#8C959F] text-right group-hover:text-[#24292f]">⋮</td>
                            </tr>
                          );

                          if (!taskCollapsed) {
                            ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                              const ss = STATUS_CONFIG[s.status as StatusKey];
                              rows.push(
                                <tr key={s.id}
                                  onClick={() => setSelectedTask(selectedTask === s.id ? null : s.id)}
                                  className={`border-b border-[#f0f1f3] cursor-pointer transition-colors ${selectedTask === s.id ? "bg-[#ddf4ff]" : "bg-[#fafbfc] hover:bg-[#f0f1f3]"}`}>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1 pl-5">
                                      <span className="text-[10px] text-[#8C959F] font-mono">{wbsMap[s.id]}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 pl-8">
                                    <span className="text-gray-300 mr-1.5 text-[11px]">└</span>
                                    <span className="text-[#57606a] font-normal text-[11px]">{s.name}</span>
                                  </td>
                                  <td className="px-4 py-2 text-[#57606a] text-[11px]">{s.contractor}</td>
                                  <td className="px-4 py-2 text-[#57606a] text-[11px]">{s.space}</td>
                                  <td className="px-4 py-2 font-mono text-[11px] text-[#57606a]">{s.startDate}</td>
                                  <td className="px-4 py-2 font-mono text-[11px] text-[#57606a]">{s.endDate}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 h-1.5 bg-[#e1e4e8] rounded-full overflow-hidden">
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
                      </>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Side Panel */}
      {selectedTaskData && (
        <div className="fixed right-0 top-0 h-full w-[320px] bg-white border-l border-[#D0D7DE] shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b border-[#D0D7DE] flex justify-between items-start">
            <div>
              <div className="text-[13px] font-semibold text-[#24292f]">{selectedTaskData.name}</div>
              <div className="text-[11px] text-[#8C959F] mt-0.5">{selectedTaskData.phase} · {selectedTaskData.contractor} · {selectedTaskData.space}</div>
            </div>
            <button onClick={() => setSelectedTask(null)} className="text-[#8C959F] hover:text-[#24292f]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Status</div>
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: `${STATUS_CONFIG[selectedTaskData.status].color}18`, color: STATUS_CONFIG[selectedTaskData.status].color }}>
                {STATUS_CONFIG[selectedTaskData.status].label}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#e1e4e8] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${selectedTaskData.pct}%`, background: STATUS_CONFIG[selectedTaskData.status].color }} />
                </div>
                <span className="text-[12px] font-bold font-mono" style={{ color: STATUS_CONFIG[selectedTaskData.status].color }}>{selectedTaskData.pct}%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Schedule</div>
              <div className="text-[12px] text-[#24292f]">{selectedTaskData.startDate} → {selectedTaskData.endDate}</div>
              <div className="text-[11px] text-[#8C959F] mt-0.5">Duration: {selectedTaskData.duration}</div>
              {selectedTaskData.delay && (
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: "#ffebe9", color: "#CF222E" }}>{selectedTaskData.delay}</span>
              )}
            </div>
            {deps.filter(d => d.to === selectedTaskData.id).length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Predecessors</div>
                {deps.filter(d => d.to === selectedTaskData.id).map((d, i) => (
                  <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#f0f1f3]">
                    <span className="text-[#24292f]">{tasks.find(t => t.id === d.from)?.name}</span>
                    <span className="text-[#8C959F] font-mono">({d.type})</span>
                  </div>
                ))}
              </div>
            )}
            {deps.filter(d => d.from === selectedTaskData.id).length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Successors</div>
                {deps.filter(d => d.from === selectedTaskData.id).map((d, i) => (
                  <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#f0f1f3]">
                    <span className="text-[#24292f]">{tasks.find(t => t.id === d.to)?.name}</span>
                    <span className="text-[#8C959F] font-mono">({d.type})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-[#D0D7DE] flex gap-2">
            <button onClick={() => openEditModal(selectedTaskData)} className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#ddf4ff] border border-[#3A4EA2] text-[#3A4EA2] hover:bg-[#b6e3ff] transition-colors">Edit</button>
            <button onClick={() => { if (window.confirm(`Delete "${selectedTaskData.name}"?`)) {
              if (real) deleteTask(selectedTaskData.id).catch(console.error);
              setTasks(p => p.filter(t => t.id !== selectedTaskData.id)); setDeps(p => p.filter(d => d.from !== selectedTaskData.id && d.to !== selectedTaskData.id)); setSelectedTask(null); }}}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#ffebe9] border border-[#CF222E] text-[#CF222E] hover:bg-[#ffc1bd] transition-colors">Delete</button>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#e1e4e8]">
              <h2 className="text-[15px] font-bold text-[#24292f]">{editingTaskId ? "Edit Task" : "Add New Task"}</h2>
              <button onClick={() => { setIsModalOpen(false); setModalError(""); }} className="text-[#57606a] hover:text-[#24292f]">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Task Name *</label>
                <input type="text" placeholder="e.g. Column Formwork Level 3"
                  value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]" />
              </div>

              {/* Phase + Space */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Phase *</label>
                  <select value={newTask.phase} onChange={e => setNewTask({ ...newTask, phase: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]">
                    <option value="">Select phase…</option>
                    {["Site Preparation","Foundation","Structure","MEP","Finishing","Handover"].map(p =>
                      <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Space / Zone</label>
                  <input type="text" placeholder="e.g. Zone A — L3"
                    value={newTask.space} onChange={e => setNewTask({ ...newTask, space: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]" />
                </div>
              </div>

              {/* Contractor */}
              <div>
                <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Contractor</label>
                <input type="text" placeholder="e.g. Rajesh Kumar"
                  value={newTask.contractor} onChange={e => setNewTask({ ...newTask, contractor: e.target.value })}
                  className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]" />
              </div>

              {/* Start + End */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Start Date *</label>
                  <input type="date" value={newTask.startDate} onChange={e => setNewTask({ ...newTask, startDate: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2] text-[#24292f]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">End Date *</label>
                  <input type="date" value={newTask.endDate} onChange={e => setNewTask({ ...newTask, endDate: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2] text-[#24292f]" />
                </div>
              </div>

              {/* Status + % Complete */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Status</label>
                  <select value={newTask.status} onChange={e => setNewTask({ ...newTask, status: e.target.value as StatusKey })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]">
                    {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([k, v]) =>
                      <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">% Complete</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} step={5}
                      value={newTask.pct} onChange={e => setNewTask({ ...newTask, pct: Number(e.target.value) })}
                      className="flex-1 accent-[#3A4EA2]" />
                    <span className="text-[13px] font-bold font-mono text-[#3A4EA2] w-10 text-right">{newTask.pct}%</span>
                  </div>
                </div>
              </div>

              {modalError && <p className="text-[12px] text-[#CF222E] font-semibold">{modalError}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[#e1e4e8] bg-[#f6f8fa] flex justify-end gap-2.5">
              <button onClick={() => { setIsModalOpen(false); setModalError(""); }}
                className="px-4 py-1.5 text-[13px] font-semibold text-[#24292f] bg-white border border-[#D0D7DE] rounded-md hover:bg-[#f6f8fa]">Cancel</button>
              <button
                onClick={() => {
                  if (!newTask.name.trim()) return setModalError("Task name is required.");
                  if (!newTask.phase) return setModalError("Phase is required.");
                  if (!newTask.startDate || !newTask.endDate) return setModalError("Start and end dates are required.");
                  if (newTask.endDate < newTask.startDate) return setModalError("End date must be after start date.");

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
                      }).then(updated => {
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
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#3A4EA2] rounded-md hover:bg-[#0353A4] shadow-sm">
                {editingTaskId ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ListViewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8C959F]">Loading...</div>}>
      <ListViewPageContent />
    </Suspense>
  );
}
