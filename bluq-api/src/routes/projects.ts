import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function projectsRoute(app: FastifyInstance) {

  app.get("/projects", async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    const data = await db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
    return data;
  });

  app.post("/projects", async (request, reply) => {
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
    const [newProject] = await db.insert(projects).values(body).returning();
    return reply.status(201).send(newProject);
  });

  app.patch("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const [updated] = await db.update(projects).set(body).where(eq(projects.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "Project not found" });
    return updated;
  });

  app.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
    if (!deleted) return reply.status(404).send({ error: "Project not found" });
    return { success: true };
  });
}