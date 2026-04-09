import { NextRequest, NextResponse } from "next/server";
import { getWorkersForToday, getWorkerStates, initWorkerState, saveState } from "@/lib/flow-engine";
import { sendButtonMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workers = await getWorkersForToday();
  const existingStates = await getWorkerStates();
  let sent = 0;

  for (const profile of workers) {
    const existingState = existingStates.find((s) => s.phone === profile.phone);
    if (existingState?.flowPhase === "complete") continue;

    try {
      const state = existingState ?? await initWorkerState(profile);

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
      state.lastUpdated = new Date();
      await saveState(state);

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
    } catch (err) {
      console.error(`[Cron/Evening] Failed to message ${profile.name}:`, err);
    }
  }

  return NextResponse.json({ success: true, workersSentTo: sent });
}
