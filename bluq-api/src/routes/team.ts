import { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db/client.js";
import { users, workspaceMembers, projects, orgs, projectMembers } from "../db/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const SECRET = () => process.env.BETTER_AUTH_SECRET ?? "bluq-invite-secret";

function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): Record<string, any> | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET()).update(data).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function sendInviteEmail(opts: {
  to: string;
  inviteeName: string;
  inviterName: string;
  orgName: string;
  inviteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[team-invite] RESEND_API_KEY not set. Invite URL:", opts.inviteUrl);
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL ?? "BluQ <no-reply@bluq.ai>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: `${opts.inviterName} invited you to join ${opts.orgName} on BluQ`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
          <img src="https://bluq.ai/bluq-logo.png" alt="BluQ" style="height:18px;margin-bottom:28px" />
          <h2 style="font-size:20px;color:#24292f;margin:0 0 8px">You've been invited to ${opts.orgName}</h2>
          <p style="color:#57606a;font-size:14px;margin:0 0 8px">
            <strong>${opts.inviterName}</strong> has added you as a team member on BluQ — the construction project management platform used by ${opts.orgName}.
          </p>
          <p style="color:#57606a;font-size:14px;margin:0 0 28px">
            Once you join, you'll have access to all projects, schedules, daily reports, and site updates for your organisation.
          </p>
          <a href="${opts.inviteUrl}"
             style="display:inline-block;background:#3A4EA2;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;margin-bottom:28px">
            Join ${opts.orgName} on BluQ →
          </a>
          <p style="color:#8C959F;font-size:12px;margin:0">
            This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[team-invite] Resend failed:", res.status, body);
  }
}

export async function teamRoute(app: FastifyInstance) {
  // POST /team/invite
  // Generates a signed invite token and emails it to the new team member.
  app.post("/team/invite", { preHandler: verifySession }, async (request, reply) => {
    const { email, name, role, workspaceId } = request.body as {
      email: string; name: string; role: string; workspaceId: string;
    };
    if (!email || !workspaceId) return reply.status(400).send({ error: "email and workspaceId required" });

    const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, workspaceId)).limit(1);
    const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, request.userId)).limit(1);

    const token = signToken({
      email,
      name,
      role,
      workspaceId,
      orgName: org?.name ?? "your organisation",
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? "https://bluq.ai";
    const inviteUrl = `${frontendUrl}/invite?token=${token}`;

    await sendInviteEmail({
      to: email,
      inviteeName: name,
      inviterName: inviter?.name ?? "A team member",
      orgName: org?.name ?? "your organisation",
      inviteUrl,
    });

    return { ok: true };
  });

  // GET /team/invite/verify?token=xxx
  // Returns invite details so the UI can show "You're invited to X by Y".
  app.get("/team/invite/verify", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: "token required" });
    const payload = verifyToken(token);
    if (!payload) return reply.status(400).send({ error: "Invalid or expired invite link" });
    return {
      email: payload.email,
      name: payload.name,
      role: payload.role,
      workspaceId: payload.workspaceId,
      orgName: payload.orgName,
    };
  });

  // GET /team/invite-link — general workspace invite link (no email required)
  app.get("/team/invite-link", { preHandler: verifySession }, async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, workspaceId)).limit(1);
    const token = signToken({
      workspaceId,
      orgName: org?.name ?? "your organisation",
      general: true,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? "https://bluq.ai";
    return { inviteUrl: `${frontendUrl}/invite?token=${token}` };
  });

  // GET /team/members?workspaceId=xxx — list workspace members with user info
  app.get("/team/members", { preHandler: verifySession }, async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const [myMembership] = await db.select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);
    if (!myMembership) return reply.status(403).send({ error: "Not a member" });

    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
        joinedAt: workspaceMembers.joinedAt,
        invitedAt: workspaceMembers.invitedAt,
        name: users.name,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    // Attach project access counts
    const userIds = members.map(m => m.userId);
    const projectCounts = userIds.length > 0
      ? await db
          .select({ userId: projectMembers.userId, cnt: sql<number>`count(*)::int` })
          .from(projectMembers)
          .where(and(eq(projectMembers.workspaceId, workspaceId), inArray(projectMembers.userId, userIds)))
          .groupBy(projectMembers.userId)
      : [];

    const countMap = Object.fromEntries(projectCounts.map(r => [r.userId, r.cnt]));
    return members.map(m => ({ ...m, projectCount: countMap[m.userId] ?? 0 }));
  });

  // DELETE /team/members/:memberId?workspaceId=xxx — remove a workspace member
  app.delete("/team/members/:memberId", { preHandler: verifySession }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const [myMembership] = await db.select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);
    if (!myMembership || !["admin", "super admin", "superadmin"].includes(myMembership.role.toLowerCase())) {
      return reply.status(403).send({ error: "Only admins can remove members" });
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId));
    return { ok: true };
  });

  // PATCH /team/members/:memberId/role — update a member's role
  app.patch("/team/members/:memberId/role", { preHandler: verifySession }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const { role, workspaceId } = request.body as { role: string; workspaceId: string };

    const [myMembership] = await db.select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);
    if (!myMembership || !["admin", "super admin", "superadmin"].includes(myMembership.role.toLowerCase())) {
      return reply.status(403).send({ error: "Only admins can change roles" });
    }

    await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId));
    return { ok: true };
  });

  // GET /team/members/:userId/projects?workspaceId=xxx — project access for one user
  app.get("/team/members/:userId/projects", { preHandler: verifySession }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const rows = await db.select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.workspaceId, workspaceId), eq(projectMembers.userId, userId)));

    return rows.map(r => r.projectId);
  });

  // PUT /team/members/:userId/projects — set full project access for one user
  app.put("/team/members/:userId/projects", { preHandler: verifySession }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { workspaceId, projectIds } = request.body as { workspaceId: string; projectIds: string[] };

    const [myMembership] = await db.select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);
    if (!myMembership || !["admin", "super admin", "superadmin"].includes(myMembership.role.toLowerCase())) {
      return reply.status(403).send({ error: "Only admins can manage project access" });
    }

    // Get the member's workspace_member row to find their role
    const [member] = await db.select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    // Delete all existing and re-insert
    await db.delete(projectMembers).where(
      and(eq(projectMembers.workspaceId, workspaceId), eq(projectMembers.userId, userId))
    );

    if (projectIds.length > 0) {
      await db.insert(projectMembers).values(
        projectIds.map(projectId => ({
          workspaceId,
          projectId,
          userId,
          role: member?.role ?? "member",
          access: "editor" as const,
        }))
      );
    }

    return { ok: true };
  });

  // POST /team/invite/accept
  // Called after the user is logged in. Adds them to the workspace.
  app.post("/team/invite/accept", { preHandler: verifySession }, async (request, reply) => {
    const { token } = request.body as { token: string };
    if (!token) return reply.status(400).send({ error: "token required" });

    const payload = verifyToken(token);
    if (!payload) return reply.status(400).send({ error: "Invalid or expired invite link" });

    const { workspaceId, role } = payload;

    const [user] = await db.select({ email: users.email, name: users.name })
      .from(users).where(eq(users.id, request.userId)).limit(1);

    if (!user) return reply.status(404).send({ error: "User not found" });

    // Email-specific invites: verify the logged-in user matches
    if (!payload.general && payload.email) {
      if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
        return reply.status(403).send({ error: "This invite was sent to a different email address" });
      }
    }

    // Add to workspace if not already a member
    const [existing] = await db.select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);

    if (!existing) {
      await db.insert(workspaceMembers).values({
        workspaceId,
        userId: request.userId,
        role: role ?? "member",
        status: "active",
        joinedAt: new Date().toISOString(),
      });
    }

    return { ok: true, workspaceId };
  });
}
