"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, ChevronDown, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getDelayRows, getDelayRowsByArea, getDelayDeepDive,
  type DelayRow, type DelayDeepDive,
} from "@/lib/mock-data-extended";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects, fetchTasks, isRealProject } from "@/lib/api-client";

function GroupToggle({ options, active, onChange }: { options: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-[#E2E8F0] shadow-sm">
      {options.map((o, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className="px-4 py-2 text-[13px] font-semibold transition-colors"
          style={{ background: i === active ? "#2563EB" : "#fff", color: i === active ? "#fff" : "#475569" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function AIPanel({ data }: { data: DelayDeepDive }) {
  const critical = data.onCriticalPath;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${critical ? "#DC2626" : "#059669"}` }}>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold text-[#0F172A]">{data.title}</div>
          <span className="text-[12px] text-[#94A3B8] font-semibold">
            {data.contractor} · <span className="font-mono text-[#DC2626]">{data.delayDays}</span>
          </span>
        </div>

        {/* Downstream impact */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Downstream Impact</div>
          {data.downstreamImpact.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-[#059669] font-semibold">
              <CheckCircle size={14} className="shrink-0" />
              No downstream impact — not on critical path.
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.downstreamImpact.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-[#475569]">
                  <span className="text-[#DC2626] shrink-0">→</span>
                  <span>{d.task}</span>
                  <span className="font-mono font-bold text-[#DC2626]">{d.days}{d.cascading ? " (cascading)" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Root cause + pattern + recommendations — light card */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-4">
          <div>
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1.5">Root Cause</div>
            <p className="text-[13px] text-[#334155] leading-relaxed">{data.rootCause}</p>
          </div>

          {data.patternDetected && (
            <div>
              <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1.5">Pattern Detected</div>
              <p className="text-[13px] text-[#334155] leading-relaxed">
                {data.patternDetected}
                {data.supplierReliability && (
                  <> Supplier reliability: <span className="font-bold text-[#DC2626]">{data.supplierReliability}</span>.</>
                )}
              </p>
            </div>
          )}

          <div>
            <div className="text-[11px] font-bold text-[#059669] uppercase tracking-[0.08em] mb-2">Recommended Actions</div>
            <div className="space-y-2">
              {data.recommendations.map((r, i) => (
                <div key={i} className="flex gap-2.5 items-start text-[13px] text-[#334155]">
                  <span className="w-5 h-5 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">{i + 1}</span>
                  <span><span className="font-semibold text-[#0F172A]">{r.action}</span> — {r.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DelayAnalyticsPageContent() {
  const [selected, setSelected] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState(0);
  const [rows, setRows] = useState<DelayRow[]>([]);
  const [deepDive, setDeepDive] = useState<DelayDeepDive | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<string>("—");

  const searchParams = useSearchParams();
  const { workspaceId: ctxWorkspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const workspaceId = searchParams.get("workspaceId");
  const wsId = workspaceId ?? ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!wsId;
  const prevProjectIdParam = useRef(projectIdParam);

  useEffect(() => {
    if (real && wsId) {
      fetchProjects(wsId).then(projects => {
        const p = projects.find(p => p.id === projectIdParam);
        if (p?.endDate) setProjectEndDate(p.endDate);
      });
    }
  }, [projectIdParam, wsId]);

  useEffect(() => {
    prevProjectIdParam.current = projectIdParam;
    if (real) {
      fetchTasks(projectIdParam, wsId!).then(tasks => {
        const delayed = tasks.filter(t => t.status === "delayed" || t.status === "runningLate");
        const realRows: DelayRow[] = delayed.map((t, i) => ({
          id: i + 1,
          name: t.contractor || t.name,
          count: "1",
          avg: t.status === "delayed" ? "3d" : "1d",
          critical: t.status === "delayed" ? "1" : "0",
          impact: t.status === "delayed" ? "+3d" : "+1d",
          projectId: 0,
        }));
        setRows(realRows);
        setSelected(realRows.length > 0 ? realRows[0].id : null);
      });
    } else {
      const fetcher = groupBy === 0 ? getDelayRows : getDelayRowsByArea;
      fetcher(Number(projectIdParam)).then(data => {
        setRows(data);
        setSelected(data.length > 0 ? data[0].id : null);
      });
    }
  }, [projectIdParam, workspaceId, groupBy]);

  useEffect(() => {
    if (selected === null) { setDeepDive(null); return; }
    if (!real) getDelayDeepDive(selected).then(d => setDeepDive(d ?? null));
  }, [selected, real]);

  const totalSlipDays = rows.reduce((sum, r) => {
    const match = r.impact.match(/\+(\d+)/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  const predictedEndDate = (() => {
    if (!projectEndDate || projectEndDate === "—") return "—";
    try {
      const d = new Date(projectEndDate);
      d.setDate(d.getDate() + totalSlipDays);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return "—"; }
  })();

  const plannedEndFormatted = (() => {
    if (!projectEndDate || projectEndDate === "—") return "—";
    try {
      return new Date(projectEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return projectEndDate; }
  })();

  const atRisk = totalSlipDays > 0;

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F8FAFC] space-y-5">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">Delay Analytics</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Track delay impact by contractor or work zone</p>
        </div>
        <GroupToggle options={["By Contractor", "By Space"]} active={groupBy} onChange={setGroupBy} />
      </div>

      {/* Risk banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden"
        style={{ borderLeft: `4px solid ${atRisk ? "#DC2626" : "#059669"}` }}>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${atRisk ? "bg-[#FEF2F2]" : "bg-[#ECFDF5]"}`}>
              {atRisk
                ? <AlertTriangle size={20} className="text-[#DC2626]" />
                : <CheckCircle size={20} className="text-[#059669]" />
              }
            </div>
            <div>
              <div className={`text-[15px] font-bold ${atRisk ? "text-[#DC2626]" : "text-[#059669]"}`}>
                {atRisk ? "Project Deadline at Risk" : "Project On Schedule"}
              </div>
              <div className="text-[13px] text-[#64748B] mt-0.5">
                {atRisk
                  ? `${rows.filter(r => Number(r.critical) > 0).length} critical task${rows.filter(r => Number(r.critical) > 0).length !== 1 ? "s" : ""} on the critical path`
                  : "No active delays impacting the project deadline."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-0.5">Planned End</div>
              <div className="text-[15px] font-bold text-[#475569] font-mono">{plannedEndFormatted}</div>
            </div>
            {atRisk && (
              <>
                <div className="text-[#DC2626] text-[20px] font-light">→</div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-[#DC2626] uppercase tracking-[0.08em] mb-0.5">Predicted End</div>
                  <div className="text-[15px] font-bold text-[#DC2626] font-mono">{predictedEndDate}</div>
                </div>
              </>
            )}
            {atRisk && (
              <div className="px-3 py-1.5 bg-[#FEF2F2] rounded-lg">
                <div className="text-[13px] font-bold text-[#DC2626] font-mono">+{totalSlipDays}d slippage</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Delayed Contractors</div>
          <div className="text-[28px] font-bold text-[#DC2626]">{rows.length}</div>
          <div className="text-[12px] text-[#64748B]">with active delays</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Critical Tasks</div>
          <div className="text-[28px] font-bold text-[#D97706]">
            {rows.reduce((s, r) => s + Number(r.critical || 0), 0)}
          </div>
          <div className="text-[12px] text-[#64748B]">on critical path</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Total Slippage</div>
          <div className="text-[28px] font-bold" style={{ color: totalSlipDays > 0 ? "#DC2626" : "#059669" }}>
            {totalSlipDays > 0 ? `+${totalSlipDays}d` : "0d"}
          </div>
          <div className="text-[12px] text-[#64748B]">deadline impact</div>
        </div>
      </div>

      {/* Delay table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {[groupBy === 0 ? "Contractor" : "Space", "Delayed Tasks", "Avg Delay", "On Critical Path", "Deadline Impact"].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <CheckCircle size={32} className="text-[#059669] mx-auto mb-2" />
                  <div className="text-[14px] font-semibold text-[#059669]">No delays found</div>
                  <div className="text-[12px] text-[#94A3B8] mt-1">All tasks are on schedule.</div>
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const isSelected = selected === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(isSelected ? null : r.id)}
                    className="border-b border-[#F1F5F9] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
                    style={{ background: isSelected ? "#EFF6FF" : "transparent" }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {isSelected
                          ? <ChevronDown size={14} className="text-[#2563EB] shrink-0" />
                          : <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />
                        }
                        <span className="text-[13px] font-semibold text-[#0F172A]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-[#FEF2F2] text-[#DC2626] font-bold px-2.5 py-1 rounded-lg text-[12px] font-mono">
                        {r.count}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[13px] text-[#475569]">{r.avg}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[13px] font-semibold"
                        style={{ color: Number(r.critical) > 0 ? "#DC2626" : "#059669" }}>
                        {r.critical}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold font-mono text-[13px]"
                        style={{ color: r.impact === "None" ? "#059669" : "#DC2626" }}>
                        {r.impact}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Deep dive */}
      {deepDive && <AIPanel data={deepDive} />}
    </div>
  );
}

export default function DelayAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[#94A3B8]">Loading...</div>}>
      <DelayAnalyticsPageContent />
    </Suspense>
  );
}
