import { NextRequest, NextResponse } from "next/server";
import { getWorkersForToday, initWorkerState, conversationLog } from "@/lib/flow-engine";
import { sendButtonMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await req.json() as { type: "morning" | "evening" };

  const workers = await getWorkersForToday();
  let sent = 0;

  for (const profile of workers) {
    try {
      const state = await initWorkerState(profile);
      const fName = profile.name.split(" ")[0];

      if (type === "morning") {
        const body =
          `🌅 Subah ka salam ${fName} bhai! 👋\n\n` +
          `📋 Project: ${profile.projectName}\n` +
          `🔨 Kaam: ${profile.taskName}\n` +
          `📍 Jagah: ${profile.location}\n` +
          `📅 Schedule: ${profile.startDate} → ${profile.endDate}\n\n` +
          `Kya aaj kaam shuru kar sakte ho?`;

        await sendButtonMessage(profile.phone, body, [
          { id: "ok_starting",    title: "✅ Shuru karte hain" },
          { id: "report_blocker", title: "⚠️ Problem hai" },
        ]);

        state.flowPhase = "morning_prompted";
        conversationLog.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: "bot",
          text: body,
          timestamp: new Date(),
          workerName: profile.name,
          workerPhone: profile.phone,
          taskName: profile.taskName,
          projectName: profile.projectName,
          phase: state.flowPhase,
        });
      } else {
        const body =
          `🕔 Shaam ka update\n\n` +
          `📋 Kaam: ${profile.taskName}\n` +
          `📍 Jagah: ${profile.location}\n\n` +
          `Aaj ka target poora hua?`;

        await sendButtonMessage(profile.phone, body, [
          { id: "full",        title: "✅ 100% hua" },
          { id: "partial",     title: "⚠️ Thoda hua" },
          { id: "not_started", title: "❌ Shuru nahi hua" },
        ]);

        state.flowPhase = "evening_prompted";
        conversationLog.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: "bot",
          text: body,
          timestamp: new Date(),
          workerName: profile.name,
          workerPhone: profile.phone,
          taskName: profile.taskName,
          projectName: profile.projectName,
          phase: state.flowPhase,
        });
      }

      state.lastUpdated = new Date();
      sent++;
    } catch (err) {
      console.error(`[Trigger] Failed to message ${profile.name}:`, err);
    }
  }

  return NextResponse.json({ success: true, type, timestamp: new Date().toISOString(), workersSentTo: sent });
}
