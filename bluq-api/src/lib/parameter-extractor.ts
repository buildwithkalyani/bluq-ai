// =============================================================================
// BLUQ PARAMETER EXTRACTOR
// =============================================================================
// This is Claude's ONE job in the scheduling pipeline:
//   Read parsed documents → output STRUCTURED JSON parameters.
//
// These parameters feed the rules engine, which deterministically selects
// tasks from the library. Same documents = same parameters = same tasks.
//
// Pipeline position:
//   parsers.ts → THIS → rules-engine.ts → duration-calculator.ts
//
// Prompt caching strategy (3 blocks):
//   Block 1 [CACHED]     — Full task library (143 tasks, 37 regions, 17 building
//                          types, 24 conditional rules). Claude now knows exactly
//                          what parameters matter and what they trigger.
//   Block 2 [CACHED]     — Extraction instructions + JSON schema.
//   Block 3 [NOT CACHED] — Actual documents (different every call).
//
// Why feed the full library to Claude?
//   Without it, Claude extracts parameters blind. It doesn't know that:
//     - pool:true → triggers SW-01 and SW-02
//     - soilType:black_cotton → triggers SP-07
//     - buildingHeight >= 15 → triggers fire fighting (PB-07, FD-01, HO-04)
//   With the library, Claude knows what to look for and can distinguish
//   truly novel scope from items already covered in ADDITIONAL_TASKS.
// =============================================================================

import {
  CORE_TASKS, ADDITIONAL_TASKS, REGIONAL_PARAMS, BUILDING_TYPES,
  CONDITIONAL_RULES,
  type RegionCode, type SoilType, type BuildingType, type FoundationType,
} from "./task-library.js";
import { type ParsedDocument, toClaudeContent } from "./parsers.js";

// ---------------------------------------------------------------------------
// TYPES — The structured output Claude must produce
// ---------------------------------------------------------------------------

export interface ProjectParameters {
  // === BUILDING BASICS ===
  buildingType: BuildingType;
  projectName: string;
  floors: number;                    // above ground (G+N → N)
  basements: number;                 // below ground
  buildingHeight: number;            // meters (approx)
  totalArea: number;                 // sqm built-up area
  plotArea: number;                  // sqm total plot
  totalUnits: number;                // flats / offices / rooms
  typicalFloorArea: number;          // sqm per floor

  // === SITE & SOIL ===
  regionCode: RegionCode;
  city: string;
  soilType: SoilType;
  foundationType: FoundationType;
  waterTableDepth: number | null;    // meters below GL, null if unknown

  // === STRUCTURAL ===
  structuralSystem: "rcc_frame" | "load_bearing" | "steel_frame" | "composite" | "precast" | "peb";
  concreteGrade: string;             // e.g., "M25", "M30"
  steelGrade: string;                // e.g., "Fe-500D"

  // === MEP FEATURES ===
  lifts: number;
  hvac: boolean;
  centralAC: boolean;
  dgSet: boolean;
  solar: boolean;
  fireProtection: boolean;           // sprinkler + hydrant system

  // === SPECIAL FEATURES ===
  pool: boolean;
  podiumParking: boolean;
  basementParking: boolean;
  stilts: boolean;                   // stilt floor parking
  terrace: "accessible" | "non_accessible" | "green_roof";
  rainwaterHarvesting: boolean;
  stp: boolean;                      // sewage treatment plant
  falseCeiling: boolean;
  facadeType: "plastered" | "curtain_wall" | "acp" | "stone_cladding" | "exposed_brick";
  undergroundTank: boolean;

  // === DATES ===
  startDate: string | null;          // ISO date if found in documents
  endDate: string | null;            // ISO date if found in documents

  // === CONFIDENCE ===
  confidence: {
    overall: "high" | "medium" | "low";
    notes: string[];                 // what was clearly stated vs inferred
  };

  // === WINGS / BLOCKS / TOWERS ===
  // Multi-wing projects: each wing may have a different number of floors.
  // null = single-wing or unknown — behavior identical to current (no wing expansion).
  // Extracted by Claude from project documents (e.g., "Wing A: G+4, Wing B: G+6").
  wings: Array<{ name: string; floors: number }> | null;

  // === NOVEL SCOPE ITEMS ===
  // Things found in documents that are NOT in the standard task library.
  // These will trigger AI-generated tasks in Step 6 of the pipeline.
  novelScopeItems: string[];
}


// ---------------------------------------------------------------------------
// LIBRARY SUMMARY — built once at module load, sent as cached context
// ---------------------------------------------------------------------------

/**
 * Serializes the full task library into a compact, structured text format
 * for Claude. Generated once at module load — always in sync with the
 * actual TypeScript data (no manual maintenance needed).
 *
 * Output size: ~5,000-6,000 tokens. Well above the 1,024-token cache minimum.
 */
function buildLibrarySummary(): string {
  const lines: string[] = [];

  lines.push("=== BLUQ TASK LIBRARY (143 tasks) ===");
  lines.push("Use this to extract parameters accurately and distinguish novel scope from covered items.");
  lines.push("");

  // ── CORE TASKS ──────────────────────────────────────────────────────────
  lines.push("[CORE TASKS — 117 tasks, always applicable unless excluded by building type]");
  lines.push("Format: CODE | phase | name | perFloor | conditions");
  lines.push("");

  for (const t of CORE_TASKS) {
    const perFloor = t.perFloor ? "perFloor:YES" : "perFloor:no";
    const conds = t.conditions && t.conditions.length > 0
      ? t.conditions.map(c => `${c.field}${c.operator}${c.value}`).join(" AND ")
      : "always";
    const excl = t.excludedBuildingTypes && t.excludedBuildingTypes.length > 0
      ? ` | excl:${t.excludedBuildingTypes.join(",")}`
      : "";
    lines.push(`${t.code} | ${t.phase} | ${t.name} | ${perFloor} | cond:${conds}${excl}`);
  }

  lines.push("");

  // ── ADDITIONAL TASKS ────────────────────────────────────────────────────
  lines.push("[ADDITIONAL TASKS — 26 tasks, triggered by features/building type/conditions]");
  lines.push("Format: CODE | phase | name | perFloor | conditions | applicable building types");
  lines.push("");

  for (const t of ADDITIONAL_TASKS) {
    const perFloor = t.perFloor ? "perFloor:YES" : "perFloor:no";
    const conds = t.conditions && t.conditions.length > 0
      ? t.conditions.map(c => `${c.field}${c.operator}${c.value}`).join(" AND ")
      : "see building type config";
    const applicable = t.applicableBuildingTypes && t.applicableBuildingTypes.length > 0
      ? ` | types:${t.applicableBuildingTypes.join(",")}`
      : "";
    lines.push(`${t.code} | ${t.phase} | ${t.name} | ${perFloor} | cond:${conds}${applicable}`);
  }

  lines.push("");

  // ── BUILDING TYPE TASK SETS ──────────────────────────────────────────────
  lines.push("=== BUILDING TYPES (17 types) ===");
  lines.push("Format: type | mandatory task codes | excluded task codes | additional task codes | special flags");
  lines.push("");

  for (const [type, cfg] of Object.entries(BUILDING_TYPES)) {
    const mandatory = cfg.mandatoryTaskCodes.length > 0 ? cfg.mandatoryTaskCodes.join(",") : "none";
    const excluded  = cfg.excludedTaskCodes.length > 0  ? cfg.excludedTaskCodes.join(",")  : "none";
    const additional = cfg.additionalTaskCodes.length > 0 ? cfg.additionalTaskCodes.join(",") : "none";
    const flags: string[] = [];
    if (cfg.requiresHVAC)         flags.push("HVAC:required");
    if (cfg.requiresFireFighting)  flags.push("fire:required");
    if (cfg.requiresDG)            flags.push("DG:required");
    if (cfg.requiresElevator)      flags.push("lift:required");
    if (cfg.requiresPileFoundation) flags.push("pile:required");
    if (cfg.requiresCurtainWall)   flags.push("curtainWall:required");
    if (cfg.requiresCraneAboveFloors) flags.push(`crane:above${cfg.requiresCraneAboveFloors}F`);
    const flagStr = flags.length > 0 ? ` | flags:${flags.join(",")}` : "";
    lines.push(`${type} | floors:${cfg.typicalFloorRange.min}-${cfg.typicalFloorRange.max} | mandatory:[${mandatory}] | excl:[${excluded}] | addl:[${additional}]${flagStr}`);
  }

  lines.push("");

  // ── CONDITIONAL RULES ────────────────────────────────────────────────────
  lines.push("=== CONDITIONAL RULES (24 rules) ===");
  lines.push("These rules override building type defaults based on project parameters.");
  lines.push("Format: ID | IF condition → ACTION [task codes]");
  lines.push("");

  for (const rule of CONDITIONAL_RULES) {
    const cond = `${rule.condition.field}${rule.condition.operator}${rule.condition.value}`;
    lines.push(`${rule.id} | ${rule.description} | IF ${cond} → ${rule.action.toUpperCase()} [${rule.taskCodes.join(",")}]`);
  }

  lines.push("");

  // ── REGIONS ─────────────────────────────────────────────────────────────
  lines.push("=== REGIONS (37 Indian states/UTs) ===");
  lines.push("Format: CODE Name | soils | monsoon months | seismic zone | key regulatory notes");
  lines.push("");

  for (const [code, r] of Object.entries(REGIONAL_PARAMS)) {
    const monsoonMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monsoon = r.monsoonMonths.length > 0
      ? r.monsoonMonths.map(m => monsoonMonthNames[m - 1]).join("-")
      : "none";
    const notes: string[] = [];
    if (r.stpMandatoryAboveUnits < 999) notes.push(`STP>=${r.stpMandatoryAboveUnits}units`);
    if (r.reraApplicable) notes.push("RERA");
    if (r.cycloneRisk) notes.push("cyclone-risk");
    if (r.extremeSummerTempC && r.extremeSummerTempC > 45) notes.push(`extreme-summer-${r.extremeSummerTempC}C`);
    if (r.winterFrostMonths && r.winterFrostMonths.length > 0) notes.push("winter-frost");
    if (r.productivityIndex < 0.9) notes.push(`productivity:${r.productivityIndex}`);
    lines.push(`${code} ${r.name} | soils:${r.commonSoilTypes.join(",")} | monsoon:${monsoon} | seismic:${r.seismicZone} | ${notes.join("|")}`);
  }

  lines.push("");
  lines.push("=== IMPORTANT ===");
  lines.push("Only flag something as a 'novelScopeItem' if it cannot be covered by ANY task in this library.");
  lines.push("All pool work → SW-01/SW-02. HVAC → HV-01/HV-02/HV-03. Curtain wall → CW-01/CW-02.");
  lines.push("Pile foundation → PF-01/PF-02/PF-03. Raft foundation → RF-01/RF-02. Basement → BM-01/BM-02/BM-03.");
  lines.push("Solar panels → SO-01/SO-02. DG set → DG-01. False ceiling → FC-01. Tower crane → TC-01/TC-02.");
  lines.push("STP → EX-09. Fire fighting → FD-01. Lift installation → EX-10. Rainwater harvesting → RW-01.");
  lines.push("Novel items are ONLY things like: helipad, rooftop garden, amphitheatre, skywalk, bullet-proof glass, etc.");

  return lines.join("\n");
}

// Generated once at module load. Cached by Anthropic's API on first call.
const LIBRARY_SUMMARY = buildLibrarySummary();


// ---------------------------------------------------------------------------
// EXTRACTION INSTRUCTIONS (second cached block)
// ---------------------------------------------------------------------------

const EXTRACTION_INSTRUCTIONS = `You are a construction project parameter extractor for Indian construction projects.

Your ONLY job: Read the uploaded project documents (drawings, scope of work, BOQ) and extract structured parameters as JSON.

CRITICAL RULES:
1. Output ONLY valid JSON matching the schema below. No explanations, no markdown, no preamble.
2. Extract what is EXPLICITLY stated in the documents. Do not invent or assume.
3. If a parameter cannot be determined from the documents, use the default value specified.
4. For building type, match to the CLOSEST option from the allowed values.
5. For soil type, if not mentioned in documents, use "mixed" as default.
6. FLOOR COUNT RULE — Extract ONLY the integer after the "+" sign. NEVER add 1 for ground floor.
   "G+4" = floors: 4    "G+5" = floors: 5    "G+6" = floors: 6    "G+7" = floors: 7
   "Stilt+5" = floors: 5, stilts: true    "B+G+6" = floors: 6, basements: 1
   CRITICAL: "G+6" = floors: 6 (NOT 7). The system handles ground floor as floor-0 internally.
   Rule: floors = the integer immediately after the first "+" in the G+N notation — nothing more.
7. For region, identify from the project address, city name, or any location reference in the documents.
8. Use the TASK LIBRARY above to understand what each parameter triggers — extract precisely.
9. Only add to novelScopeItems if the scope item is NOT covered by any task in the library above.

ALLOWED VALUES:

buildingType: "residential_g2" | "residential_g4" | "residential_g7" | "residential_g10" | "residential_highrise" | "commercial_office" | "commercial_retail" | "commercial_mall" | "industrial_warehouse" | "industrial_factory" | "institutional_school" | "institutional_hospital" | "hospitality_hotel" | "mixed_use" | "villa_bungalow" | "row_house" | "farmhouse"

regionCode: "MH" | "RJ" | "GJ" | "DL" | "TN" | "KA" | "WB" | "KL" | "AP" | "TS" | "UP" | "MP" | "CG" | "JH" | "BR" | "OD" | "PB" | "HR" | "UK" | "HP" | "GA" | "AS" | "MN" | "ML" | "MZ" | "NL" | "TR" | "AR" | "SK" | "JK" | "LA" | "AN" | "CH" | "DN" | "DD" | "LD" | "PY"

soilType: "alluvial" | "black_cotton" | "laterite" | "sandy" | "rocky" | "hard_rock" | "marine_clay" | "soft_clay" | "red_soil" | "mixed"

foundationType: "isolated_footing" | "combined_footing" | "raft" | "pile" | "well" | "strip"

structuralSystem: "rcc_frame" | "load_bearing" | "steel_frame" | "composite" | "precast" | "peb"

facadeType: "plastered" | "curtain_wall" | "acp" | "stone_cladding" | "exposed_brick"

terrace: "accessible" | "non_accessible" | "green_roof"

wings: null (single-wing project) | array of { name: string, floors: number }
  - Extract wing/block/tower names and per-wing floor counts from documents.
  - "Wing A: G+4, Wing B: G+6" → [{"name":"Wing A","floors":4},{"name":"Wing B","floors":6}]
  - Use null if the building has only one wing/block/tower, or if wings are not mentioned.
  - The floors value follows the same rule as the main floors field (G+N → N).

DEFAULTS (use when document doesn't specify):
- soilType: "mixed"
- foundationType: "isolated_footing"
- structuralSystem: "rcc_frame"
- concreteGrade: "M25"
- steelGrade: "Fe-500D"
- facadeType: "plastered"
- terrace: "accessible"
- waterTableDepth: null
- startDate: null
- endDate: null  ← ONLY extract if document is a construction CONTRACT or work order. Brochure "possession dates" and marketing timelines are NOT endDate — set null.
- hvac: false (true for commercial/hospital/hotel)
- centralAC: false
- dgSet: false (true for commercial/hospital/hotel)
- solar: false
- falseCeiling: false (true for commercial/hospital/hotel)
- rainwaterHarvesting: false
- stp: false
- undergroundTank: true (for residential >4 units)

ESTIMATION RULES (when not explicitly stated):
- buildingHeight: floors × 3.2 meters (typical floor-to-floor)
- typicalFloorArea: DERIVE FROM BROCHURE UNIT DATA — this is the most important area field.
  Step 1: Find unit sizes in the brochure (e.g. "2BHK: 850 sqft, 3BHK: 1200 sqft").
  Step 2: Count units per floor (totalUnits / (floors + 1), or read explicitly if stated).
  Step 3: typicalFloorArea = sum of unit carpet areas per floor × 1.25 (carpet-to-built-up factor).
  Example: 4 flats per floor (2× 850sqft + 2× 1200sqft) → typicalFloorArea = (1700+2400)×1.25 / 10.76 = 476 sqm.
  ONLY fall back to totalArea/(floors+1) if NO unit size data exists in the document.
- totalArea: SINGLE BUILDING only — NOT total complex/township area. Large developers quote total development area; ignore that figure. Set totalArea = typicalFloorArea × (floors + 1) if not explicitly stated for THIS building.
  If only carpet area given, multiply by 1.25 for built-up area.
- fireProtection: true if buildingHeight >= 15m
- lifts: 0 if floors <= 3, 1 if floors 4-7, 2 if floors 8-15, 3+ if floors > 15

OUTPUT FORMAT — respond with ONLY this JSON structure:`;

const EXTRACTION_USER_PROMPT = `
Extract all project parameters from the documents above.
Respond with ONLY valid JSON matching this exact structure (no markdown backticks, no explanation):

{
  "buildingType": "residential_g4",
  "projectName": "string",
  "floors": 0,
  "basements": 0,
  "buildingHeight": 0,
  "totalArea": 0,
  "plotArea": 0,
  "totalUnits": 0,
  "typicalFloorArea": 0,
  "regionCode": "MH",
  "city": "string",
  "soilType": "mixed",
  "foundationType": "isolated_footing",
  "waterTableDepth": null,
  "structuralSystem": "rcc_frame",
  "concreteGrade": "M25",
  "steelGrade": "Fe-500D",
  "lifts": 0,
  "hvac": false,
  "centralAC": false,
  "dgSet": false,
  "solar": false,
  "fireProtection": false,
  "pool": false,
  "podiumParking": false,
  "basementParking": false,
  "stilts": false,
  "terrace": "accessible",
  "rainwaterHarvesting": false,
  "stp": false,
  "falseCeiling": false,
  "facadeType": "plastered",
  "undergroundTank": true,
  "startDate": null,
  "endDate": null,
  "confidence": {
    "overall": "high",
    "notes": ["list what was explicitly found vs inferred"]
  },
  "wings": null,
  "novelScopeItems": ["ONLY items not covered by any task in the library"]
}`;


// ---------------------------------------------------------------------------
// EXTRACTION FUNCTION
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  success: boolean;
  parameters?: ProjectParameters;
  rawResponse?: string;
  error?: string;
}

/**
 * Extract project parameters from parsed documents using Claude.
 *
 * How it works:
 *   1. Takes parsed documents (from parsers.ts)
 *   2. Sends them to Claude with the full task library as cached context
 *   3. Parses Claude's JSON response
 *   4. Validates and fills defaults
 *   5. Returns structured ProjectParameters
 *
 * Prompt caching:
 *   - Block 1 (library summary): cached, ~5,500 tokens, reused across all calls
 *   - Block 2 (instructions + schema): cached, ~1,000 tokens
 *   - Block 3 (documents): NOT cached — different every call
 *   Cache hits cost ~10% of full price. Repeated test runs in a session are cheap.
 *
 * @param documents - Array of ParsedDocument from parsers.ts
 * @param apiKey - Anthropic API key (from env)
 * @param options - Optional config (model, runs for majority vote)
 */
export async function extractParameters(
  documents: ParsedDocument[],
  apiKey: string,
  options?: {
    model?: string;
    runs?: number;           // default 1; set to 2 for majority vote
    projectRegion?: RegionCode;  // if already known from project record
    projectCity?: string;        // if already known
  }
): Promise<ExtractionResult> {
  const model = options?.model || "claude-sonnet-4-6";
  const runs = options?.runs || 1;

  try {
    // Build the user content array: documents + extraction prompt
    const content = toClaudeContent(documents, EXTRACTION_USER_PROMPT);

    // Run extraction (potentially multiple times for determinism)
    const results: ProjectParameters[] = [];

    for (let i = 0; i < runs; i++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0,  // deterministic extraction — same doc = same params every time
          system: [
            // Block 1: Full task library — cached across all calls in a session
            {
              type: "text",
              text: LIBRARY_SUMMARY,
              cache_control: { type: "ephemeral" },
            },
            // Block 2: Extraction instructions + JSON schema — cached
            {
              type: "text",
              text: EXTRACTION_INSTRUCTIONS,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            // Block 3: Actual documents — NOT cached (different every call)
            { role: "user", content },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Claude API error: ${response.status} — ${errBody}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
        usage?: {
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          input_tokens?: number;
        };
      };

      // Log cache hit/miss for observability
      if (data.usage) {
        const cacheRead = data.usage.cache_read_input_tokens || 0;
        const cacheWrite = data.usage.cache_creation_input_tokens || 0;
        const input = data.usage.input_tokens || 0;
        if (cacheRead > 0) {
          console.log(`[parameter-extractor] Cache HIT — ${cacheRead} cached tokens read (saved ~90% on those tokens)`);
        } else if (cacheWrite > 0) {
          console.log(`[parameter-extractor] Cache WRITE — ${cacheWrite} tokens written to cache, ${input} uncached tokens`);
        }
      }

      // Extract text from response
      const responseText = data.content
        .filter((block) => block.type === "text" && block.text)
        .map((block) => block.text!)
        .join("");

      // Parse JSON — strip any markdown backticks Claude might add despite instructions
      const cleanJson = responseText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleanJson) as ProjectParameters;
      const validated = validateAndFillDefaults(parsed, options);
      results.push(validated);
    }

    // If multiple runs, merge via majority vote on critical fields
    const finalParams = runs > 1 ? mergeResults(results) : results[0];

    return {
      success: true,
      parameters: finalParams,
    };
  } catch (err: any) {
    console.error("[parameter-extractor] Extraction failed:", err.message);
    return {
      success: false,
      error: err.message,
      rawResponse: err.rawResponse,
    };
  }
}


// ---------------------------------------------------------------------------
// VALIDATION & DEFAULTS
// ---------------------------------------------------------------------------

const VALID_BUILDING_TYPES: Set<string> = new Set([
  "residential_g2", "residential_g4", "residential_g7", "residential_g10",
  "residential_highrise", "commercial_office", "commercial_retail",
  "commercial_mall", "industrial_warehouse", "industrial_factory",
  "institutional_school", "institutional_hospital", "hospitality_hotel",
  "mixed_use", "villa_bungalow", "row_house", "farmhouse",
]);

const VALID_REGION_CODES: Set<string> = new Set([
  "MH", "RJ", "GJ", "DL", "TN", "KA", "WB", "KL", "AP", "TS",
  "UP", "MP", "CG", "JH", "BR", "OD", "PB", "HR", "UK", "HP",
  "GA", "AS", "MN", "ML", "MZ", "NL", "TR", "AR", "SK", "JK",
  "LA", "AN", "CH", "DN", "DD", "LD", "PY",
]);

const VALID_SOIL_TYPES: Set<string> = new Set([
  "alluvial", "black_cotton", "laterite", "sandy", "rocky",
  "hard_rock", "marine_clay", "soft_clay", "red_soil", "mixed",
]);

const VALID_FOUNDATION_TYPES: Set<string> = new Set([
  "isolated_footing", "combined_footing", "raft", "pile", "well", "strip",
]);

const VALID_STRUCTURAL_SYSTEMS: Set<string> = new Set([
  "rcc_frame", "load_bearing", "steel_frame", "composite", "precast", "peb",
]);

const VALID_FACADE_TYPES: Set<string> = new Set([
  "plastered", "curtain_wall", "acp", "stone_cladding", "exposed_brick",
]);

const VALID_TERRACE_TYPES: Set<string> = new Set([
  "accessible", "non_accessible", "green_roof",
]);

/**
 * Validate Claude's output and fill in any missing/invalid fields with safe defaults.
 * This is the safety net — even if Claude returns garbage for a field,
 * the pipeline continues with a reasonable default.
 */
// Max typical floor plate area per building type — prevents complex/township total area
// from inflating single-building task durations to thousands of days.
// These are generous upper bounds: e.g. residential_g7 at 2000 sqm = 20 flats × 100 sqm.
const FLOOR_AREA_MAXES: Record<string, number> = {
  villa_bungalow:        500,
  row_house:             300,
  farmhouse:            1000,
  residential_g2:       1000,
  residential_g4:       1500,
  residential_g7:       2000,
  residential_g10:      3000,
  residential_highrise: 5000,
  commercial_office:    8000,
  commercial_retail:    6000,
  commercial_mall:     20000,
  industrial_warehouse: 30000,
  industrial_factory:  15000,
  institutional_school: 4000,
  institutional_hospital: 8000,
  hospitality_hotel:    4000,
  mixed_use:            8000,
};

function validateAndFillDefaults(
  raw: Partial<ProjectParameters>,
  options?: { projectRegion?: RegionCode; projectCity?: string }
): ProjectParameters {
  const floors = clampNumber(raw.floors, 1, 100, 4);
  const buildingHeight = raw.buildingHeight && raw.buildingHeight > 0
    ? raw.buildingHeight
    : floors * 3.2;

  // Cross-check floors against buildingType range — clamp if clearly outside
  const extractedBuildingType = validEnum(raw.buildingType, VALID_BUILDING_TYPES, inferBuildingType(floors)) as BuildingType;
  const btConfig = BUILDING_TYPES[extractedBuildingType];
  const clampedFloors = (btConfig && floors > btConfig.typicalFloorRange.max + 1)
    ? btConfig.typicalFloorRange.max
    : floors;
  if (clampedFloors !== floors) {
    console.warn(
      `[parameter-extractor] floors=${floors} exceeds buildingType=${extractedBuildingType} max=${btConfig.typicalFloorRange.max}, clamped to ${clampedFloors}`
    );
  }

  // Clamp typicalFloorArea first — it directly drives all task quantity estimates.
  // Large Indian developments (Lodha, Prestige, etc.) quote total COMPLEX area in
  // brochures. We need the floor plate of ONE building/wing, not the whole township.
  const maxFloorArea = FLOOR_AREA_MAXES[extractedBuildingType] ?? 8000;
  const rawFloorArea = (raw.typicalFloorArea && raw.typicalFloorArea > 0)
    ? raw.typicalFloorArea
    : ((raw.totalArea && raw.totalArea > 0) ? raw.totalArea / (clampedFloors + 1) : (clampedFloors * 200) / (clampedFloors + 1));
  const typicalFloorArea = Math.min(Math.max(10, rawFloorArea), maxFloorArea);

  // totalArea is derived from typicalFloorArea × floors when the raw value is
  // implausibly large (i.e. looks like complex area, not single-building area).
  const maxTotalArea = typicalFloorArea * (clampedFloors + 1) * 2;
  const rawTotalArea = (raw.totalArea && raw.totalArea > 0) ? raw.totalArea : typicalFloorArea * (clampedFloors + 1);
  const totalArea = Math.min(Math.max(10, rawTotalArea), maxTotalArea);

  if (rawTotalArea > maxTotalArea) {
    console.warn(
      `[parameter-extractor] totalArea=${rawTotalArea} sqm looks like complex area (max for single ${extractedBuildingType}: ${maxTotalArea}). ` +
      `Clamped to ${totalArea}. typicalFloorArea=${typicalFloorArea}`
    );
  }

  const params: ProjectParameters = {
    // Building basics
    buildingType: extractedBuildingType,
    projectName: raw.projectName || "Untitled Project",
    floors: clampedFloors,
    basements: clampNumber(raw.basements, 0, 10, 0),
    buildingHeight,
    totalArea,
    plotArea: clampNumber(raw.plotArea, 10, 500_000, totalArea * 1.5),
    totalUnits: clampNumber(raw.totalUnits, 1, 5000, clampedFloors * 4),
    typicalFloorArea,

    // Site & soil
    regionCode: (options?.projectRegion || validEnum(raw.regionCode, VALID_REGION_CODES, "MH")) as RegionCode,
    city: options?.projectCity || raw.city || "Unknown",
    soilType: validEnum(raw.soilType, VALID_SOIL_TYPES, "mixed") as SoilType,
    foundationType: validEnum(raw.foundationType, VALID_FOUNDATION_TYPES, "isolated_footing") as FoundationType,
    waterTableDepth: raw.waterTableDepth ?? null,

    // Structural
    structuralSystem: validEnum(raw.structuralSystem, VALID_STRUCTURAL_SYSTEMS, "rcc_frame") as "rcc_frame" | "load_bearing" | "steel_frame" | "composite" | "precast" | "peb",
    concreteGrade: raw.concreteGrade || "M25",
    steelGrade: raw.steelGrade || "Fe-500D",

    // MEP
    lifts: clampNumber(raw.lifts, 0, 20, inferLifts(floors)),
    hvac: raw.hvac ?? false,
    centralAC: raw.centralAC ?? false,
    dgSet: raw.dgSet ?? false,
    solar: raw.solar ?? false,
    fireProtection: raw.fireProtection ?? (buildingHeight >= 15),

    // Special features
    pool: raw.pool ?? false,
    podiumParking: raw.podiumParking ?? false,
    basementParking: raw.basementParking ?? (raw.basements ? raw.basements > 0 : false),
    stilts: raw.stilts ?? false,
    terrace: validEnum(raw.terrace, VALID_TERRACE_TYPES, "accessible") as "accessible" | "non_accessible" | "green_roof",
    rainwaterHarvesting: raw.rainwaterHarvesting ?? false,
    stp: raw.stp ?? false,
    falseCeiling: raw.falseCeiling ?? false,
    facadeType: validEnum(raw.facadeType, VALID_FACADE_TYPES, "plastered") as "plastered" | "curtain_wall" | "acp" | "stone_cladding" | "exposed_brick",
    undergroundTank: raw.undergroundTank ?? true,

    // Dates
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,

    // Confidence
    confidence: {
      overall: validEnum(raw.confidence?.overall, new Set(["high", "medium", "low"]), "medium") as "high" | "medium" | "low",
      notes: Array.isArray(raw.confidence?.notes) ? raw.confidence.notes : [],
    },

    // Novel scope
    novelScopeItems: Array.isArray(raw.novelScopeItems) ? raw.novelScopeItems : [],

    // Wings
    wings: validateWings(raw.wings),
  };

  return params;
}

// ---------------------------------------------------------------------------
// MAJORITY VOTE — merge multiple extraction runs
// ---------------------------------------------------------------------------

/**
 * When we run extraction twice (for determinism), this merges the results.
 * For critical fields that affect task selection (floors, soil, buildingType),
 * we take the value that appeared most. For numeric fields, we average.
 */
function mergeResults(results: ProjectParameters[]): ProjectParameters {
  if (results.length === 1) return results[0];

  const merged = { ...results[0] };

  // Majority vote on categorical fields (these affect which tasks are selected)
  merged.buildingType    = majorityVote(results.map(r => r.buildingType)) as BuildingType;
  merged.soilType        = majorityVote(results.map(r => r.soilType)) as SoilType;
  merged.foundationType  = majorityVote(results.map(r => r.foundationType)) as FoundationType;
  merged.structuralSystem = majorityVote(results.map(r => r.structuralSystem)) as any;
  merged.regionCode      = majorityVote(results.map(r => r.regionCode)) as RegionCode;
  merged.facadeType      = majorityVote(results.map(r => r.facadeType)) as any;
  merged.terrace         = majorityVote(results.map(r => r.terrace)) as any;

  // Average on numeric fields — floors uses min to avoid phantom floor bug
  // (if runs disagree 6 vs 7, the lower is almost always correct for G+N notation)
  merged.floors          = Math.min(...results.map(r => r.floors));
  merged.basements       = Math.round(average(results.map(r => r.basements)));
  merged.buildingHeight  = Math.round(average(results.map(r => r.buildingHeight)) * 10) / 10;
  merged.totalArea       = Math.round(average(results.map(r => r.totalArea)));
  merged.plotArea        = Math.round(average(results.map(r => r.plotArea)));
  merged.totalUnits      = Math.round(average(results.map(r => r.totalUnits)));
  merged.lifts           = Math.round(average(results.map(r => r.lifts)));

  // Boolean majority (true if more runs say true than false)
  merged.hvac               = booleanMajority(results.map(r => r.hvac));
  merged.centralAC          = booleanMajority(results.map(r => r.centralAC));
  merged.dgSet              = booleanMajority(results.map(r => r.dgSet));
  merged.solar              = booleanMajority(results.map(r => r.solar));
  merged.fireProtection     = booleanMajority(results.map(r => r.fireProtection));
  merged.pool               = booleanMajority(results.map(r => r.pool));
  merged.podiumParking      = booleanMajority(results.map(r => r.podiumParking));
  merged.basementParking    = booleanMajority(results.map(r => r.basementParking));
  merged.stilts             = booleanMajority(results.map(r => r.stilts));
  merged.rainwaterHarvesting = booleanMajority(results.map(r => r.rainwaterHarvesting));
  merged.stp                = booleanMajority(results.map(r => r.stp));
  merged.falseCeiling       = booleanMajority(results.map(r => r.falseCeiling));
  merged.undergroundTank    = booleanMajority(results.map(r => r.undergroundTank));

  // Wings: take the result with the most wings (most complete extraction)
  const wingsCandidate = results
    .map(r => r.wings)
    .filter((w): w is Array<{ name: string; floors: number }> => w !== null)
    .sort((a, b) => b.length - a.length)[0] ?? null;
  merged.wings = wingsCandidate;

  // Merge novel scope items (union of all runs, deduplicated)
  const allNovel = new Set<string>();
  for (const r of results) {
    for (const item of r.novelScopeItems) {
      allNovel.add(item.toLowerCase().trim());
    }
  }
  merged.novelScopeItems = [...allNovel];

  // Merge confidence notes
  const allNotes = new Set<string>();
  for (const r of results) {
    for (const note of r.confidence.notes) {
      allNotes.add(note);
    }
  }
  merged.confidence.notes = [...allNotes];

  return merged;
}


// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------

function clampNumber(
  value: number | undefined | null,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === undefined || value === null || isNaN(value)) return defaultValue;
  return Math.max(min, Math.min(max, value));
}

function validEnum(
  value: string | undefined | null,
  validSet: Set<string>,
  defaultValue: string
): string {
  if (!value || !validSet.has(value)) return defaultValue;
  return value;
}

function inferBuildingType(floors: number): string {
  if (floors <= 2) return "residential_g2";
  if (floors <= 5) return "residential_g4";
  if (floors <= 8) return "residential_g7";
  if (floors <= 12) return "residential_g10";
  return "residential_highrise";
}

function validateWings(
  raw: unknown
): Array<{ name: string; floors: number }> | null {
  if (!raw || !Array.isArray(raw) || raw.length <= 1) return null;
  const valid = (raw as unknown[])
    .filter((w): w is { name: string; floors: number } =>
      w !== null &&
      typeof w === "object" &&
      typeof (w as any).name === "string" &&
      typeof (w as any).floors === "number"
    )
    .map(w => ({ name: w.name.trim(), floors: Math.max(1, Math.round(w.floors)) }));
  return valid.length >= 2 ? valid : null;
}

function inferLifts(floors: number): number {
  if (floors <= 3) return 0;
  if (floors <= 7) return 1;
  if (floors <= 15) return 2;
  return 3;
}

function majorityVote(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let maxCount = 0;
  let winner = values[0];
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}

function booleanMajority(values: boolean[]): boolean {
  const trueCount = values.filter(v => v).length;
  return trueCount > values.length / 2;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
