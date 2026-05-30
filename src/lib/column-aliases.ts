import { distance } from "fastest-levenshtein";

// ─── CANONICAL FIELDS ─────────────────────────────────────────────────────────

export const CANONICAL_FIELDS = [
  "Task Name",
  "Start Date",
  "End Date",
  "Duration",
  "Predecessor",
  "Contractor",
  "Space / Zone",
  "% Complete",
  "Phase",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

// ─── ALIAS DICTIONARY ─────────────────────────────────────────────────────────
// Covers: Primavera P6, MS Project, Asta Powerproject, common Indian Excel
// templates, and typical manual spreadsheets.

export const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  "Task Name": [
    "task name", "task", "activity name", "activity", "activity id",
    "description", "work item", "wbs name", "wbs description", "item",
    "item description", "job", "job description", "scope item",
    "work package", "deliverable", "milestone name", "name",
  ],
  "Start Date": [
    "start date", "start", "begin date", "begin", "planned start",
    "baseline start", "early start", "target start", "commencement",
    "commencement date", "scheduled start", "projected start",
    "contract start", "es", "ps", "bl start",
  ],
  "End Date": [
    "end date", "end", "finish date", "finish", "planned finish",
    "baseline finish", "early finish", "target end", "target finish",
    "completion date", "completion", "scheduled finish", "projected finish",
    "contract finish", "ef", "pf", "bl finish",
  ],
  "Duration": [
    "duration", "days", "calendar days", "working days", "work days",
    "duration days", "orig dur", "original duration", "planned duration",
    "drtn", "remaining duration", "rem dur", "total duration",
  ],
  "Predecessor": [
    "predecessor", "predecessors", "predecessor task", "depends on",
    "dependency", "dependencies", "pred", "logic", "link", "preceding task",
  ],
  "Contractor": [
    "contractor", "contractors", "resource", "resources", "assigned to",
    "assignment", "responsible", "responsibility", "resp party",
    "responsible party", "subcontractor", "agency", "vendor", "team",
    "crew", "trade", "labour", "laborer",
  ],
  "Space / Zone": [
    "location", "zone", "space", "area", "block", "tower", "floor",
    "floor no", "floor number", "unit", "section", "wing", "level",
    "grid", "room", "bay", "building", "structure",
  ],
  "% Complete": [
    "% complete", "% completion", "percent complete", "percent completion",
    "progress", "progress %", "progress (%)", "progress(%)", "pct", "phys %", "physical %",
    "physical complete", "completion %", "done %", "percent done",
    "achievement", "achieved %",
  ],
  "Phase": [
    "phase", "stage", "construction phase", "work phase", "project phase",
    "category", "group", "work group", "discipline", "trade", "section",
    "wbs level 1", "wbs 1", "level 1",
  ],
};

// ─── NORMALIZE ────────────────────────────────────────────────────────────────

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[_\-]/g, " ")   // START_DATE → start date
    .replace(/\s+/g, " ");    // collapse extra spaces
}

// ─── ALIAS MATCH ─────────────────────────────────────────────────────────────

function matchByAlias(normalized: string): { field: CanonicalField; confidence: "high" } | null {
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CanonicalField, string[]][]) {
    for (const alias of aliases) {
      if (normalized === alias) return { field, confidence: "high" };
    }
  }
  // Substring containment — e.g. "planned start date" contains "start date"
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CanonicalField, string[]][]) {
    for (const alias of aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return { field, confidence: "high" };
      }
    }
  }
  return null;
}

// ─── FUZZY MATCH ─────────────────────────────────────────────────────────────

function fuzzyMatch(normalized: string): { field: CanonicalField; confidence: "medium" } | null {
  let bestField: CanonicalField | null = null;
  let bestScore = Infinity;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CanonicalField, string[]][]) {
    for (const alias of aliases) {
      const score = distance(normalized, alias);
      if (score < bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
  }

  if (bestField && bestScore <= 2) return { field: bestField, confidence: "medium" };
  return null;
}

// ─── SAMPLE VALUE HEURISTICS ─────────────────────────────────────────────────

const DATE_RE = /^\d{1,4}[\-\/]\d{1,2}[\-\/]\d{2,4}$/;
const PERCENT_RE = /^\d+(\.\d+)?%$/;
const SMALL_INT_RE = /^\d{1,3}$/; // 1-999 → likely duration in days

function sampleValueHint(values: string[]): { field: CanonicalField; confidence: "medium" } | null {
  const nonEmpty = values.filter(v => v.trim());
  if (!nonEmpty.length) return null;

  const allDates = nonEmpty.every(v => DATE_RE.test(v.trim()));
  if (allDates) return { field: "Start Date", confidence: "medium" };

  const allPercent = nonEmpty.every(v => PERCENT_RE.test(v.trim()));
  if (allPercent) return { field: "% Complete", confidence: "medium" };

  const allSmallInt = nonEmpty.every(v => SMALL_INT_RE.test(v.trim()));
  if (allSmallInt) return { field: "Duration", confidence: "medium" };

  return null;
}

// ─── COMBINED AUTO-MAPPER ─────────────────────────────────────────────────────

export type MappingConfidence = "high" | "medium" | null;

export interface MappingResult {
  field: CanonicalField | null;
  confidence: MappingConfidence;
}

/**
 * Given a raw column header and optional sample cell values from the first
 * few rows, returns the best-guess canonical field and a confidence level.
 *
 * Pipeline:
 *   1. Normalize header
 *   2. Exact / substring alias match  → "high"
 *   3. Fuzzy Levenshtein match (≤2)   → "medium"
 *   4. Sample value pattern detection → "medium"
 *   5. No match                       → null
 */
export function autoMapColumn(header: string, sampleValues: string[] = []): MappingResult {
  const normalized = normalizeHeader(header);

  const aliasHit = matchByAlias(normalized);
  if (aliasHit) return aliasHit;

  const fuzzyHit = fuzzyMatch(normalized);
  if (fuzzyHit) return fuzzyHit;

  const sampleHit = sampleValueHint(sampleValues);
  if (sampleHit) return sampleHit;

  return { field: null, confidence: null };
}

/**
 * Auto-map all headers at once.
 * Returns two maps: field assignments and confidence per header.
 */
export function autoMapAllColumns(
  headers: string[],
  rows: string[][],
): {
  mappings: Record<string, string>;
  confidence: Record<string, MappingConfidence>;
} {
  const mappings: Record<string, string> = {};
  const confidence: Record<string, MappingConfidence> = {};
  const usedFields = new Set<string>();

  const sampleValuesByIndex = headers.map((_, i) =>
    rows.slice(0, 5).map(r => r[i] ?? "").filter(v => v.trim()).slice(0, 3)
  );

  // Pass 1: exact alias matches only — prevents a substring hit from stealing a field
  // that a later column would match exactly (e.g. "WBS" stealing "Task Name" via "wbs name")
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    let exactField: CanonicalField | null = null;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CanonicalField, string[]][]) {
      if (aliases.includes(normalized)) { exactField = field; break; }
    }
    if (exactField && !usedFields.has(exactField)) {
      mappings[headers[i]] = exactField;
      confidence[headers[i]] = "high";
      usedFields.add(exactField);
    }
  }

  // Pass 2: remaining columns get full autoMapColumn (substring / fuzzy / sample)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (mappings[header] !== undefined) continue; // already resolved in pass 1

    const result = autoMapColumn(header, sampleValuesByIndex[i]);

    if (result.field && !usedFields.has(result.field)) {
      mappings[header] = result.field;
      confidence[header] = result.confidence;
      usedFields.add(result.field);
    } else {
      confidence[header] = null;
    }
  }

  return { mappings, confidence };
}
