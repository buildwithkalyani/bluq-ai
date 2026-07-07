// =============================================================================
// BLUQ BUILDING TASK LIBRARY
// =============================================================================
// Source: NBC 2016, IS 456, IS 2911, CPWD DSR 2023, BIS Standards,
//         RERA Act 2016, NBC Fire Chapter, GRIHA/LEED norms
//
// Covers:
//   residential_highrise  — 10+ floor residential towers / apartments
//   commercial_office     — office buildings, IT parks, mixed-use
//   industrial_shed       — warehouses, factories, light industrial
//   hospital              — private/government hospitals, medical colleges
//   data_center           — Tier III/IV data centres
//   hotel                 — hotels, serviced apartments, resorts
//
// Key building constraints:
//   - Floor-by-floor superstructure cycle: formwork → rebars → pour → cure (7 days min)
//   - Tower crane mobilisation / demobilisation on critical path for high-rise
//   - Long-lead items: passenger lifts (180 days), HVAC chillers (90 days),
//     data-centre UPS/PDU (150 days), hospital medical gas plants (90 days)
//   - RERA commencement certificate must be obtained before marketing (residential)
//   - Monsoon: concrete curing requires shuttering extension — 1.3× duration adjustment
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

export type BuildingPhase =
  | "surveys_investigations"
  | "approvals_permits"
  | "site_preparation"
  | "substructure"
  | "superstructure"
  | "envelope"
  | "mep_services"
  | "finishing"
  | "external_works"
  | "commissioning_handover";

export type BuildingType =
  | "residential_highrise"
  | "commercial_office"
  | "industrial_shed"
  | "hospital"
  | "data_center"
  | "hotel";

export type BuildingUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos" | "No" | "Set" | "Days";

export interface BuildingTaskTemplate {
  code: string;
  phase: BuildingPhase;
  name: string;
  unit: BuildingUnit;
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
  applicableBuildingTypes?: BuildingType[];
  excludedBuildingTypes?: BuildingType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface BuildingTypeConfig {
  type: BuildingType;
  label: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
}

// ---------------------------------------------------------------------------
// BUILDING TASK DEFINITIONS
// ---------------------------------------------------------------------------

export const ALL_BUILDING_TASKS: BuildingTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (BL-SI)
  // =========================================================================
  {
    code: "BL-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey & soil investigation (bore logs, SPT, CBR)",
    unit: "LS",
    productivityRate: { min: 21, max: 45, unit: "Days" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Surveyor", count: 1 },
      { role: "Drilling Crew", count: 3 },
      { role: "Lab Technician", count: 1 },
    ],
    equipment: ["Rotary drilling rig", "SPT equipment", "Total station"],
    predecessors: [],
    isCodeRef: ["IS 1892", "IS 2131", "IS 2720"],
    dsrRef: "CPWD DSR Chapter 1",
    safetyChecks: ["Bore pits barricaded", "Adjacent structure monitoring if near excavation"],
    remarks: "Minimum 1 bore per 500 sqm plot area; at least 2 bore holes per block; depth = 2× estimated pile depth or 1.5× footing width, whichever is deeper",
    isCore: true,
  },
  {
    code: "BL-SI-02",
    phase: "surveys_investigations",
    name: "Architectural & structural design, drawing preparation",
    unit: "LS",
    productivityRate: { min: 45, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Architect", count: 2 },
      { role: "Structural Engineer", count: 2 },
      { role: "MEP Consultant", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016", "IS 456", "IS 13920"],
    dsrRef: "CPWD Design Standards",
    safetyChecks: ["Structural drawings signed by licensed structural engineer"],
    remarks: "All drawings must be signed and sealed by a registered architect/engineer; good-for-construction (GFC) set required before any structural work",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-SI-03",
    phase: "surveys_investigations",
    name: "RERA commencement certificate application & registration",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Legal / RERA Consultant", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-AP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["RERA Act 2016", "State RERA Rules"],
    dsrRef: "State RERA Portal",
    safetyChecks: [],
    remarks: "Required before marketing or selling any residential units; project plan, approval, land title, and promoter details required",
    isCore: false,
    applicableBuildingTypes: ["residential_highrise"],
  },

  // =========================================================================
  // PHASE 2: APPROVALS & PERMITS (BL-AP)
  // =========================================================================
  {
    code: "BL-AP-01",
    phase: "approvals_permits",
    name: "Building plan sanction from local authority (BDA / BMC / GHMC etc.)",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Liaison Officer", count: 1 },
      { role: "Architect", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016 Part 3", "UDCPR 2020 (Maharashtra)", "BDA Bye-laws"],
    dsrRef: "Local Authority Building Rules",
    safetyChecks: [],
    remarks: "Critical gate — no physical work on permanent structure until plan is sanctioned; OC cannot be obtained later without plan compliance",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-AP-02",
    phase: "approvals_permits",
    name: "Environmental Clearance (EC) from SEIAA / MoEF",
    unit: "LS",
    productivityRate: { min: 90, max: 180, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Environmental Consultant", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["EIA Notification 2006", "Coastal Regulation Zone (if applicable)"],
    dsrRef: "MoEF EIA Process",
    safetyChecks: [],
    remarks: "Mandatory for BUA > 20,000 sqm (Category B2); SEIAA approves within 105 days; public hearing required for Category B1",
    isCore: false,
    taskCategory: "A",
    leadTimeDays: 120,
  },
  {
    code: "BL-AP-03",
    phase: "approvals_permits",
    name: "Fire department NOC for construction (high-rise > 15m)",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Fire Safety Consultant", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-AP-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["NBC 2016 Part 4 — Fire & Life Safety"],
    dsrRef: "State Fire Services Act",
    safetyChecks: [],
    remarks: "Needed for buildings > 15m height or > 500 sqm per floor; fire escape routes, sprinkler zones, hydrant locations to be shown in plans",
    isCore: false,
    applicableBuildingTypes: ["residential_highrise", "commercial_office", "hospital", "hotel", "data_center"],
  },
  {
    code: "BL-AP-04",
    phase: "approvals_permits",
    name: "CGWA NoC for groundwater extraction / dewatering",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Liaison Officer", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-AP-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["CGWA Guidelines", "Water (Prevention & Control of Pollution) Act"],
    dsrRef: "CGWA Online Portal",
    safetyChecks: [],
    remarks: "Required when groundwater depth < 5m and basement excavation proposed; apply through CGWA portal",
    isCore: false,
  },

  // =========================================================================
  // PHASE 3: SITE PREPARATION (BL-PW)
  // =========================================================================
  {
    code: "BL-PW-01",
    phase: "site_preparation",
    name: "Site clearance, demolition of existing structures & debris removal",
    unit: "Sqm",
    productivityRate: { min: 500, max: 800, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "JCB / Excavator Operator", count: 2 },
      { role: "Unskilled Labour", count: 10 },
    ],
    equipment: ["JCB 3CX", "Tipper trucks", "Chain-link loader"],
    predecessors: [{ taskCode: "BL-AP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016", "Solid Waste Management Rules 2016"],
    dsrRef: "CPWD DSR 1.1",
    safetyChecks: ["Adjacent building protection plan", "Dust suppression by water sprinkler", "Traffic management for debris trucks"],
    remarks: "Demolition requires local authority permission and structural assessment for party wall; debris to approved landfill only",
    isCore: true,
  },
  {
    code: "BL-PW-02",
    phase: "site_preparation",
    name: "Compound wall, site hoarding & security cabin",
    unit: "Rmt",
    productivityRate: { min: 20, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Mason", count: 4 },
      { role: "Unskilled Labour", count: 6 },
    ],
    predecessors: [{ taskCode: "BL-PW-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["NBC 2016"],
    dsrRef: "CPWD DSR 4.0",
    safetyChecks: ["GI sheet hoarding 2.4m height on public facing sides", "Danger boards at every 10m"],
    remarks: "Compound wall required by most local bye-laws before starting piling / excavation; security cabin on site perimeter",
    isCore: true,
  },
  {
    code: "BL-PW-03",
    phase: "site_preparation",
    name: "Temporary power, water supply & site infrastructure",
    unit: "LS",
    productivityRate: { min: 7, max: 14, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Plumber", count: 2 },
      { role: "Electrician", count: 2 },
    ],
    predecessors: [{ taskCode: "BL-PW-01", type: "SS", lagDays: 2 }],
    isCodeRef: [],
    dsrRef: "CPWD DSR",
    safetyChecks: ["Temporary earthing for all electrical connections", "Overhead HT cable clearance (min 3m) from scaffold"],
    remarks: "DG set required; temporary HT connection from DISCOM takes 15-30 days — apply simultaneously with plan sanction",
    isCore: true,
  },
  {
    code: "BL-PW-04",
    phase: "site_preparation",
    name: "Tower crane erection & testing (for high-rise)",
    unit: "Nos",
    productivityRate: { min: 5, max: 10, unit: "Days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Crane Erection Crew", count: 6 },
      { role: "Structural Engineer", count: 1 },
    ],
    equipment: ["Mobile crane for erection", "Tower crane"],
    predecessors: [{ taskCode: "BL-PW-03", type: "SS", lagDays: 3 }],
    isCodeRef: ["IS 15419 (Tower Cranes)", "Factory Act / BOCW Act"],
    dsrRef: "CPWD Tower Crane Specification",
    safetyChecks: ["Third-party load test certificate before use", "Climber engineer signed off", "Radius clearance from site boundary"],
    remarks: "Tower crane is critical path — set up before first slab pour; typically 1 crane per block for towers up to 30 floors",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "authorised crane erection agency",
    applicableBuildingTypes: ["residential_highrise", "commercial_office", "hotel"],
  },

  // =========================================================================
  // PHASE 4: SUBSTRUCTURE (BL-EX, BL-BM)
  // =========================================================================
  {
    code: "BL-EX-01",
    phase: "substructure",
    name: "Bulk excavation & dewatering",
    unit: "Cum",
    productivityRate: { min: 200, max: 400, unit: "Cum/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Excavator Operator", count: 2 },
      { role: "Tractor Driver", count: 4 },
      { role: "Unskilled Labour", count: 6 },
    ],
    equipment: ["Excavator 20T", "Tipper trucks (10T)", "Dewatering pump 100mm dia"],
    predecessors: [
      { taskCode: "BL-AP-01", type: "FS", lagDays: 0 },
      { taskCode: "BL-PW-01", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 3764 (Excavation Safety)", "NBC 2016"],
    dsrRef: "CPWD DSR 2.1",
    safetyChecks: ["Shore/strut system for excavation > 1.5m", "Adjacent foundation protection plan", "Dewatering sumps at corners"],
    remarks: "Soft / loose soil: sheeting and strutting required; hard rock: hydraulic breaker or blasting (with DGMS permit); dewatering pump capacity must exceed 150% of seepage inflow",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-EX-02",
    phase: "substructure",
    name: "Bored cast-in-situ pile foundation (600–1000mm dia)",
    unit: "Rmt",
    productivityRate: { min: 8, max: 15, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Piling Engineer", count: 1 },
      { role: "Piling Rig Operator", count: 1 },
      { role: "Concrete Gang", count: 4 },
      { role: "Steel Fabricator", count: 3 },
    ],
    equipment: ["Hydraulic rotary piling rig", "Bentonite mixing unit", "Tremie pipe"],
    predecessors: [{ taskCode: "BL-AP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2911 Part 1 Sec 2", "IS 456"],
    dsrRef: "CPWD DSR Pile Foundation",
    safetyChecks: ["Trial pile with load test before production piling", "Bentonite pit fenced", "Slurry disposal plan"],
    remarks: "Trial pile and load test (preliminary + routine) mandatory per IS 2911; allow 28 days curing before load test; production piling can start post preliminary test",
    isCore: false,
    taskCategory: "A",
  },
  {
    code: "BL-EX-03",
    phase: "substructure",
    name: "Pile cap, grade beams & plinth beam",
    unit: "Cum",
    productivityRate: { min: 8, max: 15, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Formwork Carpenter", count: 4 },
      { role: "Steel Fabricator", count: 4 },
      { role: "Concrete Crew", count: 6 },
    ],
    equipment: ["Concrete pump / transit mixer", "Bar-bending machine"],
    predecessors: [{ taskCode: "BL-EX-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "CPWD DSR 3.0",
    safetyChecks: ["Lean concrete blinding before pile cap formwork", "Earth retention for trench depth > 1.5m"],
    remarks: "Pile cap shuttering must be watertight for waterproofing coat; back-fill compacted in 150mm layers after waterproofing is cured",
    isCore: false,
  },
  {
    code: "BL-EX-04",
    phase: "substructure",
    name: "Raft foundation (mat slab)",
    unit: "Sqm",
    productivityRate: { min: 100, max: 150, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Formwork Carpenter", count: 6 },
      { role: "Steel Fabricator", count: 8 },
      { role: "Concrete Pump Operator", count: 2 },
    ],
    equipment: ["Concrete pump (boom placer)", "Transit mixer", "Poker vibrator"],
    predecessors: [{ taskCode: "BL-EX-01", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "CPWD DSR 3.0",
    safetyChecks: ["Mass concrete pour plan — temperature monitoring", "Anti-washout admixture in high groundwater", "Curing compound spray immediately after pour"],
    remarks: "Mass concrete pours > 1m thick need thermal gradient control; consider 50% GGBS or fly ash replacement; 72hr temperature monitoring via embedded sensors",
    isCore: false,
  },
  {
    code: "BL-EX-05",
    phase: "substructure",
    name: "Isolated / combined footings",
    unit: "Cum",
    productivityRate: { min: 8, max: 12, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Formwork Carpenter", count: 4 },
      { role: "Steel Fabricator", count: 4 },
      { role: "Concrete Crew", count: 5 },
    ],
    equipment: ["Concrete mixer or transit mixer", "Bar bending machine"],
    predecessors: [{ taskCode: "BL-EX-01", type: "FS", lagDays: 2 }],
    isCodeRef: ["IS 456", "IS 13920"],
    dsrRef: "CPWD DSR 3.0",
    safetyChecks: ["Lean concrete PCC 100mm below footing", "Dewatering sumps adjacent to excavation pits"],
    remarks: "Suitable for low-rise structures on medium-to-hard soils; bearing capacity confirmation by geotechnical engineer required",
    isCore: false,
    excludedBuildingTypes: ["residential_highrise"],
  },
  {
    code: "BL-BM-01",
    phase: "substructure",
    name: "Basement retaining walls & basement floor slab",
    unit: "Sqm",
    productivityRate: { min: 40, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Formwork Carpenter", count: 6 },
      { role: "Steel Fabricator", count: 6 },
      { role: "Concrete Pump Operator", count: 2 },
    ],
    equipment: ["Concrete pump", "Climbing/jump formwork for deep basement"],
    predecessors: [{ taskCode: "BL-EX-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 456", "IS 3370 Part II (Retaining Walls)"],
    dsrRef: "CPWD DSR 3.0",
    safetyChecks: ["Strut the excavation before starting retaining wall", "Adjacent structures settlement monitoring"],
    remarks: "Multi-level basement: each level retaining wall is predecessor to level above; prop and strut must remain in place until adequate curing",
    isCore: false,
    taskCategory: "A",
  },
  {
    code: "BL-BM-02",
    phase: "substructure",
    name: "Basement waterproofing — negative/positive side (crystalline + bituminous membrane)",
    unit: "Sqm",
    productivityRate: { min: 80, max: 120, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Waterproofing Specialist", count: 3 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-BM-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 3384 (Bitumen for waterproofing)"],
    dsrRef: "CPWD DSR 8.0",
    safetyChecks: ["Curing of substrate: min 28 days before membrane", "Flood test after application (24hr)"],
    remarks: "Critical — basement waterproofing failure is irreversible; use 3mm SBS bituminous membrane + crystalline admixture in concrete; protective screed immediately after membrane",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "approved waterproofing applicator (BASF / Sika / Fosroc empanelled)",
  },

  // =========================================================================
  // PHASE 5: SUPERSTRUCTURE (BL-ST) — LINEAR phase (per floor cluster / block)
  // =========================================================================
  {
    code: "BL-ST-01",
    phase: "superstructure",
    name: "Columns, shear walls & core walls (RCC)",
    unit: "Cum",
    productivityRate: { min: 10, max: 15, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Formwork Carpenter", count: 6 },
      { role: "Steel Fabricator / Binder", count: 6 },
      { role: "Concrete Pump Operator", count: 1 },
      { role: "Concrete Gang", count: 4 },
    ],
    equipment: ["Column / wall formwork (Mivan or conventional)", "Concrete pump", "Poker vibrator"],
    predecessors: [
      { taskCode: "BL-EX-03", type: "FS", lagDays: 7 },
      { taskCode: "BL-EX-04", type: "FS", lagDays: 7 },
      { taskCode: "BL-BM-01", type: "FS", lagDays: 7 },
    ],
    isCodeRef: ["IS 456", "IS 13920", "IS 10262"],
    dsrRef: "CPWD DSR 4.1",
    safetyChecks: ["Column starter bars inspected before formwork", "Concrete cube samples: 3 per 50 m³", "No concreting in heavy rain"],
    remarks: "Mivan aluminium formwork enables 4-day floor cycle; conventional formwork 7-10 day cycle; vertical elements (columns/shear walls) are predecessor to horizontal slab",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-ST-02",
    phase: "superstructure",
    name: "Beam & slab formwork, rebar & concrete (typical floor)",
    unit: "Sqm",
    productivityRate: { min: 150, max: 250, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Formwork Carpenter", count: 8 },
      { role: "Steel Fabricator / Binder", count: 8 },
      { role: "Concrete Pump Operator", count: 2 },
      { role: "Concrete Gang", count: 6 },
    ],
    equipment: ["Slab formwork (props + plywood / Mivan)", "Boom placer / concrete pump", "Poker vibrator ×4", "Transit mixer"],
    predecessors: [{ taskCode: "BL-ST-01", type: "FS", lagDays: 1 }],
    isCodeRef: ["IS 456", "IS 13920", "IS 10262"],
    dsrRef: "CPWD DSR 4.2",
    safetyChecks: ["Propping of lower floors during construction (IS 456 Cl. 14.2.3)", "Cube testing: 3 per 50 m³ pour", "Concrete cover blocks at all reinforcement"],
    remarks: "Each floor slab requires minimum 7 days curing before loading / stripping; critical path — no MEP or masonry on a floor until slab above is poured and cured",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-ST-03",
    phase: "superstructure",
    name: "Staircase, landing & utility core walls (RCC)",
    unit: "Cum",
    productivityRate: { min: 5, max: 10, unit: "Cum/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Formwork Carpenter", count: 4 },
      { role: "Steel Fabricator", count: 4 },
      { role: "Concrete Gang", count: 3 },
    ],
    equipment: ["Staircase formwork", "Concrete mixer or pump"],
    predecessors: [{ taskCode: "BL-ST-02", type: "SS", lagDays: 5 }],
    isCodeRef: ["NBC 2016 (staircase dimensions)", "IS 456"],
    dsrRef: "CPWD DSR 4.2",
    safetyChecks: ["Temporary stair access to each floor as construction progresses", "Safety nets at staircase openings"],
    remarks: "Staircase formwork can run in parallel with slab once structural drawings are issued; do not close staircase opening until final flight cast",
    isCore: true,
  },
  {
    code: "BL-ST-04",
    phase: "superstructure",
    name: "Precast wall panel & column erection (for precast structures)",
    unit: "Sqm",
    productivityRate: { min: 250, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Precast Erection Engineer", count: 1 },
      { role: "Rigger", count: 2 },
      { role: "Tower Crane Operator", count: 1 },
      { role: "Connection Crew", count: 4 },
    ],
    equipment: ["Tower crane / mobile crane", "Precast lifting fixtures", "Grouting equipment"],
    predecessors: [{ taskCode: "BL-EX-03", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 15916 (Precast Concrete)", "IS 456"],
    dsrRef: "CPWD Precast Specification",
    safetyChecks: ["Precast elements inspected for cracks before erection", "Erection sequence engineer-approved", "Temporary bracing immediately after erection"],
    remarks: "Precast factory lead time is 60-90 days; structural connections (grout/weld) must achieve minimum 75% strength before loading next floor",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "precast manufacturer and certified erection crew",
  },

  // =========================================================================
  // PHASE 6: ENVELOPE (BL-EV)
  // =========================================================================
  {
    code: "BL-EV-01",
    phase: "envelope",
    name: "External brick / AAC block masonry (infill walls)",
    unit: "Sqm",
    productivityRate: { min: 60, max: 80, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Mason", count: 6 },
      { role: "Helper", count: 6 },
    ],
    equipment: ["Scaffolding (cup-lock / ringlock)", "Mortar mixer"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1905 (Masonry)", "IS 3696 (Scaffolding safety)"],
    dsrRef: "CPWD DSR 5.0",
    safetyChecks: ["External scaffolding load tested before use", "Full-body harness for scaffold above 4m", "Brick/block dropped from height protected by toe boards"],
    remarks: "AAC block preferred over red brick for thermal performance (NBC 2016 ECBC compliance); all external masonry complete before external plaster",
    isCore: true,
  },
  {
    code: "BL-EV-02",
    phase: "envelope",
    name: "External cement plaster (2-coat: scratch coat + finish coat)",
    unit: "Sqm",
    productivityRate: { min: 100, max: 150, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Plasterer", count: 6 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Plastering machine (optional)", "Scaffolding"],
    predecessors: [{ taskCode: "BL-EV-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1661", "NBC 2016"],
    dsrRef: "CPWD DSR 7.0",
    safetyChecks: ["Scaffolding certified before plastering", "Curing of masonry for 7 days before plaster"],
    remarks: "External plaster must be complete and cured 14 days before external paint; monsoon pauses plastering unless temporary protection provided",
    isCore: true,
  },
  {
    code: "BL-EV-03",
    phase: "envelope",
    name: "Curtain wall / glass facade / ACP cladding system",
    unit: "Sqm",
    productivityRate: { min: 30, max: 50, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Facade Engineer", count: 1 },
      { role: "Aluminium Fabricator", count: 6 },
      { role: "Rigger / Rope Access", count: 4 },
    ],
    equipment: ["Gondola / bosun chair / cradle", "Silicone dispensing gun", "Suction cup lifter"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 14900 (Glass)", "CWCT TN69 (Curtain Wall)"],
    dsrRef: "Specialist Contractor Spec",
    safetyChecks: ["Gondola inspected daily before use", "Rope access workers certified (IRATA level 2)", "Wind speed monitoring (stop if > 50 km/h)"],
    remarks: "Curtain wall anchor system designed by facade engineer and approved by structural engineer; mock-up panel required before bulk fabrication",
    isCore: false,
    requiresSpecialistContractor: true,
    specialistType: "specialist facade contractor (RIBA / CWCT accredited)",
    applicableBuildingTypes: ["commercial_office", "hotel", "data_center"],
    leadTimeDays: 90,
  },
  {
    code: "BL-EV-04",
    phase: "envelope",
    name: "Aluminium windows, glazing & sliding / casement units",
    unit: "Sqm",
    productivityRate: { min: 30, max: 50, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Aluminium Fabricator", count: 4 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Scaffolding / gondola", "Silicon gun", "Drill"],
    predecessors: [{ taskCode: "BL-EV-01", type: "FS", lagDays: 3 }],
    isCodeRef: ["IS 1948 (Aluminium windows)", "IS 14900"],
    dsrRef: "CPWD DSR 9.0",
    safetyChecks: ["Glass handling: vacuum suction cups mandatory", "Broken glass disposal protocol"],
    remarks: "Fix openings in masonry accurately — poor tolerances cause window leaks; allow 3 days masonry cure after lintel before fixing frame",
    isCore: true,
  },
  {
    code: "BL-EV-05",
    phase: "envelope",
    name: "Terrace waterproofing & parapet cap",
    unit: "Sqm",
    productivityRate: { min: 80, max: 120, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Waterproofing Specialist", count: 3 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 21 }],
    isCodeRef: ["IS 3384", "NBC 2016"],
    dsrRef: "CPWD DSR 8.0",
    safetyChecks: ["Flood test 24 hours before final inspection", "Drain outlets clear before flood test"],
    remarks: "Terrace waterproofing is a defect-prone area — IWF + APP membrane + drainage layer + protection screed; guarantee of 10 years minimum required",
    isCore: true,
  },

  // =========================================================================
  // PHASE 7: MEP SERVICES (BL-ME)
  // =========================================================================
  {
    code: "BL-ME-01",
    phase: "mep_services",
    name: "Electrical — conduit, wiring, DB, LT panel & external power supply",
    unit: "Sqm",
    productivityRate: { min: 150, max: 200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Electrical Engineer", count: 2 },
      { role: "Licensed Electrician", count: 6 },
      { role: "Helper", count: 6 },
    ],
    equipment: ["Cable drum stands", "Conduit bending machine", "Cable pulling machine"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 732", "NBC 2016 Part 8", "CEA Regulations 2010"],
    dsrRef: "CPWD DSR 10.0",
    safetyChecks: ["Only licensed electricians for HT/LT panel work", "Energisation requires CEI inspection", "LOTO during live line work"],
    remarks: "Conduit laying in slabs must be done before concrete pour (coordination with structural); dedicated power connections for lifts and HVAC",
    isCore: true,
  },
  {
    code: "BL-ME-02",
    phase: "mep_services",
    name: "Plumbing, sanitary, drainage & water supply piping",
    unit: "Rmt",
    productivityRate: { min: 40, max: 60, unit: "Rmt/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Plumbing Engineer", count: 1 },
      { role: "Plumber", count: 6 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Pipe threading machine", "Pipe testing pump"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 4985 (UPVC pipes)", "NBC 2016 Part 9", "Manual on Water Supply — CPHEEO"],
    dsrRef: "CPWD DSR 11.0",
    safetyChecks: ["Hydraulic pressure test at 1.5× working pressure", "Sleeve protection at slab penetrations"],
    remarks: "SHI (sanitary hardware installation) is last activity on a floor before OC inspection; concealed piping must be tested before walls are closed",
    isCore: true,
  },
  {
    code: "BL-ME-03",
    phase: "mep_services",
    name: "HVAC — AHU, ducting, chiller plant & cooling tower",
    unit: "Sqm",
    productivityRate: { min: 80, max: 120, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "HVAC Engineer", count: 2 },
      { role: "Sheet Metal Fabricator", count: 6 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Ducting fabrication machine", "Refrigerant charging unit", "Crane for chiller placement"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["NBC 2016 Part 8 Section 3", "ASHRAE 90.1", "ECBC 2017"],
    dsrRef: "CPWD DSR 12.0",
    safetyChecks: ["Pressure test ducts before ceiling closure", "Refrigerant handling by certified technician (FGAS)"],
    remarks: "Chiller long lead time 90 days; ducting coordination with electrical/plumbing critical to prevent clashes; BIM clash detection recommended",
    isCore: false,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "authorised HVAC contractor",
    applicableBuildingTypes: ["commercial_office", "hospital", "data_center", "hotel"],
  },
  {
    code: "BL-ME-04",
    phase: "mep_services",
    name: "Fire detection, alarm, fire hydrant & sprinkler system",
    unit: "Sqm",
    productivityRate: { min: 100, max: 150, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Fire Fighting Engineer", count: 1 },
      { role: "Fire Piping Crew", count: 4 },
      { role: "Detection Technician", count: 3 },
    ],
    equipment: ["Pipe threading machine", "Hydrostatic test pump", "Fire detection tools"],
    predecessors: [{ taskCode: "BL-ME-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["NBC 2016 Part 4", "NFPA 13 (Sprinklers)", "IS 2189 (Fire Detection)"],
    dsrRef: "CPWD DSR 13.0",
    safetyChecks: ["Sprinkler head clearance from obstructions (min 450mm)", "Hydraulic calculation submitted to fire dept"],
    remarks: "Fire NOC from state fire department is mandatory for OC; final inspection by fire dept includes wet run test of sprinkler system",
    isCore: true,
  },
  {
    code: "BL-ME-05",
    phase: "mep_services",
    name: "Passenger lift & service elevator installation",
    unit: "Nos",
    productivityRate: { min: 45, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Elevator Engineer (OEM)", count: 2 },
      { role: "Helper", count: 2 },
    ],
    equipment: ["Overhead beam hoist for car assembly"],
    predecessors: [{ taskCode: "BL-ST-02", type: "FS", lagDays: 21 }],
    isCodeRef: ["IS 14665 (Electric Traction Lifts)", "NBC 2016 Part 8 Section 5"],
    dsrRef: "CPWD DSR Lift Specification",
    safetyChecks: ["Lift shaft clear of debris before installation", "Pit dewatering before machine room installation"],
    remarks: "Import lift: 180 days lead time; Indian make: 90-120 days; lift pit and machine room must be structurally complete before OEM mobilises; CEI inspection mandatory",
    isCore: false,
    taskCategory: "A",
    leadTimeDays: 120,
    requiresSpecialistContractor: true,
    specialistType: "OEM authorized elevator installer",
  },
  {
    code: "BL-ME-06",
    phase: "mep_services",
    name: "DG sets, LT substation, UPS & earthing",
    unit: "LS",
    productivityRate: { min: 21, max: 45, unit: "Days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 4 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Crane for transformer placement", "Testing instruments"],
    predecessors: [{ taskCode: "BL-ME-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["CEA Regulations 2010", "IS 3043 (Earthing)"],
    dsrRef: "CPWD DSR 10.0",
    safetyChecks: ["HT room access restricted to licensed personnel", "Earth electrode testing before energisation"],
    remarks: "HT/LT substation requires DISCOM approval and CEI inspection before energisation; DG sets require SPCB consent for air emission",
    isCore: true,
  },

  // =========================================================================
  // PHASE 8: FINISHING (BL-FF)
  // =========================================================================
  {
    code: "BL-FF-01",
    phase: "finishing",
    name: "Internal cement plaster (walls & soffits)",
    unit: "Sqm",
    productivityRate: { min: 150, max: 200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Plasterer", count: 8 },
      { role: "Helper", count: 6 },
    ],
    predecessors: [{ taskCode: "BL-EV-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1661"],
    dsrRef: "CPWD DSR 7.0",
    safetyChecks: ["Masonry cube test results available before plastering commences"],
    remarks: "Plaster in bathrooms must be complete and cured 14 days before wall tile work; never plaster over fresh masonry (< 7 days)",
    isCore: true,
  },
  {
    code: "BL-FF-02",
    phase: "finishing",
    name: "Floor tiles, marble / granite or screed finish",
    unit: "Sqm",
    productivityRate: { min: 80, max: 120, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Tile Layer / Marble Polisher", count: 6 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-FF-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 1237 (Floor tiles)", "IS 3622 (Marble)"],
    dsrRef: "CPWD DSR 7.3",
    safetyChecks: ["Diamond blade wet cutting only (dust control)", "Grouting complete and cleaned before OC inspection"],
    remarks: "Grouting compound must be same shade as tile; anti-skid tiles mandatory in bathrooms and external pathways",
    isCore: true,
  },
  {
    code: "BL-FF-03",
    phase: "finishing",
    name: "Doors, door frames, hardware & ironmongery",
    unit: "Nos",
    productivityRate: { min: 8, max: 12, unit: "Nos/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Carpenter", count: 4 },
      { role: "Helper", count: 2 },
    ],
    predecessors: [{ taskCode: "BL-FF-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 4021 (Wooden doors)", "NBC 2016"],
    dsrRef: "CPWD DSR 9.0",
    safetyChecks: ["Fire-rated doors with correct fire rating certifications"],
    remarks: "Fire-rated doors at staircase, lobby, and electrical room — FRL certificate from CBRI/NABL lab mandatory",
    isCore: true,
  },
  {
    code: "BL-FF-04",
    phase: "finishing",
    name: "Internal painting (putty + primer + 2-coat emulsion)",
    unit: "Sqm",
    productivityRate: { min: 300, max: 500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Painter", count: 8 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-FF-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 5411 (Acrylic Emulsion)"],
    dsrRef: "CPWD DSR 15.0",
    safetyChecks: ["VOC-compliant paints in confined spaces", "Adequate ventilation during painting"],
    remarks: "Putty 2 coats → primer → finish coat; allow 24hr between coats; final coat must be within 30 days before handover",
    isCore: true,
  },
  {
    code: "BL-FF-05",
    phase: "finishing",
    name: "False ceiling (gypsum board / metal / acoustic tile) & partitions",
    unit: "Sqm",
    productivityRate: { min: 60, max: 100, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "False Ceiling Installer", count: 6 },
      { role: "Helper", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-ME-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 2095 Part 1 (Gypsum plaster)"],
    dsrRef: "CPWD DSR 16.0",
    safetyChecks: ["Coordinate with mechanical / electrical for penetrations before sealing", "Fire-rated ceiling at staircase lobbies"],
    remarks: "False ceiling installed after all above-ceiling services (electrical, mechanical, IT cabling) are complete and tested; access panels at AHU and valve locations",
    isCore: false,
    applicableBuildingTypes: ["commercial_office", "hospital", "hotel", "data_center"],
  },
  {
    code: "BL-FF-06",
    phase: "finishing",
    name: "External texture paint / stone cladding / EIFS",
    unit: "Sqm",
    productivityRate: { min: 100, max: 150, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Painter / Cladding Crew", count: 6 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["External scaffolding / gondola"],
    predecessors: [{ taskCode: "BL-EV-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 5411", "NBC 2016"],
    dsrRef: "CPWD DSR 15.0",
    safetyChecks: ["Wind speed monitoring before gondola operation", "All peripheral scaffold boards toed and railed"],
    remarks: "External paint applied after external plaster is cured and external scaffold dismantled; no painting in rain or < 8°C temperature",
    isCore: true,
  },

  // =========================================================================
  // PHASE 9: EXTERNAL WORKS (BL-XW)
  // =========================================================================
  {
    code: "BL-XW-01",
    phase: "external_works",
    name: "Compound road, vehicular pathways & parking paving",
    unit: "Sqm",
    productivityRate: { min: 200, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Supervisor", count: 1 },
      { role: "JCB Operator", count: 1 },
      { role: "Compaction Crew", count: 4 },
      { role: "Concrete / Paving Crew", count: 6 },
    ],
    equipment: ["Plate compactor / roller", "Paving machine or screed"],
    predecessors: [{ taskCode: "BL-EV-01", type: "FS", lagDays: 30 }],
    isCodeRef: ["NBC 2016", "IS 457 (Pavement design)"],
    dsrRef: "CPWD DSR 2.0",
    safetyChecks: ["Subgrade CBR tested before pavement layers", "Drainage gradients confirmed (1 in 50 minimum)"],
    remarks: "External works are last activity — do after all heavy vehicle movements complete; precast compound paving blocks preferred for easy utility access",
    isCore: true,
  },
  {
    code: "BL-XW-02",
    phase: "external_works",
    name: "Landscaping, horticulture & external site furniture",
    unit: "Sqm",
    productivityRate: { min: 200, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Landscape Architect", count: 1 },
      { role: "Horticulturist", count: 2 },
      { role: "Helper", count: 6 },
    ],
    predecessors: [{ taskCode: "BL-XW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["GRIHA Rating requirements"],
    dsrRef: "CPWD Horticulture Spec",
    safetyChecks: [],
    remarks: "Monsoon season (June–Sept) is best time for transplanting; minimum green cover per GRIHA/LEED requirements; irrigation system installed before planting",
    isCore: true,
  },
  {
    code: "BL-XW-03",
    phase: "external_works",
    name: "STP / ETP for treated water reuse (if required by RERA / municipal)",
    unit: "LS",
    productivityRate: { min: 60, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Environmental Engineer", count: 1 },
      { role: "Civil Crew", count: 4 },
      { role: "MEP Crew", count: 3 },
    ],
    predecessors: [{ taskCode: "BL-PW-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoEF/SPCB effluent standards", "NBC 2016 Part 9 Sec 5"],
    dsrRef: "CPWD STP Specification",
    safetyChecks: ["Confined space permit for tank entry", "SPCB Consent to Operate before commissioning"],
    remarks: "STP mandatory for all new buildings > 20 units or > 500 sqm (many state rules); must be commissioned and operational before OC",
    isCore: false,
  },
  {
    code: "BL-XW-04",
    phase: "external_works",
    name: "Rainwater harvesting, stormwater drainage & external sewer connection",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Plumbing Supervisor", count: 1 },
      { role: "Civil Crew", count: 4 },
    ],
    predecessors: [{ taskCode: "BL-XW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["BIS 15797 (RWH)", "Municipal drainage byelaws"],
    dsrRef: "CPWD DSR 11.0",
    safetyChecks: ["Flow test of drainage before sealing"],
    remarks: "Rainwater harvesting pits mandatory in most states for plots > 300 sqm; connected to groundwater recharge or storage tank; test flow at design storm (30mm/hr)",
    isCore: true,
  },

  // =========================================================================
  // PHASE 10: COMMISSIONING & HANDOVER (BL-CH)
  // =========================================================================
  {
    code: "BL-CH-01",
    phase: "commissioning_handover",
    name: "Fire department final inspection & NOC",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Fire Safety Consultant", count: 1 },
      { role: "Fire Fighting Engineer", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-ME-04", type: "FS", lagDays: 7 }],
    isCodeRef: ["NBC 2016 Part 4", "State Fire Prevention Act"],
    dsrRef: "State Fire Department Procedure",
    safetyChecks: [],
    remarks: "Fire dept inspects: hydrant pressure test, sprinkler zone test, fire alarm panel, PA system, exit signage, emergency lighting; apply min 30 days before target OC",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-CH-02",
    phase: "commissioning_handover",
    name: "Lift inspection & completion certificate by Chief Electrical Inspector (CEI)",
    unit: "Nos",
    productivityRate: { min: 14, max: 21, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Elevator OEM Engineer", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-ME-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 14665", "Lifts & Escalators Act (state)"],
    dsrRef: "CEI Inspection Procedure",
    safetyChecks: [],
    remarks: "CEI inspection includes: overload test, drop test, speed governor test, emergency lowering; annual renewal required after commissioning",
    isCore: false,
    taskCategory: "A",
  },
  {
    code: "BL-CH-03",
    phase: "commissioning_handover",
    name: "Occupancy Certificate (OC) / Building Completion Certificate from local authority",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Architect", count: 1 },
      { role: "Liaison Officer", count: 1 },
    ],
    predecessors: [
      { taskCode: "BL-CH-01", type: "FS", lagDays: 0 },
      { taskCode: "BL-FF-04", type: "FS", lagDays: 7 },
    ],
    isCodeRef: ["NBC 2016", "Local Authority Building Rules"],
    dsrRef: "Local Authority OC Procedure",
    safetyChecks: [],
    remarks: "OC required before legal occupation; local authority inspects: setbacks, height, parking, fire NOC, lift certificate, STP operation; plinth area must match sanctioned plan",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "BL-CH-04",
    phase: "commissioning_handover",
    name: "RERA completion certificate & conveyance deed execution",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.00,
    crew: [
      { role: "Legal / RERA Consultant", count: 1 },
    ],
    predecessors: [{ taskCode: "BL-CH-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["RERA Act 2016", "State RERA Rules"],
    dsrRef: "State RERA Portal",
    safetyChecks: [],
    remarks: "RERA completion certificate based on OC; conveyance/possession of individual units requires this; penalty for delay under RERA",
    isCore: false,
    applicableBuildingTypes: ["residential_highrise"],
  },
];

// ---------------------------------------------------------------------------
// CONFIG PER BUILDING TYPE
// ---------------------------------------------------------------------------

const BUILDING_TYPE_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  residential_highrise: {
    type: "residential_highrise",
    label: "Residential High-Rise (10+ floors)",
    mandatoryTaskCodes: ["BL-SI-03", "BL-CH-04"],
    excludedTaskCodes: ["BL-FF-05", "BL-EV-03"],
  },
  commercial_office: {
    type: "commercial_office",
    label: "Commercial Office / IT Park",
    mandatoryTaskCodes: ["BL-ME-03", "BL-FF-05", "BL-EV-03"],
    excludedTaskCodes: ["BL-SI-03", "BL-CH-04"],
  },
  industrial_shed: {
    type: "industrial_shed",
    label: "Industrial Shed / Warehouse / Factory",
    mandatoryTaskCodes: [],
    excludedTaskCodes: ["BL-BM-01", "BL-BM-02", "BL-PW-04", "BL-ME-03", "BL-FF-05", "BL-EV-03", "BL-SI-03", "BL-CH-04"],
  },
  hospital: {
    type: "hospital",
    label: "Hospital / Healthcare Facility",
    mandatoryTaskCodes: ["BL-ME-03", "BL-ME-04", "BL-FF-05"],
    excludedTaskCodes: ["BL-SI-03", "BL-CH-04"],
  },
  data_center: {
    type: "data_center",
    label: "Data Centre (Tier III/IV)",
    mandatoryTaskCodes: ["BL-ME-03", "BL-ME-06"],
    excludedTaskCodes: ["BL-ST-04", "BL-SI-03", "BL-CH-04"],
  },
  hotel: {
    type: "hotel",
    label: "Hotel / Serviced Apartments",
    mandatoryTaskCodes: ["BL-ME-03", "BL-ME-05", "BL-FF-05", "BL-EV-03"],
    excludedTaskCodes: ["BL-SI-03", "BL-CH-04"],
  },
};

// ---------------------------------------------------------------------------
// ACCESSOR
// ---------------------------------------------------------------------------

export function getBuildingTasks(buildingType: BuildingType): BuildingTaskTemplate[] {
  return ALL_BUILDING_TASKS;
}

export function getBuildingTypeConfig(buildingType: BuildingType): BuildingTypeConfig {
  return BUILDING_TYPE_CONFIGS[buildingType];
}
