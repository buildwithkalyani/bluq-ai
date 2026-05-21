// =============================================================================
// REPORTS ROUTE
// =============================================================================
// Endpoints for triggering PDF report generation and reading results.
//
//   POST /reports/generate      → add job to pdf-generator queue, return jobId
//   GET  /reports/status/:jobId → poll job progress
//   GET  /reports               → list saved reports for a project
//
// The actual PDF work happens in workers/pdf.worker.ts.
// =============================================================================

import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { reports, projects, dprs, tasks } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { pdfQueue } from "../lib/queues.js";
import { verifySession } from "../lib/verifySession.js";
import type { PdfJobData } from "../workers/pdf.worker.js";
import { buildPdfBuffer } from "../lib/pdf-builder.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const VALID_SECTIONS = [
  "ai_summary",
  "site_attendance",
  "material_usage",
  "critical_issues",
  "site_progress",
  "s_curve",
  "site_photos",
] as const;

export async function reportsRoute(app: FastifyInstance) {

  // =========================================================================
  // GET /reports/download — synchronous PDF generation, streams back directly
  // No queuing, no polling. Works even with no DPR data (generates template).
  // =========================================================================
  app.get("/reports/download", { preHandler: verifySession }, async (request, reply) => {
    const { projectId, workspaceId, reportDate, sections: sectionsParam } = request.query as {
      projectId: string;
      workspaceId: string;
      reportDate?: string;
      sections?: string;
    };

    if (!projectId || !workspaceId) {
      return reply.status(400).send({ error: "projectId and workspaceId are required" });
    }
    if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
      return reply.status(400).send({ error: "Invalid UUIDs" });
    }

    const date = reportDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const dprRows = await db.select().from(dprs)
      .where(and(eq(dprs.projectId, projectId), eq(dprs.workspaceId, workspaceId), eq(dprs.reportDate, date)));

    const taskRows = await db.select().from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.workspaceId, workspaceId)));

    const enabledSections = sectionsParam
      ? (sectionsParam.split(",").filter(s => VALID_SECTIONS.includes(s as any)) as PdfJobData["sections"])
      : [...VALID_SECTIONS];

    const pdfBuffer = await buildPdfBuffer({
      projectName: project.projectName,
      clientName: project.clientName,
      address: project.address,
      projectCode: project.projectCode,
      reportDate: date,
      sections: enabledSections,
      dprRows,
      taskRows,
    });

    // Save a snapshot record so DPR history tracks generated reports by date
    const totalTasks = taskRows.length;
    const doneTasks = taskRows.filter(t => t.status === "completed").length;
    const avgPct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
    const existingSnapshot = await db.select({ id: dprs.id }).from(dprs)
      .where(and(eq(dprs.projectId, projectId), eq(dprs.workspaceId, workspaceId), eq(dprs.reportDate, date), eq(dprs.source, "generated")))
      .limit(1);
    if (existingSnapshot.length === 0) {
      await db.insert(dprs).values({
        workspaceId,
        projectId,
        reportDate: date,
        source: "generated",
        workDone: `PDF report generated. Tasks: ${doneTasks}/${totalTasks} complete.`,
        percentComplete: String(avgPct),
      }).catch(() => {});
    }

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="DPR-${project.projectName}-${date}.pdf"`)
      .header("Content-Length", pdfBuffer.length);
    return reply.send(pdfBuffer);
  });

  // =========================================================================
  // POST /reports/generate — queue a PDF report generation job
  // =========================================================================
  app.post("/reports/generate", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        projectId: string;
        workspaceId: string;
        reportDate?: string;
        sections?: string[];
        requestedBy?: string;
      };

      // Validate required fields
      if (!body.projectId || !body.workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId are required" });
      }
      if (!UUID_REGEX.test(body.projectId) || !UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      // Default reportDate to today (IST)
      const reportDate = body.reportDate ?? new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (!DATE_REGEX.test(reportDate) || isNaN(Date.parse(reportDate))) {
        return reply.status(400).send({ error: "reportDate must be YYYY-MM-DD" });
      }

      // Validate + default sections
      const rawSections: string[] = body.sections ?? [...VALID_SECTIONS];
      const invalidSections = rawSections.filter(
        (s) => !(VALID_SECTIONS as readonly string[]).includes(s)
      );
      if (invalidSections.length > 0) {
        return reply.status(400).send({
          error: `Invalid sections: ${invalidSections.join(", ")}`,
          valid: VALID_SECTIONS,
        });
      }
      const sections = rawSections as PdfJobData["sections"];

      if (body.requestedBy && !UUID_REGEX.test(body.requestedBy)) {
        return reply.status(400).send({ error: "requestedBy must be a valid UUID" });
      }

      // Add to queue
      const jobData: PdfJobData = {
        projectId: body.projectId,
        workspaceId: body.workspaceId,
        reportDate,
        sections,
        requestedBy: body.requestedBy,
      };

      const job = await pdfQueue.add("generate-pdf", jobData, {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });

      return reply.status(202).send({
        success: true,
        jobId: job.id,
        status: "queued",
        message: "PDF generation started. Poll /reports/status/:jobId for progress.",
        reportDate,
        sections,
      });
    } catch (err: any) {
      console.error("POST /reports/generate error:", err.message);
      return reply.status(500).send({ error: "Failed to start report generation" });
    }
  });

  // =========================================================================
  // GET /reports/status/:jobId — poll job progress
  // =========================================================================
  app.get("/reports/status/:jobId", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      if (!jobId) {
        return reply.status(400).send({ error: "jobId is required" });
      }

      const job = await pdfQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          error: "Job not found",
          suggestion: "The job may have expired. Try generating the report again.",
        });
      }

      const state = await job.getState();

      switch (state) {
        case "waiting":
        case "delayed":
          return {
            jobId,
            status: "queued",
            message: "Report is in the queue. Generation will start shortly.",
          };

        case "active":
          return {
            jobId,
            status: "processing",
            message: "Building your PDF report...",
          };

        case "completed": {
          const result = job.returnvalue as { reportId: string; pdfUrl: string };
          // result.pdfUrl is a storage path — generate a fresh signed URL before returning
          let signedUrl: string | null = null;
          const supabaseUrl = process.env.SUPABASE_URL;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (result?.pdfUrl && supabaseUrl && serviceRoleKey) {
            try {
              const signRes = await fetch(
                `${supabaseUrl}/storage/v1/object/sign/reports/${result.pdfUrl}`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ expiresIn: 3600 }),
                }
              );
              if (signRes.ok) {
                const { signedURL } = (await signRes.json()) as { signedURL: string };
                signedUrl = `${supabaseUrl}${signedURL}`;
              }
            } catch { /* non-fatal */ }
          }
          return {
            jobId,
            status: "completed",
            message: "Report generated successfully!",
            reportId: result?.reportId,
            signedUrl,
          };
        }

        case "failed": {
          const failedReason = job.failedReason ?? "Unknown error";
          return {
            jobId,
            status: "failed",
            message: "Report generation failed.",
            error: failedReason,
          };
        }

        default:
          return { jobId, status: state, message: `Job is in state: ${state}` };
      }
    } catch (err: any) {
      console.error("GET /reports/status error:", err.message);
      return reply.status(500).send({ error: "Failed to check job status" });
    }
  });

  // =========================================================================
  // GET /reports — list saved reports for a project
  //
  // For each report that has a pdfUrl (storage path), generates a Supabase
  // signed URL valid for 1 hour and injects it as `signedUrl` in the response.
  // The bucket stays private — the frontend uses `signedUrl` to download.
  // =========================================================================
  app.get("/reports", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as {
        projectId: string;
        workspaceId: string;
      };

      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId are required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const data = await db
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.projectId, projectId),
            eq(reports.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(reports.reportDate));

      // Generate a fresh signed URL (1-hour TTL) for each report that has a PDF.
      // Done in parallel for speed.
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const withSignedUrls = await Promise.all(
        data.map(async (report) => {
          if (!report.pdfUrl || !supabaseUrl || !serviceRoleKey) {
            return { ...report, signedUrl: null };
          }
          try {
            const signRes = await fetch(
              `${supabaseUrl}/storage/v1/object/sign/reports/${report.pdfUrl}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ expiresIn: 604800 }),  // 7 days
              }
            );
            if (!signRes.ok) return { ...report, signedUrl: null };
            const { signedURL } = (await signRes.json()) as { signedURL: string };
            return { ...report, signedUrl: `${supabaseUrl}${signedURL}` };
          } catch {
            return { ...report, signedUrl: null };
          }
        })
      );

      return withSignedUrls;
    } catch (err: any) {
      console.error("GET /reports error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch reports" });
    }
  });
}
