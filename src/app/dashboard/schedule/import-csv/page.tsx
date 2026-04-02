"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  parseCSVPreview,
  BLUQ_FIELDS,
  getScheduleTasks,
  ScheduleTask,
} from "@/lib/mock-data";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { useProjectSync } from "@/lib/use-project-sync";

type Step = "upload" | "map" | "preview";

function ImportCSVContent() {
  const router = useRouter();
  const { projectId, currentProjectName, projects, loading } =
    useProjectSync();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [existingTasks, setExistingTasks] = useState<ScheduleTask[]>([]);
  const [checkingTasks, setCheckingTasks] = useState(true);

  const currentProject = projects.find((p) => p.id === projectId);

  // Check if project already has a schedule
  useEffect(() => {
    if (projectId == null) return;
    setCheckingTasks(true);
    getScheduleTasks(projectId).then((tasks) => {
      setExistingTasks(tasks);
      setCheckingTasks(false);
    });
  }, [projectId]);

  const hasExistingSchedule = existingTasks.length > 0;

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const mock = await parseCSVPreview();
    setHeaders(mock.headers);
    setRows(mock.rows);

    // Auto-map obvious columns
    const autoMap: Record<string, string> = {};
    mock.headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes("activity") || lower.includes("task"))
        autoMap[h] = "Task Name";
      else if (lower.includes("begin") || lower.includes("start"))
        autoMap[h] = "Start Date";
      else if (lower.includes("finish") || lower.includes("end"))
        autoMap[h] = "End Date";
      else if (lower.includes("day") || lower.includes("duration"))
        autoMap[h] = "Duration";
      else if (lower.includes("depend") || lower.includes("pred"))
        autoMap[h] = "Predecessor";
      else if (lower.includes("assign") || lower.includes("contractor"))
        autoMap[h] = "Contractor";
      else if (lower.includes("location") || lower.includes("zone"))
        autoMap[h] = "Space / Zone";
      else if (lower.includes("progress") || lower.includes("complete"))
        autoMap[h] = "% Complete";
    });
    setMappings(autoMap);
    setStep("map");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (
        file &&
        (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))
      ) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleImport = () => {
    setImporting(true);
    // TODO: Replace with actual import API call
    // await fetch('/api/schedule/import', {
    //   method: 'POST',
    //   body: JSON.stringify({ projectId, mappings, rows, type: 'baseline' })
    // })
    setTimeout(() => {
      setImporting(false);
      alert(
        `Import complete! ${rows.length} tasks added to ${currentProjectName} as baseline schedule.`
      );
      setStep("upload");
      setHeaders([]);
      setRows([]);
      setMappings({});
      setFileName("");
      // Refresh existing tasks check
      getScheduleTasks(projectId).then(setExistingTasks);
    }, 1500);
  };

  // ─── LOADING STATE ──────────────────────────────────────────
  if (loading || checkingTasks) {
    return (
      <div className="p-5">
        <div className="text-sm text-[#8C959F]">Loading...</div>
      </div>
    );
  }

  // ─── NO PROJECT SELECTED ───────────────────────────────────
  if (!currentProject) {
    return (
      <div className="p-5">
        <SectionTitle>Import Schedule</SectionTitle>
        <Card className="mt-4">
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">
              No project selected
            </div>
            <div className="text-xs text-[#8C959F] mb-4">
              Select a project from the dropdown above, or create a new one.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ─── ALREADY HAS SCHEDULE ──────────────────────────────────
  if (hasExistingSchedule) {
    // Group tasks by status for the summary
    const statusCounts = existingTasks.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const completedTasks = existingTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const avgProgress = Math.round(
      existingTasks.reduce((sum, t) => sum + t.pct, 0) / existingTasks.length
    );

    return (
      <div className="p-5 overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Import Schedule</SectionTitle>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ddf4ff] rounded-md">
            <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
            <span className="text-[12px] font-semibold text-[#3A4EA2]">
              {currentProjectName}
            </span>
          </div>
        </div>

        <Card>
          <div className="text-center py-10">
            {/* Green check icon */}
            <div className="w-12 h-12 rounded-full bg-[#dafbe1] flex items-center justify-center mx-auto mb-4">
              <span className="text-[#1A7F37] text-xl font-bold">✓</span>
            </div>

            <div className="text-sm font-bold text-[#24292f] mb-1">
              Baseline schedule already imported
            </div>
            <div className="text-xs text-[#8C959F] mb-6">
              {existingTasks.length} tasks · {avgProgress}% overall progress ·{" "}
              {completedTasks} completed
            </div>

            {/* Task summary pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {statusCounts.inProgress && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ddf4ff] text-[#3A4EA2]">
                  {statusCounts.inProgress} In Progress
                </span>
              )}
              {statusCounts.runningLate && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#fff8c5] text-[#9A6700]">
                  {statusCounts.runningLate} Running Late
                </span>
              )}
              {statusCounts.delayed && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ffebe9] text-[#CF222E]">
                  {statusCounts.delayed} Delayed
                </span>
              )}
              {statusCounts.notStarted && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f0f1f3] text-[#8C959F]">
                  {statusCounts.notStarted} Not Started
                </span>
              )}
              {statusCounts.completed && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#dafbe1] text-[#1A7F37]">
                  {statusCounts.completed} Completed
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              <Btn
                onClick={() =>
                  router.push(
                    `/dashboard/schedule/gantt?projectId=${projectId}`
                  )
                }
              >
                View Gantt Chart →
              </Btn>
              <Btn
                onClick={() =>
                  router.push(
                    `/dashboard/schedule/list-view?projectId=${projectId}`
                  )
                }
              >
                View List →
              </Btn>
            </div>
          </div>
        </Card>

        {/* Info card about actuals */}
        <div className="mt-4 p-4 bg-[#ddf4ff] border border-[#54aeff44] rounded-lg flex items-start gap-3">
          <span className="text-sm mt-0.5">💬</span>
          <div>
            <div className="text-[12px] font-bold text-[#3A4EA2] mb-0.5">
              Actuals come from the field
            </div>
            <div className="text-[12px] text-[#3A4EA2] leading-relaxed">
              Progress updates are collected automatically via WhatsApp from
              your contractors. View them in the{" "}
              <span
                className="underline cursor-pointer font-semibold"
                onClick={() =>
                  router.push(
                    `/dashboard/whatsapp-feed?projectId=${projectId}`
                  )
                }
              >
                WhatsApp Feed
              </span>
              .
            </div>
          </div>
        </div>

        {/* Re-baseline hint for V2 */}
        <div className="mt-3 p-3 bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg flex items-start gap-3">
          <span className="text-sm mt-0.5">📌</span>
          <div className="text-[12px] text-[#57606a] leading-relaxed">
            Need to update the baseline? Baseline versioning is coming soon —
            you&apos;ll be able to import revised schedules and compare across
            versions.
          </div>
        </div>
      </div>
    );
  }

  // ─── NO SCHEDULE YET — SHOW IMPORT WIZARD ──────────────────
  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Import Schedule</SectionTitle>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ddf4ff] rounded-md">
          <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
          <span className="text-[12px] font-semibold text-[#3A4EA2]">
            Importing into: {currentProjectName}
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: "upload", label: "1. Upload File" },
          { key: "map", label: "2. Map Columns" },
          { key: "preview", label: "3. Preview & Import" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                step === s.key
                  ? "bg-[#3A4EA2] text-white"
                  : headers.length > 0 &&
                      (s.key === "upload" ||
                        (s.key === "map" && step === "preview"))
                    ? "bg-[#dafbe1] text-[#1A7F37]"
                    : "bg-[#f0f1f3] text-[#8C959F]"
              }`}
            >
              {s.label}
            </div>
            {i < 2 && <span className="text-[#D0D7DE] text-xs">→</span>}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: UPLOAD ─────────────────────────────── */}
      {step === "upload" && (
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-[#3A4EA2] bg-[#ddf4ff]"
                : "border-[#D0D7DE] hover:border-[#8C959F]"
            }`}
          >
            <div className="text-5xl mb-3">📄</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">
              Drag & drop your schedule file here
            </div>
            <div className="text-xs text-[#8C959F] mb-1">
              This will become the baseline schedule for{" "}
              <span className="font-semibold text-[#24292f]">
                {currentProjectName}
              </span>
            </div>
            <div className="text-xs text-[#8C959F] mb-4">
              Supports .csv and .xlsx files
            </div>
            <label>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <span className="inline-block px-5 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors">
                Browse Files
              </span>
            </label>
          </div>

          <div className="mt-4 p-3 bg-[#f6f8fa] rounded-md">
            <div className="text-[11px] font-bold text-[#57606a] mb-2">
              EXPECTED COLUMNS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BLUQ_FIELDS.filter((f) => f !== "— Skip Column —").map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 bg-white border border-[#D0D7DE] rounded text-[11px] text-[#57606a]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ─── STEP 2: MAP COLUMNS ────────────────────────── */}
      {step === "map" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#24292f]">
                Map Your Columns
              </div>
              <div className="text-xs text-[#8C959F] mt-0.5">
                📎 {fileName} — {rows.length} rows detected
              </div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("upload")}>
                ← Back
              </Btn>
              <Btn small primary onClick={() => setStep("preview")}>
                Next: Preview →
              </Btn>
            </div>
          </div>

          <div className="space-y-2">
            {headers.map((h) => (
              <div
                key={h}
                className="flex items-center gap-3 py-2 px-3 rounded-md bg-[#f6f8fa]"
              >
                <div className="w-48 text-xs font-semibold text-[#24292f] font-mono">
                  {h}
                </div>
                <span className="text-[#8C959F] text-sm">→</span>
                <select
                  value={mappings[h] || ""}
                  onChange={(e) =>
                    setMappings({ ...mappings, [h]: e.target.value })
                  }
                  className="flex-1 border border-[#D0D7DE] rounded-md px-3 py-1.5 text-xs bg-white text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2]"
                >
                  <option value="">Select field...</option>
                  {BLUQ_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                {mappings[h] && mappings[h] !== "— Skip Column —" && (
                  <span className="text-[#1A7F37] text-sm">✓</span>
                )}
              </div>
            ))}
          </div>

          {/* Sample data preview */}
          <div className="mt-4 border-t border-[#e1e4e8] pt-4">
            <div className="text-[11px] font-bold text-[#57606a] mb-2">
              SAMPLE DATA (first 2 rows)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#f6f8fa]">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left font-bold text-[#57606a] border-b border-[#e1e4e8] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 2).map((row, ri) => (
                    <tr key={ri} className="border-b border-[#f0f1f3]">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ─── STEP 3: PREVIEW & IMPORT ───────────────────── */}
      {step === "preview" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#24292f]">
                Review & Import
              </div>
              <div className="text-xs text-[#8C959F] mt-0.5">
                {rows.length} tasks will be imported as baseline into{" "}
                <span className="font-semibold text-[#24292f]">
                  {currentProjectName}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("map")}>
                ← Back
              </Btn>
              <Btn small primary onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : "✓ Import as Baseline"}
              </Btn>
            </div>
          </div>

          {/* Mapped preview table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#f6f8fa]">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1.5 text-left border-b border-[#e1e4e8] whitespace-nowrap"
                    >
                      <div className="font-bold text-[#3A4EA2]">
                        {mappings[h] || "—"}
                      </div>
                      <div className="font-normal text-[#8C959F]">{h}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-[#f0f1f3] hover:bg-[#f6f8fa]"
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-[#dafbe1] rounded-md flex items-center gap-2">
            <span className="text-[#1A7F37] font-bold text-sm">✓</span>
            <span className="text-xs text-[#1A7F37] font-semibold">
              {rows.length} tasks ready as baseline for {currentProjectName} •{" "}
              {
                Object.values(mappings).filter(
                  (v) => v && v !== "— Skip Column —"
                ).length
              }{" "}
              columns mapped
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ImportCSVPage() {
  return (
    <Suspense
      fallback={
        <div className="p-5 text-sm text-[#8C959F]">Loading...</div>
      }
    >
      <ImportCSVContent />
    </Suspense>
  );
}
