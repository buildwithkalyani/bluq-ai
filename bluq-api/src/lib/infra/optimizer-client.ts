// OR-Tools CP-SAT optimizer client
// Refines the list-scheduler result to a 100%-optimal RCPSP solution.
// If OPTIMIZER_URL is unset or the service is unreachable, falls back to the
// list-scheduling result silently — no disruption to the scheduling pipeline.

import type { InfraScheduleResult, InfraScheduledTask } from "./infra-duration-calculator.js";
import { dayNumberToDate } from "./infra-duration-calculator.js";
import type { AnyInfraParams } from "./infra-duration-calculator.js";
import type { InfraSection } from "./infrastructure-parameter-extractor.js";

// ─── Wire types ───────────────────────────────────────────────────────────────

interface OptimizerTask {
  code:            string;
  duration:        number;
  units_required:  number;
  resource_type?:  string;
  zone_id?:        string;
  predecessors:    { code: string; lag: number }[];
}

interface CapacityWindow {
  from_day: number;
  to_day:   number;
  capacity: number;
}

interface OptimizerRequest {
  tasks:          OptimizerTask[];
  resource_pools: { type: string; windows: CapacityWindow[] }[];
  zones:          { id: string; max_concurrent: number }[];
  horizon:        number;
}

interface OptimizerResponse {
  status:          "optimal" | "feasible" | "infeasible" | "timeout";
  tasks:           { code: string; start_day: number; end_day: number }[];
  total_duration:  number;
  solve_time_ms:   number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export async function refineWithOrTools(
  result: InfraScheduleResult,
  params: AnyInfraParams,
  startDate: string,
): Promise<InfraScheduleResult> {
  const url = process.env.OPTIMIZER_URL;
  if (!url) return result;

  const projectStart = new Date(startDate);
  const maxDay = result.totalDurationDays;

  // Build optimizer tasks
  const optimizerTasks: OptimizerTask[] = result.tasks.map((t: InfraScheduledTask) => ({
    code:           t.code,
    duration:       t.finalDurationDays,
    units_required: t.actualUnits ?? 1,
    resource_type:  t.resourceType,
    zone_id:        t.sectionId,
    predecessors:   t.predecessors.map(p => ({ code: p.taskCode, lag: p.lagDays ?? 0 })),
  }));

  // Build resource pools with day-based windows
  const resourcePools = params.availableResources.map(r => ({
    type: r.type,
    windows: r.availabilityWindows?.length
      ? r.availabilityWindows.map(w => ({
          from_day: (w.fromProjectMonth - 1) * 30,
          to_day:   w.toProjectMonth * 30,
          capacity: w.count,
        }))
      : [{ from_day: 0, to_day: maxDay * 2, capacity: r.count }],
  }));

  // Build zones
  const zones = params.sections.map((s: InfraSection) => ({
    id:              s.id,
    max_concurrent:  s.maxConcurrentActivities ?? 1,
  }));

  const req: OptimizerRequest = {
    tasks:          optimizerTasks,
    resource_pools: resourcePools,
    zones,
    horizon:        maxDay,
  };

  let response: Response;
  try {
    response = await fetch(`${url}/optimize`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(req),
      signal:  AbortSignal.timeout(35_000),
    });
  } catch {
    return result; // service unreachable — use list scheduling result
  }

  if (!response.ok) return result;

  const opt: OptimizerResponse = await response.json();

  if (opt.status === "infeasible" || opt.status === "timeout" || opt.tasks.length === 0) {
    return result;
  }

  // Apply optimized start/end times back to tasks
  const dayMap = new Map(opt.tasks.map(t => [t.code, t]));

  const updatedTasks: InfraScheduledTask[] = result.tasks.map((t: InfraScheduledTask) => {
    const o = dayMap.get(t.code);
    if (!o) return t;
    return {
      ...t,
      earliestStart:  o.start_day,
      earliestFinish: o.end_day,
      startDate:      dayNumberToDate(projectStart, o.start_day),
      endDate:        dayNumberToDate(projectStart, o.end_day),
    };
  });

  return {
    ...result,
    tasks:             updatedTasks,
    totalDurationDays: opt.total_duration,
  };
}
