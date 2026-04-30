"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getScheduleTasks } from "@/lib/mock-data";
import { fetchTasks, isRealProject, type ScheduleTask } from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";

const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-4 ${className}`} style={style}>{children}</div>
);

// SVG canvas constants
const X0 = 50, X1 = 480, Y0 = 195, Y1 = 10;
const W = X1 - X0; // 430
const H = Y0 - Y1; // 185

// Pick sample count based on project duration — 1 pt per day up to 30d,
// then weekly, capped at 100 pts so long projects still get proportional resolution.
function sampleCount(durationMs: number): number {
  const days = durationMs / 86400000;
  if (days <= 30)  return Math.ceil(days);
  if (days <= 90)  return Math.ceil(days / 2);
  const weekly = Math.ceil(days / 7);
  return Math.min(weekly, 100);
}

function toSvgX(frac: number) { return X0 + frac * W; }
function toSvgY(pct: number)  { return Y0 - (pct / 100) * H; }

// Build a smooth SVG path from an array of [x, y] SVG coords using cubic bezier
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const cpx = px + (cx - px) * 0.5;
    d += ` C ${cpx} ${py} ${cpx} ${cy} ${cx} ${cy}`;
  }
  return d;
}

interface CurveData {
  plannedPts: [number, number][];
  actualPts:  [number, number][];
  xLabels:    { label: string; svgX: number }[];
  plannedAtToday: number;
  actualNow:  number;
  todayFrac:  number;
}

function computeCurves(tasks: ScheduleTask[], rangeStart: string, rangeEnd: string): CurveData {
  const parents = tasks.filter(t => !t.parentTaskId && t.startDate && t.endDate);

  const rs = new Date(rangeStart).getTime();
  const re = new Date(rangeEnd).getTime();
  const totalRangeMs = re - rs;
  const today = Date.now();
  const todayFrac = totalRangeMs > 0 ? Math.min(1, Math.max(0, (today - rs) / totalRangeMs)) : 0;

  if (parents.length === 0 || totalRangeMs <= 0) {
    return { plannedPts: [], actualPts: [], xLabels: [], plannedAtToday: 0, actualNow: 0, todayFrac };
  }

  const N = sampleCount(totalRangeMs);

  // Weight each task by its duration (days), min 1
  const taskData = parents.map(t => {
    const ts = new Date(t.startDate).getTime();
    const te = new Date(t.endDate).getTime();
    const dur = Math.max(1, te - ts);
    return { ts, te, dur, pct: t.pct };
  });
  const totalWeight = taskData.reduce((s, t) => s + t.dur, 0);

  // Sample N+1 evenly-spaced points across the range
  const plannedPts: [number, number][] = [];
  const actualPts:  [number, number][] = [];

  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const t = rs + frac * totalRangeMs;
    const svgX = toSvgX(frac);

    // Planned: cumulative fraction of each task completed by time t (uniform daily spread)
    let plannedPct = 0;
    for (const task of taskData) {
      const done = Math.min(1, Math.max(0, (t - task.ts) / task.dur));
      plannedPct += done * (task.dur / totalWeight) * 100;
    }
    plannedPts.push([svgX, toSvgY(plannedPct)]);

    // Actual: only plot up to today
    if (t <= today + 86400000) {
      let actualPct = 0;
      for (const task of taskData) {
        if (task.ts > t) continue; // task hasn't started yet at time t
        // Spread completed work linearly from task.ts to min(today, task.te)
        const effectiveEnd = Math.min(today, task.te);
        const elapsed = Math.max(1, effectiveEnd - task.ts);
        const progressHere = Math.min(1, (t - task.ts) / elapsed);
        actualPct += progressHere * (task.pct / 100) * (task.dur / totalWeight) * 100;
      }
      actualPts.push([svgX, toSvgY(actualPct)]);
    }
  }

  // Planned % at today (for gap calc)
  const plannedAtToday = (() => {
    let p = 0;
    for (const task of taskData) {
      const done = Math.min(1, Math.max(0, (today - task.ts) / task.dur));
      p += done * (task.dur / totalWeight) * 100;
    }
    return Math.round(p);
  })();

  // Current actual overall % (weighted by duration)
  const actualNow = Math.round(
    taskData.reduce((s, t) => s + (t.pct / 100) * (t.dur / totalWeight) * 100, 0)
  );

  // X-axis labels at 7 evenly-spaced positions
  const xLabels = Array.from({ length: 7 }, (_, i) => {
    const frac = i / 6;
    const d = new Date(rs + frac * totalRangeMs);
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      svgX: toSvgX(frac),
    };
  });

  return { plannedPts, actualPts, xLabels, plannedAtToday, actualNow, todayFrac };
}

function SCurveContent() {
  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [startDate, setStartDate] = useState("2026-03-01");
  const [endDate, setEndDate] = useState("2026-04-15");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const loader = real
      ? fetchTasks(projectIdParam, workspaceId!)
      : isDesignMode
        ? getScheduleTasks(Number(projectIdParam))
        : Promise.resolve([]);

    loader.then(loaded => {
      const parents = loaded.filter(t => !t.parentTaskId && t.startDate && t.endDate);
      if (parents.length > 0) {
        const starts = parents.map(t => t.startDate).sort();
        const ends   = parents.map(t => t.endDate).sort();
        if (starts[0]) setStartDate(starts[0]);
        if (ends[ends.length - 1]) setEndDate(ends[ends.length - 1]);
      }
      setTasks(loaded);
    });
  }, [projectIdParam, workspaceId, real, isDesignMode]);

  const { plannedPts, actualPts, xLabels, plannedAtToday, actualNow, todayFrac } =
    useMemo(() => computeCurves(tasks, startDate, endDate), [tasks, startDate, endDate]);

  const gap = actualNow - plannedAtToday;

  // Today vertical line
  const todaySvgX = toSvgX(Math.min(1, Math.max(0, todayFrac)));

  // Gap annotation: compare planned vs actual at today's x position
  const plannedYatToday = plannedPts.length > 0
    ? toSvgY(plannedAtToday)
    : toSvgY(0);
  const actualYatToday = actualPts.length > 0
    ? actualPts[actualPts.length - 1][1]
    : toSvgY(0);

  const plannedPath = smoothPath(plannedPts);
  const actualPath  = smoothPath(actualPts);

  // Area fill under actual line (close back to x-axis)
  const actualAreaPath = actualPts.length > 1
    ? `${actualPath} L ${actualPts[actualPts.length - 1][0]} ${Y0} L ${X0} ${Y0} Z`
    : "";

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => { setIsDownloading(false); alert("S-Curve PDF downloaded successfully!"); }, 1500);
  };

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa]">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[15px] font-bold text-[#24292f]">S-Curve</div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center bg-white border border-[#D0D7DE] rounded-md overflow-hidden shadow-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-[12px] text-[#24292f] font-mono outline-none focus:bg-[#ddf4ff]" />
            <span className="text-[#8C959F] text-[12px] bg-[#f0f1f3] px-2 py-1.5 border-x border-[#D0D7DE]">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-[12px] text-[#24292f] font-mono outline-none focus:bg-[#ddf4ff]" />
          </div>
          <button onClick={handleDownload} disabled={isDownloading}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-md flex items-center gap-1.5 transition-colors shadow-sm ${
              isDownloading ? "bg-[#8C959F] text-white cursor-not-allowed" : "bg-[#3A4EA2] text-white hover:bg-[#0353A4]"
            }`}>
            {isDownloading ? "⏳ Generating..." : "📄 Download PDF"}
          </button>
        </div>
      </div>

      <Card className="!p-6 mb-4 shadow-sm">
        {tasks.filter(t => !t.parentTaskId).length === 0 ? (
          <div className="flex items-center justify-center h-[220px] text-[13px] text-[#8C959F]">
            No tasks with dates found — add tasks to the schedule to see the S-Curve.
          </div>
        ) : (
          <svg viewBox="0 0 500 220" className="w-full" style={{ height: 220 }}>
            <defs>
              <linearGradient id="scg-actual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3A4EA2" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3A4EA2" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 20, 40, 60, 80, 100].map(v => (
              <g key={v}>
                <line x1={X0} y1={toSvgY(v)} x2={X1} y2={toSvgY(v)} stroke="#f0f1f3" strokeWidth="1" />
                <text x={X0 - 8} y={toSvgY(v) + 4} fontSize="9" fill="#8C959F" textAnchor="end" fontFamily="monospace">{v}%</text>
              </g>
            ))}

            {/* X-axis labels */}
            {xLabels.map(({ label, svgX }, i) => (
              <text key={i} x={svgX} y="210" fontSize="8" fill="#8C959F" textAnchor="middle" fontFamily="monospace">{label}</text>
            ))}

            {/* Today vertical line */}
            {todayFrac > 0 && todayFrac < 1 && (
              <>
                <line x1={todaySvgX} y1={Y1} x2={todaySvgX} y2={Y0}
                  stroke="#d4a017" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <text x={todaySvgX + 3} y={Y1 + 10} fontSize="8" fill="#d4a017" fontFamily="monospace">Today</text>
              </>
            )}

            {/* Planned line (dashed) */}
            {plannedPath && (
              <path d={plannedPath} fill="none" stroke="#8C959F" strokeWidth="2" strokeDasharray="6 4" />
            )}

            {/* Actual area fill */}
            {actualAreaPath && (
              <path d={actualAreaPath} fill="url(#scg-actual)" />
            )}

            {/* Actual line (solid) */}
            {actualPath && (
              <path d={actualPath} fill="none" stroke="#3A4EA2" strokeWidth="2.5" />
            )}

            {/* Endpoint dot on actual line */}
            {actualPts.length > 0 && (
              <circle
                cx={actualPts[actualPts.length - 1][0]}
                cy={actualPts[actualPts.length - 1][1]}
                r="5" fill="#3A4EA2" stroke="#fff" strokeWidth="2" />
            )}

            {/* Gap annotation at today's x */}
            {Math.abs(gap) >= 2 && todayFrac > 0 && todayFrac <= 1 && (
              <>
                <line x1={todaySvgX} y1={plannedYatToday} x2={todaySvgX} y2={actualYatToday}
                  stroke="#CF222E" strokeWidth="1.5" strokeDasharray="3 2" />
                <text x={todaySvgX + 6} y={(plannedYatToday + actualYatToday) / 2 + 3}
                  fontSize="9" fill="#CF222E" fontWeight="700" fontFamily="monospace">
                  {gap > 0 ? "+" : ""}{gap}% gap
                </text>
              </>
            )}

            {/* Legend */}
            <line x1="60" y1="10" x2="80" y2="10" stroke="#8C959F" strokeWidth="2" strokeDasharray="4 3" />
            <text x="84" y="13" fontSize="9" fill="#8C959F" fontFamily="monospace">Planned</text>
            <line x1="148" y1="10" x2="168" y2="10" stroke="#3A4EA2" strokeWidth="2.5" />
            <text x="172" y="13" fontSize="9" fill="#3A4EA2" fontFamily="monospace">Actual</text>
          </svg>
        )}
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Planned Progress", value: `${plannedAtToday}%`, color: "#8C959F" },
          { label: "Actual Progress",  value: `${actualNow}%`,      color: "#3A4EA2" },
          { label: "Schedule Gap",     value: `${gap > 0 ? "+" : ""}${gap}%`, color: gap < -2 ? "#CF222E" : gap > 2 ? "#1a7f37" : "#8C959F" },
        ].map(s => (
          <Card key={s.label} className="!p-3 text-center shadow-sm">
            <div className="text-[11px] text-[#8C959F] mb-1">{s.label}</div>
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="!bg-[#0D1117] !text-[#c9d1d9] !border-[#30363d] shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#3FB950] animate-pulse" style={{ boxShadow: "0 0 6px #3FB950" }} />
          <span className="text-xs font-bold text-[#3FB950] font-mono tracking-wide">AI S-CURVE ANALYSIS</span>
        </div>
        <div className="text-[13px] leading-relaxed">
          {gap < -2 ? (
            <>Project is tracking <span className="text-[#ff8182] font-semibold">{Math.abs(gap)}% behind</span> planned progress.{" "}
            If current pace continues, the project may slip beyond its target end date.{" "}
            <span className="text-[#3FB950] font-semibold">Review delayed tasks and accelerate critical path activities.</span></>
          ) : gap > 2 ? (
            <>Project is <span className="text-[#3FB950] font-semibold">{gap}% ahead</span> of planned progress.{" "}
            <span className="text-[#3FB950] font-semibold">Continue current pace and monitor upcoming milestones.</span></>
          ) : (
            <>Project is <span className="text-[#3FB950] font-semibold">on track</span> with planned progress at {actualNow}%.{" "}
            <span className="text-[#3FB950] font-semibold">Maintain momentum through upcoming phases.</span></>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function SCurvePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8C959F]">Loading…</div>}>
      <SCurveContent />
    </Suspense>
  );
}
