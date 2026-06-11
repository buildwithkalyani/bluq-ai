// Water Treatment / Sewage Treatment Plant Task Library
// Covers: WTP (Water Treatment Plant) and STP (Sewage Treatment Plant)
// Standards: CPHEEO Manual, IS 4251, IS 7647, BIS standards for water treatment

export type WTPPhase =
  | "surveys_investigations"
  | "site_preparation"
  | "civil_structures"
  | "mechanical_equipment"
  | "piping_valves"
  | "electrical_instrumentation"
  | "commissioning_handover";

export type WTPType = "water_treatment_plant" | "sewage_treatment_plant";

export type WTPUnit =
  | "Cum"      // cubic metres
  | "Sqm"      // square metres
  | "Rmt"      // running metres
  | "No"       // numbers
  | "MT"       // metric tonnes
  | "KL"       // kiloliters (tank capacity)
  | "MLD"      // megalitres per day (plant capacity)
  | "Lot"      // lump sum lot
  | "LS"       // lump sum
  | "Set"      // set of equipment
  | "Kg"       // kilograms
  | "KW"       // kilowatts
  | "KVA";     // kilovolt-amperes

interface ProductivityRate {
  min: number;
  max: number;
  unit: string;
}

interface CrewMember {
  role: string;
  count: number;
}

interface Predecessor {
  taskCode: string;
  lagDays?: number;
  type: "FS" | "SS" | "FF" | "SF";
}

export interface WTPTaskTemplate {
  code: string;
  phase: WTPPhase;
  name: string;
  unit: WTPUnit;
  productivityRate: ProductivityRate;
  monsoonImpactFactor: number;       // 1.0 = no impact, 2.0 = 2× duration
  crew: CrewMember[];
  equipment?: string[];
  predecessors: Predecessor[];
  isCodeRef: string[];               // IS codes / CPHEEO references
  dsrRef: string;
  safetyChecks: string[];
  remarks: string;
  taskCategory?: "A" | "B";
  isCore: boolean;
  leadTimeDays?: number;             // procurement lead time
  requiresSpecialistContractor?: boolean;
  specialistType?: string;
  applicableWTPTypes?: WTPType[];
  excludedWTPTypes?: WTPType[];
  conditions?: Array<{
    field: string;
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    value: string | number | boolean;
  }>;
}

// ─── Phase 1: Surveys & Investigations ────────────────────────────────────────

const SURVEY_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-SI-01",
    phase: "surveys_investigations",
    name: "Topographic survey and site mapping",
    unit: "Sqm",
    productivityRate: { min: 20000, max: 40000, unit: "Sqm/day" },
    monsoonImpactFactor: 1.3,
    crew: [
      { role: "Survey Engineer", count: 1 },
      { role: "Surveyor", count: 2 },
      { role: "Helper", count: 2 },
    ],
    equipment: ["Total station", "DGPS", "Drone/UAV"],
    predecessors: [],
    isCodeRef: ["IS 4251"],
    dsrRef: "MORTH 2019 Item 1.1",
    safetyChecks: ["Site boundary demarcation", "Utility identification"],
    remarks: "Include catchment area survey for WTP; drainage basin for STP",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-SI-02",
    phase: "surveys_investigations",
    name: "Geotechnical investigation and soil testing",
    unit: "No",
    productivityRate: { min: 2, max: 4, unit: "Bore holes/day" },
    monsoonImpactFactor: 1.5,
    crew: [
      { role: "Geotechnical Engineer", count: 1 },
      { role: "Rig Operator", count: 1 },
      { role: "Lab Technician", count: 1 },
    ],
    equipment: ["Bore hole rig", "SPT equipment", "Sampling tubes"],
    predecessors: [{ taskCode: "WT-SI-01", type: "FS" }],
    isCodeRef: ["IS 1892", "IS 2132"],
    dsrRef: "DSR 2021 Item 2.3",
    safetyChecks: ["Bore hole barricading", "PPE for crew"],
    remarks: "Min 6–8 bore holes per 1 ha; depth to refusal or 30m; check for high water table near rivers",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-SI-03",
    phase: "surveys_investigations",
    name: "Raw water quality testing (source characterisation)",
    unit: "No",
    productivityRate: { min: 1, max: 2, unit: "Test reports/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Engineer", count: 1 },
      { role: "Lab Chemist", count: 2 },
    ],
    equipment: ["Water sampling equipment", "Portable analyser"],
    predecessors: [{ taskCode: "WT-SI-01", type: "FS" }],
    isCodeRef: ["IS 10500", "CPHEEO Manual 2012"],
    dsrRef: "CPHEEO Reference",
    safetyChecks: ["Sample chain of custody", "Chemical handling protocol"],
    remarks: "WTP only; test turbidity, TDS, BOD, COD, heavy metals, seasonal variation over 12 months if possible",
    taskCategory: "A",
    isCore: true,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-SI-04",
    phase: "surveys_investigations",
    name: "Influent sewage characterisation (STP only)",
    unit: "No",
    productivityRate: { min: 1, max: 2, unit: "Test reports/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Engineer", count: 1 },
      { role: "Lab Chemist", count: 2 },
    ],
    equipment: ["Composite sampler", "Portable analyser"],
    predecessors: [{ taskCode: "WT-SI-01", type: "FS" }],
    isCodeRef: ["IS 2490", "CPHEEO STP Manual"],
    dsrRef: "CPHEEO Reference",
    safetyChecks: ["Bio-hazard PPE", "Sample handling protocol"],
    remarks: "STP only; measure BOD, COD, SS, TKN, phosphorus, flow variation (diurnal pattern)",
    taskCategory: "A",
    isCore: true,
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
];

// ─── Phase 2: Site Preparation ────────────────────────────────────────────────

const SITE_PREP_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-SP-01",
    phase: "site_preparation",
    name: "Site clearance, grubbing and demolition",
    unit: "Sqm",
    productivityRate: { min: 500, max: 1500, unit: "Sqm/day" },
    monsoonImpactFactor: 1.4,
    crew: [
      { role: "Supervisor", count: 1 },
      { role: "Operator", count: 2 },
      { role: "Labour", count: 8 },
    ],
    equipment: ["Bulldozer", "Hydraulic excavator", "Tractor with trailer"],
    predecessors: [{ taskCode: "WT-SI-02", type: "FS" }],
    isCodeRef: [],
    dsrRef: "DSR 2021 Item 1.1",
    safetyChecks: ["Utility clearance certificate", "Tree cutting NOC if applicable"],
    remarks: "Dispose vegetation offsite; segregate topsoil for reuse in landscaping",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-SP-02",
    phase: "site_preparation",
    name: "Bulk earthworks — cut and fill",
    unit: "Cum",
    productivityRate: { min: 800, max: 2000, unit: "Cum/day" },
    monsoonImpactFactor: 1.8,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Excavator Operator", count: 2 },
      { role: "Dumper Driver", count: 4 },
      { role: "Labour", count: 6 },
    ],
    equipment: ["Hydraulic excavator 21T", "Tipper 10T × 4", "Motor grader", "Compactor"],
    predecessors: [{ taskCode: "WT-SP-01", type: "FS" }],
    isCodeRef: ["IS 3764"],
    dsrRef: "MORTH 2019 Item 301",
    safetyChecks: ["Edge protection for excavations > 1.5m", "Slope stability check"],
    remarks: "Level site to design platform elevation; tank areas typically below grade — 2–5m deep excavation",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-SP-03",
    phase: "site_preparation",
    name: "Access road construction (internal plant roads)",
    unit: "Rmt",
    productivityRate: { min: 30, max: 60, unit: "Rmt/day" },
    monsoonImpactFactor: 1.6,
    crew: [
      { role: "Site Engineer", count: 1 },
      { role: "Operator", count: 3 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Motor grader", "Vibratory roller", "Paver"],
    predecessors: [{ taskCode: "WT-SP-02", type: "SS", lagDays: 7 }],
    isCodeRef: [],
    dsrRef: "MORTH 2019",
    safetyChecks: ["Road gradient not to exceed 5% for equipment movement"],
    remarks: "7m wide WBM + bituminous surface; needed early for equipment delivery",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 3: Civil Structures ─────────────────────────────────────────────────

const CIVIL_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-CS-01",
    phase: "civil_structures",
    name: "Intake structure (jack well / approach channel)",
    unit: "Cum",
    productivityRate: { min: 15, max: 30, unit: "Cum/day (concrete)" },
    monsoonImpactFactor: 2.0,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Foreman", count: 2 },
      { role: "Mason", count: 6 },
      { role: "Labour", count: 12 },
    ],
    equipment: ["Dewatering pumps", "Batching plant", "Crane"],
    predecessors: [{ taskCode: "WT-SP-02", type: "FS" }],
    isCodeRef: ["IS 456", "IS 3370", "CPHEEO Manual"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Dewatering adequacy", "Cofferdam integrity", "Confined space entry permit"],
    remarks: "WTP only; M35 concrete, waterproofing coat inside; construct during dry season (Oct–Feb); river intake requires CWC NOC",
    taskCategory: "B",
    isCore: true,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-CS-02",
    phase: "civil_structures",
    name: "Raw water / rising main pump sump and wet well",
    unit: "Cum",
    productivityRate: { min: 20, max: 40, unit: "Cum/day (concrete)" },
    monsoonImpactFactor: 1.8,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Foreman", count: 1 },
      { role: "Mason", count: 5 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Dewatering pumps", "Batching plant", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 456", "IS 3370-Part 4"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Leakage test (24hr water retention test)", "Dewatering adequacy"],
    remarks: "M35 concrete, liquid retaining design; 24hr water retention test mandatory per IS 3370",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CS-03",
    phase: "civil_structures",
    name: "Flash mixer / rapid mixing chamber (WTP)",
    unit: "No",
    productivityRate: { min: 0.2, max: 0.5, unit: "No/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labour", count: 8 },
    ],
    equipment: ["Batching plant", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-02", type: "FS" }],
    isCodeRef: ["IS 456", "CPHEEO Manual Ch.6"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Chemical (alum) handling protocol", "Water retention test"],
    remarks: "WTP only; velocity gradient G = 700–1000 s⁻¹; detention time 30–60 sec; M35 concrete with acid-resistant lining",
    taskCategory: "B",
    isCore: false,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-CS-04",
    phase: "civil_structures",
    name: "Flocculation chambers",
    unit: "No",
    productivityRate: { min: 0.1, max: 0.3, unit: "No/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 6 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Batching plant", "Shuttering", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-03", type: "FS" }],
    isCodeRef: ["IS 456", "IS 3370", "CPHEEO Manual Ch.6"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Structural integrity after formwork removal", "Water retention test"],
    remarks: "WTP only; multiple compartments; G = 20–70 s⁻¹; 20–30 min detention; M35 concrete",
    taskCategory: "B",
    isCore: false,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-CS-05",
    phase: "civil_structures",
    name: "Sedimentation / clarifier tanks (WTP) or primary clarifier (STP)",
    unit: "No",
    productivityRate: { min: 0.05, max: 0.15, unit: "No/day" },
    monsoonImpactFactor: 1.3,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Foreman", count: 2 },
      { role: "Mason", count: 8 },
      { role: "Labour", count: 15 },
    ],
    equipment: ["Batching plant", "Crane", "Shuttering system", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-04", type: "FS" }],
    isCodeRef: ["IS 456", "IS 3370", "CPHEEO Manual"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Water retention test", "Base slab deflection check"],
    remarks: "Circular tanks 10–40m dia; SOR 1 m³/m²/hr (WTP), 1.5–2.0 m³/m²/hr (STP primary); M35 waterproofed",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CS-06",
    phase: "civil_structures",
    name: "Rapid gravity filter / pressure filter beds (WTP)",
    unit: "No",
    productivityRate: { min: 0.1, max: 0.2, unit: "No/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 6 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Batching plant", "Shuttering", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-05", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IS 3370", "IS 2405"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Filter media gradation certificate", "Underdrain integrity test"],
    remarks: "WTP only; loading rate 4–6 m/hr; dual media or sand/gravel; filter bottom block underdrain; nozzle type also common",
    taskCategory: "B",
    isCore: false,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-CS-07",
    phase: "civil_structures",
    name: "Aeration tank / biological reactor (STP — MBR/SBR/ASP)",
    unit: "Cum",
    productivityRate: { min: 25, max: 50, unit: "Cum/day (concrete)" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Foreman", count: 2 },
      { role: "Mason", count: 8 },
      { role: "Labour", count: 15 },
    ],
    equipment: ["Batching plant", "Crane", "Shuttering", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-05", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "IS 3370", "CPHEEO STP Manual"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Water retention test", "Diffuser grid level check"],
    remarks: "STP only; MLSS 3000–6000 mg/L for ASP; SBR has combined aeration+settling; MBR requires membrane frame embed in slab",
    taskCategory: "B",
    isCore: true,
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
  {
    code: "WT-CS-08",
    phase: "civil_structures",
    name: "Secondary clarifier (STP)",
    unit: "No",
    productivityRate: { min: 0.05, max: 0.12, unit: "No/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 6 },
      { role: "Labour", count: 12 },
    ],
    equipment: ["Batching plant", "Crane", "Shuttering", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-07", type: "FS" }],
    isCodeRef: ["IS 456", "IS 3370"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Water retention test", "Center pier level accuracy"],
    remarks: "STP only; SOR 1.5–2.0 m³/m²/hr; peripheral feed/center feed; bridge mounted scraper mechanism installed later",
    taskCategory: "B",
    isCore: true,
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
  {
    code: "WT-CS-09",
    phase: "civil_structures",
    name: "Sludge digester / sludge drying beds",
    unit: "Cum",
    productivityRate: { min: 15, max: 30, unit: "Cum/day (concrete)" },
    monsoonImpactFactor: 1.5,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Mason", count: 5 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Batching plant", "Vibrator", "Shuttering"],
    predecessors: [{ taskCode: "WT-CS-05", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 456", "IS 3370"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Gas-tight joints (anaerobic digester)", "Slab drainage slope (drying beds)"],
    remarks: "Anaerobic digesters — double dome or fixed cover; drying beds — sand/gravel media 0.2m; digester gas piping to gas holder",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CS-10",
    phase: "civil_structures",
    name: "Overhead / ground-level clear water reservoir (CWR)",
    unit: "KL",
    productivityRate: { min: 100, max: 300, unit: "KL/day (capacity)" },
    monsoonImpactFactor: 1.3,
    crew: [
      { role: "Structural Engineer", count: 1 },
      { role: "Foreman", count: 2 },
      { role: "Mason", count: 8 },
      { role: "Labour", count: 15 },
    ],
    equipment: ["Batching plant", "Crane", "Slipform / jump form", "Vibrator"],
    predecessors: [{ taskCode: "WT-CS-06", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 456", "IS 3370-Part 2", "IS 11682"],
    dsrRef: "DSR 2021 Item 6.3",
    safetyChecks: ["Water retention test 24hr", "Structural load check for OHT"],
    remarks: "OHT (elevated): RCC intze / circular; GL tank: rectangular or circular; M35 waterproofed; 24hr retention test mandatory",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CS-11",
    phase: "civil_structures",
    name: "Chemical house / dosing room civil works (alum, chlorine, lime)",
    unit: "Sqm",
    productivityRate: { min: 20, max: 40, unit: "Sqm/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Foreman", count: 1 },
      { role: "Mason", count: 4 },
      { role: "Labour", count: 6 },
    ],
    equipment: ["Batching plant", "Vibrator"],
    predecessors: [{ taskCode: "WT-SP-02", type: "FS", lagDays: 30 }],
    isCodeRef: ["IS 456", "National Building Code Part 4"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Chemical-resistant flooring", "Acid-resistant drain channel", "Forced ventilation provision"],
    remarks: "Epoxy-coated floors; chlorine room — leak-proof, negative pressure, scrubber provision; lime saturation room — sump",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CS-12",
    phase: "civil_structures",
    name: "Administration and control building (civil)",
    unit: "Sqm",
    productivityRate: { min: 15, max: 30, unit: "Sqm/day" },
    monsoonImpactFactor: 1.3,
    crew: [
      { role: "Civil Engineer", count: 1 },
      { role: "Mason", count: 5 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Batching plant", "Vibrator", "Crane"],
    predecessors: [{ taskCode: "WT-SP-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 456", "National Building Code"],
    dsrRef: "DSR 2021",
    safetyChecks: ["NBC fire safety compliance", "Structural certificate"],
    remarks: "G+1 typical; includes lab room, SCADA room, operator quarters, store; lightning protection mandatory",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 4: Mechanical Equipment ────────────────────────────────────────────

const MECHANICAL_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-ME-01",
    phase: "mechanical_equipment",
    name: "Raw water / intake pumps supply and installation",
    unit: "Set",
    productivityRate: { min: 1, max: 2, unit: "Pumps/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Pump Fitter", count: 2 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Chain pulley / EOT crane", "Alignment tools", "Vibration meter"],
    predecessors: [{ taskCode: "WT-CS-02", type: "FS", lagDays: 14 }],
    isCodeRef: ["IS 1520", "IS 5600"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Pump foundation grouting strength", "Shaft alignment within 0.05mm", "Motor insulation resistance check"],
    remarks: "Vertical turbine pumps (VTP) or submersible for deep sumps; standby = 100% duty; FAT at manufacturer before dispatch",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "Pump manufacturer's service team",
  },
  {
    code: "WT-ME-02",
    phase: "mechanical_equipment",
    name: "Flash / paddle flocculators supply and installation (WTP)",
    unit: "No",
    productivityRate: { min: 1, max: 3, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 3 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Crane", "Torque wrench", "Level"],
    predecessors: [{ taskCode: "WT-CS-04", type: "FS", lagDays: 14 }],
    isCodeRef: ["CPHEEO Manual"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Drive alignment", "Guard over rotating parts"],
    remarks: "WTP only; variable speed drive (VSD) for each compartment; stainless steel paddles",
    taskCategory: "B",
    isCore: false,
    leadTimeDays: 60,
    applicableWTPTypes: ["water_treatment_plant"],
  },
  {
    code: "WT-ME-03",
    phase: "mechanical_equipment",
    name: "Sludge / clarifier scraper mechanism supply and installation",
    unit: "No",
    productivityRate: { min: 1, max: 2, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 3 },
      { role: "Welder", count: 1 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Crane", "Welding machine", "Alignment tools"],
    predecessors: [{ taskCode: "WT-CS-05", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Torque test on drive unit", "Bridge level check", "Immersion depth verification"],
    remarks: "Bridge mounted rotating scraper; center drive; FRP or MS epoxy-coated bridge; trial run in water before acceptance",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "Scraper OEM installation team",
  },
  {
    code: "WT-ME-04",
    phase: "mechanical_equipment",
    name: "Fine screen / bar screen supply and installation (STP headworks)",
    unit: "No",
    productivityRate: { min: 1, max: 2, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 2 },
      { role: "Labour", count: 3 },
    ],
    equipment: ["Crane", "Level", "Torque wrench"],
    predecessors: [{ taskCode: "WT-CS-02", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Bio-hazard protocol (sewage)", "ATEX rating for enclosed headworks"],
    remarks: "STP only; coarse screen (50mm) + fine screen (6mm); SS 316; screenings washer/compactor; grit channel + classifier",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 60,
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
  {
    code: "WT-ME-05",
    phase: "mechanical_equipment",
    name: "Aeration system — diffusers and blowers supply and installation (STP)",
    unit: "Set",
    productivityRate: { min: 0.5, max: 1, unit: "Tanks/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 3 },
      { role: "Labour", count: 5 },
    ],
    equipment: ["Crane", "Air flow meter", "DO meter"],
    predecessors: [{ taskCode: "WT-CS-07", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Noise level check (blowers ≤ 85 dB)", "Air pipe pressure test", "DO target 2 mg/L"],
    remarks: "STP only; fine bubble EPDM membrane diffusers; SOTE ≥ 4%; twin-lobe / tri-lobe or turbo blowers; VSD on each blower",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "Aeration system OEM",
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
  {
    code: "WT-ME-06",
    phase: "mechanical_equipment",
    name: "MBR membrane module supply and installation",
    unit: "Set",
    productivityRate: { min: 0.3, max: 0.7, unit: "Membrane trains/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Membrane Specialist", count: 2 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Crane", "Clean water flushing system"],
    predecessors: [{ taskCode: "WT-CS-07", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Membrane integrity test (bubble point)", "Permeate turbidity < 1 NTU"],
    remarks: "STP-MBR only; hollow fibre PVDF membranes; maintain MLSS ≤ 12,000 mg/L; install per OEM sequence; keep membranes wet",
    taskCategory: "B",
    isCore: false,
    leadTimeDays: 180,
    requiresSpecialistContractor: true,
    specialistType: "Membrane OEM (Kubota / Toray / GE)",
    applicableWTPTypes: ["sewage_treatment_plant"],
    conditions: [{ field: "stpProcess", operator: "==", value: "MBR" }],
  },
  {
    code: "WT-ME-07",
    phase: "mechanical_equipment",
    name: "Sludge handling — thickener, centrifuge / belt press supply and installation",
    unit: "Set",
    productivityRate: { min: 0.5, max: 1, unit: "Units/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 3 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Crane", "Vibration meter", "Alignment tools"],
    predecessors: [{ taskCode: "WT-CS-09", type: "FS", lagDays: 14 }],
    isCodeRef: [],
    dsrRef: "DSR 2021",
    safetyChecks: ["Mechanical seal integrity", "Noise and vibration within limits", "Polymer dosing system calibration"],
    remarks: "Centrifuge preferred for large plants > 10 MLD; belt press for smaller; gravity thickener reduces volume before dewatering",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 120,
    requiresSpecialistContractor: true,
    specialistType: "Sludge handling OEM",
  },
  {
    code: "WT-ME-08",
    phase: "mechanical_equipment",
    name: "Chlorination system supply and installation (WTP / STP disinfection)",
    unit: "Set",
    productivityRate: { min: 1, max: 2, unit: "Sets/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Mechanical Engineer", count: 1 },
      { role: "Fitter", count: 2 },
      { role: "Labour", count: 2 },
    ],
    equipment: ["Chlorine leak detector", "Torque wrench"],
    predecessors: [{ taskCode: "WT-CS-11", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 10190", "CPCB guidelines"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Gas-tight fittings", "Chlorine detection alarm", "Emergency scrubber operational", "SCBA available"],
    remarks: "Chlorine gas (tonner) or sodium hypochlorite; UV-C disinfection as alternative for STP tertiary; residual 0.2 mg/L at consumer",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 45,
    requiresSpecialistContractor: true,
    specialistType: "Chlorination system OEM",
  },
];

// ─── Phase 5: Piping & Valves ──────────────────────────────────────────────────

const PIPING_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-PV-01",
    phase: "piping_valves",
    name: "Raw water / rising main pipeline (DI / MS pipe)",
    unit: "Rmt",
    productivityRate: { min: 50, max: 120, unit: "Rmt/day" },
    monsoonImpactFactor: 1.8,
    crew: [
      { role: "Piping Engineer", count: 1 },
      { role: "Pipe Fitter", count: 4 },
      { role: "Welder", count: 2 },
      { role: "Labour", count: 10 },
    ],
    equipment: ["Excavator", "Pipe bending / cutting machine", "Welding machine", "Hydro-testing pump"],
    predecessors: [{ taskCode: "WT-SP-02", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 8329 (DI)", "IS 3589 (MS)", "IS 12288"],
    dsrRef: "CPWD DSR",
    safetyChecks: ["Trench shoring for depth > 1.5m", "Traffic management for road crossings", "Pressure test 1.5× WP"],
    remarks: "Ductile iron (DI K9) preferred for underground; MS with FBE coating for above-ground; pressure test 1.5× WP for 2hr",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-PV-02",
    phase: "piping_valves",
    name: "Inter-process piping within plant (MS / FRP / HDPE)",
    unit: "Rmt",
    productivityRate: { min: 30, max: 70, unit: "Rmt/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Piping Engineer", count: 1 },
      { role: "Pipe Fitter", count: 4 },
      { role: "Welder", count: 2 },
      { role: "Labour", count: 8 },
    ],
    equipment: ["Pipe cutting / welding", "Hydro-testing pump", "Flushing pump"],
    predecessors: [{ taskCode: "WT-CS-05", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 3589", "IS 4984 (HDPE)"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Pipe support spacing per standard", "Pressure test before insulation", "Flow direction marking"],
    remarks: "Include sluice valves, butterfly valves, NRVs, air release valves at all high points; pipe schedule per design pressure",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-PV-03",
    phase: "piping_valves",
    name: "Chemical dosing piping (PVC / FRP / HDPE)",
    unit: "Rmt",
    productivityRate: { min: 20, max: 50, unit: "Rmt/day" },
    monsoonImpactFactor: 1.1,
    crew: [
      { role: "Pipe Fitter", count: 2 },
      { role: "Labour", count: 4 },
    ],
    equipment: ["Pipe solvent / HDPE fusion tool"],
    predecessors: [{ taskCode: "WT-CS-11", type: "FS" }],
    isCodeRef: ["IS 4985 (PVC)"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Chemical compatibility of pipe material", "Leak test before commissioning"],
    remarks: "Alum lines — HDPE; chlorine gas lines — SCH 80 PVC with double containment; acid lines — FRP",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-PV-04",
    phase: "piping_valves",
    name: "Sludge withdrawal and return sludge piping (STP)",
    unit: "Rmt",
    productivityRate: { min: 25, max: 60, unit: "Rmt/day" },
    monsoonImpactFactor: 1.2,
    crew: [
      { role: "Pipe Fitter", count: 3 },
      { role: "Labour", count: 6 },
    ],
    equipment: ["Welding machine", "Hydro-testing pump"],
    predecessors: [{ taskCode: "WT-CS-08", type: "FS" }],
    isCodeRef: ["IS 3589"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Non-clog design verification", "Velocity ≥ 0.9 m/s to prevent settling"],
    remarks: "STP only; self-cleaning non-clog design; RAS pump capacity = 50–100% of Q; WAS pump = 1–3% of Q",
    taskCategory: "B",
    isCore: true,
    applicableWTPTypes: ["sewage_treatment_plant"],
  },
  {
    code: "WT-PV-05",
    phase: "piping_valves",
    name: "Treated water / effluent outlet main",
    unit: "Rmt",
    productivityRate: { min: 50, max: 120, unit: "Rmt/day" },
    monsoonImpactFactor: 1.5,
    crew: [
      { role: "Piping Engineer", count: 1 },
      { role: "Pipe Fitter", count: 3 },
      { role: "Labour", count: 8 },
    ],
    equipment: ["Excavator", "Hydro-testing pump"],
    predecessors: [{ taskCode: "WT-CS-10", type: "FS" }],
    isCodeRef: ["IS 8329", "IS 3589"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Pressure test", "Final connection to distribution main under PWSSB supervision"],
    remarks: "DI or HDPE; STP outlet — gravity sewer or pumped effluent to disposal; treated water to OHT / distribution",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 6: Electrical & Instrumentation ────────────────────────────────────

const ELECTRICAL_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-EI-01",
    phase: "electrical_instrumentation",
    name: "HT substation, transformer and MCC supply and installation",
    unit: "Set",
    productivityRate: { min: 0.3, max: 0.7, unit: "Sets/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 4 },
      { role: "Labour", count: 6 },
    ],
    equipment: ["Crane", "Insulation tester", "Earth tester"],
    predecessors: [{ taskCode: "WT-CS-12", type: "FS", lagDays: 7 }],
    isCodeRef: ["IS 2026", "IS 13947", "CEA Regulations 2010"],
    dsrRef: "DSR 2021",
    safetyChecks: ["CEA clearance", "Earth resistance < 1 Ω", "Arc flash analysis", "DISCOM HT metering approval"],
    remarks: "11kV or 33kV incoming; transformer 11kV/0.415kV; MCCs for each pump group; ACB / VCB main breakers; relay coordination study mandatory",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "Licensed HT electrical contractor (CEA)",
  },
  {
    code: "WT-EI-02",
    phase: "electrical_instrumentation",
    name: "DG set supply and installation (standby power)",
    unit: "No",
    productivityRate: { min: 1, max: 2, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 2 },
      { role: "Labour", count: 3 },
    ],
    equipment: ["Crane", "Anti-vibration pads"],
    predecessors: [{ taskCode: "WT-EI-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 10000", "CPCB DG emission norms"],
    dsrRef: "DSR 2021",
    safetyChecks: ["CPCB DG emission compliance", "Acoustic enclosure (≤ 75 dB at 1m)", "Fuel tank bund wall", "AMF panel interlock test"],
    remarks: "Minimum 100% standby for critical loads; AMF (auto mains failure) panel; acoustic canopy; fuel for 72hr at full load",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 60,
  },
  {
    code: "WT-EI-03",
    phase: "electrical_instrumentation",
    name: "VFD / VSD installation for pumps and blowers",
    unit: "No",
    productivityRate: { min: 3, max: 6, unit: "No/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Electrical Engineer", count: 1 },
      { role: "Electrician", count: 2 },
    ],
    equipment: ["Harmonic analyser", "Calibration tools"],
    predecessors: [{ taskCode: "WT-EI-01", type: "FS", lagDays: 7 }],
    isCodeRef: ["IEC 61800"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Harmonic distortion THD < 5%", "Motor cable screening", "EMC filter installation"],
    remarks: "VFD on all motors > 11kW for energy saving; harmonic filter if THD > 5%; separate VFD room or IP54 enclosure if motor-mounted",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 45,
  },
  {
    code: "WT-EI-04",
    phase: "electrical_instrumentation",
    name: "Process instrumentation — flow meters, level sensors, pH, DO, turbidity",
    unit: "No",
    productivityRate: { min: 5, max: 10, unit: "Instruments/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Instrumentation Engineer", count: 1 },
      { role: "Instrument Fitter", count: 2 },
      { role: "Labour", count: 2 },
    ],
    equipment: ["Calibration kit", "Multimeter", "Laptop for configuration"],
    predecessors: [{ taskCode: "WT-PV-02", type: "SS", lagDays: 30 }],
    isCodeRef: ["IS 2360", "ISA-5.1"],
    dsrRef: "DSR 2021",
    safetyChecks: ["IP67 rating for submerged sensors", "Calibration certificate for each instrument", "4–20mA loop check"],
    remarks: "Electromagnetic flow meters on all process lines; ultrasonic level in tanks; online water quality analyser (turbidity, pH, chlorine) at outlet",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 60,
    requiresSpecialistContractor: true,
    specialistType: "Instrumentation contractor",
  },
  {
    code: "WT-EI-05",
    phase: "electrical_instrumentation",
    name: "SCADA / PLC control system supply and integration",
    unit: "Set",
    productivityRate: { min: 0.3, max: 0.5, unit: "Sets/week" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "SCADA Engineer", count: 2 },
      { role: "Electrician", count: 1 },
    ],
    equipment: ["Laptop", "SCADA server", "HMI panel"],
    predecessors: [{ taskCode: "WT-EI-04", type: "SS", lagDays: 21 }],
    isCodeRef: ["IEC 61511 (safety)", "IS 2681"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Cybersecurity review", "UPS backup for SCADA (min 2hr)", "FAT + SAT required"],
    remarks: "SCADA with redundant PLC; OPC-UA protocol; historian for 12 months data; remote monitoring via 4G/fibre; FAT at factory, SAT on-site",
    taskCategory: "B",
    isCore: true,
    leadTimeDays: 90,
    requiresSpecialistContractor: true,
    specialistType: "SCADA system integrator",
  },
  {
    code: "WT-EI-06",
    phase: "electrical_instrumentation",
    name: "Cable laying — HT, LT, instrumentation and earthing",
    unit: "Rmt",
    productivityRate: { min: 200, max: 500, unit: "Rmt/day" },
    monsoonImpactFactor: 1.3,
    crew: [
      { role: "Electrician", count: 4 },
      { role: "Labour", count: 8 },
    ],
    equipment: ["Cable drum stand", "Cable pulling machine", "Multimeter"],
    predecessors: [{ taskCode: "WT-EI-01", type: "SS", lagDays: 14 }],
    isCodeRef: ["IS 1554", "IS 7098", "IS 3043"],
    dsrRef: "DSR 2021",
    safetyChecks: ["Cable tray support spacing ≤ 1.2m", "Segregation HT/LT/instrumentation cables", "Earth continuity test"],
    remarks: "XLPE armoured cables; separate cable trays for HT, LT, instrumentation; cable tagging and termination schedule mandatory",
    taskCategory: "B",
    isCore: true,
  },
];

// ─── Phase 7: Commissioning & Handover ────────────────────────────────────────

const COMMISSIONING_TASKS: WTPTaskTemplate[] = [
  {
    code: "WT-CH-01",
    phase: "commissioning_handover",
    name: "Individual equipment commissioning and trial runs",
    unit: "No",
    productivityRate: { min: 2, max: 5, unit: "Equipment/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Commissioning Engineer", count: 2 },
      { role: "Electrical Engineer", count: 1 },
      { role: "Mechanical Engineer", count: 1 },
    ],
    equipment: ["Power analyser", "Vibration meter", "Calibration kit"],
    predecessors: [
      { taskCode: "WT-ME-08", type: "FS" },
      { taskCode: "WT-EI-06", type: "FS" },
    ],
    isCodeRef: [],
    dsrRef: "Commissioning Protocol",
    safetyChecks: ["Lock-out tag-out protocol", "First run checklist signed", "OEM engineer present for critical equipment"],
    remarks: "Bumper test for all rotating equipment; check rotation direction, current draw, vibration, temperature; OEM sign-off",
    taskCategory: "B",
    isCore: true,
  },
  {
    code: "WT-CH-02",
    phase: "commissioning_handover",
    name: "Hydraulic testing — full plant water run (clean water)",
    unit: "MLD",
    productivityRate: { min: 5, max: 20, unit: "MLD capacity tested/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Process Engineer", count: 1 },
      { role: "Operator", count: 4 },
    ],
    equipment: ["Flow meters", "Pressure gauges", "Sampling equipment"],
    predecessors: [{ taskCode: "WT-CH-01", type: "FS" }],
    isCodeRef: ["CPHEEO Manual"],
    dsrRef: "Commissioning Protocol",
    safetyChecks: ["Confirm all isolation valves position", "SCADA logged during test"],
    remarks: "Run at 50%, 75%, 100% design flow; verify hydraulic grade line; adjust throttle valves; record pressure at key points",
    taskCategory: "A",
    isCore: true,
  },
  {
    code: "WT-CH-03",
    phase: "commissioning_handover",
    name: "Process performance trials — treated water quality verification",
    unit: "MLD",
    productivityRate: { min: 2, max: 10, unit: "MLD capacity/day" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Process Engineer", count: 1 },
      { role: "Lab Chemist", count: 2 },
      { role: "Operator", count: 4 },
    ],
    equipment: ["Laboratory equipment", "Online analysers"],
    predecessors: [{ taskCode: "WT-CH-02", type: "FS" }],
    isCodeRef: ["IS 10500 (WTP)", "IS 2490 (STP effluent)"],
    dsrRef: "CPHEEO / SPCB protocol",
    safetyChecks: ["SPCB inspector present during trials", "Daily sample log maintained"],
    remarks: "WTP — treated water to meet IS 10500 drinking water standards; STP — effluent to CPCB Class D/E norms; minimum 30-day trial period",
    taskCategory: "A",
    isCore: true,
  },
  {
    code: "WT-CH-04",
    phase: "commissioning_handover",
    name: "SPCB environmental clearance and consent to operate (CTO)",
    unit: "LS",
    productivityRate: { min: 30, max: 90, unit: "Days for approval" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Environmental Engineer", count: 1 },
      { role: "Project Manager", count: 1 },
    ],
    equipment: [],
    predecessors: [{ taskCode: "WT-CH-03", type: "FS" }],
    isCodeRef: ["Environment Protection Act 1986", "Water Act 1974"],
    dsrRef: "SPCB requirement",
    safetyChecks: ["Effluent quality compliance before CTO application", "EMP implementation evidence"],
    remarks: "STP mandatory: CTO from State Pollution Control Board; WTP: NOC from local authority + PWSSB/PHED approval for public supply",
    taskCategory: "A",
    isCore: true,
    requiresSpecialistContractor: true,
    specialistType: "Environmental consultant",
  },
  {
    code: "WT-CH-05",
    phase: "commissioning_handover",
    name: "Operator training and O&M manual handover",
    unit: "LS",
    productivityRate: { min: 14, max: 30, unit: "Days" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Process Engineer", count: 1 },
      { role: "Electrical Engineer", count: 1 },
    ],
    equipment: ["Training materials", "Simulation on SCADA"],
    predecessors: [{ taskCode: "WT-CH-03", type: "FS" }],
    isCodeRef: [],
    dsrRef: "Contract requirement",
    safetyChecks: ["Emergency shutdown drill completed", "Chemical handling training done"],
    remarks: "Train min 3 operators and 1 supervisor; topics: normal ops, troubleshooting, chemical handling, SCADA, emergency response; O&M manuals in English + local language",
    taskCategory: "A",
    isCore: true,
  },
  {
    code: "WT-CH-06",
    phase: "commissioning_handover",
    name: "Defects liability period monitoring and final handover",
    unit: "LS",
    productivityRate: { min: 365, max: 365, unit: "Days (DLP)" },
    monsoonImpactFactor: 1.0,
    crew: [
      { role: "Project Manager", count: 1 },
      { role: "Process Engineer", count: 1 },
    ],
    equipment: [],
    predecessors: [{ taskCode: "WT-CH-04", type: "FS" }, { taskCode: "WT-CH-05", type: "FS" }],
    isCodeRef: [],
    dsrRef: "Contract DLP clause",
    safetyChecks: ["Performance guarantee parameters monitored monthly", "Snag list closeout documented"],
    remarks: "1-year DLP standard for process plants; O&M support by contractor during DLP; performance bank guarantee to be released after DLP",
    taskCategory: "A",
    isCore: true,
  },
];

// ─── All Tasks Combined ────────────────────────────────────────────────────────

export const ALL_WTP_TASKS: WTPTaskTemplate[] = [
  ...SURVEY_TASKS,
  ...SITE_PREP_TASKS,
  ...CIVIL_TASKS,
  ...MECHANICAL_TASKS,
  ...PIPING_TASKS,
  ...ELECTRICAL_TASKS,
  ...COMMISSIONING_TASKS,
];

// ─── Type Configurations ───────────────────────────────────────────────────────

export interface WTPTypeConfig {
  type: WTPType;
  label: string;
  description: string;
  corePhasesRequired: WTPPhase[];
  typicalCapacityRange: { min: number; max: number; unit: string };
  keyRegulations: string[];
  approvalBody: string;
}

export const WTP_TYPES: Record<WTPType, WTPTypeConfig> = {
  water_treatment_plant: {
    type: "water_treatment_plant",
    label: "Water Treatment Plant",
    description: "Surface water or groundwater treatment for potable supply; CPHEEO design standards",
    corePhasesRequired: [
      "surveys_investigations",
      "site_preparation",
      "civil_structures",
      "mechanical_equipment",
      "piping_valves",
      "electrical_instrumentation",
      "commissioning_handover",
    ],
    typicalCapacityRange: { min: 1, max: 500, unit: "MLD" },
    keyRegulations: ["IS 10500", "CPHEEO Manual 2012", "BIS 2962", "Water Act 1974"],
    approvalBody: "PWSSB / PHED / Local Authority + SPCB NOC",
  },
  sewage_treatment_plant: {
    type: "sewage_treatment_plant",
    label: "Sewage Treatment Plant",
    description: "Municipal or industrial wastewater treatment; ASP / SBR / MBR technology; CPCB norms",
    corePhasesRequired: [
      "surveys_investigations",
      "site_preparation",
      "civil_structures",
      "mechanical_equipment",
      "piping_valves",
      "electrical_instrumentation",
      "commissioning_handover",
    ],
    typicalCapacityRange: { min: 1, max: 1000, unit: "MLD" },
    keyRegulations: ["IS 2490", "CPHEEO STP Manual", "CPCB Class D/E norms", "Water Act 1974"],
    approvalBody: "SPCB Consent to Operate (CTO) — mandatory before operation",
  },
};

// ─── Conditional Rules ─────────────────────────────────────────────────────────

export const WTP_CONDITIONAL_RULES = [
  {
    condition: { field: "wtpType", operator: "==", value: "water_treatment_plant" },
    include: ["WT-SI-03", "WT-CS-01", "WT-CS-03", "WT-CS-04", "WT-CS-06"],
    exclude: ["WT-SI-04", "WT-CS-07", "WT-CS-08", "WT-ME-04", "WT-ME-05", "WT-ME-06", "WT-PV-04"],
  },
  {
    condition: { field: "wtpType", operator: "==", value: "sewage_treatment_plant" },
    include: ["WT-SI-04", "WT-CS-07", "WT-CS-08", "WT-ME-04", "WT-ME-05", "WT-PV-04"],
    exclude: ["WT-SI-03", "WT-CS-01", "WT-CS-03", "WT-CS-04", "WT-CS-06"],
  },
  {
    condition: { field: "stpProcess", operator: "==", value: "MBR" },
    include: ["WT-ME-06"],
    exclude: [],
  },
  {
    condition: { field: "plantCapacityMLD", operator: ">=", value: 50 },
    include: ["WT-ME-07"],
    exclude: [],
  },
];

// ─── Regional Parameters ───────────────────────────────────────────────────────

export const WTP_REGIONAL_PARAMS: Record<string, { productivityIndex: number; monsoonMonths: number[] }> = {
  north_india:    { productivityIndex: 1.0, monsoonMonths: [7, 8, 9] },
  south_india:    { productivityIndex: 0.95, monsoonMonths: [6, 7, 8, 9, 10, 11] },
  west_india:     { productivityIndex: 1.0, monsoonMonths: [6, 7, 8, 9] },
  east_india:     { productivityIndex: 0.9, monsoonMonths: [6, 7, 8, 9, 10] },
  northeast:      { productivityIndex: 0.85, monsoonMonths: [5, 6, 7, 8, 9, 10] },
  coastal:        { productivityIndex: 0.92, monsoonMonths: [6, 7, 8, 9, 10] },
};

// ─── Helper Function ───────────────────────────────────────────────────────────

export function getWTPTasks(wtpType: WTPType): WTPTaskTemplate[] {
  return ALL_WTP_TASKS.filter((task) => {
    if (task.applicableWTPTypes && !task.applicableWTPTypes.includes(wtpType)) {
      return false;
    }
    if (task.excludedWTPTypes && task.excludedWTPTypes.includes(wtpType)) {
      return false;
    }
    return true;
  });
}

export function getCoreWTPTasks(wtpType: WTPType): WTPTaskTemplate[] {
  return getWTPTasks(wtpType).filter((t) => t.isCore);
}
