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
import { scheduleVersions, documents, tasks, gapCheckFeedback, users, pendingWorkPackages, projectMembers } from "../db/schema.js";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { aiSchedulerQueue } from "../lib/queues.js";
import type { ScheduleJobData } from "../workers/ai-scheduler.worker.js";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converts MSPDI ISO 8601 duration (e.g. "PT8H", "P5DT0H") to working days */
function parseMspDuration(iso: string): number {
  const days = iso.match(/(\d+(?:\.\d+)?)D/)?.[1];
  const hours = iso.match(/(\d+(?:\.\d+)?)H/)?.[1];
  const d = parseFloat(days ?? "0");
  const h = parseFloat(hours ?? "0");
  return Math.round(d + h / 8) || 1;
}

export async function scheduleRoute(app: FastifyInstance) {

  // =========================================================================
  // POST /schedule/generate — trigger schedule generation
  // =========================================================================
  app.post("/schedule/generate", { preHandler: verifySession }, async (request, reply) => {
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
        constructionType?: string;
        extractionRuns?: number;
        // Tunnel-specific overrides
        tunnelLength?:   string;
        tunnelDiameter?: string;
        tunnelMethod?:   string;
        // Railway / Metro overrides
        trackLength?:    string;
        stationCount?:   string;
        trackGauge?:     string;
        // Highway overrides
        roadLength?:     string;
        laneCount?:      string;
        pavementType?:   string;
        // Bridge overrides
        totalSpan?:      string;
        pierCount?:      string;
        deckType?:       string;
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

      // Check that the project has at least one document in the Schedules staging folder
      const projectDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.projectId, body.projectId),
            eq(documents.workspaceId, body.workspaceId),
            like(documents.folder, "Schedules%")
          )
        );

      if (projectDocs.length === 0) {
        return reply.status(400).send({
          error: "No documents in Schedules folder",
          suggestion: "Upload documents via the Schedule tab before generating. Documents in Drawings/Reports/BOQs folders are not used for schedule generation.",
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
        constructionType: body.constructionType,
        extractionRuns: body.extractionRuns || 1,
        tunnelLength:   body.tunnelLength,
        tunnelDiameter: body.tunnelDiameter,
        tunnelMethod:   body.tunnelMethod,
        trackLength:    body.trackLength,
        stationCount:   body.stationCount,
        trackGauge:     body.trackGauge,
        roadLength:     body.roadLength,
        laneCount:      body.laneCount,
        pavementType:   body.pavementType,
        totalSpan:      body.totalSpan,
        pierCount:      body.pierCount,
        deckType:       body.deckType,
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
  app.get("/schedule/status/:jobId", { preHandler: verifySession }, async (request, reply) => {
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
          if (result?.phase === "awaiting_review") {
            return {
              jobId,
              status: "awaiting_review",
              message: "Work packages extracted — review and confirm before the schedule is built.",
              result: {
                phase: "awaiting_review",
                pendingId: result.pendingId,
              },
            };
          }
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
  app.get("/schedule/versions", { preHandler: verifySession }, async (request, reply) => {
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
        .leftJoin(users, sql`${users.id}::text = ${scheduleVersions.uploadedBy}`)
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
  app.get("/schedule/versions/:id", { preHandler: verifySession }, async (request, reply) => {
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
      const body = request.body as { projectId: string; workspaceId: string; generatedBy?: string; sourceFileName?: string };
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
          generatedBy: body.generatedBy ?? "manual",
          sourceFileName: body.sourceFileName ?? null,
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
        .leftJoin(users, sql`${users.id}::text = ${scheduleVersions.uploadedBy}`)
        .where(eq(scheduleVersions.id, created.id));

      return reply.status(201).send(row);
    } catch (err: any) {
      console.error("POST /schedule/versions error:", err.message);
      return reply.status(500).send({ error: "Failed to create schedule version" });
    }
  });

  // =========================================================================
  // GET /schedule/work-packages/:jobId — fetch extracted work packages for review
  // =========================================================================
  app.get("/schedule/work-packages/:jobId", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const userId = request.userId;

      const [row] = await db
        .select()
        .from(pendingWorkPackages)
        .where(eq(pendingWorkPackages.jobId, jobId));

      if (!row) {
        return reply.status(404).send({
          error: "Work packages not found",
          suggestion: "They may have already been confirmed or cancelled. Start a new generation.",
        });
      }

      const [membership] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, row.projectId),
          eq(projectMembers.userId, userId),
        ));

      if (!membership) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({
        jobId: row.jobId,
        projectId: row.projectId,
        versionNumber: row.versionNumber,
        constructionType: row.constructionType,
        status: row.status,
        data: row.data,
        createdAt: row.createdAt,
      });
    } catch (err: any) {
      console.error("GET /schedule/work-packages error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch work packages" });
    }
  });

  // =========================================================================
  // POST /schedule/work-packages/:jobId/confirm — PM confirms edited packages
  // =========================================================================
  app.post("/schedule/work-packages/:jobId/confirm", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const body = request.body as { edits?: Array<{ id: string; [key: string]: any }> } | undefined;
      const userId = request.userId;

      const [row] = await db
        .select()
        .from(pendingWorkPackages)
        .where(eq(pendingWorkPackages.jobId, jobId));

      if (!row) {
        return reply.status(404).send({ error: "Work packages not found" });
      }

      if (row.status === "confirmed") {
        return reply.status(409).send({ error: "Already confirmed" });
      }

      const [membership] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, row.projectId),
          eq(projectMembers.userId, userId),
        ));

      if (!membership) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Apply PM edits to work packages if provided
      let data = row.data as any;
      if (body?.edits && body.edits.length > 0) {
        const editMap = new Map(body.edits.map(e => [e.id, e]));
        data = {
          ...data,
          workPackages: data.workPackages.map((wp: any) => {
            const edit = editMap.get(wp.id);
            if (!edit) return wp;
            return {
              ...wp,
              ...edit,
              ...(edit.productivityRate !== undefined && { productivityBasis: "user_input" }),
            };
          }),
        };
      }

      await db
        .update(pendingWorkPackages)
        .set({
          status: "confirmed",
          data,
          confirmedAt: new Date().toISOString(),
        })
        .where(eq(pendingWorkPackages.jobId, jobId));

      // Phase 3: enqueue RCPSP optimizer job here
      // TODO: aiSchedulerQueue.add("optimize-schedule", { pendingId: row.id, projectId: row.projectId, ... })

      return reply.send({
        message: "Work packages confirmed. Schedule optimization will run in Phase 3.",
        versionNumber: row.versionNumber,
        projectId: row.projectId,
      });
    } catch (err: any) {
      console.error("POST /schedule/work-packages/confirm error:", err.message);
      return reply.status(500).send({ error: "Failed to confirm work packages" });
    }
  });

  // =========================================================================
  // POST /schedule/work-packages/:jobId/cancel — discard and start over
  // =========================================================================
  app.post("/schedule/work-packages/:jobId/cancel", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const userId = request.userId;

      const [row] = await db
        .select({ id: pendingWorkPackages.id, projectId: pendingWorkPackages.projectId })
        .from(pendingWorkPackages)
        .where(eq(pendingWorkPackages.jobId, jobId));

      if (!row) {
        return reply.status(404).send({ error: "Work packages not found" });
      }

      const [membership] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, row.projectId),
          eq(projectMembers.userId, userId),
        ));

      if (!membership) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await db.delete(pendingWorkPackages).where(eq(pendingWorkPackages.jobId, jobId));

      return reply.send({ message: "Extraction cancelled. Start a new schedule generation when ready." });
    } catch (err: any) {
      console.error("POST /schedule/work-packages/cancel error:", err.message);
      return reply.status(500).send({ error: "Failed to cancel" });
    }
  });

  // =========================================================================
  // POST /schedule/parse-preview
  // Accepts a multipart file upload (.mpp, .xml, .xer, .csv, .xlsx)
  // Returns { headers: string[], rows: string[][], error?: string, suggestion?: string }
  // Used by the import wizard to show real column data before mapping.
  // =========================================================================
  app.post("/schedule/parse-preview", { preHandler: verifySession }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "No file uploaded" });

      const fileName = data.filename;
      const ext = fileName.toLowerCase().split(".").pop() ?? "";
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buf = Buffer.concat(chunks);

      // ── XER (Primavera P6) ──────────────────────────────────────────────────
      if (ext === "xer") {
        const text = buf.toString("utf-8");
        const lines = text.split(/\r?\n/);

        // State machine — XER sections can appear in any order
        type XerSection = "task" | "taskpred" | "projwbs" | null;
        let section: XerSection = null;

        let taskHeaders: string[] = [];
        const taskRows: string[][] = [];
        let predHeaders: string[] = [];
        const predRows: string[][] = [];
        let wbsHeaders: string[] = [];
        const wbsRows: string[][] = [];

        for (const line of lines) {
          // Section header — %T TASK must not match %T TASKPRED
          if (/^%T\s+TASK\b/.test(line) && !/^%T\s+TASKPRED/.test(line)) {
            section = "task"; continue;
          }
          if (/^%T\s+TASKPRED\b/.test(line)) { section = "taskpred"; continue; }
          if (/^%T\s+PROJWBS\b/.test(line))  { section = "projwbs";  continue; }
          if (line.startsWith("%T"))          { section = null; continue; }

          const fields = line.slice(3).split("\t");
          if (line.startsWith("%F") && section === "task")     { taskHeaders = fields; continue; }
          if (line.startsWith("%F") && section === "taskpred") { predHeaders = fields; continue; }
          if (line.startsWith("%F") && section === "projwbs")  { wbsHeaders  = fields; continue; }
          if (line.startsWith("%R") && section === "task")     { taskRows.push(fields); continue; }
          if (line.startsWith("%R") && section === "taskpred") { predRows.push(fields); continue; }
          if (line.startsWith("%R") && section === "projwbs")  { wbsRows.push(fields);  continue; }
        }

        if (!taskHeaders.length) {
          return reply.send({ headers: [], rows: [], error: "No TASK section found in XER file" });
        }

        // ── Build wbs_id → wbs_name from PROJWBS section ─────────────────────
        const wbsIdCol   = wbsHeaders.indexOf("wbs_id");
        const wbsNameCol = wbsHeaders.indexOf("wbs_name");
        const wbsIdToName = new Map<string, string>();
        if (wbsIdCol !== -1 && wbsNameCol !== -1) {
          for (const row of wbsRows) {
            const id   = row[wbsIdCol]?.trim();
            const name = row[wbsNameCol]?.trim();
            if (id && name) wbsIdToName.set(id, name);
          }
        }

        // ── Build task_id → task_name lookup ──────────────────────────────────
        const taskIdIdx   = taskHeaders.indexOf("task_id");
        const taskNameIdx = taskHeaders.indexOf("task_name");
        const wbsIdIdx    = taskHeaders.indexOf("wbs_id");
        const taskIdToName = new Map<string, string>();
        for (const row of taskRows) {
          const id   = row[taskIdIdx]?.trim();
          const name = row[taskNameIdx]?.trim();
          if (id && name) taskIdToName.set(id, name);
        }

        // ── Build task_id → [{name, type}] via TASKPRED ───────────────────────
        const succIdIdx   = predHeaders.indexOf("task_id");      // the successor
        const predIdIdx   = predHeaders.indexOf("pred_task_id"); // the predecessor
        const predTypeIdx = predHeaders.indexOf("pred_type");

        const taskIdToPreds = new Map<string, Array<{ name: string; type: string }>>();
        if (succIdIdx !== -1 && predIdIdx !== -1) {
          for (const row of predRows) {
            const succId   = row[succIdIdx]?.trim();
            const predId   = row[predIdIdx]?.trim();
            const predName = predId ? taskIdToName.get(predId) : undefined;
            if (succId && predName) {
              const rawType = predTypeIdx !== -1 ? (row[predTypeIdx]?.trim() ?? "") : "";
              const depType = (["FS", "FF", "SS", "SF"] as const).includes(rawType as "FS") ? rawType : "FS";
              if (!taskIdToPreds.has(succId)) taskIdToPreds.set(succId, []);
              taskIdToPreds.get(succId)!.push({ name: predName, type: depType });
            }
          }
        }

        // ── Extract wanted columns + resolved Predecessor ─────────────────────
        const wanted = [
          "task_id", "task_name", "target_start_date",
          "target_end_date", "target_drtn_hr_cnt", "phys_complete_pct",
        ];
        const labels: Record<string, string> = {
          task_name: "Activity", target_start_date: "Start Date",
          target_end_date: "End Date", target_drtn_hr_cnt: "Duration",
          phys_complete_pct: "% Complete",
        };

        const idxs = wanted
          .filter(k => k !== "task_id")
          .map(k => taskHeaders.indexOf(k))
          .filter(i => i !== -1);

        const durationIdx = taskHeaders.indexOf("target_drtn_hr_cnt");
        const outHeaders = [...idxs.map(i => labels[taskHeaders[i]] ?? taskHeaders[i]), "Predecessor", "Phase"];

        const outRows = taskRows.map(row => {
          const taskId = row[taskIdIdx]?.trim();
          const preds  = taskId ? (taskIdToPreds.get(taskId) ?? []) : [];
          const wbsId  = wbsIdIdx !== -1 ? row[wbsIdIdx]?.trim() : undefined;
          const phase  = wbsId ? (wbsIdToName.get(wbsId) ?? "") : "";
          const cells  = idxs.map(i => {
            const val = row[i] ?? "";
            // XER stores duration in hours — convert to working days (÷8)
            if (i === durationIdx && val !== "") {
              const hrs = parseFloat(val);
              return isNaN(hrs) ? val : String(Math.round(hrs / 8) || 1);
            }
            return val;
          });
          // Encode predecessors as "Name|TYPE" so bulk import can preserve dep type
          return [...cells, preds.map(p => `${p.name}|${p.type}`).join(", "), phase];
        });

        return reply.send({ headers: outHeaders, rows: outRows });
      }

      // ── XML — detect P6 vs MSPDI, parse accordingly ───────────────────────
      if (ext === "xml") {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
        const xmlText = buf.toString("utf-8");
        const parsed = parser.parse(xmlText);

        // ── Primavera P6 XML detection ─────────────────────────────────────
        // P6 XML root is <APIBusinessObjects> with oracle.com namespace,
        // or the parsed object has top-level Activity/Relationship keys.
        const isP6 =
          xmlText.includes("oracle.com/Primavera") ||
          parsed?.APIBusinessObjects !== undefined ||
          parsed?.APIBusinessObjects?.Activity !== undefined ||
          // Some P6 exports wrap in a Project element but still have PlannedStartDate
          (parsed?.Project?.Activity !== undefined);

        if (isP6) {
          // P6 XML structure: Activities + Relationships + WBS at top level or under Project
          const root = parsed?.APIBusinessObjects ?? parsed?.Project ?? parsed;
          const actList: any[] = Array.isArray(root?.Activity)
            ? root.Activity
            : root?.Activity ? [root.Activity] : [];

          const relList: any[] = Array.isArray(root?.Relationship)
            ? root.Relationship
            : root?.Relationship ? [root.Relationship] : [];

          const wbsList: any[] = Array.isArray(root?.WBS)
            ? root.WBS
            : root?.WBS ? [root.WBS] : [];

          // Build WBSObjectId → wbs_name for phase lookup
          const wbsObjIdToName = new Map<string, string>();
          for (const w of wbsList) {
            const id   = String(w.ObjectId ?? "");
            const name = String(w.Name ?? "");
            if (id && name) wbsObjIdToName.set(id, name);
          }

          // Build ObjectId → Name lookup for relationship resolution
          const objIdToName = new Map<string, string>();
          for (const a of actList) {
            const objId = String(a.ObjectId ?? a.Id ?? "");
            const name  = String(a.Name ?? "");
            if (objId && name) objIdToName.set(objId, name);
          }

          // Build successor ObjectId → [{name, type}] — P6 Relationship.Type is "FS"/"FF"/etc.
          const VALID_P6_TYPES = new Set(["FS", "FF", "SS", "SF"]);
          const succToPreds = new Map<string, Array<{ name: string; type: string }>>();
          for (const r of relList) {
            const predObjId = String(r.PredecessorActivityObjectId ?? r.PredecessorActivity ?? "");
            const succObjId = String(r.SuccessorActivityObjectId   ?? r.SuccessorActivity   ?? "");
            const predName  = predObjId ? objIdToName.get(predObjId) : undefined;
            if (succObjId && predName) {
              const rawType = String(r.Type ?? "").toUpperCase();
              const depType = VALID_P6_TYPES.has(rawType) ? rawType : "FS";
              if (!succToPreds.has(succObjId)) succToPreds.set(succObjId, []);
              succToPreds.get(succObjId)!.push({ name: predName, type: depType });
            }
          }

          const rows = actList
            .filter((a: any) => a.Name && a.Type !== "WBS") // skip WBS summary rows
            .map((a: any) => {
              const objId = String(a.ObjectId ?? a.Id ?? "");
              const preds = succToPreds.get(objId) ?? [];
              const start = (a.PlannedStartDate ?? a.StartDate ?? a.EarlyStartDate ?? "")
                .toString().split("T")[0];
              const end   = (a.PlannedFinishDate ?? a.FinishDate ?? a.EarlyFinishDate ?? "")
                .toString().split("T")[0];
              const dur   = a.PlannedDuration ?? a.Duration ?? "";
              const pct   = a.PercentComplete ?? a.PhysicalPercentComplete ?? 0;
              const wbsId = String(a.WBSObjectId ?? a.WBSId ?? "");
              const phase = wbsId ? (wbsObjIdToName.get(wbsId) ?? "") : "";
              return [
                String(a.Name),
                start,
                end,
                dur ? String(Math.round(Number(dur))) : "",
                preds.map(p => `${p.name}|${p.type}`).join(", "),
                String(pct),
                phase,
              ];
            });

          return reply.send({
            headers: ["Task Name", "Start Date", "End Date", "Duration (days)", "Predecessor", "% Complete", "Phase"],
            rows,
          });
        }

        // ── MSPDI (MS Project XML) ─────────────────────────────────────────
        const taskList: any[] =
          parsed?.Project?.Tasks?.Task ??
          parsed?.["msp:Project"]?.["msp:Tasks"]?.["msp:Task"] ?? [];
        const mspTasks = Array.isArray(taskList) ? taskList : [taskList];

        // Build UID → Name for predecessor resolution
        const uidToName = new Map<string, string>();
        for (const t of mspTasks) {
          if (t.UID != null && t.Name) uidToName.set(String(t.UID), String(t.Name));
        }

        // Derive phase from nearest parent Summary task using OutlineLevel stack.
        // Process tasks in document order (depth-first outline order in MSPDI).
        // For each task: pop stack entries at same-or-deeper level, then push if Summary.
        // Phase for a leaf task = name of stack top = nearest enclosing Summary.
        const uidToPhase = new Map<string, string>();
        const summaryStack: Array<{ level: number; name: string }> = [];
        for (const t of mspTasks) {
          const level = Number(t.OutlineLevel ?? 0);
          const isSummary = t.Summary === true || t.Summary === 1
            || String(t.Summary) === "1" || String(t.Summary).toLowerCase() === "true";
          while (summaryStack.length && summaryStack[summaryStack.length - 1].level >= level) {
            summaryStack.pop();
          }
          if (isSummary && t.Name) {
            summaryStack.push({ level, name: String(t.Name) });
          } else if (!isSummary && t.UID != null && summaryStack.length) {
            uidToPhase.set(String(t.UID), summaryStack[summaryStack.length - 1].name);
          }
        }

        // MSPDI PredecessorLink.Type is numeric: 0=FF, 1=FS, 2=SF, 3=SS
        const MSP_DEP_TYPE: Record<number, string> = { 0: "FF", 1: "FS", 2: "SF", 3: "SS" };

        const rows = mspTasks
          .filter((t: any) => t.Name && !t.Summary)
          .map((t: any) => {
            const predLinks = t.PredecessorLink
              ? (Array.isArray(t.PredecessorLink) ? t.PredecessorLink : [t.PredecessorLink])
              : [];
            const predNames = predLinks
              .flatMap((l: any) => {
                const name = uidToName.get(String(l.PredecessorUID ?? ""));
                if (!name) return [];
                const depType = MSP_DEP_TYPE[Number(l.Type)] ?? "FS";
                return [`${name}|${depType}`];
              })
              .join(", ");
            const phase = uidToPhase.get(String(t.UID ?? "")) ?? "";
            return [
              String(t.Name),
              t.Start  ? String(t.Start).split("T")[0]  : "",
              t.Finish ? String(t.Finish).split("T")[0] : "",
              t.Duration ? String(parseMspDuration(String(t.Duration))) : "",
              predNames,
              t.PercentComplete != null ? `${t.PercentComplete}` : "0",
              phase,
            ];
          });

        return reply.send({
          headers: ["Task Name", "Start Date", "End Date", "Duration (days)", "Predecessor", "% Complete", "Phase"],
          rows,
        });
      }

      // ── MPP (MS Project binary) ─────────────────────────────────────────────
      if (ext === "mpp") {
        // Validate it's a real OLE Compound Document (MPP signature)
        const { read: cfbRead } = await import("cfb");
        try {
          cfbRead(buf, { type: "buffer" });
          // It's a valid OLE file — guide to XML export
          return reply.send({
            headers: [],
            rows: [],
            error: "MPP binary format cannot be parsed directly.",
            suggestion: "In MS Project: File → Save As → change type to 'XML Format (*.xml)' → upload that file instead.",
          });
        } catch {
          return reply.send({
            headers: [],
            rows: [],
            error: "File does not appear to be a valid MS Project file.",
            suggestion: "Export from MS Project as XML: File → Save As → XML Format (*.xml).",
          });
        }
      }

      return reply.status(400).send({ error: `Unsupported file type: .${ext}` });
    } catch (err: any) {
      console.error("POST /schedule/parse-preview error:", err.message);
      return reply.status(500).send({ error: "Failed to parse file", details: err.message });
    }
  });

  // POST /schedule/baseline — lock a version as baseline
  // =========================================================================
  app.post("/schedule/baseline", { preHandler: verifySession }, async (request, reply) => {
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

      // Demote all previous baselines for this project
      await db
        .update(scheduleVersions)
        .set({ isBaseline: false })
        .where(and(
          eq(scheduleVersions.projectId, version.projectId),
          eq(scheduleVersions.workspaceId, body.workspaceId)
        ));

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
