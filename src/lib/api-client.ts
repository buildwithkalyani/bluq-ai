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
  ScheduleTask,
} from "@/lib/mock-data";
import type { DPREntry } from "@/lib/mock-data-extended";
import { authClient } from "@/lib/auth-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

async function getAuthToken(): Promise<string> {
  const session = await authClient.getSession();
  return session?.data?.session?.token ?? "";
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = await getAuthToken();
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
  const token = await getAuthToken();
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
// TASKS (schedule pages)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true when projectId is a real UUID (not a mock numeric string "0") */
export function isRealProject(projectId: string | null | undefined): boolean {
  return !!projectId && UUID_RE.test(projectId);
}

export interface BackendTask {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  percentComplete: string | null;
  contractor: string | null;
  area: string | null;
  isMilestone: boolean;
  parentTaskId: string | null;
  sortOrder: number;
  priority: string | null;
}

function backendTaskToScheduleTask(t: BackendTask): ScheduleTask {
  const statusMap: Record<string, string> = {
    not_started: "notStarted",
    in_progress: "inProgress",
    completed: "completed",
    running_late: "runningLate",
    delayed: "delayed",
  };
  const pct = Number(t.percentComplete ?? 0);
  const isDelayed = t.status === "delayed" || t.status === "running_late";
  return {
    id: t.id,
    name: t.title,
    pct,
    status: (statusMap[t.status] ?? "notStarted") as any,
    critical: false,
    group: "",
    startDate: t.startDate ?? "",
    endDate: t.endDate ?? "",
    duration: t.durationDays ? `${t.durationDays}d` : "",
    contractor: t.contractor ?? "—",
    delay: isDelayed ? `${t.status === "delayed" ? "Delayed" : "Running late"}` : null,
    space: t.area ?? "",
    phase: t.area ?? "",       // no separate phase in schema — use area
    photos: [],
    milestone: t.isMilestone,
    parentTaskId: t.parentTaskId ?? undefined,
    left: 0,
    width: 0,
    projectId: 0,
  };
}

/** GET /tasks?projectId=&workspaceId= → ScheduleTask[] */
export async function fetchTasks(
  projectId: string,
  workspaceId: string
): Promise<ScheduleTask[]> {
  const rows = await apiFetch<BackendTask[]>(
    `/tasks?projectId=${projectId}&workspaceId=${workspaceId}`
  );
  return (rows ?? []).map(backendTaskToScheduleTask);
}

/** POST /tasks */
export async function createTask(data: {
  workspaceId: string;
  projectId: string;
  title: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  percentComplete?: number;
  contractor?: string;
  area?: string;
  isMilestone?: boolean;
  parentTaskId?: string;
  priority?: string;
}): Promise<BackendTask> {
  return apiPost<BackendTask>("/tasks", data);
}

/** PATCH /tasks/:id */
export async function updateTask(
  id: string,
  data: Partial<Omit<BackendTask, "id" | "workspaceId" | "projectId">>
): Promise<BackendTask> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH /tasks/${id} failed: ${res.status}`);
  return res.json();
}

/** DELETE /tasks/:id */
export async function deleteTask(id: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}/tasks/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`DELETE /tasks/${id} failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// DOCUMENTS
// ---------------------------------------------------------------------------

export interface BackendDocument {
  id: string;
  workspaceId: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
  folder: string | null;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

/** GET /documents?projectId=&workspaceId= → BackendDocument[] */
export async function fetchDocuments(
  projectId: string,
  workspaceId: string
): Promise<BackendDocument[]> {
  return apiFetch<BackendDocument[]>(
    `/documents?projectId=${projectId}&workspaceId=${workspaceId}`
  );
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
