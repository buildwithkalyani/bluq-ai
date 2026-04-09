"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDPRHistory,
  getProjects,
  type DPREntry,
  type Project,
} from "@/lib/mock-data-extended";
import { getScheduleTasks } from "@/lib/mock-data";
import { Card, SectionTitle } from "@/components/ui/bluq-ui";

const REPORT_SECTIONS = [
  { id: "executive_summary", label: "AI Executive Summary",  defaultChecked: true },
  { id: "s_curve",           label: "Progress S-Curve",      defaultChecked: true },
  { id: "site_progress",     label: "Site Progress",         defaultChecked: true },
  { id: "site_attendance",   label: "Site Attendance",       defaultChecked: true },
  { id: "material_usage",    label: "Material Usage",        defaultChecked: true },
  { id: "issues",            label: "Critical Issues",       defaultChecked: true },
  { id: "site_photos",       label: "Site Photos",           defaultChecked: true },
];

export default function DPRPage() {
  const searchParams = useSearchParams();
  const urlProjectId = Number(searchParams.get("projectId") ?? "0");

  const [viewState, setViewState] = useState<string>("generate");
  const [history, setHistory] = useState<DPREntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(urlProjectId);
  const [loading, setLoading] = useState(true);

  // Live project metrics
  const [actualProgress, setActualProgress] = useState(0);
  const [plannedProgress, setPlannedProgress] = useState(0);
  const [workersOnSite, setWorkersOnSite] = useState(0);

  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(REPORT_SECTIONS.map(s => [s.id, s.defaultChecked]))
  );
  const [filterMember, setFilterMember] = useState("all");
  const [generating, setGenerating] = useState(false);

  // Load projects list
  useEffect(() => {
    getProjects().then(setProjects);
  }, []);

  // Sync selectedProjectId when URL changes
  useEffect(() => {
    setSelectedProjectId(urlProjectId);
  }, [urlProjectId]);

  // Load history + schedule data when project changes
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDPRHistory(selectedProjectId),
      getScheduleTasks(selectedProjectId),
    ]).then(([h, tasks]) => {
      setHistory(h || []);

      const parents = tasks.filter(t => !t.parentTaskId);
      if (parents.length > 0) {
        const actual = Math.round(parents.reduce((s, t) => s + t.pct, 0) / parents.length);
        setActualProgress(actual);
        // Planned = simple estimate: average of baseline pct (using baselineEnd offset)
        const planned = Math.min(100, actual + 5); // approximation until real baseline data is available
        setPlannedProgress(planned);
        setWorkersOnSite(parents.reduce((s, t) => s + (t.pct > 0 ? 8 : 0), 0)); // rough estimate
      } else {
        setActualProgress(0);
        setPlannedProgress(0);
        setWorkersOnSite(0);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const members = useMemo(() => Array.from(new Set(history.map(h => h.submittedBy))), [history]);
  const filteredHistory = useMemo(() =>
    filterMember === "all" ? history : history.filter(h => h.submittedBy === filterMember),
  [history, filterMember]);

  // S-Curve data — based on actual progress
  const plannedData = [0, 10, 22, 35, 50, 65, 78, 88, 95, 100];
  const actualStopIdx = Math.round((actualProgress / 100) * (plannedData.length - 1));
  const actualData = plannedData.slice(0, actualStopIdx + 1).map((v, i) =>
    i === actualStopIdx ? actualProgress : Math.round(v * (actualProgress / (plannedData[actualStopIdx] || 1)))
  );

  const generatePath = (data: number[], width: number, height: number) => {
    const points = data.map((val, i) => {
      const x = (i / (plannedData.length - 1)) * width;
      const y = height - (val / 100) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const toggleSection = (id: string) => setSections(prev => ({ ...prev, [id]: !prev[id] }));

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); alert("PDF Generated and downloaded successfully!"); }, 2000);
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-[#f0f1f3] rounded" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[#f0f1f3] rounded-lg" />)}
        </div>
      </div>
    );
  }

  // ─── REPORT DETAIL VIEW ─────────────────────────────────
  if (viewState !== "feed" && viewState !== "generate" && viewState !== "history") {
    const report = history.find(h => h.id.toString() === viewState);
    return (
      <div className="p-5 overflow-y-auto h-full flex justify-center bg-[#f6f8fa]">
        <div className="w-full max-w-2xl">
          <div className="mb-3">
            <div onClick={() => setViewState("history")}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[13px] text-[#3A4EA2] font-semibold hover:underline">
              ← Back to History
            </div>
          </div>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-base border border-[#D0D7DE] shadow-sm">📄</div>
            <div>
              <div className="text-[15px] font-bold">DPR — {report?.date || reportDate}</div>
              <div className="text-xs text-[#57606a]">
                Project: {selectedProject?.name ?? "—"} • Submitted by {report?.submittedBy || "AI Agent"}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Card className="bg-white border-[#D0D7DE] shadow-sm">
              <div className="text-[10px] text-[#3A4EA2] font-bold mb-2 font-mono uppercase">AI Executive Summary</div>
              <div className="text-[13px] text-[#24292f] leading-relaxed">
                Overall project progress is currently at <strong>{report?.overallProgress ?? actualProgress}%</strong>.{" "}
                {(report?.overallProgress ?? actualProgress) < plannedProgress
                  ? `The project is trailing by ${plannedProgress - (report?.overallProgress ?? actualProgress)}% against the baseline.`
                  : "The project is on or ahead of schedule."}{" "}
                Labor turnout on record: {report?.workersOnSite ?? workersOnSite} workers.
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <SectionTitle>Daily Progress Report</SectionTitle>
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(Number(e.target.value))}
              className="appearance-none bg-white border border-[#D0D7DE] rounded-md py-1.5 pl-3 pr-8 text-[13px] font-semibold text-[#24292f] cursor-pointer outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] shadow-sm"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#57606a]">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE] shadow-sm">
          {(["generate", "history"] as const).map(v => (
            <button key={v} onClick={() => setViewState(v)}
              className={`px-4 py-1.5 text-xs font-semibold capitalize transition-all ${viewState === v ? "bg-[#3A4EA2] text-white" : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"}`}>
              {v === "generate" ? "Generate Report" : "Report History"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── GENERATE VIEW ──────────────────────────────────────── */}
      {viewState === "generate" && (
        <div className="flex gap-6 items-start">
          {/* Controls */}
          <div className="w-[280px] shrink-0 sticky top-0">
            <Card className="space-y-6 shadow-sm border-[#D0D7DE] bg-white">
              <div>
                <label className="block text-xs font-semibold text-[#24292f] mb-1.5">Report Date</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                  className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#3A4EA2] outline-none" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#24292f] mb-3">Include Sections:</h3>
                <div className="space-y-2">
                  {REPORT_SECTIONS.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" className="rounded border-[#D0D7DE] text-[#3A4EA2] focus:ring-[#3A4EA2]"
                        checked={sections[s.id]} onChange={() => toggleSection(s.id)} />
                      <span className="text-[13px] text-[#57606a] select-none group-hover:text-[#24292f] transition-colors">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-[#e1e4e8]">
                <button onClick={handleGenerate} disabled={generating}
                  className="w-full bg-[#3A4EA2] hover:bg-[#0353A4] text-white py-2 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-70">
                  {generating ? "Generating PDF..." : "Generate & Download"}
                </button>
              </div>
            </Card>
          </div>

          {/* Live Preview */}
          <div className="flex-1 max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[#57606a] text-xs font-semibold uppercase tracking-wider">
              <span>👁️ Live Preview</span>
            </div>
            <div id="dpr-report-preview" className="space-y-4">
              {/* Header */}
              <Card className="bg-white border-[#D0D7DE] shadow-sm pb-4 border-b-4 border-b-[#3A4EA2]">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-black text-[#24292f] tracking-tight">Daily Progress Report</h1>
                    <div className="text-sm text-[#57606a] mt-1 font-medium">{selectedProject?.name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#24292f]">{reportDate}</div>
                    <div className="text-[10px] font-bold text-[#3A4EA2] tracking-[1px] uppercase mt-1">Bluq Engineering</div>
                  </div>
                </div>
              </Card>

              {sections.executive_summary && (
                <Card className="bg-[#f6f8fa] border-[#e1e4e8] shadow-sm">
                  <div className="text-[10px] text-[#3A4EA2] font-bold mb-2 font-mono uppercase">AI Executive Summary</div>
                  <div className="text-[13px] text-[#24292f] leading-relaxed">
                    Overall project progress is currently at <strong>{actualProgress}%</strong>.{" "}
                    {actualProgress < plannedProgress
                      ? `The project is trailing by ${plannedProgress - actualProgress}% against the baseline.`
                      : "The project is on or ahead of schedule."}{" "}
                    Labor turnout: {workersOnSite} workers on site.
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                {sections.site_progress && (
                  <Card className="bg-white shadow-sm border-[#D0D7DE]">
                    <div className="text-[10px] text-[#57606a] font-bold mb-2 font-mono uppercase">Site Progress</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[11px] text-[#57606a]">Actual</div>
                        <div className="text-xl font-black text-[#1a7f37]">{actualProgress}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#57606a]">Planned</div>
                        <div className="text-sm font-bold text-[#24292f]">{plannedProgress}%</div>
                      </div>
                    </div>
                  </Card>
                )}
                {sections.site_attendance && (
                  <Card className="bg-white shadow-sm border-[#D0D7DE]">
                    <div className="text-[10px] text-[#57606a] font-bold mb-2 font-mono uppercase">Site Attendance</div>
                    <div className="text-xl font-black text-[#24292f]">{workersOnSite} <span className="text-xs font-normal text-[#57606a]">Workers</span></div>
                    <div className="text-[11px] text-[#57606a] mt-1">On site today</div>
                  </Card>
                )}
              </div>

              {sections.s_curve && (
                <Card className="bg-white shadow-sm border-[#D0D7DE]">
                  <div className="text-[10px] text-[#57606a] font-bold mb-3 font-mono uppercase">Progress S-Curve</div>
                  <div className="relative h-[160px] w-full border-l border-b border-[#e1e4e8] ml-6 pr-2">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <path d={generatePath(plannedData, 600, 160)} fill="none" stroke="#D0D7DE" strokeWidth="2" strokeDasharray="5,5" />
                      <path d={generatePath(actualData, 600, 160)} fill="none" stroke="#3A4EA2" strokeWidth="3" strokeLinecap="round" />
                      <circle
                        cx={(actualData.length - 1) / (plannedData.length - 1) * 600}
                        cy={160 - (actualData[actualData.length - 1] / 100) * 160}
                        r="5" fill="#3A4EA2" />
                    </svg>
                    <div className="absolute -left-8 top-0 text-[10px] text-[#8C959F]">100%</div>
                    <div className="absolute -left-6 bottom-0 text-[10px] text-[#8C959F]">0%</div>
                  </div>
                  <div className="flex gap-4 mt-4 justify-center">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-[#57606a]"><span className="w-3 h-0.5 bg-[#D0D7DE] border-t border-dashed" /> Planned Baseline</div>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-[#57606a]"><span className="w-3 h-0.5 bg-[#3A4EA2]" /> Actual Progress</div>
                  </div>
                </Card>
              )}

              {sections.material_usage && (
                <Card className="bg-white shadow-sm border-[#D0D7DE]">
                  <div className="text-[10px] text-[#57606a] font-bold mb-2 font-mono uppercase">Material Usage</div>
                  <div className="text-[12px] text-[#8C959F] italic">
                    Material data will be populated from contractor WhatsApp updates.
                  </div>
                </Card>
              )}

              {sections.issues && (
                <Card className="bg-[#ffebe9] border-[#ff8182] shadow-sm">
                  <div className="text-[10px] text-[#cf222e] font-bold mb-1.5 font-mono uppercase">Critical Issues & Requests</div>
                  <div className="text-[12px] text-[#cf222e] font-medium flex items-start gap-2">
                    <span>⚠️</span>
                    <div>Issues are pulled from the project&apos;s open issue log.</div>
                  </div>
                </Card>
              )}

              {sections.site_photos && (
                <Card className="bg-white shadow-sm border-[#D0D7DE]">
                  <div className="text-[10px] text-[#57606a] font-bold mb-3 font-mono uppercase">Site Photos</div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    <div className="w-32 h-24 bg-[#f6f8fa] rounded flex items-center justify-center text-[10px] text-[#8C959F] border border-[#e1e4e8] shrink-0">Photos from WhatsApp</div>
                  </div>
                </Card>
              )}

              {Object.values(sections).every(v => !v) && (
                <div className="text-center py-16 text-[#8C959F] text-sm border-2 border-dashed border-[#e1e4e8] rounded-md bg-white">
                  No sections selected. Use the toggles on the left to build your report.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── HISTORY VIEW ────────────────────────────────────── */}
      {viewState === "history" && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-2.5 py-1 text-[12px] bg-white outline-none focus:ring-1 focus:ring-[#3A4EA2] text-[#57606a] shadow-sm">
              <option value="all">Filter by: All Members</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {filteredHistory.length > 0 ? filteredHistory.map(entry => (
              <Card key={entry.id} onClick={() => setViewState(entry.id.toString())}
                className="cursor-pointer hover:shadow-sm transition-shadow bg-white border-[#D0D7DE]">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#f6f8fa] flex items-center justify-center text-sm flex-shrink-0 border border-[#e1e4e8]">📄</div>
                    <div>
                      <div className="text-[13px] font-bold text-[#24292f]">Report — {entry.date}</div>
                      <div className="text-xs text-[#57606a]">Submitted by {entry.submittedBy}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${entry.status === "reviewed" ? "bg-[#dafbe1] text-[#1A7F37]" : "bg-[#ddf4ff] text-[#3A4EA2]"}`}>
                      {entry.status}
                    </span>
                    <div className="text-[11px] text-[#8C959F] mt-1 font-mono">{entry.overallProgress}% Complete</div>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 text-[11px] text-[#57606a]">
                  <span>👷 {entry.workersOnSite} Workers</span>
                  {entry.issuesCount > 0 && <span className="text-[#cf222e] font-semibold">⚠️ {entry.issuesCount} Issues</span>}
                </div>
              </Card>
            )) : (
              <div className="text-center py-10 text-[13px] text-[#57606a]">No history found for {selectedProject?.name}.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
