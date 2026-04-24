// =============================================================================
// NOVEL TASK GENERATOR
// =============================================================================
// When parameter extraction finds scope items not covered by the 143-task
// library (e.g., helipad, rooftop garden, amphitheatre), this module uses
// Claude Haiku to generate TaskTemplate-compatible tasks for them.
//
// Generated tasks are:
//   - Flagged with source: "ai_generated" (placed) or "ai_generated_unplaced"
//   - Inserted at the correct phase boundary in the schedule (NOT appended at end)
//   - Shown to PM with "AI-generated, needs review" badge in the frontend
//   - Never auto-approved — PM must manually confirm or delete each one
//
// IMPORTANT: Novel task placement is driven entirely by the `predecessorPhases`
// field returned by the AI. The scope document is the source of truth for what
// comes before a novel task — no hardcoded phase mapping exists here. If a
// novel task's predecessorPhases cannot be resolved to actual tasks in this
// project, it is flagged as unplaced and the PM is warned.
//
// Uses Claude Haiku (not Sonnet) — cheap and fast for structured generation.
// Task library is sent as cached context so Haiku knows the exact format.
// =============================================================================

import type { ProjectParameters } from "./parameter-extractor.js";
import type { ScheduledTask } from "./duration-calculator.js";

// ---------------------------------------------------------------------------
// SYSTEM PROMPT (cached) — task format template
// ---------------------------------------------------------------------------

const NOVEL_TASK_SYSTEM_PROMPT = `You are a construction task generator for Indian construction projects.

You will be given a list of scope items that are NOT covered by the standard 143-task library.
Your job: generate construction tasks for these novel scope items in exact JSON format.

TASK FORMAT — each task must follow this structure exactly:
{
  "code": "AI-01",                          // AI-01, AI-02, AI-03, etc.
  "name": "short task name (max 60 chars)",
  "phase": "one of: site_preparation | foundation | plinth | superstructure | masonry | plumbing | electrical | plastering | waterproofing | flooring | doors_windows | painting | external_works | approvals_handover | special_systems | hvac | facade | heavy_structure",
  "unit": "one of: LS | Sqm | Cum | Rmt | MT | Each | Per flat | Kg | Nos | Set | kWp",
  "durationDays": 14,                       // realistic construction duration in calendar days
  "contractorType": "Civil",               // one of: Civil | Plumbing | Electrical | Waterproofing | Flooring | Carpentry | Painting | Fabrication | Lift Company | Fire Fighting | HVAC | Landscaping | Specialist
  "crew": [
    { "role": "role name", "count": 2 }    // typical Indian construction crew
  ],
  "predecessorPhases": ["external_works"],  // which phase must finish before this starts (use phase names, not task codes)
  "remarks": "Brief note on what this task covers and why it's novel"
}

RULES:
1. Output ONLY a valid JSON array. No markdown, no explanation.
2. Generate exactly one task per scope item (combine sub-tasks if needed).
3. Duration must be realistic for Indian construction pace (not optimistic).
4. Use Indian construction terminology for crew roles.
5. For predecessorPhases, pick the phase that logically precedes this work.
6. If the scope item is actually a standard task in disguise, say so in remarks.
7. Mark unusual or specialized items with "SPECIALIST:" prefix in remarks.

EXAMPLE OUTPUT:
[
  {
    "code": "AI-01",
    "name": "Rooftop garden — soil, planters & irrigation",
    "phase": "external_works",
    "unit": "Sqm",
    "durationDays": 21,
    "crew": [
      { "role": "Landscape Contractor", "count": 1 },
      { "role": "Labourer", "count": 4 }
    ],
    "predecessorPhases": ["waterproofing"],
    "remarks": "SPECIALIST: Rooftop garden requires waterproofing completion first. Includes soil medium, planters, drip irrigation, and light fixtures."
  }
]`;

// ---------------------------------------------------------------------------
// GENERATED TASK TYPE (what Claude returns)
// ---------------------------------------------------------------------------

interface GeneratedTask {
  code: string;
  name: string;
  phase: string;
  unit: string;
  durationDays: number;
  contractorType: string;
  crew: Array<{ role: string; count: number }>;
  predecessorPhases: string[];
  remarks: string;
}

// ---------------------------------------------------------------------------
// RETURN TYPE
// ---------------------------------------------------------------------------

export interface GenerateNovelTasksResult {
  tasks: ScheduledTask[];
  placementWarnings: string[];
}

// ---------------------------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------------------------

/**
 * Generate ScheduledTask entries for novel scope items using Claude Haiku.
 *
 * @param novelScopeItems - Items from parameter extraction not in the library
 * @param params - Full project parameters (for context: region, floors, area)
 * @param apiKey - Anthropic API key
 * @param scheduledTasks - The main schedule; used to place novel tasks at the
 *   correct phase boundary rather than blindly appending them at the end.
 */
export async function generateNovelTasks(
  novelScopeItems: string[],
  params: ProjectParameters,
  apiKey: string,
  scheduledTasks: ScheduledTask[],
): Promise<GenerateNovelTasksResult> {
  if (novelScopeItems.length === 0) return { tasks: [], placementWarnings: [] };

  const userPrompt = `
Project context:
- Building type: ${params.buildingType}
- Floors: ${params.floors} above ground + ${params.basements} basement(s)
- Total area: ${params.totalArea} sqm
- Region: ${params.regionCode} (${params.city})
- Structural system: ${params.structuralSystem}

Novel scope items NOT covered by the standard task library:
${novelScopeItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Generate one task per item. Output ONLY a JSON array.`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: NOVEL_TASK_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[novel-task-generator] Haiku API error: ${response.status} — ${errBody}`);
      return { tasks: [], placementWarnings: [] };
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const responseText = data.content
      .filter(b => b.type === "text" && b.text)
      .map(b => b.text!)
      .join("");

    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const generated = JSON.parse(cleanJson) as GeneratedTask[];

    if (!Array.isArray(generated)) {
      console.error("[novel-task-generator] Response was not an array");
      return { tasks: [], placementWarnings: [] };
    }

    console.log(`[novel-task-generator] Generated ${generated.length} novel tasks via Haiku`);

    return convertToScheduledTasks(generated, scheduledTasks, params);

  } catch (err: any) {
    // Non-fatal: log and continue. PM will be notified via novelScopeItems in the schedule version.
    console.error("[novel-task-generator] Failed:", err.message);
    return { tasks: [], placementWarnings: [] };
  }
}

// ---------------------------------------------------------------------------
// CONVERTER — GeneratedTask[] → ScheduledTask[]
// ---------------------------------------------------------------------------

// IMPORTANT: Novel task placement is driven entirely by the `predecessorPhases`
// field returned by the AI. The scope document is the source of truth for what
// precedes each novel task. No hardcoded phase mapping exists here. If
// predecessorPhases is empty or references a phase not present in this project,
// the task is flagged as unplaced and the PMC is warned.

function convertToScheduledTasks(
  generated: GeneratedTask[],
  scheduledTasks: ScheduledTask[],
  params: ProjectParameters,
): GenerateNovelTasksResult {
  const results: ScheduledTask[] = [];
  const placementWarnings: string[] = [];

  // Build a map: normalizedPhase → latest endDate task in that phase
  const phaseLatestEnd = new Map<string, { endDate: string; code: string }>();
  for (const t of scheduledTasks) {
    const norm = t.phase.toLowerCase();
    const existing = phaseLatestEnd.get(norm);
    if (!existing || t.endDate > existing.endDate) {
      phaseLatestEnd.set(norm, { endDate: t.endDate, code: t.code });
    }
  }

  for (const t of generated) {
    const durationDays = Math.max(1, Math.round(t.durationDays || 7));
    const predecessorPhases: string[] = Array.isArray(t.predecessorPhases) ? t.predecessorPhases : [];

    // ------------------------------------------------------------------
    // Scenario 1: predecessorPhases is empty or null
    // ------------------------------------------------------------------
    if (predecessorPhases.length === 0) {
      placementWarnings.push(
        `Could not place ${t.name} in schedule — predecessor phase unknown. Manual placement required.`
      );
      results.push(makeUnplacedTask(t, durationDays));
      continue;
    }

    // ------------------------------------------------------------------
    // Find the latest endDate among all matching predecessor phases
    // ------------------------------------------------------------------
    let latestEnd: string | null = null;
    let latestPredCode: string | null = null;
    const missingPhases: string[] = [];

    for (const phase of predecessorPhases) {
      const norm = phase.toLowerCase().trim();
      const entry = phaseLatestEnd.get(norm);
      if (!entry) {
        missingPhases.push(phase);
        continue;
      }
      if (!latestEnd || entry.endDate > latestEnd) {
        latestEnd = entry.endDate;
        latestPredCode = entry.code;
      }
    }

    // ------------------------------------------------------------------
    // Scenario 2: every referenced phase has no tasks in this project
    // ------------------------------------------------------------------
    if (!latestEnd) {
      const phaseList = missingPhases.join(", ");
      placementWarnings.push(
        `Could not place ${t.name} in schedule — referenced phase ${phaseList} has no tasks in this project. Manual placement required.`
      );
      results.push(makeUnplacedTask(t, durationDays));
      continue;
    }

    // ------------------------------------------------------------------
    // Happy path: place 1 day after latest predecessor phase end
    // ------------------------------------------------------------------
    const startDate = addCalendarDays(latestEnd, 1);
    const endDate = addCalendarDays(startDate, durationDays - 1);

    const predecessor = latestPredCode
      ? [{ taskCode: latestPredCode, type: "FS" as const, lagDays: 1, note: "ai_generated phase predecessor" }]
      : [];

    results.push({
      code: t.code,
      originalCode: t.code,
      phase: sanitizePhase(t.phase),
      name: t.name,
      fullName: t.name,
      unit: sanitizeUnit(t.unit),

      floorNumber: undefined,
      floorLabel: undefined,

      estimatedQuantity: 1,
      quantityUnit: t.unit,
      baseDurationDays: durationDays,
      adjustedDurationDays: durationDays,
      finalDurationDays: durationDays,

      startDate,
      endDate,

      predecessors: predecessor,

      crew: Array.isArray(t.crew) ? t.crew : [{ role: "Specialist", count: 1 }],

      monsoonImpactFactor: 1.0,
      monsoonOverlapDays: 0,
      monsoonAdjustedDays: 0,

      earliestStart: 0,
      earliestFinish: durationDays,
      isCriticalPath: false,
      totalFloat: 999,

      source: "ai_generated",
      isPerFloor: false,
      isPerFlat: false,
      contractorType: t.contractorType || "Civil",
      regionalAdjustments: {
        labourCostIndex: 1.0,
        materialCostIndex: 1.0,
        productivityIndex: 1.0,
        monsoonMifMultiplier: 1.0,
      },
    });
  }

  return { tasks: results, placementWarnings };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function makeUnplacedTask(t: GeneratedTask, durationDays: number): ScheduledTask {
  return {
    code: t.code,
    originalCode: t.code,
    phase: sanitizePhase(t.phase),
    name: t.name,
    fullName: t.name,
    unit: sanitizeUnit(t.unit),
    floorNumber: undefined,
    floorLabel: undefined,
    estimatedQuantity: 1,
    quantityUnit: t.unit,
    baseDurationDays: durationDays,
    adjustedDurationDays: durationDays,
    finalDurationDays: durationDays,
    startDate: "",
    endDate: "",
    predecessors: [],
    crew: Array.isArray(t.crew) ? t.crew : [{ role: "Specialist", count: 1 }],
    monsoonImpactFactor: 1.0,
    monsoonOverlapDays: 0,
    monsoonAdjustedDays: 0,
    earliestStart: 0,
    earliestFinish: durationDays,
    isCriticalPath: false,
    totalFloat: 999,
    source: "ai_generated_unplaced",
    isPerFloor: false,
    isPerFlat: false,
    contractorType: t.contractorType || "Civil",
    regionalAdjustments: {
      labourCostIndex: 1.0,
      materialCostIndex: 1.0,
      productivityIndex: 1.0,
      monsoonMifMultiplier: 1.0,
    },
  };
}

function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const VALID_PHASES = new Set([
  "site_preparation", "foundation", "plinth", "superstructure", "masonry",
  "plumbing", "electrical", "plastering", "waterproofing", "flooring",
  "doors_windows", "painting", "external_works", "approvals_handover",
  "special_systems", "hvac", "facade", "heavy_structure",
]);

function sanitizePhase(phase: string): string {
  if (VALID_PHASES.has(phase)) return phase;
  return "special_systems";
}

const VALID_UNITS = new Set([
  "LS", "Sqm", "Cum", "Rmt", "MT", "Each", "Per flat", "Kg", "Nos", "Set", "kWp",
]);

function sanitizeUnit(unit: string): string {
  if (VALID_UNITS.has(unit)) return unit;
  return "LS";
}
