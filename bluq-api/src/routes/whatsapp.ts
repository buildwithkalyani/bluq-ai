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
import { db } from "../db/client.js";
import { whatsappUpdates, tasks, dprPhotos, projects } from "../db/schema.js";
import { sendText, sendTemplate } from "../lib/whatsapp-send.js";
import { eq, and, desc } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

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

  // ─── FEED: CONVERSATIONS LIST ─────────────────────────────────────────────
  // GET /whatsapp/feed?projectId=xxx
  // Returns one "conversation" per unique senderPhone, using latest message.
  app.get("/whatsapp/feed", { preHandler: verifySession }, async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const rows = await db
      .select({
        id: whatsappUpdates.id,
        senderPhone: whatsappUpdates.senderPhone,
        senderName: whatsappUpdates.senderName,
        rawMessage: whatsappUpdates.rawMessage,
        parsedJson: whatsappUpdates.parsedJson,
        matchedTaskId: whatsappUpdates.matchedTaskId,
        receivedAt: whatsappUpdates.receivedAt,
        status: whatsappUpdates.status,
      })
      .from(whatsappUpdates)
      .where(eq(whatsappUpdates.projectId, projectId))
      .orderBy(desc(whatsappUpdates.receivedAt));

    // Group by senderPhone — keep latest message per phone
    const byPhone = new Map<string, typeof rows[number]>();
    const countByPhone = new Map<string, number>();
    for (const row of rows) {
      countByPhone.set(row.senderPhone, (countByPhone.get(row.senderPhone) ?? 0) + 1);
      if (!byPhone.has(row.senderPhone)) byPhone.set(row.senderPhone, row);
    }

    // Fetch task titles for matched tasks
    const taskIds = [...new Set([...byPhone.values()].map(r => r.matchedTaskId).filter(Boolean))] as string[];
    const allTaskRows = taskIds.length > 0
      ? await Promise.all(taskIds.map(tid =>
          db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(eq(tasks.id, tid)).limit(1)
            .then(r => r[0])
        ))
      : [];
    const taskMap = new Map(allTaskRows.filter(Boolean).map(t => [t!.id, t!.title]));

    const convos = [...byPhone.values()].map(row => {
      const parsed = row.parsedJson as any;
      const hasIssue = !!(parsed?.delayReason || parsed?.issueDesc);
      const pct = parsed?.percentComplete;
      const taskTitle = row.matchedTaskId ? (taskMap.get(row.matchedTaskId) ?? "Unknown Task") : row.rawMessage.slice(0, 40);

      let status = "In Progress";
      let color = "#9A6700";
      if (hasIssue) { status = "⚠️ Issue Reported"; color = "#CF222E"; }
      else if (pct === 100) { status = "✅ Complete"; color = "#1A7F37"; }
      else if (pct != null) { status = `${pct}% complete`; color = "#3A4EA2"; }

      const receivedAt = row.receivedAt ? new Date(row.receivedAt) : new Date();
      const timeStr = receivedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      return {
        id: row.id,
        senderPhone: row.senderPhone,
        name: row.senderName ?? row.senderPhone,
        trade: null as string | null,
        type: hasIssue ? "Warning" : "EOD",
        time: timeStr,
        status,
        task: taskTitle,
        color,
        messageCount: countByPhone.get(row.senderPhone) ?? 1,
        lastMessage: row.rawMessage,
        receivedAt: row.receivedAt,
        hasMessages: true,
      };
    });

    // Merge in linked contractors who haven't sent any messages yet
    const projectRow = await db
      .select({ settingsJson: projects.settingsJson })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then(r => r[0]);

    const linkedContractors: { id: string; name: string; phone: string; trade: string }[] =
      (projectRow?.settingsJson as any)?.contractors ?? [];

    const phonesWithMessages = new Set(convos.map(c => c.senderPhone));

    for (const contractor of linkedContractors) {
      // Normalize: strip leading + or country code variations for comparison
      const normalizedPhone = contractor.phone.replace(/\D/g, "");
      const alreadyPresent = [...phonesWithMessages].some(p => p.replace(/\D/g, "").endsWith(normalizedPhone) || normalizedPhone.endsWith(p.replace(/\D/g, "")));
      if (alreadyPresent) continue;

      convos.push({
        id: `contractor-${contractor.id}`,
        senderPhone: contractor.phone,
        name: contractor.name,
        trade: contractor.trade,
        type: "EOD",
        time: "—",
        status: "Awaiting first update",
        task: "No messages yet",
        color: "#8C959F",
        messageCount: 0,
        lastMessage: "",
        receivedAt: null,
        hasMessages: false,
      });
    }

    return convos;
  });

  // ─── FEED: MESSAGES FOR A CONVERSATION ───────────────────────────────────
  // GET /whatsapp/feed/messages?projectId=xxx&senderPhone=xxx
  app.get("/whatsapp/feed/messages", { preHandler: verifySession }, async (request, reply) => {
    const { projectId, senderPhone } = request.query as { projectId?: string; senderPhone?: string };
    if (!projectId || !senderPhone) return reply.status(400).send({ error: "projectId and senderPhone required" });

    const rows = await db
      .select({
        id: whatsappUpdates.id,
        rawMessage: whatsappUpdates.rawMessage,
        parsedJson: whatsappUpdates.parsedJson,
        receivedAt: whatsappUpdates.receivedAt,
        matchedTaskId: whatsappUpdates.matchedTaskId,
        status: whatsappUpdates.status,
      })
      .from(whatsappUpdates)
      .where(and(
        eq(whatsappUpdates.projectId, projectId),
        eq(whatsappUpdates.senderPhone, senderPhone),
      ))
      .orderBy(desc(whatsappUpdates.receivedAt));

    // Fetch photo count for this project+phone combo
    const photoRows = await db
      .select({ id: dprPhotos.id })
      .from(dprPhotos)
      .where(eq(dprPhotos.projectId, projectId));

    return { messages: rows, photoCount: photoRows.length };
  });

  // ─── WELCOME MESSAGE ─────────────────────────────────────────────────────
  // POST /whatsapp/send-welcome
  // Called when a contractor is added to a project. Sends a personalised
  // onboarding message so they know the Bluq bot will reach out daily.
  app.post("/whatsapp/send-welcome", { preHandler: verifySession }, async (request, reply) => {
    const { phone, contractorName, projectName } = request.body as {
      phone?: string;
      contractorName?: string;
      projectName?: string;
    };
    if (!phone || !contractorName || !projectName) {
      return reply.status(400).send({ error: "phone, contractorName, projectName required" });
    }

    // Credentials check — fail fast with a clear message instead of a cryptic Meta 401
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      console.warn("[whatsapp] send-welcome skipped — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set");
      return reply.status(503).send({ error: "WhatsApp not configured on this environment" });
    }

    // Normalise phone: strip leading + (Meta API expects E.164 without +)
    const normalised = phone.replace(/^\+/, "");

    try {
      await sendTemplate(normalised, "contractor_welcome", "en", [
        {
          type: "body",
          parameters: [
            { type: "text", text: contractorName },
            { type: "text", text: projectName },
          ],
        },
      ]);
      console.log(`[whatsapp] Welcome sent to ${normalised} (${contractorName})`);
      return { ok: true };
    } catch (err: any) {
      console.error("[whatsapp] Failed to send welcome to", normalised, err.message);
      return reply.status(500).send({ error: err.message });
    }
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
