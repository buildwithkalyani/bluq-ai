"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getScheduleTasks, getScheduleDeps, type ScheduleTask, type TaskDependency } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// Data & Types
// ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  completed:   { color: "#22c55e", label: "Completed" },
  inProgress:  { color: "#3b82f6", label: "In progress" },
  runningLate: { color: "#d97706", label: "Running late" },
  delayed:     { color: "#ef4444", label: "Delayed" },
  notStarted:  { color: "#94a3b8", label: "Not started" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

interface Project {
  id: string;
  name: string;
}

const ROW_H = 48;
const GROUP_H = 32;
const HEADER_H = 44; 
const TIMELINE_LEFT_OFFSET = 200;

// ─────────────────────────────────────────────────────────────
// Date Math Utilities
// ─────────────────────────────────────────────────────────────
const MS_PER_DAY = 86400000;
const parseDate = (d: string) => new Date(d).getTime();
const diffDays = (d1: string, d2: string) => Math.round((parseDate(d2) - parseDate(d1)) / MS_PER_DAY);
const addDays = (d: string, days: number) => {
  const date = new Date(parseDate(d) + days * MS_PER_DAY);
  return date.toISOString().split("T")[0];
};
const formatDateStr = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const getMonthName = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ─────────────────────────────────────────────────────────────
// Critical Path Calculation (FINAL FIXED VERSION)
// ─────────────────────────────────────────────────────────────
function calculateCriticalPath(tasks: ScheduleTask[], deps: TaskDependency[]): Set<string> {
  if (tasks.length === 0) return new Set();

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const graph: Record<string, string[]> = {};
  const durationMap = new Map(tasks.map(t => [t.id, diffDays(t.startDate, t.endDate)]));

  // Build successor graph
  tasks.forEach(t => {
    graph[t.id] = [];
  });

  deps.forEach(dep => {
    if (graph[dep.from]) {
      graph[dep.from].push(dep.to);
    }
  });

  // Memoized longest path from any task
  const memo = new Map<string, number>();

  function longestPathFrom(taskId: string): number {
    if (memo.has(taskId)) return memo.get(taskId)!;

    let max = durationMap.get(taskId) || 0;
    for (const nextId of graph[taskId] || []) {
      max = Math.max(max, (durationMap.get(taskId) || 0) + longestPathFrom(nextId));
    }

    memo.set(taskId, max);
    return max;
  }

  // Find the starting task of the longest path
  let maxTotalDuration = -1;
  let startTaskId: string | null = null;

  tasks.forEach(task => {
    const pathLength = longestPathFrom(task.id);
    if (pathLength > maxTotalDuration) {
      maxTotalDuration = pathLength;
      startTaskId = task.id;
    }
  });

  // Trace the critical path
  const criticalTasks = new Set<string>();
  let current: string | null = startTaskId;

  while (current !== null) {
    criticalTasks.add(current);

    const successors = deps.filter(d => d.from === current);
    if (successors.length === 0) break;

    let bestNext: string | null = null;
    let bestLength = -1;

    for (const succ of successors) {
      const remainingLength = longestPathFrom(succ.to);
      if (remainingLength > bestLength) {
        bestLength = remainingLength;
        bestNext = succ.to;
      }
    }

    if (bestNext === null) break;
    current = bestNext;
  }

  return criticalTasks;
}
// ─────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────
function GanttRow({ t, selected, chartStart, pixelsPerDay, onSelect, onUpdateDates, highlightCritical, isOnCriticalPath, showCriticalPath }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ mode: "move", startX: 0, initStart: "", initEnd: "" });

  const leftPx = diffDays(chartStart, t.startDate) * pixelsPerDay;
  const widthPx = Math.max(4, diffDays(t.startDate, t.endDate) * pixelsPerDay);

  const handleMouseDown = (mode: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { mode, startX: e.clientX, initStart: t.startDate, initEnd: t.endDate };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaDays = Math.round((e.clientX - dragRef.current.startX) / pixelsPerDay);
      let newStart = dragRef.current.initStart;
      let newEnd = dragRef.current.initEnd;

      if (dragRef.current.mode === "move") {
        newStart = addDays(dragRef.current.initStart, deltaDays);
        newEnd = addDays(dragRef.current.initEnd, deltaDays);
      } else if (dragRef.current.mode === "left") {
        newStart = addDays(dragRef.current.initStart, deltaDays);
        if (parseDate(newStart) >= parseDate(newEnd)) newStart = addDays(newEnd, -1);
      } else if (dragRef.current.mode === "right") {
        newEnd = addDays(dragRef.current.initEnd, deltaDays);
        if (parseDate(newEnd) <= parseDate(newStart)) newEnd = addDays(newStart, 1);
      }
      onUpdateDates(t.id, newStart, newEnd);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, t, onUpdateDates, pixelsPerDay]);

  const sc = STATUS_CONFIG[t.status as StatusKey];
  const isCrit = (t.critical && highlightCritical) || (showCriticalPath && isOnCriticalPath);

  const opacity = showCriticalPath && !isOnCriticalPath ? 0.35 : 1;

  return (
    <div 
      onClick={onSelect} 
      className={`flex border-b border-gray-200 cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`} 
      style={{ height: ROW_H, width: '100%', opacity }}
    >
      <div className="relative w-full h-full">
        <div 
          className="absolute h-5 rounded-[3px] flex items-center justify-end pr-1 cursor-grab active:cursor-grabbing select-none transition-all"
          style={{ 
            top: 14, 
            left: leftPx, 
            width: widthPx, 
            background: isCrit ? "#ef4444" : sc.color,
            boxShadow: isCrit ? "0 0 0 3px #ef444466" : "none",
            opacity 
          }}
          onMouseDown={handleMouseDown("move")}
        >
          <div onMouseDown={handleMouseDown("left")} className="absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-l" />
          {t.pct > 12 && widthPx > 30 && <span className="text-[9px] font-semibold text-white pointer-events-none">{t.pct}%</span>}
          <div onMouseDown={handleMouseDown("right")} className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-r" />
        </div>
      </div>
    </div>
  );
}

function SVGArrows({ deps, tasks, taskYMap, chartStart, pixelsPerDay, totalH, highlightCritical, showCriticalPath, criticalPathTasks }: any) {
  return (
    <svg className="absolute top-0 pointer-events-none z-[4] overflow-visible" style={{ left: 0, width: "100%", height: totalH }}>
      <defs>
        <marker id="mc" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="#ef4444" /></marker>
        <marker id="mn" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="#94a3b8" /></marker>
      </defs>
      {deps.map((dep: any, i: number) => {
        const fromT = tasks.find((t: any) => t.id === dep.from);
        const toT = tasks.find((t: any) => t.id === dep.to);
        if (!fromT || !toT || taskYMap[dep.from] === undefined || taskYMap[dep.to] === undefined) return null;

        const isOnCritical = showCriticalPath && criticalPathTasks.has(dep.from) && criticalPathTasks.has(dep.to);
        const isOldCrit = fromT.critical && toT.critical && highlightCritical && !showCriticalPath;

        const color = isOnCritical || isOldCrit ? "#ef4444" : "#94a3b8";
        const strokeWidth = (isOnCritical || isOldCrit) ? 2.5 : 1;
        const opacity = showCriticalPath && !isOnCritical ? 0.25 : 0.85;

        const startX1 = diffDays(chartStart, fromT.startDate) * pixelsPerDay;
        const endX1 = diffDays(chartStart, fromT.endDate) * pixelsPerDay;
        const startX2 = diffDays(chartStart, toT.startDate) * pixelsPerDay;
        const endX2 = diffDays(chartStart, toT.endDate) * pixelsPerDay;

        let x1, x2;
        if (dep.type === "FS") { x1 = endX1; x2 = startX2; }
        else if (dep.type === "SS") { x1 = startX1; x2 = startX2; }
        else if (dep.type === "FF") { x1 = endX1; x2 = endX2; }
        else { x1 = startX1; x2 = endX2; } 

        const y1 = taskYMap[dep.from] + 24;
        const y2 = taskYMap[dep.to] + 24;
        let elbow = x1 + 16;
        if (dep.type === "SS" || dep.type === "SF") elbow = Math.min(x1, x2) - 16;
        if (dep.type === "FF") elbow = Math.max(x1, x2) + 16;

        return (
          <g key={i} opacity={opacity}>
            <circle cx={x1} cy={y1} r="3" fill={color} />
            <polyline 
              points={`${x1},${y1} ${elbow},${y1} ${elbow},${y2} ${x2},${y2}`} 
              fill="none" 
              stroke={color} 
              strokeWidth={strokeWidth} 
              strokeDasharray={isOnCritical || isOldCrit ? "" : "4 3"} 
              markerEnd={isOnCritical || isOldCrit ? "url(#mc)" : "url(#mn)"} 
            />
          </g>
        );
      })}
    </svg>
  );
}

function TaskDetailPanel({ task, deps, tasks, onClose, onEditClick, onDelete, criticalPathTasks }: any) {
  const sc = STATUS_CONFIG[task.status as StatusKey];
  const predecessors = deps.filter((d: any) => d.to === task.id);
  const successors = deps.filter((d: any) => d.from === task.id);

  // Compute days late: if endDate is past today and task isn't completed
  const today = new Date().toISOString().split("T")[0];
  const durationDays = diffDays(task.startDate, task.endDate);
  const daysLate = task.status !== "completed" && parseDate(task.endDate) < parseDate(today)
    ? diffDays(task.endDate, today)
    : 0;

  const isOnCritical = criticalPathTasks?.has(task.id) || task.critical;

  return (
    <div className="w-[320px] border-l border-gray-200 flex flex-col shrink-0 bg-white h-full z-20">
      <div className="p-3 px-3.5 border-b border-gray-200 flex justify-between items-start">
        <div>
          <div className="text-[13px] font-medium text-gray-900">{task.name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{task.contractor} · {task.space}</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {/* Site Photo */}
      <div className="px-3.5 pt-4">
        <img 
          src="https://picsum.photos/id/1015/600/240" 
          alt="Site Photo"
          className="w-full h-44 object-cover rounded-2xl shadow-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Status */}
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Status</div>
          <span className="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: `${sc.color}15`, color: sc.color }}>{sc.label}</span>
        </div>

        {/* Progress */}
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Progress</div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all" 
                style={{ width: `${task.pct ?? 0}%`, background: sc.color }} 
              />
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: sc.color }}>{task.pct ?? 0}%</span>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Schedule</div>
          <div className="text-[13px] font-medium text-gray-900">
            {formatDateStr(task.startDate)} → {formatDateStr(task.endDate)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Duration: {durationDays}d</div>
          {daysLate > 0 && (
            <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100">
              {daysLate}d late
            </span>
          )}
        </div>

        {/* Critical Path */}
        {isOnCritical && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Critical Path</div>
            <span className="text-[12px] font-semibold text-red-500 flex items-center gap-1">
              ⚠ On Critical Path
            </span>
          </div>
        )}

        {/* Predecessors */}
        {predecessors.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Predecessors</div>
            {predecessors.map((d: any) => (
              <div key={d.from} className="text-[11px] text-gray-600 py-1.5 border-b border-gray-100 flex justify-between items-center">
                <span className="font-medium">{tasks.find((t: any) => t.id === d.from)?.name}</span>
                <span className="text-gray-400 font-mono text-[10px]">( {d.type} )</span>
              </div>
            ))}
          </div>
        )}

        {/* Successors */}
        {successors.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Successors</div>
            {successors.map((d: any) => (
              <div key={d.to} className="text-[11px] text-gray-600 py-1.5 border-b border-gray-100 flex justify-between items-center">
                <span className="font-medium">{tasks.find((t: any) => t.id === d.to)?.name}</span>
                <span className="text-gray-400 font-mono text-[10px]">( {d.type} )</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 flex gap-2">
        <button onClick={onEditClick} className="flex-1 py-1.5 text-[12px] rounded-md bg-blue-50 text-blue-600 border border-blue-200 font-semibold">Edit</button>
        <button onClick={() => { if(window.confirm("Delete?")) onDelete(task.id); }} className="flex-1 py-1.5 text-[12px] rounded-md bg-red-50 text-red-600 border border-red-200 font-semibold">Delete</button>
      </div>
    </div>
  );
}

function TaskModal({ isOpen, mode, task, tasks, deps, onClose, onSave, onDelete }: any) {
  const [formData, setFormData] = useState({ name: "", contractor: "", space: "", startDate: "", endDate: "" });
  const [selectedPreds, setSelectedPreds] = useState<{id: string, type: string}[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && task) {
        setFormData({ name: task.name, contractor: task.contractor || "", space: task.space || "", startDate: task.startDate, endDate: task.endDate });
        setSelectedPreds(deps.filter((d: any) => d.to === task.id).map((d: any) => ({ id: d.from, type: d.type })));
      } else {
        setFormData({ name: "", contractor: "", space: "", startDate: "", endDate: "" });
        setSelectedPreds([]);
      }
    }
  }, [isOpen, mode, task, deps]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData, selectedPreds); onClose(); };
  const togglePred = (id: string) => setSelectedPreds(p => p.find(x => x.id === id) ? p.filter(x => x.id !== id) : [...p, { id, type: "FS" }]);
  const changePredType = (id: string, type: string) => setSelectedPreds(p => p.map(x => x.id === id ? { ...x, type } : x));

  return (
    <div className="fixed inset-0 bg-gray-900/40 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between"><h2 className="text-[15px] font-semibold">{mode === "add" ? "Create Task" : "Edit Task"}</h2><button onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div><label className="text-[11px] text-gray-500 uppercase">Name</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded text-[13px] mt-1" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[11px] text-gray-500 uppercase">Start (YYYY-MM-DD)</label><input required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border p-2 rounded text-[13px] mt-1" /></div>
            <div><label className="text-[11px] text-gray-500 uppercase">End (YYYY-MM-DD)</label><input required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full border p-2 rounded text-[13px] mt-1" /></div>
          </div>
          <div><label className="text-[11px] text-gray-500 uppercase mb-2 block">Dependencies</label>
            <div className="border p-2 rounded max-h-40 overflow-y-auto space-y-1">
              {tasks.filter((t:any) => t.id !== task?.id).map((t:any) => {
                const sel = selectedPreds.find(p => p.id === t.id);
                return (
                  <div key={t.id} className="flex justify-between p-1 hover:bg-gray-50 rounded">
                    <label className="flex gap-2 text-[12px] items-center"><input type="checkbox" checked={!!sel} onChange={() => togglePred(t.id)} /> {t.name}</label>
                    {sel && <select value={sel.type} onChange={e => changePredType(t.id, e.target.value)} className="text-[11px] border rounded"><option value="FS">FS</option><option value="SS">SS</option><option value="FF">FF</option><option value="SF">SF</option></select>}
                  </div>
                )
              })}
            </div>
          </div>
        </form>
        <div className="px-5 py-4 border-t flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-[12px] border rounded bg-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-[12px] bg-[#2563eb] text-white rounded">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Zoom Presets
// ─────────────────────────────────────────────────────────────
const ZOOM_PRESETS = [
  { label: "Year",    value: 0.15 },
  { label: "Quarter", value: 0.35 },
  { label: "Month",   value: 0.7 },
  { label: "Week",    value: 1.0 },
  { label: "Day",     value: 2.0 },
] as const;

function getActivePreset(zoom: number): string | null {
  const match = ZOOM_PRESETS.find(p => Math.abs(p.value - zoom) < 0.08);
  return match?.label ?? null;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function GanttChart() {
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");
  
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [deps, setDeps] = useState<TaskDependency[]>([]);
  useEffect(() => {
    getScheduleTasks(projectId).then(setTasks);
    getScheduleDeps(projectId).then(setDeps);
  }, [projectId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [groupBy, setGroupBy] = useState<"contractor" | "space">("contractor");
  const [highlightCritical, setHighlightCritical] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const BASE_PIXELS_PER_DAY = 20;
  const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;

  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: "add", taskId: null as string | null });

  // Zoom helpers
  const zoomIn = () => setZoomLevel(p => Math.min(3, +(p + 0.2).toFixed(1)));
  const zoomOut = () => setZoomLevel(p => Math.max(0.1, +(p - 0.2).toFixed(1)));
  const setZoomPreset = (val: number) => setZoomLevel(val);

  // 1. Search & Filter
  const filteredTasks = tasks.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Dynamic Timeline Boundaries
  const { chartStart, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) return { chartStart: "2025-01-01", totalDays: 31 };
    let minD = parseDate(filteredTasks[0].startDate);
    let maxD = parseDate(filteredTasks[0].endDate);
    filteredTasks.forEach(t => {
      if (parseDate(t.startDate) < minD) minD = parseDate(t.startDate);
      if (parseDate(t.endDate) > maxD) maxD = parseDate(t.endDate);
    });
    const start = new Date(minD - 14 * MS_PER_DAY).toISOString().split("T")[0];
    const end = new Date(maxD + 28 * MS_PER_DAY).toISOString().split("T")[0];
    return { chartStart: start, totalDays: diffDays(start, end) };
  }, [filteredTasks]);

  const timelineWidthPx = totalDays * pixelsPerDay;

  // 3. Critical Path Calculation
  const criticalPathTasks = useMemo(() => {
    if (!showCriticalPath) return new Set<string>();
    return calculateCriticalPath(filteredTasks, deps);
  }, [filteredTasks, deps, showCriticalPath]);

  // 4. Group Tasks
  const groupedData = useMemo(() => {
    const map: Record<string, ScheduleTask[]> = {};
    filteredTasks.forEach((t) => {
      const key = groupBy === "contractor" ? (t.contractor || "Unassigned") : (t.space || "No Space");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks, groupBy]);

  const { taskYMap, totalH } = useMemo(() => {
    const map: Record<string, number> = {};
    let y = 0;
    groupedData.forEach(([_, gTasks]) => {
      y += GROUP_H;
      gTasks.forEach((t) => { map[t.id] = y; y += ROW_H; });
    });
    return { taskYMap: map, totalH: y };
  }, [groupedData]);

  // Handlers
  const handleUpdateDates = (id: string, start: string, end: string) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, startDate: start, endDate: end, duration: `${diffDays(start, end)}d` } : t)));
  const handleWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoomLevel(p => Math.max(0.1, Math.min(3, p - e.deltaY * 0.005))); } };
  
  const handleDeleteTask = (id: string) => {
    setTasks(p => p.filter(t => t.id !== id));
    setDeps(p => p.filter(d => d.from !== id && d.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSaveModal = (data: any, newPreds: any) => {
    let targetId = modalConfig.taskId;
    if (modalConfig.mode === "add") {
      targetId = `t_${Date.now()}`;
      setTasks(p => [...p, { ...data, id: targetId, projectId: projectId, pct: 0, status: "NotStarted", critical: false, duration: `${diffDays(data.startDate, data.endDate)}d` }]);
    } else {
      setTasks(p => p.map(t => t.id === targetId ? { ...t, ...data, duration: `${diffDays(data.startDate, data.endDate)}d` } : t));
    }
    setDeps(p => {
      const filtered = p.filter(d => d.to !== targetId);
      return [...filtered, ...newPreds.map((pr: any) => ({ from: pr.id, to: targetId, type: pr.type }))];
    });
  };

  const renderHeaders = () => {
    const months: any[] = []; const lowerTier: any[] = [];
    let currentMonth = ""; let daysInMonth = 0; let monthOffset = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(chartStart, i);
      const mName = getMonthName(d);
      
      if (mName !== currentMonth) {
        if (currentMonth !== "") months.push({ label: currentMonth, days: daysInMonth, startDayOffset: monthOffset });
        currentMonth = mName; daysInMonth = 1; monthOffset = i;
      } else daysInMonth++;

      if (pixelsPerDay >= 15) lowerTier.push({ label: new Date(d).getDate().toString(), days: 1, offset: i });
      else if (pixelsPerDay >= 3 && new Date(d).getDay() === 1) lowerTier.push({ label: formatDateStr(d), days: 7, offset: i });
    }
    months.push({ label: currentMonth, days: daysInMonth, startDayOffset: monthOffset });

    return (
      <div className="flex flex-col border-b border-gray-200 bg-gray-50 sticky top-0 z-20" style={{ height: HEADER_H, width: timelineWidthPx }}>
        <div className="flex-1 flex border-b border-gray-200">{months.map((m, i) => (<div key={i} className="flex items-center justify-center text-[11px] font-semibold text-gray-700 border-r border-gray-200" style={{ width: m.days * pixelsPerDay }}>{m.label}</div>))}</div>
        <div className="flex-1 flex relative">{lowerTier.map((item, i) => (<div key={i} className="absolute flex items-center justify-center text-[10px] text-gray-400 font-medium border-l border-gray-200 h-full" style={{ left: item.offset * pixelsPerDay, width: item.days * pixelsPerDay }}>{item.label}</div>))}</div>
      </div>
    );
  };

  const selectedTask = tasks.find(t => t.id === selectedId);
  const activePreset = getActivePreset(zoomLevel);

  return (
    <div className="flex w-full h-full min-h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-white font-sans relative">
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 1. Gantt Heading */}
        <div className="px-4 py-3 text-[15px] font-bold text-[#24292f] border-b border-gray-200 bg-white">
          Gantt
        </div>

        {/* 2. Toolbar */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex-wrap gap-3">
          
          {/* Left Side: Critical Path, Zoom */}
          <div className="flex items-center gap-4">
            
            {/* Critical Path Toggle */}
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showCriticalPath} 
                  onChange={() => setShowCriticalPath(!showCriticalPath)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#3A4EA2] transition-colors"></div>
                <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full shadow transition-all peer-checked:translate-x-4"></div>
              </label>
              <span className="text-[12px] font-semibold text-[#57606a] flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[#3A4EA2] text-lg leading-none mt-px">●</span>
                Critical Path
              </span>
            </div>

            {/* ─── Compact Zoom Control ─── */}
            <div className="flex items-center gap-1 border-l border-[#D0D7DE] pl-4 h-6">
              <button
                onClick={zoomOut}
                disabled={zoomLevel <= 0.1}
                className="w-6 h-6 flex items-center justify-center rounded text-[14px] font-bold text-[#57606a] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >−</button>

              <select
                value={activePreset ?? ""}
                onChange={(e) => {
                  const preset = ZOOM_PRESETS.find(p => p.label === e.target.value);
                  if (preset) setZoomPreset(preset.value);
                }}
                className="h-6 pl-2 pr-6 text-[11px] font-semibold text-[#24292f] border border-[#D0D7DE] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] outline-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                {ZOOM_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>{preset.label}</option>
                ))}
              </select>

              <button
                onClick={zoomIn}
                disabled={zoomLevel >= 3}
                className="w-6 h-6 flex items-center justify-center rounded text-[14px] font-bold text-[#57606a] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
              >+</button>

              <span className="text-[10px] text-[#8C959F] font-mono tabular-nums ml-0.5 min-w-[32px] text-right">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
          </div>

          {/* Right Side: Search, Group Toggle, Add Task */}
          <div className="flex items-center gap-3">
            
            {/* Search */}
            <div className="flex items-center gap-2 border border-[#D0D7DE] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#3A4EA2] focus-within:ring-1 focus-within:ring-[#3A4EA2] transition-all">
              <span className="text-[12px] text-[#8C959F]">🔍</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-[13px] text-[#24292f] placeholder:text-[#8C959F] border-none outline-none bg-transparent w-48"
              />
            </div>

            {/* Group Toggle */}
            <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE] shadow-sm bg-white">
              <button
                onClick={() => setGroupBy("contractor")}
                className={`px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                  groupBy === "contractor" ? "bg-[#3A4EA2] text-white" : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"
                }`}
              >
                By Contractor
              </button>
              <button
                onClick={() => setGroupBy("space")}
                className={`px-4 py-1.5 text-[12px] font-semibold transition-colors border-l border-[#D0D7DE] ${
                  groupBy === "space" ? "bg-[#3A4EA2] text-white" : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"
                }`}
              >
                By Space
              </button>
            </div>

            {/* Add Task Button */}
            <button 
              onClick={() => setModalConfig({ isOpen: true, mode: "add", taskId: null })} 
              className="px-4 py-1.5 text-[12px] font-semibold bg-[#3A4EA2] text-white rounded-md flex items-center gap-1.5 shadow-sm hover:bg-[#0353A4] transition-colors ml-1"
            >
              + Add Task
            </button>

          </div>
        </div>

        {/* ─── NEW: Status Legend Bar ─── */}
        <div className="flex items-center gap-5 px-4 py-1.5 border-b border-gray-200 bg-white">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: cfg.color }}
              />
              <span className="text-[11px] text-[#57606a] font-medium">
                {cfg.label}
              </span>
            </div>
          ))}
        </div>

        {/* Chart Area */}
        <div className="flex-1 overflow-auto relative flex" id="chart-scroll" onWheel={handleWheel}>
          {/* Frozen Left Column */}
          <div className="sticky left-0 z-30 bg-white border-r border-gray-200 shadow-[1px_0_0_0_#e5e7eb]" style={{ width: TIMELINE_LEFT_OFFSET, minWidth: TIMELINE_LEFT_OFFSET }}>
            <div className="flex items-center px-4 text-[11px] font-medium text-gray-500 border-b bg-gray-50" style={{ height: HEADER_H }}>Task Name</div>
            <div style={{ minHeight: totalH }}>
              {groupedData.map(([key, gTasks]) => (
                <div key={`col-${key}`}>
                  <div className="px-4 flex items-center text-[12px] font-medium text-gray-900 border-b bg-gray-50 gap-1.5" style={{ height: GROUP_H }}>▾ {key}</div>
                  {gTasks.map((t) => (
                    <div key={`name-${t.id}`} onClick={() => setSelectedId(t.id)} className={`px-4 pl-6 flex items-center gap-1.5 border-b cursor-pointer ${selectedId === t.id ? "bg-blue-50" : "hover:bg-gray-50"}`} style={{ height: ROW_H, opacity: showCriticalPath && !criticalPathTasks.has(t.id) ? 0.4 : 1 }}>
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_CONFIG[t.status].color }} />
                      <span className="text-[12px] font-medium truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Timeline Area */}
          <div className="relative" style={{ width: timelineWidthPx }}>
            {renderHeaders()}
            <div className="relative" style={{ minHeight: totalH }}>
              {groupedData.map(([key, gTasks]) => (
                <div key={`time-${key}`}>
                  <div className="border-b border-gray-200 bg-gray-50/50" style={{ height: GROUP_H }} />
                  {gTasks.map((t) => (
                    <GanttRow 
                      key={t.id} 
                      t={t} 
                      selected={selectedId === t.id} 
                      chartStart={chartStart} 
                      pixelsPerDay={pixelsPerDay} 
                      onSelect={() => setSelectedId(t.id)} 
                      onUpdateDates={handleUpdateDates} 
                      highlightCritical={highlightCritical}
                      isOnCriticalPath={criticalPathTasks.has(t.id)}
                      showCriticalPath={showCriticalPath}
                    />
                  ))}
                </div>
              ))}
              <SVGArrows 
                deps={deps} 
                tasks={filteredTasks} 
                taskYMap={taskYMap} 
                chartStart={chartStart} 
                pixelsPerDay={pixelsPerDay} 
                totalH={totalH} 
                highlightCritical={highlightCritical}
                showCriticalPath={showCriticalPath}
                criticalPathTasks={criticalPathTasks}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {selectedTask && (
        <TaskDetailPanel task={selectedTask} deps={deps} tasks={filteredTasks} criticalPathTasks={criticalPathTasks} onClose={() => setSelectedId(null)} onEditClick={() => setModalConfig({ isOpen: true, mode: "edit", taskId: selectedTask.id })} onDelete={handleDeleteTask} />
      )}

      {/* Modal */}
      <TaskModal isOpen={modalConfig.isOpen} mode={modalConfig.mode} task={tasks.find(t => t.id === modalConfig.taskId)} tasks={filteredTasks} deps={deps} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} onSave={handleSaveModal} onDelete={handleDeleteTask} />
    </div>
  );
}
