import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { tasks, taskDependencies, projects } from "../db/schema.js";
import { eq, and, ne, lte, gte } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";
import { detectPhase } from "../lib/detect-phase.js";

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
// Status auto-calculation (project-relative)
// ---------------------------------------------------------------------------

/**
 * Derives task status from project timeline and task progress.
 *
 * Rule 1: pct >= 100                                      → 'completed'
 * Rule 2: tStart > pEnd AND tEnd > pEnd                   → 'delayed'
 * Rule 3: tStart in [pStart..pEnd] AND tEnd > pEnd        → 'running_late'
 *
 * Returns null when none of the rules match (caller keeps its own value).
 * All date params are "YYYY-MM-DD" strings — ISO lexicographic comparison is safe.
 */
function computeAutoStatus(
  percentComplete: number | string | null | undefined,
  taskStartDate: string | null | undefined,
  taskEndDate: string | null | undefined,
  projectStartDate: string | null | undefined,
  projectEndDate: string | null | undefined,
): "completed" | "delayed" | "running_late" | null {
  const pct = Number(percentComplete ?? 0);
  if (pct >= 100) return "completed";

  if (!taskStartDate || !taskEndDate || !projectStartDate || !projectEndDate) return null;

  // Rule 2: both task dates fall entirely after project end
  if (taskStartDate > projectEndDate && taskEndDate > projectEndDate) return "delayed";

  // Rule 3: task starts within project window but overruns project end
  if (taskStartDate >= projectStartDate && taskStartDate <= projectEndDate && taskEndDate > projectEndDate) {
    return "running_late";
  }

  return null;
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
        phase?: string;
        isMilestone?: boolean;
        parentTaskId?: string;
        sortOrder?: number;
      };
      if (!body.workspaceId || !body.projectId || !body.title) return reply.status(400).send({ error: "workspaceId, projectId, title required" });
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
      }
      if (!body.phase) body.phase = detectPhase(body.title) ?? undefined;

      // Fetch parent project to compute project-relative status
      const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId));
      const autoStatus = computeAutoStatus(
        (body as any).percentComplete,
        body.startDate,
        body.endDate,
        project?.startDate,
        project?.endDate,
      );
      if (autoStatus) body.status = autoStatus;

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

      // Fetch existing task to fill in fields absent from the partial update
      const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!existing) return reply.status(404).send({ error: "Task not found" });

      const effectivePct      = body.percentComplete !== undefined ? body.percentComplete : existing.percentComplete;
      const effectiveStart    = body.startDate  !== undefined ? body.startDate  : existing.startDate;
      const effectiveEnd      = body.endDate    !== undefined ? body.endDate    : existing.endDate;
      const projectId         = body.projectId  !== undefined ? body.projectId  : existing.projectId;

      // Fetch parent project for project-relative status rules
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      const autoStatus = computeAutoStatus(
        effectivePct,
        effectiveStart,
        effectiveEnd,
        project?.startDate,
        project?.endDate,
      );
      if (autoStatus) body.status = autoStatus;

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

  // =========================================================================
  // GET /tasks/dependencies?projectId=&workspaceId=
  // Returns all dependency rows for tasks belonging to the project.
  // =========================================================================
  app.get("/tasks/dependencies", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
      if (!UUID_REGEX.test(workspaceId) || !UUID_REGEX.test(projectId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }
      const data = await db
        .select({
          id: taskDependencies.id,
          predecessorId: taskDependencies.predecessorId,
          successorId: taskDependencies.successorId,
          dependencyType: taskDependencies.dependencyType,
          lagDays: taskDependencies.lagDays,
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.successorId, tasks.id))
        .where(and(eq(tasks.projectId, projectId), eq(taskDependencies.workspaceId, workspaceId)));
      return data;
    } catch (err: any) {
      console.error("GET /tasks/dependencies error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch dependencies", details: err.message });
    }
  });

  // =========================================================================
  // POST /tasks/dependencies
  // Body: { workspaceId, predecessorId, successorId, dependencyType?, lagDays? }
  // =========================================================================
  app.post("/tasks/dependencies", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId: string;
        predecessorId: string;
        successorId: string;
        dependencyType?: string;
        lagDays?: number;
      };
      if (!body.workspaceId || !body.predecessorId || !body.successorId) {
        return reply.status(400).send({ error: "workspaceId, predecessorId, successorId required" });
      }
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.predecessorId) || !UUID_REGEX.test(body.successorId)) {
        return reply.status(400).send({ error: "IDs must be valid UUIDs" });
      }
      const [dep] = await db
        .insert(taskDependencies)
        .values({
          workspaceId: body.workspaceId,
          predecessorId: body.predecessorId,
          successorId: body.successorId,
          dependencyType: body.dependencyType ?? "FS",
          lagDays: body.lagDays ?? 0,
        })
        .onConflictDoNothing()
        .returning();
      return reply.status(201).send(dep ?? { message: "dependency already exists" });
    } catch (err: any) {
      console.error("POST /tasks/dependencies error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to create dependency", details: err.message });
    }
  });

  // =========================================================================
  // DELETE /tasks/dependencies/:id
  // =========================================================================
  app.delete("/tasks/dependencies/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(400).send({ error: "id must be a valid UUID" });
      await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
      return { success: true };
    } catch (err: any) {
      console.error("DELETE /tasks/dependencies error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to delete dependency", details: err.message });
    }
  });
}
