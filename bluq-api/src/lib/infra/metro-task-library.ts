// =============================================================================
// BLUQ METRO / URBAN RAIL TASK LIBRARY
// =============================================================================
// Source: DMRC/CMRL/BMRCL Standard Specifications, RDSO Guidelines,
//         IS 3370, IS 456, IS 800, IRS Codes, IGBC Green Metro Rating
//
// Covers:
//   metro_elevated    — Elevated viaduct + at-grade station (most Indian metros)
//   metro_underground — Cut & cover or TBM tunnel + underground station (complex)
//
// Key metro constraints:
//   - Urban ROW acquisition is hardest constraint — not contractor scope
//   - Utility relocation on critical path (telecom / HT / water mains in city)
//   - Monsoon: open excavation and pile work affected; indoor TBM not affected
//   - Equipment procurement: U-girder moulds, TBM — very long lead times
//   - Systems integration (signaling + OHE + AFC + PIS) is critical path in commissioning
//   - CMRS (Commissioner of Metro Rail Safety) inspection required before revenue service
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

export type MetroPhase =
  | "surveys_investigations"
  | "foundation_piling"
  | "viaduct_structure"
  | "station_civil"
  | "track_works"
  | "systems_electromechanical"
  | "depot"
  | "testing_commissioning";

export type MetroType =
  | "metro_elevated"
  | "metro_underground";

export type MetroUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos" | "km" | "Set";

export interface MetroTaskTemplate {
  code: string;
  phase: MetroPhase;
  name: string;
  unit: MetroUnit;
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
  applicableMetroTypes?: MetroType[];
  excludedMetroTypes?: MetroType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface MetroTypeConfig {
  type: MetroType;
  label: string;
  description: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
  additionalTaskCodes: string[];
  structuralComplexityFactor: number;
  systemsComplexityFactor: number;
}

// ---------------------------------------------------------------------------
// METRO CORE TASKS
// ---------------------------------------------------------------------------

export const METRO_CORE_TASKS: MetroTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (MR-SI)
  // =========================================================================
  {
    code: "MR-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey of alignment (drone + total station)",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.5, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Licensed Surveyor", count: 2 },
      { role: "Survey Assistant", count: 4 },
      { role: "Drone Operator", count: 1 },
    ],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I", "DMRC Standard Spec"],
    dsrRef: "DMRC Survey Spec",
    safetyChecks: ["Traffic management before survey crew on road", "Drone DGCA approval (NPNT)"],
    remarks: "Drone photogrammetry at 1:500; ground truthing; tie to GTS benchmark; coordinate with traffic police",
    isCore: true,
  },
  {
    code: "MR-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation (bore logs, SPT, pressuremeter)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 4 },
      { role: "Lab Technician", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-SI-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 1892", "IS 2131", "IS 2720"],
    dsrRef: "DMRC Geotech Spec",
    safetyChecks: ["Borehole locations traffic management plan", "Reinstatement of pavement after boring"],
    remarks: "Bore every 50m on viaduct centreline; deeper bores at stations; TBM route: pressuremeter + lab triaxial",
    isCore: true,
  },
  {
    code: "MR-SI-03",
    phase: "surveys_investigations",
    name: "Utility survey (GPR + record drawings + trial pits)",
    unit: "km",
    productivityRate: { min: 0.3, max: 0.7, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Survey Engineer", count: 1 },
      { role: "GPR Operator", count: 1 },
      { role: "Utility Liaison Officer", count: 2 },
    ],
    equipment: ["Ground penetrating radar (GPR)"],
    predecessors: [{ taskCode: "MR-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: [],
    dsrRef: "DMRC Utility Spec",
    safetyChecks: ["All utilities confirmed with owners", "Trial pits at each utility crossing before piling"],
    remarks: "Urban utilities: BSNL, DISCOM, BWSSB, GAIL — each has own diversion process; start early",
    isCore: true,
  },
  {
    code: "MR-SI-04",
    phase: "surveys_investigations",
    name: "Environmental & social impact assessment",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Consultant", count: 2 },
      { role: "Social Impact Expert", count: 1 },
    ],
    predecessors: [{ taskCode: "MR-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["EIA Notification 2006", "LARR Act 2013"],
    dsrRef: "DMRC EIA Guidelines",
    safetyChecks: ["Affected households survey completed", "Public consultation conducted"],
    remarks: "Both EIA and social impact assessment (SIA) needed; world bank / ADB funded projects need resettlement plan",
    isCore: true,
    taskCategory: "A",
    requiresSpecialistContractor: true,
    specialistType: "NABET accredited EIA consultant",
  },

  // =========================================================================
  // PHASE 2: FOUNDATION & PILING (MR-FP)
  // =========================================================================
  {
    code: "MR-FP-01",
    phase: "foundation_piling",
    name: "Utility relocation before piling",
    unit: "km",
    productivityRate: { min: 0.02, max: 0.05, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Utility Relocation Supervisor", count: 1 },
      { role: "Utility Contractor Crew", count: 15 },
    ],
    predecessors: [{ taskCode: "MR-SI-03", type: "FS", lagDays: 30 }],
    isCodeRef: [],
    dsrRef: "DMRC Utility Spec",
    safetyChecks: ["Service interruption approvals from all utility owners", "Temporary services maintained during shifting"],
    remarks: "Often determines piling start date — must get NOC from each utility; DMRC utility cell liaison critical",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "each utility department or their approved contractor",
  },
  {
    code: "MR-FP-02",
    phase: "foundation_piling",
    name: "Bored cast-in-situ piling (viaduct piers)",
    unit: "Rmt",
    productivityRate: { min: 15, max: 30, unit: "Rmt/day per rig" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Piling Supervisor", count: 1 },
      { role: "Piling Rig Operator", count: 1 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Rotary piling rig", "Bentonite plant", "Concrete pump", "Tremie"],
    predecessors: [{ taskCode: "MR-FP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2911 Part-I", "DMRC Piling Spec"],
    dsrRef: "DMRC Piling Spec",
    safetyChecks: [
      "PIT on 100% piles",
      "Load test 1% of piles or min 2",
      "Night piling not allowed in residential areas",
      "Vibration monitoring near heritage structures",
    ],
    remarks: "1000–1200mm diameter; depth 20–35m; 2 rigs per km typical for viaduct; PIT mandatory",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
  },
  {
    code: "MR-FP-03",
    phase: "foundation_piling",
    name: "Pile cap & starter column construction",
    unit: "Each",
    productivityRate: { min: 5, max: 10, unit: "days per pile cap" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "MR-FP-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "DMRC Pile Cap Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Pile cut-off level ±10mm", "Pile cap blinding concrete before reinforcement"],
    remarks: "M40 concrete; 75mm cover; starter column for pier connection; shuttering to be released only after 24hrs",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
  },

  // =========================================================================
  // PHASE 3: VIADUCT STRUCTURE (MR-VD) — elevated only
  // =========================================================================
  {
    code: "MR-VD-01",
    phase: "viaduct_structure",
    name: "Pier column construction (table form or jump form)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per pier" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Table form / jump form system", "Tower crane or crawler crane"],
    predecessors: [{ taskCode: "MR-FP-03", type: "FS", lagDays: 21 }],
    isCodeRef: ["IS 456", "IS 1893", "DMRC Pier Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Plumb ±1:500", "Night work restrictions near residential"],
    remarks: "Typical pier height 8–12m; M40; jump form every 3m lift; column cross section T or rectangular",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
  },
  {
    code: "MR-VD-02",
    phase: "viaduct_structure",
    name: "Pier cap construction",
    unit: "Each",
    productivityRate: { min: 5, max: 10, unit: "days per pier cap" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "MR-VD-01", type: "FS", lagDays: 21 }],
    isCodeRef: ["IS 456", "DMRC Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Bearing pocket position ±5mm", "Surface finish smooth for bearings"],
    remarks: "Saddle type or flat top; bearing pad pockets pre-formed; M40; survey before concrete sets",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
  },
  {
    code: "MR-VD-03",
    phase: "viaduct_structure",
    name: "Precast U-girder / box segment fabrication",
    unit: "Each",
    productivityRate: { min: 2, max: 4, unit: "Each/day at casting yard" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Precast Engineer", count: 2 },
      { role: "Steel Fitter", count: 6 },
      { role: "Carpenter", count: 4 },
      { role: "Labourer", count: 12 },
    ],
    equipment: ["Casting yard (dedicated)", "Steam curing tent", "Strand jack", "Portal crane"],
    predecessors: [{ taskCode: "MR-FP-02", type: "SS", lagDays: -60 }],
    isCodeRef: ["IS 1343", "IRC 112", "DMRC Precast Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: [
      "Geometry control — match casting for segmental",
      "Cube strength 40 MPa before stressing",
      "Segment numbering and marking for erection sequence",
    ],
    remarks: "U-girder 25–35m span; weight 80–120T; casting yard 2–3 km from site typical; 21-day curing before stressing",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
    requiresSpecialistContractor: true,
    specialistType: "precast concrete specialist",
    leadTimeDays: 90,
  },
  {
    code: "MR-VD-04",
    phase: "viaduct_structure",
    name: "U-girder erection by overhead launching equipment (OLE)",
    unit: "Each",
    productivityRate: { min: 1, max: 2, unit: "Each/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "OLE Operator", count: 3 },
      { role: "Surveyor", count: 1 },
      { role: "Rigger", count: 4 },
    ],
    equipment: ["Overhead launching equipment (OLE)", "Nose beam", "Straddle carrier"],
    predecessors: [
      { taskCode: "MR-VD-02", type: "FS", lagDays: 14 },
      { taskCode: "MR-VD-03", type: "FS", lagDays: 28 },
    ],
    isCodeRef: ["IRC 112", "DMRC Erection Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: [
      "OLE lift capacity vs segment weight verified",
      "Girder survey after placement ±10mm",
      "Night erection allowed only with traffic diversion plan",
    ],
    remarks: "OLE spans over traffic; typical metro erects 2 girders per day; wind speed <15 m/s for erection",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
    requiresSpecialistContractor: true,
    specialistType: "metro viaduct specialist contractor",
  },
  {
    code: "MR-VD-05",
    phase: "viaduct_structure",
    name: "In-situ deck topping & waterproofing",
    unit: "Sqm",
    productivityRate: { min: 100, max: 200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "MR-VD-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "DMRC Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Topping thickness ±5mm", "Waterproofing holiday test before track"],
    remarks: "60–80mm topping; M40; waterproofing membrane below track; forms base for track slab",
    isCore: true,
    applicableMetroTypes: ["metro_elevated"],
  },

  // =========================================================================
  // PHASE 3B: UNDERGROUND WORKS (MR-UG) — underground only
  // =========================================================================
  {
    code: "MR-UG-01",
    phase: "viaduct_structure",
    name: "Cut & cover station box — diaphragm wall",
    unit: "Rmt",
    productivityRate: { min: 5, max: 10, unit: "Rmt/day per panel" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Specialist Civil Engineer", count: 2 },
      { role: "Hydromil Operator", count: 2 },
      { role: "Concrete Crew", count: 8 },
    ],
    equipment: ["Hydraulic cutter / clamshell bucket", "Bentonite plant", "Tremie concrete", "Reinforcement cage crane"],
    predecessors: [{ taskCode: "MR-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2911", "BS EN 1538", "DMRC Underground Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Panel verticality <1:200", "Bentonite specific gravity 1.04–1.10", "Hydrostatic pressure check"],
    remarks: "600–1000mm thick D-wall; serves as temporary shoring during excavation; permanent station wall",
    isCore: false,
    applicableMetroTypes: ["metro_underground"],
    requiresSpecialistContractor: true,
    specialistType: "specialist geotechnical / retaining wall contractor",
  },
  {
    code: "MR-UG-02",
    phase: "viaduct_structure",
    name: "Cut & cover station box — excavation & propping",
    unit: "Cum",
    productivityRate: { min: 200, max: 500, unit: "Cum/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Civil Engineer", count: 2 },
      { role: "Excavator Operator", count: 2 },
      { role: "Strutting Crew", count: 6 },
    ],
    equipment: ["Excavator", "Dump trucks", "Steel struts / walers", "Dewatering pump"],
    predecessors: [{ taskCode: "MR-UG-01", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 4956", "DMRC Underground Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Inclinometer readings before each prop removal", "Wall deflection <25mm", "24hr dewatering"],
    remarks: "Excavate in stages with steel props; dewatering critical; bottom-up or top-down depending on depth",
    isCore: false,
    applicableMetroTypes: ["metro_underground"],
    requiresSpecialistContractor: true,
    specialistType: "specialist deep excavation contractor",
  },
  {
    code: "MR-UG-03",
    phase: "viaduct_structure",
    name: "TBM tunnel boring (twin bore)",
    unit: "km",
    productivityRate: { min: 0.005, max: 0.015, unit: "km/day per TBM" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "TBM Engineer", count: 2 },
      { role: "TBM Crew", count: 25 },
      { role: "Segment Erector Operator", count: 2 },
    ],
    equipment: ["Earth pressure balance TBM (EPB TBM)", "Segment train", "Grouting plant", "Muck train"],
    predecessors: [{ taskCode: "MR-UG-01", type: "FS", lagDays: 90 }],
    isCodeRef: ["ITA Guidelines", "DMRC Tunnel Spec"],
    dsrRef: "DMRC Tunnel Spec",
    safetyChecks: [
      "Face pressure maintained (EPB mode)",
      "Settlement monitoring — surface settlement <10mm",
      "Ground conditioning in mixed face conditions",
      "Tail void grouting within 24 hours of advance",
    ],
    remarks: "6.5–6.8m bore diameter typical; EPB TBM for soft ground; breakthrough at launch shaft; average 8–12 rings/day",
    isCore: false,
    applicableMetroTypes: ["metro_underground"],
    requiresSpecialistContractor: true,
    specialistType: "TBM tunneling specialist (Herrenknecht / CREG / LNSS)",
    leadTimeDays: 540,
  },

  // =========================================================================
  // PHASE 4: STATION CIVIL WORKS (MR-SC)
  // =========================================================================
  {
    code: "MR-SC-01",
    phase: "station_civil",
    name: "Station structural frame (concourse + platform levels)",
    unit: "Sqm",
    productivityRate: { min: 30, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Carpenter", count: 6 },
      { role: "Steel Fitter", count: 6 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Tower crane", "Mobile crane"],
    predecessors: [{ taskCode: "MR-VD-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IS 1893", "DMRC Station Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Column grid survey ±5mm", "Seismic detailing (Zone III/IV) verified"],
    remarks: "Two-level station typical: concourse + platform; M40; precast roof possible for speed",
    isCore: true,
  },
  {
    code: "MR-SC-02",
    phase: "station_civil",
    name: "Station roof structure & cladding (steel / PC)",
    unit: "Sqm",
    productivityRate: { min: 20, max: 40, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Steel Erector", count: 6 },
      { role: "Cladding Installer", count: 4 },
      { role: "Labourer", count: 6 },
    ],
    equipment: ["Mobile crane", "Aerial work platform"],
    predecessors: [{ taskCode: "MR-SC-01", type: "FS", lagDays: 28 }],
    isCodeRef: ["IS 800", "IS 1893"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Wind uplift check", "Roof drainage gradient min 1:100"],
    remarks: "Polycarbonate or metal deck; natural ventilation maximised; solar PV possible on roof",
    isCore: true,
  },
  {
    code: "MR-SC-03",
    phase: "station_civil",
    name: "Station finishing — flooring, cladding, false ceiling",
    unit: "Sqm",
    productivityRate: { min: 25, max: 50, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Interior Contractor", count: 10 },
      { role: "False Ceiling Installer", count: 4 },
    ],
    predecessors: [{ taskCode: "MR-SC-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016", "DMRC Finishing Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Slip resistance in rainy conditions", "Tactile path for visually impaired (RPWD Act)"],
    remarks: "Granite / vitrified tile; tactile pavers for visually impaired; bright lighting; advertisement panels",
    isCore: true,
  },
  {
    code: "MR-SC-04",
    phase: "station_civil",
    name: "Staircase, escalator & lift openings and finishing",
    unit: "Each",
    productivityRate: { min: 14, max: 21, unit: "days per staircase set" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "MR-SC-01", type: "FS", lagDays: 28 }],
    isCodeRef: ["NBC 2016", "RPWD Act 2016"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Riser height 150mm max", "Tread 300mm min", "Handrail both sides"],
    remarks: "Minimum 3 staircases per station; 2 escalators (1 up, 1 fixed staircase alternate); 1 lift mandatory",
    isCore: true,
  },
  {
    code: "MR-SC-05",
    phase: "station_civil",
    name: "Station MEP — HVAC, electrical, fire fighting, plumbing",
    unit: "Sqm",
    productivityRate: { min: 15, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "MEP Engineer", count: 2 },
      { role: "HVAC Technician", count: 4 },
      { role: "Electrician", count: 6 },
      { role: "Plumber", count: 3 },
    ],
    predecessors: [{ taskCode: "MR-SC-01", type: "SS", lagDays: 30 }],
    isCodeRef: ["NBC Part-4", "IS 3034", "TAC Guidelines"],
    dsrRef: "DMRC MEP Spec",
    safetyChecks: ["Fire suppression test", "Emergency lighting 90min backup", "Smoke extraction test"],
    remarks: "Screen door system requires interface with OHE and platform; HVAC for underground critical",
    isCore: true,
  },

  // =========================================================================
  // PHASE 5: TRACK WORKS (MR-TW)
  // =========================================================================
  {
    code: "MR-TW-01",
    phase: "track_works",
    name: "Ballastless track — direct fixation (DFF) on viaduct",
    unit: "km",
    productivityRate: { min: 0.05, max: 0.10, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Track Engineer", count: 2 },
      { role: "Track Fitter", count: 8 },
      { role: "Surveyor", count: 1 },
    ],
    equipment: ["Rail laying trolley", "Alignment laser", "Hydraulic rail bender"],
    predecessors: [{ taskCode: "MR-VD-05", type: "FS", lagDays: 7 }],
    isCodeRef: ["IRS T-12", "IRS T-28", "RDSO Track Manual"],
    dsrRef: "DMRC Track Spec",
    safetyChecks: [
      "Track geometry: gauge 1435mm ±1mm, cant as designed",
      "Rail joint weld NDT",
      "Fish plate bolt torque log",
    ],
    remarks: "60 kg/m UIC 60 rail; direct fixation with elastomeric pads; no ballast on viaduct; geometrical survey after each 200m",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "metro track laying specialist",
  },
  {
    code: "MR-TW-02",
    phase: "track_works",
    name: "Turnout & crossover installation (at interchange / depot entry)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per turnout" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Track Engineer", count: 1 },
      { role: "Track Fitter", count: 6 },
    ],
    equipment: ["Mobile crane", "Hydraulic jack"],
    predecessors: [{ taskCode: "MR-TW-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS T-12", "RDSO Turnout Spec"],
    dsrRef: "DMRC Track Spec",
    safetyChecks: ["Switch machine operation test", "Tie bar clearance check", "Turnout geometry survey"],
    remarks: "Preassembled turnout panels; point machine (switch machine) electric or hydraulic; tested with rolling stock",
    isCore: true,
  },
  {
    code: "MR-TW-03",
    phase: "track_works",
    name: "Third rail / OHE installation (traction power supply conductor)",
    unit: "km",
    productivityRate: { min: 0.1, max: 0.3, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Electrical Engineer", count: 2 },
      { role: "OHE Fitter", count: 6 },
      { role: "Rigger", count: 3 },
    ],
    equipment: ["OHE wiring train", "Tension machine", "Aerial work platform"],
    predecessors: [{ taskCode: "MR-TW-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS OHE Manual", "RDSO OHE Spec", "DMRC Traction Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: [
      "Stagger ±200mm maximum",
      "Contact wire height 5.5–5.8m above rail (OHE)",
      "Third rail cover guards continuity tested",
      "Section gaps at stations and crossovers",
    ],
    remarks: "25kV 50Hz AC OHE (most metros) or 750V DC third rail; catenary + contact wire system; tensioned to 15kN",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "traction OHE specialist contractor",
  },
  {
    code: "MR-TW-04",
    phase: "track_works",
    name: "Depot track laying (ballasted or DFF)",
    unit: "km",
    productivityRate: { min: 0.05, max: 0.10, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Track Engineer", count: 1 },
      { role: "Track Fitter", count: 6 },
    ],
    predecessors: [{ taskCode: "MR-TW-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS T-12", "RDSO Track Manual"],
    dsrRef: "DMRC Track Spec",
    safetyChecks: ["Pit track alignment for inspection pit", "Overhead clearance in shed"],
    remarks: "Depot has ballasted track (cost savings); inspection pits at maintenance lines; wash plant tracks",
    isCore: true,
  },

  // =========================================================================
  // PHASE 6: SYSTEMS (MR-SY)
  // =========================================================================
  {
    code: "MR-SY-01",
    phase: "systems_electromechanical",
    name: "Traction power supply — receiving substations (RSS) & TSS",
    unit: "Each",
    productivityRate: { min: 60, max: 120, unit: "days per substation" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Power Engineer", count: 2 },
      { role: "HT Electrician", count: 6 },
      { role: "Cable Jointer", count: 4 },
    ],
    predecessors: [{ taskCode: "MR-SI-04", type: "FS", lagDays: 30 }],
    isCodeRef: ["IS 11171", "CEA Regulations 2010", "DMRC Power Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["CEA approval before energisation", "Earth resistance <0.5 ohm", "Protection relay test"],
    remarks: "66kV or 33kV grid input; RSS every 10–15 km; TSS every 1.5 km for 25kV AC traction",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "HT electrical contractor with metro experience",
    leadTimeDays: 180,
  },
  {
    code: "MR-SY-02",
    phase: "systems_electromechanical",
    name: "Signaling & train control system (CBTC / ATP/ATO)",
    unit: "LS",
    productivityRate: { min: 120, max: 240, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Signaling Engineer", count: 4 },
      { role: "Software Engineer", count: 3 },
      { role: "Test Engineer", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-TW-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["IEC 62280", "EN 50126", "RDSO CBTC Spec"],
    dsrRef: "DMRC Signaling Spec",
    safetyChecks: [
      "SIL 4 safety integrity level certification",
      "Fail-safe design verification",
      "Integration test with rolling stock",
    ],
    remarks: "CBTC (communications-based train control); headway 90 seconds at full automation; safety case to CMRS",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "signaling OEM (Alstom / Siemens / Thales / Hitachi)",
    leadTimeDays: 365,
  },
  {
    code: "MR-SY-03",
    phase: "systems_electromechanical",
    name: "Telecom system — SCADA, CCTV, PIS, radio",
    unit: "LS",
    productivityRate: { min: 90, max: 150, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Telecom Engineer", count: 3 },
      { role: "IT Engineer", count: 2 },
      { role: "CCTV Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "MR-SC-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["TEC Guidelines", "DMRC Telecom Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["OFC ring redundancy tested", "CCTV 30-day recording", "PIS display brightness verified"],
    remarks: "OFC backbone; tetra/GSM-R radio; passenger information (PIS); SCADA for power control; leaky cable in tunnel",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "metro telecom systems integrator",
  },
  {
    code: "MR-SY-04",
    phase: "systems_electromechanical",
    name: "Automatic fare collection (AFC) system",
    unit: "LS",
    productivityRate: { min: 60, max: 90, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "AFC Engineer", count: 2 },
      { role: "IT Engineer", count: 2 },
      { role: "Electrician", count: 3 },
    ],
    predecessors: [{ taskCode: "MR-SC-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["ISO 7501", "NCMC (National Common Mobility Card) Spec"],
    dsrRef: "DMRC AFC Spec",
    safetyChecks: ["NCMC card interoperability tested", "Fare collection accuracy >99.9%"],
    remarks: "Smart card + QR + UPI; ticket vending machines, passenger gates, add-value machines; NCMC compliance mandatory",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "AFC systems supplier",
    leadTimeDays: 240,
  },
  {
    code: "MR-SY-05",
    phase: "systems_electromechanical",
    name: "Escalator & lift installation (at all stations)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per unit" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "OEM Installation Team", count: 4 },
      { role: "Electrician", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-SC-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 14665 Part-I", "NBC 2016", "RPWD Act 2016"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Load test 25% overload", "Safety device test (overspeed governor)", "Lift inspection CEI"],
    remarks: "KONE / Otis / Schindler; speed 0.5 m/s for escalator; 1 m/s for lift; CMRS inspects all lifts",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "escalator / lift OEM (CEI-licensed)",
    leadTimeDays: 180,
  },
  {
    code: "MR-SY-06",
    phase: "systems_electromechanical",
    name: "Platform screen doors (PSD) installation",
    unit: "Each",
    productivityRate: { min: 3, max: 7, unit: "days per station set" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "PSD Engineer", count: 2 },
      { role: "Electrician", count: 3 },
      { role: "Installer", count: 4 },
    ],
    predecessors: [
      { taskCode: "MR-SC-03", type: "FS", lagDays: 0 },
      { taskCode: "MR-SY-02", type: "SS", lagDays: 0 },
    ],
    isCodeRef: ["EN 81-70", "DMRC PSD Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: [
      "Door alignment with train door ±20mm",
      "Emergency manual release tested",
      "Interface with ATP/ATO verified",
    ],
    remarks: "Full height PSD for underground; half height for elevated; must be interfaced with signaling before CMRS inspection",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "PSD OEM (Nabtesco / Faiveley / Stanley)",
    leadTimeDays: 240,
  },

  // =========================================================================
  // PHASE 7: DEPOT (MR-DP)
  // =========================================================================
  {
    code: "MR-DP-01",
    phase: "depot",
    name: "Depot civil works — maintenance shed, workshop, stabling yard",
    unit: "Sqm",
    productivityRate: { min: 40, max: 70, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 2 },
      { role: "Steel Erector", count: 8 },
      { role: "Mason", count: 6 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Tower crane", "Mobile crane 50T"],
    predecessors: [{ taskCode: "MR-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 800", "IS 1893", "NBC 2016"],
    dsrRef: "DMRC Depot Spec",
    safetyChecks: ["EOT crane (10T) load test", "Inspection pit depth and width verified"],
    remarks: "PEB shed; EOT crane; pit roads for under-bogie access; wash plant; car wash automated",
    isCore: true,
  },
  {
    code: "MR-DP-02",
    phase: "depot",
    name: "Depot maintenance equipment installation (wheel lathe, lifting jacks, test bench)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Rolling Stock Engineer", count: 1 },
      { role: "OEM Technician", count: 4 },
      { role: "Electrician", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-DP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["RDSO Rolling Stock Maintenance Manual"],
    dsrRef: "DMRC Depot Spec",
    safetyChecks: ["Wheel lathe foundation vibration isolation", "Underfloor wheel profile grinding test"],
    remarks: "Underfloor wheel lathe, synchronous lifting jacks (10T×8 per train), traction test bench, brake test",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "rolling stock maintenance equipment supplier",
    leadTimeDays: 365,
  },

  // =========================================================================
  // PHASE 8: TESTING & COMMISSIONING (MR-TC)
  // =========================================================================
  {
    code: "MR-TC-01",
    phase: "testing_commissioning",
    name: "Rolling stock delivery, testing & acceptance",
    unit: "Each",
    productivityRate: { min: 14, max: 21, unit: "days per train" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Rolling Stock Engineer", count: 3 },
      { role: "OEM Technician", count: 6 },
      { role: "Test Driver", count: 2 },
    ],
    predecessors: [
      { taskCode: "MR-TW-03", type: "FS", lagDays: 0 },
      { taskCode: "MR-SY-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IEC 61133", "RDSO Rolling Stock Spec"],
    dsrRef: "DMRC Rolling Stock Spec",
    safetyChecks: ["Dynamic gauging test", "Brake test at 80 km/h", "High voltage test"],
    remarks: "Trains arrive from manufacturer (BEML / Bombardier / CRRC / Alstom); 2–3 trains delivered per month",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "rolling stock OEM",
    leadTimeDays: 730,
  },
  {
    code: "MR-TC-02",
    phase: "testing_commissioning",
    name: "Track geometry survey (TGM) — full alignment",
    unit: "km",
    productivityRate: { min: 3, max: 6, unit: "km/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Track Engineer", count: 2 },
      { role: "TGM Operator", count: 2 },
    ],
    equipment: ["Track geometry measurement vehicle or portable TGM"],
    predecessors: [{ taskCode: "MR-TC-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["RDSO Track Manual", "IRS T-12"],
    dsrRef: "DMRC Track Spec",
    safetyChecks: ["TGM readings vs tolerances per speed profile", "Defects corrected before trial runs"],
    remarks: "Gauge, cross level, twist, alignment, longitudinal level — all measured; corrective tamping before speed increase",
    isCore: true,
  },
  {
    code: "MR-TC-03",
    phase: "testing_commissioning",
    name: "Integrated systems test (signaling + OHE + rolling stock + AFC)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Systems Integration Manager", count: 2 },
      { role: "Signaling Engineer", count: 3 },
      { role: "Rolling Stock Engineer", count: 2 },
      { role: "Power Engineer", count: 2 },
    ],
    predecessors: [
      { taskCode: "MR-TC-02", type: "FS", lagDays: 0 },
      { taskCode: "MR-SY-02", type: "FS", lagDays: 0 },
      { taskCode: "MR-SY-04", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["EN 50126", "IEC 61133", "DMRC IST Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: ["Emergency stop from each train position tested", "PSD-signaling interlock verified", "All failure modes tested"],
    remarks: "Critical path — all systems must be integrated before CMRS inspection; typically 30–60 days of testing",
    isCore: true,
  },
  {
    code: "MR-TC-04",
    phase: "testing_commissioning",
    name: "Trial runs — empty (speed escalation 40 → 80 km/h)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Operations Manager", count: 1 },
      { role: "Train Operator", count: 6 },
      { role: "Safety Officer", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-TC-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["CMRS Guidelines", "RDSO Rolling Stock Spec"],
    dsrRef: "DMRC Spec",
    safetyChecks: [
      "Speed certificate from CMRS at each stage",
      "Minimum 30 days × 20 trains/day trial before CMRS inspection",
    ],
    remarks: "Speed ramp: 40 → 60 → 80 km/h; CMRS must witness final 80 km/h speed trial; staff training alongside",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "MR-TC-05",
    phase: "testing_commissioning",
    name: "CMRS inspection & safety certificate grant",
    unit: "LS",
    productivityRate: { min: 14, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Project Director", count: 1 },
      { role: "Liaison Officer", count: 2 },
    ],
    predecessors: [{ taskCode: "MR-TC-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["Metro Railways (Construction of Works) Act", "CMRS Guidelines"],
    dsrRef: "",
    safetyChecks: ["All CMRS inspection deficiencies resolved", "Safety management system documented"],
    remarks: "CMRS = Commissioner of Metro Rail Safety (MoR appointee); mandatory before commercial operations; not time-bound",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "MR-TC-06",
    phase: "testing_commissioning",
    name: "Revenue service launch & staff readiness",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Operations Manager", count: 2 },
      { role: "Station Controller", count: 10 },
      { role: "Train Operator", count: 20 },
      { role: "Security Staff", count: 20 },
    ],
    predecessors: [{ taskCode: "MR-TC-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["Metro Railways (Operation & Maintenance) Act"],
    dsrRef: "",
    safetyChecks: ["Emergency drill before first revenue day", "All staff certified by DMRC/operator"],
    remarks: "Inauguration requires CM / PM presence — political scheduling can delay; soft launch with limited passengers",
    isCore: true,
  },
];

// ---------------------------------------------------------------------------
// METRO TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const METRO_TYPE_CONFIGS: Record<MetroType, MetroTypeConfig> = {
  metro_elevated: {
    type: "metro_elevated",
    label: "Elevated Metro",
    description: "Precast U-girder viaduct + at-grade or elevated stations; most Indian metro corridors",
    mandatoryTaskCodes: [
      "MR-SI-01", "MR-SI-02", "MR-SI-03", "MR-SI-04",
      "MR-FP-01", "MR-FP-02", "MR-FP-03",
      "MR-VD-01", "MR-VD-02", "MR-VD-03", "MR-VD-04", "MR-VD-05",
      "MR-SC-01", "MR-SC-02", "MR-SC-03", "MR-SC-04", "MR-SC-05",
      "MR-TW-01", "MR-TW-02", "MR-TW-03", "MR-TW-04",
      "MR-SY-01", "MR-SY-02", "MR-SY-03", "MR-SY-04", "MR-SY-05", "MR-SY-06",
      "MR-DP-01", "MR-DP-02",
      "MR-TC-01", "MR-TC-02", "MR-TC-03", "MR-TC-04", "MR-TC-05", "MR-TC-06",
    ],
    excludedTaskCodes: ["MR-UG-01", "MR-UG-02", "MR-UG-03"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 1.30,
    systemsComplexityFactor: 1.60,
  },
  metro_underground: {
    type: "metro_underground",
    label: "Underground Metro",
    description: "TBM or cut-and-cover tunnel; underground stations; complex urban environment",
    mandatoryTaskCodes: [
      "MR-SI-01", "MR-SI-02", "MR-SI-03", "MR-SI-04",
      "MR-FP-01",
      "MR-UG-01", "MR-UG-02", "MR-UG-03",
      "MR-SC-01", "MR-SC-02", "MR-SC-03", "MR-SC-04", "MR-SC-05",
      "MR-TW-01", "MR-TW-02", "MR-TW-03", "MR-TW-04",
      "MR-SY-01", "MR-SY-02", "MR-SY-03", "MR-SY-04", "MR-SY-05", "MR-SY-06",
      "MR-DP-01", "MR-DP-02",
      "MR-TC-01", "MR-TC-02", "MR-TC-03", "MR-TC-04", "MR-TC-05", "MR-TC-06",
    ],
    excludedTaskCodes: ["MR-FP-02", "MR-FP-03", "MR-VD-01", "MR-VD-02", "MR-VD-03", "MR-VD-04", "MR-VD-05"],
    additionalTaskCodes: [],
    structuralComplexityFactor: 2.00,
    systemsComplexityFactor: 1.80,
  },
};

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export const ALL_METRO_TASKS: MetroTaskTemplate[] = [...METRO_CORE_TASKS];

export function getMetroTasks(metroType: MetroType): MetroTaskTemplate[] {
  const config = METRO_TYPE_CONFIGS[metroType];
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet  = new Set(config.excludedTaskCodes);

  return ALL_METRO_TASKS.filter(t => {
    if (excludedSet.has(t.code)) return false;
    if (mandatorySet.has(t.code)) return true;
    if (t.applicableMetroTypes && !t.applicableMetroTypes.includes(metroType)) return false;
    if (t.excludedMetroTypes && t.excludedMetroTypes.includes(metroType)) return false;
    return t.isCore;
  });
}
