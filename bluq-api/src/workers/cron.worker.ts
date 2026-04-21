import cron from "node-cron";
import { db } from "../db/client.js";
import { tasks, users } from "../db/schema.js";
import { eq, and, lte, gte, lt, ne, isNotNull } from "drizzle-orm";
import { triggerMorningPrompt, triggerEveningPrompt } from "./whatsapp.worker.js";
import { sendText } from "../lib/whatsapp-send.js";

// ---------------------------------------------------------------------------
// MORNING CRON — 7:00am IST
// ---------------------------------------------------------------------------

async function runMorningCron(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[cron] Running morning prompts for ${today}`);

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

  const phones = [...new Set(activeTasks.map((r) => r.userPhone!).filter(Boolean))];

  for (const phone of phones) {
    try {
      await triggerEveningPrompt(phone);
    } catch (err: any) {
      console.error(`[cron] Evening prompt failed for ${phone}:`, err.message);
    }
  }

  console.log(`[cron] Evening done — attempted ${phones.length}`);
}

// ---------------------------------------------------------------------------
// START — registers in-process schedules, no Redis
// ---------------------------------------------------------------------------

export function startCronWorker(): void {
  cron.schedule("0 7 * * *", runMorningCron, { timezone: "Asia/Kolkata" });
  cron.schedule("30 17 * * *", runEveningCron, { timezone: "Asia/Kolkata" });
  console.log("[cron] Scheduled morning (7:00am IST) and evening (5:30pm IST)");
}
