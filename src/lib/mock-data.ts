// ═══════════════════════════════════════════════════════════════
// MOCK DATA — matches the exact shape Kalyani's API will return.
// When backend is ready, replace each export with a fetch call.
// Example:
//   BEFORE: export const getProjects = () => PROJECTS;
//   AFTER:  export const getProjects = () => fetch('/api/projects').then(r => r.json());
// ═══════════════════════════════════════════════════════════════

export type ProjectStatus = "completed" | "inProgress" | "runningLate" | "delayed" | "notStarted";

export const STATUS_CONFIG: Record<ProjectStatus, { color: string; bg: string; label: string }> = {
  completed:   { color: "#1A7F37", bg: "#dafbe1", label: "Completed" },
  inProgress:  { color: "#3A4EA2", bg: "#ddf4ff", label: "In Progress" },
  runningLate: { color: "#9A6700", bg: "#fff8c5", label: "Running Late" },
  delayed:     { color: "#CF222E", bg: "#ffebe9", label: "Delayed" },
  notStarted:  { color: "#8C959F", bg: "#f0f1f3", label: "Not Started" },
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
  { id: 1, name: "Marina Heights",     code: "MH-2026-002",   pct: 67, status: "inProgress",  tasks: 18, tasksDone: 12, workers: 28, issues: 1, stage: "Structure",   startDate: "Jan 15, 2026",  endDate: "Nov 15, 2026", address: "JBR, Dubai" },
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
  //Nakheel Tower( projectID: )
  { id: "foundation",  projectId: 0,   name: "Foundation Works",   left: 5,  width: 42, pct: 75, status: "runningLate", critical: true,  group: "rajesh", startDate: "Mar 1",  endDate: "Mar 22", duration: "22d", contractor: "Rajesh Kumar",  delay: "3d late",  space: "Zone A — Ground",    photos: ["foundation_progress_001.jpg", "foundation_progress_002.jpg", "foundation_progress_003.jpg"] },
  { id: "rebar",    projectId: 0,       name: "Rebar Installation", left: 28, width: 30, pct: 60, status: "inProgress",  critical: false, group: "rajesh", startDate: "Mar 8",  endDate: "Mar 29", duration: "21d", contractor: "Rajesh Kumar",  delay: null,       space: "Zone A — L1",        photos: ["rebar_east_wing.jpg", "rebar_west_wing.jpg"] },
  { id: "formwork",  projectId: 0,      name: "Formwork",           left: 38, width: 25, pct: 45, status: "inProgress",  critical: false, group: "rajesh", startDate: "Mar 12", endDate: "Apr 5",  duration: "25d", contractor: "Rajesh Kumar",  delay: null,       space: "Zone A — L1-L2",     photos: [] },
  { id: "waterproofing", projectId: 0,  name: "Waterproofing",      left: 48, width: 28, pct: 30, status: "delayed",     critical: true,  group: "ahmed",  startDate: "Mar 5",  endDate: "Mar 20", duration: "16d", contractor: "Ahmed Hassan",  delay: "7d late",  space: "Zone A — Basement",  photos: ["waterproofing_membrane_01.jpg"] },
  { id: "mep",  projectId: 0,  name: "MEP Rough-In",       left: 68, width: 27, pct: 0,  status: "notStarted",  critical: true,  group: "ahmed",  startDate: "Mar 22", endDate: "Apr 12", duration: "22d", contractor: "Ahmed Hassan",  delay: null,       space: "Zone A-B — L1-L3",   photos: [] },
  // ── Marina Heights (projectId: 1) ─────────────────────
  { id: "mh_structure",  projectId: 1, name: "Structure Works",    left: 5,  width: 35, pct: 67, status: "inProgress",  critical: true,  group: "ali",    startDate: "2025-03-01", endDate: "2025-03-25", duration: "25d", contractor: "Ali Contractors", delay: null,      space: "Level 4", photos: [] },
  { id: "mh_scaffolding",projectId: 1, name: "Scaffolding",        left: 10, width: 28, pct: 80, status: "inProgress",  critical: false, group: "ali",    startDate: "2025-03-05", endDate: "2025-03-28", duration: "23d", contractor: "Ali Contractors", delay: null,      space: "Level 4", photos: [] },
  { id: "mh_electrical", projectId: 1, name: "Electrical Rough-In",left: 30, width: 25, pct: 20, status: "runningLate", critical: true,  group: "gulf",   startDate: "2025-03-15", endDate: "2025-04-08", duration: "24d", contractor: "Gulf MEP Ltd",   delay: "2d late", space: "Level 3", photos: [] },

  // ── Palm Residences (projectId: 2) ────────────────────
  { id: "pr_plumbing",   projectId: 2, name: "Plumbing Rough-In",  left: 5,  width: 20, pct: 90, status: "inProgress",  critical: false, group: "gulf",   startDate: "2025-03-01", endDate: "2025-03-20", duration: "19d", contractor: "Gulf MEP Ltd",   delay: null,      space: "Unit 12B", photos: [] },
  { id: "pr_tiling",     projectId: 2, name: "Tile Work",          left: 18, width: 22, pct: 50, status: "inProgress",  critical: false, group: "gulf",   startDate: "2025-03-10", endDate: "2025-04-01", duration: "22d", contractor: "Gulf MEP Ltd",   delay: null,      space: "Unit 12A", photos: [] },
  { id: "pr_painting",   projectId: 2, name: "Painting",           left: 35, width: 18, pct: 0,  status: "notStarted",  critical: false, group: "gulf",   startDate: "2025-03-25", endDate: "2025-04-12", duration: "18d", contractor: "Gulf MEP Ltd",   delay: null,      space: "Unit 12A", photos: [] },

  // ── Creek Office Park (projectId: 3) ──────────────────
  { id: "cop_piling",    projectId: 3, name: "Piling Works",       left: 5,  width: 30, pct: 15, status: "delayed",     critical: true,  group: "rajesh", startDate: "2025-03-01", endDate: "2025-03-28", duration: "27d", contractor: "Rajesh Kumar",   delay: "5d late", space: "Grid C3-C5", photos: [] },
  { id: "cop_mep",       projectId: 3, name: "MEP Conduit",        left: 20, width: 25, pct: 0,  status: "notStarted",  critical: true,  group: "ahmed",  startDate: "2025-03-15", endDate: "2025-04-08", duration: "24d", contractor: "Ahmed Hassan",   delay: null,      space: "Zone A",    photos: [] },
  { id: "cop_scaffold",  projectId: 3, name: "Scaffolding",        left: 15, width: 20, pct: 10, status: "runningLate", critical: false, group: "mohammad", startDate: "2025-03-10", endDate: "2025-03-30", duration: "20d", contractor: "Mohammad Ali", delay: "1d late", space: "Level 3",   photos: [] },
];;

const SCHEDULE_DEPS: TaskDependency[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────
  { from: "foundation",    to: "rebar",          type: "FS", label: "Finish-to-Start" },
  { from: "rebar",         to: "formwork",       type: "SS", label: "Start-to-Start" },
  { from: "foundation",    to: "waterproofing",  type: "FS", label: "Finish-to-Start" },
  { from: "waterproofing", to: "mep",            type: "FS", label: "Finish-to-Start" },
  { from: "formwork",      to: "mep",            type: "FF", label: "Finish-to-Finish" },

  // ── Marina Heights (projectId: 1) ─────────────────────
  { from: "mh_structure",   to: "mh_scaffolding",  type: "SS", label: "Start-to-Start" },
  { from: "mh_scaffolding", to: "mh_electrical",   type: "FS", label: "Finish-to-Start" },

  // ── Palm Residences (projectId: 2) ────────────────────
  { from: "pr_plumbing",   to: "pr_tiling",      type: "FS", label: "Finish-to-Start" },
  { from: "pr_tiling",     to: "pr_painting",    type: "FS", label: "Finish-to-Start" },

  // ── Creek Office Park (projectId: 3) ──────────────────
  { from: "cop_piling",    to: "cop_mep",        type: "FS", label: "Finish-to-Start" },
  { from: "cop_piling",    to: "cop_scaffold",   type: "SS", label: "Start-to-Start" },
  { from: "cop_scaffold",  to: "cop_mep",        type: "FF", label: "Finish-to-Finish" },
];

// ← end of SCHEDULE_DEPS array (line 87)

export const getScheduleTasks = (projectId: number): Promise<ScheduleTask[]> =>
  Promise.resolve(SCHEDULE_TASKS.filter(t => t.projectId === projectId));

export const getScheduleDeps = (projectId: number): Promise<TaskDependency[]> =>
  Promise.resolve(SCHEDULE_DEPS);


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

export const getAnalytics = (projectId: number): Promise<AnalyticsData> => Promise.resolve(ANALYTICS);

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