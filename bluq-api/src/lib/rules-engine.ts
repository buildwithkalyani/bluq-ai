// =============================================================================
// BLUQ RULES ENGINE — Deterministic Task Selection
// =============================================================================
// This is the heart of the determinism architecture.
//
// Input:  ProjectParameters (from parameter-extractor.ts)
// Uses:   CORE_TASKS, ADDITIONAL_TASKS, REGIONAL_PARAMS, BUILDING_TYPES,
//         CONDITIONAL_RULES (all from task-library.ts)
// Output: SelectedTask[] — the exact tasks for this project
//
// GUARANTEE: Same ProjectParameters → Same tasks. Every time. No AI.
//
// Pipeline position:
//   parsers.ts → parameter-extractor.ts → THIS → duration-calculator.ts
//
// How it works:
//   Step 1: Start with all core tasks (isCore: true)
//   Step 2: Filter by building type (exclude inapplicable tasks)
//   Step 3: Apply conditional rules (IF soil == X → add/remove tasks)
//   Step 4: Apply building type mandatory tasks
//   Step 5: Apply regional additional tasks
//   Step 6: Expand per-floor tasks (SS, MW, etc. × number of floors)
//   Step 7: Validate — check mandatory phases, dependency integrity
//   Step 8: Apply regional parameter overrides (MIF, productivity, cost)
// =============================================================================

import {
    type TaskTemplate,
    type RegionCode,
    type Phase,
    type BuildingType,
    type Predecessor,
    type ContractorType,
    CORE_TASKS,
    ADDITIONAL_TASKS,
    ALL_TASKS,
    REGIONAL_PARAMS,
    BUILDING_TYPES,
    CONDITIONAL_RULES,
    getTask,
    getContractorType,
  } from "./task-library.js";
  
  import { type ProjectParameters } from "./parameter-extractor.js";
  
  // ---------------------------------------------------------------------------
  // TYPES
  // ---------------------------------------------------------------------------
  
  export interface SelectedTask {
    // From the library
    code: string;
    originalCode: string;         // before floor expansion (e.g., "SS-01")
    phase: Phase;
    name: string;
    unit: string;
  
    // Calculated by rules engine
    floorNumber?: number;          // which floor this task is for (if per-floor)
    floorLabel?: string;           // "Ground Floor", "1st Floor", etc.
    wingCode?: string;             // "WA", "WB", "T1" — set when project has multiple wings
    wingLabel?: string;            // "Wing A", "Tower 1" — human-readable wing name
    fullName: string;              // e.g., "Column reinforcement — Wing A 2nd Floor"
  
    // From library, potentially modified by regional params
    productivityRateMin: number;
    productivityRateMax: number;
    productivityUnit: string;
    monsoonImpactFactor: number;    // base MIF × regional multiplier
    crew: Array<{ role: string; count: number }>;
  
    // Dependencies — resolved with floor-aware codes
    predecessors: ResolvedPredecessor[];
  
    // Metadata
    isCodeRef: string[];
    dsrRef: string;
    safetyChecks: string[];
    remarks: string;
    source: "library" | "building_type" | "conditional_rule" | "regional";
    isPerFloor: boolean;
    isPerFlat: boolean;

    // Contractor assignment — used for Gantt grouping, filtering, and color coding
    contractorType: ContractorType;
  
    // Regional adjustments applied
    regionalAdjustments: {
      labourCostIndex: number;
      materialCostIndex: number;
      productivityIndex: number;
      monsoonMifMultiplier: number;
    };
  }
  
  export interface ResolvedPredecessor {
    taskCode: string;             // resolved code (e.g., "SS-09-F2" for floor 2)
    type: "FS" | "FF" | "SS" | "SF";
    lagDays: number;
  }
  
  export interface RulesEngineResult {
    tasks: SelectedTask[];
    summary: {
      totalTasks: number;
      coreTasks: number;
      conditionalTasks: number;
      buildingTypeTasks: number;
      regionalTasks: number;
      excludedTasks: number;
      floorsExpanded: number;
      phases: Record<string, number>;
    };
    rulesApplied: string[];        // which conditional rules fired
    warnings: string[];            // anything the PM should review
  }
  
  // ---------------------------------------------------------------------------
  // MAIN ENGINE
  // ---------------------------------------------------------------------------
  
  /**
   * Select tasks for a project based on its parameters.
   * This is the core deterministic function — no AI, no randomness.
   *
   * @param params - ProjectParameters from the parameter extractor
   * @returns RulesEngineResult with selected tasks and metadata
   */
  export function selectTasks(params: ProjectParameters): RulesEngineResult {
    const rulesApplied: string[] = [];
    const warnings: string[] = [];
    const regionParams = REGIONAL_PARAMS[params.regionCode];
    const buildingTypeConfig = BUILDING_TYPES[params.buildingType];
  
    if (!regionParams) {
      warnings.push(`Unknown region code "${params.regionCode}" — using Maharashtra (MH) defaults`);
    }
    if (!buildingTypeConfig) {
      warnings.push(`Unknown building type "${params.buildingType}" — using residential_g4 defaults`);
    }
  
    const region = regionParams || REGIONAL_PARAMS.MH;
    const buildingType = buildingTypeConfig || BUILDING_TYPES.residential_g4;
  
    // Track task codes: code → TaskTemplate
    const selectedCodes = new Map<string, { task: TaskTemplate; source: SelectedTask["source"] }>();
    const excludedCodes = new Set<string>();
  
    // =========================================================================
    // STEP 1: Start with all core tasks
    // =========================================================================
    for (const task of CORE_TASKS) {
      if (task.isCore) {
        selectedCodes.set(task.code, { task, source: "library" });
      }
    }
  
    // =========================================================================
    // STEP 2: Apply building type exclusions
    // =========================================================================
    for (const code of buildingType.excludedTaskCodes) {
      if (selectedCodes.has(code)) {
        selectedCodes.delete(code);
        excludedCodes.add(code);
      }
    }
  
    // Also check task-level building type exclusions
    for (const [code, entry] of selectedCodes) {
      const task = entry.task;
      if (task.excludedBuildingTypes?.includes(params.buildingType)) {
        selectedCodes.delete(code);
        excludedCodes.add(code);
      }
      if (task.applicableBuildingTypes && !task.applicableBuildingTypes.includes(params.buildingType)) {
        selectedCodes.delete(code);
        excludedCodes.add(code);
      }
    }
  
    // =========================================================================
    // STEP 3: Apply building type mandatory tasks
    // =========================================================================
    for (const code of buildingType.mandatoryTaskCodes) {
      const task = getTask(code);
      if (task && !excludedCodes.has(code)) {
        selectedCodes.set(code, { task, source: "building_type" });
        rulesApplied.push(`Building type "${buildingType.label}" → added mandatory task ${code}`);
      }
    }
  
    // Add building type additional tasks
    for (const code of buildingType.additionalTaskCodes) {
      const task = getTask(code);
      if (task && !excludedCodes.has(code)) {
        selectedCodes.set(code, { task, source: "building_type" });
      }
    }
  
    // =========================================================================
    // STEP 4: Apply conditional rules (sorted by priority)
    // =========================================================================
    const sortedRules = [...CONDITIONAL_RULES].sort((a, b) => a.priority - b.priority);
  
    for (const rule of sortedRules) {
      const conditionMet = evaluateCondition(rule.condition, params);
  
      if (conditionMet) {
        if (rule.action === "add") {
          for (const code of rule.taskCodes) {
            const task = getTask(code);
            if (task && !excludedCodes.has(code)) {
              selectedCodes.set(code, { task, source: "conditional_rule" });
            }
          }
          rulesApplied.push(`Rule ${rule.id}: ${rule.description}`);
        } else if (rule.action === "remove") {
          for (const code of rule.taskCodes) {
            selectedCodes.delete(code);
            excludedCodes.add(code);
          }
          rulesApplied.push(`Rule ${rule.id}: ${rule.description} (removed)`);
        }
      }
    }
  
    // Also evaluate task-level conditions for non-core tasks
    for (const task of [...CORE_TASKS, ...ADDITIONAL_TASKS]) {
      if (task.isCore || selectedCodes.has(task.code) || excludedCodes.has(task.code)) continue;
  
      if (task.conditions) {
        const allConditionsMet = task.conditions.every(c => evaluateCondition(c, params));
        if (allConditionsMet) {
          selectedCodes.set(task.code, { task, source: "conditional_rule" });
          rulesApplied.push(`Task condition: ${task.code} "${task.name}" — conditions met`);
        }
      }
    }
  
    // =========================================================================
    // STEP 5: Apply regional additional tasks
    // =========================================================================
    if (region.additionalTaskCodes) {
      for (const code of region.additionalTaskCodes) {
        const task = getTask(code);
        if (task && !excludedCodes.has(code)) {
          selectedCodes.set(code, { task, source: "regional" });
          rulesApplied.push(`Regional (${region.name}) → added task ${code}`);
        }
      }
    }
  
    // =========================================================================
    // STEP 6: Expand per-floor and per-flat tasks
    // =========================================================================
    const expandedTasks: SelectedTask[] = [];
    let floorsExpanded = 0;
  
    // Count sources for summary
    let coreTasks = 0;
    let conditionalTasks = 0;
    let buildingTypeTasks = 0;
    let regionalTasks = 0;
  
    for (const [code, entry] of selectedCodes) {
      const { task, source } = entry;
  
      if (task.perFloor) {
        if (params.wings && params.wings.length >= 2) {
          // Multi-wing expansion: SS-01 → SS-01-WA-F0, SS-01-WA-F1, SS-01-WB-F0, ...
          for (const wing of params.wings) {
            const wingCode = nameToWingCode(wing.name);
            const wingTotalFloors = wing.floors + 1; // +1 for ground floor
            for (let floor = 0; floor < wingTotalFloors; floor++) {
              const floorLabel = getFloorLabel(floor);
              const predecessors = resolveFloorPredecessors(
                task.predecessors, floor, wing.floors, wingCode
              );
              expandedTasks.push(
                buildSelectedTask(task, {
                  code: `${code}-W${wingCode}-F${floor}`,
                  originalCode: code,
                  floorNumber: floor,
                  floorLabel,
                  wingCode,
                  wingLabel: wing.name,
                  fullName: `${task.name} — ${wing.name} ${floorLabel}`,
                  predecessors,
                  source,
                  region,
                })
              );
              floorsExpanded++;
            }
          }
        } else {
          // Single-wing: existing behaviour (codes stay SS-01-F0, SS-01-F1, ...)
          const totalFloors = params.floors + 1; // +1 for ground floor
          for (let floor = 0; floor < totalFloors; floor++) {
            const floorLabel = getFloorLabel(floor);
            const predecessors = resolveFloorPredecessors(
              task.predecessors, floor, params.floors
            );
            expandedTasks.push(
              buildSelectedTask(task, {
                code: `${code}-F${floor}`,
                originalCode: code,
                floorNumber: floor,
                floorLabel,
                fullName: `${task.name} — ${floorLabel}`,
                predecessors,
                source,
                region,
              })
            );
            floorsExpanded++;
          }
        }
      } else if (task.perFlat) {
        // Per-flat tasks get a single entry — duration calculator will multiply
        expandedTasks.push(
          buildSelectedTask(task, {
            code,
            originalCode: code,
            fullName: `${task.name} (×${params.totalUnits} flats)`,
            predecessors: resolveSimplePredecessors(task.predecessors, selectedCodes, params.floors, params.wings ?? undefined),
            source,
            region,
          })
        );
      } else {
        // Regular task — single instance
        expandedTasks.push(
          buildSelectedTask(task, {
            code,
            originalCode: code,
            fullName: task.name,
            predecessors: resolveSimplePredecessors(task.predecessors, selectedCodes, params.floors, params.wings ?? undefined),
            source,
            region,
          })
        );
      }
  
      // Count by source
      switch (source) {
        case "library": coreTasks++; break;
        case "conditional_rule": conditionalTasks++; break;
        case "building_type": buildingTypeTasks++; break;
        case "regional": regionalTasks++; break;
      }
    }
  
    // =========================================================================
    // STEP 7: Validate — check mandatory phases and dependencies
    // =========================================================================
    const presentPhases = new Set(expandedTasks.map(t => t.phase));
    const mandatoryPhases: Phase[] = [
      "site_preparation", "foundation", "plinth", "superstructure",
      "approvals_handover",
    ];
  
    for (const phase of mandatoryPhases) {
      if (!presentPhases.has(phase)) {
        warnings.push(`Missing mandatory phase: ${phase}. Every building needs this.`);
      }
    }
  
    // Check for orphan dependencies (predecessor not in selected tasks)
    const allTaskCodes = new Set(expandedTasks.map(t => t.code));
    for (const task of expandedTasks) {
      for (const pred of task.predecessors) {
        if (!allTaskCodes.has(pred.taskCode) && pred.taskCode !== "") {
          // Don't warn for floor-expanded predecessor references that might not exist
          // (e.g., SS-09-F5 when building only has 4 floors)
          if (!pred.taskCode.includes("-F")) {
            warnings.push(
              `Task ${task.code} depends on ${pred.taskCode} which is not in the selected tasks`
            );
          }
        }
      }
    }
  
    // =========================================================================
    // STEP 8: Build phase summary
    // =========================================================================
    const phases: Record<string, number> = {};
    for (const task of expandedTasks) {
      phases[task.phase] = (phases[task.phase] || 0) + 1;
    }
  
    return {
      tasks: expandedTasks,
      summary: {
        totalTasks: expandedTasks.length,
        coreTasks,
        conditionalTasks,
        buildingTypeTasks,
        regionalTasks,
        excludedTasks: excludedCodes.size,
        floorsExpanded,
        phases,
      },
      rulesApplied,
      warnings,
    };
  }
  
  
  // ---------------------------------------------------------------------------
  // CONDITION EVALUATOR
  // ---------------------------------------------------------------------------
  
  /**
   * Evaluate a single condition against project parameters.
   * This is deterministic — same params + same condition = same result.
   */
  function evaluateCondition(
    condition: { field: string; operator: string; value: string | number | boolean },
    params: ProjectParameters
  ): boolean {
    const fieldValue = getParamValue(params, condition.field);
  
    if (fieldValue === undefined || fieldValue === null) {
      return false; // unknown fields never match
    }
  
    switch (condition.operator) {
      case "==":
        return fieldValue === condition.value;
      case "!=":
        return fieldValue !== condition.value;
      case ">=":
        return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
      case "<=":
        return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
      case ">":
        return typeof fieldValue === "number" && fieldValue > (condition.value as number);
      case "<":
        return typeof fieldValue === "number" && fieldValue < (condition.value as number);
      case "includes":
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return String(fieldValue).includes(String(condition.value));
      case "not_includes":
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(condition.value);
        }
        return !String(fieldValue).includes(String(condition.value));
      default:
        return false;
    }
  }
  
  /**
   * Get a parameter value by field name from ProjectParameters.
   * Supports nested access for common fields.
   */
  function getParamValue(params: ProjectParameters, field: string): any {
    const fieldMap: Record<string, any> = {
      buildingType: params.buildingType,
      floors: params.floors,
      basements: params.basements,
      buildingHeight: params.buildingHeight,
      totalArea: params.totalArea,
      plotArea: params.plotArea,
      totalUnits: params.totalUnits,
      regionCode: params.regionCode,
      soilType: params.soilType,
      foundationType: params.foundationType,
      structuralSystem: params.structuralSystem,
      lifts: params.lifts,
      hvac: params.hvac,
      centralAC: params.centralAC,
      dgSet: params.dgSet,
      solar: params.solar,
      fireProtection: params.fireProtection,
      pool: params.pool,
      podiumParking: params.podiumParking,
      basementParking: params.basementParking,
      stilts: params.stilts,
      terrace: params.terrace,
      rainwaterHarvesting: params.rainwaterHarvesting,
      stp: params.stp,
      falseCeiling: params.falseCeiling,
      facadeType: params.facadeType,
      undergroundTank: params.undergroundTank,
      waterTableDepth: params.waterTableDepth,
      reraApplicable: REGIONAL_PARAMS[params.regionCode]?.reraApplicable ?? true,
    };
  
    return fieldMap[field];
  }
  
  
  // ---------------------------------------------------------------------------
  // FLOOR EXPANSION HELPERS
  // ---------------------------------------------------------------------------
  
  function getFloorLabel(floor: number): string {
    if (floor === 0) return "Ground Floor";
    if (floor === 1) return "1st Floor";
    if (floor === 2) return "2nd Floor";
    if (floor === 3) return "3rd Floor";
    return `${floor}th Floor`;
  }

  /**
   * Convert a wing name to a short alphanumeric code used in task codes.
   * "Wing A" → "WA", "Tower 1" → "T1", "Block B" → "WB", "Phase 2" → "P2"
   */
  function nameToWingCode(name: string): string {
    const n = name.trim();
    // "Wing X" or "Block X" → "W" + X (strip spaces)
    const wingMatch = n.match(/^(?:wing|block)\s*(.+)$/i);
    if (wingMatch) return `W${wingMatch[1].replace(/\s+/g, "").toUpperCase()}`;
    // "Tower X" → "T" + X
    const towerMatch = n.match(/^tower\s*(.+)$/i);
    if (towerMatch) return `T${towerMatch[1].replace(/\s+/g, "").toUpperCase()}`;
    // "Phase X" → "P" + X
    const phaseMatch = n.match(/^phase\s*(.+)$/i);
    if (phaseMatch) return `P${phaseMatch[1].replace(/\s+/g, "").toUpperCase()}`;
    // Single letter/number → "W" + it
    if (/^[A-Za-z0-9]$/.test(n)) return `W${n.toUpperCase()}`;
    // Fallback: take first char of each word, prefix with W
    const initials = n.split(/\s+/).map(w => w[0]).join("").toUpperCase();
    return `W${initials}`;
  }
  
  /**
   * Resolve predecessors for floor-expanded tasks.
   *
   * Logic:
   *   - "FN-05 (for ground floor)" → only applies to floor 0
   *   - "SS-09 (for upper floors)" → SS-09-F{floor-1} (previous floor's curing)
   *   - "SS-11 (per floor)" → SS-11-F{same floor}
   *   - Regular predecessor → use as-is
   */
  function resolveFloorPredecessors(
    predecessors: Predecessor[],
    currentFloor: number,
    totalUpperFloors: number,
    wingCode?: string
  ): ResolvedPredecessor[] {
    const resolved: ResolvedPredecessor[] = [];

    // Helper: build a floor-aware task code, including wing prefix when present.
    // Single-wing: "SS-01-F2"   Multi-wing: "SS-01-WA-F2"
    const wfc = (base: string, f: number) =>
      wingCode ? `${base}-W${wingCode}-F${f}` : `${base}-F${f}`;

    for (const pred of predecessors) {
      const predTask = getTask(pred.taskCode);
      if (!predTask) continue;

      if (predTask.perFloor) {
        // Predecessor is also a per-floor task
        if (pred.note?.includes("for ground floor") && currentFloor === 0) {
          // Ground floor depends on foundation task (non-floor-expanded)
          resolved.push({
            taskCode: pred.taskCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        } else if (pred.note?.includes("for upper floors")) {
          // Upper floors wait for previous floor's completion.
          // Ground floor (currentFloor === 0) skips this — it has no previous floor.
          // Without this guard the default branch would add SS-09-F0 as a predecessor
          // of SS-01-F0, creating a cycle that breaks the entire CPM forward pass.
          if (currentFloor > 0) {
            resolved.push({
              taskCode: wfc(pred.taskCode, currentFloor - 1),
              type: pred.type,
              lagDays: pred.lagDays,
            });
          }
        } else if (pred.note?.includes("per floor") || pred.note?.includes("same floor")) {
          // Same floor dependency
          resolved.push({
            taskCode: wfc(pred.taskCode, currentFloor),
            type: pred.type,
            lagDays: pred.lagDays,
          });
        } else {
          // Default: same floor
          resolved.push({
            taskCode: wfc(pred.taskCode, currentFloor),
            type: pred.type,
            lagDays: pred.lagDays,
          });
        }
      } else {
        // Predecessor is NOT a per-floor task (e.g., FN-05 for ground floor SS-01)
        if (pred.note?.includes("for ground floor") || pred.note?.includes("GF")) {
          if (currentFloor === 0) {
            resolved.push({
              taskCode: pred.taskCode,
              type: pred.type,
              lagDays: pred.lagDays,
            });
          }
          // Upper floors skip foundation predecessors — they use previous floor's tasks
        } else if (pred.note?.includes("for upper floors")) {
          if (currentFloor > 0) {
            resolved.push({
              taskCode: pred.taskCode,
              type: pred.type,
              lagDays: pred.lagDays,
            });
          }
        } else if (pred.note?.includes("all floors")) {
          // Depends on this task being complete for ALL floors (e.g., lift installation)
          // Use the topmost floor's version
          const topFloorCode = predTask.perFloor
            ? `${pred.taskCode}-F${totalUpperFloors}`
            : pred.taskCode;
          resolved.push({
            taskCode: topFloorCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        } else if (pred.note?.includes("terrace")) {
          // Depends on terrace slab (topmost floor)
          resolved.push({
            taskCode: predTask.perFloor
              ? `${pred.taskCode}-F${totalUpperFloors}`
              : pred.taskCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        } else {
          // Regular non-floor predecessor — use as-is
          resolved.push({
            taskCode: pred.taskCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        }
      }
    }
  
    // Ground floor with no resolved predecessors from floor logic:
    // SS-01 ground floor needs FN-05 as predecessor
    if (currentFloor === 0 && resolved.length === 0) {
      // Check if the original task had any ground-floor specific predecessor
      for (const pred of predecessors) {
        if (pred.note?.includes("for ground floor") || pred.note?.includes("GF")) {
          resolved.push({
            taskCode: pred.taskCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        }
      }
    }
  
    // Upper floors with no resolved predecessors:
    // They should depend on previous floor's completion
    if (currentFloor > 0 && resolved.length === 0) {
      for (const pred of predecessors) {
        if (pred.note?.includes("for upper floors") || pred.note?.includes("upper")) {
          const predTask2 = getTask(pred.taskCode);
          resolved.push({
            taskCode: predTask2?.perFloor
              ? `${pred.taskCode}-F${currentFloor - 1}`
              : pred.taskCode,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        }
      }
    }
  
    return resolved;
  }
  
  /**
   * Resolve predecessors for non-floor-expanded tasks.
   *
   * When a non-perFloor task references a perFloor predecessor, we resolve it to
   * the appropriate floor-specific code:
   *   - note includes "GF" or "ground floor" → F0
   *   - all other notes (terrace, all floors, all floors done, etc.) → F{topFloor}
   * This matches the intent of building-level tasks that depend on the whole
   * structure being up before they can start.
   */
  function resolveSimplePredecessors(
    predecessors: Predecessor[],
    selectedCodes: Map<string, any>,
    totalUpperFloors: number,
    wings?: Array<{ name: string; floors: number }>
  ): ResolvedPredecessor[] {
    const resolved: ResolvedPredecessor[] = [];

    for (const pred of predecessors) {
      if (pred.taskCode === "") continue;

      const predTask = getTask(pred.taskCode);
      if (!predTask) continue;

      if (predTask.perFloor) {
        // This non-perFloor task depends on a perFloor task — resolve to the right floor.
        const note = pred.note ?? "";
        const isGroundFloor = note.includes("GF") || note.toLowerCase().includes("ground floor");

        if (wings && wings.length >= 2) {
          // Multi-wing: add one predecessor per wing pointing to that wing's target floor.
          for (const wing of wings) {
            const wc = nameToWingCode(wing.name);
            const targetFloor = isGroundFloor ? 0 : wing.floors;
            resolved.push({
              taskCode: `${pred.taskCode}-W${wc}-F${targetFloor}`,
              type: pred.type,
              lagDays: pred.lagDays,
            });
          }
        } else {
          // Single-wing: original behaviour
          const targetFloor = isGroundFloor ? 0 : totalUpperFloors;
          resolved.push({
            taskCode: `${pred.taskCode}-F${targetFloor}`,
            type: pred.type,
            lagDays: pred.lagDays,
          });
        }
      } else if (selectedCodes.has(pred.taskCode)) {
        resolved.push({
          taskCode: pred.taskCode,
          type: pred.type,
          lagDays: pred.lagDays,
        });
      }
    }

    return resolved;
  }
  
  
  // ---------------------------------------------------------------------------
  // SELECTED TASK BUILDER
  // ---------------------------------------------------------------------------
  
  function buildSelectedTask(
    template: TaskTemplate,
    options: {
      code: string;
      originalCode: string;
      fullName: string;
      predecessors: ResolvedPredecessor[];
      source: SelectedTask["source"];
      region: typeof REGIONAL_PARAMS[RegionCode];
      floorNumber?: number;
      floorLabel?: string;
      wingCode?: string;
      wingLabel?: string;
    }
  ): SelectedTask {
    const { region } = options;
  
    // Apply regional MIF multiplier to the task's base MIF
    const adjustedMif = template.monsoonImpactFactor * region.monsoonMifMultiplier;
  
    return {
      code: options.code,
      originalCode: options.originalCode,
      phase: template.phase,
      name: template.name,
      unit: template.unit,
      floorNumber: options.floorNumber,
      floorLabel: options.floorLabel,
      wingCode: options.wingCode,
      wingLabel: options.wingLabel,
      fullName: options.fullName,
  
      productivityRateMin: template.productivityRate.min,
      productivityRateMax: template.productivityRate.max,
      productivityUnit: template.productivityRate.unit,
      monsoonImpactFactor: Math.round(adjustedMif * 100) / 100,
      crew: template.crew.map(c => ({ ...c })),
  
      predecessors: options.predecessors,
  
      isCodeRef: template.isCodeRef,
      dsrRef: template.dsrRef,
      safetyChecks: template.safetyChecks,
      remarks: template.remarks,
      source: options.source,
      isPerFloor: template.perFloor || false,
      isPerFlat: template.perFlat || false,
      contractorType: getContractorType(options.originalCode),

      regionalAdjustments: {
        labourCostIndex: region.labourCostIndex,
        materialCostIndex: region.materialCostIndex,
        productivityIndex: region.productivityIndex,
        monsoonMifMultiplier: region.monsoonMifMultiplier,
      },
    };
  }
  
  
  // ---------------------------------------------------------------------------
  // CONVENIENCE: Print a summary of selected tasks (for debugging)
  // ---------------------------------------------------------------------------
  
  export function printTaskSummary(result: RulesEngineResult): string {
    const lines: string[] = [];
  
    lines.push(`=== RULES ENGINE RESULT ===`);
    lines.push(`Total tasks: ${result.summary.totalTasks}`);
    lines.push(`  Core: ${result.summary.coreTasks} | Conditional: ${result.summary.conditionalTasks} | Building type: ${result.summary.buildingTypeTasks} | Regional: ${result.summary.regionalTasks}`);
    lines.push(`  Excluded: ${result.summary.excludedTasks} | Floor-expanded: ${result.summary.floorsExpanded}`);
    lines.push(``);
  
    lines.push(`Phases:`);
    for (const [phase, count] of Object.entries(result.summary.phases)) {
      lines.push(`  ${phase}: ${count} tasks`);
    }
    lines.push(``);
  
    lines.push(`Rules applied (${result.rulesApplied.length}):`);
    for (const rule of result.rulesApplied) {
      lines.push(`  ✓ ${rule}`);
    }
  
    if (result.warnings.length > 0) {
      lines.push(``);
      lines.push(`Warnings (${result.warnings.length}):`);
      for (const warn of result.warnings) {
        lines.push(`  ⚠ ${warn}`);
      }
    }
  
    return lines.join("\n");
  }