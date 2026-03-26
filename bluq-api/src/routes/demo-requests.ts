import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { demoRequests } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sendConfirmationEmail(to: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "BLUQ <no-reply@bluq.ai>",
        to: [to],
        subject: "We got your demo request — BLUQ",
        html: `
          <div style="font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="padding: 32px 0; border-bottom: 2px solid #2563eb;">
              <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #2563eb;">BLUQ</h1>
            </div>
            <div style="padding: 32px 0;">
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi from ${companyName},</p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Thanks for requesting a demo of BLUQ! We're excited to show you how AI-powered
                project management can transform your construction workflows.
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Our team will reach out within 24 hours to schedule a personalized walkthrough.
                You can also reach us directly on WhatsApp for a quicker response.
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 4px;">— The BLUQ Team</p>
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
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "BLUQ <no-reply@bluq.ai>",
        to: [notifyEmail],
        subject: `New demo request from ${req.companyName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; color: #1a1a1a;">
            <h2 style="color: #2563eb;">New Demo Request</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: 600;">Firm</td><td style="padding: 8px 0;">${req.companyName}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: 600;">Email</td><td style="padding: 8px 0;">${req.email}</td></tr>
              ${req.name ? `<tr><td style="padding: 8px 0; font-weight: 600;">Contact</td><td style="padding: 8px 0;">${req.name}</td></tr>` : ""}
              ${req.phone ? `<tr><td style="padding: 8px 0; font-weight: 600;">Phone</td><td style="padding: 8px 0;">${req.phone}</td></tr>` : ""}
              ${req.companySize ? `<tr><td style="padding: 8px 0; font-weight: 600;">Size</td><td style="padding: 8px 0;">${req.companySize}</td></tr>` : ""}
              ${req.message ? `<tr><td style="padding: 8px 0; font-weight: 600;">Message</td><td style="padding: 8px 0;">${req.message}</td></tr>` : ""}
            </table>
          </div>
        `,
      }),
    });
  } catch (err: any) {
    console.error("Internal notification failed:", err.message);
  }
}

export async function demoRequestsRoute(app: FastifyInstance) {

  // POST /demo-requests — public, called from landing page form
  app.post("/demo-requests", async (request, reply) => {
    try {
      const body = request.body as {
        companyName: string;  // required
        email: string;        // required
        name?: string;        // optional contact person
        phone?: string;       // optional
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
      return reply.status(500).send({ error: "Failed to submit demo request", details: err.message });
    }
  });

  // GET /demo-requests — internal admin use
  app.get("/demo-requests", async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const data = status
        ? await db.select().from(demoRequests).where(eq(demoRequests.status, status)).orderBy(desc(demoRequests.createdAt))
        : await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
      return data;
    } catch (err: any) {
      console.error("GET /demo-requests error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch demo requests", details: err.message });
    }
  });

  // PATCH /demo-requests/:id — update status
  app.patch("/demo-requests/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, any>;
      const [updated] = await db
        .update(demoRequests)
        .set({ ...body, updatedAt: new Date().toISOString() })
        .where(eq(demoRequests.id, id))
        .returning();
      if (!updated) return reply.status(404).send({ error: "Demo request not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /demo-requests error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update demo request", details: err.message });
    }
  });
}