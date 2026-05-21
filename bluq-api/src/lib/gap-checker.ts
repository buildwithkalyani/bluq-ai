// =============================================================================
// BLUQ GAP CHECKER
// =============================================================================
// After the rules engine selects tasks, this runs a single Claude Haiku call
// to check whether any standard construction tasks appear to be missing from
// the selected list given the building parameters.
//
// Run in parallel with the duration calculator — does not add to generation time.
// Uses prompt caching — the selected task list is cached since it is large and
// consistent for the same schedule generation run.
// =============================================================================

import type { SelectedTask } from "./rules-engine.js";
import type { ProjectParameters } from "./parameter-extractor.js";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface GapCheckResult {
  suspectedGaps: Array<{
    taskName: string;
    phase: string;
    reason: string;
    confidence: "high" | "medium" | "low";
    alreadyCovered: boolean;
  }>;
  coverageAssessment: "complete" | "minor_gaps" | "significant_gaps";
  notes: string;
}

// ---------------------------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------------------------

/**
 * Check whether any standard construction tasks appear to be missing from the
 * selected task list for this building type. Uses Claude Haiku with prompt
 * caching on the task list block.
 *
 * @param selectedTasks - Tasks chosen by the rules engine
 * @param params - Project parameters (building type, floors, features)
 * @param apiKey - Anthropic API key
 */
export async function checkTaskGaps(
  selectedTasks: SelectedTask[],
  params: ProjectParameters,
  apiKey: string,
): Promise<GapCheckResult> {
  const fallback: GapCheckResult = {
    suspectedGaps: [],
    coverageAssessment: "complete",
    notes: "Gap check skipped or failed — assuming complete coverage.",
  };

  try {
    // Group tasks by phase for the prompt
    const byPhase: Record<string, string[]> = {};
    for (const t of selectedTasks) {
      if (!byPhase[t.phase]) byPhase[t.phase] = [];
      byPhase[t.phase].push(t.name);
    }

    const taskListText = Object.entries(byPhase)
      .map(([phase, names]) => `${phase}:\n${names.map(n => `  - ${n}`).join("\n")}`)
      .join("\n\n");

    // Task list goes as a cached block — large, stable per schedule generation
    const cachedTaskBlock = {
      type: "text" as const,
      text: `Selected tasks (${selectedTasks.length} total) grouped by phase:\n\n${taskListText}`,
      cache_control: { type: "ephemeral" as const },
    };

    const systemPrompt = `You are a senior construction project manager reviewing a schedule for completeness.

Your job: identify any standard construction tasks that appear to be MISSING from this schedule that a PMC would expect to see for this building type.

Rules:
1. Only flag tasks that are genuinely missing — not covered under any other name in the list
2. Maximum 5 gaps. If you find more, report only the highest confidence ones
3. Do not flag tasks that are clearly not applicable to this building type
4. If the schedule looks complete, say so
5. Output ONLY valid JSON, no explanation, no markdown

Output format:
{
  "suspectedGaps": [
    {
      "taskName": "task name",
      "phase": "phase name",
      "reason": "one sentence why this should be here",
      "confidence": "high|medium|low",
      "alreadyCovered": false
    }
  ],
  "coverageAssessment": "complete|minor_gaps|significant_gaps",
  "notes": "brief overall assessment"
}`;

    const userPrompt = `Building: ${params.buildingType}, ${params.floors} floors, ${params.city}, ${params.structuralSystem}
Features: lifts=${params.lifts}, hvac=${params.hvac}, pool=${params.pool}, basement=${params.basements}, facade=${params.facadeType}`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              cachedTaskBlock,
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[gap-checker] Haiku API error: ${response.status} — ${errBody}`);
      return fallback;
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

    const parsed = JSON.parse(cleanJson) as GapCheckResult;

    // Validate shape
    if (
      !parsed ||
      !Array.isArray(parsed.suspectedGaps) ||
      !["complete", "minor_gaps", "significant_gaps"].includes(parsed.coverageAssessment)
    ) {
      console.error("[gap-checker] Unexpected response shape:", cleanJson.slice(0, 200));
      return fallback;
    }

    // Clamp to max 5 gaps
    parsed.suspectedGaps = parsed.suspectedGaps.slice(0, 5);

    console.log(
      `[gap-checker] Coverage: ${parsed.coverageAssessment}, gaps: ${parsed.suspectedGaps.length}`
    );

    return parsed;

  } catch (err: any) {
    console.error("[gap-checker] Failed:", err.message);
    return fallback;
  }
}
