// =============================================================================
// BLUQ WHATSAPP WORKER
// =============================================================================
// BullMQ worker on "whatsapp-processor" queue.
//
// Handles the full Hindi-language conversation flow with site workers:
//
//   Morning (sent by cron at 7am):
//     Bot:    "Kya aaj kaam shuru kar rahe hain?"
//     Worker: "Haan" or "Koi blocker hai"
//
//   Anytime (ISSUE keyword → immediate alert):
//     Bot:    "Konsi problem hai?" [list]
//     Worker: picks issue type → describes → impact noted
//
//   Evening (sent by cron at 5:30pm):
//     Bot:    "Target poora hua?" [buttons: 100%/partial/not started]
//     Worker: answers → workers count → materials → photos → DONE
//
// On EOD complete → writes to:
//   - dprs table (Daily Progress Report)
//   - tasks table (updates percentComplete, status, actualStart/End)
//   - whatsapp_updates table (status → "parsed")
//
// State machine per-phone stored in Redis (TTL 24h).
// =============================================================================

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { db } from "../db/client.js";
import { users, tasks, dprs, whatsappUpdates, dprPhotos } from "../db/schema.js";
import { eq, and, lte, gte, ne, isNull, asc } from "drizzle-orm";
import { redisConnection } from "../lib/redis.js";
import { sendText, sendButtons, sendList } from "../lib/whatsapp-send.js";
import { parseWhatsappMessage, matchTaskId } from "../lib/whatsapp-parser.js";
import { emitTaskUpdate } from "../lib/socket.js";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type FlowPhase =
  | "idle"
  | "morning_prompted"
  | "morning_blocker_asked"
  | "morning_ack"
  | "issue_type_asked"
  | "issue_desc_asked"
  | "issue_impact_asked"
  | "evening_prompted"
  | "eod_partial_quantity_asked"
  | "eod_workers_asked"
  | "eod_materials_asked"
  | "eod_photos_asked"
  | "complete";

interface WaState {
  phone: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  area: string | null;
  contractor: string | null;   // used to select material prompts
  flowPhase: FlowPhase;
  eodData: {
    completionStatus?: "full" | "partial" | "not_started";
    completedQuantity?: string;
    workers?: string;
    materials?: Record<string, string>;
    photos?: boolean;
    issueCategory?: string;    // label selected from list
    issueDesc?: string;        // free-text description
  };
  lastUpdated: string;         // ISO date string
}

interface WhatsappJobData {
  metaMessageId: string;
  senderPhone: string;
  senderName: string | null;
  messageText: string;
  mediaId: string | null;         // present when messageType === "image"
  mediaMimeType: string | null;   // e.g. "image/jpeg"
  messageType: string;
}

// ---------------------------------------------------------------------------
// REDIS STATE (separate client — not BullMQ connection)
// ---------------------------------------------------------------------------

const waRedisUrl = process.env.UPSTASH_REDIS_URL!;
const waRedis = new Redis(waRedisUrl, {
  ...(waRedisUrl.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
});
const STATE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

async function getState(phone: string): Promise<WaState | null> {
  const raw = await waRedis.get(`wa:state:${phone}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WaState;
  } catch {
    return null;
  }
}

async function setState(state: WaState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  await waRedis.setex(`wa:state:${state.phone}`, STATE_TTL_SECONDS, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// ISSUE KEYWORD DETECTION
// ---------------------------------------------------------------------------

const ISSUE_KEYWORDS = [
  "issue", "ISSUE", "problem", "blocker",
  "nahi hai", "khatam", "nahi", "cement", "sand",
  "machine", "break", "broke", "material", "stock",
];

function hasIssueKeyword(text: string): boolean {
  return ISSUE_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

const ISSUE_PHASES: FlowPhase[] = ["morning_ack", "idle", "morning_prompted", "morning_blocker_asked"];

// ---------------------------------------------------------------------------
// MATERIALS BY CONTRACTOR TYPE
// ---------------------------------------------------------------------------

function getMaterials(contractor: string | null): string[] {
  switch (contractor) {
    case "Plumbing":      return ["Pipes (Metres)", "Fittings (Nos)", "Sealant (Tubes)"];
    case "Electrical":    return ["Conduit (Metres)", "Wires (Metres)", "Fittings (Nos)"];
    case "Waterproofing": return ["Waterproofing Compound (Litres)", "Cement (Bags)"];
    case "Flooring":      return ["Tiles (SqFt)", "Adhesive (Bags)", "Grout (Kg)"];
    case "Painting":      return ["Paint (Litres)", "Primer (Litres)", "Putty (Bags)"];
    case "Carpentry":     return ["Wood (CFT)", "Plywood (Sheets)", "Hardware (Sets)"];
    default:              return ["Cement (Bags)", "Sand (Brass/CFT)", "Steel (Kg)"];
  }
}

// ---------------------------------------------------------------------------
// DB LOOKUPS
// ---------------------------------------------------------------------------

async function lookupUser(phone: string) {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  return rows[0] ?? null;
}

async function findTodayTask(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      workspaceId: tasks.workspaceId,
      projectId: tasks.projectId,
      area: tasks.area,
      contractor: tasks.contractor,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.assignedTo, userId),
        lte(tasks.startDate, today),
        gte(tasks.endDate, today),
        ne(tasks.status, "completed"),
      )
    )
    .orderBy(asc(tasks.sortOrder))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// ISSUE TYPE LABELS (matches the list rows sent to worker)
// ---------------------------------------------------------------------------

const ISSUE_TYPE_LABELS: Record<string, string> = {
  issue_material: "Material nahi hai",
  issue_machine:  "Machine kharab hai",
  issue_safety:   "Safety issue",
  issue_labour:   "Labour/Mazdoor nahi",
  issue_design:   "Drawing issue",
  issue_other:    "Kuch aur",
};

// ---------------------------------------------------------------------------
// FLOW HANDLERS
// ---------------------------------------------------------------------------

async function sendMorningPrompt(state: WaState): Promise<void> {
  const body = [
    "🌅 Subah ka update",
    "",
    `📋 Kaam: ${state.taskTitle}`,
    state.area ? `📍 Jagah: ${state.area}` : null,
    "",
    "Kya aaj kaam shuru kar rahe hain?",
  ].filter(Boolean).join("\n");

  await sendButtons(state.phone, body, [
    { id: "ok_starting",    title: "✅ Haan, shuru karta hoon" },
    { id: "report_blocker", title: "⚠️ Koi blocker hai" },
  ]);
  state.flowPhase = "morning_prompted";
  await setState(state);
}

async function handleMorningAck(state: WaState): Promise<void> {
  const text =
    "Theek hai! Kaam shuru karo. 💡 Koi bhi problem ho — machine kharab ho, material khatam ho — bas *ISSUE* likho. PMC ko turant pata chalega.";
  await sendText(state.phone, text);
  state.flowPhase = "morning_ack";
  await setState(state);
}

async function handleAskIssueType(state: WaState): Promise<void> {
  const body = "⚠️ Kya hua bhai? Konsi problem hai?";
  await sendList(state.phone, body, "Problem chuniye", [
    {
      title: "Problem ka type",
      rows: [
        { id: "issue_material", title: "Material nahi hai" },
        { id: "issue_machine",  title: "Machine kharab hai" },
        { id: "issue_safety",   title: "Safety ka issue" },
        { id: "issue_labour",   title: "Labour/Mazdoor nahi" },
        { id: "issue_design",   title: "Drawing ka issue" },
        { id: "issue_other",    title: "Kuch aur" },
      ],
    },
  ]);
  state.flowPhase = "issue_type_asked";
  await setState(state);
}

async function handleAskIssueDesc(state: WaState, issueTypeId: string): Promise<void> {
  const label = ISSUE_TYPE_LABELS[issueTypeId] ?? "Issue";
  state.eodData.issueCategory = label;
  const text = `Samajh gaye — ${label}. Thoda aur batao, exactly kya hua?`;
  await sendText(state.phone, text);
  state.flowPhase = "issue_desc_asked";
  await setState(state);
}

async function handleIssueDetected(state: WaState, desc: string): Promise<void> {
  const category = state.eodData.issueCategory ?? "";
  const fullDesc = category ? `${category} — ${desc}` : desc;
  state.eodData.issueDesc = fullDesc;

  const body = `🚨 Issue note ho gaya: ${fullDesc}\n\nPMC ko alert kar diya hai. Kya aaj ka target poora hoga?`;
  await sendButtons(state.phone, body, [
    { id: "manage", title: "✅ Ho jayega" },
    { id: "missed", title: "❌ Miss hoga" },
  ]);
  state.flowPhase = "issue_impact_asked";
  await setState(state);
}

async function handleEveningPrompt(state: WaState): Promise<void> {
  const body = [
    "🕔 Shaam ka update",
    "",
    `📋 Kaam: ${state.taskTitle}`,
    state.area ? `📍 Jagah: ${state.area}` : null,
    "",
    "Aaj ka target poora hua?",
  ].filter(Boolean).join("\n");

  await sendButtons(state.phone, body, [
    { id: "full",        title: "✅ 100% hua" },
    { id: "partial",     title: "⚠️ Thoda hua" },
    { id: "not_started", title: "❌ Shuru nahi hua" },
  ]);
  state.flowPhase = "evening_prompted";
  await setState(state);
}

async function handleEodPartialQuantityAsk(state: WaState): Promise<void> {
  const body = "Kitna kaam hua? Ek option chuniye ya exact percentage type kariye (e.g. 60%).";
  await sendList(state.phone, body, "Chuniye", [
    {
      title: "Progress",
      rows: [
        { id: "q1", title: "Less than 25%" },
        { id: "q2", title: "25–50%" },
        { id: "q3", title: "50–75%" },
        { id: "q4", title: "75–99%" },
      ],
    },
  ]);
  state.flowPhase = "eod_partial_quantity_asked";
  await setState(state);
}

async function handleEodWorkersAsk(state: WaState): Promise<void> {
  const text =
    "Theek hai ✅\n\nAaj kitne workers the? Mistri aur Majdoor alag-alag batao.\nExample: 2, 4";
  await sendText(state.phone, text);
  state.flowPhase = "eod_workers_asked";
  await setState(state);
}

async function handleEodMaterialsAsk(state: WaState): Promise<void> {
  const materials = getMaterials(state.contractor);
  const list = materials.map((m, i) => `${i + 1}. ${m}`).join("\n");
  const text = `Aaj kitna material laga? Is format mein likho:\n1: [quantity]\n2: [quantity]\n\n${list}`;
  await sendText(state.phone, text);
  state.flowPhase = "eod_materials_asked";
  await setState(state);
}

async function handleEodPhotosAsk(state: WaState): Promise<void> {
  const body =
    "📸 Aaj ki site ki photos bhejo.\nPMC progress verify karta hai photos se.";
  await sendButtons(state.phone, body, [{ id: "skip_photos", title: "⏭️ Skip karo" }]);
  state.flowPhase = "eod_photos_asked";
  await setState(state);
}

async function handleEodComplete(state: WaState, waUpdateId: string | null): Promise<string | null> {
  const text = `✅ Sab note ho gaya. Acha kaam kiya! Kal milte hain. 🙏`;
  await sendText(state.phone, text);
  state.flowPhase = "complete";
  await setState(state);

  return writeEodToDb(state, waUpdateId);
}

// ---------------------------------------------------------------------------
// EOD → DB WRITE (DPR + task update)
// ---------------------------------------------------------------------------

function parseCompletionPercent(
  completionStatus: string | undefined,
  qty: string | undefined
): number {
  if (completionStatus === "full") return 100;
  if (completionStatus === "not_started") return 0;
  // partial — parse qty
  const qMap: Record<string, number> = { q1: 12, q2: 37, q3: 62, q4: 87 };
  if (qty && qMap[qty]) return qMap[qty];
  if (qty) {
    const n = parseFloat(qty);
    if (!isNaN(n)) return Math.min(99, Math.max(1, n));
  }
  return 50;
}

function parseLabourCount(workers: string | undefined): number | null {
  if (!workers) return null;
  const nums = workers.match(/\d+/g);
  if (!nums) return null;
  return nums.reduce((sum, n) => sum + parseInt(n, 10), 0);
}

async function writeEodToDb(state: WaState, waUpdateId: string | null): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0];
  const { completionStatus, completedQuantity, workers, materials, issueDesc } =
    state.eodData;

  const pct = parseCompletionPercent(completionStatus, completedQuantity);

  const newStatus =
    completionStatus === "full"
      ? "completed"
      : completionStatus === "not_started"
      ? "delayed"
      : "in_progress";

  // Update task percentComplete and status
  await db
    .update(tasks)
    .set({
      percentComplete: pct.toString(),
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(completionStatus === "full" ? { actualEnd: today } : {}),
    })
    .where(eq(tasks.id, state.taskId));

  // Set actualStart only if not already set and task is in progress/complete
  if (completionStatus !== "not_started") {
    await db
      .update(tasks)
      .set({ actualStart: today })
      .where(and(eq(tasks.id, state.taskId), isNull(tasks.actualStart)));
  }

  // Push real-time update to all Gantt chart clients watching this project
  emitTaskUpdate({
    taskId: state.taskId,
    projectId: state.projectId,
    percentComplete: pct,
    status: newStatus,
    area: null,       // fetched from DB if needed — null is safe, frontend merges by taskId
    contractor: null,
    updatedAt: new Date().toISOString(),
  });

  // Build materialSummary for workDone field
  const materialSummary = materials
    ? Object.entries(materials)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : null;

  const workDone =
    completionStatus === "full"
      ? "Task 100% completed"
      : completionStatus === "not_started"
      ? "Work not started today"
      : materialSummary ?? `${pct}% complete`;

  // Insert DPR — return id so photo can be linked
  const [dprRow] = await db.insert(dprs).values({
    workspaceId: state.workspaceId,
    projectId: state.projectId,
    taskId: state.taskId,
    reportedBy: state.userId,
    reportDate: today,
    labourCount: parseLabourCount(workers),
    workDone,
    percentComplete: pct.toString(),
    remarks: materialSummary ? `Materials: ${materialSummary}` : null,
    delayReason: issueDesc ?? null,
    delayDays: completionStatus === "not_started" ? 1 : null,
    source: "whatsapp",
    whatsappUpdateId: waUpdateId ?? undefined,
  }).returning({ id: dprs.id });

  console.log(
    `[whatsapp-worker] EOD saved — task ${state.taskId}: ${pct}% → ${newStatus}`
  );
  return dprRow?.id ?? null;
}

// ---------------------------------------------------------------------------
// PHOTO DOWNLOAD + SAVE
// ---------------------------------------------------------------------------
// Called whenever messageType === "image" and mediaId is present.
//
// Flow:
//   1. Call Meta Graph API with mediaId → get a temporary download URL
//   2. Download the image bytes from that URL
//   3. Upload to Supabase Storage (dpr-photos bucket, private)
//   4. Insert row into dpr_photos table → return the saved photo row id
//
// Returns the dpr_photos row id on success, null if anything fails.
// Never throws — a failed photo save should not break the conversation flow.
// ---------------------------------------------------------------------------

async function downloadAndSavePhoto(opts: {
  mediaId: string;
  mediaMimeType: string;
  workspaceId: string;
  projectId: string;
  dprId: string | null;
}): Promise<string | null> {
  const { mediaId, mediaMimeType, workspaceId, projectId, dprId } = opts;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    console.error("[photo] Missing env vars: WHATSAPP_ACCESS_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }

  try {
    // Step 1: Get temporary download URL from Meta Graph API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) {
      console.error(`[photo] Meta media lookup failed: ${metaRes.status}`);
      return null;
    }
    const metaData = (await metaRes.json()) as { url?: string };
    if (!metaData.url) {
      console.error("[photo] Meta returned no download URL");
      return null;
    }

    // Step 2: Download image bytes from the temporary URL
    const imgRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!imgRes.ok) {
      console.error(`[photo] Image download failed: ${imgRes.status}`);
      return null;
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Step 3: Upload to Supabase Storage
    // Bucket: dpr-photos (private — create in Supabase dashboard)
    const today = new Date().toISOString().split("T")[0];
    const ext = mediaMimeType === "image/png" ? "png" : "jpg";
    const storagePath = `${workspaceId}/${projectId}/${today}/${mediaId}.${ext}`;

    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/dpr-photos/${storagePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": mediaMimeType,
          "x-upsert": "true",
        },
        body: new Uint8Array(imgBuffer),
      }
    );
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`[photo] Supabase upload failed: ${uploadRes.status} — ${errText}`);
      return null;
    }

    // Step 4: Save row to dpr_photos table
    const [photoRow] = await db
      .insert(dprPhotos)
      .values({
        workspaceId,
        projectId,
        dprId: dprId ?? undefined,
        fileUrl: storagePath,   // store path — signed URL generated on read
        fileName: `${mediaId}.${ext}`,
        capturedAt: new Date().toISOString(),
      })
      .returning({ id: dprPhotos.id });

    console.log(`[photo] Saved photo ${photoRow.id} for project ${projectId}`);
    return photoRow.id;
  } catch (err: any) {
    console.error("[photo] Unexpected error:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// MAIN MESSAGE PROCESSOR
// ---------------------------------------------------------------------------

async function processMessage(job: Job<WhatsappJobData>): Promise<void> {
  const { senderPhone, senderName, messageText, messageType, mediaId, mediaMimeType } = job.data;

  // 1. Resolve phone → user
  const user = await lookupUser(senderPhone);
  if (!user) {
    console.warn(`[whatsapp-worker] Unknown phone: ${senderPhone}`);
    return;
  }

  // 2. Get existing state or initialize from today's task
  let state = await getState(senderPhone);

  if (!state) {
    const task = await findTodayTask(user.id);
    if (!task) {
      console.warn(`[whatsapp-worker] No active task for user ${user.id} (${senderPhone})`);
      await sendText(senderPhone, "Aaj koi active kaam nahi mila aapke liye. PMC se contact karein.");
      return;
    }
    state = {
      phone: senderPhone,
      userId: user.id,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      taskTitle: task.title,
      area: task.area,
      contractor: task.contractor,
      flowPhase: "idle",
      eodData: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  // 3. Log to whatsapp_updates (now we have workspaceId)
  let waUpdateId: string | null = null;
  try {
    const rows = await db
      .insert(whatsappUpdates)
      .values({
        workspaceId: state.workspaceId,
        projectId: state.projectId,
        senderPhone,
        senderName,
        senderUserId: state.userId,
        rawMessage: messageText || messageType,
        matchedTaskId: state.taskId,
        status: "processing",
      })
      .returning({ id: whatsappUpdates.id });
    waUpdateId = rows[0]?.id ?? null;
  } catch (err: any) {
    console.error("[whatsapp-worker] Failed to save whatsapp_update:", err.message);
  }

  const phase = state.flowPhase;

  // 4. ISSUE keyword — intercepts morning/idle phases before phase routing
  if (hasIssueKeyword(messageText) && ISSUE_PHASES.includes(phase)) {
    await handleAskIssueType(state);
    await markParsed(waUpdateId);
    return;
  }

  // 5. Phase state machine
  switch (phase) {

    case "idle": {
      // No morning prompt has been sent yet — trigger it now
      await sendMorningPrompt(state);
      break;
    }

    case "morning_prompted": {
      if (messageText === "report_blocker") {
        const ask = "Kya problem hai? Thoda batao:";
        await sendText(state.phone, ask);
        state.flowPhase = "morning_blocker_asked";
        await setState(state);
      } else {
        // "ok_starting" or any affirmative
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
      if (messageText === "missed") {
        const text = "Samajh gaye. PMC ko bata diya hai. Apna khayal rakhna. 🙏";
        await sendText(state.phone, text);
      } else {
        // "manage" or anything else
        const text = "Theek hai! ✊ Dhyan se kaam karo. Koi aur problem ho toh batana.";
        await sendText(state.phone, text);
      }
      state.flowPhase = "morning_ack";
      await setState(state);
      break;
    }

    case "evening_prompted": {
      if (messageText === "full") {
        state.eodData.completionStatus = "full";
        await setState(state);
        await handleEodPhotosAsk(state);
      } else if (messageText === "partial") {
        state.eodData.completionStatus = "partial";
        await setState(state);
        await handleEodPartialQuantityAsk(state);
      } else if (messageText === "not_started") {
        state.eodData.completionStatus = "not_started";
        await setState(state);
        await handleEodComplete(state, waUpdateId);
      }
      break;
    }

    case "eod_partial_quantity_asked": {
      state.eodData.completedQuantity = messageText;
      await setState(state);
      await handleEodWorkersAsk(state);
      break;
    }

    case "eod_workers_asked": {
      state.eodData.workers = messageText;
      await setState(state);
      await handleEodMaterialsAsk(state);
      break;
    }

    case "eod_materials_asked": {
      const materials = getMaterials(state.contractor);
      const matMap: Record<string, string> = {};
      messageText.split("\n").forEach((line) => {
        const match = line.match(/^(\d+):\s*(.+)$/);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          const mat = materials[idx];
          if (mat) matMap[mat] = match[2].trim();
        }
      });
      state.eodData.materials = matMap;
      await setState(state);
      await handleEodPhotosAsk(state);
      break;
    }

    case "eod_photos_asked": {
      if (messageText === "skip_photos" || messageType === "image") {
        state.eodData.photos = messageType === "image";
        await setState(state);
        // Save EOD data to DB first, then link photo to the returned DPR id
        const savedDprId = await handleEodComplete(state, waUpdateId);
        if (messageType === "image" && mediaId) {
          await downloadAndSavePhoto({
            mediaId,
            mediaMimeType: mediaMimeType ?? "image/jpeg",
            workspaceId: state.workspaceId,
            projectId: state.projectId,
            dprId: savedDprId,
          });
        }
      } else {
        // User sent something else — re-prompt
        await handleEodPhotosAsk(state);
      }
      break;
    }

    case "morning_ack":
    case "complete":
    default: {
      // Free-text update path — worker sends an unstructured progress message
      // (e.g. "aaj ground floor slab 70% hua, 12 mazdoor")
      if (messageType === "image" && mediaId) {
        // Worker sent a photo outside guided flow — save it silently
        await downloadAndSavePhoto({
          mediaId,
          mediaMimeType: mediaMimeType ?? "image/jpeg",
          workspaceId: state.workspaceId,
          projectId: state.projectId,
          dprId: null,
        });
      } else if (messageText && messageText !== "[image]") {
        await parseAndUpdateFromFreeText(state, messageText, waUpdateId);
      }
      break;
    }
  }

  await markParsed(waUpdateId);
}

// ---------------------------------------------------------------------------
// FREE-TEXT PARSING PATH (option B — alongside conversational flow)
// ---------------------------------------------------------------------------

async function fetchProjectTasks(projectId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      area: tasks.area,
      status: tasks.status,
      contractor: tasks.contractor,
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), ne(tasks.status, "completed")))
    .limit(300);
}

/**
 * Called when a worker sends a free-form message (not a guided-flow reply).
 * Parses with Claude Haiku → fuzzy-matches to a task → creates DPR → updates task.
 * Used in morning_ack, complete, and idle states.
 */
async function parseAndUpdateFromFreeText(
  state: WaState,
  messageText: string,
  waUpdateId: string | null
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  // 1. Parse with Haiku
  let parsed;
  try {
    parsed = await parseWhatsappMessage(messageText, apiKey);
  } catch (err: any) {
    console.error("[whatsapp-worker] Haiku parse failed:", err.message);
    await sendText(state.phone, "Update samajh nahi aaya. Thoda clear karke bhejo.");
    return;
  }

  // 2. Match to a task in the project
  const projectTasks = await fetchProjectTasks(state.projectId);
  const matchedTaskId = matchTaskId(parsed, projectTasks);
  const matchedTask = projectTasks.find((t) => t.id === matchedTaskId) ?? null;

  const today = new Date().toISOString().split("T")[0];
  const pct = parsed.percentComplete;

  // 3. Determine task status
  let newStatus: "in_progress" | "completed" | "delayed" = "in_progress";
  if (pct === 100) newStatus = "completed";
  else if (parsed.delayReason && (pct === 0 || pct === null)) newStatus = "delayed";

  // 4. Update whatsapp_updates with parsed JSON + matched task
  if (waUpdateId) {
    try {
      await db
        .update(whatsappUpdates)
        .set({
          parsedJson: parsed as any,
          ...(matchedTaskId ? { matchedTaskId } : {}),
        })
        .where(eq(whatsappUpdates.id, waUpdateId));
    } catch { /* non-fatal */ }
  }

  // 5. Create DPR
  await db.insert(dprs).values({
    workspaceId: state.workspaceId,
    projectId: state.projectId,
    taskId: matchedTaskId ?? undefined,
    reportedBy: state.userId,
    reportDate: today,
    labourCount: parsed.labourCount,
    workDone: parsed.workDone,
    percentComplete: pct?.toString() ?? null,
    remarks: parsed.remarks,
    delayReason: parsed.delayReason,
    delayDays: parsed.delayDays,
    source: "whatsapp",
    whatsappUpdateId: waUpdateId ?? undefined,
  });

  // 6. Update matched task
  if (matchedTaskId && pct !== null) {
    await db
      .update(tasks)
      .set({
        percentComplete: pct.toString(),
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(pct === 100 ? { actualEnd: today } : {}),
      })
      .where(eq(tasks.id, matchedTaskId));

    // Set actualStart only if this is the first update
    if (pct > 0) {
      await db
        .update(tasks)
        .set({ actualStart: today })
        .where(and(eq(tasks.id, matchedTaskId), isNull(tasks.actualStart)));
    }

    // Push real-time update to all Gantt chart clients watching this project
    emitTaskUpdate({
      taskId: matchedTaskId,
      projectId: state.projectId,
      percentComplete: pct,
      status: newStatus,
      area: matchedTask?.area ?? null,
      contractor: matchedTask?.contractor ?? null,
      updatedAt: new Date().toISOString(),
    });
  }

  // 7. Confirmation message back to worker
  if (matchedTask) {
    const pctText = pct !== null ? `${pct}%` : "noted";
    const areaText = matchedTask.area ? ` (${matchedTask.area})` : "";
    const labourText = parsed.labourCount ? `\n👷 ${parsed.labourCount} workers` : "";
    const delayText = parsed.delayReason ? `\n⚠️ Delay: ${parsed.delayReason}` : "";
    await sendText(
      state.phone,
      `✅ Update save ho gaya!\n📋 ${matchedTask.title}${areaText}\n📊 ${pctText} complete${labourText}${delayText}`
    );
  } else {
    await sendText(
      state.phone,
      "✅ Update save ho gaya! Task exact match nahi hua — PM manually assign kar denge."
    );
  }

  console.log(
    `[whatsapp-worker] Free-text update — matched: ${matchedTask?.title ?? "none"}, pct: ${pct}`
  );
}

async function markParsed(waUpdateId: string | null): Promise<void> {
  if (!waUpdateId) return;
  try {
    await db
      .update(whatsappUpdates)
      .set({ status: "parsed" })
      .where(eq(whatsappUpdates.id, waUpdateId));
  } catch {
    // non-fatal — don't break the message flow
  }
}

// ---------------------------------------------------------------------------
// CRON-CALLABLE EXPORTS (used by morning/evening cron jobs)
// ---------------------------------------------------------------------------

/**
 * Send morning prompt to a worker and set their state to "morning_prompted".
 * Called by the 7am cron job for every worker with an active task today.
 */
export async function triggerMorningPrompt(
  phone: string,
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
  taskTitle: string,
  area: string | null,
  contractor: string | null
): Promise<void> {
  let state = await getState(phone);

  // Reset state for new day
  state = {
    phone,
    userId,
    workspaceId,
    projectId,
    taskId,
    taskTitle,
    area,
    contractor,
    flowPhase: "idle",
    eodData: {},
    lastUpdated: new Date().toISOString(),
  };
  await setState(state);
  await sendMorningPrompt(state);
}

/**
 * Send morning prompt to a project contractor (stored in settingsJson, not a system user).
 * Sets minimal state so the reply flow works correctly.
 */
export async function triggerContractorMorningPrompt(
  phone: string,
  workspaceId: string,
  projectId: string,
  trade: string | null,
): Promise<void> {
  const state: WaState = {
    phone,
    userId: "",
    workspaceId,
    projectId,
    taskId: "",
    taskTitle: trade ?? "Site work",
    area: null,
    contractor: trade,
    flowPhase: "idle",
    eodData: {},
    lastUpdated: new Date().toISOString(),
  };
  await setState(state);
  await sendMorningPrompt(state);
}

/**
 * Send evening prompt to a worker.
 * Called by the 5:30pm cron job for every worker who checked in this morning.
 */
export async function triggerEveningPrompt(phone: string): Promise<void> {
  const state = await getState(phone);
  if (!state) {
    console.warn(`[whatsapp-worker] No state for evening prompt: ${phone}`);
    return;
  }
  // Only send if they're in morning_ack (checked in but not yet EOD)
  if (state.flowPhase !== "morning_ack") return;
  await handleEveningPrompt(state);
}

// ---------------------------------------------------------------------------
// START WORKER
// ---------------------------------------------------------------------------

export function startWhatsappWorker() {
  const worker = new Worker<WhatsappJobData>(
    "whatsapp-processor",
    async (job) => {
      try {
        await processMessage(job);
      } catch (err: any) {
        console.error("[whatsapp-worker] Error processing message:", err.message);
        throw err; // BullMQ will retry
      }
    },
    {
      connection: redisConnection,
      drainDelay: 15,
      stalledInterval: 600_000,
      lockDuration: 300_000,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[whatsapp-worker] ✓ Job ${job.id} (${job.data.senderPhone})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[whatsapp-worker] ✗ Job ${job?.id} failed:`, err.message);
  });

  console.log("[whatsapp-worker] Worker started on 'whatsapp-processor' queue");
  return worker;
}
