import { NextRequest, NextResponse } from "next/server";
import { getConversationLog, getPMCAlerts, getWorkerStates } from "@/lib/flow-engine";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    log:    getConversationLog(),
    alerts: getPMCAlerts(),
    states: await getWorkerStates(),
  });
}
