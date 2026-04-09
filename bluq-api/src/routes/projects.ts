import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function projectsRoute(app: FastifyInstance) {

  app.get("/projects", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { workspaceId } = request.query as { workspaceId: string };
      if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
      if (!UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "workspaceId must be a valid UUID" });
      }
      const data = await db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
      return data;
    } catch (err: any) {
      console.error("GET /projects error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch projects", details: err.message });
    }
  });

  app.post("/projects", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId: string;
        projectName: string;
        projectCode?: string;
        clientName?: string;
        address?: string;
        category?: string;
        stage?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
        createdBy?: string;
      };
      if (!body.workspaceId || !body.projectName) return reply.status(400).send({ error: "workspaceId and projectName required" });
      if (!UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({ error: "workspaceId must be a valid UUID" });
      }
      const [newProject] = await db.insert(projects).values(body).returning();
      return reply.status(201).send(newProject);
    } catch (err: any) {
      console.error("POST /projects error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to create project", details: err.message });
    }
  });

  app.patch("/projects/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, any>;
      const [updated] = await db.update(projects).set(body).where(eq(projects.id, id)).returning();
      if (!updated) return reply.status(404).send({ error: "Project not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /projects error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update project", details: err.message });
    }
  });

  app.delete("/projects/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: "Project not found" });
      return { success: true };
    } catch (err: any) {
      console.error("DELETE /projects error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to delete project", details: err.message });
    }
  });
}