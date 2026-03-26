import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { demoRequests } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendConfirmationEmail(to: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "BluQ <no-reply@bluq.ai>",
        reply_to: "aishnakalyani@gmail.com",
        to: [to],
        subject: "Scheduling your BluQ Demo",
        html: `
          <div style="font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="padding: 32px 0; border-bottom: 2px solid #2563eb;">
              <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #2563eb;">BluQ</h1>
            </div>
            <div style="padding: 32px 0;">
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi,</p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Thanks for your interest in BluQ. We're excited to show you how our AI-powered
                project management platform can streamline your construction workflows and reduce project leakages.
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Our team is currently reviewing your request and will reach out within 24 hours
                to schedule a personalized walkthrough.
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Want to skip the wait? Message us directly on WhatsApp to coordinate a time immediately:
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 4px;">
                <a href="https://wa.me/919921118937" style="color: #2563eb; text-decoration: none;">+91 99211 18937</a>
                &nbsp;|&nbsp;
                <a href="https://wa.me/918290870000" style="color: #2563eb; text-decoration: none;">+91 82908 70000</a>
              </p>
              <br/>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 4px;">— The BluQ Team</p>
              <p style="font-size: 13px; color: #6b7280; margin: 0;">
                <a href="https://bluq.ai" style="color: #2563eb; text-decoration: none;">bluq.ai</a>
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend API error:", res.status, errBody);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Resend send failed:", err.message);
    return false;
  }
}

async function sendInternalNotification(req: {
  companyName: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  companySize?: string | null;
  role?: string | null;
  message?: string | null;
}): Promise<void> {
  const notifyEmail = process.env.DEMO_NOTIFY_EMAIL;
  if (!notifyEmail) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "BluQ <no-reply@bluq.ai>",
        to: [notifyEmail],
        subject: `New demo request from ${req.companyName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; color: #1a1a1a;">
            <h2 style="color: #2563eb;">New Demo Request</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: 600;">Firm</td><td style="padding: 8px 0;">${escapeHtml(req.companyName)}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: 600;">Email</td><td style="padding: 8px 0;">${escapeHtml(req.email)}</td></tr>
              ${req.name ? `<tr><td style="padding: 8px 0; font-weight: 600;">Contact</td><td style="padding: 8px 0;">${escapeHtml(req.name)}</td></tr>` : ""}
              ${req.phone ? `<tr><td style="padding: 8px 0; font-weight: 600;">Phone</td><td style="padding: 8px 0;">${escapeHtml(req.phone)}</td></tr>` : ""}
              ${req.companySize ? `<tr><td style="padding: 8px 0; font-weight: 600;">Size</td><td style="padding: 8px 0;">${escapeHtml(req.companySize)}</td></tr>` : ""}
              ${req.message ? `<tr><td style="padding: 8px 0; font-weight: 600;">Message</td><td style="padding: 8px 0;">${escapeHtml(req.message)}</td></tr>` : ""}
            </table>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("Internal notification API error:", res.status, errBody);
    }
  } catch (err: any) {
    console.error("Internal notification failed:", err.message);
  }
}

export async function demoRequestsRoute(app: FastifyInstance) {

  app.post("/demo-requests", async (request, reply) => {
    try {
      const body = request.body as {
        companyName: string;
        email: string;
        name?: string;
        phone?: string;
        companySize?: string;
        role?: string;
        message?: string;
        source?: string;
      };

      if (!body.companyName?.trim() || !body.email?.trim()) {
        return reply.status(400).send({ error: "companyName and email are required" });
      }
      if (!EMAIL_REGEX.test(body.email)) {
        return reply.status(400).send({ error: "Invalid email format" });
      }

      const [demoRequest] = await db
        .insert(demoRequests)
        .values({
          companyName: body.companyName.trim(),
          email: body.email.trim().toLowerCase(),
          name: body.name?.trim() || null,
          phone: body.phone?.trim() || null,
          companySize: body.companySize?.trim() || null,
          role: body.role?.trim() || null,
          message: body.message?.trim() || null,
          source: body.source || "website",
        })
        .returning();

      const emailSent = await sendConfirmationEmail(demoRequest.email, demoRequest.companyName);

      if (emailSent) {
        await db
          .update(demoRequests)
          .set({ emailSent: true })
          .where(eq(demoRequests.id, demoRequest.id));
      }

      sendInternalNotification(demoRequest).catch(() => {});

      return reply.status(201).send({
        success: true,
        id: demoRequest.id,
        emailSent,
      });
    } catch (err: any) {
      console.error("POST /demo-requests error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to submit demo request" });
    }
  });

  app.get("/demo-requests", async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const data = status
        ? await db.select().from(demoRequests).where(eq(demoRequests.status, status)).orderBy(desc(demoRequests.createdAt))
        : await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
      return data;
    } catch (err: any) {
      console.error("GET /demo-requests error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch demo requests" });
    }
  });

  app.patch("/demo-requests/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, unknown>;
      const allowedKeys = new Set(["status", "name", "phone", "companySize", "role", "message", "source"]);
      const updates = Object.fromEntries(Object.entries(body).filter(([key]) => allowedKeys.has(key)));
      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: "No allowed fields to update" });
      }
      const [updated] = await db
        .update(demoRequests)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(demoRequests.id, id))
        .returning();
      if (!updated) return reply.status(404).send({ error: "Demo request not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /demo-requests error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update demo request" });
    }
  });
}