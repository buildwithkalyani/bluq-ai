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
import { orgs, workspaceMembers } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

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
}
