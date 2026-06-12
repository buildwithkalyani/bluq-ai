// ICD / Dry Port / Private Freight Terminal Task Library
// Covers: Inland Container Depot (ICD), Container Freight Station (CFS),
//         Private Freight Terminal (PFT), Private Goods Terminal (PGT)
// Standards: Customs Act 1962, CBIC circulars, MoR PFT/GFT Policy 2012, IRC 58

export type ICDPhase =
  | "surveys_investigations"
  | "site_preparation"
  | "civil_earthworks"
  | "pavement_yard"
  | "rail_siding"
  | "customs_facilities"
  | "warehousing_sheds"
  | "utilities"
  | "equipment_installation"
  | "systems_gate"
  | "commissioning_handover";

export type ICDType =
  | "icd_rail_linked"          // full ICD with rail siding — gets CBIC ICD notification
  | "icd_road_linked"          // road-only CFS — gets CBIC CFS notification
  | "private_freight_terminal" // MoR PFT/GFT — rail freight on private siding
  | "goods_shed";              // simple railway goods shed / parcel depot

export type ICDUnit =
  | "Sqm" | "Cum" | "Rmt" | "No" | "MT" | "Lot" | "LS" | "Set" | "KVA" | "Km" | "TEU";

interface ProductivityRate { min: number; max: number; unit: string; }
interface CrewMember { role: string; count: number; }
interface Predecessor { taskCode: string; lagDays?: number; type: "FS" | "SS" | "FF" | "SF"; }

export interface ICDTaskTemplate {
  code: string;
  phase: ICDPhase;
  name: string;
  unit: ICDUnit;
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
  applicableICDTypes?: ICDType[];
  excludedICDTypes?: ICDType[];
  conditions?: Array<{ field: string; operator: "==" | "!=" | ">=" | "<=" | ">" | "<"; value: string | number | boolean; }>;
}

// ─── Phase 1: Surveys & Investigations ────────────────────────────────────────

const SURVEY_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey and site layout planning",
    unit: "Sqm",
    productivityRate: { min: 30000, max: 80000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Survey Engineer", count: 1 }, { role: "Surveyor", count: 2 }],
    equipment: ["Total station", "DGPS"],
    predecessors: [],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Boundary demarcation", "Utility mapping"],
    remarks: "ICD typically 20–100 ha; CFS 5–20 ha; layout to show customs-bonded zone, export/import separation, rail/road entry/exit segregation",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation — pavement and foundation design",
    unit: "No",
    productivityRate: { min: 2, max: 4, unit: "Bore holes/day" },
    monsoonImpactFactor: 1.4,
    crew: [{ role: "Geotechnical Engineer", count: 1 }, { role: "Rig Operator", count: 1 }],
    equipment: ["Bore hole rig", "SPT equipment"],
    predecessors: [{ taskCode: "IC-SI-01", type: "FS" }],
    isCodeRef: ["IS 1892"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Bore hole barricading"],
    remarks: "CBR required for heavy-duty pavement design (reach stacker 45T, RTG 70T/wheel); expansive soil = lime treatment; 1 borehole per 3000 sqm",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-SI-03",
    phase: "surveys_investigations",
    name: "MoR in-principle approval for PFT/GFT designation",
    unit: "LS",
    productivityRate: { min: 90, max: 270, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Railway Consultant", count: 2 }, { role: "Project Manager", count: 1 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-SI-01", type: "FS" }],
    isCodeRef: ["MoR PFT Policy 2012", "MoR GFT Policy 2012"],
    dsrRef: "MoR circular",
    safetyChecks: ["MoR approval before siding construction"],
    remarks: "Rail-linked ICD and PFT/GFT only; DPR submission to MoR; Traffic forecast; Junction station approval; cost sharing for last-mile connectivity",
    taskCategory: "A",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal", "goods_shed"],
  },
  {
    code: "IC-SI-04",
    phase: "surveys_investigations",
    name: "CBIC ICD/CFS site approval and licensing",
    unit: "LS",
    productivityRate: { min: 90, max: 365, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Customs Consultant", count: 1 }, { role: "Project Manager", count: 1 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-SI-01", type: "FS" }],
    isCodeRef: ["Customs Act 1962 Section 7", "CBIC circular 18/2019"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["CBIC site inspection passed", "Security plan approved"],
    remarks: "CBIC notification under Customs Act Section 7; site survey by Customs; minimum area 10 ha for ICD, 3 ha for CFS; ECTS and CCTV mandatory",
    taskCategory: "A",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
];

// ─── Phase 2: Site Preparation ────────────────────────────────────────────────

const SITE_PREP_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-SP-01",
    phase: "site_preparation",
    name: "Site clearance, grubbing and perimeter compound wall",
    unit: "Rmt",
    productivityRate: { min: 20, max: 50, unit: "Rmt/day" },
    monsoonImpactFactor: 1.4,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Mason", count: 6 }, { role: "Labour", count: 12 }],
    equipment: ["Bulldozer", "Concrete mixer"],
    predecessors: [{ taskCode: "IC-SI-04", type: "FS" }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Land possession certificate", "Customs perimeter approval"],
    remarks: "2.4m RCC compound wall with barbed wire top; customs-approved perimeter design; no openings other than approved gates; CCTV coverage of full perimeter",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-SP-02",
    phase: "site_preparation",
    name: "Bulk earthworks — platform preparation for yard and sheds",
    unit: "Cum",
    productivityRate: { min: 1000, max: 3000, unit: "Cum/day" },
    monsoonImpactFactor: 2.0,
    crew: [{ role: "Site Engineer", count: 1 }, { role: "Excavator Operator", count: 2 }, { role: "Dumper Driver", count: 5 }, { role: "Labour", count: 8 }],
    equipment: ["Hydraulic excavator", "Tipper × 5", "Motor grader", "Vibratory roller"],
    predecessors: [{ taskCode: "IC-SP-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 3764"],
    dsrRef: "MORTH 2019 Item 301",
    safetyChecks: ["CBR testing on compacted fill", "Slope stability"],
    remarks: "Platform 300mm above HFL; fill in 300mm layers; CBR ≥ 8% for yard pavement; level tolerance ±25mm; subgrade proof rolling before pavement",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-SP-03",
    phase: "site_preparation",
    name: "Storm water drainage and perimeter drain",
    unit: "Rmt",
    productivityRate: { min: 40, max: 100, unit: "Rmt/day" },
    monsoonImpactFactor: 1.6,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Labour", count: 8 }],
    equipment: ["Excavator"],
    predecessors: [{ taskCode: "IC-SP-02", type: "SS", lagDays: 21 }],
    isCodeRef: ["IS 4111"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Outfall approval from local body", "Oil interceptor at yard drain"],
    remarks: "RCC box drains graded to outfall; oil and grease trap mandatory at exit; design for 1:25 year storm; separate import/export drainage zones",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 3: Civil Earthworks ─────────────────────────────────────────────────

const CIVIL_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-CE-01",
    phase: "civil_earthworks",
    name: "Granular sub-base (GSB) and drainage course for yard",
    unit: "Sqm",
    productivityRate: { min: 1000, max: 3000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.6,
    crew: [{ role: "Highway Engineer", count: 1 }, { role: "Operator", count: 3 }, { role: "Labour", count: 8 }],
    equipment: ["Motor grader", "Vibratory roller", "Tipper"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS" }],
    isCodeRef: ["MORTH 2019 Table 400-1", "IRC 37"],
    dsrRef: "MORTH 2019 Item 401",
    safetyChecks: ["Gradation test certificate per batch", "Compaction to 98% MDD"],
    remarks: "400mm GSB for RTG/reach stacker yard; 250mm for light vehicle roads; material to MORTH specification; DCP test for each layer",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-CE-02",
    phase: "civil_earthworks",
    name: "Wet Mix Macadam (WMM) base course",
    unit: "Sqm",
    productivityRate: { min: 500, max: 1500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.7,
    crew: [{ role: "Highway Engineer", count: 1 }, { role: "Operator", count: 2 }, { role: "Labour", count: 8 }],
    equipment: ["Paver", "Vibratory roller", "Tipper"],
    predecessors: [{ taskCode: "IC-CE-01", type: "FS" }],
    isCodeRef: ["MORTH 2019 Item 406", "IS 2386"],
    dsrRef: "MORTH 2019 Item 406",
    safetyChecks: ["Core density test", "Gradation certificate"],
    remarks: "250mm WMM; only for flexible pavement zones (road links, light vehicle areas); yard under containers uses direct PQC on GSB",
    taskCategory: "B",
    isCore: false,
  },
];

// ─── Phase 4: Pavement & Yard ──────────────────────────────────────────────────

const PAVEMENT_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-PY-01",
    phase: "pavement_yard",
    name: "Container yard — heavy-duty PQC pavement",
    unit: "Sqm",
    productivityRate: { min: 150, max: 400, unit: "Sqm/day" },
    monsoonImpactFactor: 1.5,
    crew: [{ role: "Highway Engineer", count: 1 }, { role: "Operator", count: 3 }, { role: "Labour", count: 12 }],
    equipment: ["Slip form paver", "Dowel bar inserter", "Texturing machine", "Curing compound sprayer"],
    predecessors: [{ taskCode: "IC-CE-01", type: "FS" }],
    isCodeRef: ["IRC 58", "IS 456"],
    dsrRef: "MORTH 2019 Item 602",
    safetyChecks: ["Cube strength M45 at 28 days", "Dowel and tie bar position check", "Floor flatness per TR34"],
    remarks: "M45 PQC 350–400mm for 4-high stacking under reach stacker; joint spacing 4.5m; Dowel bars @ 300mm spacing; 28-day cure before loading",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-PY-02",
    phase: "pavement_yard",
    name: "Internal roads — flexible pavement (DBM+BC) for trucks",
    unit: "Sqm",
    productivityRate: { min: 300, max: 700, unit: "Sqm/day" },
    monsoonImpactFactor: 1.6,
    crew: [{ role: "Highway Engineer", count: 1 }, { role: "Operator", count: 2 }, { role: "Labour", count: 8 }],
    equipment: ["Paver", "Tandem roller", "Pneumatic roller"],
    predecessors: [{ taskCode: "IC-CE-02", type: "FS" }],
    isCodeRef: ["IRC 37", "MORTH 2019"],
    dsrRef: "MORTH 2019 Item 507",
    safetyChecks: ["Compaction test (Marshall density)", "Temperature at paving ≥ 135°C"],
    remarks: "For truck roads, tractor-trailer routes; 65mm DBM + 40mm BC; design for 30MSA; separate from reach stacker container yard",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-PY-03",
    phase: "pavement_yard",
    name: "Import and export yard marking, lane delineation",
    unit: "Sqm",
    productivityRate: { min: 500, max: 1500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.1,
    crew: [{ role: "Supervisor", count: 1 }, { role: "Labour", count: 4 }],
    equipment: ["Line marking machine"],
    predecessors: [{ taskCode: "IC-PY-01", type: "FS", lagDays: 7 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Customs-approved bay numbering", "Hazmat zone markings"],
    remarks: "Separate import, export, empty, and hazmat zones mandatory per Customs; bay numbering per TOS/CMS; retroreflective paint; segregation verified by CBIC",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-PY-04",
    phase: "pavement_yard",
    name: "Open cargo yard — warehouse/goods storage area pavement",
    unit: "Sqm",
    productivityRate: { min: 200, max: 500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.5,
    crew: [{ role: "Highway Engineer", count: 1 }, { role: "Labour", count: 10 }],
    equipment: ["Paver", "Roller"],
    predecessors: [{ taskCode: "IC-CE-01", type: "FS" }],
    isCodeRef: ["IRC 58"],
    dsrRef: "MORTH 2019",
    safetyChecks: ["Cube strength check", "Drainage gradient 0.5%"],
    remarks: "For general cargo, over-dimensional cargo (ODC); M35 PQC 250mm; covered shed adjacent; forklift access ramps at 1:10",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 5: Rail Siding ──────────────────────────────────────────────────────

const RAIL_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-RS-01",
    phase: "rail_siding",
    name: "Rail siding formation and earthworks",
    unit: "Rmt",
    productivityRate: { min: 80, max: 200, unit: "Rmt/day" },
    monsoonImpactFactor: 2.0,
    crew: [{ role: "Railway Engineer", count: 1 }, { role: "Operator", count: 2 }, { role: "Labour", count: 8 }],
    equipment: ["Excavator", "Motor grader", "Vibratory roller"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRS GE-1"],
    dsrRef: "MoR SOR",
    safetyChecks: ["MoR formation approval", "Gradient ≤ 1:400 in loading/unloading area"],
    remarks: "BG 1676mm; gradient ≤ 1:400; min 3 sidings for simultaneous loading/unloading; loop siding length = 700m (standard rake); siding for loco stabling",
    taskCategory: "B",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal", "goods_shed"],
  },
  {
    code: "IC-RS-02",
    phase: "rail_siding",
    name: "Rail track laying — ballast, sleepers, rails and fastenings",
    unit: "Rmt",
    productivityRate: { min: 40, max: 100, unit: "Rmt/day" },
    monsoonImpactFactor: 1.5,
    crew: [{ role: "Permanent Way Inspector", count: 1 }, { role: "Track Layer", count: 8 }, { role: "Labour", count: 10 }],
    equipment: ["Rail laying machine", "Tamping machine"],
    predecessors: [{ taskCode: "IC-RS-01", type: "FS" }],
    isCodeRef: ["IRS T-12", "IRS T-44"],
    dsrRef: "MoR SOR",
    safetyChecks: ["MoR track inspector sign-off", "Buffer stop installation", "Cant and alignment check"],
    remarks: "60kg/m UIC rail; PSC sleepers @ 650mm; elastic fastenings; Thermit welding at joints; buffer stops at dead ends; 300mm clean crushed stone ballast",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 45,
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal", "goods_shed"],
  },
  {
    code: "IC-RS-03",
    phase: "rail_siding",
    name: "Points, crossings and panel interlocking",
    unit: "No",
    productivityRate: { min: 0.5, max: 1, unit: "No/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "S&T Engineer", count: 1 }, { role: "Track Layer", count: 4 }],
    equipment: ["Signal testing equipment"],
    predecessors: [{ taskCode: "IC-RS-02", type: "SS", lagDays: 30 }],
    isCodeRef: ["IRS S-34"],
    dsrRef: "MoR SOR",
    safetyChecks: ["MoR S&T inspection and approval", "Derail clearance test"],
    remarks: "1:8.5 turnouts for yard; 1:12 on main line connection; relay panel interlocking; MoR S&T Inspector approval mandatory before use",
    taskCategory: "B",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "MoR approved S&T contractor",
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal", "goods_shed"],
  },
  {
    code: "IC-RS-04",
    phase: "rail_siding",
    name: "Last-mile rail connectivity to mainline junction station",
    unit: "Km",
    productivityRate: { min: 0.1, max: 0.25, unit: "Km/day" },
    monsoonImpactFactor: 1.8,
    crew: [{ role: "Railway Engineer", count: 1 }, { role: "Permanent Way Inspector", count: 1 }, { role: "Labour", count: 15 }],
    equipment: ["Track laying machine", "Tamper"],
    predecessors: [{ taskCode: "IC-RS-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IRS GE-1"],
    dsrRef: "MoR SOR",
    safetyChecks: ["MoR block possession safety protocol", "Buffer stop at terminal end"],
    remarks: "Connection to nearest mainline station or yard; MoR block possession for connection; speed restriction on new siding until inspected; cost per MoR PFT policy",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "MoR approved EPC contractor",
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal"],
  },
];

// ─── Phase 6: Customs Facilities ──────────────────────────────────────────────

const CUSTOMS_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-CF-01",
    phase: "customs_facilities",
    name: "Customs examination shed — bonded construction",
    unit: "Sqm",
    productivityRate: { min: 20, max: 50, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Mason", count: 5 }, { role: "Labour", count: 10 }],
    equipment: ["Batching plant", "Vibrator"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 21 }],
    isCodeRef: ["Customs Act 1962", "CBIC circular"],
    dsrRef: "DSR 2021",
    safetyChecks: ["CBIC physical verification of shed", "Double lock on all doors", "CCTV coverage 100%"],
    remarks: "RCC structure; tamper-proof construction; min 3m clear height; bonded zone must be physically segregated from general area; no windows below 3m on bonded side",
    taskCategory: "B",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
  {
    code: "IC-CF-02",
    phase: "customs_facilities",
    name: "Scanner building and heavy X-ray scanner installation",
    unit: "No",
    productivityRate: { min: 0.3, max: 0.7, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Electrical Engineer", count: 1 }, { role: "OEM Technician", count: 3 }],
    equipment: ["Crane"],
    predecessors: [{ taskCode: "IC-CF-01", type: "SS", lagDays: 30 }],
    isCodeRef: ["CBIC scanner installation guidelines", "Atomic Energy Regulatory Board (AERB)"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["AERB radiation safety certificate", "Shielding design approved by AERB", "Operator dosimetry badges"],
    remarks: "CBIC mandates scanner at notified ICDs; AERB approval for radiation safety before commissioning; separate truck lane for scanner; 6m headroom",
    taskCategory: "B",
    isCore: false,
    leadTimeDays: 270,
    requiresSpecialistContractor: true,
    specialistType: "CBIC-empanelled scanner vendor (BSES / Smiths / Nuctech)",
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
  {
    code: "IC-CF-03",
    phase: "customs_facilities",
    name: "Customs officer facilities — office, strong room, sample room",
    unit: "Sqm",
    productivityRate: { min: 15, max: 35, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Mason", count: 4 }, { role: "Labour", count: 6 }],
    equipment: ["Batching plant"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 30 }],
    isCodeRef: ["CBIC circular"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Handover to Customs Officer", "Safe room specifications met"],
    remarks: "Provided to Customs free of cost by concession holder; includes examination office, sample room with locked cupboards, rest room; OFC connectivity",
    taskCategory: "B",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
  {
    code: "IC-CF-04",
    phase: "customs_facilities",
    name: "Container weighing — static weighbridge for customs",
    unit: "No",
    productivityRate: { min: 0.3, max: 0.7, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Fitter", count: 2 }],
    equipment: ["Crane"],
    predecessors: [{ taskCode: "IC-PY-02", type: "FS", lagDays: 30 }],
    isCodeRef: ["Weights and Measures Act", "IS 9747", "SOLAS VGM rules"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Legal Metrology stamp", "VGM compliance certificate"],
    remarks: "100T capacity; Legal Metrology Department calibration; SOLAS VGM compliant for export containers; data integrated to CTMS/TOS",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 45,
  },
];

// ─── Phase 7: Warehousing & Sheds ─────────────────────────────────────────────

const WAREHOUSE_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-WH-01",
    phase: "warehousing_sheds",
    name: "Transit shed / covered goods shed — PEB structure",
    unit: "Sqm",
    productivityRate: { min: 80, max: 200, unit: "Sqm/day" },
    monsoonImpactFactor: 1.3,
    crew: [{ role: "Structural Engineer", count: 1 }, { role: "Steel Erector", count: 6 }, { role: "Labour", count: 10 }],
    equipment: ["Mobile crane 40T", "Bolt tools"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 800", "NBC 2016"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Foundation bolt torque check", "Crane lift plan", "Fire NOC"],
    remarks: "Clear span 18–24m; eave height 6–8m; PUF insulated roofing; gutters and downpipes; 10% natural lighting via translucent sheets; floor hardened slab",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 45,
    requiresSpecialistContractor: true,
    specialistType: "PEB manufacturer",
  },
  {
    code: "IC-WH-02",
    phase: "warehousing_sheds",
    name: "Shed floor — hardened industrial slab",
    unit: "Sqm",
    productivityRate: { min: 300, max: 800, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Mason", count: 5 }, { role: "Labour", count: 10 }],
    equipment: ["Laser screed", "Power trowel"],
    predecessors: [{ taskCode: "IC-WH-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 456", "TR 34"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Flatness FM2 per TR34", "28-day cure before forklift use"],
    remarks: "M35 PQC 150mm; wire mesh; hardener finish; loading dock 1.2m height; dock levellers at one end; ramps at other end for tractor-trailer",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-WH-03",
    phase: "warehousing_sheds",
    name: "Stuffing / destuffing (LCL) facility",
    unit: "Sqm",
    productivityRate: { min: 20, max: 60, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Mason", count: 4 }, { role: "Labour", count: 6 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-WH-01", type: "SS", lagDays: 21 }],
    isCodeRef: ["CBIC LCL guidelines"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Customs-verified stuffing/destuffing procedure area", "CCTV mandatory in stuffing area"],
    remarks: "Separate area for LCL (Less-than-Container-Load) consolidation; under customs supervision; ramp-level access for container positioning; forklift access",
    taskCategory: "B",
    isCore: false,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
  {
    code: "IC-WH-04",
    phase: "warehousing_sheds",
    name: "Hazardous goods / DG cargo storage area",
    unit: "Sqm",
    productivityRate: { min: 10, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.1,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "HSE Officer", count: 1 }, { role: "Labour", count: 4 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 45 }],
    isCodeRef: ["IMDG Code", "Explosives Rules 2008", "CBIC DG guidelines"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Bund wall for liquid chemicals", "Explosion-proof fittings", "Fire NOC", "Petroleum NOC if applicable"],
    remarks: "Separate isolated area; 50m from other structures; bund wall for Class 3 (flammable liquids); sparks-proof electrical; segregation per IMDG class",
    taskCategory: "B",
    isCore: false,
    requiresSpecialistContractor: false,
  },
];

// ─── Phase 8: Utilities ────────────────────────────────────────────────────────

const UTILITIES_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-UT-01",
    phase: "utilities",
    name: "HT power supply, substation and yard lighting",
    unit: "KVA",
    productivityRate: { min: 500, max: 2000, unit: "KVA/week" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Electrical Engineer", count: 1 }, { role: "Electrician", count: 4 }, { role: "Labour", count: 4 }],
    equipment: ["Crane", "Cable pulling machine"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS", lagDays: 21 }],
    isCodeRef: ["IS 2026", "CEA Regulations"],
    dsrRef: "DSR 2021",
    safetyChecks: ["CEA energisation", "Earth resistance < 1 Ω", "Yard lighting lux ≥ 30 for night ops"],
    remarks: "11kV substation; yard lighting on 12m mast 30 lux min for 24/7 operations; DG backup for scanner, customs, CCTV, TOS; reefer power sockets in yard",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
  },
  {
    code: "IC-UT-02",
    phase: "utilities",
    name: "Water supply, firefighting reservoir and yard washing system",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.3,
    crew: [{ role: "Civil Engineer", count: 1 }, { role: "Plumber", count: 2 }],
    equipment: ["Boring rig", "Pump set"],
    predecessors: [{ taskCode: "IC-SP-02", type: "FS" }],
    isCodeRef: ["NBC Part 9", "TAC fire reserve"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Fire reserve capacity verified by TAC", "Hydrant pressure test"],
    remarks: "500 KL fire reserve + 100 KL operational; hydrant ring with 45mm outlets @ 45m spacing; high-pressure yard washing for container cleaning",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "IC-UT-03",
    phase: "utilities",
    name: "Effluent treatment — container wash and yard runoff",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.2,
    crew: [{ role: "Environmental Engineer", count: 1 }, { role: "Civil Engineer", count: 1 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-SP-03", type: "FS" }],
    isCodeRef: ["Environment Protection Act 1986", "SPCB discharge norms"],
    dsrRef: "DSR 2021",
    safetyChecks: ["SPCB consent to operate (CTO)", "Effluent quality meets SPCB Class A norms"],
    remarks: "Oil and grease separator + ETP for container wash water; ZLD preferred; recycled treated water for yard washing; SPCB CTO before operation",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 9: Systems & Gate Automation ───────────────────────────────────────

const SYSTEMS_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-SG-01",
    phase: "systems_gate",
    name: "Container Management System (CMS) / Terminal Operating System (TOS)",
    unit: "Set",
    productivityRate: { min: 60, max: 120, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "IT Project Manager", count: 1 }, { role: "System Integrator", count: 2 }],
    equipment: ["Servers", "Workstations"],
    predecessors: [{ taskCode: "IC-UT-01", type: "FS", lagDays: 14 }],
    isCodeRef: ["CBIC ECTS mandate"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["CBIC ICEGATE integration tested", "UAT sign-off", "DR site configured"],
    remarks: "Integration with CBIC ICEGATE mandatory; ECTS (Electronic Cargo Tracking System); Customs EDI interface; rail booking portal integration; mobile app for truck drivers",
    taskCategory: "A",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "TOS/CMS vendor with CBIC integration experience",
  },
  {
    code: "IC-SG-02",
    phase: "systems_gate",
    name: "Gate automation — OCR, RFID, boom barriers, truck appointment",
    unit: "No",
    productivityRate: { min: 0.5, max: 1, unit: "Gates/week" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "IT Engineer", count: 1 }, { role: "Civil Engineer", count: 1 }, { role: "Electrician", count: 2 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-PY-02", type: "FS", lagDays: 30 }],
    isCodeRef: ["CBIC gate procedure guidelines"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["Traffic simulation test", "Night OCR accuracy test ≥ 95%"],
    remarks: "OCR reads container number, ISO type, seal; truck plate recognition; RFID for repeat carriers; integration with customs for seal verification; truck appointment system",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 60,
    requiresSpecialistContractor: true,
    specialistType: "Gate automation specialist (IDENTIX / SOLYSTIC)",
  },
  {
    code: "IC-SG-03",
    phase: "systems_gate",
    name: "CCTV surveillance — yard, customs area, perimeter",
    unit: "No",
    productivityRate: { min: 8, max: 20, unit: "Cameras/week" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Security System Engineer", count: 1 }, { role: "Electrician", count: 2 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-CF-01", type: "SS", lagDays: 30 }],
    isCodeRef: ["CBIC CCTV mandate"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["90-day recording verified by CBIC inspector", "Night vision coverage test"],
    remarks: "Mandatory per CBIC; 90-day recording retention; Customs officer must have access terminal; PTZ cameras on yard; analytics for container movement tracking",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 30,
  },
  {
    code: "IC-SG-04",
    phase: "systems_gate",
    name: "Electronic Cargo Tracking System (ECTS) — GPS seals",
    unit: "Set",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "IT Engineer", count: 1 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-SG-01", type: "FS" }],
    isCodeRef: ["CBIC circular 26/2017"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["GPS tracking live test on transit route", "CBIC verification of seal integrity"],
    remarks: "CBIC mandated for ICDs; e-Seal on containers from port to ICD; GPS tracking by CBIC; integration with ICEGATE; one-time setup cost + per-seal running cost",
    taskCategory: "A",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
];

// ─── Phase 10: Commissioning & Handover ───────────────────────────────────────

const COMMISSIONING_TASKS: ICDTaskTemplate[] = [
  {
    code: "IC-CH-01",
    phase: "commissioning_handover",
    name: "MoR open line inspection — Certificate of Fitness for siding",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Railway Manager", count: 1 }, { role: "MoR Inspector (external)", count: 2 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-RS-03", type: "FS" }, { taskCode: "IC-RS-04", type: "FS" }],
    isCodeRef: ["Indian Railways Act 1989"],
    dsrRef: "MoR circular",
    safetyChecks: ["All safety items on MoR checklist signed off", "Emergency call procedure with loco shed"],
    remarks: "Mandatory before first rake movement; DRM/Sr. DEN inspection; speed restriction 10 km/h until Certificate of Fitness received",
    taskCategory: "A",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "private_freight_terminal", "goods_shed"],
  },
  {
    code: "IC-CH-02",
    phase: "commissioning_handover",
    name: "CBIC final site inspection and issuance of ICD/CFS notification",
    unit: "LS",
    productivityRate: { min: 30, max: 120, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Customs Consultant", count: 1 }, { role: "Project Manager", count: 1 }],
    equipment: [],
    predecessors: [
      { taskCode: "IC-CF-01", type: "FS" },
      { taskCode: "IC-SG-01", type: "FS" },
      { taskCode: "IC-SG-03", type: "FS" },
    ],
    isCodeRef: ["Customs Act 1962 Section 7", "CBIC notification"],
    dsrRef: "CBIC requirement",
    safetyChecks: ["Customs perimeter integrity verified", "All CCTV operational", "Customs staff room ready"],
    remarks: "Critical path gate — ICD cannot operate commercially without this gazette notification; CBIC inspects site + systems; typically 60–90 days from application",
    taskCategory: "A",
    isCore: true,
    applicableICDTypes: ["icd_rail_linked", "icd_road_linked"],
  },
  {
    code: "IC-CH-03",
    phase: "commissioning_handover",
    name: "Trial run — first rake movement and system integration test",
    unit: "LS",
    productivityRate: { min: 7, max: 21, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Operations Manager", count: 1 }, { role: "IT Manager", count: 1 }, { role: "Equipment Operator", count: 3 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-CH-01", type: "FS" }, { taskCode: "IC-CH-02", type: "FS" }],
    isCodeRef: [],
    dsrRef: "Contract specification",
    safetyChecks: ["Emergency drill complete", "Rake shunting SOP approved", "All operators certified"],
    remarks: "Simulated full import cycle: rail in → destuff → customs exam → gate out; simulated export cycle: gate in → stuff → seal → rail out; snag closure",
    taskCategory: "A",
    isCore: true,
  },
  {
    code: "IC-CH-04",
    phase: "commissioning_handover",
    name: "Statutory NOCs — fire NOC, factory licence, environment CTO",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [{ role: "Project Manager", count: 1 }],
    equipment: [],
    predecessors: [{ taskCode: "IC-CH-03", type: "FS" }],
    isCodeRef: ["Factories Act 1948", "Fire Services Act", "Water Act 1974"],
    dsrRef: "State authority",
    safetyChecks: ["All NOCs received before commercial operations"],
    remarks: "Fire NOC mandatory; SPCB CTO for ETP; trade licence from ULB; Factory Act registration if workers > 10 with power; PESO NOC for DG storage",
    taskCategory: "A",
    isCore: true,
  },
];

// ─── All Tasks ────────────────────────────────────────────────────────────────

export const ALL_ICD_TASKS: ICDTaskTemplate[] = [
  ...SURVEY_TASKS,
  ...SITE_PREP_TASKS,
  ...CIVIL_TASKS,
  ...PAVEMENT_TASKS,
  ...RAIL_TASKS,
  ...CUSTOMS_TASKS,
  ...WAREHOUSE_TASKS,
  ...UTILITIES_TASKS,
  ...SYSTEMS_TASKS,
  ...COMMISSIONING_TASKS,
];

// ─── Type Configurations ───────────────────────────────────────────────────────

export interface ICDTypeConfig {
  type: ICDType;
  label: string;
  description: string;
  keyRegulations: string[];
  approvalBody: string;
  criticalGate: string;
}

export const ICD_TYPES: Record<ICDType, ICDTypeConfig> = {
  icd_rail_linked: {
    type: "icd_rail_linked",
    label: "Inland Container Depot (Rail Linked)",
    description: "Full ICD with rail siding; CBIC notification under Customs Act; handles FCL and LCL containers",
    keyRegulations: ["Customs Act 1962 Section 7", "MoR PFT Policy 2012", "CBIC circular 18/2019"],
    approvalBody: "CBIC (Customs) + MoR open line inspection",
    criticalGate: "CBIC gazette notification — cannot operate before this",
  },
  icd_road_linked: {
    type: "icd_road_linked",
    label: "Container Freight Station (Road Linked CFS)",
    description: "Road-linked CFS without rail; CBIC CFS notification; typically near seaport catchment",
    keyRegulations: ["Customs Act 1962 Section 7", "CBIC CFS circular"],
    approvalBody: "CBIC (Customs)",
    criticalGate: "CBIC gazette notification",
  },
  private_freight_terminal: {
    type: "private_freight_terminal",
    label: "Private Freight Terminal (MoR PFT)",
    description: "MoR-designated PFT for originating/terminating freight; rail siding; handles general cargo not containers",
    keyRegulations: ["MoR PFT Policy 2012", "Indian Railways Act 1989"],
    approvalBody: "MoR Certificate of Fitness + DRM open line",
    criticalGate: "MoR Certificate of Fitness — no train movement before this",
  },
  goods_shed: {
    type: "goods_shed",
    label: "Railway Goods Shed / Parcel Depot",
    description: "Small-scale railway goods handling facility; typically at wayside stations",
    keyRegulations: ["Indian Railways Act 1989", "IRS GE-1"],
    approvalBody: "MoR DRM inspection",
    criticalGate: "MoR open line inspection",
  },
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

export function getICDTasks(icdType: ICDType): ICDTaskTemplate[] {
  return ALL_ICD_TASKS.filter((task) => {
    if (task.applicableICDTypes && !task.applicableICDTypes.includes(icdType)) return false;
    if (task.excludedICDTypes && task.excludedICDTypes.includes(icdType)) return false;
    return true;
  });
}

export function getCoreICDTasks(icdType: ICDType): ICDTaskTemplate[] {
  return getICDTasks(icdType).filter((t) => t.isCore);
}
