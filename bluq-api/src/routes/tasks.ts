import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { tasks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function tasksRoute(app: FastifyInstance) {

  app.get("/tasks", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
      if (!UUID_REGEX.test(workspaceId) || !UUID_REGEX.test(projectId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }
      const data = await db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.workspaceId, workspaceId)));
      return data;
    } catch (err: any) {
      console.error("GET /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch tasks", details: err.message });
    }
  });

  app.post("/tasks", { preHandler: verifySession }, async (request, reply) => {
    try {
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
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
      }
      const [newTask] = await db.insert(tasks).values(body).returning();
      return reply.status(201).send(newTask);
    } catch (err: any) {
      console.error("POST /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to create task", details: err.message });
    }
  });

  app.patch("/tasks/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, any>;
      const [updated] = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
      if (!updated) return reply.status(404).send({ error: "Task not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update task", details: err.message });
    }
  });

  app.delete("/tasks/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: "Task not found" });
      return { success: true };
    } catch (err: any) {
      console.error("DELETE /tasks error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to delete task", details: err.message });
    }
  });
}