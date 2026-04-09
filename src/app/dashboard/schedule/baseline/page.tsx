"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { getScheduleTasks, STATUS_CONFIG, type ScheduleTask } from "@/lib/mock-data";

const PHASE_ORDER = ["Site Preparation", "Foundation", "Structure", "MEP", "Finishing", "Handover"];

function VariancePill({ variance }: { variance: number }) {
  if (variance === 0) return <span className="text-[11px] font-mono text-[#8C959F]">On track</span>;
  const ahead = variance > 0;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
      style={{ background: ahead ? "#dafbe1" : "#ffebe9", color: ahead ? "#1A7F37" : "#CF222E" }}>
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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ml-2"
      style={{ background: days > 0 ? "#ffebe9" : "#dafbe1", color: days > 0 ? "#CF222E" : "#1A7F37" }}>
      {days > 0 ? `+${days}d slip` : `${days}d early`}
    </span>
  );
}

function BaselineActualPageContent() {
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");

  useEffect(() => {
    setLoading(true);
    getScheduleTasks(projectId).then(t => { setTasks(t); setLoading(false); });
  }, [projectId]);

  const togglePhase = (p: string) =>
    setCollapsedPhases(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });

  // Group by phase, parents only at top level, sub-tasks after parent
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

  // Project-level summary
  const summary = useMemo(() => {
    const parents = tasks.filter(t => !t.parentTaskId);
    const overallActual = parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
    const overallBaseline = parents.length ? Math.round(parents.reduce((s, t) => s + (t.pct + (t.status === "delayed" || t.status === "runningLate" ? 12 : -4)), 0) / parents.length) : 0;
    const delayed = parents.filter(t => t.status === "delayed" || t.status === "runningLate").length;
    return { overallActual, overallBaseline, delayed, total: parents.length };
  }, [tasks]);

  if (loading) return (
    <div className="p-5 animate-pulse space-y-3">
      <div className="h-6 w-48 bg-[#f0f1f3] rounded" />
      <div className="h-[400px] bg-[#f0f1f3] rounded-lg" />
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa] space-y-4">
      <div className="text-[15px] font-bold text-[#24292f]">Baseline vs Actual</div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#D0D7DE] rounded-lg p-4">
          <div className="text-[10px] font-bold text-[#8C959F] uppercase tracking-wider mb-1.5">Overall Actual</div>
          <div className="text-[28px] font-bold text-[#3A4EA2] leading-none">{summary.overallActual}%</div>
          <div className="text-[11px] text-[#8C959F] mt-1">vs {summary.overallBaseline}% planned</div>
          <div className="mt-2 h-2 bg-[#f0f1f3] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#3A4EA2]" style={{ width: `${summary.overallActual}%` }} />
          </div>
        </div>
        <div className="bg-white border border-[#D0D7DE] rounded-lg p-4">
          <div className="text-[10px] font-bold text-[#8C959F] uppercase tracking-wider mb-1.5">Variance</div>
          <div className="text-[28px] font-bold leading-none" style={{ color: summary.overallActual >= summary.overallBaseline ? "#1A7F37" : "#CF222E" }}>
            {summary.overallActual >= summary.overallBaseline ? "+" : ""}{summary.overallActual - summary.overallBaseline}%
          </div>
          <div className="text-[11px] text-[#8C959F] mt-1">{summary.overallActual >= summary.overallBaseline ? "Ahead of plan" : "Behind plan"}</div>
        </div>
        <div className="bg-white border border-[#D0D7DE] rounded-lg p-4">
          <div className="text-[10px] font-bold text-[#8C959F] uppercase tracking-wider mb-1.5">At Risk Tasks</div>
          <div className="text-[28px] font-bold text-[#CF222E] leading-none">{summary.delayed}</div>
          <div className="text-[11px] text-[#8C959F] mt-1">of {summary.total} total tasks</div>
        </div>
      </div>

      {/* Per-phase breakdown */}
      {groupedData.map(([phase, phaseTasks]) => {
        const parents = phaseTasks.filter(t => !t.parentTaskId);
        const phaseActual = parents.length ? Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length) : 0;
        const phaseBaseline = parents.length ? Math.round(parents.reduce((s, t) => s + (t.pct + (t.status === "delayed" || t.status === "runningLate" ? 12 : -4)), 0) / parents.length) : 0;
        const collapsed = collapsedPhases.has(phase);

        return (
          <div key={phase} className="bg-white border border-[#D0D7DE] rounded-lg overflow-hidden">
            {/* Phase header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f6f8fa] border-b border-[#D0D7DE] cursor-pointer hover:bg-[#eef0f2] transition-colors"
              onClick={() => togglePhase(phase)}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#8C959F]">{collapsed ? "▶" : "▼"}</span>
                <span className="text-[13px] font-bold text-[#24292f]">{phase}</span>
                <VariancePill variance={phaseActual - phaseBaseline} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-[#8C959F] font-semibold">BASELINE</div>
                  <div className="text-[13px] font-bold text-[#8C959F] font-mono">{phaseBaseline}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#3A4EA2] font-semibold">ACTUAL</div>
                  <div className="text-[13px] font-bold text-[#3A4EA2] font-mono">{phaseActual}%</div>
                </div>
              </div>
            </div>

            {/* Task rows */}
            {!collapsed && (
              <div className="divide-y divide-[#f0f1f3]">
                {phaseTasks.map(t => {
                  const isSub = !!t.parentTaskId;
                  const baseline = t.pct + (t.status === "delayed" || t.status === "runningLate" ? 12 : -4);
                  const variance = t.pct - baseline;
                  const sc = STATUS_CONFIG[t.status];
                  return (
                    <div key={t.id} className={`px-4 py-3 ${isSub ? "pl-10 bg-[#fafbfc]" : ""}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          {isSub && <span className="text-gray-300 text-[11px]">└</span>}
                          <span className={`font-semibold ${isSub ? "text-[12px] text-[#57606a]" : "text-[13px] text-[#24292f]"}`}>{t.name}</span>
                          {!isSub && <span className="text-[11px] text-[#8C959F] font-normal ml-1">— {t.contractor}</span>}
                          <SlippageBadge baselineEnd={t.baselineEnd} actualEnd={t.endDate} />
                        </div>
                        <VariancePill variance={variance} />
                      </div>

                      {/* Baseline bar */}
                      <div className="flex gap-2 items-center mb-1.5">
                        <span className="text-[10px] text-[#8C959F] w-14 font-mono uppercase tracking-wider shrink-0">Baseline</span>
                        <div className="flex-1 bg-[#f0f1f3] rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-[#8C959F] opacity-50" style={{ width: `${Math.min(100, Math.max(0, baseline))}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-[#8C959F] w-8 text-right shrink-0">{Math.max(0, baseline)}%</span>
                      </div>

                      {/* Actual bar */}
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-[#8C959F] w-14 font-mono uppercase tracking-wider shrink-0">Actual</span>
                        <div className="flex-1 bg-[#f0f1f3] rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.pct}%`, background: sc.color }} />
                        </div>
                        <span className="text-[11px] font-mono font-bold w-8 text-right shrink-0" style={{ color: sc.color }}>{t.pct}%</span>
                      </div>

                      {/* Date comparison if baseline dates exist */}
                      {t.baselineStart && t.baselineEnd && !isSub && (
                        <div className="mt-2 flex gap-4 text-[10px] text-[#8C959F]">
                          <span>Planned: <span className="font-mono">{t.baselineStart} → {t.baselineEnd}</span></span>
                          <span>Actual: <span className="font-mono" style={{ color: t.endDate > t.baselineEnd ? "#CF222E" : "#1A7F37" }}>{t.startDate} → {t.endDate}</span></span>
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
    <Suspense fallback={<div className="p-6 text-sm text-[#8C959F]">Loading...</div>}>
      <BaselineActualPageContent />
    </Suspense>
  );
}
