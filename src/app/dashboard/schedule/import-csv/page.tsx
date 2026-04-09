"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  parseCSVPreview,
  BLUQ_FIELDS,
} from "@/lib/mock-data";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { useProjectSync } from "@/lib/use-project-sync";

type Step = "upload" | "map" | "preview";

type BaselineVersion = {
  version: number;
  fileName: string;
  uploadedAt: string;
  taskCount: number;
  note: string;
};

const MOCK_HISTORY: Record<number, BaselineVersion[]> = {
  0: [
    { version: 1, fileName: "Al_Nakheel_Baseline_v1.csv", uploadedAt: "2025-02-14 09:22", taskCount: 12, note: "Initial baseline — contract award" },
  ],
  1: [
    { version: 2, fileName: "Marina_Heights_Rev2.csv",     uploadedAt: "2025-03-01 11:05", taskCount: 9,  note: "Revised after design change" },
    { version: 1, fileName: "Marina_Heights_Baseline.csv", uploadedAt: "2025-01-20 14:30", taskCount: 8,  note: "Initial baseline" },
  ],
  2: [],
  3: [],
};

function ImportCSVContent() {
  const router = useRouter();
  const { projectId, currentProjectName, projects, loading } = useProjectSync();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<BaselineVersion[]>([]);

  const currentProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (projectId == null) return;
    setUploadHistory(MOCK_HISTORY[projectId] ?? []);
    // Reset wizard when project changes
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMappings({});
    setFileName("");
  }, [projectId]);

  const isRebaseline = uploadHistory.length > 0;
  const nextVersion = isRebaseline ? uploadHistory[0].version + 1 : 1;

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const mock = await parseCSVPreview();
    setHeaders(mock.headers);
    setRows(mock.rows);

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
      if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      alert(
        `${isRebaseline ? "Re-baseline" : "Import"} complete! ${rows.length} tasks added to ${currentProjectName} as Baseline v${nextVersion}.`
      );
      // Prepend new version to history
      const newEntry: BaselineVersion = {
        version: nextVersion,
        fileName,
        uploadedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        taskCount: rows.length,
        note: isRebaseline ? `Re-baseline v${nextVersion}` : "Initial baseline",
      };
      setUploadHistory([newEntry, ...uploadHistory]);
      setStep("upload");
      setHeaders([]);
      setRows([]);
      setMappings({});
      setFileName("");
    }, 1500);
  };

  // ─── LOADING ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5">
        <div className="text-sm text-[#8C959F]">Loading...</div>
      </div>
    );
  }

  // ─── NO PROJECT ─────────────────────────────────────────────
  if (!currentProject) {
    return (
      <div className="p-5">
        <SectionTitle>Import Schedule</SectionTitle>
        <Card className="mt-4">
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">No project selected</div>
            <div className="text-xs text-[#8C959F] mb-4">
              Select a project from the dropdown above, or create a new one.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ─── MAIN PAGE ──────────────────────────────────────────────
  return (
    <div className="p-5 overflow-y-auto h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionTitle>
          {isRebaseline ? `Re-baseline Schedule` : "Import Schedule"}
        </SectionTitle>
        <div className="flex items-center gap-2">
          {isRebaseline && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fff8c5] text-[#9A6700]">
              v{nextVersion} next
            </span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ddf4ff] rounded-md">
            <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
            <span className="text-[12px] font-semibold text-[#3A4EA2]">
              {currentProjectName}
            </span>
          </div>
        </div>
      </div>

      {/* Baseline history log — shown only when previous uploads exist */}
      {uploadHistory.length > 0 && (
        <div className="bg-white border border-[#D0D7DE] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#D0D7DE] flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#24292f]">
              Baseline History
            </span>
            <span className="text-[11px] text-[#8C959F]">
              {uploadHistory.length} version{uploadHistory.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-[#f0f1f3]">
            {uploadHistory.map((v) => (
              <div key={v.version} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#ddf4ff] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#3A4EA2]">v{v.version}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#24292f] truncate">
                    {v.fileName}
                  </div>
                  <div className="text-[11px] text-[#8C959F]">{v.note}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-[#57606a]">{v.taskCount} tasks</div>
                  <div className="text-[10px] text-[#8C959F] font-mono">{v.uploadedAt}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/schedule/gantt?projectId=${projectId}`)}
                    className="text-[11px] text-[#3A4EA2] hover:underline font-semibold"
                  >
                    View Gantt
                  </button>
                  <span className="text-[#D0D7DE]">·</span>
                  <button
                    onClick={() => router.push(`/dashboard/schedule/baseline?projectId=${projectId}`)}
                    className="text-[11px] text-[#3A4EA2] hover:underline font-semibold"
                  >
                    Compare
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { key: "upload", label: `1. ${isRebaseline ? "Upload New" : "Upload File"}` },
          { key: "map",    label: "2. Map Columns" },
          { key: "preview", label: "3. Preview & Import" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                step === s.key
                  ? "bg-[#3A4EA2] text-white"
                  : headers.length > 0 &&
                      (s.key === "upload" || (s.key === "map" && step === "preview"))
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
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${
              dragging ? "border-[#3A4EA2] bg-[#ddf4ff]" : "border-[#D0D7DE] hover:border-[#8C959F]"
            }`}
          >
            <div className="text-5xl mb-3">{isRebaseline ? "🔄" : "📄"}</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">
              {isRebaseline
                ? `Upload Baseline v${nextVersion} for ${currentProjectName}`
                : "Drag & drop your schedule file here"}
            </div>
            <div className="text-xs text-[#8C959F] mb-1">
              {isRebaseline
                ? "This will replace the active baseline — previous versions are kept in history above"
                : `This will become the baseline schedule for `}
              {!isRebaseline && (
                <span className="font-semibold text-[#24292f]">{currentProjectName}</span>
              )}
            </div>
            <div className="text-xs text-[#8C959F] mb-4">Supports .csv and .xlsx files</div>
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
            <div className="text-[11px] font-bold text-[#57606a] mb-2">EXPECTED COLUMNS</div>
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
              <div className="text-sm font-bold text-[#24292f]">Map Your Columns</div>
              <div className="text-xs text-[#8C959F] mt-0.5">
                📎 {fileName} — {rows.length} rows detected
              </div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("upload")}>← Back</Btn>
              <Btn small primary onClick={() => setStep("preview")}>Next: Preview →</Btn>
            </div>
          </div>

          <div className="space-y-2">
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-3 py-2 px-3 rounded-md bg-[#f6f8fa]">
                <div className="w-48 text-xs font-semibold text-[#24292f] font-mono">{h}</div>
                <span className="text-[#8C959F] text-sm">→</span>
                <select
                  value={mappings[h] || ""}
                  onChange={(e) => setMappings({ ...mappings, [h]: e.target.value })}
                  className="flex-1 border border-[#D0D7DE] rounded-md px-3 py-1.5 text-xs bg-white text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2]"
                >
                  <option value="">Select field...</option>
                  {BLUQ_FIELDS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                {mappings[h] && mappings[h] !== "— Skip Column —" && (
                  <span className="text-[#1A7F37] text-sm">✓</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#e1e4e8] pt-4">
            <div className="text-[11px] font-bold text-[#57606a] mb-2">SAMPLE DATA (first 2 rows)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#f6f8fa]">
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-bold text-[#57606a] border-b border-[#e1e4e8] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 2).map((row, ri) => (
                    <tr key={ri} className="border-b border-[#f0f1f3]">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono">{cell}</td>
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
              <div className="text-sm font-bold text-[#24292f]">Review & Import</div>
              <div className="text-xs text-[#8C959F] mt-0.5">
                {rows.length} tasks will be imported as{" "}
                <span className="font-semibold text-[#24292f]">
                  Baseline v{nextVersion}
                </span>{" "}
                into <span className="font-semibold text-[#24292f]">{currentProjectName}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("map")}>← Back</Btn>
              <Btn small primary onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `✓ ${isRebaseline ? `Set as Baseline v${nextVersion}` : "Import as Baseline"}`}
              </Btn>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#f6f8fa]">
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left border-b border-[#e1e4e8] whitespace-nowrap">
                      <div className="font-bold text-[#3A4EA2]">{mappings[h] || "—"}</div>
                      <div className="font-normal text-[#8C959F]">{h}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-[#f0f1f3] hover:bg-[#f6f8fa]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-[#dafbe1] rounded-md flex items-center gap-2">
            <span className="text-[#1A7F37] font-bold text-sm">✓</span>
            <span className="text-xs text-[#1A7F37] font-semibold">
              {rows.length} tasks ready as Baseline v{nextVersion} for {currentProjectName} •{" "}
              {Object.values(mappings).filter((v) => v && v !== "— Skip Column —").length} columns mapped
            </span>
          </div>
        </Card>
      )}

      {/* Actuals info */}
      <div className="p-4 bg-[#ddf4ff] border border-[#54aeff44] rounded-lg flex items-start gap-3">
        <span className="text-sm mt-0.5">💬</span>
        <div>
          <div className="text-[12px] font-bold text-[#3A4EA2] mb-0.5">Actuals come from the field</div>
          <div className="text-[12px] text-[#3A4EA2] leading-relaxed">
            Progress updates are collected automatically via WhatsApp from your contractors. View them in the{" "}
            <span
              className="underline cursor-pointer font-semibold"
              onClick={() => router.push(`/dashboard/whatsapp-feed?projectId=${projectId}`)}
            >
              WhatsApp Feed
            </span>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportCSVPage() {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-[#8C959F]">Loading...</div>}>
      <ImportCSVContent />
    </Suspense>
  );
}
