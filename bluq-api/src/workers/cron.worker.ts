import cron from "node-cron";
import { db } from "../db/client.js";
import { tasks, users, projects } from "../db/schema.js";
import { eq, and, lte, gte, lt, ne, isNotNull } from "drizzle-orm";
import { triggerMorningPrompt, triggerEveningPrompt, triggerContractorMorningPrompt } from "./whatsapp.worker.js";
import { sendText } from "../lib/whatsapp-send.js";

interface ProjectContractor {
  id: string;
  name: string;
  phone: string;
  trade: string;
}

interface ContractorInfo {
  phone: string;
  workspaceId: string;
  projectId: string;
  trade: string | null;
}

async function getActiveContractors(): Promise<ContractorInfo[]> {
  const rows = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId, settingsJson: projects.settingsJson })
    .from(projects)
    .where(eq(projects.status, "active"));

  const contractors: ContractorInfo[] = [];
  for (const row of rows) {
    const settings = row.settingsJson as { contractors?: ProjectContractor[] } | null;
    if (!settings?.contractors) continue;
    for (const c of settings.contractors) {
      if (c.phone) {
        contractors.push({
          phone: c.phone.replace(/^\+/, ""),
          workspaceId: row.workspaceId,
          projectId: row.id,
          trade: c.trade ?? null,
        });
      }
    }
  }
  return contractors;
}

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

  // Send morning check-in to contractors in project settings who aren't system users
  const activeContractors = await getActiveContractors();
  let contractorCount = 0;
  for (const c of activeContractors) {
    if (byPhone.has(c.phone)) continue; // already messaged via task-based sweep
    try {
      await triggerContractorMorningPrompt(c.phone, c.workspaceId, c.projectId, c.trade);
      contractorCount++;
    } catch (err: any) {
      console.error(`[cron] Contractor morning prompt failed for ${c.phone}:`, err.message);
    }
  }

  console.log(
    `[cron] Morning done — ${byPhone.size} user prompts, ${contractorCount} contractor prompts, ${delayedByPhone.size} delay alerts`
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

  const phones = [...new Set(activeTasks.map((r) => r.userPhone).filter((p): p is string => !!p))];

  for (const phone of phones) {
    try {
      await triggerEveningPrompt(phone);
    } catch (err: any) {
      console.error(`[cron] Evening prompt failed for ${phone}:`, err.message);
    }
  }

  // Send evening check-in to contractors in project settings who aren't system users
  const activeContractors = await getActiveContractors();
  const phoneSet = new Set(phones);
  let contractorCount = 0;
  for (const c of activeContractors) {
    if (phoneSet.has(c.phone)) continue; // already messaged via task-based sweep
    try {
      await triggerEveningPrompt(c.phone);
      contractorCount++;
    } catch (err: any) {
      console.error(`[cron] Contractor evening prompt failed for ${c.phone}:`, err.message);
    }
  }

  console.log(`[cron] Evening done — ${phones.length} user prompts, ${contractorCount} contractor prompts`);
}

// ---------------------------------------------------------------------------
// START — registers in-process schedules, no Redis
// ---------------------------------------------------------------------------

export function startCronWorker(): void {
  cron.schedule("0 7 * * *", runMorningCron, { timezone: "Asia/Kolkata" });
  cron.schedule("30 17 * * *", runEveningCron, { timezone: "Asia/Kolkata" });
  console.log("[cron] Scheduled morning (7:00am IST) and evening (5:30pm IST)");
}
