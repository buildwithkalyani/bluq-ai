"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseCSVPreview, BLUQ_FIELDS } from "@/lib/mock-data";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { useWorkspace } from "@/context/workspace";
import {
  fetchProjects,
  isRealProject,
  registerDocument,
  fetchDocuments,
  deleteDocument,
  generateSchedule,
  pollScheduleStatus,
  type ScheduleStatusResult,
  type BackendDocument,
} from "@/lib/api-client";
import { uploadFileToStorage } from "@/lib/supabase-storage";

// ─── TYPES ──────────────────────────────────────────────────────────────────

type MockStep = "upload" | "map" | "preview";

type BaselineVersion = {
  version: number;
  fileName: string;
  uploadedAt: string;
  taskCount: number;
  note: string;
};

const MOCK_HISTORY: Record<number, BaselineVersion[]> = {
  0: [{ version: 1, fileName: "Al_Nakheel_Baseline_v1.csv", uploadedAt: "2025-02-14 09:22", taskCount: 12, note: "Initial baseline — contract award" }],
  1: [
    { version: 2, fileName: "Marina_Heights_Rev2.csv", uploadedAt: "2025-03-01 11:05", taskCount: 9, note: "Revised after design change" },
    { version: 1, fileName: "Marina_Heights_Baseline.csv", uploadedAt: "2025-01-20 14:30", taskCount: 8, note: "Initial baseline" },
  ],
  2: [],
  3: [],
};

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0-100
  error?: string;
  url?: string; // Supabase public URL after upload
};

type RealStep = "idle" | "uploading" | "ready" | "generating" | "done" | "error";

const ALLOWED_EXTS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png", ".webp"]);

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

// ─── REAL MODE COMPONENT ─────────────────────────────────────────────────────

function RealImport({
  projectId,
  workspaceId,
  projectName,
  initialStartDate,
  initialEndDate,
  initialBuildingType,
}: {
  projectId: string;
  workspaceId: string;
  projectName: string;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  initialBuildingType?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<RealStep>("idle");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [buildingType, setBuildingType] = useState(initialBuildingType ?? "");
  const [city, setCity] = useState("");
  const [jobStatus, setJobStatus] = useState<ScheduleStatusResult | null>(null);
  const [genResult, setGenResult] = useState<ScheduleStatusResult["result"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [existingDocs, setExistingDocs] = useState<BackendDocument[]>([]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  // Load existing documents for this project
  useEffect(() => {
    fetchDocuments(projectId, workspaceId)
      .then(setExistingDocs)
      .catch(() => {});
  }, [projectId, workspaceId]);

  const handleDeleteDoc = async (doc: BackendDocument) => {
    try {
      await deleteDocument(doc.id);
      setExistingDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(f => ALLOWED_EXTS.has(fileExt(f.name)));
    if (!valid.length) return;
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ file: f, status: "pending" as const, progress: 0 })),
    ]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  // Upload all pending files → Supabase Storage → POST /documents
  const handleUpload = async () => {
    const pending = files.filter(f => f.status === "pending");
    if (!pending.length) return;
    setStep("uploading");

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status !== "pending") continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading", progress: 0 } : f));

      try {
        const url = await uploadFileToStorage(
          entry.file,
          projectId,
          workspaceId,
          (pct) => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
        );

        await registerDocument({
          workspaceId,
          projectId,
          fileName: entry.file.name,
          fileUrl: url,
          fileType: fileExt(entry.file.name).slice(1),
          fileSize: entry.file.size,
          folder: "schedule_inputs",
        });

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done", progress: 100, url } : f));
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message } : f));
      }
    }

    setStep("ready");
    // Refresh existing docs list
    fetchDocuments(projectId, workspaceId).then(setExistingDocs).catch(() => {});
  };

  // Trigger schedule generation + start polling
  const handleGenerate = async () => {
    setStep("generating");
    setErrorMsg("");

    try {
      const res = await generateSchedule({
        projectId,
        workspaceId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        buildingType: buildingType || undefined,
        city: city || undefined,
      });

      startPolling(res.jobId);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to start generation");
      setStep("error");
    }
  };

  const startPolling = (jobId: string) => {
    const poll = async () => {
      try {
        const status = await pollScheduleStatus(jobId);
        setJobStatus(status);

        if (status.status === "completed") {
          setGenResult(status.result ?? null);
          setStep("done");
          return;
        }
        if (status.status === "failed") {
          setErrorMsg(status.error ?? status.message);
          setStep("error");
          return;
        }

        // Still running — poll again in 3s
        pollRef.current = setTimeout(poll, 3000);
      } catch {
        pollRef.current = setTimeout(poll, 5000);
      }
    };
    pollRef.current = setTimeout(poll, 3000);
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const allDone = files.length > 0 && files.every(f => f.status === "done" || f.status === "error");

  // ── DONE STATE ──
  if (step === "done" && genResult) {
    return (
      <div className="p-5 space-y-4 max-w-2xl">
        <SectionTitle>Schedule Generated</SectionTitle>
        <div className="bg-[#dafbe1] border border-[#4ac26b] rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <div className="text-4xl">✅</div>
          <div className="text-[15px] font-bold text-[#1a7f37]">Schedule ready for {projectName}</div>
          <div className="text-[13px] text-[#1a7f37]">
            {genResult.taskCount} tasks · {genResult.durationDays} days total duration
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/dashboard/schedule/gantt?projectId=${projectId}&workspaceId=${workspaceId}`)}
            className="px-5 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold hover:bg-[#0353A4] transition-colors"
          >
            View Gantt →
          </button>
          <button
            onClick={() => { setStep("idle"); setFiles([]); setJobStatus(null); setGenResult(null); }}
            className="px-5 py-2 border border-[#D0D7DE] bg-white text-[#24292f] rounded-md text-[13px] font-semibold hover:bg-[#f6f8fa]"
          >
            Upload More Files
          </button>
        </div>
      </div>
    );
  }

  // ── GENERATING STATE ──
  if (step === "generating") {
    const pct = jobStatus?.progress?.percentage ?? 0;
    const statusText = jobStatus?.progress?.status ?? "Starting…";
    const stepNum = jobStatus?.progress?.step ?? 0;

    const STEP_LABELS = [
      "Queued",
      "Fetching documents",
      "Parsing files",
      "Extracting parameters",
      "Running rules engine",
      "Calculating schedule",
      "Generating novel tasks",
      "Saving to database",
    ];

    return (
      <div className="p-5 space-y-4 max-w-2xl">
        <SectionTitle>Generating Schedule</SectionTitle>
        <Card className="space-y-5">
          <div className="text-[13px] font-semibold text-[#24292f]">
            AI is building your schedule for <span className="text-[#3A4EA2]">{projectName}</span>
          </div>

          {/* Big progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-[#57606a] mb-1.5">
              <span>{statusText}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="w-full h-3 bg-[#f0f1f3] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3A4EA2] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Step list */}
          <div className="space-y-1.5">
            {STEP_LABELS.map((label, i) => {
              const done = i < stepNum;
              const active = i === stepNum;
              return (
                <div key={i} className="flex items-center gap-2.5 text-[12px]">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors ${
                    done ? "bg-[#1a7f37] text-white" : active ? "bg-[#3A4EA2] text-white" : "bg-[#f0f1f3] text-[#8C959F]"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={done ? "text-[#1a7f37]" : active ? "text-[#24292f] font-semibold" : "text-[#8C959F]"}>
                    {label}
                  </span>
                  {active && (
                    <span className="text-[10px] text-[#3A4EA2] font-mono animate-pulse">processing…</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-[#8C959F]">This usually takes 30–90 seconds depending on document size.</div>
        </Card>
      </div>
    );
  }

  // ── ERROR STATE ──
  if (step === "error") {
    return (
      <div className="p-5 space-y-4 max-w-2xl">
        <SectionTitle>Generation Failed</SectionTitle>
        <Card className="space-y-3">
          <div className="text-[13px] text-[#CF222E] font-semibold">⚠️ {errorMsg}</div>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep("ready"); setJobStatus(null); }}
              className="px-4 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold hover:bg-[#0353A4]"
            >
              Retry Generate
            </button>
            <button
              onClick={() => { setStep("idle"); setFiles([]); }}
              className="px-4 py-2 border border-[#D0D7DE] bg-white text-[#24292f] rounded-md text-[13px] font-semibold hover:bg-[#f6f8fa]"
            >
              Start Over
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ── IDLE / UPLOADING / READY ──
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Import Schedule</SectionTitle>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ddf4ff] rounded-md">
          <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
          <span className="text-[12px] font-semibold text-[#3A4EA2]">{projectName}</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { label: "1. Upload Files", active: step === "idle" || step === "uploading", done: step === "ready" },
          { label: "2. Generate Schedule", active: step === "ready", done: false },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              s.done ? "bg-[#dafbe1] text-[#1A7F37]" : s.active ? "bg-[#3A4EA2] text-white" : "bg-[#f0f1f3] text-[#8C959F]"
            }`}>{s.label}</div>
            {i === 0 && <span className="text-[#D0D7DE] text-xs">→</span>}
          </div>
        ))}
      </div>

      {/* ── Existing Documents ── */}
      {existingDocs.length > 0 && (
        <div className="bg-white border border-[#D0D7DE] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#D0D7DE] flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#24292f]">Uploaded Documents</span>
            <span className="text-[11px] text-[#8C959F]">{existingDocs.length} file{existingDocs.length !== 1 ? "s" : ""} · AI will use these for schedule generation</span>
          </div>
          <div className="divide-y divide-[#f0f1f3]">
            {existingDocs.map(doc => (
              <div key={doc.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-base shrink-0">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#24292f] truncate">{doc.fileName}</div>
                  <div className="text-[11px] text-[#8C959F]">
                    {doc.fileType?.toUpperCase()} · {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "—"} · {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDoc(doc)}
                  className="text-[#CF222E] text-xs font-semibold hover:opacity-70 transition shrink-0"
                  title="Remove document"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: Upload files ── */}
      <Card>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
            dragging ? "border-[#3A4EA2] bg-[#ddf4ff]" : "border-[#D0D7DE] hover:border-[#8C959F]"
          }`}
        >
          <div className="text-4xl mb-3">📂</div>
          <div className="text-sm font-semibold text-[#24292f] mb-1">
            Drag & drop project documents here
          </div>
          <div className="text-xs text-[#8C959F] mb-4">
            PDF drawings, BOQ, scope of work, XLSX schedules · Multiple files at once
          </div>
          <label>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; } }}
            />
            <span className="inline-block px-5 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors">
              Browse Files
            </span>
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#f6f8fa] border border-[#e1e4e8]">
                <span className="text-lg shrink-0">
                  {entry.status === "done" ? "✅" : entry.status === "error" ? "❌" : entry.status === "uploading" ? "⏳" : "📄"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#24292f] truncate">{entry.file.name}</div>
                  <div className="text-[11px] text-[#8C959F]">{formatBytes(entry.file.size)}</div>
                  {entry.status === "uploading" && (
                    <div className="mt-1 h-1 bg-[#D0D7DE] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3A4EA2] rounded-full transition-all" style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                  {entry.status === "error" && (
                    <div className="text-[11px] text-[#CF222E] mt-0.5">{entry.error}</div>
                  )}
                </div>
                {entry.status === "pending" && (
                  <button onClick={() => removeFile(i)} className="text-[#8C959F] hover:text-[#CF222E] text-sm shrink-0">✕</button>
                )}
                {entry.status === "done" && (
                  <span className="text-[10px] text-[#1a7f37] font-semibold shrink-0">Uploaded</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {files.some(f => f.status === "pending") && step !== "uploading" && (
          <div className="mt-4 flex gap-3 items-center">
            <button
              onClick={handleUpload}
              className="px-5 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold hover:bg-[#0353A4] transition-colors"
            >
              Upload {files.filter(f => f.status === "pending").length} File{files.filter(f => f.status === "pending").length > 1 ? "s" : ""}
            </button>
            <span className="text-[11px] text-[#8C959F]">Files are securely stored and used only for schedule generation</span>
          </div>
        )}

        {step === "uploading" && (
          <div className="mt-4 text-[13px] text-[#57606a] flex items-center gap-2">
            <span className="animate-spin text-base">⏳</span> Uploading files…
          </div>
        )}

        {/* Upload summary */}
        {allDone && (
          <div className={`mt-4 px-3 py-2 rounded-md text-[12px] font-semibold ${
            errorCount === 0 ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#fff8c5] text-[#9a6700]"
          }`}>
            {doneCount} file{doneCount !== 1 ? "s" : ""} uploaded successfully
            {errorCount > 0 && ` · ${errorCount} failed`}
          </div>
        )}

        {/* Expected formats */}
        <div className="mt-4 p-3 bg-[#f6f8fa] rounded-md">
          <div className="text-[11px] font-bold text-[#57606a] mb-2">ACCEPTED FILE TYPES</div>
          <div className="flex flex-wrap gap-1.5">
            {["PDF (drawings, scope)", "XLSX (BOQ, schedule)", "DOCX (specs)", "JPG/PNG (site photos)", "CSV (task list)"].map(f => (
              <span key={f} className="px-2 py-0.5 bg-white border border-[#D0D7DE] rounded text-[11px] text-[#57606a]">{f}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* ── STEP 2: Generate Schedule (shown after upload) ── */}
      {step === "ready" && doneCount > 0 && (
        <Card className="space-y-4">
          <div>
            <div className="text-[13px] font-bold text-[#24292f] mb-0.5">Generate Schedule</div>
            <div className="text-[12px] text-[#57606a]">
              AI will parse your documents and build a full Gantt schedule for <span className="font-semibold text-[#24292f]">{projectName}</span>.
              Optionally provide project dates and type to improve accuracy.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#3A4EA2] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">End Date</label>
              <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(startDate && e.target.value < startDate ? startDate : e.target.value)}
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#3A4EA2] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">Building Type</label>
              <select value={buildingType} onChange={e => setBuildingType(e.target.value)}
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#3A4EA2] outline-none bg-white">
                <option value="">Auto-detect</option>
                {["residential", "commercial", "mixed-use", "industrial", "infrastructure"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#57606a] mb-1">City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="e.g. Mumbai, Dubai"
                className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#3A4EA2] outline-none" />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-2.5 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold hover:bg-[#0353A4] transition-colors"
          >
            ✨ Generate Schedule with AI
          </button>

          <div className="text-[11px] text-[#8C959F] flex items-center gap-1.5">
            <span>💬</span>
            Progress updates come from WhatsApp via your contractors — the schedule tracks against those actuals.
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MOCK MODE WIZARD ────────────────────────────────────────────────────────

function MockImport({ projectId, projectName }: { projectId: number; projectName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<MockStep>("upload");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [fileQueue, setFileQueue] = useState<{ file: File; status: "pending" | "done" }[]>([]);
  const [uploadHistory, setUploadHistory] = useState<BaselineVersion[]>(MOCK_HISTORY[projectId] ?? []);

  const isRebaseline = uploadHistory.length > 0;
  const nextVersion = isRebaseline ? uploadHistory[0].version + 1 : 1;

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const mock = await parseCSVPreview();
    setHeaders(mock.headers);
    setRows(mock.rows);
    const autoMap: Record<string, string> = {};
    mock.headers.forEach(h => {
      const l = h.toLowerCase();
      if (l.includes("activity") || l.includes("task")) autoMap[h] = "Task Name";
      else if (l.includes("begin") || l.includes("start")) autoMap[h] = "Start Date";
      else if (l.includes("finish") || l.includes("end")) autoMap[h] = "End Date";
      else if (l.includes("day") || l.includes("duration")) autoMap[h] = "Duration";
      else if (l.includes("depend") || l.includes("pred")) autoMap[h] = "Predecessor";
      else if (l.includes("assign") || l.includes("contractor")) autoMap[h] = "Contractor";
      else if (l.includes("location") || l.includes("zone")) autoMap[h] = "Space / Zone";
      else if (l.includes("progress") || l.includes("complete")) autoMap[h] = "% Complete";
    });
    setMappings(autoMap);
    setStep("map");
  }, []);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(f => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xer") || f.name.endsWith(".mpp"));
    if (!valid.length) return;
    setFileQueue(q => [...q, ...valid.map(f => ({ file: f, status: "pending" as const }))]);
    handleFile(valid[0]);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      alert(`${isRebaseline ? "Re-baseline" : "Import"} complete! ${rows.length} tasks added to ${projectName} as Baseline v${nextVersion}.`);
      const newEntry: BaselineVersion = {
        version: nextVersion, fileName,
        uploadedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        taskCount: rows.length,
        note: isRebaseline ? `Re-baseline v${nextVersion}` : "Initial baseline",
      };
      setUploadHistory([newEntry, ...uploadHistory]);
      setFileQueue(q => {
        const remaining = q.filter(f => f.status === "pending").slice(1);
        if (remaining.length > 0) handleFile(remaining[0].file);
        else { setStep("upload"); setHeaders([]); setRows([]); setMappings({}); setFileName(""); }
        return remaining;
      });
    }, 1500);
  };

  return (
    <div className="p-5 overflow-y-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>{isRebaseline ? "Re-baseline Schedule" : "Import Schedule"}</SectionTitle>
        <div className="flex items-center gap-2">
          {isRebaseline && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fff8c5] text-[#9A6700]">v{nextVersion} next</span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ddf4ff] rounded-md">
            <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
            <span className="text-[12px] font-semibold text-[#3A4EA2]">{projectName}</span>
          </div>
        </div>
      </div>

      {uploadHistory.length > 0 && (
        <div className="bg-white border border-[#D0D7DE] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#D0D7DE] flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#24292f]">Baseline History</span>
            <span className="text-[11px] text-[#8C959F]">{uploadHistory.length} version{uploadHistory.length > 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-[#f0f1f3]">
            {uploadHistory.map(v => (
              <div key={v.version} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#ddf4ff] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#3A4EA2]">v{v.version}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#24292f] truncate">{v.fileName}</div>
                  <div className="text-[11px] text-[#8C959F]">{v.note}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-[#57606a]">{v.taskCount} tasks</div>
                  <div className="text-[10px] text-[#8C959F] font-mono">{v.uploadedAt}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push(`/dashboard/schedule/gantt?projectId=${projectId}`)} className="text-[11px] text-[#3A4EA2] hover:underline font-semibold">View Gantt</button>
                  <span className="text-[#D0D7DE]">·</span>
                  <button onClick={() => router.push(`/dashboard/schedule/baseline?projectId=${projectId}`)} className="text-[11px] text-[#3A4EA2] hover:underline font-semibold">Compare</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {[
          { key: "upload", label: `1. ${isRebaseline ? "Upload New" : "Upload File"}` },
          { key: "map", label: "2. Map Columns" },
          { key: "preview", label: "3. Preview & Import" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              step === s.key ? "bg-[#3A4EA2] text-white"
              : headers.length > 0 && (s.key === "upload" || (s.key === "map" && step === "preview")) ? "bg-[#dafbe1] text-[#1A7F37]"
              : "bg-[#f0f1f3] text-[#8C959F]"
            }`}>{s.label}</div>
            {i < 2 && <span className="text-[#D0D7DE] text-xs">→</span>}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <Card>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${dragging ? "border-[#3A4EA2] bg-[#ddf4ff]" : "border-[#D0D7DE] hover:border-[#8C959F]"}`}
          >
            <div className="text-5xl mb-3">{isRebaseline ? "🔄" : "📤"}</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">
              Upload Baseline v{nextVersion} for {projectName}
            </div>
            <div className="text-xs text-[#8C959F] mb-1">
              {isRebaseline
                ? "This will replace the active baseline — previous versions are kept in history above"
                : <span>This will become the baseline schedule for <span className="font-semibold text-[#24292f]">{projectName}</span></span>
              }
            </div>
            <div className="text-xs text-[#8C959F] mb-4">Supports .csv, .xlsx, .xer, .mpp — select multiple files at once</div>
            <label>
              <input type="file" accept=".csv,.xlsx,.xer,.mpp" multiple className="hidden"
                onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
              <span className="inline-block px-5 py-2 bg-[#3A4EA2] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors">
                Browse Files
              </span>
            </label>
            {fileQueue.length > 1 && (
              <div className="mt-3 text-[11px] text-[#57606a]">
                {fileQueue.length} files queued — processing <span className="font-semibold text-[#24292f]">{fileQueue[0]?.file.name}</span>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 bg-[#f6f8fa] rounded-md">
            <div className="text-[11px] font-bold text-[#57606a] mb-2">EXPECTED COLUMNS</div>
            <div className="flex flex-wrap gap-1.5">
              {BLUQ_FIELDS.filter(f => f !== "— Skip Column —").map(f => (
                <span key={f} className="px-2 py-0.5 bg-white border border-[#D0D7DE] rounded text-[11px] text-[#57606a]">{f}</span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#24292f]">Map Your Columns</div>
              <div className="text-xs text-[#8C959F] mt-0.5">📎 {fileName} — {rows.length} rows detected</div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("upload")}>← Back</Btn>
              <Btn small primary onClick={() => setStep("preview")}>Next: Preview →</Btn>
            </div>
          </div>
          <div className="space-y-2">
            {headers.map(h => (
              <div key={h} className="flex items-center gap-3 py-2 px-3 rounded-md bg-[#f6f8fa]">
                <div className="w-48 text-xs font-semibold text-[#24292f] font-mono">{h}</div>
                <span className="text-[#8C959F] text-sm">→</span>
                <select value={mappings[h] || ""} onChange={e => setMappings({ ...mappings, [h]: e.target.value })}
                  className="flex-1 border border-[#D0D7DE] rounded-md px-3 py-1.5 text-xs bg-white text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2]">
                  <option value="">Select field...</option>
                  {BLUQ_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {mappings[h] && mappings[h] !== "— Skip Column —" && <span className="text-[#1A7F37] text-sm">✓</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[#e1e4e8] pt-4">
            <div className="text-[11px] font-bold text-[#57606a] mb-2">SAMPLE DATA (first 2 rows)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead><tr className="bg-[#f6f8fa]">{headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-bold text-[#57606a] border-b border-[#e1e4e8] whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 2).map((row, ri) => <tr key={ri} className="border-b border-[#f0f1f3]">{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#24292f]">Review & Import</div>
              <div className="text-xs text-[#8C959F] mt-0.5">
                {rows.length} tasks will be imported as <span className="font-semibold text-[#24292f]">Baseline v{nextVersion}</span> into <span className="font-semibold text-[#24292f]">{projectName}</span>
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
              <thead><tr className="bg-[#f6f8fa]">{headers.map(h => <th key={h} className="px-2 py-1.5 text-left border-b border-[#e1e4e8] whitespace-nowrap"><div className="font-bold text-[#3A4EA2]">{mappings[h] || "—"}</div><div className="font-normal text-[#8C959F]">{h}</div></th>)}</tr></thead>
              <tbody>{rows.map((row, ri) => <tr key={ri} className="border-b border-[#f0f1f3] hover:bg-[#f6f8fa]">{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-[#24292f] whitespace-nowrap font-mono">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-[#dafbe1] rounded-md flex items-center gap-2">
            <span className="text-[#1A7F37] font-bold text-sm">✓</span>
            <span className="text-xs text-[#1A7F37] font-semibold">
              {rows.length} tasks ready as Baseline v{nextVersion} for {projectName} · {Object.values(mappings).filter(v => v && v !== "— Skip Column —").length} columns mapped
            </span>
          </div>
        </Card>
      )}

      <div className="p-4 bg-[#ddf4ff] border border-[#54aeff44] rounded-lg flex items-start gap-3">
        <span className="text-sm mt-0.5">💬</span>
        <div>
          <div className="text-[12px] font-bold text-[#3A4EA2] mb-0.5">Actuals come from the field</div>
          <div className="text-[12px] text-[#3A4EA2] leading-relaxed">
            Progress updates are collected automatically via WhatsApp from your contractors. View them in the{" "}
            <span className="underline cursor-pointer font-semibold" onClick={() => router.push(`/dashboard/whatsapp-feed?projectId=${projectId}`)}>
              WhatsApp Feed
            </span>.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN CONTENT ─────────────────────────────────────────────────────────────

function ImportCSVContent() {
  const searchParams = useSearchParams();
  const { workspaceId, isDesignMode, loading: wsLoading } = useWorkspace();

  const projectIdParam = searchParams.get("projectId") ?? "0";
  const real = !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;
  const hasProject = projectIdParam !== "0" && projectIdParam !== "";

  const [projectName, setProjectName] = useState("Select Project");
  const [projectStartDate, setProjectStartDate] = useState<string | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<string | null>(null);
  const [projectCategory, setProjectCategory] = useState<string | null>(null);

  useEffect(() => {
    if (real && workspaceId) {
      fetchProjects(workspaceId).then(rows => {
        const match = rows.find(p => p.id === projectIdParam);
        if (match) {
          setProjectName(match.projectName);
          setProjectStartDate(match.startDate ?? null);
          setProjectEndDate(match.endDate ?? null);
          setProjectCategory(match.category ?? null);
        }
      }).catch(() => {});
    } else if (!real && projectIdParam !== "0") {
      const numId = Number(projectIdParam);
      import("@/lib/mock-data").then(({ getProjects }) =>
        getProjects().then(ps => {
          const m = ps.find(p => p.id === numId);
          if (m) setProjectName(m.name);
        })
      );
    }
  }, [projectIdParam, real, workspaceId]);

  if (wsLoading) {
    return <div className="p-5 text-sm text-[#8C959F]">Loading...</div>;
  }

  if (!hasProject) {
    return (
      <div className="p-5">
        <SectionTitle>Import Schedule</SectionTitle>
        <Card className="mt-4">
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-semibold text-[#24292f] mb-1">No project selected</div>
            <div className="text-xs text-[#8C959F]">Select a project from the dropdown above, or create a new one.</div>
          </div>
        </Card>
      </div>
    );
  }

  if (real) {
    return <RealImport projectId={projectIdParam} workspaceId={workspaceId!} projectName={projectName} initialStartDate={projectStartDate} initialEndDate={projectEndDate} initialBuildingType={projectCategory} />;
  }

  return <MockImport projectId={Number(projectIdParam)} projectName={projectName} />;
}

export default function ImportCSVPage() {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-[#8C959F]">Loading...</div>}>
      <ImportCSVContent />
    </Suspense>
  );
}
