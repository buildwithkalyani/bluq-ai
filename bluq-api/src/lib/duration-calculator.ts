// =============================================================================
// BLUQ DURATION CALCULATOR & SCHEDULER
// =============================================================================
// Pure math. No AI. Deterministic.
//
// Input:  SelectedTask[] (from rules-engine.ts) + ProjectParameters
// Output: ScheduledTask[] with durations, start dates, end dates
//
// Pipeline position:
//   parsers → parameter-extractor → rules-engine → THIS → final schedule
//
// What it does:
//   1. Estimate quantities for each task (based on project area/floors)
//   2. Calculate duration = quantity ÷ productivity_rate
//   3. Apply monsoon impact factor (MIF) if task falls in monsoon months
//   4. Apply regional productivity index
//   5. Forward pass (CPM) — earliest start/finish based on dependencies
//   6. Fit to PM's requested timeline (compress or expand proportionally)
//   7. Mark critical path
// =============================================================================

import { type SelectedTask, type ResolvedPredecessor } from "./rules-engine.js";
import { type ProjectParameters } from "./parameter-extractor.js";
import { REGIONAL_PARAMS } from "./task-library.js";
import { analyzeSpatial, type SpatialAnalysis } from "./spatial-analyzer.js";

// ---------------------------------------------------------------------------
// DEBUG HELPER (Step 1 — CPM predecessor audit)
// ---------------------------------------------------------------------------

export function debugCpmInput(tasks: SelectedTask[]): string {
  const codeSet = new Set(tasks.map(t => t.code));
  const lines: string[] = [];

  lines.push(`=== CPM INPUT DEBUG ===`);
  lines.push(`Total tasks: ${tasks.length}`);
  lines.push(`Task codes:\n  ${tasks.map(t => t.code).join("\n  ")}`);
  lines.push(``);
  lines.push(`=== PREDECESSOR LOOKUP AUDIT ===`);

  let brokenCount = 0;
  for (const task of tasks) {
    if (task.predecessors.length === 0) continue;
    for (const pred of task.predecessors) {
      const exists = codeSet.has(pred.taskCode);
      if (!exists) {
        lines.push(`BROKEN  ${task.code} → ${pred.taskCode} [NOT FOUND]`);
        brokenCount++;
      } else {
        lines.push(`OK      ${task.code} → ${pred.taskCode}`);
      }
    }
  }

  lines.push(``);
  lines.push(`Broken predecessor lookups: ${brokenCount}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ScheduledTask {
  // Identity
  code: string;
  originalCode: string;
  phase: string;
  name: string;
  fullName: string;
  unit: string;

  // Floor / wing info
  floorNumber?: number;
  floorLabel?: string;
  wingCode?: string;             // "WA", "WB" — set when project has multiple wings
  wingLabel?: string;            // "Wing A", "Tower 1"

  // Calculated values
  estimatedQuantity: number;
  quantityUnit: string;
  baseDurationDays: number;       // before MIF and adjustments
  adjustedDurationDays: number;   // after MIF and regional adjustments
  finalDurationDays: number;      // after timeline fitting

  // Dates
  startDate: string;              // ISO date (YYYY-MM-DD)
  endDate: string;                // ISO date (YYYY-MM-DD)

  // Dependencies
  predecessors: ResolvedPredecessor[];

  // Crew
  crew: Array<{ role: string; count: number }>;

  // MIF detail
  monsoonImpactFactor: number;
  monsoonOverlapDays: number;     // how many days fall in monsoon
  monsoonAdjustedDays: number;    // extra days added due to monsoon

  // Scheduling metadata
  earliestStart: number;          // day number from project start
  earliestFinish: number;
  isCriticalPath: boolean;
  totalFloat: number;             // days of slack

  // Source & flags
  source: string;
  isPerFloor: boolean;
  isPerFlat: boolean;
  contractorType: string;     // from getContractorType() — used for Gantt grouping
  regionalAdjustments: {
    labourCostIndex: number;
    materialCostIndex: number;
    productivityIndex: number;
    monsoonMifMultiplier: number;
  };
}

export interface CompressionSummary {
  feasible: boolean;
  requestedDays: number;
  naturalDays: number;
  minimumPossibleDays: number;
  compressionFactor: number;          // 1.0 = no compression, 0.7 = 30% compressed
  fixedLagDaysOnCriticalPath: number; // days that cannot be compressed
  warnings: string[];
}

export interface WeeklyWorkers {
  weekStart: string;          // ISO date of Monday
  weekEnd: string;            // ISO date of Sunday
  weekNumber: number;         // 1-based from project start
  byContractor: Record<string, number>;  // contractorType → peak headcount that week
  total: number;
}

export interface EquipmentEntry {
  name: string;
  phase: string;
  mobilizationDate: string;   // 2 days before first task needing it
  demobilizationDate: string; // 1 day after last task needing it
}

export interface MaterialProcurement {
  material: string;
  phases: string[];
  firstNeededDate: string;    // earliest task start date using this material
  orderByDate: string;        // firstNeededDate − leadTimeDays
  leadTimeDays: number;
}

export interface ResourceSummary {
  weeklyWorkers: WeeklyWorkers[];
  peakWeek: { weekNumber: number; weekStart: string; total: number };
  equipment: EquipmentEntry[];
  materialProcurement: MaterialProcurement[];
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  summary: {
    totalTasks: number;
    totalDurationDays: number;
    projectStartDate: string;
    projectEndDate: string;
    criticalPathLength: number;
    criticalPathTasks: number;
    timelineCompression: number;   // 1.0 = natural, <1 = compressed, >1 = extended
    monsoonMonths: number[];
    totalMonsoonImpactDays: number;
    phases: Record<string, { tasks: number; durationDays: number }>;
    compressionSummary: CompressionSummary;
  };
  resourceSummary: ResourceSummary;
  spatialAnalysis: SpatialAnalysis;
}

// ---------------------------------------------------------------------------
// QUANTITY ESTIMATION
// ---------------------------------------------------------------------------

/**
 * Estimate quantity for a task based on project parameters.
 * These are thumb-rule estimates — they get replaced when BOQ is available.
 *
 * The PM will see these as defaults and can override in the UI.
 */
function estimateQuantity(
  task: SelectedTask,
  params: ProjectParameters
): { quantity: number; unit: string } {
  const floorArea = params.typicalFloorArea || params.totalArea / (params.floors + 1);
  const perimeter = Math.sqrt(floorArea) * 4; // approximate perimeter
  const totalFloors = params.floors + 1; // including ground
  const isPerFloor = task.isPerFloor;

  // Use original code for matching (before floor expansion)
  const code = task.originalCode;

  // --- SITE PREPARATION ---
  if (code === "SP-01") return { quantity: 1, unit: "LS" };
  if (code === "SP-02") return { quantity: params.plotArea, unit: "Sqm" };
  if (code === "SP-03") return { quantity: Math.sqrt(params.plotArea) * 4, unit: "Rmt" };
  if (code === "SP-04") return { quantity: 1, unit: "LS" };
  if (code === "SP-05") return { quantity: floorArea * 1.5 * 1.5, unit: "Cum" }; // area × depth avg
  if (code === "SP-06") return { quantity: floorArea * 1.0, unit: "Cum" };
  if (code === "SP-07") return { quantity: floorArea * 1.2, unit: "Sqm" };
  if (code === "SP-08") return { quantity: floorArea * 0.3, unit: "Cum" };
  if (code === "SP-09") return { quantity: floorArea * 0.08, unit: "Cum" };
  if (code === "SP-10") return { quantity: floorArea * 1.0, unit: "Cum" };

  // --- FOUNDATION ---
  if (code === "FN-01") return { quantity: 1, unit: "LS" };
  if (code === "FN-02") return { quantity: floorArea * 0.008, unit: "MT" }; // ~8 kg/sqm
  if (code === "FN-03") return { quantity: floorArea * 0.3, unit: "Sqm" };
  if (code === "FN-04") return { quantity: floorArea * 0.15, unit: "Cum" };
  if (code === "FN-05") return { quantity: floorArea * 0.3, unit: "Sqm" };
  if (code === "FN-06") return { quantity: floorArea * 0.1, unit: "Rmt" };
  if (code === "FN-07") return { quantity: perimeter * 0.005, unit: "MT" };
  if (code === "FN-08") return { quantity: perimeter * 0.15, unit: "Cum" };
  if (code === "FN-09") return { quantity: perimeter * 2, unit: "Sqm" };

  // --- PLINTH ---
  if (code === "PL-01") return { quantity: perimeter * 0.6 * 0.45, unit: "Cum" };
  if (code === "PL-02") return { quantity: perimeter * 0.3, unit: "Sqm" };
  if (code === "PL-03") return { quantity: floorArea * 0.6, unit: "Cum" };
  if (code === "PL-04") return { quantity: floorArea, unit: "Sqm" };
  if (code === "PL-05") return { quantity: 1, unit: "LS" };
  if (code === "PL-06") return { quantity: perimeter * 2, unit: "Rmt" };
  if (code === "PL-07") return { quantity: 1, unit: "LS" };

  // --- SUPERSTRUCTURE (per floor) ---
  if (code === "SS-01") return { quantity: floorArea * 0.006, unit: "MT" };
  if (code === "SS-02") return { quantity: floorArea * 0.15, unit: "Sqm" };
  if (code === "SS-03") return { quantity: floorArea * 0.04, unit: "Cum" };
  if (code === "SS-04") return { quantity: floorArea * 0.25, unit: "Sqm" };
  if (code === "SS-05") return { quantity: floorArea * 0.005, unit: "MT" };
  if (code === "SS-06") return { quantity: floorArea, unit: "Sqm" };
  if (code === "SS-07") return { quantity: floorArea * 0.008, unit: "MT" };
  if (code === "SS-08") return { quantity: floorArea * 0.15, unit: "Cum" };
  if (code === "SS-09") return { quantity: floorArea, unit: "Sqm" };
  if (code === "SS-10") return { quantity: 3, unit: "Cum" }; // per staircase flight
  if (code === "SS-11") return { quantity: floorArea * 1.5, unit: "Sqm" };
  if (code === "SS-12") return { quantity: perimeter * 0.3 * 0.08, unit: "Cum" };

  // --- MASONRY (per floor) ---
  if (code === "MW-01") return { quantity: perimeter * 3.0 * 0.23, unit: "Cum" };
  if (code === "MW-02") return { quantity: floorArea * 0.15, unit: "Cum" };
  if (code === "MW-03") return { quantity: perimeter * 0.5, unit: "Rmt" };
  if (code === "MW-04") return { quantity: perimeter * 0.8, unit: "Rmt" };
  if (code === "MW-05") return { quantity: Math.ceil(floorArea / 30), unit: "Each" }; // ~1 opening per 30sqm
  if (code === "MW-06") return { quantity: perimeter * 3.0, unit: "Sqm" };

  // --- PLUMBING ---
  if (code === "PB-01") return { quantity: floorArea * 0.5, unit: "Rmt" };
  if (code === "PB-02") return { quantity: floorArea * 0.4, unit: "Rmt" };
  if (code === "PB-03") return { quantity: totalFloors * 3.2, unit: "Rmt" }; // per downpipe
  if (code === "PB-04") return { quantity: totalFloors * 3.2, unit: "Rmt" };
  if (code === "PB-05") return { quantity: Math.ceil(floorArea / 50) * 3, unit: "Each" }; // ~3 fixtures per unit
  if (code === "PB-06") return { quantity: 1, unit: "LS" };
  if (code === "PB-07") return { quantity: totalFloors * 3.2 * 2, unit: "Rmt" };

  // --- ELECTRICAL (per floor) ---
  if (code === "EL-01") return { quantity: floorArea * 2, unit: "Rmt" };
  if (code === "EL-02") return { quantity: floorArea * 1.5, unit: "Rmt" };
  if (code === "EL-03") return { quantity: Math.ceil(floorArea / 15), unit: "Each" };
  if (code === "EL-04") return { quantity: floorArea * 4, unit: "Rmt" };
  if (code === "EL-05") return { quantity: Math.ceil(floorArea / params.typicalFloorArea * params.totalUnits / totalFloors), unit: "Each" };
  if (code === "EL-06") return { quantity: 1, unit: "LS" };
  if (code === "EL-07") return { quantity: 2, unit: "Each" };
  if (code === "EL-08") return { quantity: 1, unit: "LS" };

  // --- PLASTERING ---
  if (code === "PT-01") return { quantity: isPerFloor ? floorArea * 2.5 : params.totalArea * 2.5, unit: "Sqm" };
  if (code === "PT-02") return { quantity: perimeter * totalFloors * 3.2, unit: "Sqm" };
  if (code === "PT-03") return { quantity: isPerFloor ? floorArea : params.totalArea, unit: "Sqm" };
  if (code === "PT-04") return { quantity: isPerFloor ? floorArea * 3.5 : params.totalArea * 3.5, unit: "Sqm" };

  // --- WATERPROOFING ---
  if (code === "WP-01") return { quantity: floorArea, unit: "Sqm" };
  if (code === "WP-02") return { quantity: floorArea * 0.15, unit: "Sqm" }; // ~15% is wet area
  if (code === "WP-03") return { quantity: floorArea * 1.5, unit: "Sqm" }; // walls + floor
  if (code === "WP-04") return { quantity: Math.max(1, Math.floor(Math.sqrt(params.totalArea) / 30)) * perimeter * 0.5, unit: "Rmt" };

  // --- FLOORING (per floor) ---
  if (code === "FL-01") return { quantity: floorArea * 0.85, unit: "Sqm" };
  if (code === "FL-02") return { quantity: floorArea * 0.70, unit: "Sqm" };
  if (code === "FL-03") return { quantity: floorArea * 0.25, unit: "Sqm" };
  if (code === "FL-04") return { quantity: floorArea * 0.15, unit: "Sqm" };
  if (code === "FL-05") return { quantity: 20, unit: "Sqm" }; // per staircase
  if (code === "FL-06") return { quantity: floorArea * 0.20, unit: "Sqm" };
  if (code === "FL-07") return { quantity: perimeter * 0.7, unit: "Rmt" };
  if (code === "FL-08") return { quantity: floorArea * 0.85, unit: "Sqm" };

  // --- DOORS & WINDOWS ---
  if (code === "DW-01") return { quantity: Math.ceil(params.totalUnits / totalFloors), unit: "Each" };
  if (code === "DW-02") return { quantity: Math.ceil(params.totalUnits / totalFloors) * 3, unit: "Each" };
  if (code === "DW-03") return { quantity: Math.ceil(params.totalUnits / totalFloors) * 2, unit: "Each" };
  if (code === "DW-04") return { quantity: floorArea * 0.12, unit: "Sqm" };
  if (code === "DW-05") return { quantity: floorArea * 0.08, unit: "Sqm" };
  if (code === "DW-06") return { quantity: perimeter * 0.15, unit: "Rmt" };
  if (code === "DW-07") return { quantity: totalFloors * 6, unit: "Rmt" }; // ~6m per flight

  // --- PAINTING ---
  if (code === "PA-01") return { quantity: isPerFloor ? floorArea * 2.5 : params.totalArea * 2.5, unit: "Sqm" };
  if (code === "PA-02") return { quantity: isPerFloor ? floorArea * 2.5 : params.totalArea * 2.5, unit: "Sqm" };
  if (code === "PA-03") return { quantity: perimeter * totalFloors * 3.2, unit: "Sqm" };
  if (code === "PA-04") return { quantity: isPerFloor ? floorArea * 0.1 : params.totalArea * 0.1, unit: "Sqm" };
  if (code === "PA-05") return { quantity: floorArea * 0.08, unit: "Sqm" };
  if (code === "PA-06") return { quantity: isPerFloor ? floorArea : params.totalArea, unit: "Sqm" };

  // --- EXTERNAL WORKS ---
  if (code === "EX-01") return { quantity: Math.sqrt(params.plotArea) * 4, unit: "Rmt" };
  if (code === "EX-02") return { quantity: 1, unit: "Each" };
  if (code === "EX-03") return { quantity: params.plotArea * 0.3, unit: "Sqm" };
  if (code === "EX-04") return { quantity: Math.sqrt(params.plotArea) * 3, unit: "Rmt" };
  if (code === "EX-05") return { quantity: Math.ceil(Math.sqrt(params.plotArea) / 15), unit: "Each" };
  if (code === "EX-06") return { quantity: 1, unit: "LS" };
  if (code === "EX-07") return { quantity: 1, unit: "LS" };
  if (code === "EX-08") return { quantity: 1, unit: "LS" };
  if (code === "EX-09") return { quantity: 1, unit: "LS" };
  if (code === "EX-10") return { quantity: params.lifts, unit: "Each" };
  if (code === "EX-11") return { quantity: 1, unit: "LS" };
  if (code === "EX-12") return { quantity: params.plotArea * 0.15, unit: "Sqm" };

  // --- HANDOVER ---
  if (code === "HO-01") return { quantity: 1, unit: "LS" };
  if (code === "HO-02") return { quantity: 1, unit: "LS" };
  if (code === "HO-03") return { quantity: 1, unit: "LS" };
  if (code === "HO-04") return { quantity: 1, unit: "LS" };
  if (code === "HO-05") return { quantity: 1, unit: "LS" };
  if (code === "HO-06") return { quantity: 1, unit: "LS" };
  if (code === "HO-07") return { quantity: 1, unit: "LS" };
  if (code === "HO-08") return { quantity: params.totalUnits, unit: "Per flat" };
  if (code === "HO-09") return { quantity: params.totalUnits, unit: "Per flat" };
  if (code === "HO-10") return { quantity: 1, unit: "LS" };

  // --- ADDITIONAL TASKS ---
  if (code === "PF-01") return { quantity: totalFloors * floorArea * 0.04, unit: "Rmt" }; // pile length
  if (code === "PF-02") return { quantity: floorArea * 0.2, unit: "Cum" };
  if (code === "PF-03") return { quantity: Math.ceil(floorArea * 0.04 * 0.02), unit: "Each" }; // 2% of piles
  if (code === "RF-01") return { quantity: floorArea * 0.015, unit: "MT" };
  if (code === "RF-02") return { quantity: floorArea * 0.5, unit: "Cum" };
  if (code === "BM-01") return { quantity: perimeter * 3.0 * 0.3, unit: "Cum" };
  if (code === "BM-02") return { quantity: floorArea * 0.2, unit: "Cum" };
  if (code === "BM-03") return { quantity: 1, unit: "LS" };
  if (code === "HV-01") return { quantity: floorArea * 0.8, unit: "Sqm" };
  if (code === "HV-02") return { quantity: Math.ceil(floorArea / 100), unit: "Each" };
  if (code === "HV-03") return { quantity: 1, unit: "LS" };
  if (code === "CW-01") return { quantity: perimeter * totalFloors * 3.2 * 0.6, unit: "Sqm" };
  if (code === "CW-02") return { quantity: perimeter * totalFloors * 3.2 * 0.6, unit: "Sqm" };
  if (code === "TC-01") return { quantity: 1, unit: "LS" };
  if (code === "TC-02") return { quantity: 1, unit: "LS" };
  if (code === "DG-01") return { quantity: 1, unit: "LS" };
  if (code === "SW-01") return { quantity: 1, unit: "LS" };
  if (code === "SW-02") return { quantity: 1, unit: "LS" };
  if (code === "SO-01") return { quantity: params.totalUnits * 1, unit: "kWp" }; // ~1kWp per unit
  if (code === "SO-02") return { quantity: 1, unit: "LS" };
  if (code === "FC-01") return { quantity: floorArea * 0.80, unit: "Sqm" };
  if (code === "FD-01") return { quantity: 1, unit: "LS" };
  if (code === "RW-01") return { quantity: 1, unit: "LS" };

  // Default fallback
  return { quantity: 1, unit: task.unit };
}


// ---------------------------------------------------------------------------
// DURATION CALCULATION
// ---------------------------------------------------------------------------

/**
 * Calculate base duration for a task.
 * duration = quantity ÷ average_productivity_rate
 *
 * For LS (lump sum) tasks, use the productivity rate directly as days.
 * For per-flat tasks, multiply quantity by rate.
 */
function calculateBaseDuration(
  quantity: number,
  rateMin: number,
  rateMax: number,
  unit: string,
  productivityUnit: string,
  isPerFlat: boolean
): number {
  const avgRate = (rateMin + rateMax) / 2;

  // LS tasks: productivity is already in days
  if (unit === "LS") {
    return avgRate;
  }

  // Per flat tasks: quantity is number of flats
  if (isPerFlat) {
    if (productivityUnit.includes("/day") || productivityUnit.includes("day")) {
      return Math.ceil(quantity / avgRate);
    }
    return Math.ceil(quantity * avgRate);
  }

  // Regular tasks: quantity ÷ rate = days
  if (avgRate <= 0) return 1;

  // Handle different productivity units
  if (productivityUnit.includes("/hr") || productivityUnit.includes("hr")) {
    // Rate is per hour — assume 8-hour workday
    return Math.max(1, Math.ceil(quantity / (avgRate * 8)));
  }

  if (productivityUnit.includes("/day") || productivityUnit.includes("day")) {
    return Math.max(1, Math.ceil(quantity / avgRate));
  }

  if (productivityUnit.includes("days")) {
    // Rate IS the duration (e.g., "3-5 days", "7 days")
    return Math.ceil(avgRate);
  }

  // Default: treat as per-day rate
  return Math.max(1, Math.ceil(quantity / avgRate));
}


// ---------------------------------------------------------------------------
// MONSOON OVERLAP CALCULATION
// ---------------------------------------------------------------------------

/**
 * Calculate how many working days of a task fall within monsoon months.
 * Returns the number of overlapping days.
 */
function calculateMonsoonOverlap(
  startDayNumber: number,
  durationDays: number,
  projectStartDate: Date,
  monsoonMonths: number[]
): number {
  if (monsoonMonths.length === 0) return 0;

  let monsoonDays = 0;
  const monsoonSet = new Set(monsoonMonths);

  for (let d = 0; d < durationDays; d++) {
    const taskDate = new Date(projectStartDate);
    taskDate.setDate(taskDate.getDate() + startDayNumber + d);
    const month = taskDate.getMonth() + 1; // 1-12

    if (monsoonSet.has(month)) {
      monsoonDays++;
    }
  }

  return monsoonDays;
}

/**
 * Apply MIF to duration based on monsoon overlap.
 * Only the days that fall in monsoon get the MIF penalty.
 *
 * adjustedDuration = nonMonsoonDays + (monsoonDays × MIF)
 */
function applyMonsoonImpact(
  baseDuration: number,
  monsoonOverlapDays: number,
  mif: number
): { adjustedDuration: number; extraDays: number } {
  if (monsoonOverlapDays === 0 || mif <= 1.0) {
    return { adjustedDuration: baseDuration, extraDays: 0 };
  }

  const nonMonsoonDays = baseDuration - monsoonOverlapDays;
  const adjustedMonsoonDays = Math.ceil(monsoonOverlapDays * mif);
  const adjustedDuration = nonMonsoonDays + adjustedMonsoonDays;
  const extraDays = adjustedDuration - baseDuration;

  return { adjustedDuration, extraDays };
}


// ---------------------------------------------------------------------------
// CPM FORWARD PASS
// ---------------------------------------------------------------------------

/**
 * Run forward pass of CPM (Critical Path Method).
 * Calculates earliest start and earliest finish for each task.
 *
 * Returns tasks sorted in topological order (ready for scheduling).
 */
function forwardPass(
  tasks: Array<{
    code: string;
    durationDays: number;
    predecessors: ResolvedPredecessor[];
  }>
): Map<string, { earliestStart: number; earliestFinish: number }> {
  const result = new Map<string, { earliestStart: number; earliestFinish: number }>();

  // Build adjacency info
  const taskDurations = new Map<string, number>();
  const taskPreds = new Map<string, ResolvedPredecessor[]>();
  for (const t of tasks) {
    taskDurations.set(t.code, t.durationDays);
    taskPreds.set(t.code, t.predecessors);
  }

  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const t of tasks) {
    if (!inDegree.has(t.code)) inDegree.set(t.code, 0);
    if (!adjList.has(t.code)) adjList.set(t.code, []);
  }

  for (const t of tasks) {
    for (const pred of t.predecessors) {
      if (taskDurations.has(pred.taskCode)) {
        inDegree.set(t.code, (inDegree.get(t.code) || 0) + 1);
        if (!adjList.has(pred.taskCode)) adjList.set(pred.taskCode, []);
        adjList.get(pred.taskCode)!.push(t.code);
      }
    }
  }

  // Process tasks with no predecessors first
  const queue: string[] = [];
  for (const [code, degree] of inDegree) {
    if (degree === 0) {
      queue.push(code);
      result.set(code, {
        earliestStart: 0,
        earliestFinish: taskDurations.get(code) || 1,
      });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentFinish = result.get(current)!.earliestFinish;

    for (const successor of adjList.get(current) || []) {
      // Find the lag for this specific predecessor→successor relationship
      const sucPreds = taskPreds.get(successor) || [];
      const predInfo = sucPreds.find(p => p.taskCode === current);
      const lag = predInfo?.lagDays || 0;

      const candidateStart = currentFinish + lag;
      const existing = result.get(successor);

      if (!existing || candidateStart > existing.earliestStart) {
        result.set(successor, {
          earliestStart: candidateStart,
          earliestFinish: candidateStart + (taskDurations.get(successor) || 1),
        });
      }

      // Decrement in-degree
      inDegree.set(successor, (inDegree.get(successor) || 0) - 1);
      if (inDegree.get(successor) === 0) {
        queue.push(successor);
      }
    }
  }

  // Handle any tasks not reached (circular deps or missing predecessors)
  for (const t of tasks) {
    if (!result.has(t.code)) {
      result.set(t.code, {
        earliestStart: 0,
        earliestFinish: t.durationDays,
      });
    }
  }

  return result;
}


// ---------------------------------------------------------------------------
// RESOURCE AGGREGATION
// ---------------------------------------------------------------------------

// Equipment needed per phase (name maps to phases that require it)
const PHASE_EQUIPMENT: Record<string, string[]> = {
  "Transit Mixer":          ["foundation", "plinth", "superstructure"],
  "Concrete Vibrator":      ["foundation", "plinth", "superstructure"],
  "Bar Bending Machine":    ["foundation", "superstructure"],
  "Scaffolding":            ["superstructure", "masonry", "plastering", "painting", "external"],
  "Tower Crane / Hoist":    ["superstructure"],
  "Excavator / JCB":        ["site-preparation", "foundation"],
  "Plate Compactor":        ["site-preparation", "plinth"],
  "Dewatering Pump":        ["foundation"],
  "Tile Cutter":            ["flooring"],
  "Plumbing Pressure Tester": ["plumbing"],
  "Cable Pulling Machine":  ["electrical"],
  "Waterproofing Spray Rig": ["waterproofing"],
};

// Materials with hardcoded lead times and the phases that consume them
const MATERIAL_LEAD_TIMES: Array<{
  material: string;
  leadTimeDays: number;
  phases: string[];
}> = [
  { material: "TMT Steel",              leadTimeDays: 21, phases: ["superstructure", "foundation"] },
  { material: "Cement",                 leadTimeDays: 7,  phases: ["superstructure", "masonry", "plinth", "foundation"] },
  { material: "Bricks",                 leadTimeDays: 3,  phases: ["masonry"] },
  { material: "Glazing",                leadTimeDays: 45, phases: ["doors-windows"] },
  { material: "Waterproofing Membrane", leadTimeDays: 14, phases: ["waterproofing"] },
  { material: "Tiles",                  leadTimeDays: 21, phases: ["flooring"] },
  { material: "Electrical Panels",      leadTimeDays: 30, phases: ["electrical"] },
  { material: "Sanitary Fixtures",      leadTimeDays: 21, phases: ["plumbing"] },
];

// Normalize phase codes from tasks to canonical phase groups
function normalizePhase(phase: string): string {
  const p = phase.toLowerCase();
  if (p.includes("site")) return "site-preparation";
  if (p.includes("found")) return "foundation";
  if (p.includes("plinth")) return "plinth";
  if (p.includes("super")) return "superstructure";
  if (p.includes("mason") || p.includes("masonry") || p.startsWith("mw")) return "masonry";
  if (p.includes("plumb") || p.startsWith("pb")) return "plumbing";
  if (p.includes("electr") || p.startsWith("el")) return "electrical";
  if (p.includes("plaster")) return "plastering";
  if (p.includes("waterp") || p.startsWith("wp")) return "waterproofing";
  if (p.includes("floor") || p.startsWith("fl")) return "flooring";
  if (p.includes("door") || p.includes("window") || p.startsWith("dw")) return "doors-windows";
  if (p.includes("paint")) return "painting";
  if (p.includes("external") || p.includes("extern") || p.startsWith("ex")) return "external";
  if (p.includes("handover") || p.startsWith("ho")) return "handover";
  return p;
}

function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function aggregateResources(
  tasks: ScheduledTask[],
  projectStartDate: string
): ResourceSummary {
  // -------------------------------------------------------------------------
  // 1. Weekly workers by contractor type
  // -------------------------------------------------------------------------
  // Find project span in calendar weeks
  const startMs = new Date(projectStartDate).getTime();
  let lastEndDate = projectStartDate;
  for (const t of tasks) {
    if (t.endDate > lastEndDate) lastEndDate = t.endDate;
  }

  // Build ISO-week boundaries (Monday–Sunday) covering the project
  // Find the Monday on or before projectStartDate
  const projectStart = new Date(projectStartDate);
  const dow = projectStart.getDay(); // 0=Sun
  const monday = new Date(projectStart);
  monday.setDate(projectStart.getDate() - ((dow + 6) % 7));

  const lastDay = new Date(lastEndDate);
  const weeks: WeeklyWorkers[] = [];
  let weekNum = 1;
  const cursor = new Date(monday);

  while (cursor <= lastDay) {
    const weekStart = cursor.toISOString().split("T")[0];
    const weekEndDate = new Date(cursor);
    weekEndDate.setDate(cursor.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split("T")[0];

    // Find all tasks active during this week
    const byContractor: Record<string, number> = {};
    let total = 0;

    for (const task of tasks) {
      // Task overlaps this week if taskStart <= weekEnd && taskEnd >= weekStart
      if (task.startDate <= weekEnd && task.endDate >= weekStart) {
        const headcount = task.crew.reduce((s, c) => s + c.count, 0);
        const ct = task.contractorType || "General";
        byContractor[ct] = (byContractor[ct] || 0) + headcount;
        total += headcount;
      }
    }

    weeks.push({ weekStart, weekEnd, weekNumber: weekNum, byContractor, total });
    weekNum++;
    cursor.setDate(cursor.getDate() + 7);
  }

  const peakWeekEntry = weeks.reduce((best, w) => w.total > best.total ? w : best, weeks[0] || { weekNumber: 1, weekStart: projectStartDate, total: 0 });
  const peakWeek = { weekNumber: peakWeekEntry.weekNumber, weekStart: peakWeekEntry.weekStart, total: peakWeekEntry.total };

  // -------------------------------------------------------------------------
  // 2. Equipment list per phase
  // -------------------------------------------------------------------------
  // Build phase → { firstStart, lastEnd } from task dates
  const phaseWindow: Record<string, { first: string; last: string }> = {};
  for (const task of tasks) {
    const phase = normalizePhase(task.phase);
    const w = phaseWindow[phase];
    if (!w) {
      phaseWindow[phase] = { first: task.startDate, last: task.endDate };
    } else {
      if (task.startDate < w.first) w.first = task.startDate;
      if (task.endDate > w.last) w.last = task.endDate;
    }
  }

  const equipment: EquipmentEntry[] = [];
  for (const [equipName, phases] of Object.entries(PHASE_EQUIPMENT)) {
    // Find earliest first-start and latest last-end across relevant phases
    let firstStart: string | null = null;
    let lastEnd: string | null = null;
    const activePhases: string[] = [];

    for (const phase of phases) {
      const w = phaseWindow[phase];
      if (!w) continue;
      activePhases.push(phase);
      if (!firstStart || w.first < firstStart) firstStart = w.first;
      if (!lastEnd || w.last > lastEnd) lastEnd = w.last;
    }

    if (!firstStart || !lastEnd) continue; // phase not present in this project

    equipment.push({
      name: equipName,
      phase: activePhases.join(", "),
      mobilizationDate: addCalendarDays(firstStart, -2),
      demobilizationDate: addCalendarDays(lastEnd, 1),
    });
  }

  // -------------------------------------------------------------------------
  // 3. Material procurement schedule
  // -------------------------------------------------------------------------
  const materialProcurement: MaterialProcurement[] = [];
  for (const mat of MATERIAL_LEAD_TIMES) {
    let firstNeeded: string | null = null;
    const presentPhases: string[] = [];

    for (const phase of mat.phases) {
      const w = phaseWindow[phase];
      if (!w) continue;
      presentPhases.push(phase);
      if (!firstNeeded || w.first < firstNeeded) firstNeeded = w.first;
    }

    if (!firstNeeded) continue; // material not needed in this project

    materialProcurement.push({
      material: mat.material,
      phases: presentPhases,
      firstNeededDate: firstNeeded,
      orderByDate: addCalendarDays(firstNeeded, -mat.leadTimeDays),
      leadTimeDays: mat.leadTimeDays,
    });
  }

  // Sort by orderByDate ascending (earliest order first)
  materialProcurement.sort((a, b) => a.orderByDate.localeCompare(b.orderByDate));

  return { weeklyWorkers: weeks, peakWeek, equipment, materialProcurement };
}


// ---------------------------------------------------------------------------
// MAIN CALCULATOR
// ---------------------------------------------------------------------------

/**
 * Calculate durations and schedule all tasks.
 *
 * @param selectedTasks - Tasks from rules engine
 * @param params - Project parameters (for quantities, dates, region)
 * @returns ScheduleResult with all tasks scheduled
 */
export function calculateSchedule(
  selectedTasks: SelectedTask[],
  params: ProjectParameters
): ScheduleResult {
  const region = REGIONAL_PARAMS[params.regionCode] || REGIONAL_PARAMS.MH;
  const monsoonMonths = region.monsoonMonths;

  // Determine project start date
  const projectStartDate = params.startDate
    ? new Date(params.startDate)
    : new Date(); // default to today

  // ---------------------------------------------------------------------------
  // PASS 1: Calculate base durations
  // ---------------------------------------------------------------------------
  const tasksWithDurations = selectedTasks.map(task => {
    const { quantity, unit: qUnit } = estimateQuantity(task, params);

    const baseDuration = calculateBaseDuration(
      quantity,
      task.productivityRateMin,
      task.productivityRateMax,
      task.unit,
      task.productivityUnit,
      task.isPerFlat
    );

    // Apply regional productivity index
    const regionalAdjustedDuration = Math.ceil(baseDuration / region.productivityIndex);

    return {
      ...task,
      estimatedQuantity: quantity,
      quantityUnit: qUnit,
      baseDurationDays: baseDuration,
      regionalAdjustedDuration,
    };
  });

  // ---------------------------------------------------------------------------
  // PASS 2: CPM forward pass (before monsoon adjustment)
  // ---------------------------------------------------------------------------
  const cpmInput = tasksWithDurations.map(t => ({
    code: t.code,
    durationDays: t.regionalAdjustedDuration,
    predecessors: t.predecessors,
  }));

  const cpmResult = forwardPass(cpmInput);

  // ---------------------------------------------------------------------------
  // PASS 3: Apply monsoon impact based on when tasks actually fall
  // ---------------------------------------------------------------------------
  const scheduledTasks: ScheduledTask[] = tasksWithDurations.map(task => {
    const cpm = cpmResult.get(task.code) || { earliestStart: 0, earliestFinish: task.regionalAdjustedDuration };

    const monsoonOverlap = calculateMonsoonOverlap(
      cpm.earliestStart,
      task.regionalAdjustedDuration,
      projectStartDate,
      monsoonMonths
    );

    const { adjustedDuration, extraDays } = applyMonsoonImpact(
      task.regionalAdjustedDuration,
      monsoonOverlap,
      task.monsoonImpactFactor
    );

    return {
      ...task,
      adjustedDurationDays: adjustedDuration,
      finalDurationDays: adjustedDuration, // will be modified if timeline fitting
      monsoonOverlapDays: monsoonOverlap,
      monsoonAdjustedDays: extraDays,
      earliestStart: cpm.earliestStart,
      earliestFinish: cpm.earliestStart + adjustedDuration,
      startDate: "",  // filled below
      endDate: "",    // filled below
      isCriticalPath: false, // filled below
      totalFloat: 0,         // filled below
    } as ScheduledTask;
  });

  // ---------------------------------------------------------------------------
  // PASS 4: Re-run CPM with monsoon-adjusted durations
  // ---------------------------------------------------------------------------
  const finalCpmInput = scheduledTasks.map(t => ({
    code: t.code,
    durationDays: t.adjustedDurationDays,
    predecessors: t.predecessors,
  }));

  const finalCpmResult = forwardPass(finalCpmInput);

  // Find the natural project end (latest finish)
  let maxFinish = 0;
  for (const [_, timing] of finalCpmResult) {
    if (timing.earliestFinish > maxFinish) {
      maxFinish = timing.earliestFinish;
    }
  }

  // ---------------------------------------------------------------------------
  // PASS 5a: Natural critical path analysis (on uncompressed schedule)
  // Used to determine minimum possible days (lag days cannot be compressed)
  // ---------------------------------------------------------------------------
  const naturalDays = maxFinish;

  // Build successor map for backward pass
  const naturalSuccessorMap = new Map<string, string[]>();
  for (const task of scheduledTasks) {
    if (!naturalSuccessorMap.has(task.code)) naturalSuccessorMap.set(task.code, []);
    for (const pred of task.predecessors) {
      if (!naturalSuccessorMap.has(pred.taskCode)) naturalSuccessorMap.set(pred.taskCode, []);
      naturalSuccessorMap.get(pred.taskCode)!.push(task.code);
    }
  }

  // Backward pass on natural schedule
  const naturalLatestFinish = new Map<string, number>();
  for (const task of scheduledTasks) {
    if ((naturalSuccessorMap.get(task.code) || []).length === 0) {
      naturalLatestFinish.set(task.code, naturalDays);
    }
  }
  const naturalSortedDesc = [...scheduledTasks].sort((a, b) => {
    return (finalCpmResult.get(b.code)?.earliestFinish || 0) - (finalCpmResult.get(a.code)?.earliestFinish || 0);
  });
  for (const task of naturalSortedDesc) {
    if (!naturalLatestFinish.has(task.code)) {
      const successors = naturalSuccessorMap.get(task.code) || [];
      let minSuccStart = naturalDays;
      for (const sucCode of successors) {
        const sucTask = scheduledTasks.find(t => t.code === sucCode);
        if (sucTask) {
          const sucLF = naturalLatestFinish.get(sucCode) || naturalDays;
          const sucLS = sucLF - sucTask.adjustedDurationDays;
          const predInfo = sucTask.predecessors.find(p => p.taskCode === task.code);
          const lag = predInfo?.lagDays || 0;
          minSuccStart = Math.min(minSuccStart, sucLS - lag);
        }
      }
      naturalLatestFinish.set(task.code, minSuccStart);
    }
  }

  // Identify natural critical path
  const naturalCriticalSet = new Set<string>();
  for (const task of scheduledTasks) {
    const lf = naturalLatestFinish.get(task.code) || naturalDays;
    const es = finalCpmResult.get(task.code)?.earliestStart || 0;
    const ls = lf - task.adjustedDurationDays;
    if (Math.max(0, ls - es) === 0) naturalCriticalSet.add(task.code);
  }

  // Sum lag days between consecutive critical path tasks
  let criticalPathLagDaysTotal = 0;
  const criticalPathTaskNames: string[] = [];
  for (const task of scheduledTasks) {
    if (!naturalCriticalSet.has(task.code)) continue;
    criticalPathTaskNames.push(task.name);
    for (const pred of task.predecessors) {
      if (naturalCriticalSet.has(pred.taskCode) && pred.lagDays > 0) {
        criticalPathLagDaysTotal += pred.lagDays;
      }
    }
  }
  const criticalPathTaskCount = naturalCriticalSet.size;
  // Lag days are physics — cannot compress. Minimum 1 day per task on critical path.
  const minimumPossibleDays = criticalPathLagDaysTotal + criticalPathTaskCount;

  // ---------------------------------------------------------------------------
  // PASS 5b: Timeline fitting — compress only task durations, never lag days
  // ---------------------------------------------------------------------------
  let timelineCompression = 1.0;
  let requestedDays = naturalDays;
  const compressionWarnings: string[] = [];
  let feasible = true;

  if (params.endDate) {
    const requestedEndDate = new Date(params.endDate);
    requestedDays = Math.ceil(
      (requestedEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (requestedDays > 0 && naturalDays > 0) {
      timelineCompression = requestedDays / naturalDays;
    }

    if (requestedDays < minimumPossibleDays) {
      feasible = false;
      compressionWarnings.push(
        `Timeline infeasible. Minimum required: ${minimumPossibleDays} days (includes ${criticalPathLagDaysTotal} days of mandatory curing/drying time). Requested: ${requestedDays} days. Critical path: [${criticalPathTaskNames.join(", ")}]`
      );
      // Cannot compress below minimum — set all tasks to 1 day, lags preserved
      timelineCompression = 1.0;
    }
  }

  if (feasible && timelineCompression < 0.7) {
    compressionWarnings.push(
      `Heavy compression applied (${Math.round(timelineCompression * 100)}%). Schedule assumes maximum crew deployment. Verify with contractor before committing.`
    );
  }

  // Compress only finalDurationDays — lags live in predecessors[] and are untouched
  for (const task of scheduledTasks) {
    if (!feasible) {
      task.finalDurationDays = 1;
    } else {
      task.finalDurationDays = Math.max(1, Math.round(task.adjustedDurationDays * timelineCompression));
    }
  }

  // Re-run forward pass with compressed durations — lags are preserved naturally
  // because forwardPass reads lagDays from task.predecessors[], which we never modify
  const compressedCpmInput = scheduledTasks.map(t => ({
    code: t.code,
    durationDays: t.finalDurationDays,
    predecessors: t.predecessors,
  }));
  const compressedCpmResult = forwardPass(compressedCpmInput);

  for (const task of scheduledTasks) {
    const cpm = compressedCpmResult.get(task.code) || { earliestStart: 0, earliestFinish: task.finalDurationDays };
    task.earliestStart = cpm.earliestStart;
    task.earliestFinish = cpm.earliestFinish;
  }

  // ---------------------------------------------------------------------------
  // PASS 6: Assign final dates and identify critical path
  // ---------------------------------------------------------------------------
  let totalMonsoonImpactDays = 0;
  const phaseSummary: Record<string, { tasks: number; durationDays: number }> = {};

  for (const task of scheduledTasks) {
    // Dates come directly from compressed forward pass — no multiplication needed
    const startDate = new Date(projectStartDate);
    startDate.setDate(startDate.getDate() + task.earliestStart);
    task.startDate = startDate.toISOString().split("T")[0];

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + task.finalDurationDays);
    task.endDate = endDate.toISOString().split("T")[0];

    totalMonsoonImpactDays += task.monsoonAdjustedDays;

    if (!phaseSummary[task.phase]) {
      phaseSummary[task.phase] = { tasks: 0, durationDays: 0 };
    }
    phaseSummary[task.phase].tasks++;
    phaseSummary[task.phase].durationDays += task.finalDurationDays;
  }

  // Identify critical path (backward pass on compressed schedule)
  const projectEndDay = Math.max(...scheduledTasks.map(t => t.earliestFinish));
  const latestFinish = new Map<string, number>();
  const successorMap = new Map<string, string[]>();

  for (const task of scheduledTasks) {
    if (!successorMap.has(task.code)) successorMap.set(task.code, []);
    for (const pred of task.predecessors) {
      if (!successorMap.has(pred.taskCode)) successorMap.set(pred.taskCode, []);
      successorMap.get(pred.taskCode)!.push(task.code);
    }
  }

  for (const task of scheduledTasks) {
    if ((successorMap.get(task.code) || []).length === 0) {
      latestFinish.set(task.code, projectEndDay);
    }
  }

  const sortedByFinishDesc = [...scheduledTasks].sort((a, b) => b.earliestFinish - a.earliestFinish);
  for (const task of sortedByFinishDesc) {
    if (!latestFinish.has(task.code)) {
      const successors = successorMap.get(task.code) || [];
      let minSuccessorStart = projectEndDay;
      for (const sucCode of successors) {
        const sucTask = scheduledTasks.find(t => t.code === sucCode);
        if (sucTask) {
          const sucLF = latestFinish.get(sucCode) || projectEndDay;
          const sucLS = sucLF - sucTask.finalDurationDays;
          const predInfo = sucTask.predecessors.find(p => p.taskCode === task.code);
          const lag = predInfo?.lagDays || 0;
          minSuccessorStart = Math.min(minSuccessorStart, sucLS - lag);
        }
      }
      latestFinish.set(task.code, minSuccessorStart);
    }
  }

  let criticalPathTasks = 0;
  for (const task of scheduledTasks) {
    const lf = latestFinish.get(task.code) || projectEndDay;
    const ls = lf - task.finalDurationDays;
    task.totalFloat = Math.max(0, ls - task.earliestStart);
    task.isCriticalPath = task.totalFloat === 0;
    if (task.isCriticalPath) criticalPathTasks++;
  }

  // ---------------------------------------------------------------------------
  // BUILD RESULT
  // ---------------------------------------------------------------------------
  const projectEndDate = new Date(projectStartDate);
  projectEndDate.setDate(projectEndDate.getDate() + projectEndDay);

  const compressionSummary: CompressionSummary = {
    feasible,
    requestedDays,
    naturalDays,
    minimumPossibleDays,
    compressionFactor: timelineCompression,
    fixedLagDaysOnCriticalPath: criticalPathLagDaysTotal,
    warnings: compressionWarnings,
  };

  const projectStartIso = projectStartDate.toISOString().split("T")[0];
  const resourceSummary = aggregateResources(scheduledTasks, projectStartIso);
  const spatialAnalysis = analyzeSpatial(scheduledTasks, params, projectStartIso);

  return {
    tasks: scheduledTasks,
    summary: {
      totalTasks: scheduledTasks.length,
      totalDurationDays: projectEndDay,
      projectStartDate: projectStartIso,
      projectEndDate: projectEndDate.toISOString().split("T")[0],
      criticalPathLength: projectEndDay,
      criticalPathTasks,
      timelineCompression,
      monsoonMonths,
      totalMonsoonImpactDays,
      phases: phaseSummary,
      compressionSummary,
    },
    resourceSummary,
    spatialAnalysis,
  };
}