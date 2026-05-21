"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  FileText, Settings, CalendarDays, Tag, MapPin,
  CheckCircle2, Circle, Clock, AlertCircle,
  TrendingUp, AlertTriangle, Target, Activity,
  Users, Package, Clipboard, BarChart2, RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  STATUS_CONFIG,
  getScheduleTasks,
  getProjectIssues,
  type Project,
  type ScheduleTask,
  type ProjectIssue,
} from "@/lib/mock-data";
import { StatusBadge, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { useWorkspace } from "@/context/workspace";
import { fetchTasks, isRealProject, generateSchedule, pollScheduleStatus } from "@/lib/api-client";
import { useTaskSocket } from "@/hooks/useTaskSocket";

// ── Date helpers ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso || iso === "TBD") return iso;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── S-Curve helpers ──────────────────────────────────────────────
function buildSCurve(
  startDate: string,
  endDate: string,
  tasks: ScheduleTask[],
  n = 7,
): { labels: string[]; planned: number[]; actual: (number | null)[] } {
  const start = new Date(startDate + "T00:00:00").getTime();
  const end   = new Date(endDate   + "T00:00:00").getTime();
  const today = Date.now();
  if (isNaN(start) || isNaN(end) || end <= start) return { labels: [], planned: [], actual: [] };

  const sig = (t: number) => {
    const k = 7, s = (x: number) => 1 / (1 + Math.exp(-k * (x - 0.5)));
    return Math.round(((s(t) - s(0)) / (s(1) - s(0))) * 100);
  };

  return Array.from({ length: n }, (_, i) => {
    const t  = i / (n - 1);
    const ts = start + t * (end - start);
    return {
      label:   new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      planned: sig(t),
      actual:  ts > today
        ? null
        : tasks.length === 0
          ? 0
          : Math.round(
              tasks.reduce((sum, task) => {
                const tS = task.startDate ? new Date(task.startDate + "T00:00:00").getTime() : start;
                const tE = task.endDate   ? new Date(task.endDate   + "T00:00:00").getTime() : end;
                if (task.status === "completed") {
                  const fin = task.endDate ? tE : today;
                  return sum + (ts >= fin ? 100 : Math.max(0, Math.min(99, ((ts - tS) / Math.max(1, fin - tS)) * 100)));
                }
                if (task.status === "inProgress" || task.status === "runningLate") {
                  return sum + Math.max(0, Math.min(1, (ts - tS) / Math.max(1, today - tS))) * task.pct;
                }
                return sum;
              }, 0) / tasks.length,
            ),
    };
  }).reduce<{ labels: string[]; planned: number[]; actual: (number | null)[] }>(
    (acc, row) => { acc.labels.push(row.label); acc.planned.push(row.planned); acc.actual.push(row.actual); return acc; },
    { labels: [], planned: [], actual: [] },
  );
}

function svgPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1][0] + pts[i][0]) / 2).toFixed(1);
    d += ` C ${cpx} ${pts[i - 1][1].toFixed(1)}, ${cpx} ${pts[i][1].toFixed(1)}, ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  return d;
}

// ── Weather helpers ───────────────────────────────────────────
interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    uv_index: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

function wxInfo(code: number): { emoji: string; label: string } {
  if (code === 0)  return { emoji: "☀️", label: "Clear" };
  if (code <= 3)   return { emoji: "⛅", label: "Partly Cloudy" };
  if (code <= 48)  return { emoji: "🌫️", label: "Foggy" };
  if (code <= 67)  return { emoji: "🌧️", label: "Rain" };
  if (code <= 77)  return { emoji: "❄️", label: "Snow" };
  if (code <= 82)  return { emoji: "🌦️", label: "Showers" };
  if (code <= 99)  return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "🌡️", label: "—" };
}

function uvLabel(uv: number): { label: string; color: string } {
  if (uv <= 2)  return { label: "Low",     color: "#22C55E" };
  if (uv <= 5)  return { label: "Moderate",color: "#F59E0B" };
  if (uv <= 7)  return { label: "High",    color: "#F97316" };
  if (uv <= 10) return { label: "V. High", color: "#EF4444" };
  return        { label: "Extreme",        color: "#7C3AED" };
}

function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Weather Widget ────────────────────────────────────────────
function WeatherWidget({ address, lat, lng }: { address: string; lat?: number | null; lng?: number | null }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const city = extractCity(address);

  useEffect(() => {
    (async () => {
      try {
        let latitude = 0, longitude = 0;
        if (lat != null && lng != null) {
          latitude = lat;
          longitude = lng;
        } else {
          // Try full address then each comma-part right-to-left via Nominatim
          const parts = address
            ? address.split(",").map(s => s.trim()).filter(Boolean)
            : [];
          const queries = address ? [address, ...parts.slice().reverse()] : parts.slice().reverse();
          let resolved = false;
          for (const q of queries) {
            if (!q || q.length < 3) continue;
            try {
              const nm = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
                { headers: { "Accept-Language": "en", "User-Agent": "BLUQ-ConstructionPM/1.0" } }
              );
              const nmData = await nm.json();
              if (nmData[0]) {
                latitude = parseFloat(nmData[0].lat);
                longitude = parseFloat(nmData[0].lon);
                resolved = true;
                break;
              }
            } catch { /* try next */ }
          }
          if (!resolved) { setLoading(false); return; }
        }
        const wx = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,uv_index` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4`
        );
        setWeather(await wx.json());
      } catch {
        // silent — widget simply won't render
      } finally {
        setLoading(false);
      }
    })();
  }, [lat, lng, city]);

  if (!lat && !lng && !city) return null;

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-3 w-20 bg-[#E2E8F0] rounded mb-3" />
        <div className="h-10 w-28 bg-[#E2E8F0] rounded mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className="flex-1 h-14 bg-[#E2E8F0] rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const cur = weather.current;
  const wx  = wxInfo(cur.weather_code);
  const uv  = uvLabel(cur.uv_index);

  const heatAlert =
    cur.temperature_2m >= 38 && cur.relative_humidity_2m >= 60 ? "Extreme Heat — enforce breaks"
    : cur.temperature_2m >= 35 ? "Heat Caution — hydration required"
    : null;

  return (
    <div className="bg-gradient-to-br from-[#0EA5E9]/8 to-[#2563EB]/5 border border-[#BAE6FD] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#0EA5E9] uppercase tracking-[0.1em]">Site Weather</span>
        <span className="text-[10px] text-[#64748B]">{city}</span>
      </div>

      {/* Current conditions */}
      <div className="flex items-end gap-3 mb-3">
        <div className="text-[38px] leading-none">{wx.emoji}</div>
        <div>
          <div className="text-[30px] font-bold text-[#0F172A] leading-none">{Math.round(cur.temperature_2m)}°C</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">{wx.label}</div>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-3 gap-0 mb-3 bg-white/60 rounded-lg overflow-hidden border border-white/80">
        <div className="text-center py-2">
          <div className="text-[9px] text-[#94A3B8] font-semibold uppercase mb-0.5">Humidity</div>
          <div className="text-[13px] font-bold text-[#0F172A]">{cur.relative_humidity_2m}%</div>
        </div>
        <div className="text-center py-2 border-x border-[#E2E8F0]/60">
          <div className="text-[9px] text-[#94A3B8] font-semibold uppercase mb-0.5">Wind</div>
          <div className="text-[13px] font-bold text-[#0F172A]">{Math.round(cur.wind_speed_10m)}<span className="text-[9px] font-normal"> km/h</span></div>
        </div>
        <div className="text-center py-2">
          <div className="text-[9px] text-[#94A3B8] font-semibold uppercase mb-0.5">UV Index</div>
          <div className="text-[13px] font-bold" style={{ color: uv.color }}>{Math.round(cur.uv_index)}<span className="text-[9px] font-normal"> {uv.label}</span></div>
        </div>
      </div>

      {/* Heat alert */}
      {heatAlert && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200">
          <AlertTriangle size={11} className="text-orange-500 shrink-0" />
          <span className="text-[10px] font-semibold text-orange-700 leading-tight">{heatAlert}</span>
        </div>
      )}

      {/* 3-day forecast */}
      {weather.daily.time.length >= 4 && (
        <div className="flex gap-1.5">
          {weather.daily.time.slice(1, 4).map((d, i) => {
            const fw = wxInfo(weather.daily.weather_code[i + 1]);
            return (
              <div key={d} className="flex-1 text-center bg-white/60 rounded-lg py-2 border border-white/80">
                <div className="text-[9px] text-[#94A3B8] font-semibold">{DAY_NAMES[new Date(d).getDay()]}</div>
                <div className="text-[15px] my-0.5">{fw.emoji}</div>
                <div className="text-[10px] font-bold text-[#0F172A]">{Math.round(weather.daily.temperature_2m_max[i + 1])}°</div>
                <div className="text-[9px] text-[#94A3B8]">{Math.round(weather.daily.temperature_2m_min[i + 1])}°</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  sub,
  iconBg = "#EFF6FF",
  valueColor = "#0F172A",
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  iconBg?: string;
  valueColor?: string;
  accent?: { label: string; color: string };
}) {
  const fontSize =
    value === "—" || value.length <= 5 ? "text-[26px]"
    : value.length <= 9 ? "text-[19px]"
    : "text-[14px]";

  return (
    <div className="flex-1 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] leading-tight">{label}</span>
      </div>
      <div className={`${fontSize} font-bold leading-none mb-1`} style={{ color: valueColor }}>{value}</div>
      {sub && <div className="text-[11px] text-[#94A3B8] mt-1 leading-tight">{sub}</div>}
      {accent && (
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: accent.color + "18", color: accent.color }}>
          {accent.label}
        </div>
      )}
    </div>
  );
}

// ── Milestone status icon ─────────────────────────────────────
function MilestoneIcon({ status }: { status: ScheduleTask["status"] }) {
  const props = { size: 18, strokeWidth: 2 };
  if (status === "completed")                             return <CheckCircle2 {...props} className="text-[#22C55E] shrink-0" />;
  if (status === "inProgress")                            return <Clock       {...props} className="text-[#F59E0B] shrink-0" />;
  if (status === "delayed" || status === "runningLate")   return <AlertCircle {...props} className="text-[#EF4444] shrink-0" />;
  return <Circle {...props} className="text-[#CBD5E1] shrink-0" />;
}

// ── Milestone Tracker ─────────────────────────────────────────
function MilestoneTracker({ tasks }: { tasks: ScheduleTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="py-10 text-center">
        <Clipboard size={28} className="mx-auto mb-2 text-[#CBD5E1]" />
        <div className="text-[13px] font-semibold text-[#475569] mb-1">No milestones yet</div>
        <div className="text-[12px] text-[#94A3B8]">Import a schedule to start tracking</div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {tasks.map((t, i) => {
        const isLast = i === tasks.length - 1;
        const cfg = STATUS_CONFIG[t.status];
        return (
          <div key={t.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <MilestoneIcon status={t.status} />
              {!isLast && (
                <div
                  className="w-0.5 flex-1 mt-1"
                  style={{ background: t.status === "completed" ? "#22C55E" : "#E2E8F0", minHeight: "32px" }}
                />
              )}
            </div>
            <div className="flex-1 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-[#0F172A] truncate">{t.name}</span>
                    {t.delay && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 shrink-0">{t.delay}</span>
                    )}
                  </div>
                  {(t.startDate || t.endDate) && (
                    <div className="text-[11px] text-[#94A3B8] font-mono mb-2">
                      {fmtDate(t.startDate ?? "")}{t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}
                      {t.duration ? ` · ${t.duration}` : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[200px] h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: cfg.color }} />
                    </div>
                    <span className="text-[11px] font-bold font-mono" style={{ color: cfg.color }}>{t.pct}%</span>
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
interface ProjectDetailViewProps {
  project: Project & { clientName?: string };
  onBack: () => void;
  wrapperClassName?: string;
}

export default function ProjectDetailView({
  project: proj,
  onBack,
  wrapperClassName = "",
}: ProjectDetailViewProps) {
  const [tasks, setTasks]   = useState<ScheduleTask[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { workspaceId, isDesignMode } = useWorkspace();

  // ── Reoptimize flow ──────────────────────────────────────────
  type ReoptState = "idle" | "running" | "done" | "error";
  const [reoptState, setReoptState] = useState<ReoptState>("idle");
  const [reoptJobId, setReoptJobId] = useState<string | null>(null);
  const [reoptProgress, setReoptProgress] = useState<{ step: number; totalSteps: number; percentage: number; status: string } | null>(null);
  const [reoptError, setReoptError] = useState<string | null>(null);

  const projectIdStr = String(proj.id);
  const real = !isDesignMode && isRealProject(projectIdStr) && !!workspaceId;

  useEffect(() => {
    setLoading(true);
    if (real && workspaceId) {
      fetchTasks(projectIdStr, workspaceId)
        .then(t => { setTasks(t); setLoading(false); })
        .catch(() => setLoading(false));
      setIssues([]);
    } else {
      Promise.all([
        getScheduleTasks(Number(proj.id)),
        getProjectIssues(Number(proj.id)),
      ]).then(([t, i]) => { setTasks(t); setIssues(i); setLoading(false); });
    }
  }, [proj.id, workspaceId, real]);

  // Live task updates + schedule:generated events
  useTaskSocket({
    projectId: real ? projectIdStr : null,
    workspaceId: real ? workspaceId : null,
    setTasks,
    onScheduleGenerated: () => {
      if (real && workspaceId) {
        fetchTasks(projectIdStr, workspaceId).then(t => setTasks(t)).catch(() => {});
      }
    },
  });

  // Poll reoptimize job status
  useEffect(() => {
    if (reoptState !== "running" || !reoptJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await pollScheduleStatus(reoptJobId);
        if (cancelled) return;
        if (s.progress) setReoptProgress(s.progress);
        if (s.status === "completed") {
          setReoptState("done");
          // Refresh task list
          if (real && workspaceId) {
            fetchTasks(projectIdStr, workspaceId).then(t => setTasks(t)).catch(() => {});
          }
        } else if (s.status === "failed") {
          setReoptState("error");
          setReoptError(s.error ?? "Reoptimization failed");
        } else {
          setTimeout(poll, 2500);
        }
      } catch {
        if (!cancelled) {
          setReoptState("error");
          setReoptError("Lost connection to scheduler");
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [reoptState, reoptJobId]);

  async function handleReoptimize() {
    if (!workspaceId) return;
    setReoptState("running");
    setReoptProgress(null);
    setReoptError(null);
    try {
      const res = await generateSchedule({
        projectId: projectIdStr,
        workspaceId,
        startDate: proj.startDate || undefined,
        endDate: proj.endDate || undefined,
      });
      setReoptJobId(res.jobId);
    } catch (e: any) {
      setReoptState("error");
      setReoptError(e.message ?? "Failed to start reoptimization");
    }
  }

  // ── Derived stats ────────────────────────────────────────────
  const parentTasks    = tasks.filter(t => !t.parentTaskId);
  const hasTasks       = parentTasks.length > 0;
  const total          = parentTasks.length || 1;

  const completedCount  = parentTasks.filter(t => t.status === "completed").length;
  const inProgressCount = parentTasks.filter(t => t.status === "inProgress").length;
  const pendingCount    = parentTasks.filter(t => t.status === "notStarted").length;
  const delayedCount    = parentTasks.filter(t => t.status === "delayed" || t.status === "runningLate").length;

  const completedPct   = hasTasks ? Math.round((completedCount  / total) * 100) : null;
  const inProgressPct  = hasTasks ? Math.round((inProgressCount / total) * 100) : null;
  const pendingPct     = hasTasks ? Math.round((pendingCount    / total) * 100) : null;
  const averageProgress = hasTasks ? Math.round(parentTasks.reduce((a, t) => a + t.pct, 0) / total) : null;

  const totalDays    = proj.startDate && proj.endDate
    ? Math.round((new Date(proj.endDate + "T00:00:00").getTime() - new Date(proj.startDate + "T00:00:00").getTime()) / 86_400_000)
    : 0;
  const elapsedDays  = proj.startDate
    ? Math.max(0, Math.round((Date.now() - new Date(proj.startDate + "T00:00:00").getTime()) / 86_400_000))
    : 0;

  // Minimum timeline required by tasks
  const taskDatedStart = parentTasks.filter(t => t.startDate);
  const taskDatedEnd   = parentTasks.filter(t => t.endDate);
  const taskMinStartMs = taskDatedStart.length > 0
    ? Math.min(...taskDatedStart.map(t => new Date(t.startDate! + "T00:00:00").getTime()))
    : null;
  const taskMaxEndMs   = taskDatedEnd.length > 0
    ? Math.max(...taskDatedEnd.map(t => new Date(t.endDate! + "T00:00:00").getTime()))
    : null;
  const minTaskDays = taskMinStartMs && taskMaxEndMs
    ? Math.round((taskMaxEndMs - taskMinStartMs) / 86_400_000)
    : null;
  const timelineInsufficient = proj.startDate && proj.endDate && minTaskDays !== null && totalDays < minTaskDays;
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const timeUsedPct   = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;

  // Schedule performance index (progress vs time consumed)
  const scheduleVariance  = averageProgress !== null ? averageProgress - timeUsedPct : null;
  const scheduleHealth    = scheduleVariance === null    ? null
    : scheduleVariance >=  0 ? "On Track"
    : scheduleVariance >= -10 ? "Slight Delay"
    : "Behind Schedule";
  const scheduleColor = scheduleHealth === "On Track"      ? "#059669"
    : scheduleHealth === "Slight Delay"                    ? "#F59E0B"
    : scheduleHealth === "Behind Schedule"                 ? "#EF4444"
    : "#94A3B8";

  const deadlineColor = !totalDays ? "#94A3B8"
    : remainingDays > 30 ? "#059669"
    : remainingDays >  7 ? "#F59E0B"
    : "#EF4444";

  const laborUsed    = hasTasks ? parentTasks.length * 20 : null;
  const laborPlanned = hasTasks ? parentTasks.length * 40 : null;
  const laborVar     = laborUsed !== null && laborPlanned ? Math.round(((laborPlanned - laborUsed) / laborPlanned) * 100) : null;
  const matUsed      = hasTasks ? Math.min(100, Math.round(proj.pct * 0.8)) : null;
  const matReceived  = hasTasks ? Math.min(100, Math.round(proj.pct * 0.8 + 30)) : null;

  const fmt = (v: number | null, suffix = "%") => v === null ? "—" : `${v}${suffix}`;
  const scheduleParams = workspaceId
    ? `?projectId=${proj.id}&workspaceId=${workspaceId}${proj.endDate ? `&projectEndDate=${proj.endDate}` : ""}`
    : `?projectId=${proj.id}${proj.endDate ? `&projectEndDate=${proj.endDate}` : ""}`;

  // ── S-Curve chart data ──────────────────────────────────────
  const scData = proj.startDate && proj.endDate
    ? buildSCurve(proj.startDate, proj.endDate, parentTasks)
    : { labels: [] as string[], planned: [] as number[], actual: [] as (number | null)[] };

  const SC = { L: 50, R: 422, T: 16, B: 142 };
  const scN  = scData.labels.length;
  const scTX = (i: number) => SC.L + (scN > 1 ? i / (scN - 1) : 0) * (SC.R - SC.L);
  const scTY = (p: number) => SC.B - (p / 100) * (SC.B - SC.T);
  const scTodayX = SC.L + Math.min(1, Math.max(0, timeUsedPct / 100)) * (SC.R - SC.L);

  const scPlannedPts = scData.planned.map((p, i) => [scTX(i), scTY(p)] as [number, number]);
  const scActualPts  = scData.actual
    .map((p, i): [number, number] | null => p !== null ? [scTX(i), scTY(p)] : null)
    .filter((p): p is [number, number] => p !== null);
  const scPlannedPath = svgPath(scPlannedPts);
  const scActualPath  = svgPath(scActualPts);
  const scFillPath = scActualPts.length > 0
    ? `${scActualPath} L ${scActualPts[scActualPts.length - 1][0].toFixed(1)} ${SC.B} L ${SC.L} ${SC.B} Z`
    : "";

  // ── Delay analytics ────────────────────────────────────────
  const today = Date.now();
  const delayList = parentTasks
    .filter(t =>
      t.status === "delayed" ||
      t.status === "runningLate" ||
      (t.status !== "completed" && t.endDate && new Date(t.endDate + "T00:00:00").getTime() < today)
    )
    .map(t => {
      const endMs = t.endDate ? new Date(t.endDate + "T00:00:00").getTime() : 0;
      const overdueDays = endMs > 0 ? Math.max(0, Math.round((today - endMs) / 86_400_000)) : 0;
      return { ...t, overdueDays };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);
  const maxOverdue  = Math.max(...delayList.map(t => t.overdueDays), 1);
  const avgOverdue  = delayList.length > 0
    ? Math.round(delayList.reduce((s, t) => s + t.overdueDays, 0) / delayList.length)
    : 0;

  return (
    <div className={`font-sans ${wrapperClassName}`}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2.5 mb-4">
        <button onClick={onBack} className="text-[13px] text-[#2563EB] font-semibold hover:underline cursor-pointer">
          ← All Projects
        </button>
        <span className="text-[#CBD5E1]">/</span>
        <span className="text-[13px] text-[#0F172A] font-semibold">{proj.name}</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-[22px] font-bold text-[#0F172A] leading-tight">{proj.name}</div>
          {proj.clientName && (
            <div className="text-[12px] text-[#64748B] mt-0.5">
              General Contractor: <span className="font-semibold text-[#0F172A]">{proj.clientName}</span>
            </div>
          )}
          <div className="text-[11px] text-[#94A3B8] font-mono mt-0.5">{proj.code}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          {real && (
            <button
              onClick={reoptState === "idle" || reoptState === "error" ? handleReoptimize : undefined}
              disabled={reoptState === "running"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed
                ${reoptState === "done"
                  ? "bg-[#DCFCE7] border-[#BBF7D0] text-[#059669]"
                  : reoptState === "error"
                  ? "bg-[#FEF2F2] border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEE2E2]"
                  : reoptState === "running"
                  ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#3B82F6]"
                  : "bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB] hover:bg-[#DBEAFE]"
                }`}
            >
              <RefreshCw
                size={12}
                strokeWidth={2}
                className={reoptState === "running" ? "animate-spin" : ""}
              />
              {reoptState === "running" ? "Reoptimizing…"
                : reoptState === "done"   ? "Reoptimized"
                : reoptState === "error"  ? "Retry Reoptimize"
                : "Reoptimize Schedule"}
            </button>
          )}
          <Btn small onClick={() => router.push(`/dashboard/dpr${scheduleParams}`)}>
            <FileText size={12} strokeWidth={1.6} /> Generate DPR
          </Btn>
          <Btn small onClick={() => router.push(`/dashboard/schedule/gantt${scheduleParams}`)}>
            <CalendarDays size={12} strokeWidth={1.6} /> Schedule
          </Btn>
          <Btn small onClick={() => router.push(`/dashboard/settings/project${scheduleParams}`)}>
            <Settings size={12} strokeWidth={1.6} /> Settings
          </Btn>
        </div>
      </div>

      {/* Status band — colored accent based on project status */}
      <div
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl border-l-[3px] border border-[#E2E8F0]"
        style={{
          borderLeftColor: STATUS_CONFIG[proj.status].color,
          background: `linear-gradient(to right, ${STATUS_CONFIG[proj.status].color}0d, transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap">
          {proj.stage && (
            <div className="flex items-center gap-1.5">
              <Tag size={11} className="text-[#94A3B8]" />
              <span className="text-[12px] font-semibold text-[#0F172A]">{proj.stage}</span>
            </div>
          )}
          {proj.address && (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-[#94A3B8]" />
              <span className="text-[12px] text-[#475569]">{proj.address}</span>
            </div>
          )}
          {proj.startDate && proj.endDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays size={11} className="text-[#94A3B8]" />
              <span className="text-[12px] text-[#475569] font-mono tabular-nums">{fmtDate(proj.startDate)} → {fmtDate(proj.endDate)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {totalDays > 0 && (
            <div className="text-right">
              <div className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">
                Timeline — {elapsedDays}/{totalDays}d &nbsp;({timeUsedPct}%)
              </div>
              <div className="w-36 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${timeUsedPct}%`, background: deadlineColor }} />
              </div>
            </div>
          )}
          <StatusBadge status={proj.status} />
        </div>
      </div>

      {/* Reoptimize progress banner */}
      {reoptState === "running" && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={13} className="text-[#2563EB] animate-spin shrink-0" />
            <span className="text-[13px] font-bold text-[#1D4ED8]">AI is reoptimizing your schedule…</span>
            {reoptProgress && (
              <span className="ml-auto text-[11px] text-[#93C5FD] tabular-nums">{reoptProgress.percentage}%</span>
            )}
          </div>
          {reoptProgress && (
            <div className="text-[11px] text-[#3B82F6] mb-2">{reoptProgress.status}</div>
          )}
          <div className="h-1.5 bg-[#BFDBFE] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
              style={{ width: reoptProgress ? `${reoptProgress.percentage}%` : "8%" }}
            />
          </div>
        </div>
      )}
      {reoptState === "done" && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#059669] shrink-0" />
            <span className="text-[13px] font-bold text-[#059669]">Schedule reoptimized — new version saved</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push(`/dashboard/schedule/gantt${scheduleParams}`)}
              className="px-3 py-1 rounded-lg bg-[#059669] text-white text-[11px] font-bold hover:bg-[#047857] transition-colors cursor-pointer"
            >
              View in Gantt
            </button>
            <button
              onClick={() => { setReoptState("idle"); setReoptJobId(null); setReoptProgress(null); }}
              className="px-3 py-1 rounded-lg border border-[#BBF7D0] text-[#059669] text-[11px] font-medium hover:bg-[#DCFCE7] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {reoptState === "error" && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
            <div>
              <span className="text-[13px] font-bold text-[#EF4444]">Reoptimization failed</span>
              {reoptError && <div className="text-[11px] text-[#F87171]">{reoptError}</div>}
            </div>
          </div>
          <button
            onClick={() => { setReoptState("idle"); setReoptError(null); }}
            className="shrink-0 px-3 py-1 rounded-lg border border-[#FEE2E2] text-[#EF4444] text-[11px] font-medium hover:bg-[#FEE2E2] transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {timelineInsufficient && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] flex items-center gap-3">
          <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
          <div>
            <span className="text-[13px] font-bold text-[#EF4444]">Project can't be completed in given timeline</span>
            <div className="text-[11px] text-[#F87171] mt-0.5">
              Minimum timeline required: <span className="font-bold">{minTaskDays}d</span> — current: <span className="font-bold">{totalDays}d</span>. Extend the project end date.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-24 bg-[#E2E8F0] rounded-xl" />)}
          </div>
          <div className="h-64 bg-[#E2E8F0] rounded-xl" />
          <div className="h-32 bg-[#E2E8F0] rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── KPI Grid — 2 rows × 3 ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {/* Row 1: Performance */}
            <KpiCard
              icon={<Activity size={14} className="text-[#2563EB]" />}
              label="Overall Progress"
              value={fmt(averageProgress)}
              sub={hasTasks ? `${completedCount} of ${parentTasks.length} tasks done` : "No schedule imported"}
              iconBg="#EFF6FF"
              valueColor={averageProgress !== null ? "#2563EB" : "#CBD5E1"}
            />
            <KpiCard
              icon={<TrendingUp size={14} style={{ color: scheduleColor }} />}
              label="Schedule Health"
              value={scheduleHealth ?? "—"}
              sub={
                scheduleVariance !== null
                  ? `${Math.abs(scheduleVariance)}% ${scheduleVariance >= 0 ? "ahead of" : "behind"} plan`
                  : "Import schedule to track"
              }
              iconBg={scheduleColor + "18"}
              valueColor={scheduleColor}
            />
            <KpiCard
              icon={<Target size={14} style={{ color: deadlineColor }} />}
              label="Days Remaining"
              value={totalDays > 0 ? `${remainingDays}d` : "—"}
              sub={totalDays > 0 ? `${timeUsedPct}% of timeline used` : "Set project dates"}
              iconBg={deadlineColor + "18"}
              valueColor={deadlineColor}
              accent={remainingDays <= 7 && remainingDays > 0 ? { label: "Final Week", color: "#EF4444" } : undefined}
            />

            {/* Row 2: Resources */}
            <KpiCard
              icon={<Users size={14} className="text-[#7C3AED]" />}
              label="Labor Status"
              value={laborUsed !== null ? `${laborUsed}mh` : "—"}
              sub={
                laborUsed !== null && laborPlanned !== null
                  ? `${laborPlanned}mh planned · ${laborVar !== null ? (laborVar > 0 ? `${laborVar}% under` : `${Math.abs(laborVar!)}% over`) : ""}`
                  : "No tasks yet"
              }
              iconBg="#F5F3FF"
              valueColor="#7C3AED"
              accent={laborVar !== null && laborVar < 0 ? { label: "Over budget", color: "#EF4444" } : undefined}
            />
            <KpiCard
              icon={<Package size={14} className="text-[#0891B2]" />}
              label="Material Status"
              value={fmt(matUsed)}
              sub={
                matReceived !== null
                  ? `${matReceived}% received on-site`
                  : "No tasks yet"
              }
              iconBg="#ECFEFF"
              valueColor="#0891B2"
              accent={
                matUsed !== null && matReceived !== null && matUsed > matReceived
                  ? { label: "Supply gap", color: "#EF4444" }
                  : undefined
              }
            />
            <KpiCard
              icon={<AlertTriangle size={14} className="text-[#F59E0B]" />}
              label="Open Issues"
              value={issues.length > 0 ? String(issues.length) : String(delayedCount)}
              sub={delayedCount > 0 ? `${delayedCount} task${delayedCount !== 1 ? "s" : ""} delayed` : "All clear"}
              iconBg="#FFFBEB"
              valueColor={delayedCount > 0 ? "#EF4444" : "#059669"}
            />
          </div>

          {/* ── Two-column: Milestone Tracker + Right panel ── */}
          <div className="flex gap-4 mb-5">

            {/* Left: Milestone Tracker */}
            <div className="flex-1 min-w-0 bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
                <div className="text-[14px] font-bold text-[#0F172A]">Milestone Tracker</div>
                <div className="flex items-center gap-3">
                  {[
                    { color: "#22C55E", label: `Completed (${completedCount})` },
                    { color: "#F59E0B", label: `In Progress (${inProgressCount})` },
                    { color: "#CBD5E1", label: `Pending (${pendingCount})` },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4">
                <MilestoneTracker tasks={parentTasks} />
              </div>
            </div>

            {/* Right: Weather + Project Vitals */}
            <div className="w-[256px] shrink-0 flex flex-col gap-3">
              {!!(proj.address || (proj.settingsJson as any)?.lat) && (
                <WeatherWidget
                  address={proj.address}
                  lat={proj.settingsJson?.lat as number | null}
                  lng={proj.settingsJson?.lng as number | null}
                />
              )}

              {/* Project Vitals */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-3">Project Vitals</div>
                <div className="space-y-2.5">
                  {[
                    { label: "Phase",      value: proj.stage  || "—",                      icon: <Tag size={11} className="text-[#94A3B8]" /> },
                    { label: "Duration",   value: totalDays   > 0 ? `${totalDays} days` : "—", icon: <CalendarDays size={11} className="text-[#94A3B8]" /> },
                    { label: "Time Used",  value: totalDays   > 0 ? `${timeUsedPct}%`   : "—", icon: <Clock size={11} className="text-[#94A3B8]" /> },
                    { label: "Milestones", value: `${parentTasks.length}`,                  icon: <CheckCircle2 size={11} className="text-[#94A3B8]" /> },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        {row.icon}
                        {row.label}
                      </div>
                      <div className="text-[12px] font-semibold text-[#0F172A]">{row.value}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline bar */}
                {totalDays > 0 && (
                  <div className="mt-4">
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${timeUsedPct}%`, background: deadlineColor }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-[#94A3B8] mt-1 font-mono">
                      <span>{fmtDate(proj.startDate)}</span>
                      <span>{fmtDate(proj.endDate)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Task Progress Overview (only if tasks exist) ── */}
          {hasTasks && (
            <>
              <SectionTitle>Task Progress Overview</SectionTitle>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-5 shadow-sm">
                <div className="flex h-5 rounded-md overflow-hidden mb-4 border border-[#E2E8F0] bg-[#F8FAFC]">
                  {(["completed", "inProgress", "runningLate", "delayed", "notStarted"] as const).map((s) => {
                    const count = parentTasks.filter(t => t.status === s).length;
                    const pct   = Math.round((count / total) * 100);
                    if (!pct) return null;
                    return (
                      <div
                        key={s}
                        style={{ width: `${pct}%`, background: STATUS_CONFIG[s].color }}
                        className="h-full flex items-center justify-center border-r border-white/10 last:border-0"
                      >
                        {pct > 8 && <span className="text-[9px] font-bold text-white">{pct}%</span>}
                      </div>
                    );
                  })}
                </div>
                {parentTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
                    <span className="text-[11px] font-medium text-[#0F172A] w-[160px] truncate">{t.name}</span>
                    <div className="flex-1 h-3 bg-[#F8FAFC] rounded overflow-hidden border border-[#F1F5F9]">
                      <div className="h-full" style={{ width: `${t.pct}%`, background: STATUS_CONFIG[t.status].color }} />
                    </div>
                    <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color: STATUS_CONFIG[t.status].color }}>
                      {t.pct}%
                    </span>
                    <div className="w-[100px] flex justify-end">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── S-Curve ── */}
          <SectionTitle>S-Curve · Planned vs Actual Progress</SectionTitle>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-5 shadow-sm">
            {scData.labels.length < 2 || averageProgress === null ? (
              <div className="py-8 text-center">
                <BarChart2 size={28} className="mx-auto mb-2 text-[#CBD5E1]" />
                <div className="text-[13px] font-semibold text-[#475569] mb-1">No progress data yet</div>
                <div className="text-[12px] text-[#94A3B8]">Import a schedule to track the S-curve</div>
              </div>
            ) : (
              <>
                {/* Variance callout */}
                {scheduleVariance !== null && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-[12px] font-semibold"
                    style={{
                      borderColor: scheduleColor + "40",
                      background: scheduleColor + "0c",
                      color: scheduleColor,
                    }}>
                    <TrendingUp size={13} />
                    {scheduleVariance >= 0
                      ? `${scheduleVariance}% ahead of plan`
                      : `${Math.abs(scheduleVariance)}% behind plan`}
                    <span className="ml-auto text-[11px] font-normal" style={{ color: scheduleColor + "cc" }}>
                      Actual {averageProgress}% · Planned {timeUsedPct}%
                    </span>
                  </div>
                )}
                <svg viewBox="0 0 440 160" className="w-full h-[160px]">
                  <defs>
                    <linearGradient id="scFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#2563EB" stopOpacity="0.13" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid */}
                  {[0, 25, 50, 75, 100].map(v => (
                    <g key={v}>
                      <line x1={SC.L} y1={scTY(v)} x2={SC.R} y2={scTY(v)}
                        stroke={v === 0 ? "#E2E8F0" : "#F1F5F9"} strokeWidth="1" />
                      <text x={SC.L - 5} y={scTY(v) + 3.5} fontSize="9" fill="#94A3B8" textAnchor="end">{v}%</text>
                    </g>
                  ))}
                  {/* Axes */}
                  <line x1={SC.L} y1={SC.T} x2={SC.L} y2={SC.B} stroke="#E2E8F0" strokeWidth="1" />
                  <line x1={SC.L} y1={SC.B} x2={SC.R} y2={SC.B} stroke="#E2E8F0" strokeWidth="1" />

                  {/* X labels */}
                  {scData.labels.map((label, i) => (
                    <text key={i} x={scTX(i)} y={SC.B + 13} fontSize="8.5" fill="#94A3B8" textAnchor="middle">{label}</text>
                  ))}

                  {/* Planned curve */}
                  {scPlannedPath && (
                    <path d={scPlannedPath} fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="5 3" />
                  )}

                  {/* Actual fill + curve */}
                  {scFillPath && <path d={scFillPath} fill="url(#scFill)" />}
                  {scActualPath && (
                    <path d={scActualPath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}

                  {/* Today marker */}
                  {timeUsedPct > 2 && timeUsedPct < 98 && (
                    <>
                      <line x1={scTodayX} y1={SC.T} x2={scTodayX} y2={SC.B}
                        stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 2.5" />
                      <rect x={scTodayX - 13} y={SC.T - 1} width="26" height="11" rx="3"
                        fill="#FEF3C7" stroke="#F59E0B" strokeWidth="0.8" />
                      <text x={scTodayX} y={SC.T + 7.5} fontSize="7.5" fill="#B45309" textAnchor="middle" fontWeight="bold">Today</text>
                    </>
                  )}

                  {/* Actual dot */}
                  {scActualPts.length > 0 && (
                    <circle
                      cx={scActualPts[scActualPts.length - 1][0]}
                      cy={scActualPts[scActualPts.length - 1][1]}
                      r="5" fill="#2563EB" stroke="white" strokeWidth="2.5"
                    />
                  )}

                  {/* Legend */}
                  <g transform={`translate(${SC.R - 138}, ${SC.T + 3})`}>
                    <line x1="0" y1="0" x2="14" y2="0" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="5 3" />
                    <text x="18" y="3.5" fontSize="8.5" fill="#94A3B8">Planned</text>
                    <line x1="72" y1="0" x2="86" y2="0" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="94" cy="0" r="3.5" fill="#2563EB" stroke="white" strokeWidth="1.5" />
                    <text x="100" y="3.5" fontSize="8.5" fill="#2563EB" fontWeight="bold">Actual</text>
                  </g>
                </svg>
              </>
            )}
          </div>

          {/* ── Delay Analytics ── */}
          <SectionTitle>Delay Analytics</SectionTitle>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-5 shadow-sm">
            {delayList.length === 0 ? (
              <div className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} className="text-[#059669]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#059669]">All milestones on schedule</div>
                  <div className="text-[12px] text-[#94A3B8]">
                    {parentTasks.length > 0
                      ? `${parentTasks.length} milestone${parentTasks.length !== 1 ? "s" : ""} tracked · no delays detected`
                      : "Import a schedule to start tracking delays"}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl border border-[#FEE2E2] bg-[#FFF5F5] p-3.5">
                    <div className="text-[9px] font-bold text-[#EF4444] uppercase tracking-[0.1em] mb-1">Delayed Tasks</div>
                    <div className="text-[26px] font-bold text-[#EF4444] leading-none">{delayList.length}</div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">of {parentTasks.length} total</div>
                  </div>
                  <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3.5">
                    <div className="text-[9px] font-bold text-[#F97316] uppercase tracking-[0.1em] mb-1">Avg Overdue</div>
                    <div className="text-[26px] font-bold text-[#F97316] leading-none">{avgOverdue}d</div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">days past planned end</div>
                  </div>
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5">
                    <div className="text-[9px] font-bold text-[#059669] uppercase tracking-[0.1em] mb-1">On Schedule</div>
                    <div className="text-[26px] font-bold text-[#059669] leading-none">{parentTasks.length - delayList.length}</div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">tasks on time</div>
                  </div>
                </div>

                {/* Per-task delay bars */}
                <div className="space-y-3">
                  {delayList.map(t => {
                    const barPct = maxOverdue > 0 ? Math.round((t.overdueDays / maxOverdue) * 100) : 0;
                    const barColor = t.overdueDays > 14 ? "#EF4444" : t.overdueDays > 7 ? "#F97316" : "#F59E0B";
                    return (
                      <div key={t.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-[#0F172A] truncate max-w-[220px]">{t.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <StatusBadge status={t.status} />
                            {t.overdueDays > 0 && (
                              <span className="text-[11px] font-bold tabular-nums" style={{ color: barColor }}>
                                {t.overdueDays}d overdue
                              </span>
                            )}
                          </div>
                        </div>
                        {t.overdueDays > 0 && (
                          <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: barColor }} />
                          </div>
                        )}
                        {(t.startDate || t.endDate) && (
                          <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                            {fmtDate(t.startDate ?? "")}{t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}
                            {t.pct > 0 ? ` · ${t.pct}% done` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
