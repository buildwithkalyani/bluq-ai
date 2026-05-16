import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { workspaceRoles, workspaceMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

type PermLevel = "none" | "view" | "upload" | "edit";

export interface RolePermissions {
  overview: PermLevel;
  schedule: PermLevel;
  reports: PermLevel;
  documents: PermLevel;
  siteUpdates: PermLevel;
  team: PermLevel;
  settings: PermLevel;
}

export const DEFAULT_PERMISSIONS: RolePermissions = {
  overview: "view",
  schedule: "view",
  reports: "none",
  documents: "none",
  siteUpdates: "none",
  team: "none",
  settings: "none",
};

const ADMIN_PERMISSIONS: RolePermissions = {
  overview: "edit",
  schedule: "edit",
  reports: "edit",
  documents: "edit",
  siteUpdates: "edit",
  team: "edit",
  settings: "edit",
};

async function requireAdmin(workspaceId: string, userId: string) {
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!m) return false;
  const r = m.role.toLowerCase();
  return r === "admin" || r === "super admin" || r === "superadmin";
}

export async function rolesRoute(app: FastifyInstance) {
  // GET /roles?workspaceId=xxx — list all roles for a workspace
  app.get("/roles", { preHandler: verifySession }, async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const [myMembership] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);
    if (!myMembership) return reply.status(403).send({ error: "Not a member" });

    const roles = await db
      .select()
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, workspaceId));

    return roles;
  });

  // GET /roles/mine?workspaceId=xxx — current user's effective permissions
  app.get("/roles/mine", { preHandler: verifySession }, async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    const [membership] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, request.userId)))
      .limit(1);

    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const roleName = membership.role.toLowerCase();
    // Super admin / admin always get full access
    if (roleName === "super admin" || roleName === "superadmin" || roleName === "admin") {
      return { role: membership.role, permissions: ADMIN_PERMISSIONS };
    }

    // Look up role definition
    const [roleDef] = await db
      .select({ permissions: workspaceRoles.permissions })
      .from(workspaceRoles)
      .where(and(
        eq(workspaceRoles.workspaceId, workspaceId),
        eq(workspaceRoles.name, membership.role)
      ))
      .limit(1);

    return {
      role: membership.role,
      permissions: (roleDef?.permissions as RolePermissions) ?? DEFAULT_PERMISSIONS,
    };
  });

  // POST /roles — create a new role
  app.post("/roles", { preHandler: verifySession }, async (request, reply) => {
    const { workspaceId, name, description, permissions } = request.body as {
      workspaceId: string;
      name: string;
      description?: string;
      permissions?: Partial<RolePermissions>;
    };

    if (!workspaceId || !name?.trim()) {
      return reply.status(400).send({ error: "workspaceId and name required" });
    }

    if (!await requireAdmin(workspaceId, request.userId)) {
      return reply.status(403).send({ error: "Only admins can manage roles" });
    }

    const merged: RolePermissions = { ...DEFAULT_PERMISSIONS, ...permissions };

    const [role] = await db
      .insert(workspaceRoles)
      .values({ workspaceId, name: name.trim(), description: description?.trim() ?? null, permissions: merged })
      .returning();

    return reply.status(201).send(role);
  });

  // PATCH /roles/:id — update role name, description, or permissions
  app.patch("/roles/:id", { preHandler: verifySession }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { workspaceId, name, description, permissions } = request.body as {
      workspaceId: string;
      name?: string;
      description?: string;
      permissions?: Partial<RolePermissions>;
    };

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    if (!await requireAdmin(workspaceId, request.userId)) {
      return reply.status(403).send({ error: "Only admins can manage roles" });
    }

    const [existing] = await db
      .select()
      .from(workspaceRoles)
      .where(and(eq(workspaceRoles.id, id), eq(workspaceRoles.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: "Role not found" });

    const updates: Partial<typeof workspaceRoles.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim() || null;
    if (permissions !== undefined) {
      updates.permissions = { ...(existing.permissions as RolePermissions), ...permissions };
    }

    const [updated] = await db
      .update(workspaceRoles)
      .set(updates)
      .where(eq(workspaceRoles.id, id))
      .returning();

    return updated;
  });

  // DELETE /roles/:id?workspaceId=xxx
  app.delete("/roles/:id", { preHandler: verifySession }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { workspaceId } = request.query as { workspaceId: string };

    if (!workspaceId) return reply.status(400).send({ error: "workspaceId required" });

    if (!await requireAdmin(workspaceId, request.userId)) {
      return reply.status(403).send({ error: "Only admins can manage roles" });
    }

    await db
      .delete(workspaceRoles)
      .where(and(eq(workspaceRoles.id, id), eq(workspaceRoles.workspaceId, workspaceId)));

    return { ok: true };
  });
}
