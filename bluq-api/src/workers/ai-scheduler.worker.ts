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
import { eq, and, like, inArray, isNull, or } from "drizzle-orm";

// Pipeline modules
import { parseFiles, fetchFileBuffer } from "../lib/parsers.js";
import { extractParameters, type ProjectParameters } from "../lib/parameter-extractor.js";
import { selectTasks, printTaskSummary, type RulesEngineResult } from "../lib/rules-engine.js";
import { calculateSchedule, type ScheduleResult, type ScheduledTask } from "../lib/duration-calculator.js";
import { generateNovelTasks } from "../lib/novel-task-generator.js";
import { checkTaskGaps, type GapCheckResult } from "../lib/gap-checker.js";
import { getIO } from "../lib/socket.js";

// Infra pipeline modules
import { extractInfrastructureParameters, type InfrastructureType } from "../lib/infra/infrastructure-parameter-extractor.js";
import { runInfrastructureRulesEngine } from "../lib/infra/infrastructure-rules-engine.js";
import { calculateInfraSchedule } from "../lib/infra/infra-duration-calculator.js";

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
  // STEP 3–6: Branched pipeline — infra vs building
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
    // INFRASTRUCTURE PIPELINE
    // -----------------------------------------------------------------------

    // Step 3: Extract infra parameters via Claude
    await updateProgress(job, 3, totalSteps, `AI is reading your ${infraType} project documents...`);
    const step3Start = Date.now();

    const parsedDocs = parsed.map(p => ({ name: p.fileName, content: p.contents.map((c: any) => c.text ?? "").join("\n") }));
    const infraParams = await extractInfrastructureParameters(
      infraType,
      parsedDocs,
      job.data.extractionRuns ?? 1,
    );

    // Apply date overrides
    if (job.data.city) (infraParams as any).region = job.data.city;

    // Apply tunnel-specific overrides when user filled the form fields
    if (infraType === "tunnel") {
      const tp = infraParams as import("../lib/infra/infrastructure-parameter-extractor.js").TunnelParameters;
      if (job.data.tunnelLength   && !isNaN(Number(job.data.tunnelLength)))   tp.totalLengthM      = Number(job.data.tunnelLength);
      if (job.data.tunnelDiameter && !isNaN(Number(job.data.tunnelDiameter))) tp.internalDiameterM = Number(job.data.tunnelDiameter);
      if (job.data.tunnelMethod) {
        // Frontend sends "cutcover"; TunnelParameters expects "cut_and_cover"
        const m = job.data.tunnelMethod;
        tp.excavationMethod = m === "cutcover" ? "cut_and_cover" : (m as "natm" | "tbm");
      }
    }

    // Apply railway overrides — frontend gauge values: "broad" | "metre" | "standard"
    if (infraType === "railway") {
      const rp = infraParams as import("../lib/infra/infrastructure-parameter-extractor.js").RailwayParameters;
      if (job.data.trackLength  && !isNaN(Number(job.data.trackLength)))  rp.totalLengthKm    = Number(job.data.trackLength);
      if (job.data.stationCount && !isNaN(Number(job.data.stationCount))) rp.numberOfStations = Number(job.data.stationCount);
      if (job.data.trackGauge) {
        const g = job.data.trackGauge;
        rp.trackGauge =
          g === "broad"    ? "broad_gauge"    :
          g === "metre"    ? "metre_gauge"    :
          g === "standard" ? "standard_gauge" :
          rp.trackGauge;
      }
    }

    // Apply metro overrides — gaugeMM is numeric for MetroParameters
    if (infraType === "metro") {
      const mp = infraParams as import("../lib/infra/infrastructure-parameter-extractor.js").MetroParameters;
      if (job.data.trackLength  && !isNaN(Number(job.data.trackLength)))  mp.totalLengthKm    = Number(job.data.trackLength);
      if (job.data.stationCount && !isNaN(Number(job.data.stationCount))) mp.numberOfStations = Number(job.data.stationCount);
      if (job.data.trackGauge) {
        const g = job.data.trackGauge;
        mp.gaugeMM =
          g === "broad"    ? 1676 :
          g === "metre"    ? 1000 :
          g === "standard" ? 1435 :
          mp.gaugeMM;
      }
    }

    // Apply highway overrides
    if (infraType === "highway") {
      const hp = infraParams as import("../lib/infra/infrastructure-parameter-extractor.js").HighwayParameters;
      if (job.data.roadLength  && !isNaN(Number(job.data.roadLength)))  hp.totalLengthKm  = Number(job.data.roadLength);
      if (job.data.laneCount   && !isNaN(Number(job.data.laneCount)))   hp.numberOfLanes  = Number(job.data.laneCount);
      if (job.data.pavementType) {
        const p = job.data.pavementType;
        if (p === "flexible" || p === "rigid" || p === "composite") hp.pavementType = p;
      }
    }

    // Apply bridge overrides — frontend deckType values map to BridgeParameters.superstructureType
    if (infraType === "bridge") {
      const bp = infraParams as import("../lib/infra/infrastructure-parameter-extractor.js").BridgeParameters;
      if (job.data.totalSpan && !isNaN(Number(job.data.totalSpan))) bp.totalLengthM  = Number(job.data.totalSpan);
      if (job.data.pierCount && !isNaN(Number(job.data.pierCount))) bp.numberOfPiers = Number(job.data.pierCount);
      if (job.data.deckType) {
        const d = job.data.deckType;
        bp.superstructureType =
          d === "psc"       ? "psc_girder"         :
          d === "steel"     ? "steel_truss"         :
          d === "composite" ? "composite"           :
          d === "cable"     ? "cable_stayed"        :
          bp.superstructureType;
      }
    }
    console.log(`[worker] Infra params extracted: ${JSON.stringify(infraParams).slice(0, 200)}...`);
    console.log(`[worker] Step 3 completed in ${Date.now() - step3Start}ms`);

    // Step 4: Select tasks via infra rules engine
    await updateProgress(job, 4, totalSteps, "Selecting infrastructure tasks...");
    const step4Start = Date.now();

    const infraRulesResult = runInfrastructureRulesEngine(infraType, infraParams);

    if (infraRulesResult.selectedTasks.length === 0) {
      throw new Error("Infrastructure rules engine returned zero tasks. Check task library configuration.");
    }

    console.log(`[worker] Infra rules engine: ${infraRulesResult.totalTaskCount} tasks selected`);
    if (infraRulesResult.longLeadItems.length > 0) {
      console.log(
        `[worker] Long-lead items: ${infraRulesResult.longLeadItems.map(t => `${t.code}(${t.leadTimeDays}d)`).join(", ")}`
      );
    }
    console.log(`[worker] Step 4 completed in ${Date.now() - step4Start}ms`);

    // Step 5: Calculate durations and schedule
    await updateProgress(job, 5, totalSteps, "Calculating durations and scheduling...");
    const step5Start = Date.now();

    const effectiveStartDate = job.data.startDate ?? new Date().toISOString().split("T")[0];
    const infraSchedule = calculateInfraSchedule(infraRulesResult, infraType, infraParams, effectiveStartDate);

    allTasks = infraSchedule.tasks;
    totalDurationDays = infraSchedule.totalDurationDays;

    if (infraRulesResult.longLeadItems.length > 0) {
      schedulingWarnings.push(
        `Long-lead procurement items: ${infraRulesResult.longLeadItems
          .map(t => `${t.name} (${t.leadTimeDays} days lead time)`)
          .join("; ")}. Start procurement immediately.`
      );
    }

    console.log(
      `[worker] Infra schedule: ${allTasks.length} tasks, ${totalDurationDays} days, ` +
      `${infraSchedule.criticalPathTasks} critical path tasks`
    );
    console.log(`[worker] Step 5 completed in ${Date.now() - step5Start}ms`);

    // Step 6: No novel task generation for infra (task libraries are comprehensive)
    await updateProgress(job, 6, totalSteps, "Finalising infrastructure schedule...");

    aiReasoning =
      `Infrastructure type: ${infraType}. ` +
      `Extracted parameters from ${parsedDocs.length} document(s). ` +
      `Selected ${allTasks.length} tasks using infrastructure rules engine. ` +
      `Schedule duration: ${totalDurationDays} days. ` +
      `Critical path tasks: ${infraSchedule.criticalPathTasks}. ` +
      (infraRulesResult.longLeadItems.length > 0
        ? `Long-lead items requiring early procurement: ${infraRulesResult.longLeadItems.map(t => t.name).join(", ")}.`
        : "No long-lead procurement items flagged.");

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

  // Get next version number and save the current baseline ID (for manual task carryover)
  const existingVersions = await db
    .select({ versionNumber: scheduleVersions.versionNumber, id: scheduleVersions.id, isBaseline: scheduleVersions.isBaseline })
    .from(scheduleVersions)
    .where(eq(scheduleVersions.projectId, projectId));

  const nextVersion = existingVersions.length > 0
    ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
    : 1;

  const prevBaselineId = existingVersions.find(v => v.isBaseline)?.id ?? null;

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
    taskSource: "ai" as const,
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

  // Carry over manually added tasks from the previous baseline (or null-version tasks)
  // into the new version so they don't disappear when the baseline changes.
  const versionFilter = prevBaselineId
    ? or(eq(tasks.scheduleVersionId, prevBaselineId), isNull(tasks.scheduleVersionId))!
    : isNull(tasks.scheduleVersionId);

  const manualTasks = await db
    .select()
    .from(tasks)
    .where(and(
      eq(tasks.projectId, projectId),
      eq(tasks.workspaceId, workspaceId),
      eq(tasks.taskSource, "manual"),
      versionFilter,
    ));

  if (manualTasks.length > 0) {
    // Tasks with null scheduleVersionId migrate into the new version (UPDATE)
    const nullVersionIds = manualTasks.filter(t => !t.scheduleVersionId).map(t => t.id);
    if (nullVersionIds.length > 0) {
      await db.update(tasks)
        .set({ scheduleVersionId: savedVersion.id })
        .where(inArray(tasks.id, nullVersionIds));
    }

    // Tasks from the previous baseline get copied into the new version (INSERT)
    const prevVersionTasks = manualTasks.filter(t => t.scheduleVersionId === prevBaselineId);
    if (prevVersionTasks.length > 0) {
      await db.insert(tasks).values(
        prevVersionTasks.map(t => ({
          workspaceId: t.workspaceId,
          projectId: t.projectId,
          scheduleVersionId: savedVersion.id,
          taskSource: "manual" as const,
          title: t.title,
          description: t.description,
          assignedTo: t.assignedTo,
          status: t.status,
          priority: t.priority,
          startDate: t.startDate,
          endDate: t.endDate,
          durationDays: t.durationDays,
          percentComplete: t.percentComplete,
          contractor: t.contractor,
          area: t.area,
          phase: t.phase,
          isMilestone: t.isMilestone,
          parentTaskId: t.parentTaskId,
          sortOrder: t.sortOrder,
        }))
      );
    }

    console.log(`[worker] Carried over ${manualTasks.length} manual task(s) to version ${nextVersion}`);
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
    scheduleVersionId: savedVersion.id,
    taskCount: insertedTasks.length,
    durationDays: totalDurationDays,
  };
}


// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Maps frontend constructionType string → InfrastructureType enum used by infra pipeline.
// Returns null for building types (residential, commercial, etc.) which use the existing pipeline.
function resolveInfraType(constructionType?: string): InfrastructureType | null {
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