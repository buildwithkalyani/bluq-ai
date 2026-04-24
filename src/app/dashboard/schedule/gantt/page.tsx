"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { getScheduleTasks, getScheduleDeps, type ScheduleTask, type TaskDependency } from "@/lib/mock-data";
import { fetchTasks, fetchTaskDependencies, createTaskDependency, deleteTaskDependency, fetchLatestScheduleVersion, isRealProject, type ScheduleVersion } from "@/lib/api-client";
import { GapCheckPanel, type SuspectedGap } from "@/components/ui/GapCheckPanel";
import { useWorkspace } from "@/context/workspace";
import { useTaskSocket } from "@/hooks/useTaskSocket";

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
const GROUP_H = 36;
const AREA_H = 28;
const HEADER_H = 44;
const TIMELINE_LEFT_OFFSET = 260;

const PHASE_ORDER = ["Site Preparation", "Foundation", "Structure", "MEP", "Finishing", "Handover"];

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
const SUB_ROW_H = 36;

function GanttRow({ t, selected, chartStart, pixelsPerDay, onSelect, onUpdateDates, isOnCriticalPath, showCriticalPath, onStartConnection, onDropConnection, drawingDep }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef({ mode: "move", startX: 0, initStart: "", initEnd: "" });
  const isSubTask = !!t.parentTaskId;
  const rowH = isSubTask ? SUB_ROW_H : ROW_H;
  const barTop = isSubTask ? 11 : 14;
  const barH = isSubTask ? 14 : 20;

  const leftPx = diffDays(chartStart, t.startDate) * pixelsPerDay;
  const widthPx = Math.max(4, diffDays(t.startDate, t.endDate) * pixelsPerDay);
  const opacity = showCriticalPath && !isOnCriticalPath ? 0.35 : 1;

  const handleMouseDown = (mode: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { mode, startX: e.clientX, initStart: t.startDate, initEnd: t.endDate };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - dragRef.current.startX) / pixelsPerDay);
      let ns = dragRef.current.initStart, ne = dragRef.current.initEnd;
      if (dragRef.current.mode === "move") { ns = addDays(ns, delta); ne = addDays(ne, delta); }
      else if (dragRef.current.mode === "left") { ns = addDays(ns, delta); if (parseDate(ns) >= parseDate(ne)) ns = addDays(ne, -1); }
      else if (dragRef.current.mode === "right") { ne = addDays(ne, delta); if (parseDate(ne) <= parseDate(ns)) ne = addDays(ns, 1); }
      onUpdateDates(t.id, ns, ne);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging, t, onUpdateDates, pixelsPerDay]);

  const sc = STATUS_CONFIG[t.status as StatusKey];
  const isCrit = showCriticalPath && isOnCriticalPath;
  const barColor = isCrit ? "#ef4444" : sc.color;
  const showPorts = hovered || !!drawingDep;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // When a connection is being drawn and mouse is released over this row, complete it
      onMouseUp={() => { if (drawingDep && drawingDep.fromId !== t.id) onDropConnection && onDropConnection(t.id); }}
      className={`flex border-b border-gray-200 cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
      style={{ height: rowH, width: "100%", opacity }}
    >
      <div className="relative w-full h-full">
        {/* Left port — drag FROM here to create SS / SF dep */}
        <div
          style={{ position: "absolute", top: barTop, left: leftPx - 8, width: 14, height: barH, display: "flex", alignItems: "center", justifyContent: "center", cursor: "crosshair", zIndex: 10, opacity: showPorts ? 1 : 0, transition: "opacity 0.12s" }}
          onMouseDown={e => { e.stopPropagation(); onStartConnection && onStartConnection(t.id, "start", leftPx, rowH / 2 + barTop - barH / 2); }}
        >
          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${barColor}`, background: "white" }} />
        </div>

        {/* Bar wrapper — no overflow-hidden so % label can escape when bar is narrow */}
        <div className="absolute" style={{ top: barTop, left: leftPx, width: widthPx, height: barH }}
          onMouseDown={handleMouseDown("move")}>
          {/* Track + fill — overflow-hidden only here */}
          <div className="absolute inset-0 rounded-[3px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{ background: `${barColor}30`, boxShadow: isCrit ? `0 0 0 2px ${barColor}` : `inset 0 0 0 1px ${barColor}70` }}>
            <div className="absolute left-0 top-0 bottom-0" style={{ width: `${t.pct}%`, background: barColor, minWidth: t.pct > 0 ? 3 : 0 }} />
          </div>
          {/* Resize handles */}
          <div onMouseDown={handleMouseDown("left")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10" />
          <div onMouseDown={handleMouseDown("right")} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10" />
          {/* % label — inside bar if wide enough, else pinned just outside to the right */}
          {widthPx >= 36 ? (
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold pointer-events-none z-10 whitespace-nowrap"
              style={{ color: "white", textShadow: `0 0 3px ${barColor}, 0 0 6px ${barColor}99` }}>
              {t.pct}%
            </span>
          ) : (
            <span className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold pointer-events-none z-10 whitespace-nowrap"
              style={{ left: widthPx + 4, color: barColor }}>
              {t.pct}%
            </span>
          )}
        </div>

        {/* Right port — drag FROM here to create FS / FF dep */}
        <div
          style={{ position: "absolute", top: barTop, left: leftPx + widthPx - 6, width: 14, height: barH, display: "flex", alignItems: "center", justifyContent: "center", cursor: "crosshair", zIndex: 10, opacity: showPorts ? 1 : 0, transition: "opacity 0.12s" }}
          onMouseDown={e => { e.stopPropagation(); onStartConnection && onStartConnection(t.id, "end", leftPx + widthPx, rowH / 2 + barTop - barH / 2); }}
        >
          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${barColor}`, background: "white" }} />
        </div>
      </div>
    </div>
  );
}

// Dep type label
const DEP_LABELS: Record<string, string> = { FS: "Finish → Start", SS: "Start → Start", FF: "Finish → Finish", SF: "Start → Finish" };

function SVGArrows({ deps, tasks, taskYMap, chartStart, pixelsPerDay, totalH, showCriticalPath, criticalPathTasks, onDeleteDep, onChangeDep, drawingDep, mousePos }: any) {
  const [hoveredDep, setHoveredDep] = useState<number | null>(null);
  const [editingDep, setEditingDep] = useState<number | null>(null);

  return (
    <svg className="absolute top-0 overflow-visible" style={{ left: 0, width: "100%", height: totalH, zIndex: 5, pointerEvents: "none" }}>
      <defs>
        <marker id="arr-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M1,1 L5,3 L1,5 Z" fill="#ef4444" /></marker>
        <marker id="arr-norm" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M1,1 L5,3 L1,5 Z" fill="#94a3b8" /></marker>
        <marker id="arr-hover" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M1,1 L5,3 L1,5 Z" fill="#3b82f6" /></marker>
        <marker id="arr-draw" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M1,1 L5,3 L1,5 Z" fill="#3b82f6" /></marker>
      </defs>

      {deps.map((dep: any, i: number) => {
        const fromT = tasks.find((t: any) => t.id === dep.from);
        const toT   = tasks.find((t: any) => t.id === dep.to);
        if (!fromT || !toT || taskYMap[dep.from] === undefined || taskYMap[dep.to] === undefined) return null;

        const isOnCritical = showCriticalPath && criticalPathTasks.has(dep.from) && criticalPathTasks.has(dep.to);
        const isHov = hoveredDep === i || editingDep === i;
        const baseOpacity = showCriticalPath && !isOnCritical ? 0.2 : 1;
        const color = isHov ? "#3b82f6" : isOnCritical ? "#ef4444" : "#94a3b8";
        const sw = isHov ? 2 : isOnCritical ? 2 : 1.5;
        const marker = isHov ? "url(#arr-hover)" : isOnCritical ? "url(#arr-crit)" : "url(#arr-norm)";

        const fromStartX = diffDays(chartStart, fromT.startDate) * pixelsPerDay;
        const fromEndX   = diffDays(chartStart, fromT.endDate)   * pixelsPerDay;
        const toStartX   = diffDays(chartStart, toT.startDate)   * pixelsPerDay;
        const toEndX     = diffDays(chartStart, toT.endDate)     * pixelsPerDay;

        let x1: number, x2: number, elbowX: number;
        if (dep.type === "FS") {
          x1 = fromEndX; x2 = toStartX;
          elbowX = x2 > x1 + 20 ? Math.round((x1 + x2) / 2) : x1 + 16;
        } else if (dep.type === "SS") {
          x1 = fromStartX; x2 = toStartX;
          elbowX = Math.min(x1, x2) - 14;
        } else if (dep.type === "FF") {
          x1 = fromEndX; x2 = toEndX;
          elbowX = Math.max(x1, x2) + 14;
        } else { // SF
          x1 = fromStartX; x2 = toEndX;
          elbowX = Math.min(x1, x2) - 14;
        }

        // bar center per task: barTop + barH/2
        const getBarY = (t: any) => {
          const bt = t.parentTaskId ? 11 : 14;
          const bh = t.parentTaskId ? 14 : 20;
          return (taskYMap[t.id] ?? 0) + bt + bh / 2;
        };
        const y1 = getBarY(fromT);
        const y2 = getBarY(toT);
        const pts = `${x1},${y1} ${elbowX},${y1} ${elbowX},${y2} ${x2},${y2}`;
        const midY = Math.round((y1 + y2) / 2);

        return (
          <g key={i} opacity={baseOpacity} style={{ pointerEvents: "all" }}
            onMouseEnter={() => setHoveredDep(i)}
            onMouseLeave={() => { setHoveredDep(null); }}
            onClick={(e) => { e.stopPropagation(); setEditingDep(editingDep === i ? null : i); }}
          >
            {/* Fat invisible hit strip */}
            <polyline points={pts} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} />
            {/* Visible arrow */}
            <polyline points={pts} fill="none" stroke={color} strokeWidth={sw}
              strokeDasharray={isOnCritical ? "" : "5 3"} markerEnd={marker} style={{ pointerEvents: "none" }} />
            {/* Origin dot */}
            <circle cx={x1} cy={y1} r={3} fill={color} style={{ pointerEvents: "none" }} />

            {/* Edit popup on click */}
            {editingDep === i && (
              <g style={{ pointerEvents: "all" }}>
                <rect x={elbowX - 52} y={midY - 36} width={104} height={70} rx={6} fill="#1e293b" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.4))" />
                {/* Type label */}
                <text x={elbowX} y={midY - 18} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">{DEP_LABELS[dep.type] ?? dep.type}</text>
                {/* Type selector buttons */}
                {(["FS","SS","FF","SF"] as const).map((t, ti) => (
                  <g key={t} style={{ cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); onChangeDep(i, t); setEditingDep(null); }}>
                    <rect x={elbowX - 48 + ti * 24} y={midY - 10} width={22} height={16} rx={3}
                      fill={dep.type === t ? "#3b82f6" : "#334155"} />
                    <text x={elbowX - 37 + ti * 24} y={midY + 2} textAnchor="middle" fill="white" fontSize={8} fontFamily="monospace" fontWeight="bold">{t}</text>
                  </g>
                ))}
                {/* Delete */}
                <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onDeleteDep(i); setEditingDep(null); }}>
                  <rect x={elbowX - 20} y={midY + 10} width={40} height={14} rx={3} fill="#ef4444" />
                  <text x={elbowX} y={midY + 21} textAnchor="middle" fill="white" fontSize={8} fontFamily="sans-serif">Delete</text>
                </g>
              </g>
            )}
          </g>
        );
      })}

      {/* Live rubber-band line while drawing */}
      {drawingDep && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={drawingDep.x} y1={drawingDep.y} x2={mousePos.x} y2={mousePos.y}
            stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#arr-draw)" />
          <circle cx={drawingDep.x} cy={drawingDep.y} r={4} fill="#3b82f6" />
        </g>
      )}
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

const PHASE_OPTIONS = ["Site Preparation","Foundation","Structure","MEP","Finishing","Handover"];

function TaskModal({ isOpen, mode, task, tasks, deps, onClose, onSave, onDelete }: any) {
  const emptyForm = { name: "", phase: "", contractor: "", space: "", startDate: "", endDate: "", status: "notStarted" as StatusKey, pct: 0 };
  const [formData, setFormData] = useState(emptyForm);
  const [selectedPreds, setSelectedPreds] = useState<{id: string, type: string}[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && task) {
        setFormData({ name: task.name, phase: task.phase || "", contractor: task.contractor || "", space: task.space || "", startDate: task.startDate, endDate: task.endDate, status: task.status || "notStarted", pct: task.pct ?? 0 });
        setSelectedPreds(deps.filter((d: any) => d.to === task.id).map((d: any) => ({ id: d.from, type: d.type })));
      } else {
        setFormData(emptyForm);
        setSelectedPreds([]);
      }
      setError("");
    }
  }, [isOpen, mode, task, deps]);

  if (!isOpen) return null;

  const labelCls = "block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider";
  const inputCls = "w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2]";

  const f = formData;
  const set = (k: string, v: any) => setFormData(p => {
    const next: typeof p = { ...p, [k]: v };
    if (k === "status" && v === "completed") next.pct = 100;
    if (k === "status" && v === "notStarted") next.pct = 0;
    if (k === "pct" && v === 100) next.status = "completed";
    if (k === "pct" && v === 0) next.status = "notStarted";
    return next;
  });

  const handleSave = () => {
    if (!f.name.trim())    return setError("Task name is required.");
    if (!f.phase)          return setError("Phase is required.");
    if (!f.startDate)      return setError("Start date is required.");
    if (!f.endDate)        return setError("End date is required.");
    if (f.endDate < f.startDate) return setError("End date must be after start date.");
    onSave(formData, selectedPreds);
    onClose();
  };

  const togglePred = (id: string) => setSelectedPreds(p => p.find(x => x.id === id) ? p.filter(x => x.id !== id) : [...p, { id, type: "FS" }]);
  const changePredType = (id: string, type: string) => setSelectedPreds(p => p.map(x => x.id === id ? { ...x, type } : x));

  const parentTasks = tasks.filter((t: any) => !t.parentTaskId && t.id !== task?.id);

  return (
    <div className="fixed inset-0 bg-[#09090b]/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[#e1e4e8] flex justify-between items-center">
          <h2 className="text-[15px] font-bold text-[#24292f]">{mode === "add" ? "Add New Task" : "Edit Task"}</h2>
          <button onClick={onClose} className="text-[#57606a] hover:text-[#24292f]">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Name */}
          <div>
            <label className={labelCls}>Task Name *</label>
            <input type="text" placeholder="e.g. Column Formwork Level 3" value={f.name} onChange={e => set("name", e.target.value)} className={inputCls} />
          </div>

          {/* Phase + Space */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phase *</label>
              <select value={f.phase} onChange={e => set("phase", e.target.value)} className={inputCls}>
                <option value="">Select phase…</option>
                {PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Space / Zone</label>
              <input type="text" placeholder="e.g. Zone A — L3" value={f.space} onChange={e => set("space", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Contractor */}
          <div>
            <label className={labelCls}>Contractor</label>
            <input type="text" placeholder="e.g. Rajesh Kumar" value={f.contractor} onChange={e => set("contractor", e.target.value)} className={inputCls} />
          </div>

          {/* Start + End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} className={inputCls + " text-[#24292f]"} />
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} className={inputCls + " text-[#24292f]"} />
            </div>
          </div>

          {/* Status + % Complete */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={f.status} onChange={e => set("status", e.target.value)} className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>% Complete</label>
              <div className="flex items-center gap-2 pt-1">
                <input type="range" min={0} max={100} step={5} value={f.pct} onChange={e => set("pct", Number(e.target.value))} className="flex-1 accent-[#3A4EA2]" />
                <span className="text-[13px] font-bold font-mono text-[#3A4EA2] w-10 text-right">{f.pct}%</span>
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {parentTasks.length > 0 && (
            <div>
              <label className={labelCls}>Dependencies (predecessors)</label>
              <div className="border border-[#D0D7DE] rounded-md p-2 max-h-36 overflow-y-auto space-y-1 bg-[#fafbfc]">
                {parentTasks.map((t: any) => {
                  const sel = selectedPreds.find(x => x.id === t.id);
                  return (
                    <div key={t.id} className="flex justify-between items-center py-0.5 px-1 hover:bg-[#f0f6fc] rounded">
                      <label className="flex gap-2 text-[12px] items-center cursor-pointer">
                        <input type="checkbox" checked={!!sel} onChange={() => togglePred(t.id)} className="accent-[#3A4EA2]" />
                        <span className="text-[#24292f]">{t.name}</span>
                      </label>
                      {sel && (
                        <select value={sel.type} onChange={e => changePredType(t.id, e.target.value)}
                          className="text-[11px] border border-[#D0D7DE] rounded px-1.5 py-0.5 bg-white">
                          <option value="FS">FS — Finish to Start</option>
                          <option value="SS">SS — Start to Start</option>
                          <option value="FF">FF — Finish to Finish</option>
                          <option value="SF">SF — Start to Finish</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-[#CF222E] font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[#e1e4e8] bg-[#f6f8fa] flex justify-between items-center">
          <div>
            {mode === "edit" && (
              <button onClick={() => { onDelete(task?.id); onClose(); }}
                className="px-3 py-1.5 text-[12px] font-semibold text-[#CF222E] border border-[#CF222E] rounded-md hover:bg-[#ffebe9] transition-colors">
                Delete Task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-[13px] font-semibold text-[#24292f] bg-white border border-[#D0D7DE] rounded-md hover:bg-[#f6f8fa]">Cancel</button>
            <button onClick={handleSave} className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#3A4EA2] rounded-md hover:bg-[#0353A4] shadow-sm">
              {mode === "add" ? "Add Task" : "Save Changes"}
            </button>
          </div>
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
function GanttChartContent() {
  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [deps, setDeps] = useState<TaskDependency[]>([]);
  const [depIds, setDepIds] = useState<Record<string, string>>({});
  const [scheduleVersion, setScheduleVersion] = useState<ScheduleVersion | null>(null);
  const depIdKey = (from: string, to: string) => `${from}__${to}`;

  useEffect(() => {
    if (real) {
      fetchTasks(projectIdParam, workspaceId!).then(setTasks);
      fetchLatestScheduleVersion(projectIdParam, workspaceId!).then(setScheduleVersion);
      fetchTaskDependencies(projectIdParam, workspaceId!).then(rows => {
        setDeps(rows.map(r => ({ from: r.predecessorId, to: r.successorId, type: r.dependencyType, label: r.dependencyType })));
        const ids: Record<string, string> = {};
        rows.forEach(r => { ids[depIdKey(r.predecessorId, r.successorId)] = r.id; });
        setDepIds(ids);
      }).catch(() => setDeps([]));
    } else if (isDesignMode) {
      const numId = Number(projectIdParam);
      getScheduleTasks(numId).then(setTasks);
      getScheduleDeps(numId).then(setDeps);
    } else {
      setTasks([]);
      setDeps([]);
    }
  }, [projectIdParam, workspaceId, isDesignMode]);

  const gapCheckGaps: SuspectedGap[] =
    scheduleVersion?.scheduleJson?.gapCheck?.suspectedGaps?.filter(g => !g.alreadyCovered) ?? [];

  const refreshTasks = () => {
    if (real) fetchTasks(projectIdParam, workspaceId!).then(setTasks);
  };

  // Real-time task updates via Socket.IO — patches tasks state when WhatsApp
  // updates arrive from site workers. Uses UUID when real project is selected.
  useTaskSocket({ projectId: real ? projectIdParam : null, setTasks });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterContractor, setFilterContractor] = useState("All");
  const [filterSpace, setFilterSpace] = useState("All");
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [highlightCritical] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const didInit = useRef(false);

  // Collapse everything by default on first load
  useEffect(() => {
    if (didInit.current || tasks.length === 0) return;
    didInit.current = true;
    const phases = new Set(tasks.map(t => t.phase || "Other"));
    const areas = new Set(tasks.map(t => `${t.phase || "Other"}__${t.space || "General"}`));
    const parentIds = new Set(tasks.filter(t => !t.parentTaskId).map(t => t.id));
    setCollapsedPhases(phases);
    setCollapsedAreas(areas);
    setCollapsedTasks(parentIds);
  }, [tasks]);

  // Dep drawing state
  const [drawingDep, setDrawingDep] = useState<{ fromId: string; fromSide: "start"|"end"; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const togglePhase = (phase: string) =>
    setCollapsedPhases(p => { const s = new Set(p); s.has(phase) ? s.delete(phase) : s.add(phase); return s; });
  const toggleArea = (key: string) =>
    setCollapsedAreas(p => { const s = new Set(p); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleTask = (id: string) =>
    setCollapsedTasks(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const BASE_PIXELS_PER_DAY = 20;
  const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;

  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: "add", taskId: null as string | null });

  // Zoom helpers
  const zoomIn = () => setZoomLevel(p => Math.min(3, +(p + 0.2).toFixed(1)));
  const zoomOut = () => setZoomLevel(p => Math.max(0.1, +(p - 0.2).toFixed(1)));
  const setZoomPreset = (val: number) => setZoomLevel(val);

  // Derived filter option lists
  const contractorOptions = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.contractor).map(t => t.contractor))).sort()], [tasks]);
  const spaceOptions = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.space).map(t => t.space))).sort()], [tasks]);

  // 1. Search & Filter
  const filteredTasks = tasks.filter((t) => {
    if (t.milestone) return false; // milestones removed from main view
    if (!t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterContractor !== "All" && t.contractor !== filterContractor) return false;
    if (filterSpace !== "All" && t.space !== filterSpace) return false;
    return true;
  });

  // 2. Dynamic Timeline Boundaries
  const { chartStart, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const year = new Date().getFullYear();
      return { chartStart: `${year}-01-01`, totalDays: 365 };
    }
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

  // 4. Group by phase → area → tasks (parents first, sub-tasks interleaved)
  const groupedData = useMemo(() => {
    // phase -> area -> tasks[]
    const phaseMap: Record<string, Record<string, ScheduleTask[]>> = {};
    filteredTasks.filter(t => !t.parentTaskId).forEach((t) => {
      const phase = t.phase || "Other";
      const area = t.space || "General";
      if (!phaseMap[phase]) phaseMap[phase] = {};
      if (!phaseMap[phase][area]) phaseMap[phase][area] = [];
      phaseMap[phase][area].push(t);
      // Append sub-tasks immediately after parent
      filteredTasks.filter(s => s.parentTaskId === t.id).forEach(s => phaseMap[phase][area].push(s));
    });
    const toEntry = (phaseKey: string): [string, [string, ScheduleTask[]][]] =>
      [phaseKey, Object.entries(phaseMap[phaseKey])];
    const ordered = PHASE_ORDER.filter(p => phaseMap[p]).map(toEntry);
    const rest = Object.keys(phaseMap).filter(k => !PHASE_ORDER.includes(k)).map(toEntry);
    return [...ordered, ...rest];
  }, [filteredTasks]);

  const phaseAvgPct = (areas: [string, ScheduleTask[]][]) => {
    const parents = areas.flatMap(([, ts]) => ts).filter(t => !t.parentTaskId);
    return parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
  };

  // taskYMap + WBS numbers (respects all 3 collapse levels)
  const { taskYMap, totalH, wbsMap } = useMemo(() => {
    const yMap: Record<string, number> = {};
    const wbs: Record<string, string> = {};
    let y = 0;
    let phaseIdx = 0;
    groupedData.forEach(([phase, areas]) => {
      phaseIdx++;
      y += GROUP_H;
      if (!collapsedPhases.has(phase)) {
        let areaIdx = 0;
        areas.forEach(([area, ts]) => {
          areaIdx++;
          const areaKey = `${phase}__${area}`;
          y += AREA_H;
          if (!collapsedAreas.has(areaKey)) {
            let taskIdx = 0;
            ts.filter(t => !t.parentTaskId).forEach((t) => {
              taskIdx++;
              const taskWbs = `${phaseIdx}.${areaIdx}.${taskIdx}`;
              wbs[t.id] = taskWbs;
              yMap[t.id] = y;
              y += ROW_H;
              if (!collapsedTasks.has(t.id)) {
                // sub-tasks
                let subIdx = 0;
                ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                  subIdx++;
                  wbs[s.id] = `${taskWbs}.${subIdx}`;
                  yMap[s.id] = y;
                  y += SUB_ROW_H;
                });
              }
            });
          }
        });
      }
    });
    return { taskYMap: yMap, totalH: y, wbsMap: wbs };
  }, [groupedData, collapsedPhases, collapsedAreas, collapsedTasks]);

  // Rollup status color — priority: delayed > runningLate > inProgress > notStarted > completed
  const STATUS_PRIORITY: StatusKey[] = ["delayed", "runningLate", "inProgress", "notStarted", "completed"];
  const rollupColor = (ts: ScheduleTask[]) => {
    const parents = ts.filter(t => !t.parentTaskId);
    for (const s of STATUS_PRIORITY) {
      if (parents.some(t => t.status === s)) return STATUS_CONFIG[s].color;
    }
    return STATUS_CONFIG.notStarted.color;
  };

  // Summary bar: spanning start→end of all (non-sub) tasks in a list
  const spanOf = (ts: ScheduleTask[]) => {
    const parents = ts.filter(t => !t.parentTaskId);
    if (!parents.length) return null;
    const start = parents.reduce((m, t) => parseDate(t.startDate) < parseDate(m) ? t.startDate : m, parents[0].startDate);
    const end   = parents.reduce((m, t) => parseDate(t.endDate)   > parseDate(m) ? t.endDate   : m, parents[0].endDate);
    const avg   = Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length);
    return { start, end, avg };
  };

  // Today marker X position
  const today = new Date().toISOString().split("T")[0];
  const todayOffsetDays = diffDays(chartStart, today);
  const todayX = todayOffsetDays * pixelsPerDay;

  // Handlers
  const handleUpdateDates = (id: string, start: string, end: string) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, startDate: start, endDate: end, duration: `${diffDays(start, end)}d` } : t)));
  const handleWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoomLevel(p => Math.max(0.1, Math.min(3, p - e.deltaY * 0.005))); } };
  const handleChangeDep = (idx: number, newType: string) => setDeps(p => p.map((d, i) => i === idx ? { ...d, type: newType as any } : d));
  
  const handleDeleteTask = (id: string) => {
    setTasks(p => p.filter(t => t.id !== id));
    setDeps(p => p.filter(d => d.from !== id && d.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSaveModal = (data: any, newPreds: any) => {
    let targetId = modalConfig.taskId;
    if (modalConfig.mode === "add") {
      targetId = `t_${Date.now()}`;
      const days = diffDays(data.startDate, data.endDate);
      setTasks(p => [...p, {
        id: targetId,
        projectId: 0,
        name: data.name,
        phase: data.phase,
        space: data.space || "General",
        contractor: data.contractor || "—",
        startDate: data.startDate,
        endDate: data.endDate,
        duration: `${days}d`,
        pct: data.pct ?? 0,
        status: data.status ?? "notStarted",
        critical: false,
        group: "",
        delay: null,
        left: 0,
        width: 0,
        photos: [] as string[],
      } as any]);
    } else {
      setTasks(p => p.map(t => t.id === targetId
        ? { ...t, ...data, duration: `${diffDays(data.startDate, data.endDate)}d` }
        : t
      ));
    }
    setDeps(p => {
      const filtered = p.filter(d => d.to !== targetId);
      return [...filtered, ...newPreds.map((pr: any) => ({ from: pr.id, to: targetId, type: pr.type, label: pr.type }))];
    });
    if (real && workspaceId && targetId) {
      // delete old deps for this task, then create new ones
      const oldDeps = deps.filter(d => d.to === targetId);
      oldDeps.forEach(d => {
        const bid = depIds[depIdKey(d.from, d.to)];
        if (bid) deleteTaskDependency(bid).catch(console.error);
      });
      newPreds.forEach((pr: any) => {
        createTaskDependency({ workspaceId: workspaceId!, predecessorId: pr.id, successorId: targetId!, dependencyType: pr.type })
          .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(pr.id, targetId!)]: r.id })); })
          .catch(console.error);
      });
    }
  };

  const handleExport = async () => {
    if (!chartRef.current || isExporting) return;
    setIsExporting(true);

    // Snapshot current collapse state
    const prevPhases = new Set(collapsedPhases);
    const prevAreas  = new Set(collapsedAreas);
    const prevTasks  = new Set(collapsedTasks);

    // Expand everything
    setCollapsedPhases(new Set());
    setCollapsedAreas(new Set());
    setCollapsedTasks(new Set());

    // Wait two frames for the DOM to re-render fully
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: chartRef.current.scrollWidth,
        height: chartRef.current.scrollHeight,
        windowWidth: chartRef.current.scrollWidth,
        windowHeight: chartRef.current.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `gantt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      // Restore collapse state
      setCollapsedPhases(prevPhases);
      setCollapsedAreas(prevAreas);
      setCollapsedTasks(prevTasks);
      setIsExporting(false);
    }
  };

  const renderHeaders = () => {
    const showYearLevel = pixelsPerDay < 5; // year & quarter zoom → upper=year, lower=month
    const upperTier: { label: string; days: number; startDayOffset: number }[] = [];
    const lowerTier: { label: string; days: number; offset: number }[] = [];

    let curUpperKey = ""; let daysInUpper = 0; let upperOffset = 0;
    let curMonthKey = ""; let daysInMonth = 0; let monthOffset = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(chartStart, i);
      const date = new Date(d);

      const upperKey = showYearLevel
        ? date.getFullYear().toString()
        : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (upperKey !== curUpperKey) {
        if (curUpperKey !== "") upperTier.push({ label: curUpperKey, days: daysInUpper, startDayOffset: upperOffset });
        curUpperKey = upperKey; daysInUpper = 1; upperOffset = i;
      } else daysInUpper++;

      if (pixelsPerDay >= 15) {
        lowerTier.push({ label: date.getDate().toString(), days: 1, offset: i });
      } else if (pixelsPerDay >= 5) {
        if (date.getDay() === 1) lowerTier.push({ label: formatDateStr(d), days: 7, offset: i });
      } else {
        // month markers for year/quarter zoom
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthKey !== curMonthKey) {
          if (curMonthKey !== "") {
            lowerTier.push({
              label: new Date(addDays(chartStart, monthOffset)).toLocaleDateString("en-US", { month: "short" }),
              days: daysInMonth,
              offset: monthOffset,
            });
          }
          curMonthKey = monthKey; daysInMonth = 1; monthOffset = i;
        } else daysInMonth++;
      }
    }

    upperTier.push({ label: curUpperKey, days: daysInUpper, startDayOffset: upperOffset });
    if (curMonthKey && pixelsPerDay < 5) {
      lowerTier.push({
        label: new Date(addDays(chartStart, monthOffset)).toLocaleDateString("en-US", { month: "short" }),
        days: daysInMonth,
        offset: monthOffset,
      });
    }

    const showToday = todayOffsetDays >= 0 && todayOffsetDays <= totalDays;

    return (
      <div className="flex flex-col border-b border-gray-200 bg-gray-50 sticky top-0 z-20 overflow-visible" style={{ height: HEADER_H, width: timelineWidthPx }}>
        <div className="flex-1 flex border-b border-gray-200 relative">
          {upperTier.map((m, i) => (
            <div key={i} className="flex items-center justify-center text-[11px] font-semibold text-gray-700 border-r border-gray-200" style={{ width: m.days * pixelsPerDay }}>
              {m.label}
            </div>
          ))}
          {showToday && (
            <div className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: todayX, top: 3 }}>
              <div className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-red-500 whitespace-nowrap leading-tight">TODAY</div>
            </div>
          )}
        </div>
        <div className="flex-1 flex relative">
          {lowerTier.map((item, i) => (
            <div key={i} className="absolute flex items-center justify-center text-[10px] text-gray-400 font-medium border-l border-gray-200 h-full" style={{ left: item.offset * pixelsPerDay, width: item.days * pixelsPerDay }}>
              {item.label}
            </div>
          ))}
          {showToday && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none" style={{ left: todayX }} />
          )}
        </div>
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

        {/* Gap Check Panel — advisory only, never blocking */}
        {real && scheduleVersion && gapCheckGaps.length > 0 && (
          <GapCheckPanel
            scheduleVersionId={scheduleVersion.id}
            workspaceId={workspaceId!}
            projectId={projectIdParam}
            gaps={gapCheckGaps}
            onTaskAdded={refreshTasks}
          />
        )}

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

          {/* Right Side: Search, Filters, Add Task */}
          <div className="flex items-center gap-3">

            {/* Search */}
            <div className="flex items-center gap-2 border border-[#D0D7DE] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#3A4EA2] focus-within:ring-1 focus-within:ring-[#3A4EA2] transition-all">
              <span className="text-[12px] text-[#8C959F]">🔍</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-[13px] text-[#24292f] placeholder:text-[#8C959F] border-none outline-none bg-transparent w-40"
              />
            </div>

            {/* Contractor Filter */}
            <select
              value={filterContractor}
              onChange={e => setFilterContractor(e.target.value)}
              className="h-7 pl-2 pr-6 text-[12px] font-medium text-[#24292f] border border-[#D0D7DE] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#3A4EA2] outline-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
            >
              {contractorOptions.map(c => <option key={c} value={c}>{c === "All" ? "All Contractors" : c}</option>)}
            </select>

            {/* Space Filter */}
            <select
              value={filterSpace}
              onChange={e => setFilterSpace(e.target.value)}
              className="h-7 pl-2 pr-6 text-[12px] font-medium text-[#24292f] border border-[#D0D7DE] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#3A4EA2] outline-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
            >
              {spaceOptions.map(s => <option key={s} value={s}>{s === "All" ? "All Spaces" : s}</option>)}
            </select>

            {/* Export PNG */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-3 py-1.5 text-[12px] font-semibold border border-[#D0D7DE] bg-white text-[#24292f] rounded-md flex items-center gap-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Export chart as PNG (all rows expanded)"
            >
              {isExporting ? (
                <svg className="animate-spin w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
                </svg>
              )}
              {isExporting ? "Exporting…" : "Export PNG"}
            </button>

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
        <div
          ref={chartRef}
          className="flex-1 overflow-auto relative flex"
          id="chart-scroll"
          onWheel={handleWheel}
          onMouseMove={e => {
            if (drawingDep && timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
          }}
          onMouseUp={() => setDrawingDep(null)}
        >
          {/* Frozen Left Column */}
          <div className="sticky left-0 z-30 bg-white border-r border-gray-200 shadow-[1px_0_0_0_#e5e7eb]" style={{ width: TIMELINE_LEFT_OFFSET, minWidth: TIMELINE_LEFT_OFFSET }}>
            <div className="flex items-center px-4 text-[11px] font-medium text-gray-500 border-b bg-gray-50" style={{ height: HEADER_H }}>Task Name</div>
            <div>
              {groupedData.map(([phase, areas]) => {
                const avg = phaseAvgPct(areas);
                const collapsed = collapsedPhases.has(phase);
                return (
                  <div key={`col-${phase}`}>
                    {/* Phase header — clickable to collapse */}
                    <div
                      className="px-3 border-b bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      style={{ height: GROUP_H }}
                      onClick={() => togglePhase(phase)}
                    >
                      <div className="flex items-center justify-between h-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] text-gray-400 shrink-0">{collapsed ? "▶" : "▼"}</span>
                          <span className="text-[12px] font-semibold text-gray-800 truncate">{phase}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#3A4EA2]" style={{ width: `${avg}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[#3A4EA2] tabular-nums">{avg}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Area subheaders + task rows */}
                    {!collapsed && areas.map(([area, ts]) => {
                      const areaKey = `${phase}__${area}`;
                      const areaCollapsed = collapsedAreas.has(areaKey);
                      return (
                      <div key={`col-${phase}-${area}`}>
                        {/* Area subheader — collapsible */}
                        <div
                          className="px-5 flex items-center justify-between border-b bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                          style={{ height: AREA_H }}
                          onClick={() => toggleArea(areaKey)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[9px] text-gray-400 shrink-0">{areaCollapsed ? "▶" : "▼"}</span>
                            <span className="text-[11px] font-semibold text-gray-600 truncate">{area}</span>
                          </div>
                        </div>
                        {!areaCollapsed && ts.filter(t => !t.parentTaskId).flatMap((t) => {
                          const taskCollapsed = collapsedTasks.has(t.id);
                          const hasChildren = ts.some(s => s.parentTaskId === t.id);
                          const rows = [];
                          // Parent task row
                          rows.push(
                            <div
                              key={`name-${t.id}`}
                              className={`flex items-center border-b cursor-pointer gap-1 pr-2 ${selectedId === t.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                              style={{ height: ROW_H, opacity: showCriticalPath && !criticalPathTasks.has(t.id) ? 0.4 : 1, paddingLeft: 8 }}
                            >
                              {/* WBS number */}
                              <span className="text-[10px] text-gray-400 font-mono shrink-0 w-[38px] text-right pr-1.5">{wbsMap[t.id]}</span>
                              {/* Collapse toggle */}
                              <span
                                className="text-[9px] text-gray-400 shrink-0 w-3 text-center cursor-pointer"
                                onClick={e => { e.stopPropagation(); if (hasChildren) toggleTask(t.id); }}
                              >{hasChildren ? (taskCollapsed ? "▶" : "▼") : ""}</span>
                              {/* Status dot */}
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_CONFIG[t.status as StatusKey].color }} />
                              <span
                                className="truncate text-[12px] font-medium text-gray-900 flex-1"
                                onClick={() => setSelectedId(t.id)}
                              >{t.name}</span>
                            </div>
                          );
                          // Sub-task rows
                          if (!taskCollapsed) {
                            ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                              rows.push(
                                <div
                                  key={`name-${s.id}`}
                                  onClick={() => setSelectedId(s.id)}
                                  className={`flex items-center border-b cursor-pointer gap-1 pr-2 bg-gray-50/50 ${selectedId === s.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                  style={{ height: SUB_ROW_H, opacity: showCriticalPath && !criticalPathTasks.has(s.id) ? 0.4 : 1, paddingLeft: 8 }}
                                >
                                  <span className="text-[10px] text-gray-400 font-mono shrink-0 w-[38px] text-right pr-1.5">{wbsMap[s.id]}</span>
                                  <span className="w-3 shrink-0" />
                                  <span className="text-gray-300 text-[10px] shrink-0">└</span>
                                  <span className="truncate text-[11px] text-gray-600 flex-1">{s.name}</span>
                                </div>
                              );
                            });
                          }
                          return rows;
                        })}
                      </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Timeline Area */}
          <div className="relative" style={{ width: timelineWidthPx }} ref={timelineRef}>
            {renderHeaders()}
            <div className="relative" style={{ minHeight: totalH }}>
              {/* Today vertical line — 2px solid red, full chart height */}
              {todayOffsetDays >= 0 && todayOffsetDays <= totalDays && (
                <div className="absolute top-0 pointer-events-none z-10" style={{ left: todayX - 1, width: 2, height: totalH, background: "#ef4444", opacity: 0.7 }} />
              )}

              {groupedData.map(([phase, areas]) => {
                const collapsed = collapsedPhases.has(phase);
                const phaseTasks = areas.flatMap(([, ts]) => ts);
                const phaseSpan = spanOf(phaseTasks);
                const phaseColor = rollupColor(phaseTasks);
                const phaseLeftPx  = phaseSpan ? diffDays(chartStart, phaseSpan.start) * pixelsPerDay : 0;
                const phaseWidthPx = phaseSpan ? Math.max(4, diffDays(phaseSpan.start, phaseSpan.end) * pixelsPerDay) : 0;
                // Fade phase bar if critical path is on and NO task in this phase is critical
                const phaseHasCritical = phaseTasks.some(t => criticalPathTasks.has(t.id));
                const phaseBarOpacity = showCriticalPath && !phaseHasCritical ? 0.2 : 1;
                return (
                  <div key={`time-${phase}`}>
                    {/* Phase summary row */}
                    <div className="relative border-b border-gray-200 bg-gray-50/30" style={{ height: GROUP_H }}>
                      {phaseSpan && (
                        // wrapper — no overflow-hidden so label can escape
                        <div className="absolute transition-opacity"
                          style={{ top: 8, left: phaseLeftPx, width: phaseWidthPx, height: GROUP_H - 16, opacity: phaseBarOpacity }}>
                          {/* track + fill — overflow-hidden scoped here */}
                          <div className="absolute inset-0 rounded overflow-hidden"
                            style={{ background: `${phaseColor}30`, border: `1.5px solid ${phaseColor}` }}>
                            <div className="absolute left-0 top-0 bottom-0 rounded-l" style={{ width: `${phaseSpan.avg}%`, background: phaseColor }} />
                          </div>
                          {/* label outside overflow-hidden */}
                          {phaseWidthPx >= 40 ? (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold pointer-events-none z-10 whitespace-nowrap"
                              style={{ color: "white", textShadow: `0 0 3px ${phaseColor}, 0 0 6px ${phaseColor}99` }}>
                              {phaseSpan.avg}%
                            </span>
                          ) : (
                            <span className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold pointer-events-none z-10 whitespace-nowrap"
                              style={{ left: phaseWidthPx + 4, color: phaseColor }}>
                              {phaseSpan.avg}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!collapsed && areas.map(([area, ts]) => {
                      const areaKey = `${phase}__${area}`;
                      const areaCollapsed = collapsedAreas.has(areaKey);
                      const areaColor = rollupColor(ts);
                      const areaSpan = spanOf(ts);
                      const areaLeftPx  = areaSpan ? diffDays(chartStart, areaSpan.start) * pixelsPerDay : 0;
                      const areaWidthPx = areaSpan ? Math.max(4, diffDays(areaSpan.start, areaSpan.end) * pixelsPerDay) : 0;
                      // Fade area bar if critical path on and NO task in this area is critical
                      const areaHasCritical = ts.some(t => criticalPathTasks.has(t.id));
                      const areaBarOpacity = showCriticalPath && !areaHasCritical ? 0.2 : 1;
                      return (
                      <div key={`time-${phase}-${area}`}>
                        {/* Area summary row */}
                        <div className="relative border-b border-gray-100 bg-slate-50/60" style={{ height: AREA_H }}>
                          {areaSpan && (
                            <div className="absolute transition-opacity"
                              style={{ top: 5, left: areaLeftPx, width: areaWidthPx, height: AREA_H - 10, opacity: areaBarOpacity }}>
                              <div className="absolute inset-0 rounded overflow-hidden"
                                style={{ background: `${areaColor}25`, border: `1px solid ${areaColor}` }}>
                                <div className="absolute left-0 top-0 bottom-0 rounded-l" style={{ width: `${areaSpan.avg}%`, background: areaColor }} />
                              </div>
                              {areaWidthPx >= 36 ? (
                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold pointer-events-none z-10 whitespace-nowrap"
                                  style={{ color: "white", textShadow: `0 0 3px ${areaColor}, 0 0 6px ${areaColor}99` }}>
                                  {areaSpan.avg}%
                                </span>
                              ) : (
                                <span className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold pointer-events-none z-10 whitespace-nowrap"
                                  style={{ left: areaWidthPx + 4, color: areaColor }}>
                                  {areaSpan.avg}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!areaCollapsed && ts.filter(t => !t.parentTaskId).flatMap((t) => {
                          const taskCollapsed = collapsedTasks.has(t.id);
                          const rows = [
                            <GanttRow
                              key={t.id}
                              t={t}
                              selected={selectedId === t.id}
                              chartStart={chartStart}
                              pixelsPerDay={pixelsPerDay}
                              onSelect={() => setSelectedId(t.id)}
                              onUpdateDates={handleUpdateDates}
                              isOnCriticalPath={criticalPathTasks.has(t.id)}
                              showCriticalPath={showCriticalPath}
                              drawingDep={drawingDep}
                              onStartConnection={(fromId: string, side: "start"|"end", barX: number, barY: number) => {
                                setDrawingDep({ fromId, fromSide: side, x: barX, y: barY });
                              }}
                              onDropConnection={(toId: string) => {
                                if (!drawingDep || drawingDep.fromId === toId) { setDrawingDep(null); return; }
                                const type = drawingDep.fromSide === "start" ? "SS" : "FS";
                                const fromId = drawingDep.fromId;
                                setDeps(p => [...p.filter(d => !(d.from === fromId && d.to === toId)), { from: fromId, to: toId, type, label: type }]);
                                setDrawingDep(null);
                                if (real && workspaceId) {
                                  createTaskDependency({ workspaceId, predecessorId: fromId, successorId: toId, dependencyType: type })
                                    .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(fromId, toId)]: r.id })); })
                                    .catch(console.error);
                                }
                              }}
                            />
                          ];
                          if (!taskCollapsed) {
                            ts.filter(s => s.parentTaskId === t.id).forEach(s => rows.push(
                              <GanttRow
                                key={s.id}
                                t={s}
                                selected={selectedId === s.id}
                                chartStart={chartStart}
                                pixelsPerDay={pixelsPerDay}
                                onSelect={() => setSelectedId(s.id)}
                                onUpdateDates={handleUpdateDates}
                                isOnCriticalPath={criticalPathTasks.has(s.id)}
                                showCriticalPath={showCriticalPath}
                                drawingDep={drawingDep}
                                onStartConnection={(fromId: string, side: "start"|"end", barX: number, barY: number) => {
                                  setDrawingDep({ fromId, fromSide: side, x: barX, y: barY });
                                }}
                                onDropConnection={(toId: string) => {
                                  if (!drawingDep || drawingDep.fromId === toId) { setDrawingDep(null); return; }
                                  const type = drawingDep.fromSide === "start" ? "SS" : "FS";
                                  const fromId = drawingDep.fromId;
                                  setDeps(p => [...p.filter(d => !(d.from === fromId && d.to === toId)), { from: fromId, to: toId, type, label: type }]);
                                  setDrawingDep(null);
                                  if (real && workspaceId) {
                                    createTaskDependency({ workspaceId, predecessorId: fromId, successorId: toId, dependencyType: type })
                                      .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(fromId, toId)]: r.id })); })
                                      .catch(console.error);
                                  }
                                }}
                              />
                            ));
                          }
                          return rows;
                        })}
                      </div>
                      );
                    })}
                  </div>
                );
              })}
              <SVGArrows
                deps={deps}
                tasks={filteredTasks}
                taskYMap={taskYMap}
                chartStart={chartStart}
                pixelsPerDay={pixelsPerDay}
                totalH={totalH}
                showCriticalPath={showCriticalPath}
                criticalPathTasks={criticalPathTasks}
                drawingDep={drawingDep}
                mousePos={mousePos}
                onDeleteDep={(i: number) => {
                  const dep = deps[i];
                  setDeps(p => p.filter((_, idx) => idx !== i));
                  if (real && dep) {
                    const bid = depIds[depIdKey(dep.from, dep.to)];
                    if (bid) deleteTaskDependency(bid).catch(console.error);
                    setDepIds(p => { const n = { ...p }; delete n[depIdKey(dep.from, dep.to)]; return n; });
                  }
                }}
                onChangeDep={handleChangeDep}
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

export default function GanttChart() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8C959F]">Loading...</div>}>
      <GanttChartContent />
    </Suspense>
  );
}
