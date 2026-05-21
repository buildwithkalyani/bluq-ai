"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { Users, AlertTriangle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type DPREntry,
} from "@/lib/mock-data-extended";
import {
  fetchDPRHistory,
  generateReport,
  pollReportStatus,
} from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";
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

function DPRPageContent() {
  const searchParams = useSearchParams();
  const urlProjectIdParam = searchParams.get("projectId") ?? "0";
  const urlWorkspaceId    = searchParams.get("workspaceId");
  const { workspaceId: ctxWorkspaceId, isDesignMode, orgName } = useWorkspace();
  const workspaceId   = urlWorkspaceId ?? ctxWorkspaceId;
  // Detect real mode: projectId is a UUID (not numeric "0") and workspaceId available
  const isRealData = !isDesignMode && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(urlProjectIdParam) && !!workspaceId;
  const projectUuid = isRealData ? urlProjectIdParam : null;

  const [viewState, setViewState] = useState<string>("generate");
  const [history, setHistory] = useState<DPREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectName, setSelectedProjectName] = useState<string>("—");

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
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Load history + schedule data when project changes
  useEffect(() => {
    setLoading(true);

    if (isRealData) {
      // Real backend data
      fetchDPRHistory(projectUuid!, workspaceId!)
        .then((h) => {
          setHistory(h || []);
          if (h.length > 0) {
            const latest = h[0];
            setActualProgress(latest.overallProgress);
            setPlannedProgress(Math.min(100, latest.overallProgress + 5));
            setWorkersOnSite(latest.workersOnSite);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setActualProgress(0);
      setPlannedProgress(0);
      setWorkersOnSite(0);
      setHistory([]);
      setLoading(false);
    }
  }, [urlProjectIdParam, projectUuid, workspaceId]);

  // Fetch project name when projectId or workspaceId changes
  useEffect(() => {
    if (isRealData && workspaceId) {
      import("@/lib/api-client").then(({ fetchProjects }) => {
        fetchProjects(workspaceId).then(rows => {
          const p = rows.find(r => r.id === urlProjectIdParam);
          if (p) setSelectedProjectName(p.projectName);
        }).catch(() => {});
      });
    }
  }, [urlProjectIdParam, workspaceId, isRealData]);

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

  const handleGenerate = async () => {
    if (!isRealData) {
      setGenerateError("Select a project first to generate a report.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    try {
      const enabledSections = Object.entries(sections)
        .filter(([, on]) => on)
        .map(([id]) => id);

      const sectionMap: Record<string, string> = {
        executive_summary: "ai_summary", s_curve: "s_curve",
        site_progress: "site_progress", site_attendance: "site_attendance",
        material_usage: "material_usage", issues: "critical_issues", site_photos: "site_photos",
      };
      const mappedSections = enabledSections.map(s => sectionMap[s]).filter(Boolean).join(",");

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
      const { authClient } = await import("@/lib/auth-client");
      const sessionData = await authClient.getSession();
      const token = sessionData?.data?.session?.token ?? "";

      const params = new URLSearchParams({
        projectId: projectUuid!,
        workspaceId: workspaceId!,
        reportDate,
        sections: mappedSections,
      });

      const res = await fetch(`${BACKEND_URL}/reports/download?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DPR-${reportDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGenerateError(err.message ?? "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-[#F1F5F9] rounded" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[#F1F5F9] rounded-lg" />)}
        </div>
      </div>
    );
  }

  // ─── REPORT DETAIL VIEW ─────────────────────────────────
  if (viewState !== "feed" && viewState !== "generate" && viewState !== "history") {
    const report = history.find(h => h.id.toString() === viewState);
    return (
      <div className="p-5 overflow-y-auto h-full flex justify-center bg-[#F8FAFC]">
        <div className="w-full max-w-2xl">
          <div className="mb-3">
            <div onClick={() => setViewState("history")}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[13px] text-[#2563EB] font-semibold hover:underline">
              ← Back to History
            </div>
          </div>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-base border border-[#E2E8F0] shadow-sm">📄</div>
            <div>
              <div className="text-[15px] font-bold">DPR — {report?.date || reportDate}</div>
              <div className="text-xs text-[#475569]">
                Project: {selectedProjectName} • Submitted by {report?.submittedBy || "AI Agent"}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Card className="bg-white border-[#E2E8F0] shadow-sm">
              <div className="text-[10px] text-[#2563EB] font-bold mb-2 font-mono uppercase">AI Executive Summary</div>
              <div className="text-[13px] text-[#0F172A] leading-relaxed">
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
    <div className="p-5 overflow-y-auto h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <SectionTitle>Daily Progress Report</SectionTitle>
        </div>
        <div className="inline-flex rounded-md overflow-hidden border border-[#E2E8F0] shadow-sm">
          {(["generate", "history"] as const).map(v => (
            <button key={v} onClick={() => setViewState(v)}
              className={`px-4 py-1.5 text-xs font-semibold capitalize transition-all ${viewState === v ? "bg-[#2563EB] text-white" : "bg-white text-[#475569] hover:bg-[#F8FAFC]"}`}>
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
            <Card className="space-y-6 shadow-sm border-[#E2E8F0] bg-white">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Report Date</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#2563EB] outline-none" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0F172A] mb-3">Include Sections:</h3>
                <div className="space-y-2">
                  {REPORT_SECTIONS.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" className="rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                        checked={sections[s.id]} onChange={() => toggleSection(s.id)} />
                      <span className="text-[13px] text-[#475569] select-none group-hover:text-[#0F172A] transition-colors">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-[#E2E8F0]">
                <button onClick={handleGenerate} disabled={generating}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-70">
                  {generating ? "Generating PDF..." : "Generate & Download"}
                </button>
                {generateError && (
                  <div className="mt-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">{generateError}</div>
                )}
              </div>
            </Card>
          </div>

          {/* Live Preview */}
          <div className="flex-1 max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[#475569] text-xs font-semibold uppercase tracking-wider">
              <span>👁️ Live Preview</span>
            </div>
            <div id="dpr-report-preview" className="space-y-4">
              {/* Header */}
              <Card className="bg-white border-[#E2E8F0] shadow-sm pb-4 border-b-4 border-b-[#2563EB]">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Daily Progress Report</h1>
                    <div className="text-sm text-[#475569] mt-1 font-medium">{selectedProjectName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#0F172A]">{reportDate}</div>
                    <div className="text-[10px] font-bold text-[#2563EB] tracking-[1px] uppercase mt-1">{orgName ?? "Bluq Engineering"}</div>
                  </div>
                </div>
              </Card>

              {sections.executive_summary && (
                <Card className="bg-[#F8FAFC] border-[#E2E8F0] shadow-sm">
                  <div className="text-[10px] text-[#2563EB] font-bold mb-2 font-mono uppercase">AI Executive Summary</div>
                  <div className="text-[13px] text-[#0F172A] leading-relaxed">
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
                  <Card className="bg-white shadow-sm border-[#E2E8F0]">
                    <div className="text-[10px] text-[#475569] font-bold mb-2 font-mono uppercase">Site Progress</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[11px] text-[#475569]">Actual</div>
                        <div className="text-xl font-black text-[#059669]">{actualProgress}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#475569]">Planned</div>
                        <div className="text-sm font-bold text-[#0F172A]">{plannedProgress}%</div>
                      </div>
                    </div>
                  </Card>
                )}
                {sections.site_attendance && (
                  <Card className="bg-white shadow-sm border-[#E2E8F0]">
                    <div className="text-[10px] text-[#475569] font-bold mb-2 font-mono uppercase">Site Attendance</div>
                    <div className="text-xl font-black text-[#0F172A]">{workersOnSite} <span className="text-xs font-normal text-[#475569]">Workers</span></div>
                    <div className="text-[11px] text-[#475569] mt-1">On site today</div>
                  </Card>
                )}
              </div>

              {sections.s_curve && (
                <Card className="bg-white shadow-sm border-[#E2E8F0]">
                  <div className="text-[10px] text-[#475569] font-bold mb-3 font-mono uppercase">Progress S-Curve</div>
                  <div className="relative h-[160px] w-full border-l border-b border-[#E2E8F0] ml-6 pr-2">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <path d={generatePath(plannedData, 600, 160)} fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="5,5" />
                      <path d={generatePath(actualData, 600, 160)} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
                      <circle
                        cx={(actualData.length - 1) / (plannedData.length - 1) * 600}
                        cy={160 - (actualData[actualData.length - 1] / 100) * 160}
                        r="5" fill="#2563EB" />
                    </svg>
                    <div className="absolute -left-8 top-0 text-[10px] text-[#94A3B8]">100%</div>
                    <div className="absolute -left-6 bottom-0 text-[10px] text-[#94A3B8]">0%</div>
                  </div>
                  <div className="flex gap-4 mt-4 justify-center">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-[#475569]"><span className="w-3 h-0.5 bg-[#E2E8F0] border-t border-dashed" /> Planned Baseline</div>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-[#475569]"><span className="w-3 h-0.5 bg-[#2563EB]" /> Actual Progress</div>
                  </div>
                </Card>
              )}

              {sections.material_usage && (
                <Card className="bg-white shadow-sm border-[#E2E8F0]">
                  <div className="text-[10px] text-[#475569] font-bold mb-2 font-mono uppercase">Material Usage</div>
                  <div className="text-[12px] text-[#94A3B8]">No material data recorded yet. Data is captured via contractor WhatsApp updates.</div>
                </Card>
              )}

              {sections.issues && (
                <Card className="bg-white shadow-sm border-[#E2E8F0]">
                  <div className="text-[10px] text-[#475569] font-bold mb-1.5 font-mono uppercase">Critical Issues & Requests</div>
                  <div className="text-[12px] text-[#94A3B8]">No open issues recorded for this project.</div>
                </Card>
              )}

              {sections.site_photos && (
                <Card className="bg-white shadow-sm border-[#E2E8F0]">
                  <div className="text-[10px] text-[#475569] font-bold mb-3 font-mono uppercase">Site Photos</div>
                  <div className="text-[12px] text-[#94A3B8]">No site photos uploaded yet. Photos are captured via contractor WhatsApp updates.</div>
                </Card>
              )}

              {Object.values(sections).every(v => !v) && (
                <div className="text-center py-16 text-[#94A3B8] text-sm border-2 border-dashed border-[#E2E8F0] rounded-md bg-white">
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
              className="border border-[#E2E8F0] rounded-md px-2.5 py-1 text-[12px] bg-white outline-none focus:ring-1 focus:ring-[#2563EB] text-[#475569] shadow-sm">
              <option value="all">Filter by: All Members</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {filteredHistory.length > 0 ? filteredHistory.map(entry => (
              <Card key={entry.id} onClick={() => setViewState(entry.id.toString())}
                className="cursor-pointer hover:shadow-sm transition-shadow bg-white border-[#E2E8F0]">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#F8FAFC] flex items-center justify-center text-sm flex-shrink-0 border border-[#E2E8F0]">📄</div>
                    <div>
                      <div className="text-[13px] font-bold text-[#0F172A]">Report — {entry.date}</div>
                      <div className="text-xs text-[#475569]">Submitted by {entry.submittedBy}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${entry.status === "reviewed" ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#EFF6FF] text-[#2563EB]"}`}>
                      {entry.status}
                    </span>
                    <div className="text-[11px] text-[#94A3B8] mt-1 font-mono">{entry.overallProgress}% Complete</div>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 text-[11px] text-[#475569]">
                  <span className="inline-flex items-center gap-1"><Users size={11} /> {entry.workersOnSite} Workers</span>
                  {entry.issuesCount > 0 && <span className="inline-flex items-center gap-1 text-[#DC2626] font-semibold"><AlertTriangle size={11} /> {entry.issuesCount} Issues</span>}
                </div>
              </Card>
            )) : (
              <div className="text-center py-10 text-[13px] text-[#475569]">
                {isRealData ? "No DPR history found for this project." : "Select a project to view report history."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DPRPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#94A3B8]">Loading...</div>}>
      <DPRPageContent />
    </Suspense>
  );
}
