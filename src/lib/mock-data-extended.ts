// ═══════════════════════════════════════════════════════════════
// MOCK DATA — Task 2 & 3 additions
// Add these exports to your existing src/lib/mock-data.ts
// ═══════════════════════════════════════════════════════════════

// ─── AI SCHEDULING OUTPUT ────────────────────────────────────
export interface AIScheduleReasoning {
  taskId: string;
  taskName: string;
  sequenceRationale: string;
  riskFlags: { level: "high" | "medium" | "low"; message: string }[];
  dependencies: string[];
  estimatedDuration: string;
  confidence: number;
}

const AI_SCHEDULE_OUTPUT: AIScheduleReasoning[] = [
  {
    taskId: "foundation",
    taskName: "Foundation Works",
    sequenceRationale: "Scheduled first as all structural work depends on foundation completion. Zone A ground conditions require 22-day cure cycle before loading.",
    riskFlags: [
      { level: "high", message: "Cement supply chain has 38% reliability score — buffer 3 days for delivery delays" },
      { level: "medium", message: "Mar weather forecast shows 4 rain days — extend curing window" },
    ],
    dependencies: [],
    estimatedDuration: "22d",
    confidence: 72,
  },
  {
    taskId: "rebar",
    taskName: "Rebar Installation",
    sequenceRationale: "Starts 7 days after Foundation begins (FS dependency). Zone A-L1 rebar can begin once foundation reaches 60% — no need to wait for full completion.",
    riskFlags: [
      { level: "low", message: "Rebar stock confirmed with supplier through April" },
    ],
    dependencies: ["Foundation Works"],
    estimatedDuration: "21d",
    confidence: 85,
  },
  {
    taskId: "waterproofing",
    taskName: "Waterproofing",
    sequenceRationale: "Must follow Foundation completion (FS). Basement waterproofing is on the critical path — any delay here pushes MEP and final handover.",
    riskFlags: [
      { level: "high", message: "Al Rashid Materials has caused 3 delays in 60 days — recommend dual-sourcing" },
      { level: "high", message: "First application failed moisture test — quality control risk" },
    ],
    dependencies: ["Foundation Works"],
    estimatedDuration: "16d",
    confidence: 45,
  },
  {
    taskId: "formwork",
    taskName: "Formwork",
    sequenceRationale: "Starts after Rebar begins (SS dependency). Can run in parallel with Rebar on different zones. Not on critical path — has 8 days of float.",
    riskFlags: [],
    dependencies: ["Rebar Installation"],
    estimatedDuration: "25d",
    confidence: 90,
  },
  {
    taskId: "mep",
    taskName: "MEP Rough-In",
    sequenceRationale: "Final task on critical path. Depends on Waterproofing (FS) and Formwork (FF). Cannot start until Zone A basement is sealed and formwork is complete.",
    riskFlags: [
      { level: "medium", message: "MEP contractor not yet mobilised — confirm crew availability by Mar 18" },
    ],
    dependencies: ["Waterproofing", "Formwork"],
    estimatedDuration: "22d",
    confidence: 60,
  },
];

export const getAIScheduleOutput = (projectId: number): Promise<AIScheduleReasoning[]> =>
  Promise.resolve(AI_SCHEDULE_OUTPUT);

// ─── DELAY ANALYSIS ──────────────────────────────────────────
export interface DelayRow {
  id: number;
  name: string;
  count: string;
  avg: string;
  critical: string;
  impact: string;
  projectId: number;
}

export interface DelayDeepDive {
  contractorId: number;
  projectId: number;
  title: string;
  contractor: string;
  delayDays: string;
  downstreamImpact: { task: string; days: string; cascading?: boolean }[];
  rootCause: string;
  patternDetected: string | null;
  supplierReliability: string | null;
  recommendations: { action: string; detail: string }[];
  onCriticalPath: boolean;
}

const DELAY_ROWS_BY_CONTRACTOR: DelayRow[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────
  { id: 0, projectId: 0, name: "Rajesh Kumar",  count: "2", avg: "3.5 days", critical: "Foundation Works", impact: "+5 days" },
  { id: 1, projectId: 0, name: "Ahmed Hassan",  count: "1", avg: "7 days",   critical: "Waterproofing",    impact: "+8 days" },
  { id: 2, projectId: 0, name: "Mohammad Ali",  count: "1", avg: "1 day",    critical: "Formwork",          impact: "None" },

  // ── Orchid Poorva (projectId: 1) ──────────────────────
  { id: 3, projectId: 1, name: "Rajesh Kumar",  count: "1", avg: "2 days",   critical: "Plastering 7th Flr", impact: "+2 days" },

  // ── Palm Residences (projectId: 2) — no delays ────────

  // ── Creek Office Park (projectId: 3) ──────────────────
  { id: 4, projectId: 3, name: "Rajesh Kumar",  count: "1", avg: "5 days",   critical: "Piling Works",    impact: "+5 days" },
  { id: 5, projectId: 3, name: "Mohammad Ali",  count: "1", avg: "1 day",    critical: "Scaffolding",     impact: "None" },
];

const DELAY_ROWS_BY_AREA: DelayRow[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────
  { id: 10, projectId: 0, name: "Zone A — Ground",   count: "2", avg: "3.5 days", critical: "Foundation Works", impact: "+5 days" },
  { id: 11, projectId: 0, name: "Zone A — Basement", count: "1", avg: "7 days",   critical: "Waterproofing",    impact: "+8 days" },
  { id: 12, projectId: 0, name: "Zone A — L1-L2",    count: "1", avg: "1 day",    critical: "Formwork",          impact: "None" },

  // ── Orchid Poorva (projectId: 1) ──────────────────────
  { id: 13, projectId: 1, name: "7th Floor",          count: "1", avg: "2 days",   critical: "Plastering 7th Flr", impact: "+2 days" },

  // ── Palm Residences (projectId: 2) — no delays ────────

  // ── Creek Office Park (projectId: 3) ──────────────────
  { id: 14, projectId: 3, name: "Grid C3-C5",         count: "1", avg: "5 days",   critical: "Piling Works",    impact: "+5 days" },
  { id: 15, projectId: 3, name: "Level 3",             count: "1", avg: "1 day",    critical: "Scaffolding",     impact: "None" },
];

// Keep legacy export name pointing to contractor rows for backward compat
const DELAY_ROWS = DELAY_ROWS_BY_CONTRACTOR;

const DELAY_DEEP_DIVES: DelayDeepDive[] = [
  // ── Al Nakheel Tower (projectId: 0) ──────────────────
  {
    contractorId: 0,
    projectId: 0,
    title: "Foundation Works — Delay Deep Dive",
    contractor: "Rajesh Kumar",
    delayDays: "3.5 days avg delay",
    downstreamImpact: [
      { task: "Rebar Installation", days: "+5 days" },
      { task: "Waterproofing", days: "+5 days", cascading: true },
    ],
    rootCause: "Cement delivery delayed by supplier on Mar 12–14 (2 days lost). Additional 1.5 days lost to rain on Mar 15 — freshly poured sections in Zone A required 48hr extended curing. Rajesh's crew was idle during both events.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "Pre-order cement buffer stock", detail: "Maintain 3-day inventory on site to absorb supplier delays." },
      { action: "Deploy Rajesh's crew to Rebar prep", detail: "During weather delays rather than keeping them idle." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 1,
    projectId: 0,
    title: "Waterproofing — Delay Deep Dive",
    contractor: "Ahmed Hassan",
    delayDays: "7 days delayed",
    downstreamImpact: [
      { task: "External Cladding", days: "+8 days" },
      { task: "Window Installation", days: "+8 days" },
    ],
    rootCause: "Waterproofing membrane delivery was delayed 5 days due to supplier stockout (Al Rashid Materials, PO #4471). The remaining 2 days of slippage were caused by rework — the first application failed the moisture test on Zone A-L1, requiring a full strip and reapply.",
    patternDetected: "This is the 3rd material delay from Al Rashid Materials in the last 60 days. Previous delays affected Rebar Installation (Mar 3) and Formwork supplies (Feb 18).",
    supplierReliability: "Low (38%)",
    recommendations: [
      { action: "Dual-source waterproofing materials", detail: "Engage backup supplier (Gulf Coatings LLC) for remaining Zone B-L2 scope to prevent recurrence." },
      { action: "Add overtime shift", detail: "Ahmed's crew can recover ~3 days by running Saturday shifts for the next 2 weeks. Estimated cost: AED 12,400." },
      { action: "Fast-track External Cladding prep", detail: "Begin cladding measurement and anchor installation on Zone B while waterproofing completes on Zone A, reducing downstream impact by ~4 days." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 2,
    projectId: 0,
    title: "Formwork — Delay Deep Dive",
    contractor: "Mohammad Ali",
    delayDays: "1 day delayed",
    downstreamImpact: [],
    rootCause: "Minor 1-day delay due to plywood delivery arriving in the afternoon instead of morning on Mar 14. Crew completed a half-shift and resumed normally the next day.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "No action required", detail: "Delay is within float and has no deadline impact. Continue monitoring." },
    ],
    onCriticalPath: false,
  },

  // ── Marina Heights (projectId: 1) ─────────────────────
  {
    contractorId: 3,
    projectId: 1,
    title: "Electrical Rough-In — Delay Deep Dive",
    contractor: "Gulf MEP Ltd",
    delayDays: "2 days delayed",
    downstreamImpact: [
      { task: "Interior Finishing", days: "+2 days" },
    ],
    rootCause: "Electrical conduit delivery was delayed 1 day due to customs clearance. Additional 1 day lost to crew reallocation — 3 electricians were diverted to another site on Mar 16.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "Lock crew allocation", detail: "Confirm dedicated crew for Marina Heights through April to prevent reallocation." },
      { action: "Pre-clear conduit shipments", detail: "Submit customs paperwork 5 days ahead instead of 3 to absorb clearance delays." },
    ],
    onCriticalPath: true,
  },

  // ── Creek Office Park (projectId: 3) ──────────────────
  {
    contractorId: 4,
    projectId: 3,
    title: "Piling Works — Delay Deep Dive",
    contractor: "Rajesh Kumar",
    delayDays: "5 days delayed",
    downstreamImpact: [
      { task: "MEP Conduit", days: "+5 days" },
      { task: "Scaffolding", days: "+3 days", cascading: true },
    ],
    rootCause: "Piling rig broke down on Mar 5 (2 days lost for repair). Additional 3 days lost due to unexpected rock layer at Grid C4 requiring specialist drill bits — bits were sourced from Abu Dhabi with 2-day lead time plus 1 day for crew retraining on harder substrate.",
    patternDetected: "Rajesh Kumar's crews have experienced equipment failure on 2 of last 3 projects. Piling rig maintenance logs show overdue servicing.",
    supplierReliability: null,
    recommendations: [
      { action: "Enforce equipment maintenance schedule", detail: "Require Rajesh to submit rig servicing logs before mobilisation. Add penalty clause for equipment-related delays." },
      { action: "Commission geotechnical survey for remaining grids", detail: "Survey Grids C6-C9 ahead of piling to identify rock layers early and pre-order appropriate drill bits." },
      { action: "Add second piling rig", detail: "Mobilise backup rig for Grid C5 to run parallel piling and recover 3 days. Estimated cost: AED 28,000." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 5,
    projectId: 3,
    title: "Scaffolding — Delay Deep Dive",
    contractor: "Mohammad Ali",
    delayDays: "1 day delayed",
    downstreamImpact: [],
    rootCause: "Scaffold tubes delivery was short by 15% on Mar 12. Crew erected what they could and resumed the next day when the remaining tubes arrived.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "No action required", detail: "Delay is within float and has no deadline impact. Continue monitoring." },
    ],
    onCriticalPath: false,
  },

  // ── Area-based deep dives (IDs 10–15) ─────────────────
  {
    contractorId: 10, projectId: 0,
    title: "Zone A — Ground Floor Delay",
    contractor: "Rajesh Kumar",
    delayDays: "3.5 days avg delay",
    downstreamImpact: [
      { task: "Rebar Installation", days: "+5 days" },
      { task: "Waterproofing", days: "+5 days", cascading: true },
    ],
    rootCause: "Zone A ground floor was impacted by cement delivery delays (Mar 12–14) and rain on Mar 15. Two concurrent events stalled the pour and extended curing time by 48 hours.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "Maintain cement buffer stock at Zone A", detail: "Keep 3-day inventory on site to prevent supply-chain delays from halting pour schedules." },
      { action: "Install weather-proof curing covers", detail: "Prevents rain from extending curing cycles on freshly poured slabs." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 11, projectId: 0,
    title: "Zone A — Basement Delay",
    contractor: "Ahmed Hassan",
    delayDays: "7 days delayed",
    downstreamImpact: [
      { task: "External Cladding", days: "+8 days" },
      { task: "Window Installation", days: "+8 days" },
    ],
    rootCause: "Waterproofing membrane delivery for the basement was delayed 5 days due to supplier stockout. First application on Zone A-L1 failed moisture test — full strip and reapply cost 2 additional days.",
    patternDetected: "Supplier Al Rashid Materials has caused 3 delays in 60 days affecting this zone.",
    supplierReliability: "Low (38%)",
    recommendations: [
      { action: "Dual-source waterproofing for Zone A Basement", detail: "Engage Gulf Coatings LLC as backup supplier for remaining scope." },
      { action: "Mandatory moisture test before application", detail: "Add a 24hr pre-test checklist to prevent rework failures." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 12, projectId: 0,
    title: "Zone A — L1/L2 Delay",
    contractor: "Mohammad Ali",
    delayDays: "1 day delayed",
    downstreamImpact: [],
    rootCause: "Plywood delivery for formwork arrived in the afternoon instead of morning on Mar 14. Crew completed a half-shift and resumed normally the following day.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "No action required", detail: "Delay is within float and has no impact on Zone A-L1/L2 deadlines." },
    ],
    onCriticalPath: false,
  },
  {
    contractorId: 13, projectId: 1,
    title: "7th Floor — Plastering Delay",
    contractor: "Rajesh Kumar",
    delayDays: "2 days delayed",
    downstreamImpact: [
      { task: "Painting 7th Flr", days: "+2 days" },
    ],
    rootCause: "Cement shortage on 7th floor on Mar 16 — only 250 SqFt completed against 500 SqFt target. Rajesh Kumar reported the issue via WhatsApp at 2:15 PM.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "Pre-stage floor materials 1 day ahead", detail: "Deliver plastering materials to each floor the evening before to avoid morning shortages." },
    ],
    onCriticalPath: false,
  },
  {
    contractorId: 14, projectId: 3,
    title: "Grid C3-C5 — Piling Delay",
    contractor: "Rajesh Kumar",
    delayDays: "5 days delayed",
    downstreamImpact: [
      { task: "MEP Conduit", days: "+5 days" },
      { task: "Scaffolding", days: "+3 days", cascading: true },
    ],
    rootCause: "Piling rig breakdown on Mar 5 at Grid C3 (2 days). Rock layer at Grid C4 required specialist drill bits sourced from Abu Dhabi — 2-day lead time plus 1 day crew retraining.",
    patternDetected: "Equipment failure on 2 of last 3 Rajesh Kumar projects. Rig maintenance logs show overdue servicing.",
    supplierReliability: null,
    recommendations: [
      { action: "Enforce rig maintenance schedule", detail: "Require maintenance logs before mobilisation on Grid C5 onwards." },
      { action: "Pre-survey Grids C6-C9", detail: "Geotechnical survey to identify rock layers early and pre-order drill bits." },
    ],
    onCriticalPath: true,
  },
  {
    contractorId: 15, projectId: 3,
    title: "Level 3 — Scaffolding Delay",
    contractor: "Mohammad Ali",
    delayDays: "1 day delayed",
    downstreamImpact: [],
    rootCause: "Scaffold tube delivery on Mar 12 was 15% short. Crew erected available material and completed the rest the following day.",
    patternDetected: null,
    supplierReliability: null,
    recommendations: [
      { action: "No action required", detail: "Delay is within float. Continue monitoring Level 3 scaffold completion." },
    ],
    onCriticalPath: false,
  },
];

export const getDelayRows = (projectId: number): Promise<DelayRow[]> =>
  Promise.resolve(DELAY_ROWS_BY_CONTRACTOR.filter(r => r.projectId === projectId));

export const getDelayRowsByArea = (projectId: number): Promise<DelayRow[]> =>
  Promise.resolve(DELAY_ROWS_BY_AREA.filter(r => r.projectId === projectId));

export const getDelayDeepDive = (contractorId: number): Promise<DelayDeepDive | undefined> =>
  Promise.resolve(DELAY_DEEP_DIVES.find((d) => d.contractorId === contractorId));

// ─── DPR ─────────────────────────────────────────────────────
export interface DPREntry {
  id: number;
  date: string;
  submittedBy: string;
  tasksSummary: string;
  overallProgress: number;
  workersOnSite: number;
  issuesCount: number;
  photosCount: number;
  status: "submitted" | "reviewed" | "draft";
}

const DPR_HISTORY: DPREntry[] = [
  { id: 1, date: "Mar 15, 2026", submittedBy: "Aayush Patel", tasksSummary: "Foundation Works, Rebar Installation, Formwork", overallProgress: 42, workersOnSite: 30, issuesCount: 2, photosCount: 6, status: "submitted" },
  { id: 2, date: "Mar 14, 2026", submittedBy: "Aayush Patel", tasksSummary: "Foundation Works, Rebar Installation",          overallProgress: 40, workersOnSite: 28, issuesCount: 1, photosCount: 4, status: "reviewed" },
  { id: 3, date: "Mar 13, 2026", submittedBy: "Meera Shah",   tasksSummary: "Foundation Works, Formwork",                    overallProgress: 38, workersOnSite: 32, issuesCount: 3, photosCount: 8, status: "reviewed" },
  { id: 4, date: "Mar 12, 2026", submittedBy: "Aayush Patel", tasksSummary: "Foundation Works, Rebar Installation",          overallProgress: 35, workersOnSite: 26, issuesCount: 0, photosCount: 3, status: "reviewed" },
  { id: 5, date: "Mar 11, 2026", submittedBy: "Aayush Patel", tasksSummary: "Foundation Works",                              overallProgress: 32, workersOnSite: 24, issuesCount: 1, photosCount: 5, status: "reviewed" },
];

export const DPR_SECTIONS = [
  "Executive Summary",
  "Contractor Progress Table",
  "Space Progress Table",
  "Issues & Warnings",
  "S-Curve Chart + AI Narrative",
  "Next Steps & Recommendations",
] as const;

export const getDPRHistory = (projectId: number): Promise<DPREntry[]> => Promise.resolve(DPR_HISTORY);

// ─── PROJECTS ────────────────────────────────────────────────
export interface Project {
  id: number;
  name: string;
}

const PROJECTS: Project[] = [
  { id: 0, name: "Al Nakheel Tower" },
  { id: 1, name: "Orchid Poorva" },
  { id: 2, name: "Palm Residences" },
  { id: 3, name: "Creek Office Park" },
];

export const getProjects = (): Promise<Project[]> => Promise.resolve(PROJECTS);

// ─── WHATSAPP FEED ───────────────────────────────────────────
export interface WhatsAppConvo {
  id: number;
  name: string;
  type: "EOD" | "Warning";
  time: string;
  status: string;
  task: string;
  photos: number;
  color: string;
}

export interface WhatsAppMessage {
  bot: string;
  reply: string;
}

// ── Per-project conversation lists ───────────────────────────

const WHATSAPP_CONVOS_BY_PROJECT: Record<number, WhatsAppConvo[]> = {
  // Al Nakheel Tower
  0: [
    { id: 10, name: "Rajesh Kumar", type: "EOD",     time: "6:14 PM",  status: "✅ Complete", task: "Foundation Works — 75%",                  photos: 3, color: "#1A7F37" },
    { id: 11, name: "Ahmed Hassan", type: "Warning", time: "11:43 AM", status: "⚠️ Flagged",  task: "Rebar Installation — Labor Issue (High)",  photos: 0, color: "#CF222E" },
    { id: 12, name: "Ahmed Hassan", type: "EOD",     time: "6:22 PM",  status: "✅ Complete",  task: "Rebar Installation — 60%",                photos: 2, color: "#1A7F37" },
    { id: 13, name: "Mohammad Ali", type: "EOD",     time: "—",        status: "⏳ Pending",   task: "Reminder sent at 6:30 PM",                photos: 0, color: "#9A6700" },
  ],

  // Orchid Poorva — Rajesh Kumar 3-phase bot flow (the reference flow)
  1: [
    { id: 20, name: "Rajesh Kumar", type: "Warning", time: "5:30 PM", status: "Target Missed", task: "Plastering 7th Flr",       photos: 2, color: "#CF222E" },
    { id: 21, name: "Suresh Patel", type: "EOD",     time: "6:00 PM", status: "✅ Complete",   task: "Shuttering 4th Flr — 80%", photos: 2, color: "#1A7F37" },
    { id: 22, name: "Vikram Singh", type: "EOD",     time: "5:45 PM", status: "✅ Complete",   task: "Painting Block-B — 100%",  photos: 5, color: "#1A7F37" },
    { id: 23, name: "Anil Sharma",  type: "Warning", time: "3:15 PM", status: "Pipe Leak",     task: "Plumbing 2nd Flr",         photos: 1, color: "#CF222E" },
    { id: 24, name: "Deepak Yadav", type: "EOD",     time: "6:20 PM", status: "✅ Complete",   task: "Bar Bending Slab-6 — 55%", photos: 0, color: "#1A7F37" },
  ],

  // Palm Residences
  2: [
    { id: 30, name: "Gulf MEP Ltd",  type: "EOD",     time: "6:05 PM", status: "✅ Complete",  task: "Plumbing Rough-In — 90%",   photos: 3, color: "#1A7F37" },
    { id: 31, name: "Gulf MEP Ltd",  type: "EOD",     time: "5:50 PM", status: "✅ Complete",  task: "Tile Work — 50%",            photos: 2, color: "#1A7F37" },
  ],

  // Creek Office Park
  3: [
    { id: 40, name: "Rajesh Kumar",  type: "Warning", time: "2:45 PM", status: "⚠️ Delayed",  task: "Piling Works — Rig Breakdown", photos: 1, color: "#CF222E" },
    { id: 41, name: "Ahmed Hassan",  type: "Warning", time: "10:00 AM",status: "⚠️ Blocked",   task: "MEP Conduit — Permit Pending", photos: 0, color: "#CF222E" },
    { id: 42, name: "Mohammad Ali",  type: "EOD",     time: "6:10 PM", status: "✅ Complete",  task: "Scaffolding — 10%",            photos: 0, color: "#1A7F37" },
  ],
};

// ── Per-convo message threads ────────────────────────────────

// Rajesh Kumar — 3-phase WhatsApp bot flow (Morning Push → Mid-Day Alert → Evening Pull)
const RAJESH_3PHASE_FLOW: WhatsAppMessage[] = [
  {
    bot: "🌅 *Phase 1: The Morning Push (8:30 AM)*\n\n🏗️ Target for Today: Orchid Proova\nTask: Plastering 7th Flr (Flats 701 & 702)\n🎯 Target: 500 SqFt\n\nAre we good to go, or are there any blockers this morning?\n\n[Button: ✅ OK, Starting Work]\n[Button: ⚠️ Report Blocker]",
    reply: "✅ OK, Starting Work",
  },
  {
    bot: "Great! Have a safe shift. 💡 Tip: If any machines break or materials run out today, just type \"ISSUE\" here to alert the PMC instantly.",
    reply: "Hi",
  },
  {
    bot: "Hi Rajesh! 👋 You are currently scheduled for Plastering 7th Flr (500 SqFt) today.\nHow can I help you right now?\n\n[Button: ⚠️ Report an Issue]\n[Button: 📊 Log Early Progress]\n[Button: 📋 View Today's Target]",
    reply: "Cement nahi hai site pe",
  },
  {
    bot: "🚨 *Phase 2: The Reactive Mid-Day Alert (2:15 PM)*\n\nMaterial Alert Logged. I've alerted the PMC that you are out of cement. Will this stop you from hitting the 500 SqFt target today?\n\n[Button: ✅ Yes, Will Manage]\n[Button: ❌ No, Target Missed]",
    reply: "❌ No, Target Missed",
  },
  {
    bot: "🕔 *Phase 3: The Evening Pull (5:30 PM)*\n\n📋 EOD Update: Plastering 7th Flr\nDid you complete the full target of 500 SqFt today?\n\n[Button: ✅ Yes, 100% Done]\n[Button: ⚠️ Partially Done]\n[Button: ❌ Not Started]",
    reply: "⚠️ Partially Done",
  },
  {
    bot: "How much was actually completed today?\n\n[List Menu 👇]\nLess than 100 SqFt\n100 - 250 SqFt\n250 - 400 SqFt\nOr type the exact number below:",
    reply: "250",
  },
  {
    bot: "Got it. How many workers were on site for this task today? (Format: Mistri, Majdoor)",
    reply: "2, 4",
  },
  {
    bot: "Based on 250 SqFt completed, what materials were used today?\n\nCement (Bags)\nSand (Brass/CFT)",
    reply: "1: 12, 2: 2",
  },
  {
    bot: "Please share today's site photos.\n\n[Button: ⏭️ Skip Photos]",
    reply: "📸 [Uploads 2 photos]",
  },
  {
    bot: "✅ Update saved. Have a great evening!",
    reply: "",
  },
];

// Standard EOD flow
const STANDARD_EOD_FLOW: WhatsAppMessage[] = [
  { bot: "Hi! 👋 Time for your daily EOD update.\nWhich task did you work on today?", reply: "1" },
  { bot: "Got it. What % is complete now?", reply: "75" },
  { bot: "How many workers were on site today?", reply: "12" },
  { bot: "Any materials used or delivered today? Reply or send SKIP", reply: "SKIP" },
  { bot: "Any issues or blockers? Reply or send SKIP", reply: "SKIP" },
  { bot: "Please share site photos. Send photos or reply SKIP", reply: "📸 3 photos attached" },
  { bot: "✅ Update saved! Have a good evening!", reply: "" },
];

// Warning flow — labor issue
const LABOR_WARNING_FLOW: WhatsAppMessage[] = [
  { bot: "⚠️ *Auto-Alert: Labor Issue Detected*\n\nTask: Rebar Installation\nOnly 4 of 12 scheduled workers checked in by 9:30 AM.\n\nIs this expected?\n\n[Button: ✅ Yes, Adjusted Plan]\n[Button: ❌ No, Escalate]", reply: "❌ No, Escalate" },
  { bot: "Alert escalated to PMC. A notification has been sent to Aayush Patel.\n\nWould you like to reassign available workers to another task in the meantime?\n\n[Button: ✅ Yes]\n[Button: ❌ No, Wait]", reply: "❌ No, Wait" },
  { bot: "Understood. We'll follow up once the PMC responds. You'll get a ping here.", reply: "" },
];

// Pending reminder flow
const PENDING_REMINDER_FLOW: WhatsAppMessage[] = [
  { bot: "Hi Mohammad! 👋 Just a reminder — your EOD update for Formwork is due.\n\nPlease share your progress when you get a chance.\n\n[Button: 📊 Start Update]\n[Button: ⏭️ Skip Today]", reply: "" },
];

// Map convo IDs → their message threads
const WHATSAPP_MESSAGES_BY_CONVO: Record<number, WhatsAppMessage[]> = {
  // Al Nakheel Tower
  10: STANDARD_EOD_FLOW,
  11: LABOR_WARNING_FLOW,
  12: STANDARD_EOD_FLOW,
  13: PENDING_REMINDER_FLOW,

  // Orchid Poorva — Rajesh Kumar 3-phase flow is the reference
  20: RAJESH_3PHASE_FLOW,
  21: STANDARD_EOD_FLOW,
  22: STANDARD_EOD_FLOW,
  23: [
    { bot: "⚠️ *Auto-Alert: Issue Reported*\n\nTask: Plumbing 2nd Flr\nAnil Sharma reported a pipe leak in Unit 204.\n\n📸 1 photo attached.\n\nEscalating to PMC for immediate inspection.", reply: "" },
  ],
  24: STANDARD_EOD_FLOW,

  // Palm Residences
  30: STANDARD_EOD_FLOW,
  31: STANDARD_EOD_FLOW,

  // Creek Office Park
  40: [
    { bot: "⚠️ *Auto-Alert: Equipment Breakdown*\n\nTask: Piling Works — Grid C3-C5\nRajesh Kumar reported that the piling rig has broken down.\n\nEstimated downtime: 2 days.\n\nEscalating to PMC for recovery planning.\n\n[Button: ✅ Acknowledged]\n[Button: 📋 View Impact]", reply: "✅ Acknowledged" },
    { bot: "Noted. Procurement has been alerted to source a backup rig. You will receive an update within 4 hours.", reply: "" },
  ],
  41: [
    { bot: "⚠️ *Auto-Alert: Permit Pending*\n\nTask: MEP Conduit — Zone A\nMunicipality permit for underground conduit has not been approved.\n\nWork cannot begin until permit is granted.\n\nPMC has been notified.\n\n[Button: ✅ Acknowledged]", reply: "✅ Acknowledged" },
    { bot: "Understood. We will follow up with the municipality office and update you by EOD.", reply: "" },
  ],
  42: STANDARD_EOD_FLOW,
};

// ── Exported fetchers ────────────────────────────────────────

export const getWhatsAppConvos = (projectId: number): Promise<WhatsAppConvo[]> =>
  Promise.resolve(WHATSAPP_CONVOS_BY_PROJECT[projectId] ?? []);

export const getWhatsAppMessages = (convoId: number): Promise<WhatsAppMessage[]> =>
  Promise.resolve(WHATSAPP_MESSAGES_BY_CONVO[convoId] ?? STANDARD_EOD_FLOW);