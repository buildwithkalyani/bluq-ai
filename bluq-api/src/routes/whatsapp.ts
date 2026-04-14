// =============================================================================
// WHATSAPP WEBHOOK ROUTE
// =============================================================================
// Two endpoints required by Meta:
//
//   GET  /webhook/whatsapp  — One-time verification when setting up the webhook
//                             in Meta Developer Console. Returns hub.challenge.
//
//   POST /webhook/whatsapp  — Incoming messages from site workers.
//                             ACKs Meta immediately (200 OK), then enqueues
//                             each message to "whatsapp-processor" BullMQ queue.
//                             Never auth-gated — Meta calls this directly.
//
// Env vars required:
//   WHATSAPP_VERIFY_TOKEN   — arbitrary secret you set in Meta Developer Console
// =============================================================================

import { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { whatsappQueue } from "../lib/queues.js";

// ---------------------------------------------------------------------------
// WEBHOOK SIGNATURE VERIFICATION (X-Hub-Signature-256)
// Meta signs every POST body with HMAC-SHA256 using WHATSAPP_APP_SECRET.
// Reject any request that fails — prevents spoofed webhook calls.
// ---------------------------------------------------------------------------
function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    // timingSafeEqual prevents timing attacks
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// Shape of a single message inside Meta's webhook payload
interface MetaMessage {
  from: string;       // sender phone e.g. "918290870000"
  id: string;         // wamid.XXX — Meta's message ID
  type: string;       // "text" | "interactive" | "image" | "document" | ...
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  image?: {
    id: string;         // Media ID — use this to download from Meta Graph API
    mime_type?: string; // e.g. "image/jpeg"
    caption?: string;   // optional caption the worker typed alongside the photo
  };
}

export async function whatsappRoute(app: FastifyInstance) {
  // ─── WEBHOOK VERIFICATION ─────────────────────────────────────────────────
  // Meta calls this GET once when you configure the webhook URL.
  // Must return hub.challenge as plain text.
  app.get("/webhook/whatsapp", async (request, reply) => {
    const q = request.query as Record<string, string>;
    if (
      q["hub.mode"] === "subscribe" &&
      q["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return reply.status(200).send(q["hub.challenge"]);
    }
    return reply.status(403).send("Forbidden");
  });

  // ─── INCOMING MESSAGES ────────────────────────────────────────────────────
  // Meta sends a POST for every message. Must ACK within 20 seconds.
  // We verify the signature first, then reply immediately and enqueue.
  app.post("/webhook/whatsapp", async (request, reply) => {
    // Verify Meta's HMAC-SHA256 signature
    const rawBody = (request as any).rawBody as Buffer | undefined;
    const signature = request.headers["x-hub-signature-256"] as string | undefined;

    if (rawBody && !verifyMetaSignature(rawBody, signature)) {
      return reply.status(403).send("Invalid signature");
    }

    // ACK Meta immediately — never block on processing
    reply.status(200).send("OK");

    const body = request.body as any;
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore non-message events (read receipts, status updates, etc.)
    if (!value?.messages?.length) return;

    const contacts: { wa_id: string; profile: { name: string } }[] =
      value.contacts ?? [];

    for (const msg of value.messages as MetaMessage[]) {
      const senderPhone = msg.from;
      const senderName =
        contacts.find((c) => c.wa_id === senderPhone)?.profile?.name ?? null;

      // Extract the message text / button ID / list selection ID
      let messageText = "";
      let mediaId: string | null = null;
      let mediaMimeType: string | null = null;

      if (msg.type === "text") {
        messageText = msg.text?.body ?? "";
      } else if (msg.type === "interactive") {
        messageText =
          msg.interactive?.button_reply?.id ??
          msg.interactive?.list_reply?.id ??
          "";
      } else if (msg.type === "image") {
        messageText = "[image]";
        mediaId = msg.image?.id ?? null;
        mediaMimeType = msg.image?.mime_type ?? "image/jpeg";
      }

      try {
        await whatsappQueue.add("process-message", {
          metaMessageId: msg.id,
          senderPhone,
          senderName,
          messageText,
          messageType: msg.type,
          mediaId,
          mediaMimeType,
        });
      } catch (err: any) {
        // Log but never throw — Meta must always get 200
        console.error("[whatsapp-route] Failed to enqueue:", senderPhone, err.message);
      }
    }
  });
}
