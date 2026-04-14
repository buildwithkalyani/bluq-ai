import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { projects, tasks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function projectsRoute(app: FastifyInstance) {

  // =========================================================================
  // GET /projects — list all projects for a workspace
  // =========================================================================
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

  // =========================================================================
  // GET /projects/:id/briefing — AI briefing for the Daily Updates page
  //
  // Query params:
  //   workspaceId — required (for ownership check)
  //
  // Steps:
  //   1. Fetch project + all its tasks
  //   2. Compute stats: task counts by status, avg %, overdue count
  //   3. Call Claude Haiku with the stats → 3-4 sentence briefing
  //   4. Return briefing text + the raw stats (frontend can use stats too)
  //
  // Used by: Daily Updates page — "AI Briefing" dark card
  // =========================================================================
  app.get("/projects/:id/briefing", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { workspaceId } = request.query as { workspaceId: string };

      if (!id || !workspaceId) {
        return reply.status(400).send({ error: "id and workspaceId are required" });
      }
      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "id and workspaceId must be valid UUIDs" });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return reply.status(500).send({ error: "ANTHROPIC_API_KEY is not configured" });
      }

      // Fetch project
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)));

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Fetch all tasks
      const taskRows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, id), eq(tasks.workspaceId, workspaceId)));

      // Compute stats
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      const total = taskRows.length;
      const notStarted = taskRows.filter((t) => t.status === "not_started").length;
      const inProgress = taskRows.filter((t) => t.status === "in_progress").length;
      const completed = taskRows.filter((t) => t.status === "completed").length;
      const delayed = taskRows.filter(
        (t) => t.status === "delayed" || t.status === "running_late"
      ).length;
      const overdue = taskRows.filter(
        (t) => t.status !== "completed" && t.endDate != null && t.endDate < today
      ).length;
      const avgPercent =
        total > 0
          ? Math.round(
              taskRows.reduce((s, t) => s + Number(t.percentComplete ?? 0), 0) / total
            )
          : 0;

      // Top delayed task titles for context
      const delayedTitles = taskRows
        .filter((t) => t.status === "delayed" || t.status === "running_late")
        .slice(0, 3)
        .map((t) => t.title)
        .join(", ");

      // Build prompt
      const prompt = `You are a construction project management AI assistant. Write a concise 3-4 sentence daily briefing for a project manager starting their day.

Project: ${project.projectName}
Client: ${project.clientName ?? "Not specified"}
Today: ${today}
Total tasks: ${total}
Not started: ${notStarted}
In progress: ${inProgress}
Completed: ${completed}
Delayed or running late: ${delayed}
Overdue (past end date, not complete): ${overdue}
Overall project completion: ${avgPercent}%
${delayedTitles ? `Delayed tasks include: ${delayedTitles}` : ""}

Write a professional morning briefing. Be direct and actionable — highlight what needs attention today. Do not use bullet points. Do not start with "Good morning".`;

      // Call Claude Haiku (cheap, fast — this is a quick summary not a complex task)
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        console.error("Claude briefing API error:", res.status, await res.text());
        return reply.status(502).send({ error: "Failed to generate AI briefing" });
      }

      const data = (await res.json()) as any;
      const briefing = data?.content?.[0]?.text?.trim() ?? "";

      return {
        projectId: id,
        briefing,
        stats: {
          total,
          notStarted,
          inProgress,
          completed,
          delayed,
          overdue,
          avgPercent,
          asOf: today,
        },
      };
    } catch (err: any) {
      console.error("GET /projects/:id/briefing error:", err.message, err.cause);
      return reply.status(500).send({ error: "Failed to generate briefing", details: err.message });
    }
  });

  // =========================================================================
  // POST /projects
  // =========================================================================
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

  // =========================================================================
  // PATCH /projects/:id
  // =========================================================================
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

  // =========================================================================
  // DELETE /projects/:id
  // =========================================================================
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
