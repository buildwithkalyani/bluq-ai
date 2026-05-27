"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { CheckCircle, AlertTriangle, X, Loader, FileText, Sparkles, RefreshCw, Upload, ClipboardList, Table2, GitBranch, Layers, ArrowLeft, PenLine, Plus, Lock, Bot, FolderOpen, Calculator, ScrollText, Milestone, BarChart3, Package, MapPin, Receipt, Home, Building2, Factory, Route, Train, Landmark, CircleDot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseCSVPreview, BLUQ_FIELDS } from "@/lib/mock-data";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import { useWorkspace } from "@/context/workspace";
import {
  fetchProjects,
  fetchTasks,
  isRealProject,
  registerDocument,
  fetchDocuments,
  deleteDocument,
  generateSchedule,
  fetchScheduleVersions,
  createScheduleVersion,
  type ScheduleStatusResult,
  type BackendDocument,
  type ScheduleVersion,
} from "@/lib/api-client";
import { SCHEDULE_JOB_PREFIX, SCHEDULE_RESULT_PREFIX } from "@/hooks/useSchedulePoller";
import { uploadFileToStorage } from "@/lib/supabase-storage";

// ─── DOCS CACHE ─────────────────────────────────────────────────────────────
function readDocsCache(projectId: string): BackendDocument[] | null {
  try {
    const raw = localStorage.getItem(`bluq_docs_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeDocsCache(projectId: string, docs: BackendDocument[]): void {
  try {
    localStorage.setItem(`bluq_docs_${projectId}`, JSON.stringify(docs));
  } catch {}
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

type ImportMode = "excel" | "msp" | "primavera" | "ai" | "manual";

type MockStep = "upload" | "map" | "preview" | "done";

// Mock schedule versions shown in design/demo mode
const MOCK_SCHEDULE_VERSIONS: ScheduleVersion[] = [
  {
    id: "mock-v2",
    versionNumber: 2,
    isBaseline: true,
    isLocked: false,
    generatedBy: "ai",
    uploadedBy: null,
    uploadedByName: "Demo User",
    sourceFileName: null,
    aiReasoning: "Generated from BOQ, architectural drawings and scope of work document",
    createdAt: "2025-04-22T14:15:00Z",
    scheduleJson: {},
  },
  {
    id: "mock-v1",
    versionNumber: 1,
    isBaseline: false,
    isLocked: true,
    generatedBy: "import",
    uploadedBy: null,
    uploadedByName: "Demo User",
    sourceFileName: "Baseline_Schedule_v1.xlsx",
    aiReasoning: null,
    createdAt: "2025-03-10T09:30:00Z",
    scheduleJson: {},
  },
];

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0-100
  error?: string;
  url?: string;
  docId?: string; // DB id after registerDocument — needed for deletion
  docCategory?: string;
};

type RealStep = "idle" | "uploading" | "ready" | "generating" | "done" | "error";

const DOC_CATEGORIES: Array<{
  id: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  hint: string;
  Icon: LucideIcon;
}> = [
  { id: "gfc",          label: "GFC Drawings",         color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD",  hint: "Good-For-Construction architectural & structural drawings", Icon: Layers },
  { id: "boq",          label: "BOQ",                  color: "#059669", bg: "#DCFCE7", border: "#A7F3D0",  hint: "Bill of Quantities and cost estimates",                      Icon: Calculator },
  { id: "specs",        label: "Specifications",        color: "#0891B2", bg: "#ECFEFF", border: "#67E8F9",  hint: "Technical specs, IS codes, material standards",              Icon: ScrollText },
  { id: "contract",     label: "Contract / Milestones", color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD",  hint: "Contract conditions, contractual milestones",                Icon: Milestone },
  { id: "productivity", label: "Productivity Sheet",    color: "#D97706", bg: "#FFFBEB", border: "#FCD34D",  hint: "Resource norms, crew output rates, productivity data",       Icon: BarChart3 },
  { id: "wbs",          label: "WBS Template",          color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4",  hint: "Work Breakdown Structure template",                          Icon: GitBranch },
  { id: "procurement",  label: "Procurement Schedule",  color: "#9333EA", bg: "#FAF5FF", border: "#D8B4FE",  hint: "Material procurement and delivery schedule",                 Icon: Package },
  { id: "survey",       label: "Site Survey / Geotech", color: "#B45309", bg: "#FEF3C7", border: "#FDE68A",  hint: "Site survey, soil investigation, geotech report",            Icon: MapPin },
  { id: "qs",           label: "QS Report",             color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5",  hint: "Quantity Surveyor report, rate analysis",                    Icon: Receipt },
];

const CONSTRUCTION_TYPES: Array<{
  id: string;
  label: string;
  color: string;
  bg: string;
  Icon: LucideIcon;
}> = [
  { id: "residential", label: "Residential",      color: "#2563EB", bg: "#EFF6FF", Icon: Home      },
  { id: "commercial",  label: "Commercial",        color: "#0891B2", bg: "#ECFEFF", Icon: Building2 },
  { id: "mixed",       label: "Mixed Use",         color: "#7C3AED", bg: "#F5F3FF", Icon: Layers    },
  { id: "industrial",  label: "Industrial",        color: "#D97706", bg: "#FFFBEB", Icon: Factory   },
  { id: "road",        label: "Road / Highway",    color: "#059669", bg: "#DCFCE7", Icon: Route     },
  { id: "railway",     label: "Railway / Metro",   color: "#0F766E", bg: "#F0FDFA", Icon: Train     },
  { id: "bridge",      label: "Bridge / Flyover",  color: "#9333EA", bg: "#FAF5FF", Icon: Landmark  },
  { id: "tunnel",      label: "Tunnel",            color: "#64748B", bg: "#F8FAFC", Icon: CircleDot },
];

function inferConstructionType(buildingType: string): string {
  const b = (buildingType ?? "").toLowerCase();
  if (b.includes("residential"))                       return "residential";
  if (b.includes("commercial"))                        return "commercial";
  if (b.includes("mixed"))                             return "mixed";
  if (b.includes("industrial") || b.includes("warehouse")) return "industrial";
  if (b.includes("road") || b.includes("highway"))    return "road";
  if (b.includes("railway") || b.includes("metro"))   return "railway";
  if (b.includes("bridge") || b.includes("flyover"))  return "bridge";
  if (b.includes("tunnel"))                            return "tunnel";
  return "";
}

const ALLOWED_EXTS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png", ".webp"]);

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

// ─── METHOD PICKER ───────────────────────────────────────────────────────────

const AI_COLOR   = "#4F46E5";
const AI_BG      = "#EEF2FF";
const AI_BORDER  = "#C7D2FE";

const IMPORT_METHODS: Array<{
  id: ImportMode;
  label: string;
  sub: string;
  description: string;
  accepts: string;
  formats: string[];
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  badge?: string;
  ai?: boolean;
}> = [
  {
    id: "excel",
    label: "I have an Excel or CSV schedule",
    sub: "Most common",
    description: "Your planner shared an Excel sheet with tasks, dates, and durations. Upload it and we'll bring it into Bluq instantly.",
    accepts: ".xlsx,.xls,.csv",
    formats: [".xlsx", ".xls", ".csv"],
    icon: <Table2 size={22} />,
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    badge: "Popular",
  },
  {
    id: "msp",
    label: "My planner uses MS Project",
    sub: "Microsoft Project file",
    description: "Your planner works in MS Project. Export the .mpp file and upload it. All tasks, links, and milestones come across cleanly.",
    accepts: ".mpp",
    formats: [".mpp"],
    icon: <GitBranch size={22} />,
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#93C5FD",
  },
  {
    id: "primavera",
    label: "My planner uses Primavera P6",
    sub: "Oracle Primavera P6",
    description: "Your planner works in Primavera P6. Ask them to export an .xer file and upload it here. Activities, WBS, and relationships all carry over.",
    accepts: ".xer",
    formats: [".xer"],
    icon: <Layers size={22} />,
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#C4B5FD",
  },
  {
    id: "ai",
    label: "No existing schedule? Build one from my documents",
    sub: "AI-powered · Ready in ~2 minutes",
    description: "Upload your drawings, BOQ, or scope document and our AI reads them to build a complete project schedule. No manual entry required.",
    accepts: ".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.webp",
    formats: ["PDF", "DOCX", "XLSX", "Images"],
    icon: <Sparkles size={22} />,
    color: AI_COLOR,
    bg: AI_BG,
    border: AI_BORDER,
    badge: "Recommended",
    ai: true,
  },
];

const SHORT_MODE_LABEL: Partial<Record<ImportMode, string>> = {
  excel: "Excel / CSV",
  msp: "MS Project",
  primavera: "Primavera P6",
  ai: "AI Generated",
  manual: "Manual",
};

function ImportMethodPicker({ projectName, onSelect, onBack }: { projectName: string; onSelect: (m: ImportMode) => void; onBack?: () => void }) {
  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer">
          <ArrowLeft size={14} /> Back
        </button>
      )}
      {/* Header */}
      <div>
        <div className="text-[17px] font-bold text-[#0F172A] mb-1">How would you like to set up the schedule?</div>
        <div className="text-[13px] text-[#64748B]">
          For <span className="font-semibold text-[#0F172A]">{projectName}</span>. Pick whichever fits your situation.
        </div>
      </div>

      {/* AI card — top, most prominent */}
      {IMPORT_METHODS.filter(m => m.ai).map(method => (
        <button
          key={method.id}
          onClick={() => onSelect("ai")}
          className="w-full text-left rounded-2xl border-2 hover:shadow-xl transition-all overflow-hidden"
          style={{ borderColor: method.border, background: method.bg }}
        >
          <div className="flex items-stretch">
            <div className="w-1.5 shrink-0 rounded-l-2xl" style={{ background: method.color }} />
            <div className="flex items-start gap-4 p-5 flex-1">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "#FFFFFF", color: method.color, boxShadow: "0 2px 8px 0 rgba(79,70,229,0.12)" }}>
                {method.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[15px] font-bold text-[#0F172A]">{method.label}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                    style={{ background: method.color, color: "#FFFFFF" }}>✦ {method.badge}</span>
                </div>
                <div className="text-[12px] font-semibold mb-2" style={{ color: method.color }}>{method.sub}</div>
                <div className="text-[12px] text-[#475569] leading-relaxed mb-3">{method.description}</div>
                <div className="flex flex-wrap gap-1.5">
                  {["Architectural Drawings", "BOQ", "Scope of Work", "DPR", "Site Photos", "Specifications"].map(f => (
                    <span key={f} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-[#475569]"
                      style={{ border: `1px solid ${AI_BORDER}` }}>{f}</span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 self-center px-5 py-2.5 rounded-xl text-[13px] font-bold text-white whitespace-nowrap"
                style={{ background: method.color }}>
                Build my schedule
              </div>
            </div>
          </div>
        </button>
      ))}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E2E8F0]" />
        <span className="text-[11px] font-semibold text-[#94A3B8]">Already have a schedule file?</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>

      {/* File import options — 3 cards in a row */}
      <div className="grid grid-cols-3 gap-3">
        {IMPORT_METHODS.filter(m => !m.ai).map(method => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className="text-left p-4 rounded-xl border-2 hover:shadow-md transition-all"
            style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = method.border; (e.currentTarget as HTMLElement).style.background = method.bg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: method.bg, color: method.color }}>
                {method.icon}
              </div>
              {method.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: method.bg, color: method.color }}>{method.badge}</span>
              )}
            </div>
            <div className="text-[13px] font-bold text-[#0F172A] mb-1 leading-snug">{method.label}</div>
            <div className="text-[11px] text-[#64748B] leading-snug mb-3">{method.description}</div>
            <div className="flex flex-wrap gap-1">
              {method.formats.map(f => (
                <span key={f} className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
                  style={{ background: method.bg, color: method.color }}>{f}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Manual / blank creation */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E2E8F0]" />
        <span className="text-[11px] font-semibold text-[#94A3B8]">Starting from scratch?</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>

      <button
        onClick={() => onSelect("manual")}
        className="w-full text-left p-4 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-all flex items-center gap-4"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#F1F5F9]">
          <PenLine size={18} className="text-[#64748B]" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-[#0F172A]">Create schedule manually</div>
          <div className="text-[11px] text-[#64748B]">Start with a blank canvas and add tasks, durations, and dependencies by hand.</div>
        </div>
        <Plus size={16} className="text-[#94A3B8] shrink-0" />
      </button>
    </div>
  );
}

// ─── SCHEDULE LANDING (always-first screen) ──────────────────────────────────

function ScheduleLanding({
  projectName,
  projectId,
  workspaceId,
  versions,
  loading,
  onSetup,
}: {
  projectName: string;
  projectId: string;
  workspaceId: string;
  versions: ScheduleVersion[];
  loading: boolean;
  onSetup: () => void;
}) {
  const router = useRouter();
  const hasVersions = versions.length > 0;
  const activeBaseline = versions.find(v => v.isBaseline) ?? (hasVersions ? versions[0] : null);

  const genLabel = (g: string) =>
    g === "ai" ? "AI Generated" : g === "import" ? "Imported" : "Manual";

  const genIcon = (g: string) =>
    g === "ai" ? <Bot size={13} /> : g === "import" ? <Upload size={13} /> : <PenLine size={13} />;

  const formatDate = (iso: string | null) => {
    if (!iso || iso === "—") return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F8FAFC] space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">Import Schedule</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {projectName}
            {hasVersions && <> · {versions.length} version{versions.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        {hasVersions && (
          <button
            onClick={onSetup}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors cursor-pointer shrink-0"
          >
            <Plus size={14} /> New version
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-36 bg-white border border-[#E2E8F0] rounded-xl" />
          <div className="h-24 bg-white border border-[#E2E8F0] rounded-xl" />
        </div>
      )}

      {/* No baseline yet — empty state */}
      {!loading && !hasVersions && (
        <div className="flex flex-col items-center text-center py-16 bg-white border border-dashed border-[#E2E8F0] rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <ClipboardList size={22} className="text-[#94A3B8]" />
          </div>
          <div className="text-[15px] font-bold text-[#0F172A] mb-1">No schedule baseline yet</div>
          <p className="text-[13px] text-[#64748B] mb-5 max-w-xs">
            Import your planner&apos;s file or let AI build a schedule from your project documents.
          </p>
          <button
            onClick={onSetup}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg px-5 py-2 text-[12px] font-bold transition-colors cursor-pointer"
          >
            <Plus size={14} /> Set up schedule
          </button>
        </div>
      )}

      {/* Active baseline card */}
      {!loading && activeBaseline && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] uppercase tracking-wide">Active baseline</span>
              <span className="text-[13px] font-bold text-[#0F172A]">v{activeBaseline.versionNumber}</span>
              {activeBaseline.isLocked && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
                  <Lock size={10} /> Locked
                </span>
              )}
            </div>
            <div className="text-[12px] text-[#64748B]">{formatDate(activeBaseline.createdAt)}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Method</div>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F172A]">
                {genIcon(activeBaseline.generatedBy)} {genLabel(activeBaseline.generatedBy)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Uploaded by</div>
              <div className="text-[13px] font-semibold text-[#0F172A] truncate">
                {activeBaseline.uploadedByName ?? activeBaseline.uploadedBy ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">
                {activeBaseline.generatedBy === "ai" ? "Source docs" : "Source file"}
              </div>
              {activeBaseline.generatedBy === "ai" ? (
                <button
                  onClick={() => router.push(`/dashboard/documents?folder=Schedules&projectId=${projectId}&workspaceId=${workspaceId}`)}
                  className="text-[13px] font-semibold text-[#2563EB] hover:underline cursor-pointer text-left"
                >
                  View source documents
                </button>
              ) : (
                <div className="text-[13px] font-semibold text-[#0F172A] truncate">
                  {activeBaseline.sourceFileName ?? "—"}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Status</div>
              <div className="text-[13px] font-semibold text-[#059669]">Active</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#F1F5F9]">
            <button
              onClick={() => router.push(`/dashboard/schedule/gantt`)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#2563EB] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              View Gantt
            </button>
            <button
              onClick={() => router.push(`/dashboard/schedule/baseline`)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#475569] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Baseline vs Actual
            </button>
            <button
              onClick={onSetup}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#475569] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer ml-auto"
            >
              Upload new version
            </button>
          </div>
        </div>
      )}

      {/* Version history table */}
      {!loading && versions.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#0F172A]">Version history</span>
            <span className="text-[11px] text-[#94A3B8]">{versions.length} version{versions.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-[48px_1fr_1fr_1fr_1fr_90px] text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0]">
            <div>Ver</div>
            <div>Date</div>
            <div>Method</div>
            <div>Uploaded by</div>
            <div>Source</div>
            <div className="text-right">Status</div>
          </div>
          {versions.map((v, i) => (
            <div
              key={v.id}
              className={`grid grid-cols-[48px_1fr_1fr_1fr_1fr_90px] items-center px-4 py-3 text-[12px] ${i < versions.length - 1 ? "border-b border-[#F1F5F9]" : ""} hover:bg-[#F8FAFC] transition-colors`}
            >
              <div className="font-bold text-[#2563EB]">v{v.versionNumber}</div>
              <div className="text-[#475569]">{formatDate(v.createdAt)}</div>
              <div className="flex items-center gap-1.5 text-[#475569]">
                {genIcon(v.generatedBy)}
                <span>{genLabel(v.generatedBy)}</span>
              </div>
              <div className="text-[#475569] truncate pr-2">{v.uploadedByName ?? v.uploadedBy ?? "—"}</div>
              <div className="truncate pr-2">
                {v.generatedBy === "ai" ? (
                  <button
                    onClick={() => router.push(`/dashboard/documents?folder=Schedules&projectId=${projectId}&workspaceId=${workspaceId}`)}
                    className="text-[#2563EB] hover:underline font-medium cursor-pointer text-left text-[12px]"
                  >
                    View docs
                  </button>
                ) : (
                  <span className="text-[#475569] text-[11px] font-mono">{v.sourceFileName ?? "—"}</span>
                )}
              </div>
              <div className="text-right">
                {v.isBaseline ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A]">Baseline</span>
                ) : v.isLocked ? (
                  <span className="flex items-center gap-1 justify-end text-[10px] text-[#64748B]">
                    <Lock size={10} /> Locked
                  </span>
                ) : (
                  <span className="text-[10px] text-[#94A3B8]">Draft</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents folder link */}
      {!loading && hasVersions && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-white border border-[#E2E8F0] shadow-sm">
          <FolderOpen size={14} className="text-[#64748B] shrink-0" />
          <span className="text-[12px] text-[#475569]">Source files saved in</span>
          <button
            onClick={() => router.push(`/dashboard/documents?folder=Schedules&projectId=${projectId}&workspaceId=${workspaceId}`)}
            className="text-[12px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
          >
            Documents / Schedules
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MANUAL SCHEDULE SETUP ───────────────────────────────────────────────────

function ManualScheduleSetup({ projectId, projectName, onBack }: { projectId: string; projectName: string; onBack: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer">
        <ArrowLeft size={14} /> Back to import options
      </button>
      <div className="max-w-lg">
        <div className="text-[17px] font-bold text-[#0F172A] mb-1">Create your schedule manually</div>
        <div className="text-[13px] text-[#64748B]">
          A blank schedule will open for{" "}
          <span className="font-semibold text-[#0F172A]">{projectName}</span>. Add tasks, durations, and dependencies at your own pace.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Add tasks one by one", hint: "Type activity names and set durations directly in the list view" },
          { label: "Drag to reorder", hint: "Rearrange tasks and link predecessors with a simple interface" },
          { label: "Gantt builds as you go", hint: "Dates auto-calculate as you connect tasks and set durations" },
        ].map(item => (
          <div key={item.label} className="px-3 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="text-[12px] font-semibold text-[#0F172A] mb-0.5">{item.label}</div>
            <div className="text-[11px] text-[#94A3B8]">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => router.push(`/dashboard/schedule/list-view?projectId=${projectId}`)}
          className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] transition-colors cursor-pointer"
        >
          Open blank schedule
        </button>
        <button onClick={onBack} className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[#475569] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer">
          Go back
        </button>
      </div>
    </div>
  );
}

// ─── REAL MODE COMPONENT ─────────────────────────────────────────────────────

function RealImport({
  projectId,
  workspaceId,
  projectName,
  initialStartDate,
  initialEndDate,
  initialBuildingType,
  initialCity,
  onBack,
}: {
  projectId: string;
  workspaceId: string;
  projectName: string;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  initialBuildingType?: string | null;
  initialCity?: string | null;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<RealStep>("idle");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  // Project details come from project settings — not re-asked here
  const startDate = initialStartDate ?? "";
  const endDate = initialEndDate ?? "";
  const city = initialCity ?? "";
  const buildingType = initialBuildingType ?? "";
  // Schedule-impacting questions
  const [floors, setFloors] = useState("");
  const [basement, setBasement] = useState<"0" | "1" | "2plus" | "">("");
  const [wings, setWings] = useState("");
  const [workingShift, setWorkingShift] = useState<"single" | "double" | "24x7" | "">("");
  const [concreteMethod, setConcreteMethod] = useState<"rmc" | "site" | "manual" | "">("");
  const [useCrane, setUseCrane] = useState<"yes" | "no" | "">("");
  const [monsoon, setMonsoon] = useState<"yes" | "no" | "na" | "">("");
  const [priority, setPriority] = useState<"deadline" | "cost" | "">("");
  // Infrastructure questions
  const [roadLength, setRoadLength] = useState("");
  const [laneCount, setLaneCount] = useState<"2" | "4" | "6" | "8plus" | "">("");
  const [pavementType, setPavementType] = useState<"flexible" | "rigid" | "composite" | "bridge" | "">("");
  // Industrial questions
  const [clearHeight, setClearHeight] = useState("");
  const [spanLength, setSpanLength] = useState("");
  // Railway questions
  const [trackLength, setTrackLength] = useState("");
  const [stationCount, setStationCount] = useState("");
  const [trackGauge, setTrackGauge] = useState<"broad" | "metre" | "standard" | "">("");
  // Bridge questions
  const [totalSpan, setTotalSpan] = useState("");
  const [pierCount, setPierCount] = useState("");
  const [deckType, setDeckType] = useState<"psc" | "steel" | "composite" | "cable" | "">("");
  // Tunnel questions
  const [tunnelLength, setTunnelLength] = useState("");
  const [tunnelDiameter, setTunnelDiameter] = useState("");
  const [tunnelMethod, setTunnelMethod] = useState<"tbm" | "natm" | "cutcover" | "">("");
  // Construction type — inferred from project category, user can change
  const [constructionType, setConstructionType] = useState(() => inferConstructionType(buildingType));
  const [jobStatus, setJobStatus] = useState<ScheduleStatusResult | null>(null);
  const [genResult, setGenResult] = useState<ScheduleStatusResult["result"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [existingDocs, setExistingDocs] = useState<BackendDocument[]>([]);
  const [deleteError, setDeleteError] = useState("");

  // Load existing docs; restore UI state from localStorage
  useEffect(() => {
    const savedResult = localStorage.getItem(`${SCHEDULE_RESULT_PREFIX}${projectId}`);
    if (savedResult) {
      try {
        setGenResult(JSON.parse(savedResult));
        setStep("done");
        return;
      } catch { localStorage.removeItem(`${SCHEDULE_RESULT_PREFIX}${projectId}`); }
    }

    const savedJobId = localStorage.getItem(`${SCHEDULE_JOB_PREFIX}${projectId}`);
    if (savedJobId) setStep("generating");

    // Show cached docs instantly so previously uploaded files appear immediately
    const cachedDocs = readDocsCache(projectId);
    if (cachedDocs && cachedDocs.length > 0) {
      setExistingDocs(cachedDocs);
      if (!savedJobId) setStep("ready");
    }

    // Fetch fresh from backend in background
    fetchDocuments(projectId, workspaceId)
      .then(docs => {
        setExistingDocs(docs);
        writeDocsCache(projectId, docs);
        if (docs.length > 0 && !savedJobId) {
          setStep(prev => prev === "idle" ? "ready" : prev);
        } else if (docs.length === 0 && !savedJobId) {
          setStep("idle");
        }
      })
      .catch(err => console.error("fetchDocuments failed:", err));
  }, [projectId, workspaceId]);

  // Warn on browser refresh/close when pending files exist
  useEffect(() => {
    const pending = files.some(f => f.status === "pending");
    if (!pending) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [files]);

  // Listen to background poller events for live progress + completion
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const { projectId: pid, status } = (e as CustomEvent).detail;
      if (pid !== projectId) return;
      setJobStatus(status);
    };

    const handleDone = (e: Event) => {
      const { projectId: pid, result, error } = (e as CustomEvent).detail;
      if (pid !== projectId) return;
      if (error) {
        setErrorMsg(error);
        setStep("error");
      } else {
        setGenResult(result ?? null);
        setStep("done");
      }
    };

    window.addEventListener("bluq_schedule_progress", handleProgress);
    window.addEventListener("bluq_schedule_done", handleDone);
    return () => {
      window.removeEventListener("bluq_schedule_progress", handleProgress);
      window.removeEventListener("bluq_schedule_done", handleDone);
    };
  }, [projectId]);

  const handleDeleteDoc = async (docId: string) => {
    setDeleteError("");
    try {
      await deleteDocument(docId);
      setExistingDocs(prev => {
        const updated = prev.filter(d => d.id !== docId);
        writeDocsCache(projectId, updated);
        return updated;
      });
      setFiles(prev => prev.filter(f => f.docId !== docId));
    } catch (err: any) {
      setDeleteError(err.message ?? "Failed to delete file");
    }
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(f => ALLOWED_EXTS.has(fileExt(f.name)));
    if (!valid.length) return;
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ file: f, status: "pending" as const, progress: 0, docCategory: "" })),
    ]);
  }, []);

  const addFilesToCategory = useCallback((category: string, incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => ALLOWED_EXTS.has(fileExt(f.name)));
    if (!valid.length) return;
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ file: f, status: "pending" as const, progress: 0, docCategory: category })),
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

        const doc = await registerDocument({
          workspaceId,
          projectId,
          fileName: entry.file.name,
          fileUrl: url,
          fileType: fileExt(entry.file.name).slice(1),
          fileSize: entry.file.size,
          folder: entry.docCategory ? `Schedules/${entry.docCategory}` : "Schedules",
        });

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done", progress: 100, url, docId: doc.id } : f));
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message } : f));
      }
    }

    setStep("ready");
    // Refresh and cache existing docs list
    fetchDocuments(projectId, workspaceId)
      .then(docs => { setExistingDocs(docs); writeDocsCache(projectId, docs); })
      .catch(err => console.error("fetchDocuments after upload:", err));
  };

  // Trigger schedule generation + start polling
  const handleGenerate = async () => {
    setStep("generating");
    setErrorMsg("");

    try {
      const docTypes = Array.from(new Set(files.map(f => f.docCategory).filter(Boolean)));
      const res = await generateSchedule({
        projectId,
        workspaceId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        buildingType: buildingType || undefined,
        city: city || undefined,
        // extra context — backend uses what it supports, ignores the rest
        ...(floors && { floors }),
        ...(basement && { basement }),
        ...(wings && { wings }),
        ...(workingShift && { workingShift }),
        ...(concreteMethod && { concreteMethod }),
        ...(useCrane && { useCrane }),
        ...(monsoon && { monsoon }),
        ...(priority && { priority }),
        // Infrastructure
        ...(constructionType && { constructionType }),
        // Road
        ...(roadLength && { roadLength }),
        ...(laneCount && { laneCount }),
        ...(pavementType && { pavementType }),
        // Industrial
        ...(clearHeight && { clearHeight }),
        ...(spanLength && { spanLength }),
        // Railway
        ...(trackLength && { trackLength }),
        ...(stationCount && { stationCount }),
        ...(trackGauge && { trackGauge }),
        // Bridge
        ...(totalSpan && { totalSpan }),
        ...(pierCount && { pierCount }),
        ...(deckType && { deckType }),
        // Tunnel
        ...(tunnelLength && { tunnelLength }),
        ...(tunnelDiameter && { tunnelDiameter }),
        ...(tunnelMethod && { tunnelMethod }),
        ...(docTypes.length && { docTypes }),
      } as Parameters<typeof generateSchedule>[0]);

      localStorage.setItem(`${SCHEDULE_JOB_PREFIX}${projectId}`, res.jobId);
      // Layout-level poller picks this up and polls in background
      window.dispatchEvent(
        new CustomEvent("bluq_schedule_started", { detail: { projectId, jobId: res.jobId } })
      );
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to start generation");
      setStep("error");
    }
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const allDone = files.length > 0 && files.every(f => f.status === "done" || f.status === "error");
  const totalDocs = existingDocs.length + doneCount;
  const canGenerate = totalDocs > 0;

  // ── DONE STATE ──
  if (step === "done" && genResult) {
    const ASSUMPTIONS = [
      concreteMethod === "rmc" ? "Ready-mix concrete (RMC) delivery assumed — pump, 1.5m lifts, 14-day cure cycle" : concreteMethod === "site" ? "Site batching plant assumed — crew output derived from productivity norms" : "Concrete supply method inferred from documents or BOQ quantities",
      useCrane === "yes" ? "Tower crane included — vertical work sequence and hoist cycles planned accordingly" : useCrane === "no" ? "No crane — material hoisting via manual lifts and temporary hoist" : "Crane requirement inferred from building height and floor count",
      monsoon === "yes" ? "Monsoon shutdown factored into timeline — outdoor structural work paused June–September" : monsoon === "na" ? "No monsoon impact (non-seasonal or indoor project)" : "Monsoon risk assessed from project city",
      priority === "deadline" ? "Schedule optimised for earliest completion — parallel activities maximised" : priority === "cost" ? "Schedule optimised for resource efficiency — crew continuity prioritised" : "Contractual milestones used to set schedule priorities",
      "IS code mix designs applied for concrete grades unless specifications state otherwise",
      "Floor-by-floor sequential construction unless GFC drawings indicate podium or transfer slab",
      "Procurement lead times defaulted to IS norms — override in Procurement Schedule if different",
    ];

    return (
      <div className="p-6 space-y-5 max-w-2xl">
        {/* Success banner */}
        <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center shrink-0">
            <CheckCircle size={22} className="text-[#059669]" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-[#065F46] mb-0.5">Schedule ready — {projectName}</div>
            <div className="text-[13px] text-[#059669]">
              {genResult.taskCount} tasks · {genResult.durationDays} days total duration
            </div>
          </div>
        </div>

        {/* Assumptions log */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
            <Bot size={14} className="text-[#4F46E5]" />
            <span className="text-[12px] font-bold text-[#0F172A]">AI assumptions — change anything you disagree with</span>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {ASSUMPTIONS.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <span className="text-[10px] font-bold text-[#94A3B8] mt-0.5 shrink-0">✦</span>
                <span className="text-[12px] text-[#475569]">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <span className="text-[11px] text-[#94A3B8]">Open the Gantt chart and edit any task, duration, or dependency directly.</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/dashboard/schedule/gantt?projectId=${projectId}&workspaceId=${workspaceId}`)}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#4F46E5] hover:bg-[#4338CA] transition-colors"
          >
            <Sparkles size={13} className="inline mr-1.5" />View Gantt →
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(`${SCHEDULE_RESULT_PREFIX}${projectId}`);
              setStep("idle"); setFiles([]); setJobStatus(null); setGenResult(null);
            }}
            className="px-5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[#475569] text-[13px] font-semibold hover:bg-[#F8FAFC] transition-colors"
          >
            Upload more files
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
          <div className="text-[13px] font-semibold text-[#0F172A]">
            AI is building your schedule for <span className="text-[#2563EB]">{projectName}</span>
          </div>

          {/* Big progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-[#475569] mb-1.5">
              <span>{statusText}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="w-full h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
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
                    done ? "bg-[#059669] text-white" : active ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={done ? "text-[#059669]" : active ? "text-[#0F172A] font-semibold" : "text-[#94A3B8]"}>
                    {label}
                  </span>
                  {active && (
                    <span className="text-[10px] text-[#2563EB] font-mono animate-pulse">processing…</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-[#8C959F]">This usually takes 30–90 seconds depending on document size.</div>

          <div className="pt-2 border-t border-[#f0f1f3]">
            <button
              onClick={() => {
                localStorage.removeItem(`${SCHEDULE_JOB_PREFIX}${projectId}`);
                setStep(existingDocs.length > 0 ? "ready" : "idle");
                setJobStatus(null);
              }}
              className="text-[12px] text-[#8C959F] hover:text-[#CF222E] font-semibold transition-colors"
            >
              Cancel generation
            </button>
          </div>
        </Card>

        {existingDocs.length > 0 && (
          <div className="bg-white border border-[#D0D7DE] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#D0D7DE]">
              <span className="text-[12px] font-bold text-[#24292f]">Files being used · {existingDocs.length} document{existingDocs.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-[#f0f1f3]">
              {existingDocs.map(doc => (
                <div key={doc.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-base shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#24292f] truncate">{doc.fileName}</div>
                    <div className="text-[11px] text-[#8C959F]">{doc.fileType?.toUpperCase()} · {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "—"}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-[#CF222E] text-xs font-semibold hover:opacity-70 shrink-0"
                    title="Remove document"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ERROR STATE ──
  if (step === "error") {
    return (
      <div className="p-5 space-y-4 max-w-2xl">
        <SectionTitle>Generation Failed</SectionTitle>
        <Card className="space-y-3">
          <div className="text-[13px] text-[#DC2626] font-semibold flex items-center gap-1.5"><AlertTriangle size={13} /> {errorMsg}</div>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep("ready"); setJobStatus(null); }}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-md text-[13px] font-semibold hover:bg-[#1D4ED8]"
            >
              Retry Generate
            </button>
            <button
              onClick={() => { setStep("idle"); setFiles([]); }}
              className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#0F172A] rounded-md text-[13px] font-semibold hover:bg-[#F8FAFC]"
            >
              Start Over
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ── IDLE / UPLOADING / READY — combined form ──
  const ToggleGroup = ({ value, onChange, options }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="flex gap-2">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? "" : o.value)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer ${
            value === o.value
              ? "bg-[#4F46E5] text-white border-[#4F46E5]"
              : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#C7D2FE] hover:text-[#4F46E5]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-5 space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-[#64748B] hover:text-[#0F172A] font-semibold transition-colors cursor-pointer">
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EEF2FF] rounded-lg">
          <Sparkles size={12} className="text-[#4F46E5]" />
          <span className="text-[12px] font-semibold text-[#4F46E5]">{projectName}</span>
        </div>
      </div>

      {/* ── CONSTRUCTION TYPE — read from project, inline override if unset ── */}
      {((): React.ReactNode => {
        const ctInfo = CONSTRUCTION_TYPES.find(c => c.id === constructionType);
        const { Icon: CtIcon } = ctInfo ?? {};
        if (ctInfo) {
          return (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: ctInfo.bg }}>
                {CtIcon && <CtIcon size={14} color={ctInfo.color} />}
              </div>
              <div className="flex-1">
                <span className="text-[12px] font-semibold text-[#0F172A]">{ctInfo.label}</span>
                <span className="text-[11px] text-[#94A3B8] ml-2">from project settings</span>
              </div>
              <div className="flex gap-1">
                {CONSTRUCTION_TYPES.map(ct => (
                  <button key={ct.id} title={ct.label} onClick={() => setConstructionType(ct.id)}
                    className="w-5 h-5 rounded-md border-2 transition-all cursor-pointer"
                    style={ct.id === constructionType
                      ? { borderColor: ct.color, background: ct.color }
                      : { borderColor: "#E2E8F0", background: "#F8FAFC" }
                    } />
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[#FDE68A]">
              <span className="text-[12px] font-bold text-[#92400E]">Construction type not set for this project</span>
              <span className="text-[11px] text-[#B45309]">— select one to unlock tailored questions</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {CONSTRUCTION_TYPES.map(ct => {
                const { Icon } = ct;
                return (
                  <button key={ct.id} onClick={() => setConstructionType(ct.id)}
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm text-center"
                    style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ct.bg }}>
                      <Icon size={13} color={ct.color} />
                    </div>
                    <span className="text-[10px] font-semibold leading-tight text-[#64748B]">{ct.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── SECTION 1: Category tiles upload ── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-[#0F172A]">Upload project documents</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">Click a category → select files. AI reads each type differently — tagging reduces questions</div>
          </div>
          {totalDocs > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#16A34A]">
              {totalDocs} file{totalDocs !== 1 ? "s" : ""} ready
            </span>
          )}
        </div>

        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Category tile grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {DOC_CATEGORIES.map(cat => {
              const catFiles = files.filter(f => f.docCategory === cat.id);
              const catCount = catFiles.length + existingDocs.filter(d => d.folder?.includes(cat.id)).length;
              const active = catCount > 0;
              const { Icon } = cat;
              return (
                <label
                  key={cat.id}
                  title={cat.hint}
                  className="relative flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md group"
                  style={active
                    ? { borderColor: cat.color, background: cat.bg }
                    : { borderColor: "#E2E8F0", background: "#FFFFFF" }
                  }
                >
                  <input type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={e => { addFilesToCategory(cat.id, e.target.files); e.target.value = ""; }} />

                  {/* Icon + badge row */}
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: active ? cat.color : cat.bg }}>
                      <Icon size={15} color={active ? "#fff" : cat.color} />
                    </div>
                    {active ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: cat.color }}>
                        {catCount}
                      </span>
                    ) : (
                      <Upload size={11} className="text-[#CBD5E1] group-hover:text-[#94A3B8] transition-colors mt-0.5" />
                    )}
                  </div>

                  {/* Label + state */}
                  <div>
                    <div className="text-[11px] font-bold leading-tight" style={{ color: active ? cat.color : "#1E293B" }}>
                      {cat.label}
                    </div>
                    <div className="text-[10px] mt-0.5 leading-tight" style={{ color: active ? cat.color : "#94A3B8" }}>
                      {active ? `${catCount} file${catCount > 1 ? "s" : ""} added` : "Click to upload"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* File list — all uploaded files */}
          {(existingDocs.length > 0 || files.length > 0) && (
            <div className="space-y-1">
              {existingDocs.map(doc => {
                const cat = DOC_CATEGORIES.find(c => doc.folder?.includes(c.id));
                return (
                  <div key={doc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <CheckCircle size={12} className="text-[#059669] shrink-0" />
                    <span className="flex-1 text-[11px] text-[#0F172A] truncate">{doc.fileName}</span>
                    {cat && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>}
                    <button onClick={() => handleDeleteDoc(doc.id)} className="text-[#CBD5E1] hover:text-[#CF222E] cursor-pointer shrink-0"><X size={11} /></button>
                  </div>
                );
              })}
              {files.map((entry, i) => {
                const cat = DOC_CATEGORIES.find(c => c.id === entry.docCategory);
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${entry.status === "error" ? "bg-[#FFFBEB] border-[#FCD34D]" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
                    {entry.status === "done" ? <CheckCircle size={12} className="text-[#059669] shrink-0" />
                      : entry.status === "error" ? <AlertTriangle size={12} className="text-[#D97706] shrink-0" />
                      : entry.status === "uploading" ? <Loader size={12} className="animate-spin text-[#4F46E5] shrink-0" />
                      : <FileText size={12} className="text-[#94A3B8] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] text-[#0F172A] truncate">{entry.file.name}</span>
                      {entry.status === "error" && entry.error && (
                        <span className="block text-[10px] text-[#D97706] truncate">{entry.error}</span>
                      )}
                    </div>
                    {entry.status === "uploading" && (
                      <div className="w-16 h-1 bg-[#E2E8F0] rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${entry.progress}%` }} />
                      </div>
                    )}
                    {cat && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>}
                    {!cat && <span className="text-[10px] text-[#D97706] font-medium shrink-0">untagged</span>}
                    {(entry.status === "pending" || entry.status === "error") && (
                      <button onClick={() => removeFile(i)} className="text-[#CBD5E1] hover:text-[#CF222E] cursor-pointer shrink-0"><X size={11} /></button>
                    )}
                    {entry.status === "done" && entry.docId && (
                      <button onClick={() => handleDeleteDoc(entry.docId!)} className="text-[#CBD5E1] hover:text-[#CF222E] cursor-pointer shrink-0"><X size={11} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback drop zone for uncategorised */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg px-4 py-3 text-center transition-all ${
              dragging ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-[#E2E8F0] hover:border-[#C7D2FE]"
            }`}
          >
            <span className="text-[11px] text-[#94A3B8]">Or drag files here — you can tag the category after</span>
          </div>

          {/* Upload / status */}
          {files.some(f => f.status === "pending") && step !== "uploading" && (
            <div className="flex items-center gap-3">
              <button onClick={handleUpload} className="px-4 py-1.5 rounded-lg bg-[#4F46E5] text-white text-[12px] font-semibold hover:bg-[#4338CA] transition-colors cursor-pointer">
                Upload {files.filter(f => f.status === "pending").length} file{files.filter(f => f.status === "pending").length > 1 ? "s" : ""}
              </button>
            </div>
          )}
          {step === "uploading" && <div className="text-[12px] text-[#475569] flex items-center gap-2"><Loader size={13} className="animate-spin text-[#4F46E5]" /> Uploading…</div>}
          {allDone && errorCount === 0 && <div className="text-[12px] font-semibold text-[#059669]">✓ {doneCount} file{doneCount !== 1 ? "s" : ""} uploaded</div>}
        </div>
      </div>

      {deleteError && (
        <div className="px-3 py-2 bg-[#FEF3C7] border border-[#D97706] rounded-lg text-[12px] text-[#92400E] font-semibold flex items-center justify-between">
          <span>⚠ {deleteError}</span>
          <button onClick={() => setDeleteError("")} className="ml-3 hover:opacity-70 cursor-pointer"><X size={12} /></button>
        </div>
      )}

      {/* ── SECTION 2: Smart questions — driven by constructionType ── */}
      {((): React.ReactNode => {
        const taggedCategories = new Set(files.map(f => f.docCategory).filter(Boolean));
        const hasProductivity = taggedCategories.has("productivity") || taggedCategories.has("wbs");
        const hasGFC = taggedCategories.has("gfc");
        const hasContract = taggedCategories.has("contract");
        const hasSurvey = taggedCategories.has("survey");
        const hasBoq = taggedCategories.has("boq");

        const ct = constructionType;
        const isBuilding  = ct === "residential" || ct === "commercial" || ct === "mixed" || ct === "";
        const isIndustrial = ct === "industrial";
        const isRoad      = ct === "road";
        const isRailway   = ct === "railway";
        const isBridge    = ct === "bridge";
        const isTunnel    = ct === "tunnel";

        if (!ct) {
          return (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
              <div className="text-[13px] font-semibold text-[#94A3B8]">Select a construction type above</div>
              <div className="text-[11px] text-[#CBD5E1] mt-1">Questions will appear here — tailored to your project</div>
            </div>
          );
        }

        const ctInfo = CONSTRUCTION_TYPES.find(c => c.id === ct);

        return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-[#0F172A]">
              {ctInfo?.label} — schedule inputs
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              {taggedCategories.size > 0
                ? `${taggedCategories.size} doc type${taggedCategories.size > 1 ? "s" : ""} uploaded — some questions auto-filled`
                : "Upload tagged documents above to reduce questions here"}
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-5">

          {/* ── BUILDING (Residential / Commercial / Mixed Use) ── */}
          {isBuilding && (
            <>
              {!hasGFC ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Floors above ground</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Primary driver of total duration</div>
                    <input type="number" min="1" max="100" value={floors} onChange={e => setFloors(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Basement levels</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Adds excavation + dewatering tasks</div>
                    <ToggleGroup value={basement} onChange={v => setBasement(v as typeof basement)} options={[
                      { value: "0", label: "None" },
                      { value: "1", label: "1 level" },
                      { value: "2plus", label: "2+" },
                    ]} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EFF6FF] border border-[#93C5FD]">
                  <CheckCircle size={12} className="text-[#2563EB] shrink-0" />
                  <span className="text-[11px] text-[#2563EB]">GFC drawings uploaded — floors, basement, and spans detected automatically</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Wings / blocks</div>
                  <div className="text-[11px] text-[#64748B]">Multiple wings enable parallel work — compresses schedule</div>
                </div>
                <input type="number" min="1" max="20" value={wings} onChange={e => setWings(e.target.value)}
                  placeholder="1"
                  className="w-20 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] text-center focus:ring-1 focus:ring-[#4F46E5] outline-none" />
              </div>
              <div className="h-px bg-[#F1F5F9]" />
              {!hasProductivity ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A]">Concrete supply</div>
                    <div className="text-[11px] text-[#64748B]">Determines daily pour output and cycle time</div>
                  </div>
                  <ToggleGroup value={concreteMethod} onChange={v => setConcreteMethod(v as typeof concreteMethod)} options={[
                    { value: "rmc", label: "RMC" },
                    { value: "site", label: "Batching plant" },
                    { value: "manual", label: "Manual mix" },
                  ]} />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">Productivity sheet uploaded — crew norms and output rates read from it</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Tower crane on site?</div>
                  <div className="text-[11px] text-[#64748B]">Changes vertical sequencing and hoist cycles</div>
                </div>
                <ToggleGroup value={useCrane} onChange={v => setUseCrane(v as typeof useCrane)} options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]} />
              </div>
            </>
          )}

          {/* ── INDUSTRIAL ── */}
          {isIndustrial && (
            <>
              {!hasGFC ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Clear height (m)</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Drives structure and crane headroom</div>
                    <input type="number" min="3" max="50" value={clearHeight} onChange={e => setClearHeight(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Bay span (m)</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Column spacing — affects structural cycle time</div>
                    <input type="number" min="5" max="100" value={spanLength} onChange={e => setSpanLength(e.target.value)}
                      placeholder="e.g. 24"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EFF6FF] border border-[#93C5FD]">
                  <CheckCircle size={12} className="text-[#2563EB] shrink-0" />
                  <span className="text-[11px] text-[#2563EB]">GFC drawings uploaded — clear height and bay spans detected automatically</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Overhead / gantry crane?</div>
                  <div className="text-[11px] text-[#64748B]">Adds crane rail erection and commissioning tasks</div>
                </div>
                <ToggleGroup value={useCrane} onChange={v => setUseCrane(v as typeof useCrane)} options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]} />
              </div>
              <div className="h-px bg-[#F1F5F9]" />
            </>
          )}

          {/* ── ROAD / HIGHWAY ── */}
          {isRoad && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Total length (km)</div>
                  <div className="text-[11px] text-[#64748B]">Primary quantity driver for earthworks and paving</div>
                </div>
                <input type="number" min="0.1" step="0.1" value={roadLength} onChange={e => setRoadLength(e.target.value)}
                  placeholder="e.g. 12.5"
                  className="w-24 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] text-center focus:ring-1 focus:ring-[#4F46E5] outline-none" />
              </div>
              {!hasSurvey ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A]">Number of lanes</div>
                    <div className="text-[11px] text-[#64748B]">Doubles earthwork and pavement quantities per km</div>
                  </div>
                  <ToggleGroup value={laneCount} onChange={v => setLaneCount(v as typeof laneCount)} options={[
                    { value: "2", label: "2 lane" },
                    { value: "4", label: "4 lane" },
                    { value: "6", label: "6 lane" },
                    { value: "8plus", label: "8+" },
                  ]} />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">Site survey uploaded — cross-section and lane data read from it</span>
                </div>
              )}
              {!hasBoq ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A]">Pavement type</div>
                    <div className="text-[11px] text-[#64748B]">Determines layer sequence, curing time, and plant required</div>
                  </div>
                  <ToggleGroup value={pavementType} onChange={v => setPavementType(v as typeof pavementType)} options={[
                    { value: "flexible", label: "Flexible (BT)" },
                    { value: "rigid", label: "Rigid (CC)" },
                    { value: "composite", label: "Composite" },
                  ]} />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">BOQ uploaded — pavement layers and quantities read from it</span>
                </div>
              )}
              <div className="h-px bg-[#F1F5F9]" />
            </>
          )}

          {/* ── RAILWAY / METRO ── */}
          {isRailway && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Track length (km)</div>
                  <div className="text-[11px] text-[#64748B]">Total track length including loops and sidings</div>
                </div>
                <input type="number" min="0.1" step="0.1" value={trackLength} onChange={e => setTrackLength(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-24 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] text-center focus:ring-1 focus:ring-[#4F46E5] outline-none" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Number of stations</div>
                  <div className="text-[11px] text-[#64748B]">Each station is a parallel sub-project with civil + fit-out</div>
                </div>
                <input type="number" min="1" max="200" value={stationCount} onChange={e => setStationCount(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-24 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] text-center focus:ring-1 focus:ring-[#4F46E5] outline-none" />
              </div>
              {!hasSurvey ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A]">Track gauge</div>
                    <div className="text-[11px] text-[#64748B]">Determines rail, sleeper, and ballast specifications</div>
                  </div>
                  <ToggleGroup value={trackGauge} onChange={v => setTrackGauge(v as typeof trackGauge)} options={[
                    { value: "broad", label: "Broad (1676mm)" },
                    { value: "metre", label: "Metre (1000mm)" },
                    { value: "standard", label: "Standard (1435mm)" },
                  ]} />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">Site survey uploaded — alignment and gauge data read from it</span>
                </div>
              )}
              <div className="h-px bg-[#F1F5F9]" />
            </>
          )}

          {/* ── BRIDGE / FLYOVER ── */}
          {isBridge && (
            <>
              {!hasSurvey ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Total span (m)</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Sum of all spans — drives falsework and erection plan</div>
                    <input type="number" min="10" value={totalSpan} onChange={e => setTotalSpan(e.target.value)}
                      placeholder="e.g. 480"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A] mb-1">Number of piers</div>
                    <div className="text-[11px] text-[#64748B] mb-2">Each pier is a sequential substructure cycle</div>
                    <input type="number" min="1" value={pierCount} onChange={e => setPierCount(e.target.value)}
                      placeholder="e.g. 16"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">Site survey uploaded — span lengths and pier positions read from it</span>
                </div>
              )}
              {!hasBoq ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold text-[#0F172A]">Deck type</div>
                    <div className="text-[11px] text-[#64748B]">Determines launching / casting method and cycle time</div>
                  </div>
                  <ToggleGroup value={deckType} onChange={v => setDeckType(v as typeof deckType)} options={[
                    { value: "psc", label: "PSC girder" },
                    { value: "steel", label: "Steel girder" },
                    { value: "composite", label: "Composite" },
                    { value: "cable", label: "Cable-stayed" },
                  ]} />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
                  <CheckCircle size={12} className="text-[#D97706] shrink-0" />
                  <span className="text-[11px] text-[#D97706]">BOQ uploaded — deck type and quantities read from it</span>
                </div>
              )}
              <div className="h-px bg-[#F1F5F9]" />
            </>
          )}

          {/* ── TUNNEL ── */}
          {isTunnel && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A] mb-1">Tunnel length (m)</div>
                  <div className="text-[11px] text-[#64748B] mb-2">Total bored / cut length</div>
                  <input type="number" min="10" value={tunnelLength} onChange={e => setTunnelLength(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A] mb-1">Internal diameter (m)</div>
                  <div className="text-[11px] text-[#64748B] mb-2">Drives TBM / lining ring size and segment count</div>
                  <input type="number" min="2" max="20" step="0.1" value={tunnelDiameter} onChange={e => setTunnelDiameter(e.target.value)}
                    placeholder="e.g. 6.5"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] outline-none" />
                </div>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-bold text-[#0F172A]">Construction method</div>
                  <div className="text-[11px] text-[#64748B]">Determines excavation sequence, lining, and cycle time</div>
                </div>
                <ToggleGroup value={tunnelMethod} onChange={v => setTunnelMethod(v as typeof tunnelMethod)} options={[
                  { value: "tbm", label: "TBM" },
                  { value: "natm", label: "NATM" },
                  { value: "cutcover", label: "Cut & Cover" },
                ]} />
              </div>
              <div className="h-px bg-[#F1F5F9]" />
            </>
          )}

          {/* ── COMMON (all types) ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold text-[#0F172A]">Working pattern</div>
              <div className="text-[11px] text-[#64748B]">Double shift cuts duration ~40% — major schedule lever</div>
            </div>
            <ToggleGroup value={workingShift} onChange={v => setWorkingShift(v as typeof workingShift)} options={[
              { value: "single", label: "Single (8h)" },
              { value: "double", label: "Double (16h)" },
              { value: "24x7", label: "24×7" },
            ]} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold text-[#0F172A]">Monsoon shutdown?</div>
              <div className="text-[11px] text-[#64748B]">
                {isRoad || isRailway ? "Stops earthworks and paving for ~3 months"
                  : isBridge ? "Halts substructure and casting work in monsoon months"
                  : isTunnel ? "Usually unaffected — confirm if portal works are outdoor"
                  : "Adds ~3 months gap in outdoor structural work"}
              </div>
            </div>
            <ToggleGroup value={monsoon} onChange={v => setMonsoon(v as typeof monsoon)} options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "na", label: "N/A" },
            ]} />
          </div>
          {!hasContract ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] font-bold text-[#0F172A]">Schedule priority</div>
                <div className="text-[11px] text-[#64748B]">Shapes how AI compresses or smooths the plan</div>
              </div>
              <ToggleGroup value={priority} onChange={v => setPriority(v as typeof priority)} options={[
                { value: "deadline", label: "Hit deadline" },
                { value: "cost", label: "Minimise cost" },
              ]} />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F3FF] border border-[#C4B5FD]">
              <CheckCircle size={12} className="text-[#7C3AED] shrink-0" />
              <span className="text-[11px] text-[#7C3AED]">Contract uploaded — contractual milestones will set schedule priorities</span>
            </div>
          )}
        </div>
      </div>
        );
      })()}

      {/* ── GENERATE BUTTON ── */}
      <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] p-4">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-3 rounded-xl text-[14px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: canGenerate ? "linear-gradient(135deg, #4F46E5, #6D28D9)" : "#94A3B8" }}
        >
          <Sparkles size={16} />
          Generate schedule with AI
        </button>
        {canGenerate ? (
          <div className="text-[11px] text-[#4F46E5] text-center mt-2.5 font-medium">
            Using {totalDocs} document{totalDocs !== 1 ? "s" : ""} · ready in ~2 minutes
          </div>
        ) : (
          <div className="text-[11px] text-[#64748B] text-center mt-2.5">
            Upload at least one document to generate
          </div>
        )}
      </div>

      {files.some(f => f.status === "pending") && (
        <div className="px-3 py-2 bg-[#FEF3C7] border border-[#D97706] rounded-lg text-[12px] text-[#92400E] font-semibold">
          ⚠ {files.filter(f => f.status === "pending").length} file{files.filter(f => f.status === "pending").length > 1 ? "s" : ""} not uploaded yet — upload before generating
        </div>
      )}
    </div>
  );
}

// ─── MOCK MODE WIZARD ────────────────────────────────────────────────────────

function MockImport({
  projectId: _projectId, projectName, mode, onBack, currentVersionCount = 0, onComplete,
}: {
  projectId: number;
  projectName: string;
  mode: ImportMode;
  onBack: () => void;
  currentVersionCount?: number;
  onComplete?: (info: { versionNumber: number; fileName: string; taskCount: number }) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<MockStep>("upload");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [fileQueue, setFileQueue] = useState<{ file: File; status: "pending" | "done" }[]>([]);

  const isRebaseline = currentVersionCount > 0;
  const nextVersion = currentVersionCount + 1;

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

  const modeMethod = IMPORT_METHODS.find(m => m.id === mode)!;
  const acceptedExts = modeMethod.accepts.split(",");

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(f => acceptedExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (!valid.length) return;
    setFileQueue(q => [...q, ...valid.map(f => ({ file: f, status: "pending" as const }))]);
    handleFile(valid[0]);
  }, [handleFile, acceptedExts]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setStep("done");
      onComplete?.({ versionNumber: nextVersion, fileName, taskCount: rows.length });
    }, 1500);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[#DCFCE7] flex items-center justify-center">
          <CheckCircle size={32} className="text-[#16A34A]" />
        </div>
        <div>
          <div className="text-[17px] font-bold text-[#0F172A] mb-1">
            {isRebaseline ? `Baseline v${nextVersion} uploaded` : "Schedule imported"}
          </div>
          <div className="text-[13px] text-[#64748B]">
            {rows.length} tasks imported from <span className="font-semibold text-[#0F172A]">{fileName}</span>
            {isRebaseline && <> · Previous version kept in history</>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            View schedule history
          </button>
          <button
            onClick={() => router.push(`/dashboard/schedule/gantt`)}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#475569] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            Open Gantt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-[#64748B] hover:text-[#0F172A] font-semibold transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-[#E2E8F0]">·</span>
          <SectionTitle>{isRebaseline ? "Upload new version" : "Import schedule"} · {SHORT_MODE_LABEL[mode] ?? modeMethod.label}</SectionTitle>
        </div>
        <div className="flex items-center gap-2">
          {isRebaseline && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFFBEB] text-[#D97706]">v{nextVersion} next</span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF6FF] rounded-md">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            <span className="text-[12px] font-semibold text-[#2563EB]">{projectName}</span>
          </div>
        </div>
      </div>


      {step === "upload" && (
        <Card>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${dragging ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
          >
            <div className="mb-3">{isRebaseline ? <RefreshCw size={48} className="text-[#94A3B8] mx-auto" /> : <Upload size={48} className="text-[#94A3B8] mx-auto" />}</div>
            <div className="text-sm font-semibold text-[#0F172A] mb-1">
              Upload Baseline v{nextVersion} for {projectName}
            </div>
            <div className="text-xs text-[#94A3B8] mb-1">
              {isRebaseline
                ? "This will replace the active baseline — previous versions are kept in history above"
                : <span>This will become the baseline schedule for <span className="font-semibold text-[#0F172A]">{projectName}</span></span>
              }
            </div>
            <div className="text-xs text-[#94A3B8] mb-4">Supports {modeMethod.formats.join(", ")} — select multiple files at once</div>
            <label>
              <input type="file" accept={modeMethod.accepts} multiple className="hidden"
                onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
              <span className="inline-block px-5 py-2 bg-[#2563EB] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#1D4ED8] transition-colors">
                Browse Files
              </span>
            </label>
            {fileQueue.length > 1 && (
              <div className="mt-3 text-[11px] text-[#475569]">
                {fileQueue.length} files queued — processing <span className="font-semibold text-[#0F172A]">{fileQueue[0]?.file.name}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#0F172A]">Map Your Columns</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">📎 {fileName} — {rows.length} rows detected</div>
            </div>
            <div className="flex gap-2">
              <Btn small onClick={() => setStep("upload")}>← Back</Btn>
              <Btn small primary onClick={() => setStep("preview")}>Next: Preview →</Btn>
            </div>
          </div>
          <div className="space-y-2">
            {headers.map(h => (
              <div key={h} className="flex items-center gap-3 py-2 px-3 rounded-md bg-[#F8FAFC]">
                <div className="w-48 text-xs font-semibold text-[#0F172A] font-mono">{h}</div>
                <span className="text-[#94A3B8] text-sm">→</span>
                <select value={mappings[h] || ""} onChange={e => setMappings({ ...mappings, [h]: e.target.value })}
                  className="flex-1 border border-[#E2E8F0] rounded-md px-3 py-1.5 text-xs bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
                  <option value="">Select field...</option>
                  {BLUQ_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {mappings[h] && mappings[h] !== "— Skip Column —" && <span className="text-[#059669] text-sm">✓</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[#E2E8F0] pt-4">
            <div className="text-[11px] font-bold text-[#475569] mb-2">SAMPLE DATA (first 2 rows)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead><tr className="bg-[#F8FAFC]">{headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-bold text-[#475569] border-b border-[#E2E8F0] whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 2).map((row, ri) => <tr key={ri} className="border-b border-[#F1F5F9]">{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-[#0F172A] whitespace-nowrap font-mono">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-[#0F172A]">Review & Import</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">
                {rows.length} tasks will be imported as <span className="font-semibold text-[#0F172A]">Baseline v{nextVersion}</span> into <span className="font-semibold text-[#0F172A]">{projectName}</span>
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
              <thead><tr className="bg-[#F8FAFC]">{headers.map(h => <th key={h} className="px-2 py-1.5 text-left border-b border-[#E2E8F0] whitespace-nowrap"><div className="font-bold text-[#2563EB]">{mappings[h] || "—"}</div><div className="font-normal text-[#94A3B8]">{h}</div></th>)}</tr></thead>
              <tbody>{rows.map((row, ri) => <tr key={ri} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-[#0F172A] whitespace-nowrap font-mono">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-[#ECFDF5] rounded-md flex items-center gap-2">
            <span className="text-[#059669] font-bold text-sm">✓</span>
            <span className="text-xs text-[#059669] font-semibold">
              {rows.length} tasks ready as Baseline v{nextVersion} for {projectName} · {Object.values(mappings).filter(v => v && v !== "— Skip Column —").length} columns mapped
            </span>
          </div>
        </Card>
      )}

    </div>
  );
}

// ─── MAIN CONTENT ─────────────────────────────────────────────────────────────

function ImportCSVContent() {
  const searchParams = useSearchParams();
  const { workspaceId, isDesignMode, loading: wsLoading } = useWorkspace();

  const projectIdParam = searchParams.get("projectId") ?? "0";
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;
  const hasProject = projectIdParam !== "0" && projectIdParam !== "";
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [versions, setVersions] = useState<ScheduleVersion[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showNewBaselinePicker, setShowNewBaselinePicker] = useState(false);

  const [projectName, setProjectName] = useState("Select Project");
  const [projectStartDate, setProjectStartDate] = useState<string | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<string | null>(null);
  const [projectCategory, setProjectCategory] = useState<string | null>(null);
  const [projectCity, setProjectCity] = useState<string | null>(null);

  useEffect(() => {
    if (real && workspaceId) {
      fetchProjects(workspaceId).then(rows => {
        const match = rows.find(p => p.id === projectIdParam);
        if (match) {
          setProjectName(match.projectName);
          setProjectStartDate(match.startDate ?? null);
          setProjectEndDate(match.endDate ?? null);
          setProjectCategory(match.category ?? null);
          // Extract city from address: "Dubai Marina, Dubai" → "Dubai"
          if (match.address) {
            const parts = match.address.split(",").map((s: string) => s.trim()).filter(Boolean);
            setProjectCity(parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null);
          }
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

  // Fetch existing schedule versions; auto-create v1 if tasks exist but no version yet
  useEffect(() => {
    if (real && workspaceId && isRealProject(projectIdParam)) {
      setVersionsLoading(true);
      fetchScheduleVersions(projectIdParam, workspaceId)
        .then(async v => {
          if (v.length === 0) {
            // Check for manually created tasks
            try {
              const existingTasks = await fetchTasks(projectIdParam, workspaceId);
              console.log("[ImportSchedule] tasks found:", existingTasks.length);
              if (existingTasks.length > 0) {
                const newV = await createScheduleVersion(projectIdParam, workspaceId);
                setVersions([newV]);
                return;
              }
            } catch (e) {
              console.error("[ImportSchedule] auto-create v1 failed:", e);
            }
          }
          setVersions(v);
        })
        .catch(() => setVersions([]))
        .finally(() => setVersionsLoading(false));
    } else if (hasProject) {
      // Design mode — use mock versions so the landing looks populated
      setVersions(MOCK_SCHEDULE_VERSIONS);
    } else {
      setVersions([]);
    }
  }, [projectIdParam, real, workspaceId, hasProject]);

  if (wsLoading) {
    return <div className="p-5 text-sm text-[#94A3B8]">Loading...</div>;
  }

  if (!hasProject) {
    return (
      <div className="p-5">
        <SectionTitle>Import Schedule</SectionTitle>
        <Card className="mt-4">
          <div className="text-center py-12">
            <ClipboardList size={40} className="mb-3 text-[#94A3B8] mx-auto" />
            <div className="text-sm font-semibold text-[#0F172A] mb-1">No project selected</div>
            <div className="text-xs text-[#94A3B8]">Select a project from the dropdown above, or create a new one.</div>
          </div>
        </Card>
      </div>
    );
  }

  const goBack = () => { setImportMode(null); setShowNewBaselinePicker(false); };

  const pickMethod = (m: ImportMode) => {
    setShowNewBaselinePicker(false);
    setImportMode(m);
  };

  // ScheduleLanding is ALWAYS the home screen — shown until user actively picks a method
  if (!importMode && !showNewBaselinePicker) {
    return (
      <ScheduleLanding
        projectName={projectName}
        projectId={projectIdParam}
        workspaceId={workspaceId ?? ""}
        versions={versions ?? []}
        loading={versionsLoading}
        onSetup={() => setShowNewBaselinePicker(true)}
      />
    );
  }

  // Method picker — user clicked "Set up schedule" or "New version"
  if (!importMode || showNewBaselinePicker) {
    return (
      <ImportMethodPicker
        projectName={projectName}
        onSelect={pickMethod}
        onBack={goBack}
      />
    );
  }

  if (importMode === "manual") {
    return <ManualScheduleSetup projectId={projectIdParam} projectName={projectName} onBack={goBack} />;
  }

  const handleImportComplete = (info: { versionNumber: number; fileName: string; taskCount: number }) => {
    const newV: ScheduleVersion = {
      id: `v-${Date.now()}`,
      versionNumber: info.versionNumber,
      isBaseline: true,
      isLocked: false,
      generatedBy: "import",
      uploadedBy: null,
      uploadedByName: "You",
      sourceFileName: info.fileName,
      aiReasoning: null,
      createdAt: new Date().toISOString(),
      scheduleJson: {},
    };
    // New version becomes baseline; demote previous ones
    setVersions(prev => [newV, ...(prev ?? []).map(v => ({ ...v, isBaseline: false }))]);
  };

  const mockImportProps = {
    projectId: Number(projectIdParam),
    projectName,
    mode: importMode,
    onBack: goBack,
    currentVersionCount: (versions ?? []).length,
    onComplete: handleImportComplete,
  };

  // AI mode always uses RealImport — works for both real and mock projects
  // ?testType=Infrastructure|Industrial|Residential overrides project category for local testing
  const testType = process.env.NODE_ENV === "development" ? searchParams.get("testType") : null;
  if (importMode === "ai") {
    return <RealImport projectId={projectIdParam} workspaceId={workspaceId ?? ""} projectName={projectName} initialStartDate={projectStartDate} initialEndDate={projectEndDate} initialBuildingType={testType ?? projectCategory} initialCity={projectCity} onBack={goBack} />;
  }

  return <MockImport {...mockImportProps} />;
}

export default function ImportCSVPage() {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-[#94A3B8]">Loading...</div>}>
      <ImportCSVContent />
    </Suspense>
  );
}
