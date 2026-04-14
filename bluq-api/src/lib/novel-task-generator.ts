// =============================================================================
// NOVEL TASK GENERATOR
// =============================================================================
// When parameter extraction finds scope items not covered by the 143-task
// library (e.g., helipad, rooftop garden, amphitheatre), this module uses
// Claude Haiku to generate TaskTemplate-compatible tasks for them.
//
// Generated tasks are:
//   - Flagged with source: "ai_generated"
//   - Appended after the main schedule
//   - Shown to PM with "AI-generated, needs review" badge in the frontend
//   - Never auto-approved — PM must manually confirm or delete each one
//
// Uses Claude Haiku (not Sonnet) — cheap and fast for structured generation.
// Task library is sent as cached context so Haiku knows the exact format.
// =============================================================================

import type { ProjectParameters } from "./parameter-extractor.js";
import type { ScheduledTask } from "./duration-calculator.js";
import { CORE_TASKS } from "./task-library.js";

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
// MAIN FUNCTION
// ---------------------------------------------------------------------------

/**
 * Generate ScheduledTask entries for novel scope items using Claude Haiku.
 *
 * @param novelScopeItems - Items from parameter extraction not in the library
 * @param params - Full project parameters (for context: region, floors, area)
 * @param apiKey - Anthropic API key
 * @param mainScheduleEndDate - ISO date — novel tasks start after main schedule
 * @returns ScheduledTask[] with source: "ai_generated"
 */
export async function generateNovelTasks(
  novelScopeItems: string[],
  params: ProjectParameters,
  apiKey: string,
  mainScheduleEndDate: string,
): Promise<ScheduledTask[]> {
  if (novelScopeItems.length === 0) return [];

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
      return [];
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
      return [];
    }

    console.log(`[novel-task-generator] Generated ${generated.length} novel tasks via Haiku`);

    // Convert to ScheduledTask format, placed sequentially after main schedule
    return convertToScheduledTasks(generated, mainScheduleEndDate, params);

  } catch (err: any) {
    // Non-fatal: log and continue. PM will be notified via novelScopeItems in the schedule version.
    console.error("[novel-task-generator] Failed:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// CONVERTER — GeneratedTask[] → ScheduledTask[]
// ---------------------------------------------------------------------------

function convertToScheduledTasks(
  generated: GeneratedTask[],
  mainScheduleEndDate: string,
  params: ProjectParameters,
): ScheduledTask[] {
  const results: ScheduledTask[] = [];
  let currentStart = new Date(mainScheduleEndDate);

  // Add 1 day gap after main schedule before novel tasks begin
  currentStart.setDate(currentStart.getDate() + 1);

  for (const t of generated) {
    const durationDays = Math.max(1, Math.round(t.durationDays || 7));
    const startDate = formatDate(currentStart);
    const endDate = addDays(currentStart, durationDays - 1);

    results.push({
      // Identity
      code: t.code,
      originalCode: t.code,
      phase: sanitizePhase(t.phase),
      name: t.name,
      fullName: t.name,
      unit: sanitizeUnit(t.unit),

      // Floor info — novel tasks are project-level (not per-floor)
      floorNumber: undefined,
      floorLabel: undefined,

      // Quantities — unknown for novel tasks, PM will fill in
      estimatedQuantity: 1,
      quantityUnit: t.unit,
      baseDurationDays: durationDays,
      adjustedDurationDays: durationDays,
      finalDurationDays: durationDays,

      // Dates — sequential after main schedule
      startDate,
      endDate: formatDate(addDays(currentStart, durationDays - 1)),

      // Dependencies — no cross-references to main schedule tasks
      predecessors: [],

      // Crew
      crew: Array.isArray(t.crew) ? t.crew : [{ role: "Specialist", count: 1 }],

      // MIF — no monsoon calculation for novel tasks (PM adjusts)
      monsoonImpactFactor: 1.0,
      monsoonOverlapDays: 0,
      monsoonAdjustedDays: 0,

      // Scheduling metadata — novel tasks are never on critical path
      earliestStart: 0,
      earliestFinish: durationDays,
      isCriticalPath: false,
      totalFloat: 999,

      // Source — this is the key flag the frontend reads for the badge
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

    // Next novel task starts the day after this one ends
    currentStart = new Date(endDate);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return results;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const VALID_PHASES = new Set([
  "site_preparation", "foundation", "plinth", "superstructure", "masonry",
  "plumbing", "electrical", "plastering", "waterproofing", "flooring",
  "doors_windows", "painting", "external_works", "approvals_handover",
  "special_systems", "hvac", "facade", "heavy_structure",
]);

function sanitizePhase(phase: string): string {
  if (VALID_PHASES.has(phase)) return phase;
  return "special_systems"; // safe default for unknown phases
}

const VALID_UNITS = new Set([
  "LS", "Sqm", "Cum", "Rmt", "MT", "Each", "Per flat", "Kg", "Nos", "Set", "kWp",
]);

function sanitizeUnit(unit: string): string {
  if (VALID_UNITS.has(unit)) return unit;
  return "LS"; // safe default
}
