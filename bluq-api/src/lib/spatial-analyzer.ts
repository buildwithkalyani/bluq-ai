// =============================================================================
// BLUQ SPATIAL ANALYZER
// =============================================================================
// Input:  ScheduledTask[] + ProjectParameters + projectStartDate
// Output: SpatialAnalysis — zone activity, equipment mobilization, conflicts
// =============================================================================

import { type ScheduledTask } from "./duration-calculator.js";
import { type ProjectParameters } from "./parameter-extractor.js";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type SiteZone =
  | "excavation"
  | "foundation"
  | "structure_floor"
  | "masonry_floor"
  | "finishing_floor"
  | "mep_floor"
  | "external"
  | "material_staging";

export interface WeeklyZoneActivity {
  weekStart: string;
  weekEnd: string;
  activeZones: string[];
  activeTasks: number;
  equipmentOnSite: string[];
  conflicts: string[];
}

export interface EquipmentMobilization {
  equipment: string;
  mobilizeDate: string;
  demobilizeDate: string;
  totalDaysOnSite: number;
  phases: string[];
}

export interface ConflictSummary {
  totalConflicts: number;
  craneConflicts: number;
  stagingConflicts: number;
  scaffoldingConflicts: number;
  conflictWeeks: string[];
}

export interface SpatialAnalysis {
  weeklyZoneActivity: WeeklyZoneActivity[];
  equipmentMobilization: EquipmentMobilization[];
  conflictSummary: ConflictSummary;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const EQUIPMENT_BY_PHASE: Record<string, string[]> = {
  SP: ["excavator", "compactor", "dumper"],
  FN: ["excavator", "concrete mixer", "vibrator", "dewatering pump"],
  SS: ["tower crane", "concrete mixer", "vibrator", "bar bending machine", "material hoist"],
  MW: ["scaffolding", "concrete mixer", "mortar mixer"],
  PL: ["scaffolding", "plaster machine", "mortar mixer"],
  FL: ["tile cutter", "grinder", "scaffolding"],
  PT: ["scaffolding", "spray machine"],
  EL: ["wire pulling equipment", "drill machine", "conduit bender"],
  PB: ["pipe threading machine", "welding machine", "pressure testing pump"],
  EX: ["excavator", "compactor", "concrete mixer"],
  WP: ["spray machine", "roller equipment"],
  DW: ["scaffolding", "glazing suction cups", "crane or hoist"],
};

// Material names that count toward staging congestion (must match task name substrings)
const STAGED_MATERIALS = ["steel", "cement", "brick", "glaz"];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/** Return the Monday on or before the given ISO date. */
function weekMonday(iso: string): string {
  const d = new Date(iso);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((dow + 6) % 7));
  return isoDate(d);
}

/** Extract the phase prefix (2-char uppercase) from a task code or phase string. */
function phasePrefix(task: ScheduledTask): string {
  // originalCode like "SS-01", "MW-02", etc.
  return task.originalCode.split("-")[0].toUpperCase();
}

/** Map a task to one or more SiteZone strings. */
function taskToZones(task: ScheduledTask): string[] {
  const pfx = phasePrefix(task);
  switch (pfx) {
    case "SP": return ["excavation"];
    case "FN": return ["foundation"];
    case "SS": return [`structure_floor_${task.floorNumber ?? 0}`];
    case "MW": return [`masonry_floor_${task.floorNumber ?? 0}`];
    case "FL":
    case "PT":
    case "DW":
    case "PL": return [`finishing_floor_${task.floorNumber ?? 0}`]; // PL = plastering
    case "EL":
    case "PB": return [`mep_floor_${task.floorNumber ?? 0}`];
    case "EX": return ["external"];
    default:   return ["material_staging"];
  }
}

// ---------------------------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------------------------

export function analyzeSpatial(
  scheduledTasks: ScheduledTask[],
  params: ProjectParameters,
  projectStartDate: string
): SpatialAnalysis {

  const isSingleWing = !params.wings || params.wings.length < 2;

  // -------------------------------------------------------------------------
  // Build week boundaries covering the full project
  // -------------------------------------------------------------------------
  let lastEnd = projectStartDate;
  for (const t of scheduledTasks) {
    if (t.endDate > lastEnd) lastEnd = t.endDate;
  }

  const firstMonday = weekMonday(projectStartDate);
  const weeks: Array<{ weekStart: string; weekEnd: string }> = [];
  const cursor = new Date(firstMonday);
  const lastDay = new Date(lastEnd);

  while (cursor <= lastDay) {
    const ws = isoDate(cursor);
    const we = addDays(ws, 6);
    weeks.push({ weekStart: ws, weekEnd: we });
    cursor.setDate(cursor.getDate() + 7);
  }

  // -------------------------------------------------------------------------
  // Pre-compute: equipment date ranges per equipment name
  // key → { firstDate, lastDate, phases }
  // -------------------------------------------------------------------------
  const equipMap = new Map<string, { firstDate: string; lastDate: string; phases: Set<string> }>();

  // Gather SP-phase end date and last-SS end date for tower crane special rules
  let spLastEnd: string | null = null;
  let ssLastEnd: string | null = null;
  let fnFirstStart: string | null = null;

  for (const task of scheduledTasks) {
    const pfx = phasePrefix(task);
    if (pfx === "SP") {
      if (!spLastEnd || task.endDate > spLastEnd) spLastEnd = task.endDate;
    }
    if (pfx === "FN") {
      if (!fnFirstStart || task.startDate < fnFirstStart) fnFirstStart = task.startDate;
    }
    if (pfx === "SS") {
      if (!ssLastEnd || task.endDate > ssLastEnd) ssLastEnd = task.endDate;
    }

    const equipList = EQUIPMENT_BY_PHASE[pfx] ?? [];
    for (const eq of equipList) {
      // Skip dewatering pump unless water table < 2m
      if (eq === "dewatering pump") {
        if (params.waterTableDepth === null || params.waterTableDepth >= 2) continue;
      }

      const entry = equipMap.get(eq);
      if (!entry) {
        equipMap.set(eq, { firstDate: task.startDate, lastDate: task.endDate, phases: new Set([pfx]) });
      } else {
        if (task.startDate < entry.firstDate) entry.firstDate = task.startDate;
        if (task.endDate > entry.lastDate) entry.lastDate = task.endDate;
        entry.phases.add(pfx);
      }
    }
  }

  // Apply tower crane special rules
  const cranEntry = equipMap.get("tower crane");
  if (cranEntry) {
    // Mobilize before foundation starts (SP end − 3 days, or FN start − 3 days)
    const craneMobBase = fnFirstStart ?? cranEntry.firstDate;
    cranEntry.firstDate = addDays(craneMobBase, -3);
    // Demobilize after last SS task end
    if (ssLastEnd) cranEntry.lastDate = ssLastEnd;
  }

  // Build final equipment mobilization list
  const equipmentMobilization: EquipmentMobilization[] = [];
  for (const [eq, entry] of equipMap) {
    const mobilizeDate = addDays(entry.firstDate, -2);
    const demobilizeDate = addDays(entry.lastDate, 1);
    equipmentMobilization.push({
      equipment: eq,
      mobilizeDate,
      demobilizeDate,
      totalDaysOnSite: Math.max(1, daysBetween(mobilizeDate, demobilizeDate)),
      phases: Array.from(entry.phases).sort(),
    });
  }

  // Sort by mobilize date
  equipmentMobilization.sort((a, b) => a.mobilizeDate.localeCompare(b.mobilizeDate));

  // -------------------------------------------------------------------------
  // Project total days (for tower crane % check in recommendations)
  // -------------------------------------------------------------------------
  const projectTotalDays = Math.max(1, daysBetween(projectStartDate, lastEnd));
  const craneMobEntry = equipmentMobilization.find(e => e.equipment === "tower crane");
  const craneDaysOnSite = craneMobEntry?.totalDaysOnSite ?? 0;

  // -------------------------------------------------------------------------
  // Weekly zone activity + conflict detection
  // -------------------------------------------------------------------------
  let craneConflicts = 0;
  let stagingConflicts = 0;
  let scaffoldingConflicts = 0;
  const conflictWeeks: string[] = [];

  const weeklyZoneActivity: WeeklyZoneActivity[] = weeks.map(({ weekStart, weekEnd }) => {
    // Tasks active this week
    const active = scheduledTasks.filter(t => t.startDate <= weekEnd && t.endDate >= weekStart);

    const zoneSet = new Set<string>();
    const equipSet = new Set<string>();
    const conflicts: string[] = [];

    // Active SS floors (for crane conflict)
    const activeSsFloors = new Set<number>();
    // Active finishing floors (for scaffolding conflict)
    const activeFinishFloors = new Set<number>();
    // Material deliveries this week (for staging conflict)
    let materialDeliveryCount = 0;

    for (const task of active) {
      const pfx = phasePrefix(task);

      // Zones
      for (const z of taskToZones(task)) zoneSet.add(z);
      // Always include material_staging
      zoneSet.add("material_staging");

      // Equipment
      const equipList = EQUIPMENT_BY_PHASE[pfx] ?? [];
      for (const eq of equipList) {
        if (eq === "dewatering pump") {
          if (params.waterTableDepth === null || params.waterTableDepth >= 2) continue;
        }
        equipSet.add(eq);
      }

      // Crane conflict tracking
      if (pfx === "SS" && task.floorNumber !== undefined) {
        activeSsFloors.add(task.floorNumber);
      }

      // Scaffolding conflict tracking
      if (["PL", "PT", "FL", "DW"].includes(pfx) && task.floorNumber !== undefined) {
        activeFinishFloors.add(task.floorNumber);
      }

      // Material staging: count major material tasks starting this week
      const nameLower = task.name.toLowerCase();
      if (task.startDate >= weekStart && task.startDate <= weekEnd) {
        if (STAGED_MATERIALS.some(m => nameLower.includes(m))) {
          materialDeliveryCount++;
        }
      }
    }

    // --- Conflict 1: Crane conflict ---
    if (isSingleWing && activeSsFloors.size > 1) {
      const floorList = Array.from(activeSsFloors).sort((a, b) => a - b).join(" and ");
      conflicts.push(
        `Crane conflict week of ${weekStart} — structure active on floors ${floorList} simultaneously. Consider staggering by 1 week or adding second crane.`
      );
      craneConflicts++;
    }

    // --- Conflict 2: Material staging congestion ---
    if (materialDeliveryCount > 3) {
      conflicts.push(
        `Material congestion week of ${weekStart} — ${materialDeliveryCount} deliveries scheduled. Stagger deliveries or arrange additional storage.`
      );
      stagingConflicts++;
    }

    // --- Conflict 3: Scaffolding constraint ---
    if (activeFinishFloors.size >= 3) {
      conflicts.push(
        `Scaffolding constraint week of ${weekStart} — finishing active on ${activeFinishFloors.size} floors simultaneously. Verify scaffolding inventory.`
      );
      scaffoldingConflicts++;
    }

    if (conflicts.length > 0 && !conflictWeeks.includes(weekStart)) {
      conflictWeeks.push(weekStart);
    }

    return {
      weekStart,
      weekEnd,
      activeZones: Array.from(zoneSet).sort(),
      activeTasks: active.length,
      equipmentOnSite: Array.from(equipSet).sort(),
      conflicts,
    };
  });

  // -------------------------------------------------------------------------
  // Recommendations
  // -------------------------------------------------------------------------
  const recommendations: string[] = [];

  if (craneConflicts > 0) {
    recommendations.push(
      "Consider staggering structural work between floors by at least 1 week to avoid crane bottleneck."
    );
  }

  if (stagingConflicts > 0) {
    recommendations.push(
      "Schedule steel and cement deliveries on alternate days during peak structure phase."
    );
  }

  if (craneDaysOnSite > 0 && craneDaysOnSite / projectTotalDays > 0.6) {
    recommendations.push(
      "Evaluate whether tower crane can be replaced with material hoist after structure complete — significant cost saving."
    );
  }

  if (params.waterTableDepth !== null && params.waterTableDepth < 2) {
    recommendations.push(
      "Dewatering pump required from foundation start. Confirm water table depth with soil investigation report before mobilizing."
    );
  }

  return {
    weeklyZoneActivity,
    equipmentMobilization,
    conflictSummary: {
      totalConflicts: craneConflicts + stagingConflicts + scaffoldingConflicts,
      craneConflicts,
      stagingConflicts,
      scaffoldingConflicts,
      conflictWeeks: conflictWeeks.sort(),
    },
    recommendations,
  };
}
