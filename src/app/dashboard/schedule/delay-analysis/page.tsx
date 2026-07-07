"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import {
  CheckCircle, ChevronDown, ChevronRight, Flag,
  AlertTriangle, TrendingDown, Users, Zap, Clock, Activity,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getDelayRows, getDelayRowsByArea, getDelayDeepDive,
  type DelayRow, type DelayDeepDive,
} from "@/lib/mock-data-extended";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects, fetchTasks, isRealProject } from "@/lib/api-client";
import type { ScheduleTask } from "@/lib/mock-data";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const T = {
  label: "text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]",
  card: "bg-white rounded-2xl border border-[#E8EDF5] shadow-[0_1px_4px_rgba(15,23,42,0.06)]",
  green: { fg: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  amber: { fg: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  red:   { fg: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  blue:  { fg: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  purple:{ fg: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  slate: { fg: "#475569", bg: "#F8FAFC", border: "#E2E8F0" },
};

// ---------------------------------------------------------------------------
// GroupToggle
// ---------------------------------------------------------------------------

function GroupToggle({ options, active, onChange }: { options: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm">
      {options.map((o, i) => (
        <button key={i} onClick={() => onChange(i)}
          className="px-4 py-2 text-[12px] font-semibold transition-all duration-150"
          style={{ background: i === active ? "#1E40AF" : "#fff", color: i === active ? "#fff" : "#64748B" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBanner
// ---------------------------------------------------------------------------

function StatusBanner({ riskTier, slipMonths }: {
  riskTier: "Low" | "Medium" | "Critical"; slipMonths: number;
}) {
  const cfg = riskTier === "Critical"
    ? { ...T.red, badge: "CRITICAL", Icon: AlertTriangle, msg: `Project is ${slipMonths} month${slipMonths !== 1 ? "s" : ""} behind schedule. Immediate intervention required.` }
    : riskTier === "Medium"
    ? { ...T.amber, badge: "AT RISK", Icon: AlertTriangle, msg: `Schedule at risk — ${slipMonths}mo slip detected. Targeted acceleration needed.` }
    : { ...T.green, badge: "ON TRACK", Icon: CheckCircle, msg: "Project tracking to schedule. No delay signals detected." };

  return (
    <div className="flex items-center gap-4 rounded-2xl px-5 py-4 border"
      style={{ background: cfg.bg, borderColor: cfg.border }}>
      <cfg.Icon size={20} style={{ color: cfg.fg }} className="shrink-0" />
      <p className="flex-1 text-[13px] font-medium leading-snug" style={{ color: cfg.fg }}>
        {cfg.msg}
      </p>
      <span className="shrink-0 text-[11px] font-bold px-3 py-1 rounded-full text-white"
        style={{ background: cfg.fg }}>{cfg.badge}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateShiftRow — replaces HeroTimeline; shows when there's actual slip data
// ---------------------------------------------------------------------------

function DateShiftRow({ plannedEnd, predictedEnd, totalSlipDays, atRisk }: {
  plannedEnd: string; predictedEnd: string; totalSlipDays: number; atRisk: boolean;
}) {
  if (!atRisk || plannedEnd === "—") return null;
  const delayColor = totalSlipDays > 90 ? T.red.fg : T.amber.fg;
  const delayBg   = totalSlipDays > 90 ? T.red.bg  : T.amber.bg;
  return (
    <div className={`${T.card} px-5 py-4 flex items-center gap-4 flex-wrap`}>
      <span className={T.label}>Timeline Shift</span>
      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
        <div>
          <div className="text-[10px] text-[#94A3B8] font-semibold mb-0.5">Original DoC</div>
          <div className="text-[14px] font-bold text-[#334155] font-mono">{plannedEnd}</div>
        </div>
        <div className="flex items-center gap-1 text-[#94A3B8]">
          <div className="w-8 h-px bg-[#E2E8F0]" />
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: delayColor, background: delayBg }}>
            +{totalSlipDays}d
          </span>
          <div className="w-8 h-px bg-[#E2E8F0]" />
        </div>
        <div>
          <div className="text-[10px] font-semibold mb-0.5" style={{ color: delayColor }}>AI-Predicted DoC</div>
          <div className="text-[14px] font-bold font-mono" style={{ color: delayColor }}>{predictedEnd}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circular progress (for milestones)
// ---------------------------------------------------------------------------

function CircularProgress({ pct, color }: { pct: number; color: string }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RiskGauge
// ---------------------------------------------------------------------------

function RiskGauge({ riskTier, slipDays }: { riskTier: "Low" | "Medium" | "Critical"; slipDays: number }) {
  const pct = Math.min(slipDays / 180, 1);
  const cx = 100, cy = 95, r = 72, needleLen = 58;
  const svgAngleRad = ((180 + pct * 180) * Math.PI) / 180;
  const nx = +(cx + needleLen * Math.cos(svgAngleRad)).toFixed(1);
  const ny = +(cy + needleLen * Math.sin(svgAngleRad)).toFixed(1);
  const pt = (deg: number) => ({ x: +(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(1), y: +(cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(1) });
  const [p180, p240, p300, p360] = [180, 240, 300, 360].map(pt);
  const seg = (a: typeof p180, b: typeof p180, large = 0) => `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  const needleColor = riskTier === "Low" ? T.green.fg : riskTier === "Medium" ? T.amber.fg : T.red.fg;
  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 200 112" className="w-full max-w-[220px]">
        {/* outer track */}
        <path d={seg(p180, p360, 1)} fill="none" stroke="#F1F5F9" strokeWidth="20" />
        {/* colored zones */}
        <path d={seg(p180, p240)} fill="none" stroke={T.green.fg} strokeWidth="14" strokeLinecap="butt" />
        <path d={seg(p240, p300)} fill="none" stroke={T.amber.fg} strokeWidth="14" strokeLinecap="butt" />
        <path d={seg(p300, p360)} fill="none" stroke={T.red.fg}   strokeWidth="14" strokeLinecap="butt" />
        {/* zone separators */}
        {[p240, p300].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" />
        ))}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill={needleColor} />
        <circle cx={cx} cy={cy} r="4" fill="white" />
        {/* labels */}
        <text x="16" y="112" fontSize="9" fill={T.green.fg} fontWeight="700" fontFamily="system-ui">Low</text>
        <text x="77" y="106" fontSize="9" fill={T.amber.fg} fontWeight="700" fontFamily="system-ui">Medium</text>
        <text x="150" y="112" fontSize="9" fill={T.red.fg}   fontWeight="700" fontFamily="system-ui">Critical</text>
      </svg>
      <div className="mt-2 text-center">
        <div className="text-[28px] font-bold leading-none" style={{ color: needleColor }}>{riskTier}</div>
        <div className={`${T.label} mt-1`}>Risk Tier</div>
        {slipDays > 0 && <div className="text-[11px] text-[#94A3B8] mt-1">{slipDays}d total slip</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SPICard
// ---------------------------------------------------------------------------

function SPICard({ spi }: { spi: number | null }) {
  if (spi === null) {
    return (
      <div className={`${T.card} p-5`}>
        <span className={T.label}>SPI(t)</span>
        <div className="text-[11px] text-[#94A3B8] mt-0.5 mb-3">Schedule Performance Index</div>
        <div className="text-[28px] font-bold text-[#94A3B8]">—</div>
        <div className="text-[11px] text-[#94A3B8] mt-2">Project start date required</div>
      </div>
    );
  }
  const color = spi >= 1.05 ? T.blue.fg : spi >= 0.95 ? T.green.fg : spi >= 0.85 ? T.amber.fg : T.red.fg;
  const label = spi >= 1.05 ? "Ahead" : spi >= 0.95 ? "On Track" : spi >= 0.85 ? "Behind" : "Critical";
  const desc = spi >= 1.05 ? "Ahead of plan" : spi >= 0.95 ? "On plan" : spi >= 0.85 ? "Slightly behind" : "Significantly behind";
  return (
    <div className={`${T.card} p-5`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className={T.label}>SPI(t)</span>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">Schedule Performance Index</div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: color + "18" }}>{label}</span>
      </div>
      <div className="text-[36px] font-bold font-mono leading-none mb-3" style={{ color }}>{spi.toFixed(2)}</div>
      <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(spi * 100, 100)}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#94A3B8]">
        <span>0.0</span>
        <span className="font-semibold text-[#94A3B8]">1.0 = On Plan</span>
        <span>1.2+</span>
      </div>
      <div className="text-[11px] text-[#64748B] mt-2">{desc}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompressionIndexCard
// ---------------------------------------------------------------------------

function CompressionIndexCard({ data }: { data: { ci: number; workDays: number; calDays: number } | null }) {
  if (data === null) {
    return (
      <div className={`${T.card} p-5`}>
        <span className={T.label}>Compression Index</span>
        <div className="text-[10px] text-[#94A3B8] mt-0.5 mb-3">Remaining work ÷ remaining time</div>
        <div className="text-[28px] font-bold text-[#94A3B8]">—</div>
        <div className="text-[11px] text-[#94A3B8] mt-2">No incomplete tasks with dates</div>
      </div>
    );
  }
  const { ci, workDays, calDays } = data;
  const color = ci <= 0.70 ? T.green.fg : ci <= 0.85 ? T.amber.fg : ci <= 1.00 ? T.red.fg : T.purple.fg;
  const label = ci <= 0.70 ? "Comfortable" : ci <= 0.85 ? "Tight" : ci <= 1.00 ? "At limit" : "Not feasible";
  const desc = ci <= 0.70 ? "Normal pace sufficient" : ci <= 0.85 ? "Saturday work likely needed" : ci <= 1.00 ? "7-day weeks required" : "Revised DoC required";
  const markerPct = (1 / 1.5) * 100;
  return (
    <div className={`${T.card} p-5`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className={T.label}>Compression Index</span>
          <div className="text-[10px] text-[#94A3B8] mt-0.5">Work remaining ÷ time remaining</div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: color + "18" }}>{label}</span>
      </div>
      <div className="text-[36px] font-bold font-mono leading-none mb-3" style={{ color }}>{ci.toFixed(2)}x</div>
      <div className="relative h-1.5 rounded-full bg-[#F1F5F9] overflow-visible mb-2">
        <div className="h-full rounded-full overflow-hidden absolute inset-0">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((ci / 1.5) * 100, 100)}%`, background: color }} />
        </div>
        <div className="absolute top-[-3px] w-0.5 h-[12px] bg-[#0F172A] rounded-full" style={{ left: `${markerPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#94A3B8] mb-2">
        <span>0.0 Safe</span>
        <span className="font-bold text-[#334155]">1.0 limit</span>
        <span>1.5+</span>
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-[#64748B]">{desc}</span>
        <span className="font-mono text-[#94A3B8]">{workDays}d / {calDays}d</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DelayDrivers — icon-driven, data-backed only
// ---------------------------------------------------------------------------

function DelayDrivers({ rows, slipMonths, compressionCI }: {
  rows: DelayRow[]; slipMonths: number; compressionCI: number | null;
}) {
  const criticalCount = rows.reduce((s, r) => s + Number(r.critical || 0), 0);
  const totalDelayed = rows.reduce((s, r) => s + Number(r.count || 0), 0);
  const contractorCount = rows.length;

  const drivers: { label: string; detail: string; color: string; bg: string; border: string; Icon: typeof Zap }[] = [];

  if (criticalCount > 0)
    drivers.push({ label: "Critical Path Bottleneck", detail: `${criticalCount} task${criticalCount !== 1 ? "s" : ""} on critical path with cascading schedule impact`, color: T.red.fg, bg: T.red.bg, border: T.red.border, Icon: Zap });

  if (contractorCount > 1)
    drivers.push({ label: "Multi-Contractor Coordination Gap", detail: `${contractorCount} entities with active delays — inter-dependency exposure`, color: T.amber.fg, bg: T.amber.bg, border: T.amber.border, Icon: Users });
  else if (totalDelayed > 3)
    drivers.push({ label: "High Task Concentration", detail: `${totalDelayed} delayed tasks signal resource bandwidth constraints`, color: T.amber.fg, bg: T.amber.bg, border: T.amber.border, Icon: Activity });

  if (compressionCI !== null && compressionCI > 0.85)
    drivers.push({ label: "Schedule Physically Compressed", detail: `${compressionCI.toFixed(2)}x ratio — remaining work exceeds available calendar at current pace`, color: T.purple.fg, bg: T.purple.bg, border: T.purple.border, Icon: Clock });
  else if (slipMonths > 3 && drivers.length < 3)
    drivers.push({ label: "Budget vs. Progress Lag", detail: `${slipMonths}mo overrun signals cost-to-completion escalation risk`, color: T.purple.fg, bg: T.purple.bg, border: T.purple.border, Icon: TrendingDown });

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <span className={T.label}>Delay Drivers</span>
        <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: T.green.bg, borderColor: T.green.border }}>
          <CheckCircle size={16} style={{ color: T.green.fg }} className="shrink-0" />
          <span className="text-[13px] font-semibold" style={{ color: T.green.fg }}>No active delay drivers detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={T.label}>Delay Drivers</span>
      {drivers.slice(0, 3).map((d, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border"
          style={{ background: d.bg, borderColor: d.border }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: d.color + "20" }}>
            <d.Icon size={14} style={{ color: d.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold rounded px-1 py-0.5 text-white"
                style={{ background: d.color }}>{i + 1}</span>
              <span className="text-[12px] font-bold" style={{ color: d.color }}>{d.label}</span>
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">{d.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneRAG
// ---------------------------------------------------------------------------

type RAGStatus = "green" | "amber" | "red";

function getMilestoneRAG(endDate: string, pct: number, status: string): RAGStatus {
  if (status === "completed") return "green";
  const daysLeft = Math.round((new Date(endDate + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (daysLeft < 0 || status === "delayed" || status === "runningLate") return "red";
  if (daysLeft <= 7 && pct < 90) return "red";
  if (daysLeft <= 30 && pct < 60) return "amber";
  if (daysLeft <= 60 && pct < 30) return "amber";
  return "green";
}

interface MilestoneItem { name: string; endDate: string; pct: number; status: string; }

function MilestoneRAGCard({ m }: { m: MilestoneItem }) {
  const rag = getMilestoneRAG(m.endDate, m.pct, m.status);
  const tok = rag === "green" ? T.green : rag === "amber" ? T.amber : T.red;
  const ragLabel = rag === "green" ? "On Track" : rag === "amber" ? "At Risk" : "Critical";
  const end = new Date(m.endDate + "T00:00:00");
  const daysLeft = Math.round((end.getTime() - Date.now()) / 86400000);
  const dateStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className={`${T.card} p-4 hover:shadow-md transition-shadow duration-200`}
      style={{ borderTop: `3px solid ${tok.fg}` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Flag size={12} style={{ color: tok.fg }} className="shrink-0 mt-1" />
          <span className="text-[13px] font-bold text-[#0F172A] leading-snug">{m.name}</span>
        </div>
        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: tok.fg, background: tok.bg }}>{ragLabel}</span>
      </div>

      {/* Circular progress + details */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <CircularProgress pct={m.pct} color={tok.fg} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold" style={{ color: tok.fg }}>{m.pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-[#64748B] mb-1">{dateStr}</div>
          <div className="text-[12px] font-bold" style={{ color: tok.fg }}>
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d remaining`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FloatSummaryCard
// ---------------------------------------------------------------------------

interface FloatTask { name: string; floatDays: number; }

function computeFloatTasks(tasks: ScheduleTask[]): FloatTask[] {
  const today = Date.now();
  return tasks
    .filter(t => t.startDate && t.endDate && t.pct < 100 && t.status !== "completed")
    .map(t => {
      const endMs = new Date(t.endDate + "T00:00:00").getTime();
      const startMs = new Date(t.startDate + "T00:00:00").getTime();
      const duration = Math.max(1, (endMs - startMs) / 86400000);
      return { name: t.name, floatDays: Math.round((endMs - today) / 86400000 - duration * (1 - t.pct / 100)) };
    })
    .sort((a, b) => a.floatDays - b.floatDays);
}

const MOCK_FLOAT_TASKS: FloatTask[] = [
  { name: "Structural Steel Installation",  floatDays: -3 },
  { name: "Electrical Rough-In",            floatDays: 2  },
  { name: "Concrete Pour — Level 4",        floatDays: 5  },
  { name: "MEP Coordination Drawing",       floatDays: 9  },
  { name: "Fire Suppression System",        floatDays: 12 },
];

function FloatSummaryCard({ floatTasks, criticalCount, nearCriticalCount }: {
  floatTasks: FloatTask[]; criticalCount: number; nearCriticalCount: number;
}) {
  const topTight = floatTasks.filter(t => t.floatDays <= 14).slice(0, 5);
  return (
    <div className={`${T.card} p-5`}>
      <span className={`${T.label} mb-4 block`}>Schedule Float Analysis</span>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl p-4 text-center border" style={{ background: T.red.bg, borderColor: T.red.border }}>
          <div className="text-[32px] font-bold leading-none" style={{ color: T.red.fg }}>{criticalCount}</div>
          <div className="text-[11px] font-bold mt-1" style={{ color: T.red.fg }}>Critical Tasks</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Zero float</div>
        </div>
        <div className="rounded-xl p-4 text-center border" style={{ background: T.amber.bg, borderColor: T.amber.border }}>
          <div className="text-[32px] font-bold leading-none" style={{ color: T.amber.fg }}>{nearCriticalCount}</div>
          <div className="text-[11px] font-bold mt-1" style={{ color: T.amber.fg }}>Near-Critical</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">1–7 days float</div>
        </div>
      </div>

      {/* Tightest tasks with mini bar */}
      {topTight.length > 0 ? (
        <div>
          <div className={`${T.label} mb-3`}>Tightest Tasks</div>
          <div className="space-y-3">
            {topTight.map((t, i) => {
              const color = t.floatDays <= 0 ? T.red.fg : t.floatDays <= 7 ? T.amber.fg : T.slate.fg;
              const urgency = Math.max(0, 1 - (t.floatDays + 5) / 20);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] text-[#334155] truncate flex-1">{t.name}</span>
                    <span className="shrink-0 text-[11px] font-bold font-mono px-2 py-0.5 rounded-md"
                      style={{ color, background: color + "15" }}>
                      {t.floatDays <= 0 ? `${Math.abs(t.floatDays)}d over` : `${t.floatDays}d`}
                    </span>
                  </div>
                  {/* Urgency bar: full = most urgent */}
                  <div className="h-1 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(urgency * 100)}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: T.green.bg }}>
          <CheckCircle size={14} style={{ color: T.green.fg }} className="shrink-0" />
          <span className="text-[12px] font-semibold" style={{ color: T.green.fg }}>All tasks have adequate float</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIPanel
// ---------------------------------------------------------------------------

function AIPanel({ data }: { data: DelayDeepDive }) {
  const critical = data.onCriticalPath;
  const accentColor = critical ? T.red.fg : T.green.fg;
  return (
    <div className={`${T.card} overflow-hidden`} style={{ borderLeft: `4px solid ${accentColor}` }}>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold text-[#0F172A]">{data.title}</div>
          <span className="text-[12px] text-[#94A3B8] font-semibold">
            {data.contractor} · <span className="font-mono" style={{ color: T.red.fg }}>{data.delayDays}</span>
          </span>
        </div>
        <div className="mb-4">
          <span className={`${T.label} block mb-2`}>Downstream Impact</span>
          {data.downstreamImpact.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: T.green.fg }}>
              <CheckCircle size={14} className="shrink-0" />
              No downstream impact — not on critical path.
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.downstreamImpact.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-[#475569]">
                  <span className="shrink-0" style={{ color: T.red.fg }}>→</span>
                  <span>{d.task}</span>
                  <span className="font-mono font-bold" style={{ color: T.red.fg }}>{d.days}{d.cascading ? " (cascading)" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4 space-y-4 border" style={{ background: T.slate.bg, borderColor: T.slate.border }}>
          <div>
            <span className={`${T.label} block mb-1.5`}>Root Cause</span>
            <p className="text-[13px] text-[#334155] leading-relaxed">{data.rootCause}</p>
          </div>
          {data.patternDetected && (
            <div>
              <span className={`${T.label} block mb-1.5`}>Pattern Detected</span>
              <p className="text-[13px] text-[#334155] leading-relaxed">
                {data.patternDetected}
                {data.supplierReliability && (
                  <> Supplier reliability: <span className="font-bold" style={{ color: T.red.fg }}>{data.supplierReliability}</span>.</>
                )}
              </p>
            </div>
          )}
          <div>
            <span className={`${T.label} mb-2 block`} style={{ color: T.green.fg }}>Recommended Actions</span>
            <div className="space-y-2">
              {data.recommendations.map((r, i) => (
                <div key={i} className="flex gap-2.5 items-start text-[13px] text-[#334155]">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                    style={{ background: T.green.bg, color: T.green.fg }}>{i + 1}</span>
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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_MILESTONES: MilestoneItem[] = [
  { name: "Structural Frame Completion", endDate: "2025-07-28", pct: 68, status: "inProgress" },
  { name: "MEP Rough-In Sign-off",       endDate: "2025-09-15", pct: 30, status: "inProgress" },
  { name: "Fit-out & Handover",          endDate: "2025-12-20", pct: 0,  status: "notStarted" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DelayAnalyticsPageContent() {
  const [selected, setSelected] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState(0);
  const [rows, setRows] = useState<DelayRow[]>([]);
  const [deepDive, setDeepDive] = useState<DelayDeepDive | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<string>("—");
  const [projectStartDate, setProjectStartDate] = useState<string>("—");
  const [rawTasks, setRawTasks] = useState<ScheduleTask[]>([]);

  const searchParams = useSearchParams();
  const { workspaceId: ctxWorkspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const workspaceId = searchParams.get("workspaceId");
  const versionId = searchParams.get("versionId") ?? undefined;
  const wsId = workspaceId ?? ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!wsId;
  const prevProjectIdParam = useRef(projectIdParam);

  useEffect(() => {
    prevProjectIdParam.current = projectIdParam;
    if (real) {
      Promise.all([
        fetchProjects(wsId!),
        fetchTasks(projectIdParam, wsId!, undefined, versionId),
      ]).then(([projects, tasks]) => {
        setRawTasks(tasks);
        const p = projects.find(proj => proj.id === projectIdParam);
        if (p?.endDate) setProjectEndDate(p.endDate);
        if (p?.startDate) setProjectStartDate(p.startDate);

        const today = new Date().toLocaleDateString("en-CA");
        const projEnd = p?.endDate ?? null;
        const delayedTasks = tasks.filter(t =>
          t.status === "delayed" || t.status === "runningLate" ||
          (t.pct < 100 && t.endDate && ((projEnd && t.endDate > projEnd) || t.endDate < today))
        );

        const calcSlip = (endDate: string) =>
          projEnd && endDate > projEnd
            ? Math.max(1, Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(projEnd + "T00:00:00").getTime()) / 86400000))
            : Math.max(1, Math.round((Date.now() - new Date(endDate + "T00:00:00").getTime()) / 86400000));

        const groupKey = (t: (typeof tasks)[0]) =>
          groupBy === 0 ? (t.contractor && t.contractor !== "—" ? t.contractor : "Unassigned") : (t.space || "Unassigned");

        const grouped = new Map<string, typeof delayedTasks>();
        for (const t of delayedTasks) {
          const key = groupKey(t);
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(t);
        }

        const realRows: DelayRow[] = Array.from(grouped.entries()).map(([key, ts], i) => {
          const slips = ts.map(t => t.endDate ? calcSlip(t.endDate) : 1);
          return {
            id: i + 1, name: key, count: String(ts.length),
            avg: `${Math.round(slips.reduce((a, b) => a + b, 0) / slips.length)}d`,
            critical: String(ts.filter(t => projEnd && t.endDate && t.endDate > projEnd).length),
            impact: `+${Math.max(...slips)}d`, projectId: 0,
          };
        });
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
  }, [projectIdParam, workspaceId, versionId, groupBy, real]);

  useEffect(() => {
    if (selected === null) { setDeepDive(null); return; }
    if (!real) getDelayDeepDive(selected).then(d => setDeepDive(d ?? null));
  }, [selected, real]);

  // --- Derived ---

  const totalSlipDays = rows.reduce((max, r) => {
    const m = r.impact.match(/\+(\d+)/);
    return Math.max(max, m ? Number(m[1]) : 0);
  }, 0);

  const fmt = (d: string) => {
    if (!d || d === "—") return "—";
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };
  const plannedEndFormatted = fmt(projectEndDate);
  const predictedEndDate = (() => {
    if (!projectEndDate || projectEndDate === "—") return "—";
    try { const d = new Date(projectEndDate); d.setDate(d.getDate() + totalSlipDays); return fmt(d.toLocaleDateString("en-CA")); }
    catch { return "—"; }
  })();

  const atRisk = totalSlipDays > 0;
  const slipMonths = Math.round(totalSlipDays / 30.44);
  const riskTier: "Low" | "Medium" | "Critical" =
    totalSlipDays === 0 ? "Low" : totalSlipDays <= 30 ? "Low" : totalSlipDays <= 90 ? "Medium" : "Critical";
  const costEscPct = slipMonths > 0 ? (slipMonths * 1.5).toFixed(1) : "0";

  const spi: number | null = (() => {
    const tasks = real ? rawTasks : null;
    if (!tasks || tasks.length === 0) return real ? null : 0.82;
    if (!projectStartDate || projectStartDate === "—" || !projectEndDate || projectEndDate === "—") return null;
    const avgPct = tasks.reduce((s, t) => s + t.pct, 0) / tasks.length;
    const startMs = new Date(projectStartDate + "T00:00:00").getTime();
    const endMs = new Date(projectEndDate + "T00:00:00").getTime();
    const elapsed = Date.now() - startMs;
    const totalDur = endMs - startMs;
    if (totalDur <= 0 || elapsed <= 0) return null;
    const plannedPct = Math.min(elapsed / totalDur, 1) * 100;
    return plannedPct === 0 ? null : +(avgPct / plannedPct).toFixed(3);
  })();

  const compressionData: { ci: number; workDays: number; calDays: number } | null = (() => {
    if (!real) return { ci: 0.91, workDays: 180, calDays: 198 };
    if (!projectEndDate || projectEndDate === "—") return null;
    const calDays = Math.round((new Date(projectEndDate + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (calDays <= 0) return null;
    const workDays = rawTasks
      .filter(t => t.startDate && t.endDate && t.pct < 100 && t.status !== "completed")
      .reduce((sum, t) => {
        const dur = Math.max(1, (new Date(t.endDate + "T00:00:00").getTime() - new Date(t.startDate + "T00:00:00").getTime()) / 86400000);
        return sum + dur * (1 - t.pct / 100);
      }, 0);
    return { ci: +(workDays / calDays).toFixed(3), workDays: Math.round(workDays), calDays };
  })();

  const upcomingMilestones: MilestoneItem[] = real
    ? rawTasks.filter(t => t.milestone && t.status !== "completed" && t.endDate)
        .sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 3)
        .map(t => ({ name: t.name, endDate: t.endDate, pct: t.pct, status: t.status }))
    : MOCK_MILESTONES;

  const floatTasks = real ? computeFloatTasks(rawTasks) : MOCK_FLOAT_TASKS;
  const criticalFloatCount = real ? floatTasks.filter(t => t.floatDays <= 0).length : 3;
  const nearCriticalFloatCount = real ? floatTasks.filter(t => t.floatDays > 0 && t.floatDays <= 7).length : 5;

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F4F6FA] space-y-5">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight tracking-tight">Delay Analysis</h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5 font-medium">AI-powered schedule risk advisory</p>
        </div>
        <GroupToggle options={["By Contractor", "By Space"]} active={groupBy} onChange={setGroupBy} />
      </div>

      {/* Status Banner */}
      <StatusBanner riskTier={riskTier} slipMonths={slipMonths} />

      {/* Timeline shift — only shown when there's actual slip */}
      <DateShiftRow
        plannedEnd={plannedEndFormatted} predictedEnd={predictedEndDate}
        totalSlipDays={totalSlipDays} atRisk={atRisk}
      />

      {/* 4 KPI metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Predicted Delay */}
        <div className={`${T.card} p-5`}>
          <span className={T.label}>Predicted Delay</span>
          <div className="text-[40px] font-bold leading-none mt-2 mb-1"
            style={{ color: atRisk ? T.red.fg : T.green.fg }}>
            {atRisk ? `+${slipMonths}` : "—"}
          </div>
          {atRisk && <div className="text-[12px] font-semibold" style={{ color: T.red.fg }}>months behind</div>}
          <div className="text-[11px] text-[#94A3B8] mt-1">{atRisk ? `${totalSlipDays} days over schedule` : "On schedule"}</div>
        </div>

        {/* Financial Impact */}
        <div className={`${T.card} p-5`}>
          <span className={T.label}>Financial Impact</span>
          <div className="text-[40px] font-bold leading-none mt-2 mb-1"
            style={{ color: atRisk ? T.amber.fg : T.green.fg }}>
            {atRisk ? `+${costEscPct}` : "0"}
          </div>
          <div className="text-[12px] font-semibold" style={{ color: atRisk ? T.amber.fg : T.green.fg }}>
            % cost escalation
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1">est. on contract value</div>
        </div>

        <SPICard spi={spi} />
        <CompressionIndexCard data={compressionData} />
      </div>

      {/* Risk Gauge + Delay Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${T.card} p-5 flex flex-col`}>
          <span className={`${T.label} mb-4`}>Risk Gauge</span>
          <div className="flex-1 flex items-center justify-center">
            <RiskGauge riskTier={riskTier} slipDays={totalSlipDays} />
          </div>
        </div>
        <div className={`${T.card} p-5`}>
          <DelayDrivers rows={rows} slipMonths={slipMonths} compressionCI={compressionData?.ci ?? null} />
        </div>
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div>
          <span className={`${T.label} block mb-3`}>Upcoming Milestones</span>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {upcomingMilestones.map((m, i) => <MilestoneRAGCard key={i} m={m} />)}
          </div>
        </div>
      )}

      {/* Float Analysis */}
      <FloatSummaryCard floatTasks={floatTasks} criticalCount={criticalFloatCount} nearCriticalCount={nearCriticalFloatCount} />

      {/* Delay Breakdown Table */}
      <div className={`${T.card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="text-[14px] font-bold text-[#0F172A]">Delay Breakdown</div>
          <span className="text-[11px] font-semibold text-[#94A3B8]">
            {rows.length > 0 ? `${rows.reduce((s, r) => s + Number(r.count), 0)} delayed tasks` : "No delays"}
          </span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {[groupBy === 0 ? "Contractor" : "Space", "Delayed Tasks", "Avg Delay", "On Critical Path", "Deadline Impact"].map((h, i) => (
                <th key={i} className="px-5 py-3 text-left border-b border-[#F1F5F9]">
                  <span className={T.label}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ background: T.green.bg }}>
                    <CheckCircle size={24} style={{ color: T.green.fg }} />
                  </div>
                  <div className="text-[14px] font-bold" style={{ color: T.green.fg }}>No delays found</div>
                  <div className="text-[12px] text-[#94A3B8] mt-1">All tasks are tracking to schedule.</div>
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const isSel = selected === r.id;
                const hasCritical = Number(r.critical) > 0;
                return (
                  <tr key={r.id}
                    onClick={() => setSelected(isSel ? null : r.id)}
                    className="border-b border-[#F8FAFC] cursor-pointer transition-all duration-150 hover:bg-[#F8FAFC]"
                    style={{ background: isSel ? T.blue.bg : idx % 2 === 0 ? "white" : "#FAFBFC" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ background: hasCritical ? T.red.fg : T.slate.border }} />
                        {isSel
                          ? <ChevronDown size={13} style={{ color: T.blue.fg }} className="shrink-0" />
                          : <ChevronRight size={13} className="text-[#94A3B8] shrink-0" />}
                        <span className="text-[13px] font-semibold text-[#0F172A]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-bold font-mono px-2.5 py-1 rounded-lg"
                        style={{ color: T.red.fg, background: T.red.bg }}>{r.count}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-[#475569] font-semibold">{r.avg}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] font-bold"
                        style={{ color: hasCritical ? T.red.fg : T.green.fg }}>{r.critical}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-bold font-mono px-2 py-0.5 rounded-md"
                        style={{ color: r.impact === "None" ? T.green.fg : T.red.fg, background: r.impact === "None" ? T.green.bg : T.red.bg }}>
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

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}

export default function DelayAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center gap-3 text-[#94A3B8]">
        <div className="w-4 h-4 rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB] animate-spin" />
        <span className="text-[13px]">Loading delay analytics…</span>
      </div>
    }>
      <DelayAnalyticsPageContent />
    </Suspense>
  );
}
