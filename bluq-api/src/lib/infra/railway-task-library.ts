// =============================================================================
// BLUQ MAINLINE RAILWAY TASK LIBRARY
// =============================================================================
// Source: Indian Railways Standard Specifications, RDSO Guidelines,
//         IRS Track Manual, IRS Bridge Code, IRS Signal & Telecom Spec,
//         LARR Act 2013, MoEF EIA Notification 2006, CEA Regulations 2010
//
// Covers:
//   new_line              — Greenfield broad-gauge passenger/freight line
//   doubling              — Third/fourth line alongside existing route
//   gauge_conversion      — Metre gauge to broad gauge conversion
//   station_redevelopment — Standalone station upgrade (limited scope)
//
// Key mainline railway constraints vs metro:
//   - Land acquisition (LARR Act) is the #1 critical-path item on new lines
//   - Railway Board investment sanction can take 1–3 years
//   - Track: ballasted (not slab), BG (1676mm), 60 kg/m UIC rail
//   - Signalling: EI/RI-based conventional block working (not CBTC)
//   - CRS (Commissioner of Railway Safety) — not CMRS — inspects before opening
//   - 25kV AC traction (electrified) — different from 750V DC metro third rail
//   - Bridges: through/half-through trusses and PSC girders, IRS Bridge Code
//   - Monsoon: embankment and earthwork most affected; track linking restricted
// =============================================================================

import type { ProductivityRate, CrewMember, Predecessor } from "../task-library.js";

export type RailwayPhase =
  | "surveys_investigations"
  | "land_acquisition"
  | "earthworks"
  | "bridges_culverts"
  | "track_laying"
  | "station_works"
  | "signalling_telecom"
  | "traction_power"
  | "testing_commissioning";

export type RailwayProjectType =
  | "new_line"
  | "doubling"
  | "gauge_conversion"
  | "station_redevelopment";

export type RailwayUnit =
  | "LS" | "Sqm" | "Cum" | "Rmt" | "MT" | "Each" | "No" | "km" | "Set";

export interface RailwayTaskTemplate {
  code:                      string;
  phase:                     RailwayPhase;
  name:                      string;
  unit:                      RailwayUnit;
  productivityRate:          ProductivityRate;
  monsoonImpactFactor:       number;
  crew:                      CrewMember[];
  equipment?:                string[];
  predecessors:              Predecessor[];
  isCodeRef:                 string[];
  dsrRef:                    string;
  safetyChecks:              string[];
  remarks:                   string;
  taskCategory?:             "A" | "B";
  isCore:                    boolean;
  isConditional?:            boolean;
  isElectrifiedOnly?:        boolean;   // include only when isElectrified === true
  leadTimeDays?:             number;
  requiresSpecialistContractor?: boolean;
  specialistType?:           string;
  applicableProjectTypes?:   RailwayProjectType[];
  isCriticalPath?:           boolean;
}

// ---------------------------------------------------------------------------
// RAILWAY TASKS
// ---------------------------------------------------------------------------

export const ALL_RAILWAY_TASKS: RailwayTaskTemplate[] = [

  // =========================================================================
  // PHASE 1: SURVEYS & INVESTIGATIONS (RW-SI)
  // =========================================================================
  {
    code: "RW-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey and alignment finalization (total station + drone)",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.5, unit: "km/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Licensed Surveyor", count: 2 },
      { role: "Survey Assistant", count: 4 },
      { role: "Drone Operator", count: 1 },
    ],
    predecessors: [],
    isCodeRef: ["IS 1200 Part-I", "RDSO Survey Manual"],
    dsrRef: "MoR Survey Spec",
    safetyChecks: ["Traffic management on road crossings", "Drone DGCA approval (NPNT)"],
    remarks: "1:1000 strip plan; tie to GTS benchmark; drone photogrammetry + ground truthing; co-ordinate with forest & revenue departments",
    isCore: true,
  },
  {
    code: "RW-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation (bore logs, SPT, CBR, sub-grade testing)",
    unit: "LS",
    productivityRate: { min: 45, max: 90, unit: "days" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Geotechnical Engineer", count: 2 },
      { role: "Drilling Crew", count: 4 },
      { role: "Lab Technician", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-SI-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IS 1892", "IS 2131", "IRS GE-1", "RDSO Subgrade Design Guidelines"],
    dsrRef: "RDSO Geotech Manual",
    safetyChecks: ["Bore locations on road: traffic management", "Reinstatement of formation after boring"],
    remarks: "Bore every 200m on formation; deeper at bridges; CBR at 95% Proctor for subgrade; expansive soil (black cotton) identification critical",
    taskCategory: "A",
    isCore: true,
  },
  {
    code: "RW-SI-03",
    phase: "surveys_investigations",
    name: "DPR preparation and Railway Board / Ministry investment sanction",
    unit: "LS",
    productivityRate: { min: 180, max: 365, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Project Director", count: 1 },
      { role: "Design Engineer", count: 4 },
      { role: "Liaison Officer (MoR)", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["Railway Board circulars", "CCEA investment approval guidelines"],
    dsrRef: "MoR DPR Format",
    safetyChecks: ["DPR submitted to Railway Board before civil work tender floating"],
    remarks: "Investment Sanction by Railway Board/CCEA is a hard gate; no civil work can start legally without it; NITI Aayog nod needed for large projects",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
    leadTimeDays: 365,
  },
  {
    code: "RW-SI-04",
    phase: "surveys_investigations",
    name: "Environmental and Social Impact Assessment (EIA + SIA under LARR)",
    unit: "LS",
    productivityRate: { min: 60, max: 120, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Consultant", count: 2 },
      { role: "Social Impact Expert", count: 1 },
    ],
    predecessors: [{ taskCode: "RW-SI-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["EIA Notification 2006", "LARR Act 2013", "Environment Protection Act 1986"],
    dsrRef: "MoEF EIA Guidelines",
    safetyChecks: ["Affected households census completed", "Public hearing conducted at each district"],
    remarks: "NABET-accredited EIA firm mandatory for Category B2+ projects; SIA triggers LARR land acquisition; EC before civil works in ecologically sensitive areas",
    taskCategory: "A",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "NABET-accredited EIA consultant",
  },
  {
    code: "RW-SI-05",
    phase: "surveys_investigations",
    name: "Forest clearance — Stage I & II (MoEF / CAMPA)",
    unit: "LS",
    productivityRate: { min: 180, max: 540, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Forest Liaison Officer", count: 1 },
      { role: "DFO Interface Team", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-SI-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["Forest Conservation Act 1980", "Van (Sanrakshan Evam Samriddhi) Act 2023"],
    dsrRef: "MoEF Forest Clearance Guidelines",
    safetyChecks: ["Stage II FC in hand before tree felling in forest land"],
    remarks: "Stage I (in-principle) + Stage II (final) clearance; compensatory afforestation (CAMPA) payment mandatory; NPV payment to be made; 12–18 months typical",
    taskCategory: "A",
    isCore: false,
    isConditional: true,
    isCriticalPath: true,
    leadTimeDays: 360,
  },

  // =========================================================================
  // PHASE 2: LAND ACQUISITION (RW-LA)
  // =========================================================================
  {
    code: "RW-LA-01",
    phase: "land_acquisition",
    name: "Land acquisition under LARR Act 2013 — SIA, award and possession",
    unit: "Rmt",
    productivityRate: { min: 50, max: 150, unit: "Rmt/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Land Acquisition Officer (LAO)", count: 2 },
      { role: "Revenue / Tehsildar Interface", count: 3 },
      { role: "Legal Officer", count: 1 },
    ],
    predecessors: [{ taskCode: "RW-SI-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["LARR Act 2013", "National Rail Plan 2030", "Railways Act 1989"],
    dsrRef: "MoR Land Acquisition Manual",
    safetyChecks: ["Possession certificate before earthwork machinery on land", "Encroachment clearance by police / civil authority"],
    remarks: "LARR Act requires: SIA → notification → consent → award → possession; disputed acquisition = court delays; 2–3 years typical for contested parcels; critical path on most greenfield lines",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
    leadTimeDays: 730,
    applicableProjectTypes: ["new_line", "doubling"],
  },
  {
    code: "RW-LA-02",
    phase: "land_acquisition",
    name: "Utility and service relocation in ROW (electricity, water, telecom)",
    unit: "Rmt",
    productivityRate: { min: 20, max: 50, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Utility Relocation Supervisor", count: 1 },
      { role: "Utility Contractor Crew", count: 12 },
      { role: "Utility Liaison Officer", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-LA-01", type: "FS", lagDays: 30 }],
    isCodeRef: [],
    dsrRef: "RDSO Utility Relocation Spec",
    safetyChecks: ["Service interruption NOC from each utility owner", "HT line isolation before work below it"],
    remarks: "DISCOM, BSNL, GAIL, BWSSB each have own NOC process; co-ordinate early; rural areas faster, urban crossings can hold up earthwork for months",
    isCore: true,
  },

  // =========================================================================
  // PHASE 3: FORMATION & EARTHWORKS (RW-FE)
  // =========================================================================
  {
    code: "RW-FE-01",
    phase: "earthworks",
    name: "Site clearing, grubbing, fencing and temporary access roads",
    unit: "km",
    productivityRate: { min: 1.0, max: 3.0, unit: "km/day" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Operator", count: 3 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Dozer D6/D7", "Hydraulic excavator", "Chainsaw"],
    predecessors: [{ taskCode: "RW-LA-02", type: "FS", lagDays: 30 }],
    isCodeRef: ["IRS Earthwork Spec"],
    dsrRef: "MoR Formation Manual",
    safetyChecks: ["Tree felling only after FC / revenue authority permission", "No earthwork inside forest land without Stage II FC"],
    remarks: "Temporary fence at ROW boundary; access roads every 2 km for machinery; stump removal included; topsoil stockpile for later slope protection",
    isCore: true,
  },
  {
    code: "RW-FE-02",
    phase: "earthworks",
    name: "Rock/earth cutting for railway formation (blasting where required)",
    unit: "Cum",
    productivityRate: { min: 800, max: 2000, unit: "Cum/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Earthworks Engineer", count: 1 },
      { role: "Excavator Operator", count: 2 },
      { role: "Dumper Driver", count: 4 },
      { role: "Blasting Expert", count: 1 },
    ],
    equipment: ["Hydraulic excavator 30T", "Dumper 20T", "Rock breaker", "Drill rig (if blasting)"],
    predecessors: [{ taskCode: "RW-FE-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRS Earthwork Spec", "Explosive Act 2008", "IS 4081"],
    dsrRef: "MoR Formation Manual",
    safetyChecks: ["Blasting license (PESO) for all controlled blasts", "Vibration monitoring near structures", "Safe exclusion zone during blast"],
    remarks: "Hilly terrain: rock cutting dominates; plains: earthwork by excavator + dumper; lead distance for earth movement determines productivity; monsoon = nil blasting in many states",
    isCore: true,
  },
  {
    code: "RW-FE-03",
    phase: "earthworks",
    name: "Embankment filling and compaction to 95% Modified Proctor Density",
    unit: "Cum",
    productivityRate: { min: 1000, max: 2500, unit: "Cum/day" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Earthworks Engineer", count: 1 },
      { role: "Grader Operator", count: 1 },
      { role: "Roller Operator", count: 2 },
      { role: "Labourer", count: 8 },
    ],
    equipment: ["Grader", "Vibratory roller", "Water tanker", "Compactor"],
    predecessors: [{ taskCode: "RW-FE-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS Earthwork Spec", "RDSO Embankment Guidelines"],
    dsrRef: "MoR Formation Manual",
    safetyChecks: ["Compaction test every 500 Cum — DCP / sand cone", "Layer thickness ≤ 300mm loose", "Moisture content within ±2% OMC"],
    remarks: "Black cotton soil: lime stabilization layer at bottom 500mm before fill; 300mm compacted layer; subgrade CBR ≥ 8 for BG traffic; settlement monitoring post-fill for soft soil embankments",
    isCore: true,
  },
  {
    code: "RW-FE-04",
    phase: "earthworks",
    name: "Formation finishing — subgrade treatment, graded sand blanket, blanket layer",
    unit: "Sqm",
    productivityRate: { min: 800, max: 2000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Grader Operator", count: 1 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "RW-FE-03", type: "FS", lagDays: 7 }],
    isCodeRef: ["RDSO Subgrade Design Guidelines", "IRS GE-1"],
    dsrRef: "MoR Formation Manual",
    safetyChecks: ["Formation width 7.115m (BG double) / 5.49m (BG single) — survey before ballast", "Surface drainage slope 1:30 maintained"],
    remarks: "Graded sand blanket (300mm) on plastic soil subgrade; formation slope 1:4 in cutting, 1:1.5–2 in embankment; slope protection by turfing/pitching on embankments > 3m",
    isCore: true,
  },

  // =========================================================================
  // PHASE 4: BRIDGES & CULVERTS (RW-BC)
  // =========================================================================
  {
    code: "RW-BC-01",
    phase: "bridges_culverts",
    name: "Minor bridges and culverts (span < 18m) — RCC box / PSC girder",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per bridge" },
    monsoonImpactFactor: 1.50,
    crew: [
      { role: "Bridge Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Steel Fitter", count: 4 },
      { role: "Labourer", count: 12 },
    ],
    predecessors: [{ taskCode: "RW-SI-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRS Bridge Code", "IS 456", "IS 3370 Part-IV"],
    dsrRef: "RDSO Bridge Design Manual",
    safetyChecks: ["Foundation depth ≥ max scour depth + 1.5m", "Scour depth assessment per IRC 78 method"],
    remarks: "Minor bridges ≤ 18m span; most common is 6m RCC box culvert; PSC girder for 12–18m; typically 5–15 per km on Indian terrain",
    isCore: true,
  },
  {
    code: "RW-BC-02",
    phase: "bridges_culverts",
    name: "Major railway bridge (span ≥ 18m) — PSC / steel through-truss",
    unit: "Each",
    productivityRate: { min: 120, max: 365, unit: "days per bridge" },
    monsoonImpactFactor: 1.60,
    crew: [
      { role: "Bridge Engineer", count: 2 },
      { role: "Well Sinking Crew", count: 15 },
      { role: "Structural Steel Erector", count: 8 },
      { role: "Crane Operator", count: 2 },
    ],
    equipment: ["50T crane", "Well sinking equipment", "RCC tremie", "Pile rig"],
    predecessors: [{ taskCode: "RW-BC-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS Bridge Code", "IRS T-39 (Steel)", "IS 456", "IRS B1 (Loads)"],
    dsrRef: "RDSO Bridge Manual",
    safetyChecks: [
      "Well foundation sinking only in dry season (Oct–Feb) for river crossings",
      "Cofferdam or dewatering plan before pier concreting",
      "Structural steel fabrication from RDSO approved vendor",
    ],
    remarks: "River bridge: well foundation or pile; hilly area: PSC girder on RCC piers; steel through-truss for long spans; proof load test per RDSO",
    isCore: false,
    isConditional: true,
    isCriticalPath: true,
    leadTimeDays: 180,
    requiresSpecialistContractor: true,
    specialistType: "RDSO-approved bridge contractor",
    applicableProjectTypes: ["new_line", "doubling"],
  },
  {
    code: "RW-BC-03",
    phase: "bridges_culverts",
    name: "Road Over Bridge (ROB) / Road Under Bridge (RUB) construction",
    unit: "Each",
    productivityRate: { min: 90, max: 180, unit: "days per ROB/RUB" },
    monsoonImpactFactor: 1.40,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 6 },
      { role: "Steel Fitter", count: 6 },
      { role: "Labourer", count: 15 },
    ],
    equipment: ["60T crawler crane", "Formwork system", "Concrete pump"],
    predecessors: [{ taskCode: "RW-BC-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRC 6", "IRC 112", "IRS Bridge Code", "MoRTH spec for ROB"],
    dsrRef: "Railways / NHAI ROB Spec",
    safetyChecks: [
      "Traffic diversion plan approved by Traffic Police before work at road crossing",
      "Night work only with proper illumination and signage",
      "Launching over live track: block working with traffic controller",
    ],
    remarks: "Road traffic crossing over / under railway; cost usually shared between Railways and State/NHAI; night launching of steel girders over traffic; RDSO/Railways nod for track proximity work",
    isCore: false,
    isConditional: true,
    applicableProjectTypes: ["new_line", "doubling"],
  },
  {
    code: "RW-BC-04",
    phase: "bridges_culverts",
    name: "Level crossing upgrade — boom barriers, VHF equipment, interlocking",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per LC" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Signal & Telecom Engineer", count: 1 },
      { role: "Civil Technician", count: 3 },
    ],
    predecessors: [{ taskCode: "RW-SG-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS S&T Signal Manual", "RDSO Level Crossing Spec"],
    dsrRef: "IRS LC Spec",
    safetyChecks: ["LC gate kept closed during train passage — logbook check", "Boom barrier tested before handover"],
    remarks: "Manned LC with boom barriers and interlocking mandatory on NH/SH crossings; unmanned LC only on low-density footpath crossings; many unmanned LCs being abolished on doubling works",
    isCore: true,
  },

  // =========================================================================
  // PHASE 5: TRACK LAYING (RW-TL)
  // =========================================================================
  {
    code: "RW-TL-01",
    phase: "track_laying",
    name: "Ballast procurement, despatch and stacking along formation",
    unit: "Cum",
    productivityRate: { min: 100, max: 300, unit: "Cum/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "Ballast Measurement Staff", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-FE-04", type: "FS", lagDays: 7 }],
    isCodeRef: ["IRS GE-1 Ballast Spec", "RDSO Track Manual"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Ballast grading test at quarry before despatch", "No soil contamination in ballast stack"],
    remarks: "60-mm machine-crushed hard moorum/granite; 300mm cushion below sleeper + 150mm bed; 1 km track needs approx 2200 Cum ballast; source quarry approval by RDSO essential",
    isCore: true,
    leadTimeDays: 30,
  },
  {
    code: "RW-TL-02",
    phase: "track_laying",
    name: "Pre-stressed concrete (PSC) sleeper supply and placement",
    unit: "No",
    productivityRate: { min: 1000, max: 1500, unit: "No/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "P-Way Supervisor", count: 2 },
      { role: "P-Way Gang", count: 12 },
    ],
    equipment: ["Track trolley", "Sleeper handling crane"],
    predecessors: [{ taskCode: "RW-TL-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS T-44 (PSC sleepers)", "IS 13177", "RDSO Drawing RT-6710"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Sleeper gauge maintained at 1676mm centre ±1mm", "Sleeper spacing 600mm standard BG"],
    remarks: "1540 sleepers per km (BG); RDSO-approved manufacturers; elastic rail clips (ERC) type; sleepers delivered by rail-mounted trolleys or road when no track access",
    isCore: true,
    leadTimeDays: 45,
  },
  {
    code: "RW-TL-03",
    phase: "track_laying",
    name: "Rail supply and laying — 60 kg/m UIC 90 UTS rail (13m/26m panels)",
    unit: "Rmt",
    productivityRate: { min: 500, max: 1500, unit: "Rmt/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "P-Way Supervisor", count: 2 },
      { role: "P-Way Gang", count: 15 },
    ],
    equipment: ["Rail laying trolley", "Hydraulic rail bender", "EOT crane at depot"],
    predecessors: [{ taskCode: "RW-TL-01", type: "SS", lagDays: 7 }],
    isCodeRef: ["IRS T-12 (Rails)", "IS 3443", "RDSO Track Manual"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Rail profile inspection at each despatch", "Fish plate bolt torque 165 Nm"],
    remarks: "60 kg/m 90 UTS rail from SAIL/RINL; head-hardened rail at curves < 400m radius; anti-theft bolt nuts mandatory on bridges; 4 rail clips per sleeper both sides",
    isCore: true,
    leadTimeDays: 60,
    requiresSpecialistContractor: false,
  },
  {
    code: "RW-TL-04",
    phase: "track_laying",
    name: "Track linking and jointing — mechanized panel linking",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.0, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "P-Way Supervisor", count: 3 },
      { role: "P-Way Gang", count: 25 },
    ],
    equipment: ["Mechanical linking trolley", "Hydraulic jack", "Torque wrench"],
    predecessors: [
      { taskCode: "RW-TL-01", type: "FS", lagDays: 0 },
      { taskCode: "RW-TL-02", type: "FS", lagDays: 0 },
      { taskCode: "RW-TL-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["RDSO Track Manual", "IRS T-12"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Gauge check every 50m", "Cant and twist measured after linking"],
    remarks: "Jointed track first, converted to LWR by flash-butt welding; 3–4 gangs of 25 working simultaneously in independent blocks; monsoon: track expansion joints must be set to temperature",
    isCore: true,
  },
  {
    code: "RW-TL-05",
    phase: "track_laying",
    name: "Points, crossings and turnout installation (station yards)",
    unit: "Each",
    productivityRate: { min: 7, max: 14, unit: "days per turnout" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "P-Way Supervisor", count: 2 },
      { role: "P-Way Gang", count: 15 },
    ],
    equipment: ["60T crane (for heavy assembly)", "Hydraulic jack"],
    predecessors: [{ taskCode: "RW-TL-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS T-5 (Turnouts)", "RDSO Drawing RT-3697"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Switch tongue inspection — no light between rail and tongue", "Stretcher bar clearance checked"],
    remarks: "1:12 turnouts standard for platform lines; 1:8.5 for goods sidings; point machine (EI-operated) or ground frame; assembling in yard then shifting to position by crane",
    isCore: true,
    leadTimeDays: 60,
  },
  {
    code: "RW-TL-06",
    phase: "track_laying",
    name: "Flash butt / thermit welding — jointed track to Long Welded Rail (LWR)",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.0, unit: "km/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "P-Way Welding Engineer", count: 1 },
      { role: "Flash Butt Welding Machine Operator", count: 2 },
      { role: "Welder (Thermit)", count: 4 },
    ],
    equipment: ["Flash butt welding machine (rail-mounted)", "Thermit welding crucibles", "Hydraulic profile grinder"],
    predecessors: [{ taskCode: "RW-TL-04", type: "FS", lagDays: 7 }],
    isCodeRef: ["RDSO Welding Manual", "IRS T-19 (Welding)"],
    dsrRef: "RDSO P-Way Manual",
    safetyChecks: ["Weld NDT (UT) — 100% before traffic", "Weld profile ground to ±0.5mm of parent rail"],
    remarks: "Flash butt welding preferred (machine-mounted on track); thermit (Goldschmidt) at turnout connections; 400m LWR panels with stress-free temperature set at 30–40°C",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "RDSO-approved rail welding contractor",
  },
  {
    code: "RW-TL-07",
    phase: "track_laying",
    name: "Track geometry correction — dynamic tamping, lining, profiling (DTM)",
    unit: "km",
    productivityRate: { min: 2.0, max: 5.0, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "DTM Machine Operator", count: 2 },
      { role: "Spot-attention Gang", count: 10 },
    ],
    equipment: ["Dynamic tamping machine (Duomatic/Unimat)", "Ballast regulator", "Track trolley"],
    predecessors: [{ taskCode: "RW-TL-06", type: "FS", lagDays: 7 }],
    isCodeRef: ["RDSO Track Maintenance Manual TM 01-2003", "IRS T-12"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["Geometry check by Track Recording Car before speed trial", "Defect index ≤ track category limits"],
    remarks: "3 passes of DTM: rough tamping → medium tamping → final; at least 2 passes before speed trial; night machine blocks (NMB) 4 hrs each night; geometry records mandatory",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "Plasser & Theurrer / Matisa / equivalent DTM operator",
  },

  // =========================================================================
  // PHASE 6: STATION WORKS (RW-SW)
  // =========================================================================
  {
    code: "RW-SW-01",
    phase: "station_works",
    name: "Railway platform construction — RCC platform + coping + kerb",
    unit: "Rmt",
    productivityRate: { min: 5, max: 10, unit: "Rmt/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Carpenter", count: 2 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "RW-FE-04", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRS Platform Standard Spec", "NBC 2016", "RPWD Act 2016"],
    dsrRef: "MoR Station Spec",
    safetyChecks: ["Platform height 840mm BG standard (adjust for coach floor)", "Edge strip and tactile pavers for visually impaired"],
    remarks: "BG platform: 840mm high from rail top; length 300m for mail/exp; 600m for local; RCC coping with granite or kota stone face; tactile paving mandatory; yellow line 1.5m from edge",
    isCore: true,
  },
  {
    code: "RW-SW-02",
    phase: "station_works",
    name: "Station building — Passenger Amenity Block (waiting hall, booking, toilets)",
    unit: "Sqm",
    productivityRate: { min: 20, max: 40, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Mason", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    predecessors: [{ taskCode: "RW-SI-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["NBC 2016", "IS 456", "IS 1893 (Seismic)"],
    dsrRef: "MoR Station Architecture Spec",
    safetyChecks: ["Sanitation: 1 toilet per 50 pax (BIS standard)", "Fire NOC from DFS before revenue service"],
    remarks: "Minimum amenities: waiting hall, booking window, water kiosk, toilets; Graded C/D stations have simple buildings; A/B stations need circulation concourse + lift + escalator per NDLS specs",
    isCore: true,
  },
  {
    code: "RW-SW-03",
    phase: "station_works",
    name: "Foot-over-bridge (FOB) — RCC or steel lattice girder",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per FOB" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Steel Erector", count: 6 },
      { role: "Carpenter", count: 4 },
      { role: "Labourer", count: 10 },
    ],
    equipment: ["Mobile crane 30T", "Aerial work platform"],
    predecessors: [{ taskCode: "RW-SW-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IRS FOB Spec", "NBC 2016", "IS 875 (Load)"],
    dsrRef: "MoR Station Spec",
    safetyChecks: [
      "FOB launch over live track: block working with traffic controller",
      "Anti-climb height from rail 5.5m minimum",
      "Structural load test before opening",
    ],
    remarks: "One FOB per station mandatory; width 3m minimum for BG; steel lattice preferred for speed; launching over live track needs block protection at night",
    isCore: true,
  },
  {
    code: "RW-SW-04",
    phase: "station_works",
    name: "Station utilities — water supply, sanitation, power supply, lighting",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "MEP Engineer", count: 1 },
      { role: "Electrician", count: 3 },
      { role: "Plumber", count: 2 },
    ],
    predecessors: [{ taskCode: "RW-SW-02", type: "SS", lagDays: 14 }],
    isCodeRef: ["NBC Part-4", "IS 3034"],
    dsrRef: "MoR Station Spec",
    safetyChecks: ["HT connection from DISCOM approved before energisation", "DG set with auto changeover"],
    remarks: "DG backup for station lighting; solar PV on station rooftop (Railway solar mission); WiFi / PA system from Railways telecom backbone",
    isCore: true,
  },
  {
    code: "RW-SW-05",
    phase: "station_works",
    name: "Loco shed, crew lobby and running room (terminal and major stations)",
    unit: "Sqm",
    productivityRate: { min: 20, max: 40, unit: "Sqm/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "MEP Engineer", count: 1 },
      { role: "Carpenter", count: 4 },
      { role: "Labourer", count: 8 },
    ],
    predecessors: [{ taskCode: "RW-SW-02", type: "SS", lagDays: 0 }],
    isCodeRef: ["Railway Board loco shed standards"],
    dsrRef: "MoR Workshop Spec",
    safetyChecks: ["Pit-over inspection pits — minimum 1.5m depth", "Overhead clearance for pantograph 7.5m"],
    remarks: "Terminal stations need loco shed (inspection + stabling), crew lobby (rest rooms, medical room), and running room (dormitory for outstation crew); separate tracks for loco movement",
    isCore: false,
    isConditional: true,
    applicableProjectTypes: ["new_line"],
  },

  // =========================================================================
  // PHASE 7: SIGNALLING & TELECOM (RW-SG)
  // =========================================================================
  {
    code: "RW-SG-01",
    phase: "signalling_telecom",
    name: "Electronic interlocking (EI) installation and commissioning per station",
    unit: "Each",
    productivityRate: { min: 30, max: 60, unit: "days per station" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Signal & Telecom Engineer (SSE/S&T)", count: 2 },
      { role: "Signal Technician", count: 4 },
      { role: "Cabling Crew", count: 6 },
    ],
    predecessors: [{ taskCode: "RW-TL-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRS S&T Signal Manual", "RDSO EI Spec STS-EI-03", "IEC 62280"],
    dsrRef: "RDSO Signal Spec",
    safetyChecks: ["Fail-safe design verification by RDSO", "All routes proved on ground before traffic", "Interlocking chart checked by Inspector (Signals)"],
    remarks: "EI replaces conventional relay interlocking; SIL 2 certified; RDSO approved systems only (Siemens/Alstom/GE/HBL etc.); point motors, track circuits, signals all interfaced in EI",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
    leadTimeDays: 180,
    requiresSpecialistContractor: true,
    specialistType: "RDSO-approved signal contractor",
  },
  {
    code: "RW-SG-02",
    phase: "signalling_telecom",
    name: "Colour light signals (home, starter, outer) — mast erection and wiring",
    unit: "Each",
    productivityRate: { min: 3, max: 7, unit: "days per signal mast" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Signal Technician", count: 3 },
      { role: "Electrician", count: 2 },
      { role: "Civil Helper", count: 3 },
    ],
    equipment: ["Signal mast (gantry / DF post)", "Cable drum trolley"],
    predecessors: [{ taskCode: "RW-SG-01", type: "SS", lagDays: 0 }],
    isCodeRef: ["IRS S&T Manual", "RDSO Signal Drawing"],
    dsrRef: "RDSO Signal Spec",
    safetyChecks: ["Signal sighting distance ≥ 800m or speed-based", "LED signal lamp tested at all aspects"],
    remarks: "4-aspect LED signals (double yellow, yellow, green, red); SS posts, gantry or bracket mounts depending on track geometry; cable trenching in cess; route indicators at major junctions",
    isCore: true,
  },
  {
    code: "RW-SG-03",
    phase: "signalling_telecom",
    name: "Automatic block signalling (ABS) / CTC — track circuit and axle counters",
    unit: "km",
    productivityRate: { min: 0.1, max: 0.3, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Signal Engineer", count: 2 },
      { role: "Signal Technician", count: 4 },
    ],
    predecessors: [{ taskCode: "RW-SG-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["RDSO ABS Spec STS-ABS-01", "IRS S&T Manual"],
    dsrRef: "RDSO Signal Spec",
    safetyChecks: ["Track circuit insulation tested before energisation", "Axle counter proved for 3 consecutive tests"],
    remarks: "ABS enables multiple trains between stations on 2-km sections; mandatory for high-density lines; axle counters preferred over track circuits in long block sections",
    isCore: false,
    isConditional: true,
    applicableProjectTypes: ["new_line", "doubling"],
  },
  {
    code: "RW-SG-04",
    phase: "signalling_telecom",
    name: "Optical fibre cable (OFC) telecom backbone — trenching, laying, splicing",
    unit: "km",
    productivityRate: { min: 0.5, max: 1.5, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "Telecom Engineer", count: 1 },
      { role: "OFC Splicer", count: 2 },
      { role: "Cable Layer", count: 4 },
    ],
    equipment: ["Cable plough / trencher", "OTDR (for testing)", "Fusion splicer"],
    predecessors: [{ taskCode: "RW-FE-04", type: "SS", lagDays: 0 }],
    isCodeRef: ["TEC Specifications", "RDSO Telecom Spec"],
    dsrRef: "MoR Telecom Manual",
    safetyChecks: ["OFC duct at 1.2m depth minimum in cess", "OTDR test at every 2 km splice point"],
    remarks: "96-core OFC in HDPE duct; buried in cess alongside formation; splicing at every 2 km; termination at each station building; carries EI data, voice (railway phone), CCTV, and GSM-R backbone",
    isCore: true,
  },
  {
    code: "RW-SG-05",
    phase: "signalling_telecom",
    name: "RDSO signal acceptance test — T&C, commissioning, traffic handover",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Signal Inspector", count: 2 },
      { role: "Commissioning Engineer", count: 1 },
      { role: "RDSO Representative", count: 1 },
    ],
    predecessors: [
      { taskCode: "RW-SG-01", type: "FS", lagDays: 0 },
      { taskCode: "RW-SG-02", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["RDSO Commissioning Manual", "IRS S&T Manual"],
    dsrRef: "RDSO Signal Commissioning Spec",
    safetyChecks: ["All routes tested with actual train run", "Failure mode analysis (FMA) documented"],
    remarks: "Signal commissioning: all tests per RDSO schedule; traffic handover only after SSE(S&T) route clearance certificate; can be done station-by-station as sections open",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
  },

  // =========================================================================
  // PHASE 8: TRACTION & POWER — ELECTRIFIED LINES ONLY (RW-TP)
  // =========================================================================
  {
    code: "RW-TP-01",
    phase: "traction_power",
    name: "OHE mast foundation and mast erection (25kV AC, BG)",
    unit: "Each",
    productivityRate: { min: 5, max: 10, unit: "Each/day" },
    monsoonImpactFactor: 1.30,
    crew: [
      { role: "Electrical Engineer (OHE)", count: 1 },
      { role: "OHE Crew", count: 6 },
      { role: "Crane Operator", count: 1 },
    ],
    equipment: ["Mobile crane 10T", "Mast drilling rig", "Concrete mixer"],
    predecessors: [{ taskCode: "RW-FE-04", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRS OHE Manual", "RDSO OHE Drawing ETI/OHE", "IS 3043"],
    dsrRef: "RDSO OHE Spec",
    safetyChecks: ["Mast verticality ±1:500", "Foundation depth per OHE design (min 2.5m)"],
    remarks: "1 mast every 50–65m; 9 masts/km approx on straight; concrete foundation M25; galvanised steel mast 9–10m height; cantilever on straight, staggered ±200mm",
    isCore: true,
    isElectrifiedOnly: true,
    leadTimeDays: 60,
  },
  {
    code: "RW-TP-02",
    phase: "traction_power",
    name: "OHE wiring and stringing — catenary + contact wire, tensioning",
    unit: "km",
    productivityRate: { min: 0.3, max: 0.8, unit: "km/day" },
    monsoonImpactFactor: 1.20,
    crew: [
      { role: "OHE Engineer", count: 2 },
      { role: "OHE Crew", count: 8 },
    ],
    equipment: ["OHE wiring train (tower wagon)", "Tension machine (15kN)", "Clipping tool"],
    predecessors: [{ taskCode: "RW-TP-01", type: "FS", lagDays: 0 }],
    isCodeRef: ["IRS OHE Manual", "RDSO OHE Spec ETI/OHE", "IS 11421"],
    dsrRef: "RDSO OHE Spec",
    safetyChecks: [
      "Contact wire height: 5.3m (normal) / 4.8m (min at level crossings)",
      "Stagger ±200mm maximum",
      "Section gaps at stations — 4-track section gaps",
    ],
    remarks: "Catenary: 65 mm² hard-drawn copper; contact wire: 107 mm² grooved copper; pre-sag method; tensioned to 15 kN each; section insulators at every electrical section",
    isCore: true,
    isElectrifiedOnly: true,
    requiresSpecialistContractor: true,
    specialistType: "RDSO-approved OHE contractor (Kalpataru / KEC / L&T Power)",
  },
  {
    code: "RW-TP-03",
    phase: "traction_power",
    name: "Traction substation (TSS) and switching stations — civil + HT equipment",
    unit: "Each",
    productivityRate: { min: 90, max: 150, unit: "days per substation" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "Power Engineer", count: 2 },
      { role: "HT Electrician", count: 6 },
      { role: "Civil Engineer", count: 1 },
    ],
    predecessors: [{ taskCode: "RW-SI-03", type: "FS", lagDays: 30 }],
    isCodeRef: ["CEA Regulations 2010", "IS 11171", "RDSO OHE Power Supply Spec"],
    dsrRef: "RDSO Traction Power Spec",
    safetyChecks: ["CEA approval before 220kV/132kV energisation", "Earth resistance <0.5 ohm"],
    remarks: "TSS every 40–80 km (BT supply); 2×25 kV AT system on high-speed routes (TSS every 50–100 km); 220/25kV transformer; CEA approval mandatory; separate Civil + HT contracts",
    isCore: true,
    isElectrifiedOnly: true,
    isCriticalPath: true,
    leadTimeDays: 180,
    requiresSpecialistContractor: true,
    specialistType: "HT electrical contractor with CEA-licensed engineers",
  },
  {
    code: "RW-TP-04",
    phase: "traction_power",
    name: "CEA clearance and trial run under 25kV electric traction",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrical Inspector (CEA)", count: 1 },
      { role: "Traction Engineer", count: 2 },
    ],
    predecessors: [
      { taskCode: "RW-TP-02", type: "FS", lagDays: 0 },
      { taskCode: "RW-TP-03", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["CEA Regulations 2010", "RDSO OHE Manual", "Electricity Act 2003"],
    dsrRef: "CEA Inspection Guidelines",
    safetyChecks: ["No personnel on formation when OHE energised", "Earthing of all metallic structures verified"],
    remarks: "CEA (Chief Electrical Authority) inspects 25kV OHE before first electric loco run; earthing of all metallic structures mandatory; voltage trial at 20 km/h before speed escalation",
    taskCategory: "A",
    isCore: true,
    isElectrifiedOnly: true,
    isCriticalPath: true,
  },

  // =========================================================================
  // PHASE 9: TESTING & COMMISSIONING (RW-TC)
  // =========================================================================
  {
    code: "RW-TC-01",
    phase: "testing_commissioning",
    name: "Track geometry measurement — RTGM/MTGM car over full alignment",
    unit: "km",
    productivityRate: { min: 5, max: 15, unit: "km/day" },
    monsoonImpactFactor: 1.10,
    crew: [
      { role: "P-Way Engineer", count: 1 },
      { role: "TRC Operator", count: 2 },
      { role: "Spot Correction Gang", count: 10 },
    ],
    equipment: ["Track Recording Car (TRC) or portable TGM"],
    predecessors: [{ taskCode: "RW-TL-07", type: "FS", lagDays: 0 }],
    isCodeRef: ["RDSO Track Maintenance Manual TM 01-2003", "IRS T-12"],
    dsrRef: "MoR P-Way Manual",
    safetyChecks: ["TRC readings reviewed by P-Way Inspector before speed trial", "Speed restriction on all defects until corrected"],
    remarks: "Gauge, cross level, twist, alignment, unevenness — all measured; TRC report reviewed by SSE(PW); track brought to TM-0 level before 60 km/h; corrective tamping wherever defects exceed limits",
    isCore: true,
  },
  {
    code: "RW-TC-02",
    phase: "testing_commissioning",
    name: "Speed trial — empty stock / loco (40 → 80 → 100 km/h escalation)",
    unit: "LS",
    productivityRate: { min: 30, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Divisional Railway Manager (inspection)", count: 1 },
      { role: "SSE(PW) / SSE(S&T)", count: 2 },
      { role: "Loco Pilot", count: 2 },
    ],
    predecessors: [
      { taskCode: "RW-TC-01", type: "FS", lagDays: 0 },
      { taskCode: "RW-SG-05", type: "FS", lagDays: 0 },
    ],
    isCodeRef: ["RDSO Speed Trial Manual", "Railways Act 1989 Sec 21"],
    dsrRef: "MoR Speed Trial Guidelines",
    safetyChecks: [
      "All bridges inspected and proof-loaded before speed trial",
      "Speed restriction boards in place at curves, bridges",
      "OHE live on correct sections before trial (electrified)",
    ],
    remarks: "Progressive speed escalation; CRS must witness or receive report at each stage before granting further clearance; typically 40→60→80→100 km/h in 10-day intervals; slow-speed run to check track and OB first",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
  },
  {
    code: "RW-TC-03",
    phase: "testing_commissioning",
    name: "CRS inspection — Commissioner of Railway Safety inspection and certificate",
    unit: "LS",
    productivityRate: { min: 14, max: 60, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "CRS (Government official)", count: 1 },
      { role: "Project Director", count: 1 },
      { role: "Divisional Railway Manager", count: 1 },
    ],
    predecessors: [{ taskCode: "RW-TC-02", type: "FS", lagDays: 0 }],
    isCodeRef: ["Railways Act 1989 Sec 17", "Railway Board CRS Guideline"],
    dsrRef: "CRS Inspection Guidelines",
    safetyChecks: ["All deficiencies from CRS report rectified before certificate", "Statutory inspection report filed"],
    remarks: "CRS inspection mandatory for new lines, major alterations, and doubling; CRS rides pilot loco + inspection coach; deficiency list issued; certificate not time-bound — can take 1–6 months; political pressure should never bypass CRS certificate",
    taskCategory: "A",
    isCore: true,
    isCriticalPath: true,
    leadTimeDays: 30,
  },
  {
    code: "RW-TC-04",
    phase: "testing_commissioning",
    name: "Revenue service launch — staff readiness, timetabling, inaugural run",
    unit: "LS",
    productivityRate: { min: 7, max: 21, unit: "days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Divisional Operations Manager", count: 1 },
      { role: "Station Master (trained)", count: 5 },
      { role: "Guard / Loco Pilot (trained)", count: 10 },
    ],
    predecessors: [{ taskCode: "RW-TC-03", type: "FS", lagDays: 0 }],
    isCodeRef: ["Railways Act 1989", "IR Working Rules (GR & SR)"],
    dsrRef: "MoR Operations Manual",
    safetyChecks: ["All staff medically fit and tested", "Train Working Rules assessment done"],
    remarks: "Inaugural special train typically flagged by Railway Minister or CM; regular timetable trains start within 1–2 weeks of inaugural; booking commences online before inaugural; crew lobby and running room must be ready",
    isCore: true,
  },
];

// ---------------------------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------------------------

export function getRailwayTasks(
  projectType: RailwayProjectType,
  isElectrified: boolean,
): RailwayTaskTemplate[] {
  return ALL_RAILWAY_TASKS.filter(t => {
    if (t.isElectrifiedOnly && !isElectrified) return false;
    if (t.applicableProjectTypes && !t.applicableProjectTypes.includes(projectType)) return false;
    return t.isCore;
  });
}

export const RAILWAY_TYPES: RailwayProjectType[] = [
  "new_line",
  "doubling",
  "gauge_conversion",
  "station_redevelopment",
];
