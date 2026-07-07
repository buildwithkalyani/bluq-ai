// Infrastructure Rules Engine
// Deterministically selects tasks based on extracted project parameters
// Analogous to rules-engine.ts for building projects

import { getPortTasks, type PortTaskTemplate } from "./port-task-library.js";
import { getAirportTasks, type AirportTaskTemplate } from "./airport-task-library.js";
import { getHighwayTasks, type HighwayTaskTemplate } from "./highway-task-library.js";
import { getBridgeTasks, type BridgeTaskTemplate } from "./bridge-task-library.js";
import { getMetroTasks, type MetroTaskTemplate } from "./metro-task-library.js";
import { getWTPTasks, type WTPTaskTemplate } from "./water-treatment-task-library.js";
import { getMMLPTasks, type MMLPTaskTemplate } from "./mmlp-task-library.js";
import { getICDTasks, type ICDTaskTemplate } from "./icd-task-library.js";
import { getLCTTasks, type LiquidCargoTerminalTaskTemplate } from "./liquid-cargo-terminal-task-library.js";
import { getTunnelTasks, type TunnelTaskTemplate } from "./tunnel-task-library.js";
import { getRailwayTasks, type RailwayTaskTemplate } from "./railway-task-library.js";
import { getBuildingTasks, getBuildingTypeConfig, type BuildingTaskTemplate } from "./building-task-library.js";
import type {
  InfrastructureType,
  PortParameters,
  AirportParameters,
  HighwayParameters,
  BridgeParameters,
  MetroParameters,
  WaterTreatmentParameters,
  MMLPParameters,
  ICDParameters,
  LiquidCargoTerminalParameters,
  TunnelParameters,
  RailwayParameters,
  BuildingParameters,
} from "./infrastructure-parameter-extractor.js";

// ─── Task Union ────────────────────────────────────────────────────────────────

export type InfrastructureTask =
  | (PortTaskTemplate                      & { infraType: "port" })
  | (AirportTaskTemplate                   & { infraType: "airport" })
  | (HighwayTaskTemplate                   & { infraType: "highway" })
  | (BridgeTaskTemplate                    & { infraType: "bridge" })
  | (MetroTaskTemplate                     & { infraType: "metro" })
  | (WTPTaskTemplate                       & { infraType: "water_treatment" })
  | (MMLPTaskTemplate                      & { infraType: "mmlp" })
  | (ICDTaskTemplate                       & { infraType: "icd" })
  | (LiquidCargoTerminalTaskTemplate       & { infraType: "liquid_cargo_terminal" })
  | (TunnelTaskTemplate                    & { infraType: "tunnel" })
  | (RailwayTaskTemplate                   & { infraType: "railway" })
  | (BuildingTaskTemplate                  & { infraType: "building" });

export interface SelectedInfraTask {
  code: string;
  name: string;
  phase: string;
  infraType: InfrastructureType;
  inclusionReason: string;
  leadTimeDays?: number;
  isCriticalPath?: boolean;
  // Link to the section this instance belongs to — scheduler looks up full section data from params.sections
  sectionId?: string;
}

// ─── Port Rules ────────────────────────────────────────────────────────────────

function selectPortTasks(params: PortParameters): SelectedInfraTask[] {
  const allTasks = getPortTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // Breakwater tasks
    if (task.code === "PT-MW-01" && params.hasBreakwater) {
      include = true; reason = "breakwater required";
    }

    // Dredging — always if dredge depth specified
    if (task.code === "PT-MW-02" && params.dredgeDepthM > 0) {
      include = true; reason = `dredge depth ${params.dredgeDepthM}m`;
    }

    // Reclamation only if area specified
    if (task.phase === "reclamation" && (!params.reclamationAreaHa || params.reclamationAreaHa === 0)) {
      if (!task.isCore) { include = false; reason = ""; }
    }

    // Settlement monitoring
    if (task.code === "PT-RC-04") {
      include = params.settlementMonitoringRequired;
      reason = include ? "reclamation area or soft clay requires monitoring" : "";
    }

    // STS cranes only for container terminals
    if (task.code === "PT-CT-02" && params.projectType !== "port_container_terminal") {
      include = false; reason = "";
    }
    // RTG cranes only for container terminals
    if (task.code === "PT-CT-03" && params.projectType !== "port_container_terminal") {
      include = false; reason = "";
    }

    // Bulk handling equipment only for bulk terminals
    if (task.code === "PT-CT-04" && params.projectType !== "port_bulk_cargo") {
      include = false; reason = "";
    }

    // Cold store only for fishing harbours
    if (task.code === "PT-TB-03" && params.projectType !== "port_fishing_harbour") {
      include = false; reason = "";
    }

    // Tidal window tasks — flag macrotidal sites
    if (params.tidalRange === "macrotidal" && task.tidalWindowFactor && task.tidalWindowFactor < 0.7) {
      if (include) reason += "; macrotidal — tidal window scheduling critical";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "port",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 180),
      });
    }
  }

  return selected;
}

// ─── Airport Rules ─────────────────────────────────────────────────────────────

function selectAirportTasks(params: AirportParameters): SelectedInfraTask[] {
  const allTasks = getAirportTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // ILS localizer — only if ILS specified
    if (task.code === "AP-NA-01") {
      include = params.hasILS;
      reason = include ? `ILS ${params.ilsCategory} required` : "";
    }
    // ILS glide path
    if (task.code === "AP-NA-02") {
      include = params.hasILS;
      reason = include ? `ILS ${params.ilsCategory} glide path` : "";
    }
    // ILS flight calibration — AAI Flight Inspection Unit
    if (task.code === "AP-NA-05") {
      include = params.hasILS;
      reason = include ? "ILS flight calibration mandatory before DGCA licence" : "";
    }

    // DGCA licence — always for new airports
    if (task.code === "AP-CH-01") {
      include = params.dgcaLicenceRequired;
      reason = include ? "DGCA aerodrome licence mandatory" : "";
    }

    // Cargo apron — only if cargo
    if (task.phase === "commissioning_handover" || task.code === "AP-CA-01") {
      if (task.code === "AP-CA-01" && !params.hasCargo) {
        include = false; reason = "";
      }
    }

    // CAT II/III specific works — additional lighting
    if (task.code === "AP-NA-03" && params.ilsCategory === "CAT_I") {
      include = false; reason = ""; // CAT I doesn't need precision approach lighting
    }

    // Rigid pavement (PQC) — only for rigid or composite
    if (task.code === "AP-RW-03" && params.pavementType === "flexible") {
      include = false; reason = "";
    }
    // Flexible (BM/DBM) — only for flexible or composite
    if (task.code === "AP-RW-02" && params.pavementType === "rigid") {
      include = false; reason = "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "airport",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 60),
      });
    }
  }

  return selected;
}

// ─── Highway Rules ─────────────────────────────────────────────────────────────

function selectHighwayTasks(params: HighwayParameters): SelectedInfraTask[] {
  const allTasks = getHighwayTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // Utility relocation
    if (task.code === "HW-EW-02") {
      include = params.utilityRelocationRequired;
      reason = include ? "utility relocation in corridor" : "";
    }

    // Forest NOC
    if (task.code === "HW-SI-03") {
      include = params.forestClearanceRequired;
      reason = include ? "forest land in corridor — Stage II FC" : "";
    }

    // Rigid pavement (PQC) — expressway only by default
    if (task.code === "HW-PV-05") {
      include = params.pavementType === "rigid" || params.projectType === "expressway";
      reason = include ? "rigid pavement specified or expressway" : "";
    }

    // Flexible pavement layers — skip if pure rigid
    if ((task.code === "HW-PV-03" || task.code === "HW-PV-04") && params.pavementType === "rigid") {
      include = false; reason = "";
    }

    // Bridges — skip if count is 0
    if (task.phase === "structures" && params.numberOfBridges === 0) {
      include = false; reason = "";
    }

    // Toll plaza — skip if no tolls
    if (task.phase === "toll_its" && params.numberOfTollPlazas === 0) {
      include = false; reason = "";
    }

    // Interchanges
    if (task.code === "HW-SF-04" && params.numberOfInterchanges === 0) {
      include = false; reason = "";
    }

    // High mast lighting
    if (task.code === "HW-SF-03") {
      include = params.hasHighMast ?? false;
      reason = include ? "high mast lighting specified" : "";
    }

    // Service road — include if specified
    if (task.code === "HW-PV-06" && !params.hasServiceRoad) {
      include = false; reason = "";
    }

    // Lime treatment — black cotton soil
    if (task.code === "HW-EW-03") {
      include = params.soilType === "black_cotton";
      reason = include ? "black cotton soil — lime stabilisation required" : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "highway",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A",
      });
    }
  }

  return selected;
}

// ─── Bridge Rules ──────────────────────────────────────────────────────────────

function selectBridgeTasks(params: BridgeParameters): SelectedInfraTask[] {
  const allTasks = getBridgeTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // Well foundation — only if well foundation type
    if (task.code === "BR-FP-03") {
      include = params.foundationType === "well";
      reason = include ? "well foundation specified (river pier with scour)" : "";
    }

    // Pile foundation — only if pile
    if (task.code === "BR-FP-02") {
      include = params.foundationType === "pile";
      reason = include ? "pile foundation specified" : "";
    }

    // Cofferdam — only for river/sea crossings with water depth
    if (task.code === "BR-FP-01") {
      include = params.waterDepthM > 0 && (params.crossingType === "river" || params.crossingType === "sea");
      reason = include ? `water depth ${params.waterDepthM}m — cofferdam required` : "";
    }

    // Cable-stayed specific tasks
    if (task.code === "BR-SU-05" || task.code === "BR-SU-06") {
      include = params.projectType === "bridge_cable" || params.superstructureType === "cable_stayed";
      reason = include ? "cable-stayed superstructure" : "";
    }

    // Balanced cantilever
    if (task.code === "BR-SU-07") {
      include = params.superstructureType === "balanced_cantilever";
      reason = include ? "balanced cantilever superstructure" : "";
    }

    // PSC girder erection (standard)
    if (task.code === "BR-SU-02") {
      include = params.superstructureType === "psc_girder";
      reason = include ? "PSC girder superstructure" : "";
    }

    // IRC proof load test — always required
    if (task.code === "BR-CH-01") {
      include = params.ircProofLoadRequired;
      reason = include ? "IRC proof load mandatory" : "";
    }

    // Toll gantry
    if (task.code === "BR-DF-04") {
      include = params.hasTollGantry;
      reason = include ? "toll gantry on bridge" : "";
    }

    // Seismic restrainers / isolators — Zone IV/V
    if (task.code === "BR-WC-04") {
      include = params.seismicZone === "IV" || params.seismicZone === "V";
      reason = include ? `seismic zone ${params.seismicZone} — isolators required` : "";
    }

    // Expansion joints — include for all bridges > 30m
    if (task.code === "BR-WC-03") {
      include = params.totalLengthM > 30;
      reason = include ? `bridge length ${params.totalLengthM}m — expansion joints required` : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "bridge",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 30),
      });
    }
  }

  return selected;
}

// ─── Metro Rules ───────────────────────────────────────────────────────────────

function selectMetroTasks(params: MetroParameters): SelectedInfraTask[] {
  const allTasks = getMetroTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // TBM tunneling — only for underground
    if (task.code === "MR-UG-03") {
      include = params.projectType === "metro_underground" && (params.tunnelLengthKm ?? 0) > 0;
      reason = include ? `TBM tunneling ${params.tunnelLengthKm}km` : "";
    }

    // Cut & cover station box — underground only
    if (task.code === "MR-UG-01" || task.code === "MR-UG-02") {
      include = params.projectType === "metro_underground";
      reason = include ? "underground station" : "";
    }

    // Viaduct tasks — elevated only
    if (task.phase === "viaduct_structure") {
      include = params.projectType === "metro_elevated" || (params.viaductLengthKm ?? 0) > 0;
      reason = include ? "elevated viaduct" : "";
    }

    // CBTC signaling
    if (task.code === "MR-SY-02") {
      include = params.signalingSystem === "CBTC";
      reason = include ? "CBTC signaling specified" : "";
    }

    // Rolling stock delivery — always core
    if (task.code === "MR-TC-01") {
      include = true;
      reason = `${params.rollingStockCars} cars, leadTime ${task.leadTimeDays} days — critical path`;
    }

    // CMRS inspection — always required in India
    if (task.code === "MR-TC-05") {
      include = params.cmrsInspectionRequired;
      reason = include ? "CMRS inspection mandatory before revenue service" : "";
    }

    // Depot — only if depot exists
    if (task.phase === "depot") {
      include = params.hasDepot;
      reason = include ? `depot ${params.depotAreaHa}ha` : "";
    }

    // Groundwater — dewatering tasks for underground in high water table
    if (task.code === "MR-UG-04" && params.groundwaterDepthM !== undefined && params.groundwaterDepthM < 5) {
      include = true;
      reason = `shallow groundwater ${params.groundwaterDepthM}m — dewatering critical`;
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "metro",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 180),
      });
    }
  }

  return selected;
}

// ─── Water Treatment Rules ─────────────────────────────────────────────────────

function selectWTPTasks(params: WaterTreatmentParameters): SelectedInfraTask[] {
  const allTasks = getWTPTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = task.isCore ? "core task" : "";

    // WTP-only source characterisation
    if (task.code === "WT-SI-03") {
      include = params.projectType === "water_treatment_plant";
      reason = include ? "raw water quality characterisation" : "";
    }

    // STP influent characterisation
    if (task.code === "WT-SI-04") {
      include = params.projectType === "sewage_treatment_plant";
      reason = include ? "influent characterisation for STP" : "";
    }

    // River intake — WTP only with river source
    if (task.code === "WT-CS-01") {
      include = params.projectType === "water_treatment_plant" && params.intakeType === "river";
      reason = include ? "river intake structure" : "";
    }

    // Flash mixer / flocculator — WTP only
    if (task.code === "WT-CS-03" || task.code === "WT-CS-04") {
      include = params.projectType === "water_treatment_plant";
      reason = include ? "coagulation/flocculation for WTP" : "";
    }

    // Rapid gravity filter — WTP only
    if (task.code === "WT-CS-06") {
      include = params.projectType === "water_treatment_plant";
      reason = include ? "filtration for WTP" : "";
    }

    // Aeration tank — STP only
    if (task.code === "WT-CS-07") {
      include = params.projectType === "sewage_treatment_plant";
      reason = include ? `biological reactor for STP (${params.stpProcess})` : "";
    }

    // Secondary clarifier — STP only (not for MBR which has no secondary clarifier)
    if (task.code === "WT-CS-08") {
      include = params.projectType === "sewage_treatment_plant" && params.stpProcess !== "MBR";
      reason = include ? "secondary clarifier for STP" : "";
    }

    // Screen / bar screen — STP headworks
    if (task.code === "WT-ME-04") {
      include = params.projectType === "sewage_treatment_plant";
      reason = include ? "fine screen for STP headworks" : "";
    }

    // Aeration blowers/diffusers — STP only
    if (task.code === "WT-ME-05") {
      include = params.projectType === "sewage_treatment_plant"
        && (params.stpProcess === "ASP" || params.stpProcess === "SBR" || params.stpProcess === "MBR");
      reason = include ? `aeration system for ${params.stpProcess}` : "";
    }

    // MBR membranes — STP only with MBR process
    if (task.code === "WT-ME-06") {
      include = params.projectType === "sewage_treatment_plant" && params.stpProcess === "MBR";
      reason = include ? "MBR membrane modules" : "";
    }

    // Sludge dewatering — centrifuge or belt press for large plants
    if (task.code === "WT-ME-07") {
      include = params.capacityMLD >= 10 && params.sludgeTreatment !== "none" && params.sludgeTreatment !== "drying_beds";
      reason = include ? `sludge dewatering (${params.sludgeTreatment}) for ${params.capacityMLD} MLD plant` : "";
    }

    // RAS / sludge piping — STP only
    if (task.code === "WT-PV-04") {
      include = params.projectType === "sewage_treatment_plant";
      reason = include ? "return activated sludge piping" : "";
    }

    // SPCB CTO — STP only
    if (task.code === "WT-CH-04") {
      include = params.spCBApprovalRequired;
      reason = include ? "SPCB Consent to Operate mandatory" : "";
    }

    // SCADA — include if specified
    if (task.code === "WT-EI-05" && !params.hasSCADA) {
      include = false; reason = "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "water_treatment",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 60),
      });
    }
  }

  return selected;
}

// ─── MMLP Rules ────────────────────────────────────────────────────────────────

function selectMMLPTasks(params: MMLPParameters): SelectedInfraTask[] {
  const allTasks = getMMLPTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore && !task.conditions?.length;
    let reason = include ? "core task" : "";

    // Rail infrastructure — only if rail connectivity
    if (task.phase === "rail_infrastructure") {
      include = params.hasRailConnectivity;
      reason = include ? `rail siding ${params.railSidingLengthM ?? 0}m` : "";
    }

    // MoR preliminary approval — only if rail
    if (task.code === "ML-SI-03") {
      include = params.hasRailConnectivity;
      reason = include ? "MoR approval required for rail siding" : "";
    }

    // MoR Certificate of Fitness — only if rail
    if (task.code === "ML-CH-01") {
      include = params.hasRailConnectivity;
      reason = include ? "MoR Certificate of Fitness mandatory before first train" : "";
    }

    // RTG/RMG — only if specified
    if (task.code === "ML-EQ-02") {
      include = params.hasRtg;
      reason = include ? `${params.numberOfRtg ?? 1} RTG/RMG cranes` : "";
    }

    // ASRS — only if specified
    if (task.code === "ML-EQ-04") {
      include = params.hasAsrs;
      reason = include ? "ASRS automated storage system" : "";
    }

    // Reach stackers — only if specified
    if (task.code === "ML-EQ-01") {
      include = params.hasReachStacker;
      reason = include ? `${params.numberOfReachStackers ?? 1} reach stackers` : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "mmlp",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 90),
      });
    }
  }

  return selected;
}

// ─── ICD Rules ─────────────────────────────────────────────────────────────────

function selectICDTasks(params: ICDParameters): SelectedInfraTask[] {
  const allTasks = getICDTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore && !task.conditions?.length;
    let reason = include ? "core task" : "";

    // Rail siding tasks — only if rail-linked
    if (task.phase === "rail_siding") {
      include = params.hasRailSiding;
      reason = include ? `rail siding ${params.railSidingLengthM ?? 0}m` : "";
    }

    // CBIC site approval — always required
    if (task.code === "IC-SI-04") {
      include = true;
      reason = "CBIC ICD/CFS site approval mandatory";
    }

    // CBIC gazette notification — critical gate
    if (task.code === "IC-CH-02") {
      include = true;
      reason = "CBIC gazette notification — cannot operate commercially before this";
    }

    // MoR Certificate of Fitness — only if rail siding
    if (task.code === "IC-CH-01") {
      include = params.hasRailSiding;
      reason = include ? "MoR Certificate of Fitness mandatory before first train" : "";
    }

    // X-ray scanner — only if specified
    if (task.code === "IC-CF-02") {
      include = params.hasXrayScanner;
      reason = include ? "X-ray scanner — CBIC mandate for major ICDs" : "";
    }

    // Gantry scanner — only if specified
    if (task.code === "IC-CF-03") {
      include = params.hasGantryScanner;
      reason = include ? "Gantry scanner for vehicle/container scanning" : "";
    }

    // CFS / container freight station — only if applicable
    if (task.code === "IC-WS-02") {
      include = params.hasContainerFreightStation;
      reason = include ? "Container Freight Station (CFS) for stuffing/destuffing" : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "icd",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 90),
      });
    }
  }

  return selected;
}

// ─── Liquid Cargo Terminal Rules ───────────────────────────────────────────────

function selectLCTTasks(params: LiquidCargoTerminalParameters): SelectedInfraTask[] {
  const allTasks = getLCTTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = !task.isConditional;
    let reason = include ? "core task" : "";

    // PNGRB authorisation — LPG only
    if (task.code === "LC-SI-06" || task.code === "LC-CH-06") {
      include = params.pngrbApprovalRequired;
      reason = include ? "PNGRB authorisation mandatory for LPG terminals" : "";
    }

    // Mounded bullets / LPG pressure vessels
    if (task.code === "LC-ST-04") {
      include = params.hasBulletStorage;
      reason = include ? "LPG mounded bullet storage" : "";
    }

    // Pressurised LPG pipeline
    if (task.code === "LC-PP-06") {
      include = params.projectType === "lpg_terminal";
      reason = include ? "high-pressure LPG piping — IBR inspection" : "";
    }

    // LPG compressors & vaporisers
    if (task.code === "LC-ME-04") {
      include = params.projectType === "lpg_terminal";
      reason = include ? "LPG compressors and vaporisers" : "";
    }

    // Floating roof — petroleum only, not LPG
    if (task.code === "LC-ST-03") {
      include = params.projectType === "liquid_cargo_terminal";
      reason = include ? "floating roof for Class A petroleum products" : "";
    }

    // VRU — only if specified
    if (task.code === "LC-PP-05" || task.code === "LC-ME-03") {
      include = params.hasVRU;
      reason = include ? "Vapor Recovery Unit — CPCB mandate" : "";
    }

    // Chemical-resistant lining — chemical jetty only
    if (task.code === "LC-PP-03" || task.code === "LC-FS-06") {
      include = params.projectType === "chemical_jetty";
      reason = include ? "NACE-grade chemical-resistant coating" : "";
    }

    // Chemical metering — chemical jetty only
    if (task.code === "LC-ME-05") {
      include = params.projectType === "chemical_jetty";
      reason = include ? "chemical dosing and metering" : "";
    }

    // MSIHC compliance — chemical jetty only
    if (task.code === "LC-RA-04") {
      include = params.projectType === "chemical_jetty";
      reason = include ? "MSIHC Rules — hazardous chemical handling" : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "liquid_cargo_terminal",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 90),
      });
    }
  }

  return selected;
}

// ─── Tunnel Rules ──────────────────────────────────────────────────────────────

function selectTunnelTasks(params: TunnelParameters): SelectedInfraTask[] {
  const allTasks = getTunnelTasks(params.projectType);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore && !task.conditions?.length;
    let reason = include ? "core task" : "";

    // DGMS approval — only for drill & blast
    if (task.code === "TN-RA-02") {
      include = params.dgmsApprovalRequired && params.excavationMethod !== "tbm";
      reason = include ? "DGMS approval mandatory for drill & blast" : "";
    }

    // MoRTH design approval — road tunnel only
    if (task.code === "TN-RA-03") {
      include = params.projectType === "road_tunnel";
      reason = include ? "MoRTH/NHAI design sanction — IRC:SP-91" : "";
    }

    // Railway Board sanction — rail tunnel only
    if (task.code === "TN-RA-04") {
      include = params.projectType === "railway_tunnel";
      reason = include ? "Railway Board / RDSO design sanction mandatory" : "";
    }

    // CWC approval — water tunnel only
    if (task.code === "TN-RA-05") {
      include = params.projectType === "water_conveyance_tunnel";
      reason = include ? "CWC / Irrigation Dept approval" : "";
    }

    // TBM procurement — only if TBM method
    if (task.code === "TN-RA-06") {
      include = params.excavationMethod === "tbm";
      reason = include ? `TBM procurement — 540 day lead time for ${params.internalDiameterM}m dia tunnel` : "";
    }

    // TBM launch shaft — only if TBM
    if (task.code === "TN-PW-05") {
      include = params.excavationMethod === "tbm";
      reason = include ? "TBM launch shaft — required before TBM deployment" : "";
    }

    // Construction adits — only if numberOfAdits > 0
    if (task.code === "TN-PW-04") {
      include = params.numberOfAdits > 0;
      reason = include ? `${params.numberOfAdits} construction adits` : "";
    }

    // NATM/drill & blast excavation — only if not TBM and not cut-and-cover
    if (task.code === "TN-EX-01") {
      include = params.excavationMethod === "natm";
      reason = include ? `NATM excavation — ${params.totalLengthM}m, rock class ${params.rockClass}` : "";
    }

    // TBM advance — only if TBM
    if (task.code === "TN-EX-02") {
      include = params.excavationMethod === "tbm";
      reason = include ? `TBM boring — ${params.totalLengthM}m` : "";
    }

    // Cut & cover — only if cut-and-cover method
    if (task.code === "TN-EX-03") {
      include = params.excavationMethod === "cut_and_cover";
      reason = include ? "cut & cover open excavation" : "";
    }

    // Pre-excavation grouting — only if high ingress water class
    if (task.code === "TN-EX-05") {
      include = params.ingressWaterClass === "high";
      reason = include ? "high groundwater ingress — probe drilling & pre-grouting required" : "";
    }

    // Emergency cross-passages — only for twin-tube tunnels
    if (task.code === "TN-EX-06") {
      include = params.numberOfTubes === 2;
      reason = include ? "twin-tube — cross-passages at ≤250m per IRC:SP-91" : "";
    }

    // Steel ribs — only for poor rock (class IV or V)
    if (task.code === "TN-PS-03") {
      include = params.rockClass === "IV" || params.rockClass === "V";
      reason = include ? `rock class ${params.rockClass} — steel rib/lattice girder support required` : "";
    }

    // TBM segment lining — only if TBM
    if (task.code === "TN-PS-04") {
      include = params.excavationMethod === "tbm";
      reason = include ? "TBM — precast segment lining erected by TBM" : "";
    }

    // Pressure tunnel lining (steel/grouted) — water tunnel only
    if (task.code === "TN-WL-03") {
      include = params.projectType === "water_conveyance_tunnel";
      reason = include ? "pressure tunnel lining — steel liner or concrete with contact grouting" : "";
    }

    // Secondary lining (cast-in-situ) — road and rail tunnel only
    if (task.code === "TN-WL-02") {
      include = params.projectType !== "water_conveyance_tunnel";
      reason = include ? "secondary CIS concrete lining via travelling formwork" : "";
    }

    // Invert concrete / drainage — road and rail tunnel only
    if (task.code === "TN-DI-01" || task.code === "TN-DI-02" || task.code === "TN-DI-03") {
      include = params.projectType !== "water_conveyance_tunnel";
      reason = include ? "floor slab / drainage channel / sump pump" : "";
    }

    // Penstock / surge shaft — water tunnel only
    if (task.code === "TN-DI-04") {
      include = params.projectType === "water_conveyance_tunnel";
      reason = include ? "penstock and surge shaft for water conveyance tunnel" : "";
    }

    // Road tunnel MEP (jet fans, lighting, fire suppression, SCADA) — road only
    if (["TN-ME-01", "TN-ME-03", "TN-ME-04", "TN-ME-05", "TN-ME-06"].includes(task.code)) {
      include = params.projectType === "road_tunnel";
      reason = include ? `road tunnel MEP — IRC:SP-91` : "";
    }

    // Ventilation shaft — only if project has one
    if (task.code === "TN-ME-02") {
      include = params.hasVentilationShaft;
      reason = include ? "ventilation shaft specified" : "";
    }

    // Railway electrification & OHE — rail tunnel only
    if (task.code === "TN-ME-07") {
      include = params.projectType === "railway_tunnel";
      reason = include ? "railway tunnel OHE & electrification" : "";
    }

    // Water tunnel hydromechanical works — water tunnel only
    if (task.code === "TN-ME-08") {
      include = params.projectType === "water_conveyance_tunnel";
      reason = include ? "penstock gates and hydromechanical equipment" : "";
    }

    // Road finishing tasks — road tunnel only
    if (["TN-RF-01", "TN-RF-02", "TN-RF-03"].includes(task.code)) {
      include = params.projectType === "road_tunnel";
      reason = include ? "road tunnel carriageway pavement and finishing" : "";
    }

    // Rail track laying — rail tunnel only
    if (task.code === "TN-RF-04") {
      include = params.projectType === "railway_tunnel";
      reason = include ? "railway track laying inside tunnel" : "";
    }

    // Systems integration testing — road tunnel only
    if (task.code === "TN-CH-01") {
      include = params.projectType === "road_tunnel";
      reason = include ? "systems integration test — ventilation, fire, SCADA, lighting" : "";
    }

    // MoRTH/NHAI safety audit — road tunnel only
    if (task.code === "TN-CH-02") {
      include = params.projectType === "road_tunnel";
      reason = include ? "MoRTH/NHAI Tunnel Readiness Certificate — IRC:SP-91 Ch. 14" : "";
    }

    // CRS inspection — rail tunnel only
    if (task.code === "TN-CH-03") {
      include = params.projectType === "railway_tunnel";
      reason = include ? "CRS inspection mandatory before first train" : "";
    }

    // Hydraulic pressure test — water tunnel only
    if (task.code === "TN-CH-04") {
      include = params.projectType === "water_conveyance_tunnel";
      reason = include ? "hydraulic pressure test for pressure tunnel" : "";
    }

    // Fire NOC — road tunnel only
    if (task.code === "TN-CH-05") {
      include = params.projectType === "road_tunnel";
      reason = include ? "Fire NOC — NFPA 502 / IRC:SP-91" : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "tunnel",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.isCriticalPath || task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 90),
      });
    }
  }

  return selected;
}

// ─── Railway Rules ─────────────────────────────────────────────────────────────

function selectRailwayTasks(params: RailwayParameters): SelectedInfraTask[] {
  const allTasks = getRailwayTasks(params.projectType, params.isElectrified);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    let include = task.isCore;
    let reason = include ? "core task for railway projects" : "";

    // Forest clearance only if alignment passes through forest land
    if (task.code === "RW-SI-05") {
      include = params.forestClearanceRequired;
      reason = include ? "forest clearance required (MoEF Stage I & II)" : "";
    }

    // Land acquisition only when new land is needed
    if (task.code === "RW-LA-01" || task.code === "RW-LA-02") {
      include = params.landAcquisitionRequired;
      reason = include ? "land acquisition required under LARR Act" : "";
    }

    // Major bridge only if there are major river/valley crossings
    if (task.code === "RW-BC-02") {
      include = params.hasMajorBridge || params.numberOfMajorBridges > 0;
      reason = include ? `${params.numberOfMajorBridges} major bridge(s) span ≥ 18m` : "";
    }

    // ROBs only if count > 0
    if (task.code === "RW-BC-03") {
      include = params.numberOfROBs > 0;
      reason = include ? `${params.numberOfROBs} ROB(s)/RUB(s) required` : "";
    }

    // ABS/CTC for new lines and doubling — high-density corridors
    if (task.code === "RW-SG-03") {
      include =
        params.projectType === "new_line" || params.projectType === "doubling";
      reason = include ? "ABS for new/doubling line to increase section capacity" : "";
    }

    // Loco shed / crew lobby only for terminal stations
    if (task.code === "RW-SW-05") {
      include = params.hasTerminalFacilities;
      reason = include ? "terminal station requires loco shed and crew lobby" : "";
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "railway",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath:
          task.isCriticalPath ||
          task.taskCategory === "A" ||
          (task.leadTimeDays !== undefined && task.leadTimeDays >= 90),
      });
    }
  }

  return selected;
}

// ─── Building Rules ────────────────────────────────────────────────────────────

function selectBuildingTasks(params: BuildingParameters): SelectedInfraTask[] {
  const allTasks = getBuildingTasks(params.projectType);
  const config = getBuildingTypeConfig(params.projectType);
  const mandatorySet = new Set(config.mandatoryTaskCodes);
  const excludedSet = new Set(config.excludedTaskCodes);
  const selected: SelectedInfraTask[] = [];

  for (const task of allTasks) {
    if (excludedSet.has(task.code)) continue;

    // Restrict to applicable building types if specified
    if (task.applicableBuildingTypes && !task.applicableBuildingTypes.includes(params.projectType)) continue;
    if (task.excludedBuildingTypes && task.excludedBuildingTypes.includes(params.projectType)) continue;

    let include = task.isCore || mandatorySet.has(task.code);
    let reason = task.isCore ? "core task" : mandatorySet.has(task.code) ? `mandatory for ${params.projectType}` : "";

    // Pile foundation — only if foundationType is pile
    if (task.code === "BL-EX-02") {
      include = params.foundationType === "pile";
      reason = include ? `pile foundation specified (${params.pileDepthM ?? "?"}m depth)` : "";
    }

    // Raft foundation — only if raft
    if (task.code === "BL-EX-04") {
      include = params.foundationType === "raft";
      reason = include ? "raft foundation specified" : "";
    }

    // Isolated footing — only if isolated_footing
    if (task.code === "BL-EX-05") {
      include = params.foundationType === "isolated_footing";
      reason = include ? "isolated footing foundation" : "";
    }

    // Pile cap only if pile foundation
    if (task.code === "BL-EX-03") {
      include = params.foundationType === "pile";
      reason = include ? "pile cap required with pile foundation" : "";
    }

    // Basement works — only if basementLevels > 0
    if (task.code === "BL-BM-01" || task.code === "BL-BM-02") {
      include = params.basementLevels > 0;
      reason = include ? `${params.basementLevels} basement level(s)` : "";
    }

    // CGWA NoC — only if groundwater is shallow (< 5m)
    if (task.code === "BL-AP-04") {
      include = params.basementLevels > 0 && (params.groundwaterDepthM ?? 10) < 5;
      reason = include ? `shallow groundwater (${params.groundwaterDepthM}m) + basement excavation` : "";
    }

    // Environmental clearance — only if required
    if (task.code === "BL-AP-02") {
      include = params.environmentalClearanceRequired;
      reason = include ? `BUA ${params.totalBuiltUpAreaSqm}sqm > 20,000sqm — SEIAA EC required` : "";
    }

    // RERA — only for residential
    if (task.code === "BL-SI-03" || task.code === "BL-CH-04") {
      include = params.reraRegistrationRequired;
      reason = include ? "RERA registration mandatory for residential project" : "";
    }

    // Tower crane — only for 10+ floors
    if (task.code === "BL-PW-04") {
      include = params.numberOfFloors >= 10;
      reason = include ? `${params.numberOfFloors} floors — tower crane required` : "";
    }

    // Facade system (curtain wall / ACP) — conditional
    if (task.code === "BL-EV-03") {
      include = params.hasFacadeSystem;
      reason = include ? "facade system (curtain wall / ACP / glass) specified" : "";
    }

    // Fire detection & sprinklers — high-rise mandatory
    if (task.code === "BL-ME-04") {
      include = params.hasFireFighting || params.hasSprinklers || params.numberOfFloors >= 4;
      reason = include ? `fire fighting system — ${params.numberOfFloors} floors (NBC Part 4 mandatory > 15m)` : "";
    }

    // Fire NOC — mandatory for > 15m height (~ 4+ floors at 4m/floor)
    if (task.code === "BL-AP-03") {
      include = params.numberOfFloors >= 4 || params.floorHeightM * params.numberOfFloors > 15;
      reason = include ? `building height > 15m — fire NOC required` : "";
    }

    // Lifts — conditional
    if (task.code === "BL-ME-05") {
      include = params.hasLift;
      reason = include ? `${params.numberOfLifts ?? "?"} lift(s) specified` : "";
    }

    // CEI lift inspection — only if lifts exist
    if (task.code === "BL-CH-02") {
      include = params.hasLift;
      reason = include ? "CEI inspection mandatory before lift commissioning" : "";
    }

    // HVAC — conditional
    if (task.code === "BL-ME-03") {
      include = params.hasHVAC;
      reason = include ? "HVAC system specified" : "";
    }

    // False ceiling & partitions — commercial/hospital/hotel/DC only
    if (task.code === "BL-FF-05") {
      include = ["commercial_office", "hospital", "hotel", "data_center"].includes(params.projectType);
      reason = include ? `false ceiling required for ${params.projectType}` : "";
    }

    // Precast superstructure — only if structuralSystem is precast
    if (task.code === "BL-ST-04") {
      include = params.structuralSystem === "precast";
      reason = include ? "precast structural system" : "";
    }

    // For non-precast: exclude precast task; for precast: keep RCC slab (hybrid common)
    if (task.code === "BL-ST-01" || task.code === "BL-ST-02" || task.code === "BL-ST-03") {
      if (params.structuralSystem === "precast") {
        // precast still needs slab topping — keep BL-ST-02 as topping slab, suppress columns
        if (task.code === "BL-ST-01") { include = false; reason = ""; }
      }
    }

    if (include) {
      selected.push({
        code: task.code,
        name: task.name,
        phase: task.phase,
        infraType: "building",
        inclusionReason: reason,
        leadTimeDays: task.leadTimeDays,
        isCriticalPath: task.taskCategory === "A" || (task.leadTimeDays !== undefined && task.leadTimeDays >= 60),
      });
    }
  }

  return selected;
}

// ─── Section Expansion ─────────────────────────────────────────────────────────
// Linear phases: tasks in these phases are distributed along the project length/area
// and get expanded into one instance per section.
// Non-linear phases (approvals, commissioning, procurement) stay singular.

const LINEAR_PHASES: Record<InfrastructureType, ReadonlySet<string>> = {
  highway:               new Set(["earthworks", "pavement_layers", "drainage_structures"]),
  bridge:                new Set(["foundation_piling", "substructure", "superstructure"]),
  metro:                 new Set(["foundation_piling", "viaduct_structure", "station_civil", "track_works"]),
  tunnel:                new Set(["portal_works", "tunnel_excavation", "primary_support", "waterproofing_lining", "drainage_invert"]),
  port:                  new Set(["marine_works", "reclamation", "quay_berth", "yard_pavement"]),
  railway:               new Set(["earthworks", "track_laying", "bridges_culverts"]),
  airport:               new Set(["earthworks_grading", "runway_taxiway_pavement", "drainage"]),
  water_treatment:       new Set<string>(),
  mmlp:                  new Set(["warehouse_shed", "intermodal_yard", "site_preparation"]),
  icd:                   new Set(["civil_earthworks", "pavement_yard", "warehousing_sheds"]),
  liquid_cargo_terminal: new Set(["marine_structures", "storage_tanks", "pipeline_piping"]),
  building:              new Set(["superstructure"]),
};

function expandToSections(
  tasks: SelectedInfraTask[],
  sections: { id: string; name: string }[],
  infraType: InfrastructureType,
): SelectedInfraTask[] {
  if (sections.length === 0) return tasks;
  const spatialPhases = LINEAR_PHASES[infraType];
  const result: SelectedInfraTask[] = [];

  for (const task of tasks) {
    if (!spatialPhases.has(task.phase)) {
      result.push(task);
      continue;
    }
    for (const section of sections) {
      result.push({
        ...task,
        code:      `${task.code}_${section.id}`,
        name:      `${task.name} — ${section.name}`,
        sectionId: section.id,
      });
    }
  }
  return result;
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

export interface InfraRulesEngineResult {
  infraType: InfrastructureType;
  selectedTasks: SelectedInfraTask[];
  criticalPathTasks: SelectedInfraTask[];
  longLeadItems: SelectedInfraTask[];
  totalTaskCount: number;
}

export function runInfrastructureRulesEngine(
  infraType: InfrastructureType,
  parameters:
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
    | BuildingParameters,
): InfraRulesEngineResult {
  let selectedTasks: SelectedInfraTask[] = [];

  switch (infraType) {
    case "port":
      selectedTasks = selectPortTasks(parameters as PortParameters);
      break;
    case "airport":
      selectedTasks = selectAirportTasks(parameters as AirportParameters);
      break;
    case "highway":
      selectedTasks = selectHighwayTasks(parameters as HighwayParameters);
      break;
    case "bridge":
      selectedTasks = selectBridgeTasks(parameters as BridgeParameters);
      break;
    case "metro":
      selectedTasks = selectMetroTasks(parameters as MetroParameters);
      break;
    case "water_treatment":
      selectedTasks = selectWTPTasks(parameters as WaterTreatmentParameters);
      break;
    case "mmlp":
      selectedTasks = selectMMLPTasks(parameters as MMLPParameters);
      break;
    case "icd":
      selectedTasks = selectICDTasks(parameters as ICDParameters);
      break;
    case "liquid_cargo_terminal":
      selectedTasks = selectLCTTasks(parameters as LiquidCargoTerminalParameters);
      break;
    case "tunnel":
      selectedTasks = selectTunnelTasks(parameters as TunnelParameters);
      break;
    case "railway":
      selectedTasks = selectRailwayTasks(parameters as RailwayParameters);
      break;
    case "building":
      selectedTasks = selectBuildingTasks(parameters as BuildingParameters);
      break;
  }

  selectedTasks = expandToSections(selectedTasks, parameters.sections, infraType);

  const criticalPathTasks = selectedTasks.filter((t) => t.isCriticalPath);
  const longLeadItems = selectedTasks
    .filter((t) => t.leadTimeDays !== undefined && t.leadTimeDays >= 90)
    .sort((a, b) => (b.leadTimeDays ?? 0) - (a.leadTimeDays ?? 0));

  return {
    infraType,
    selectedTasks,
    criticalPathTasks,
    longLeadItems,
    totalTaskCount: selectedTasks.length,
  };
}
