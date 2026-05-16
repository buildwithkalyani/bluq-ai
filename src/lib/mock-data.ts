// ═══════════════════════════════════════════════════════════════
// MOCK DATA — matches the exact shape Kalyani's API will return.
// When backend is ready, replace each export with a fetch call.
// Example:
//   BEFORE: export const getProjects = () => PROJECTS;
//   AFTER:  export const getProjects = () => fetch('/api/projects').then(r => r.json());
// ═══════════════════════════════════════════════════════════════

export type ProjectStatus = "completed" | "inProgress" | "runningLate" | "delayed" | "notStarted";

export const STATUS_CONFIG: Record<ProjectStatus, { color: string; bg: string; label: string }> = {
  completed:   { color: "#059669", bg: "#ECFDF5", label: "Completed" },
  inProgress:  { color: "#2563EB", bg: "#EFF6FF", label: "In Progress" },
  runningLate: { color: "#D97706", bg: "#FFFBEB", label: "Running Late" },
  delayed:     { color: "#DC2626", bg: "#FEF2F2", label: "Delayed" },
  notStarted:  { color: "#94A3B8", bg: "#F8FAFC", label: "Not Started" },
};

// ─── PROJECTS ────────────────────────────────────────────────
export interface Project {
  id: number;
  name: string;
  code: string;
  pct: number;
  status: ProjectStatus;
  tasks: number;
  tasksDone: number;
  workers: number;
  issues: number;
  stage: string;
  startDate: string;
  endDate: string;
  address: string;
}

const PROJECTS: Project[] = [
  { id: 0, name: "Al Nakheel Tower",   code: "ANT-2026-001",  pct: 42, status: "runningLate", tasks: 24, tasksDone: 10, workers: 30, issues: 3, stage: "Foundation",  startDate: "Mar 1, 2026",   endDate: "Sep 30, 2026", address: "Dubai Marina, Dubai" },
  { id: 1, name: "Orchid Poorva",       code: "OP-2026-002",   pct: 67, status: "inProgress",  tasks: 18, tasksDone: 12, workers: 28, issues: 1, stage: "Structure",   startDate: "Jan 15, 2026",  endDate: "Nov 15, 2026", address: "JBR, Dubai" },
  { id: 2, name: "Palm Residences",    code: "PR-2026-003",   pct: 91, status: "inProgress",  tasks: 12, tasksDone: 11, workers: 15, issues: 0, stage: "Finishing",   startDate: "Sep 1, 2025",   endDate: "Apr 30, 2026", address: "Palm Jumeirah, Dubai" },
  { id: 3, name: "Creek Office Park",  code: "COP-2026-004",  pct: 15, status: "delayed",     tasks: 30, tasksDone: 4,  workers: 22, issues: 4, stage: "Foundation",  startDate: "Feb 10, 2026",  endDate: "Dec 20, 2026", address: "Creek Harbour, Dubai" },
];

export const getProjects = (): Promise<Project[]> => Promise.resolve(PROJECTS);

// ─── SCHEDULE TASKS ──────────────────────────────────────────
export interface ScheduleTask {
  id: string;
  name: string;
  pct: number;
  status: ProjectStatus;
  critical: boolean;
  group: string;
  startDate: string;
  endDate: string;
  duration: string;
  contractor: string;
  delay: string | null;
  space: string;
  photos: string[];
  phase: string;
  milestone?: boolean;
  parentTaskId?: string;       // sub-task parent
  baselineStart?: string;      // planned start for baseline comparison
  baselineEnd?: string;        // planned end for baseline comparison
  // Gantt positioning (will come from API calculated)
  left: number;
  width: number;
  projectId: number;
}

export interface TaskDependency {
  from: string;
  to: string;
  type: "FS" | "SS" | "FF" | "SF";
  label: string;
}

const SCHEDULE_TASKS: ScheduleTask[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────
  // Foundation phase
  { id: "foundation",        projectId: 0, name: "Foundation Works",          left: 5,  width: 42, pct: 75, status: "runningLate", critical: true,  group: "rajesh", startDate: "2026-04-01", endDate: "2026-04-30", duration: "22d", baselineStart: "2025-03-01", baselineEnd: "2025-03-19", contractor: "Rajesh Kumar", delay: "3d late", space: "Zone A — Ground",   phase: "Foundation", photos: [] },
  { id: "foundation_excav",  projectId: 0, name: "Excavation",                left: 0,  width: 0,  pct: 100,status: "completed",   critical: false, group: "rajesh", startDate: "2025-03-01", endDate: "2025-03-05", duration: "4d",  baselineStart: "2025-03-01", baselineEnd: "2025-03-05", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — Ground",   phase: "Foundation", parentTaskId: "foundation", photos: [] },
  { id: "foundation_pour",   projectId: 0, name: "Concrete Pour",             left: 0,  width: 0,  pct: 80, status: "runningLate", critical: true,  group: "rajesh", startDate: "2025-03-06", endDate: "2025-03-18", duration: "12d", baselineStart: "2025-03-06", baselineEnd: "2025-03-15", contractor: "Rajesh Kumar", delay: "3d late", space: "Zone A — Ground",   phase: "Foundation", parentTaskId: "foundation", photos: [] },
  { id: "foundation_cure",   projectId: 0, name: "Curing",                    left: 0,  width: 0,  pct: 20, status: "inProgress",  critical: false, group: "rajesh", startDate: "2025-03-19", endDate: "2025-03-22", duration: "3d",  baselineStart: "2025-03-16", baselineEnd: "2025-03-19", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — Ground",   phase: "Foundation", parentTaskId: "foundation", photos: [] },
  { id: "rebar",             projectId: 0, name: "Rebar Installation",        left: 28, width: 30, pct: 60, status: "inProgress",  critical: false, group: "rajesh", startDate: "2025-03-08", endDate: "2025-03-29", duration: "21d", baselineStart: "2025-03-08", baselineEnd: "2025-03-29", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — L1",       phase: "Foundation", photos: [] },
  { id: "waterproofing",     projectId: 0, name: "Waterproofing",             left: 48, width: 28, pct: 30, status: "delayed",     critical: true,  group: "ahmed",  startDate: "2025-03-05", endDate: "2025-03-20", duration: "16d", baselineStart: "2025-03-05", baselineEnd: "2025-03-12", contractor: "Ahmed Hassan", delay: "7d late", space: "Zone A — Basement",  phase: "Foundation", photos: [] },
  { id: "waterproof_primer", projectId: 0, name: "Primer Application",        left: 0,  width: 0,  pct: 60, status: "inProgress",  critical: false, group: "ahmed",  startDate: "2025-03-05", endDate: "2025-03-10", duration: "5d",  baselineStart: "2025-03-05", baselineEnd: "2025-03-08", contractor: "Ahmed Hassan", delay: null,      space: "Zone A — Basement",  phase: "Foundation", parentTaskId: "waterproofing", photos: [] },
  { id: "waterproof_membrane",projectId:0, name: "Membrane Installation",     left: 0,  width: 0,  pct: 0,  status: "delayed",     critical: true,  group: "ahmed",  startDate: "2025-03-14", endDate: "2025-03-20", duration: "7d",  baselineStart: "2025-03-09", baselineEnd: "2025-03-12", contractor: "Ahmed Hassan", delay: "7d late", space: "Zone A — Basement",  phase: "Foundation", parentTaskId: "waterproofing", photos: [] },
  // Structure phase
  { id: "formwork",          projectId: 0, name: "Formwork",                  left: 38, width: 25, pct: 45, status: "inProgress",  critical: false, group: "rajesh", startDate: "2025-03-12", endDate: "2025-04-05", duration: "25d", baselineStart: "2025-03-12", baselineEnd: "2025-04-02", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — L1-L2",    phase: "Structure",  photos: [] },
  { id: "formwork_shuttering",projectId:0, name: "Shuttering Setup",          left: 0,  width: 0,  pct: 80, status: "inProgress",  critical: false, group: "rajesh", startDate: "2025-03-12", endDate: "2025-03-22", duration: "10d", baselineStart: "2025-03-12", baselineEnd: "2025-03-22", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — L1",       phase: "Structure",  parentTaskId: "formwork", photos: [] },
  { id: "formwork_columns",  projectId: 0, name: "Column Formwork",           left: 0,  width: 0,  pct: 20, status: "inProgress",  critical: false, group: "rajesh", startDate: "2025-03-23", endDate: "2025-04-05", duration: "13d", baselineStart: "2025-03-23", baselineEnd: "2025-04-02", contractor: "Rajesh Kumar", delay: null,      space: "Zone A — L2",       phase: "Structure",  parentTaskId: "formwork", photos: [] },
  // MEP phase
  { id: "mep",               projectId: 0, name: "MEP Rough-In",              left: 68, width: 27, pct: 0,  status: "notStarted",  critical: true,  group: "ahmed",  startDate: "2025-03-22", endDate: "2025-04-12", duration: "22d", baselineStart: "2025-03-22", baselineEnd: "2025-04-12", contractor: "Ahmed Hassan", delay: null,      space: "Zone A-B — L1-L3",  phase: "MEP",        photos: [] },
  { id: "mep_electrical",    projectId: 0, name: "Electrical Conduit",        left: 0,  width: 0,  pct: 0,  status: "notStarted",  critical: false, group: "ahmed",  startDate: "2025-03-22", endDate: "2025-04-02", duration: "11d", baselineStart: "2025-03-22", baselineEnd: "2025-04-02", contractor: "Ahmed Hassan", delay: null,      space: "Zone A — L1-L2",    phase: "MEP",        parentTaskId: "mep", photos: [] },
  { id: "mep_plumbing",      projectId: 0, name: "Plumbing Rough-In",         left: 0,  width: 0,  pct: 0,  status: "notStarted",  critical: true,  group: "ahmed",  startDate: "2025-03-25", endDate: "2025-04-08", duration: "14d", baselineStart: "2025-03-25", baselineEnd: "2025-04-08", contractor: "Ahmed Hassan", delay: null,      space: "Zone B — L1-L3",    phase: "MEP",        parentTaskId: "mep", photos: [] },
  { id: "mep_hvac",          projectId: 0, name: "HVAC Ducting",              left: 0,  width: 0,  pct: 0,  status: "notStarted",  critical: false, group: "ahmed",  startDate: "2025-04-01", endDate: "2025-04-12", duration: "11d", baselineStart: "2025-04-01", baselineEnd: "2025-04-12", contractor: "Ahmed Hassan", delay: null,      space: "Zone A-B — L3",     phase: "MEP",        parentTaskId: "mep", photos: [] },

  // ── Orchid Poorva (projectId: 1) ──────────────────────
  { id: "mh_structure",   projectId: 1, name: "Shuttering 4th Flr", left: 5,  width: 35, pct: 80, status: "inProgress",  critical: true,  group: "suresh",  startDate: "2025-03-01", endDate: "2025-03-25", duration: "25d", contractor: "Suresh Patel",  delay: null,      space: "4th Floor", phase: "Structure", photos: [] },
  { id: "mh_scaffolding", projectId: 1, name: "Plastering 7th Flr", left: 10, width: 28, pct: 50, status: "runningLate", critical: false, group: "rajesh",  startDate: "2025-03-05", endDate: "2025-03-28", duration: "23d", contractor: "Rajesh Kumar",  delay: "Target missed", space: "7th Floor", phase: "Finishing", photos: [] },
  { id: "mh_electrical",  projectId: 1, name: "Painting Block-B",   left: 30, width: 25, pct: 100,status: "completed",   critical: false, group: "vikram",  startDate: "2025-03-15", endDate: "2025-04-08", duration: "24d", contractor: "Vikram Singh",  delay: null,      space: "Block B",   phase: "Finishing", photos: [] },

  // ── Palm Residences (projectId: 2) ────────────────────
  { id: "pr_plumbing",    projectId: 2, name: "Plumbing Rough-In",  left: 5,  width: 20, pct: 90, status: "inProgress",  critical: false, group: "gulf", startDate: "2025-03-01", endDate: "2025-03-20", duration: "19d", contractor: "Gulf MEP Ltd", delay: null, space: "Unit 12B", phase: "MEP",       photos: [] },
  { id: "pr_tiling",      projectId: 2, name: "Tile Work",          left: 18, width: 22, pct: 50, status: "inProgress",  critical: false, group: "gulf", startDate: "2025-03-10", endDate: "2025-04-01", duration: "22d", contractor: "Gulf MEP Ltd", delay: null, space: "Unit 12A", phase: "Finishing", photos: [] },
  { id: "pr_painting",    projectId: 2, name: "Painting",           left: 35, width: 18, pct: 0,  status: "notStarted",  critical: false, group: "gulf", startDate: "2025-03-25", endDate: "2025-04-12", duration: "18d", contractor: "Gulf MEP Ltd", delay: null, space: "Unit 12A", phase: "Finishing", photos: [] },

  // ── Creek Office Park (projectId: 3) ──────────────────
  { id: "cop_piling",     projectId: 3, name: "Piling Works",       left: 5,  width: 30, pct: 15, status: "delayed",     critical: true,  group: "rajesh",   startDate: "2025-03-01", endDate: "2025-03-28", duration: "27d", contractor: "Rajesh Kumar",  delay: "5d late", space: "Grid C3-C5", phase: "Foundation", photos: [] },
  { id: "cop_mep",        projectId: 3, name: "MEP Conduit",        left: 20, width: 25, pct: 0,  status: "notStarted",  critical: true,  group: "ahmed",    startDate: "2025-03-15", endDate: "2025-04-08", duration: "24d", contractor: "Ahmed Hassan",  delay: null,      space: "Zone A",     phase: "MEP",        photos: [] },
  { id: "cop_scaffold",   projectId: 3, name: "Scaffolding",        left: 15, width: 20, pct: 10, status: "runningLate", critical: false, group: "mohammad", startDate: "2025-03-10", endDate: "2025-03-30", duration: "20d", contractor: "Mohammad Ali", delay: "1d late", space: "Level 3",    phase: "Structure",  photos: [] },
];

const SCHEDULE_DEPS: TaskDependency[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────────────────────────────
  //
  // FOUNDATION sub-task chain
  // Excavation must fully finish before concrete can be poured — you can't pour
  // into an unsupported face.
  { from: "foundation_excav",     to: "foundation_pour",      type: "FS", label: "Finish-to-Start" },
  // Curing begins the moment the last truck leaves — continuous wet-cure regime.
  { from: "foundation_pour",      to: "foundation_cure",      type: "FS", label: "Finish-to-Start" },
  // Rebar for superstructure columns is cast into the slab starter bars —
  // can only begin once the slab pour is complete and partially cured (3 days).
  { from: "foundation_pour",      to: "rebar",                type: "FS", label: "Finish-to-Start" },

  // WATERPROOFING sub-task chain
  // Concrete must achieve initial cure before primer will bond — minimum 7 days.
  { from: "foundation_cure",      to: "waterproof_primer",    type: "FS", label: "Finish-to-Start" },
  // Membrane goes over the primed surface only after primer tacks off (~24 h).
  { from: "waterproof_primer",    to: "waterproof_membrane",  type: "FS", label: "Finish-to-Start" },

  // STRUCTURE — Formwork sub-task chain
  // Shuttering (base panels) can mobilise once rebar starter bars are in place
  // so it runs SS with rebar — carpenters work behind the steel fixers.
  { from: "rebar",                to: "formwork_shuttering",  type: "SS", label: "Start-to-Start" },
  // Column formwork is fixed only after the base shuttering is plumbed & braced.
  { from: "formwork_shuttering",  to: "formwork_columns",     type: "FS", label: "Finish-to-Start" },

  // MEP sub-task chain
  // MEP rough-in cannot start until the structural shell is closed — formwork
  // (concrete columns/walls) must be fully struck and inspected.
  { from: "formwork_columns",     to: "mep_electrical",       type: "FS", label: "Finish-to-Start" },
  // Waterproofing must be signed-off before plumbing is buried in the slab to
  // avoid breaking the waterproof layer retrospectively.
  { from: "waterproof_membrane",  to: "mep_plumbing",         type: "FS", label: "Finish-to-Start" },
  // Electrical conduits run first (embedded in walls/slab); plumbing follows
  // once conduit routes are confirmed to avoid clashes.
  { from: "mep_electrical",       to: "mep_plumbing",         type: "FS", label: "Finish-to-Start" },
  // HVAC ductwork is the bulkiest item — starts as soon as plumbing is roughed
  // in so both trades can work in parallel in adjacent zones.
  { from: "mep_plumbing",         to: "mep_hvac",             type: "SS", label: "Start-to-Start" },

  // ── Marina Heights (projectId: 1) ────────────────────────────────────────────
  //
  // Scaffolding must be erected floor-by-floor as the structure rises —
  // it cannot go up ahead of the slab, but it starts on day 1 alongside it.
  { from: "mh_structure",   to: "mh_scaffolding",  type: "SS", label: "Start-to-Start" },
  // Electrical rough-in only begins once the structural frame is complete and
  // scaffolding is fully certified for MEP operatives to work from.
  { from: "mh_scaffolding", to: "mh_electrical",   type: "FS", label: "Finish-to-Start" },

  // ── Palm Residences (projectId: 2) ───────────────────────────────────────────
  //
  // Plumbing must be pressure-tested and signed off before any tiles are laid
  // — once tiled, leaks cause strip-out costing 10× more to rectify.
  { from: "pr_plumbing",  to: "pr_tiling",   type: "FS", label: "Finish-to-Start" },
  // Painting follows tiling: tile grout must cure (≥72 h) and tilers must
  // have vacated so paint is not contaminated by tile adhesive dust.
  { from: "pr_tiling",    to: "pr_painting", type: "FS", label: "Finish-to-Start" },

  // ── Creek Office Park (projectId: 3) ─────────────────────────────────────────
  //
  // Piling must reach designed set before any above-ground scaffold loads the
  // ground — pile integrity test takes ~5 days after last pile.
  { from: "cop_piling",   to: "cop_scaffold", type: "FS", label: "Finish-to-Start" },
  // MEP conduit in the basement slab is cast-in; piling must be 100% complete
  // and the pile cap concreted before MEP can begin.
  { from: "cop_piling",   to: "cop_mep",      type: "FS", label: "Finish-to-Start" },
  // MEP conduit installation cannot begin until scaffold platforms give safe
  // access to the ceiling/wall zones where conduit runs.
  { from: "cop_scaffold", to: "cop_mep",      type: "FS", label: "Finish-to-Start" },
];

export const getScheduleTasks = (projectId: number): Promise<ScheduleTask[]> =>
  Promise.resolve(SCHEDULE_TASKS.filter(t => t.projectId === projectId && !t.milestone));

export const getScheduleDeps = (_projectId: number): Promise<TaskDependency[]> =>
  Promise.resolve(SCHEDULE_DEPS);

// ─── PROJECT ISSUES ──────────────────────────────────────────
export interface ProjectIssue {
  severity: "HIGH" | "MED" | "LOW";
  task: string;
  reporter: string;
  date: string;
  desc: string;
  age: string;
  contact: string;
  phone: string;
  role: string;
}

const PROJECT_ISSUES: Record<number, ProjectIssue[]> = {
  0: [
    { severity: "HIGH", task: "Foundation Works",    reporter: "Rajesh Kumar", date: "Mar 15", desc: "Cement delivery delayed by supplier, expected tomorrow",             age: "2 days open", contact: "Rajesh Kumar", phone: "+971 50 123 4567", role: "Contractor — Foundation" },
    { severity: "MED",  task: "Rebar Installation",  reporter: "Ahmed Hassan", date: "Mar 14", desc: "3 workers absent, waiting for replacements from subcontractor",       age: "3 days open", contact: "Ahmed Hassan",  phone: "+971 50 234 5678", role: "Contractor — Rebar & MEP" },
    { severity: "LOW",  task: "MEP Conduit — Zone A",reporter: "Ahmed Hassan", date: "Mar 15", desc: "Minor cable routing conflict with HVAC duct — needs coordination",   age: "1 day open",  contact: "Mohammad Ali",  phone: "+971 50 345 6789", role: "MEP Coordinator" },
  ],
  1: [
    { severity: "HIGH", task: "Plastering 7th Flr",  reporter: "Rajesh Kumar", date: "Mar 16", desc: "Target of 500 SqFt missed — cement unavailable on site, only 250 SqFt completed", age: "1 day open", contact: "Rajesh Kumar", phone: "+91 98200 12345", role: "Contractor — Plastering" },
    { severity: "MED",  task: "Plumbing 2nd Flr",    reporter: "Anil Sharma",  date: "Mar 15", desc: "Pipe leak reported in Unit 204 — plumber dispatched for inspection",               age: "2 days open", contact: "Anil Sharma",  phone: "+91 98200 67890", role: "Contractor — Plumbing" },
  ],
  2: [],
  3: [
    { severity: "HIGH", task: "Piling Works",        reporter: "Rajesh Kumar", date: "Mar 12", desc: "Piling rig breakdown — replacement part on order, 5 day delay expected", age: "6 days open", contact: "Rajesh Kumar", phone: "+971 50 123 4567", role: "Contractor — Foundation" },
    { severity: "HIGH", task: "MEP Conduit",         reporter: "Ahmed Hassan", date: "Mar 14", desc: "Municipality permit for underground conduit not yet approved",         age: "4 days open", contact: "Ahmed Hassan",  phone: "+971 50 234 5678", role: "Contractor — MEP" },
    { severity: "MED",  task: "Scaffolding",         reporter: "Mohammad Ali", date: "Mar 15", desc: "Scaffolding inspection overdue — safety officer not available",        age: "3 days open", contact: "Mohammad Ali",  phone: "+971 50 345 6789", role: "Scaffolding Contractor" },
    { severity: "LOW",  task: "Site Preparation",    reporter: "Mohammad Ali", date: "Mar 16", desc: "Minor drainage issue near Grid C4 — being addressed",                 age: "2 days open", contact: "Mohammad Ali",  phone: "+971 50 345 6789", role: "Site Supervisor" },
  ],
};

export const getProjectIssues = (projectId: number): Promise<ProjectIssue[]> =>
  Promise.resolve(PROJECT_ISSUES[projectId] ?? []);


// ─── ANALYTICS ───────────────────────────────────────────────
export interface AnalyticsData {
  overallProgress: number;
  tasksAtRisk: number;
  scheduleVarianceDays: number;
  resourceUtilisation: number;
  progressOverTime: { week: string; planned: number; actual: number }[];
  tasksByStatus: { status: string; count: number; color: string }[];
  contractorPerformance: { name: string; tasks: number; completed: number; avgProgress: number }[];
  resourceAllocation: { name: string; workers: number; utilisation: number }[];
}

const ANALYTICS: AnalyticsData = {
  overallProgress: 42,
  tasksAtRisk: 3,
  scheduleVarianceDays: -5,
  resourceUtilisation: 78,
  progressOverTime: [
    { week: "W1",  planned: 8,  actual: 7 },
    { week: "W2",  planned: 16, actual: 14 },
    { week: "W3",  planned: 25, actual: 20 },
    { week: "W4",  planned: 34, actual: 26 },
    { week: "W5",  planned: 42, actual: 32 },
    { week: "W6",  planned: 50, actual: 38 },
    { week: "W7",  planned: 58, actual: 42 },
  ],
  tasksByStatus: [
    { status: "In Progress",  count: 2, color: "#3A4EA2" },
    { status: "Running Late", count: 1, color: "#9A6700" },
    { status: "Delayed",      count: 1, color: "#CF222E" },
    { status: "Not Started",  count: 1, color: "#8C959F" },
  ],
  contractorPerformance: [
    { name: "Rajesh Kumar", tasks: 3, completed: 0, avgProgress: 60 },
    { name: "Ahmed Hassan", tasks: 2, completed: 0, avgProgress: 15 },
  ],
  resourceAllocation: [
    { name: "Foundation Works",   workers: 12, utilisation: 85 },
    { name: "Rebar Installation", workers: 8,  utilisation: 72 },
    { name: "Formwork",           workers: 6,  utilisation: 68 },
    { name: "Waterproofing",      workers: 4,  utilisation: 45 },
  ],
};

export const getAnalytics = (_projectId: number): Promise<AnalyticsData> => Promise.resolve(ANALYTICS);

// ─── CSV IMPORT ──────────────────────────────────────────────
export interface ColumnMapping {
  csvColumn: string;
  bluqField: string;
}

export const BLUQ_FIELDS = [
  "Task Name",
  "Start Date",
  "End Date",
  "Duration",
  "Predecessor",
  "Contractor",
  "Space / Zone",
  "% Complete",
  "Status",
  "— Skip Column —",
] as const;

// simulates parsing a CSV
export const parseCSVPreview = (): Promise<{ headers: string[]; rows: string[][] }> =>
  Promise.resolve({
    headers: ["Activity", "Begin", "Finish", "Days", "Depends On", "Assigned To", "Location", "Progress"],
    rows: [
      ["Foundation Works",   "2026-03-01", "2026-03-22", "22", "",            "Rajesh Kumar", "Zone A — Ground",   "75%"],
      ["Rebar Installation", "2026-03-08", "2026-03-29", "21", "Foundation",  "Rajesh Kumar", "Zone A — L1",       "60%"],
      ["Waterproofing",      "2026-03-05", "2026-03-20", "16", "Foundation",  "Ahmed Hassan", "Zone A — Basement", "30%"],
      ["MEP Rough-In",       "2026-03-22", "2026-04-12", "22", "Waterproof", "Ahmed Hassan", "Zone A-B — L1-L3",  "0%"],
      ["Formwork",           "2026-03-12", "2026-04-05", "25", "Rebar",      "Rajesh Kumar", "Zone A — L1-L2",    "45%"],
    ],
  });

  // ─── DAILY UPDATES ───────────────────────────────────────────

export interface DailyTask {
  task: string;
  project: string;
  projectId: number;
  contractor: string;
}

export interface DailyTodo extends DailyTask {
  priority: "high" | "medium" | "low";
}

export interface Milestone {
  name: string;
  project: string;
  projectId: number;
  date: string;
  status: ProjectStatus;
  daysLeft: number;
}

export interface AIBriefing {
  projectId: number | null; // null = overall
  text: string;
  highlight: string;
}

const DONE_YESTERDAY: DailyTask[] = [
  { task: "Foundation rebar — Zone A complete",  project: "Al Nakheel Tower",  projectId: 0, contractor: "Rajesh Kumar" },
  { task: "Waterproofing membrane — L1 applied", project: "Al Nakheel Tower",  projectId: 0, contractor: "Ahmed Hassan" },
  { task: "Scaffolding erected — Level 4",        project: "Marina Heights",    projectId: 1, contractor: "Ali Contractors" },
  { task: "Plumbing rough-in — Unit 12B",         project: "Palm Residences",   projectId: 2, contractor: "Gulf MEP Ltd" },
  { task: "Pile cap formwork — Grid C3-C5",       project: "Creek Office Park", projectId: 3, contractor: "Rajesh Kumar" },
];

const TODO_TODAY: DailyTodo[] = [
  { task: "Foundation Works — pour concrete Zone B", project: "Al Nakheel Tower",  projectId: 0, contractor: "Rajesh Kumar",  priority: "high" },
  { task: "Rebar Installation — tie beams L2",       project: "Al Nakheel Tower",  projectId: 0, contractor: "Ahmed Hassan",  priority: "high" },
  { task: "Structure — column formwork Level 5",     project: "Marina Heights",    projectId: 1, contractor: "Ali Contractors", priority: "medium" },
  { task: "Finishing — tile work Unit 12A",          project: "Palm Residences",   projectId: 2, contractor: "Gulf MEP Ltd",   priority: "low" },
  { task: "MEP Conduit — Zone A routing",            project: "Creek Office Park", projectId: 3, contractor: "Ahmed Hassan",   priority: "high" },
  { task: "Scaffolding inspection — Level 3",        project: "Creek Office Park", projectId: 3, contractor: "Mohammad Ali",  priority: "medium" },
];

const MILESTONES: Milestone[] = [
  { name: "Foundation Complete",      project: "Al Nakheel Tower",  projectId: 0, date: "Mar 28", status: "runningLate", daysLeft: 4 },
  { name: "Plumbing Sign-off",        project: "Palm Residences",   projectId: 2, date: "Mar 30", status: "inProgress",  daysLeft: 6 },
  { name: "Structure Topping Out",    project: "Marina Heights",    projectId: 1, date: "Apr 2",  status: "inProgress",  daysLeft: 9 },
  { name: "MEP Rough-In Start",       project: "Creek Office Park", projectId: 3, date: "Apr 7",  status: "notStarted",  daysLeft: 14 },
  { name: "Facade Mock-up Review",    project: "Al Nakheel Tower",  projectId: 0, date: "Apr 12", status: "notStarted",  daysLeft: 19 },
  { name: "Finishing Phase Kick-off", project: "Palm Residences",   projectId: 2, date: "Apr 18", status: "inProgress",  daysLeft: 25 },
];

const AI_BRIEFINGS: AIBriefing[] = [
  {
    projectId: null,
    text: "5 tasks completed yesterday across 4 projects. 6 tasks planned for today — 3 are high priority. Al Nakheel Tower has the most activity with 2 critical tasks. Creek Office Park needs attention with scaffolding inspection overdue.",
    highlight: "Focus today: Concrete pour at Al Nakheel, MEP routing at Creek Office, and follow up on tile delivery for Palm Residences.",
  },
  { projectId: 0, text: "2 tasks completed yesterday, 2 high-priority tasks today. Foundation concrete pour is critical — ensure cement delivery confirmed.", highlight: "All contractors have submitted EOD updates." },
  { projectId: 1, text: "Scaffolding for Level 4 completed. Column formwork on Level 5 is today's priority.", highlight: "All contractors have submitted EOD updates." },
  { projectId: 2, text: "Plumbing rough-in complete for Unit 12B. Tile work continues today, low urgency.", highlight: "All contractors have submitted EOD updates." },
  { projectId: 3, text: "Pile cap formwork done on Grid C3-C5. MEP conduit routing and scaffolding inspection are today's priorities.", highlight: "All contractors have submitted EOD updates." },
];

export const getDoneYesterday = (projectId?: number): Promise<DailyTask[]> =>
  Promise.resolve(projectId == null ? DONE_YESTERDAY : DONE_YESTERDAY.filter(t => t.projectId === projectId));

export const getTodoToday = (projectId?: number): Promise<DailyTodo[]> =>
  Promise.resolve(projectId == null ? TODO_TODAY : TODO_TODAY.filter(t => t.projectId === projectId));

export const getMilestones = (projectId?: number): Promise<Milestone[]> =>
  Promise.resolve(projectId == null ? MILESTONES : MILESTONES.filter(m => m.projectId === projectId));

export const getAIBriefing = (projectId: number | null): Promise<AIBriefing> =>
  Promise.resolve(AI_BRIEFINGS.find(b => b.projectId === projectId) ?? AI_BRIEFINGS[0]);