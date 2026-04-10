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

  // Floor info
  floorNumber?: number;
  floorLabel?: string;

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
  regionalAdjustments: {
    labourCostIndex: number;
    materialCostIndex: number;
    productivityIndex: number;
    monsoonMifMultiplier: number;
  };
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
  };
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
  // PASS 5: Timeline fitting — compress or expand to meet PM's end date
  // ---------------------------------------------------------------------------
  let timelineCompression = 1.0;

  if (params.endDate) {
    const requestedEndDate = new Date(params.endDate);
    const naturalEndDate = new Date(projectStartDate);
    naturalEndDate.setDate(naturalEndDate.getDate() + maxFinish);

    const requestedDays = Math.ceil(
      (requestedEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (requestedDays > 0 && maxFinish > 0) {
      timelineCompression = requestedDays / maxFinish;
    }
  }

  // ---------------------------------------------------------------------------
  // PASS 6: Assign final dates and identify critical path
  // ---------------------------------------------------------------------------
  let totalMonsoonImpactDays = 0;
  const phaseSummary: Record<string, { tasks: number; durationDays: number }> = {};

  for (const task of scheduledTasks) {
    const cpm = finalCpmResult.get(task.code) || { earliestStart: 0, earliestFinish: task.adjustedDurationDays };

    // Apply timeline compression
    const compressedStart = Math.round(cpm.earliestStart * timelineCompression);
    const compressedDuration = Math.max(1, Math.round(task.adjustedDurationDays * timelineCompression));

    task.earliestStart = compressedStart;
    task.earliestFinish = compressedStart + compressedDuration;
    task.finalDurationDays = compressedDuration;

    // Calculate dates
    const startDate = new Date(projectStartDate);
    startDate.setDate(startDate.getDate() + compressedStart);
    task.startDate = startDate.toISOString().split("T")[0];

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + compressedDuration);
    task.endDate = endDate.toISOString().split("T")[0];

    // Track monsoon impact
    totalMonsoonImpactDays += task.monsoonAdjustedDays;

    // Phase summary
    if (!phaseSummary[task.phase]) {
      phaseSummary[task.phase] = { tasks: 0, durationDays: 0 };
    }
    phaseSummary[task.phase].tasks++;
    phaseSummary[task.phase].durationDays += compressedDuration;
  }

  // Identify critical path (tasks with zero float)
  const projectEndDay = Math.max(...scheduledTasks.map(t => t.earliestFinish));

  // Backward pass for float calculation
  const latestFinish = new Map<string, number>();
  const successorMap = new Map<string, string[]>();

  for (const task of scheduledTasks) {
    if (!successorMap.has(task.code)) successorMap.set(task.code, []);
    for (const pred of task.predecessors) {
      if (!successorMap.has(pred.taskCode)) successorMap.set(pred.taskCode, []);
      successorMap.get(pred.taskCode)!.push(task.code);
    }
  }

  // Initialize: tasks with no successors have LF = project end
  for (const task of scheduledTasks) {
    const successors = successorMap.get(task.code) || [];
    if (successors.length === 0) {
      latestFinish.set(task.code, projectEndDay);
    }
  }

  // Process in reverse topological order
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
          // Account for lag
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

  return {
    tasks: scheduledTasks,
    summary: {
      totalTasks: scheduledTasks.length,
      totalDurationDays: projectEndDay,
      projectStartDate: projectStartDate.toISOString().split("T")[0],
      projectEndDate: projectEndDate.toISOString().split("T")[0],
      criticalPathLength: projectEndDay,
      criticalPathTasks,
      timelineCompression,
      monsoonMonths,
      totalMonsoonImpactDays,
      phases: phaseSummary,
    },
  };
}