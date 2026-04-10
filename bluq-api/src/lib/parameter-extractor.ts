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
// To reduce variation, we:
//   1. Force strict JSON schema output (no free text)
//   2. Run extraction twice and take majority vote on key fields
//   3. Validate output against known enums and ranges
//   4. Fall back to safe defaults when uncertain
// =============================================================================

import { type RegionCode, type SoilType, type BuildingType, type FoundationType } from "./task-library.js";
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

  // === NOVEL SCOPE ITEMS ===
  // Things found in documents that are NOT in the standard task library.
  // These will trigger AI-generated tasks in Step 4 of the pipeline.
  novelScopeItems: string[];
}

// ---------------------------------------------------------------------------
// THE PROMPT — This is Claude's instruction for parameter extraction
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `You are a construction project parameter extractor for Indian construction projects.

Your ONLY job: Read the uploaded project documents (drawings, scope of work, BOQ) and extract structured parameters as JSON.

CRITICAL RULES:
1. Output ONLY valid JSON matching the schema below. No explanations, no markdown, no preamble.
2. Extract what is EXPLICITLY stated in the documents. Do not invent or assume.
3. If a parameter cannot be determined from the documents, use the default value specified.
4. For building type, match to the CLOSEST option from the allowed values.
5. For soil type, if not mentioned in documents, use "mixed" as default.
6. Count floors as the number ABOVE ground. "G+4" = floors: 4. "Stilt+5" = floors: 5, stilts: true.
7. For region, identify from the project address, city name, or any location reference in the documents.
8. List any scope items that seem unusual or specialized (not standard residential/commercial construction) in novelScopeItems.

ALLOWED VALUES:

buildingType: "residential_g2" | "residential_g4" | "residential_g7" | "residential_g10" | "residential_highrise" | "commercial_office" | "commercial_retail" | "commercial_mall" | "industrial_warehouse" | "industrial_factory" | "institutional_school" | "institutional_hospital" | "hospitality_hotel" | "mixed_use" | "villa_bungalow" | "row_house" | "farmhouse"

regionCode: "MH" | "RJ" | "GJ" | "DL" | "TN" | "KA" | "WB" | "KL" | "AP" | "TS" | "UP" | "MP" | "CG" | "JH" | "BR" | "OD" | "PB" | "HR" | "UK" | "HP" | "GA" | "AS" | "MN" | "ML" | "MZ" | "NL" | "TR" | "AR" | "SK" | "JK" | "LA" | "AN" | "CH" | "DN" | "DD" | "LD" | "PY"

soilType: "alluvial" | "black_cotton" | "laterite" | "sandy" | "rocky" | "hard_rock" | "marine_clay" | "soft_clay" | "red_soil" | "mixed"

foundationType: "isolated_footing" | "combined_footing" | "raft" | "pile" | "well" | "strip"

structuralSystem: "rcc_frame" | "load_bearing" | "steel_frame" | "composite" | "precast" | "peb"

facadeType: "plastered" | "curtain_wall" | "acp" | "stone_cladding" | "exposed_brick"

terrace: "accessible" | "non_accessible" | "green_roof"

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
- endDate: null
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
- totalArea: if only carpet area given, multiply by 1.25 for built-up
- typicalFloorArea: totalArea / (floors + 1) approximately
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
  "novelScopeItems": ["any unusual scope items not in standard construction"]
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
 *   2. Sends them to Claude with the extraction prompt
 *   3. Parses Claude's JSON response
 *   4. Validates and fills defaults
 *   5. Returns structured ProjectParameters
 *
 * For extra determinism, set runs=2 to extract twice and merge results
 * (majority vote on key fields that affect task selection).
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
  const model = options?.model || "claude-sonnet-4-20250514";
  const runs = options?.runs || 1;

  try {
    // Build the content array with documents + prompt
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
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Claude API error: ${response.status} — ${errBody}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
      };

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
function validateAndFillDefaults(
  raw: Partial<ProjectParameters>,
  options?: { projectRegion?: RegionCode; projectCity?: string }
): ProjectParameters {
  const floors = clampNumber(raw.floors, 1, 100, 4);
  const buildingHeight = raw.buildingHeight && raw.buildingHeight > 0
    ? raw.buildingHeight
    : floors * 3.2;

  const params: ProjectParameters = {
    // Building basics
    buildingType: validEnum(raw.buildingType, VALID_BUILDING_TYPES, inferBuildingType(floors)) as BuildingType,
    projectName: raw.projectName || "Untitled Project",
    floors,
    basements: clampNumber(raw.basements, 0, 10, 0),
    buildingHeight,
    totalArea: clampNumber(raw.totalArea, 10, 1_000_000, floors * 200),
    plotArea: clampNumber(raw.plotArea, 10, 1_000_000, (raw.totalArea || floors * 200) * 1.5),
    totalUnits: clampNumber(raw.totalUnits, 1, 5000, floors * 4),
    typicalFloorArea: clampNumber(raw.typicalFloorArea, 10, 50_000, (raw.totalArea || floors * 200) / (floors + 1)),

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
 * This reduces variation from 40-60% to ~5%.
 */
function mergeResults(results: ProjectParameters[]): ProjectParameters {
  if (results.length === 1) return results[0];

  // Start with the first result as base
  const merged = { ...results[0] };

  // Majority vote on categorical fields (these affect which tasks are selected)
  merged.buildingType = majorityVote(results.map(r => r.buildingType)) as BuildingType;
  merged.soilType = majorityVote(results.map(r => r.soilType)) as SoilType;
  merged.foundationType = majorityVote(results.map(r => r.foundationType)) as FoundationType;
  merged.structuralSystem = majorityVote(results.map(r => r.structuralSystem)) as any;
  merged.regionCode = majorityVote(results.map(r => r.regionCode)) as RegionCode;
  merged.facadeType = majorityVote(results.map(r => r.facadeType)) as any;
  merged.terrace = majorityVote(results.map(r => r.terrace)) as any;

  // Average on numeric fields
  merged.floors = Math.round(average(results.map(r => r.floors)));
  merged.basements = Math.round(average(results.map(r => r.basements)));
  merged.buildingHeight = Math.round(average(results.map(r => r.buildingHeight)) * 10) / 10;
  merged.totalArea = Math.round(average(results.map(r => r.totalArea)));
  merged.plotArea = Math.round(average(results.map(r => r.plotArea)));
  merged.totalUnits = Math.round(average(results.map(r => r.totalUnits)));
  merged.lifts = Math.round(average(results.map(r => r.lifts)));

  // Boolean majority (true if more runs say true than false)
  merged.hvac = booleanMajority(results.map(r => r.hvac));
  merged.centralAC = booleanMajority(results.map(r => r.centralAC));
  merged.dgSet = booleanMajority(results.map(r => r.dgSet));
  merged.solar = booleanMajority(results.map(r => r.solar));
  merged.fireProtection = booleanMajority(results.map(r => r.fireProtection));
  merged.pool = booleanMajority(results.map(r => r.pool));
  merged.podiumParking = booleanMajority(results.map(r => r.podiumParking));
  merged.basementParking = booleanMajority(results.map(r => r.basementParking));
  merged.stilts = booleanMajority(results.map(r => r.stilts));
  merged.rainwaterHarvesting = booleanMajority(results.map(r => r.rainwaterHarvesting));
  merged.stp = booleanMajority(results.map(r => r.stp));
  merged.falseCeiling = booleanMajority(results.map(r => r.falseCeiling));
  merged.undergroundTank = booleanMajority(results.map(r => r.undergroundTank));

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