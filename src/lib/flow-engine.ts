import { getScheduleTasks } from "@/lib/mock-data";
import { sendTextMessage, sendButtonMessage, sendListMessage } from "@/lib/whatsapp";
import { Redis } from "@upstash/redis";

// ─── REDIS CLIENT ─────────────────────────────────────────────
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATE_TTL = 60 * 60 * 24; // 24 hours

async function getState(phone: string): Promise<ConversationState | null> {
  const raw = await redis.get<ConversationState>(`wa:state:${phone}`);
  if (!raw) return null;
  return { ...raw, lastUpdated: new Date(raw.lastUpdated) };
}

export async function saveState(state: ConversationState): Promise<void> {
  await redis.set(`wa:state:${state.phone}`, state, { ex: STATE_TTL });
}

async function getAllStates(): Promise<ConversationState[]> {
  const keys = await redis.keys("wa:state:*");
  if (!keys.length) return [];
  const states = await Promise.all(keys.map((k) => redis.get<ConversationState>(k)));
  return states
    .filter((s): s is ConversationState => s !== null)
    .map((s) => ({ ...s, lastUpdated: new Date(s.lastUpdated) }));
}

// ─── WORKER PHONES MAP ───────────────────────────────────────
// Replace with DB lookup when real onboarding is built
const WORKER_PHONES: Record<string, string> = {
  "Rajesh Kumar":  "918290870000",
  "Suresh Patel":  "918290870000",
  "Ahmed Hassan":  "918290870000",
  "Vikram Singh":  "918290870000",
  "Mohammad Ali":  "918290870000",
};

// Reverse map: phone → worker name
const PHONE_TO_WORKER: Record<string, string> = Object.fromEntries(
  Object.entries(WORKER_PHONES).map(([name, phone]) => [phone, name])
);

// ─── PROJECT NAMES ───────────────────────────────────────────
const PROJECT_NAMES: Record<number, string> = {
  0: "Al Nakheel Tower",
  1: "Orchid Poorva",
  2: "Palm Residences",
  3: "Creek Office Park",
};

// ─── MATERIALS BY PHASE ──────────────────────────────────────
const PHASE_MATERIALS: Record<string, string[]> = {
  Finishing:  ["Cement (Bags)", "Sand (Brass/CFT)", "Paint (Litres)"],
  Structure:  ["Plywood (Sheets)", "Nails (Kg)", "Steel (Kg)"],
  Foundation: ["Cement (Bags)", "Rebar (Kg)", "Shuttering Oil (Litres)"],
  MEP:        ["Conduit (Metres)", "Wires (Metres)", "Fittings (Nos)"],
};

// ─── TYPES ───────────────────────────────────────────────────
export type WorkerProfile = {
  name: string;
  phone: string;
  taskName: string;
  taskId: string;
  projectId: number;
  projectName: string;
  location: string;
  phase: string;
  materials: string[];
  startDate: string;
  endDate: string;
};

export type FlowPhase =
  | "idle"
  | "morning_prompted"
  | "morning_blocker_asked"
  | "morning_ack"
  | "issue_type_asked"
  | "issue_desc_asked"
  | "issue_detected"
  | "issue_impact_asked"
  | "evening_prompted"
  | "eod_partial_quantity_asked"
  | "eod_workers_asked"
  | "eod_materials_asked"
  | "eod_photos_asked"
  | "complete";

export type ConversationMessage = {
  id: string;
  role: "bot" | "worker" | "system";
  text: string;
  timestamp: Date;
  workerName: string;
  workerPhone: string;
  taskName: string;
  projectName: string;
  phase: FlowPhase;
};

export type PMCAlert = {
  id: string;
  workerName: string;
  workerPhone: string;
  taskName: string;
  projectName: string;
  location: string;
  issueDesc: string;
  timestamp: Date;
  resolved: boolean;
};

export type ConversationState = {
  phone: string;
  workerName: string;
  profile: WorkerProfile;
  flowPhase: FlowPhase;
  eodData: {
    completionStatus?: "full" | "partial" | "not_started";
    completedQuantity?: string;
    workers?: string;
    materials?: Record<string, string>;
    photos?: number;
    issueDesc?: string;
  };
  lastUpdated: Date;
};

// ─── IN-MEMORY STORES (logs only — state is in Redis) ────────
export const conversationLog: ConversationMessage[] = [];
export const pmcAlerts: PMCAlert[] = [];

// ─── HELPERS ─────────────────────────────────────────────────
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

function logMessage(
  role: ConversationMessage["role"],
  text: string,
  state: ConversationState
) {
  conversationLog.push({
    id: genId(),
    role,
    text,
    timestamp: new Date(),
    workerName: state.workerName,
    workerPhone: state.phone,
    taskName: state.profile.taskName,
    projectName: state.profile.projectName,
    phase: state.flowPhase,
  });
}

// ─── ISSUE KEYWORD DETECTION ─────────────────────────────────
const ISSUE_KEYWORDS = [
  "issue", "ISSUE", "problem", "blocker",
  "nahi hai", "khatam", "nahi", "cement", "sand",
  "machine", "break", "broke", "material", "stock",
];

function hasIssueKeyword(text: string): boolean {
  return ISSUE_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

// ─── PHASE HANDLERS ──────────────────────────────────────────
async function handleMorningAck(state: ConversationState) {
  const text =
    "Theek hai! Kaam shuru karo. 💡 Koi bhi problem ho — machine kharab ho, material khatam ho — bas *ISSUE* likho. PMC ko turant pata chalega.";
  await sendTextMessage(state.phone, text);
  state.flowPhase = "morning_ack";
  state.lastUpdated = new Date();
  logMessage("bot", text, state);
  await saveState(state);
}

async function handleAskIssueType(state: ConversationState) {
  const body = "⚠️ Kya hua bhai? Konsi problem hai?";
  await sendListMessage(state.phone, body, "Problem chuniye", [
    {
      title: "Problem ka type",
      rows: [
        { id: "issue_material",  title: "Material nahi hai" },
        { id: "issue_machine",   title: "Machine kharab hai" },
        { id: "issue_safety",    title: "Safety ka issue" },
        { id: "issue_labour",    title: "Labour/Mazdoor nahi" },
        { id: "issue_design",    title: "Drawing ka issue" },
        { id: "issue_other",     title: "Kuch aur" },
      ],
    },
  ]);
  state.flowPhase = "issue_type_asked";
  state.lastUpdated = new Date();
  logMessage("bot", body, state);
  await saveState(state);
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  issue_material: "Material nahi hai",
  issue_machine:  "Machine kharab hai",
  issue_safety:   "Safety issue",
  issue_labour:   "Labour/Mazdoor nahi",
  issue_design:   "Drawing issue",
  issue_other:    "Kuch aur",
};

async function handleAskIssueDesc(state: ConversationState, issueTypeId: string) {
  const label = ISSUE_TYPE_LABELS[issueTypeId] ?? "Issue";
  state.eodData.issueDesc = label;
  const text = `Samajh gaye — ${label}. Thoda aur batao, exactly kya hua?`;
  await sendTextMessage(state.phone, text);
  state.flowPhase = "issue_desc_asked";
  state.lastUpdated = new Date();
  logMessage("bot", text, state);
  await saveState(state);
}

async function handleIssueDetected(
  state: ConversationState,
  issueDesc: string
) {
  // Resolve raw list ID to label if user somehow sent it as description
  const resolvedDesc = ISSUE_TYPE_LABELS[issueDesc] ?? issueDesc;
  const category = state.eodData.issueDesc && !ISSUE_TYPE_LABELS[state.eodData.issueDesc]
    ? state.eodData.issueDesc
    : ISSUE_TYPE_LABELS[state.eodData.issueDesc ?? ""] ?? state.eodData.issueDesc;
  const fullDesc = category
    ? `${category} — ${resolvedDesc}`
    : resolvedDesc;

  const alert: PMCAlert = {
    id: genId(),
    workerName: state.workerName,
    workerPhone: state.phone,
    taskName: state.profile.taskName,
    projectName: state.profile.projectName,
    location: state.profile.location,
    issueDesc: fullDesc,
    timestamp: new Date(),
    resolved: false,
  };
  pmcAlerts.push(alert);

  const body = `🚨 Issue note ho gaya: ${fullDesc}\n\nPMC ko alert kar diya hai. Kya aaj ka target poora hoga?`;
  await sendButtonMessage(state.phone, body, [
    { id: "manage", title: "✅ Ho jayega" },
    { id: "missed", title: "❌ Miss hoga" },
  ]);
  state.flowPhase = "issue_impact_asked";
  state.eodData.issueDesc = fullDesc;
  state.lastUpdated = new Date();
  logMessage("bot", body, state);
  await saveState(state);
}

async function _handleEveningPrompt(
  state: ConversationState,
  profile: WorkerProfile
) {
  const body =
    `🕔 Shaam ka update\n\n📋 Kaam: ${profile.taskName}\n📍 Jagah: ${profile.location}\n\nAaj ka target poora hua?`;
  await sendButtonMessage(state.phone, body, [
    { id: "full",        title: "✅ 100% hua" },
    { id: "partial",     title: "⚠️ Thoda hua" },
    { id: "not_started", title: "❌ Shuru nahi hua" },
  ]);
  state.flowPhase = "evening_prompted";
  state.lastUpdated = new Date();
  logMessage("bot", body, state);
  await saveState(state);
}

async function handleEodPartialQuantityAsk(
  state: ConversationState,
  profile: WorkerProfile
) {
  const isSqFt = profile.phase === "Finishing";
  const rows = isSqFt
    ? [
        { id: "q1", title: "Less than 100 SqFt" },
        { id: "q2", title: "100-250 SqFt" },
        { id: "q3", title: "250-400 SqFt" },
        { id: "q4", title: "400+ SqFt" },
      ]
    : [
        { id: "q1", title: "Less than 25%" },
        { id: "q2", title: "25-50%" },
        { id: "q3", title: "50-75%" },
        { id: "q4", title: "75-99%" },
      ];

  const body = "Kitna kaam hua? Ek option chuniye ya exact number type kariye.";
  await sendListMessage(state.phone, body, "Chuniye", [
    { title: "Progress", rows },
  ]);
  state.flowPhase = "eod_partial_quantity_asked";
  state.lastUpdated = new Date();
  logMessage("bot", body, state);
  await saveState(state);
}

async function handleEodWorkersAsk(state: ConversationState) {
  const text =
    "Theek hai ✅\n\nAaj kitne workers the? Mistri aur Majdoor alag-alag batao.\nExample: 2, 4";
  await sendTextMessage(state.phone, text);
  state.flowPhase = "eod_workers_asked";
  state.lastUpdated = new Date();
  logMessage("bot", text, state);
  await saveState(state);
}

async function handleEodMaterialsAsk(
  state: ConversationState,
  profile: WorkerProfile
) {
  const materialsList = profile.materials
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n");
  const text =
    `Aaj kitna material laga? Is format mein likho:\n1: [quantity]\n2: [quantity]\n...\n\n${materialsList}`;
  await sendTextMessage(state.phone, text);
  state.flowPhase = "eod_materials_asked";
  state.lastUpdated = new Date();
  logMessage("bot", text, state);
  await saveState(state);
}

async function handleEodPhotosAsk(state: ConversationState) {
  const body =
    "📸 Aaj ki site ki photos bhejo.\nPMC progress verify karta hai photos se.";
  await sendButtonMessage(state.phone, body, [
    { id: "skip_photos", title: "⏭️ Skip karo" },
  ]);
  state.flowPhase = "eod_photos_asked";
  state.lastUpdated = new Date();
  logMessage("bot", body, state);
  await saveState(state);
}

async function handleEodComplete(
  state: ConversationState,
  profile: WorkerProfile
) {
  const text = `✅ Sab note ho gaya. Acha kaam kiya ${firstName(profile.name)} bhai! Kal milte hain. 🙏`;
  await sendTextMessage(state.phone, text);
  state.flowPhase = "complete";
  state.lastUpdated = new Date();
  logMessage("bot", text, state);
  await saveState(state);

  // Log final EOD summary as system message
  conversationLog.push({
    id: genId(),
    role: "system",
    text: `EOD Summary — ${JSON.stringify(state.eodData)}`,
    timestamp: new Date(),
    workerName: state.workerName,
    workerPhone: state.phone,
    taskName: profile.taskName,
    projectName: profile.projectName,
    phase: "complete",
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────
export async function handleIncomingMessage(
  from: string,
  messageText: string,
  messageType: string
) {
  let state = await getState(from);

  if (!state) {
    const workerName = PHONE_TO_WORKER[from];
    if (!workerName) {
      console.warn(`[FlowEngine] Unknown phone number: ${from}`);
      return;
    }
    console.warn(`[FlowEngine] No state for known worker ${workerName}, creating idle state`);
    const profile: WorkerProfile = {
      name: workerName,
      phone: from,
      taskName: "Unknown Task",
      taskId: "unknown",
      projectId: 0,
      projectName: "Unknown Project",
      location: "Unknown",
      phase: "Foundation",
      materials: PHASE_MATERIALS["Foundation"],
      startDate: "",
      endDate: "",
    };
    state = {
      phone: from,
      workerName,
      profile,
      flowPhase: "idle",
      eodData: {},
      lastUpdated: new Date(),
    };
    await saveState(state);
  }

  // Log incoming worker message
  logMessage("worker", messageText, state);

  const phase = state.flowPhase;
  const profile = state.profile;

  // ── Issue keyword check (runs before phase routing) ──────
  const issuePhases: FlowPhase[] = ["morning_ack", "idle", "morning_prompted"];
  if (hasIssueKeyword(messageText) && issuePhases.includes(phase)) {
    await handleAskIssueType(state);
    return;
  }

  // ── Phase routing ─────────────────────────────────────────
  switch (phase) {
    case "morning_prompted": {
      if (messageText === "ok_starting") {
        await handleMorningAck(state);
      } else if (messageText === "report_blocker") {
        const ask = "Kya problem hai? Thoda batao:";
        await sendTextMessage(state.phone, ask);
        state.flowPhase = "morning_blocker_asked";
        state.lastUpdated = new Date();
        logMessage("bot", ask, state);
        await saveState(state);
      } else {
        await handleMorningAck(state);
      }
      break;
    }

    case "morning_blocker_asked": {
      await handleAskIssueType(state);
      break;
    }

    case "issue_type_asked": {
      await handleAskIssueDesc(state, messageText);
      break;
    }

    case "issue_desc_asked": {
      await handleIssueDetected(state, messageText);
      break;
    }

    case "issue_impact_asked": {
      if (messageText === "manage") {
        const text = "Theek hai! ✊ Dhyan se kaam karo. Koi aur problem ho toh batana.";
        await sendTextMessage(state.phone, text);
        state.flowPhase = "morning_ack";
        state.lastUpdated = new Date();
        logMessage("bot", text, state);
        await saveState(state);
      } else if (messageText === "missed") {
        const text = "Samajh gaye. PMC ko bata diya hai. Apna khayal rakhna. 🙏";
        await sendTextMessage(state.phone, text);
        state.flowPhase = "morning_ack";
        state.lastUpdated = new Date();
        logMessage("bot", text, state);
        await saveState(state);
      }
      break;
    }

    case "evening_prompted": {
      if (messageText === "full") {
        state.eodData.completionStatus = "full";
        await handleEodPhotosAsk(state);
      } else if (messageText === "partial") {
        state.eodData.completionStatus = "partial";
        await handleEodPartialQuantityAsk(state, profile);
      } else if (messageText === "not_started") {
        state.eodData.completionStatus = "not_started";
        await handleEodComplete(state, profile);
      }
      break;
    }

    case "eod_partial_quantity_asked": {
      state.eodData.completedQuantity = messageText;
      await handleEodWorkersAsk(state);
      break;
    }

    case "eod_workers_asked": {
      state.eodData.workers = messageText;
      await handleEodMaterialsAsk(state, profile);
      break;
    }

    case "eod_materials_asked": {
      const matMap: Record<string, string> = {};
      messageText.split("\n").forEach((line) => {
        const match = line.match(/^(\d+):\s*(.+)$/);
        if (match) {
          const idx = parseInt(match[1]) - 1;
          const material = profile.materials[idx];
          if (material) matMap[material] = match[2].trim();
        }
      });
      state.eodData.materials = matMap;
      await handleEodPhotosAsk(state);
      break;
    }

    case "eod_photos_asked": {
      if (messageText === "skip_photos" || messageType === "image") {
        state.eodData.photos = messageType === "image" ? 1 : 0;
        await handleEodComplete(state, profile);
      }
      break;
    }

    case "morning_ack":
    case "idle":
    case "complete":
    default:
      break;
  }
}

// ─── WORKER PROFILE BUILDER ───────────────────────────────────
function buildWorkerProfile(task: Awaited<ReturnType<typeof getScheduleTasks>>[0]): WorkerProfile | null {
  const phone = WORKER_PHONES[task.contractor];
  if (!phone) {
    console.warn(`[FlowEngine] No phone for contractor: ${task.contractor}`);
    return null;
  }
  return {
    name: task.contractor,
    phone,
    taskName: task.name,
    taskId: task.id,
    projectId: task.projectId,
    projectName: PROJECT_NAMES[task.projectId] ?? `Project ${task.projectId}`,
    location: task.space,
    phase: task.phase,
    materials: PHASE_MATERIALS[task.phase] ?? PHASE_MATERIALS["Foundation"],
    startDate: task.startDate,
    endDate: task.endDate,
  };
}

// ─── EXPORTED HELPERS ─────────────────────────────────────────
export async function getWorkersForToday(): Promise<WorkerProfile[]> {
  const allTaskArrays = await Promise.all(
    [0, 1, 2, 3].map((id) => getScheduleTasks(id))
  );
  const allTasks = allTaskArrays.flat();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return allTasks
    .filter((task) => {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      return today >= start && today <= end;
    })
    .map(buildWorkerProfile)
    .filter((p): p is WorkerProfile => p !== null);
}

export function getConversationLog(): ConversationMessage[] {
  return conversationLog;
}

export function getPMCAlerts(): PMCAlert[] {
  return pmcAlerts;
}

export async function getWorkerStates(): Promise<ConversationState[]> {
  return getAllStates();
}

// ─── STATE INITIALIZER (used by cron) ────────────────────────
export async function initWorkerState(profile: WorkerProfile): Promise<ConversationState> {
  const existing = await getState(profile.phone);
  if (existing) {
    existing.profile = profile;
    existing.flowPhase = "morning_prompted";
    existing.eodData = {};
    existing.lastUpdated = new Date();
    await saveState(existing);
    return existing;
  }
  const state: ConversationState = {
    phone: profile.phone,
    workerName: profile.name,
    profile,
    flowPhase: "morning_prompted",
    eodData: {},
    lastUpdated: new Date(),
  };
  await saveState(state);
  return state;
}
