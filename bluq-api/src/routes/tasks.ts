import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { tasks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export async function tasksRoute(app: FastifyInstance) {

  app.get("/tasks", async (request, reply) => {
    const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
    if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
    const data = await db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.workspaceId, workspaceId)));
    return data;
  });

  app.post("/tasks", async (request, reply) => {
    const body = request.body as {
      workspaceId: string;
      projectId: string;
      title: string;
      description?: string;
      assignedTo?: string;
      status?: string;
      priority?: string;
      startDate?: string;
      endDate?: string;
      durationDays?: number;
      contractor?: string;
      area?: string;
      isMilestone?: boolean;
      parentTaskId?: string;
      sortOrder?: number;
    };
    if (!body.workspaceId || !body.projectId || !body.title) return reply.status(400).send({ error: "workspaceId, projectId, title required" });
    const [newTask] = await db.insert(tasks).values(body).returning();
    return reply.status(201).send(newTask);
  });

  app.patch("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const [updated] = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "Task not found" });
    return updated;
  });

  app.delete("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!deleted) return reply.status(404).send({ error: "Task not found" });
    return { success: true };
  });
}