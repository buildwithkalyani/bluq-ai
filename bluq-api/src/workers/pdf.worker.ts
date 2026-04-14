// =============================================================================
// BLUQ PDF WORKER
// =============================================================================
// Processes jobs from the "pdf-generator" BullMQ queue.
//
// Job data:
//   { projectId, workspaceId, reportDate, sections[] }
//
// Steps:
//   1. Fetch project details from DB
//   2. Fetch DPR entries for reportDate
//   3. Fetch tasks for the project
//   4. Fetch dpr_photos linked to today's DPRs
//   5. (optional) Claude Sonnet generates AI Executive Summary
//   6. Build PDF with PDFKit
//   7. Upload PDF to Supabase Storage (reports bucket)
//   8. Save record to reports table → return { reportId, pdfUrl }
//
// Storage:
//   Bucket: "reports"  (create in Supabase dashboard, set to public)
//   Path:   reports/{workspaceId}/{projectId}/{reportDate}.pdf
//
// Required env vars (add to Railway):
//   SUPABASE_URL              → https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY → service role JWT from Supabase dashboard
// =============================================================================

import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { db } from "../db/client.js";
import { projects, dprs, tasks, dprPhotos, reports } from "../db/schema.js";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface PdfJobData {
  projectId: string;
  workspaceId: string;
  /** ISO date string e.g. "2026-04-12" */
  reportDate: string;
  /** Which sections to include in the PDF */
  sections: Array<
    | "ai_summary"
    | "site_attendance"
    | "material_usage"
    | "critical_issues"
    | "site_progress"
    | "s_curve"
    | "site_photos"
  >;
  /** Optional: who triggered the report */
  requestedBy?: string;
}

// ---------------------------------------------------------------------------
// COLOUR PALETTE (BLUQ brand)
// ---------------------------------------------------------------------------

const BLUQ_BLUE = "#1E40AF";    // primary blue
const BLUQ_LIGHT = "#EFF6FF";   // light blue background
const TEXT_DARK = "#111827";
const TEXT_MID = "#374151";
const TEXT_LIGHT = "#6B7280";
const RED = "#DC2626";
const GREEN = "#16A34A";
const ORANGE = "#D97706";
const WHITE = "#FFFFFF";

// ---------------------------------------------------------------------------
// WORKER
// ---------------------------------------------------------------------------

export function startPdfWorker() {
  const worker = new Worker<PdfJobData>(
    "pdf-generator",
    async (job: Job<PdfJobData>) => {
      return await processPdfJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 1,                        // PDFs are memory-heavy, one at a time
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ PDF job ${job.id} done for project ${job.data.projectId} / ${job.data.reportDate}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ PDF job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("🔴 PDF worker error:", err.message);
  });

  console.log("📄 PDF worker started, listening for jobs...");
  return worker;
}

// ---------------------------------------------------------------------------
// MAIN PROCESSOR
// ---------------------------------------------------------------------------

async function processPdfJob(job: Job<PdfJobData>): Promise<{
  reportId: string;
  pdfUrl: string;
}> {
  const { projectId, workspaceId, reportDate, sections } = job.data;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables");
  }

  // =========================================================================
  // STEP 1: Fetch project
  // =========================================================================
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId)
      )
    );

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // =========================================================================
  // STEP 2: Fetch DPRs for reportDate
  // =========================================================================
  const dprRows = await db
    .select()
    .from(dprs)
    .where(
      and(
        eq(dprs.projectId, projectId),
        eq(dprs.workspaceId, workspaceId),
        eq(dprs.reportDate, reportDate)
      )
    );

  // =========================================================================
  // STEP 3: Fetch all tasks
  // =========================================================================
  const taskRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.workspaceId, workspaceId)
      )
    );

  // =========================================================================
  // STEP 4: Fetch dpr_photos for today's DPRs
  // =========================================================================
  let photoRows: typeof dprPhotos.$inferSelect[] = [];
  if (dprRows.length > 0) {
    const dprIds = dprRows.map((d) => d.id);
    photoRows = await db
      .select()
      .from(dprPhotos)
      .where(inArray(dprPhotos.dprId, dprIds));
  }

  // =========================================================================
  // STEP 5: AI Executive Summary (optional)
  // =========================================================================
  let aiSummaryText = "";
  if (sections.includes("ai_summary") && apiKey) {
    aiSummaryText = await generateAiSummary({
      apiKey,
      project,
      reportDate,
      dprRows,
      taskRows,
    });
  }

  // =========================================================================
  // STEP 6: Build PDF in memory
  // =========================================================================
  const pdfBuffer = await buildPdf({
    project,
    reportDate,
    sections,
    dprRows,
    taskRows,
    photoRows,
    aiSummaryText,
  });

  // =========================================================================
  // STEP 7: Upload to Supabase Storage
  // =========================================================================
  const storagePath = `${workspaceId}/${projectId}/${reportDate}.pdf`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/reports/${storagePath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",       // overwrite if already exists (idempotent)
    },
    body: new Uint8Array(pdfBuffer),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Supabase Storage upload failed: ${uploadRes.status} — ${errorText}`);
  }

  // Store the path only — signed URLs are generated on-demand by the reports route.
  // This keeps the bucket private and ensures URLs can't be shared permanently.
  const pdfUrl = storagePath;

  // =========================================================================
  // STEP 8: Save to reports table
  // =========================================================================

  // Compute summary metrics for metricsJson
  const totalWorkers = dprRows.reduce((s, d) => s + (d.labourCount ?? 0), 0);
  const inProgressTasks = taskRows.filter((t) => t.status === "in_progress").length;
  const completedTasks = taskRows.filter((t) => t.status === "completed").length;
  const delayedTasks = taskRows.filter(
    (t) => t.status === "delayed" || t.status === "running_late"
  ).length;
  const avgPercent =
    taskRows.length > 0
      ? taskRows.reduce((s, t) => s + Number(t.percentComplete ?? 0), 0) / taskRows.length
      : 0;

  const [savedReport] = await db
    .insert(reports)
    .values({
      workspaceId,
      projectId,
      type: "daily",
      reportDate,
      aiSummary: aiSummaryText || null,
      metricsJson: {
        totalWorkers,
        inProgressTasks,
        completedTasks,
        delayedTasks,
        avgPercentComplete: Math.round(avgPercent),
        dprCount: dprRows.length,
        photoCount: photoRows.length,
      },
      pdfUrl,
    })
    .returning();

  return { reportId: savedReport.id, pdfUrl };
}

// ---------------------------------------------------------------------------
// AI SUMMARY
// ---------------------------------------------------------------------------

async function generateAiSummary(opts: {
  apiKey: string;
  project: typeof projects.$inferSelect;
  reportDate: string;
  dprRows: typeof dprs.$inferSelect[];
  taskRows: typeof tasks.$inferSelect[];
}): Promise<string> {
  const { apiKey, project, reportDate, dprRows, taskRows } = opts;

  const totalWorkers = dprRows.reduce((s, d) => s + (d.labourCount ?? 0), 0);
  const inProgress = taskRows.filter((t) => t.status === "in_progress").length;
  const completedTasks = taskRows.filter((t) => t.status === "completed").length;
  const delayed = taskRows.filter(
    (t) => t.status === "delayed" || t.status === "running_late"
  ).length;
  const avgPct =
    taskRows.length > 0
      ? Math.round(
          taskRows.reduce((s, t) => s + Number(t.percentComplete ?? 0), 0) /
            taskRows.length
        )
      : 0;

  const delayReasons = dprRows
    .filter((d) => d.delayReason)
    .map((d) => d.delayReason)
    .join("; ");

  const workDoneSummary = dprRows
    .filter((d) => d.workDone)
    .map((d) => d.workDone)
    .slice(0, 5)
    .join("; ");

  const prompt = `You are a construction project manager AI assistant. Write a concise 2–3 sentence executive summary for a Daily Progress Report.

Project: ${project.projectName}
Date: ${reportDate}
Workers on site today: ${totalWorkers}
Tasks in progress: ${inProgress}
Tasks completed: ${completedTasks}
Tasks delayed or late: ${delayed}
Overall project completion: ${avgPct}%
Work done today: ${workDoneSummary || "Not reported"}
Delay reasons: ${delayReasons || "None reported"}

Write a professional summary that a site manager would send to a client. Be factual and specific. Do not use bullet points. Do not start with "On [date]".`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return "";

    const data = (await res.json()) as any;
    return data?.content?.[0]?.text?.trim() ?? "";
  } catch {
    return "";   // summary is optional — don't fail the whole PDF for it
  }
}

// ---------------------------------------------------------------------------
// PDF BUILDER
// ---------------------------------------------------------------------------

type ProjectRow = typeof projects.$inferSelect;
type DprRow = typeof dprs.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type PhotoRow = typeof dprPhotos.$inferSelect;

interface BuildPdfOpts {
  project: ProjectRow;
  reportDate: string;
  sections: PdfJobData["sections"];
  dprRows: DprRow[];
  taskRows: TaskRow[];
  photoRows: PhotoRow[];
  aiSummaryText: string;
}

function buildPdf(opts: BuildPdfOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { project, reportDate, sections, dprRows, taskRows, photoRows, aiSummaryText } = opts;

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,   // needed for page-number footer
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;   // 595 for A4
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    function drawRect(
      x: number, y: number, w: number, h: number, fillColor: string
    ) {
      doc.save().rect(x, y, w, h).fill(fillColor).restore();
    }

    function sectionHeader(title: string) {
      doc.moveDown(0.6);
      const y = doc.y;
      drawRect(margin, y, contentWidth, 22, BLUQ_LIGHT);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(BLUQ_BLUE)
        .text(title.toUpperCase(), margin + 8, y + 6, { width: contentWidth - 16 });
      doc.moveDown(0.2);
    }

    function bodyText(text: string, color = TEXT_MID) {
      doc.font("Helvetica").fontSize(9).fillColor(color).text(text, { width: contentWidth });
    }

    function tableRow(
      cols: string[],
      widths: number[],
      isHeader = false,
      rowY?: number
    ) {
      const y = rowY ?? doc.y;
      const rowH = 18;
      const rowColor = isHeader ? BLUQ_BLUE : WHITE;

      let x = margin;
      cols.forEach((col, i) => {
        if (isHeader) {
          drawRect(x, y, widths[i], rowH, rowColor);
        } else {
          // Alternate row shading
          const fill = doc.y % 36 < 18 ? "#F9FAFB" : WHITE;
          drawRect(x, y, widths[i], rowH, fill);
        }
        doc
          .font(isHeader ? "Helvetica-Bold" : "Helvetica")
          .fontSize(8)
          .fillColor(isHeader ? WHITE : TEXT_DARK)
          .text(String(col).slice(0, 60), x + 4, y + 5, {
            width: widths[i] - 8,
            height: rowH - 4,
            ellipsis: true,
            lineBreak: false,
          });
        x += widths[i];
      });
      doc.y = y + rowH;
    }

    // -------------------------------------------------------------------------
    // PAGE HEADER  (appears on page 1 only; page 2+ gets a thin repeat header)
    // -------------------------------------------------------------------------

    // Blue banner
    drawRect(0, 0, pageWidth, 70, BLUQ_BLUE);
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(WHITE)
      .text("BLUQ", margin, 18);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(WHITE)
      .text("DAILY PROGRESS REPORT", margin + 60, 22);

    const formattedDate = new Date(reportDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(WHITE)
      .text(formattedDate, margin, 38, { align: "right", width: contentWidth });

    doc.y = 80;

    // -------------------------------------------------------------------------
    // PROJECT INFO BOX
    // -------------------------------------------------------------------------
    drawRect(margin, doc.y, contentWidth, 52, BLUQ_LIGHT);
    const infoY = doc.y + 8;
    const col1 = margin + 8;
    const col2 = margin + contentWidth / 2;

    doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT_LIGHT).text("PROJECT", col1, infoY);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_DARK).text(project.projectName, col1, infoY + 10);

    if (project.clientName) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("CLIENT", col2, infoY);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_DARK).text(project.clientName, col2, infoY + 10);
    }

    if (project.address) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("SITE ADDRESS", col1, infoY + 26);
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(project.address, col1, infoY + 36, { width: contentWidth / 2 - 16 });
    }

    if (project.projectCode) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("CODE", col2, infoY + 26);
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(project.projectCode, col2, infoY + 36);
    }

    doc.y = infoY + 52;

    // -------------------------------------------------------------------------
    // METRICS BAR
    // -------------------------------------------------------------------------
    const totalWorkers = dprRows.reduce((s, d) => s + (d.labourCount ?? 0), 0);
    const inProgress = taskRows.filter((t) => t.status === "in_progress").length;
    const completed = taskRows.filter((t) => t.status === "completed").length;
    const delayed = taskRows.filter((t) => t.status === "delayed" || t.status === "running_late").length;
    const avgPct =
      taskRows.length > 0
        ? Math.round(taskRows.reduce((s, t) => s + Number(t.percentComplete ?? 0), 0) / taskRows.length)
        : 0;

    const metrics = [
      { label: "Workers On Site", value: String(totalWorkers), color: BLUQ_BLUE },
      { label: "In Progress", value: String(inProgress), color: ORANGE },
      { label: "Completed", value: String(completed), color: GREEN },
      { label: "Delayed / Late", value: String(delayed), color: RED },
      { label: "Avg % Complete", value: `${avgPct}%`, color: TEXT_MID },
    ];

    doc.moveDown(0.6);
    const metricY = doc.y;
    const metricW = contentWidth / metrics.length;

    metrics.forEach((m, i) => {
      const mx = margin + i * metricW;
      drawRect(mx, metricY, metricW - 4, 44, "#F3F4F6");
      doc.font("Helvetica-Bold").fontSize(18).fillColor(m.color).text(m.value, mx + 4, metricY + 6, {
        width: metricW - 12,
        align: "center",
      });
      doc.font("Helvetica").fontSize(7).fillColor(TEXT_LIGHT).text(m.label, mx + 4, metricY + 30, {
        width: metricW - 12,
        align: "center",
      });
    });

    doc.y = metricY + 52;

    // =========================================================================
    // SECTIONS
    // =========================================================================

    // -------------------------------------------------------------------------
    // AI Executive Summary
    // -------------------------------------------------------------------------
    if (sections.includes("ai_summary") && aiSummaryText) {
      sectionHeader("AI Executive Summary");
      doc.moveDown(0.3);
      drawRect(margin, doc.y, contentWidth, 0, BLUQ_LIGHT); // placeholder, actual height unknown
      const sumY = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_DARK).text(aiSummaryText, margin + 10, sumY + 6, {
        width: contentWidth - 20,
        lineGap: 2,
      });
      doc.moveDown(0.4);
    }

    // -------------------------------------------------------------------------
    // Site Attendance
    // -------------------------------------------------------------------------
    if (sections.includes("site_attendance") && dprRows.length > 0) {
      sectionHeader("Site Attendance");

      // Map taskId → title for display
      const taskMap = new Map(taskRows.map((t) => [t.id, t.title]));

      const colW = [contentWidth * 0.45, 80, 80, contentWidth - contentWidth * 0.45 - 80 - 80];
      tableRow(["Task / Activity", "Labour Count", "% Complete", "Source"], colW, true);

      for (const dpr of dprRows) {
        const taskTitle = dpr.taskId ? (taskMap.get(dpr.taskId) ?? "—") : "General";
        tableRow(
          [
            taskTitle,
            String(dpr.labourCount ?? "—"),
            dpr.percentComplete ? `${dpr.percentComplete}%` : "—",
            dpr.source ?? "—",
          ],
          colW,
          false
        );
        // page break if near bottom
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.y = margin;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Material Usage  (workDone text from each DPR)
    // -------------------------------------------------------------------------
    if (sections.includes("material_usage") && dprRows.some((d) => d.workDone)) {
      sectionHeader("Work Done / Material Usage");
      doc.moveDown(0.2);
      for (const dpr of dprRows.filter((d) => d.workDone)) {
        const taskTitle = dpr.taskId
          ? (taskRows.find((t) => t.id === dpr.taskId)?.title ?? "General")
          : "General";
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor(TEXT_DARK)
          .text(`• ${taskTitle}:`, { continued: true, indent: 10 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(TEXT_MID)
          .text(` ${dpr.workDone}`);
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.y = margin;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Critical Issues  (delayed/late tasks + DPR delay reasons)
    // -------------------------------------------------------------------------
    if (sections.includes("critical_issues")) {
      const delayedTasks = taskRows.filter(
        (t) => t.status === "delayed" || t.status === "running_late"
      );
      const dprDelays = dprRows.filter((d) => d.delayReason);

      if (delayedTasks.length > 0 || dprDelays.length > 0) {
        sectionHeader("Critical Issues");
        doc.moveDown(0.2);

        if (delayedTasks.length > 0) {
          doc.font("Helvetica-Bold").fontSize(8).fillColor(RED).text("Delayed Tasks:");
          for (const t of delayedTasks) {
            const status = t.status === "running_late" ? "Running Late" : "Delayed";
            bodyText(
              `  • ${t.title}  [${status}] — ${t.area ?? ""}  ${t.contractor ?? ""}`.trim(),
              RED
            );
            if (doc.y > doc.page.height - 80) {
              doc.addPage();
              doc.y = margin;
            }
          }
        }

        if (dprDelays.length > 0) {
          doc.moveDown(0.3);
          doc.font("Helvetica-Bold").fontSize(8).fillColor(RED).text("Reported Delay Reasons:");
          for (const d of dprDelays) {
            bodyText(`  • ${d.delayReason}`, RED);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Site Progress  (full task table — new page)
    // -------------------------------------------------------------------------
    if (sections.includes("site_progress") && taskRows.length > 0) {
      doc.addPage();
      doc.y = margin;
      sectionHeader("Site Progress — All Tasks");

      const statusColor = (s: string) => {
        if (s === "completed") return GREEN;
        if (s === "in_progress") return BLUQ_BLUE;
        if (s === "delayed" || s === "running_late") return RED;
        return TEXT_LIGHT;
      };

      const colW2 = [contentWidth * 0.38, 70, 70, 60, contentWidth - contentWidth * 0.38 - 70 - 70 - 60];
      tableRow(["Task", "Contractor", "Area", "% Done", "Status"], colW2, true);

      // Sort: in_progress first, then not_started, then completed
      const sorted = [...taskRows].sort((a, b) => {
        const order: Record<string, number> = {
          in_progress: 0,
          running_late: 1,
          delayed: 2,
          not_started: 3,
          completed: 4,
        };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      });

      for (const t of sorted) {
        const y = doc.y;
        const fill = doc.y % 36 < 18 ? "#F9FAFB" : WHITE;
        const totalColW = colW2.reduce((s, w) => s + w, 0);
        drawRect(margin, y, totalColW, 18, fill);

        let x = margin;
        // Title
        doc.font("Helvetica").fontSize(8).fillColor(TEXT_DARK).text(t.title, x + 4, y + 5, {
          width: colW2[0] - 8, height: 12, ellipsis: true, lineBreak: false,
        });
        x += colW2[0];
        // Contractor
        doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(t.contractor ?? "—", x + 4, y + 5, {
          width: colW2[1] - 8, height: 12, ellipsis: true, lineBreak: false,
        });
        x += colW2[1];
        // Area
        doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(t.area ?? "—", x + 4, y + 5, {
          width: colW2[2] - 8, height: 12, ellipsis: true, lineBreak: false,
        });
        x += colW2[2];
        // % Done
        doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT_DARK).text(
          `${t.percentComplete ?? 0}%`, x + 4, y + 5, { width: colW2[3] - 8, height: 12, lineBreak: false }
        );
        x += colW2[3];
        // Status (coloured)
        const humanStatus = (t.status ?? "not_started")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        doc.font("Helvetica-Bold").fontSize(7).fillColor(statusColor(t.status ?? "")).text(
          humanStatus, x + 4, y + 5, { width: colW2[4] - 8, height: 12, ellipsis: true, lineBreak: false }
        );

        doc.y = y + 18;

        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.y = margin;
          tableRow(["Task", "Contractor", "Area", "% Done", "Status"], colW2, true);
        }
      }
    }

    // -------------------------------------------------------------------------
    // S-Curve  (area-wise progress table + dashboard note)
    // -------------------------------------------------------------------------
    if (sections.includes("s_curve")) {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.y = margin;
      }
      sectionHeader("S-Curve / Area-wise Progress");
      doc.moveDown(0.2);
      bodyText(
        "Note: The interactive S-Curve chart is available on the BLUQ dashboard. " +
          "The table below shows current area-wise progress as of " + reportDate + ".",
        TEXT_LIGHT
      );
      doc.moveDown(0.4);

      // Group by area
      const areaMap = new Map<string, { total: number; sumPct: number }>();
      for (const t of taskRows) {
        const area = t.area ?? "General";
        const cur = areaMap.get(area) ?? { total: 0, sumPct: 0 };
        areaMap.set(area, {
          total: cur.total + 1,
          sumPct: cur.sumPct + Number(t.percentComplete ?? 0),
        });
      }

      const colW3 = [contentWidth * 0.5, 80, contentWidth - contentWidth * 0.5 - 80];
      tableRow(["Area", "Task Count", "Avg % Complete"], colW3, true);
      for (const [area, { total, sumPct }] of areaMap) {
        tableRow([area, String(total), `${Math.round(sumPct / total)}%`], colW3);
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.y = margin;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Site Photos
    // -------------------------------------------------------------------------
    if (sections.includes("site_photos")) {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.y = margin;
      }
      sectionHeader("Site Photos");
      doc.moveDown(0.2);

      if (photoRows.length === 0) {
        bodyText("No site photos uploaded for this date.", TEXT_LIGHT);
      } else {
        bodyText(`${photoRows.length} photo(s) uploaded today:`, TEXT_MID);
        doc.moveDown(0.2);
        for (const photo of photoRows) {
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(BLUQ_BLUE)
            .text(`• ${photo.fileName ?? photo.fileUrl}`, { link: photo.fileUrl, underline: true });
          if (photo.capturedAt) {
            doc.font("Helvetica").fontSize(7).fillColor(TEXT_LIGHT)
              .text(`  Captured: ${photo.capturedAt}`);
          }
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            doc.y = margin;
          }
        }
      }
    }

    // =========================================================================
    // FOOTER — page numbers on every page
    // =========================================================================
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 30;
      drawRect(0, footerY - 4, pageWidth, 30, BLUQ_LIGHT);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(TEXT_LIGHT)
        .text(
          `Generated by BLUQ AI  •  ${new Date().toISOString()}  •  Page ${i + 1} of ${totalPages}`,
          margin,
          footerY + 2,
          { width: contentWidth, align: "center" }
        );
    }

    doc.end();
  });
}
