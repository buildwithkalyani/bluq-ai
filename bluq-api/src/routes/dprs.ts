import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { dprs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function dprsRoute(app: FastifyInstance) {

  app.get("/dprs", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
      if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
      if (!UUID_REGEX.test(workspaceId) || !UUID_REGEX.test(projectId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }
      const data = await db.select().from(dprs).where(and(eq(dprs.projectId, projectId), eq(dprs.workspaceId, workspaceId))).orderBy(desc(dprs.reportDate));
      return data;
    } catch (err: any) {
      console.error("GET /dprs error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to fetch DPRs", details: err.message });
    }
  });

  app.post("/dprs", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId: string;
        projectId: string;
        taskId?: string;
        reportedBy?: string;
        reportDate?: string;
        labourCount?: number;
        workDone?: string;
        percentComplete?: string;
        remarks?: string;
        delayReason?: string;
        delayDays?: number;
        source?: "whatsapp" | "web";
        whatsappUpdateId?: string;
      };
      if (!body.workspaceId || !body.projectId) return reply.status(400).send({ error: "workspaceId and projectId required" });
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
      }
      const [newDpr] = await db.insert(dprs).values(body).returning();
      return reply.status(201).send(newDpr);
    } catch (err: any) {
      console.error("POST /dprs error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to create DPR", details: err.message });
    }
  });

  app.patch("/dprs/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      const body = request.body as Record<string, any>;
      const [updated] = await db.update(dprs).set(body).where(eq(dprs.id, id)).returning();
      if (!updated) return reply.status(404).send({ error: "DPR not found" });
      return updated;
    } catch (err: any) {
      console.error("PATCH /dprs error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to update DPR", details: err.message });
    }
  });
}