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

let _tokenCache: { token: string; exp: number } | null = null;
let _tokenFlight: Promise<string> | null = null;

async function getAuthToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.exp) return _tokenCache.token;
  if (_tokenFlight) return _tokenFlight;
  _tokenFlight = authClient.getSession().then(session => {
    const token = session?.data?.session?.token ?? "";
    _tokenCache = { token, exp: Date.now() + 60_000 };
    _tokenFlight = null;
    return token;
  });
  return _tokenFlight;
}

export function clearAuthTokenCache(): void {
  _tokenCache = null;
  _tokenFlight = null;
}

async function apiFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API PATCH ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API PUT ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API DELETE ${path} failed: ${res.status}`);
  }
}

export async function deleteProject(id: string): Promise<void> {
  return apiDelete(`/projects/${id}`);
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
  settingsJson?: Record<string, unknown> | null;
}

/** GET /projects?workspaceId= → BackendProject[] */
export async function fetchProjects(workspaceId: string): Promise<BackendProject[]> {
  return apiFetch<BackendProject[]>(`/projects?workspaceId=${workspaceId}`);
}

/** GET /projects/:id → BackendProject */
export async function fetchProject(id: string): Promise<BackendProject> {
  return apiFetch<BackendProject>(`/projects/${id}`);
}

// ---------------------------------------------------------------------------
// USER + ORG (ACCOUNT SETTINGS)
// ---------------------------------------------------------------------------

export interface BackendUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export async function fetchUserProfile(): Promise<BackendUserProfile> {
  return apiFetch<BackendUserProfile>("/users/me");
}

export async function updateUserProfile(data: { name?: string; phone?: string }): Promise<BackendUserProfile> {
  return apiPatch<BackendUserProfile>("/users/me", data);
}

export async function updateOrg(id: string, data: { name?: string; logoUrl?: string }): Promise<{ id: string; name: string; logoUrl: string | null }> {
  return apiPatch(`/orgs/${id}`, data);
}

export async function fetchOrgLogoUploadUrl(orgId: string, fileName: string): Promise<{ signedUrl: string; publicUrl: string }> {
  return apiFetch(`/orgs/logo-upload-url?orgId=${encodeURIComponent(orgId)}&fileName=${encodeURIComponent(fileName)}`);
}

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------

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
  settingsJson?: Record<string, unknown>;
}): Promise<BackendProject> {
  return apiPost<BackendProject>("/projects", data);
}

/** PATCH /projects/:id → BackendProject */
export async function updateProject(
  id: string,
  data: Partial<{
    projectName: string;
    address: string;
    stage: string;
    category: string;
    startDate: string;
    endDate: string;
    projectCode: string;
    settingsJson: Record<string, unknown>;
  }>
): Promise<BackendProject> {
  return apiPatch<BackendProject>(`/projects/${id}`, data);
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
  phase: string | null;
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
    phase: t.phase ?? "",
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
  workspaceId: string,
  signal?: AbortSignal
): Promise<ScheduleTask[]> {
  const rows = await apiFetch<BackendTask[]>(
    `/tasks?projectId=${projectId}&workspaceId=${workspaceId}`,
    signal
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
  phase?: string;
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

// ---------------------------------------------------------------------------
// TASK DEPENDENCIES
// ---------------------------------------------------------------------------

export interface BackendTaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  dependencyType: "FS" | "FF" | "SS" | "SF";
  lagDays: number | null;
}

/** GET /tasks/dependencies?projectId=&workspaceId= */
export async function fetchTaskDependencies(
  projectId: string,
  workspaceId: string,
  signal?: AbortSignal
): Promise<BackendTaskDependency[]> {
  return apiFetch<BackendTaskDependency[]>(
    `/tasks/dependencies?projectId=${projectId}&workspaceId=${workspaceId}`,
    signal
  );
}

/**
 * Prefetch tasks + deps for a project and write them to the Gantt localStorage
 * cache. Call on Schedule nav hover so navigation feels instant.
 * No-op if fresh cache already exists (< 60s old).
 */
export function prefetchGanttData(projectId: string, workspaceId: string): void {
  if (!projectId || !workspaceId) return;
  try {
    const raw = localStorage.getItem(`bluq_gantt_${projectId}`);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.lastFetchedAt && Date.now() - cached.lastFetchedAt < 60_000) return;
    }
  } catch {}

  Promise.all([
    fetchTasks(projectId, workspaceId),
    fetchTaskDependencies(projectId, workspaceId),
  ]).then(([tasks, depRows]) => {
    const deps = depRows.map(r => ({ from: r.predecessorId, to: r.successorId, type: r.dependencyType, label: r.dependencyType }));
    const depIds: Record<string, string> = {};
    depRows.forEach(r => { depIds[`${r.predecessorId}__${r.successorId}`] = r.id; });
    try {
      localStorage.setItem(`bluq_gantt_${projectId}`, JSON.stringify({ tasks, deps, depIds, lastFetchedAt: Date.now() }));
    } catch {}
  }).catch(() => {});
}

/** POST /tasks/dependencies */
export async function createTaskDependency(data: {
  workspaceId: string;
  predecessorId: string;
  successorId: string;
  dependencyType?: string;
}): Promise<BackendTaskDependency | null> {
  const result = await apiPost<BackendTaskDependency | { message: string }>("/tasks/dependencies", data);
  if ("message" in result) return null;
  return result;
}

/** DELETE /tasks/dependencies/:id */
export async function deleteTaskDependency(id: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}/tasks/dependencies/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`DELETE /tasks/dependencies/${id} failed: ${res.status}`);
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
    submittedBy: d.source === "generated" ? "Generated PDF" : (d.reportedBy ?? "WhatsApp"),
    tasksSummary: d.workDone ?? "—",
    overallProgress: Number(d.percentComplete ?? 0),
    workersOnSite: d.labourCount ?? 0,
    issuesCount: d.delayReason ? 1 : 0,
    photosCount: 0,
    status: (d.source === "generated" ? "generated" : "submitted") as "generated" | "submitted",
  }));
}

// ---------------------------------------------------------------------------
// WHATSAPP FEED
// ---------------------------------------------------------------------------

export interface WaConvo {
  id: string;
  senderPhone: string;
  name: string;
  type: "EOD" | "Warning";
  time: string;
  status: string;
  task: string;
  color: string;
  messageCount: number;
  lastMessage: string;
  receivedAt: string | null;
}

export interface WaMessage {
  id: string;
  rawMessage: string;
  parsedJson: unknown;
  receivedAt: string | null;
  matchedTaskId: string | null;
  status: string;
}

export async function sendTeamInvite(email: string, name: string, role: string, workspaceId: string): Promise<void> {
  await apiPost<{ ok: boolean }>("/team/invite", { email, name, role, workspaceId });
}

export interface TeamMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string | null;
  invitedAt: string | null;
  name: string;
  email: string;
  projectCount: number;
}

export async function fetchTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  return apiFetch(`/team/members?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function removeTeamMember(memberId: string, workspaceId: string): Promise<void> {
  return apiDelete(`/team/members/${memberId}?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function updateMemberRole(memberId: string, role: string, workspaceId: string): Promise<void> {
  await apiPatch(`/team/members/${memberId}/role`, { role, workspaceId });
}

export async function getTeamInviteLink(workspaceId: string): Promise<string> {
  const res = await apiFetch<{ inviteUrl: string }>(`/team/invite-link?workspaceId=${encodeURIComponent(workspaceId)}`);
  return res.inviteUrl;
}

export async function fetchMemberProjectAccess(userId: string, workspaceId: string): Promise<string[]> {
  return apiFetch(`/team/members/${userId}/projects?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function setMemberProjectAccess(userId: string, workspaceId: string, projectIds: string[]): Promise<void> {
  await apiPut(`/team/members/${userId}/projects`, { workspaceId, projectIds });
}

// ── Role permissions ──────────────────────────────────────────
export type PermLevel = "none" | "view" | "upload" | "edit";

export interface RolePermissions {
  overview: PermLevel;
  schedule: PermLevel;
  reports: PermLevel;
  documents: PermLevel;
  siteUpdates: PermLevel;
  team: PermLevel;
  settings: PermLevel;
}

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  permissions: RolePermissions;
  createdAt: string | null;
}

export interface MyPermissions {
  role: string;
  permissions: RolePermissions;
}

export async function fetchRoles(workspaceId: string): Promise<WorkspaceRole[]> {
  return apiFetch(`/roles?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function fetchMyPermissions(workspaceId: string): Promise<MyPermissions> {
  return apiFetch(`/roles/mine?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function createRole(data: {
  workspaceId: string;
  name: string;
  description?: string;
  permissions: RolePermissions;
}): Promise<WorkspaceRole> {
  return apiPost("/roles", data);
}

export async function updateRole(
  id: string,
  data: { workspaceId: string; name?: string; description?: string; permissions?: Partial<RolePermissions> }
): Promise<WorkspaceRole> {
  return apiPatch(`/roles/${id}`, data);
}

export async function deleteRole(id: string, workspaceId: string): Promise<void> {
  return apiDelete(`/roles/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function acceptTeamInvite(token: string): Promise<{ ok: boolean; workspaceId: string }> {
  return apiPost("/team/invite/accept", { token });
}

export async function verifyTeamInvite(token: string): Promise<{ email: string; name: string; role: string; workspaceId: string; orgName: string }> {
  return apiFetch(`/team/invite/verify?token=${encodeURIComponent(token)}`);
}

export async function sendContractorWelcome(phone: string, contractorName: string, projectName: string): Promise<void> {
  await apiPost<{ ok: boolean }>("/whatsapp/send-welcome", { phone, contractorName, projectName });
}

export async function fetchWaConvos(projectId: string): Promise<WaConvo[]> {
  return apiFetch<WaConvo[]>(`/whatsapp/feed?projectId=${projectId}`);
}

export async function fetchWaMessages(projectId: string, senderPhone: string): Promise<{ messages: WaMessage[]; photoCount: number }> {
  return apiFetch(`/whatsapp/feed/messages?projectId=${encodeURIComponent(projectId)}&senderPhone=${encodeURIComponent(senderPhone)}`);
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

// ---------------------------------------------------------------------------
// SCHEDULE VERSIONS
// ---------------------------------------------------------------------------

export interface ScheduleVersion {
  id: string;
  versionNumber: number;
  isBaseline: boolean;
  isLocked: boolean;
  generatedBy: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  sourceFileName: string | null;
  aiReasoning: string | null;
  createdAt: string;
  scheduleJson: {
    gapCheck?: {
      suspectedGaps: Array<{
        taskName: string;
        phase: string;
        reason: string;
        confidence: "high" | "medium" | "low";
        alreadyCovered: boolean;
      }>;
      coverageAssessment: string;
      notes: string;
    };
    [key: string]: unknown;
  };
}

/** GET /schedule/versions?projectId=&workspaceId= → latest version with gapCheck */
export async function fetchLatestScheduleVersion(
  projectId: string,
  workspaceId: string,
): Promise<ScheduleVersion | null> {
  try {
    const versions = await apiFetch<ScheduleVersion[]>(
      `/schedule/versions?projectId=${projectId}&workspaceId=${workspaceId}`
    );
    return versions?.[0] ?? null; // versions are ordered desc by versionNumber
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GAP CHECK
// ---------------------------------------------------------------------------

/** POST /schedule/gap-check/accept */
export async function acceptGapCheckItem(body: {
  scheduleVersionId: string;
  workspaceId: string;
  projectId: string;
  taskName: string;
  phase: string;
  reason: string;
  dismissed: boolean;
}): Promise<{ success: boolean; action: string; task?: unknown }> {
  const result = await apiPost<{ success: boolean; action: string; task?: unknown }>(
    "/schedule/gap-check/accept",
    body,
  );
  return result;
}

// ---------------------------------------------------------------------------
// REPORTS — PDF generation
// ---------------------------------------------------------------------------

/** GET /reports/status/:jobId — polls until done or failed */
export async function pollReportStatus(
  jobId: string
): Promise<ReportStatusResult> {
  return apiFetch<ReportStatusResult>(`/reports/status/${jobId}`);
}

// ---------------------------------------------------------------------------
// DOCUMENTS — register uploaded file reference
// ---------------------------------------------------------------------------

/** GET /documents/upload-url → signed Supabase upload URL + storagePath */
export async function getDocumentUploadUrl(
  fileName: string,
  workspaceId: string,
  projectId: string,
  fileSize?: number,
): Promise<{ signedUrl: string; storagePath: string }> {
  const params = new URLSearchParams({ fileName, workspaceId, projectId });
  if (fileSize) params.set("fileSize", String(fileSize));
  return apiFetch(`/documents/upload-url?${params}`);
}

/** POST /documents — save Supabase Storage URL reference after upload */
export async function deleteDocument(id: string): Promise<void> {
  const token = await getAuthToken();
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  const res = await fetch(`${BACKEND_URL}/documents/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`DELETE /documents/${id} failed: ${res.status}`);
}

export async function registerDocument(data: {
  workspaceId: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  folder?: string;
  uploadedBy?: string;
}): Promise<BackendDocument> {
  return apiPost<BackendDocument>("/documents", data);
}

// ---------------------------------------------------------------------------
// SCHEDULE GENERATION
// ---------------------------------------------------------------------------

export async function fetchScheduleVersions(
  projectId: string,
  workspaceId: string
): Promise<ScheduleVersion[]> {
  return apiFetch<ScheduleVersion[]>(
    `/schedule/versions?projectId=${projectId}&workspaceId=${workspaceId}`
  );
}

export async function createScheduleVersion(
  projectId: string,
  workspaceId: string
): Promise<ScheduleVersion> {
  return apiPost<ScheduleVersion>("/schedule/versions", { projectId, workspaceId });
}

export interface ScheduleGenerateResult {
  success: boolean;
  jobId: string;
  status: string;
  documentsFound: number;
}

export interface ScheduleStatusResult {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  message: string;
  progress?: {
    step: number;
    totalSteps: number;
    percentage: number;
    status: string;
  };
  result?: {
    scheduleVersionId: string;
    taskCount: number;
    durationDays: number;
  };
  error?: string;
  suggestion?: string;
}

/** POST /schedule/generate → start AI schedule generation job */
export async function generateSchedule(data: {
  projectId: string;
  workspaceId: string;
  startDate?: string;
  endDate?: string;
  buildingType?: string;
  city?: string;
}): Promise<ScheduleGenerateResult> {
  return apiPost<ScheduleGenerateResult>("/schedule/generate", data);
}

/** GET /schedule/status/:jobId → poll generation progress */
export async function pollScheduleStatus(jobId: string): Promise<ScheduleStatusResult> {
  return apiFetch<ScheduleStatusResult>(`/schedule/status/${jobId}`);
}
