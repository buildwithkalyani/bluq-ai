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
import { eq, and, like, inArray, desc } from "drizzle-orm";

// Pipeline modules
import { parseFiles, fetchFileBuffer } from "../lib/parsers.js";
import { extractParameters, type ProjectParameters } from "../lib/parameter-extractor.js";
import { selectTasks, printTaskSummary, type RulesEngineResult } from "../lib/rules-engine.js";
import { calculateSchedule, type ScheduleResult, type ScheduledTask } from "../lib/duration-calculator.js";
import { generateNovelTasks } from "../lib/novel-task-generator.js";
import { checkTaskGaps, type GapCheckResult } from "../lib/gap-checker.js";
import { getIO, emitInfraParamsReady } from "../lib/socket.js";
import { pendingWorkPackages } from "../db/schema.js";

// Infra pipeline modules
import {
  type InfrastructureType,
  extractInfrastructureParameters,
} from "../lib/infra/infrastructure-parameter-extractor.js";

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
  constructionType?: string;   // "road" | "railway" | "bridge" | "port" | "airport" | "water_treatment" | "residential" | etc.

  // Tunnel-specific overrides (sent by import-csv page when user fills the tunnel form)
  tunnelLength?:   string;    // total tunnel length in metres (applied to TunnelParameters.totalLengthM)
  tunnelDiameter?: string;    // internal finished diameter in metres (applied to TunnelParameters.internalDiameterM)
  tunnelMethod?:   string;    // "natm" | "tbm" | "cutcover" (frontend) → normalised to TunnelParameters.excavationMethod

  // Railway / Metro overrides (sent by import-csv page when user fills the track form)
  trackLength?:   string;    // route length in km → RailwayParameters.totalLengthKm / MetroParameters.totalLengthKm
  stationCount?:  string;    // station count → RailwayParameters.numberOfStations / MetroParameters.numberOfStations
  trackGauge?:    string;    // "broad" | "metre" | "standard" (frontend) → normalised to enum

  // Highway overrides
  roadLength?:    string;    // total route length in km → HighwayParameters.totalLengthKm
  laneCount?:     string;    // number of lanes → HighwayParameters.numberOfLanes
  pavementType?:  string;    // "flexible" | "rigid" | "composite" → HighwayParameters.pavementType

  // Bridge overrides
  totalSpan?:     string;    // total bridge length in m → BridgeParameters.totalLengthM
  pierCount?:     string;    // number of piers → BridgeParameters.numberOfPiers
  deckType?:      string;    // "psc" | "steel" | "composite" | "cable" → BridgeParameters.superstructureType

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
      concurrency: 2,
      drainDelay: 30,
      stalledInterval: 600_000,
      lockDuration: 300_000,
      removeOnComplete: { count: 50 },  // keep last 50 completed jobs
      removeOnFail: { count: 20 },      // keep last 20 failed jobs
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Schedule job ${job.id} completed for project ${job.data.projectId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Schedule job ${job?.id} failed:`, err.stack ?? err.message);
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

async function processScheduleJob(job: Job<ScheduleJobData>): Promise<
  | { phase: "awaiting_review"; pendingId: string }
  | { phase: "complete"; scheduleVersionId: string; taskCount: number; durationDays: number }
> {
  const { projectId, workspaceId, userId } = job.data;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }

  const totalSteps = 7;
  const pipelineStart = Date.now();

  // =========================================================================
  // STEP 1: Fetch document records from database
  // =========================================================================
  await updateProgress(job, 1, totalSteps, "Fetching project documents...");
  const step1Start = Date.now();

  const projectDocuments = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.workspaceId, workspaceId),
        like(documents.folder, "Schedules%")
      )
    );

  if (projectDocuments.length === 0) {
    throw new Error(
      "No documents found in the Schedules folder. Upload documents via the Schedule tab before generating."
    );
  }
  console.log(`[worker] Step 1 completed in ${Date.now() - step1Start}ms`);

  // =========================================================================
  // STEP 2: Download and parse files
  // =========================================================================
  await updateProgress(job, 2, totalSteps, `Parsing ${projectDocuments.length} document(s)...`);
  const step2Start = Date.now();

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
  console.log(`[worker] Step 2 completed in ${Date.now() - step2Start}ms`);

  // =========================================================================
  // STEP 3–6: Infra pipeline (all types including building)
  // =========================================================================

  const infraType = resolveInfraType(job.data.constructionType);

  let allTasks: ScheduledTask[] = [];
  let schedulingWarnings: string[] = [];
  let aiReasoning = "";
  let totalDurationDays = 0;
  let gapCheck: GapCheckResult = {
    coverageAssessment: "complete",
    suspectedGaps: [],
    notes: "Gap check not run for infrastructure projects — task libraries are domain-specific.",
  };

  if (infraType) {
    // -----------------------------------------------------------------------
    // INFRASTRUCTURE PIPELINE — PHASE A
    // Extract parameters via Claude, store for PM review.
    // Phase B (rules engine + RCPSP + save) runs in POST /work-packages/:jobId/confirm
    // after the PM reviews and edits the extracted parameters.
    // -----------------------------------------------------------------------

    // Step 3: Extract infrastructure parameters via Claude
    await updateProgress(job, 3, totalSteps, `Extracting ${infraType} project parameters...`);
    const step3Start = Date.now();

    const infraParams = await extractInfrastructureParameters(
      infraType,
      parsed,
      job.data.extractionRuns ?? 1,
    );
    console.log(
      `[worker] Infra params extracted: confidence=${infraParams.confidence}, ` +
      `missing=${infraParams.missingData.length} fields`
    );
    console.log(`[worker] Step 3 completed in ${Date.now() - step3Start}ms`);

    // Step 4: Store in DB — PM reviews before Phase B runs
    await updateProgress(job, 4, totalSteps, "Parameters extracted — review before schedule is built...");

    const existingVers = await db
      .select({ versionNumber: scheduleVersions.versionNumber })
      .from(scheduleVersions)
      .where(eq(scheduleVersions.projectId, projectId))
      .orderBy(desc(scheduleVersions.versionNumber))
      .limit(1);
    const nextVersion = (existingVers[0]?.versionNumber ?? 0) + 1;

    const [pendingRow] = await db
      .insert(pendingWorkPackages)
      .values({
        jobId:            job.id!,
        projectId,
        workspaceId,
        versionNumber:    nextVersion,
        constructionType: job.data.constructionType ?? infraType,
        data: {
          params:    infraParams,
          startDate: job.data.startDate ?? new Date().toISOString().split("T")[0],
          userId,
        },
        status: "pending_review",
      })
      .returning({ id: pendingWorkPackages.id });

    emitInfraParamsReady({
      jobId:            job.id!,
      projectId,
      versionNumber:    nextVersion,
      constructionType: job.data.constructionType ?? infraType,
      missingData:      infraParams.missingData,
      confidence:       infraParams.confidence,
    });

    console.log(`[worker] Stored infra params pending review, v${nextVersion}, id=${pendingRow.id}`);
    console.log(`[worker] Total Phase A: ${Date.now() - pipelineStart}ms`);

    return { phase: "awaiting_review", pendingId: job.id! };

  } else {
    // -----------------------------------------------------------------------
    // BUILDING PIPELINE (existing, unchanged)
    // -----------------------------------------------------------------------

    // Step 3: Extract parameters via Claude
    await updateProgress(job, 3, totalSteps, "AI is reading your documents...");
    const step3Start = Date.now();

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

    const params = applyOverrides(extractionResult.parameters, job.data);

    console.log(
      `[worker] Extracted params: ${params.buildingType}, ${params.floors} floors, ` +
      `${params.regionCode}, soil=${params.soilType}, confidence=${params.confidence.overall}`
    );
    console.log(`[worker] Step 3 completed in ${Date.now() - step3Start}ms`);

    // Step 4: Select tasks deterministically
    await updateProgress(job, 4, totalSteps, "Selecting construction tasks...");
    const step4Start = Date.now();

    const rulesResult: RulesEngineResult = selectTasks(params);

    console.log(`[worker] Rules engine:\n${printTaskSummary(rulesResult)}`);

    if (rulesResult.tasks.length === 0) {
      throw new Error("Rules engine returned zero tasks. This should not happen — please report this bug.");
    }
    console.log(`[worker] Step 4 completed in ${Date.now() - step4Start}ms`);

    const gapCheckPromise = checkTaskGaps(rulesResult.tasks, params, apiKey);

    // Step 5: Calculate durations
    await updateProgress(job, 5, totalSteps, "Calculating durations and scheduling...");
    const step5Start = Date.now();

    const scheduleResult: ScheduleResult = calculateSchedule(rulesResult.tasks, params);

    console.log(
      `[worker] Schedule: ${scheduleResult.summary.totalTasks} tasks, ` +
      `${scheduleResult.summary.totalDurationDays} days, ` +
      `${scheduleResult.summary.criticalPathTasks} on critical path`
    );
    console.log(`[worker] Step 5 completed in ${Date.now() - step5Start}ms`);

    // Step 6: Novel tasks
    await updateProgress(job, 6, totalSteps, "Checking for non-standard scope items...");
    const step6Start = Date.now();

    let novelTasks: ScheduledTask[] = [];
    let placementWarnings: string[] = [];

    if (params.novelScopeItems.length > 0) {
      const novelResult = await generateNovelTasks(
        params.novelScopeItems,
        params,
        apiKey,
        scheduleResult.tasks,
      );
      novelTasks = novelResult.tasks;
      placementWarnings = novelResult.placementWarnings;
    }

    gapCheck = await gapCheckPromise;
    console.log(`[worker] Step 6 completed in ${Date.now() - step6Start}ms`);

    allTasks = [...scheduleResult.tasks, ...novelTasks];
    schedulingWarnings = [...rulesResult.warnings, ...placementWarnings];
    totalDurationDays = scheduleResult.summary.totalDurationDays;

    if (gapCheck.coverageAssessment === "significant_gaps") {
      schedulingWarnings.push(
        "AI gap check flagged potential missing tasks. Review gapCheck field before sharing schedule with contractor."
      );
    }
    for (const gap of gapCheck.suspectedGaps) {
      if (gap.confidence === "high" && !gap.alreadyCovered) {
        schedulingWarnings.push(`High confidence gap detected: ${gap.taskName}. Verify task library coverage.`);
      }
    }

    aiReasoning =
      `Extracted parameters: ${params.buildingType}, ${params.floors} floors, ${params.regionCode}. ` +
      `Selected ${allTasks.length} tasks using ${rulesResult.rulesApplied.length} rules. ` +
      `Schedule duration: ${scheduleResult.summary.totalDurationDays} days. ` +
      `Critical path: ${scheduleResult.summary.criticalPathTasks} tasks. ` +
      `Confidence: ${params.confidence.overall}.`;
  }

  // =========================================================================
  // STEP 7: Save to database
  // =========================================================================
  await updateProgress(job, 7, totalSteps, "Saving schedule...");
  const step7Start = Date.now();

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
    infraType: infraType ?? null,
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
    warnings: schedulingWarnings,
    parseSummary,
    gapCheck,
    totalDurationDays,
  };

  // Archive staging docs to versioned folder before inserting version
  const stagingDocIds = projectDocuments.map(d => d.id);
  if (stagingDocIds.length > 0) {
    await db
      .update(documents)
      .set({ folder: `schedule_v${nextVersion}` })
      .where(inArray(documents.id, stagingDocIds));
  }

  // Demote all previous baselines for this project before inserting new version
  await db
    .update(scheduleVersions)
    .set({ isBaseline: false })
    .where(and(eq(scheduleVersions.projectId, projectId), eq(scheduleVersions.workspaceId, workspaceId)));

  const [savedVersion] = await db
    .insert(scheduleVersions)
    .values({
      workspaceId,
      projectId,
      versionNumber: nextVersion,
      scheduleJson,
      aiReasoning: aiReasoning,
      aiRisks: {
        warnings: schedulingWarnings,
      },
      isBaseline: true,
      isLocked: false,
      generatedBy: "ai",
      uploadedBy: userId !== "system" ? userId : null,
    })
    .returning();

  // Save individual tasks to the tasks table
  // (so they show up in the Gantt chart and can be edited)
  const crewToString = (crew: Array<{ role: string; count: number }>): string => {
    return crew.map((c) => `${c.count} ${c.role}`).join(", ");
  };

  // Map granular task-library phase codes → display phases used in Gantt
  const PHASE_DISPLAY: Record<string, string> = {
    // Building phases
    site_preparation:      "Site Preparation",
    foundation:            "Foundation",
    plinth:                "Foundation",
    superstructure:        "Structure",
    masonry:               "Structure",
    plumbing:              "MEP",
    electrical:            "MEP",
    special_systems:       "MEP",
    plastering:            "Finishing",
    waterproofing:         "Finishing",
    flooring:              "Finishing",
    doors_windows:         "Finishing",
    painting:              "Finishing",
    external_works:        "Finishing",
    approvals_handover:    "Handover",
    // Port phases
    surveys_investigations:   "Surveys & Investigations",
    marine_works:             "Marine Works",
    reclamation:              "Reclamation",
    quay_berth:               "Quay & Berth",
    yard_pavement:            "Yard & Pavement",
    terminal_buildings:       "Terminal Buildings",
    utilities:                "Utilities",
    equipment_installation:   "Equipment Installation",
    navigational_aids:        "Navigational Aids",
    commissioning_handover:   "Commissioning & Handover",
    // Airport phases
    earthworks_grading:       "Earthworks",
    runway_taxiway_pavement:  "Runway & Taxiway",
    drainage:                 "Drainage",
    terminal_building:        "Terminal Building",
    atc_facilities:           "ATC Facilities",
    perimeter_security:       "Perimeter & Security",
    // Highway phases
    earthworks:               "Earthworks",
    drainage_structures:      "Drainage",
    pavement_layers:          "Pavement",
    structures:               "Structures",
    safety_furniture:         "Safety & Furniture",
    toll_its:                 "Toll & ITS",
    // Bridge phases
    foundation_piling:        "Foundation & Piling",
    substructure:             "Substructure",
    superstructure_bridge:    "Superstructure",
    deck_finishes:            "Deck & Finishes",
    approaches:               "Approaches",
    // Metro phases
    viaduct_structure:        "Viaduct",
    station_civil:            "Stations",
    track_works:              "Track Works",
    systems_electromechanical:"Systems & E&M",
    depot:                    "Depot",
    testing_commissioning:    "Testing & Commissioning",
    // WTP phases
    site_preparation_wtp:     "Site Preparation",
    civil_structures:         "Civil Structures",
    mechanical_equipment:     "Mechanical Equipment",
    piping_valves:            "Piping & Valves",
    electrical_instrumentation: "Electrical & Instrumentation",
    // MMLP phases
    rail_infrastructure:      "Rail Infrastructure",
    road_connectivity:        "Road Connectivity",
    warehouse_shed:           "Warehouse & Sheds",
    intermodal_yard:          "Intermodal Yard",
    utilities_services:       "Utilities",
    systems_technology:       "Systems & Technology",
    // ICD phases
    civil_earthworks:         "Civil & Earthworks",
    pavement_yard:            "Pavement & Yard",
    rail_siding:              "Rail Siding",
    customs_facilities:       "Customs Facilities",
    warehousing_sheds:        "Warehousing & Sheds",
    systems_gate:             "Systems & Gate",
    // Liquid Cargo Terminal phases
    regulatory_approvals:     "Regulatory Approvals",
    marine_structures:        "Marine Structures",
    pipeline_piping:          "Pipeline & Piping",
    storage_tanks:            "Storage Tanks",
    fire_safety_systems:      "Fire & Safety Systems",
    // Tunnel phases
    portal_works:             "Portal Works",
    tunnel_excavation:        "Tunnel Excavation",
    primary_support:          "Primary Support",
    waterproofing_lining:     "Waterproofing & Lining",
    drainage_invert:          "Drainage & Invert",
    mep_safety:               "MEP & Safety",
    road_rail_finishing:      "Road / Rail Finishing",
    // Mainline Railway phases
    land_acquisition:         "Land Acquisition",
    bridges_culverts:         "Bridges & Culverts",
    track_laying:             "Track Works",        // shares display name with metro track_works
    station_works:            "Stations",           // shares display name with metro station_civil
    signalling_telecom:       "Signalling & Telecom",
    traction_power:           "Traction & Power",
  };

  const taskInserts = allTasks.map((t, index) => ({
    workspaceId,
    projectId,
    scheduleVersionId: savedVersion.id,
    title: t.fullName,
    description: `${t.originalCode} | ${t.phase} | Qty: ${t.estimatedQuantity} ${t.unit} | Crew: ${crewToString(t.crew)}`,
    status: "not_started" as const,
    priority: t.isCriticalPath ? ("high" as const) : ("medium" as const),
    startDate: t.startDate,
    endDate: t.endDate,
    durationDays: t.finalDurationDays,
    contractor: t.contractorType,
    phase: t.phase ? (PHASE_DISPLAY[t.phase] ?? t.phase) : null,
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
  console.log(`[worker] Step 7 completed in ${Date.now() - step7Start}ms`);

  // Notify connected clients so the Gantt chart refreshes automatically
  getIO()?.to(workspaceId).emit("schedule:generated", {
    projectId,
    versionNumber: nextVersion,
    scheduleVersionId: savedVersion.id,
    taskCount: insertedTasks.length,
    compressionFeasible: true,
  });

  console.log(`[worker] Pipeline total: ${Date.now() - pipelineStart}ms`);

  return {
    phase:             "complete" as const,
    scheduleVersionId: savedVersion.id,
    taskCount:         insertedTasks.length,
    durationDays:      totalDurationDays,
  };
}


// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Maps frontend constructionType string → InfrastructureType enum used by infra pipeline.
export function resolveInfraType(constructionType?: string): InfrastructureType | null {
  const map: Record<string, InfrastructureType> = {
    road:                   "highway",
    highway:                "highway",
    railway:                "railway",
    metro:                  "metro",
    bridge:                 "bridge",
    port:                   "port",
    harbour:                "port",
    airport:                "airport",
    water_treatment:        "water_treatment",
    sewage_treatment:       "water_treatment",
    wtp:                    "water_treatment",
    stp:                    "water_treatment",
    mmlp:                   "mmlp",
    logistics_park:         "mmlp",
    multimodal:             "mmlp",
    icd:                    "icd",
    dry_port:               "icd",
    freight_terminal:       "icd",
    goods_shed:             "icd",
    liquid_cargo_terminal:  "liquid_cargo_terminal",
    liquid_terminal:        "liquid_cargo_terminal",
    chemical_jetty:         "liquid_cargo_terminal",
    lpg_terminal:           "liquid_cargo_terminal",
    oil_terminal:           "liquid_cargo_terminal",
    tunnel:                 "tunnel",
    road_tunnel:            "tunnel",
    railway_tunnel:         "tunnel",
    water_tunnel:           "tunnel",
    hill_tunnel:            "tunnel",
    building:               "building",
    residential:            "building",
    residential_highrise:   "building",
    commercial:             "building",
    commercial_office:      "building",
    office:                 "building",
    industrial:             "building",
    industrial_shed:        "building",
    warehouse:              "building",
    hospital:               "building",
    healthcare:             "building",
    data_center:            "building",
    datacenter:             "building",
    hotel:                  "building",
  };
  if (!constructionType) return null;
  return map[constructionType.toLowerCase()] ?? null;
}

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