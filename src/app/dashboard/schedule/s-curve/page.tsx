"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getScheduleTasks } from "@/lib/mock-data";
import { getAnalytics } from "@/lib/mock-data";

const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-4 ${className}`} style={style}>{children}</div>
);

function SCurveContent() {
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");

  const [startDate, setStartDate] = useState("2026-03-01");
  const [endDate, setEndDate] = useState("2026-04-15");
  const [actualProgress, setActualProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load project schedule to derive date range and actual progress
  useEffect(() => {
    getScheduleTasks(projectId).then(tasks => {
      const parents = tasks.filter(t => !t.parentTaskId);
      if (parents.length === 0) return;

      // Date range from tasks
      const starts = parents.map(t => t.startDate).sort();
      const ends = parents.map(t => t.endDate).sort();
      if (starts[0]) setStartDate(starts[0]);
      if (ends[ends.length - 1]) setEndDate(ends[ends.length - 1]);

      // Actual progress
      const avg = Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length);
      setActualProgress(avg);
    });
  }, [projectId]);

  const generateDateLabels = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) return ["","","","","","",""];
    const step = (e - s) / 6;
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(s + step * i);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
  };

  const xAxisLabels = generateDateLabels(startDate, endDate);

  // Planned progress at current point = simple linear interpolation
  const totalMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const elapsedMs = Date.now() - new Date(startDate).getTime();
  const plannedProgress = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 50;
  const gap = actualProgress - plannedProgress;

  // Actual line endpoint x position (proportion of elapsed time)
  const actualX = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0.6;
  const actualSvgX = 50 + actualX * 430;
  const actualSvgY = 195 - (actualProgress / 100) * 185;
  const plannedSvgY = 195 - (plannedProgress / 100) * 185;

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
        <svg viewBox="0 0 500 220" className="w-full" style={{ height: 220 }}>
          <defs>
            <linearGradient id="scg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A4EA2" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#3A4EA2" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 20, 40, 60, 80, 100].map(v => (
            <g key={v}>
              <line x1="50" y1={195 - v * 1.85} x2="480" y2={195 - v * 1.85} stroke="#f0f1f3" strokeWidth="1" />
              <text x="42" y={199 - v * 1.85} fontSize="9" fill="#8C959F" textAnchor="end" fontFamily="monospace">{v}%</text>
            </g>
          ))}

          {xAxisLabels.map((d, i) => (
            <text key={i} x={50 + i * 71.6} y="210" fontSize="8" fill="#8C959F" textAnchor="middle" fontFamily="monospace">{d}</text>
          ))}

          {/* Planned line (dashed) */}
          <path d="M 50 195 C 120 192 160 175 200 155 S 280 100 340 55 Q 400 20 480 10"
            fill="none" stroke="#8C959F" strokeWidth="2" strokeDasharray="6 4" />

          {/* Actual line (solid) — ends at current date position */}
          <path d={`M 50 195 C ${50 + actualSvgX * 0.3} 192 ${50 + actualSvgX * 0.6} ${195 - (actualProgress * 0.5)} ${actualSvgX} ${actualSvgY}`}
            fill="none" stroke="#3A4EA2" strokeWidth="2.5" />
          <path d={`M 50 195 C ${50 + actualSvgX * 0.3} 192 ${50 + actualSvgX * 0.6} ${195 - (actualProgress * 0.5)} ${actualSvgX} ${actualSvgY} L ${actualSvgX} 195 L 50 195 Z`}
            fill="url(#scg)" />
          <circle cx={actualSvgX} cy={actualSvgY} r="5" fill="#3A4EA2" stroke="#fff" strokeWidth="2" />

          {/* Gap annotation — only show if there's a meaningful gap */}
          {Math.abs(gap) >= 2 && (
            <>
              <line x1={actualSvgX} y1={plannedSvgY} x2={actualSvgX} y2={actualSvgY}
                stroke="#CF222E" strokeWidth="1" strokeDasharray="3 2" />
              <text x={actualSvgX + 6} y={(plannedSvgY + actualSvgY) / 2 + 3}
                fontSize="9" fill="#CF222E" fontWeight="700" fontFamily="monospace">
                {gap > 0 ? "+" : ""}{gap}% gap
              </text>
            </>
          )}

          {/* Legend */}
          <line x1="60" y1="10" x2="80" y2="10" stroke="#8C959F" strokeWidth="2" strokeDasharray="4 3" />
          <text x="84" y="13" fontSize="9" fill="#8C959F">Planned</text>
          <line x1="140" y1="10" x2="160" y2="10" stroke="#3A4EA2" strokeWidth="2.5" />
          <text x="164" y="13" fontSize="9" fill="#3A4EA2">Actual</text>
        </svg>
      </Card>

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
            <>Project is <span className="text-[#3FB950] font-semibold">on track</span> with planned progress at {actualProgress}%.{" "}
            <span className="text-[#3FB950] font-semibold">Maintain momentum through upcoming phases.</span></>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function SCurvePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8C959F]">Loading...</div>}>
      <SCurveContent />
    </Suspense>
  );
}
