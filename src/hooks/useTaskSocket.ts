// =============================================================================
// useTaskSocket — real-time Gantt task updates via Socket.IO
// =============================================================================
// Connects to the Fastify backend Socket.IO server, joins the project room,
// and patches task state whenever a "task:updated" event arrives.
//
// Usage:
//   useTaskSocket({ projectId, setTasks })
//
// Requirements:
//   - projectId: UUID string of the project (from real API, not mock numeric id)
//   - setTasks:  React setState dispatch for the tasks array
//   - Session token is read from Better Auth via authClient.useSession()
//
// The hook is a no-op if:
//   - projectId is falsy / not a valid UUID
//   - NEXT_PUBLIC_BACKEND_URL is not set
//   - session is not yet loaded
//
// On unmount: socket is disconnected cleanly.
// On token expiry: server disconnects the socket; the hook lets it fail
//   silently (no infinite reconnect loop) — the user would need to log in again.
// =============================================================================

"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { authClient } from "@/lib/auth-client";
import type { ScheduleTask, ProjectStatus } from "@/lib/mock-data";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Status mapping — backend snake_case → frontend camelCase
// ---------------------------------------------------------------------------
const STATUS_MAP: Record<string, ProjectStatus> = {
  not_started:  "notStarted",
  in_progress:  "inProgress",
  completed:    "completed",
  running_late: "runningLate",
  delayed:      "delayed",
};

function mapStatus(raw: string | null): ProjectStatus | null {
  if (!raw) return null;
  return STATUS_MAP[raw] ?? null;
}

// ---------------------------------------------------------------------------
// Payload shape from backend emitTaskUpdate()
// ---------------------------------------------------------------------------
interface TaskUpdatePayload {
  taskId: string;
  projectId: string;
  percentComplete: number | null;
  status: string | null;
  area: string | null;
  contractor: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface ScheduleGeneratedPayload {
  projectId: string;
  versionNumber: number;
  scheduleVersionId: string;
  taskCount: number;
}

interface InfraParamsReadyPayload {
  jobId:            string;
  projectId:        string;
  versionNumber:    number;
  constructionType: string;
  missingData:      string[];
  confidence:       "high" | "medium" | "low";
}

interface UseTaskSocketOptions {
  /** UUID of the project to subscribe to. Pass null/undefined to disable. */
  projectId: string | null | undefined;
  /** UUID of the workspace — also joins workspace room for schedule:generated events. */
  workspaceId?: string | null | undefined;
  /** React setState dispatch for the tasks array. Optional — omit if only subscribing to schedule events. */
  setTasks?: React.Dispatch<React.SetStateAction<ScheduleTask[]>>;
  /** Called when a new schedule version is generated for this project */
  onScheduleGenerated?: (payload: ScheduleGeneratedPayload) => void;
  /** Called when infra parameters are extracted and ready for PM review */
  onInfraParamsReady?: (payload: InfraParamsReadyPayload) => void;
}

export function useTaskSocket({ projectId, workspaceId, setTasks, onScheduleGenerated, onInfraParamsReady }: UseTaskSocketOptions): void {
  const socketRef = useRef<Socket | null>(null);
  const { data: session } = authClient.useSession();
  const token = (session as any)?.session?.token as string | undefined;

  useEffect(() => {
    // Guard: need a valid UUID project ID and an authenticated session
    if (!projectId || !UUID_REGEX.test(projectId)) return;
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.warn("[useTaskSocket] NEXT_PUBLIC_BACKEND_URL is not set");
      return;
    }

    // Connect with Bearer token in handshake auth
    const socket: Socket = io(backendUrl, {
      auth: { token: `Bearer ${token}` },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:project", projectId);
      if (workspaceId && UUID_REGEX.test(workspaceId)) {
        socket.emit("join:workspace", workspaceId);
      }
    });

    socket.on("joined", ({ projectId: joinedId }: { projectId: string }) => {
      console.log(`[useTaskSocket] Subscribed to project:${joinedId}`);
    });

    socket.on("joined:workspace", ({ workspaceId: wid }: { workspaceId: string }) => {
      console.log(`[useTaskSocket] Subscribed to workspace:${wid}`);
    });

    socket.on("task:updated", (payload: TaskUpdatePayload) => {
      if (!setTasks) return;
      const mappedStatus = mapStatus(payload.status);
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== payload.taskId) return task;
          return {
            ...task,
            ...(payload.percentComplete !== null && { pct: payload.percentComplete }),
            ...(mappedStatus !== null && { status: mappedStatus }),
            ...(payload.area !== null && { space: payload.area }),
            ...(payload.contractor !== null && { contractor: payload.contractor }),
          };
        })
      );
    });

    socket.on("schedule:generated", (payload: ScheduleGeneratedPayload) => {
      if (payload.projectId === projectId) {
        onScheduleGenerated?.(payload);
      }
    });

    socket.on("infra_params_ready", (payload: InfraParamsReadyPayload) => {
      if (payload.projectId === projectId) {
        onInfraParamsReady?.(payload);
      }
    });

    socket.on("error", (msg: string) => {
      console.warn("[useTaskSocket] Socket error:", msg);
      socket.disconnect();
    });

    socket.on("disconnect", (reason) => {
      console.log("[useTaskSocket] Disconnected:", reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, workspaceId, token, setTasks, onScheduleGenerated, onInfraParamsReady]);
}
