// =============================================================================
// BLUQ CRON WORKER
// =============================================================================
// Uses BullMQ repeatable jobs (schedule stored in Redis, survives restarts).
//
// Two daily jobs (Asia/Kolkata timezone = IST):
//
//   7:00am  → morning-prompts
//             • Find every worker with an active task today
//             • Send "Aaj kaam shuru karoge?" WhatsApp message per worker
//             • Also alert workers whose tasks are running late (endDate passed)
//
//   5:30pm  → evening-prompts
//             • Find all workers who checked in this morning (flowPhase = morning_ack)
//             • Send "Target poora hua?" EOD collection message
//
// Registration is idempotent — checks getRepeatableJobs() before adding,
// so restarting the server never creates duplicate scheduled jobs.
// =============================================================================

import { Worker, Queue } from "bullmq";
import { db } from "../db/client.js";
import { tasks, users } from "../db/schema.js";
import { eq, and, lte, gte, lt, ne, isNotNull } from "drizzle-orm";
import { redisConnection } from "../lib/redis.js";
import { triggerMorningPrompt, triggerEveningPrompt } from "./whatsapp.worker.js";
import { sendText } from "../lib/whatsapp-send.js";

// ---------------------------------------------------------------------------
// CRON QUEUE
// ---------------------------------------------------------------------------

const cronQueue = new Queue("cron-jobs", { connection: redisConnection });

// ---------------------------------------------------------------------------
// MORNING CRON — 7:00am IST
// ---------------------------------------------------------------------------

async function runMorningCron(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[cron] Running morning prompts for ${today}`);

  // ── Active tasks today ────────────────────────────────────────────────────
  const activeTasks = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      workspaceId: tasks.workspaceId,
      projectId: tasks.projectId,
      area: tasks.area,
      contractor: tasks.contractor,
      userId: users.id,
      userPhone: users.phone,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.assignedTo, users.id))
    .where(
      and(
        lte(tasks.startDate, today),
        gte(tasks.endDate, today),
        ne(tasks.status, "completed"),
        isNotNull(users.phone),
      )
    );

  // One message per worker phone (take first task by DB order = sortOrder)
  const byPhone = new Map<string, typeof activeTasks[0]>();
  for (const row of activeTasks) {
    if (!row.userPhone || byPhone.has(row.userPhone)) continue;
    byPhone.set(row.userPhone, row);
  }

  for (const row of byPhone.values()) {
    try {
      await triggerMorningPrompt(
        row.userPhone!,
        row.userId,
        row.workspaceId,
        row.projectId,
        row.taskId,
        row.taskTitle,
        row.area,
        row.contractor,
      );
    } catch (err: any) {
      console.error(`[cron] Morning prompt failed for ${row.userPhone}:`, err.message);
    }
  }

  // ── Delayed tasks (endDate already passed, still not complete) ────────────
  const delayedTasks = await db
    .select({
      taskTitle: tasks.title,
      area: tasks.area,
      userPhone: users.phone,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.assignedTo, users.id))
    .where(
      and(
        lt(tasks.endDate, today),
        ne(tasks.status, "completed"),
        isNotNull(users.phone),
      )
    );

  // Group by phone so each worker gets one bundled message
  const delayedByPhone = new Map<string, string[]>();
  for (const row of delayedTasks) {
    if (!row.userPhone) continue;
    if (!delayedByPhone.has(row.userPhone)) delayedByPhone.set(row.userPhone, []);
    const label = row.area ? `${row.taskTitle} (${row.area})` : row.taskTitle;
    delayedByPhone.get(row.userPhone)!.push(label);
  }

  for (const [phone, taskNames] of delayedByPhone) {
    try {
      const list = taskNames.map((n, i) => `${i + 1}. ${n}`).join("\n");
      await sendText(
        phone,
        `⚠️ Neeche likhe kaam abhi tak poore nahi hue:\n\n${list}\n\nKripya inhe update karein ya PMC se baat karein.`
      );
    } catch (err: any) {
      console.error(`[cron] Delay alert failed for ${phone}:`, err.message);
    }
  }

  console.log(
    `[cron] Morning done — ${byPhone.size} prompts sent, ${delayedByPhone.size} delay alerts sent`
  );
}

// ---------------------------------------------------------------------------
// EVENING CRON — 5:30pm IST
// ---------------------------------------------------------------------------

async function runEveningCron(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[cron] Running evening prompts for ${today}`);

  // All workers with tasks active today (triggerEveningPrompt skips anyone
  // not in morning_ack state, so over-fetching here is safe)
  const activeTasks = await db
    .select({ userPhone: users.phone })
    .from(tasks)
    .innerJoin(users, eq(tasks.assignedTo, users.id))
    .where(
      and(
        lte(tasks.startDate, today),
        gte(tasks.endDate, today),
        ne(tasks.status, "completed"),
        isNotNull(users.phone),
      )
    );

  // Deduplicate phones
  const phones = [...new Set(activeTasks.map((r) => r.userPhone!).filter(Boolean))];

  let sent = 0;
  for (const phone of phones) {
    try {
      await triggerEveningPrompt(phone);
      sent++;
    } catch (err: any) {
      console.error(`[cron] Evening prompt failed for ${phone}:`, err.message);
    }
  }

  console.log(`[cron] Evening done — attempted ${phones.length}, sent to morning_ack workers`);
}

// ---------------------------------------------------------------------------
// START CRON WORKER
// ---------------------------------------------------------------------------

export async function startCronWorker(): Promise<void> {
  // Check existing repeatable jobs to avoid duplicates on restart
  const existing = await cronQueue.getRepeatableJobs();
  const names = new Set(existing.map((j) => j.name));

  if (!names.has("morning-prompts")) {
    await cronQueue.add(
      "morning-prompts",
      {},
      { repeat: { pattern: "0 7 * * *", tz: "Asia/Kolkata" } }
    );
    console.log("[cron] Registered morning-prompts (7:00am IST daily)");
  }

  if (!names.has("evening-prompts")) {
    await cronQueue.add(
      "evening-prompts",
      {},
      { repeat: { pattern: "30 17 * * *", tz: "Asia/Kolkata" } }
    );
    console.log("[cron] Registered evening-prompts (5:30pm IST daily)");
  }

  const worker = new Worker(
    "cron-jobs",
    async (job) => {
      if (job.name === "morning-prompts") await runMorningCron();
      else if (job.name === "evening-prompts") await runEveningCron();
    },
    { connection: redisConnection }
  );

  worker.on("completed", (job) => console.log(`[cron] ✓ ${job.name}`));
  worker.on("failed", (job, err) =>
    console.error(`[cron] ✗ ${job?.name}:`, err.message)
  );

  console.log("[cron] Cron worker ready");
}
