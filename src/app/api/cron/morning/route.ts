import { NextRequest, NextResponse } from "next/server";
import { getWorkersForToday, initWorkerState } from "@/lib/flow-engine";
import { sendButtonMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workers = await getWorkersForToday();
  console.log(`[Cron/Morning] Workers found: ${workers.length}`, workers.map(w => w.name));
  let sent = 0;

  for (const profile of workers) {
    try {
      const state = await initWorkerState(profile);

      const fName = profile.name.split(" ")[0];
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

      // Log the outgoing bot message
      const { conversationLog } = await import("@/lib/flow-engine");
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

      sent++;
    } catch (err: any) {
      console.error(`[Cron/Morning] Failed to message ${profile.name}:`, err?.message ?? err);
    }
  }

  return NextResponse.json({ success: true, workersSentTo: sent });
}
