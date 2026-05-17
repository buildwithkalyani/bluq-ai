// =============================================================================
// SCHEDULE ROUTE
// =============================================================================
// Endpoints for AI schedule generation, status tracking, and versioning.
//
// Flow:
//   POST /schedule/generate       → adds job to queue, returns jobId
//   GET  /schedule/status/:jobId  → frontend polls this for progress
//   GET  /schedule/versions       → list all versions for a project
//   GET  /schedule/versions/:id   → get full schedule JSON for a version
//   POST /schedule/baseline       → lock a version as baseline
//
// The actual work happens in the worker (ai-scheduler.worker.ts).
// This route just manages the queue and reads results from the database.
// =============================================================================

import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { scheduleVersions, documents, tasks, gapCheckFeedback, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { aiSchedulerQueue } from "../lib/queues.js";
import type { ScheduleJobData } from "../workers/ai-scheduler.worker.js";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function scheduleRoute(app: FastifyInstance) {

  // =========================================================================
  // POST /schedule/generate — trigger schedule generation
  // =========================================================================
  app.post("/schedule/generate", async (request, reply) => {
    try {
      const body = request.body as {
        projectId: string;
        workspaceId: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
        regionCode?: string;
        city?: string;
        buildingType?: string;
        extractionRuns?: number;
      };

      // Validate required fields
      if (!body.projectId || !body.workspaceId) {
        return reply.status(400).send({
          error: "projectId and workspaceId are required",
        });
      }
      if (!UUID_REGEX.test(body.projectId) || !UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({
          error: "projectId and workspaceId must be valid UUIDs",
        });
      }

      // Check that the project has at least one document uploaded
      const projectDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.projectId, body.projectId),
            eq(documents.workspaceId, body.workspaceId)
          )
        );

      if (projectDocs.length === 0) {
        return reply.status(400).send({
          error: "No documents uploaded",
          suggestion: "Please upload at least one document (drawings PDF, scope of work, or BOQ) before generating a schedule.",
        });
      }

      // Validate dates if provided
      if (body.startDate && isNaN(Date.parse(body.startDate))) {
        return reply.status(400).send({ error: "startDate must be a valid ISO date (YYYY-MM-DD)" });
      }
      if (body.endDate && isNaN(Date.parse(body.endDate))) {
        return reply.status(400).send({ error: "endDate must be a valid ISO date (YYYY-MM-DD)" });
      }
      if (body.startDate && body.endDate && new Date(body.endDate) <= new Date(body.startDate)) {
        return reply.status(400).send({ error: "endDate must be after startDate" });
      }

      // Add job to the ai-scheduler queue
      const jobData: ScheduleJobData = {
        projectId: body.projectId,
        workspaceId: body.workspaceId,
        userId: body.userId || "system",
        startDate: body.startDate,
        endDate: body.endDate,
        regionCode: body.regionCode,
        city: body.city,
        buildingType: body.buildingType,
        extractionRuns: body.extractionRuns || 1,
      };

      const job = await aiSchedulerQueue.add("generate-schedule", jobData, {
        attempts: 2,                    // retry once on failure
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });

      return reply.status(202).send({
        success: true,
        jobId: job.id,
        status: "queued",
        message: "Schedule generation started. Poll /schedule/status/:jobId for progress.",
        documentsFound: projectDocs.length,
      });
    } catch (err: any) {
      console.error("POST /schedule/generate error:", err.message);
      return reply.status(500).send({ error: "Failed to start schedule generation" });
    }
  });

  // =========================================================================
  // GET /schedule/status/:jobId — poll for job progress
  // =========================================================================
  app.get("/schedule/status/:jobId", async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      if (!jobId) {
        return reply.status(400).send({ error: "jobId is required" });
      }

      const job = await aiSchedulerQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          error: "Job not found",
          suggestion: "The job may have expired. Please try generating the schedule again.",
        });
      }

      const state = await job.getState();

      // Build response based on job state
      switch (state) {
        case "waiting":
        case "delayed":
          return {
            jobId,
            status: "queued",
            message: "Your schedule is in the queue. Processing will start shortly.",
            progress: { step: 0, totalSteps: 7, percentage: 0, status: "Waiting..." },
          };

        case "active": {
          const progress = job.progress as any || {};
          return {
            jobId,
            status: "processing",
            message: progress.status || "Processing...",
            progress: {
              step: progress.step || 0,
              totalSteps: progress.totalSteps || 7,
              percentage: progress.percentage || 0,
              status: progress.status || "Processing...",
            },
          };
        }

        case "completed": {
          const result = job.returnvalue as any;
          return {
            jobId,
            status: "completed",
            message: "Schedule generated successfully!",
            result: {
              scheduleVersionId: result?.scheduleVersionId,
              taskCount: result?.taskCount,
              durationDays: result?.durationDays,
            },
          };
        }

        case "failed": {
          const failedReason = job.failedReason || "Unknown error";
          return {
            jobId,
            status: "failed",
            message: "Schedule generation failed.",
            error: failedReason,
            suggestion: failedReason.includes("No documents")
              ? "Please upload project documents before generating."
              : "Please try again. If the problem persists, contact support.",
          };
        }

        default:
          return {
            jobId,
            status: state,
            message: `Job is in state: ${state}`,
          };
      }
    } catch (err: any) {
      console.error("GET /schedule/status error:", err.message);
      return reply.status(500).send({ error: "Failed to check job status" });
    }
  });

  // =========================================================================
  // GET /schedule/versions — list all schedule versions for a project
  // =========================================================================
  app.get("/schedule/versions", async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as {
        projectId: string;
        workspaceId: string;
      };

      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const rows = await db
        .select({
          id: scheduleVersions.id,
          versionNumber: scheduleVersions.versionNumber,
          isBaseline: scheduleVersions.isBaseline,
          isLocked: scheduleVersions.isLocked,
          generatedBy: scheduleVersions.generatedBy,
          uploadedBy: scheduleVersions.uploadedBy,
          uploadedByName: users.name,
          sourceFileName: scheduleVersions.sourceFileName,
          aiReasoning: scheduleVersions.aiReasoning,
          aiRisks: scheduleVersions.aiRisks,
          createdAt: scheduleVersions.createdAt,
        })
        .from(scheduleVersions)
        .leftJoin(users, eq(users.id, scheduleVersions.uploadedBy))
        .where(
          and(
            eq(scheduleVersions.projectId, projectId),
            eq(scheduleVersions.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(scheduleVersions.versionNumber));

      return rows;
    } catch (err: any) {
      console.error("GET /schedule/versions error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch schedule versions" });
    }
  });

  // =========================================================================
  // GET /schedule/versions/:id — get full schedule JSON for a version
  // =========================================================================
  app.get("/schedule/versions/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }

      const [version] = await db
        .select()
        .from(scheduleVersions)
        .where(eq(scheduleVersions.id, id));

      if (!version) {
        return reply.status(404).send({ error: "Schedule version not found" });
      }

      return version;
    } catch (err: any) {
      console.error("GET /schedule/versions/:id error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch schedule version" });
    }
  });

  // =========================================================================
  // POST /schedule/gap-check/accept — PMC accepts or dismisses a gap check item
  // =========================================================================
  app.post("/schedule/gap-check/accept", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        scheduleVersionId: string;
        workspaceId: string;
        projectId: string;
        taskName: string;
        phase: string;
        reason: string;
        dismissed: boolean;
      };

      // --- Validate required fields ---
      if (!body.scheduleVersionId || !body.workspaceId || !body.projectId) {
        return reply.status(400).send({
          error: "scheduleVersionId, workspaceId, and projectId are required",
        });
      }
      if (
        !UUID_REGEX.test(body.scheduleVersionId) ||
        !UUID_REGEX.test(body.workspaceId) ||
        !UUID_REGEX.test(body.projectId)
      ) {
        return reply.status(400).send({ error: "scheduleVersionId, workspaceId, and projectId must be valid UUIDs" });
      }
      if (!body.taskName || typeof body.taskName !== "string" || body.taskName.trim() === "") {
        return reply.status(400).send({ error: "taskName is required" });
      }
      if (!body.phase || typeof body.phase !== "string" || body.phase.trim() === "") {
        return reply.status(400).send({ error: "phase is required" });
      }
      if (typeof body.dismissed !== "boolean") {
        return reply.status(400).send({ error: "dismissed must be a boolean" });
      }

      const action = body.dismissed ? "dismissed" : "accepted";

      // --- Dismissed path: just log and return ---
      if (body.dismissed) {
        await db.insert(gapCheckFeedback).values({
          scheduleVersionId: body.scheduleVersionId,
          workspaceId: body.workspaceId,
          projectId: body.projectId,
          taskName: body.taskName.trim(),
          phase: body.phase.trim(),
          reason: body.reason ?? null,
          action: "dismissed",
        });

        return reply.send({ success: true, action: "dismissed" });
      }

      // --- Accepted path: place the task in the schedule ---

      // Fetch the schedule version (verify it belongs to this workspace+project)
      const [version] = await db
        .select()
        .from(scheduleVersions)
        .where(
          and(
            eq(scheduleVersions.id, body.scheduleVersionId),
            eq(scheduleVersions.workspaceId, body.workspaceId),
            eq(scheduleVersions.projectId, body.projectId)
          )
        );

      if (!version) {
        return reply.status(404).send({ error: "Schedule version not found" });
      }

      // Pull existing tasks out of the schedule JSON
      const scheduleJson = version.scheduleJson as { tasks: Array<{
        phase: string;
        endDate: string;
        startDate: string;
        [key: string]: unknown;
      }> };

      const existingTasks = Array.isArray(scheduleJson?.tasks) ? scheduleJson.tasks : [];

      // Find latest endDate among tasks in the target phase
      const phaseLower = body.phase.trim().toLowerCase();
      const phaseTasks = existingTasks.filter(
        t => (t.phase ?? "").toLowerCase() === phaseLower
      );

      if (phaseTasks.length === 0) {
        return reply.status(422).send({
          error: `Phase ${body.phase} has no tasks in this schedule. Cannot auto-place. Please add manually.`,
        });
      }

      const latestEndDate = phaseTasks
        .map(t => t.endDate ?? "")
        .filter(Boolean)
        .sort()
        .at(-1)!;

      // Compute placement dates
      const startDate = addOneDayIso(latestEndDate);
      const endDate = addDaysIso(startDate, 7);
      const taskCode = `GC-${Date.now()}`;

      const newTask = {
        code: taskCode,
        originalCode: taskCode,
        phase: body.phase.trim(),
        name: body.taskName.trim(),
        fullName: body.taskName.trim(),
        unit: "LS",
        estimatedQuantity: 1,
        quantityUnit: "LS",
        baseDurationDays: 7,
        adjustedDurationDays: 7,
        finalDurationDays: 7,
        startDate,
        endDate,
        predecessors: [],
        crew: [{ role: "Specialist", count: 1 }],
        monsoonImpactFactor: 1.0,
        monsoonOverlapDays: 0,
        monsoonAdjustedDays: 0,
        earliestStart: 0,
        earliestFinish: 7,
        isCriticalPath: false,
        totalFloat: 999,
        source: "gap_check_accepted",
        isPerFloor: false,
        isPerFlat: false,
        contractorType: "Civil",
        regionalAdjustments: {
          labourCostIndex: 1.0,
          materialCostIndex: 1.0,
          productivityIndex: 1.0,
          monsoonMifMultiplier: 1.0,
        },
      };

      // Insert into tasks table
      const [insertedTask] = await db
        .insert(tasks)
        .values({
          workspaceId: body.workspaceId,
          projectId: body.projectId,
          title: newTask.name,
          description: `Gap check accepted | Phase: ${newTask.phase} | Reason: ${body.reason ?? ""}`,
          status: "not_started",
          priority: "medium",
          startDate: newTask.startDate,
          endDate: newTask.endDate,
          durationDays: newTask.finalDurationDays,
          contractor: newTask.contractorType,
          isMilestone: false,
          sortOrder: existingTasks.length,
        })
        .returning({ id: tasks.id });

      // Append the new task to scheduleJson.tasks and update the version row
      const updatedTasks = [...existingTasks, newTask];
      await db
        .update(scheduleVersions)
        .set({
          scheduleJson: { ...scheduleJson, tasks: updatedTasks },
        })
        .where(eq(scheduleVersions.id, body.scheduleVersionId));

      // Log to gap_check_feedback
      await db.insert(gapCheckFeedback).values({
        scheduleVersionId: body.scheduleVersionId,
        workspaceId: body.workspaceId,
        projectId: body.projectId,
        taskName: body.taskName.trim(),
        phase: body.phase.trim(),
        reason: body.reason ?? null,
        action: "accepted",
      });

      return reply.send({
        success: true,
        action: "accepted",
        task: { ...newTask, id: insertedTask.id },
      });
    } catch (err: any) {
      console.error("POST /schedule/gap-check/accept error:", err.message);
      return reply.status(500).send({ error: "Failed to process gap check action" });
    }
  });

  // =========================================================================
  // POST /schedule/versions — create a manual schedule version (baseline)
  // =========================================================================
  app.post("/schedule/versions", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as { projectId: string; workspaceId: string };
      const userId = request.userId;

      if (!body.projectId || !body.workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId are required" });
      }
      if (!UUID_REGEX.test(body.projectId) || !UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      // Next version number
      const existing = await db
        .select({ vn: scheduleVersions.versionNumber })
        .from(scheduleVersions)
        .where(and(eq(scheduleVersions.projectId, body.projectId), eq(scheduleVersions.workspaceId, body.workspaceId)))
        .orderBy(desc(scheduleVersions.versionNumber))
        .limit(1);
      const nextVersion = (existing[0]?.vn ?? 0) + 1;

      // Demote all previous baselines for this project
      await db
        .update(scheduleVersions)
        .set({ isBaseline: false })
        .where(and(eq(scheduleVersions.projectId, body.projectId), eq(scheduleVersions.workspaceId, body.workspaceId)));

      const [created] = await db
        .insert(scheduleVersions)
        .values({
          projectId: body.projectId,
          workspaceId: body.workspaceId,
          versionNumber: nextVersion,
          isBaseline: true,
          isLocked: false,
          generatedBy: "manual",
          uploadedBy: userId,
          scheduleJson: {},
        })
        .returning();

      // Re-fetch with user name join to match the shape GET /schedule/versions returns
      const [row] = await db
        .select({
          id: scheduleVersions.id,
          versionNumber: scheduleVersions.versionNumber,
          isBaseline: scheduleVersions.isBaseline,
          isLocked: scheduleVersions.isLocked,
          generatedBy: scheduleVersions.generatedBy,
          uploadedBy: scheduleVersions.uploadedBy,
          uploadedByName: users.name,
          sourceFileName: scheduleVersions.sourceFileName,
          aiReasoning: scheduleVersions.aiReasoning,
          createdAt: scheduleVersions.createdAt,
        })
        .from(scheduleVersions)
        .leftJoin(users, eq(users.id, scheduleVersions.uploadedBy))
        .where(eq(scheduleVersions.id, created.id));

      return reply.status(201).send(row);
    } catch (err: any) {
      console.error("POST /schedule/versions error:", err.message);
      return reply.status(500).send({ error: "Failed to create schedule version" });
    }
  });

  // POST /schedule/baseline — lock a version as baseline
  // =========================================================================
  app.post("/schedule/baseline", async (request, reply) => {
    try {
      const body = request.body as {
        scheduleVersionId: string;
        workspaceId: string;
      };

      if (!body.scheduleVersionId || !body.workspaceId) {
        return reply.status(400).send({
          error: "scheduleVersionId and workspaceId are required",
        });
      }
      if (!UUID_REGEX.test(body.scheduleVersionId) || !UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({
          error: "scheduleVersionId and workspaceId must be valid UUIDs",
        });
      }

      // Verify the version exists and belongs to this workspace
      const [version] = await db
        .select()
        .from(scheduleVersions)
        .where(
          and(
            eq(scheduleVersions.id, body.scheduleVersionId),
            eq(scheduleVersions.workspaceId, body.workspaceId)
          )
        );

      if (!version) {
        return reply.status(404).send({ error: "Schedule version not found" });
      }

      if (version.isLocked) {
        return reply.status(400).send({
          error: "This version is already locked as a baseline.",
          suggestion: "Generate a new schedule version if you need to make changes.",
        });
      }

      // Lock as baseline
      const [updated] = await db
        .update(scheduleVersions)
        .set({
          isBaseline: true,
          isLocked: true,
        })
        .where(eq(scheduleVersions.id, body.scheduleVersionId))
        .returning();

      return {
        success: true,
        message: `Version ${updated.versionNumber} locked as Baseline.`,
        version: {
          id: updated.id,
          versionNumber: updated.versionNumber,
          isBaseline: updated.isBaseline,
          isLocked: updated.isLocked,
        },
      };
    } catch (err: any) {
      console.error("POST /schedule/baseline error:", err.message);
      return reply.status(500).send({ error: "Failed to set baseline" });
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addOneDayIso(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
