// =============================================================================
// BLUQ HIGHWAY TASK LIBRARY
// =============================================================================
// Source: MoRT&H Specifications for Road & Bridge Works (5th revision),
//         IRC Codes (IRC 37, IRC 58, IRC 86, IRC SP-73, IRC SP-84),
//         NHAI Guidelines, CPWD DSR, IS Codes
//
// Covers:
//   highway_4lane    — 4-lane divided (2+2) NH/SH, flexible or rigid pavement
//   highway_6lane    — 6-lane divided (3+3) NH, typically flexible
//   expressway       — 6-8 lane access-controlled, rigid pavement, safety barriers
//
// Key highway constraints:
//   - Utility relocation often on critical path (telecom, electrical, water mains)
//   - Monsoon: earthwork and bituminous paving stop completely in heavy rain
//   - ROW acquisition delays are outside contractor scope but affect start dates
//   - NHAI/SRRDA/PWD mile-stone based payment — tied to specific layer completions
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

export type HighwayPhase =
  | "surveys_investigations"
  | "earthworks"
  | "drainage_structures"
  | "pavement_layers"
  | "structures"
  | "safety_furniture"
  | "toll_its"
  | "commissioning_handover";

export type HighwayType =
  | "highway_4lane"
  | "highway_6lane"
  | "expressway";

export type HighwayUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos" | "km" | "Set";

export interface HighwayTaskTemplate {
  code: string;
  phase: HighwayPhase;
  name: string;
  unit: HighwayUnit;
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
  applicableHighwayTypes?: HighwayType[];
  excludedHighwayTypes?: HighwayType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface HighwayTypeConfig {
  type: HighwayType;
  label: string;
  description: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
  additionalTaskCodes: string[];
  pavementComplexityFactor: number;
  structureComplexityFactor: number;
}

// ---------------------------------------------------------------------------
// HIGHWAY CORE TASKS
// ---------------------------------------------------------------------------

export const HIGHWAY_CORE_TASKS: HighwayTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (HW-SI)
  // =========================================================================
  {
    code: "HW-SI-01",
    phase: "surveys_investigations",
    name: "Detailed project alignment survey (total station + drone)",
    unit: "km",
    productivityRate: { min: 1, max: 2, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Licensed Surveyor", count: 2 },
      { role: "Survey Assistant", count: 4 },
      { role: "Drone Operator", count: 1 },
    ],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I", "IRC SP-19"],
    dsrRef: "NHAI Survey Spec",
    safetyChecks: ["Traffic management plan before survey crew on road", "High-visibility vests mandatory"],
    remarks: "Total station + drone photogrammetry; 1:1000 strip plan; cross sections every 25m",
    isCore: true,
  },
  {
    code: "HW-SI-02",
    phase: "surveys_investigations",
    name: "Soil investigation along alignment (bore logs + CBR)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 3 },
      { role: "Lab Technician", count: 2 },
    ],
    predecessors: [{ taskCode: "HW-SI-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 1892", "IS 2131", "IS 2720"],
    dsrRef: "MoRT&H Spec",
    safetyChecks: ["Bore pits barricaded", "Traffic signing at bore locations"],
    remarks: "Bore at 500m intervals; CBR at each change of soil; pavement design depends on subgrade CBR",
    isCore: true,
  },
  {
    code: "HW-SI-03",
    phase: "surveys_investigations",
    name: "Utility mapping (GPR + manual verification)",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.0, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Survey Engineer", count: 1 },
      { role: "GPR Operator", count: 1 },
      { role: "Utility Liaison Officer", count: 1 },
    ],
    equipment: ["Ground penetrating radar (GPR)"],
    predecessors: [{ taskCode: "HW-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "NHAI Utility Spec",
    safetyChecks: ["All utilities confirmed with utility owners before earthwork"],
    remarks: "Critical — undetected utilities cause delays + safety incidents; verify with BSNL, state electricity, PWD water",
    isCore: true,
  },

  // =========================================================================
  // PHASE 2: EARTHWORKS (HW-EW)
  // =========================================================================
  {
    code: "HW-EW-01",
    phase: "earthworks",
    name: "Clearing, grubbing & demolition (structures in ROW)",
    unit: "km",
    productivityRate: { min: 0.1, max: 0.3, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "JCB Operator", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Bulldozer D6", "JCB 3CX", "Dump trucks"],
    predecessors: [
      { taskCode: "HW-SI-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["MoRT&H Spec Clause 201", "IS 1200 Part-I"],
    dsrRef: "DSR 1.1-1.3",
    safetyChecks: ["Tree-cutting permission from forest/revenue dept", "Utility disconnect NOC before demolition"],
    remarks: "Demolition of structures requires district collector NOC; debris disposal at approved dumping ground",
    isCore: true,
  },
  {
    code: "HW-EW-02",
    phase: "earthworks",
    name: "Utility relocation (BSNL, HT lines, water mains)",
    unit: "LS",
    productivityRate: { min: 30, max: 180, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Project Liaison Officer", count: 1 },
      { role: "Utility Contractor Crew", count: 10 },
    ],
    predecessors: [{ taskCode: "HW-SI-03", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "NHAI Utility Relocation Guidelines",
    safetyChecks: ["BSNL / DISCOM / BWSSB NOC before cutting", "Underground cable marker posts"],
    remarks: "OFTEN CRITICAL PATH — utility departments set their own timeline; must push parallel with DPR approval",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "utility department or their approved contractor",
  },
  {
    code: "HW-EW-03",
    phase: "earthworks",
    name: "Rock cutting (blasting or mechanical — highway cutting)",
    unit: "Cum",
    productivityRate: {
      min: 200, max: 600, unit: "Cum/day", method: "mechanical",
      mechanicalMin: 50, mechanicalMax: 150, mechanicalUnit: "Cum/hr",
    },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Blasting Supervisor (licensed)", count: 1 },
      { role: "Rock Breaker Operator", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Hydraulic rock breaker", "Drill jumbo", "Dump trucks 20T"],
    predecessors: [{ taskCode: "HW-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4081", "Explosive Act 1884"],
    dsrRef: "MoRT&H Spec Clause 303",
    safetyChecks: [
      "District Magistrate blasting permit",
      "1-km exclusion zone during blast",
      "Vibration monitoring near structures",
    ],
    remarks: "Blasting only in rural / remote stretches; mechanical breaking in urban/residential; blast mat required",
    isCore: false,
    conditions: [{ field: "rockCuttingRequired", operator: "==", value: true }],
  },
  {
    code: "HW-EW-04",
    phase: "earthworks",
    name: "Embankment filling & compaction (ordinary fill)",
    unit: "Cum",
    productivityRate: { min: 1500, max: 3000, unit: "Cum/day" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "Compactor Operator", count: 2 },
      { role: "Water Tanker Operator", count: 1 },
    ],
    equipment: ["Vibratory roller 12T", "Motor grader", "Water tanker", "Dump trucks"],
    predecessors: [{ taskCode: "HW-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 305", "IS 2720 Part-28"],
    dsrRef: "DSR Ch.2",
    safetyChecks: ["Degree of compaction 95% MDD (heavy)", "Layer thickness ≤ 300mm loose"],
    remarks: "No fill in rain; moisture within ±2% OMC; DCP test every 500 sqm; cross drain before each lift",
    isCore: true,
  },
  {
    code: "HW-EW-05",
    phase: "earthworks",
    name: "High embankment — staged construction with geotextile reinforcement",
    unit: "Cum",
    productivityRate: { min: 500, max: 1200, unit: "Cum/day" },
    monsoonImpactFactor: 1.80,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "Compactor Operator", count: 2 },
    ],
    equipment: ["Vibratory roller 12T", "Motor grader", "Geotextile spreader"],
    predecessors: [{ taskCode: "HW-EW-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRC SP-59", "IS 13162", "MoRT&H Spec Clause 305"],
    dsrRef: "NHAI High Embankment Spec",
    safetyChecks: ["Slope inclinometer reading before each stage", "Settlement plates installed"],
    remarks: "For embankment >6m; staged loading with geosynthetic reinforcement; PVD if soft subgrade",
    isCore: false,
    conditions: [{ field: "maxEmbankmentHeight", operator: ">", value: 6 }],
  },
  {
    code: "HW-EW-06",
    phase: "earthworks",
    name: "Sub-grade preparation & trimming",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Motor Grader Operator", count: 1 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Motor grader with laser control", "Vibratory roller", "Water tanker"],
    predecessors: [{ taskCode: "HW-EW-04", type: "FS", lagDays: 3 }],
    isCodeRef: ["MoRT&H Spec Clause 301", "IRC 37"],
    dsrRef: "DSR Ch.13",
    safetyChecks: ["CBR min 5% for subgrade", "Moisture ≤OMC +2%", "Survey cross section sign-off"],
    remarks: "Final trimming to design profile ±10mm; acceptance survey by engineer before GSB",
    isCore: true,
  },

  // =========================================================================
  // PHASE 3: DRAINAGE & STRUCTURES (HW-DR)
  // =========================================================================
  {
    code: "HW-DR-01",
    phase: "drainage_structures",
    name: "Box culvert construction (RCC)",
    unit: "Each",
    productivityRate: { min: 14, max: 28, unit: "days per culvert" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "HW-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 86", "IRC SP-13"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Foundation depth below scour level", "Hydraulic design flood (Q50) verified"],
    remarks: "Precast box culverts preferred for speed; cast-in-situ for large waterways; wing walls mandatory",
    isCore: true,
  },
  {
    code: "HW-DR-02",
    phase: "drainage_structures",
    name: "Pipe culvert installation (RCC NP3/NP4)",
    unit: "Each",
    productivityRate: { min: 2, max: 4, unit: "Each/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "JCB Operator", count: 1 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "HW-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 458", "IRC 86"],
    dsrRef: "DSR Ch.16",
    safetyChecks: ["Bedding compaction", "Outlet headwall anti-scour protection"],
    remarks: "600–1800mm diameter; NP4 for heavy traffic; headwall at both ends; completed before embankment",
    isCore: true,
  },
  {
    code: "HW-DR-03",
    phase: "drainage_structures",
    name: "Side drains (lined RCC / stone pitching)",
    unit: "Rmt",
    productivityRate: { min: 20, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "HW-EW-06", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 4111", "IRC SP-42"],
    dsrRef: "DSR Ch.16",
    safetyChecks: ["Drain gradient min 0.3%", "No sharp bends without catch pit"],
    remarks: "Trapezoidal or V-shaped; precast kerb drain or stone pitched; outlet to natural drainage",
    isCore: true,
  },
  {
    code: "HW-DR-04",
    phase: "drainage_structures",
    name: "Retaining wall — RCC / mechanically stabilised earth (MSE)",
    unit: "Rmt",
    productivityRate: { min: 3, max: 8, unit: "Rmt/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Steel Fitter", count: 3 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "HW-EW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 78", "IRC SP-96"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Drainage holes every 1.5m", "Backfill compaction per design spec"],
    remarks: "MSE wall faster than RCC; geogrid reinforcement; precast panel facing; used for high fills",
    isCore: false,
    conditions: [{ field: "retainingWallRequired", operator: "==", value: true }],
  },

  // =========================================================================
  // PHASE 4: PAVEMENT LAYERS (HW-PV)
  // =========================================================================
  {
    code: "HW-PV-01",
    phase: "pavement_layers",
    name: "Granular subbase (GSB) — 250mm compacted",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 1 },
      { role: "Compactor Operator", count: 2 },
    ],
    equipment: ["Motor grader", "Vibratory roller 12T", "Water tanker"],
    predecessors: [{ taskCode: "HW-EW-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 401", "IRC 37"],
    dsrRef: "DSR 13.2",
    safetyChecks: ["Grading within IS sieve limits", "Degree of compaction ≥ 98% MDD"],
    remarks: "Crusher run or pit gravel; max aggregate 53mm; compact in 150mm layers",
    isCore: true,
  },
  {
    code: "HW-PV-02",
    phase: "pavement_layers",
    name: "Wet mix macadam (WMM) base — 250mm",
    unit: "Sqm",
    productivityRate: { min: 1500, max: 3000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 1 },
      { role: "Compactor Operator", count: 2 },
    ],
    equipment: ["Wet mix plant", "Sensor paver", "Tandem roller", "Pneumatic roller"],
    predecessors: [{ taskCode: "HW-PV-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 406", "IRC 37"],
    dsrRef: "DSR 13.3",
    safetyChecks: ["Proctor density ≥ 98% MDD", "No WMM paving in rain", "Curing 7 days minimum"],
    remarks: "Crushed aggregate with moisture; high production rate; quality hinges on mix plant control",
    isCore: true,
  },
  {
    code: "HW-PV-03",
    phase: "pavement_layers",
    name: "Dense bituminous macadam (DBM) binder course — 75mm",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 2.00,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 2 },
      { role: "Roller Operator", count: 3 },
    ],
    equipment: ["Hot mix plant 120-160 TPH", "Sensor paver", "Tandem roller 12T", "Pneumatic roller 24T"],
    predecessors: [{ taskCode: "HW-PV-02", type: "FS", lagDays: 2 }],
    isCodeRef: ["MoRT&H Spec Clause 507", "IRC 111"],
    dsrRef: "DSR 13.5",
    safetyChecks: [
      "Mix temperature at plant 155–165°C",
      "Laying temp ≥ 125°C",
      "No laying in rain or wet surface",
      "Joint staggered min 300mm from BC joint",
    ],
    remarks: "VG-30 or VG-40 bitumen; spray tack coat before laying; joint heater for longitudinal joints",
    isCore: true,
  },
  {
    code: "HW-PV-04",
    phase: "pavement_layers",
    name: "Bituminous concrete (BC) wearing course — 40mm",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 2.20,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 2 },
      { role: "Roller Operator", count: 3 },
    ],
    equipment: ["Hot mix plant 120 TPH", "Sensor paver", "Tandem roller", "Pneumatic roller"],
    predecessors: [{ taskCode: "HW-PV-03", type: "FS", lagDays: 1 }],
    isCodeRef: ["MoRT&H Spec Clause 509", "IRC 111"],
    dsrRef: "DSR 13.6",
    safetyChecks: [
      "Marshall stability ≥ 9kN",
      "Void in mix (VIM) 3–5%",
      "Surface finish ±3mm under 3m straight edge",
    ],
    remarks: "Top layer; smooth finish; OGFC (open graded) on expressways for wet skid resistance",
    isCore: true,
  },
  {
    code: "HW-PV-05",
    phase: "pavement_layers",
    name: "Rigid pavement — PQC 300mm (expressway / NH)",
    unit: "Sqm",
    productivityRate: { min: 500, max: 1200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Concrete Engineer", count: 2 },
      { role: "Slip Form Paver Operator", count: 3 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Slip form paver", "Concrete batching plant 120 m³/hr", "Transit mixers", "Curing compound sprayer"],
    predecessors: [{ taskCode: "HW-PV-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IRC 58", "IS 456", "MoRT&H Spec Clause 601"],
    dsrRef: "DSR 13.7",
    safetyChecks: [
      "Flexural strength ≥ 4.5 MPa at 28 days",
      "Dowel bar alignment ±5mm",
      "Curing 28 days minimum",
    ],
    remarks: "Used on expressways and high-volume NH; M40 concrete; GGBS/PPC; joint sealant within 14 days",
    isCore: false,
    applicableHighwayTypes: ["expressway"],
  },

  // =========================================================================
  // PHASE 5: STRUCTURES (HW-ST)
  // =========================================================================
  {
    code: "HW-ST-01",
    phase: "structures",
    name: "Minor bridge — foundation (open / pile)",
    unit: "Each",
    productivityRate: { min: 14, max: 30, unit: "days per span" },
    monsoonImpactFactor: 1.70,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "HW-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 78", "IS 2911"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Foundation below scour depth per hydraulic study", "Cofferdam for in-water foundations"],
    remarks: "Scour depth from IRC 89 formula; dewatering plan before concreting",
    isCore: true,
  },
  {
    code: "HW-ST-02",
    phase: "structures",
    name: "Minor bridge — substructure (pier, abutment, pier cap)",
    unit: "Each",
    productivityRate: { min: 14, max: 21, unit: "days per unit" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "HW-ST-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IRC 78", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Bearing seat level survey", "Construction joint surface roughened"],
    remarks: "M30 minimum; formwork to have camber for deflection; bearing pad surface to ±2mm",
    isCore: true,
  },
  {
    code: "HW-ST-03",
    phase: "structures",
    name: "Minor bridge — PSC girder casting & erection",
    unit: "Each",
    productivityRate: { min: 5, max: 10, unit: "days per girder" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Prestressing Specialist", count: 2 },
      { role: "Crane Operator", count: 1 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Casting yard / precast facility", "Mobile crane 100–200T", "Strand jack"],
    predecessors: [{ taskCode: "HW-ST-02", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 1343", "IRC 18", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: [
      "Prestress force log maintained",
      "Girder deflection measured before erection",
      "Crane lift plan approved by structural engineer",
    ],
    remarks: "Precast PSC I-girders or T-beams; cast at yard, transported, erected; grouting of PT ducts within 7 days of stressing",
    isCore: true,
  },
  {
    code: "HW-ST-04",
    phase: "structures",
    name: "Minor bridge — deck slab and wearing course",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per span" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "HW-ST-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 21", "IRC 112"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Deck camber per design", "Deck drainage checked before wearing course"],
    remarks: "M35 deck slab; expansion joint installed; waterproofing membrane before BC wearing course",
    isCore: true,
  },
  {
    code: "HW-ST-05",
    phase: "structures",
    name: "Vehicular underpass (VUP) / pedestrian underpass (PUP) construction",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per underpass" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "HW-EW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IRC 78", "NHAI VUP Guidelines"],
    dsrRef: "",
    safetyChecks: ["Waterproofing on top slab", "Approach road gradient ≤5% (8% max for VUP)"],
    remarks: "Box section; backfill in layers after 28 days concrete strength; drainage pump at low point",
    isCore: false,
    conditions: [{ field: "underpasses", operator: ">", value: 0 }],
  },
  {
    code: "HW-ST-06",
    phase: "structures",
    name: "Flyover / grade separator — full structure",
    unit: "Each",
    productivityRate: { min: 90, max: 180, unit: "days per structure" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 2 },
      { role: "Structural Engineer", count: 1 },
      { role: "Carpenter", count: 8 },
      { role: "Steel Fitter", count: 8 },
      { role: "Labourer", count: 20 },
    ],
    equipment: ["Tower crane", "Mobile crane 200T+", "Launching gantry (if precast segments)"],
    predecessors: [{ taskCode: "HW-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 112", "IRC 6", "IS 1343", "IS 456"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Load test on completion", "Independent check engineer (ICE) review of design"],
    remarks: "Major structure — design approval by independent checking engineer; traffic management during construction critical",
    isCore: false,
    conditions: [{ field: "flyovers", operator: ">", value: 0 }],
  },

  // =========================================================================
  // PHASE 6: SAFETY & FURNITURE (HW-SF)
  // =========================================================================
  {
    code: "HW-SF-01",
    phase: "safety_furniture",
    name: "W-beam (Armco) crash barrier installation",
    unit: "Rmt",
    productivityRate: { min: 100, max: 200, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Installer", count: 4 },
      { role: "Labourer", count: 4 },
    ],
    equipment: ["Post driver", "Mobile crane"],
    predecessors: [{ taskCode: "HW-PV-04", type: "FS", lagDays: 3 }],
    isCodeRef: ["IRC 119", "EN 1317 (reference)", "MoRT&H Spec Clause 811"],
    dsrRef: "DSR Ch.15",
    safetyChecks: ["Post embedment depth 1.1m in soil / 0.6m in concrete", "Beam splice bolt torque verified"],
    remarks: "Hot-dip galvanised; double-side on median divider; terminal end treatment mandatory (FLEAT or BEAT)",
    isCore: true,
  },
  {
    code: "HW-SF-02",
    phase: "safety_furniture",
    name: "Concrete median barrier (Jersey / F-shape)",
    unit: "Rmt",
    productivityRate: { min: 50, max: 120, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    equipment: ["Slip form paver or precast placing beam"],
    predecessors: [{ taskCode: "HW-PV-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRC 119", "MoRT&H Spec Clause 813"],
    dsrRef: "DSR Ch.15",
    safetyChecks: ["Precast joint gap ≤ 12mm", "Reflectorised markers every 8m"],
    remarks: "Precast or slipformed; NHAI standard for 4+ lane divided roads; road marking on top",
    isCore: false,
    applicableHighwayTypes: ["highway_4lane", "highway_6lane", "expressway"],
  },
  {
    code: "HW-SF-03",
    phase: "safety_furniture",
    name: "Road markings & raised pavement markers (RPM)",
    unit: "km",
    productivityRate: { min: 1, max: 3, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Marking Specialist", count: 2 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Thermoplastic road marking machine", "RPM applicator"],
    predecessors: [{ taskCode: "HW-PV-04", type: "FS", lagDays: 3 }],
    isCodeRef: ["IRC 35", "MoRT&H Spec Clause 803", "IS 164"],
    dsrRef: "DSR Ch.15",
    safetyChecks: ["Retroreflectivity ≥ 100 mcd/m²/lux white, 50 mcd yellow", "RPM spacing 5m on rural, 1.2m on urban"],
    remarks: "Thermoplastic paint mandatory on NH; raised retroreflective markers at lane lines; Botts dots on curves",
    isCore: true,
  },
  {
    code: "HW-SF-04",
    phase: "safety_furniture",
    name: "Overhead sign gantry & directional signs",
    unit: "Each",
    productivityRate: { min: 2, max: 4, unit: "Each/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Steel Erector", count: 4 },
      { role: "Electrician", count: 2 },
    ],
    equipment: ["Mobile crane 50T", "Aerial work platform"],
    predecessors: [{ taskCode: "HW-SF-03", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRC 67", "MoRT&H Spec Clause 801", "IS 1111"],
    dsrRef: "DSR Ch.15",
    safetyChecks: ["Wind load check for gantry (IS 875 Part-3)", "Retroreflective sheeting ASTM D4956 Type IV"],
    remarks: "VMS (variable message signs) on expressways; static signs on NH; High Intensity Grade sheeting",
    isCore: true,
  },
  {
    code: "HW-SF-05",
    phase: "safety_furniture",
    name: "Highway lighting (LED) on urban stretches & intersections",
    unit: "Each",
    productivityRate: { min: 10, max: 20, unit: "Each/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 4 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "HW-SF-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 1944", "MoRT&H Spec Clause 821"],
    dsrRef: "DSR Ch.11",
    safetyChecks: ["Pole foundation depth min 1.5m", "Earth leakage circuit breaker (ELCB) on all poles"],
    remarks: "LED luminaires min 30W; 45m pole spacing; solar option for remote stretches",
    isCore: false,
    conditions: [{ field: "urbanLightingRequired", operator: "==", value: true }],
  },

  // =========================================================================
  // PHASE 7: TOLL & ITS (HW-TI)
  // =========================================================================
  {
    code: "HW-TI-01",
    phase: "toll_its",
    name: "Toll plaza structure & lanes (ETC + manual)",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Civil Engineer", count: 2 },
      { role: "Steel Erector", count: 6 },
      { role: "Electrician", count: 4 },
    ],
    predecessors: [{ taskCode: "HW-PV-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 800", "IS 456", "NHAI Toll Plaza Spec"],
    dsrRef: "",
    safetyChecks: ["Canopy wind load design", "Power backup UPS for ETC systems"],
    remarks: "Minimum 5 lanes; FASTag ETC mandatory (NHAI circular 2021); ANPR cameras; weigh-in-motion",
    isCore: false,
    applicableHighwayTypes: ["highway_4lane", "highway_6lane", "expressway"],
  },
  {
    code: "HW-TI-02",
    phase: "toll_its",
    name: "Advanced traffic management system (ATMS) & CCTV",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "ITS Engineer", count: 2 },
      { role: "Electrician", count: 4 },
      { role: "IT Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "HW-SF-04", type: "SS", lagDays: 30 }],
    isCodeRef: ["NHAI ATMS Spec"],
    dsrRef: "",
    safetyChecks: ["Control centre 24×7 staffing plan", "Incident detection algorithm tested"],
    remarks: "Mandatory on expressways; VMS, CCTV, incident detection, weather stations; TMC integration",
    isCore: false,
    applicableHighwayTypes: ["expressway"],
  },

  // =========================================================================
  // PHASE 8: COMMISSIONING (HW-CH)
  // =========================================================================
  {
    code: "HW-CH-01",
    phase: "commissioning_handover",
    name: "Road safety audit (RSA) — independent",
    unit: "LS",
    productivityRate: { min: 7, max: 21, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Road Safety Auditor (IRC certified)", count: 2 },
    ],
    predecessors: [{ taskCode: "HW-SF-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC SP-88", "IRC 39"],
    dsrRef: "NHAI RSA Guidelines",
    safetyChecks: ["RSA Stage 4 (pre-opening) mandatory", "All deficiencies resolved before opening"],
    remarks: "Mandatory per NHAI contract; Stage 1 (design), 3 (pre-opening) typical; IRC SP-88 guidelines",
    isCore: true,
  },
  {
    code: "HW-CH-02",
    phase: "commissioning_handover",
    name: "Pavement quality tests (core cutting, BM tests, roughness IRI)",
    unit: "km",
    productivityRate: { min: 2, max: 5, unit: "km/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "QC Engineer", count: 1 },
      { role: "Lab Technician", count: 2 },
    ],
    equipment: ["Core cutting machine", "Laser profilometer / bump integrator"],
    predecessors: [{ taskCode: "HW-PV-04", type: "FS", lagDays: 28 }],
    isCodeRef: ["MoRT&H Spec", "IRC 37"],
    dsrRef: "NHAI QC Guidelines",
    safetyChecks: ["IRI ≤ 2.5 m/km on BC surface", "Core thickness within ±5mm"],
    remarks: "Longitudinal profile roughness (IRI) determines pavement acceptance; NHAI will reject if IRI >2.5",
    isCore: true,
  },
  {
    code: "HW-CH-03",
    phase: "commissioning_handover",
    name: "NHAI / MoRT&H completion certificate & DLP commencement",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Project Director", count: 1 },
      { role: "Site Engineer", count: 2 },
    ],
    predecessors: [
      { taskCode: "HW-CH-01", type: "FS", lagDays: 0 },
      { taskCode: "HW-CH-02", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["NHAI Concession Agreement"],
    dsrRef: "",
    safetyChecks: ["Punch list cleared", "Defect liability period (DLP) bond submitted"],
    remarks: "Completion certificate triggers start of 5-year DLP; punch list closure mandatory; as-built drawings submitted",
    isCore: true,
    taskCategory: "A",
  },
];

// ---------------------------------------------------------------------------
// HIGHWAY TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const HIGHWAY_TYPE_CONFIGS: Record<HighwayType, HighwayTypeConfig> = {
  highway_4lane: {
    type: "highway_4lane",
    label: "4-Lane Divided Highway (NH/SH)",
    description: "2+2 lanes divided by median; flexible bituminous pavement; NHAI / PWD",
    mandatoryTaskCodes: [
      "HW-SI-01", "HW-SI-02", "HW-SI-03",
      "HW-EW-01", "HW-EW-02", "HW-EW-04", "HW-EW-06",
      "HW-DR-01", "HW-DR-02", "HW-DR-03",
      "HW-PV-01", "HW-PV-02", "HW-PV-03", "HW-PV-04",
      "HW-ST-01", "HW-ST-02", "HW-ST-03", "HW-ST-04",
      "HW-SF-01", "HW-SF-02", "HW-SF-03", "HW-SF-04",
      "HW-TI-01",
      "HW-CH-01", "HW-CH-02", "HW-CH-03",
    ],
    excludedTaskCodes: ["HW-PV-05", "HW-TI-02"],
    additionalTaskCodes: ["HW-EW-03", "HW-EW-05", "HW-DR-04", "HW-ST-05", "HW-ST-06", "HW-SF-05"],
    pavementComplexityFactor: 1.0,
    structureComplexityFactor: 1.0,
  },
  highway_6lane: {
    type: "highway_6lane",
    label: "6-Lane Divided Highway (NH)",
    description: "3+3 lanes divided; flexible pavement; high-volume national corridor",
    mandatoryTaskCodes: [
      "HW-SI-01", "HW-SI-02", "HW-SI-03",
      "HW-EW-01", "HW-EW-02", "HW-EW-04", "HW-EW-06",
      "HW-DR-01", "HW-DR-02", "HW-DR-03",
      "HW-PV-01", "HW-PV-02", "HW-PV-03", "HW-PV-04",
      "HW-ST-01", "HW-ST-02", "HW-ST-03", "HW-ST-04",
      "HW-SF-01", "HW-SF-02", "HW-SF-03", "HW-SF-04",
      "HW-TI-01",
      "HW-CH-01", "HW-CH-02", "HW-CH-03",
    ],
    excludedTaskCodes: ["HW-PV-05", "HW-TI-02"],
    additionalTaskCodes: ["HW-EW-03", "HW-EW-05", "HW-DR-04", "HW-ST-05", "HW-ST-06", "HW-SF-05"],
    pavementComplexityFactor: 1.20,
    structureComplexityFactor: 1.10,
  },
  expressway: {
    type: "expressway",
    label: "Expressway (6–8 lane access-controlled)",
    description: "Full access control; rigid/semi-rigid pavement; ATMS; NHAI expressway",
    mandatoryTaskCodes: [
      "HW-SI-01", "HW-SI-02", "HW-SI-03",
      "HW-EW-01", "HW-EW-02", "HW-EW-04", "HW-EW-06",
      "HW-DR-01", "HW-DR-02", "HW-DR-03",
      "HW-PV-01", "HW-PV-02", "HW-PV-05",
      "HW-ST-01", "HW-ST-02", "HW-ST-03", "HW-ST-04",
      "HW-SF-01", "HW-SF-02", "HW-SF-03", "HW-SF-04", "HW-SF-05",
      "HW-TI-01", "HW-TI-02",
      "HW-CH-01", "HW-CH-02", "HW-CH-03",
    ],
    excludedTaskCodes: ["HW-PV-03", "HW-PV-04"],
    additionalTaskCodes: ["HW-EW-03", "HW-EW-05", "HW-DR-04", "HW-ST-05", "HW-ST-06"],
    pavementComplexityFactor: 1.40,
    structureComplexityFactor: 1.30,
  },
};

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export const ALL_HIGHWAY_TASKS: HighwayTaskTemplate[] = [...HIGHWAY_CORE_TASKS];

export function getHighwayTasks(highwayType: HighwayType): HighwayTaskTemplate[] {
  const config = HIGHWAY_TYPE_CONFIGS[highwayType];
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet  = new Set(config.excludedTaskCodes);

  return ALL_HIGHWAY_TASKS.filter(t => {
    if (excludedSet.has(t.code)) return false;
    if (mandatorySet.has(t.code)) return true;
    if (t.applicableHighwayTypes && !t.applicableHighwayTypes.includes(highwayType)) return false;
    if (t.excludedHighwayTypes && t.excludedHighwayTypes.includes(highwayType)) return false;
    return t.isCore;
  });
}
