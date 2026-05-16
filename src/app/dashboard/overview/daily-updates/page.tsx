"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download, CheckCircle2, AlertTriangle,
  Building2, Zap,
} from "lucide-react";
import {
  getDoneYesterday,
  getTodoToday,
  getMilestones,
  getAIBriefing,
  type DailyTask,
  type DailyTodo,
  type Milestone,
  type AIBriefing,
  STATUS_CONFIG,
} from "@/lib/mock-data";
import {
  fetchProjects,
  fetchDoneYesterday,
  fetchTodoToday,
  fetchMilestones,
  fetchAIBriefing,
  isRealProject,
  type BackendProject,
} from "@/lib/api-client";
import { useWorkspace } from "@/context/workspace";

// ─── Status badge ─────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!s) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
};

// ─── Priority config ──────────────────────────────────────────
const PRIORITY: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  high:   { color: "#DC2626", bg: "#FEF2F2", label: "High",   dot: "#DC2626" },
  medium: { color: "#D97706", bg: "#FFFBEB", label: "Medium", dot: "#D97706" },
  low:    { color: "#94A3B8", bg: "#F1F5F9", label: "Low",    dot: "#CBD5E1" },
};

// ─── Main ─────────────────────────────────────────────────────
function DailyUpdatesInner() {
  const searchParams       = useSearchParams();
  const { workspaceId, loading: wsLoading, isDesignMode } = useWorkspace();

  const urlProjectId   = searchParams.get("projectId") ?? searchParams.get("projectUuid");
  const urlWorkspaceId = searchParams.get("workspaceId");
  const activeWorkspaceId = urlWorkspaceId ?? workspaceId;
  const selectedProjectId = urlProjectId ?? null;

  const [milestoneRange, setMilestoneRange] = useState(1);
  const ranges = [7, 15, 30];

  const [projects, setProjects]           = useState<BackendProject[]>([]);
  const [doneYesterday, setDoneYesterday] = useState<DailyTask[]>([]);
  const [todoToday, setTodoToday]         = useState<DailyTodo[]>([]);
  const [milestones, setMilestones]       = useState<Milestone[]>([]);
  const [briefing, setBriefing]           = useState<AIBriefing | null>(null);
  const [briefingFetchedAt, setBriefingFetchedAt] = useState<Date | null>(null);

  // Load projects list
  useEffect(() => {
    if (wsLoading || isDesignMode) return;
    if (activeWorkspaceId) fetchProjects(activeWorkspaceId).then(setProjects).catch(console.error);
  }, [activeWorkspaceId, wsLoading, isDesignMode]);

  // Reload tasks/milestones whenever project, range, or workspace changes
  useEffect(() => {
    if (wsLoading) return;
    const days = ranges[milestoneRange];

    if (isDesignMode) {
      getDoneYesterday(undefined).then(setDoneYesterday);
      getTodoToday(undefined).then(setTodoToday);
      getMilestones(undefined).then(setMilestones);
      getAIBriefing(null).then(b => { setBriefing(b); setBriefingFetchedAt(new Date()); });
    } else if (activeWorkspaceId && selectedProjectId && isRealProject(selectedProjectId)) {
      fetchDoneYesterday(selectedProjectId, activeWorkspaceId).then(setDoneYesterday).catch(console.error);
      fetchTodoToday(selectedProjectId, activeWorkspaceId).then(setTodoToday).catch(console.error);
      fetchMilestones(selectedProjectId, activeWorkspaceId, days).then(setMilestones).catch(console.error);
    } else if (activeWorkspaceId && projects.length > 0) {
      Promise.all(projects.map(p => fetchDoneYesterday(p.id, activeWorkspaceId).catch(() => [] as DailyTask[])))
        .then(r => setDoneYesterday(r.flat()));
      Promise.all(projects.map(p => fetchTodoToday(p.id, activeWorkspaceId).catch(() => [] as DailyTodo[])))
        .then(r => setTodoToday(r.flat()));
      Promise.all(projects.map(p => fetchMilestones(p.id, activeWorkspaceId, days).catch(() => [] as Milestone[])))
        .then(results => setMilestones(results.flat()));
    }
  }, [selectedProjectId, milestoneRange, activeWorkspaceId, wsLoading, projects.length, isDesignMode]);

  // Briefing has its own effect — isolated from projects.length to prevent stale races
  useEffect(() => {
    if (wsLoading || isDesignMode) return;
    if (!activeWorkspaceId || !selectedProjectId || !isRealProject(selectedProjectId)) {
      setBriefing(null);
      return;
    }
    let cancelled = false;
    fetchAIBriefing(selectedProjectId, activeWorkspaceId)
      .then(b => { if (!cancelled) setBriefing(b); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [selectedProjectId, activeWorkspaceId, wsLoading, isDesignMode]);

  const filteredMilestones = activeWorkspaceId
    ? milestones
    : milestones.filter(m => m.daysLeft <= ranges[milestoneRange]);

  const selectedProject   = projects.find(p => p.id === selectedProjectId);
  const highPriorityCount = todoToday.filter(t => t.priority === "high").length;

  const briefingAge = briefingFetchedAt
    ? (() => {
        const mins = Math.floor((Date.now() - briefingFetchedAt.getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins === 1) return "1 min ago";
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
      })()
    : null;

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadDPR = async () => {
    if (!activeWorkspaceId || !selectedProjectId || !isRealProject(selectedProjectId)) {
      setDownloadError("Select a project first to export a PDF.");
      return;
    }
    setDownloadError(null);
    setDownloading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
      const { authClient } = await import("@/lib/auth-client");
      const sessionData = await authClient.getSession();
      const token = (sessionData as any)?.data?.session?.token ?? "";
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        workspaceId: activeWorkspaceId,
        reportDate: today,
        sections: "ai_summary,s_curve,site_progress,site_attendance,material_usage,critical_issues,site_photos",
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
      a.download = `DPR-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err.message ?? "Failed to download report.");
    } finally {
      setDownloading(false);
    }
  };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFmt = yesterday.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });

  const sortedTodo = [...todoToday].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return (rank[a.priority as keyof typeof rank] ?? 2) - (rank[b.priority as keyof typeof rank] ?? 2);
  });

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div>

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight tracking-tight">
              Daily Updates
            </h1>
            {selectedProject && (
              <div className="flex items-center gap-2 mt-1 text-[13px] text-[#64748B]">
                <Building2 size={12} className="text-[#94A3B8]" />
                <span className="font-medium text-[#334155]">{selectedProject.projectName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleDownloadDPR}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-[#2563EB] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              <Download size={13} strokeWidth={1.6} />
              {downloading ? "Exporting..." : "Export PDF"}
            </button>
            {downloadError && (
              <span className="text-[11px] text-red-500">{downloadError}</span>
            )}
          </div>
        </div>

        {/* ── Site Intelligence (AI Briefing) ── */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl mb-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#2563EB] flex items-center justify-center shrink-0">
                <Zap size={12} className="text-white" />
              </div>
              <span className="text-[13px] font-bold text-[#0F172A]">Site Intelligence</span>
            </div>
            <span className="text-[11px] text-[#94A3B8]">AI-generated{briefingAge ? ` · Updated ${briefingAge}` : ""}</span>
          </div>
          <div className="px-5 py-4">
            {briefing ? (
              <p className="text-[14px] text-[#334155] leading-relaxed">
                {selectedProject && (
                  <span className="font-semibold text-[#0F172A]">{selectedProject.projectName} — </span>
                )}
                {briefing.text}{" "}
                {briefing.highlight && (
                  <span className="font-semibold text-[#2563EB]">{briefing.highlight}</span>
                )}
              </p>
            ) : (
              <p className="text-[13px] text-[#94A3B8]">
                {activeWorkspaceId && !selectedProjectId
                  ? "Select a project using the top navigation to see the AI site briefing."
                  : activeWorkspaceId
                  ? "Loading briefing..."
                  : "No briefing available."}
              </p>
            )}
          </div>
        </div>

        {/* ── Summary metrics ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-3">
              Completed Yesterday
            </div>
            <div className="text-[28px] font-bold text-[#059669] leading-none">{doneYesterday.length}</div>
            <div className="text-[12px] text-[#94A3B8] mt-1">tasks wrapped up</div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-3">
              Scheduled Today
            </div>
            <div className="text-[28px] font-bold text-[#2563EB] leading-none">{todoToday.length}</div>
            <div className="text-[12px] mt-1">
              {highPriorityCount > 0
                ? <span className="text-[#DC2626] font-semibold">{highPriorityCount} high priority</span>
                : <span className="text-[#94A3B8]">tasks lined up</span>}
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-3">
              Upcoming Milestones
            </div>
            <div className="text-[28px] font-bold text-[#F59E0B] leading-none">{filteredMilestones.length}</div>
            <div className="text-[12px] text-[#94A3B8] mt-1">in next {ranges[milestoneRange]} days</div>
          </div>
        </div>

        {/* ── Done Yesterday + To Do Today ── */}
        <div className="grid grid-cols-2 gap-4 mb-5">

          {/* Done Yesterday */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
              <span className="text-[14px] font-bold text-[#0F172A]">Done Yesterday</span>
              <span className="text-[11px] text-[#94A3B8]">{yesterdayFmt}</span>
            </div>

            {doneYesterday.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-[#94A3B8]">
                No tasks logged for yesterday
              </div>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {doneYesterday.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <CheckCircle2 size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#0F172A] leading-snug">{t.task}</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        {!selectedProjectId && t.project ? `${t.project} · ` : ""}{t.contractor}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* To Do Today */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
              <span className="text-[14px] font-bold text-[#0F172A]">To Do Today</span>
              {highPriorityCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]">
                  <AlertTriangle size={11} strokeWidth={2} />
                  {highPriorityCount} urgent
                </span>
              )}
            </div>

            {sortedTodo.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-[#94A3B8]">
                No tasks scheduled for today
              </div>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {sortedTodo.map((t, i) => {
                  const pc = PRIORITY[t.priority] ?? PRIORITY.low;
                  return (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full" style={{ background: pc.dot }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-semibold text-[#0F172A] leading-snug">{t.task}</div>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                            style={{ background: pc.bg, color: pc.color }}
                          >
                            {pc.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5">
                          {!selectedProjectId && t.project ? `${t.project} · ` : ""}{t.contractor}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Upcoming Milestones ── */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
            <span className="text-[14px] font-bold text-[#0F172A]">Upcoming Milestones</span>
            <div className="flex items-center gap-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-0.5">
              {ranges.map((r, i) => (
                <button
                  key={r}
                  onClick={() => setMilestoneRange(i)}
                  className="px-3 py-1 text-[12px] font-semibold rounded-md transition-all cursor-pointer"
                  style={{
                    background: i === milestoneRange ? "white" : "transparent",
                    color:      i === milestoneRange ? "#0F172A" : "#94A3B8",
                    boxShadow:  i === milestoneRange ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {filteredMilestones.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#94A3B8]">
              No milestones due in the next {ranges[milestoneRange]} days
            </div>
          ) : (
            <div className="divide-y divide-[#F8FAFC]">
              {filteredMilestones.map((m, i) => {
                const urgentColor = m.daysLeft <= 7 ? "#EF4444" : m.daysLeft <= 14 ? "#F59E0B" : "#22C55E";
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    {/* Urgency indicator bar */}
                    <div
                      className="w-0.5 self-stretch rounded-full shrink-0"
                      style={{ background: urgentColor, minHeight: "32px" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#0F172A]">{m.name}</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">{m.project}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-mono text-[#475569] tabular-nums">{m.date}</div>
                      <div
                        className="text-[11px] font-bold mt-0.5 tabular-nums"
                        style={{ color: urgentColor }}
                      >
                        {m.daysLeft}d remaining
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function DailyUpdates() {
  return (
    <Suspense
      fallback={
        <div className="p-6 overflow-y-auto h-full">
          <div className="animate-pulse space-y-4">
            <div className="h-7 w-48 bg-[#E2E8F0] rounded" />
            <div className="h-20 bg-[#E2E8F0] rounded-xl" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#E2E8F0] rounded-xl" />)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map(i => <div key={i} className="h-48 bg-[#E2E8F0] rounded-xl" />)}
            </div>
            <div className="h-40 bg-[#E2E8F0] rounded-xl" />
          </div>
        </div>
      }
    >
      <DailyUpdatesInner />
    </Suspense>
  );
}
