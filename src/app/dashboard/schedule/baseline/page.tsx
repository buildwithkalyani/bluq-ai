"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { getScheduleTasks, STATUS_CONFIG, type ScheduleTask } from "@/lib/mock-data";
import { fetchTasks, isRealProject } from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";
import { ChevronDown, ChevronRight } from "lucide-react";

const PHASE_ORDER = ["Site Preparation", "Foundation", "Structure", "MEP", "Finishing", "Handover"];

const MOCK_BASELINES = [
  { version: 3, label: "v3 — Re-baseline (Mar 2025)", uploadedAt: "Mar 15, 2025", note: "Revised after foundation delays", offsetMultiplier: 1.0 },
  { version: 2, label: "v2 — Re-baseline (Jan 2025)", uploadedAt: "Jan 10, 2025", note: "Updated after scope change",     offsetMultiplier: 1.15 },
  { version: 1, label: "v1 — Original Baseline (Oct 2024)", uploadedAt: "Oct 1, 2024", note: "Initial approved schedule", offsetMultiplier: 1.3 },
];

function fmtDate(d?: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function VariancePill({ variance }: { variance: number }) {
  if (variance === 0) return <span className="text-[12px] font-semibold text-[#94A3B8]">On track</span>;
  const ahead = variance > 0;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold font-mono"
      style={{ background: ahead ? "#ECFDF5" : "#FEF2F2", color: ahead ? "#059669" : "#DC2626" }}>
      {ahead ? "+" : ""}{variance}% {ahead ? "ahead" : "behind"}
    </span>
  );
}

function SlippageBadge({ baselineEnd, actualEnd }: { baselineEnd?: string; actualEnd: string }) {
  if (!baselineEnd) return null;
  const bl = new Date(baselineEnd).getTime();
  const ac = new Date(actualEnd).getTime();
  const days = Math.round((ac - bl) / 86400000);
  if (days === 0) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ml-2"
      style={{ background: days > 0 ? "#FEF2F2" : "#ECFDF5", color: days > 0 ? "#DC2626" : "#059669" }}>
      {days > 0 ? `+${days}d slip` : `${days}d early`}
    </span>
  );
}

function BaselineActualPageContent() {
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  useEffect(() => {
    if (wsLoading) return;
    setLoading(true);
    const load = real
      ? fetchTasks(projectIdParam, workspaceId!)
      : isDesignMode
        ? getScheduleTasks(Number(projectIdParam))
        : Promise.resolve([]);
    load.then(t => { setTasks(t); setLoading(false); });
  }, [projectIdParam, workspaceId, wsLoading, isDesignMode]);

  const togglePhase = (p: string) =>
    setCollapsedPhases(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });

  const groupedData = useMemo(() => {
    const map: Record<string, ScheduleTask[]> = {};
    tasks.filter(t => !t.parentTaskId).forEach(t => {
      const key = t.phase || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(t);
      tasks.filter(s => s.parentTaskId === t.id).forEach(s => map[key].push(s));
    });
    const ordered = PHASE_ORDER.filter(p => map[p]).map(p => [p, map[p]] as [string, ScheduleTask[]]);
    const rest = Object.entries(map).filter(([k]) => !PHASE_ORDER.includes(k));
    return [...ordered, ...rest];
  }, [tasks]);

  const activeBaseline = MOCK_BASELINES[0];
  const bOffset = (pct: number, status: string) => {
    const raw = pct + (status === "delayed" || status === "runningLate" ? 12 : -4);
    return Math.min(100, Math.max(0, Math.round(raw * activeBaseline.offsetMultiplier)));
  };

  const summary = useMemo(() => {
    const parents = tasks.filter(t => !t.parentTaskId);
    const overallActual = parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
    const overallBaseline = parents.length ? Math.round(parents.reduce((s, t) => s + bOffset(t.pct, t.status), 0) / parents.length) : 0;
    const delayed = parents.filter(t => t.status === "delayed" || t.status === "runningLate").length;
    return { overallActual, overallBaseline, delayed, total: parents.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  if (loading) return (
    <div className="p-6 animate-pulse space-y-4">
      <div className="h-7 w-56 bg-[#E2E8F0] rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="h-28 bg-white border border-[#E2E8F0] rounded-xl" />)}
      </div>
      <div className="h-64 bg-white border border-[#E2E8F0] rounded-xl" />
    </div>
  );

  const variance = summary.overallActual - summary.overallBaseline;

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F8FAFC] space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">Baseline vs Actual</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Track planned schedule against real progress</p>
        </div>
        <div className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg shadow-sm text-right">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Uploaded</div>
          <div className="text-[12px] font-semibold text-[#475569]">{activeBaseline.uploadedAt}</div>
        </div>
      </div>

      {/* Baseline note banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
        <span className="text-[#D97706] text-[13px]">📋</span>
        <span className="text-[12px] text-[#92400E] font-medium">{activeBaseline.note}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Overall Actual</div>
          <div className="text-[32px] font-bold text-[#2563EB] leading-none mb-1">{summary.overallActual}%</div>
          <div className="text-[12px] text-[#64748B] mb-3">vs <span className="font-semibold">{summary.overallBaseline}%</span> planned</div>
          <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#2563EB] transition-all" style={{ width: `${summary.overallActual}%` }} />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Schedule Variance</div>
          <div className="text-[32px] font-bold leading-none mb-1" style={{ color: variance >= 0 ? "#059669" : "#DC2626" }}>
            {variance >= 0 ? "+" : ""}{variance}%
          </div>
          <div className="text-[12px] font-semibold mb-3" style={{ color: variance >= 0 ? "#059669" : "#DC2626" }}>
            {variance >= 0 ? "Ahead of plan" : "Behind plan"}
          </div>
          <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden relative">
            <div className="h-full rounded-full bg-[#94A3B8]" style={{ width: `${summary.overallBaseline}%` }} />
            <div className="absolute inset-0 h-full rounded-full transition-all" style={{
              width: `${summary.overallActual}%`,
              background: variance >= 0 ? "#059669" : "#DC2626",
            }} />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">At-Risk Tasks</div>
          <div className="text-[32px] font-bold text-[#DC2626] leading-none mb-1">{summary.delayed}</div>
          <div className="text-[12px] text-[#64748B] mb-3">of {summary.total} tasks delayed or late</div>
          <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${summary.total ? (summary.delayed / summary.total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Per-phase breakdown */}
      {groupedData.map(([phase, phaseTasks]) => {
        const parents = phaseTasks.filter(t => !t.parentTaskId);
        const phaseActual = parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
        const phaseBaseline = parents.length ? Math.round(parents.reduce((s, t) => s + bOffset(t.pct, t.status), 0) / parents.length) : 0;
        const collapsed = collapsedPhases.has(phase);
        const phaseVariance = phaseActual - phaseBaseline;

        return (
          <div key={phase} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            {/* Phase header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] cursor-pointer hover:bg-[#EEF2F7] transition-colors"
              onClick={() => togglePhase(phase)}
            >
              <div className="flex items-center gap-3">
                {collapsed
                  ? <ChevronRight size={15} className="text-[#94A3B8] shrink-0" />
                  : <ChevronDown size={15} className="text-[#64748B] shrink-0" />
                }
                <span className="text-[15px] font-bold text-[#0F172A]">{phase}</span>
                <VariancePill variance={phaseVariance} />
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Baseline</div>
                  <div className="text-[16px] font-bold text-[#94A3B8] font-mono leading-tight">{phaseBaseline}%</div>
                </div>
                <div className="w-px h-8 bg-[#E2E8F0]" />
                <div className="text-right">
                  <div className="text-[10px] font-bold text-[#2563EB] uppercase tracking-[0.08em]">Actual</div>
                  <div className="text-[16px] font-bold text-[#2563EB] font-mono leading-tight">{phaseActual}%</div>
                </div>
              </div>
            </div>

            {/* Task rows */}
            {!collapsed && (
              <div className="divide-y divide-[#F1F5F9]">
                {phaseTasks.map(t => {
                  const isSub = !!t.parentTaskId;
                  const baseline = bOffset(t.pct, t.status);
                  const taskVariance = t.pct - baseline;
                  const sc = STATUS_CONFIG[t.status];
                  return (
                    <div key={t.id} className={`px-5 py-4 ${isSub ? "pl-12 bg-[#FAFBFC]" : ""}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isSub && <span className="text-[#CBD5E1] text-[13px]">└</span>}
                          <span className={`font-semibold ${isSub ? "text-[13px] text-[#475569]" : "text-[14px] text-[#0F172A]"}`}>
                            {t.name}
                          </span>
                          {!isSub && t.contractor && (
                            <span className="text-[12px] text-[#94A3B8] font-normal">— {t.contractor}</span>
                          )}
                          <SlippageBadge baselineEnd={t.baselineEnd} actualEnd={t.endDate} />
                        </div>
                        <VariancePill variance={taskVariance} />
                      </div>

                      {/* Baseline bar */}
                      <div className="flex gap-3 items-center mb-2">
                        <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.06em] w-16 shrink-0">Baseline</span>
                        <div className="flex-1 bg-[#F1F5F9] rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#94A3B8] opacity-40" style={{ width: `${Math.min(100, Math.max(0, baseline))}%` }} />
                        </div>
                        <span className="text-[12px] font-bold font-mono text-[#94A3B8] w-9 text-right shrink-0">{Math.max(0, baseline)}%</span>
                      </div>

                      {/* Actual bar */}
                      <div className="flex gap-3 items-center">
                        <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.06em] w-16 shrink-0">Actual</span>
                        <div className="flex-1 bg-[#F1F5F9] rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.pct}%`, background: sc.color }} />
                        </div>
                        <span className="text-[12px] font-bold font-mono w-9 text-right shrink-0" style={{ color: sc.color }}>{t.pct}%</span>
                      </div>

                      {/* Date comparison */}
                      {t.baselineStart && t.baselineEnd && !isSub && (
                        <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-[#94A3B8]">
                          <span>Planned: <span className="font-mono text-[#475569]">{fmtDate(t.baselineStart)} → {fmtDate(t.baselineEnd)}</span></span>
                          <span>Actual: <span className="font-mono font-semibold" style={{ color: t.endDate > (t.baselineEnd ?? "") ? "#DC2626" : "#059669" }}>
                            {fmtDate(t.startDate)} → {fmtDate(t.endDate)}
                          </span></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BaselineActualPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[#94A3B8]">Loading...</div>}>
      <BaselineActualPageContent />
    </Suspense>
  );
}
