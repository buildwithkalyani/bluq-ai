// =============================================================================
// BLUQ PIPELINE END-TO-END TEST (no DB required)
// =============================================================================
// Tests the full scheduling logic without touching the database:
//   ParsedDocument → extractParameters (Claude) → selectTasks → calculateSchedule
//
// Run with:
//   npx tsx scripts/test-pipeline.ts
//
// No project ID needed. No DB writes. Safe to run any time.
// The DB save code in the worker is identical — if the pipeline passes here,
// the worker will save correctly when triggered via POST /schedule/generate.
// =============================================================================

import dotenv from "dotenv";
dotenv.config();

import { extractParameters, type ProjectParameters } from "../src/lib/parameter-extractor.js";
import { selectTasks, printTaskSummary, type RulesEngineResult } from "../src/lib/rules-engine.js";
import { calculateSchedule, type ScheduleResult } from "../src/lib/duration-calculator.js";
import { generateNovelTasks } from "../src/lib/novel-task-generator.js";
import type { ParsedDocument } from "../src/lib/parsers.js";

// ---------------------------------------------------------------------------
// SAMPLE SOW — G+4 residential in Pune, Maharashtra
// Includes a rooftop garden to trigger novel task generation (Haiku).
// Edit freely to test different building types, regions, features.
// ---------------------------------------------------------------------------

const SAMPLE_SOW = `
SCOPE OF WORK — RESIDENTIAL APARTMENT PROJECT
==============================================
Project Name: Greenview Residences Block A
Client: ABC Developers Pvt. Ltd.
Location: Baner, Pune, Maharashtra - 411045
Date: April 2026

PROJECT OVERVIEW
----------------
Construction of a Residential Apartment Building (G+4) with basement parking.
Total Floors: Basement (B1) + Ground Floor (G) + 4 Upper Floors (1F to 4F)
Total Built-up Area: 4,500 sqm per floor x 5 = 22,500 sqm
Plot Area: 2,800 sqm
Total Residential Units: 40 flats (8 per floor x 5 floors)
Typical Floor Plate: 4,500 sqm

SITE & SOIL CONDITIONS
-----------------------
Soil Type: Hard Murum / Dense Laterite
Foundation Depth: 2.5 m below FGL
Water Table: >5m (does not affect construction)
Seismic Zone: III (Maharashtra)

STRUCTURE
---------
Structural System: RCC Frame Structure
Concrete Grade: M25 for slabs/beams, M30 for columns
Reinforcement: Fe-500D HYSD Bars
Foundation Type: Isolated column footings + tie beams

SCOPE OF CIVIL WORKS
--------------------
1. Site clearing, levelling, and excavation
2. PCC M10 for column footings
3. RCC isolated footings with M30 concrete
4. Tie beams at plinth level
5. RCC columns (ground floor to 4th floor)
6. RCC beams and slabs at each floor level (G+4)
7. External and internal brick masonry (230mm and 115mm)
8. Window sills and lintels (RCC precast)
9. Staircase: RCC dog-legged staircase x2 per floor

PLUMBING & SANITATION
---------------------
- Internal water supply: GI pipes, concealed
- Drainage: UPVC pipes (100mm, 75mm, 50mm)
- Overhead water tank: 25,000 litres (RCC on terrace)
- Underground sump: 60,000 litres
- STP (Sewage Treatment Plant): 50 KLD capacity

ELECTRICAL
----------
- LT Panel: 250 KVA transformer
- Internal electrification: PVC conduit concealed wiring
- External lighting, common area lighting
- Earthing and lightning protection as per IS 3043
- Diesel Generator: 250 KVA (backup for common areas)

FIRE FIGHTING
-------------
- Wet riser system with fire pump
- Portable fire extinguishers at each floor
- Fire alarm and detection system

LIFTS
-----
- 2 Passenger lifts: 8-person (630 kg) capacity each
- Machine room less (MRL) type

FINISHES
--------
Plastering: 12mm internal, 15mm external + texture paint
Flooring: 600x600 vitrified tiles in apartments, granite in lobbies
Waterproofing: Dr. Fixit terrace system, crystalline bathrooms, basement membrane
Doors: Teak wood main door, hollow-core internal doors
Windows: Aluminium powder-coated with 5mm glass
Painting: 2 coats OBD interior, weatherproof exterior emulsion

EXTERNAL WORKS
--------------
- Compound wall with main gate
- Paver block flooring in podium and driveway
- Underground drainage connection to BMC sewer
- Landscaping: soft landscaping with grass and shrubs
- Rooftop garden with pergola seating area and drip irrigation

PROJECT TIMELINE
----------------
Estimated Start: 15-May-2026
Target Completion: 30-November-2027 (18 months)
`.trim();

// ---------------------------------------------------------------------------
// COLOUR HELPERS
// ---------------------------------------------------------------------------
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m",
  green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m",
};
const pass    = (msg: string) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const fail    = (msg: string) => console.log(`  ${C.red}✗${C.reset} ${C.red}${msg}${C.reset}`);
const info    = (msg: string) => console.log(`  ${C.cyan}→${C.reset} ${msg}`);
const warn    = (msg: string) => console.log(`  ${C.yellow}⚠${C.reset} ${msg}`);
const section = (t: string) => {
  console.log(`\n${C.bold}${C.cyan}══════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${t}${C.reset}`);
  console.log(`${C.cyan}══════════════════════════════════════════${C.reset}`);
};

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${C.bold}BLUQ PIPELINE TEST (no DB)${C.reset}`);
  console.log(`${C.dim}Date: ${new Date().toISOString()}${C.reset}`);

  const startTime = Date.now();

  // =========================================================================
  // PRE-FLIGHT CHECKS
  // =========================================================================
  section("PRE-FLIGHT CHECKS");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { fail("ANTHROPIC_API_KEY not set in .env"); process.exit(1); }
  pass("ANTHROPIC_API_KEY is set");

  // =========================================================================
  // STEP 1: CONSTRUCT PARSED DOCUMENT
  // =========================================================================
  section("STEP 1: CONSTRUCT PARSED DOCUMENT");

  const parsedDocs: ParsedDocument[] = [{
    fileName: "scope_of_work_test.txt",
    fileType: "txt",
    contentType: "text",
    contents: [{ type: "text", text: SAMPLE_SOW }],
    metadata: { wordCount: SAMPLE_SOW.split(/\s+/).length },
  }];

  pass(`Document ready: ${parsedDocs[0].fileName} (~${parsedDocs[0].metadata.wordCount} words)`);

  // =========================================================================
  // STEP 2: EXTRACT PARAMETERS VIA CLAUDE
  // =========================================================================
  section("STEP 2: EXTRACT PARAMETERS (Claude Sonnet + full task library)");
  info("Calling Claude API... (~20s first call, cache hit on repeat runs)");

  let params: ProjectParameters;

  try {
    const t0 = Date.now();
    const result = await extractParameters(parsedDocs, apiKey, {
      runs: 1,
      projectRegion: "MH",
      projectCity: "Pune",
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!result.success || !result.parameters) {
      fail(`Extraction failed: ${result.error}`);
      process.exit(1);
    }

    params = result.parameters;
    pass(`Extracted in ${elapsed}s`);

    console.log(`\n  ${C.dim}─────────────────────────────────${C.reset}`);
    console.log(`  buildingType    : ${C.bold}${params.buildingType}${C.reset}`);
    console.log(`  floors          : ${C.bold}${params.floors}${C.reset} + ${params.basements} basement(s)`);
    console.log(`  totalArea       : ${C.bold}${params.totalArea} sqm${C.reset}`);
    console.log(`  typicalFloor    : ${C.bold}${params.typicalFloorArea} sqm${C.reset}`);
    console.log(`  plotArea        : ${C.bold}${params.plotArea} sqm${C.reset}`);
    console.log(`  totalUnits      : ${C.bold}${params.totalUnits}${C.reset}`);
    console.log(`  regionCode      : ${C.bold}${params.regionCode}${C.reset} (${params.city})`);
    console.log(`  soilType        : ${C.bold}${params.soilType}${C.reset}`);
    console.log(`  foundationType  : ${C.bold}${params.foundationType}${C.reset}`);
    console.log(`  structuralSystem: ${C.bold}${params.structuralSystem}${C.reset}`);
    console.log(`  lifts           : ${C.bold}${params.lifts}${C.reset}`);
    console.log(`  dgSet           : ${C.bold}${params.dgSet}${C.reset}`);
    console.log(`  fireProtection  : ${C.bold}${params.fireProtection}${C.reset}`);
    console.log(`  stp             : ${C.bold}${params.stp}${C.reset}`);
    console.log(`  basementParking : ${C.bold}${params.basementParking}${C.reset}`);
    console.log(`  rainwaterHarv.  : ${C.bold}${params.rainwaterHarvesting}${C.reset}`);
    console.log(`  startDate       : ${C.bold}${params.startDate || "not found"}${C.reset}`);
    console.log(`  endDate         : ${C.bold}${params.endDate || "not found"}${C.reset}`);
    console.log(`  confidence      : ${C.bold}${params.confidence?.overall}${C.reset}`);
    if (params.confidence?.notes?.length) params.confidence.notes.forEach(n => info(n));
    if (params.novelScopeItems?.length) {
      warn(`Novel scope items (${params.novelScopeItems.length}):`);
      params.novelScopeItems.forEach(n => warn(`  "${n}"`));
    } else {
      info("No novel scope items — all covered by library ✓");
    }
    console.log(`  ${C.dim}─────────────────────────────────${C.reset}`);

  } catch (err: any) {
    fail(`Exception: ${err.message}`);
    process.exit(1);
  }

  // =========================================================================
  // STEP 3: SELECT TASKS (deterministic, no AI)
  // =========================================================================
  section("STEP 3: SELECT TASKS (Rules Engine — deterministic)");

  let rulesResult: RulesEngineResult;

  try {
    rulesResult = selectTasks(params!);
    pass(`Rules engine complete`);
    console.log(`\n  ${printTaskSummary(rulesResult).split("\n").join("\n  ")}`);
    if (rulesResult.warnings.length) {
      console.log();
      rulesResult.warnings.forEach(w => warn(w));
    }
  } catch (err: any) {
    fail(`Rules engine crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  // =========================================================================
  // STEP 4: CALCULATE SCHEDULE (CPM)
  // =========================================================================
  section("STEP 4: CALCULATE SCHEDULE (CPM + monsoon)");

  let scheduleResult: ScheduleResult;

  try {
    const t0 = Date.now();
    scheduleResult = calculateSchedule(rulesResult!.tasks, params!);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    pass(`Calculated in ${elapsed}s`);

    const s = scheduleResult.summary;
    console.log(`\n  ${C.dim}─────────────────────────────────${C.reset}`);
    console.log(`  Total tasks         : ${C.bold}${s.totalTasks}${C.reset}`);
    console.log(`  Total duration      : ${C.bold}${s.totalDurationDays} days${C.reset}`);
    console.log(`  Project start       : ${C.bold}${s.projectStartDate}${C.reset}`);
    console.log(`  Project end         : ${C.bold}${s.projectEndDate}${C.reset}`);
    console.log(`  Critical path tasks : ${C.bold}${s.criticalPathTasks}${C.reset}`);
    console.log(`  Monsoon impact days : ${C.bold}${s.totalMonsoonImpactDays}${C.reset}`);
    if (s.timelineCompression) warn("Timeline compressed to fit target dates");
    console.log(`  ${C.dim}─────────────────────────────────${C.reset}`);

    // First 20 tasks
    console.log(`\n  ${C.dim}${"Code".padEnd(18)}${"Name".padEnd(46)}${"Days".padEnd(6)}${"Start".padEnd(13)}${"End".padEnd(13)}CP${C.reset}`);
    console.log(`  ${C.dim}${"─".repeat(102)}${C.reset}`);
    scheduleResult.tasks.slice(0, 20).forEach(t => {
      const cp = t.isCriticalPath ? `${C.red}★${C.reset}` : " ";
      const name = (t.fullName || "").slice(0, 44).padEnd(45);
      console.log(`  ${t.code.padEnd(18)}${name} ${String(t.finalDurationDays).padEnd(5)} ${(t.startDate || "").padEnd(12)} ${(t.endDate || "").padEnd(12)} ${cp}`);
    });
    if (scheduleResult.tasks.length > 20) info(`... and ${scheduleResult.tasks.length - 20} more tasks`);

    // Tasks by phase breakdown
    console.log(`\n  Tasks by phase:`);
    const byPhase = new Map<string, number>();
    scheduleResult.tasks.forEach(t => byPhase.set(t.phase, (byPhase.get(t.phase) || 0) + 1));
    [...byPhase.entries()].sort((a, b) => b[1] - a[1]).forEach(([phase, count]) => {
      console.log(`  ${C.dim}  ${phase.padEnd(25)} ${count} tasks${C.reset}`);
    });

  } catch (err: any) {
    fail(`Schedule calculation crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  // =========================================================================
  // STEP 5: NOVEL TASKS VIA CLAUDE HAIKU
  // =========================================================================
  section("STEP 5: NOVEL TASK GENERATION (Claude Haiku)");

  let novelTasks: Awaited<ReturnType<typeof generateNovelTasks>> = [];

  if (params!.novelScopeItems.length > 0) {
    info(`Generating tasks for ${params!.novelScopeItems.length} novel item(s) via Haiku...`);
    try {
      const t0 = Date.now();
      novelTasks = await generateNovelTasks(
        params!.novelScopeItems, params!, apiKey,
        scheduleResult!.summary.projectEndDate,
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      pass(`Generated ${novelTasks.length} novel task(s) in ${elapsed}s`);
      novelTasks.forEach(t => {
        info(`  ${t.code} | ${t.phase} | ${t.fullName} | ${t.finalDurationDays}d | source:${t.source}`);
      });
    } catch (err: any) {
      warn(`Novel task generation failed (non-fatal): ${err.message}`);
    }
  } else {
    pass("No novel scope items — Haiku call skipped");
  }

  // =========================================================================
  // FINAL REPORT
  // =========================================================================
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const allTasks = [...scheduleResult!.tasks, ...novelTasks];

  section("RESULT");
  console.log(`\n  ${C.green}${C.bold}ALL STEPS PASSED${C.reset}`);
  console.log(`\n  Total time    : ${totalTime}s`);
  console.log(`  Tasks         : ${C.bold}${allTasks.length}${C.reset} (${scheduleResult!.tasks.length} standard + ${novelTasks.length} AI-generated)`);
  console.log(`  Duration      : ${C.bold}${scheduleResult!.summary.totalDurationDays} days${C.reset}`);
  console.log(`  Critical path : ${C.bold}${scheduleResult!.summary.criticalPathTasks} tasks${C.reset}`);
  console.log(`  Building      : ${C.bold}${params!.buildingType}${C.reset} | ${params!.floors}F | ${params!.regionCode} | ${params!.city}`);
  console.log(`\n  ${C.dim}Pipeline is working. To test DB save, create a project via POST /projects`);
  console.log(`  then trigger the full worker via POST /schedule/generate.${C.reset}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error(`\n${C.red}FATAL:${C.reset}`, err);
  process.exit(1);
});
