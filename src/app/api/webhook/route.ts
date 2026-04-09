import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { handleIncomingMessage } from "@/lib/flow-engine";

// ─── GET — Meta webhook verification ─────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming messages ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify Meta webhook signature
    const signature = req.headers.get("x-hub-signature-256");
    if (process.env.WHATSAPP_APP_SECRET && signature) {
      const expected = "sha256=" + createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
        .update(rawBody)
        .digest("hex");
      if (signature !== expected) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const body = JSON.parse(rawBody);

    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const from = message.from as string;
    const type = message.type as string;

    let text = "";
    if (type === "text") {
      text = message.text?.body ?? "";
    } else if (type === "interactive") {
      text =
        message.interactive?.button_reply?.id ??
        message.interactive?.list_reply?.id ??
        "";
    } else if (type === "image") {
      text = "[Photo received]";
    }

    // Fire-and-forget — Meta requires a fast 200 response
    handleIncomingMessage(from, text, type).catch((err) =>
      console.error("[Webhook] handleIncomingMessage error:", err)
    );
  } catch (err) {
    console.error("[Webhook] POST parse error:", err);
  }

  // Always return 200 immediately
  return NextResponse.json({ ok: true });
}
