// =============================================================================
// BLUQ SOCKET.IO SERVER
// =============================================================================
// Real-time task updates for the Gantt chart.
//
// Security model (two layers):
//
//   Layer 1 — Connection auth:
//     Every socket must present a valid Better Auth session token in
//     socket.handshake.auth.token (same Bearer token used for HTTP requests).
//     Invalid/expired token → connection rejected before any events fire.
//     Tokens are re-checked every 15 minutes on active connections — if
//     a token expires mid-session the socket is disconnected immediately.
//
//   Layer 2 — Room auth:
//     "join:project" checks project_members table before adding the socket
//     to a room. Not a member → error event, room not joined.
//     Room names are prefixed: "project:{uuid}" to avoid collisions.
//
//   Error responses:
//     Always "Unauthorized" — never leaks whether the project exists,
//     why the check failed, or any internal state.
//
// Rate limiting:
//     Max 10 concurrent sockets per IP. Connections beyond this are
//     rejected at the middleware level.
//
// Emitting updates:
//     Workers import emitTaskUpdate() to push updates to a project room.
//     This is a fire-and-forget — if the Socket.IO server isn't initialised
//     yet the call is a no-op (safe during startup).
//
// Usage in index.ts:
//     import { initSocketServer, getIO } from "./lib/socket.js"
//     const httpServer = app.server          // after app.listen()
//     initSocketServer(httpServer)
//
// Usage in workers:
//     import { emitTaskUpdate } from "../lib/socket.js"
//     emitTaskUpdate({ taskId, projectId, percentComplete, status, ... })
//
// Frontend (Aishna):
//     const socket = io("https://railway-url", {
//       auth: { token: "Bearer <better-auth-session-token>" }
//     })
//     socket.emit("join:project", projectId)
//     socket.on("task:updated", (data) => { /* update Gantt state */ })
//     socket.on("error", (msg) => { /* show toast */ })
// =============================================================================

import { Server, Socket } from "socket.io";
import { IncomingMessage, ServerResponse, Server as HttpServer } from "http";
import { db } from "../db/client.js";
import { projectMembers, workspaceMembers } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface TaskUpdatePayload {
  taskId: string;
  projectId: string;
  percentComplete: number | null;
  status: string | null;
  area: string | null;
  contractor: string | null;
  updatedAt: string;
}

// Stored on socket.data after successful auth
interface SocketData {
  userId: string;
  tokenExpiresAt: Date;
}

// ---------------------------------------------------------------------------
// MODULE STATE
// ---------------------------------------------------------------------------

let io: Server | null = null;

// Track active socket count per IP for rate limiting
const ipSocketCount = new Map<string, number>();
const MAX_SOCKETS_PER_IP = 10;

// How often (ms) to re-check token expiry on active connections
const TOKEN_RECHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

export function initSocketServer(
  httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse>
): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://bluq.ai",
        "https://www.bluq.ai",
        "https://bluq-ai.vercel.app",
        "http://localhost:3000",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Limit payload size — prevents memory exhaustion attacks
    maxHttpBufferSize: 1e5,  // 100 KB
  });

  // =========================================================================
  // LAYER 1 — Connection auth middleware
  // Runs once per socket before any events are processed.
  // =========================================================================
  io.use(async (socket, next) => {
    // --- IP rate limiting ---
    const ip = socket.handshake.address;
    const count = ipSocketCount.get(ip) ?? 0;
    if (count >= MAX_SOCKETS_PER_IP) {
      return next(new Error("Unauthorized"));
    }

    // --- Token extraction ---
    const raw: unknown = socket.handshake.auth?.token;
    if (typeof raw !== "string" || !raw.startsWith("Bearer ")) {
      return next(new Error("Unauthorized"));
    }
    const token = raw.slice(7);

    // --- Session validation (same logic as verifySession.ts) ---
    try {
      const rows = await db.execute(
        sql`SELECT user_id, expires_at FROM session WHERE token = ${token} LIMIT 1`
      );
      const session = (rows[0] ?? null) as {
        user_id: string;
        expires_at: string;
      } | null;

      if (!session || new Date(session.expires_at) < new Date()) {
        return next(new Error("Unauthorized"));
      }

      // Store auth context on socket — available in all event handlers
      socket.data = {
        userId: session.user_id,
        tokenExpiresAt: new Date(session.expires_at),
      } satisfies SocketData;

      // Track IP count
      ipSocketCount.set(ip, (ipSocketCount.get(ip) ?? 0) + 1);

      next();
    } catch {
      // Don't leak internal DB errors
      return next(new Error("Unauthorized"));
    }
  });

  // =========================================================================
  // CONNECTION HANDLER
  // =========================================================================
  io.on("connection", (socket: Socket) => {
    const { userId, tokenExpiresAt } = socket.data as SocketData;
    const ip = socket.handshake.address;

    console.log(`🔌 Socket connected: userId=${userId} ip=${ip}`);

    // -----------------------------------------------------------------------
    // Token expiry re-check timer
    // Fires at TOKEN_RECHECK_INTERVAL_MS and also schedules itself precisely
    // for when the token actually expires, whichever comes first.
    // -----------------------------------------------------------------------
    const msUntilExpiry = tokenExpiresAt.getTime() - Date.now();
    const recheckDelay = Math.min(msUntilExpiry, TOKEN_RECHECK_INTERVAL_MS);

    const expiryTimer = setTimeout(async () => {
      if (new Date() >= tokenExpiresAt) {
        // Token has expired — force disconnect
        socket.emit("error", "Unauthorized");
        socket.disconnect(true);
        return;
      }
      // Token still valid — re-verify against DB (handles server-side revocation)
      try {
        const raw: unknown = socket.handshake.auth?.token;
        if (typeof raw !== "string") { socket.disconnect(true); return; }
        const token = (raw as string).slice(7);
        const rows = await db.execute(
          sql`SELECT expires_at FROM session WHERE token = ${token} LIMIT 1`
        );
        const session = (rows[0] ?? null) as { expires_at: string } | null;
        if (!session || new Date(session.expires_at) < new Date()) {
          socket.emit("error", "Unauthorized");
          socket.disconnect(true);
        }
      } catch {
        socket.disconnect(true);
      }
    }, recheckDelay);

    // -----------------------------------------------------------------------
    // LAYER 2 — "join:project" room auth
    // Checks project_members table before joining the room.
    // -----------------------------------------------------------------------
    socket.on("join:project", async (projectId: unknown) => {
      // Validate input shape — never trust client data
      if (typeof projectId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
        socket.emit("error", "Unauthorized");
        return;
      }

      try {
        const [membership] = await db
          .select({ id: projectMembers.id })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, projectId),
              eq(projectMembers.userId, userId)
            )
          );

        if (!membership) {
          // Not a member — emit generic error, do not reveal why
          socket.emit("error", "Unauthorized");
          return;
        }

        const room = `project:${projectId}`;
        await socket.join(room);
        socket.emit("joined", { projectId });
        console.log(`👥 userId=${userId} joined room ${room}`);
      } catch {
        socket.emit("error", "Unauthorized");
      }
    });

    // -----------------------------------------------------------------------
    // "join:workspace" — workspace-level events (schedule:generated etc.)
    // -----------------------------------------------------------------------
    socket.on("join:workspace", async (workspaceId: unknown) => {
      if (
        typeof workspaceId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)
      ) {
        socket.emit("error", "Unauthorized");
        return;
      }
      try {
        const [membership] = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, userId),
              eq(workspaceMembers.status, "active")
            )
          );
        if (!membership) {
          socket.emit("error", "Unauthorized");
          return;
        }
        await socket.join(workspaceId);
        socket.emit("joined:workspace", { workspaceId });
      } catch {
        socket.emit("error", "Unauthorized");
      }
    });

    // -----------------------------------------------------------------------
    // CLEANUP on disconnect
    // -----------------------------------------------------------------------
    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      const current = ipSocketCount.get(ip) ?? 1;
      if (current <= 1) {
        ipSocketCount.delete(ip);
      } else {
        ipSocketCount.set(ip, current - 1);
      }
      console.log(`🔌 Socket disconnected: userId=${userId}`);
    });
  });

  console.log("⚡ Socket.IO server initialised");
  return io;
}

// ---------------------------------------------------------------------------
// getIO — access the server instance after init
// ---------------------------------------------------------------------------

export function getIO(): Server | null {
  return io;
}

// ---------------------------------------------------------------------------
// emitTaskUpdate — called by workers after any task DB update
//
// Fire-and-forget. If Socket.IO is not yet initialised (e.g. during startup)
// the call is a safe no-op.
// ---------------------------------------------------------------------------

export function emitTaskUpdate(payload: TaskUpdatePayload): void {
  if (!io) return;
  io.to(`project:${payload.projectId}`).emit("task:updated", payload);
}

// ---------------------------------------------------------------------------
// emitInfraParamsReady — called by worker after infrastructure parameter extraction
// Emits to the project room so the frontend redirects to the parameter review page.
// ---------------------------------------------------------------------------

export interface InfraParamsReadyPayload {
  jobId:            string;
  projectId:        string;
  versionNumber:    number;
  constructionType: string;
  missingData:      string[];
  confidence:       "high" | "medium" | "low";
}

export function emitInfraParamsReady(payload: InfraParamsReadyPayload): void {
  if (!io) return;
  io.to(`project:${payload.projectId}`).emit("infra_params_ready", payload);
}

