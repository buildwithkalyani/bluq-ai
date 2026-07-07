// Infra Duration Calculator + RCPSP List Scheduler
// Step 1: Extract quantities, rates, resource counts per task
// Step 2: RCPSP list scheduling — respects resource pool + spatial zone constraints
// OR-Tools CP-SAT (Python microservice) will refine this to 100% optimal in Phase 2

import type { ScheduledTask } from "../duration-calculator.js";
import type { ResolvedPredecessor } from "../rules-engine.js";
import type { InfraRulesEngineResult, SelectedInfraTask } from "./infrastructure-rules-engine.js";
import type {
  InfraSection,
  InfraProductivityRate,
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
  BuildingParameters,
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
import { ALL_BUILDING_TASKS, type BuildingTaskTemplate } from "./building-task-library.js";

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
  | RailwayTaskTemplate
  | BuildingTaskTemplate;

export type AnyInfraParams =
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

// ─── Template Lookup ───────────────────────────────────────────────────────────

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
    building:              ALL_BUILDING_TASKS,
  };
  const map = new Map<string, AnyInfraTask>();
  for (const t of lists[infraType]) map.set(t.code, t);
  return map;
}

// ─── Code Helpers ─────────────────────────────────────────────────────────────

function getBaseCode(task: SelectedInfraTask): string {
  if (!task.sectionId) return task.code;
  return task.code.slice(0, task.code.length - task.sectionId.length - 1);
}

// ─── Section + Quantity ────────────────────────────────────────────────────────

function getSection(sectionId: string | undefined, params: AnyInfraParams): InfraSection | undefined {
  if (!sectionId) return undefined;
  return params.sections.find(s => s.id === sectionId);
}

function resolveQuantity(
  task: SelectedInfraTask,
  template: AnyInfraTask,
  infraType: InfrastructureType,
  params: AnyInfraParams,
): number {
  const section = getSection(task.sectionId, params);
  if (section?.quantityValue != null) {
    const contingency = section.quantityBasis === "estimated" ? 1.2 : 1.0;
    return section.quantityValue * contingency;
  }
  return estimateQuantity(template, infraType, params);
}

// ─── Productivity Rate ────────────────────────────────────────────────────────

function resolveProductivityRate(
  baseCode: string,
  template: AnyInfraTask,
  params: AnyInfraParams,
): { ratePerDayPerUnit: number; resourceType: string | undefined } {
  const extracted = params.productivityRates.find((r: InfraProductivityRate) => r.taskCode === baseCode);
  if (extracted) return { ratePerDayPerUnit: extracted.ratePerDayPerUnit, resourceType: extracted.resourceType };
  const avg = (template.productivityRate.min + template.productivityRate.max) / 2;
  return { ratePerDayPerUnit: avg, resourceType: undefined };
}

// ─── Resource Pool ─────────────────────────────────────────────────────────────
// Returns how many units of resourceType are available at a given project day.
// Respects availabilityWindows — ramp-up/ramp-down over project lifecycle.

function getTotalResourceAtDay(
  resourceType: string,
  projectDayNum: number,
  params: AnyInfraParams,
): number {
  const resource = params.availableResources.find(r => r.type === resourceType);
  if (!resource) return 1;
  if (!resource.availabilityWindows?.length) return resource.count;
  const projectMonth = Math.floor(projectDayNum / 30) + 1;
  const window = resource.availabilityWindows.find(
    w => projectMonth >= w.fromProjectMonth && projectMonth <= w.toProjectMonth,
  );
  return window?.count ?? 1;
}

// ─── Monsoon ──────────────────────────────────────────────────────────────────

function monsoonOverlapDays(
  startDay: number,
  durationDays: number,
  projectStartDate: Date,
  monsoonMonths: number[],
): number {
  const monsoonSet = new Set(monsoonMonths);
  let count = 0;
  for (let d = 0; d < durationDays; d++) {
    const date = new Date(projectStartDate);
    date.setDate(date.getDate() + startDay + d);
    if (monsoonSet.has(date.getMonth() + 1)) count++;
  }
  return count;
}

// ─── Duration per task given actual units assigned ────────────────────────────

function calcDuration(
  task: SelectedInfraTask,
  template: AnyInfraTask,
  quantity: number,
  actualUnits: number,
  startDay: number,
  projectStart: Date,
  params: AnyInfraParams,
): { baseDuration: number; adjustedDuration: number; monsoonDays: number; extraDays: number } {
  let baseDuration: number;

  if (template.taskCategory === "A" || template.productivityRate.unit === "Days") {
    baseDuration = Math.round((template.productivityRate.min + template.productivityRate.max) / 2);
  } else {
    const baseCode = getBaseCode(task);
    const { ratePerDayPerUnit } = resolveProductivityRate(baseCode, template, params);
    const effectiveOutput = ratePerDayPerUnit * Math.max(1, actualUnits);
    baseDuration = Math.max(1, Math.round(quantity / effectiveOutput));
  }

  const mDays = monsoonOverlapDays(startDay, baseDuration, projectStart, params.monsoonMonths);
  const mif = template.monsoonImpactFactor ?? 1.0;
  const extraDays = Math.round(mDays * (mif - 1));
  return { baseDuration, adjustedDuration: baseDuration + extraDays, monsoonDays: mDays, extraDays };
}

// ─── RCPSP: Estimated durations for chain-length priority calculation ──────────
// Uses 1 resource unit — gives conservative estimate used only for priority, not final schedule.

function estimateDurationsForPriority(
  tasks: SelectedInfraTask[],
  templateMap: Map<string, AnyInfraTask>,
  infraType: InfrastructureType,
  params: AnyInfraParams,
  projectStart: Date,
): Map<string, number> {
  const durations = new Map<string, number>();
  for (const task of tasks) {
    const baseCode = getBaseCode(task);
    const template = templateMap.get(baseCode);
    if (!template) { durations.set(task.code, 1); continue; }
    const quantity = resolveQuantity(task, template, infraType, params);
    const { baseDuration, adjustedDuration } = calcDuration(task, template, quantity, 1, 0, projectStart, params);
    durations.set(task.code, adjustedDuration);
  }
  return durations;
}

// ─── RCPSP: Chain length (remaining path) for priority ────────────────────────
// Chain length = task duration + longest chain of successors.
// Tasks with longer chains go first — avoids delaying the critical path.

function computeChainLengths(
  tasks: SelectedInfraTask[],
  templateMap: Map<string, AnyInfraTask>,
  selectedBaseCodes: Set<string>,
  selectedTaskMap: Map<string, SelectedInfraTask>,
  estimatedDurations: Map<string, number>,
): Map<string, number> {
  // Build successor map
  const successors = new Map<string, string[]>();
  for (const task of tasks) successors.set(task.code, []);

  for (const task of tasks) {
    const baseCode = getBaseCode(task);
    const template = templateMap.get(baseCode);
    if (!template) continue;
    for (const pred of template.predecessors) {
      if (!selectedBaseCodes.has(pred.taskCode)) continue;
      const sectionPredCode = task.sectionId ? `${pred.taskCode}_${task.sectionId}` : pred.taskCode;
      const predCode = selectedTaskMap.has(sectionPredCode) ? sectionPredCode : pred.taskCode;
      if (successors.has(predCode)) successors.get(predCode)!.push(task.code);
    }
  }

  // Backward pass with memoization
  const chainLen = new Map<string, number>();
  function getLen(code: string): number {
    if (chainLen.has(code)) return chainLen.get(code)!;
    const d = estimatedDurations.get(code) ?? 1;
    const succs = successors.get(code) ?? [];
    const len = d + (succs.length > 0 ? Math.max(...succs.map(getLen)) : 0);
    chainLen.set(code, len);
    return len;
  }
  for (const task of tasks) getLen(task.code);
  return chainLen;
}

// ─── RCPSP: Predecessor resolve ───────────────────────────────────────────────

function resolvePredecessorCode(
  predBaseCode: string,
  currentTask: SelectedInfraTask,
  selectedTaskMap: Map<string, SelectedInfraTask>,
): string {
  if (currentTask.sectionId) {
    const sectionSpecific = `${predBaseCode}_${currentTask.sectionId}`;
    if (selectedTaskMap.has(sectionSpecific)) return sectionSpecific;
  }
  return predBaseCode;
}

// ─── RCPSP List Scheduling ────────────────────────────────────────────────────
// Event-driven simulation. At each event (task finish), reschedule waiting tasks.
// Priority: longest remaining chain first (critical path heuristic).
// Two constraints per task:
//   1. Resource pool: poolUsed[resourceType] + actualUnits ≤ totalPool[resourceType]
//   2. Zone capacity: zoneUsed[sectionId] + actualUnits ≤ maxConcurrentActivities

interface RCPSPTaskState {
  status:           "waiting" | "running" | "done";
  startDay:         number;
  endDay:           number;
  actualUnits:      number;
  resourceType:     string | undefined;
  baseDuration:     number;
  adjustedDuration: number;
  monsoonDays:      number;
  extraDays:        number;
  quantity:         number;
  resolvedPreds:    ResolvedPredecessor[];
}

function runRCPSP(
  tasks: SelectedInfraTask[],
  templateMap: Map<string, AnyInfraTask>,
  infraType: InfrastructureType,
  params: AnyInfraParams,
  projectStart: Date,
  chainLengths: Map<string, number>,
  selectedBaseCodes: Set<string>,
  selectedTaskMap: Map<string, SelectedInfraTask>,
): Map<string, RCPSPTaskState> {
  const state = new Map<string, RCPSPTaskState>();

  // Pre-compute quantities
  for (const task of tasks) {
    const baseCode = getBaseCode(task);
    const template = templateMap.get(baseCode);
    const quantity = template ? resolveQuantity(task, template, infraType, params) : 0;
    state.set(task.code, {
      status: "waiting", startDay: 0, endDay: 0,
      actualUnits: 0, resourceType: undefined,
      baseDuration: 0, adjustedDuration: 0, monsoonDays: 0, extraDays: 0,
      quantity, resolvedPreds: [],
    });
  }

  // Current resource usage: resourceType → units currently in use
  const poolUsed = new Map<string, number>();
  // Current zone usage: sectionId → units currently in use in that zone
  const zoneUsed = new Map<string, number>();

  function poolAvailable(resourceType: string, day: number): number {
    const total = getTotalResourceAtDay(resourceType, day, params);
    return total - (poolUsed.get(resourceType) ?? 0);
  }

  function zoneAvailable(sectionId: string | undefined, maxConcurrent: number): number {
    if (!sectionId) return maxConcurrent;
    return maxConcurrent - (zoneUsed.get(sectionId) ?? 0);
  }

  function isReady(task: SelectedInfraTask): boolean {
    if (state.get(task.code)!.status !== "waiting") return false;
    const baseCode = getBaseCode(task);
    const template = templateMap.get(baseCode);
    if (!template) return true;
    for (const pred of template.predecessors) {
      if (!selectedBaseCodes.has(pred.taskCode)) continue;
      const predCode = resolvePredecessorCode(pred.taskCode, task, selectedTaskMap);
      const predState = state.get(predCode);
      if (!predState || predState.status !== "done") return false;
    }
    return true;
  }

  let currentDay = 0;
  const maxIterations = tasks.length * tasks.length + 1000;
  let iterations = 0;

  while (iterations++ < maxIterations) {
    // Find tasks ready to start
    const ready = tasks
      .filter(t => isReady(t))
      .sort((a, b) => (chainLengths.get(b.code) ?? 0) - (chainLengths.get(a.code) ?? 0));

    let anyStarted = false;

    for (const task of ready) {
      const baseCode = getBaseCode(task);
      const template = templateMap.get(baseCode);
      if (!template) {
        // No template: schedule immediately with duration 1
        const s = state.get(task.code)!;
        s.status = "running"; s.startDay = currentDay; s.endDay = currentDay + 1;
        s.baseDuration = 1; s.adjustedDuration = 1;
        anyStarted = true;
        continue;
      }

      const { resourceType } = resolveProductivityRate(baseCode, template, params);
      const section = getSection(task.sectionId, params);
      const maxConcurrent = section?.maxConcurrentActivities ?? 1;

      // Check both constraints
      const zoneLeft = zoneAvailable(task.sectionId, maxConcurrent);
      if (zoneLeft < 1) continue; // zone full

      let actualUnits: number;
      if (resourceType) {
        const poolLeft = poolAvailable(resourceType, currentDay);
        if (poolLeft < 1) continue; // no resources available
        actualUnits = Math.min(poolLeft, zoneLeft);
      } else {
        // Category A / no resource type — schedule immediately, no pool deduction
        actualUnits = 0;
      }

      // Build resolved predecessors
      const resolvedPreds: ResolvedPredecessor[] = [];
      for (const pred of template.predecessors) {
        if (!selectedBaseCodes.has(pred.taskCode)) continue;
        const predCode = resolvePredecessorCode(pred.taskCode, task, selectedTaskMap);
        resolvedPreds.push({ taskCode: predCode, lagDays: pred.lagDays ?? 0, type: pred.type });
      }

      // Compute duration with actual units
      const s = state.get(task.code)!;
      const { baseDuration, adjustedDuration, monsoonDays, extraDays } =
        calcDuration(task, template, s.quantity, actualUnits || 1, currentDay, projectStart, params);

      // Start the task
      s.status = "running";
      s.startDay = currentDay;
      s.endDay = currentDay + adjustedDuration;
      s.actualUnits = actualUnits;
      s.resourceType = resourceType;
      s.baseDuration = baseDuration;
      s.adjustedDuration = adjustedDuration;
      s.monsoonDays = monsoonDays;
      s.extraDays = extraDays;
      s.resolvedPreds = resolvedPreds;

      // Deduct from pool and zone
      if (resourceType && actualUnits > 0) {
        poolUsed.set(resourceType, (poolUsed.get(resourceType) ?? 0) + actualUnits);
      }
      if (task.sectionId && actualUnits > 0) {
        zoneUsed.set(task.sectionId, (zoneUsed.get(task.sectionId) ?? 0) + actualUnits);
      }

      anyStarted = true;
    }

    // All done?
    if ([...state.values()].every(s => s.status === "done")) break;

    // Find next event: earliest endDay among running tasks
    const running = [...state.entries()].filter(([, s]) => s.status === "running");
    if (running.length === 0) {
      // Nothing running and nothing started — dependency deadlock or all done
      if (!anyStarted) break;
      continue;
    }

    const nextEvent = Math.min(...running.map(([, s]) => s.endDay));

    // Release resources from tasks finishing at nextEvent
    for (const [code, s] of state.entries()) {
      if (s.status === "running" && s.endDay === nextEvent) {
        s.status = "done";
        if (s.resourceType && s.actualUnits > 0) {
          poolUsed.set(s.resourceType, (poolUsed.get(s.resourceType) ?? 0) - s.actualUnits);
        }
        const task = selectedTaskMap.get(code);
        if (task?.sectionId && s.actualUnits > 0) {
          zoneUsed.set(task.sectionId, (zoneUsed.get(task.sectionId) ?? 0) - s.actualUnits);
        }
      }
    }

    currentDay = nextEvent;
  }

  // Mark any still-waiting tasks as done at last day (safety fallback)
  const lastDay = Math.max(...[...state.values()].map(s => s.endDay), 0);
  for (const s of state.values()) {
    if (s.status !== "done") {
      s.status = "done"; s.startDay = lastDay; s.endDay = lastDay + 1;
      s.baseDuration = 1; s.adjustedDuration = 1;
    }
  }

  return state;
}

// ─── Quantity Estimation Fallback ──────────────────────────────────────────────

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
        return p.quayLengthM;
      }
      if (unit === "Cum") {
        if (phase === "marine_works")   return p.quayLengthM * p.dredgeDepthM * 50;
        if (phase === "reclamation")    return (p.reclamationAreaHa ?? 20) * 10000 * 3;
        return 5000;
      }
      if (unit === "Sqm") {
        if (phase === "yard_pavement")      return (p.yardAreaHa ?? 10) * 10000;
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
      const roadWidthM = p.numberOfLanes * 3.75;
      if (unit === "Sqm") return p.totalLengthKm * 1000 * roadWidthM;
      if (unit === "Cum") {
        if (phase === "earthworks") return p.totalLengthKm * 1000 * 2000;
        return p.totalLengthKm * 1000 * roadWidthM * 0.3;
      }
      if (unit === "Rmt") return p.totalLengthKm * 1000;
      if (unit === "No") {
        if (phase === "structures") return p.numberOfBridges || 1;
        if (phase === "toll_its")   return p.numberOfTollPlazas || 1;
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
        if (phase === "station_civil") return p.numberOfElevatedStations ?? p.numberOfStations;
        if (task.code === "MR-TC-01")  return p.rollingStockCars;
        return p.numberOfStations;
      }
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
        return p.totalAreaHa * 3000;
      }
      if (unit === "Cum") return p.totalAreaHa * 5000;
      if (unit === "Rmt") return p.railSidingLengthM ?? 500;
      if (unit === "No") {
        if (task.code === "ML-EQ-01") return p.numberOfReachStackers ?? 2;
        if (task.code === "ML-EQ-02") return p.numberOfRtg ?? 2;
        return p.numberOfWarehouses;
      }
      return 1;
    }
    case "icd": {
      const p = params as ICDParameters;
      if (unit === "Sqm") {
        if (phase === "warehousing_sheds" || phase === "customs_facilities") return p.customsWarehouseAreaSqm;
        return p.yardAreaHa * 10000;
      }
      if (unit === "Cum") return p.totalAreaHa * 6000;
      if (unit === "Rmt") return p.railSidingLengthM ?? 400;
      if (unit === "No") {
        if (task.code === "IC-CF-02" || task.code === "IC-CF-03") return 1;
        return p.numberOfRtg ?? 2;
      }
      return 1;
    }
    case "liquid_cargo_terminal": {
      const p = params as LiquidCargoTerminalParameters;
      if (unit === "Rmt") {
        if (phase === "marine_structures")   return p.jettyLengthM;
        if (phase === "pipeline_piping")     return p.pipelineLengthM;
        return p.pipelineLengthM * 0.5;
      }
      if (unit === "Cum") {
        if (phase === "marine_structures") return p.jettyLengthM * p.dredgeDepthM * 80;
        if (phase === "storage_tanks")     return p.storageTankCapacityKL * 0.1;
        return 5000;
      }
      if (unit === "Sqm") return p.numberOfTanks * 200;
      if (unit === "No") {
        if (task.code === "LC-ME-01") return p.numberOfMLAs;
        if (phase === "storage_tanks")       return p.numberOfTanks;
        return p.numberOfBerths;
      }
      return 1;
    }
    case "tunnel": {
      const p = params as TunnelParameters;
      if (unit === "Rmt") {
        if (phase === "portal_works") return p.internalDiameterM * 10;
        return p.totalLengthM * (p.numberOfTubes ?? 1);
      }
      if (unit === "Sqm") {
        if (phase === "portal_works") return Math.PI * (p.internalDiameterM / 2) ** 2 * 2;
        return Math.PI * p.internalDiameterM * p.totalLengthM * (p.numberOfTubes ?? 1);
      }
      if (unit === "Cum") return p.totalLengthM * p.internalDiameterM * 0.3 * (p.numberOfTubes ?? 1);
      if (unit === "MT")  return p.totalLengthM * 0.1 * (p.numberOfTubes ?? 1);
      if (unit === "No") {
        if (task.code === "TN-PS-01") return Math.ceil(p.totalLengthM * 8);
        if (task.code === "TN-EX-06") return Math.ceil(p.totalLengthM / 250);
        return 1;
      }
      return 1;
    }
    case "railway": {
      const p = params as RailwayParameters;
      const lengthM = p.totalLengthKm * 1000;
      if (unit === "Rmt") return lengthM;
      if (unit === "km")  return p.totalLengthKm;
      if (unit === "Cum") return lengthM * 1500;
      if (unit === "Sqm") return p.numberOfStations * 500;
      if (unit === "No") {
        if (task.code === "RW-TL-02") return Math.ceil(p.totalLengthKm * 1540);
        return 1;
      }
      if (unit === "Each") {
        if (task.code === "RW-BC-02") return Math.max(1, p.numberOfMajorBridges);
        if (task.code === "RW-BC-03") return Math.max(1, p.numberOfROBs);
        return 1;
      }
      return 1;
    }
    case "building": {
      const p = params as BuildingParameters;
      const floorPlate = p.floorPlateSqm ?? Math.round(p.totalBuiltUpAreaSqm / Math.max(1, p.numberOfFloors));
      const concreteVolumeCum = p.totalBuiltUpAreaSqm * 0.12; // ~0.12 m³ concrete per sqm BUA (IS 456 typical)
      if (unit === "Sqm") {
        if (phase === "superstructure")   return floorPlate;  // per floor cluster section
        if (phase === "envelope")         return p.totalBuiltUpAreaSqm * 0.4; // perimeter wall area estimate
        if (phase === "finishing")        return p.totalBuiltUpAreaSqm * 1.5; // walls + floors (1.5× BUA)
        if (phase === "external_works")   return floorPlate * 0.8; // external paved area ≈ 80% of floor plate
        return p.totalBuiltUpAreaSqm;
      }
      if (unit === "Cum") {
        if (phase === "substructure") {
          if (task.code === "BL-EX-01") return floorPlate * (p.basementLevels > 0 ? p.basementLevels * 3.5 : 1.5); // excavation depth estimate
          if (task.code === "BL-BM-01") return floorPlate * p.basementLevels * 0.3; // retaining wall volume
          return concreteVolumeCum * 0.15; // foundation concrete
        }
        if (phase === "superstructure") return floorPlate * 0.12; // concrete per floor cluster
        return concreteVolumeCum;
      }
      if (unit === "Rmt") {
        if (phase === "site_preparation") return Math.sqrt(floorPlate * p.numberOfBlocks) * 4; // compound perimeter
        if (phase === "mep_services")     return p.totalBuiltUpAreaSqm / 5; // piping runs
        return p.totalBuiltUpAreaSqm / 10;
      }
      if (unit === "Nos" || unit === "No") {
        if (task.code === "BL-ME-05") return p.numberOfLifts ?? Math.max(1, Math.ceil(p.numberOfFloors / 10));
        if (task.code === "BL-FF-03") return Math.ceil(p.totalBuiltUpAreaSqm / 50); // 1 door per 50 sqm
        if (task.code === "BL-PW-04") return p.numberOfBlocks; // one crane per block
        return p.numberOfBlocks;
      }
      return 1;
    }
  }
}

// ─── Date Helpers ──────────────────────────────────────────────────────────────

function addWorkDays(startDate: Date, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function dayNumberToDate(projectStart: Date, dayNum: number): string {
  return addWorkDays(projectStart, dayNum).toISOString().split("T")[0];
}

// ─── Main Export ───────────────────────────────────────────────────────────────

// Extends ScheduledTask with RCPSP allocation metadata needed by the OR-Tools optimizer.
export interface InfraScheduledTask extends ScheduledTask {
  actualUnits: number;       // resource units allocated by list scheduler
  resourceType?: string;     // which pool was deducted
  sectionId?: string;        // zone this task belongs to
}

export interface InfraScheduleResult {
  tasks: InfraScheduledTask[];
  totalDurationDays: number;
  criticalPathTasks: number;
  longLeadItems: Array<{ code: string; name: string; leadTimeDays: number }>;
}

export { dayNumberToDate };

export function calculateInfraSchedule(
  rulesResult: InfraRulesEngineResult,
  infraType: InfrastructureType,
  params: AnyInfraParams,
  startDate: string,
): InfraScheduleResult {
  const projectStart = new Date(startDate);
  const templateMap = getTemplateMap(infraType);
  const selectedTaskMap = new Map(rulesResult.selectedTasks.map(t => [t.code, t]));
  const selectedBaseCodes = new Set(rulesResult.selectedTasks.map(t => getBaseCode(t)));

  // Step 1: Estimate durations (1 resource unit) for priority calculation
  const estimatedDurations = estimateDurationsForPriority(
    rulesResult.selectedTasks, templateMap, infraType, params, projectStart,
  );

  // Step 2: Compute chain lengths (remaining path) for RCPSP priority
  const chainLengths = computeChainLengths(
    rulesResult.selectedTasks, templateMap, selectedBaseCodes, selectedTaskMap, estimatedDurations,
  );

  // Step 3: RCPSP list scheduling
  const rcpspState = runRCPSP(
    rulesResult.selectedTasks, templateMap, infraType, params, projectStart,
    chainLengths, selectedBaseCodes, selectedTaskMap,
  );

  // Step 4: Build InfraScheduledTask[] from RCPSP results
  const scheduledTasks: InfraScheduledTask[] = [];

  for (const task of rulesResult.selectedTasks) {
    const s = rcpspState.get(task.code);
    if (!s) continue;
    const baseCode = getBaseCode(task);
    const template = templateMap.get(baseCode);

    scheduledTasks.push({
      code:                  task.code,
      originalCode:          baseCode,
      phase:                 (template?.phase ?? task.phase) as string,
      name:                  task.name,
      fullName:              task.name,
      unit:                  (template?.unit ?? "") as string,
      taskCategory:          ((template?.taskCategory ?? "B") as "A" | "B"),
      estimatedQuantity:     s.quantity,
      quantityUnit:          (template?.unit ?? "") as string,
      baseDurationDays:      s.baseDuration,
      adjustedDurationDays:  s.adjustedDuration,
      finalDurationDays:     s.adjustedDuration,
      startDate:             dayNumberToDate(projectStart, s.startDay),
      endDate:               dayNumberToDate(projectStart, s.endDay),
      predecessors:          s.resolvedPreds,
      crew:                  template?.crew ?? [],
      monsoonImpactFactor:   template?.monsoonImpactFactor ?? 1.0,
      monsoonOverlapDays:    s.monsoonDays,
      monsoonAdjustedDays:   s.extraDays,
      earliestStart:         s.startDay,
      earliestFinish:        s.endDay,
      isCriticalPath:        task.isCriticalPath ?? false,
      totalFloat:            0,
      source:                "infra_library",
      isPerFloor:            false,
      isPerFlat:             false,
      contractorType:        (template as any)?.requiresSpecialistContractor
                               ? ((template as any)?.specialistType ?? "Specialist Contractor")
                               : "Main Contractor",
      regionalAdjustments: {
        labourCostIndex:      1.0,
        materialCostIndex:    1.0,
        productivityIndex:    1.0,
        monsoonMifMultiplier: 1.0,
      },
      // RCPSP allocation metadata — consumed by OR-Tools optimizer client
      actualUnits:  s.actualUnits,
      resourceType: s.resourceType,
      sectionId:    task.sectionId,
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
