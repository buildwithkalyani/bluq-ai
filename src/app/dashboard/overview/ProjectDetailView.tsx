"use client";

import { useState, useEffect } from "react";
import {
  STATUS_CONFIG,
  getScheduleTasks,
  getProjectIssues,
  type Project,
  type ScheduleTask,
  type ProjectIssue,
} from "@/lib/mock-data";
import {
  Card,
  MetricCard,
  StatusBadge,
  SectionTitle,
  Btn,
} from "@/components/ui/bluq-ui";

const sevColors = (sev: string) => ({
  color:      sev === "HIGH" ? "#CF222E" : sev === "MED" ? "#9A6700" : "#8C959F",
  background: sev === "HIGH" ? "#ffebe9" : sev === "MED" ? "#fff8c5" : "#f0f1f3",
});

interface ProjectDetailViewProps {
  project: Project & { clientName?: string; totalArea?: string; type?: string };
  onBack: () => void;
  wrapperClassName?: string;
}

export default function ProjectDetailView({
  project: proj,
  onBack,
  wrapperClassName = "",
}: ProjectDetailViewProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getScheduleTasks(proj.id),
      getProjectIssues(proj.id),
    ]).then(([t, i]) => {
      setTasks(t);
      setIssues(i);
      setLoading(false);
    });
  }, [proj.id]);

  // Parent tasks only for the overview list
  const parentTasks = tasks.filter(t => !t.parentTaskId);

  // Derive contractor rows from parent tasks
  const contractorMap: Record<string, { task: string; pct: number; status: ScheduleTask["status"] }[]> = {};
  parentTasks.forEach(t => {
    if (!contractorMap[t.contractor]) contractorMap[t.contractor] = [];
    contractorMap[t.contractor].push({ task: t.name, pct: t.pct, status: t.status });
  });
  const contractors = Object.entries(contractorMap).map(([name, taskList]) => ({
    name,
    tasks: taskList,
    avgPct: Math.round(taskList.reduce((s, t) => s + t.pct, 0) / taskList.length),
    worstStatus: taskList.reduce<ScheduleTask["status"]>((worst, t) => {
      const priority = ["delayed","runningLate","inProgress","notStarted","completed"];
      return priority.indexOf(t.status) < priority.indexOf(worst) ? t.status : worst;
    }, "completed"),
  }));

  const totalTasksCount = parentTasks.length || 1;
  const averageProgress = Math.round(
    parentTasks.reduce((acc, t) => acc + t.pct, 0) / totalTasksCount
  );

  const statusCounts = parentTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stackedBars = Object.keys(STATUS_CONFIG).map((key) => {
    const k = key as keyof typeof STATUS_CONFIG;
    const count = statusCounts[k] || 0;
    return { status: k, pct: Math.round((count / totalTasksCount) * 100), count };
  }).filter(s => s.count > 0);

  return (
    <div className={`font-sans ${wrapperClassName}`}>
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2.5 mb-4">
        <button onClick={onBack} className="text-[13px] text-[#3A4EA2] font-semibold hover:underline">← All Projects</button>
        <span className="text-[#D0D7DE]">/</span>
        <span className="text-[13px] text-[#24292f] font-semibold">{proj.name}</span>
      </div>

      <div className={`flex justify-between items-center ${showInfo ? "mb-0" : "mb-4"}`}>
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[18px] font-bold text-[#24292f]">{proj.name}</div>
            <div className="text-[12px] text-[#8C959F] font-mono">{proj.code} • {proj.startDate} → {proj.endDate}</div>
          </div>
          <button onClick={() => setShowInfo(!showInfo)} className="w-[30px] h-[30px] rounded-md border border-[#D0D7DE] flex items-center justify-center transition-colors hover:bg-[#f6f8fa]">
            {showInfo ? "▴" : "▾"}
          </button>
        </div>
        <div className="flex gap-2">
          <Btn small>📄 Generate DPR</Btn>
          <Btn small>⚙️ Settings</Btn>
        </div>
      </div>

      {showInfo && (
        <Card className="mt-2.5 mb-4 !bg-[#f6f8fa] !border-[#e1e4e8]">
          <div className="grid grid-cols-3 gap-y-4 gap-x-3 text-xs">
            {[
              { label: "Stage",        value: proj.stage },
              { label: "Location",     value: proj.address },
              { label: "Client",       value: proj.clientName || "—" },
              { label: "Project Code", value: proj.code },
              { label: "Start Date",   value: proj.startDate },
              { label: "End Date",     value: proj.endDate },
              { label: "Total Area",   value: proj.totalArea || "—" },
              { label: "Contractors",  value: `${contractors.length} linked` },
              { label: "Project Type", value: proj.type || "—" },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-[10px] font-bold text-[#8C959F] mb-0.5 tracking-wide">{item.label.toUpperCase()}</div>
                <div className="font-medium text-[#24292f]">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-[#f0f1f3] rounded-lg" />
          <div className="h-48 bg-[#f0f1f3] rounded-lg" />
        </div>
      ) : (
        <>
          {/* ── Metrics ── */}
          <div className="flex gap-3 mb-4">
            <MetricCard label="Overall Progress" value={`${averageProgress}%`} color={STATUS_CONFIG[proj.status].color} />
            <MetricCard label="Workers On-Site"  value={proj.workers} color="#1A7F37" />
            <MetricCard label="Open Issues"      value={issues.length} color={issues.length > 0 ? "#CF222E" : "#1A7F37"} />
          </div>

          {/* ── Task Overview ── */}
          <SectionTitle>Task Progress Overview</SectionTitle>
          <Card className="mb-4">
            {parentTasks.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-[#8C959F]">No tasks yet — import a schedule to get started.</div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3.5">
                  <div className="text-xs text-[#57606a]">{totalTasksCount} tasks</div>
                  <div className="flex gap-3 text-[11px]">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
                        <span className="text-[#57606a]">{v.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex h-6 rounded-md overflow-hidden mb-5 border border-[#e1e4e8] bg-[#f0f1f3]">
                  {stackedBars.map((s, i) => (
                    <div key={i} style={{ width: `${s.pct}%`, background: STATUS_CONFIG[s.status].color }} className="h-full flex items-center justify-center border-r border-white/10 last:border-0 transition-all">
                      {s.pct > 7 && <span className="text-[9px] font-bold text-white font-mono">{s.pct}%</span>}
                    </div>
                  ))}
                </div>

                {parentTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
                    <span className="text-[11px] font-medium text-[#24292f] w-[160px] truncate">{t.name}</span>
                    <div className="flex-1 h-3.5 bg-[#f0f1f3] rounded overflow-hidden">
                      <div className="h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: STATUS_CONFIG[t.status].color }} />
                    </div>
                    <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color: STATUS_CONFIG[t.status].color }}>{t.pct}%</span>
                    <div className="w-[100px] flex justify-end"><StatusBadge status={t.status} /></div>
                  </div>
                ))}
              </>
            )}
          </Card>

          {/* ── Unresolved Issues ── */}
          <SectionTitle>Unresolved Issues ({issues.length})</SectionTitle>
          {issues.length === 0 ? (
            <Card className="mb-4">
              <div className="text-center py-6 text-[13px] text-[#1A7F37] font-semibold">✓ No open issues</div>
            </Card>
          ) : (
            issues.map((issue, i) => {
              const sc = sevColors(issue.severity);
              return (
                <div key={i} className="mb-2" style={{ borderLeft: `4px solid ${sc.color}` }}>
                  <Card className="!p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: sc.background, color: sc.color }}>⚠ {issue.severity}</span>
                        <span className="text-[13px] font-semibold text-[#24292f]">{issue.task}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#CF222E] font-mono">{issue.age}</span>
                    </div>
                    <p className="text-xs text-[#57606a] mt-1.5">{issue.desc}</p>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-[11px] text-[#8C959F]">Reported by {issue.reporter} • {issue.date}</div>
                      <div className="flex items-center gap-1.5 bg-[#ddf4ff] rounded-md px-2.5 py-1">
                        <span className="text-xs">📞</span>
                        <div>
                          <div className="text-[11px] font-semibold text-[#3A4EA2]">{issue.contact}</div>
                          <div className="text-[10px] text-[#57606a] font-mono">{issue.phone}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })
          )}

          {/* ── Contractor Updates ── */}
          <SectionTitle>Contractor Overview</SectionTitle>
          {contractors.length === 0 ? (
            <Card className="mb-4">
              <div className="text-center py-6 text-[13px] text-[#8C959F]">No contractors linked yet.</div>
            </Card>
          ) : (
            contractors.map((c, i) => (
              <Card key={i} className="mb-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[13px] font-bold text-[#24292f]">{c.name}</div>
                    <div className="text-xs text-[#57606a]">{c.tasks.map(t => t.task).join(", ")}</div>
                  </div>
                  <StatusBadge status={c.worstStatus} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-[#57606a]">
                  <span><strong>{c.avgPct}%</strong> avg progress</span>
                  <span>{c.tasks.length} task{c.tasks.length > 1 ? "s" : ""}</span>
                </div>
              </Card>
            ))
          )}

          {/* ── Compact S-Curve ── */}
          <SectionTitle>S-Curve (Progress over Time)</SectionTitle>
          <Card className="!p-5">
            <svg viewBox="0 0 420 150" className="w-full h-[150px] shrink-0">
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3A4EA2" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#3A4EA2" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line x1="40" y1={130 - v * 1.2} x2="400" y2={130 - v * 1.2} stroke="#f0f1f3" strokeWidth="1" />
                  <text x="34" y={133 - v * 1.2} fontSize="9" fill="#8C959F" textAnchor="end" className="font-mono">{v}%</text>
                </g>
              ))}
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, i) => (
                <text key={month} x={40 + i * 72} y="148" fontSize="9" fill="#8C959F" textAnchor="middle">{month}</text>
              ))}
              <line x1="40" y1="130" x2="40" y2="10" stroke="#D0D7DE" strokeWidth="1" />
              <line x1="40" y1="130" x2="400" y2="130" stroke="#D0D7DE" strokeWidth="1" />
              <path d="M 40 130 Q 112 125 184 110 T 328 40 T 400 10" fill="none" stroke="#8C959F" strokeWidth="1.25" strokeDasharray="3 2" />
              <path d={`M 40 130 Q 112 128 184 ${130 - (averageProgress * 1.2)}`} fill="none" stroke="#3A4EA2" strokeWidth="2.25" />
              <path d={`M 40 130 Q 112 128 184 ${130 - (averageProgress * 1.2)} L 184 130 L 40 130 Z`} fill="url(#sg)" />
              <circle cx="184" cy={130 - (averageProgress * 1.2)} r="4" fill="#3A4EA2" stroke="white" strokeWidth="2" />
              <g transform="translate(250, 16)">
                <line x1="0" y1="0" x2="10" y2="0" stroke="#8C959F" strokeWidth="1" strokeDasharray="2 1.5" />
                <text x="14" y="3" fontSize="8" fill="#8C959F">Planned</text>
                <circle cx="60" cy="0" r="3" fill="#3A4EA2" />
                <text x="68" y="3" fontSize="8" fill="#3A4EA2" fontWeight="bold">Actual</text>
              </g>
            </svg>
          </Card>
        </>
      )}
    </div>
  );
}
