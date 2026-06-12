// =============================================================================
// BLUQ AIRPORT TASK LIBRARY
// =============================================================================
// Source: DGCA CAR Section 3, AAI Specifications, ICAO Annex 14,
//         MoCA Guidelines, IRC SP-81, FAA AC 150 series (reference only)
//
// Covers:
//   airport_greenfield   — New airport from scratch (ICAO Code 3C / 4E / 4F)
//   airport_expansion    — Additional runway, terminal expansion, apron extension
//
// Key airport constraints not in building library:
//   - DGCA approval chain (AAI/MoCA/DGCA) is the critical path, not construction
//   - ILS calibration flight required before commissioning
//   - Obstacle limitation surfaces (OLS) — nothing can be built above OLS without exemption
//   - Pavement design for aircraft wheel loads (PCN/ACN system)
//   - No-fly zone coordination during construction crane operations
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type AirportPhase =
  | "surveys_investigations"
  | "earthworks_grading"
  | "runway_taxiway_pavement"
  | "drainage"
  | "terminal_building"
  | "atc_facilities"
  | "navigational_aids"
  | "utilities"
  | "perimeter_security"
  | "commissioning_handover";

export type AirportType =
  | "airport_greenfield"
  | "airport_expansion";

export type AirportUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "Nos" | "km" | "Set";

export interface AirportTaskTemplate {
  code: string;
  phase: AirportPhase;
  name: string;
  description?: string;
  unit: AirportUnit;
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
  applicableAirportTypes?: AirportType[];
  excludedAirportTypes?: AirportType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

export interface AirportTypeConfig {
  type: AirportType;
  label: string;
  description: string;
  mandatoryTaskCodes: string[];
  excludedTaskCodes: string[];
  additionalTaskCodes: string[];
  structuralComplexityFactor: number;
  pavementComplexityFactor: number;
  systemsComplexityFactor: number;
}

// ---------------------------------------------------------------------------
// AIRPORT CORE TASKS
// ---------------------------------------------------------------------------

export const AIRPORT_CORE_TASKS: AirportTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (AP-SI)
  // =========================================================================
  {
    code: "AP-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey (total station + GPS)",
    unit: "LS",
    productivityRate: { min: 14, max: 28, unit: "days" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Licensed Surveyor", count: 2 },
      { role: "Survey Assistant", count: 4 },
    ],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I", "ICAO Annex 14 Vol-I"],
    dsrRef: "AAI Survey Spec",
    safetyChecks: ["Tie survey to Airport Reference Point (ARP)", "Coordinate with DGCA for OLS mapping"],
    remarks: "Drone photogrammetry + ground truthing; LiDAR for large sites; tie to WGS-84 datum",
    isCore: true,
  },
  {
    code: "AP-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation (bore logs + plate load test)",
    unit: "LS",
    productivityRate: { min: 21, max: 42, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 4 },
      { role: "Lab Technician", count: 2 },
    ],
    equipment: ["Rotary drill rig", "SPT equipment", "CBR testing equipment"],
    predecessors: [{ taskCode: "AP-SI-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 1892", "IS 2131", "IS 2720"],
    dsrRef: "AAI Geotech Spec",
    safetyChecks: ["Bore log every 50m on runway centreline", "Plate load test at design load"],
    remarks: "CBR test critical for pavement design; subgrade CBR determines pavement thickness",
    isCore: true,
  },
  {
    code: "AP-SI-03",
    phase: "surveys_investigations",
    name: "Environmental impact assessment & clearance",
    unit: "LS",
    productivityRate: { min: 90, max: 180, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Consultant", count: 3 },
      { role: "Field Technician", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["EIA Notification 2006", "MoEFCC Guidelines"],
    dsrRef: "MoCA EIA Guidelines",
    safetyChecks: ["Bird hazard survey mandatory", "Noise contour study"],
    remarks: "Category A project — MoEFCC approval required; public hearing mandatory; 180 days typical",
    isCore: true,
    taskCategory: "A",
    requiresSpecialistContractor: true,
    specialistType: "NABET/QCI accredited EIA consultant",
  },
  {
    code: "AP-SI-04",
    phase: "surveys_investigations",
    name: "Obstacle limitation surface (OLS) survey",
    unit: "LS",
    productivityRate: { min: 14, max: 21, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Aviation Surveyor", count: 1 },
      { role: "Survey Assistant", count: 2 },
    ],
    predecessors: [{ taskCode: "AP-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "DGCA CAR Section-3 Series B"],
    dsrRef: "AAI OLS Guidelines",
    safetyChecks: ["All obstacles within OLS mapped and lit", "NOC from all obstacle owners"],
    remarks: "OLS defines what can be built within airport vicinity; no construction cranes above OLS without DGCA NOC",
    isCore: true,
  },
  {
    code: "AP-SI-05",
    phase: "surveys_investigations",
    name: "Wind rose analysis & runway orientation study",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Aeronautical Engineer", count: 1 },
      { role: "Meteorologist", count: 1 },
    ],
    predecessors: [{ taskCode: "AP-SI-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "ICAO Doc 9157"],
    dsrRef: "DGCA CAR",
    safetyChecks: ["Usability factor >95% mandatory (ICAO)"],
    remarks: "10-yr wind data from IMD; runway orientation maximises headwind; crosswind component <20 knots typical",
    isCore: true,
    applicableAirportTypes: ["airport_greenfield"],
    taskCategory: "A",
  },

  // =========================================================================
  // PHASE 2: EARTHWORKS & GRADING (AP-EW)
  // =========================================================================
  {
    code: "AP-EW-01",
    phase: "earthworks_grading",
    name: "Clearing, grubbing & topsoil stripping",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Dozer Operator", count: 2 },
      { role: "JCB Operator", count: 2 },
    ],
    equipment: ["Bulldozer D6/D7", "JCB 3CX", "Dump trucks"],
    predecessors: [
      { taskCode: "AP-SI-02", type: "FS", lagDays: 0 },
      { taskCode: "AP-SI-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["IS 1200 Part-I", "MoRT&H Spec Clause 201"],
    dsrRef: "DSR 1.1-1.3",
    safetyChecks: ["Photograph before clearing", "Utility marking before earthwork"],
    remarks: "Stockpile topsoil for later use in landscaping / grass seeding",
    isCore: true,
  },
  {
    code: "AP-EW-02",
    phase: "earthworks_grading",
    name: "Bulk earthwork — cut to fill (runway formation)",
    unit: "Cum",
    productivityRate: {
      min: 2000, max: 5000, unit: "Cum/day", method: "mechanical",
      mechanicalMin: 500, mechanicalMax: 1200, mechanicalUnit: "Cum/hr",
    },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Earthwork Engineer", count: 1 },
      { role: "Dozer Operator", count: 3 },
      { role: "Motor Grader Operator", count: 1 },
      { role: "Compactor Operator", count: 2 },
    ],
    equipment: ["Scrapers", "Bulldozer D8", "Dump trucks 20T", "Motor grader", "Vibratory roller 20T", "Water tanker"],
    predecessors: [{ taskCode: "AP-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 301-305", "IS 2720 Part-28"],
    dsrRef: "DSR Ch.2",
    safetyChecks: ["Proctor density 98% on runway formation", "Moisture content within ±2% of OMC"],
    remarks: "Runway formation requires high precision; laser level control; compaction in 200mm layers max",
    isCore: true,
  },
  {
    code: "AP-EW-03",
    phase: "earthworks_grading",
    name: "Subgrade stabilisation (lime / cement treatment)",
    unit: "Sqm",
    productivityRate: { min: 1000, max: 2000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Stabilisation Equipment Operator", count: 2 },
      { role: "Labourer", count: 4 },
    ],
    equipment: ["Pulvi-mixer / stabiliser", "Lime spreader", "Vibratory roller", "Water tanker"],
    predecessors: [{ taskCode: "AP-EW-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC SP-89", "IS 4332"],
    dsrRef: "AAI Pavement Spec",
    safetyChecks: ["UCS test 28-day ≥ 1.75 MPa for lime treated", "pH test for lime content"],
    remarks: "Required where subgrade CBR <6%; 4–6% cement or 4% lime typical; 28-day curing before pavement",
    isCore: false,
    taskCategory: "B",
    conditions: [{ field: "subgradeCBR", operator: "<", value: 6 }],
  },
  {
    code: "AP-EW-04",
    phase: "earthworks_grading",
    name: "Final runway / taxiway / apron grading to design profile",
    unit: "Sqm",
    productivityRate: { min: 2000, max: 4000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Survey Engineer", count: 1 },
      { role: "Motor Grader Operator", count: 2 },
      { role: "Compactor Operator", count: 1 },
    ],
    equipment: ["Motor grader with laser control", "Vibratory roller", "Survey total station"],
    predecessors: [{ taskCode: "AP-EW-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "AAI Pavement Spec"],
    dsrRef: "AAI Spec",
    safetyChecks: [
      "Cross fall 1.5% from centreline (max 2%)",
      "Longitudinal gradient <1.25% on runway",
      "Survey acceptance by AAI before pavement",
    ],
    remarks: "Laser grader gives ±5mm accuracy; critical — any deviation affects ILS alignment and drainage",
    isCore: true,
  },

  // =========================================================================
  // PHASE 3: RUNWAY & TAXIWAY PAVEMENT (AP-RW)
  // =========================================================================
  {
    code: "AP-RW-01",
    phase: "runway_taxiway_pavement",
    name: "Granular subbase (GSB) — 300mm compacted",
    unit: "Sqm",
    productivityRate: { min: 1500, max: 3000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Pavement Engineer", count: 1 },
      { role: "Paver Operator", count: 1 },
      { role: "Compactor Operator", count: 2 },
    ],
    equipment: ["Vibratory paver", "Tandem roller", "Water tanker"],
    predecessors: [{ taskCode: "AP-EW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["MoRT&H Spec Clause 401", "AAI Pavement Spec"],
    dsrRef: "AAI Spec Ch.3",
    safetyChecks: ["Degree of compaction >98% MDD", "CBR >30% after compaction"],
    remarks: "Crusher run aggregate; compacted in 150mm layers",
    isCore: true,
  },
  {
    code: "AP-RW-02",
    phase: "runway_taxiway_pavement",
    name: "Dry lean concrete (DLC) sub-base — 150mm",
    unit: "Sqm",
    productivityRate: { min: 800, max: 1500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Concrete Engineer", count: 1 },
      { role: "Paver Operator", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Slip form paver", "Concrete batching plant", "Transit mixers", "Curing compound sprayer"],
    predecessors: [{ taskCode: "AP-RW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRC 15", "IS 456", "AAI Pavement Spec"],
    dsrRef: "AAI Spec Ch.3",
    safetyChecks: ["7-day UCS ≥ 10 MPa", "Curing by polythene sheeting 7 days"],
    remarks: "M10 DLC; provides uniform support to PQC slab; polythene separation membrane above DLC",
    isCore: true,
  },
  {
    code: "AP-RW-03",
    phase: "runway_taxiway_pavement",
    name: "Pavement quality concrete (PQC) — runway slab 380–450mm",
    unit: "Sqm",
    productivityRate: { min: 300, max: 700, unit: "Sqm/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Concrete Engineer", count: 2 },
      { role: "Slip Form Paver Operator", count: 3 },
      { role: "Steel Fixer", count: 6 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Slip form paver (major)", "Concrete batching plant 120 m³/hr", "Transit mixers", "Texturing machine", "Curing compound sprayer"],
    predecessors: [{ taskCode: "AP-RW-02", type: "FS", lagDays: 7 }],
    isCodeRef: ["IRC 15", "IS 456", "ICAO Doc 9157 Part-3", "AAI Pavement Spec"],
    dsrRef: "AAI Spec Ch.4",
    safetyChecks: [
      "Flexural strength ≥ 4.5 MPa at 28 days",
      "Joint sealing within 14 days",
      "Curing minimum 21 days",
      "No concrete poured in rain — cover ready",
    ],
    remarks: "M45–M50 concrete; GGBS or fly ash partial replacement; dowel bars at all transverse joints; tie bars longitudinal",
    isCore: true,
  },
  {
    code: "AP-RW-04",
    phase: "runway_taxiway_pavement",
    name: "Runway grooving",
    unit: "Sqm",
    productivityRate: { min: 300, max: 600, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Grooving Operator", count: 2 },
      { role: "Helper", count: 4 },
    ],
    equipment: ["Diamond grooving machine"],
    predecessors: [{ taskCode: "AP-RW-03", type: "FS", lagDays: 28 }],
    isCodeRef: ["ICAO Annex 14", "FAA AC 150/5370-10 (reference)", "AAI Spec"],
    dsrRef: "AAI Spec Ch.4",
    safetyChecks: ["Groove depth 6mm ±1mm", "Groove width 6mm, spacing 38mm"],
    remarks: "Transverse grooving on full runway width; improves wet friction; required for Code 3/4 runways",
    isCore: true,
  },
  {
    code: "AP-RW-05",
    phase: "runway_taxiway_pavement",
    name: "Taxiway & apron PQC — 300–380mm",
    unit: "Sqm",
    productivityRate: { min: 400, max: 800, unit: "Sqm/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Concrete Engineer", count: 1 },
      { role: "Slip Form Paver Operator", count: 2 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Slip form paver (minor)", "Batching plant", "Transit mixers"],
    predecessors: [{ taskCode: "AP-RW-02", type: "SS", lagDays: 14 }],
    isCodeRef: ["IRC 15", "AAI Pavement Spec"],
    dsrRef: "AAI Spec Ch.4",
    safetyChecks: ["Flexural strength ≥ 4.5 MPa", "Apron design for pushback tractor loads"],
    remarks: "Same spec as runway but thinner; aircraft classification number (ACN) determines thickness",
    isCore: true,
  },
  {
    code: "AP-RW-06",
    phase: "runway_taxiway_pavement",
    name: "Runway & taxiway markings",
    unit: "Sqm",
    productivityRate: { min: 200, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Marking Specialist", count: 2 },
      { role: "Helper", count: 3 },
    ],
    equipment: ["Airfield marking machine", "Thermoplastic applicator"],
    predecessors: [{ taskCode: "AP-RW-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "DGCA CAR Section-3 Series B"],
    dsrRef: "AAI Markings Spec",
    safetyChecks: [
      "Retroreflectivity ≥ 150 mcd/m²/lux",
      "All marking dimensions per ICAO Annex 14 Table 5-1",
    ],
    remarks: "White for runway, yellow for taxiway; threshold, designator, centreline, touchdown zone",
    isCore: true,
  },

  // =========================================================================
  // PHASE 4: DRAINAGE (AP-DR)
  // =========================================================================
  {
    code: "AP-DR-01",
    phase: "drainage",
    name: "Airfield surface drainage — transverse & longitudinal channels",
    unit: "Rmt",
    productivityRate: { min: 20, max: 40, unit: "Rmt/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "AP-EW-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 4111", "ICAO Doc 9157 Part-3"],
    dsrRef: "AAI Drainage Spec",
    safetyChecks: ["No channel within runway strip unless flush with surface", "Grate rated for aircraft wheel loads"],
    remarks: "ICAO requires no standing water on runway; drainage capacity for 1-in-10 year storm",
    isCore: true,
  },
  {
    code: "AP-DR-02",
    phase: "drainage",
    name: "Perimeter drain & outfall",
    unit: "Rmt",
    productivityRate: { min: 15, max: 30, unit: "Rmt/day" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 3 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "AP-DR-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IS 4111"],
    dsrRef: "AAI Drainage Spec",
    safetyChecks: ["Outfall not to discharge on approach path", "Desilting chamber at outfall"],
    remarks: "Encloses entire airfield; separate from runway drainage; detention pond if near water body",
    isCore: true,
  },
  {
    code: "AP-DR-03",
    phase: "drainage",
    name: "Hydrant pit drainage & fuel separator",
    unit: "LS",
    productivityRate: { min: 14, max: 28, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Plumber", count: 3 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-DR-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["DGCA CAR Section-3", "OISD Standard 117"],
    dsrRef: "",
    safetyChecks: ["Oil-water separator capacity for 50mm/hr rainfall", "PESO approval for fuel drainage"],
    remarks: "Apron fuel drainage must go through API gravity separator before storm drain",
    isCore: true,
  },

  // =========================================================================
  // PHASE 5: TERMINAL BUILDING (AP-TB)
  // =========================================================================
  {
    code: "AP-TB-01",
    phase: "terminal_building",
    name: "Terminal building — structure (steel/RCC)",
    unit: "Sqm",
    productivityRate: { min: 40, max: 70, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Structural Engineer", count: 2 },
      { role: "Steel Erector", count: 8 },
      { role: "Mason", count: 6 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["Tower crane", "Mobile crane 50T"],
    predecessors: [{ taskCode: "AP-EW-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 800", "IS 456", "IS 1893", "NBC 2016"],
    dsrRef: "DSR Ch.5–6",
    safetyChecks: ["Wind load per IS 875 Part-3", "Seismic zone design", "Column-free span for check-in hall"],
    remarks: "Steel roof with RCC core; large column-free spans; glass façade; LEED certification targeted",
    isCore: true,
  },
  {
    code: "AP-TB-02",
    phase: "terminal_building",
    name: "Terminal MEP — HVAC, electrical, plumbing, firefighting",
    unit: "Sqm",
    productivityRate: { min: 25, max: 45, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "MEP Engineer", count: 2 },
      { role: "HVAC Technician", count: 6 },
      { role: "Electrician", count: 8 },
      { role: "Plumber", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-TB-01", type: "SS", lagDays: 45 }],
    isCodeRef: ["IS 1554", "IS 3034", "NBC Part-4", "TAC Guidelines"],
    dsrRef: "DSR Ch.9–11",
    safetyChecks: ["Fire suppression system test", "Emergency power UPS test", "AHU balance test"],
    remarks: "BMS integration; variable refrigerant volume (VRV) or chilled water system; fire sprinkler mandatory",
    isCore: true,
  },
  {
    code: "AP-TB-03",
    phase: "terminal_building",
    name: "Terminal finishing — flooring, cladding, false ceiling, glazing",
    unit: "Sqm",
    productivityRate: { min: 30, max: 55, unit: "Sqm/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Interior Contractor", count: 10 },
      { role: "Glazing Specialist", count: 4 },
      { role: "False Ceiling Fixer", count: 6 },
    ],
    predecessors: [{ taskCode: "AP-TB-02", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 1237", "NBC 2016"],
    dsrRef: "DSR Ch.14",
    safetyChecks: ["Slip resistance test on floor tiles", "Glass impact test for curtain wall"],
    remarks: "Granite or vitrified tile in public areas; structural glazing on façade; acoustic ceiling in check-in",
    isCore: true,
  },
  {
    code: "AP-TB-04",
    phase: "terminal_building",
    name: "Baggage handling system (BHS) installation",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "BHS Engineer", count: 2 },
      { role: "OEM Technician", count: 6 },
      { role: "Electrician", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-TB-01", type: "SS", lagDays: 60 }],
    isCodeRef: ["IATA AHM", "EU 185/2010 (reference)"],
    dsrRef: "",
    safetyChecks: ["Baggage jam simulation test", "Hold baggage screening (HBS) integration", "CUTE system integration"],
    remarks: "Vanderlande / Siemens / Beumer; HBS Level 3 integration; carousel minimum 3 per terminal",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "BHS OEM / systems integrator",
    leadTimeDays: 240,
  },
  {
    code: "AP-TB-05",
    phase: "terminal_building",
    name: "Passenger boarding bridges (PBB) installation",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per bridge" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "OEM Supervisor", count: 1 },
      { role: "Steel Erector", count: 4 },
      { role: "Electrician", count: 2 },
    ],
    equipment: ["Mobile crane 50T"],
    predecessors: [{ taskCode: "AP-TB-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["EN 12312-4", "IATA AHM"],
    dsrRef: "",
    safetyChecks: ["Load test at 150% SWL", "Anti-collision sensors tested", "Pit depth verified"],
    remarks: "JBT / Thyssenkrupp / ADELTE; single or dual cab; code 4E aircraft = 10m reach minimum",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "PBB OEM erection team",
    leadTimeDays: 365,
  },

  // =========================================================================
  // PHASE 6: ATC FACILITIES (AP-AT)
  // =========================================================================
  {
    code: "AP-AT-01",
    phase: "atc_facilities",
    name: "ATC tower structure & cab glazing",
    unit: "LS",
    productivityRate: { min: 90, max: 150, unit: "days" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Steel Erector", count: 6 },
      { role: "Glazing Specialist", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-EW-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 800", "IS 1893", "ICAO Annex 14 Vol-I"],
    dsrRef: "AAI ATC Tower Spec",
    safetyChecks: ["360° unobstructed view from cab", "Height clears OLS", "Lightning protection"],
    remarks: "360° panoramic glazing cab; typically 25–40m AGL; OLS compliance mandatory; Spirent reference",
    isCore: true,
    applicableAirportTypes: ["airport_greenfield"],
  },
  {
    code: "AP-AT-02",
    phase: "atc_facilities",
    name: "ATC communication & radar equipment installation",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "CNS/ATM Engineer", count: 3 },
      { role: "Electronics Technician", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-AT-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 10 Vol-I", "DGCA CNS/ATM Guidelines"],
    dsrRef: "AAI ATC Spec",
    safetyChecks: ["VHF radio range test", "Radar coverage verified by AAI", "UPS 4hr backup"],
    remarks: "VHF communication; SSR radar; ATIS; AFTN/AMHS; AAI supplies equipment; contractor installs",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "CNS/ATM systems integrator",
    leadTimeDays: 180,
  },

  // =========================================================================
  // PHASE 7: NAVIGATIONAL AIDS (AP-NA)
  // =========================================================================
  {
    code: "AP-NA-01",
    phase: "navigational_aids",
    name: "Instrument landing system (ILS) — localizer installation",
    unit: "LS",
    productivityRate: { min: 14, max: 28, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "CNS Engineer", count: 2 },
      { role: "Electronics Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "AP-RW-04", type: "FS", lagDays: 14 }],
    isCodeRef: ["ICAO Annex 10 Vol-I", "DGCA CAR Section-3"],
    dsrRef: "AAI ILS Spec",
    safetyChecks: ["Localizer antenna 300m from runway end", "ILS critical area marked and protected"],
    remarks: "Localizer at far end of runway; CAT I minimum; CAT III for major airports; flight check required",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "ILS OEM / AAI-approved contractor",
    leadTimeDays: 180,
  },
  {
    code: "AP-NA-02",
    phase: "navigational_aids",
    name: "ILS — glide path installation",
    unit: "LS",
    productivityRate: { min: 14, max: 21, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "CNS Engineer", count: 2 },
      { role: "Electronics Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "AP-NA-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 10 Vol-I"],
    dsrRef: "AAI ILS Spec",
    safetyChecks: ["GP antenna 300m from threshold at offset", "3° glidepath confirmed"],
    remarks: "GP transmitter on side of runway at touchdown zone; azimuth adjusted post-installation",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "ILS OEM / AAI-approved contractor",
  },
  {
    code: "AP-NA-03",
    phase: "navigational_aids",
    name: "Airfield ground lighting — runway, taxiway, apron (HIAL/MIAL)",
    unit: "Nos",
    productivityRate: { min: 20, max: 40, unit: "Nos/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Airfield Lighting Engineer", count: 2 },
      { role: "Electrician", count: 6 },
      { role: "Labourer", count: 6 },
    ],
    predecessors: [{ taskCode: "AP-RW-03", type: "FS", lagDays: 14 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "DGCA CAR Section-3"],
    dsrRef: "AAI AGL Spec",
    safetyChecks: [
      "Frangible mounting — shear at 75N horizontal",
      "Photometric test each fitting",
      "AGL control system failsafe tested",
    ],
    remarks: "HIAL for CAT I minimum; HIAL + ALS for CAT II/III; LED preferred; 5kW constant current regulators",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "AAI-approved AGL contractor",
    leadTimeDays: 120,
  },
  {
    code: "AP-NA-04",
    phase: "navigational_aids",
    name: "PAPI (precision approach path indicator) installation",
    unit: "Each",
    productivityRate: { min: 3, max: 5, unit: "days per set" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "CNS Engineer", count: 1 },
      { role: "Electrician", count: 2 },
    ],
    predecessors: [{ taskCode: "AP-RW-06", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 14 Vol-I"],
    dsrRef: "AAI PAPI Spec",
    safetyChecks: ["PAPI angle = glidepath angle ±0.05°", "Inset lights flush ±3mm with pavement"],
    remarks: "4-box PAPI on left side of runway; 3°±0.5° glidepath; flight check before commission",
    isCore: true,
  },
  {
    code: "AP-NA-05",
    phase: "navigational_aids",
    name: "ILS flight calibration check",
    unit: "LS",
    productivityRate: { min: 3, max: 7, unit: "days" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "AAI Flight Inspection Team", count: 5 },
    ],
    equipment: ["AAI Beechcraft King Air 350ER (flight inspection aircraft)"],
    predecessors: [
      { taskCode: "AP-NA-01", type: "FS", lagDays: 0 },
      { taskCode: "AP-NA-02", type: "FS", lagDays: 0 },
      { taskCode: "AP-NA-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["ICAO Doc 8071", "DGCA Flight Inspection Manual"],
    dsrRef: "AAI Flight Inspection Spec",
    safetyChecks: ["All ILS parameters within ICAO tolerance", "NOTAM issued for test flights"],
    remarks: "Mandatory before DGCA grants aerodrome licence; AAI flight inspection unit (Dehra Dun) to be scheduled 3 months ahead",
    isCore: true,
    taskCategory: "A",
    requiresSpecialistContractor: true,
    specialistType: "AAI Flight Inspection Unit",
    leadTimeDays: 90,
  },

  // =========================================================================
  // PHASE 8: UTILITIES (AP-UT)
  // =========================================================================
  {
    code: "AP-UT-01",
    phase: "utilities",
    name: "Airfield ground lighting (AGL) control system & power",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Electrical Engineer", count: 2 },
      { role: "Electrician", count: 6 },
    ],
    predecessors: [{ taskCode: "AP-NA-03", type: "SS", lagDays: 0 }],
    isCodeRef: ["CEA Regulations", "DGCA CAR Section-3"],
    dsrRef: "AAI Electrical Spec",
    safetyChecks: ["CCR step control 1–5 brightness tested", "Dual supply + auto changeover <1s"],
    remarks: "Constant current regulators (CCR); series circuit 6.6A; dual power supply with auto changeover",
    isCore: true,
  },
  {
    code: "AP-UT-02",
    phase: "utilities",
    name: "Aviation fuel hydrant system (apron)",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Mechanical Engineer", count: 2 },
      { role: "Plumber", count: 6 },
      { role: "Welder", count: 3 },
    ],
    predecessors: [{ taskCode: "AP-RW-05", type: "FS", lagDays: 0 }],
    isCodeRef: ["IS 5514", "OISD Standard 117", "IP 1585"],
    dsrRef: "AAI Fuel Spec",
    safetyChecks: ["Hydrostatic test 1.5× working pressure", "PESO approval", "Fuel quality certification"],
    remarks: "Underground ATF (Jet A-1) hydrant; pit stops at each aircraft stand; IATA AHM fuelling spec",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "PESO-licensed pipeline contractor",
  },
  {
    code: "AP-UT-03",
    phase: "utilities",
    name: "Crash fire rescue (CFR) station",
    unit: "LS",
    productivityRate: { min: 60, max: 90, unit: "days" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "AP-EW-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Annex 14 Vol-I", "DGCA CAR Section-3 Series O"],
    dsrRef: "AAI CFR Spec",
    safetyChecks: ["CFR station within 3 min response time to any runway point", "FOAM tender certification"],
    remarks: "ICAO category (1–10) determines CFR equipment; 3-minute response time mandatory",
    isCore: true,
  },

  // =========================================================================
  // PHASE 9: PERIMETER & SECURITY (AP-PS)
  // =========================================================================
  {
    code: "AP-PS-01",
    phase: "perimeter_security",
    name: "Perimeter fence — chain link / concrete wall",
    unit: "Rmt",
    productivityRate: { min: 30, max: 50, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Fencing Installer", count: 4 },
      { role: "Labourer", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-EW-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["BCAS Guidelines", "DGCA CAR Section-3"],
    dsrRef: "AAI Security Spec",
    safetyChecks: ["2.4m height minimum (BCAS)", "No gap >150mm at base", "Anti-climb top rail"],
    remarks: "BCAS mandatory — 2.4m galvanised chain link or precast concrete; intrusion detection optional",
    isCore: true,
  },
  {
    code: "AP-PS-02",
    phase: "perimeter_security",
    name: "CCTV & access control system",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Security Systems Engineer", count: 2 },
      { role: "Technician", count: 4 },
    ],
    predecessors: [{ taskCode: "AP-TB-03", type: "SS", lagDays: 30 }],
    isCodeRef: ["BCAS Guidelines", "IT Act 2000"],
    dsrRef: "",
    safetyChecks: ["30-day recording", "Live feed to BCAS monitoring centre"],
    remarks: "IP cameras at all critical zones; biometric + card access to airside; integration with BCAS",
    isCore: true,
  },

  // =========================================================================
  // PHASE 10: COMMISSIONING & HANDOVER (AP-CH)
  // =========================================================================
  {
    code: "AP-CH-01",
    phase: "commissioning_handover",
    name: "DGCA aerodrome inspection & licence grant",
    unit: "LS",
    productivityRate: { min: 14, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Airport Director", count: 1 },
      { role: "Liaison Engineer", count: 2 },
    ],
    predecessors: [
      { taskCode: "AP-NA-05", type: "FS", lagDays: 0 },
      { taskCode: "AP-PS-02", type: "FS", lagDays: 0 },
      { taskCode: "AP-UT-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["DGCA CAR Section-3 Series B Part-I", "Airports Authority of India Act 1994"],
    dsrRef: "DGCA Aerodrome Licensing Guidelines",
    safetyChecks: ["All ICAO Annex 14 Standards complied", "Aerodrome Manual submitted", "Wildlife hazard management plan"],
    remarks: "DGCA inspection team visits; aerodrome licence valid 1 year renewable; must precede first commercial flight",
    isCore: true,
    taskCategory: "A",
  },
  {
    code: "AP-CH-02",
    phase: "commissioning_handover",
    name: "Trial operations — ground handling, passenger flow, emergency drills",
    unit: "LS",
    productivityRate: { min: 7, max: 21, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Airport Operations Manager", count: 1 },
      { role: "Ground Handling Team", count: 20 },
      { role: "Security Team", count: 10 },
    ],
    predecessors: [{ taskCode: "AP-CH-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["ICAO Doc 9137", "BCAS Guidelines"],
    dsrRef: "",
    safetyChecks: ["Emergency evacuation drill", "Medical response drill", "ATC/aircraft communication test"],
    remarks: "Soft launch with trial flights before commercial launch; all agencies (customs, immigration, CISF) must be in place",
    isCore: true,
  },
];

// ---------------------------------------------------------------------------
// AIRPORT TYPE CONFIGURATIONS
// ---------------------------------------------------------------------------

export const AIRPORT_TYPE_CONFIGS: Record<AirportType, AirportTypeConfig> = {
  airport_greenfield: {
    type: "airport_greenfield",
    label: "Greenfield Airport",
    description: "New airport from scratch — full runway, terminal, ATC, navigational aids",
    mandatoryTaskCodes: [
      "AP-SI-01", "AP-SI-02", "AP-SI-03", "AP-SI-04", "AP-SI-05",
      "AP-EW-01", "AP-EW-02", "AP-EW-04",
      "AP-RW-01", "AP-RW-02", "AP-RW-03", "AP-RW-04", "AP-RW-05", "AP-RW-06",
      "AP-DR-01", "AP-DR-02", "AP-DR-03",
      "AP-TB-01", "AP-TB-02", "AP-TB-03", "AP-TB-04", "AP-TB-05",
      "AP-AT-01", "AP-AT-02",
      "AP-NA-01", "AP-NA-02", "AP-NA-03", "AP-NA-04", "AP-NA-05",
      "AP-UT-01", "AP-UT-02", "AP-UT-03",
      "AP-PS-01", "AP-PS-02",
      "AP-CH-01", "AP-CH-02",
    ],
    excludedTaskCodes: [],
    additionalTaskCodes: ["AP-EW-03"],
    structuralComplexityFactor: 1.30,
    pavementComplexityFactor: 1.50,
    systemsComplexityFactor: 1.60,
  },
  airport_expansion: {
    type: "airport_expansion",
    label: "Airport Expansion",
    description: "Additional runway / terminal / apron — existing airport partially operational",
    mandatoryTaskCodes: [
      "AP-SI-01", "AP-SI-02", "AP-SI-04",
      "AP-EW-01", "AP-EW-02", "AP-EW-04",
      "AP-RW-01", "AP-RW-02", "AP-RW-03", "AP-RW-04", "AP-RW-05", "AP-RW-06",
      "AP-DR-01", "AP-DR-02",
      "AP-TB-01", "AP-TB-02", "AP-TB-03",
      "AP-NA-03", "AP-NA-04", "AP-NA-05",
      "AP-UT-01",
      "AP-PS-01", "AP-PS-02",
      "AP-CH-01", "AP-CH-02",
    ],
    excludedTaskCodes: ["AP-SI-05", "AP-AT-01"],
    additionalTaskCodes: ["AP-TB-04", "AP-TB-05", "AP-UT-02"],
    structuralComplexityFactor: 1.20,
    pavementComplexityFactor: 1.40,
    systemsComplexityFactor: 1.30,
  },
};

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export const ALL_AIRPORT_TASKS: AirportTaskTemplate[] = [...AIRPORT_CORE_TASKS];

export function getAirportTasks(airportType: AirportType): AirportTaskTemplate[] {
  const config = AIRPORT_TYPE_CONFIGS[airportType];
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet  = new Set(config.excludedTaskCodes);

  return ALL_AIRPORT_TASKS.filter(t => {
    if (excludedSet.has(t.code)) return false;
    if (mandatorySet.has(t.code)) return true;
    if (t.applicableAirportTypes && !t.applicableAirportTypes.includes(airportType)) return false;
    if (t.excludedAirportTypes && t.excludedAirportTypes.includes(airportType)) return false;
    return t.isCore;
  });
}
