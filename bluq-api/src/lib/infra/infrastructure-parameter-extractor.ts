// Infrastructure Parameter Extractor
// Claude-based extraction of project parameters from uploaded documents
// Analogous to parameter-extractor.ts for building projects

import { ParsedDocument, toClaudeContent } from "../parsers.js";

// ─── Shared scheduling fields (common to all 11 infra types) ──────────────────

export interface InfraSection {
  id: string;                     // e.g. "S01", "PIER_P1", "BERTH_A"
  name: string;                   // e.g. "Chainage 0+000 to 18+000", "Pier P1", "Berth No. 1"
  quantityValue?: number;         // dominant quantity for this section
  quantityUnit?: string;          // "m³", "m", "no.", "m²", "RM"
  accessRoute?: string;           // haul road / marine access / crane path
  maxConcurrentActivities?: number; // RCPSP spatial constraint — max parallel activities here
  directionForced?: boolean;      // true if construction sequence direction fixed by geometry
  directionNote?: string;         // e.g. "paving proceeds from Ch 0+000 toward Ch 45+000"
  startChainage?: number;         // km — for linear projects
  endChainage?: number;           // km — for linear projects
  quantityBasis?: "boq" | "drawing_measured" | "estimated"; // how reliable is quantityValue
}

export interface ResourceAvailabilityWindow {
  fromProjectMonth: number;   // month 1 = project start; resource arrives at start of this month
  toProjectMonth: number;     // resource leaves at end of this month
  count: number;              // count during this window
  note?: string;              // e.g. "peak earthwork phase", "paving ramp-up after clearance"
}

export interface InfraResource {
  type: string;                   // "piling_rig" | "excavator_fleet" | "tbm" | "dredger" | etc.
  count: number;                  // peak count; or constant count if no availabilityWindows defined
  basis: "document" | "assumed"; // "document" = found in mobilisation plan / method statement
  description?: string;           // e.g. "2 × Bauer BG30 piling rigs per method statement"
  availabilityWindows?: ResourceAvailabilityWindow[]; // time-varying count; if absent, count is constant
}

export interface InfraProductivityRate {
  taskCode: string;               // task library code e.g. "HW-EW-01", "BR-PL-01"
  resourceType: string;           // which resource this rate applies to — must match a type in availableResources
  ratePerDayPerUnit: number;      // quantity per calendar day per ONE unit of resourceType
  basis: "document" | "indian_norm"; // source
  sourceNote?: string;            // e.g. "Contractor's programme pg.8" or "MoRTH Section 300 earthwork norms"
}

// ─── Parameter Interfaces ──────────────────────────────────────────────────────

export interface PortParameters {
  // Project type
  projectType: "port_container_terminal" | "port_bulk_cargo" | "port_fishing_harbour";
  // Scale
  capacityTEU?: number;           // TEU/year for container terminal
  capacityMTPY?: number;          // metric tonnes per year for bulk
  numberOfBerths: number;
  berthLengthM: number;
  dredgeDepthM: number;           // dredge depth below chart datum (m)
  reclamationAreaHa?: number;
  quayLengthM: number;
  yardAreaHa: number;
  stscranes?: number;
  rtgCranes?: number;
  // Site conditions
  tidalRange: "microtidal" | "mesotidal" | "macrotidal"; // < 2m / 2–4m / > 4m
  monsoonExposure: "sheltered" | "exposed" | "partially_exposed";
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
  settlementMonitoringRequired: boolean;
  cargoCommodity?: string;
  hasBreakwater: boolean;
  breakwaterLengthM?: number;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface AirportParameters {
  projectType: "airport_greenfield" | "airport_expansion";
  runwayLengthM: number;
  runwayWidthM: number;
  numberOfRunways: number;
  pavementType: "flexible" | "rigid" | "composite";
  terminalAreaSqm: number;
  designPaxMPPA: number;          // million passengers per annum
  codeLetterICAO: "A" | "B" | "C" | "D" | "E" | "F";
  hasILS: boolean;
  ilsCategory: "CAT_I" | "CAT_II" | "CAT_III" | null;
  hasCargo: boolean;
  cargoAreaSqm?: number;
  atcTowerHeight?: number;
  perimeterLengthM: number;
  region: string;
  soilType: "rock" | "dense_sand" | "expansive" | "alluvial";
  groundwaterDepthM?: number;
  dgcaLicenceRequired: boolean;
  aaiApprovalRequired: boolean;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface HighwayParameters {
  projectType: "highway_4lane" | "highway_6lane" | "expressway";
  totalLengthKm: number;
  numberOfLanes: number;
  pavementType: "flexible" | "rigid" | "composite";
  designSpeed: number;            // km/h
  numberOfBridges: number;
  numberOfUnderpasses: number;
  numberOfInterchanges: number;
  numberOfTollPlazas: number;
  majorBridgeLengthM?: number;
  embankmentHeightMax?: number;   // max fill height in metres
  cutHeightMax?: number;          // max cut height in metres
  hasServiceRoad: boolean;
  hasCentralVerge: boolean;
  hasHighMast?: boolean;
  isNHAI: boolean;
  region: string;
  soilType: "rock" | "black_cotton" | "alluvial" | "sandy";
  utilityRelocationRequired: boolean;
  forestClearanceRequired: boolean;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface BridgeParameters {
  projectType: "bridge_major" | "bridge_minor" | "bridge_cable";
  totalLengthM: number;
  spanArrangement: string;        // e.g. "3 × 50m + 5 × 120m"
  maxSpanM: number;
  numberOfSpans: number;
  numberOfPiers: number;
  widthM: number;
  numberOfLanes: number;
  foundationType: "pile" | "well" | "open_cut" | "caisson";
  pileDepthM?: number;
  waterDepthM: number;
  crossingType: "river" | "valley" | "road" | "railway" | "sea";
  superstructureType: "psc_girder" | "balanced_cantilever" | "cable_stayed" | "steel_truss" | "composite";
  hasTollGantry: boolean;
  seismicZone: "II" | "III" | "IV" | "V";
  region: string;
  soilType: "rock" | "sand" | "silt" | "clay";
  isDrySeasonConstruction: boolean;
  ircProofLoadRequired: boolean;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface MetroParameters {
  projectType: "metro_elevated" | "metro_underground";
  totalLengthKm: number;
  numberOfStations: number;
  numberOfElevatedStations?: number;
  numberOfUndergroundStations?: number;
  viaductLengthKm?: number;
  tunnelLengthKm?: number;
  tbmDiameterM?: number;
  stationBoxDepthM?: number;
  rollingStockCars: number;
  trainConfiguration: string;
  signalingSystem: "CBTC" | "conventional";
  hasDepot: boolean;
  depotAreaHa?: number;
  powerSupplyKV: number;
  gaugeMM: number;
  cmrsInspectionRequired: boolean;
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "mixed";
  groundwaterDepthM?: number;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface WaterTreatmentParameters {
  projectType: "water_treatment_plant" | "sewage_treatment_plant";
  capacityMLD: number;
  numberOfUnits: number;
  stpProcess?: "ASP" | "SBR" | "MBR" | "UASB" | "FAB";
  sourceType?: "surface" | "groundwater";
  rawWaterTurbidityMax?: number;
  hasOnlineAnalyser: boolean;
  hasSCADA: boolean;
  sludgeTreatment: "drying_beds" | "centrifuge" | "belt_press" | "none";
  intakeType?: "river" | "reservoir" | "well";
  effluentDisposal?: "river" | "land" | "reuse";
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  groundwaterDepthM?: number;
  spCBApprovalRequired: boolean;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface MMLPParameters {
  projectType: "mmlp_greenfield" | "mmlp_expansion" | "logistics_park";
  totalAreaHa: number;
  warehouseAreaSqm: number;
  numberOfWarehouses: number;
  hasRailConnectivity: boolean;
  railSidingLengthM?: number;
  truckBaysPerWarehouse: number;
  hasAsrs: boolean;
  hasRtg: boolean;
  numberOfRtg?: number;
  hasReachStacker: boolean;
  numberOfReachStackers?: number;
  morApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface ICDParameters {
  projectType: "icd_rail_linked" | "icd_road_linked" | "private_freight_terminal" | "goods_shed";
  totalAreaHa: number;
  yardAreaHa: number;
  hasRailSiding: boolean;
  railSidingLengthM?: number;
  customsWarehouseAreaSqm: number;
  hasXrayScanner: boolean;
  hasGantryScanner: boolean;
  numberOfRtg?: number;
  annualCapacityTEU?: number;
  hasContainerFreightStation: boolean;
  cbicApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface LiquidCargoTerminalParameters {
  projectType: "liquid_cargo_terminal" | "chemical_jetty" | "lpg_terminal";
  numberOfBerths: number;
  jettyLengthM: number;
  dredgeDepthM: number;
  numberOfMLAs: number;
  storageTankCapacityKL: number;
  numberOfTanks: number;
  hasBulletStorage: boolean;
  hasVRU: boolean;
  pipelineLengthM: number;
  pesoApprovalRequired: boolean;
  pngrbApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface TunnelParameters {
  projectType:        "road_tunnel" | "railway_tunnel" | "water_conveyance_tunnel";
  totalLengthM:       number;
  numberOfTubes:      number;
  excavationMethod:   "natm" | "tbm" | "cut_and_cover";
  internalDiameterM:  number;
  numberOfAdits:      number;
  hasVentilationShaft: boolean;
  rockClass:          "I" | "II" | "III" | "IV" | "V";
  ingressWaterClass:  "low" | "medium" | "high";
  dgmsApprovalRequired: boolean;
  region:             string;
  soilType:           "rock" | "mixed_face" | "soft_ground";
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface RailwayParameters {
  projectType:              "new_line" | "doubling" | "gauge_conversion" | "station_redevelopment";
  totalLengthKm:            number;
  numberOfStations:         number;
  numberOfMajorBridges:     number;
  numberOfROBs:             number;
  numberOfLevelCrossings:   number;
  hasLargeCutting:          boolean;
  hasLargeEmbankment:       boolean;
  trackGauge:               "broad_gauge" | "metre_gauge" | "standard_gauge";
  designSpeedKmh:           number;
  isElectrified:            boolean;
  hasMajorBridge:           boolean;
  hasTerminalFacilities:    boolean;
  landAcquisitionRequired:  boolean;
  forestClearanceRequired:  boolean;
  rdsoApprovalRequired:     boolean;
  crsInspectionRequired:    boolean;
  region:                   string;
  soilType:                 "rock" | "black_cotton" | "alluvial" | "sandy";
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export interface BuildingParameters {
  projectType: "residential_highrise" | "commercial_office" | "industrial_shed" | "hospital" | "data_center" | "hotel";
  // Scale
  totalBuiltUpAreaSqm: number;       // total BUA across all floors and blocks
  numberOfFloors: number;            // floors above ground (excluding basement)
  floorHeightM: number;              // typical floor-to-floor height in metres
  basementLevels: number;            // 0, 1, 2, 3 …
  numberOfBlocks: number;            // identical/similar construction blocks
  floorPlateSqm?: number;            // single floor area (BUA / numberOfFloors)
  // Structure
  structuralSystem: "rcc_framed" | "steel_frame" | "precast" | "composite";
  foundationType: "raft" | "pile" | "isolated_footing";
  pileDepthM?: number;               // average pile depth in metres (if pile foundation)
  // Services
  hasMEP: boolean;
  hasFacadeSystem: boolean;          // curtain wall / ACP / glass facade
  hasLift: boolean;
  numberOfLifts?: number;
  hasFireFighting: boolean;
  hasSprinklers: boolean;
  hasHVAC: boolean;
  // Compliance
  reraRegistrationRequired: boolean; // true for residential projects
  environmentalClearanceRequired: boolean; // true if BUA > 20,000 sqm
  // Context
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  groundwaterDepthM?: number;
  // Scheduling fields
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

export type InfrastructureParameters =
  | PortParameters
  | AirportParameters
  | HighwayParameters
  | BridgeParameters
  | MetroParameters
  | WaterTreatmentParameters
  | MMLPParameters
  | ICDParameters
  | LiquidCargoTerminalParameters
  | TunnelParameters
  | RailwayParameters
  | BuildingParameters;

export type InfrastructureType =
  | "port"
  | "airport"
  | "highway"
  | "bridge"
  | "metro"
  | "water_treatment"
  | "mmlp"
  | "icd"
  | "liquid_cargo_terminal"
  | "tunnel"
  | "railway"
  | "building";

// ─── Shared scheduling schema appended to every prompt ───────────────────────
// These fields are what the rules engine uses to create per-section task instances
// and what the RCPSP optimizer uses to respect resource and spatial constraints.

const SCHEDULING_SCHEMA = `
Additionally extract these scheduling fields and append them to your JSON output:

"sections": [
  // Split the project into 5–20 logical construction sections.
  // Sectioning rule by type:
  //   Highway / Railway: one section per 5–10km chainage band
  //   Bridge: one section per pier or span cluster (group every 3–5 piers)
  //   Port: one section per berth zone, plus breakwater if present
  //   Airport: runway zone, parallel taxiway zone, apron zone, terminal zone, ATC zone
  //   Metro: per station zone + inter-station viaduct / tunnel drive
  //   WTP/STP: intake zone, treatment units zone, sludge zone, electrical zone
  //   MMLP/ICD: warehouse blocks + rail siding zone + gate/systems zone
  //   Liquid terminal: jetty zone, pipeline zone, tank farm zone
  //   Tunnel: portal zone, heading zone (split at adits), lining zone
  {
    "id": "S01",                        // SHORT ID, no spaces
    "name": "Chainage 0+000 to 18+000", // human readable
    "quantityValue": 360000,            // dominant quantity (earthwork m³, piling m, etc.)
    "quantityUnit": "m³",
    "accessRoute": "main_haul_road",    // how plant reaches this section
    "maxConcurrentActivities": 2,       // RCPSP: max parallel activities in this zone
    "directionForced": true,            // true = sequence direction fixed by geometry
    "directionNote": "paving from Ch 0+000 toward Ch 45+000",
    "startChainage": 0,                 // km — linear projects only
    "endChainage": 18,                  // km — linear projects only
    "quantityBasis": "boq"              // "boq" = from BOQ (exact), "drawing_measured" = scaled from drawing, "estimated" = assumed
  }
],
"availableResources": [
  // Equipment available on site from mobilisation plan / method statement / tender.
  // If not found in documents, assume a standard fleet for this project type and scale.
  // Allowed type values: piling_rig | excavator_fleet | launching_gantry | paving_train |
  //   concrete_pump | crane | tbm | natm_heading_crew | dredger | general_civil_crew |
  //   mep_crew | track_laying_crew | erection_crew | formwork_crew
  //
  // If documents mention a mobilisation schedule, resource histogram, S-curve, or phased
  // deployment (e.g. "2 rigs in month 1, 4 rigs from month 3"), populate availabilityWindows.
  // month 1 = project start. If resource count is constant throughout, omit availabilityWindows.
  //
  // Common patterns to look for:
  //   "Contractor to mobilise X equipment after site clearance" → window starts month 2-3
  //   "Peak workforce N workers during earthwork phase" → window spans earthwork months
  //   "Paving train deployed after subgrade completion" → window starts after earthwork ends
  //   "Equipment demobilised after [phase] completion" → window ends at that month
  {
    "type": "piling_rig",
    "count": 4,
    "basis": "document",
    "description": "4 × Bauer BG30 per method statement",
    "availabilityWindows": [
      { "fromProjectMonth": 1, "toProjectMonth": 3,  "count": 2, "note": "initial mobilisation" },
      { "fromProjectMonth": 4, "toProjectMonth": 18, "count": 4, "note": "full fleet after site clearance" },
      { "fromProjectMonth": 19,"toProjectMonth": 24, "count": 2, "note": "demobilisation phase" }
    ]
  }
],
"productivityRates": [
  // Productivity per calendar day per ONE unit of resourceType.
  // resourceType MUST match a type value used in availableResources above.
  // Priority: document rate > Indian standard norm > typical Indian project benchmark.
  // Embed IS/MoRTH norm values when document is silent:
  //   HW-EW-01 earthwork:       2000 m³/day per excavator_fleet        (MoRTH Sec 300)
  //   HW-PV-01 subbase/WMM:      500 m²/day per paving_train           (MoRTH Sec 400)
  //   HW-PV-03 DBM/BC:           300 m²/day per paving_train
  //   BR-PL-01 piling 600mm:       1 pile/day per piling_rig           (IS 2911)
  //   BR-SU-01 pier concrete:     15 m³/day per formwork_crew
  //   BR-SS-01 PSC girder:    1 span/14 days per launching_gantry
  //   PT-DR-01 dredging:        5000 m³/day per dredger
  //   PT-PL-01 marine piling:    0.8 pile/day per piling_rig
  //   TN-EX-01 NATM rock III:    1.5 m/day per natm_heading_crew
  //   TN-EX-02 TBM:               8 m/day per tbm  (rock II–III)
  //   MR-PL-01 viaduct piling:    1 pile/day per piling_rig
  //   RW-EW-01 railway earthwork: 1500 m³/day per excavator_fleet
  //   RW-TL-01 track laying:      1 km/day per track_laying_crew
  { "taskCode": "HW-EW-01", "resourceType": "excavator_fleet", "ratePerDayPerUnit": 2000, "basis": "indian_norm", "sourceNote": "MoRTH Section 300 earthwork norms" }
],
// IMPORTANT: For every rate where basis="indian_norm", also add an entry to missingData:
//   "Productivity rate for [taskCode] not in documents — IS/MoRTH norm applied ([rate] [unit]/day)"
// Example: "Productivity rate for HW-EW-01 not in documents — MoRTH norm applied (2000 m³/day)"

"monsoonMonths": [6, 7, 8, 9],
// Which calendar months (1=Jan … 12=Dec) severely restrict site work.
// West coast (Kerala, Goa, Konkan): [6,7,8,9]. East coast (Andhra, Tamil Nadu): [10,11].
// Peninsular interior: [7,8,9]. Himalayan / NE India: [6,7,8,9]. Rajasthan / Gujarat arid: [7,8].
// If project documents state working months, use those. Otherwise use regional defaults above.

"missingData": ["BOQ not provided", "Soil investigation report not found"],
// List every data item you expected but could not find in the uploaded documents.
// Common missing items: BOQ, geotechnical report, traffic study, environmental clearance,
// method statement, approved programme, drawings (plan & elevation), soil report.

"confidence": "medium"
// "high"   = most parameters derived directly from documents
// "medium" = mix of document data and Indian standard defaults
// "low"    = mostly guessed from project type alone; documents were insufficient
`;

// ─── Claude Prompts ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are an expert infrastructure project analyst for Indian construction projects.
Extract structured project parameters from uploaded documents (PDFs, drawings, reports, specifications).
Return ONLY valid JSON matching the exact interface specified. Do not include explanation or commentary.
If a value cannot be found, use null or sensible defaults based on Indian standards.
For numerical ranges, use the midpoint or typical value for Indian projects.`;

function buildPortPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a PORT / MARINE project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface PortParameters {
  projectType: "port_container_terminal" | "port_bulk_cargo" | "port_fishing_harbour";
  capacityTEU?: number;
  capacityMTPY?: number;
  numberOfBerths: number;
  berthLengthM: number;
  dredgeDepthM: number;
  reclamationAreaHa?: number;
  quayLengthM: number;
  yardAreaHa: number;
  stscranes?: number;
  rtgCranes?: number;
  tidalRange: "microtidal" | "mesotidal" | "macrotidal";
  monsoonExposure: "sheltered" | "exposed" | "partially_exposed";
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
  settlementMonitoringRequired: boolean;
  cargoCommodity?: string;
  hasBreakwater: boolean;
  breakwaterLengthM?: number;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- tidalRange: microtidal < 2m, mesotidal 2–4m, macrotidal > 4m. Gulf of Kutch/Khambhat = macrotidal.
- monsoonExposure: west coast ports = exposed, east coast = partially_exposed, harbour inside bay = sheltered.
- settlementMonitoringRequired: true if reclamation area > 20ha or soft clay soil.
- dredgeDepthM: design depth below chart datum (typically 12–17m for container terminals).
- Port sections: one per berth zone (BERTH_A, BERTH_B...) + BREAKWATER + YARD + UTILITIES.
- Port resources: dredger (1–3), piling_rig (2–4), crane (2–6), general_civil_crew (2–4 gangs).
- Port productivity defaults: PT-DR-01 dredging = 5000 m³/day, PT-PL-01 marine piling = 0.8 pile/day.
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildAirportPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for an AIRPORT project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface AirportParameters {
  projectType: "airport_greenfield" | "airport_expansion";
  runwayLengthM: number;
  runwayWidthM: number;
  numberOfRunways: number;
  pavementType: "flexible" | "rigid" | "composite";
  terminalAreaSqm: number;
  designPaxMPPA: number;
  codeLetterICAO: "A" | "B" | "C" | "D" | "E" | "F";
  hasILS: boolean;
  ilsCategory: "CAT_I" | "CAT_II" | "CAT_III" | null;
  hasCargo: boolean;
  cargoAreaSqm?: number;
  atcTowerHeight?: number;
  perimeterLengthM: number;
  region: string;
  soilType: "rock" | "dense_sand" | "expansive" | "alluvial";
  groundwaterDepthM?: number;
  dgcaLicenceRequired: boolean;
  aaiApprovalRequired: boolean;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- ICAO code: A=small piston, B=turboprop, C=narrow-body (B737/A320), D=wide-body (B787), E=large wide-body (B777), F=A380.
- Greenfield: new site. Expansion: extending existing runway or new terminal at existing airport.
- dgcaLicenceRequired: always true for new airports.
- aaiApprovalRequired: always true for civil airports in India.
- Airport sections: EARTHWORKS, RUNWAY_PAVEMENT, TAXIWAY_APRON, TERMINAL_BUILDING, ATC_FACILITIES, PERIMETER_SECURITY, UTILITIES.
- Airport resources: excavator_fleet (3–6), paving_train (1–2 per runway), crane (2–4), general_civil_crew (4–8 gangs).
- Airport productivity defaults: AP-EW-01 earthwork = 3000 m³/day per excavator fleet, AP-PV-01 pavement = 400 m²/day per paving train.
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildHighwayPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a HIGHWAY project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface HighwayParameters {
  projectType: "highway_4lane" | "highway_6lane" | "expressway";
  totalLengthKm: number;
  numberOfLanes: number;
  pavementType: "flexible" | "rigid" | "composite";
  designSpeed: number;
  numberOfBridges: number;
  numberOfUnderpasses: number;
  numberOfInterchanges: number;
  numberOfTollPlazas: number;
  majorBridgeLengthM?: number;
  embankmentHeightMax?: number;
  cutHeightMax?: number;
  hasServiceRoad: boolean;
  hasCentralVerge: boolean;
  hasHighMast?: boolean;
  isNHAI: boolean;
  region: string;
  soilType: "rock" | "black_cotton" | "alluvial" | "sandy";
  utilityRelocationRequired: boolean;
  forestClearanceRequired: boolean;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- Highway type: 4-lane = NH upgrade, 6-lane = major NH, expressway = access-controlled 6–8 lane.
- designSpeed: 4-lane = 100 km/h, 6-lane = 100–120 km/h, expressway = 120–140 km/h.
- isNHAI: true if NH; false if state highway.
- forestClearanceRequired: true if forest land involved (Stage I FC from MoEF needed).
- black_cotton = expansive soil requiring lime treatment.
- Highway sections: one per 5km chainage band. For 45km road = S01 (0–5km), S02 (5–10km) … S09 (40–45km).
  Each section quantityValue = earthwork m³ for that band (estimate as: length_km × 1000 × avg_width_m × avg_height_m).
  accessRoute = "main_haul_road" unless a specific haul road is mentioned.
  maxConcurrentActivities = 2 (two spreads can run in non-adjacent sections simultaneously).
  directionForced = true if documents state a specific paving direction; otherwise false.
- Highway resources: excavator_fleet (2–4), paving_train (1–2), concrete_pump (1–2), general_civil_crew (4–8).
- Highway productivity (MoRTH norms):
  HW-EW-01 earthwork = 2000 m³/day per excavator fleet
  HW-SB-01 subbase = 500 m²/day per paving crew
  HW-GSB-01 granular subbase = 600 m²/day
  HW-WMM-01 WMM = 500 m²/day
  HW-DBM-01 DBM = 300 m²/day per paving train
  HW-BC-01 bituminous concrete = 250 m²/day per paving train
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildBridgePrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a BRIDGE project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface BridgeParameters {
  projectType: "bridge_major" | "bridge_minor" | "bridge_cable";
  totalLengthM: number;
  spanArrangement: string;
  maxSpanM: number;
  numberOfSpans: number;
  numberOfPiers: number;
  widthM: number;
  numberOfLanes: number;
  foundationType: "pile" | "well" | "open_cut" | "caisson";
  pileDepthM?: number;
  waterDepthM: number;
  crossingType: "river" | "valley" | "road" | "railway" | "sea";
  superstructureType: "psc_girder" | "balanced_cantilever" | "cable_stayed" | "steel_truss" | "composite";
  hasTollGantry: boolean;
  seismicZone: "II" | "III" | "IV" | "V";
  region: string;
  soilType: "rock" | "sand" | "silt" | "clay";
  isDrySeasonConstruction: boolean;
  ircProofLoadRequired: boolean;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- bridge_major: length > 60m; bridge_minor: length ≤ 60m; bridge_cable: cable-stayed or suspension.
- Well foundation: typically used for large river bridges with scour concern (Ganga, Brahmaputra).
- Pile foundation: preferred for most urban and highway bridges.
- ircProofLoadRequired: always true per IRC 6.
- isDrySeasonConstruction: true for river crossings in India (work restricted to Oct–Feb).
- Seismic zone: Himalayas/NE India = V; Gujarat = V; most peninsular India = II/III.
- Bridge sections: group piers into clusters of 3–5. For 12 piers = PIER_P1_P4, PIER_P5_P8, PIER_P9_P12, plus SUPERSTRUCTURE_SPANS and APPROACHES.
  quantityValue per section = number of piles in that section (for piling sections).
  maxConcurrentActivities = number of piling rigs available (usually 2).
  directionForced = true for river bridges (work from both banks toward mid-river).
- Bridge resources: piling_rig (2–4), crane (2–4), formwork_crew (2–4), concrete_pump (2).
- Bridge productivity (IS norms):
  BR-PL-01 piling (600mm) = 1 pile/day per piling rig
  BR-PL-02 piling (1000mm+) = 0.5 pile/day per piling rig
  BR-PE-01 pier construction = 15 m³/day per formwork crew
  BR-SS-01 PSC girder erection = 1 span per 14 days per launching gantry
  BR-SS-02 balanced cantilever = 3m/day per segment per cantilever traveller
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildMetroPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a METRO RAIL project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface MetroParameters {
  projectType: "metro_elevated" | "metro_underground";
  totalLengthKm: number;
  numberOfStations: number;
  numberOfElevatedStations?: number;
  numberOfUndergroundStations?: number;
  viaductLengthKm?: number;
  tunnelLengthKm?: number;
  tbmDiameterM?: number;
  stationBoxDepthM?: number;
  rollingStockCars: number;
  trainConfiguration: string;
  signalingSystem: "CBTC" | "conventional";
  hasDepot: boolean;
  depotAreaHa?: number;
  powerSupplyKV: number;
  gaugeMM: number;
  cmrsInspectionRequired: boolean;
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "mixed";
  groundwaterDepthM?: number;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- cmrsInspectionRequired: always true in India.
- powerSupplyKV: 25kV AC for most new Indian metros; 750V DC (third rail) for older Delhi Metro lines.
- gaugeMM: 1435 = standard gauge (most Indian metros); 1000 = some older systems.
- TBM diameter: typically 5.8–6.7m for twin single-track tunnels.
- Metro sections: one per station zone + inter-station viaduct/tunnel drive segment.
  For elevated: STATION_S1 ... STATION_SN, VIADUCT_S1_S2, VIADUCT_S2_S3 ..., DEPOT.
  For underground: STATION_U1 ... STATION_UN, TBM_DRIVE_1 ... TBM_DRIVE_N, DEPOT.
  quantityValue for viaduct sections = segment count. For station zones = 1 (unit).
  maxConcurrentActivities: viaduct sections = 2 (two casting yards), station = 1.
- Metro resources: piling_rig (4–8), erection_crew (2–4 for viaduct), tbm (1–2 for UG), general_civil_crew (4–8).
- Metro productivity:
  MR-PL-01 bored piling = 1 pile/day per piling rig
  MR-VP-01 viaduct pier = 10 m³/day per formwork crew
  MR-VS-01 viaduct segment erection = 3 segments/day per erection crew
  MR-TB-01 TBM drive = 10 m/day per TBM (soft ground); 8 m/day (mixed face)
  MR-ST-01 station box excavation = 80 m³/day per excavator
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildWTPPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a WATER TREATMENT / SEWAGE TREATMENT PLANT project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface WaterTreatmentParameters {
  projectType: "water_treatment_plant" | "sewage_treatment_plant";
  capacityMLD: number;
  numberOfUnits: number;
  stpProcess?: "ASP" | "SBR" | "MBR" | "UASB" | "FAB";
  sourceType?: "surface" | "groundwater";
  rawWaterTurbidityMax?: number;
  hasOnlineAnalyser: boolean;
  hasSCADA: boolean;
  sludgeTreatment: "drying_beds" | "centrifuge" | "belt_press" | "none";
  intakeType?: "river" | "reservoir" | "well";
  effluentDisposal?: "river" | "land" | "reuse";
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  groundwaterDepthM?: number;
  spCBApprovalRequired: boolean;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- WTP: treats raw water for drinking supply. STP: treats sewage/wastewater.
- stpProcess: ASP = activated sludge; SBR = sequencing batch reactor; MBR = membrane bioreactor; UASB = anaerobic; FAB = fluidised aerated bed.
- spCBApprovalRequired: always true for STP.
- numberOfUnits: parallel treatment streams (at least 2 for redundancy).
- capacityMLD: megalitres per day (1 MLD = 1000 m³/day).
- WTP/STP sections: INTAKE_PUMPING, CIVIL_STRUCTURES (tanks, chambers), MECHANICAL_EQUIPMENT,
  PIPING_VALVES, ELECTRICAL_INSTRUMENTATION, SLUDGE_ZONE, SCADA_ELECTRICAL, COMPOUND_ROADS.
  quantityValue per section in m³ (civil volume), no. (equipment count), or RM (piping).
  maxConcurrentActivities = number of parallel treatment streams (numberOfUnits).
- WTP/STP resources: general_civil_crew (3–6), concrete_pump (1–2), mep_crew (2–4), crane (1–2).
- WTP/STP productivity:
  WT-CS-01 RCC tank construction = 10 m³/day per formwork crew
  WT-ME-01 mechanical equipment installation = 1 unit/5 days per mep_crew
  WT-PP-01 piping = 20 RM/day per mep_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildMMLPPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a MMLP / LOGISTICS PARK project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface MMLPParameters {
  projectType: "mmlp_greenfield" | "mmlp_expansion" | "logistics_park";
  totalAreaHa: number;
  warehouseAreaSqm: number;
  numberOfWarehouses: number;
  hasRailConnectivity: boolean;
  railSidingLengthM?: number;
  truckBaysPerWarehouse: number;
  hasAsrs: boolean;
  hasRtg: boolean;
  numberOfRtg?: number;
  hasReachStacker: boolean;
  numberOfReachStackers?: number;
  morApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- mmlp_greenfield: new site with rail siding. mmlp_expansion: existing park extension. logistics_park: road-only park.
- morApprovalRequired: true if hasRailConnectivity.
- warehouseAreaSqm: total covered area across all warehouses.
- MMLP sections: SITE_GRADING, WAREHOUSE_BLOCK_1 ... WAREHOUSE_BLOCK_N, RAIL_SIDING (if present),
  YARD_PAVEMENT, ROAD_CONNECTIVITY, UTILITIES_SERVICES, SYSTEMS_TECHNOLOGY.
  quantityValue for warehouse blocks in m² (floor area per block).
  maxConcurrentActivities = 2 (two warehouse blocks can be under construction simultaneously).
- MMLP resources: excavator_fleet (2–3), crane (2–4), general_civil_crew (4–8), mep_crew (2–4).
- MMLP productivity:
  ML-WH-01 warehouse frame = 300 m²/day per general_civil_crew
  ML-YP-01 yard pavement = 400 m²/day per paving crew
  ML-RS-01 rail siding = 50 m/day per track_laying_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildICDPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for an ICD / DRY PORT / PRIVATE FREIGHT TERMINAL project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface ICDParameters {
  projectType: "icd_rail_linked" | "icd_road_linked" | "private_freight_terminal" | "goods_shed";
  totalAreaHa: number;
  yardAreaHa: number;
  hasRailSiding: boolean;
  railSidingLengthM?: number;
  customsWarehouseAreaSqm: number;
  hasXrayScanner: boolean;
  hasGantryScanner: boolean;
  numberOfRtg?: number;
  annualCapacityTEU?: number;
  hasContainerFreightStation: boolean;
  cbicApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- ICD: customs bonded, handles import/export containers. Linked by rail or road to seaport.
- cbicApprovalRequired: always true — CBIC gazette notification mandatory.
- hasXrayScanner: true if non-intrusive inspection scanner mentioned.
- ICD sections: CIVIL_EARTHWORKS, YARD_PAVEMENT, RAIL_SIDING (if hasRailSiding),
  CUSTOMS_WAREHOUSE, GATE_SYSTEMS, UTILITIES_SERVICES.
  quantityValue for yard pavement in m², warehouse in m².
  maxConcurrentActivities = 2.
- ICD resources: excavator_fleet (2–3), paving_train (1), general_civil_crew (3–5), mep_crew (1–2).
- ICD productivity:
  IC-YP-01 yard pavement = 400 m²/day per paving crew
  IC-WH-01 warehouse = 250 m²/day per general_civil_crew
  IC-RS-01 rail siding = 40 m/day per track_laying_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildLCTPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a LIQUID CARGO TERMINAL / CHEMICAL JETTY / LPG TERMINAL project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface LiquidCargoTerminalParameters {
  projectType: "liquid_cargo_terminal" | "chemical_jetty" | "lpg_terminal";
  numberOfBerths: number;
  jettyLengthM: number;
  dredgeDepthM: number;
  numberOfMLAs: number;
  storageTankCapacityKL: number;
  numberOfTanks: number;
  hasBulletStorage: boolean;
  hasVRU: boolean;
  pipelineLengthM: number;
  pesoApprovalRequired: boolean;
  pngrbApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- liquid_cargo_terminal: petroleum products. chemical_jetty: acids/solvents. lpg_terminal: LPG.
- MLA: Marine Loading Arms — lead time 270 days (order immediately).
- hasBulletStorage: true for LPG (mounded bullets or spheres).
- hasVRU: mandatory for volatile hydrocarbon terminals.
- pngrbApprovalRequired: true only for LPG/gas terminals.
- pesoApprovalRequired: always true.
- LCT sections: MARINE_STRUCTURES (jetty piles + deck), DREDGING, PIPELINE_PIPING,
  STORAGE_TANKS, FIRE_SAFETY_SYSTEMS, UTILITIES, REGULATORY_APPROVALS.
  quantityValue: jetty in RM, pipeline in RM, tanks by count.
  maxConcurrentActivities: MARINE = 1 (single access), TANK_FARM = 2 (two tank bunds simultaneously).
- LCT resources: piling_rig (2–3 for marine), crane (2–3), mep_crew (2–4), dredger (1).
- LCT productivity:
  LC-MP-01 marine piling = 0.8 pile/day per piling rig
  LC-TK-01 storage tank erection = 1 tank per 45 days per crane
  LC-PP-01 pipeline piping = 15 RM/day per mep_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildTunnelPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a ROAD / RAILWAY / WATER CONVEYANCE TUNNEL project from the uploaded documents above.
Return JSON matching this exact TypeScript interface:

interface TunnelParameters {
  projectType: "road_tunnel" | "railway_tunnel" | "water_conveyance_tunnel";
  totalLengthM: number;
  numberOfTubes: number;
  excavationMethod: "natm" | "tbm" | "cut_and_cover";
  internalDiameterM: number;
  numberOfAdits: number;
  hasVentilationShaft: boolean;
  rockClass: "I" | "II" | "III" | "IV" | "V";
  ingressWaterClass: "low" | "medium" | "high";
  dgmsApprovalRequired: boolean;
  region: string;
  soilType: "rock" | "mixed_face" | "soft_ground";
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- numberOfTubes: 1 = single tube; 2 = twin tube (one per direction, IRC:SP-91 recommends for > 500m).
- excavationMethod: natm = most common in India (drill & blast); tbm = long tunnels > 5km; cut_and_cover = shallow urban.
- rockClass: Barton Q: I = competent (Q > 40), II = good (10–40), III = fair (1–10), IV = poor (0.1–1), V = very poor (< 0.1).
- dgmsApprovalRequired: true for all NATM drill-and-blast. false for TBM or cut-and-cover.
- Tunnel sections: PORTAL_FACE_1 (entry portal), HEADING_ZONE_1 ... HEADING_ZONE_N (split at each adit),
  PORTAL_FACE_2 (exit portal). Each heading zone is a drive between two access points.
  For twin tube: suffix _TUBE_A and _TUBE_B for each zone.
  quantityValue = drive length in metres for each heading zone.
  accessRoute: PORTAL_FACE_1 = "approach_road_portal_1", adit zones = "adit_road_N".
  maxConcurrentActivities = number of active headings (1 per heading zone, more if twin tube).
  directionForced = true (each heading drives in one direction from its access point).
- Tunnel resources: natm_heading_crew (1 per heading), tbm (1–2), general_civil_crew (2–4 for lining).
- Tunnel productivity:
  TN-EX-01 NATM excavation = 1.5 m/day per heading crew (rock class III) — adjusts by class
    rock class I = 3.0 m/day, II = 2.0 m/day, III = 1.5 m/day, IV = 0.8 m/day, V = 0.3 m/day
  TN-TB-01 TBM drive = 10 m/day (soft ground); 8 m/day (mixed); 15 m/day (competent rock)
  TN-LN-01 concrete lining = 5 m/day per lining crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildRailwayPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a MAINLINE RAILWAY project from the uploaded documents above.
This is Indian Railways broad-gauge infrastructure — NOT metro/rapid transit.
Return JSON matching this exact TypeScript interface:

interface RailwayParameters {
  projectType: "new_line" | "doubling" | "gauge_conversion" | "station_redevelopment";
  totalLengthKm: number;
  numberOfStations: number;
  numberOfMajorBridges: number;
  numberOfROBs: number;
  numberOfLevelCrossings: number;
  hasLargeCutting: boolean;
  hasLargeEmbankment: boolean;
  trackGauge: "broad_gauge" | "metre_gauge" | "standard_gauge";
  designSpeedKmh: number;
  isElectrified: boolean;
  hasMajorBridge: boolean;
  hasTerminalFacilities: boolean;
  landAcquisitionRequired: boolean;
  forestClearanceRequired: boolean;
  rdsoApprovalRequired: boolean;
  crsInspectionRequired: boolean;
  region: string;
  soilType: "rock" | "black_cotton" | "alluvial" | "sandy";
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- projectType: new_line = greenfield; doubling = third/fourth line; gauge_conversion = MG→BG; station_redevelopment = station upgrade.
- totalLengthKm: route length in km. Default 50 if unknown.
- numberOfStations: halting/terminal stations on new section. Default 5 if unknown.
- trackGauge: broad_gauge (1676mm) for all new Indian Railways; metre_gauge for narrow corridors.
- designSpeedKmh: 100 for branch lines, 130 for mail/express, 160 for semi-high-speed.
- Railway sections: one per 10km chainage band. For 80km route = S01 (0–10km) … S08 (70–80km).
  quantityValue = earthwork m³ per section (estimate: length_km × 1000 × formation_width_m × avg_height_m).
  accessRoute: "parallel_road" or specific haul road name from documents.
  maxConcurrentActivities = 2 (two earthwork spreads in non-adjacent sections).
  directionForced = usually false for railway (work can proceed from any section).
- Railway resources: excavator_fleet (3–6), track_laying_crew (1–2), general_civil_crew (4–8), crane (2–4).
- Railway productivity (Indian Railways / RDSO norms):
  RW-EW-01 earthwork = 1500 m³/day per excavator fleet
  RW-TL-01 track laying = 1 km/day per track_laying_crew (using track laying machine)
  RW-BL-01 ballasting = 500 m/day per general_civil_crew
  RW-ST-01 station building = 100 m²/day per general_civil_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

function buildBuildingPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a BUILDING / REAL ESTATE project from the uploaded documents above.
This covers residential towers, commercial offices, industrial sheds, hospitals, data centres, and hotels.
Return JSON matching this exact TypeScript interface:

interface BuildingParameters {
  projectType: "residential_highrise" | "commercial_office" | "industrial_shed" | "hospital" | "data_center" | "hotel";
  totalBuiltUpAreaSqm: number;
  numberOfFloors: number;
  floorHeightM: number;
  basementLevels: number;
  numberOfBlocks: number;
  floorPlateSqm?: number;
  structuralSystem: "rcc_framed" | "steel_frame" | "precast" | "composite";
  foundationType: "raft" | "pile" | "isolated_footing";
  pileDepthM?: number;
  hasMEP: boolean;
  hasFacadeSystem: boolean;
  hasLift: boolean;
  numberOfLifts?: number;
  hasFireFighting: boolean;
  hasSprinklers: boolean;
  hasHVAC: boolean;
  reraRegistrationRequired: boolean;
  environmentalClearanceRequired: boolean;
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  groundwaterDepthM?: number;
  sections: InfraSection[];
  availableResources: InfraResource[];
  productivityRates: InfraProductivityRate[];
  monsoonMonths: number[];
  missingData: string[];
  confidence: "high" | "medium" | "low";
}

Guidance:
- projectType: residential_highrise ≥ 10 floors; commercial_office = office/IT park; industrial_shed = warehouse/factory; hospital = healthcare; data_center = Tier III/IV DC; hotel.
- totalBuiltUpAreaSqm: total floor area across ALL floors and ALL blocks (including basement).
- floorPlateSqm: if not stated, estimate as totalBuiltUpAreaSqm / numberOfFloors.
- numberOfBlocks: number of separate construction blocks/towers. Default 1.
- basementLevels: count basement floors (B1, B2 etc.). Default 0 if not mentioned.
- structuralSystem: default rcc_framed for most Indian buildings; steel_frame for industrial sheds; precast for rapid construction projects.
- foundationType: pile = soft soil or high-rise > 15 floors; raft = medium soil + moderate height; isolated_footing = low-rise on hard soil.
- pileDepthM: if pile foundation — typical depths 15–25m for soft clay, 8–15m for medium soil.
- hasFacadeSystem: true for commercial/hotel glass facade or ACP cladding — NOT standard brick wall.
- hasSprinklers: true for buildings > 15m height (NBC 2016 mandatory).
- environmentalClearanceRequired: true if totalBuiltUpAreaSqm > 20000.
- reraRegistrationRequired: true for all residential_highrise.
- groundwaterDepthM: from soil investigation report; if not found, typical values — coastal cities = 1–3m, inland metros = 3–8m, hilly regions = 10–20m.

Building sections — split the project by construction blocks/zones:
- Single block ≤ 10 floors: 1 section (the whole building)
- Single block 11–20 floors: split into 2 sections (lower half / upper half)
- Single block > 20 floors: one section per 5–8 floor cluster (LOWER_FLOORS, MID_FLOORS, UPPER_FLOORS, TOP_FLOORS)
- Multiple blocks: one section per block (BLOCK_A, BLOCK_B, BLOCK_C…)
- quantityValue for each section = floorPlateSqm × number of floors in that section
- quantityUnit = "Sqm"
- maxConcurrentActivities = 1 per section (one formwork gang per floor cluster; separate gangs per block)
- accessRoute: "tower_crane_coverage" for high-rise, "mobile_crane_access" for low-rise
- directionForced = true (construction proceeds floor by floor from bottom to top)

Building resources:
- formwork_crew — key resource for RCC superstructure (1 gang per active block/section, each gang ~12–15 workers)
- concrete_pump — 1 boom placer per active pour; shared across blocks if sections alternate
- general_civil_crew — masonry, plastering, finishing gangs
- crane — tower crane (1 per high-rise block)
- piling_rig — for pile foundation (1–2 rigs)
- mep_crew — MEP installation gangs
Building resource typical fleet for Indian projects:
  formwork_crew: 2–4 gangs (1 per active block)
  general_civil_crew: 4–8 gangs
  concrete_pump: 1–2 per active block
  mep_crew: 2–4 gangs

Building productivity rates (CPWD DSR 2023 / NBC norms):
  BL-ST-02 typical floor slab: 150–250 Sqm/day per formwork_crew
  BL-ST-01 columns/walls: 10–15 Cum/day per formwork_crew
  BL-EX-01 excavation: 200–400 Cum/day per excavator_fleet
  BL-EX-02 bored piling: 8–15 Rmt/day per piling_rig
  BL-EV-01 masonry: 60–80 Sqm/day per general_civil_crew
  BL-ME-01 electrical: 150–200 Sqm/day per mep_crew
  BL-ME-02 plumbing: 40–60 Rmt/day per mep_crew
  BL-FF-04 painting: 300–500 Sqm/day per general_civil_crew
${SCHEDULING_SCHEMA}

Respond with ONLY the JSON object, no markdown.`;
}

// ─── Main Extraction Function ──────────────────────────────────────────────────

export async function extractInfrastructureParameters(
  infraType: InfrastructureType,
  documents: ParsedDocument[],
  extractionRuns: number = 1,
): Promise<InfrastructureParameters> {
  const promptBuilders: Record<InfrastructureType, () => string> = {
    port:                  buildPortPrompt,
    airport:               buildAirportPrompt,
    highway:               buildHighwayPrompt,
    bridge:                buildBridgePrompt,
    metro:                 buildMetroPrompt,
    water_treatment:       buildWTPPrompt,
    mmlp:                  buildMMLPPrompt,
    icd:                   buildICDPrompt,
    liquid_cargo_terminal: buildLCTPrompt,
    tunnel:                buildTunnelPrompt,
    railway:               buildRailwayPrompt,
    building:              buildBuildingPrompt,
  };

  const buildPrompt = promptBuilders[infraType];

  async function callClaude(promptText: string): Promise<InfrastructureParameters> {
    // Stable prompt goes to system for caching; documents go in the user message.
    const content = toClaudeContent(documents, "");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        temperature: 0,
        system: [
          {
            type: "text",
            text: promptText,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content }],
      }),
    });
    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content[0]?.type === "text" ? data.content[0].text : "";
    return JSON.parse(text.trim()) as InfrastructureParameters;
  }

  if (extractionRuns === 1) {
    return callClaude(buildPrompt());
  }

  // Multiple runs for variance reduction — majority vote on scalar fields, merge arrays
  const runs = await Promise.all(
    Array.from({ length: extractionRuns }, () => callClaude(buildPrompt())),
  );

  return mergeExtractionRuns(runs);
}

// Merge multiple extraction runs: majority vote for scalars, largest array for arrays
function mergeExtractionRuns(runs: InfrastructureParameters[]): InfrastructureParameters {
  if (runs.length === 1) return runs[0];

  type PlainObj = Record<string, unknown>;
  const merged: PlainObj = {};
  const firstRun = runs[0] as unknown as PlainObj;

  for (const key of Object.keys(firstRun)) {
    const values = runs.map((r) => (r as unknown as PlainObj)[key]);
    const nonNull = values.filter((v) => v !== null && v !== undefined);

    if (nonNull.length === 0) {
      merged[key] = null;
      continue;
    }

    // Arrays: take the run with the most entries (most complete extraction)
    if (Array.isArray(nonNull[0])) {
      const longest = nonNull.reduce<unknown[]>((best, arr) =>
        (arr as unknown[]).length > (best as unknown[]).length ? (arr as unknown[]) : best,
        nonNull[0] as unknown[]
      );
      merged[key] = longest;
      continue;
    }

    if (typeof nonNull[0] === "number") {
      const sum = nonNull.reduce<number>((a, b) => a + (b as number), 0);
      merged[key] = sum / nonNull.length;
    } else {
      // Majority vote for string/boolean fields
      const counts = new Map<unknown, number>();
      for (const v of nonNull) counts.set(v, (counts.get(v) ?? 0) + 1);
      let maxCount = 0;
      let winner: unknown = nonNull[0];
      for (const [v, c] of counts) {
        if (c > maxCount) { maxCount = c; winner = v; }
      }
      merged[key] = winner;
    }
  }

  return merged as unknown as InfrastructureParameters;
}
