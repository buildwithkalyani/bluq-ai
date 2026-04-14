// =============================================================================
// BLUQ CONSTRUCTION TASK LIBRARY
// =============================================================================
// Source: Maharashtra PWD DSR 2023-24, IS Codes, NBC 2016, RERA Norms
// Extended: All Indian states/UTs, all building types
// 
// Architecture:
//   1. CORE_TASKS       → 117 universal task templates (the skeleton)
//   2. REGIONAL_PARAMS  → State-specific overrides (MIF, soil, rates, approvals)
//   3. BUILDING_TYPES   → Type-specific task modules (what to add/remove)
//   4. CONDITIONAL_RULES → IF-THEN rules for deterministic task selection
// =============================================================================

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type Phase =
  | "site_preparation"
  | "foundation"
  | "plinth"
  | "superstructure"
  | "masonry"
  | "plumbing"
  | "electrical"
  | "plastering"
  | "waterproofing"
  | "flooring"
  | "doors_windows"
  | "painting"
  | "external_works"
  | "approvals_handover"
  | "special_systems"
  | "hvac"
  | "facade"
  | "heavy_structure";

export type Unit = "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Per flat" | "Kg" | "Nos" | "Set" | "kWp";

export type DependencyType = "FS" | "FF" | "SS" | "SF";

export type BuildingType =
  | "residential_g2"
  | "residential_g4"
  | "residential_g7"
  | "residential_g10"
  | "residential_highrise"    // G+15 and above
  | "commercial_office"
  | "commercial_retail"
  | "commercial_mall"
  | "industrial_warehouse"
  | "industrial_factory"
  | "institutional_school"
  | "institutional_hospital"
  | "hospitality_hotel"
  | "mixed_use"
  | "villa_bungalow"
  | "row_house"
  | "farmhouse";

export type SeismicZone = "II" | "III" | "IV" | "V";

export type SoilType =
  | "alluvial"
  | "black_cotton"
  | "laterite"
  | "sandy"
  | "rocky"
  | "hard_rock"
  | "marine_clay"
  | "soft_clay"
  | "red_soil"
  | "mixed";

export type FoundationType =
  | "isolated_footing"
  | "combined_footing"
  | "raft"
  | "pile"
  | "well"
  | "strip";

export type RegionCode =
  | "MH" | "RJ" | "GJ" | "DL" | "TN" | "KA" | "WB" | "KL"
  | "AP" | "TS" | "UP" | "MP" | "CG" | "JH" | "BR" | "OD"
  | "PB" | "HR" | "UK" | "HP" | "GA" | "AS" | "MN" | "ML"
  | "MZ" | "NL" | "TR" | "AR" | "SK" | "JK" | "LA"
  | "AN" | "CH" | "DN" | "DD" | "LD" | "PY";

export interface ProductivityRate {
  min: number;
  max: number;
  unit: string;        // e.g., "Sqm/day", "Cum/hr"
  method?: "manual" | "mechanical" | "both";
  mechanicalMin?: number;
  mechanicalMax?: number;
  mechanicalUnit?: string;
}

export interface CrewMember {
  role: string;
  count: number;
}

export interface Predecessor {
  taskCode: string;
  type: DependencyType;
  lagDays: number;
  note?: string;       // e.g., "(GF)" or "(per floor)" or "(terrace)"
}

export interface TaskTemplate {
  code: string;
  phase: Phase;
  name: string;
  description?: string;
  unit: Unit;
  productivityRate: ProductivityRate;
  monsoonImpactFactor: number;
  crew: CrewMember[];
  predecessors: Predecessor[];
  isCodeRef: string[];
  dsrRef: string;
  safetyChecks: string[];
  remarks: string;
  
  // Conditional flags — rules engine uses these
  isCore: boolean;              // true = included in every project of matching type
  conditions?: TaskCondition[]; // if present, task is only included when conditions are met
  perFloor?: boolean;           // true = repeat for each floor (superstructure tasks)
  perFlat?: boolean;            // true = repeat for each flat (handover tasks)
  
  // Tags for building type filtering
  applicableBuildingTypes?: BuildingType[];   // if undefined, applies to all
  excludedBuildingTypes?: BuildingType[];     // exclude from these types
  
  // Minimum building parameters for this task to apply
  minFloors?: number;
  minHeight?: number;           // meters
  requiresBasement?: boolean;
  requiresLift?: boolean;
  requiresPool?: boolean;
  requiresFireFighting?: boolean;
  requiresSTP?: boolean;
}

export interface TaskCondition {
  field: string;       // project parameter field name
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<" | "includes" | "not_includes";
  value: string | number | boolean;
  note?: string;
}

export interface RegionalParams {
  code: RegionCode;
  name: string;
  commonSoilTypes: SoilType[];
  defaultSoilType: SoilType;
  seismicZone: SeismicZone;
  defaultFoundationType: FoundationType;
  foundationDepthRange: { min: number; max: number }; // meters
  
  // Monsoon data
  monsoonMonths: number[];     // 1-12
  monsoonIntensity: "low" | "moderate" | "high" | "extreme";
  monsoonMifMultiplier: number; // multiplied with task-level MIF
  
  // Climate extremes
  extremeSummerMonths?: number[];
  extremeSummerTempC?: number;
  winterFrostMonths?: number[];
  cycloneRisk: boolean;
  
  // Cost & productivity modifiers
  labourCostIndex: number;     // 1.0 = Maharashtra baseline
  materialCostIndex: number;
  productivityIndex: number;   // <1 means slower, >1 means faster
  
  // Regulatory
  dsrReference: string;
  approvalAuthority: string;
  approvalTimelineDays: { min: number; max: number };
  fireNocRequiredAboveM: number; // height in meters
  stpMandatoryAboveUnits: number;
  reraApplicable: boolean;
  
  // Special considerations
  specialNotes: string[];
  
  // State-specific additional tasks
  additionalTaskCodes?: string[];  // task codes from ADDITIONAL_TASKS
}

export interface BuildingTypeConfig {
  type: BuildingType;
  label: string;
  description: string;
  
  // Floor/height ranges
  typicalFloorRange: { min: number; max: number };
  typicalHeightRange: { min: number; max: number }; // meters
  
  // Which phases are applicable
  applicablePhases: Phase[];
  
  // Tasks to always include for this type
  mandatoryTaskCodes: string[];
  
  // Tasks to never include for this type
  excludedTaskCodes: string[];
  
  // Additional tasks specific to this building type
  additionalTaskCodes: string[];
  
  // Modifiers
  structuralComplexityFactor: number;  // multiplied with durations
  mepComplexityFactor: number;
  finishQualityFactor: number;         // 1.0 = standard, 1.3 = premium
  
  // Special requirements
  requiresCraneAboveFloors?: number;
  requiresPileFoundation?: boolean;
  requiresCurtainWall?: boolean;
  requiresHVAC?: boolean;
  requiresFireFighting?: boolean;
  requiresSTP?: boolean;
  requiresDG?: boolean;               // diesel generator
  requiresElevator?: boolean;
}

export interface ConditionalRule {
  id: string;
  description: string;
  condition: TaskCondition;
  action: "add" | "remove" | "modify";
  taskCodes: string[];
  priority: number;        // higher = evaluated later (can override)
}


// ---------------------------------------------------------------------------
// 1. CORE TASK LIBRARY — 117 tasks (generalized from Maharashtra G+4)
// ---------------------------------------------------------------------------

export const CORE_TASKS: TaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SITE PREPARATION & EARTHWORK (SP-01 to SP-10)
  // =========================================================================
  {
    code: "SP-01",
    phase: "site_preparation",
    name: "Site survey, demarcation & layout",
    unit: "LS",
    productivityRate: { min: 1, max: 1, unit: "day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Licensed Surveyor", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR Ch.1",
    safetyChecks: ["Verify plot boundaries with revenue records"],
    remarks: "As per RERA approved plan",
    isCore: true,
  },
  {
    code: "SP-02",
    phase: "site_preparation",
    name: "Site clearing & grubbing (vegetation, debris)",
    unit: "Sqm",
    productivityRate: { min: 80, max: 100, unit: "Sqm/day" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 4 },
      { role: "JCB Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "SP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 1.1-1.3",
    safetyChecks: ["Photograph existing site conditions"],
    remarks: "Dispose debris per municipal corporation norms",
    isCore: true,
  },
  {
    code: "SP-03",
    phase: "site_preparation",
    name: "Temporary fencing & site security",
    unit: "Rmt",
    productivityRate: { min: 30, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Carpenter", count: 1 },
      { role: "Labourer", count: 3 }
    ],
    predecessors: [{ taskCode: "SP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1200"],
    dsrRef: "DSR 1.4",
    safetyChecks: ["Ensure barricading with caution boards"],
    remarks: "GI sheet / bamboo fencing",
    isCore: true,
  },
  {
    code: "SP-04",
    phase: "site_preparation",
    name: "Temporary site office, store & labour shed",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "SP-03", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Fire extinguisher mandatory"],
    remarks: "Include first-aid room",
    isCore: true,
  },
  {
    code: "SP-05",
    phase: "site_preparation",
    name: "Earthwork excavation in ordinary soil (foundations)",
    unit: "Cum",
    productivityRate: {
      min: 3.0, max: 4.5, unit: "Cum/day", method: "both",
      mechanicalMin: 25, mechanicalMax: 40, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Labourer", count: 4 },
      { role: "JCB Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "SP-02", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 2.1-2.8",
    safetyChecks: ["Check soil type; shoring if depth >1.5m"],
    remarks: "Rate varies by soil classification",
    isCore: true,
    conditions: [{ field: "soilType", operator: "!=", value: "hard_rock" }],
  },
  {
    code: "SP-06",
    phase: "site_preparation",
    name: "Earthwork excavation in hard rock",
    unit: "Cum",
    productivityRate: {
      min: 0.8, max: 1.5, unit: "Cum/day", method: "both",
      mechanicalMin: 8, mechanicalMax: 12, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Rock Breaker Operator", count: 1 },
      { role: "Labourer", count: 3 }
    ],
    predecessors: [{ taskCode: "SP-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 2.9-2.14",
    safetyChecks: ["Blasting prohibited in urban area"],
    remarks: "Hydraulic breaker only",
    isCore: false,
    conditions: [{ field: "soilType", operator: "==", value: "hard_rock" }],
  },
  {
    code: "SP-07",
    phase: "site_preparation",
    name: "Anti-termite treatment (pre-construction)",
    unit: "Sqm",
    productivityRate: { min: 100, max: 150, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Pest Control Operator", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SP-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 6313"],
    dsrRef: "DSR 2.42",
    safetyChecks: ["Use IS-approved chemicals; 5-yr warranty"],
    remarks: "Chlorpyrifos / Imidacloprid",
    isCore: true,
    conditions: [
      { field: "soilType", operator: "==", value: "black_cotton", note: "Mandatory for black cotton soil" },
    ],
  },
  {
    code: "SP-08",
    phase: "site_preparation",
    name: "Sand filling in foundation trenches",
    unit: "Cum",
    productivityRate: { min: 8, max: 12, unit: "Cum/day" },
    monsoonImpactFactor: 1.25,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "SP-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 2.22",
    safetyChecks: ["Compact in 150mm layers; test density"],
    remarks: "Watering & ramming mandatory",
    isCore: true,
  },
  {
    code: "SP-09",
    phase: "site_preparation",
    name: "PCC (1:4:8) in foundation — bed concrete",
    unit: "Cum",
    productivityRate: { min: 3.0, max: 4.0, unit: "Cum/day" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 2 },
      { role: "Mixer Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "SP-08", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.1",
    safetyChecks: ["Cube test; min 75mm thick"],
    remarks: "M7.5 grade; levelled surface",
    isCore: true,
  },
  {
    code: "SP-10",
    phase: "site_preparation",
    name: "Backfilling with excavated earth",
    unit: "Cum",
    productivityRate: {
      min: 6, max: 10, unit: "Cum/day", method: "both",
      mechanicalMin: 30, mechanicalMax: 50, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Labourer", count: 4 },
      { role: "JCB Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "FN-08", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 2.28-2.32",
    safetyChecks: ["Compact in 200mm layers; OMC ±2%"],
    remarks: "After foundation & plinth completion",
    isCore: true,
  },

  // =========================================================================
  // PHASE 2: FOUNDATION (FN-01 to FN-09)
  // =========================================================================
  {
    code: "FN-01",
    phase: "foundation",
    name: "Layout marking for footings (column/combined)",
    unit: "LS",
    productivityRate: { min: 1, max: 2, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Engineer", count: 1 },
      { role: "Surveyor", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SP-09", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "",
    safetyChecks: ["Cross-check with structural drawing"],
    remarks: "Use theodolite / auto-level",
    isCore: true,
  },
  {
    code: "FN-02",
    phase: "foundation",
    name: "Footing reinforcement — cutting, bending, binding",
    unit: "MT",
    productivityRate: { min: 0.03, max: 0.05, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "FN-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2502", "IS 456"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Bar bending schedule approval; lap length"],
    remarks: "Fe-500D TMT; mech. coupler if >32mm",
    isCore: true,
  },
  {
    code: "FN-03",
    phase: "foundation",
    name: "Footing formwork — shuttering & propping",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "FN-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 14687"],
    dsrRef: "DSR 6.1-6.4",
    safetyChecks: ["Check line, level, plumb; oil application"],
    remarks: "Steel / plywood shuttering",
    isCore: true,
  },
  {
    code: "FN-04",
    phase: "foundation",
    name: "Footing concrete (M25) — mixing, pouring, vibrating",
    unit: "Cum",
    productivityRate: {
      min: 3, max: 5, unit: "Cum/day", method: "both",
      mechanicalMin: 15, mechanicalMax: 25, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 6 },
      { role: "Pump Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "FN-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9-5.14",
    safetyChecks: ["Slump test every truck; cube casting"],
    remarks: "Min M25 per IS 456 Table 5",
    isCore: true,
  },
  {
    code: "FN-05",
    phase: "foundation",
    name: "Footing curing (7 days minimum)",
    unit: "Sqm",
    productivityRate: { min: 7, max: 7, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Labourer", count: 2 }
    ],
    predecessors: [{ taskCode: "FN-04", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456 Cl.13.5"],
    dsrRef: "",
    safetyChecks: ["Maintain wet for min 7 days; curing compound alt."],
    remarks: "Ponding / hessian cloth / curing compound",
    isCore: true,
  },
  {
    code: "FN-06",
    phase: "foundation",
    name: "Column stub / starter bars up to plinth",
    unit: "Rmt",
    productivityRate: { min: 3, max: 5, unit: "Rmt/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "FN-04", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "DSR 8.1",
    safetyChecks: ["Check dowel bar embedment & projection"],
    remarks: "As per structural detail",
    isCore: true,
  },
  {
    code: "FN-07",
    phase: "foundation",
    name: "Plinth beam reinforcement — cutting, bending, binding",
    unit: "MT",
    productivityRate: { min: 0.04, max: 0.06, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 3 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "FN-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Seismic detailing per IS 13920"],
    remarks: "Continuous beam; zone III/IV detailing",
    isCore: true,
  },
  {
    code: "FN-08",
    phase: "foundation",
    name: "Plinth beam formwork & concreting (M25)",
    unit: "Cum",
    productivityRate: {
      min: 2, max: 4, unit: "Cum/day", method: "both",
      mechanicalMin: 12, mechanicalMax: 20, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Carpenter", count: 2 },
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 6 },
      { role: "Pump Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "FN-07", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9, 6.1",
    safetyChecks: ["Construction joint treatment if needed"],
    remarks: "Monolithic pour preferred",
    isCore: true,
  },
  {
    code: "FN-09",
    phase: "foundation",
    name: "Plinth beam curing",
    unit: "Sqm",
    productivityRate: { min: 7, max: 7, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Labourer", count: 2 }
    ],
    predecessors: [{ taskCode: "FN-08", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456 Cl.13.5"],
    dsrRef: "",
    safetyChecks: ["Maintain wet for 7 days"],
    remarks: "Hessian + water / curing compound",
    isCore: true,
  },

  // =========================================================================
  // PHASE 3: PLINTH & SUBSTRUCTURE (PL-01 to PL-07)
  // =========================================================================
  {
    code: "PL-01",
    phase: "plinth",
    name: "Plinth masonry (stone / brick) up to plinth level",
    unit: "Cum",
    productivityRate: { min: 1.2, max: 1.8, unit: "Cum/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "FN-09", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 2212", "IS 1905"],
    dsrRef: "DSR 4.1-4.6",
    safetyChecks: ["Mortar ratio 1:6 CM; wet bricks"],
    remarks: "Random rubble / brick as per design",
    isCore: true,
  },
  {
    code: "PL-02",
    phase: "plinth",
    name: "DPC (damp proof course) — 20mm thick CM 1:3 + waterproofing",
    unit: "Sqm",
    productivityRate: { min: 15, max: 20, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PL-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2645"],
    dsrRef: "DSR 7.1-7.3",
    safetyChecks: ["Full width of wall; no cracks; integral WP"],
    remarks: "Add waterproofing compound per IS 2645",
    isCore: true,
  },
  {
    code: "PL-03",
    phase: "plinth",
    name: "Plinth filling with murrum / gravel",
    unit: "Cum",
    productivityRate: {
      min: 10, max: 15, unit: "Cum/day", method: "both",
      mechanicalMin: 40, mechanicalMax: 60, mechanicalUnit: "Cum/hr"
    },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Labourer", count: 4 },
      { role: "Vibro-roller Operator", count: 1 }
    ],
    predecessors: [
      { taskCode: "PL-02", type: "FS", lagDays: 0 },
      { taskCode: "SP-10", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR 2.22-2.26",
    safetyChecks: ["Compact in 150mm layers; plate load test"],
    remarks: "Approved murrum; OMC ±2%",
    isCore: true,
  },
  {
    code: "PL-04",
    phase: "plinth",
    name: "Under-floor PCC (1:4:8) — 100mm thick",
    unit: "Sqm",
    productivityRate: { min: 30, max: 40, unit: "Sqm/day" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 4 },
      { role: "Mixer Operator", count: 1 }
    ],
    predecessors: [{ taskCode: "PL-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.1",
    safetyChecks: ["Level check with auto-level"],
    remarks: "M7.5 grade PCC",
    isCore: true,
  },
  {
    code: "PL-05",
    phase: "plinth",
    name: "Underground water tank construction",
    unit: "LS",
    productivityRate: { min: 15, max: 20, unit: "days" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 4 },
      { role: "Steel Fitter", count: 2 }
    ],
    predecessors: [{ taskCode: "PL-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3370"],
    dsrRef: "DSR 5.14, 8.1",
    safetyChecks: ["Water-tightness test mandatory"],
    remarks: "RCC M30; waterproof plastering",
    isCore: false,
    conditions: [{ field: "undergroundTank", operator: "==", value: true }],
  },
  {
    code: "PL-06",
    phase: "plinth",
    name: "Underground drainage lines (CI/PVC/RCC pipes)",
    unit: "Rmt",
    productivityRate: { min: 15, max: 25, unit: "Rmt/day" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "PL-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1729", "IS 4127"],
    dsrRef: "DSR 17.1-17.8",
    safetyChecks: ["Gradient min 1:60; leakage test"],
    remarks: "PVC SWR pipe as per IS 13592",
    isCore: true,
  },
  {
    code: "PL-07",
    phase: "plinth",
    name: "Septic tank / STP connection (as per local body)",
    unit: "LS",
    productivityRate: { min: 7, max: 10, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Plumber", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "PL-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2470"],
    dsrRef: "DSR 17.12",
    safetyChecks: ["NBC effluent discharge norms"],
    remarks: "STP mandatory per pollution control board for >20 units",
    isCore: true,
  },

  // =========================================================================
  // PHASE 4: SUPERSTRUCTURE — RCC FRAME (SS-01 to SS-12, per floor)
  // =========================================================================
  {
    code: "SS-01",
    phase: "superstructure",
    name: "Column reinforcement — cutting, bending, binding",
    unit: "MT",
    productivityRate: { min: 0.04, max: 0.06, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 4 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [
      { taskCode: "FN-05", type: "FS", lagDays: 3, note: "for ground floor" },
      { taskCode: "SS-09", type: "FS", lagDays: 3, note: "for upper floors" }
    ],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Lap length; cover blocks 40mm; seismic hooks"],
    remarks: "Fe-500D; overlap staggered",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-02",
    phase: "superstructure",
    name: "Column formwork — shuttering, alignment, propping",
    unit: "Sqm",
    productivityRate: { min: 10, max: 14, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 3 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 14687"],
    dsrRef: "DSR 6.1-6.4",
    safetyChecks: ["Plumb check; kicker at base; tie at 300mm c/c"],
    remarks: "Steel column boxes preferred",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-03",
    phase: "superstructure",
    name: "Column concreting (M25/M30) — pouring & vibration",
    unit: "Cum",
    productivityRate: { min: 8, max: 12, unit: "Cum/hr" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Pump Operator", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9-5.14",
    safetyChecks: ["Max free-fall 1.5m; needle vibrator 40mm"],
    remarks: "Pour height max 1.5m; tremie if needed",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-04",
    phase: "superstructure",
    name: "Beam bottom & side shuttering",
    unit: "Sqm",
    productivityRate: { min: 8, max: 10, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 4 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-03", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 14687"],
    dsrRef: "DSR 6.1-6.4",
    safetyChecks: ["Span props at 1.0-1.2m c/c; centering check"],
    remarks: "Adjustable steel props; ply 12/18mm",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-05",
    phase: "superstructure",
    name: "Beam reinforcement — cutting, bending, binding",
    unit: "MT",
    productivityRate: { min: 0.04, max: 0.06, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 4 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Stirrup spacing per BBS; anchorage length"],
    remarks: "Extra bars at beam-column junction",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-06",
    phase: "superstructure",
    name: "Slab shuttering — formwork & props",
    unit: "Sqm",
    productivityRate: { min: 12, max: 18, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 4 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 14687"],
    dsrRef: "DSR 6.1-6.4",
    safetyChecks: ["Prop load capacity check; slab level"],
    remarks: "Props to remain 14 days (slab), 21 days (beam)",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-07",
    phase: "superstructure",
    name: "Slab reinforcement — main + distribution steel",
    unit: "MT",
    productivityRate: { min: 0.05, max: 0.08, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 6 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Chair bars; cover 20mm; conduit placement"],
    remarks: "Bar spacing per structural drawing",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-08",
    phase: "superstructure",
    name: "Slab + beam concreting (M25/M30) — monolithic pour",
    unit: "Cum",
    productivityRate: { min: 15, max: 30, unit: "Cum/hr" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Pump Operator", count: 1 },
      { role: "Labourer", count: 12 },
      { role: "Vibrator Operator", count: 2 }
    ],
    predecessors: [
      { taskCode: "SS-05", type: "FS", lagDays: 0 },
      { taskCode: "SS-07", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9-5.14",
    safetyChecks: ["Slump 100-150mm; cube test; no cold joints"],
    remarks: "Continuous pour; plan for night work if needed",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-09",
    phase: "superstructure",
    name: "Slab curing — ponding / membrane (14 days)",
    unit: "Sqm",
    productivityRate: { min: 14, max: 14, unit: "days" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Labourer", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456 Cl.13.5"],
    dsrRef: "",
    safetyChecks: ["Start curing within 24 hrs; maintain wet"],
    remarks: "14 days min for M25 and above",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-10",
    phase: "superstructure",
    name: "Staircase RCC — formwork, rebar & concreting",
    unit: "Cum",
    productivityRate: { min: 2, max: 3, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Carpenter", count: 2 },
      { role: "Steel Fitter", count: 2 },
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9, 6.1, 8.1",
    safetyChecks: ["Waist slab thickness; tread/riser per NBC"],
    remarks: "As per architectural + structural drawings",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-11",
    phase: "superstructure",
    name: "Deshuttering / stripping of formwork",
    unit: "Sqm",
    productivityRate: { min: 20, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Carpenter", count: 3 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-09", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456 Table 11"],
    dsrRef: "",
    safetyChecks: ["Columns 24hr; slabs 14 days; beams 21 days"],
    remarks: "Stripping times per IS 456 Table 11",
    isCore: true,
    perFloor: true,
  },
  {
    code: "SS-12",
    phase: "superstructure",
    name: "Chajja / sunshade / projection RCC",
    unit: "Cum",
    productivityRate: { min: 1.5, max: 2.5, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Carpenter", count: 1 },
      { role: "Steel Fitter", count: 2 },
      { role: "Mason", count: 1 },
      { role: "Labourer", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 456"],
    dsrRef: "DSR 5.9, 6.1, 8.1",
    safetyChecks: ["Drip mould; waterproofing top"],
    remarks: "Cantilever reinforcement critical",
    isCore: true,
    perFloor: true,
    excludedBuildingTypes: ["industrial_warehouse", "industrial_factory"],
  },

  // =========================================================================
  // PHASE 5: MASONRY & BLOCKWORK (MW-01 to MW-06)
  // =========================================================================
  {
    code: "MW-01",
    phase: "masonry",
    name: "External wall — brick/block masonry (230mm)",
    unit: "Cum",
    productivityRate: { min: 1.0, max: 1.5, unit: "Cum/day per mason" },
    monsoonImpactFactor: 1.25,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "SS-11", type: "FS", lagDays: 3, note: "per floor" }],
    isCodeRef: ["IS 2212", "IS 1905"],
    dsrRef: "DSR 4.1-4.15",
    safetyChecks: ["Wet bricks 24hr; mortar 1:6 CM; tooth/chase"],
    remarks: "AAC block: 3-4 Cum/day; lighter",
    isCore: true,
    perFloor: true,
  },
  {
    code: "MW-02",
    phase: "masonry",
    name: "Internal wall — brick/block masonry (115mm)",
    unit: "Cum",
    productivityRate: { min: 1.2, max: 1.8, unit: "Cum/day per mason" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-11", type: "FS", lagDays: 3, note: "per floor" }],
    isCodeRef: ["IS 2212", "IS 1905"],
    dsrRef: "DSR 4.1-4.15",
    safetyChecks: ["Max height 1.2m/day; cure 7 days"],
    remarks: "Partition walls; lintel band connection",
    isCore: true,
    perFloor: true,
  },
  {
    code: "MW-03",
    phase: "masonry",
    name: "Lintel beam over openings (RCC)",
    unit: "Rmt",
    productivityRate: { min: 6, max: 10, unit: "Rmt/day" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Steel Fitter", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "MW-01", type: "FS", lagDays: 0 },
      { taskCode: "MW-02", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.9",
    safetyChecks: ["Min bearing 150mm each side"],
    remarks: "Precast or in-situ; min depth 150mm",
    isCore: true,
    perFloor: true,
  },
  {
    code: "MW-04",
    phase: "masonry",
    name: "Sill beam / band (RCC)",
    unit: "Rmt",
    productivityRate: { min: 8, max: 12, unit: "Rmt/day" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Steel Fitter", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "MW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4326", "IS 13920"],
    dsrRef: "DSR 5.9",
    safetyChecks: ["Continuous band for seismic resistance"],
    remarks: "Mandatory in seismic zone III and above",
    isCore: true,
    perFloor: true,
  },
  {
    code: "MW-05",
    phase: "masonry",
    name: "Door & window frame fixing in masonry",
    unit: "Each",
    productivityRate: { min: 4, max: 6, unit: "Nos/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 1 },
      { role: "Mason", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "MW-01", type: "FS", lagDays: 0 },
      { taskCode: "MW-02", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 4021"],
    dsrRef: "DSR 9.1-9.6",
    safetyChecks: ["Hold-fast embedment; level & plumb"],
    remarks: "Teak / sal / UPVC frames",
    isCore: true,
    perFloor: true,
  },
  {
    code: "MW-06",
    phase: "masonry",
    name: "Masonry curing (7 days)",
    unit: "Sqm",
    productivityRate: { min: 7, max: 7, unit: "days" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Labourer", count: 2 }
    ],
    predecessors: [
      { taskCode: "MW-01", type: "FS", lagDays: 1 },
      { taskCode: "MW-02", type: "FS", lagDays: 1 }
    ],
    isCodeRef: ["IS 2212"],
    dsrRef: "",
    safetyChecks: ["Wet curing; no loading for 7 days"],
    remarks: "Sprinkler / hessian method",
    isCore: true,
    perFloor: true,
  },

  // =========================================================================
  // PHASE 6: PLUMBING & SANITARY (PB-01 to PB-07)
  // =========================================================================
  {
    code: "PB-01",
    phase: "plumbing",
    name: "Internal water supply lines (GI/CPVC/PPR) — concealed",
    unit: "Rmt",
    productivityRate: { min: 15, max: 20, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "MW-02", type: "FS", lagDays: 3, note: "per floor" }],
    isCodeRef: ["IS 1239", "IS 15778"],
    dsrRef: "DSR 17.1-17.6",
    safetyChecks: ["Pressure test 6 kg/cm² for 2 hrs"],
    remarks: "CPVC preferred; jointing per manufacturer",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PB-02",
    phase: "plumbing",
    name: "Internal drainage / waste lines (PVC SWR) — concealed",
    unit: "Rmt",
    productivityRate: { min: 12, max: 18, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "MW-02", type: "FS", lagDays: 3, note: "per floor" }],
    isCodeRef: ["IS 13592"],
    dsrRef: "DSR 17.7-17.10",
    safetyChecks: ["Gradient 1:40 min; leakage test"],
    remarks: "SWR Type-A pipes; solvent cement joints",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PB-03",
    phase: "plumbing",
    name: "Rainwater downpipes (PVC / CI)",
    unit: "Rmt",
    productivityRate: { min: 10, max: 15, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "MW-01", type: "FS", lagDays: 3, note: "all floors" }],
    isCodeRef: ["IS 13592", "IS 1729"],
    dsrRef: "DSR 17.11",
    safetyChecks: ["Connect to storm water drain"],
    remarks: "110mm dia min; clamps at 1.2m c/c",
    isCore: true,
  },
  {
    code: "PB-04",
    phase: "plumbing",
    name: "Soil vent pipe (SVP) installation",
    unit: "Rmt",
    productivityRate: { min: 8, max: 12, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PB-02", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: ["IS 5329"],
    dsrRef: "DSR 17.11",
    safetyChecks: ["Extend 2m above terrace; cowl cap"],
    remarks: "110mm dia; no reduction in vertical run",
    isCore: true,
  },
  {
    code: "PB-05",
    phase: "plumbing",
    name: "Sanitary fixture installation (WC, basin, sink)",
    unit: "Each",
    productivityRate: { min: 2, max: 3, unit: "Nos/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "FL-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2556", "IS 771"],
    dsrRef: "DSR 18.1-18.12",
    safetyChecks: ["Water seal; fixing with brass screws"],
    remarks: "EWC + flush tank / concealed cistern",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PB-06",
    phase: "plumbing",
    name: "Overhead & underground tank plumbing connections",
    unit: "LS",
    productivityRate: { min: 2, max: 3, unit: "days per tank" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "PL-05", type: "FS", lagDays: 0 },
      { taskCode: "SS-08", type: "FS", lagDays: 0, note: "terrace" }
    ],
    isCodeRef: ["IS 1172"],
    dsrRef: "DSR 17.1",
    safetyChecks: ["Float valve; overflow to drain"],
    remarks: "GI pipe for risers; CPVC for distribution",
    isCore: true,
  },
  {
    code: "PB-07",
    phase: "plumbing",
    name: "Fire fighting pipeline (wet riser system)",
    unit: "Rmt",
    productivityRate: { min: 10, max: 15, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Welder", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: ["IS 3844", "NBC Part-IV"],
    dsrRef: "DSR 17.13",
    safetyChecks: ["Hydrant at each floor; test at 7 kg/cm²"],
    remarks: "MS ERW pipe; wet riser system",
    isCore: false,
    conditions: [{ field: "buildingHeight", operator: ">=", value: 15 }],
    minHeight: 15,
    requiresFireFighting: true,
  },

  // =========================================================================
  // PHASE 7: ELECTRICAL (EL-01 to EL-08)
  // =========================================================================
  {
    code: "EL-01",
    phase: "electrical",
    name: "Electrical conduit laying in slabs (before pour)",
    unit: "Rmt",
    productivityRate: { min: 40, max: 60, unit: "Rmt/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-07", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 9537"],
    dsrRef: "DSR 19.1-19.4",
    safetyChecks: ["No conduit crossing; min 20mm dia"],
    remarks: "PVC HFR conduits; bends pre-formed",
    isCore: true,
    perFloor: true,
  },
  {
    code: "EL-02",
    phase: "electrical",
    name: "Electrical conduit chasing in walls (concealed)",
    unit: "Rmt",
    productivityRate: { min: 20, max: 30, unit: "Rmt/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 1 },
      { role: "Wall Chaser Operator", count: 1 }
    ],
    predecessors: [
      { taskCode: "MW-01", type: "FS", lagDays: 3 },
      { taskCode: "MW-02", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 9537"],
    dsrRef: "DSR 19.1",
    safetyChecks: ["Vertical chases only; repair with polymer mortar"],
    remarks: "Chase width not to exceed conduit + 10mm",
    isCore: true,
    perFloor: true,
  },
  {
    code: "EL-03",
    phase: "electrical",
    name: "Switch board boxes (MS/PVC) fixing in walls",
    unit: "Each",
    productivityRate: { min: 8, max: 12, unit: "Nos/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "EL-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 5765"],
    dsrRef: "DSR 19.5",
    safetyChecks: ["Height as per IS 732; level check"],
    remarks: "Modular type; Anchor / Legrand / Havells",
    isCore: true,
    perFloor: true,
  },
  {
    code: "EL-04",
    phase: "electrical",
    name: "Wiring — FRLS copper cables in conduit",
    unit: "Rmt",
    productivityRate: { min: 50, max: 80, unit: "Rmt/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrician", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PT-03", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 694"],
    dsrRef: "DSR 19.6-19.10",
    safetyChecks: ["No joints inside conduit; megger test"],
    remarks: "1.5 sqmm light; 2.5 sqmm power; 4 sqmm AC",
    isCore: true,
    perFloor: true,
  },
  {
    code: "EL-05",
    phase: "electrical",
    name: "DB (distribution board) installation per flat",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "Nos/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "EL-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 8828"],
    dsrRef: "DSR 19.12",
    safetyChecks: ["MCB sizing; earthing; labelling"],
    remarks: "SP+N MCBs; RCCB 40A 30mA mandatory",
    isCore: true,
    perFloor: true,
  },
  {
    code: "EL-06",
    phase: "electrical",
    name: "Main LT panel & energy meter panel",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Sr. Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "EL-05", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: ["IS 8828", "IS 732"],
    dsrRef: "DSR 19.14",
    safetyChecks: ["DISCOM approval; bus bar sizing"],
    remarks: "As per sanctioned load; state DISCOM norms",
    isCore: true,
  },
  {
    code: "EL-07",
    phase: "electrical",
    name: "Earthing system (pipe earthing / plate earthing)",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "pits/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "GF" }],
    isCodeRef: ["IS 3043"],
    dsrRef: "DSR 19.15",
    safetyChecks: ["Earth resistance <1 ohm; test report"],
    remarks: "CI plate 600x600x12mm / GI pipe",
    isCore: true,
  },
  {
    code: "EL-08",
    phase: "electrical",
    name: "Lightning protection system",
    unit: "LS",
    productivityRate: { min: 2, max: 3, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "terrace" }],
    isCodeRef: ["IS 2309"],
    dsrRef: "DSR 19.16",
    safetyChecks: ["Air terminal; down conductor; earth pit"],
    remarks: "Copper tape 25x3mm; mandatory >15m",
    isCore: false,
    conditions: [{ field: "buildingHeight", operator: ">=", value: 15 }],
    minHeight: 15,
  },

  // =========================================================================
  // PHASE 8: PLASTERING (PT-01 to PT-04)
  // =========================================================================
  {
    code: "PT-01",
    phase: "plastering",
    name: "Internal plastering — CM 1:6 (12mm thick)",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day per mason" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [
      { taskCode: "MW-06", type: "FS", lagDays: 7, note: "per floor" },
      { taskCode: "PB-01", type: "FS", lagDays: 0 },
      { taskCode: "EL-02", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 2402", "IS 1661"],
    dsrRef: "DSR 7.1-7.8",
    safetyChecks: ["Hack surface; wet wall; chicken mesh at junctions"],
    remarks: "2 coats: 10mm base + 2mm finish",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PT-02",
    phase: "plastering",
    name: "External plastering — CM 1:6 (20mm thick — 2 coats)",
    unit: "Sqm",
    productivityRate: { min: 6, max: 8, unit: "Sqm/day per mason" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 4 },
      { role: "Scaffolding Crew", count: 2 }
    ],
    predecessors: [{ taskCode: "MW-06", type: "FS", lagDays: 7, note: "all floors done" }],
    isCodeRef: ["IS 2402", "IS 1661"],
    dsrRef: "DSR 7.1-7.8",
    safetyChecks: ["Scaffolding inspection; safety net/harness"],
    remarks: "Base coat 12mm + finish 8mm; groove/drip",
    isCore: true,
  },
  {
    code: "PT-03",
    phase: "plastering",
    name: "Ceiling plastering — CM 1:4 (6mm thick)",
    unit: "Sqm",
    productivityRate: { min: 6, max: 8, unit: "Sqm/day per mason" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-11", type: "FS", lagDays: 7, note: "per floor" }],
    isCodeRef: ["IS 2402"],
    dsrRef: "DSR 7.9",
    safetyChecks: ["Apply bonding agent if RCC smooth"],
    remarks: "Neeru finish / POP punning separate",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PT-04",
    phase: "plastering",
    name: "Plaster curing (7 days)",
    unit: "Sqm",
    productivityRate: { min: 7, max: 7, unit: "days" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Labourer", count: 2 }
    ],
    predecessors: [
      { taskCode: "PT-01", type: "FS", lagDays: 1, note: "all floors" },
      { taskCode: "PT-02", type: "FS", lagDays: 1 },
      { taskCode: "PT-03", type: "FS", lagDays: 1, note: "all floors" }
    ],
    isCodeRef: ["IS 2402"],
    dsrRef: "",
    safetyChecks: ["Wet curing mandatory"],
    remarks: "Sprinkler system or manual",
    isCore: true,
  },

  // =========================================================================
  // PHASE 9: WATERPROOFING (WP-01 to WP-04)
  // =========================================================================
  {
    code: "WP-01",
    phase: "waterproofing",
    name: "Terrace waterproofing — polymer modified bitumen / APP membrane",
    unit: "Sqm",
    productivityRate: { min: 20, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "WP Specialist", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-09", type: "FS", lagDays: 7, note: "terrace slab" }],
    isCodeRef: ["IS 13983", "IS 1580"],
    dsrRef: "DSR 7.22-7.28",
    safetyChecks: ["Ponding test 72 hrs; 10-yr warranty"],
    remarks: "2-coat APP membrane + protection screed",
    isCore: true,
  },
  {
    code: "WP-02",
    phase: "waterproofing",
    name: "Toilet / wet area waterproofing — cementitious coating",
    unit: "Sqm",
    productivityRate: { min: 15, max: 20, unit: "Sqm/day" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "WP Specialist", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PL-04", type: "FS", lagDays: 0, note: "or SS-08 per floor" }],
    isCodeRef: ["IS 2645"],
    dsrRef: "DSR 7.22",
    safetyChecks: ["Turn up 300mm on walls; ponding test 48 hrs"],
    remarks: "2-coat polymer modified cement coating",
    isCore: true,
    perFloor: true,
  },
  {
    code: "WP-03",
    phase: "waterproofing",
    name: "Basement waterproofing",
    unit: "Sqm",
    productivityRate: { min: 10, max: 15, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "WP Specialist", count: 1 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "FN-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3067"],
    dsrRef: "DSR 7.22",
    safetyChecks: ["External membrane + protection board"],
    remarks: "Crystalline / membrane system",
    isCore: false,
    requiresBasement: true,
    conditions: [{ field: "basements", operator: ">=", value: 1 }],
  },
  {
    code: "WP-04",
    phase: "waterproofing",
    name: "Expansion joint treatment",
    unit: "Rmt",
    productivityRate: { min: 8, max: 12, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "WP Specialist", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "WP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3414"],
    dsrRef: "DSR 7.28",
    safetyChecks: ["Polysulphide sealant; backer rod"],
    remarks: "At every 30m or structural joint",
    isCore: false,
    conditions: [{ field: "totalArea", operator: ">=", value: 2000 }],
  },

  // =========================================================================
  // PHASE 10: FLOORING & TILING (FL-01 to FL-08)
  // =========================================================================
  {
    code: "FL-01",
    phase: "flooring",
    name: "Floor base — CM 1:4 screeding (50mm avg.)",
    unit: "Sqm",
    productivityRate: { min: 12, max: 16, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [
      { taskCode: "WP-02", type: "FS", lagDays: 0, note: "toilets" },
      { taskCode: "PT-01", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 2571"],
    dsrRef: "DSR 11.1",
    safetyChecks: ["Slope toward drain in toilets; level check"],
    remarks: "Add waterproofing compound in wet areas",
    isCore: true,
    perFloor: true,
  },
  {
    code: "FL-02",
    phase: "flooring",
    name: "Vitrified tile flooring (600x600mm) — rooms",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day per mason" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Tile Specialist", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "FL-01", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 15622"],
    dsrRef: "DSR 11.8-11.14",
    safetyChecks: ["Tile adhesive / CM 1:4; spacers 2mm; level"],
    remarks: "First quality tiles; 3mm joint; grouting",
    isCore: true,
    perFloor: true,
  },
  {
    code: "FL-03",
    phase: "flooring",
    name: "Ceramic wall tiles (300x450mm) — kitchen / toilets (dado)",
    unit: "Sqm",
    productivityRate: { min: 5, max: 8, unit: "Sqm/day per mason" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Tile Specialist", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PT-01", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 15622", "IS 13753"],
    dsrRef: "DSR 11.8-11.14",
    safetyChecks: ["Tile adhesive; check alignment & level"],
    remarks: "Full height in toilets; 600mm dado in kitchen",
    isCore: true,
    perFloor: true,
  },
  {
    code: "FL-04",
    phase: "flooring",
    name: "Anti-skid tiles — toilets & balconies",
    unit: "Sqm",
    productivityRate: { min: 6, max: 10, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "FL-01", type: "FS", lagDays: 0 },
      { taskCode: "WP-02", type: "FS", lagDays: 1 }
    ],
    isCodeRef: ["IS 15622"],
    dsrRef: "DSR 11.8",
    safetyChecks: ["Surface finish >0.5 CoF; slope check"],
    remarks: "Matt / anti-skid finish mandatory",
    isCore: true,
    perFloor: true,
  },
  {
    code: "FL-05",
    phase: "flooring",
    name: "Staircase kota / granite flooring & nosing",
    unit: "Sqm",
    productivityRate: { min: 4, max: 6, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Stone Specialist", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-10", type: "FS", lagDays: 7, note: "all floors" }],
    isCodeRef: ["IS 1124", "IS 3622"],
    dsrRef: "DSR 11.15-11.18",
    safetyChecks: ["Nosing strip; anti-skid groove"],
    remarks: "Kota / granite 18-20mm thick; mirror polish",
    isCore: true,
  },
  {
    code: "FL-06",
    phase: "flooring",
    name: "Common area flooring (lobby, corridor)",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "PT-01", type: "FS", lagDays: 3, note: "all floors" }],
    isCodeRef: ["IS 15622"],
    dsrRef: "DSR 11.8",
    safetyChecks: ["Pattern layout approval; grouting"],
    remarks: "Double-charged vitrified / marble",
    isCore: true,
  },
  {
    code: "FL-07",
    phase: "flooring",
    name: "Skirting / border (75-100mm height)",
    unit: "Rmt",
    productivityRate: { min: 15, max: 25, unit: "Rmt/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "FL-02", type: "FS", lagDays: 1 }],
    isCodeRef: [],
    dsrRef: "DSR 11.20",
    safetyChecks: ["Match floor tile; level & straight"],
    remarks: "Same tile as floor; 100mm height",
    isCore: true,
    perFloor: true,
  },
  {
    code: "FL-08",
    phase: "flooring",
    name: "Tile joint grouting & cleaning",
    unit: "Sqm",
    productivityRate: { min: 40, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Mason", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "FL-02", type: "FS", lagDays: 1 },
      { taskCode: "FL-03", type: "FS", lagDays: 1 },
      { taskCode: "FL-04", type: "FS", lagDays: 1 }
    ],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Epoxy grout in wet areas; cement grout elsewhere"],
    remarks: "Clean within 24 hrs; acid wash if needed",
    isCore: true,
    perFloor: true,
  },

  // =========================================================================
  // PHASE 11: DOORS, WINDOWS & GRILLES (DW-01 to DW-07)
  // =========================================================================
  {
    code: "DW-01",
    phase: "doors_windows",
    name: "Main door frame & shutter (teak / flush)",
    unit: "Each",
    productivityRate: { min: 2, max: 3, unit: "doors/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Carpenter", count: 2 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [
      { taskCode: "PT-01", type: "FS", lagDays: 3 },
      { taskCode: "MW-05", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 4021", "IS 2202"],
    dsrRef: "DSR 9.1-9.8",
    safetyChecks: ["3 hinges; tower bolt; mortise lock"],
    remarks: "Teak frame 100x75mm; flush shutter 35mm",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-02",
    phase: "doors_windows",
    name: "Internal door shutters (flush doors)",
    unit: "Each",
    productivityRate: { min: 3, max: 5, unit: "doors/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Carpenter", count: 2 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [
      { taskCode: "PT-01", type: "FS", lagDays: 3 },
      { taskCode: "MW-05", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 2202", "IS 4021"],
    dsrRef: "DSR 9.1-9.8",
    safetyChecks: ["3 hinges; latch; rubber stopper"],
    remarks: "Commercial flush 30mm; lipping both sides",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-03",
    phase: "doors_windows",
    name: "Toilet door (FRP / PVC water-resistant)",
    unit: "Each",
    productivityRate: { min: 4, max: 6, unit: "doors/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Carpenter", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [
      { taskCode: "PT-01", type: "FS", lagDays: 3 },
      { taskCode: "MW-05", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 4020"],
    dsrRef: "DSR 9.9",
    safetyChecks: ["Louver at bottom for ventilation"],
    remarks: "FRP / WPC door; water-resistant",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-04",
    phase: "doors_windows",
    name: "Aluminium sliding windows with glass",
    unit: "Sqm",
    productivityRate: { min: 4, max: 6, unit: "Sqm/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Aluminium Fabricator", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "MW-05", type: "FS", lagDays: 0 },
      { taskCode: "PT-02", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 1948", "IS 2553"],
    dsrRef: "DSR 10.1-10.6",
    safetyChecks: ["Sealant; drainage slots; safety glass >4th floor"],
    remarks: "3-track powder-coated aluminium; 5mm glass",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-05",
    phase: "doors_windows",
    name: "MS safety grilles for windows",
    unit: "Sqm",
    productivityRate: { min: 3, max: 5, unit: "Sqm/day" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Welder/Fabricator", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "DW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1038"],
    dsrRef: "DSR 10.8",
    safetyChecks: ["Embed in frame; anti-rust primer"],
    remarks: "MS square pipe 20x20mm; enamel paint",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-06",
    phase: "doors_windows",
    name: "Balcony railing (MS / SS)",
    unit: "Rmt",
    productivityRate: { min: 3, max: 5, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Welder/Fabricator", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1038", "NBC Part-IV"],
    dsrRef: "DSR 10.10",
    safetyChecks: ["Min height 1050mm; max gap 100mm"],
    remarks: "SS 304 pipe railing or MS with enamel",
    isCore: true,
    perFloor: true,
  },
  {
    code: "DW-07",
    phase: "doors_windows",
    name: "Staircase railing (MS / SS)",
    unit: "Rmt",
    productivityRate: { min: 3, max: 5, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Welder/Fabricator", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "FL-05", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 1038", "NBC Part-IV"],
    dsrRef: "DSR 10.10",
    safetyChecks: ["Min height 900mm on stair; 1050mm at landing"],
    remarks: "Continuous handrail; anchored to slab/wall",
    isCore: true,
  },

  // =========================================================================
  // PHASE 12: PAINTING (PA-01 to PA-06)
  // =========================================================================
  {
    code: "PA-01",
    phase: "painting",
    name: "Primer coat — internal walls & ceiling (acrylic primer)",
    unit: "Sqm",
    productivityRate: { min: 20, max: 25, unit: "Sqm/day per painter" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Painter", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PT-04", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 5411"],
    dsrRef: "DSR 13.1-13.4",
    safetyChecks: ["Surface must be dry; patch POP cracks"],
    remarks: "White cement putty 2 coats before primer",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PA-02",
    phase: "painting",
    name: "Internal wall painting — acrylic emulsion (2 coats)",
    unit: "Sqm",
    productivityRate: { min: 15, max: 20, unit: "Sqm/day per painter" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Painter", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PA-01", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 15489"],
    dsrRef: "DSR 13.5-13.8",
    safetyChecks: ["Roller / brush; 4-hr gap between coats"],
    remarks: "Premium acrylic emulsion; washable",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PA-03",
    phase: "painting",
    name: "External wall painting — exterior emulsion (2 coats)",
    unit: "Sqm",
    productivityRate: { min: 10, max: 14, unit: "Sqm/day per painter" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Painter", count: 2 },
      { role: "Helper", count: 2 },
      { role: "Scaffolding Crew", count: 2 }
    ],
    predecessors: [{ taskCode: "PT-04", type: "FS", lagDays: 7, note: "external" }],
    isCodeRef: ["IS 15489"],
    dsrRef: "DSR 13.9-13.12",
    safetyChecks: ["Weather check; no painting in rain / >35°C"],
    remarks: "Exterior grade; 7-10 year warranty paint",
    isCore: true,
  },
  {
    code: "PA-04",
    phase: "painting",
    name: "Woodwork painting — enamel (door/window frames — 2 coats)",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day per painter" },
    monsoonImpactFactor: 1.15,
    crew: [
      { role: "Painter", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [
      { taskCode: "DW-01", type: "FS", lagDays: 3 },
      { taskCode: "DW-02", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 2932"],
    dsrRef: "DSR 13.13-13.16",
    safetyChecks: ["Sand between coats; primer mandatory"],
    remarks: "Synthetic enamel; satin / gloss finish",
    isCore: true,
    perFloor: true,
  },
  {
    code: "PA-05",
    phase: "painting",
    name: "MS grille & railing painting — anti-rust + enamel",
    unit: "Sqm",
    productivityRate: { min: 6, max: 10, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Painter", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [
      { taskCode: "DW-05", type: "FS", lagDays: 3, note: "all floors" },
      { taskCode: "DW-06", type: "FS", lagDays: 3, note: "all floors" },
      { taskCode: "DW-07", type: "FS", lagDays: 3 }
    ],
    isCodeRef: ["IS 2074"],
    dsrRef: "DSR 13.17-13.18",
    safetyChecks: ["Red oxide primer 2 coats + enamel 2 coats"],
    remarks: "Wire brush / sand blast; rust preventive",
    isCore: true,
  },
  {
    code: "PA-06",
    phase: "painting",
    name: "Ceiling POP / putty work (2 coats)",
    unit: "Sqm",
    productivityRate: { min: 10, max: 15, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "POP Specialist", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "PT-03", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 2547"],
    dsrRef: "DSR 13.20",
    safetyChecks: ["Sand smooth; no undulations"],
    remarks: "Wall care putty / POP; sand with 180 grit",
    isCore: true,
    perFloor: true,
  },

  // =========================================================================
  // PHASE 13: EXTERNAL WORKS & SERVICES (EX-01 to EX-12)
  // =========================================================================
  {
    code: "EX-01",
    phase: "external_works",
    name: "Compound wall construction (brick/block + RCC columns)",
    unit: "Rmt",
    productivityRate: { min: 3, max: 5, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "SP-10", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1905"],
    dsrRef: "DSR 4.1, 5.9",
    safetyChecks: ["Foundation for compound wall; plumb check"],
    remarks: "Height as per sanctioned plan; max 1.8m",
    isCore: true,
  },
  {
    code: "EX-02",
    phase: "external_works",
    name: "Main gate (MS fabricated / SS)",
    unit: "Each",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Fabricator", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "EX-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1038"],
    dsrRef: "DSR 10.12",
    safetyChecks: ["Foundation for gate pillars; pivot/roller mechanism"],
    remarks: "Sliding / swing; motorized optional",
    isCore: true,
  },
  {
    code: "EX-03",
    phase: "external_works",
    name: "External paving — paver blocks / CC pavement",
    unit: "Sqm",
    productivityRate: { min: 15, max: 25, unit: "Sqm/day" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "EX-01", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 15658"],
    dsrRef: "DSR 11.22",
    safetyChecks: ["Sub-base compaction; sand bedding"],
    remarks: "60mm thick paver blocks; herringbone pattern",
    isCore: true,
  },
  {
    code: "EX-04",
    phase: "external_works",
    name: "Stormwater drainage — external",
    unit: "Rmt",
    productivityRate: { min: 10, max: 15, unit: "Rmt/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Labourer", count: 3 }
    ],
    predecessors: [{ taskCode: "EX-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4127"],
    dsrRef: "DSR 17.14",
    safetyChecks: ["Gradient min 1:100; catch pits at bends"],
    remarks: "RCC NP3 pipes / PVC SWR pipes",
    isCore: true,
  },
  {
    code: "EX-05",
    phase: "external_works",
    name: "External electrification — street lights, gate lights",
    unit: "Each",
    productivityRate: { min: 2, max: 4, unit: "poles/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "EL-06", type: "FS", lagDays: 0 },
      { taskCode: "EX-01", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 1944", "IS 732"],
    dsrRef: "DSR 19.18",
    safetyChecks: ["Earthing for each pole; waterproof fixtures"],
    remarks: "LED 30-50W; photocell / timer control",
    isCore: true,
  },
  {
    code: "EX-06",
    phase: "external_works",
    name: "Overhead water tank (RCC / SS sectional)",
    unit: "LS",
    productivityRate: {
      min: 10, max: 15, unit: "days", method: "both",
      mechanicalMin: 3, mechanicalMax: 5, mechanicalUnit: "days (SS sectional)"
    },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 4 },
      { role: "Steel Fitter", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "terrace" }],
    isCodeRef: ["IS 3370"],
    dsrRef: "DSR 5.14 / 18.14",
    safetyChecks: ["Water-tightness test; overflow arrangement"],
    remarks: "Capacity per IS 1172; 135 LPCD",
    isCore: true,
  },
  {
    code: "EX-07",
    phase: "external_works",
    name: "Borewell / water connection from local body",
    unit: "LS",
    productivityRate: { min: 2, max: 5, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Bore Rig Crew", count: 3 }
    ],
    predecessors: [{ taskCode: "PL-06", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Yield test; water quality test"],
    remarks: "State groundwater act compliance",
    isCore: true,
  },
  {
    code: "EX-08",
    phase: "external_works",
    name: "Pump room — pumps, panels, piping",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [
      { taskCode: "EX-06", type: "FS", lagDays: 0 },
      { taskCode: "EX-07", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 1172", "IS 9079"],
    dsrRef: "DSR 17.1, 19.14",
    safetyChecks: ["Vibration isolators; auto-manual switch"],
    remarks: "Submersible + pressure pump; VFD optional",
    isCore: true,
  },
  {
    code: "EX-09",
    phase: "external_works",
    name: "STP / sewage connection to municipal line",
    unit: "LS",
    productivityRate: { min: 10, max: 15, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Specialist Contractor", count: 1 }
    ],
    predecessors: [{ taskCode: "PL-07", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Pollution control board consent; treated effluent standards"],
    remarks: "STP mandatory above threshold per state PCB",
    isCore: false,
    conditions: [{ field: "totalUnits", operator: ">=", value: 20 }],
    requiresSTP: true,
  },
  {
    code: "EX-10",
    phase: "external_works",
    name: "Lift installation",
    unit: "Each",
    productivityRate: { min: 30, max: 45, unit: "days" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Lift Company Crew", count: 5 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: ["IS 14665", "IS 15785"],
    dsrRef: "",
    safetyChecks: ["PESO licence; load test; safety cert"],
    remarks: "6-8 passenger; machine-room-less preferred",
    isCore: false,
    conditions: [{ field: "lifts", operator: ">=", value: 1 }],
    requiresLift: true,
  },
  {
    code: "EX-11",
    phase: "external_works",
    name: "CCTV & intercom system",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Technician", count: 1 },
      { role: "Helper", count: 1 }
    ],
    predecessors: [{ taskCode: "EL-04", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["DVR room; cable management"],
    remarks: "IP cameras; 30-day recording",
    isCore: false,
    conditions: [{ field: "totalUnits", operator: ">=", value: 8 }],
  },
  {
    code: "EX-12",
    phase: "external_works",
    name: "Landscaping & tree plantation",
    unit: "Sqm",
    productivityRate: { min: 20, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Gardener", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "EX-03", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Min 15% open space as per development rules"],
    remarks: "Local species; drip irrigation",
    isCore: true,
  },

  // =========================================================================
  // PHASE 14: APPROVALS & HANDOVER (HO-01 to HO-10)
  // =========================================================================
  {
    code: "HO-01",
    phase: "approvals_handover",
    name: "Completion certificate from architect & structural engineer",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Architect", count: 1 },
      { role: "Structural Engineer", count: 1 }
    ],
    predecessors: [], // dynamically set to "all construction tasks"
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["As-built drawings; structural stability cert."],
    remarks: "Mandatory for OC application",
    isCore: true,
  },
  {
    code: "HO-02",
    phase: "approvals_handover",
    name: "Permanent power connection from DISCOM",
    unit: "LS",
    productivityRate: { min: 15, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrical Contractor", count: 1 }
    ],
    predecessors: [{ taskCode: "EL-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 732"],
    dsrRef: "",
    safetyChecks: ["Test report; wiring certificate"],
    remarks: "Apply 30 days before expected OC",
    isCore: true,
  },
  {
    code: "HO-03",
    phase: "approvals_handover",
    name: "Water department NOC / connection",
    unit: "LS",
    productivityRate: { min: 7, max: 15, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Plumbing Contractor", count: 1 }
    ],
    predecessors: [{ taskCode: "EX-07", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Pipeline connection; meter installation"],
    remarks: "Apply to local municipal corporation",
    isCore: true,
  },
  {
    code: "HO-04",
    phase: "approvals_handover",
    name: "Fire department NOC",
    unit: "LS",
    productivityRate: { min: 7, max: 15, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Fire Consultant", count: 1 }
    ],
    predecessors: [{ taskCode: "PB-07", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC Part-IV"],
    dsrRef: "",
    safetyChecks: ["All fire safety provisions in place"],
    remarks: "Mandatory for buildings above height threshold per state",
    isCore: false,
    conditions: [{ field: "buildingHeight", operator: ">=", value: 15 }],
    requiresFireFighting: true,
  },
  {
    code: "HO-05",
    phase: "approvals_handover",
    name: "RERA compliance — update & upload",
    unit: "LS",
    productivityRate: { min: 5, max: 7, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "RERA Consultant", count: 1 }
    ],
    predecessors: [{ taskCode: "HO-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["RERA Act 2016"],
    dsrRef: "",
    safetyChecks: ["Quarterly update; form-5 submission"],
    remarks: "Project completion intimation to state RERA",
    isCore: true,
    conditions: [{ field: "reraApplicable", operator: "==", value: true }],
  },
  {
    code: "HO-06",
    phase: "approvals_handover",
    name: "Occupancy Certificate (OC) from planning authority",
    unit: "LS",
    productivityRate: { min: 15, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Architect", count: 1 },
      { role: "Developer", count: 1 }
    ],
    predecessors: [
      { taskCode: "HO-01", type: "FS", lagDays: 0 },
      { taskCode: "HO-02", type: "FS", lagDays: 0 },
      { taskCode: "HO-03", type: "FS", lagDays: 0 },
      { taskCode: "HO-04", type: "FS", lagDays: 0 },
      { taskCode: "HO-05", type: "FS", lagDays: 0 }
    ],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["All NOCs attached; as-built drawings"],
    remarks: "Part OC possible for completed wings",
    isCore: true,
  },
  {
    code: "HO-07",
    phase: "approvals_handover",
    name: "Common area snag list & rectification",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Engineer", count: 1 },
      { role: "Multi-trade Team", count: 4 }
    ],
    predecessors: [{ taskCode: "HO-01", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Systematic inspection; photographic record"],
    remarks: "Plumbing, electrical, civil, painting snags",
    isCore: true,
  },
  {
    code: "HO-08",
    phase: "approvals_handover",
    name: "Individual flat snag list & rectification",
    unit: "Per flat",
    productivityRate: { min: 1, max: 2, unit: "days per flat" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Engineer", count: 1 },
      { role: "Mason", count: 1 },
      { role: "Plumber", count: 1 },
      { role: "Electrician", count: 1 }
    ],
    predecessors: [{ taskCode: "HO-07", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Walk-through with buyer; punch list"],
    remarks: "As per RERA agreement specifications",
    isCore: true,
    perFlat: true,
  },
  {
    code: "HO-09",
    phase: "approvals_handover",
    name: "Handover of flat keys, manuals & warranties",
    unit: "Per flat",
    productivityRate: { min: 1, max: 2, unit: "flats/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Sales Team", count: 1 }
    ],
    predecessors: [
      { taskCode: "HO-06", type: "FS", lagDays: 0 },
      { taskCode: "HO-08", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["RERA Act"],
    dsrRef: "",
    safetyChecks: ["All warranties; appliance manuals; maintenance guide"],
    remarks: "Include common area maintenance SOP",
    isCore: true,
    perFlat: true,
  },
  {
    code: "HO-10",
    phase: "approvals_handover",
    name: "Society formation & common area handover",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Developer Legal Team", count: 2 }
    ],
    predecessors: [{ taskCode: "HO-06", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["All documents; maintenance fund transfer"],
    remarks: "Mandatory within timeline per state RERA/housing act",
    isCore: true,
    excludedBuildingTypes: ["villa_bungalow", "farmhouse", "industrial_warehouse", "industrial_factory"],
  },
];


// ---------------------------------------------------------------------------
// 2. ADDITIONAL TASKS — Building-type specific (not in core 117)
// ---------------------------------------------------------------------------

export const ADDITIONAL_TASKS: TaskTemplate[] = [
  // === PILE FOUNDATION MODULE ===
  {
    code: "PF-01",
    phase: "foundation",
    name: "Pile boring / driving (RCC bored cast-in-situ)",
    unit: "Rmt",
    productivityRate: { min: 8, max: 15, unit: "Rmt/day per rig" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Piling Rig Operator", count: 1 },
      { role: "Helper", count: 4 },
      { role: "Engineer", count: 1 }
    ],
    predecessors: [{ taskCode: "SP-09", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 2911 Part-I"],
    dsrRef: "DSR 5.20-5.24",
    safetyChecks: ["Pile integrity test; load test on 2% piles"],
    remarks: "Bentonite slurry for stability; tremie concreting",
    isCore: false,
    conditions: [{ field: "foundationType", operator: "==", value: "pile" }],
    applicableBuildingTypes: ["residential_highrise", "commercial_office", "commercial_mall", "institutional_hospital"],
  },
  {
    code: "PF-02",
    phase: "foundation",
    name: "Pile cap construction (RCC)",
    unit: "Cum",
    productivityRate: { min: 3, max: 5, unit: "Cum/day" },
    monsoonImpactFactor: 1.35,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Steel Fitter", count: 3 },
      { role: "Labourer", count: 6 }
    ],
    predecessors: [{ taskCode: "PF-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 2911", "IS 456"],
    dsrRef: "DSR 5.14",
    safetyChecks: ["Pile head trimming; reinforcement cage placement"],
    remarks: "M30 concrete minimum",
    isCore: false,
    conditions: [{ field: "foundationType", operator: "==", value: "pile" }],
  },
  {
    code: "PF-03",
    phase: "foundation",
    name: "Pile load test (routine & initial)",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "days per test" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "PF-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 2911 Part-IV"],
    dsrRef: "",
    safetyChecks: ["Maintained load test; settlement measurement"],
    remarks: "Test 2% of total piles; initial test to 2.5x working load",
    isCore: false,
    conditions: [{ field: "foundationType", operator: "==", value: "pile" }],
  },

  // === RAFT FOUNDATION MODULE ===
  {
    code: "RF-01",
    phase: "foundation",
    name: "Raft foundation — reinforcement (heavy)",
    unit: "MT",
    productivityRate: { min: 0.03, max: 0.05, unit: "MT/day per fitter" },
    monsoonImpactFactor: 1.05,
    crew: [
      { role: "Steel Fitter", count: 6 },
      { role: "Helper", count: 6 }
    ],
    predecessors: [{ taskCode: "SP-09", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456", "IS 2502"],
    dsrRef: "DSR 8.1-8.4",
    safetyChecks: ["Two-layer mesh; chair bars; cover 75mm bottom"],
    remarks: "Heavy reinforcement; mech. couplers for >25mm bars",
    isCore: false,
    conditions: [{ field: "foundationType", operator: "==", value: "raft" }],
  },
  {
    code: "RF-02",
    phase: "foundation",
    name: "Raft foundation — mass concreting (M30)",
    unit: "Cum",
    productivityRate: { min: 20, max: 40, unit: "Cum/hr" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "RMC Pump Operator", count: 1 },
      { role: "Vibrator Operator", count: 3 },
      { role: "Labourer", count: 15 }
    ],
    predecessors: [{ taskCode: "RF-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456:2000"],
    dsrRef: "DSR 5.14",
    safetyChecks: ["Continuous pour; temperature control; no cold joints"],
    remarks: "Night pouring may be needed; ice in mix if >30°C ambient",
    isCore: false,
    conditions: [{ field: "foundationType", operator: "==", value: "raft" }],
  },

  // === BASEMENT MODULE ===
  {
    code: "BM-01",
    phase: "foundation",
    name: "Basement retaining wall construction (RCC)",
    unit: "Cum",
    productivityRate: { min: 3, max: 5, unit: "Cum/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 8 }
    ],
    predecessors: [{ taskCode: "FN-04", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 456", "IS 3370"],
    dsrRef: "DSR 5.14, 6.1",
    safetyChecks: ["Lateral earth pressure design; waterproofing"],
    remarks: "Pour in lifts of 1.5m max; construction joints with waterstop",
    isCore: false,
    conditions: [{ field: "basements", operator: ">=", value: 1 }],
    requiresBasement: true,
  },
  {
    code: "BM-02",
    phase: "foundation",
    name: "Basement slab construction (RCC)",
    unit: "Cum",
    productivityRate: { min: 15, max: 25, unit: "Cum/hr" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Pump Operator", count: 1 },
      { role: "Vibrator Operator", count: 2 },
      { role: "Labourer", count: 10 }
    ],
    predecessors: [{ taskCode: "BM-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 456", "IS 3370"],
    dsrRef: "DSR 5.14",
    safetyChecks: ["Waterproof concrete; membrane under slab"],
    remarks: "M30 with integral waterproofing",
    isCore: false,
    conditions: [{ field: "basements", operator: ">=", value: 1 }],
    requiresBasement: true,
  },
  {
    code: "BM-03",
    phase: "foundation",
    name: "Basement dewatering system",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Plumber", count: 1 },
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "BM-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1172"],
    dsrRef: "",
    safetyChecks: ["Sump pit; auto float switch; backup pump"],
    remarks: "Essential in high water table areas",
    isCore: false,
    conditions: [{ field: "basements", operator: ">=", value: 1 }],
    requiresBasement: true,
  },

  // === HVAC MODULE ===
  {
    code: "HV-01",
    phase: "hvac",
    name: "HVAC duct installation (GI/pre-insulated)",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "HVAC Technician", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-11", type: "FS", lagDays: 3, note: "per floor" }],
    isCodeRef: ["IS 655"],
    dsrRef: "",
    safetyChecks: ["Duct leakage test; insulation check"],
    remarks: "Coordinate with false ceiling layout",
    isCore: false,
    conditions: [{ field: "hvac", operator: "==", value: true }],
    applicableBuildingTypes: ["commercial_office", "commercial_retail", "commercial_mall", "institutional_hospital", "hospitality_hotel"],
  },
  {
    code: "HV-02",
    phase: "hvac",
    name: "AHU / FCU installation",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "units/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "HVAC Technician", count: 2 },
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "HV-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3103"],
    dsrRef: "",
    safetyChecks: ["Vibration isolation; drain pan connection"],
    remarks: "VRV/VRF for smaller buildings",
    isCore: false,
    conditions: [{ field: "hvac", operator: "==", value: true }],
  },
  {
    code: "HV-03",
    phase: "hvac",
    name: "Chiller / cooling tower installation",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "HVAC Specialist", count: 3 },
      { role: "Electrician", count: 1 },
      { role: "Plumber", count: 1 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "HV-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4893"],
    dsrRef: "",
    safetyChecks: ["Chemical treatment plan; noise compliance"],
    remarks: "Typically on terrace or basement plant room",
    isCore: false,
    conditions: [{ field: "centralAC", operator: "==", value: true }],
  },

  // === CURTAIN WALL / FACADE MODULE ===
  {
    code: "CW-01",
    phase: "facade",
    name: "Curtain wall / ACP facade — framework installation",
    unit: "Sqm",
    productivityRate: { min: 5, max: 8, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Facade Specialist", count: 3 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 7, note: "all floors" }],
    isCodeRef: ["IS 13830"],
    dsrRef: "",
    safetyChecks: ["Anchor bolt pull-out test; sealant compatibility"],
    remarks: "Aluminium mullion-transom system",
    isCore: false,
    conditions: [{ field: "facadeType", operator: "==", value: "curtain_wall" }],
    applicableBuildingTypes: ["commercial_office", "commercial_mall", "residential_highrise", "hospitality_hotel"],
  },
  {
    code: "CW-02",
    phase: "facade",
    name: "Curtain wall glazing — DGU glass panels",
    unit: "Sqm",
    productivityRate: { min: 6, max: 10, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Glazier", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "CW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2553", "NBC Part-IV"],
    dsrRef: "",
    safetyChecks: ["Safety glass mandatory; structural silicone"],
    remarks: "6mm+12mm gap+6mm DGU; low-E optional",
    isCore: false,
    conditions: [{ field: "facadeType", operator: "==", value: "curtain_wall" }],
  },

  // === TOWER CRANE MODULE ===
  {
    code: "TC-01",
    phase: "heavy_structure",
    name: "Tower crane erection & commissioning",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Crane Specialist", count: 4 },
      { role: "Rigger", count: 2 },
      { role: "Helper", count: 4 }
    ],
    predecessors: [{ taskCode: "FN-04", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 3177", "IS 4573"],
    dsrRef: "",
    safetyChecks: ["Foundation adequacy; anti-collision if multiple; third-party inspection"],
    remarks: "Required for G+7 and above typically",
    isCore: false,
    conditions: [{ field: "floors", operator: ">=", value: 7 }],
    minFloors: 7,
  },
  {
    code: "TC-02",
    phase: "heavy_structure",
    name: "Tower crane dismantling",
    unit: "LS",
    productivityRate: { min: 2, max: 3, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Crane Specialist", count: 4 },
      { role: "Rigger", count: 2 }
    ],
    predecessors: [{ taskCode: "SS-08", type: "FS", lagDays: 0, note: "all floors complete" }],
    isCodeRef: ["IS 3177"],
    dsrRef: "",
    safetyChecks: ["Exclusion zone; road closure if needed"],
    remarks: "After all RCC structural work complete",
    isCore: false,
    conditions: [{ field: "floors", operator: ">=", value: 7 }],
    minFloors: 7,
  },

  // === DG SET MODULE ===
  {
    code: "DG-01",
    phase: "electrical",
    name: "Diesel generator set installation & acoustic enclosure",
    unit: "LS",
    productivityRate: { min: 3, max: 5, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Electrician", count: 2 },
      { role: "Mechanic", count: 1 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "EL-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4722", "CPCB norms"],
    dsrRef: "",
    safetyChecks: ["Acoustic enclosure mandatory; emission norms; fuel storage"],
    remarks: "Size per sanctioned load; AMF panel for auto-changeover",
    isCore: false,
    conditions: [{ field: "dgSet", operator: "==", value: true }],
  },

  // === SWIMMING POOL MODULE ===
  {
    code: "SW-01",
    phase: "special_systems",
    name: "Swimming pool excavation & RCC shell construction",
    unit: "LS",
    productivityRate: { min: 20, max: 30, unit: "days" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Mason", count: 3 },
      { role: "Steel Fitter", count: 3 },
      { role: "Labourer", count: 8 }
    ],
    predecessors: [{ taskCode: "SP-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3370"],
    dsrRef: "",
    safetyChecks: ["Structural design; water-tightness test"],
    remarks: "M35 concrete with integral waterproofing; gunite option",
    isCore: false,
    conditions: [{ field: "pool", operator: "==", value: true }],
    requiresPool: true,
  },
  {
    code: "SW-02",
    phase: "special_systems",
    name: "Pool tiling, filtration & plumbing",
    unit: "LS",
    productivityRate: { min: 15, max: 20, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Pool Specialist", count: 2 },
      { role: "Plumber", count: 1 },
      { role: "Tile Specialist", count: 2 },
      { role: "Helper", count: 3 }
    ],
    predecessors: [{ taskCode: "SW-01", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Anti-entrapment drain; depth markers; non-slip surround"],
    remarks: "Sand filter + chlorinator + circulation pump",
    isCore: false,
    conditions: [{ field: "pool", operator: "==", value: true }],
    requiresPool: true,
  },

  // === SOLAR SYSTEM MODULE ===
  {
    code: "SO-01",
    phase: "electrical",
    name: "Solar panel mounting structure & panels installation",
    unit: "kWp",
    productivityRate: { min: 3, max: 5, unit: "kWp/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Solar Technician", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "WP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 16169"],
    dsrRef: "",
    safetyChecks: ["Roof load check; lightning protection; earthing"],
    remarks: "GI mounting structure; orientation due South",
    isCore: false,
    conditions: [{ field: "solar", operator: "==", value: true }],
  },
  {
    code: "SO-02",
    phase: "electrical",
    name: "Solar inverter, net meter & DISCOM sync",
    unit: "LS",
    productivityRate: { min: 2, max: 3, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Solar Technician", count: 1 },
      { role: "Electrician", count: 1 }
    ],
    predecessors: [{ taskCode: "SO-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["CEA regulations"],
    dsrRef: "",
    safetyChecks: ["DISCOM net metering approval; generation meter"],
    remarks: "Grid-tied with net metering; battery backup optional",
    isCore: false,
    conditions: [{ field: "solar", operator: "==", value: true }],
  },

  // === FALSE CEILING MODULE ===
  {
    code: "FC-01",
    phase: "plastering",
    name: "False ceiling — GI frame + gypsum board",
    unit: "Sqm",
    productivityRate: { min: 8, max: 12, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "False Ceiling Specialist", count: 2 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [
      { taskCode: "PT-03", type: "FS", lagDays: 3 },
      { taskCode: "EL-04", type: "FS", lagDays: 0 }
    ],
    isCodeRef: ["IS 2095"],
    dsrRef: "",
    safetyChecks: ["Level check; expansion gaps at walls"],
    remarks: "12.5mm gypsum board; moisture-resistant in toilets",
    isCore: false,
    conditions: [{ field: "falseCeiling", operator: "==", value: true }],
    applicableBuildingTypes: ["commercial_office", "hospitality_hotel", "institutional_hospital", "commercial_retail"],
  },

  // === FIRE DETECTION & ALARM MODULE ===
  {
    code: "FD-01",
    phase: "electrical",
    name: "Fire detection & alarm system installation",
    unit: "LS",
    productivityRate: { min: 5, max: 10, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Fire System Technician", count: 2 },
      { role: "Electrician", count: 1 },
      { role: "Helper", count: 2 }
    ],
    predecessors: [{ taskCode: "EL-04", type: "FS", lagDays: 0, note: "all floors" }],
    isCodeRef: ["IS 2189", "NBC Part-IV"],
    dsrRef: "",
    safetyChecks: ["Zone-wise commissioning; panel integration; loop testing"],
    remarks: "Smoke + heat detectors; manual call points; hooters per floor",
    isCore: false,
    conditions: [{ field: "buildingHeight", operator: ">=", value: 15 }],
    minHeight: 15,
    requiresFireFighting: true,
  },

  // === RAINWATER HARVESTING MODULE ===
  {
    code: "RW-01",
    phase: "external_works",
    name: "Rainwater harvesting system — recharge pits & collection tank",
    unit: "LS",
    productivityRate: { min: 7, max: 10, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Mason", count: 2 },
      { role: "Plumber", count: 1 },
      { role: "Labourer", count: 4 }
    ],
    predecessors: [{ taskCode: "EX-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016"],
    dsrRef: "",
    safetyChecks: ["Filter mesh; first-flush divertor; overflow to drain"],
    remarks: "Mandatory in most states for plots >300 sqm",
    isCore: false,
    conditions: [{ field: "plotArea", operator: ">=", value: 300 }],
  },
];


// ---------------------------------------------------------------------------
// 3. REGIONAL PARAMETERS — All Indian States & UTs
// ---------------------------------------------------------------------------

export const REGIONAL_PARAMS: Record<RegionCode, RegionalParams> = {
  // === MAHARASHTRA ===
  MH: {
    code: "MH",
    name: "Maharashtra",
    commonSoilTypes: ["black_cotton", "laterite", "mixed"],
    defaultSoilType: "black_cotton",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.8, max: 2.5 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.0,     // baseline
    cycloneRisk: false,
    labourCostIndex: 1.0,          // baseline
    materialCostIndex: 1.0,
    productivityIndex: 1.0,
    dsrReference: "Maharashtra PWD DSR 2023-24",
    approvalAuthority: "Municipal Corporation / PMRDA / Collector",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Black cotton soil requires deeper foundation and anti-termite treatment",
      "MPCB (Maharashtra Pollution Control Board) consent required for STP",
      "UDCPR governs building control rules since 2020",
      "Konkan coast: laterite soil, cyclone-resistant design",
      "MSEDCL is the power DISCOM",
    ],
  },

  // === RAJASTHAN ===
  RJ: {
    code: "RJ",
    name: "Rajasthan",
    commonSoilTypes: ["sandy", "alluvial", "rocky"],
    defaultSoilType: "sandy",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.5 },
    monsoonMonths: [7, 8, 9],
    monsoonIntensity: "low",
    monsoonMifMultiplier: 0.85,
    extremeSummerMonths: [4, 5, 6],
    extremeSummerTempC: 48,
    cycloneRisk: false,
    labourCostIndex: 0.85,
    materialCostIndex: 0.90,
    productivityIndex: 0.90,      // extreme heat reduces productivity
    dsrReference: "Rajasthan PWD SOR 2022-23",
    approvalAuthority: "UIT / Development Authority / Nagar Nigam",
    approvalTimelineDays: { min: 30, max: 60 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Extreme summer (Apr-Jun) limits working hours to early morning / evening",
      "Sandy soil: no anti-termite typically needed but wind erosion protection required",
      "Water scarcity: curing compound preferred over ponding",
      "Short monsoon (Jul-Sep) — narrow window for earthwork",
      "Stone masonry common in western Rajasthan",
    ],
  },

  // === GUJARAT ===
  GJ: {
    code: "GJ",
    name: "Gujarat",
    commonSoilTypes: ["alluvial", "black_cotton", "sandy", "marine_clay"],
    defaultSoilType: "alluvial",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.05,
    cycloneRisk: true,
    labourCostIndex: 0.95,
    materialCostIndex: 0.95,
    productivityIndex: 1.0,
    dsrReference: "Gujarat PWD SOR 2023-24",
    approvalAuthority: "AUDA / SUDA / Nagar Palika / GDA",
    approvalTimelineDays: { min: 30, max: 75 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Kutch/Saurashtra: Seismic Zone V — mandatory enhanced seismic detailing",
      "Coastal Gujarat: cyclone-resistant design, wind speed 50m/s",
      "Reinforcement multiplier 1.15× in Zone IV/V areas",
      "Marine clay in coastal belt: pile foundation may be needed",
      "GPCB (Gujarat Pollution Control Board) STP norms",
    ],
  },

  // === DELHI NCR ===
  DL: {
    code: "DL",
    name: "Delhi NCR",
    commonSoilTypes: ["alluvial", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.95,
    winterFrostMonths: [12, 1],
    extremeSummerMonths: [5, 6],
    extremeSummerTempC: 47,
    cycloneRisk: false,
    labourCostIndex: 1.15,
    materialCostIndex: 1.10,
    productivityIndex: 0.95,
    dsrReference: "CPWD DSR 2023",
    approvalAuthority: "DDA / MCD / NOIDA / GHAZIABAD Dev Authority",
    approvalTimelineDays: { min: 45, max: 120 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV — enhanced seismic detailing mandatory per IS 13920",
      "Winter (Dec-Jan): frost risk, concrete curing protection needed",
      "Smog season (Nov-Dec): CAQM may restrict construction — anti-smog gun required",
      "NGT norms: construction waste management plan mandatory",
      "DPCC (Delhi Pollution Control Committee) STP norms stricter",
      "High labour cost; migrant labour seasonal availability varies",
    ],
  },

  // === TAMIL NADU ===
  TN: {
    code: "TN",
    name: "Tamil Nadu",
    commonSoilTypes: ["red_soil", "alluvial", "laterite", "sandy", "marine_clay"],
    defaultSoilType: "red_soil",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [10, 11, 12],   // OPPOSITE monsoon — NE monsoon
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.05,
    extremeSummerMonths: [4, 5, 6],
    extremeSummerTempC: 42,
    cycloneRisk: true,
    labourCostIndex: 0.95,
    materialCostIndex: 0.95,
    productivityIndex: 1.0,
    dsrReference: "Tamil Nadu PWD SOR 2023-24",
    approvalAuthority: "CMDA / DTCP / Local Planning Authority",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "CRITICAL: NE monsoon Oct-Dec — NOT June-Sept like rest of India",
      "Cyclone coast (Bay of Bengal): wind speed 50m/s design",
      "Chennai: marine clay in coastal areas, pile foundation may be needed",
      "Rainwater harvesting mandatory for ALL buildings per TN govt",
      "TNPCB (TN Pollution Control Board) STP norms",
    ],
  },

  // === KARNATAKA ===
  KA: {
    code: "KA",
    name: "Karnataka",
    commonSoilTypes: ["red_soil", "laterite", "hard_rock", "black_cotton"],
    defaultSoilType: "red_soil",
    seismicZone: "II",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.0,
    cycloneRisk: false,
    labourCostIndex: 1.05,
    materialCostIndex: 1.0,
    productivityIndex: 1.0,
    dsrReference: "Karnataka PWD SOR 2023-24",
    approvalAuthority: "BDA / BBMP / BMRDA / DC office",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Bengaluru: hard rock at shallow depth — blasting adds 2-3 weeks, hydraulic breaker only",
      "North Karnataka: black cotton soil region",
      "Coastal Karnataka (Mangaluru): laterite soil, heavy monsoon",
      "KSPCB (Karnataka PCB) STP norms",
      "BBMP requires rainwater harvesting for plots >2400 sqft",
    ],
  },

  // === WEST BENGAL ===
  WB: {
    code: "WB",
    name: "West Bengal",
    commonSoilTypes: ["alluvial", "soft_clay", "marine_clay"],
    defaultSoilType: "soft_clay",
    seismicZone: "III",
    defaultFoundationType: "pile",
    foundationDepthRange: { min: 15, max: 25 },  // pile depth in meters
    monsoonMonths: [5, 6, 7, 8, 9, 10],         // 5-6 months
    monsoonIntensity: "extreme",
    monsoonMifMultiplier: 1.25,
    cycloneRisk: true,
    labourCostIndex: 0.85,
    materialCostIndex: 0.90,
    productivityIndex: 0.85,      // worst soil + long monsoon
    dsrReference: "West Bengal PWD SOR 2023-24",
    approvalAuthority: "KMDA / KMC / HIDCO / Local Municipality",
    approvalTimelineDays: { min: 45, max: 120 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Pile foundation mandatory — alluvial/soft clay soil has very low bearing capacity",
      "5-6 month monsoon (May-Oct) — worst construction window in India",
      "Cyclone risk from Bay of Bengal — design for 55m/s wind speed",
      "High water table — dewatering essential during foundation",
      "Kolkata: pile depth typically 18-25m to reach hard stratum",
    ],
    additionalTaskCodes: ["PF-01", "PF-02", "PF-03", "BM-03"],
  },

  // === KERALA ===
  KL: {
    code: "KL",
    name: "Kerala",
    commonSoilTypes: ["laterite", "alluvial", "marine_clay", "rocky"],
    defaultSoilType: "laterite",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 2.0 },
    monsoonMonths: [5, 6, 7, 8, 9, 10],         // SW + NE monsoon overlap
    monsoonIntensity: "extreme",
    monsoonMifMultiplier: 1.30,
    cycloneRisk: false,
    labourCostIndex: 1.30,        // highest in India
    materialCostIndex: 1.10,
    productivityIndex: 0.90,
    dsrReference: "Kerala PWD SOR 2023-24",
    approvalAuthority: "Local Self Government / KPDA / Corporation",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Highest labour cost in India — factor 1.3× for all crew costs",
      "6-month monsoon (May-Oct combined SW + NE) — very narrow dry window",
      "Laterite stone masonry traditional — often used for foundations",
      "Kerala Building Rules (KBR) have specific requirements",
      "Flood-prone: plinth level +600mm above HFL in low-lying areas",
      "Strong building trade unions — factor into scheduling",
    ],
  },

  // === ANDHRA PRADESH ===
  AP: {
    code: "AP",
    name: "Andhra Pradesh",
    commonSoilTypes: ["black_cotton", "red_soil", "alluvial", "sandy"],
    defaultSoilType: "black_cotton",
    seismicZone: "II",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [6, 7, 8, 9, 10],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.0,
    cycloneRisk: true,
    labourCostIndex: 0.85,
    materialCostIndex: 0.90,
    productivityIndex: 1.0,
    dsrReference: "AP PWD SOR 2023-24",
    approvalAuthority: "APCRDA / VGTM UDA / Municipal Corporation",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Cyclone coast — Visakhapatnam, Vijayawada high cyclone risk",
      "Black cotton soil prevalent in Rayalaseema",
      "Amaravati region: alluvial soil, new capital development norms",
      "APPCB STP norms",
    ],
  },

  // === TELANGANA ===
  TS: {
    code: "TS",
    name: "Telangana",
    commonSoilTypes: ["red_soil", "black_cotton", "hard_rock"],
    defaultSoilType: "red_soil",
    seismicZone: "II",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.95,
    cycloneRisk: false,
    labourCostIndex: 0.95,
    materialCostIndex: 0.95,
    productivityIndex: 1.05,
    dsrReference: "Telangana PWD SOR 2023-24",
    approvalAuthority: "HMDA / GHMC / DTCP",
    approvalTimelineDays: { min: 30, max: 75 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Hyderabad: granite rock at shallow depth in some areas",
      "TS-bPASS online approval system — faster processing",
      "TSPCB STP norms",
      "Flooding risk in low-lying Hyderabad areas — check HFL",
    ],
  },

  // === UTTAR PRADESH ===
  UP: {
    code: "UP",
    name: "Uttar Pradesh",
    commonSoilTypes: ["alluvial", "sandy", "soft_clay"],
    defaultSoilType: "alluvial",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.95,
    winterFrostMonths: [12, 1],
    extremeSummerMonths: [5, 6],
    extremeSummerTempC: 47,
    cycloneRisk: false,
    labourCostIndex: 0.80,
    materialCostIndex: 0.85,
    productivityIndex: 0.95,
    dsrReference: "UP PWD SOR 2023-24",
    approvalAuthority: "NOIDA / GDA / LDA / Nagar Nigam",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Parts of UP in Seismic Zone IV & V — enhanced seismic detailing",
      "Gangetic plain: alluvial soil, good bearing capacity for low-rise",
      "Winter frost (Dec-Jan): concrete curing protection needed",
      "Extreme summer: restrict daytime concreting",
      "UPPCB STP norms; UP-RERA active",
    ],
  },

  // === MADHYA PRADESH ===
  MP: {
    code: "MP",
    name: "Madhya Pradesh",
    commonSoilTypes: ["black_cotton", "alluvial", "laterite"],
    defaultSoilType: "black_cotton",
    seismicZone: "II",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.8, max: 2.5 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.95,
    extremeSummerMonths: [4, 5, 6],
    extremeSummerTempC: 46,
    cycloneRisk: false,
    labourCostIndex: 0.80,
    materialCostIndex: 0.85,
    productivityIndex: 0.95,
    dsrReference: "MP PWD SOR 2023-24",
    approvalAuthority: "Town & Country Planning / Nagar Nigam",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Malwa plateau: extensive black cotton soil — deep foundations required",
      "Extreme summer: restrict outdoor work Apr-Jun",
      "MPPCB STP norms",
    ],
  },

  // === CHHATTISGARH ===
  CG: {
    code: "CG",
    name: "Chhattisgarh",
    commonSoilTypes: ["red_soil", "laterite", "alluvial"],
    defaultSoilType: "red_soil",
    seismicZone: "II",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.0,
    cycloneRisk: false,
    labourCostIndex: 0.75,
    materialCostIndex: 0.85,
    productivityIndex: 0.90,
    dsrReference: "CG PWD SOR 2023-24",
    approvalAuthority: "Town & Country Planning / Nagar Nigam",
    approvalTimelineDays: { min: 30, max: 75 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Good laterite and red soil — moderate foundation depth",
      "Abundant stone aggregate availability",
      "CGPCB STP norms",
    ],
  },

  // === JHARKHAND ===
  JH: {
    code: "JH",
    name: "Jharkhand",
    commonSoilTypes: ["laterite", "red_soil", "rocky", "alluvial"],
    defaultSoilType: "laterite",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.0,
    cycloneRisk: false,
    labourCostIndex: 0.80,
    materialCostIndex: 0.85,
    productivityIndex: 0.90,
    dsrReference: "Jharkhand PWD SOR 2023-24",
    approvalAuthority: "RRDA / Nagar Nigam / Municipal Corporation",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Rocky terrain in Chota Nagpur plateau — excavation challenges",
      "Good stone aggregate availability",
      "Seismic Zone III — standard seismic detailing",
    ],
  },

  // === BIHAR ===
  BR: {
    code: "BR",
    name: "Bihar",
    commonSoilTypes: ["alluvial", "soft_clay", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.5 },
    monsoonMonths: [6, 7, 8, 9, 10],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.10,
    cycloneRisk: false,
    labourCostIndex: 0.70,
    materialCostIndex: 0.85,
    productivityIndex: 0.85,
    dsrReference: "Bihar PWD SOR 2023-24",
    approvalAuthority: "Nagar Nigam / BSBA / Municipal Corporation",
    approvalTimelineDays: { min: 45, max: 120 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV & V (north Bihar) — enhanced seismic detailing",
      "Flood-prone Gangetic plain — plinth level above HFL critical",
      "Soft alluvial soil near rivers — bearing capacity verification",
      "North Bihar: pile foundation may be needed near rivers",
    ],
  },

  // === ODISHA ===
  OD: {
    code: "OD",
    name: "Odisha",
    commonSoilTypes: ["laterite", "alluvial", "marine_clay", "red_soil"],
    defaultSoilType: "laterite",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 2.0 },
    monsoonMonths: [6, 7, 8, 9, 10],
    monsoonIntensity: "extreme",
    monsoonMifMultiplier: 1.20,
    cycloneRisk: true,
    labourCostIndex: 0.80,
    materialCostIndex: 0.85,
    productivityIndex: 0.90,
    dsrReference: "Odisha PWD SOR 2023-24",
    approvalAuthority: "BDA / Municipal Corporation / NAC",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Very high cyclone risk (Fani, Amphan category) — design for 55m/s wind speed",
      "Coastal erosion zones — setback requirements",
      "Long monsoon (Jun-Oct) — limited dry construction window",
      "Laterite soil generally good for foundations",
    ],
  },

  // === PUNJAB ===
  PB: {
    code: "PB",
    name: "Punjab",
    commonSoilTypes: ["alluvial", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.90,
    winterFrostMonths: [12, 1, 2],
    cycloneRisk: false,
    labourCostIndex: 0.90,
    materialCostIndex: 0.90,
    productivityIndex: 1.0,
    dsrReference: "Punjab PWD SOR 2023-24",
    approvalAuthority: "GMADA / PUDA / MC / Improvement Trust",
    approvalTimelineDays: { min: 30, max: 75 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV — enhanced seismic detailing",
      "Winter frost (Dec-Feb): concrete curing protection, hot water in mix",
      "Good alluvial soil — standard foundations adequate",
      "Brick masonry traditionally strong in Punjab",
    ],
  },

  // === HARYANA ===
  HR: {
    code: "HR",
    name: "Haryana",
    commonSoilTypes: ["alluvial", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [7, 8, 9],
    monsoonIntensity: "moderate",
    monsoonMifMultiplier: 0.90,
    winterFrostMonths: [12, 1],
    extremeSummerMonths: [5, 6],
    extremeSummerTempC: 47,
    cycloneRisk: false,
    labourCostIndex: 1.0,
    materialCostIndex: 0.95,
    productivityIndex: 0.95,
    dsrReference: "Haryana PWD SOR 2023-24",
    approvalAuthority: "HUDA / DTCP / MC / Gurugram Metropolitan Dev Authority",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV — enhanced seismic detailing",
      "Gurugram: high-rise development norms; strict fire compliance",
      "Winter frost + summer extreme — narrow optimal construction window",
      "Smog restrictions (Nov-Dec) in NCR portion",
    ],
  },

  // === UTTARAKHAND ===
  UK: {
    code: "UK",
    name: "Uttarakhand",
    commonSoilTypes: ["rocky", "alluvial", "mixed"],
    defaultSoilType: "rocky",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.5 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.10,
    winterFrostMonths: [11, 12, 1, 2, 3],
    cycloneRisk: false,
    labourCostIndex: 0.95,
    materialCostIndex: 1.05,    // transport cost to hills
    productivityIndex: 0.85,    // terrain difficulty
    dsrReference: "Uttarakhand PWD SOR 2023-24",
    approvalAuthority: "MDDA / Nagar Nigam / Panchayat",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV & V — strictest seismic detailing in India",
      "Hill construction: retaining walls, stepped foundations, landslide risk",
      "Extended winter (Nov-Mar): concrete anti-freeze measures needed",
      "Material transport costs higher in hill regions",
      "Dehradun plains: standard construction; hills: specialty required",
    ],
  },

  // === HIMACHAL PRADESH ===
  HP: {
    code: "HP",
    name: "Himachal Pradesh",
    commonSoilTypes: ["rocky", "mixed", "alluvial"],
    defaultSoilType: "rocky",
    seismicZone: "IV",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 3.0 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "high",
    monsoonMifMultiplier: 1.15,
    winterFrostMonths: [11, 12, 1, 2, 3],
    cycloneRisk: false,
    labourCostIndex: 1.0,
    materialCostIndex: 1.15,
    productivityIndex: 0.80,
    dsrReference: "HP PWD SOR 2023-24",
    approvalAuthority: "Town & Country Planning / MC / Panchayat",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone IV & V — critical seismic detailing",
      "Hill terrain: stone masonry traditional, RCC frame preferred for multi-storey",
      "Extended winter: no concreting when temp <5°C without hot water/additives",
      "Landslide-prone zones: geotechnical survey essential",
      "Transport costs significantly higher in interior hills",
    ],
  },

  // === GOA ===
  GA: {
    code: "GA",
    name: "Goa",
    commonSoilTypes: ["laterite", "sandy", "marine_clay"],
    defaultSoilType: "laterite",
    seismicZone: "III",
    defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9],
    monsoonIntensity: "extreme",
    monsoonMifMultiplier: 1.20,
    cycloneRisk: false,
    labourCostIndex: 1.10,
    materialCostIndex: 1.10,
    productivityIndex: 0.95,
    dsrReference: "Goa PWD SOR 2023-24",
    approvalAuthority: "TCP / Panchayat / CCP / CMC",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Laterite stone masonry common and preferred locally",
      "Very heavy monsoon (Jun-Sep) — virtually no external work possible",
      "CRZ (Coastal Regulation Zone) norms apply near coast",
      "Height restrictions in many areas per TCP regulations",
      "Saline atmosphere near coast — corrosion-resistant materials needed",
    ],
  },

  // === ASSAM ===
  AS: {
    code: "AS",
    name: "Assam",
    commonSoilTypes: ["alluvial", "soft_clay", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "V",
    defaultFoundationType: "raft",
    foundationDepthRange: { min: 2.0, max: 3.0 },
    monsoonMonths: [5, 6, 7, 8, 9, 10],
    monsoonIntensity: "extreme",
    monsoonMifMultiplier: 1.30,
    cycloneRisk: false,
    labourCostIndex: 0.85,
    materialCostIndex: 1.10,
    productivityIndex: 0.80,
    dsrReference: "Assam PWD SOR 2023-24",
    approvalAuthority: "GMDA / AMC / Town Committee",
    approvalTimelineDays: { min: 30, max: 90 },
    fireNocRequiredAboveM: 15,
    stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "SEISMIC ZONE V — highest seismic risk in India — strictest IS 13920 compliance",
      "Raft or pile foundation essential — soft alluvial soil",
      "6-month monsoon + annual flooding — very limited dry window (Nov-Apr)",
      "Material transport cost higher due to geography",
      "Bamboo and timber traditionally used — RCC for multi-storey",
    ],
    additionalTaskCodes: ["RF-01", "RF-02"],
  },

  // === NORTHEAST STATES (grouped with common parameters) ===
  MN: {
    code: "MN", name: "Manipur",
    commonSoilTypes: ["alluvial", "soft_clay", "rocky"],
    defaultSoilType: "alluvial",
    seismicZone: "V", defaultFoundationType: "raft",
    foundationDepthRange: { min: 2.0, max: 3.0 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.25,
    cycloneRisk: false, labourCostIndex: 0.90, materialCostIndex: 1.20, productivityIndex: 0.75,
    dsrReference: "Manipur PWD SOR", approvalAuthority: "Town Planning Authority / DC Office",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone V; hilly terrain; limited material supply chain; very high transport cost"],
  },
  ML: {
    code: "ML", name: "Meghalaya",
    commonSoilTypes: ["laterite", "rocky", "alluvial"],
    defaultSoilType: "laterite",
    seismicZone: "V", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.5 },
    monsoonMonths: [4, 5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.35,
    cycloneRisk: false, labourCostIndex: 0.90, materialCostIndex: 1.20, productivityIndex: 0.75,
    dsrReference: "Meghalaya PWD SOR", approvalAuthority: "Town Planning / DC Office",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Cherrapunji/Mawsynram: heaviest rainfall on Earth; 7-month monsoon; Zone V seismic"],
  },
  MZ: {
    code: "MZ", name: "Mizoram",
    commonSoilTypes: ["laterite", "rocky", "mixed"],
    defaultSoilType: "laterite",
    seismicZone: "V", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.5 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.25,
    cycloneRisk: false, labourCostIndex: 0.90, materialCostIndex: 1.25, productivityIndex: 0.75,
    dsrReference: "Mizoram PWD SOR", approvalAuthority: "Town Planning / DC Office",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone V; hilly terrain; limited infrastructure; high material transport cost"],
  },
  NL: {
    code: "NL", name: "Nagaland",
    commonSoilTypes: ["laterite", "rocky", "mixed"],
    defaultSoilType: "laterite",
    seismicZone: "V", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.5 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.25,
    cycloneRisk: false, labourCostIndex: 0.90, materialCostIndex: 1.25, productivityIndex: 0.75,
    dsrReference: "Nagaland PWD SOR", approvalAuthority: "Town Planning / DC Office",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone V; mountainous terrain; limited material supply"],
  },
  TR: {
    code: "TR", name: "Tripura",
    commonSoilTypes: ["alluvial", "laterite", "soft_clay"],
    defaultSoilType: "alluvial",
    seismicZone: "V", defaultFoundationType: "raft",
    foundationDepthRange: { min: 2.0, max: 3.0 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.25,
    cycloneRisk: false, labourCostIndex: 0.80, materialCostIndex: 1.15, productivityIndex: 0.80,
    dsrReference: "Tripura PWD SOR", approvalAuthority: "Town Planning / AMC",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone V; soft soil near rivers; bamboo construction traditional"],
  },
  AR: {
    code: "AR", name: "Arunachal Pradesh",
    commonSoilTypes: ["rocky", "alluvial", "mixed"],
    defaultSoilType: "rocky",
    seismicZone: "V", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 2.0, max: 3.5 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.30,
    cycloneRisk: false, labourCostIndex: 1.0, materialCostIndex: 1.35, productivityIndex: 0.70,
    dsrReference: "Arunachal Pradesh PWD SOR", approvalAuthority: "DC Office / Town Planning",
    approvalTimelineDays: { min: 45, max: 150 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone V; most difficult terrain in India; extreme material transport costs; very short dry window"],
  },
  SK: {
    code: "SK", name: "Sikkim",
    commonSoilTypes: ["rocky", "mixed", "alluvial"],
    defaultSoilType: "rocky",
    seismicZone: "IV", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 3.0 },
    monsoonMonths: [5, 6, 7, 8, 9], monsoonIntensity: "high", monsoonMifMultiplier: 1.15,
    winterFrostMonths: [11, 12, 1, 2, 3],
    cycloneRisk: false, labourCostIndex: 1.0, materialCostIndex: 1.25, productivityIndex: 0.75,
    dsrReference: "Sikkim PWD SOR", approvalAuthority: "Urban Dev Dept / Panchayat",
    approvalTimelineDays: { min: 30, max: 90 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Seismic Zone IV; steep terrain; stone masonry common; winter frost protection needed"],
  },

  // === JAMMU & KASHMIR ===
  JK: {
    code: "JK", name: "Jammu & Kashmir",
    commonSoilTypes: ["alluvial", "rocky", "soft_clay"],
    defaultSoilType: "alluvial",
    seismicZone: "V", defaultFoundationType: "raft",
    foundationDepthRange: { min: 2.0, max: 3.0 },
    monsoonMonths: [7, 8, 9], monsoonIntensity: "moderate", monsoonMifMultiplier: 0.95,
    winterFrostMonths: [11, 12, 1, 2, 3, 4],
    cycloneRisk: false, labourCostIndex: 1.05, materialCostIndex: 1.20, productivityIndex: 0.80,
    dsrReference: "J&K PWD SOR", approvalAuthority: "SDA / MC / Development Authority",
    approvalTimelineDays: { min: 45, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Seismic Zone V (Kashmir Valley) — strictest seismic compliance",
      "Extended winter (Nov-Apr): no concreting below 5°C without additives",
      "Kashmir: soft lacustrine soil near Dal Lake — pile foundation needed",
      "Jammu: standard construction; Kashmir: specialty winterization",
    ],
  },

  // === LADAKH ===
  LA: {
    code: "LA", name: "Ladakh",
    commonSoilTypes: ["rocky", "sandy", "mixed"],
    defaultSoilType: "rocky",
    seismicZone: "V", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 2.0, max: 3.5 },
    monsoonMonths: [7, 8], monsoonIntensity: "low", monsoonMifMultiplier: 0.80,
    winterFrostMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    cycloneRisk: false, labourCostIndex: 1.20, materialCostIndex: 1.50, productivityIndex: 0.60,
    dsrReference: "CPWD DSR (adapted)", approvalAuthority: "LAHDC / UT Administration",
    approvalTimelineDays: { min: 30, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: [
      "Only 3-4 month construction window (Jun-Sep)",
      "Winter -30°C: no construction possible Nov-Apr",
      "All materials transported from plains — extreme cost",
      "Traditional mud-brick construction; RCC difficult at altitude",
      "Solar passive design essential for thermal comfort",
    ],
  },

  // === UNION TERRITORIES ===
  AN: {
    code: "AN", name: "Andaman & Nicobar Islands",
    commonSoilTypes: ["marine_clay", "laterite", "sandy"],
    defaultSoilType: "marine_clay",
    seismicZone: "V", defaultFoundationType: "pile",
    foundationDepthRange: { min: 12, max: 20 },
    monsoonMonths: [5, 6, 7, 8, 9, 10, 11], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.35,
    cycloneRisk: true, labourCostIndex: 1.20, materialCostIndex: 1.40, productivityIndex: 0.70,
    dsrReference: "CPWD DSR (adapted)", approvalAuthority: "APWD / Port Blair MC",
    approvalTimelineDays: { min: 45, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Zone V + cyclone + 7-month monsoon; all materials shipped; CRZ norms; pile foundation usual"],
    additionalTaskCodes: ["PF-01", "PF-02", "PF-03"],
  },
  CH: {
    code: "CH", name: "Chandigarh",
    commonSoilTypes: ["alluvial", "sandy"],
    defaultSoilType: "alluvial",
    seismicZone: "IV", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.5, max: 2.0 },
    monsoonMonths: [7, 8, 9], monsoonIntensity: "moderate", monsoonMifMultiplier: 0.90,
    winterFrostMonths: [12, 1],
    cycloneRisk: false, labourCostIndex: 1.0, materialCostIndex: 0.95, productivityIndex: 1.0,
    dsrReference: "Chandigarh UT SOR", approvalAuthority: "Chandigarh Administration / MC",
    approvalTimelineDays: { min: 30, max: 75 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Zone IV; strict building bylaws (Le Corbusier heritage); height restrictions in many sectors"],
  },
  DN: {
    code: "DN", name: "Dadra & Nagar Haveli and Daman & Diu",
    commonSoilTypes: ["laterite", "alluvial", "sandy"],
    defaultSoilType: "laterite",
    seismicZone: "III", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9], monsoonIntensity: "high", monsoonMifMultiplier: 1.0,
    cycloneRisk: true, labourCostIndex: 0.90, materialCostIndex: 0.95, productivityIndex: 1.0,
    dsrReference: "UT PWD SOR / Gujarat SOR adapted", approvalAuthority: "UT Administration",
    approvalTimelineDays: { min: 30, max: 75 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Coastal influence; cyclone risk in Diu; industrial zone construction common"],
  },
  DD: {
    code: "DD", name: "Daman & Diu (merged with DN)",
    commonSoilTypes: ["sandy", "marine_clay"],
    defaultSoilType: "sandy",
    seismicZone: "III", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [6, 7, 8, 9], monsoonIntensity: "high", monsoonMifMultiplier: 1.0,
    cycloneRisk: true, labourCostIndex: 0.90, materialCostIndex: 0.95, productivityIndex: 1.0,
    dsrReference: "UT PWD SOR", approvalAuthority: "UT Administration",
    approvalTimelineDays: { min: 30, max: 75 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["Now merged with Dadra & Nagar Haveli; coastal norms apply"],
  },
  LD: {
    code: "LD", name: "Lakshadweep",
    commonSoilTypes: ["sandy", "marine_clay"],
    defaultSoilType: "sandy",
    seismicZone: "III", defaultFoundationType: "pile",
    foundationDepthRange: { min: 8, max: 15 },
    monsoonMonths: [5, 6, 7, 8, 9, 10], monsoonIntensity: "extreme", monsoonMifMultiplier: 1.30,
    cycloneRisk: true, labourCostIndex: 1.25, materialCostIndex: 1.50, productivityIndex: 0.65,
    dsrReference: "CPWD DSR (adapted)", approvalAuthority: "UT Administration",
    approvalTimelineDays: { min: 45, max: 120 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 10,
    reraApplicable: true,
    specialNotes: ["Island territory; all materials shipped; CRZ norms strict; coral soil; limited construction activity"],
    additionalTaskCodes: ["PF-01", "PF-02"],
  },
  PY: {
    code: "PY", name: "Puducherry",
    commonSoilTypes: ["alluvial", "sandy", "marine_clay"],
    defaultSoilType: "alluvial",
    seismicZone: "III", defaultFoundationType: "isolated_footing",
    foundationDepthRange: { min: 1.2, max: 1.8 },
    monsoonMonths: [10, 11, 12],  // NE monsoon like Tamil Nadu
    monsoonIntensity: "high", monsoonMifMultiplier: 1.05,
    cycloneRisk: true, labourCostIndex: 0.90, materialCostIndex: 0.95, productivityIndex: 1.0,
    dsrReference: "Puducherry PWD SOR / TN SOR adapted", approvalAuthority: "Local Planning Authority",
    approvalTimelineDays: { min: 30, max: 75 }, fireNocRequiredAboveM: 15, stpMandatoryAboveUnits: 20,
    reraApplicable: true,
    specialNotes: ["NE monsoon Oct-Dec (same as Tamil Nadu); cyclone risk; French Quarter heritage zone restrictions"],
  },
};


// ---------------------------------------------------------------------------
// 4. BUILDING TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const BUILDING_TYPES: Record<BuildingType, BuildingTypeConfig> = {
  residential_g2: {
    type: "residential_g2",
    label: "Residential G+2 (Row House / Small Apartment)",
    description: "Low-rise residential up to 3 floors, no lift, basic MEP",
    typicalFloorRange: { min: 1, max: 3 },
    typicalHeightRange: { min: 3, max: 10 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["PB-07", "EL-08", "EX-10", "EX-11", "HO-04", "TC-01", "TC-02", "CW-01", "CW-02", "HV-01", "HV-02", "HV-03", "DG-01", "FD-01"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.85,
    mepComplexityFactor: 0.70,
    finishQualityFactor: 1.0,
  },
  residential_g4: {
    type: "residential_g4",
    label: "Residential G+4 (Mid-Rise Apartment)",
    description: "Standard mid-rise residential, may include lift, standard fire safety",
    typicalFloorRange: { min: 4, max: 5 },
    typicalHeightRange: { min: 12, max: 16 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["TC-01", "TC-02", "CW-01", "CW-02", "HV-01", "HV-02", "HV-03"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 1.0,
    mepComplexityFactor: 1.0,
    finishQualityFactor: 1.0,
  },
  residential_g7: {
    type: "residential_g7",
    label: "Residential G+7 (Mid-High Rise)",
    description: "Mid-high rise with mandatory lift, fire fighting, may need tower crane",
    typicalFloorRange: { min: 6, max: 8 },
    typicalHeightRange: { min: 18, max: 25 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "heavy_structure"],
    mandatoryTaskCodes: ["PB-07", "EL-08", "EX-10", "HO-04", "FD-01"],
    excludedTaskCodes: ["CW-01", "CW-02", "HV-01", "HV-02", "HV-03"],
    additionalTaskCodes: ["TC-01", "TC-02", "DG-01"],
    structuralComplexityFactor: 1.15,
    mepComplexityFactor: 1.20,
    finishQualityFactor: 1.0,
    requiresCraneAboveFloors: 7,
    requiresFireFighting: true,
    requiresElevator: true,
  },
  residential_g10: {
    type: "residential_g10",
    label: "Residential G+10 (High Rise)",
    description: "High-rise with structural complexity, tower crane, basement parking likely",
    typicalFloorRange: { min: 9, max: 11 },
    typicalHeightRange: { min: 27, max: 35 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "heavy_structure"],
    mandatoryTaskCodes: ["PB-07", "EL-08", "EX-10", "HO-04", "FD-01", "TC-01", "TC-02", "DG-01"],
    excludedTaskCodes: [],
    additionalTaskCodes: ["BM-01", "BM-02", "BM-03", "RW-01"],
    structuralComplexityFactor: 1.25,
    mepComplexityFactor: 1.35,
    finishQualityFactor: 1.0,
    requiresCraneAboveFloors: 7,
    requiresPileFoundation: false,
    requiresFireFighting: true,
    requiresDG: true,
    requiresElevator: true,
  },
  residential_highrise: {
    type: "residential_highrise",
    label: "Residential High-Rise (G+15 and above)",
    description: "Tall residential tower — pile/raft foundation, multiple lifts, full fire system",
    typicalFloorRange: { min: 15, max: 40 },
    typicalHeightRange: { min: 45, max: 130 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "heavy_structure", "facade"],
    mandatoryTaskCodes: ["PB-07", "EL-08", "EX-10", "HO-04", "FD-01", "TC-01", "TC-02", "DG-01", "PF-01", "PF-02", "PF-03", "BM-01", "BM-02", "BM-03", "RW-01"],
    excludedTaskCodes: [],
    additionalTaskCodes: ["CW-01", "CW-02"],
    structuralComplexityFactor: 1.50,
    mepComplexityFactor: 1.60,
    finishQualityFactor: 1.15,
    requiresCraneAboveFloors: 7,
    requiresPileFoundation: true,
    requiresFireFighting: true,
    requiresDG: true,
    requiresElevator: true,
  },
  commercial_office: {
    type: "commercial_office",
    label: "Commercial Office Building",
    description: "Office space — HVAC, false ceiling, larger floor plates, structured cabling",
    typicalFloorRange: { min: 3, max: 20 },
    typicalHeightRange: { min: 12, max: 70 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "hvac", "facade", "heavy_structure"],
    mandatoryTaskCodes: ["HV-01", "HV-02", "FC-01", "DG-01", "FD-01", "EX-10", "RW-01"],
    excludedTaskCodes: ["HO-08", "HO-09", "HO-10"],
    additionalTaskCodes: ["HV-03", "CW-01", "CW-02", "BM-01", "BM-02", "BM-03", "TC-01", "TC-02", "PF-01", "PF-02", "PF-03"],
    structuralComplexityFactor: 1.20,
    mepComplexityFactor: 1.50,
    finishQualityFactor: 1.20,
    requiresHVAC: true,
    requiresFireFighting: true,
    requiresDG: true,
    requiresElevator: true,
  },
  commercial_retail: {
    type: "commercial_retail",
    label: "Commercial Retail / Showroom",
    description: "Retail spaces — larger spans, high ceiling, display lighting, HVAC",
    typicalFloorRange: { min: 1, max: 5 },
    typicalHeightRange: { min: 5, max: 18 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "hvac"],
    mandatoryTaskCodes: ["HV-01", "HV-02", "FD-01"],
    excludedTaskCodes: ["HO-08", "HO-09", "HO-10", "TC-01", "TC-02"],
    additionalTaskCodes: ["DG-01", "FC-01"],
    structuralComplexityFactor: 1.10,
    mepComplexityFactor: 1.30,
    finishQualityFactor: 1.25,
    requiresHVAC: true,
    requiresFireFighting: true,
  },
  commercial_mall: {
    type: "commercial_mall",
    label: "Shopping Mall / Complex",
    description: "Large retail complex — very large spans, atriums, escalators, full HVAC, extensive fire system",
    typicalFloorRange: { min: 3, max: 8 },
    typicalHeightRange: { min: 15, max: 35 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "hvac", "heavy_structure"],
    mandatoryTaskCodes: ["HV-01", "HV-02", "HV-03", "DG-01", "FD-01", "EX-10", "BM-01", "BM-02", "BM-03", "RW-01", "TC-01", "TC-02"],
    excludedTaskCodes: ["HO-08", "HO-09", "HO-10"],
    additionalTaskCodes: ["PF-01", "PF-02", "PF-03", "CW-01", "CW-02"],
    structuralComplexityFactor: 1.40,
    mepComplexityFactor: 1.70,
    finishQualityFactor: 1.30,
    requiresCraneAboveFloors: 3,
    requiresHVAC: true,
    requiresFireFighting: true,
    requiresSTP: true,
    requiresDG: true,
    requiresElevator: true,
  },
  industrial_warehouse: {
    type: "industrial_warehouse",
    label: "Industrial Warehouse / Godown",
    description: "Single-storey PEB/steel structure — large spans, minimal internal walls",
    typicalFloorRange: { min: 1, max: 1 },
    typicalHeightRange: { min: 6, max: 12 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "plumbing", "electrical", "flooring", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["MW-01", "MW-02", "MW-03", "MW-04", "MW-05", "MW-06", "PT-01", "PT-02", "PT-03", "PT-04", "FL-02", "FL-03", "FL-04", "FL-05", "FL-06", "FL-07", "FL-08", "DW-01", "DW-02", "DW-03", "DW-04", "DW-05", "DW-06", "DW-07", "PA-01", "PA-02", "PA-06", "WP-02", "SS-10", "SS-12", "EX-10", "EX-11", "HO-08", "HO-09", "HO-10", "TC-01", "TC-02"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.60,
    mepComplexityFactor: 0.40,
    finishQualityFactor: 0.60,
  },
  industrial_factory: {
    type: "industrial_factory",
    label: "Industrial Factory / Manufacturing Unit",
    description: "Factory building — heavy equipment foundations, crane gantry, process piping",
    typicalFloorRange: { min: 1, max: 3 },
    typicalHeightRange: { min: 8, max: 18 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "plumbing", "electrical", "flooring", "external_works", "approvals_handover", "special_systems"],
    mandatoryTaskCodes: ["DG-01"],
    excludedTaskCodes: ["MW-02", "MW-05", "PT-01", "FL-02", "FL-03", "FL-04", "FL-06", "FL-07", "FL-08", "DW-01", "DW-02", "DW-03", "DW-04", "DW-05", "PA-01", "PA-02", "PA-06", "SS-10", "SS-12", "EX-10", "EX-11", "HO-08", "HO-09", "HO-10"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.80,
    mepComplexityFactor: 0.70,
    finishQualityFactor: 0.50,
    requiresDG: true,
  },
  institutional_school: {
    type: "institutional_school",
    label: "School / Educational Institution",
    description: "Classrooms, labs, assembly hall, playground — fire safety, accessibility compliance",
    typicalFloorRange: { min: 2, max: 5 },
    typicalHeightRange: { min: 7, max: 18 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: ["FD-01", "RW-01"],
    excludedTaskCodes: ["HO-08", "HO-09", "HO-10", "TC-01", "TC-02"],
    additionalTaskCodes: ["DG-01"],
    structuralComplexityFactor: 1.0,
    mepComplexityFactor: 0.90,
    finishQualityFactor: 0.90,
    requiresFireFighting: true,
  },
  institutional_hospital: {
    type: "institutional_hospital",
    label: "Hospital / Healthcare Facility",
    description: "Complex MEP — medical gas, UPS, HVAC zoning, OT, ICU, fire safety critical",
    typicalFloorRange: { min: 3, max: 12 },
    typicalHeightRange: { min: 12, max: 40 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "hvac", "heavy_structure"],
    mandatoryTaskCodes: ["HV-01", "HV-02", "HV-03", "DG-01", "FD-01", "EX-10", "RW-01"],
    excludedTaskCodes: ["HO-08", "HO-09", "HO-10"],
    additionalTaskCodes: ["BM-01", "BM-02", "TC-01", "TC-02", "FC-01", "PF-01", "PF-02"],
    structuralComplexityFactor: 1.30,
    mepComplexityFactor: 2.0,        // most complex MEP in construction
    finishQualityFactor: 1.30,
    requiresHVAC: true,
    requiresFireFighting: true,
    requiresSTP: true,
    requiresDG: true,
    requiresElevator: true,
  },
  hospitality_hotel: {
    type: "hospitality_hotel",
    label: "Hotel / Resort",
    description: "Rooms, banquets, kitchen, pool — premium finishes, HVAC, fire safety",
    typicalFloorRange: { min: 3, max: 15 },
    typicalHeightRange: { min: 12, max: 50 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "hvac", "facade"],
    mandatoryTaskCodes: ["HV-01", "HV-02", "HV-03", "DG-01", "FD-01", "EX-10", "SW-01", "SW-02", "RW-01"],
    excludedTaskCodes: ["HO-10"],
    additionalTaskCodes: ["BM-01", "BM-02", "TC-01", "TC-02", "FC-01", "CW-01", "CW-02"],
    structuralComplexityFactor: 1.20,
    mepComplexityFactor: 1.60,
    finishQualityFactor: 1.50,       // premium finishes
    requiresHVAC: true,
    requiresFireFighting: true,
    requiresSTP: true,
    requiresDG: true,
    requiresElevator: true,
  },
  mixed_use: {
    type: "mixed_use",
    label: "Mixed Use (Commercial + Residential)",
    description: "Podium commercial + residential tower — complex MEP zoning, dual compliance",
    typicalFloorRange: { min: 5, max: 25 },
    typicalHeightRange: { min: 18, max: 80 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover", "special_systems", "hvac", "facade", "heavy_structure"],
    mandatoryTaskCodes: ["PB-07", "EL-08", "EX-10", "HO-04", "FD-01", "TC-01", "TC-02", "DG-01", "HV-01", "HV-02", "RW-01"],
    excludedTaskCodes: [],
    additionalTaskCodes: ["BM-01", "BM-02", "BM-03", "PF-01", "PF-02", "PF-03", "CW-01", "CW-02", "HV-03", "FC-01"],
    structuralComplexityFactor: 1.35,
    mepComplexityFactor: 1.60,
    finishQualityFactor: 1.20,
    requiresCraneAboveFloors: 5,
    requiresHVAC: true,
    requiresFireFighting: true,
    requiresSTP: true,
    requiresDG: true,
    requiresElevator: true,
  },
  villa_bungalow: {
    type: "villa_bungalow",
    label: "Villa / Bungalow (Independent House)",
    description: "Independent low-rise — larger plot, garden, premium finishes, simpler structure",
    typicalFloorRange: { min: 1, max: 3 },
    typicalHeightRange: { min: 3, max: 10 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["PB-07", "EL-08", "EX-10", "EX-11", "HO-04", "HO-10", "TC-01", "TC-02", "CW-01", "CW-02", "HV-01", "HV-02", "HV-03", "DG-01", "FD-01"],
    additionalTaskCodes: ["SW-01", "SW-02", "SO-01", "SO-02"],
    structuralComplexityFactor: 0.80,
    mepComplexityFactor: 0.75,
    finishQualityFactor: 1.30,       // typically premium finishes
  },
  row_house: {
    type: "row_house",
    label: "Row House / Townhouse",
    description: "Attached housing in a row — shared walls, individual plots, G+1 or G+2",
    typicalFloorRange: { min: 2, max: 3 },
    typicalHeightRange: { min: 6, max: 10 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["PB-07", "EL-08", "EX-10", "EX-11", "HO-04", "TC-01", "TC-02", "CW-01", "CW-02", "HV-01", "HV-02", "HV-03", "DG-01", "FD-01"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.85,
    mepComplexityFactor: 0.70,
    finishQualityFactor: 1.0,
  },
  farmhouse: {
    type: "farmhouse",
    label: "Farmhouse / Weekend Home",
    description: "Rural/semi-urban independent house — large plot, basic services, landscaping focus",
    typicalFloorRange: { min: 1, max: 2 },
    typicalHeightRange: { min: 3, max: 7 },
    applicablePhases: ["site_preparation", "foundation", "plinth", "superstructure", "masonry", "plumbing", "electrical", "plastering", "waterproofing", "flooring", "doors_windows", "painting", "external_works", "approvals_handover"],
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["PB-07", "EL-08", "EX-10", "EX-11", "HO-04", "HO-10", "TC-01", "TC-02", "CW-01", "CW-02", "HV-01", "HV-02", "HV-03", "DG-01", "FD-01"],
    additionalTaskCodes: ["SW-01", "SW-02", "SO-01", "SO-02", "RW-01"],
    structuralComplexityFactor: 0.75,
    mepComplexityFactor: 0.60,
    finishQualityFactor: 1.10,
  },
};


// ---------------------------------------------------------------------------
// 5. CONDITIONAL RULES — Deterministic task selection
// ---------------------------------------------------------------------------

export const CONDITIONAL_RULES: ConditionalRule[] = [
  // === SOIL-BASED RULES ===
  {
    id: "SOIL-01",
    description: "Black cotton soil requires anti-termite treatment",
    condition: { field: "soilType", operator: "==", value: "black_cotton" },
    action: "add",
    taskCodes: ["SP-07"],
    priority: 10,
  },
  {
    id: "SOIL-02",
    description: "Hard rock requires rock excavation",
    condition: { field: "soilType", operator: "==", value: "hard_rock" },
    action: "add",
    taskCodes: ["SP-06"],
    priority: 10,
  },
  {
    id: "SOIL-03",
    description: "Hard rock — skip ordinary excavation",
    condition: { field: "soilType", operator: "==", value: "hard_rock" },
    action: "remove",
    taskCodes: ["SP-05"],
    priority: 10,
  },
  {
    id: "SOIL-04",
    description: "Soft clay / marine clay requires pile foundation",
    condition: { field: "soilType", operator: "includes", value: "soft_clay" },
    action: "add",
    taskCodes: ["PF-01", "PF-02", "PF-03"],
    priority: 15,
  },
  {
    id: "SOIL-05",
    description: "Marine clay requires pile foundation",
    condition: { field: "soilType", operator: "==", value: "marine_clay" },
    action: "add",
    taskCodes: ["PF-01", "PF-02", "PF-03"],
    priority: 15,
  },

  // === HEIGHT-BASED RULES ===
  {
    id: "HEIGHT-01",
    description: "Building >15m requires fire fighting system",
    condition: { field: "buildingHeight", operator: ">=", value: 15 },
    action: "add",
    taskCodes: ["PB-07", "FD-01", "HO-04"],
    priority: 20,
  },
  {
    id: "HEIGHT-02",
    description: "Building >15m requires lightning protection",
    condition: { field: "buildingHeight", operator: ">=", value: 15 },
    action: "add",
    taskCodes: ["EL-08"],
    priority: 20,
  },
  {
    id: "HEIGHT-03",
    description: "Building >=7 floors needs tower crane",
    condition: { field: "floors", operator: ">=", value: 7 },
    action: "add",
    taskCodes: ["TC-01", "TC-02"],
    priority: 20,
  },

  // === FEATURE-BASED RULES ===
  {
    id: "FEAT-01",
    description: "Lift required — add lift installation",
    condition: { field: "lifts", operator: ">=", value: 1 },
    action: "add",
    taskCodes: ["EX-10"],
    priority: 30,
  },
  {
    id: "FEAT-02",
    description: "Swimming pool — add pool module",
    condition: { field: "pool", operator: "==", value: true },
    action: "add",
    taskCodes: ["SW-01", "SW-02"],
    priority: 30,
  },
  {
    id: "FEAT-03",
    description: "Basement required — add basement module",
    condition: { field: "basements", operator: ">=", value: 1 },
    action: "add",
    taskCodes: ["BM-01", "BM-02", "BM-03", "WP-03"],
    priority: 30,
  },
  {
    id: "FEAT-04",
    description: "Solar panels — add solar module",
    condition: { field: "solar", operator: "==", value: true },
    action: "add",
    taskCodes: ["SO-01", "SO-02"],
    priority: 30,
  },
  {
    id: "FEAT-05",
    description: "DG set required — add generator",
    condition: { field: "dgSet", operator: "==", value: true },
    action: "add",
    taskCodes: ["DG-01"],
    priority: 30,
  },
  {
    id: "FEAT-06",
    description: "HVAC required — add HVAC module",
    condition: { field: "hvac", operator: "==", value: true },
    action: "add",
    taskCodes: ["HV-01", "HV-02"],
    priority: 30,
  },
  {
    id: "FEAT-07",
    description: "Central AC — add chiller/cooling tower",
    condition: { field: "centralAC", operator: "==", value: true },
    action: "add",
    taskCodes: ["HV-03"],
    priority: 30,
  },
  {
    id: "FEAT-08",
    description: "Curtain wall facade — add facade module",
    condition: { field: "facadeType", operator: "==", value: "curtain_wall" },
    action: "add",
    taskCodes: ["CW-01", "CW-02"],
    priority: 30,
  },
  {
    id: "FEAT-09",
    description: "False ceiling required — add false ceiling",
    condition: { field: "falseCeiling", operator: "==", value: true },
    action: "add",
    taskCodes: ["FC-01"],
    priority: 30,
  },

  // === UNIT-COUNT RULES ===
  {
    id: "UNIT-01",
    description: ">20 units requires STP per pollution control norms",
    condition: { field: "totalUnits", operator: ">=", value: 20 },
    action: "add",
    taskCodes: ["EX-09"],
    priority: 25,
  },
  {
    id: "UNIT-02",
    description: ">8 units warrants CCTV & intercom",
    condition: { field: "totalUnits", operator: ">=", value: 8 },
    action: "add",
    taskCodes: ["EX-11"],
    priority: 25,
  },

  // === AREA RULES ===
  {
    id: "AREA-01",
    description: "Large buildings need expansion joint treatment",
    condition: { field: "totalArea", operator: ">=", value: 2000 },
    action: "add",
    taskCodes: ["WP-04"],
    priority: 25,
  },
  {
    id: "AREA-02",
    description: "Plot >300 sqm — rainwater harvesting mandatory in most states",
    condition: { field: "plotArea", operator: ">=", value: 300 },
    action: "add",
    taskCodes: ["RW-01"],
    priority: 25,
  },

  // === FOUNDATION TYPE RULES ===
  {
    id: "FDN-01",
    description: "Pile foundation — add pile module, skip standard footings",
    condition: { field: "foundationType", operator: "==", value: "pile" },
    action: "add",
    taskCodes: ["PF-01", "PF-02", "PF-03"],
    priority: 15,
  },
  {
    id: "FDN-02",
    description: "Raft foundation — add raft module",
    condition: { field: "foundationType", operator: "==", value: "raft" },
    action: "add",
    taskCodes: ["RF-01", "RF-02"],
    priority: 15,
  },
];


// ---------------------------------------------------------------------------
// 6. HELPER: Get all tasks (core + additional) as a flat lookup
// ---------------------------------------------------------------------------

export const ALL_TASKS: Map<string, TaskTemplate> = new Map();
for (const task of CORE_TASKS) {
  ALL_TASKS.set(task.code, task);
}
for (const task of ADDITIONAL_TASKS) {
  ALL_TASKS.set(task.code, task);
}

/** Quick lookup by code */
export function getTask(code: string): TaskTemplate | undefined {
  return ALL_TASKS.get(code);
}

/** Get all tasks for a phase */
export function getTasksByPhase(phase: Phase): TaskTemplate[] {
  return [...ALL_TASKS.values()].filter(t => t.phase === phase);
}

// ---------------------------------------------------------------------------
// 7. CONTRACTOR TYPE MAPPING
// ---------------------------------------------------------------------------
// Maps every task code to a single contractor type.
// Rules engine calls this — it is NOT stored on TaskTemplate (computed at runtime).
//
// Grouping logic:
//   Phase → Contractor Type → Floor/Area → Task (leaf)
//
// One task = one contractor. If work requires two trades, it is split into
// separate tasks (e.g. PB-07 is Fire Fighting, not Plumbing, even though
// pipes are involved).
// ---------------------------------------------------------------------------

export type ContractorType =
  | "Civil"
  | "Plumbing"
  | "Electrical"
  | "Waterproofing"
  | "Flooring"
  | "Carpentry"
  | "Painting"
  | "Fabrication"
  | "Lift Company"
  | "Fire Fighting"
  | "HVAC"
  | "Landscaping"
  | "Specialist";

export function getContractorType(code: string): ContractorType {
  // ── Task-specific overrides (exceptions to prefix rules) ─────────────────

  const overrides: Record<string, ContractorType> = {
    // PL-range: plinth-level plumbing lines (PL-01 to PL-04 stay Civil)
    "PL-05": "Plumbing",  // water supply connection at plinth
    "PL-06": "Plumbing",  // drainage connection at plinth
    "PL-07": "Plumbing",  // sump / underground tank

    // PB-range: fire fighting exception
    "PB-07": "Fire Fighting",  // wet riser pipeline

    // EX-range: each has a different trade
    "EX-02": "Fabrication",    // MS main gate
    "EX-05": "Electrical",     // external street/gate lights
    "EX-06": "Plumbing",       // overhead water tank
    "EX-07": "Plumbing",       // borewell / water connection
    "EX-08": "Plumbing",       // pump room
    "EX-09": "Plumbing",       // STP / sewage connection
    "EX-10": "Lift Company",   // lift installation
    "EX-11": "Electrical",     // CCTV & intercom
    "EX-12": "Landscaping",    // landscaping & irrigation

    // HO-range: select tasks handled by specialist contractor
    "HO-02": "Electrical",     // permanent DISCOM connection
    "HO-03": "Plumbing",       // water department NOC / connection
    "HO-04": "Fire Fighting",  // fire department NOC

    // ADDITIONAL_TASKS exceptions
    "DG-01": "Electrical",     // diesel generator set
    "CW-01": "Fabrication",    // curtain wall aluminium framework
    "CW-02": "Fabrication",    // curtain wall glazing
    "TC-01": "Specialist",     // tower crane erection
    "TC-02": "Specialist",     // tower crane dismantling
    "SW-01": "Specialist",     // swimming pool shell
    "SW-02": "Specialist",     // swimming pool finishing & plant
    "SO-01": "Specialist",     // solar panels
    "SO-02": "Specialist",     // solar inverter & BOS
    "FC-01": "Carpentry",      // false ceiling (gypsum board)
    "FD-01": "Fire Fighting",  // fire detection & alarm system
  };

  if (overrides[code]) return overrides[code];

  // AI-generated novel tasks — default to Civil; PM reviews and can reassign
  if (code.startsWith("AI-")) return "Civil";

  // ── Prefix-based rules ───────────────────────────────────────────────────

  const prefix = code.split("-")[0];

  switch (prefix) {
    // Civil trades
    case "SP": return "Civil";   // site preparation
    case "FN": return "Civil";   // foundation (isolated / combined)
    case "PL": return "Civil";   // plinth works (PL-05/06/07 overridden above)
    case "SS": return "Civil";   // superstructure — RCC frame
    case "MW": return "Civil";   // masonry & blockwork
    case "PT": return "Civil";   // plastering (done by civil/masonry contractor)
    case "PF": return "Civil";   // pile foundation
    case "RF": return "Civil";   // raft foundation
    case "BM": return "Civil";   // basement construction
    case "RW": return "Civil";   // retaining wall
    case "HO": return "Civil";   // approvals & handover (HO-02/03/04 overridden)
    case "EX": return "Civil";   // external works default (specific codes overridden)

    // MEP & specialist trades
    case "PB": return "Plumbing";
    case "EL": return "Electrical";
    case "WP": return "Waterproofing";
    case "FL": return "Flooring";
    case "PA": return "Painting";
    case "HV": return "HVAC";

    // Doors & windows: DW-01 to DW-03 = Carpentry, DW-04 to DW-07 = Fabrication (MS/aluminium)
    case "DW": {
      const num = parseInt(code.split("-")[1] ?? "0", 10);
      return num <= 3 ? "Carpentry" : "Fabrication";
    }

    default: return "Civil";
  }
}

/** Get total task count */
export function getTotalTaskCount(): number {
  return ALL_TASKS.size;
}