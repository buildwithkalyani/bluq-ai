// =============================================================================
// BLUQ BRIDGE TASK LIBRARY
// =============================================================================
// Source: IRC 6, IRC 18, IRC 21, IRC 78, IRC 112, IRC SP-56, IS 456, IS 1343,
//         MoRT&H Specifications for Road & Bridge Works, CPWD DSR
//
// Covers:
//   bridge_major  — Major bridge (>60m span or >300m total length, PSC/steel)
//   bridge_minor  — Minor bridge / culvert (≤60m total length, PSC T-beam)
//   bridge_cable  — Cable-stayed / suspension bridge (major river crossings)
//
// Key bridge constraints:
//   - Foundation type depends on scour depth — critical unknowns until boring done
//   - River flooding season stops all in-water work (monsoon = high risk)
//   - PSC girder fabrication takes 60–90 days at casting yard before erection
//   - Long-span bridges require independent check engineer (ICE) design review
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

export type BridgePhase =
  | "surveys_investigations"
  | "foundation_piling"
  | "substructure"
  | "superstructure"
  | "deck_finishes"
  | "approaches"
  | "commissioning_handover";

export type BridgeType =
  | "bridge_major"
  | "bridge_minor"
  | "bridge_cable";

export type BridgeUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos" | "Set";

export interface BridgeTaskTemplate {
  code: string;
  phase: BridgePhase;
  name: string;
  unit: BridgeUnit;
  productivityRate: ProductivityRate;
  monsoonImpactFactor: number;
  crew: CrewMember[];
  equipment?: string[];
  predecessors: Predecessor[];
  isCodeRef: string[];
  dsrRef: string;
  safetyChecks: string[];
  remarks: string;
  taskCategory?: "A" | "B";
  isCore: boolean;
  leadTimeDays?: number;
  requiresSpecialistContractor?: boolean;
  specialistType?: string;
  applicableBridgeTypes?: BridgeType[];
  excludedBridgeTypes?: BridgeType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface BridgeTypeConfig {
  type: BridgeType;
  label: string;
  description: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
  additionalTaskCodes: string[];
  structuralComplexityFactor: number;
  foundationComplexityFactor: number;
}

// ---------------------------------------------------------------------------
// BRIDGE CORE TASKS
// ---------------------------------------------------------------------------

export const BRIDGE_CORE_TASKS: BridgeTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (BR-SI)
  // =========================================================================
  {
    code: "BR-SI-01",
    phase: "surveys_investigations",
    name: "Hydrographic / topographic survey of bridge site",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "days" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Licensed Surveyor", count: 1 },
      { role: "Survey Boat Crew", count: 3 },
      { role: "Survey Assistant", count: 2 },
    ],
    equipment: ["Survey boat with echo sounder", "Total station", "GPS"],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I", "IRC 5"],
    dsrRef: "MoRT&H Bridge Survey Spec",
    safetyChecks: ["Monsoon survey not recommended — high water levels", "Navigation lights on survey boat"],
    remarks: "Bathymetric survey of river bed; high flood level (HFL) from 50-year records; flow velocity",
    isCore: true,
  },
  {
    code: "BR-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation — bore logs at each pier & abutment",
    unit: "LS",
    productivityRate: { min: 21, max: 42, unit: "days" },
    monsoonImpactFactor: 1.80,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 4 },
      { role: "Lab Technician", count: 1 },
    ],
    equipment: ["Rotary drilling rig on pontoon barge (in-river)", "SPT equipment"],
    predecessors: [{ taskCode: "BR-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 1892", "IS 2131", "IRC 78"],
    dsrRef: "MoRT&H Bridge Geotech Spec",
    safetyChecks: ["Bore in river requires pontoon — monsoon season prohibited", "Strata log certified by geotechnical engineer"],
    remarks: "Scour depth from IRC 89 / Lacey formula; foundation type (open / pile / well) determined from bore log",
    isCore: true,
  },
  {
    code: "BR-SI-03",
    phase: "surveys_investigations",
    name: "Hydraulic study — scour depth, HFL, discharge",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Hydraulic Engineer", count: 1 },
      { role: "Data Analyst", count: 1 },
    ],
    predecessors: [{ taskCode: "BR-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 5", "IRC SP-13", "IS 7784"],
    dsrRef: "MoRT&H Bridge Design Guidelines",
    safetyChecks: ["50-year return period discharge for design", "100-year HFL for soffit level"],
    remarks: "Rational method or unit hydrograph; maximum scour depth determines pile depth / well depth",
    isCore: true,
    taskCategory: "A",
  },

  // =========================================================================
  // PHASE 2: FOUNDATION & PILING (BR-FP)
  // =========================================================================
  {
    code: "BR-FP-01",
    phase: "foundation_piling",
    name: "Cofferdam construction (sheet pile / sand bag — in-water piers)",
    unit: "Each",
    productivityRate: { min: 14, max: 28, unit: "days per pier" },
    monsoonImpactFactor: 2.20,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Crane Barge Crew", count: 6 },
      { role: "Dewatering Operator", count: 2 },
    ],
    equipment: ["Crane barge", "Sheet pile driving rig", "Dewatering pumps (diesel)"],
    predecessors: [
      { taskCode: "BR-SI-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 4651 Part-II", "IRC 78"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: [
      "Cofferdam designed for 50-year flood",
      "Internal struts and wales designed for water pressure",
      "Dewatering 24×7 with backup pump",
    ],
    remarks: "Only during dry season (Oct-May on most rivers); work must complete before monsoon; evacuate if flood warning",
    isCore: false,
    conditions: [{ field: "inWaterPiers", operator: ">", value: 0 }],
    requiresSpecialistContractor: true,
    specialistType: "marine civil contractor",
  },
  {
    code: "BR-FP-02",
    phase: "foundation_piling",
    name: "Bored cast-in-situ piling",
    unit: "Rmt",
    productivityRate: { min: 8, max: 20, unit: "Rmt/day per rig" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Piling Supervisor", count: 1 },
      { role: "Piling Rig Operator", count: 1 },
      { role: "Helper", count: 4 },
      { role: "Geotechnical Engineer", count: 1 },
    ],
    equipment: ["Rotary piling rig", "Bentonite plant", "Concrete pump", "Tremie pipe"],
    predecessors: [{ taskCode: "BR-FP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2911 Part-I Section-2", "IRC 78"],
    dsrRef: "DSR 5.20-5.24",
    safetyChecks: [
      "Bentonite slurry specific gravity 1.05–1.15",
      "Pile integrity test (PIT) on 10% piles",
      "Load test 2% of total piles or minimum 2",
      "Concrete free fall ≤ 3m (tremie)",
    ],
    remarks: "Diameter 600–1500mm; depth up to 50m; bentonite or water-flushed; Osterberg cell test for large piles",
    isCore: true,
  },
  {
    code: "BR-FP-03",
    phase: "foundation_piling",
    name: "Well foundation sinking (major river crossing)",
    unit: "Rmt",
    productivityRate: { min: 0.3, max: 1.0, unit: "Rmt/day per well" },
    monsoonImpactFactor: 2.00,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Crane Operator", count: 1 },
      { role: "Labourer", count: 20 },
      { role: "Diving Team", count: 3 },
    ],
    equipment: ["Grab crane / grab bucket", "Kentledge for sinking", "Dewatering setup"],
    predecessors: [{ taskCode: "BR-SI-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 3955", "IRC 78"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: ["Tilt < 1:80", "Shift < 25mm from plan position", "Pneumatic sinking: diver health checks"],
    remarks: "For hard/rocky river bed where boring not feasible; slow process — typical 1–3 months per well; tilting is main risk",
    isCore: false,
    applicableBridgeTypes: ["bridge_major", "bridge_cable"],
    requiresSpecialistContractor: true,
    specialistType: "bridge specialist contractor",
    conditions: [{ field: "foundationType", operator: "==", value: "well" }],
  },
  {
    code: "BR-FP-04",
    phase: "foundation_piling",
    name: "Pile load test (routine + initial)",
    unit: "Each",
    productivityRate: { min: 3, max: 5, unit: "days per test" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Helper", count: 3 },
    ],
    equipment: ["Kentledge / anchor pile reaction setup", "Load cells", "Dial gauges"],
    predecessors: [{ taskCode: "BR-FP-02", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 2911 Part-IV", "IRC 78"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: ["Maintained load test; 25 settlement plates; test to 2.5× working load for initial test"],
    remarks: "Initial test before production piles start; routine test on 2% of total piles",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BR-FP-05",
    phase: "foundation_piling",
    name: "Pile cap / well cap construction (RCC)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per cap" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "BR-FP-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 78"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Pile cut-off level accurate ±10mm", "Construction joint roughened and cleaned"],
    remarks: "M35 minimum; cover 75mm for marine/river exposure; cap size from pile group design",
    isCore: true,
  },

  // =========================================================================
  // PHASE 3: SUBSTRUCTURE (BR-SS)
  // =========================================================================
  {
    code: "BR-SS-01",
    phase: "substructure",
    name: "Pier column construction (RCC)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per pier" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "BR-FP-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IRC 112", "IRC 78"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Plumb check ±1:500", "Slipform inspection if >10m pier", "Anti-corrosion coating for river piers"],
    remarks: "Circular / rectangular column; slipform for tall piers (>10m); M35; river piers: epoxy coated rebar",
    isCore: true,
  },
  {
    code: "BR-SS-02",
    phase: "substructure",
    name: "Pier cap / hammerhead construction",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per pier cap" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "BR-SS-01", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 456", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Bearing seat level ±2mm", "Surface finish smooth for bearing pads"],
    remarks: "Bearing seat level critical — survey before concrete sets; neoprene bearing pad pocket pre-formed",
    isCore: true,
  },
  {
    code: "BR-SS-03",
    phase: "substructure",
    name: "Abutment construction (back wall + wing wall)",
    unit: "Each",
    productivityRate: { min: 21, max: 42, unit: "days per abutment" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "BR-FP-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IRC 78", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Backfill compaction behind abutment in 200mm layers", "Weep holes at 1.5m c/c"],
    remarks: "Approach slab connected to abutment to prevent settlement; approach fill compaction critical",
    isCore: true,
  },

  // =========================================================================
  // PHASE 4: SUPERSTRUCTURE (BR-SU)
  // =========================================================================
  {
    code: "BR-SU-01",
    phase: "superstructure",
    name: "PSC girder fabrication at casting yard",
    unit: "Each",
    productivityRate: { min: 5, max: 10, unit: "days per girder" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Prestressing Specialist", count: 2 },
      { role: "Steel Fitter", count: 6 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Casting bed (long-line or short-line)", "Strand jack", "Steam curing equipment"],
    predecessors: [{ taskCode: "BR-SS-02", type: "SS", lagDays: -60 }],
    isCodeRef: ["IS 1343", "IRC 18", "IRC 112"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: [
      "Prestress force log — each strand jacked",
      "Cube strength 40 MPa before stressing",
      "Camber measurement before transport",
    ],
    remarks: "Precast at dedicated yard; steam curing for early strength; transport by low-bed trailer; 28-day curing before transport",
    isCore: true,
    applicableBridgeTypes: ["bridge_major", "bridge_minor"],
  },
  {
    code: "BR-SU-02",
    phase: "superstructure",
    name: "PSC girder erection (crane lift or launching gantry)",
    unit: "Each",
    productivityRate: { min: 1, max: 3, unit: "Each/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Crane Operator", count: 1 },
      { role: "Rigger", count: 4 },
      { role: "Surveyor", count: 1 },
    ],
    equipment: ["Mobile crane 250–500T", "Launching gantry (for long bridges)", "Low-bed trailer"],
    predecessors: [{ taskCode: "BR-SU-01", type: "FS", lagDays: 28 }],
    isCodeRef: ["IRC 18", "IRC 112"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: [
      "Crane lift plan signed by structural engineer",
      "Rigging inspection before lift",
      "Girder survey after placement — position ±10mm",
      "Traffic management for crane movement",
    ],
    remarks: "Crane capacity from girder weight + dynamic factor; launching gantry for bridge-over-water; high monsoon risk",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "bridge specialist contractor",
  },
  {
    code: "BR-SU-03",
    phase: "superstructure",
    name: "In-situ deck slab (on precast girders)",
    unit: "Sqm",
    productivityRate: { min: 100, max: 200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 6 },
      { role: "Steel Fitter", count: 6 },
      { role: "Labourer", count: 12 },
    ],
    equipment: ["Concrete pump", "Concrete transit mixers", "Vibrators"],
    predecessors: [{ taskCode: "BR-SU-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 21", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Deck camber per design", "Construction joint roughened between pours"],
    remarks: "M35 minimum; deck thickness typically 200–250mm; pour in bays to control shrinkage",
    isCore: true,
  },
  {
    code: "BR-SU-04",
    phase: "superstructure",
    name: "Steel girder fabrication & erection (for steel bridges)",
    unit: "MT",
    productivityRate: { min: 5, max: 15, unit: "MT/day fabrication", method: "mechanical" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Structural Steel Fabricator", count: 8 },
      { role: "Welder (3G/4G certified)", count: 6 },
      { role: "Inspector (NDT)", count: 1 },
    ],
    equipment: ["Fabrication shop", "Grit blasting equipment", "Crane 200T+"],
    predecessors: [{ taskCode: "BR-SS-02", type: "SS", lagDays: -90 }],
    isCodeRef: ["IS 800", "AWS D1.5", "IRC 24"],
    dsrRef: "MoRT&H Steel Bridge Spec",
    safetyChecks: [
      "NDT (UT/MPI) on all welds",
      "Painting system DFT verification",
      "Trial assembly at shop before dispatch",
    ],
    remarks: "Fabrication at workshop; hot-dip galvanised or 3-coat painting; trial assembly mandatory for large trusses",
    isCore: false,
    applicableBridgeTypes: ["bridge_major", "bridge_cable"],
    requiresSpecialistContractor: true,
    specialistType: "structural steel fabricator (IRC-approved)",
    conditions: [{ field: "girderType", operator: "==", value: "steel" }],
  },
  {
    code: "BR-SU-05",
    phase: "superstructure",
    name: "Cable-stayed bridge — pylon construction",
    unit: "Each",
    productivityRate: { min: 90, max: 180, unit: "days per pylon" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Bridge Engineer", count: 2 },
      { role: "Slipform Operator", count: 3 },
      { role: "Steel Fitter", count: 8 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Slipform system", "Tower crane", "Climbing formwork"],
    predecessors: [{ taskCode: "BR-FP-05", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 456", "IRC 112", "SETRA Guide"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: [
      "Wind speed monitoring — stop above 15 m/s",
      "Survey every 5m of height",
      "Cable anchor socket casting position accurate",
    ],
    remarks: "H, A, or inverted Y pylon; slipform for speed; height 80–200m typical; independent check engineer mandatory",
    isCore: false,
    applicableBridgeTypes: ["bridge_cable"],
    requiresSpecialistContractor: true,
    specialistType: "cable-stayed bridge specialist",
  },
  {
    code: "BR-SU-06",
    phase: "superstructure",
    name: "Cable-stayed bridge — stay cable installation",
    unit: "Each",
    productivityRate: { min: 2, max: 5, unit: "Each/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Cable Engineer", count: 2 },
      { role: "Stressing Crew", count: 4 },
      { role: "Rigging Team", count: 4 },
    ],
    equipment: ["Cable winch", "Strand jack", "Aerial work platform"],
    predecessors: [{ taskCode: "BR-SU-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["fib Bulletin 30", "PTI DC10.5"],
    dsrRef: "MoRT&H Cable Spec",
    safetyChecks: [
      "Cable force measured vs design tolerance ±2%",
      "HDPE sheath continuity test",
      "Fatigue test certificate from OEM",
    ],
    remarks: "Parallel wire strand or locked-coil rope; HDPE sheath; anti-vandal nuts; force adjusted by stressing",
    isCore: false,
    applicableBridgeTypes: ["bridge_cable"],
    requiresSpecialistContractor: true,
    specialistType: "cable system specialist (BBR / VSL / Freyssinet)",
    leadTimeDays: 180,
  },
  {
    code: "BR-SU-07",
    phase: "superstructure",
    name: "Balanced cantilever / incremental launch — segment casting & launching",
    unit: "Each",
    productivityRate: { min: 3, max: 7, unit: "days per segment pair" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Bridge Engineer", count: 2 },
      { role: "Carpenter", count: 6 },
      { role: "Steel Fitter", count: 6 },
      { role: "Prestressing Specialist", count: 2 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Form traveller", "Strand jack system", "Surveying equipment"],
    predecessors: [{ taskCode: "BR-SS-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRC 112", "fib Bulletin 60", "IS 1343"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: [
      "Cantilever stability at each stage verified",
      "Survey after each segment — geometry control",
      "Asymmetric loading limits maintained",
    ],
    remarks: "For long spans (60–300m); form traveller method; geometry control survey critical to ensure midspan closure",
    isCore: false,
    applicableBridgeTypes: ["bridge_major", "bridge_cable"],
    requiresSpecialistContractor: true,
    specialistType: "balanced cantilever bridge specialist",
    conditions: [{ field: "maxSpan", operator: ">", value: 60 }],
  },

  // =========================================================================
  // PHASE 5: DECK FINISHES (BR-WC)
  // =========================================================================
  {
    code: "BR-WC-01",
    phase: "deck_finishes",
    name: "Waterproofing membrane on deck",
    unit: "Sqm",
    productivityRate: { min: 200, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.80,
    crew: [
      { role: "Waterproofing Specialist", count: 3 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BR-SU-03", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 1322", "IRC 83 Part-III"],
    dsrRef: "DSR Ch.12",
    safetyChecks: ["Adhesion test — pull-off strength >0.5 MPa", "Holiday test (electrical)"],
    remarks: "Polymer-modified bitumen membrane; torch applied; 4mm min thickness; lap joints 100mm; no application in rain",
    isCore: true,
  },
  {
    code: "BR-WC-02",
    phase: "deck_finishes",
    name: "Wearing course on bridge deck (BC/mastic asphalt)",
    unit: "Sqm",
    productivityRate: { min: 300, max: 600, unit: "Sqm/day" },
    monsoonImpactFactor: 1.80,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 2 },
      { role: "Roller Operator", count: 2 },
    ],
    equipment: ["Mini paver", "Tandem roller"],
    predecessors: [{ taskCode: "BR-WC-01", type: "FS", lagDays: 1 }],
    isCodeRef: ["IRC 83 Part-III", "MoRT&H Spec Clause 509"],
    dsrRef: "DSR Ch.13",
    safetyChecks: ["Thickness 40mm BC or 30mm mastic", "No paving in rain"],
    remarks: "Mastic asphalt preferred for bridges — no compaction needed, no vibration damage to structure",
    isCore: true,
  },
  {
    code: "BR-WC-03",
    phase: "deck_finishes",
    name: "Expansion joint installation",
    unit: "Rmt",
    productivityRate: { min: 5, max: 15, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Joint Specialist", count: 2 },
      { role: "Mason", count: 2 },
    ],
    predecessors: [{ taskCode: "BR-WC-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 83 Part-III", "IRC 6"],
    dsrRef: "",
    safetyChecks: ["Movement range verified vs design", "Anchorage torque verified"],
    remarks: "Modular joint for large movement (>80mm); strip seal or buried for small movement; joint gap at installation = design temp gap",
    isCore: true,
    leadTimeDays: 60,
  },
  {
    code: "BR-WC-04",
    phase: "deck_finishes",
    name: "Crash barrier & handrail on bridge",
    unit: "Rmt",
    productivityRate: { min: 20, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Steel Erector", count: 3 },
      { role: "Mason", count: 2 },
    ],
    predecessors: [{ taskCode: "BR-WC-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 5", "IRC 119", "MoRT&H Spec Clause 811"],
    dsrRef: "DSR Ch.15",
    safetyChecks: ["Post embedment depth verified", "Handrail height 900mm min (pedestrian 1100mm)"],
    remarks: "Concrete parapet wall or steel railing; reflectorised markers on parapet; drainage outlet every 5m",
    isCore: true,
  },
  {
    code: "BR-WC-05",
    phase: "deck_finishes",
    name: "Bridge deck drainage (spout outlets & longitudinal drain)",
    unit: "Rmt",
    productivityRate: { min: 20, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Plumber", count: 2 },
      { role: "Mason", count: 2 },
      { role: "Labourer", count: 3 },
    ],
    predecessors: [{ taskCode: "BR-SU-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 83 Part-III"],
    dsrRef: "DSR Ch.16",
    safetyChecks: ["Spout outlet every 5–10m", "Outlet clear of bearings and piers"],
    remarks: "Cast iron or SS spout; must direct water away from substructure; blocked outlets cause bearing damage",
    isCore: true,
  },

  // =========================================================================
  // PHASE 6: APPROACHES (BR-AP)
  // =========================================================================
  {
    code: "BR-AP-01",
    phase: "approaches",
    name: "Approach road earthworks & pavement (both ends)",
    unit: "Rmt",
    productivityRate: { min: 10, max: 20, unit: "Rmt/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 1 },
      { role: "Compactor Operator", count: 1 },
      { role: "Paver Operator", count: 1 },
    ],
    equipment: ["Motor grader", "Roller", "Paver"],
    predecessors: [{ taskCode: "BR-SS-03", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRC 37", "MoRT&H Spec"],
    dsrRef: "DSR Ch.13",
    safetyChecks: ["Approach fill gradient max 4%", "Compaction 95% MDD"],
    remarks: "Approach slab connects road pavement to bridge deck to eliminate bump at end; 6m min approach slab",
    isCore: true,
  },
  {
    code: "BR-AP-02",
    phase: "approaches",
    name: "Slope protection & riprap at abutments",
    unit: "Sqm",
    productivityRate: { min: 30, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "BR-AP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 89", "IS 8408"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Stone size from velocity calculation", "Geotextile filter below riprap"],
    remarks: "Rubble masonry pitching or gabion at abutment slopes; prevents embankment scour at flood",
    isCore: true,
  },

  // =========================================================================
  // PHASE 7: COMMISSIONING & HANDOVER (BR-CH)
  // =========================================================================
  {
    code: "BR-CH-01",
    phase: "commissioning_handover",
    name: "Load test (IRC proof loading)",
    unit: "LS",
    productivityRate: { min: 3, max: 7, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Bridge Engineer", count: 2 },
      { role: "Surveyor", count: 1 },
      { role: "Truck Driver", count: 4 },
    ],
    equipment: ["Loaded trucks (IRC Class 70R or AA)", "Deflection gauges", "Strain gauges"],
    predecessors: [
      { taskCode: "BR-WC-04", type: "FS", lagDays: 0 },
      { taskCode: "BR-AP-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IRC 6", "IRC 21", "IS 3966"],
    dsrRef: "MoRT&H Bridge Load Test Spec",
    safetyChecks: ["Deflection within design limit", "No cracking during test", "Residual deflection <10% of max"],
    remarks: "Mandatory before opening; IRC Class 70R or two-lane AA loading; deflection measured at midspan",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BR-CH-02",
    phase: "commissioning_handover",
    name: "MoRT&H / IRC inspection & completion certificate",
    unit: "LS",
    productivityRate: { min: 7, max: 21, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Liaison Officer", count: 1 },
    ],
    predecessors: [{ taskCode: "BR-CH-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 6", "NHAI Concession Agreement"],
    dsrRef: "MoRT&H Bridge Spec",
    safetyChecks: ["As-built drawings submitted", "Maintenance manual submitted"],
    remarks: "NHAI / PWD engineer visits site; completion certificate triggers DLP; 5-year DLP standard",
    isCore: true,
    taskCategory: "A",
  },
];

// ---------------------------------------------------------------------------
// BRIDGE TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const BRIDGE_TYPE_CONFIGS: Record<BridgeType, BridgeTypeConfig> = {
  bridge_minor: {
    type: "bridge_minor",
    label: "Minor Bridge / Culvert (≤60m total length)",
    description: "PSC T-beam or box culvert; open or pile foundation; simple span",
    mandatoryTaskCodes: [
      "BR-SI-01", "BR-SI-02", "BR-SI-03",
      "BR-FP-02", "BR-FP-04", "BR-FP-05",
      "BR-SS-01", "BR-SS-02", "BR-SS-03",
      "BR-SU-01", "BR-SU-02", "BR-SU-03",
      "BR-WC-01", "BR-WC-02", "BR-WC-03", "BR-WC-04", "BR-WC-05",
      "BR-AP-01", "BR-AP-02",
      "BR-CH-01", "BR-CH-02",
    ],
    excludedTaskCodes: ["BR-FP-03", "BR-SU-04", "BR-SU-05", "BR-SU-06", "BR-SU-07"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.80,
    foundationComplexityFactor: 0.80,
  },
  bridge_major: {
    type: "bridge_major",
    label: "Major Bridge (>300m total or >60m span)",
    description: "Long span PSC box or steel girder; deep pile or well foundation; form traveller or launching gantry",
    mandatoryTaskCodes: [
      "BR-SI-01", "BR-SI-02", "BR-SI-03",
      "BR-FP-01", "BR-FP-02", "BR-FP-04", "BR-FP-05",
      "BR-SS-01", "BR-SS-02", "BR-SS-03",
      "BR-SU-01", "BR-SU-02", "BR-SU-03",
      "BR-WC-01", "BR-WC-02", "BR-WC-03", "BR-WC-04", "BR-WC-05",
      "BR-AP-01", "BR-AP-02",
      "BR-CH-01", "BR-CH-02",
    ],
    excludedTaskCodes: ["BR-SU-05", "BR-SU-06"],
    additionalTaskCodes: ["BR-FP-03", "BR-SU-04", "BR-SU-07"],
    structuralComplexityFactor: 1.40,
    foundationComplexityFactor: 1.60,
  },
  bridge_cable: {
    type: "bridge_cable",
    label: "Cable-Stayed / Suspension Bridge",
    description: "Major river crossing with cable-stayed or suspension system; pylon; specialty contractor",
    mandatoryTaskCodes: [
      "BR-SI-01", "BR-SI-02", "BR-SI-03",
      "BR-FP-01", "BR-FP-02", "BR-FP-04", "BR-FP-05",
      "BR-SS-01", "BR-SS-02", "BR-SS-03",
      "BR-SU-03", "BR-SU-05", "BR-SU-06",
      "BR-WC-01", "BR-WC-02", "BR-WC-03", "BR-WC-04", "BR-WC-05",
      "BR-AP-01", "BR-AP-02",
      "BR-CH-01", "BR-CH-02",
    ],
    excludedTaskCodes: ["BR-SU-01", "BR-SU-02"],
    additionalTaskCodes: ["BR-FP-03", "BR-SU-04", "BR-SU-07"],
    structuralComplexityFactor: 2.00,
    foundationComplexityFactor: 1.80,
  },
};

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export const ALL_BRIDGE_TASKS: BridgeTaskTemplate[] = [...BRIDGE_CORE_TASKS];

export function getBridgeTasks(bridgeType: BridgeType): BridgeTaskTemplate[] {
  const config = BRIDGE_TYPE_CONFIGS[bridgeType];
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet  = new Set(config.excludedTaskCodes);

  return ALL_BRIDGE_TASKS.filter(t => {
    if (excludedSet.has(t.code)) return false;
    if (mandatorySet.has(t.code)) return true;
    if (t.applicableBridgeTypes && !t.applicableBridgeTypes.includes(bridgeType)) return false;
    if (t.excludedBridgeTypes && t.excludedBridgeTypes.includes(bridgeType)) return false;
    return t.isCore;
  });
}
