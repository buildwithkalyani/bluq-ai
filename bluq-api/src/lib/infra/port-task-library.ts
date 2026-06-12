// =============================================================================
// BLUQ PORT TASK LIBRARY
// =============================================================================
// Source: MoPSW Guidelines, IS 4651 (Port & Harbour Structures), IRC SP-37,
//         CPWD DSR, Indian Ports Act 1908, MMD Regulations, IMO Standards
//
// Covers:
//   port_container_terminal — ISO container handling, STS cranes, RTG
//   port_bulk_cargo         — Coal, grain, ore — grab cranes, conveyor
//   port_fishing_harbour    — Small craft berthing, fish landing, ice plant
//
// Architecture (mirrors building task-library.ts):
//   PORT_CORE_TASKS         — Tasks common to all port types
//   PORT_ADDITIONAL_TASKS   — Type-specific modules (container, bulk, fishing)
//   PORT_TYPE_CONFIGS       — Per-type mandatory/excluded/additional task sets
//
// Key differences from building library:
//   monsoonImpactFactor     — Marine works: 1.5–2.5 (far higher than buildings)
//   tidalWindowFactor       — Additional constraint on marine task productivity
//   leadTimeDays            — Procurement lead time (STS cranes = 900+ days)
//   requiresSpecialist      — Dredging, marine piling need specialist contractors
// =============================================================================

import type {
  ProductivityRate,
  CrewMember,
  Predecessor,
  DependencyType,
} from "../task-library.js";

// ---------------------------------------------------------------------------
// PORT-SPECIFIC TYPES
// ---------------------------------------------------------------------------

export type PortPhase =
  | "surveys_investigations"   // Hydrographic, geotechnical, environmental
  | "marine_works"             // Dredging, breakwater, marine piling
  | "reclamation"              // Hydraulic fill, settlement, ground improvement
  | "quay_berth"               // Quay wall, fenders, bollards, crane rails
  | "yard_pavement"            // Heavy duty concrete, drainage, markings
  | "terminal_buildings"       // Gate complex, admin, CFS, workshop
  | "utilities"                // HT power, water, fire, telecom, CCTV
  | "equipment_installation"   // STS cranes, RTG, reach stackers, TOS
  | "navigational_aids"        // Buoys, lights, VTS, AIS
  | "commissioning_handover";  // Trials, regulatory, training, handover

export type PortType =
  | "port_container_terminal"
  | "port_bulk_cargo"
  | "port_fishing_harbour";

export type PortUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos"
  | "Hectare" | "Set" | "km";

export interface PortTaskTemplate {
  code: string;
  phase: PortPhase;
  name: string;
  description?: string;
  unit: PortUnit;
  productivityRate: ProductivityRate;

  // Weather impact — marine ops affected more severely than building construction
  monsoonImpactFactor: number;

  // Tidal window factor — fraction of day workable given tidal constraints
  // 1.0 = no tidal restriction, 0.5 = only 12hrs/day workable
  tidalWindowFactor: number;

  crew: CrewMember[];

  // Heavy equipment required (mobilisation is a separate task)
  equipment?: string[];

  predecessors: Predecessor[];

  // IS codes, MoPSW guidelines, IMO standards
  isCodeRef: string[];
  dsrRef: string;
  safetyChecks: string[];
  remarks: string;

  // A = Process task (curing, settlement monitoring — time-locked, not crew-scaled)
  // B = Labour task (crew size drives duration)
  taskCategory?: "A" | "B";

  isCore: boolean;

  // Procurement lead time before task can start (e.g., STS crane = 900 days)
  leadTimeDays?: number;

  // Flags
  requiresSpecialistContractor?: boolean;
  specialistType?: string;

  // Filtering
  applicablePortTypes?: PortType[];
  excludedPortTypes?: PortType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface PortTypeConfig {
  type: PortType;
  label: string;
  description: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
  additionalTaskCodes: string[];
  structuralComplexityFactor: number;
  marineComplexityFactor: number;
  equipmentComplexityFactor: number;
}


// ---------------------------------------------------------------------------
// PORT CORE TASKS — common to all port types (~30 tasks)
// ---------------------------------------------------------------------------

export const PORT_CORE_TASKS: PortTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (PT-SI)
  // =========================================================================
  {
    code: "PT-SI-01",
    phase: "surveys_investigations",
    name: "Hydrographic survey (bathymetric)",
    unit: "LS",
    productivityRate: { min: 14, max: 21, unit: "days" },
    monsoonImpactFactor: 1.60,
    tidalWindowFactor: 0.75,
    crew: [
      { role: "Hydrographic Surveyor", count: 1 },
      { role: "Survey Vessel Crew", count: 3 },
      { role: "Data Processing Engineer", count: 1 },
    ],
    equipment: ["Survey vessel with single-beam / multi-beam echosounder"],
    predecessors: [],
    isCodeRef: ["IS 4651 Part-I", "IHO S-44"],
    dsrRef: "MoPSW Survey Guidelines 2019",
    safetyChecks: ["Tide gauge installed before survey", "Vessel safety equipment check"],
    remarks: "Multi-beam preferred for dredging design; 1:500 scale chart",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "hydrographic survey specialist",
  },
  {
    code: "PT-SI-02",
    phase: "surveys_investigations",
    name: "Seabed geotechnical investigation (bore logs + CPT)",
    unit: "LS",
    productivityRate: { min: 21, max: 35, unit: "days" },
    monsoonImpactFactor: 1.70,
    tidalWindowFactor: 0.70,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 4 },
      { role: "Lab Technician", count: 1 },
    ],
    equipment: ["Jack-up barge or pontoon drill rig"],
    predecessors: [{ taskCode: "PT-SI-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 1892", "IS 2131", "IS 4651 Part-I"],
    dsrRef: "MoPSW Geotechnical Guidelines",
    safetyChecks: ["Barge anchoring approved by port authority", "Marine traffic clearance"],
    remarks: "Minimum 1 borehole per 50m of structure; 2× pile depth or 30m min",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "offshore geotechnical contractor",
  },
  {
    code: "PT-SI-03",
    phase: "surveys_investigations",
    name: "Topographic & utility survey (land area)",
    unit: "LS",
    productivityRate: { min: 5, max: 10, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Licensed Surveyor", count: 1 },
      { role: "Survey Assistant", count: 2 },
    ],
    predecessors: [{ taskCode: "PT-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 1200 Part-I"],
    dsrRef: "DSR Ch.1",
    safetyChecks: ["Coordinate with port authority for existing services"],
    remarks: "GPS total station; tie to port datum / chart datum",
    isCore: true,
  },
  {
    code: "PT-SI-04",
    phase: "surveys_investigations",
    name: "Environmental baseline survey & EIA",
    unit: "LS",
    productivityRate: { min: 60, max: 90, unit: "days" },
    monsoonImpactFactor: 1.0,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Environmental Consultant", count: 2 },
      { role: "Marine Biologist", count: 1 },
      { role: "Field Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "PT-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["EIA Notification 2006", "CRZ Notification 2019"],
    dsrRef: "MoEFCC EIA Guidelines",
    safetyChecks: ["Public consultation mandatory", "Coral / mangrove mapping"],
    remarks: "Required before EC grant; 60-day public comment period",
    isCore: true,
    taskCategory: "A",
    requiresSpecialistContractor: true,
    specialistType: "accredited EIA consultant",
  },
  {
    code: "PT-SI-05",
    phase: "surveys_investigations",
    name: "Metocean study (wave, wind, current, tide)",
    unit: "LS",
    productivityRate: { min: 30, max: 45, unit: "days" },
    monsoonImpactFactor: 1.0,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Oceanographer", count: 2 },
      { role: "Data Analyst", count: 1 },
    ],
    predecessors: [{ taskCode: "PT-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-II", "PIANC Guidelines"],
    dsrRef: "MoPSW Metocean Guidelines",
    safetyChecks: ["Wave rose + wind rose analysis mandatory"],
    remarks: "INCOIS hindcast data + wave rider buoy; determines weather windows",
    isCore: true,
    taskCategory: "A",
  },

  // =========================================================================
  // PHASE 2: MARINE WORKS (PT-MW)
  // =========================================================================
  {
    code: "PT-MW-01",
    phase: "marine_works",
    name: "Mobilisation of dredging plant & marine equipment",
    unit: "LS",
    productivityRate: { min: 14, max: 28, unit: "days" },
    monsoonImpactFactor: 1.80,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Marine Superintendent", count: 1 },
      { role: "Dredge Master", count: 1 },
      { role: "Crew", count: 12 },
    ],
    equipment: ["TSHD or CSD dredger", "Survey vessel", "Tug boats (2 nos)"],
    predecessors: [
      { taskCode: "PT-SI-02", type: "FS", lagDays: 14 },
      { taskCode: "PT-SI-04", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 4651 Part-I"],
    dsrRef: "MoPSW Dredging Spec 2020",
    safetyChecks: ["Port authority approval for plant entry", "IMO equipment compliance", "Marine traffic plan"],
    remarks: "Mobilisation from nearest operating port; transit 3-14 days depending on source",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "marine dredging contractor",
    leadTimeDays: 90,
  },
  {
    code: "PT-MW-02",
    phase: "marine_works",
    name: "Capital dredging — trailing suction hopper dredger (TSHD)",
    unit: "Cum",
    productivityRate: { min: 8000, max: 15000, unit: "Cum/day" },
    monsoonImpactFactor: 2.00,
    tidalWindowFactor: 0.70,
    crew: [
      { role: "Dredge Master", count: 1 },
      { role: "Dredge Crew", count: 10 },
      { role: "Survey Engineer", count: 1 },
    ],
    equipment: ["TSHD 3000-6000 m³ hopper capacity"],
    predecessors: [{ taskCode: "PT-MW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-I", "PIANC Report 103"],
    dsrRef: "MoPSW Dredging Spec 2020",
    safetyChecks: [
      "Daily progress survey to verify design depths",
      "Turbidity monitoring — not to exceed 50 NTU beyond 200m",
      "No dredging June-August (fish spawning ban in notified areas)",
    ],
    remarks: "TSHD suitable for soft-medium soils; accuracy ±0.5m; disposal at approved grounds",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "marine dredging contractor",
    conditions: [{ field: "dredgingVolume", operator: ">", value: 500000 }],
  },
  {
    code: "PT-MW-03",
    phase: "marine_works",
    name: "Capital dredging — cutter suction dredger (CSD)",
    unit: "Cum",
    productivityRate: { min: 1500, max: 4000, unit: "Cum/day" },
    monsoonImpactFactor: 1.90,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Dredge Master", count: 1 },
      { role: "Dredge Crew", count: 8 },
      { role: "Survey Engineer", count: 1 },
    ],
    equipment: ["CSD with cutter head", "Booster pump station", "Discharge pipeline"],
    predecessors: [{ taskCode: "PT-MW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-I"],
    dsrRef: "MoPSW Dredging Spec 2020",
    safetyChecks: [
      "Pipeline route survey before laying",
      "Turbidity curtain where marine ecology present",
    ],
    remarks: "CSD for hard soils / rock; stationary plant; discharge via pipeline to reclamation",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine dredging contractor",
    conditions: [{ field: "seabedSoilType", operator: "==", value: "hard" }],
  },
  {
    code: "PT-MW-04",
    phase: "marine_works",
    name: "Post-dredge sounding survey & acceptance",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "days" },
    monsoonImpactFactor: 1.60,
    tidalWindowFactor: 0.75,
    crew: [
      { role: "Hydrographic Surveyor", count: 1 },
      { role: "Survey Vessel Crew", count: 3 },
    ],
    equipment: ["Multi-beam echosounder survey vessel"],
    predecessors: [{ taskCode: "PT-MW-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IHO S-44", "IS 4651 Part-I"],
    dsrRef: "MoPSW Dredging Spec 2020",
    safetyChecks: ["100% coverage of dredged area at ±0.15m accuracy"],
    remarks: "Acceptance only after design depth confirmed; shoaling re-dredge before handover",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "PT-MW-05",
    phase: "marine_works",
    name: "Rock armour / rubble mound breakwater construction",
    unit: "Cum",
    productivityRate: { min: 500, max: 1200, unit: "Cum/day" },
    monsoonImpactFactor: 2.20,
    tidalWindowFactor: 0.60,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Barge Crew", count: 6 },
      { role: "Crane Operator", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Side-stone dumping barge", "Crane barge", "Survey vessel"],
    predecessors: [{ taskCode: "PT-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-III", "PIANC Report 103"],
    dsrRef: "MoPSW Breakwater Spec",
    safetyChecks: [
      "Armour stone weight and shape compliance (IS 4651)",
      "No placement in wave height >1.5m",
      "Geotextile filter layer before core rock",
    ],
    remarks: "Core rock → filter layer → armour stone (3-layer); armour stone weight from wave analysis",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine civil contractor",
    conditions: [{ field: "breakwaterRequired", operator: "==", value: true }],
  },
  {
    code: "PT-MW-06",
    phase: "marine_works",
    name: "Marine pile driving — steel tubular piles",
    unit: "Rmt",
    productivityRate: { min: 6, max: 12, unit: "Rmt/day per hammer" },
    monsoonImpactFactor: 1.80,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Marine Piling Supervisor", count: 1 },
      { role: "Crane Barge Crew", count: 8 },
      { role: "Welder", count: 2 },
      { role: "Diver", count: 2 },
    ],
    equipment: ["Crane barge", "Hydraulic hammer", "Template frame", "Survey vessel"],
    predecessors: [{ taskCode: "PT-MW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2911 Part-I", "IS 4651 Part-II", "AWS D1.1"],
    dsrRef: "MoPSW Marine Piling Spec",
    safetyChecks: [
      "Pile driving records (set/blow) maintained",
      "Diver inspection of pile toe after driving",
      "Noise/vibration monitoring if near existing structures",
    ],
    remarks: "Tidal window critical — driving only at slack water ± 2hrs; hydraulic hammer preferred over diesel",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine piling contractor",
    conditions: [{ field: "berthType", operator: "==", value: "piled_jetty" }],
  },
  {
    code: "PT-MW-07",
    phase: "marine_works",
    name: "Pile cap construction (marine — in water)",
    unit: "Cum",
    productivityRate: { min: 2, max: 4, unit: "Cum/day" },
    monsoonImpactFactor: 1.90,
    tidalWindowFactor: 0.55,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 6 },
      { role: "Diver", count: 2 },
    ],
    equipment: ["Working platform / false work barge", "Concrete pump", "Skip"],
    predecessors: [{ taskCode: "PT-MW-06", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 456", "IS 4651 Part-II"],
    dsrRef: "MoPSW Marine Concrete Spec",
    safetyChecks: [
      "Marine concrete mix design approved (w/c ≤0.40, min cement 400 kg/m³)",
      "Tremie concreting below tidal zone",
      "Formwork design for wave forces",
    ],
    remarks: "Cofferdam or caissons required for in-water caps; M35 minimum",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine civil contractor",
    conditions: [{ field: "berthType", operator: "==", value: "piled_jetty" }],
  },

  // =========================================================================
  // PHASE 3: RECLAMATION (PT-RC)
  // =========================================================================
  {
    code: "PT-RC-01",
    phase: "reclamation",
    name: "Hydraulic fill — pipeline reclamation from dredging",
    unit: "Cum",
    productivityRate: { min: 5000, max: 12000, unit: "Cum/day" },
    monsoonImpactFactor: 1.70,
    tidalWindowFactor: 0.80,
    crew: [
      { role: "Reclamation Engineer", count: 1 },
      { role: "Survey Engineer", count: 1 },
      { role: "Plant Operator", count: 4 },
    ],
    equipment: ["CSD dredger", "Booster pump", "HDPE discharge pipeline"],
    predecessors: [{ taskCode: "PT-MW-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-I", "BS 6349"],
    dsrRef: "MoPSW Reclamation Spec",
    safetyChecks: [
      "Bund embankment stability checked daily",
      "Spillway outlet to sea — turbidity monitored",
      "Settlement plates installed before fill",
    ],
    remarks: "Run simultaneously with dredging; fill placement in layers; dewatering via weir",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine dredging contractor",
    conditions: [{ field: "reclamationRequired", operator: "==", value: true }],
  },
  {
    code: "PT-RC-02",
    phase: "reclamation",
    name: "Prefabricated vertical drain (PVD) installation",
    unit: "Rmt",
    productivityRate: { min: 800, max: 1500, unit: "Rmt/day per rig" },
    monsoonImpactFactor: 1.40,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "PVD Rig Operator", count: 2 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["PVD installation rig", "Band drain material (Mebra / equivalent)"],
    predecessors: [{ taskCode: "PT-RC-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 15284", "ASTM D6240"],
    dsrRef: "MoPSW Ground Improvement Spec",
    safetyChecks: ["Drain penetration to design depth confirmed", "Mandrel withdrawal smooth — no soil disturbance"],
    remarks: "PVD spacing typically 1.0–1.5m triangular; accelerates consolidation by 6–18 months",
    isCore: false,
    conditions: [{ field: "settlementTreatmentRequired", operator: "==", value: true }],
  },
  {
    code: "PT-RC-03",
    phase: "reclamation",
    name: "Surcharge fill placement",
    unit: "Cum",
    productivityRate: { min: 800, max: 1500, unit: "Cum/day" },
    monsoonImpactFactor: 1.50,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Dump trucks", "Dozer", "Vibratory roller"],
    predecessors: [{ taskCode: "PT-RC-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-I"],
    dsrRef: "MoPSW Surcharge Spec",
    safetyChecks: ["Settlement plates and piezometers monitored weekly"],
    remarks: "Surcharge height 2–4m above design level; maintained until target settlement achieved",
    isCore: false,
    conditions: [{ field: "settlementTreatmentRequired", operator: "==", value: true }],
  },
  {
    code: "PT-RC-04",
    phase: "reclamation",
    name: "Settlement monitoring period",
    unit: "LS",
    productivityRate: { min: 90, max: 540, unit: "days" },
    monsoonImpactFactor: 1.0,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
    ],
    predecessors: [{ taskCode: "PT-RC-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 8009", "Terzaghi consolidation theory"],
    dsrRef: "MoPSW Settlement Monitoring Guidelines",
    safetyChecks: ["Monthly settlement reports to client", "Alert if differential settlement >25mm/month"],
    remarks: "CRITICAL path item — cannot be crashed. Duration depends on Cv and drainage path. Often 6–18 months.",
    isCore: false,
    taskCategory: "A",
    conditions: [{ field: "settlementTreatmentRequired", operator: "==", value: true }],
  },
  {
    code: "PT-RC-05",
    phase: "reclamation",
    name: "Surcharge removal",
    unit: "Cum",
    productivityRate: { min: 1000, max: 2000, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
    ],
    equipment: ["Dump trucks", "Dozer", "Excavator"],
    predecessors: [{ taskCode: "PT-RC-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-I"],
    dsrRef: "",
    safetyChecks: ["Final settlement survey before removal decision"],
    remarks: "Remove only after target consolidation (U≥90%) confirmed",
    isCore: false,
    conditions: [{ field: "settlementTreatmentRequired", operator: "==", value: true }],
  },

  // =========================================================================
  // PHASE 4: QUAY & BERTH (PT-QB)
  // =========================================================================
  {
    code: "PT-QB-01",
    phase: "quay_berth",
    name: "Quay wall — gravity caisson construction & installation",
    unit: "Rmt",
    productivityRate: { min: 3, max: 6, unit: "Rmt/day" },
    monsoonImpactFactor: 2.00,
    tidalWindowFactor: 0.55,
    crew: [
      { role: "Marine Engineer", count: 2 },
      { role: "Concrete Crew", count: 10 },
      { role: "Crane Barge Crew", count: 6 },
      { role: "Diver", count: 2 },
    ],
    equipment: ["Floating crane (500+ MT)", "Caisson fabrication yard", "Tug boats"],
    predecessors: [
      { taskCode: "PT-MW-04", type: "FS", lagDays: 0 },
      { taskCode: "PT-RC-05", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 4651 Part-II", "IS 456", "PIANC Report 121"],
    dsrRef: "MoPSW Quay Wall Spec",
    safetyChecks: [
      "Caisson stability during tow — freeboard >0.5m",
      "Rubble mound levelling to ±50mm before caisson placement",
      "Wave height <0.5m for caisson installation",
    ],
    remarks: "Caissons fabricated in dry dock or on shore; towed & sunk in position; filled with sand/concrete",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine civil contractor",
    conditions: [{ field: "quayWallType", operator: "==", value: "caisson" }],
  },
  {
    code: "PT-QB-02",
    phase: "quay_berth",
    name: "Quay wall — combined sheet pile & anchor system",
    unit: "Rmt",
    productivityRate: { min: 5, max: 10, unit: "Rmt/day" },
    monsoonImpactFactor: 1.80,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Marine Piling Supervisor", count: 1 },
      { role: "Crane Barge Crew", count: 8 },
      { role: "Welder", count: 2 },
    ],
    equipment: ["Crane barge", "Hydraulic vibratory hammer", "Anchor pile driving hammer"],
    predecessors: [{ taskCode: "PT-MW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-II", "EN 12063"],
    dsrRef: "MoPSW Sheet Pile Spec",
    safetyChecks: ["Sheet pile clutch alignment", "Anchor tension test", "Cathodic protection installed"],
    remarks: "Larssen or AZ section; Corus/ArcelorMittal certified; cathodic protection mandatory",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "marine piling contractor",
    conditions: [{ field: "quayWallType", operator: "==", value: "sheet_pile" }],
  },
  {
    code: "PT-QB-03",
    phase: "quay_berth",
    name: "Fender system installation (cone / cell type)",
    unit: "Each",
    productivityRate: { min: 2, max: 4, unit: "Each/day" },
    monsoonImpactFactor: 1.60,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Rigger", count: 3 },
      { role: "Diver", count: 2 },
      { role: "Crane Operator", count: 1 },
    ],
    equipment: ["Marine crane", "Work boat"],
    predecessors: [
      { taskCode: "PT-QB-01", type: "FS", lagDays: 7 },
      { taskCode: "PT-QB-02", type: "FS", lagDays: 7 },
    ],
    isCodeRef: ["IS 4651 Part-IV", "PIANC Report 33"],
    dsrRef: "MoPSW Fender Spec",
    safetyChecks: [
      "Fender energy absorption certified by PIANC",
      "Anchor bolt torque verified",
      "Fender panel UHMWPE facing checked",
    ],
    remarks: "Fender type from vessel energy calculation; Trelleborg / Bridgestone or equivalent",
    isCore: true,
    leadTimeDays: 90,
  },
  {
    code: "PT-QB-04",
    phase: "quay_berth",
    name: "Bollard installation (pull-out tested, cast-in)",
    unit: "Each",
    productivityRate: { min: 2, max: 3, unit: "Each/day" },
    monsoonImpactFactor: 1.40,
    tidalWindowFactor: 0.80,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Mason", count: 2 },
      { role: "Crane Operator", count: 1 },
    ],
    equipment: ["Mobile crane", "Concrete pump"],
    predecessors: [{ taskCode: "PT-QB-03", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 4651 Part-IV", "BS 6349"],
    dsrRef: "MoPSW Bollard Spec",
    safetyChecks: ["Pull-out test to 1.5× working load", "Bituminous paint on exposed surfaces"],
    remarks: "Single / double / cruciform type from mooring load calculation; 50T–150T capacity typical",
    isCore: true,
    leadTimeDays: 60,
  },
  {
    code: "PT-QB-05",
    phase: "quay_berth",
    name: "Crane rail installation (double rail track)",
    unit: "Rmt",
    productivityRate: { min: 15, max: 25, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Track Engineer", count: 1 },
      { role: "Rail Fixer", count: 4 },
      { role: "Welder", count: 2 },
    ],
    equipment: ["Rail grinding machine", "Alignment laser"],
    predecessors: [{ taskCode: "PT-QB-04", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 3443", "DIN 536A"],
    dsrRef: "MoPSW Crane Rail Spec",
    safetyChecks: [
      "Rail straightness ±1mm/3m",
      "Joint welding certified (EN 14587-1)",
      "Expansion gap 5mm per 25m",
    ],
    remarks: "A75 or A100 rail section for STS cranes; embedded rail with grout pad",
    isCore: false,
    conditions: [{ field: "stscranes", operator: ">", value: 0 }],
    leadTimeDays: 60,
  },
  {
    code: "PT-QB-06",
    phase: "quay_berth",
    name: "Quay edge HV cable duct & manhole system",
    unit: "Rmt",
    productivityRate: { min: 20, max: 35, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 3 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "PT-QB-05", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 1554", "IS 3961"],
    dsrRef: "MoPSW Electrical Spec",
    safetyChecks: ["Duct sealing at each 30m manhole", "Marker tape above ducts"],
    remarks: "33kV / 11kV HT cables in RCC ducts; separate ducts for HT, LT, control cables",
    isCore: true,
  },
  {
    code: "PT-QB-07",
    phase: "quay_berth",
    name: "Fire hydrant ring main on quay",
    unit: "Rmt",
    productivityRate: { min: 15, max: 25, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Plumber", count: 2 },
      { role: "Welder", count: 1 },
      { role: "Labourer", count: 3 },
    ],
    predecessors: [{ taskCode: "PT-QB-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 13039", "TAC Guidelines"],
    dsrRef: "MoPSW Fire Protection Spec",
    safetyChecks: ["Hydrostatic test 1.5× working pressure", "Flow test at each hydrant"],
    remarks: "DI/HDPE pipe; hydrant every 45m; pump house in yard",
    isCore: true,
  },

  // =========================================================================
  // PHASE 5: YARD & PAVEMENT (PT-YP)
  // =========================================================================
  {
    code: "PT-YP-01",
    phase: "yard_pavement",
    name: "Subgrade preparation & compaction",
    unit: "Sqm",
    productivityRate: { min: 800, max: 1500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 1 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Motor grader", "Vibratory roller 12T", "Water tanker"],
    predecessors: [{ taskCode: "PT-RC-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 2720 Part-28", "IRC SP-72"],
    dsrRef: "DSR 13.1",
    safetyChecks: ["CBR test — min 5% for sub-grade", "Proctor density min 95%"],
    remarks: "Sub-grade must achieve 95% MDD before sub-base; check moisture content",
    isCore: true,
  },
  {
    code: "PT-YP-02",
    phase: "yard_pavement",
    name: "Granular sub-base (GSB) — 300mm compacted",
    unit: "Sqm",
    productivityRate: { min: 600, max: 1000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 1 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Paver", "Vibratory roller", "Water tanker"],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 401", "IRC SP-72"],
    dsrRef: "DSR 13.2",
    safetyChecks: ["Grading check — IS sieve analysis", "DCP test every 500 sqm"],
    remarks: "Crusher run or river gravel; max aggregate 53mm; compact in 150mm layers",
    isCore: true,
  },
  {
    code: "PT-YP-03",
    phase: "yard_pavement",
    name: "Heavy duty concrete pavement (PQC) — 350mm for RTG/reach stacker",
    unit: "Sqm",
    productivityRate: { min: 250, max: 500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.60,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Concrete Engineer", count: 1 },
      { role: "Paver Operator", count: 2 },
      { role: "Carpenter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Slip form paver", "Concrete batching plant", "Transit mixers", "Curing compound sprayer"],
    predecessors: [{ taskCode: "PT-YP-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 58", "IS 456", "IS 269"],
    dsrRef: "MoPSW Pavement Spec",
    safetyChecks: [
      "Concrete strength 45 MPa min (M45)",
      "Joint sealant within 7 days",
      "Curing minimum 14 days",
    ],
    remarks: "Port pavement designed for RTG 50T axle load; dowel bars at transverse joints; tie bars at longitudinal",
    isCore: true,
  },
  {
    code: "PT-YP-04",
    phase: "yard_pavement",
    name: "Stormwater drainage channels & manholes",
    unit: "Rmt",
    productivityRate: { min: 15, max: 25, unit: "Rmt/day" },
    monsoonImpactFactor: 1.50,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "PT-YP-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 4111", "IS 651"],
    dsrRef: "DSR Ch.16",
    safetyChecks: ["Channel gradient min 1:500", "Manhole covers rated for heavy vehicles"],
    remarks: "Precast RCC channels; grated inlet traps; pump sump at low point",
    isCore: true,
  },
  {
    code: "PT-YP-05",
    phase: "yard_pavement",
    name: "Container yard markings & signage",
    unit: "Sqm",
    productivityRate: { min: 400, max: 700, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Painter", count: 2 },
      { role: "Helper", count: 3 },
    ],
    predecessors: [{ taskCode: "PT-YP-03", type: "FS", lagDays: 28 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Reflective paint for night operations", "ISO container bay numbers"],
    remarks: "20ft / 40ft bay markings; stacking rows A–Z; thermoplastic paint",
    isCore: true,
  },

  // =========================================================================
  // PHASE 6: UTILITIES (PT-UT)
  // =========================================================================
  {
    code: "PT-UT-01",
    phase: "utilities",
    name: "HT power supply — grid connection & substation",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Electrical Engineer", count: 2 },
      { role: "HT Electrician", count: 4 },
      { role: "Labourer", count: 6 },
    ],
    equipment: ["HT transformer", "HT switchgear", "Cable laying equipment"],
    predecessors: [{ taskCode: "PT-SI-03", type: "FS", lagDays: 30 }],
    isCodeRef: ["IS 1554", "IS 11171", "CEA Regulations 2010"],
    dsrRef: "MoPSW Electrical Spec",
    safetyChecks: ["CEA approval before energisation", "Earth resistance <1 ohm", "Earth mat installed"],
    remarks: "33kV or 11kV from DISCOM; port authority approval required; RTG power = 4×500kVA typical",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "HT electrical contractor",
    leadTimeDays: 120,
  },
  {
    code: "PT-UT-02",
    phase: "utilities",
    name: "Potable water supply system",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Plumbing Engineer", count: 1 },
      { role: "Plumber", count: 4 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "PT-YP-03", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 1172", "IS 4111"],
    dsrRef: "DSR Ch.9",
    safetyChecks: ["Water quality test before commissioning", "Pressure test 1.5× working"],
    remarks: "Source from municipal supply + overhead tank; DI/HDPE pipe distribution",
    isCore: true,
  },
  {
    code: "PT-UT-03",
    phase: "utilities",
    name: "Telecom & data network (fibre + Wi-Fi)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "IT Engineer", count: 2 },
      { role: "Cable Jointer", count: 3 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "PT-TB-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["TEC Guidelines"],
    dsrRef: "",
    safetyChecks: ["OFC fibre test — OTDR reading", "Wi-Fi coverage map test"],
    remarks: "OFC ring network; Wi-Fi APs on yard lighting poles; PoE switches in MDF/IDF rooms",
    isCore: true,
  },
  {
    code: "PT-UT-04",
    phase: "utilities",
    name: "CCTV & integrated security system",
    unit: "LS",
    productivityRate: { min: 21, max: 42, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Security Systems Engineer", count: 2 },
      { role: "Technician", count: 4 },
    ],
    predecessors: [{ taskCode: "PT-UT-03", type: "SS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["30-day recording minimum", "Night vision at gate & quay edge"],
    remarks: "IP cameras; perimeter intrusion detection; access control at all gates",
    isCore: true,
  },

  // =========================================================================
  // PHASE 8: NAVIGATIONAL AIDS (PT-NA)
  // =========================================================================
  {
    code: "PT-NA-01",
    phase: "navigational_aids",
    name: "Buoys & beacons installation",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "Each/day" },
    monsoonImpactFactor: 2.00,
    tidalWindowFactor: 0.60,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Work Boat Crew", count: 4 },
    ],
    equipment: ["Work boat with crane", "Anchor chain / sinker"],
    predecessors: [{ taskCode: "PT-MW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IALA Buoyage System A", "Lighthouse Act 1927"],
    dsrRef: "DGLL Guidelines",
    safetyChecks: ["Position verified by GPS", "Light character matches DGLL approval"],
    remarks: "IALA System A (Red to Port); DGLL approval mandatory before installation",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "DGLL-approved navigational aids contractor",
    leadTimeDays: 60,
  },
  {
    code: "PT-NA-02",
    phase: "navigational_aids",
    name: "Vessel traffic system (VTS) installation",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Electronics Engineer", count: 2 },
      { role: "Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "PT-TB-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IMO Resolution A.857(20)", "IALA VTS Guidelines"],
    dsrRef: "DG Shipping Guidelines",
    safetyChecks: ["Radar coverage test", "VHF channel test", "Integration with coast guard"],
    remarks: "X-band radar + S-band radar; AIS base station; VHF DF; mandatory for major ports",
    isCore: false,
    conditions: [{ field: "portType", operator: "!=", value: "port_fishing_harbour" }],
    requiresSpecialistContractor: true,
    specialistType: "VTS system integrator",
  },

  // =========================================================================
  // PHASE 9: COMMISSIONING & HANDOVER (PT-CH)
  // =========================================================================
  {
    code: "PT-CH-01",
    phase: "commissioning_handover",
    name: "Equipment acceptance trials & performance tests",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 0.80,
    crew: [
      { role: "Commissioning Engineer", count: 2 },
      { role: "OEM Technician", count: 4 },
      { role: "Port Operations Staff", count: 6 },
    ],
    predecessors: [
      { taskCode: "PT-EQ-01", type: "FS", lagDays: 0 },
      { taskCode: "PT-NA-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["PIANC Report 135"],
    dsrRef: "MoPSW Commissioning Spec",
    safetyChecks: ["All interlocks tested", "Emergency stop tested", "Load test at 110% SWL"],
    remarks: "STS crane — 110% SWL test; RTG — stability test on grade; TOS integration test",
    isCore: true,
  },
  {
    code: "PT-CH-02",
    phase: "commissioning_handover",
    name: "Port regulatory approvals (MMD, Customs, FSSAI if applicable)",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "days" },
    monsoonImpactFactor: 1.0,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Port Director / Liaison", count: 1 },
      { role: "Legal Team", count: 2 },
    ],
    predecessors: [{ taskCode: "PT-CH-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["Indian Ports Act 1908", "Major Port Trusts Act 1963"],
    dsrRef: "MoPSW Regulatory Checklist",
    safetyChecks: ["MMD port master approval", "Customs warehouse license", "Fire NOC from CFO"],
    remarks: "Major ports: approval by MoPSW. Minor ports: state maritime board. Customs notified area status critical.",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "PT-CH-03",
    phase: "commissioning_handover",
    name: "Trial operations & staff training",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 0.80,
    crew: [
      { role: "Terminal Manager", count: 1 },
      { role: "Operations Trainer", count: 2 },
      { role: "Port Operations Staff", count: 20 },
    ],
    predecessors: [{ taskCode: "PT-CH-02", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Emergency drill conducted", "ISPS code compliance verified"],
    remarks: "Trial with actual vessels; TOS live test; ISPS port facility security plan approved",
    isCore: true,
  },
];


// ---------------------------------------------------------------------------
// PORT ADDITIONAL TASKS — type-specific modules
// ---------------------------------------------------------------------------

export const PORT_ADDITIONAL_TASKS: PortTaskTemplate[] = [

  // =========================================================================
  // CONTAINER TERMINAL MODULE (PT-CT)
  // =========================================================================
  {
    code: "PT-CT-01",
    phase: "terminal_buildings",
    name: "Gate complex — truck processing lanes (OCR + weighbridge)",
    unit: "LS",
    productivityRate: { min: 90, max: 150, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 2 },
      { role: "Structural Engineer", count: 1 },
      { role: "MEP Engineer", count: 1 },
    ],
    predecessors: [{ taskCode: "PT-YP-03", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 456", "IS 1893"],
    dsrRef: "",
    safetyChecks: ["Weighbridge calibration by Legal Metrology Dept", "OCR test with 100 trucks"],
    remarks: "4–12 lanes; RFID/OCR; pre-gate zone; hazmat inspection bay",
    isCore: false,
    applicablePortTypes: ["port_container_terminal"],
  },
  {
    code: "PT-CT-02",
    phase: "equipment_installation",
    name: "Ship-to-shore (STS) crane erection & commissioning",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per crane" },
    monsoonImpactFactor: 1.80,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "OEM Erection Supervisor", count: 2 },
      { role: "Rigger", count: 8 },
      { role: "Electrician", count: 4 },
      { role: "Crane Operator (training)", count: 2 },
    ],
    equipment: ["Floating crane 1000MT+", "Hydraulic jacking system", "SPMT transporters"],
    predecessors: [
      { taskCode: "PT-QB-05", type: "FS", lagDays: 0 },
      { taskCode: "PT-UT-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 3177", "FEM 1.001", "EN 13001"],
    dsrRef: "MoPSW Equipment Spec",
    safetyChecks: [
      "SWL test 110% with certified load",
      "Anti-collision system test",
      "Emergency stop tested from all positions",
    ],
    remarks: "STS crane delivery by ocean freight from China (ZPMC / DHHI); transit 30–45 days",
    isCore: false,
    applicablePortTypes: ["port_container_terminal"],
    requiresSpecialistContractor: true,
    specialistType: "crane OEM erection team",
    leadTimeDays: 900,
  },
  {
    code: "PT-CT-03",
    phase: "equipment_installation",
    name: "RTG crane installation & commissioning",
    unit: "Each",
    productivityRate: { min: 14, max: 21, unit: "days per RTG" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "OEM Supervisor", count: 1 },
      { role: "Electrician", count: 3 },
      { role: "Mechanic", count: 2 },
    ],
    equipment: ["SPMT for yard transport", "Mobile crane 100MT"],
    predecessors: [
      { taskCode: "PT-YP-05", type: "FS", lagDays: 0 },
      { taskCode: "PT-UT-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 3177", "EN 13001"],
    dsrRef: "",
    safetyChecks: ["Anti-sway test", "Load test 110% SWL", "Tyre pressure and ground bearing capacity"],
    remarks: "RTG = Rubber Tyred Gantry; diesel-electric or eRTG (electric); ZPMC / Konecranes",
    isCore: false,
    applicablePortTypes: ["port_container_terminal"],
    requiresSpecialistContractor: true,
    specialistType: "crane OEM erection team",
    leadTimeDays: 540,
  },
  {
    code: "PT-CT-04",
    phase: "equipment_installation",
    name: "Terminal operating system (TOS) implementation & integration",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.0,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "IT Project Manager", count: 1 },
      { role: "TOS Implementation Consultant", count: 3 },
      { role: "Operations Staff (training)", count: 10 },
    ],
    predecessors: [{ taskCode: "PT-UT-03", type: "FS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "",
    safetyChecks: ["Data backup and DR drill", "Customs EDI integration tested"],
    remarks: "Navis N4 / Tideworks / INFORM — vendor depends on operator; customs EDI mandatory",
    isCore: false,
    applicablePortTypes: ["port_container_terminal"],
    requiresSpecialistContractor: true,
    specialistType: "TOS implementation vendor",
    leadTimeDays: 180,
  },
  {
    code: "PT-CT-05",
    phase: "terminal_buildings",
    name: "Container freight station (CFS) building",
    unit: "Sqm",
    productivityRate: { min: 50, max: 80, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Structural Steel Erector", count: 6 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 800", "IS 1893"],
    dsrRef: "DSR Ch.6",
    safetyChecks: ["Pre-engineered building (PEB) wind load check", "Dock levellers load rated"],
    remarks: "PEB structure; dock levellers; cold storage bay if reefer cargo; Customs bonded warehouse licence",
    isCore: false,
    applicablePortTypes: ["port_container_terminal"],
  },

  // =========================================================================
  // BULK CARGO TERMINAL MODULE (PT-BK)
  // =========================================================================
  {
    code: "PT-BK-01",
    phase: "equipment_installation",
    name: "Ship unloader (grab crane) installation & commissioning",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per unit" },
    monsoonImpactFactor: 1.80,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "OEM Supervisor", count: 2 },
      { role: "Rigger", count: 6 },
      { role: "Electrician", count: 4 },
    ],
    equipment: ["Floating crane 800MT+"],
    predecessors: [
      { taskCode: "PT-QB-05", type: "FS", lagDays: 0 },
      { taskCode: "PT-UT-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 3177", "FEM 1.001"],
    dsrRef: "",
    safetyChecks: ["Load test 110% SWL", "Grab tightness test", "Spillage containment tested"],
    remarks: "Grabbing capacity 15–40T; coal / iron ore / grain; hopper below for conveyor feed",
    isCore: false,
    applicablePortTypes: ["port_bulk_cargo"],
    requiresSpecialistContractor: true,
    specialistType: "bulk handling OEM",
    leadTimeDays: 720,
  },
  {
    code: "PT-BK-02",
    phase: "equipment_installation",
    name: "Conveyor system — quay to stockpile",
    unit: "Rmt",
    productivityRate: { min: 5, max: 10, unit: "Rmt/day" },
    monsoonImpactFactor: 1.40,
    tidalWindowFactor: 0.90,
    crew: [
      { role: "Mechanical Engineer", count: 2 },
      { role: "Steel Erector", count: 6 },
      { role: "Electrician", count: 3 },
    ],
    equipment: ["Mobile crane 100MT"],
    predecessors: [{ taskCode: "PT-BK-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 11592", "IS 8531"],
    dsrRef: "",
    safetyChecks: ["Belt tensioning test", "Emergency pull cord test every 25m", "Spillage tray fitted"],
    remarks: "Belt conveyor 600–1800mm wide; capacity 1000–5000 TPH; weather cover on quay sections",
    isCore: false,
    applicablePortTypes: ["port_bulk_cargo"],
    requiresSpecialistContractor: true,
    specialistType: "bulk material handling contractor",
    leadTimeDays: 365,
  },
  {
    code: "PT-BK-03",
    phase: "yard_pavement",
    name: "Stockpile yard preparation (compacted gravel / concrete slab)",
    unit: "Sqm",
    productivityRate: { min: 300, max: 600, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Motor grader", "Vibratory roller"],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2720 Part-28"],
    dsrRef: "",
    safetyChecks: ["Drainage slope 1:100 min to avoid water logging under stockpile"],
    remarks: "Coal / ore: compacted gravel; grain / sugar: concrete slab to avoid contamination",
    isCore: false,
    applicablePortTypes: ["port_bulk_cargo"],
  },
  {
    code: "PT-BK-04",
    phase: "utilities",
    name: "Dust suppression system (water sprinklers + enclosure)",
    unit: "LS",
    productivityRate: { min: 21, max: 42, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Environmental Engineer", count: 1 },
      { role: "Plumber", count: 3 },
      { role: "Steel Erector", count: 4 },
    ],
    predecessors: [{ taskCode: "PT-BK-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["CPCB Dust Emission Standards", "MoEFCC Notification"],
    dsrRef: "",
    safetyChecks: ["Dust PM10 <150 µg/m³ at boundary", "Wind fence height 2× stockpile height"],
    remarks: "Mandatory per MoEFCC for coal / mineral handling; water cannons at ship unloader",
    isCore: false,
    applicablePortTypes: ["port_bulk_cargo"],
    conditions: [{ field: "cargoType", operator: "==", value: "coal" }],
  },

  // =========================================================================
  // FISHING HARBOUR MODULE (PT-FH)
  // =========================================================================
  {
    code: "PT-FH-01",
    phase: "quay_berth",
    name: "Fishing boat jetty — prestressed concrete",
    unit: "Rmt",
    productivityRate: { min: 2, max: 4, unit: "Rmt/day" },
    monsoonImpactFactor: 1.90,
    tidalWindowFactor: 0.55,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "PT-MW-06", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 4651", "IS 1343"],
    dsrRef: "NCDC Fishing Harbour Design Guidelines",
    safetyChecks: ["Fender rubber bumpers at boat level", "Gangway non-slip surface"],
    remarks: "Jetty level at HWOST; 10–50T fishing vessels; floating pontoon option for tidal range >3m",
    isCore: false,
    applicablePortTypes: ["port_fishing_harbour"],
  },
  {
    code: "PT-FH-02",
    phase: "terminal_buildings",
    name: "Fish landing centre (FLC) — auction hall + icing facility",
    unit: "Sqm",
    productivityRate: { min: 30, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["FSSAI Standards", "IS 1200"],
    dsrRef: "NCDC Fishing Harbour Guidelines",
    safetyChecks: ["Non-porous floor tiles in fish handling area", "Grease trap in drainage"],
    remarks: "Tiles or concrete with 1:100 slope; pre-cooling room; ice storage; auction platform raised 600mm",
    isCore: false,
    applicablePortTypes: ["port_fishing_harbour"],
  },
  {
    code: "PT-FH-03",
    phase: "utilities",
    name: "Ice plant installation",
    unit: "LS",
    productivityRate: { min: 21, max: 42, unit: "days" },
    monsoonImpactFactor: 1.10,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Refrigeration Engineer", count: 2 },
      { role: "Electrician", count: 2 },
    ],
    equipment: ["Ice block / flake ice machine"],
    predecessors: [
      { taskCode: "PT-FH-02", type: "FS", lagDays: 0 },
      { taskCode: "PT-UT-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["BIS IS 6938"],
    dsrRef: "NCDC Guidelines",
    safetyChecks: ["Ammonia / freon leak detection system", "Insulation thickness verified"],
    remarks: "Capacity typically 5–50 MT/day; flake ice for fish; storage silo adjacent",
    isCore: false,
    applicablePortTypes: ["port_fishing_harbour"],
    requiresSpecialistContractor: true,
    specialistType: "refrigeration contractor",
    leadTimeDays: 90,
  },
  {
    code: "PT-FH-04",
    phase: "terminal_buildings",
    name: "Boat repair yard & slipway",
    unit: "LS",
    productivityRate: { min: 60, max: 90, unit: "days" },
    monsoonImpactFactor: 1.60,
    tidalWindowFactor: 0.65,
    crew: [
      { role: "Marine Engineer", count: 1 },
      { role: "Civil Engineer", count: 1 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Boat winch / cradle system"],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 4651"],
    dsrRef: "NCDC Guidelines",
    safetyChecks: ["Slipway gradient 1:10 to 1:15", "Winch SWL certified"],
    remarks: "Haul-out capacity 10–50T; concrete slipway rails; workshop for carpentry, engine, net repair",
    isCore: false,
    applicablePortTypes: ["port_fishing_harbour"],
  },
  {
    code: "PT-FH-05",
    phase: "terminal_buildings",
    name: "Fishermen welfare facilities (rest room, toilet, potable water)",
    unit: "LS",
    productivityRate: { min: 30, max: 45, unit: "days" },
    monsoonImpactFactor: 1.20,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "PT-FH-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["Building Byelaws"],
    dsrRef: "",
    safetyChecks: ["Separate male/female facilities", "Disabled access ramp"],
    remarks: "Per NCDC / state fisheries dept norms; co-op society office; net drying ground",
    isCore: false,
    applicablePortTypes: ["port_fishing_harbour"],
  },
];


// ---------------------------------------------------------------------------
// TERMINAL BUILDINGS — common tasks referenced above
// ---------------------------------------------------------------------------

export const PORT_TERMINAL_BUILDING_TASKS: PortTaskTemplate[] = [
  {
    code: "PT-TB-01",
    phase: "terminal_buildings",
    name: "Administration building (structure, MEP, finishing)",
    unit: "Sqm",
    productivityRate: { min: 30, max: 50, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Steel Fitter", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IS 1893", "NBC 2016"],
    dsrRef: "DSR Ch.5",
    safetyChecks: ["Fire NOC", "OC from local authority"],
    remarks: "RCC frame; HVAC; server room; control room for VTS / TOS",
    isCore: true,
  },
  {
    code: "PT-TB-02",
    phase: "terminal_buildings",
    name: "Equipment maintenance workshop",
    unit: "Sqm",
    productivityRate: { min: 40, max: 70, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    tidalWindowFactor: 1.0,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Steel Erector", count: 6 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "PT-YP-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 800", "IS 1893"],
    dsrRef: "DSR Ch.6",
    safetyChecks: ["EOT crane load test in workshop", "Pit inspection certified"],
    remarks: "PEB structure; 10T EOT crane; lube oil store; inspection pit for RTG/reach stacker",
    isCore: true,
  },
];


// ---------------------------------------------------------------------------
// PORT TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const PORT_TYPE_CONFIGS: Record<PortType, PortTypeConfig> = {
  port_container_terminal: {
    type: "port_container_terminal",
    label: "Container Terminal",
    description: "ISO container handling — STS cranes, RTG/reach stacker, TOS, gate OCR",
    mandatoryTaskCodes: [
      "PT-SI-01", "PT-SI-02", "PT-SI-03", "PT-SI-04", "PT-SI-05",
      "PT-MW-01", "PT-MW-02", "PT-MW-04",
      "PT-QB-03", "PT-QB-04", "PT-QB-05", "PT-QB-06", "PT-QB-07",
      "PT-YP-01", "PT-YP-02", "PT-YP-03", "PT-YP-04", "PT-YP-05",
      "PT-UT-01", "PT-UT-02", "PT-UT-03", "PT-UT-04",
      "PT-NA-01", "PT-NA-02",
      "PT-TB-01", "PT-TB-02",
      "PT-CT-01", "PT-CT-02", "PT-CT-03", "PT-CT-04", "PT-CT-05",
      "PT-CH-01", "PT-CH-02", "PT-CH-03",
    ],
    excludedTaskCodes: ["PT-BK-01", "PT-BK-02", "PT-BK-03", "PT-BK-04", "PT-FH-01", "PT-FH-02", "PT-FH-03", "PT-FH-04", "PT-FH-05"],
    additionalTaskCodes: ["PT-RC-01", "PT-RC-02", "PT-RC-03", "PT-RC-04", "PT-RC-05"],
    structuralComplexityFactor: 1.30,
    marineComplexityFactor: 1.50,
    equipmentComplexityFactor: 1.80,
  },
  port_bulk_cargo: {
    type: "port_bulk_cargo",
    label: "Bulk Cargo Terminal",
    description: "Dry bulk — coal, iron ore, grain, fertiliser — grab cranes, conveyor, stockpile",
    mandatoryTaskCodes: [
      "PT-SI-01", "PT-SI-02", "PT-SI-03", "PT-SI-04", "PT-SI-05",
      "PT-MW-01", "PT-MW-02", "PT-MW-04",
      "PT-QB-03", "PT-QB-04", "PT-QB-06", "PT-QB-07",
      "PT-YP-01", "PT-YP-02", "PT-YP-04",
      "PT-UT-01", "PT-UT-02", "PT-UT-03", "PT-UT-04",
      "PT-NA-01", "PT-NA-02",
      "PT-TB-01", "PT-TB-02",
      "PT-BK-01", "PT-BK-02", "PT-BK-03",
      "PT-CH-01", "PT-CH-02", "PT-CH-03",
    ],
    excludedTaskCodes: ["PT-QB-05", "PT-CT-01", "PT-CT-02", "PT-CT-03", "PT-CT-04", "PT-CT-05", "PT-FH-01", "PT-FH-02", "PT-FH-03", "PT-FH-04", "PT-FH-05"],
    additionalTaskCodes: ["PT-BK-04", "PT-RC-01", "PT-RC-02", "PT-RC-03", "PT-RC-04", "PT-RC-05"],
    structuralComplexityFactor: 1.20,
    marineComplexityFactor: 1.40,
    equipmentComplexityFactor: 1.60,
  },
  port_fishing_harbour: {
    type: "port_fishing_harbour",
    label: "Fishing Harbour",
    description: "Small craft berthing, fish landing, ice plant, slipway — state fisheries dept",
    mandatoryTaskCodes: [
      "PT-SI-01", "PT-SI-02", "PT-SI-03", "PT-SI-04",
      "PT-MW-01", "PT-MW-04",
      "PT-QB-03", "PT-QB-04", "PT-QB-07",
      "PT-YP-01", "PT-YP-02", "PT-YP-04",
      "PT-UT-01", "PT-UT-02",
      "PT-NA-01",
      "PT-TB-01",
      "PT-FH-01", "PT-FH-02", "PT-FH-03", "PT-FH-04", "PT-FH-05",
      "PT-CH-02", "PT-CH-03",
    ],
    excludedTaskCodes: [
      "PT-QB-05", "PT-NA-02",
      "PT-CT-01", "PT-CT-02", "PT-CT-03", "PT-CT-04", "PT-CT-05",
      "PT-BK-01", "PT-BK-02", "PT-BK-03", "PT-BK-04",
    ],
    additionalTaskCodes: [],
    structuralComplexityFactor: 0.80,
    marineComplexityFactor: 1.10,
    equipmentComplexityFactor: 0.60,
  },
};

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export const ALL_PORT_TASKS: PortTaskTemplate[] = [
  ...PORT_CORE_TASKS,
  ...PORT_ADDITIONAL_TASKS,
  ...PORT_TERMINAL_BUILDING_TASKS,
];

export function getPortTasks(portType: PortType): PortTaskTemplate[] {
  const config = PORT_TYPE_CONFIGS[portType];
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet  = new Set(config.excludedTaskCodes);

  return ALL_PORT_TASKS.filter(t => {
    if (excludedSet.has(t.code)) return false;
    if (mandatorySet.has(t.code)) return true;
    if (t.applicablePortTypes && !t.applicablePortTypes.includes(portType)) return false;
    if (t.excludedPortTypes && t.excludedPortTypes.includes(portType)) return false;
    return t.isCore;
  });
}
