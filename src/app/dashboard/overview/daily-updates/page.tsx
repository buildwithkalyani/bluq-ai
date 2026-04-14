"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  getProjects,
  getDoneYesterday,
  getTodoToday,
  getMilestones,
  getAIBriefing,
  type Project,
  type DailyTask,
  type DailyTodo,
  type Milestone,
  type AIBriefing,
  STATUS_CONFIG,
} from "@/lib/mock-data";
import {
  fetchDoneYesterday,
  fetchTodoToday,
  fetchMilestones,
  fetchAIBriefing,
} from "@/lib/api-client";

// ─── SHARED UI ────────────────────────────────────────────────
const Badge = ({ status }: { status: string }) => {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
};

const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-4 ${className}`} style={style}>{children}</div>
);

const GroupToggle = ({ options, active, onChange }: { options: string[]; active: number; onChange: (i: number) => void }) => (
  <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE]">
    {options.map((o, i) => (
      <div key={i} onClick={() => onChange(i)} className="px-3.5 py-1 text-xs font-semibold cursor-pointer transition-colors" style={{
        background: i === active ? "#3A4EA2" : "#fff",
        color: i === active ? "#fff" : "#57606a",
      }}>{o}</div>
    ))}
  </div>
);

const ProjectDropdown = ({ options, selected, onChange }: { options: Project[]; selected: number; onChange: (i: number) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selected === -1 ? "All Projects" : options.find(p => p.id === selected)?.name ?? "All Projects";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#D0D7DE] bg-white text-xs font-semibold text-[#24292f] cursor-pointer hover:bg-[#f6f8fa] transition-colors"
        style={{ minWidth: 160 }}
      >
        <span className="flex-1 text-left">{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke="#57606a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#D0D7DE] rounded-lg shadow-lg z-50 overflow-hidden" style={{ minWidth: 160 }}>
          <div
            onClick={() => { onChange(-1); setOpen(false); }}
            className="px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#f6f8fa] transition-colors"
            style={{ color: selected === -1 ? "#3A4EA2" : "#24292f", background: selected === -1 ? "#ddf4ff" : undefined }}
          >
            All Projects
          </div>
          {options.map((p) => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className="px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#f6f8fa] transition-colors"
              style={{ color: selected === p.id ? "#3A4EA2" : "#24292f", background: selected === p.id ? "#ddf4ff" : undefined }}
            >
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function DailyUpdates() {
  const searchParams = useSearchParams();
  // Real project UUID + workspaceId from URL — when present, use real API
  // When absent, fall back to mock data so demo/client previews keep working
  const projectUuid  = searchParams.get("projectUuid");
  const workspaceId  = searchParams.get("workspaceId");
  const isRealData   = !!(projectUuid && workspaceId);

  const [milestoneRange, setMilestoneRange] = useState(0);
  const [selectedProject, setSelectedProject] = useState<number>(-1); // -1 = All Projects
  const ranges = [7, 15, 30];

  const [projects, setProjects]           = useState<Project[]>([]);
  const [doneYesterday, setDoneYesterday] = useState<DailyTask[]>([]);
  const [todoToday, setTodoToday]         = useState<DailyTodo[]>([]);
  const [milestones, setMilestones]       = useState<Milestone[]>([]);
  const [briefing, setBriefing]           = useState<AIBriefing | null>(null);

  // Load projects once
  useEffect(() => {
    getProjects().then(setProjects);
  }, []);

  // Reload data whenever selected project or milestone range changes
  useEffect(() => {
    const days = ranges[milestoneRange];
    if (isRealData) {
      // Real backend data
      fetchDoneYesterday(projectUuid!, workspaceId!).then(setDoneYesterday).catch(console.error);
      fetchTodoToday(projectUuid!, workspaceId!).then(setTodoToday).catch(console.error);
      fetchMilestones(projectUuid!, workspaceId!, days).then(setMilestones).catch(console.error);
      fetchAIBriefing(projectUuid!, workspaceId!).then(setBriefing).catch(console.error);
    } else {
      // Mock fallback — demo / client preview mode
      const pid = selectedProject === -1 ? undefined : selectedProject;
      getDoneYesterday(pid).then(setDoneYesterday);
      getTodoToday(pid).then(setTodoToday);
      getMilestones(pid).then(setMilestones);
      getAIBriefing(selectedProject === -1 ? null : selectedProject).then(setBriefing);
    }
  }, [selectedProject, milestoneRange, projectUuid, workspaceId]);

  const filteredMilestones = isRealData
    ? milestones   // backend already filtered by days
    : milestones.filter(m => m.daysLeft <= ranges[milestoneRange]);
  const isFiltered = selectedProject !== -1;

  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-[15px] font-bold text-[#24292f]">Daily Updates</div>
        <div className="flex gap-2 items-center">
          <ProjectDropdown options={projects} selected={selectedProject} onChange={setSelectedProject} />
          <button className="bg-[#3A4EA2] text-white border-none rounded-md px-4 py-1.5 text-sm font-semibold cursor-pointer">📄 Generate DPR</button>
        </div>
      </div>

      {/* AI Briefing */}
      <Card className="!bg-[#0D1117] !text-[#c9d1d9] mb-4 !border-[#30363d]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#3FB950]" style={{ boxShadow: "0 0 6px #3FB950" }} />
          <span className="text-xs font-bold text-[#3FB950] font-mono tracking-wide">AI BRIEFING</span>
          <span className="text-[10px] text-[#484f58] font-mono">Updated 5 min ago</span>
        </div>
        {briefing && (
          <div className="text-sm leading-relaxed">
            {isFiltered && <strong className="text-[#f0f6fc]">{projects.find(p => p.id === selectedProject)?.name} — </strong>}
            {!isFiltered && <strong className="text-[#f0f6fc]">{briefing.text.split(".")[0]}.</strong>}{" "}
            {isFiltered ? briefing.text : briefing.text.split(".").slice(1).join(".").trim()}{" "}
            <span className="text-[#3FB950] font-semibold">{briefing.highlight}</span>
          </div>
        )}
      </Card>

      {/* Two columns: Done Yesterday + To Do Today */}
      <div className="grid grid-cols-2 gap-3.5 mb-4">
        {/* Done Yesterday */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[15px] font-bold text-[#24292f]">Done Yesterday</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#dafbe1] text-[#1A7F37] text-[11px] font-bold font-mono">{doneYesterday.length} completed</span>
          </div>
          <Card>
            {doneYesterday.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#8C959F]">No tasks completed yesterday for this project</div>
            ) : (
              doneYesterday.map((t, i) => (
                <div key={i} className="py-2" style={{ borderBottom: i < doneYesterday.length - 1 ? "1px solid #f0f1f3" : "none" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-4 h-4 rounded bg-[#dafbe1] flex items-center justify-center text-[9px] text-[#1A7F37] shrink-0">✓</span>
                    <span className="text-xs font-semibold text-[#24292f]">{t.task}</span>
                  </div>
                  <div className="ml-[22px] text-[11px] text-[#8C959F]">
                    {!isFiltered ? `${t.project} • ` : ""}{t.contractor}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* To Do Today */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[15px] font-bold text-[#24292f]">To Do Today</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ddf4ff] text-[#3A4EA2] text-[11px] font-bold font-mono">{todoToday.length} tasks</span>
          </div>
          <Card>
            {todoToday.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#8C959F]">No tasks scheduled today for this project</div>
            ) : (
              todoToday.map((t, i) => (
                <div key={i} className="py-2" style={{ borderBottom: i < todoToday.length - 1 ? "1px solid #f0f1f3" : "none" }}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                        background: t.priority === "high" ? "#CF222E" : t.priority === "medium" ? "#9A6700" : "#8C959F"
                      }} />
                      <span className="text-xs font-semibold text-[#24292f]">{t.task}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{
                      background: t.priority === "high" ? "#ffebe9" : t.priority === "medium" ? "#fff8c5" : "#f0f1f3",
                      color: t.priority === "high" ? "#CF222E" : t.priority === "medium" ? "#9A6700" : "#8C959F",
                    }}>{t.priority}</span>
                  </div>
                  <div className="ml-3 text-[11px] text-[#8C959F]">
                    {!isFiltered ? `${t.project} • ` : ""}{t.contractor}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {/* Upcoming Milestones */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-[15px] font-bold text-[#24292f]">Upcoming Milestones</span>
        <GroupToggle options={["7d", "15d", "30d"]} active={milestoneRange} onChange={setMilestoneRange} />
      </div>
      <Card>
        {filteredMilestones.length === 0 ? (
          <div className="py-4 text-center text-xs text-[#8C959F]">
            No milestones in the next {ranges[milestoneRange]} days{isFiltered ? ` for ${projects.find(p => p.id === selectedProject)?.name}` : ""}
          </div>
        ) : (
          <div className={`grid ${filteredMilestones.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
            {filteredMilestones.map((m, i) => (
              <div key={i} className="px-3 py-2.5" style={{
                borderBottom: "1px solid #f0f1f3",
                borderRight: filteredMilestones.length > 3 && i % 2 === 0 ? "1px solid #f0f1f3" : "none",
              }}>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="text-sm font-semibold text-[#24292f]">{m.name}</div>
                    <div className="text-[11px] text-[#8C959F]">{m.project}</div>
                  </div>
                  <Badge status={m.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono text-[#8C959F]">{m.date}</span>
                  <span className="text-[10px] font-bold font-mono" style={{ color: m.daysLeft <= 7 ? "#CF222E" : "#57606a" }}>
                    {m.daysLeft}d left
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}