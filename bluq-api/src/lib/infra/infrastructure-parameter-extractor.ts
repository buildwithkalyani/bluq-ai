// Infrastructure Parameter Extractor
// Claude-based extraction of project parameters from uploaded documents
// Analogous to parameter-extractor.ts for building projects

// ─── Parameter Interfaces ──────────────────────────────────────────────────────

export interface PortParameters {
  projectType: "port_container_terminal" | "port_bulk_cargo" | "port_fishing_harbour";
  capacityTEU?: number;            // TEU/year for container terminal
  capacityMTPY?: number;          // metric tonnes per year for bulk
  numberOfBerths: number;
  berthLengthM: number;
  dredgeDepthM: number;           // dredge depth below chart datum (m)
  reclamationAreaHa?: number;
  quayLengthM: number;
  yardAreaHa: number;
  stscranes?: number;
  rtgCranes?: number;
  tidalRange: "microtidal" | "mesotidal" | "macrotidal"; // < 2m / 2–4m / > 4m
  monsoonExposure: "sheltered" | "exposed" | "partially_exposed";
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
  settlementMonitoringRequired: boolean;
  cargoCommodity?: string;
  hasBreakwater: boolean;
  breakwaterLengthM?: number;
}

export interface AirportParameters {
  projectType: "airport_greenfield" | "airport_expansion";
  runwayLengthM: number;
  runwayWidthM: number;
  numberOfRunways: number;
  pavementType: "flexible" | "rigid" | "composite";
  terminalAreaSqm: number;
  designPaxMPPA: number;           // million passengers per annum
  codeLetterICAO: "A" | "B" | "C" | "D" | "E" | "F"; // aircraft category
  hasILS: boolean;
  ilsCategory: "CAT_I" | "CAT_II" | "CAT_III" | null;
  hasCargo: boolean;
  cargoAreaSqm?: number;
  atcTowerHeight?: number;
  perimeterLengthM: number;
  region: string;
  soilType: "rock" | "dense_sand" | "expansive" | "alluvial";
  groundwaterDepthM?: number;
  dgcaLicenceRequired: boolean;    // always true for new airports
  aaiApprovalRequired: boolean;
}

export interface HighwayParameters {
  projectType: "highway_4lane" | "highway_6lane" | "expressway";
  totalLengthKm: number;
  numberOfLanes: number;
  pavementType: "flexible" | "rigid" | "composite";
  designSpeed: number;             // km/h
  numberOfBridges: number;
  numberOfUnderpasses: number;
  numberOfInterchanges: number;
  numberOfTollPlazas: number;
  majorBridgeLengthM?: number;
  embankmentHeightMax?: number;    // max fill height in metres
  cutHeightMax?: number;           // max cut height in metres
  hasServiceRoad: boolean;
  hasCentralVerge: boolean;
  hasHighMast?: boolean;
  isNHAI: boolean;                 // NHAI or state highway
  region: string;
  soilType: "rock" | "black_cotton" | "alluvial" | "sandy";
  utilityRelocationRequired: boolean;
  forestClearanceRequired: boolean;
}

export interface BridgeParameters {
  projectType: "bridge_major" | "bridge_minor" | "bridge_cable";
  totalLengthM: number;
  spanArrangement: string;         // e.g. "3 × 50m + 5 × 120m"
  maxSpanM: number;
  numberOfSpans: number;
  numberOfPiers: number;
  widthM: number;
  numberOfLanes: number;
  foundationType: "pile" | "well" | "open_cut" | "caisson";
  pileDepthM?: number;
  waterDepthM: number;             // max water depth at pier location
  crossingType: "river" | "valley" | "road" | "railway" | "sea";
  superstructureType: "psc_girder" | "balanced_cantilever" | "cable_stayed" | "steel_truss" | "composite";
  hasTollGantry: boolean;
  seismicZone: "II" | "III" | "IV" | "V";
  region: string;
  soilType: "rock" | "sand" | "silt" | "clay";
  isDrySeasonConstruction: boolean; // only for river crossings
  ircProofLoadRequired: boolean;
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
  rollingStockCars: number;        // total cars in fleet
  trainConfiguration: string;      // e.g. "4-car", "6-car"
  signalingSystem: "CBTC" | "conventional";
  hasDepot: boolean;
  depotAreaHa?: number;
  powerSupplyKV: number;           // 25kV AC or 750V DC
  gaugeMM: number;                 // 1435 standard / 1000 narrow
  cmrsInspectionRequired: boolean; // always true in India
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "mixed";
  groundwaterDepthM?: number;
}

export interface WaterTreatmentParameters {
  projectType: "water_treatment_plant" | "sewage_treatment_plant";
  capacityMLD: number;
  numberOfUnits: number;           // parallel treatment streams
  stpProcess?: "ASP" | "SBR" | "MBR" | "UASB" | "FAB"; // STP only
  sourceType?: "surface" | "groundwater";                // WTP only
  rawWaterTurbidityMax?: number;   // NTU, WTP only
  hasOnlineAnalyser: boolean;
  hasSCADA: boolean;
  sludgeTreatment: "drying_beds" | "centrifuge" | "belt_press" | "none";
  intakeType?: "river" | "reservoir" | "well";           // WTP only
  effluentDisposal?: "river" | "land" | "reuse";         // STP only
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
  groundwaterDepthM?: number;
  spCBApprovalRequired: boolean;   // always true for STP
}

export interface MMLPParameters {
  projectType: "mmlp_greenfield" | "mmlp_expansion" | "logistics_park";
  totalAreaHa: number;
  warehouseAreaSqm: number;
  numberOfWarehouses: number;
  hasRailConnectivity: boolean;
  railSidingLengthM?: number;
  truckBaysPerWarehouse: number;
  hasAsrs: boolean;              // Automated Storage & Retrieval System
  hasRtg: boolean;               // Rubber Tyre Gantry crane
  numberOfRtg?: number;
  hasReachStacker: boolean;
  numberOfReachStackers?: number;
  morApprovalRequired: boolean;  // always true if rail siding
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
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
  cbicApprovalRequired: boolean; // always true
  region: string;
  soilType: "rock" | "hard" | "medium" | "soft";
}

export interface LiquidCargoTerminalParameters {
  projectType: "liquid_cargo_terminal" | "chemical_jetty" | "lpg_terminal";
  numberOfBerths: number;
  jettyLengthM: number;
  dredgeDepthM: number;
  numberOfMLAs: number;          // Marine Loading Arms
  storageTankCapacityKL: number; // total storage in kilolitres
  numberOfTanks: number;
  hasBulletStorage: boolean;     // LPG mounded bullets / spheres
  hasVRU: boolean;               // Vapor Recovery Unit
  pipelineLengthM: number;
  pesoApprovalRequired: boolean; // always true
  pngrbApprovalRequired: boolean;// LPG only
  region: string;
  soilType: "rock" | "dense_sand" | "soft_clay" | "reclaimed";
}

export interface TunnelParameters {
  projectType:        "road_tunnel" | "railway_tunnel" | "water_conveyance_tunnel";
  totalLengthM:       number;
  numberOfTubes:      number;           // 1 = single tube, 2 = twin tube
  excavationMethod:   "natm" | "tbm" | "cut_and_cover";
  internalDiameterM:  number;           // finished inner diameter
  numberOfAdits:      number;           // construction adits (0 if none)
  hasVentilationShaft: boolean;
  rockClass:          "I" | "II" | "III" | "IV" | "V"; // I = competent, V = very poor (Barton Q / RMR)
  ingressWaterClass:  "low" | "medium" | "high";        // groundwater ingress risk
  dgmsApprovalRequired: boolean;        // always true for drill & blast
  region:             string;
  soilType:           "rock" | "mixed_face" | "soft_ground";
}

export interface RailwayParameters {
  projectType:              "new_line" | "doubling" | "gauge_conversion" | "station_redevelopment";
  totalLengthKm:            number;
  numberOfStations:         number;
  numberOfMajorBridges:     number;     // span ≥ 18m
  numberOfROBs:             number;     // Road Over / Under Bridges
  numberOfLevelCrossings:   number;
  hasLargeCutting:          boolean;    // rock cutting > 10m depth
  hasLargeEmbankment:       boolean;    // embankment > 5m height
  trackGauge:               "broad_gauge" | "metre_gauge" | "standard_gauge";
  designSpeedKmh:           number;     // typically 100, 160, or 200 km/h
  isElectrified:            boolean;
  hasMajorBridge:           boolean;    // at least one span ≥ 18m bridge
  hasTerminalFacilities:    boolean;    // loco shed, crew lobby, running room
  landAcquisitionRequired:  boolean;    // false for pure doubling on existing land
  forestClearanceRequired:  boolean;
  rdsoApprovalRequired:     boolean;    // always true
  crsInspectionRequired:    boolean;    // always true for new/doubling lines
  region:                   string;
  soilType:                 "rock" | "black_cotton" | "alluvial" | "sandy";
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
  | RailwayParameters;

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
  | "railway";

// ─── Claude Prompts ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are an expert infrastructure project analyst for Indian construction projects.
Extract structured project parameters from uploaded documents (PDFs, drawings, reports, specifications).
Return ONLY valid JSON matching the exact interface specified. Do not include explanation or commentary.
If a value cannot be found, use null or sensible defaults based on Indian standards.
For numerical ranges, use the midpoint or typical value for Indian projects.`;

function buildPortPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a PORT / MARINE project from the following documents.
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
}

Guidance:
- tidalRange: microtidal < 2m, mesotidal 2–4m, macrotidal > 4m. Gulf of Kutch/Khambhat = macrotidal.
- monsoonExposure: west coast ports = exposed, east coast = partially_exposed, harbour inside bay = sheltered.
- settlementMonitoringRequired: true if reclamation area > 20ha or soft clay soil.
- dredgeDepthM: design depth below chart datum (typically 12–17m for container terminals).

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildAirportPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for an AIRPORT project from the following documents.
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
}

Guidance:
- ICAO code: A=small piston, B=turboprop, C=narrow-body (B737/A320), D=wide-body (B787), E=large wide-body (B777), F=A380.
- Greenfield: new site. Expansion: extending existing runway or new terminal at existing airport.
- dgcaLicenceRequired: always true for new airports; false only for heliports.
- aaiApprovalRequired: always true for civil airports in India.
- Runway width: code C = 45m, D/E/F = 60m.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildHighwayPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a HIGHWAY project from the following documents.
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
}

Guidance:
- Highway type: 4-lane = NH upgrade, 6-lane = major NH, expressway = access-controlled 6–8 lane.
- designSpeed: 4-lane = 100 km/h, 6-lane = 100–120 km/h, expressway = 120–140 km/h.
- isNHAI: true if NH; false if state highway.
- forestClearanceRequired: true if forest land involved (Stage I FC from MoEF needed).
- black_cotton = expansive soil requiring lime treatment — important for pavement design.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildBridgePrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a BRIDGE project from the following documents.
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
}

Guidance:
- bridge_major: length > 60m; bridge_minor: length ≤ 60m; bridge_cable: cable-stayed or suspension.
- Well foundation: typically used for large river bridges with scour concern (Ganga, Brahmaputra).
- Pile foundation: preferred for most urban and highway bridges.
- ircProofLoadRequired: always true per IRC 6.
- isDrySeasonConstruction: true for river crossings in India (work restricted to Oct–Feb).
- Seismic zone: Himalayas/NE India = V; Gujarat = V; Andaman = V; most peninsular India = II/III.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildMetroPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a METRO RAIL project from the following documents.
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
}

Guidance:
- cmrsInspectionRequired: always true in India — Commissioner of Metro Rail Safety inspection mandatory.
- powerSupplyKV: 25kV AC for most new Indian metros; 750V DC (third rail) for older Delhi Metro lines.
- gaugeMM: 1435 = standard gauge (most Indian metros); 1000 = some older systems.
- TBM diameter: typically 5.8–6.7m for twin single-track tunnels in India.
- Signaling: CBTC = modern CBTC/ETCS; conventional = older relay-based.
- depotAreaHa: typically 30–80 ha for maintenance depot.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildWTPPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a WATER TREATMENT / SEWAGE TREATMENT PLANT project from the following documents.
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
}

Guidance:
- WTP: treats raw water for drinking supply. STP: treats sewage/wastewater.
- stpProcess: ASP = activated sludge; SBR = sequencing batch reactor; MBR = membrane bioreactor; UASB = anaerobic (textile/dairy); FAB = fluidised aerated bed.
- spCBApprovalRequired: always true for STP (Consent to Operate from SPCB).
- numberOfUnits: parallel treatment streams (at least 2 for redundancy).
- capacityMLD: megalitres per day (1 MLD = 1000 m³/day).

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildMMLPPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a MMLP / LOGISTICS PARK project from the following documents.
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
}

Guidance:
- mmlp_greenfield: new site with rail siding. mmlp_expansion: existing park extension. logistics_park: road-only park.
- morApprovalRequired: true if hasRailConnectivity.
- warehouseAreaSqm: total covered area across all warehouses.
- hasAsrs: true if automated racking / ASRS mentioned.
- RTG/RMG: overhead gantry cranes for container handling.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildICDPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for an ICD / DRY PORT / PRIVATE FREIGHT TERMINAL project from the following documents.
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
}

Guidance:
- ICD (Inland Container Depot): customs bonded, handles import/export containers. Linked by rail or road to seaport.
- CFS (Container Freight Station): stuffing/destuffing, same site as ICD or standalone.
- cbicApprovalRequired: always true — CBIC gazette notification mandatory before commercial operations.
- hasXrayScanner: true if non-intrusive inspection scanner mentioned (CBIC mandate for major ICDs).
- ECTS: Electronic Cargo Tracking System — GPS seals for containers from port.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildLCTPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a LIQUID CARGO TERMINAL / CHEMICAL JETTY / LPG TERMINAL project from the following documents.
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
}

Guidance:
- liquid_cargo_terminal: petroleum products (POL), diesel, petrol, naphtha. chemical_jetty: acids, alkalis, solvents. lpg_terminal: LPG import/export/bottling.
- MLA (Marine Loading Arms): articulated arms connecting ship manifold to shore pipeline. Lead time 270 days.
- hasBulletStorage: true for LPG terminals (mounded bullets or spheres for pressurised storage).
- hasVRU: Vapor Recovery Unit — mandatory for volatile hydrocarbon terminals.
- pngrbApprovalRequired: true only for LPG/gas terminals.
- storageTankCapacityKL: total capacity in kilolitres (1 KL = 1 m³).
- pesoApprovalRequired: always true (Petroleum and Explosives Safety Organisation).

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildTunnelPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a ROAD / RAILWAY / WATER CONVEYANCE TUNNEL project from the following documents.
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
}

Guidance:
- projectType: road_tunnel = NH/SH/urban road; railway_tunnel = Indian Railways/metro; water_conveyance_tunnel = irrigation/hydropower/water supply.
- numberOfTubes: 1 = single tube (bi-directional for road); 2 = twin tube (one per direction) — IRC:SP-91 recommends twin tube for roads > 500m.
- excavationMethod: natm = New Austrian Tunnelling Method (most common in India); tbm = Tunnel Boring Machine (used for metro, long road tunnels > 5km); cut_and_cover = shallow urban tunnels.
- internalDiameterM: for road tunnel typically 10–12m (2-lane); railway 6–8m (BG); water tunnel 2–6m.
- rockClass: Barton Q-system: I = competent (Q > 40), II = good (10–40), III = fair (1–10), IV = poor (0.1–1), V = very poor (< 0.1). Default III if unknown.
- dgmsApprovalRequired: true for all drill-and-blast tunnels (NATM). false for TBM or cut-and-cover only.
- ingressWaterClass: high = water-bearing zone, springs expected; medium = moderate seepage; low = mostly dry rock.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

function buildRailwayPrompt(documentText: string): string {
  return `${BASE_SYSTEM_PROMPT}

Extract parameters for a MAINLINE RAILWAY project from the following documents.
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
}

Guidance:
- projectType: new_line = greenfield; doubling = third/fourth line on existing corridor; gauge_conversion = MG→BG; station_redevelopment = station upgrade only.
- totalLengthKm: route length in km. Default 50 if unknown.
- numberOfStations: halting/terminal stations on the new section. Default 5 if unknown.
- numberOfMajorBridges: bridges with span ≥ 18m. Default 2 if unknown.
- numberOfROBs: Road Over Bridges / Road Under Bridges eliminating level crossings. Default 3.
- numberOfLevelCrossings: remaining level crossings after ROBs. Default 5.
- hasLargeCutting: true if rock cutting > 10m depth expected (hilly terrain).
- hasLargeEmbankment: true if fill height > 5m expected (river valleys, underpasses).
- trackGauge: broad_gauge (1676mm) for all new Indian Railways lines; metre_gauge for narrow corridors.
- designSpeedKmh: 100 for branch lines, 130 for mail/express, 160 for semi-high-speed.
- isElectrified: true for 25kV AC overhead electrification. Check project scope.
- hasMajorBridge: true if any span ≥ 18m river/valley bridge exists.
- hasTerminalFacilities: true if project includes loco shed, crew lobby, running room.
- landAcquisitionRequired: false only if all land is already with Railways (pure doubling on existing ROW).
- forestClearanceRequired: true if alignment passes through reserve/protected forest.
- rdsoApprovalRequired: always true.
- crsInspectionRequired: true for all new/doubling lines; false for station redevelopment only.
- soilType: check DPR / geotech report — black_cotton common in Vidarbha/Marathwada/AP; alluvial in Indo-Gangetic plain; rock in Deccan plateau / NE.

Documents:
${documentText}

Respond with ONLY the JSON object, no markdown.`;
}

// ─── Document Concatenation Helper ────────────────────────────────────────────

function concatDocuments(documents: Array<{ name: string; content: string }>): string {
  return documents
    .map((d) => `=== ${d.name} ===\n${d.content}`)
    .join("\n\n");
}

// ─── Main Extraction Function ──────────────────────────────────────────────────

export async function extractInfrastructureParameters(
  infraType: InfrastructureType,
  documents: Array<{ name: string; content: string }>,
  extractionRuns: number = 1,
): Promise<InfrastructureParameters> {
  const documentText = concatDocuments(documents);

  const promptBuilders: Record<InfrastructureType, (text: string) => string> = {
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
  };

  const buildPrompt = promptBuilders[infraType];

  async function callClaude(prompt: string): Promise<InfrastructureParameters> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content[0]?.type === "text" ? data.content[0].text : "";
    return JSON.parse(text.trim()) as InfrastructureParameters;
  }

  if (extractionRuns === 1) {
    return callClaude(buildPrompt(documentText));
  }

  // Multiple runs for variance reduction — majority vote on string fields, average on numbers
  const runs = await Promise.all(
    Array.from({ length: extractionRuns }, () => callClaude(buildPrompt(documentText))),
  );

  return mergeExtractionRuns(runs);
}

// Merge multiple extraction runs: majority vote for strings, average for numbers
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
