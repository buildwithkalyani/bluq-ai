import time
from typing import Optional

from fastapi import FastAPI
from ortools.sat.python import cp_model
from pydantic import BaseModel

app = FastAPI(title="BLUQ RCPSP Optimizer", version="1.0.0")


# ─── Request / Response models ────────────────────────────────────────────────


class Predecessor(BaseModel):
    code: str
    lag: int = 0


class Task(BaseModel):
    code: str
    duration: int                    # calendar days (from list scheduler)
    units_required: int              # resource units assigned by list scheduler
    resource_type: Optional[str] = None
    zone_id: Optional[str] = None
    predecessors: list[Predecessor] = []


class CapacityWindow(BaseModel):
    from_day: int
    to_day: int
    capacity: int


class ResourcePool(BaseModel):
    type: str
    windows: list[CapacityWindow]


class Zone(BaseModel):
    id: str
    max_concurrent: int              # total resource units allowed in zone simultaneously


class OptimizeRequest(BaseModel):
    tasks: list[Task]
    resource_pools: list[ResourcePool]
    zones: list[Zone]
    horizon: int                     # upper bound from list scheduler (days)


class TaskResult(BaseModel):
    code: str
    start_day: int
    end_day: int


class OptimizeResponse(BaseModel):
    status: str                      # optimal | feasible | infeasible | timeout
    tasks: list[TaskResult]
    total_duration: int
    solve_time_ms: int


# ─── Solver ───────────────────────────────────────────────────────────────────


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    model = cp_model.CpModel()

    n = len(req.tasks)
    task_index = {t.code: i for i, t in enumerate(req.tasks)}

    # Give the solver 2× list-scheduler horizon as a safe upper bound.
    horizon = req.horizon * 2

    # ── Decision variables ────────────────────────────────────────────────────
    starts    = [model.NewIntVar(0, horizon, f"s_{t.code}") for t in req.tasks]
    ends      = [model.NewIntVar(0, horizon, f"e_{t.code}") for t in req.tasks]
    intervals = [
        model.NewIntervalVar(starts[i], req.tasks[i].duration, ends[i], f"iv_{req.tasks[i].code}")
        for i in range(n)
    ]

    # ── Precedence constraints ────────────────────────────────────────────────
    for i, task in enumerate(req.tasks):
        for pred in task.predecessors:
            j = task_index.get(pred.code)
            if j is not None:
                model.Add(starts[i] >= ends[j] + pred.lag)

    # ── Resource pool constraints ─────────────────────────────────────────────
    # Time-varying capacity is modelled by adding "blocker" intervals that consume
    # the difference between peak capacity and the window's actual capacity.
    # This converts a variable-capacity cumulative into a fixed-capacity one.
    pool_map = {p.type: p for p in req.resource_pools}

    by_resource: dict[str, list[int]] = {}
    for i, task in enumerate(req.tasks):
        if task.resource_type:
            by_resource.setdefault(task.resource_type, []).append(i)

    for rtype, task_indices in by_resource.items():
        pool = pool_map.get(rtype)
        if not pool or not pool.windows:
            continue

        max_cap = max(w.capacity for w in pool.windows)

        task_ivs     = [intervals[i] for i in task_indices]
        task_demands = [req.tasks[i].units_required for i in task_indices]

        blocker_ivs: list = []
        blocker_demands: list[int] = []
        for w in pool.windows:
            gap = max_cap - w.capacity
            if gap > 0 and w.to_day > w.from_day:
                dur = w.to_day - w.from_day
                s   = model.NewConstant(w.from_day)
                e   = model.NewConstant(w.to_day)
                iv  = model.NewIntervalVar(s, dur, e, f"blk_{rtype}_{w.from_day}")
                blocker_ivs.append(iv)
                blocker_demands.append(gap)

        model.AddCumulative(task_ivs + blocker_ivs, task_demands + blocker_demands, max_cap)

    # ── Zone capacity constraints ─────────────────────────────────────────────
    zone_map = {z.id: z.max_concurrent for z in req.zones}

    by_zone: dict[str, list[int]] = {}
    for i, task in enumerate(req.tasks):
        if task.zone_id:
            by_zone.setdefault(task.zone_id, []).append(i)

    for zone_id, task_indices in by_zone.items():
        max_conc = zone_map.get(zone_id, 1)
        zone_ivs     = [intervals[i] for i in task_indices]
        zone_demands = [req.tasks[i].units_required for i in task_indices]
        model.AddCumulative(zone_ivs, zone_demands, max_conc)

    # ── Objective: minimize project makespan ──────────────────────────────────
    makespan = model.NewIntVar(0, horizon, "makespan")
    model.AddMaxEquality(makespan, ends)
    model.Minimize(makespan)

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_workers = 4      # parallel search threads
    solver.parameters.log_search_progress = False

    t0 = time.monotonic()
    status_code = solver.Solve(model)
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    STATUS = {
        cp_model.OPTIMAL:    "optimal",
        cp_model.FEASIBLE:   "feasible",
        cp_model.INFEASIBLE: "infeasible",
        cp_model.UNKNOWN:    "timeout",
    }
    status_str = STATUS.get(status_code, "unknown")

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return OptimizeResponse(
            status=status_str,
            tasks=[],
            total_duration=0,
            solve_time_ms=elapsed_ms,
        )

    results = [
        TaskResult(
            code=req.tasks[i].code,
            start_day=solver.Value(starts[i]),
            end_day=solver.Value(ends[i]),
        )
        for i in range(n)
    ]

    return OptimizeResponse(
        status=status_str,
        tasks=results,
        total_duration=solver.Value(makespan),
        solve_time_ms=elapsed_ms,
    )


@app.get("/health")
def health():
    return {"status": "ok"}
