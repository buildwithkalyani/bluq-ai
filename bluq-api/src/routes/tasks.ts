import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { tasks } from "../db/schema.js";
import { eq, and, ne, lte, gte } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// IST date helpers
// ---------------------------------------------------------------------------

/** Returns today's date as "YYYY-MM-DD" in IST (UTC+5:30). */
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Returns yesterday's date as "YYYY-MM-DD" in IST. */
function yesterdayIST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Returns a date N days from today as "YYYY-MM-DD" in IST. */
function futureDateIST(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ---------------------------------------------------------------------------

export async function tasksRoute(app: FastifyInstance) {

  // =========================================================================
  // GET /tasks — all tasks for a project
  // =========================================================================
  app.get("/tasks", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
      if (!UUID_REGEX.test(workspaceId) || !UUID_REGEX.test(projectId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }
      const data = await db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.workspaceId, workspaceId)));
      return data;
    } catch (err: any) {
      console.error("GET /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch tasks", details: err.message });
    }
  });

  // =========================================================================
  // GET /tasks/done-yesterday — tasks completed yesterday (IST)
  //
  // Returns tasks where:
  //   status = completed AND actualEnd = yesterday (IST date)
  //
  // Used by: Daily Updates page — "Done Yesterday" column
  // =========================================================================
  app.get("/tasks/done-yesterday", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const yesterday = yesterdayIST();

      const data = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.workspaceId, workspaceId),
            eq(tasks.status, "completed"),
            eq(tasks.actualEnd, yesterday)
          )
        );

      return { date: yesterday, count: data.length, tasks: data };
    } catch (err: any) {
      console.error("GET /tasks/done-yesterday error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch completed tasks", details: err.message });
    }
  });

  // =========================================================================
  // GET /tasks/todo-today — tasks that need action today (IST)
  //
  // Returns tasks where:
  //   startDate <= today AND status != completed
  //
  // This deliberately includes overdue tasks (endDate already passed but
  // not yet marked complete) — a PM needs to see and act on those too.
  //
  // Used by: Daily Updates page — "To Do Today" column
  // =========================================================================
  app.get("/tasks/todo-today", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const today = todayIST();

      const data = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.workspaceId, workspaceId),
            ne(tasks.status, "completed"),
            lte(tasks.startDate, today)
          )
        );

      // Split into in-progress vs not started vs overdue for the frontend
      const inProgress = data.filter((t) => t.status === "in_progress");
      const overdue = data.filter(
        (t) =>
          (t.status === "not_started" || t.status === "delayed" || t.status === "running_late") &&
          t.endDate != null &&
          t.endDate < today
      );
      const notStarted = data.filter(
        (t) =>
          t.status === "not_started" &&
          (t.endDate == null || t.endDate >= today)
      );

      return {
        date: today,
        count: data.length,
        inProgress,
        overdue,
        notStarted,
        // also expose flat list so frontend can choose how to render
        tasks: data,
      };
    } catch (err: any) {
      console.error("GET /tasks/todo-today error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch today's tasks", details: err.message });
    }
  });

  // =========================================================================
  // GET /tasks/milestones — upcoming milestones within N days (IST)
  //
  // Query params:
  //   projectId, workspaceId — required
  //   days                   — optional, defaults to 30 (frontend uses 7/15/30)
  //
  // Returns tasks where:
  //   isMilestone = true AND endDate BETWEEN today AND today+N
  //
  // Used by: Daily Updates page — "Upcoming Milestones" card
  // =========================================================================
  app.get("/tasks/milestones", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId, days: daysStr } = request.query as {
        projectId: string;
        workspaceId: string;
        days?: string;
      };

      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const days = daysStr ? parseInt(daysStr, 10) : 30;
      if (isNaN(days) || days < 1 || days > 365) {
        return reply.status(400).send({ error: "days must be a number between 1 and 365" });
      }

      const today = todayIST();
      const future = futureDateIST(days);

      const data = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.workspaceId, workspaceId),
            eq(tasks.isMilestone, true),
            gte(tasks.endDate, today),
            lte(tasks.endDate, future)
          )
        );

      // Sort by endDate ascending (nearest first)
      data.sort((a, b) => {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return a.endDate.localeCompare(b.endDate);
      });

      return { from: today, to: future, days, count: data.length, milestones: data };
    } catch (err: any) {
      console.error("GET /tasks/milestones error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch milestones", details: err.message });
    }
  });

  // =========================================================================
  // POST /tasks
  // =========================================================================
  app.post("/tasks", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId: string;
        projectId: string;
        title: string;
        description?: string;
        assignedTo?: string;
        status?: string;
        priority?: string;
        startDate?: string;
        endDate?: string;
        durationDays?: number;
        contractor?: string;
        area?: string;
        isMilestone?: boolean;
        parentTaskId?: string;
        sortOrder?: number;
      };
      if (!body.workspaceId || !body.projectId || !body.title) return reply.status(400).send({ error: "workspaceId, projectId, title required" });
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
      }
      const [newTask] = await db.insert(tasks).values(body).returning();
      return reply.status(201).send(newTask);
    } catch (err: any) {
      console.error("POST /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to create task", details: err.message });
    }
  });

  // =========================================================================
  // PATCH /tasks/:id
  // =========================================================================
  app.patch("/tasks/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, any>;
      const [updated] = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
      if (!updated) return reply.status(404).send({ error: "Task not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update task", details: err.message });
    }
  });

  // =========================================================================
  // DELETE /tasks/:id
  // =========================================================================
  app.delete("/tasks/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: "Task not found" });
      return { success: true };
    } catch (err: any) {
      console.error("DELETE /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to delete task", details: err.message });
    }
  });
}
