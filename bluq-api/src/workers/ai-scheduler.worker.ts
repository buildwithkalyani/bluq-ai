// =============================================================================
// BLUQ AI SCHEDULER WORKER
// =============================================================================
// This is the conveyor belt that connects all 5 pipeline modules.
//
// It's a BullMQ worker that:
//   1. Picks up jobs from the "ai-scheduler" Redis queue
//   2. Runs the full scheduling pipeline
//   3. Saves results to the database
//   4. Emits events so the frontend updates in real time
//
// The job lifecycle:
//   Frontend: POST /schedule/generate → adds job to queue → returns jobId
//   Worker:   picks up job → runs pipeline → saves schedule → emits event
//   Frontend: receives event → shows Gantt chart
//
// Pipeline steps:
//   Step 1: Fetch documents from Supabase Storage (using parsers.ts)
//   Step 2: Parse files into Claude-readable format (parsers.ts)
//   Step 3: Extract project parameters via Claude (parameter-extractor.ts)
//   Step 4: Select tasks deterministically (rules-engine.ts + task-library.ts)
//   Step 5: Calculate durations & schedule (duration-calculator.ts)
//   Step 6: (Optional) Generate novel tasks via Claude for unusual scope items
//   Step 7: Save to database (schedule_versions + tasks tables)
//
// Why BullMQ?
//   Schedule generation takes 30-60 seconds. If we did this inside an API
//   route, the HTTP request would hang. BullMQ runs this in the background:
//   - PM clicks generate → gets instant response with jobId
//   - Worker processes asynchronously
//   - Frontend polls status or gets Socket.IO event when done
//
// Install: npm install bullmq (already in your deps via queues.ts)
// =============================================================================

import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { db } from "../db/client.js";
import { documents, tasks, scheduleVersions, taskDependencies } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

// Pipeline modules
import { parseFiles, fetchFileBuffer } from "../lib/parsers.js";
import { extractParameters, type ProjectParameters } from "../lib/parameter-extractor.js";
import { selectTasks, printTaskSummary, type RulesEngineResult } from "../lib/rules-engine.js";
import { calculateSchedule, type ScheduleResult, type ScheduledTask } from "../lib/duration-calculator.js";
import { generateNovelTasks } from "../lib/novel-task-generator.js";

// ---------------------------------------------------------------------------
// JOB TYPES
// ---------------------------------------------------------------------------

/** What the route sends when adding a job to the queue */
export interface ScheduleJobData {
  projectId: string;
  workspaceId: string;
  userId: string;

  // Optional overrides from frontend
  startDate?: string;          // ISO date
  endDate?: string;            // ISO date
  regionCode?: string;         // if PM selected region manually
  city?: string;
  buildingType?: string;       // if PM selected type manually

  // Config
  extractionRuns?: number;     // 1 or 2 (for majority vote determinism)
}

/** Progress updates sent during processing */
export interface ScheduleJobProgress {
  step: number;
  totalSteps: number;
  status: string;
  detail?: string;
  percentage: number;
}

// ---------------------------------------------------------------------------
// THE WORKER
// ---------------------------------------------------------------------------

/**
 * Create and start the AI scheduler worker.
 *
 * Call this once when the server starts:
 *   import { startSchedulerWorker } from "./workers/ai-scheduler.worker.js";
 *   startSchedulerWorker();
 */
export function startSchedulerWorker() {
  const worker = new Worker<ScheduleJobData>(
    "ai-scheduler",
    async (job: Job<ScheduleJobData>) => {
      return await processScheduleJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 2,             // process up to 2 jobs at once
      stalledInterval: 300_000,   // check stalled jobs every 5 min (default ~30s)
      lockDuration: 300_000,      // lock held for 5 min, matches stalledInterval
      removeOnComplete: { count: 50 },  // keep last 50 completed jobs
      removeOnFail: { count: 20 },      // keep last 20 failed jobs
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Schedule job ${job.id} completed for project ${job.data.projectId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Schedule job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("🔴 Scheduler worker error:", err.message);
  });

  console.log("🏗️  AI Scheduler worker started, listening for jobs...");
  return worker;
}


// ---------------------------------------------------------------------------
// MAIN PIPELINE
// ---------------------------------------------------------------------------

async function processScheduleJob(job: Job<ScheduleJobData>): Promise<{
  scheduleVersionId: string;
  taskCount: number;
  durationDays: number;
}> {
  const { projectId, workspaceId } = job.data;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }

  const totalSteps = 7;

  // =========================================================================
  // STEP 1: Fetch document records from database
  // =========================================================================
  await updateProgress(job, 1, totalSteps, "Fetching project documents...");

  const projectDocuments = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.workspaceId, workspaceId)
      )
    );

  if (projectDocuments.length === 0) {
    throw new Error(
      "No documents found for this project. Please upload drawings, scope of work, or BOQ before generating a schedule."
    );
  }

  // =========================================================================
  // STEP 2: Download and parse files
  // =========================================================================
  await updateProgress(job, 2, totalSteps, `Parsing ${projectDocuments.length} document(s)...`);

  // Check required env vars before attempting downloads
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[worker] ENV CHECK — SUPABASE_URL: ${supabaseUrl ? "✅ set" : "❌ MISSING"}, SERVICE_ROLE_KEY: ${serviceRoleKey ? "✅ set" : "❌ MISSING"}`);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Storage not configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing on the server."
    );
  }

  console.log(`[worker] Documents to download (${projectDocuments.length}):`);
  projectDocuments.forEach((doc, i) => {
    console.log(`  [${i+1}] ${doc.fileName} → fileUrl: "${doc.fileUrl}"`);
  });

  const downloadResults = await Promise.all(
    projectDocuments.map(async (doc) => {
      try {
        const buffer = await fetchFileBuffer(doc.fileUrl);
        console.log(`[worker] ✅ Downloaded ${doc.fileName} (${buffer.length} bytes)`);
        return { buffer, fileName: doc.fileName, error: null };
      } catch (err: any) {
        console.error(`[worker] ❌ Failed to fetch ${doc.fileName}: ${err.message}`);
        return { buffer: null, fileName: doc.fileName, error: err.message as string };
      }
    })
  );

  const validFiles = downloadResults.filter(
    (f): f is { buffer: Buffer; fileName: string; error: null } => f.buffer !== null
  );

  if (validFiles.length === 0) {
    const reasons = downloadResults.map(f => `${f.fileName}: ${f.error}`).join("; ");
    throw new Error(
      `Could not download any project documents. Errors: ${reasons}`
    );
  }

  const failedDownloads = downloadResults.filter(f => f.buffer === null);
  if (failedDownloads.length > 0) {
    console.warn(`[worker] ${failedDownloads.length} file(s) failed to download, continuing with ${validFiles.length} valid file(s)`);
  }

  const { parsed, errors, summary: parseSummary } = await parseFiles(validFiles);

  if (parsed.length === 0) {
    const errorMessages = errors.map(e => `${e.fileName}: ${e.error} — ${e.suggestion}`).join("\n");
    throw new Error(
      `No documents could be parsed.\n${errorMessages}`
    );
  }

  // Log parse warnings (non-fatal)
  if (errors.length > 0) {
    console.warn(
      `[worker] ${errors.length} file(s) could not be parsed:`,
      errors.map(e => `${e.fileName}: ${e.error}`).join("; ")
    );
  }

  // =========================================================================
  // STEP 3: Extract parameters via Claude
  // =========================================================================
  await updateProgress(job, 3, totalSteps, "AI is reading your documents...");

  const extractionResult = await extractParameters(parsed, apiKey, {
    runs: job.data.extractionRuns || 1,
    projectRegion: job.data.regionCode as any,
    projectCity: job.data.city,
  });

  if (!extractionResult.success || !extractionResult.parameters) {
    throw new Error(
      `Failed to extract project parameters: ${extractionResult.error || "Unknown error"}`
    );
  }

  // Apply any manual overrides from the frontend
  const params = applyOverrides(extractionResult.parameters, job.data);

  console.log(
    `[worker] Extracted params: ${params.buildingType}, ${params.floors} floors, ` +
    `${params.regionCode}, soil=${params.soilType}, confidence=${params.confidence.overall}`
  );

  // =========================================================================
  // STEP 4: Select tasks deterministically
  // =========================================================================
  await updateProgress(job, 4, totalSteps, "Selecting construction tasks...");

  const rulesResult: RulesEngineResult = selectTasks(params);

  console.log(`[worker] Rules engine:\n${printTaskSummary(rulesResult)}`);

  if (rulesResult.tasks.length === 0) {
    throw new Error("Rules engine returned zero tasks. This should not happen — please report this bug.");
  }

  // =========================================================================
  // STEP 5: Calculate durations and schedule
  // =========================================================================
  await updateProgress(job, 5, totalSteps, "Calculating durations and scheduling...");

  const scheduleResult: ScheduleResult = calculateSchedule(rulesResult.tasks, params);

  console.log(
    `[worker] Schedule: ${scheduleResult.summary.totalTasks} tasks, ` +
    `${scheduleResult.summary.totalDurationDays} days, ` +
    `${scheduleResult.summary.criticalPathTasks} on critical path, ` +
    `${scheduleResult.summary.totalMonsoonImpactDays} monsoon impact days`
  );

  // =========================================================================
  // STEP 6: Handle novel scope items (optional AI step)
  // =========================================================================
  await updateProgress(job, 6, totalSteps, "Checking for non-standard scope items...");

  let novelTasks: ScheduledTask[] = [];

  if (params.novelScopeItems.length > 0) {
    console.log(
      `[worker] ${params.novelScopeItems.length} novel scope items found:`,
      params.novelScopeItems.join(", ")
    );

    // Call Claude Haiku to generate tasks for items not in the 143-task library.
    // These are appended after the main schedule and flagged source: "ai_generated".
    // The PM sees them with an "AI-generated, needs review" badge.
    novelTasks = await generateNovelTasks(
      params.novelScopeItems,
      params,
      apiKey,
      scheduleResult.summary.projectEndDate,
    );

    if (novelTasks.length > 0) {
      console.log(`[worker] Generated ${novelTasks.length} novel tasks via Claude Haiku`);
    }
  }

  // =========================================================================
  // STEP 7: Save to database
  // =========================================================================
  await updateProgress(job, 7, totalSteps, "Saving schedule...");

  const allTasks = [...scheduleResult.tasks, ...novelTasks];

  // Get next version number for this project
  const existingVersions = await db
    .select({ versionNumber: scheduleVersions.versionNumber })
    .from(scheduleVersions)
    .where(eq(scheduleVersions.projectId, projectId));

  const nextVersion = existingVersions.length > 0
    ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
    : 1;

  // Save the schedule version (full snapshot as JSON)
  const scheduleJson = {
    parameters: params,
    tasks: allTasks.map(t => ({
      code: t.code,
      originalCode: t.originalCode,
      phase: t.phase,
      name: t.fullName,
      unit: t.unit,
      floorNumber: t.floorNumber,
      floorLabel: t.floorLabel,
      estimatedQuantity: t.estimatedQuantity,
      durationDays: t.finalDurationDays,
      startDate: t.startDate,
      endDate: t.endDate,
      predecessors: t.predecessors,
      crew: t.crew,
      isCriticalPath: t.isCriticalPath,
      totalFloat: t.totalFloat,
      source: t.source,
      monsoonImpactFactor: t.monsoonImpactFactor,
    })),
    summary: scheduleResult.summary,
    rulesApplied: rulesResult.rulesApplied,
    warnings: rulesResult.warnings,
    novelScopeItems: params.novelScopeItems,
    parseSummary,
  };

  const [savedVersion] = await db
    .insert(scheduleVersions)
    .values({
      workspaceId,
      projectId,
      versionNumber: nextVersion,
      scheduleJson,
      aiReasoning: `Extracted parameters: ${params.buildingType}, ${params.floors} floors, ${params.regionCode}. ` +
        `Selected ${allTasks.length} tasks using ${rulesResult.rulesApplied.length} rules. ` +
        `Schedule duration: ${scheduleResult.summary.totalDurationDays} days. ` +
        `Critical path: ${scheduleResult.summary.criticalPathTasks} tasks. ` +
        `Confidence: ${params.confidence.overall}.`,
      aiRisks: {
        warnings: rulesResult.warnings,
        novelScopeItems: params.novelScopeItems,
        monsoonImpact: `${scheduleResult.summary.totalMonsoonImpactDays} extra days due to monsoon`,
        timelineCompression: scheduleResult.summary.timelineCompression,
      },
      isBaseline: false,    // PM needs to review and lock as baseline
      isLocked: false,
      generatedBy: "ai",
    })
    .returning();

  // Save individual tasks to the tasks table
  // (so they show up in the Gantt chart and can be edited)
  const crewToString = (crew: Array<{ role: string; count: number }>): string => {
    return crew.map((c) => `${c.count} ${c.role}`).join(", ");
  };

  const taskInserts = allTasks.map((t, index) => ({
    workspaceId,
    projectId,
    title: t.fullName,
    description: `${t.originalCode} | ${t.phase} | Qty: ${t.estimatedQuantity} ${t.unit} | Crew: ${crewToString(t.crew)}`,
    status: "not_started" as const,
    priority: t.isCriticalPath ? ("high" as const) : ("medium" as const),
    startDate: t.startDate,
    endDate: t.endDate,
    durationDays: t.finalDurationDays,
    contractor: t.contractorType,
    area: t.wingLabel
      ? `${t.wingLabel} — ${t.floorLabel ?? ""}`.trim()
      : (t.floorLabel ?? null),
    isMilestone: false,
    sortOrder: index,
  }));

  // Batch insert tasks (in chunks to avoid hitting SQL limits)
  const BATCH_SIZE = 50;
  const insertedTasks: Array<{ id: string; title: string; sortOrder: number | null }> = [];

  for (let i = 0; i < taskInserts.length; i += BATCH_SIZE) {
    const batch = taskInserts.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(tasks).values(batch).returning({
      id: tasks.id,
      title: tasks.title,
      sortOrder: tasks.sortOrder,
    });
    insertedTasks.push(...inserted);
  }

  // Build a map from sortOrder → database task ID for dependency insertion
  const sortOrderToId = new Map<number, string>();
  for (const t of insertedTasks) {
    if (t.sortOrder !== null && t.sortOrder !== undefined) {
      sortOrderToId.set(t.sortOrder, t.id);
    }
  }

  // Build a map from task code → sortOrder
  const codeToSortOrder = new Map<string, number>();
  allTasks.forEach((t, index) => {
    codeToSortOrder.set(t.code, index);
  });

  // Insert task dependencies
  const dependencyInserts: Array<{
    workspaceId: string;
    predecessorId: string;
    successorId: string;
    dependencyType: string;
    lagDays: number;
  }> = [];

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    const successorId = sortOrderToId.get(i);
    if (!successorId) continue;

    for (const pred of task.predecessors) {
      const predSortOrder = codeToSortOrder.get(pred.taskCode);
      if (predSortOrder === undefined) continue;

      const predecessorId = sortOrderToId.get(predSortOrder);
      if (!predecessorId) continue;

      dependencyInserts.push({
        workspaceId,
        predecessorId,
        successorId,
        dependencyType: pred.type,
        lagDays: pred.lagDays,
      });
    }
  }

  // Batch insert dependencies
  for (let i = 0; i < dependencyInserts.length; i += BATCH_SIZE) {
    const batch = dependencyInserts.slice(i, i + BATCH_SIZE);
    if (batch.length > 0) {
      await db.insert(taskDependencies).values(batch);
    }
  }

  console.log(
    `[worker] Saved: version ${nextVersion}, ${insertedTasks.length} tasks, ` +
    `${dependencyInserts.length} dependencies`
  );

  // TODO: Emit Socket.IO event to frontend
  // socketIO.to(workspaceId).emit("schedule:generated", {
  //   projectId,
  //   versionNumber: nextVersion,
  //   scheduleVersionId: savedVersion.id,
  //   taskCount: insertedTasks.length,
  // });

  return {
    scheduleVersionId: savedVersion.id,
    taskCount: insertedTasks.length,
    durationDays: scheduleResult.summary.totalDurationDays,
  };
}


// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Apply manual overrides from the frontend to extracted parameters.
 * If the PM already selected region/city/type in the UI, use those
 * instead of what Claude extracted.
 */
function applyOverrides(
  params: ProjectParameters,
  jobData: ScheduleJobData
): ProjectParameters {
  const overridden = { ...params };

  if (jobData.startDate) overridden.startDate = jobData.startDate;
  if (jobData.endDate) overridden.endDate = jobData.endDate;
  if (jobData.regionCode) overridden.regionCode = jobData.regionCode as any;
  if (jobData.city) overridden.city = jobData.city;
  if (jobData.buildingType) overridden.buildingType = jobData.buildingType as any;

  return overridden;
}

/**
 * Update job progress — the frontend can poll this via BullMQ job status.
 */
async function updateProgress(
  job: Job,
  step: number,
  totalSteps: number,
  status: string
): Promise<void> {
  const percentage = Math.round((step / totalSteps) * 100);

  await job.updateProgress({
    step,
    totalSteps,
    status,
    percentage,
  } as ScheduleJobProgress);

  console.log(`[worker] Step ${step}/${totalSteps}: ${status}`);
}