// =============================================================================
// WHATSAPP MESSAGE PARSER — Claude Haiku
// =============================================================================
// Converts free-form Hindi/Hinglish/English construction site messages
// into structured JSON that maps directly to the dprs table.
//
// Called when a worker sends an unstructured update (e.g., during morning_ack):
//   "aaj ground floor slab casting complete, 12 mazdoor, 70% done"
//   → { taskDescription, floorOrArea, labourCount, workDone, percentComplete, ... }
//
// Uses prompt caching — system prompt is cached across calls in a session.
// =============================================================================

// ---------------------------------------------------------------------------
// OUTPUT TYPE — maps 1:1 to dprs table columns (except taskDescription/floorOrArea)
// ---------------------------------------------------------------------------

export interface ParsedUpdate {
  taskDescription: string | null;   // used for task matching only, NOT stored in dprs
  floorOrArea: string | null;       // used for task matching only, NOT stored in dprs
  labourCount: number | null;
  workDone: string | null;
  percentComplete: number | null;   // 0–100 integer
  remarks: string | null;           // prefixed "SAFETY:", "QUALITY:", or "Plan:" if applicable
  delayReason: string | null;
  delayDays: number | null;
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT (cached)
// ---------------------------------------------------------------------------

const PARSE_SYSTEM_PROMPT = `You are a construction site message parser for Indian construction projects.
Your job: parse a single site update message and extract structured data as JSON.

HINDI/MARATHI/HINGLISH CONSTRUCTION GLOSSARY:
mazdoor / majdoor        = labourer / worker
mistri / mistry          = mason
shuttering               = formwork
loha / sariya / rebar    = steel reinforcement
dhulai / curing          = concrete curing
plaster                  = plastering
rang / paint             = painting
tiles lagana             = tiling
nali                     = drainage pipe
bijli                    = electrical work
pani ki line             = plumbing
chhat / slab             = concrete slab / roof slab
column / khamba          = RCC column
neenv                    = foundation
brickwork / chuna / inta = masonry
poora hua / complete     = completed / done
kal                      = tomorrow
aaj                      = today
shuru                    = started
band / ruka              = stopped / halted
kam mazdoor              = less workers
cement khatam            = cement ran out

OUTPUT RULES:
1. Output ONLY a single valid JSON object. No markdown, no explanation, no extra text.
2. percentComplete must be an integer 0–100, or null if not mentioned.
3. labourCount must be a positive integer, or null if not mentioned.
4. delayDays must be a non-negative integer (0 = same-day delay), or null.
5. If a field cannot be determined from the message, set it to null. NEVER guess or invent.
6. For safety incidents: prefix remarks with "SAFETY: ".
7. For quality issues: prefix remarks with "QUALITY: ".
8. For next-day plans (no work done today): prefix remarks with "Plan: ".
9. workDone should be a clean English summary of what was accomplished.

OUTPUT FORMAT (always exactly this structure):
{
  "taskDescription": "brief English description of the work mentioned",
  "floorOrArea": "Ground Floor | 1st Floor | 2nd Floor | Basement | Terrace | etc. — or null",
  "labourCount": 12,
  "workDone": "one-line English summary of work done",
  "percentComplete": 70,
  "remarks": "any additional context, issues, or observations — or null",
  "delayReason": "reason for delay if mentioned — or null",
  "delayDays": null
}`;

// ---------------------------------------------------------------------------
// FEW-SHOT EXAMPLES (prepended to user message)
// ---------------------------------------------------------------------------

const FEW_SHOT_HEADER = `EXAMPLES (study these before parsing the actual message):

Message: "aaj ground floor slab casting complete, 12 mazdoor, 70% done"
JSON: {"taskDescription":"Slab casting","floorOrArea":"Ground Floor","labourCount":12,"workDone":"Slab casting 70% complete","percentComplete":70,"remarks":null,"delayReason":null,"delayDays":null}

Message: "column reinforcement 2nd floor mein 80% ho gaya, 8 mistri, cement kam pad gaya 2 ghante delay"
JSON: {"taskDescription":"Column reinforcement","floorOrArea":"2nd Floor","labourCount":8,"workDone":"Column reinforcement 80% complete","percentComplete":80,"remarks":"Cement ran short, 2 hour delay","delayReason":"Cement shortage","delayDays":0}

Message: "plumbing work basement mein poora hua, 6 workers"
JSON: {"taskDescription":"Plumbing work","floorOrArea":"Basement","labourCount":6,"workDone":"Plumbing work completed in basement","percentComplete":100,"remarks":null,"delayReason":null,"delayDays":null}

Message: "aaj kaam nahi hua, rain heavy tha, kal karenge"
JSON: {"taskDescription":null,"floorOrArea":null,"labourCount":null,"workDone":"No work done today","percentComplete":0,"remarks":"Heavy rain — work halted. Plan: Resume tomorrow.","delayReason":"Heavy rainfall","delayDays":1}

Message: "3rd floor mein ek mazdoor gir gaya, kaam band kiya, ambulance bulaya"
JSON: {"taskDescription":"General site work","floorOrArea":"3rd Floor","labourCount":null,"workDone":"Work stopped due to safety incident","percentComplete":null,"remarks":"SAFETY: Worker fell on 3rd floor. Ambulance called. Work halted.","delayReason":"Safety incident","delayDays":1}

Message: "tiling first floor 60% complete, 4 mistri, grout material khatam ho gaya"
JSON: {"taskDescription":"Tiling","floorOrArea":"1st Floor","labourCount":4,"workDone":"Floor tiling 60% complete","percentComplete":60,"remarks":"Grout material exhausted","delayReason":"Material shortage — grout","delayDays":0}

NOW PARSE THIS MESSAGE:`;

// ---------------------------------------------------------------------------
// MAIN PARSE FUNCTION
// ---------------------------------------------------------------------------

export async function parseWhatsappMessage(
  rawMessage: string,
  apiKey: string
): Promise<ParsedUpdate> {
  const userContent = `${FEW_SHOT_HEADER}\n\nMessage: "${rawMessage}"\nJSON:`;

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
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: PARSE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Haiku parse error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const raw = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(raw) as ParsedUpdate;

  // Clamp + validate
  if (parsed.percentComplete !== null && parsed.percentComplete !== undefined) {
    parsed.percentComplete = Math.max(0, Math.min(100, Math.round(parsed.percentComplete)));
  }
  if (parsed.labourCount !== null && parsed.labourCount !== undefined) {
    parsed.labourCount = Math.max(1, Math.round(parsed.labourCount));
  }
  if (parsed.delayDays !== null && parsed.delayDays !== undefined) {
    parsed.delayDays = Math.max(0, Math.round(parsed.delayDays));
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// TASK MATCHER
// ---------------------------------------------------------------------------

/**
 * Fuzzy-match parsed taskDescription + floorOrArea against the project's task list.
 * Returns the best-matching task ID, or null if no confident match.
 *
 * Scoring:
 *   +1 per keyword overlap between taskDescription and task title
 *   +5 exact area match  |  +2 partial area match
 *   +2 if task is already "in_progress" (prefer active tasks)
 *   Minimum threshold: score ≥ 2
 */
export function matchTaskId(
  parsed: Pick<ParsedUpdate, "taskDescription" | "floorOrArea">,
  projectTasks: Array<{ id: string; title: string; area: string | null; status: string }>
): string | null {
  if (!parsed.taskDescription || projectTasks.length === 0) return null;

  const descWords = parsed.taskDescription
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);

  let bestId: string | null = null;
  let bestScore = 0;

  for (const task of projectTasks) {
    const titleWords = task.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);

    // Keyword overlap
    let score = descWords.filter((d) =>
      titleWords.some((t) => t.includes(d) || d.includes(t))
    ).length;

    // Area match bonus
    if (parsed.floorOrArea && task.area) {
      const fa = parsed.floorOrArea.toLowerCase();
      const ta = task.area.toLowerCase();
      if (fa === ta) score += 5;
      else if (ta.includes(fa) || fa.includes(ta)) score += 2;
    }

    // Prefer in_progress tasks when scores tie
    if (task.status === "in_progress") score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestId = task.id;
    }
  }

  return bestScore >= 2 ? bestId : null;
}
