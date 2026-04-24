// Shared PDF generation logic — used by both the async worker and the sync download endpoint.
import PDFDocument from "pdfkit";

const BLUQ_BLUE  = "#1E40AF";
const BLUQ_LIGHT = "#EFF6FF";
const TEXT_DARK  = "#111827";
const TEXT_MID   = "#374151";
const TEXT_LIGHT = "#6B7280";
const RED        = "#DC2626";
const GREEN      = "#16A34A";
const ORANGE     = "#D97706";
const WHITE      = "#FFFFFF";

export type PdfSection =
  | "ai_summary" | "site_attendance" | "material_usage"
  | "critical_issues" | "site_progress" | "s_curve" | "site_photos";

export interface BuildPdfOpts {
  projectName: string;
  clientName?: string | null;
  address?: string | null;
  projectCode?: string | null;
  reportDate: string;
  sections: PdfSection[];
  dprRows: { labourCount?: number | null; percentComplete?: number | string | null; workDone?: string | null; delayReason?: string | null; taskId?: string | null; source?: string | null }[];
  taskRows: { id: string; title: string; status?: string | null; percentComplete?: number | string | null; contractor?: string | null; area?: string | null }[];
  aiSummaryText?: string;
}

export function buildPdfBuffer(opts: BuildPdfOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { projectName, clientName, address, projectCode, reportDate, sections, dprRows, taskRows, aiSummaryText = "" } = opts;

    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    function drawRect(x: number, y: number, w: number, h: number, fill: string) {
      doc.save().rect(x, y, w, h).fill(fill).restore();
    }

    function sectionHeader(title: string) {
      doc.moveDown(0.6);
      const y = doc.y;
      drawRect(margin, y, contentWidth, 22, BLUQ_LIGHT);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLUQ_BLUE)
        .text(title.toUpperCase(), margin + 8, y + 6, { width: contentWidth - 16 });
      doc.moveDown(0.2);
    }

    function bodyText(text: string, color = TEXT_MID) {
      doc.font("Helvetica").fontSize(9).fillColor(color).text(text, { width: contentWidth });
    }

    function tableRow(cols: string[], widths: number[], isHeader = false) {
      const y = doc.y;
      const rowH = 18;
      let x = margin;
      cols.forEach((col, i) => {
        drawRect(x, y, widths[i], rowH, isHeader ? BLUQ_BLUE : (y % 36 < 18 ? "#F9FAFB" : WHITE));
        doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .fillColor(isHeader ? WHITE : TEXT_DARK)
          .text(String(col).slice(0, 60), x + 4, y + 5, { width: widths[i] - 8, height: rowH - 4, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      doc.y = y + rowH;
    }

    // Header banner
    drawRect(0, 0, pageWidth, 70, BLUQ_BLUE);
    doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("BLUQ", margin, 18);
    doc.font("Helvetica").fontSize(10).fillColor(WHITE).text("DAILY PROGRESS REPORT", margin + 60, 22);
    const formattedDate = new Date(reportDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    doc.font("Helvetica").fontSize(9).fillColor(WHITE)
      .text(formattedDate, margin, 38, { align: "right", width: contentWidth });
    doc.y = 80;

    // Project info box
    drawRect(margin, doc.y, contentWidth, 52, BLUQ_LIGHT);
    const infoY = doc.y + 8;
    const col1 = margin + 8;
    const col2 = margin + contentWidth / 2;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT_LIGHT).text("PROJECT", col1, infoY);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_DARK).text(projectName, col1, infoY + 10);
    if (clientName) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("CLIENT", col2, infoY);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_DARK).text(clientName, col2, infoY + 10);
    }
    if (address) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("SITE ADDRESS", col1, infoY + 26);
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(address, col1, infoY + 36, { width: contentWidth / 2 - 16 });
    }
    if (projectCode) {
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT).text("CODE", col2, infoY + 26);
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MID).text(projectCode, col2, infoY + 36);
    }
    doc.y = infoY + 52;

    // Metrics bar
    const totalWorkers = dprRows.reduce((s, d) => s + (d.labourCount ?? 0), 0);
    const inProgress  = taskRows.filter(t => t.status === "in_progress").length;
    const completed   = taskRows.filter(t => t.status === "completed").length;
    const delayed     = taskRows.filter(t => t.status === "delayed" || t.status === "running_late").length;
    const avgPct      = taskRows.length > 0
      ? Math.round(taskRows.reduce((s, t) => s + Number(t.percentComplete ?? 0), 0) / taskRows.length)
      : 0;

    const metrics = [
      { label: "Workers On Site", value: String(totalWorkers), color: BLUQ_BLUE },
      { label: "In Progress",     value: String(inProgress),   color: ORANGE },
      { label: "Completed",       value: String(completed),    color: GREEN },
      { label: "Delayed / Late",  value: String(delayed),      color: RED },
      { label: "Avg % Complete",  value: `${avgPct}%`,         color: TEXT_MID },
    ];
    doc.moveDown(0.6);
    const metricY = doc.y;
    const metricW = contentWidth / metrics.length;
    metrics.forEach((m, i) => {
      const mx = margin + i * metricW;
      drawRect(mx, metricY, metricW - 4, 44, "#F3F4F6");
      doc.font("Helvetica-Bold").fontSize(18).fillColor(m.color)
        .text(m.value, mx + 4, metricY + 6, { width: metricW - 12, align: "center" });
      doc.font("Helvetica").fontSize(7).fillColor(TEXT_LIGHT)
        .text(m.label, mx + 4, metricY + 30, { width: metricW - 12, align: "center" });
    });
    doc.y = metricY + 52;

    // AI Summary
    if (sections.includes("ai_summary") && aiSummaryText) {
      sectionHeader("AI Executive Summary");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_DARK)
        .text(aiSummaryText, margin + 10, doc.y + 6, { width: contentWidth - 20, lineGap: 2 });
      doc.moveDown(0.4);
    }

    // Site Attendance
    if (sections.includes("site_attendance")) {
      sectionHeader("Site Attendance");
      if (dprRows.length === 0) {
        bodyText("No site attendance recorded for this date.", TEXT_LIGHT);
      } else {
        const colW = [contentWidth * 0.5, 80, contentWidth - contentWidth * 0.5 - 80];
        tableRow(["Task / Activity", "Labour Count", "% Complete"], colW, true);
        for (const dpr of dprRows) {
          tableRow([dpr.taskId ?? "General", String(dpr.labourCount ?? "—"), dpr.percentComplete ? `${dpr.percentComplete}%` : "—"], colW);
          if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = margin; }
        }
      }
    }

    // Material Usage
    if (sections.includes("material_usage")) {
      sectionHeader("Work Done / Material Usage");
      const entries = dprRows.filter(d => d.workDone);
      if (entries.length === 0) {
        bodyText("No material usage reported for this date.", TEXT_LIGHT);
      } else {
        doc.moveDown(0.2);
        for (const dpr of entries) {
          doc.font("Helvetica").fontSize(9).fillColor(TEXT_MID).text(`• ${dpr.workDone}`, { indent: 10 });
          if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = margin; }
        }
      }
    }

    // Critical Issues
    if (sections.includes("critical_issues")) {
      const delayedTasks = taskRows.filter(t => t.status === "delayed" || t.status === "running_late");
      const dprDelays = dprRows.filter(d => d.delayReason);
      sectionHeader("Critical Issues");
      if (delayedTasks.length === 0 && dprDelays.length === 0) {
        bodyText("No critical issues reported.", TEXT_LIGHT);
      } else {
        for (const t of delayedTasks) {
          bodyText(`• ${t.title} [${t.status}]`, RED);
        }
        for (const d of dprDelays) {
          bodyText(`• ${d.delayReason}`, RED);
        }
      }
    }

    // Site Progress
    if (sections.includes("site_progress")) {
      doc.addPage(); doc.y = margin;
      sectionHeader("Site Progress — All Tasks");
      if (taskRows.length === 0) {
        bodyText("No tasks recorded for this project yet.", TEXT_LIGHT);
      } else {
        const colW = [contentWidth * 0.45, 80, 60, contentWidth - contentWidth * 0.45 - 80 - 60];
        tableRow(["Task", "Contractor", "% Done", "Status"], colW, true);
        for (const t of taskRows) {
          tableRow([t.title, t.contractor ?? "—", `${t.percentComplete ?? 0}%`, (t.status ?? "not_started").replace(/_/g, " ")], colW);
          if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = margin; tableRow(["Task", "Contractor", "% Done", "Status"], colW, true); }
        }
      }
    }

    // S-Curve (text table)
    if (sections.includes("s_curve")) {
      if (doc.y > doc.page.height - 150) { doc.addPage(); doc.y = margin; }
      sectionHeader("S-Curve / Area-wise Progress");
      doc.moveDown(0.2);
      if (taskRows.length === 0) {
        bodyText("No task data available to compute S-Curve.", TEXT_LIGHT);
      } else {
        const areaMap = new Map<string, { total: number; sumPct: number }>();
        for (const t of taskRows) {
          const area = t.area ?? "General";
          const cur = areaMap.get(area) ?? { total: 0, sumPct: 0 };
          areaMap.set(area, { total: cur.total + 1, sumPct: cur.sumPct + Number(t.percentComplete ?? 0) });
        }
        const colW = [contentWidth * 0.5, 80, contentWidth - contentWidth * 0.5 - 80];
        tableRow(["Area", "Task Count", "Avg % Complete"], colW, true);
        for (const [area, { total, sumPct }] of areaMap) {
          tableRow([area, String(total), `${Math.round(sumPct / total)}%`], colW);
        }
      }
    }

    // Site Photos
    if (sections.includes("site_photos")) {
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = margin; }
      sectionHeader("Site Photos");
      bodyText("No site photos uploaded for this date.", TEXT_LIGHT);
    }

    // Footer
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 30;
      drawRect(0, footerY - 4, pageWidth, 30, BLUQ_LIGHT);
      doc.font("Helvetica").fontSize(7).fillColor(TEXT_LIGHT)
        .text(`Generated by BLUQ AI  •  ${new Date().toISOString()}  •  Page ${i + 1} of ${totalPages}`,
          margin, footerY + 2, { width: contentWidth, align: "center" });
    }

    doc.end();
  });
}
