// =============================================================================
// BLUQ API CLIENT
// =============================================================================
// All functions that call the real Fastify backend (Railway).
//
// Every function returns a shape that exactly matches what the mock-data
// functions return — so pages can use either source transparently.
//
// Usage pattern in pages:
//   if (projectUuid && workspaceId) {
//     fetchDoneYesterday(projectUuid, workspaceId).then(setDoneYesterday)
//   } else {
//     getDoneYesterday(pid).then(setDoneYesterday)   // mock fallback
//   }
//
// Auth: reads the Better Auth session token from localStorage (set by
// better-auth/react automatically). All requests include Authorization header.
// =============================================================================

import type {
  DailyTask,
  DailyTodo,
  Milestone,
  AIBriefing,
} from "@/lib/mock-data";
import type { DPREntry } from "@/lib/mock-data-extended";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// ---------------------------------------------------------------------------
// Auth token helper
// Better Auth stores the session in a cookie, but for client-side fetch calls
// to our own backend we need the token. Better Auth exposes it on the session
// object — we read it from the cookie that better-auth sets.
// ---------------------------------------------------------------------------
function getAuthToken(): string {
  if (typeof document === "undefined") return "";
  // better-auth sets a cookie named "better-auth.session_token"
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("better-auth.session_token="));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// STATUS MAPPING — backend snake_case → frontend camelCase
// ---------------------------------------------------------------------------
const STATUS_MAP: Record<string, string> = {
  not_started:  "notStarted",
  in_progress:  "inProgress",
  completed:    "completed",
  running_late: "runningLate",
  delayed:      "delayed",
};

function mapStatus(raw: string): string {
  return STATUS_MAP[raw] ?? "notStarted";
}

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------

export interface BackendProject {
  id: string;           // UUID
  workspaceId: string;
  projectName: string;
  projectCode: string | null;
  address: string | null;
  stage: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  clientName: string | null;
  percentComplete: number | null;
}

/** GET /projects?workspaceId= → BackendProject[] */
export async function fetchProjects(workspaceId: string): Promise<BackendProject[]> {
  return apiFetch<BackendProject[]>(`/projects?workspaceId=${workspaceId}`);
}

/** POST /projects → BackendProject */
export async function createProject(data: {
  workspaceId: string;
  projectName: string;
  projectCode?: string;
  address?: string;
  stage?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}): Promise<BackendProject> {
  return apiPost<BackendProject>("/projects", data);
}

// ---------------------------------------------------------------------------
// DAILY UPDATES
// ---------------------------------------------------------------------------

/** GET /tasks/done-yesterday → DailyTask[] */
export async function fetchDoneYesterday(
  projectId: string,
  workspaceId: string
): Promise<DailyTask[]> {
  const data = await apiFetch<{ tasks: any[] }>(
    `/tasks/done-yesterday?projectId=${projectId}&workspaceId=${workspaceId}`
  );
  return (data.tasks ?? []).map((t) => ({
    task: t.title,
    project: t.area ?? "General",
    projectId: 0,        // numeric id not used when real data is active
    contractor: t.contractor ?? "—",
  }));
}

/** GET /tasks/todo-today → DailyTodo[] */
export async function fetchTodoToday(
  projectId: string,
  workspaceId: string
): Promise<DailyTodo[]> {
  const data = await apiFetch<{ tasks: any[] }>(
    `/tasks/todo-today?projectId=${projectId}&workspaceId=${workspaceId}`
  );
  return (data.tasks ?? []).map((t) => ({
    task: t.title,
    project: t.area ?? "General",
    projectId: 0,
    contractor: t.contractor ?? "—",
    priority:
      t.status === "delayed" || t.status === "running_late"
        ? "high"
        : t.status === "in_progress"
        ? "medium"
        : "low",
  }));
}

/** GET /tasks/milestones → Milestone[] */
export async function fetchMilestones(
  projectId: string,
  workspaceId: string,
  days: number
): Promise<Milestone[]> {
  const data = await apiFetch<{ milestones: any[] }>(
    `/tasks/milestones?projectId=${projectId}&workspaceId=${workspaceId}&days=${days}`
  );
  const today = new Date();
  return (data.milestones ?? []).map((t) => {
    const endDate = t.endDate ? new Date(t.endDate) : today;
    const daysLeft = Math.max(
      0,
      Math.round((endDate.getTime() - today.getTime()) / 86400000)
    );
    return {
      name: t.title,
      project: t.area ?? "General",
      projectId: 0,
      date: endDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      status: mapStatus(t.status) as any,
      daysLeft,
    };
  });
}

/** GET /projects/:id/briefing → AIBriefing */
export async function fetchAIBriefing(
  projectId: string,
  workspaceId: string
): Promise<AIBriefing> {
  const data = await apiFetch<{ briefing: string; stats: any }>(
    `/projects/${projectId}/briefing?workspaceId=${workspaceId}`
  );
  return {
    projectId: 0,
    text: data.briefing ?? "",
    highlight: `${data.stats?.avgPercent ?? 0}% overall completion · ${data.stats?.delayed ?? 0} delayed`,
  };
}

// ---------------------------------------------------------------------------
// DPR HISTORY
// ---------------------------------------------------------------------------

/** GET /dprs → DPREntry[] */
export async function fetchDPRHistory(
  projectId: string,
  workspaceId: string
): Promise<DPREntry[]> {
  const rows = await apiFetch<any[]>(
    `/dprs?projectId=${projectId}&workspaceId=${workspaceId}`
  );
  return (rows ?? []).map((d, i) => ({
    id: i + 1,
    date: new Date(d.reportDate).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    submittedBy: d.reportedBy ?? "WhatsApp",
    tasksSummary: d.workDone ?? "—",
    overallProgress: Number(d.percentComplete ?? 0),
    workersOnSite: d.labourCount ?? 0,
    issuesCount: d.delayReason ? 1 : 0,
    photosCount: 0,
    status: "submitted" as const,
  }));
}

// ---------------------------------------------------------------------------
// REPORTS — PDF generation
// ---------------------------------------------------------------------------

export interface GenerateReportResult {
  jobId: string;
}

export interface ReportStatusResult {
  status: "queued" | "processing" | "completed" | "failed";
  signedUrl?: string;
  error?: string;
}

/** POST /reports/generate → { jobId } */
export async function generateReport(opts: {
  projectId: string;
  workspaceId: string;
  reportDate: string;
  sections: string[];
}): Promise<GenerateReportResult> {
  // Map frontend section ids to backend section ids
  const sectionMap: Record<string, string> = {
    executive_summary: "ai_summary",
    s_curve:           "s_curve",
    site_progress:     "site_progress",
    site_attendance:   "site_attendance",
    material_usage:    "material_usage",
    issues:            "critical_issues",
    site_photos:       "site_photos",
  };
  const mappedSections = opts.sections
    .map((s) => sectionMap[s])
    .filter(Boolean);

  return apiPost<GenerateReportResult>("/reports/generate", {
    projectId: opts.projectId,
    workspaceId: opts.workspaceId,
    reportDate: opts.reportDate,
    sections: mappedSections,
  });
}

/** GET /reports/status/:jobId — polls until done or failed */
export async function pollReportStatus(
  jobId: string
): Promise<ReportStatusResult> {
  return apiFetch<ReportStatusResult>(`/reports/status/${jobId}`);
}
