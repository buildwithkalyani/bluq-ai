import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { dprs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

export async function dprsRoute(app: FastifyInstance) {

  app.get("/dprs", async (request, reply) => {
    const { projectId, workspaceId } = request.query as { projectId: string; workspaceId: string };
    if (!projectId || !workspaceId) return reply.status(400).send({ error: "projectId and workspaceId required" });
    const data = await db.select().from(dprs).where(and(eq(dprs.projectId, projectId), eq(dprs.workspaceId, workspaceId))).orderBy(desc(dprs.reportDate));
    return data;
  });

  app.post("/dprs", async (request, reply) => {
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
    const [newDpr] = await db.insert(dprs).values(body).returning();
    return reply.status(201).send(newDpr);
  });

  app.patch("/dprs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const [updated] = await db.update(dprs).set(body).where(eq(dprs.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "DPR not found" });
    return updated;
  });
}