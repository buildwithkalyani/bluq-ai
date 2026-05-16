"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, CheckCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getScheduleTasks } from "@/lib/mock-data";
import { fetchTasks, isRealProject } from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";

const SVG_W = 560;
const SVG_H = 260;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 30;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;

function sigmoid(t: number): number {
  const k = 6.5;
  const s = (x: number) => 1 / (1 + Math.exp(-k * (x - 0.5)));
  return (s(t) - s(0)) / (s(1) - s(0));
}

function buildPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const cpx = (px + cx) / 2;
    d += ` C ${cpx} ${py} ${cpx} ${cy} ${cx} ${cy}`;
  }
  return d;
}

function SCurveContent() {
  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [actualProgress, setActualProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  useEffect(() => {
    const loader = real
      ? fetchTasks(projectIdParam, workspaceId!)
      : isDesignMode
        ? getScheduleTasks(Number(projectIdParam))
        : Promise.resolve([]);
    loader.then(tasks => {
      const parents = tasks.filter(t => !t.parentTaskId);
      if (parents.length === 0) return;
      const starts = parents.map(t => t.startDate).filter(Boolean).sort();
      const ends = parents.map(t => t.endDate).filter(Boolean).sort();
      if (starts[0]) setStartDate(starts[0]);
      if (ends[ends.length - 1]) setEndDate(ends[ends.length - 1]);
      setActualProgress(Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length));
    });
  }, [projectIdParam, workspaceId, isDesignMode]);

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const totalMs = endMs - startMs;
  const elapsedMs = Date.now() - startMs;
  const todayRatio = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0.5;
  const plannedProgress = Math.round(sigmoid(todayRatio) * 100);
  const gap = actualProgress - plannedProgress;

  const N = 40;
  const plannedPts = useMemo((): [number, number][] =>
    Array.from({ length: N }, (_, i) => {
      const t = i / (N - 1);
      const x = PAD_L + t * CHART_W;
      const y = PAD_T + CHART_H - sigmoid(t) * CHART_H;
      return [x, y];
    }), [startDate, endDate]);

  const actualPts = useMemo((): [number, number][] => {
    const M = Math.max(2, Math.round(N * todayRatio));
    return Array.from({ length: M }, (_, i) => {
      const t = (i / (M - 1)) * todayRatio;
      const plannedAtT = sigmoid(t);
      const scale = todayRatio > 0 ? (actualProgress / 100) / sigmoid(todayRatio) : 1;
      const actualAtT = Math.min(1, plannedAtT * scale);
      const x = PAD_L + t * CHART_W;
      const y = PAD_T + CHART_H - actualAtT * CHART_H;
      return [x, y];
    });
  }, [todayRatio, actualProgress]);

  const todayX = PAD_L + todayRatio * CHART_W;
  const plannedY = PAD_T + CHART_H - sigmoid(todayRatio) * CHART_H;
  const actualY = actualPts.length > 0 ? actualPts[actualPts.length - 1][1] : plannedY;

  const fillPath = actualPts.length > 1
    ? buildPath(actualPts) + ` L ${actualPts[actualPts.length - 1][0]} ${PAD_T + CHART_H} L ${PAD_L} ${PAD_T + CHART_H} Z`
    : "";

  const xLabels = useMemo(() => {
    const s = startMs, e = endMs;
    if (isNaN(s) || isNaN(e) || s >= e) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s + (i / 6) * (e - s));
      return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), x: PAD_L + (i / 6) * CHART_W };
    });
  }, [startDate, endDate]);

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => { setIsDownloading(false); setDownloadDone(true); setTimeout(() => setDownloadDone(false), 3000); }, 1500);
  };

  const gapColor = gap >= 2 ? "#059669" : gap <= -2 ? "#DC2626" : "#94A3B8";

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F8FAFC] space-y-5">
      {downloadDone && (
        <div className="fixed top-4 right-4 z-50 bg-[#059669] text-white px-4 py-2 rounded-xl shadow-lg text-[13px] font-semibold flex items-center gap-2">
          <CheckCircle size={14} /> PDF downloaded
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">S-Curve</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Planned vs actual progress over time</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 text-[13px] text-[#0F172A] font-mono outline-none focus:bg-[#EFF6FF] bg-transparent" />
            <span className="text-[#94A3B8] text-[12px] bg-[#F8FAFC] px-2 py-2 border-x border-[#E2E8F0]">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 text-[13px] text-[#0F172A] font-mono outline-none focus:bg-[#EFF6FF] bg-transparent" />
          </div>
          <button onClick={handleDownload} disabled={isDownloading}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors ${
              isDownloading ? "bg-[#94A3B8] text-white cursor-not-allowed" : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            }`}>
            <Download size={14} strokeWidth={1.8} />
            {isDownloading ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-[#2563EB]" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Actual</div>
            <div className="text-[24px] font-bold text-[#2563EB] leading-none">{actualProgress}%</div>
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <Minus size={18} className="text-[#64748B]" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Planned</div>
            <div className="text-[24px] font-bold text-[#64748B] leading-none">{plannedProgress}%</div>
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: gap >= 2 ? "#ECFDF5" : gap <= -2 ? "#FEF2F2" : "#F1F5F9" }}>
            {gap >= 2
              ? <TrendingUp size={18} className="text-[#059669]" />
              : gap <= -2
                ? <TrendingDown size={18} className="text-[#DC2626]" />
                : <Minus size={18} className="text-[#94A3B8]" />
            }
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Gap</div>
            <div className="text-[24px] font-bold leading-none" style={{ color: gapColor }}>
              {gap > 0 ? "+" : ""}{gap}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden p-5">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ height: SVG_H }}>
          <defs>
            <linearGradient id="scFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 25, 50, 75, 100].map(v => {
            const y = PAD_T + CHART_H - (v / 100) * CHART_H;
            return (
              <g key={v}>
                <line x1={PAD_L} y1={y} x2={PAD_L + CHART_W} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                <text x={PAD_L - 6} y={y + 4} fontSize="10" fill="#94A3B8" textAnchor="end" fontFamily="monospace">{v}%</text>
              </g>
            );
          })}

          {/* X axis labels */}
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={PAD_T + CHART_H + 18} fontSize="10" fill="#94A3B8" textAnchor="middle" fontFamily="monospace">{label}</text>
          ))}

          {/* Planned line */}
          <path d={buildPath(plannedPts)} fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="7 4" />

          {/* Actual fill */}
          {fillPath && <path d={fillPath} fill="url(#scFill)" />}

          {/* Actual line */}
          {actualPts.length > 1 && (
            <path d={buildPath(actualPts)} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Today marker */}
          <line x1={todayX} y1={PAD_T} x2={todayX} y2={PAD_T + CHART_H} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 3" />

          {/* Gap annotation */}
          {Math.abs(gap) >= 3 && (
            <>
              <line x1={todayX} y1={plannedY} x2={todayX} y2={actualY}
                stroke={gapColor} strokeWidth="1.5" strokeDasharray="3 2" />
              <rect x={todayX + 6} y={(plannedY + actualY) / 2 - 9} width="52" height="16" rx="4"
                fill={gap >= 0 ? "#ECFDF5" : "#FEF2F2"} />
              <text x={todayX + 32} y={(plannedY + actualY) / 2 + 4}
                fontSize="10" fill={gapColor} fontWeight="700" fontFamily="monospace" textAnchor="middle">
                {gap > 0 ? "+" : ""}{gap}%
              </text>
            </>
          )}

          {/* Endpoint dot */}
          {actualPts.length > 0 && (
            <circle cx={actualPts[actualPts.length - 1][0]} cy={actualPts[actualPts.length - 1][1]}
              r="5" fill="#2563EB" stroke="#fff" strokeWidth="2" />
          )}

          {/* Legend */}
          <line x1={PAD_L + 4} y1={12} x2={PAD_L + 24} y2={12} stroke="#CBD5E1" strokeWidth="2" strokeDasharray="5 3" />
          <text x={PAD_L + 28} y={16} fontSize="11" fill="#64748B" fontFamily="system-ui">Planned</text>
          <line x1={PAD_L + 90} y1={12} x2={PAD_L + 110} y2={12} stroke="#2563EB" strokeWidth="2.5" />
          <text x={PAD_L + 114} y={16} fontSize="11" fill="#2563EB" fontFamily="system-ui">Actual</text>
          <line x1={PAD_L + 165} y1={8} x2={PAD_L + 165} y2={18} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 2" />
          <text x={PAD_L + 170} y={16} fontSize="11" fill="#94A3B8" fontFamily="system-ui">Today</text>
        </svg>
      </div>

      {/* AI Analysis — light card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden"
        style={{ borderLeft: `4px solid ${gap <= -2 ? "#DC2626" : gap >= 2 ? "#059669" : "#94A3B8"}` }}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: gap <= -2 ? "#FEF2F2" : gap >= 2 ? "#ECFDF5" : "#F1F5F9" }}>
              {gap <= -2
                ? <TrendingDown size={13} className="text-[#DC2626]" />
                : gap >= 2
                  ? <TrendingUp size={13} className="text-[#059669]" />
                  : <Minus size={13} className="text-[#94A3B8]" />
              }
            </div>
            <span className="text-[12px] font-bold text-[#475569] uppercase tracking-[0.08em]">Schedule Intelligence</span>
          </div>
          <p className="text-[14px] text-[#334155] leading-relaxed">
            {gap < -2 ? (
              <>Project is <span className="font-bold text-[#DC2626]">{Math.abs(gap)}% behind</span> planned progress.
              {" "}At current pace, the completion date is at risk of slipping.{" "}
              <span className="font-semibold text-[#0F172A]">Review delayed tasks and accelerate critical path activities.</span></>
            ) : gap > 2 ? (
              <>Project is <span className="font-bold text-[#059669]">{gap}% ahead</span> of planned progress.{" "}
              <span className="font-semibold text-[#0F172A]">Maintain current pace and monitor upcoming milestones.</span></>
            ) : (
              <>Project is <span className="font-bold text-[#475569]">on track</span> with planned progress at <span className="font-bold text-[#2563EB]">{actualProgress}%</span>.{" "}
              <span className="font-semibold text-[#0F172A]">Continue momentum through upcoming phases.</span></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SCurvePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[#94A3B8]">Loading...</div>}>
      <SCurveContent />
    </Suspense>
  );
}
