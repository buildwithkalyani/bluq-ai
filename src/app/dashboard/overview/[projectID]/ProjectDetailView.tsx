"use client";

import { useState } from "react";
import { FileText, Settings, AlertTriangle, Users, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  STATUS_CONFIG,
  type Project,
} from "@/lib/mock-data";
import {
  Card,
  MetricCard,
  StatusBadge,
  SectionTitle,
  Btn,
} from "@/components/ui/bluq-ui";

// ─── Static Data ─────────────────────────────────────────────────────────────

const TASKS = [
  { name: "Foundation Works",    pct: 75,  status: "runningLate" as const },
  { name: "Rebar Installation",  pct: 60,  status: "inProgress"  as const },
  { name: "Formwork",            pct: 45,  status: "inProgress"  as const },
  { name: "Waterproofing",       pct: 30,  status: "delayed"     as const },
  { name: "Excavation — Zone A", pct: 100, status: "completed"   as const },
  { name: "Excavation — Zone B", pct: 100, status: "completed"   as const },
  { name: "Pile Driving",        pct: 100, status: "completed"   as const },
  { name: "MEP Rough-In",        pct: 0,   status: "notStarted"  as const },
  { name: "External Cladding",   pct: 0,   status: "notStarted"  as const },
  { name: "Window Installation", pct: 0,   status: "notStarted"  as const },
];

const ISSUES = [
  { severity: "HIGH", task: "Foundation Works",    reporter: "Rajesh Kumar", date: "Mar 15", desc: "Cement delivery delayed by supplier, expected tomorrow",      age: "2 days open", contact: "Rajesh Kumar", phone: "+971 50 123 4567", role: "Contractor — Foundation" },
  { severity: "MED",  task: "Rebar Installation",   reporter: "Ahmed Hassan", date: "Mar 14", desc: "3 workers absent, waiting for replacements from subcontractor", age: "3 days open", contact: "Ahmed Hassan",  phone: "+971 50 234 5678", role: "Contractor — Rebar & MEP" },
  { severity: "LOW",  task: "MEP Conduit — Zone A", reporter: "Ahmed Hassan", date: "Mar 15", desc: "Minor cable routing conflict with HVAC duct — needs coordination", age: "1 day open", contact: "Mohammad Ali", phone: "+971 50 345 6789", role: "MEP Coordinator" },
];

const CONTRACTORS = [
  { name: "Rajesh Kumar", task: "Foundation Works",   pct: 75, workers: 12, materials: "Cement: 20 bags",    issue: "Delivery delayed", status: "runningLate" as const, photos: 3 },
  { name: "Ahmed Hassan", task: "Rebar Installation", pct: 60, workers: 8,  materials: "—",                  issue: "3 workers absent", status: "inProgress"  as const, photos: 2 },
  { name: "Mohammad Ali", task: "Formwork",           pct: 45, workers: 10, materials: "Plywood: 50 sheets", issue: "—",                status: "inProgress"  as const, photos: 0 },
];

const sevColors = (sev: string) => ({
  color:      sev === "HIGH" ? "#DC2626" : sev === "MED" ? "#D97706" : "#94A3B8",
  background: sev === "HIGH" ? "#FEF2F2" : sev === "MED" ? "#FFFBEB" : "#F1F5F9",
});

export interface ProjectDetailViewProps {
  project: Project & { clientName?: string; totalArea?: string; type?: string };
  onBack: () => void;
  wrapperClassName?: string;
}

export function ProjectDetailView({
  project: proj,
  onBack,
  wrapperClassName = "",
}: ProjectDetailViewProps) {
  const [showInfo, setShowInfo] = useState(false);
  const router = useRouter();

  const linkedContractorsCount = new Set(CONTRACTORS.map(c => c.name)).size;

  const statusCounts = TASKS.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalTasksCount = TASKS.length;

  const stackedBars = Object.keys(STATUS_CONFIG).map((key) => {
    const statusKey = key as keyof typeof STATUS_CONFIG;
    const count = statusCounts[statusKey] || 0;
    return { status: statusKey, pct: Math.round((count / totalTasksCount) * 100), count };
  }).filter(s => s.count > 0);

  const averageProgress = Math.round(
    TASKS.reduce((acc, t) => acc + t.pct, 0) / totalTasksCount
  );

  return (
    <div className={`font-sans ${wrapperClassName}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <button onClick={onBack} className="text-[13px] text-[#2563EB] font-semibold hover:underline">← All Projects</button>
        <span className="text-[#E2E8F0]">/</span>
        <span className="text-[13px] text-[#0F172A] font-semibold">{proj.name}</span>
      </div>

      <div className={`flex justify-between items-center ${showInfo ? "mb-0" : "mb-4"}`}>
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[18px] font-bold text-[#0F172A]">{proj.name}</div>
            <div className="text-[12px] text-[#94A3B8] font-mono">{proj.code} • {proj.startDate} → {proj.endDate}</div>
          </div>
          <button onClick={() => setShowInfo(!showInfo)} className="w-[30px] h-[30px] rounded-md border border-[#E2E8F0] flex items-center justify-center transition-colors hover:bg-[#F8FAFC]">
            {showInfo ? "▴" : "▾"}
          </button>
        </div>
        <div className="flex gap-2">
          <Btn small onClick={() => router.push(`/dashboard/dpr?projectId=${proj.id}`)}><FileText size={12} className="inline mr-1" /> Generate DPR</Btn>
          <Btn small><Settings size={12} className="inline mr-1" /> Settings</Btn>
        </div>
      </div>

      {showInfo && (
        <Card className="mt-2.5 mb-4 !bg-[#F8FAFC] !border-[#E2E8F0]">
          <div className="grid grid-cols-3 gap-y-4 gap-x-3 text-xs">
            {[
              { label: "Stage",        value: proj.stage },
              { label: "Location",     value: proj.address },
              { label: "Client",       value: proj.clientName || "Al Nakheel Properties LLC" },
              { label: "Project Code", value: proj.code },
              { label: "Start Date",   value: proj.startDate },
              { label: "End Date",     value: proj.endDate },
              { label: "Total Area",   value: proj.totalArea || "Data pending extraction..." },
              { label: "Contractors",  value: `${linkedContractorsCount} linked` },
              { label: "Project Type", value: proj.type || "Commercial" },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-[10px] font-bold text-[#94A3B8] mb-0.5 tracking-wide">{item.label.toUpperCase()}</div>
                <div className="font-medium text-[#0F172A]">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3 mb-4">
        <MetricCard label="Overall Progress" value={`${averageProgress}%`} color={STATUS_CONFIG[proj.status].color} />
        <MetricCard label="Workers On-Site" value={proj.workers} color="#059669" />
        <MetricCard label="Open Issues" value={ISSUES.length} color={ISSUES.length > 0 ? "#DC2626" : "#059669"} />
      </div>

      <SectionTitle>Task Progress Overview</SectionTitle>
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-3.5">
          <div className="text-xs text-[#475569]">{totalTasksCount} total tasks</div>
          <div className="flex gap-3 text-[11px]">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
                <span className="text-[#475569]">{v.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-6 rounded-md overflow-hidden mb-5 border border-[#E2E8F0] bg-[#F1F5F9]">
          {stackedBars.map((s, i) => (
            <div key={i} style={{ width: `${s.pct}%`, background: STATUS_CONFIG[s.status].color }} className="h-full flex items-center justify-center border-r border-white/10 last:border-0 transition-all">
              {s.pct > 7 && <span className="text-[9px] font-bold text-white font-mono">{s.pct}%</span>}
            </div>
          ))}
        </div>
        {TASKS.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
            <span className="text-[11px] font-medium text-[#0F172A] w-[140px] truncate">{t.name}</span>
            <div className="flex-1 h-3.5 bg-[#F1F5F9] rounded overflow-hidden">
              <div className="h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: STATUS_CONFIG[t.status].color }} />
            </div>
            <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color: STATUS_CONFIG[t.status].color }}>{t.pct}%</span>
            <div className="w-[100px] flex justify-end"><StatusBadge status={t.status} /></div>
          </div>
        ))}
      </Card>

      <SectionTitle>Unresolved Issues ({ISSUES.length})</SectionTitle>
      {ISSUES.map((issue, i) => {
        const sc = sevColors(issue.severity);
        return (
          <div key={i} className="mb-2" style={{ borderLeft: `4px solid ${sc.color}` }}>
            <Card className="!p-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: sc.background, color: sc.color }}><AlertTriangle size={10} /> {issue.severity}</span>
                  <span className="text-[13px] font-semibold text-[#0F172A]">{issue.task}</span>
                </div>
                <span className="text-[10px] font-semibold text-[#DC2626] font-mono">{issue.age}</span>
              </div>
              <p className="text-xs text-[#475569] mt-1.5">{issue.desc}</p>
              <div className="flex justify-between items-center mt-2">
                <div className="text-[11px] text-[#94A3B8]">Reported by {issue.reporter} • {issue.date}</div>
                <div className="flex items-center gap-1.5 bg-[#EFF6FF] rounded-md px-2.5 py-1">
                  <span className="text-xs">📞</span>
                  <div>
                    <div className="text-[11px] font-semibold text-[#2563EB]">{issue.contact}</div>
                    <div className="text-[10px] text-[#475569] font-mono">{issue.phone}</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      })}

      <SectionTitle>Today&apos;s Contractor Updates</SectionTitle>
      {CONTRACTORS.map((c, i) => (
        <Card key={i} className="mb-2.5">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[13px] font-bold text-[#0F172A]">{c.name}</div>
              <div className="text-xs text-[#475569]">{c.task}</div>
            </div>
            <StatusBadge status={c.status} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[#475569]">
            <span><strong>{c.pct}%</strong> complete</span>
            <span className="inline-flex items-center gap-1"><Users size={11} /> {c.workers} workers</span>
            {c.materials !== "—" && <span className="inline-flex items-center gap-1"><Package size={11} /> {c.materials}</span>}
          </div>
          {c.issue !== "—" && <div className="mt-1.5 px-2 py-1 bg-[#FEF2F2] rounded text-[11px] text-[#DC2626] flex items-center gap-1"><AlertTriangle size={11} /> {c.issue}</div>}
        </Card>
      ))}

      <SectionTitle>S-Curve (Progress over Time)</SectionTitle>
      <Card className="!p-5">
        <svg viewBox="0 0 420 150" className="w-full h-[150px] shrink-0">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1="40" y1={130 - v * 1.2} x2="400" y2={130 - v * 1.2} stroke="#F1F5F9" strokeWidth="1" />
              <text x="34" y={133 - v * 1.2} fontSize="9" fill="#94A3B8" textAnchor="end" className="font-mono">{v}%</text>
            </g>
          ))}
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, i) => (
            <text key={month} x={40 + i * 72} y="148" fontSize="9" fill="#94A3B8" textAnchor="middle">{month}</text>
          ))}
          <line x1="40" y1="130" x2="40" y2="10" stroke="#E2E8F0" strokeWidth="1" />
          <line x1="40" y1="130" x2="400" y2="130" stroke="#E2E8F0" strokeWidth="1" />
          <path d="M 40 130 Q 112 125 184 110 T 328 40 T 400 10" fill="none" stroke="#94A3B8" strokeWidth="1.25" strokeDasharray="3 2" />
          <path d={`M 40 130 Q 112 128 184 ${130 - (averageProgress * 1.2)}`} fill="none" stroke="#2563EB" strokeWidth="2.25" />
          <path d={`M 40 130 Q 112 128 184 ${130 - (averageProgress * 1.2)} L 184 130 L 40 130 Z`} fill="url(#sg)" />
          <circle cx="184" cy={130 - (averageProgress * 1.2)} r="4" fill="#2563EB" stroke="white" strokeWidth="2" />
          <g transform="translate(250, 16)">
            <line x1="0" y1="0" x2="10" y2="0" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 1.5" />
            <text x="14" y="3" fontSize="8" fill="#94A3B8">Planned</text>
            <circle cx="60" cy="0" r="3" fill="#2563EB" />
            <text x="68" y="3" fontSize="8" fill="#2563EB" fontWeight="bold">Actual</text>
          </g>
        </svg>
      </Card>
    </div>
  );
}
