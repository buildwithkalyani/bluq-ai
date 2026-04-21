// =============================================================================
// ORGS (WORKSPACES) ROUTE
// =============================================================================
// Every user must belong to an org (workspace) before they can create projects.
// This is the onboarding step: user creates their company/firm after signup.
//
// Endpoints:
//   POST /orgs          — create a new org + add creator as admin
//   GET  /orgs/mine     — list orgs the current user belongs to
// =============================================================================

import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { orgs, users, workspaceMembers } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const LOGOS_BUCKET = "org-logos";

export async function orgsRoute(app: FastifyInstance) {
  // =========================================================================
  // POST /orgs — create workspace + add creator as admin
  // =========================================================================
  app.post("/orgs", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { name } = request.body as { name?: string };
      if (!name?.trim()) {
        return reply.status(400).send({ error: "name is required" });
      }

      // Create the org
      const [org] = await db
        .insert(orgs)
        .values({ name: name.trim() })
        .returning();

      // Add creator as admin (active, no invite flow)
      await db.insert(workspaceMembers).values({
        workspaceId: org.id,
        userId: request.userId,
        role: "admin",
        status: "active",
        joinedAt: new Date().toISOString(),
      });

      return reply.status(201).send(org);
    } catch (err: any) {
      console.error("POST /orgs error:", err.message);
      return reply.status(500).send({ error: "Failed to create workspace" });
    }
  });

  // =========================================================================
  // GET /orgs/mine — list workspaces the current user belongs to
  // =========================================================================
  app.get("/orgs/mine", { preHandler: verifySession }, async (request, reply) => {
    try {
      const memberships = await db
        .select({
          orgId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, request.userId));

      if (memberships.length === 0) return reply.send([]);

      const orgIds = memberships.map((m) => m.orgId);
      const orgRows = await db
        .select()
        .from(orgs)
        .where(inArray(orgs.id, orgIds));

      return orgRows.map((o) => ({
        ...o,
        role: memberships.find((m) => m.orgId === o.id)?.role ?? "member",
      }));
    } catch (err: any) {
      console.error("GET /orgs/mine error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch workspaces" });
    }
  });

  // =========================================================================
  // GET /orgs/logo-upload-url — generate a signed upload URL for org logo
  // =========================================================================
  app.get("/orgs/logo-upload-url", { preHandler: verifySession }, async (request, reply) => {
    const { orgId, fileName } = request.query as { orgId: string; fileName: string };
    if (!orgId || !fileName) {
      return reply.status(400).send({ error: "orgId and fileName required" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return reply.status(500).send({ error: "Storage not configured" });
    }

    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase() || ".png";
    const storagePath = `${orgId}/${Date.now()}${ext}`;

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/upload/sign/${LOGOS_BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 300 }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      return reply.status(500).send({ error: body.message ?? "Failed to generate upload URL" });
    }

    const { url } = await res.json() as { url: string };
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${LOGOS_BUCKET}/${storagePath}`;
    return { signedUrl: `${supabaseUrl}/storage/v1${url}`, publicUrl };
  });

  // =========================================================================
  // PATCH /orgs/:id — update org name / logoUrl
  // =========================================================================
  app.patch("/orgs/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; logoUrl?: string };

      const membership = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, id))
        .then((rows) => rows.find((r) => r.userId === request.userId));

      if (!membership) return reply.status(403).send({ error: "Not a member of this workspace" });

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;

      const [updated] = await db.update(orgs).set(updates).where(eq(orgs.id, id)).returning();
      if (!updated) return reply.status(404).send({ error: "Org not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /orgs/:id error:", err.message);
      return reply.status(500).send({ error: "Failed to update org" });
    }
  });

  // =========================================================================
  // GET /users/me — current user profile
  // =========================================================================
  app.get("/users/me", { preHandler: verifySession }, async (request, reply) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, request.userId));
      if (!user) return reply.status(404).send({ error: "User not found" });
      return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? "" };
    } catch (err: any) {
      console.error("GET /users/me error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch user" });
    }
  });

  // =========================================================================
  // PATCH /users/me — update current user name / phone
  // =========================================================================
  app.patch("/users/me", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as { name?: string; phone?: string };
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.phone !== undefined) updates.phone = body.phone.trim() || null;

      const [updated] = await db.update(users).set(updates).where(eq(users.id, request.userId)).returning();
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone ?? "" };
    } catch (err: any) {
      console.error("PATCH /users/me error:", err.message);
      return reply.status(500).send({ error: "Failed to update user" });
    }
  });
}
