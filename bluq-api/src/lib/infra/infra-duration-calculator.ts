// Infra Duration Calculator
// Converts selected infra tasks → ScheduledTask[] with dates and durations.
// Mirrors what duration-calculator.ts does for building projects.

import type { ScheduledTask } from "../duration-calculator.js";
import type { ResolvedPredecessor } from "../rules-engine.js";
import type { InfraRulesEngineResult } from "./infrastructure-rules-engine.js";
import type {
  PortParameters,
  AirportParameters,
  HighwayParameters,
  BridgeParameters,
  MetroParameters,
  WaterTreatmentParameters,
  MMLPParameters,
  ICDParameters,
  LiquidCargoTerminalParameters,
  InfrastructureType,
  TunnelParameters,
  RailwayParameters,
} from "./infrastructure-parameter-extractor.js";

import { ALL_PORT_TASKS, type PortTaskTemplate } from "./port-task-library.js";
import { ALL_AIRPORT_TASKS, type AirportTaskTemplate } from "./airport-task-library.js";
import { ALL_HIGHWAY_TASKS, type HighwayTaskTemplate } from "./highway-task-library.js";
import { ALL_BRIDGE_TASKS, type BridgeTaskTemplate } from "./bridge-task-library.js";
import { ALL_METRO_TASKS, type MetroTaskTemplate } from "./metro-task-library.js";
import { ALL_WTP_TASKS, type WTPTaskTemplate } from "./water-treatment-task-library.js";
import { ALL_MMLP_TASKS, type MMLPTaskTemplate } from "./mmlp-task-library.js";
import { ALL_ICD_TASKS, type ICDTaskTemplate } from "./icd-task-library.js";
import { ALL_LCT_TASKS, type LiquidCargoTerminalTaskTemplate } from "./liquid-cargo-terminal-task-library.js";
import { ALL_TUNNEL_TASKS, type TunnelTaskTemplate } from "./tunnel-task-library.js";
import { ALL_RAILWAY_TASKS, type RailwayTaskTemplate } from "./railway-task-library.js";

type AnyInfraTask =
  | PortTaskTemplate
  | AirportTaskTemplate
  | HighwayTaskTemplate
  | BridgeTaskTemplate
  | MetroTaskTemplate
  | WTPTaskTemplate
  | MMLPTaskTemplate
  | ICDTaskTemplate
  | LiquidCargoTerminalTaskTemplate
  | TunnelTaskTemplate
  | RailwayTaskTemplate;

type AnyInfraParams =
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

// ─── Task Template Lookup ──────────────────────────────────────────────────────

function getTemplateMap(infraType: InfrastructureType): Map<string, AnyInfraTask> {
  const lists: Record<InfrastructureType, AnyInfraTask[]> = {
    port:                  ALL_PORT_TASKS,
    airport:               ALL_AIRPORT_TASKS,
    highway:               ALL_HIGHWAY_TASKS,
    bridge:                ALL_BRIDGE_TASKS,
    metro:                 ALL_METRO_TASKS,
    water_treatment:       ALL_WTP_TASKS,
    mmlp:                  ALL_MMLP_TASKS,
    icd:                   ALL_ICD_TASKS,
    liquid_cargo_terminal: ALL_LCT_TASKS,
    tunnel:                ALL_TUNNEL_TASKS,
    railway:               ALL_RAILWAY_TASKS,
  };
  const map = new Map<string, AnyInfraTask>();
  for (const t of lists[infraType]) map.set(t.code, t);
  return map;
}

// ─── Quantity Estimation ───────────────────────────────────────────────────────

function estimateQuantity(
  task: AnyInfraTask,
  infraType: InfrastructureType,
  params: AnyInfraParams,
): number {
  const unit = task.unit as string;
  const phase = task.phase as string;

  switch (infraType) {
    case "port": {
      const p = params as PortParameters;
      if (unit === "Rmt") {
        if (phase === "marine_works") return p.breakwaterLengthM ?? p.quayLengthM;
        if (phase === "quay_berth")   return p.quayLengthM;
        return p.quayLengthM;
      }
      if (unit === "Cum") {
        if (phase === "marine_works")   return p.quayLengthM * p.dredgeDepthM * 50;
        if (phase === "reclamation")    return (p.reclamationAreaHa ?? 20) * 10000 * 3;
        return 5000;
      }
      if (unit === "Sqm") {
        if (phase === "yard_pavement")     return (p.yardAreaHa ?? 10) * 10000;
        if (phase === "terminal_buildings") return (p.yardAreaHa ?? 10) * 500;
        return p.quayLengthM * 30;
      }
      if (unit === "No") {
        if (task.code === "PT-CT-02") return p.stscranes ?? 2;
        if (task.code === "PT-CT-03") return p.rtgCranes ?? 4;
        return 1;
      }
      return 1;
    }

    case "airport": {
      const p = params as AirportParameters;
      if (unit === "Sqm") {
        if (phase === "runway_taxiway_pavement") return p.runwayLengthM * p.runwayWidthM * p.numberOfRunways;
        if (phase === "terminal_building")       return p.terminalAreaSqm;
        return p.runwayLengthM * 30;
      }
      if (unit === "Rmt") {
        if (phase === "perimeter_security") return p.perimeterLengthM;
        return p.runwayLengthM;
      }
      if (unit === "Cum") return p.runwayLengthM * p.runwayWidthM * 0.5;
      return 1;
    }

    case "highway": {
      const p = params as HighwayParameters;
      const laneWidthM = 3.75;
      const roadWidthM = p.numberOfLanes * laneWidthM;
      if (unit === "Sqm") return p.totalLengthKm * 1000 * roadWidthM;
      if (unit === "Cum") {
        if (phase === "earthworks") return p.totalLengthKm * 1000 * 2000;
        return p.totalLengthKm * 1000 * roadWidthM * 0.3;
      }
      if (unit === "Rmt") return p.totalLengthKm * 1000;
      if (unit === "No") {
        if (phase === "structures")  return p.numberOfBridges || 1;
        if (phase === "toll_its")    return p.numberOfTollPlazas || 1;
        return 1;
      }
      return 1;
    }

    case "bridge": {
      const p = params as BridgeParameters;
      if (unit === "Rmt") {
        if (phase === "foundation_piling") return p.numberOfPiers * (p.pileDepthM ?? 25) * 4;
        return p.totalLengthM;
      }
      if (unit === "Sqm") return p.totalLengthM * p.widthM;
      if (unit === "Cum") return p.totalLengthM * p.widthM * 0.25;
      if (unit === "No") {
        if (phase === "foundation_piling") return p.numberOfPiers;
        if (phase === "substructure")      return p.numberOfPiers + 2;
        if (phase === "superstructure")    return p.numberOfSpans;
        return 1;
      }
      return 1;
    }

    case "metro": {
      const p = params as MetroParameters;
      if (unit === "km") {
        if (phase === "viaduct_structure") return p.viaductLengthKm ?? p.totalLengthKm * 0.8;
        if (phase === "track_works")       return p.totalLengthKm;
        return p.tunnelLengthKm ?? p.totalLengthKm * 0.2;
      }
      if (unit === "No") {
        if (phase === "station_civil")          return p.numberOfElevatedStations ?? p.numberOfStations;
        if (phase === "systems_electromechanical") {
          if (task.code === "MR-TC-01") return p.rollingStockCars;
          return 1;
        }
        return p.numberOfStations;
      }
      if (unit === "Set" || unit === "LS") return 1;
      return 1;
    }

    case "water_treatment": {
      const p = params as WaterTreatmentParameters;
      if (unit === "MLD") return p.capacityMLD;
      if (unit === "Cum") return p.capacityMLD * 500;
      if (unit === "Sqm") return p.capacityMLD * 50;
      if (unit === "Rmt") return p.capacityMLD * 80;
      if (unit === "KL")  return p.capacityMLD * 3000;
      if (unit === "Set" || unit === "No") return p.numberOfUnits;
      return 1;
    }

    case "mmlp": {
      const p = params as MMLPParameters;
      if (unit === "Sqm") {
        if (phase === "warehouse_shed") return p.warehouseAreaSqm;
        if (phase === "intermodal_yard" || phase === "road_connectivity") return p.totalAreaHa * 3000;
        return p.totalAreaHa * 1000;
      }
      if (unit === "Cum") return p.totalAreaHa * 5000;
      if (unit === "Rmt") {
        if (phase === "rail_infrastructure") return p.railSidingLengthM ?? 500;
        return p.totalAreaHa * 200;
      }
      if (unit === "No") {
        if (task.code === "ML-EQ-01") return p.numberOfReachStackers ?? 2;
        if (task.code === "ML-EQ-02") return p.numberOfRtg ?? 2;
        return p.numberOfWarehouses;
      }
      if (unit === "Set" || unit === "LS") return 1;
      return 1;
    }

    case "icd": {
      const p = params as ICDParameters;
      if (unit === "Sqm") {
        if (phase === "warehousing_sheds" || phase === "customs_facilities") return p.customsWarehouseAreaSqm;
        return p.yardAreaHa * 10000;
      }
      if (unit === "Cum") return p.totalAreaHa * 6000;
      if (unit === "Rmt") {
        if (phase === "rail_siding") return p.railSidingLengthM ?? 400;
        return p.totalAreaHa * 300;
      }
      if (unit === "No") {
        if (task.code === "IC-CF-02" || task.code === "IC-CF-03") return 1;
        if (phase === "systems_gate") return 1;
        return p.numberOfRtg ?? 2;
      }
      if (unit === "Set" || unit === "LS") return 1;
      return 1;
    }

    case "liquid_cargo_terminal": {
      const p = params as LiquidCargoTerminalParameters;
      if (unit === "Rmt") {
        if (phase === "marine_structures") return p.jettyLengthM;
        if (phase === "pipeline_piping")   return p.pipelineLengthM;
        if (phase === "fire_safety_systems") return p.pipelineLengthM * 0.5;
        return p.jettyLengthM;
      }
      if (unit === "Cum") {
        if (phase === "marine_structures") return p.jettyLengthM * p.dredgeDepthM * 80;
        if (phase === "storage_tanks")     return p.storageTankCapacityKL * 0.1;
        return 5000;
      }
      if (unit === "Sqm") {
        if (phase === "fire_safety_systems") return p.numberOfTanks * 200;
        return p.jettyLengthM * 20;
      }
      if (unit === "No") {
        if (task.code === "LC-ME-01") return p.numberOfMLAs;
        if (phase === "storage_tanks")    return p.numberOfTanks;
        if (phase === "fire_safety_systems") return p.numberOfTanks * 4;
        return p.numberOfBerths;
      }
      if (unit === "Set" || unit === "LS") return 1;
      return 1;
    }

    case "tunnel": {
      const p = params as TunnelParameters;
      // Tunnel length in metres is the base quantity for most linear items
      if (unit === "Rmt") {
        if (phase === "portal_works")         return p.internalDiameterM * 10;      // face cut area × short length
        if (phase === "tunnel_excavation")    return p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "primary_support")      return p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "waterproofing_lining") return p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "drainage_invert")      return p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "road_rail_finishing")  return p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "mep_safety")           return p.totalLengthM * (p.numberOfTubes ?? 1);
        return p.totalLengthM;
      }
      if (unit === "Sqm") {
        // Portal face and waterproofing membrane
        if (phase === "portal_works")         return Math.PI * (p.internalDiameterM / 2) ** 2 * 2;
        if (phase === "waterproofing_lining") return Math.PI * p.internalDiameterM * p.totalLengthM * (p.numberOfTubes ?? 1);
        return p.totalLengthM * 30;
      }
      if (unit === "Cum") {
        // Portal cut slope / invert concrete / secondary lining concrete
        if (phase === "portal_works")         return 5000;
        if (phase === "waterproofing_lining") return Math.PI * p.internalDiameterM * 0.3 * p.totalLengthM * (p.numberOfTubes ?? 1);
        if (phase === "drainage_invert")      return p.totalLengthM * p.internalDiameterM * 0.2 * (p.numberOfTubes ?? 1);
        return 2000;
      }
      if (unit === "MT") {
        // Steel ribs
        if (phase === "primary_support") return p.totalLengthM * 0.1 * (p.numberOfTubes ?? 1);
        return 100;
      }
      if (unit === "No") {
        if (task.code === "TN-EX-04") return Math.ceil(p.totalLengthM / 3);         // face maps per round
        if (task.code === "TN-PS-01") return Math.ceil(p.totalLengthM * 8);         // rock bolts: ~8/rmt
        if (task.code === "TN-PS-05") return Math.ceil(p.totalLengthM / 30);        // extensometers every 30m
        if (task.code === "TN-ME-01") return Math.ceil(p.totalLengthM / 100);       // jet fans every 100m
        if (task.code === "TN-ME-03") return Math.ceil(p.totalLengthM / 8);         // LED lights every 8m
        if (task.code === "TN-ME-04") return Math.ceil(p.totalLengthM / 200);       // deluge headers
        if (task.code === "TN-RF-02") return Math.ceil(p.totalLengthM / 10);        // signage
        if (task.code === "TN-EX-06") return Math.ceil(p.totalLengthM / 250);       // cross-passages
        return 1;
      }
      if (unit === "Set" || unit === "LS" || unit === "Days") return 1;
      return 1;
    }

    case "railway": {
      const p = params as RailwayParameters;
      const lengthM = p.totalLengthKm * 1000;
      // Rmt: running metres — most linear track items
      if (unit === "Rmt") {
        if (task.phase === "track_laying")    return lengthM;
        if (task.phase === "station_works")   return p.numberOfStations * 300;   // 300m platform per station
        if (task.phase === "land_acquisition") return lengthM;
        return lengthM;
      }
      // km: route-length items (track geometry, OHE wiring, OFC)
      if (unit === "km") {
        if (task.phase === "traction_power")      return p.totalLengthKm;
        if (task.phase === "signalling_telecom")  return p.totalLengthKm;
        if (task.phase === "track_laying")        return p.totalLengthKm;
        if (task.phase === "testing_commissioning") return p.totalLengthKm;
        return p.totalLengthKm;
      }
      // Cum: earthwork volumes
      if (unit === "Cum") {
        if (task.phase === "earthworks") return lengthM * 1500;   // ~1500 Cum/m linear for BG formation
        return 5000;
      }
      // Sqm: platform, building, formation finishing
      if (unit === "Sqm") {
        if (task.phase === "station_works")  return p.numberOfStations * 500;   // 500 Sqm station building each
        if (task.phase === "earthworks")     return lengthM * 7;                // 7m formation width BG
        return lengthM * 7;
      }
      // No: sleepers, signals
      if (unit === "No") {
        if (task.code === "RW-TL-02")  return Math.ceil(p.totalLengthKm * 1540);  // 1540 PSC sleepers/km
        if (task.code === "RW-SG-02")  return p.numberOfStations * 6;             // ~6 signals per station
        return 1;
      }
      // Each: bridges, ROBs, level crossings, turnouts, stations
      if (unit === "Each") {
        if (task.code === "RW-BC-01")  return Math.max(1, Math.ceil(p.totalLengthKm * 5));  // ~5 minor bridges/km
        if (task.code === "RW-BC-02")  return Math.max(1, p.numberOfMajorBridges);
        if (task.code === "RW-BC-03")  return Math.max(1, p.numberOfROBs);
        if (task.code === "RW-BC-04")  return Math.max(1, p.numberOfLevelCrossings);
        if (task.code === "RW-TL-05")  return p.numberOfStations * 4;               // ~4 turnouts per station
        if (task.phase === "signalling_telecom") return p.numberOfStations;
        if (task.phase === "traction_power")     return Math.ceil(p.totalLengthKm / 60); // 1 TSS per 60km
        return 1;
      }
      if (unit === "Set" || unit === "LS") return 1;
      return 1;
    }
  }
}

// ─── Duration Calculation ──────────────────────────────────────────────────────

const MONSOON_MONTHS = new Set([6, 7, 8, 9]); // June–September

function monsoonOverlap(startDay: number, durationDays: number, projectStartDate: Date): number {
  let monsoonDays = 0;
  for (let d = 0; d < durationDays; d++) {
    const date = new Date(projectStartDate);
    date.setDate(date.getDate() + startDay + d);
    if (MONSOON_MONTHS.has(date.getMonth() + 1)) monsoonDays++;
  }
  return monsoonDays;
}

function calcDuration(task: AnyInfraTask, quantity: number): number {
  const rate = task.productivityRate;
  const avgRate = (rate.min + rate.max) / 2;

  // Category A tasks: productivityRate is duration itself, not rate
  if (task.taskCategory === "A" || rate.unit === "Days") {
    return Math.round(avgRate);
  }

  // Category B: quantity / rate → days
  const raw = quantity / avgRate;
  return Math.max(1, Math.round(raw));
}

// ─── Topological Sort ─────────────────────────────────────────────────────────

function topoSort(tasks: AnyInfraTask[], selectedCodes: Set<string>): AnyInfraTask[] {
  const codeToTask = new Map<string, AnyInfraTask>(tasks.map(t => [t.code, t]));
  const visited = new Set<string>();
  const result: AnyInfraTask[] = [];

  function visit(task: AnyInfraTask) {
    if (visited.has(task.code)) return;
    visited.add(task.code);
    for (const pred of task.predecessors) {
      if (selectedCodes.has(pred.taskCode)) {
        const predTask = codeToTask.get(pred.taskCode);
        if (predTask) visit(predTask);
      }
    }
    result.push(task);
  }

  for (const task of tasks) {
    if (selectedCodes.has(task.code)) visit(task);
  }
  return result;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addWorkDays(startDate: Date, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip weekends
  }
  return d;
}

function dayNumberToDate(projectStart: Date, dayNum: number): string {
  const d = addWorkDays(projectStart, dayNum);
  return d.toISOString().split("T")[0];
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export interface InfraScheduleResult {
  tasks: ScheduledTask[];
  totalDurationDays: number;
  criticalPathTasks: number;
  longLeadItems: Array<{ code: string; name: string; leadTimeDays: number }>;
}

export function calculateInfraSchedule(
  rulesResult: InfraRulesEngineResult,
  infraType: InfrastructureType,
  params: AnyInfraParams,
  startDate: string,
): InfraScheduleResult {
  const projectStart = new Date(startDate);
  const templateMap = getTemplateMap(infraType);

  // Resolve selected task templates in topological order
  const selectedCodes = new Set(rulesResult.selectedTasks.map(t => t.code));
  const allTemplates = Array.from(templateMap.values());
  const orderedTemplates = topoSort(allTemplates, selectedCodes);

  // CPM forward pass: track earliest finish day per task code
  const efDay = new Map<string, number>(); // code → earliest finish (day from start)

  const scheduledTasks: ScheduledTask[] = [];

  for (const template of orderedTemplates) {
    const quantity = estimateQuantity(template, infraType, params);
    const baseDuration = calcDuration(template, quantity);

    // Earliest start = max EF of resolved predecessors
    let es = 0;
    const resolvedPreds: ResolvedPredecessor[] = [];
    for (const pred of template.predecessors) {
      if (!selectedCodes.has(pred.taskCode)) continue;
      const predEf = efDay.get(pred.taskCode) ?? 0;
      const lagDays = pred.lagDays ?? 0;
      let depStart: number;
      if (pred.type === "FS") depStart = predEf + lagDays;
      else if (pred.type === "SS") depStart = (efDay.get(pred.taskCode) ?? 0) - baseDuration + lagDays;
      else depStart = predEf + lagDays;
      es = Math.max(es, Math.max(0, depStart));
      resolvedPreds.push({ taskCode: pred.taskCode, lagDays, type: pred.type });
    }

    // Monsoon adjustment
    const monsoonDays = monsoonOverlap(es, baseDuration, projectStart);
    const mif = template.monsoonImpactFactor ?? 1.0;
    const extraDays = Math.round(monsoonDays * (mif - 1));
    const adjustedDuration = baseDuration + extraDays;
    const ef = es + adjustedDuration;

    efDay.set(template.code, ef);

    const startIso = dayNumberToDate(projectStart, es);
    const endIso   = dayNumberToDate(projectStart, ef);

    const selectedTask = rulesResult.selectedTasks.find(t => t.code === template.code);

    scheduledTasks.push({
      code:                  template.code,
      originalCode:          template.code,
      phase:                 template.phase as string,
      name:                  template.name,
      fullName:              template.name,
      unit:                  template.unit as string,
      taskCategory:          (template.taskCategory ?? "B") as "A" | "B",
      estimatedQuantity:     quantity,
      quantityUnit:          template.unit as string,
      baseDurationDays:      baseDuration,
      adjustedDurationDays:  adjustedDuration,
      finalDurationDays:     adjustedDuration,
      startDate:             startIso,
      endDate:               endIso,
      predecessors:          resolvedPreds,
      crew:                  template.crew,
      monsoonImpactFactor:   mif,
      monsoonOverlapDays:    monsoonDays,
      monsoonAdjustedDays:   extraDays,
      earliestStart:         es,
      earliestFinish:        ef,
      isCriticalPath:        selectedTask?.isCriticalPath ?? false,
      totalFloat:            0,
      source:                "infra_library",
      isPerFloor:            false,
      isPerFlat:             false,
      contractorType:        (template as any).requiresSpecialistContractor
                               ? ((template as any).specialistType ?? "Specialist Contractor")
                               : "Main Contractor",
      regionalAdjustments: {
        labourCostIndex:       1.0,
        materialCostIndex:     1.0,
        productivityIndex:     1.0,
        monsoonMifMultiplier:  1.0,
      },
    });
  }

  const totalDurationDays = Math.max(...scheduledTasks.map(t => t.earliestFinish), 0);
  const criticalPathTasks = scheduledTasks.filter(t => t.isCriticalPath).length;
  const longLeadItems = rulesResult.longLeadItems.map(t => ({
    code:         t.code,
    name:         t.name,
    leadTimeDays: t.leadTimeDays ?? 0,
  }));

  return { tasks: scheduledTasks, totalDurationDays, criticalPathTasks, longLeadItems };
}
