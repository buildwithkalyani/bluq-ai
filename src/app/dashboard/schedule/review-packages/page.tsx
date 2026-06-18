"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle, Loader, RefreshCw, Zap } from "lucide-react";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import {
  fetchPendingWorkPackages,
  cancelWorkPackages,
  confirmWorkPackages,
} from "@/lib/api-client";
import { SCHEDULE_PENDING_PREFIX } from "@/hooks/useSchedulePoller";

// ─── TYPES (mirror bluq-api/src/lib/infra/work-package-types.ts) ─────────────

type QuantityBasis = "boq" | "drawing_measured" | "estimated";
type ProductivityBasis = "user_input" | "document" | "indian_norm";
type ResourceBasis = "document" | "assumed";

interface Predecessor {
  id: string;
  type: "FS" | "SS";
  lagDays: number;
}

interface WorkPackage {
  id: string;
  name: string;
  phase: string;
  quantity: number;
  unit: string;
  resourceType: string;
  resourceUnitsRequired: number;
  productivityRate: number;
  productivityBasis: ProductivityBasis;
  predecessors: Predecessor[];
  monsoonSensitive: boolean;
  zoneId: string;
  quantityBasis: QuantityBasis;
  notes?: string;
}

interface ResourceTypeInfo {
  type: string;
  defaultCount: number;
  description: string;
  resourceBasis: ResourceBasis;
}

interface ProductivityConflict {
  resourceType: string;
  documentRate: number;
  userRate: number;
  affectedPackageIds: string[];
  note: string;
}

interface ExtractedScheduleInput {
  infraType: string;
  workPackages: WorkPackage[];
  availableResourceTypes: ResourceTypeInfo[];
  monsoonMonths: number[];
  extractionSummary: {
    totalPackages: number;
    boqDerived: number;
    drawingMeasured: number;
    estimated: number;
    missingData: string[];
    productivityConflicts: ProductivityConflict[];
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatResourceType(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const BASIS_COLORS: Record<QuantityBasis, string> = {
  boq:              "bg-[#DCFCE7] text-[#15803D]",
  drawing_measured: "bg-[#DBEAFE] text-[#1D4ED8]",
  estimated:        "bg-[#FEF9C3] text-[#A16207]",
};

const PRODUCTIVITY_COLORS: Record<ProductivityBasis, string> = {
  user_input:   "bg-[#F3E8FF] text-[#7C3AED]",
  document:     "bg-[#DCFCE7] text-[#15803D]",
  indian_norm:  "bg-[#FEF9C3] text-[#A16207] border border-[#FCD34D]",
};

const BASIS_LABELS: Record<QuantityBasis, string> = {
  boq:              "BOQ",
  drawing_measured: "Drawing",
  estimated:        "Est.",
};

const PRODUCTIVITY_LABELS: Record<ProductivityBasis, string> = {
  user_input:  "User",
  document:    "Doc",
  indian_norm: "IS Norm ⚠",
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatPill({
  label, value, color = "neutral",
}: { label: string; value: number; color?: "neutral" | "green" | "blue" | "amber" | "red" }) {
  const bg: Record<string, string> = {
    neutral: "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]",
    green:   "bg-[#F0FDF4] border-[#A7F3D0] text-[#059669]",
    blue:    "bg-[#EFF6FF] border-[#93C5FD]  text-[#2563EB]",
    amber:   "bg-[#FFFBEB] border-[#FCD34D]  text-[#D97706]",
    red:     "bg-[#FEF2F2] border-[#FCA5A5]  text-[#DC2626]",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${bg[color]}`}>
      <div className="text-[22px] font-bold leading-none">{value}</div>
      <div className="text-[11px] mt-1 font-medium opacity-80">{label}</div>
    </div>
  );
}

function ConflictsBanner({ conflicts }: { conflicts: ProductivityConflict[] }) {
  return (
    <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#92400E]">
        <AlertTriangle size={15} />
        {conflicts.length} productivity conflict{conflicts.length !== 1 ? "s" : ""} detected
      </div>
      {conflicts.map((c, i) => (
        <div key={i} className="text-[12px] text-[#78350F] pl-5">
          <span className="font-mono font-semibold">{formatResourceType(c.resourceType)}</span>
          {" — "}{c.note}
          {c.affectedPackageIds.length > 0 && (
            <span className="text-[#A16207] ml-1">({c.affectedPackageIds.length} package{c.affectedPackageIds.length !== 1 ? "s" : ""})</span>
          )}
        </div>
      ))}
    </div>
  );
}

function IndianNormBanner({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="text-[#D97706] shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-[#92400E]">
            {count} work package{count !== 1 ? "s" : ""} using Indian IS/MoRT&H norm rates
          </div>
          <div className="text-[12px] text-[#78350F] mt-0.5">
            Productivity rates for these packages were not found in your uploaded documents. Standard Indian norms have been applied as a fallback — look for <span className="font-semibold">IS Norm ⚠</span> badges in the table. Edit any rate before confirming if you have project-specific data.
          </div>
        </div>
      </div>
    </div>
  );
}

function MissingDataBanner({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#991B1B]">
        <AlertTriangle size={15} />
        {items.length} missing data item{items.length !== 1 ? "s" : ""} — these quantities were estimated
      </div>
      {items.map((item, i) => (
        <div key={i} className="text-[12px] text-[#7F1D1D] pl-5">· {item}</div>
      ))}
    </div>
  );
}

function ResourcesCard({ resources }: { resources: ResourceTypeInfo[] }) {
  const hasAssumed = resources.some(r => r.resourceBasis === "assumed");
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#0F172A]">Resource Deployment</span>
        {hasAssumed && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#D97706]">
            <AlertTriangle size={12} /> Some resources assumed — no method statement found
          </span>
        )}
      </div>
      <div className="divide-y divide-[#F1F5F9]">
        {resources.map(r => (
          <div key={r.type} className="px-4 py-2.5 grid grid-cols-[1fr_80px_40px] items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[#0F172A]">{formatResourceType(r.type)}</span>
                {r.resourceBasis === "assumed" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF9C3] text-[#A16207] border border-[#FCD34D]">
                    <AlertTriangle size={9} /> Assumed
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">{r.description}</div>
            </div>
            <div className="text-[11px] text-[#475569] text-right">
              Default: <span className="font-semibold text-[#0F172A]">{r.defaultCount}</span> unit{r.defaultCount !== 1 ? "s" : ""}
            </div>
            <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center ${r.resourceBasis === "document" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF9C3] text-[#A16207]"}`}>
              {r.resourceBasis === "document" ? "Doc" : "Est"}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EditableNumber({
  value, original, onChange, min = 0, step = 1,
}: {
  value: number; original: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  const isDirty = value !== original;
  return (
    <input
      type="number"
      value={value}
      min={min}
      step={step}
      onChange={e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= min) onChange(v);
      }}
      className={`w-full rounded border px-2 py-1 text-[12px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-[#2563EB] transition-colors ${
        isDirty
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
          : "border-[#E2E8F0] bg-white text-[#0F172A]"
      }`}
    />
  );
}

function WorkPackageRow({
  wp, editedQty, editedUnits, editedRate, isAssumed, isLast, onEditQty, onEditUnits, onEditRate,
}: {
  wp: WorkPackage;
  editedQty: number;
  editedUnits: number;
  editedRate: number;
  isAssumed: boolean;
  isLast: boolean;
  onEditQty: (v: number) => void;
  onEditUnits: (v: number) => void;
  onEditRate: (v: number) => void;
}) {
  const hasWarning = isAssumed || wp.quantityBasis === "estimated" || wp.productivityBasis === "indian_norm";
  return (
    <div className={`grid grid-cols-[2fr_1.1fr_1.2fr_0.8fr_1.3fr_0.9fr] items-center px-4 py-2.5 gap-3 text-[12px] ${!isLast ? "border-b border-[#F1F5F9]" : ""} ${hasWarning ? "bg-[#FFFDF5]" : "hover:bg-[#FAFAFA]"} transition-colors`}>

      {/* Package name */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[#0F172A] truncate">{wp.name}</span>
          {hasWarning && <AlertTriangle size={12} className="text-[#D97706] shrink-0" />}
        </div>
        <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5 flex items-center gap-2">
          <span>{wp.id}</span>
          {wp.predecessors.length > 0 && (
            <span className="text-[#64748B]">{wp.predecessors.length} pred.</span>
          )}
          {wp.monsoonSensitive && (
            <span className="text-[#0891B2]">🌧 monsoon</span>
          )}
        </div>
        {wp.notes && (
          <div className="text-[10px] text-[#94A3B8] italic mt-0.5 truncate">{wp.notes}</div>
        )}
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <EditableNumber
            value={editedQty}
            original={wp.quantity}
            onChange={onEditQty}
            step={wp.unit === "no." ? 1 : 0.01}
          />
        </div>
        <span className="text-[10px] text-[#64748B] shrink-0">{wp.unit}</span>
      </div>

      {/* Resource type */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[#0F172A] font-medium truncate">{formatResourceType(wp.resourceType)}</span>
          {isAssumed && (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-[#FEF9C3] text-[#A16207] border border-[#FCD34D] shrink-0">assumed</span>
          )}
        </div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5">{wp.zoneId}</div>
      </div>

      {/* Resource units */}
      <EditableNumber
        value={editedUnits}
        original={wp.resourceUnitsRequired}
        onChange={onEditUnits}
        min={1}
        step={1}
      />

      {/* Productivity */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <EditableNumber
            value={editedRate}
            original={wp.productivityRate}
            onChange={onEditRate}
            min={0.01}
            step={0.01}
          />
        </div>
        <span className="text-[10px] text-[#64748B] shrink-0">{wp.unit}/d</span>
      </div>

      {/* Basis badges */}
      <div className="flex flex-col gap-1">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center ${BASIS_COLORS[wp.quantityBasis]}`}>
          {BASIS_LABELS[wp.quantityBasis]}
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center ${PRODUCTIVITY_COLORS[wp.productivityBasis]}`}>
          {PRODUCTIVITY_LABELS[wp.productivityBasis]}
        </span>
      </div>
    </div>
  );
}

function ConfirmedState({
  versionNumber, projectId, workspaceId,
}: { versionNumber: number; projectId: string | null; workspaceId: string | null }) {
  const router = useRouter();
  return (
    <div className="p-5 max-w-xl">
      <Card className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-[#059669]" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#0F172A]">Work packages confirmed</div>
            <div className="text-[12px] text-[#475569] mt-1">
              Schedule <span className="font-semibold text-[#2563EB]">v{versionNumber}</span> has been queued for optimization. You{"'"}ll be notified when it{"'"}s ready.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <Zap size={13} className="text-[#64748B] shrink-0" />
          <span className="text-[11px] text-[#64748B]">
            RCPSP constraint solver will assign resources, resolve dependencies, and build the Gantt — this usually takes under 60 seconds.
          </span>
        </div>
        <Btn
          primary
          onClick={() =>
            router.push(
              `/dashboard/schedule/import-csv?projectId=${projectId}&workspaceId=${workspaceId}`
            )
          }
          className="w-full justify-center"
        >
          Back to Schedule
        </Btn>
      </Card>
    </div>
  );
}

// ─── MAIN CONTENT ─────────────────────────────────────────────────────────────

function ReviewPackagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const jobId = searchParams.get("jobId");
  const projectId = searchParams.get("projectId");
  const workspaceId = searchParams.get("workspaceId");

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedScheduleInput | null>(null);
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [constructionType, setConstructionType] = useState("");

  // Inline edits: wpId → { quantity?, resourceUnitsRequired?, productivityRate? }
  const [edits, setEdits] = useState<Map<string, { quantity?: number; resourceUnitsRequired?: number; productivityRate?: number }>>(new Map());

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<number | null>(null); // confirmed version number

  useEffect(() => {
    if (!jobId) {
      setFetchError("No job ID in URL. Navigate here from the import page.");
      setLoading(false);
      return;
    }
    fetchPendingWorkPackages(jobId)
      .then(result => {
        setData(result.data as ExtractedScheduleInput);
        setVersionNumber(result.versionNumber);
        setConstructionType(result.constructionType);
        setLoading(false);
      })
      .catch(err => {
        setFetchError(err.message ?? "Failed to load work packages");
        setLoading(false);
      });
  }, [jobId]);

  function setEdit(wpId: string, field: "quantity" | "resourceUnitsRequired" | "productivityRate", value: number) {
    setEdits(prev => {
      const next = new Map(prev);
      next.set(wpId, { ...next.get(wpId), [field]: value });
      return next;
    });
  }

  function getVal(wp: WorkPackage, field: "quantity" | "resourceUnitsRequired" | "productivityRate") {
    return edits.get(wp.id)?.[field] ?? wp[field];
  }

  async function handleConfirm() {
    if (!jobId) return;
    setConfirming(true);
    setActionError(null);
    try {
      const editsArr = Array.from(edits.entries()).map(([id, changes]) => ({ id, ...changes }));
      const result = await confirmWorkPackages(jobId, editsArr.length > 0 ? editsArr : undefined);
      if (projectId) localStorage.removeItem(`${SCHEDULE_PENDING_PREFIX}${projectId}`);
      setConfirmed(result.versionNumber);
    } catch (err: any) {
      setActionError(err.message ?? "Failed to confirm. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!jobId) return;
    setCancelling(true);
    try {
      await cancelWorkPackages(jobId);
    } catch { /* swallow — navigate anyway */ }
    if (projectId) localStorage.removeItem(`${SCHEDULE_PENDING_PREFIX}${projectId}`);
    router.push(
      `/dashboard/schedule/import-csv?projectId=${projectId}&workspaceId=${workspaceId}`
    );
  }

  // ── loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] gap-2">
        <Loader size={16} className="animate-spin" />
        <span className="text-[13px]">Loading work packages…</span>
      </div>
    );
  }

  // ── fetch error ──
  if (fetchError) {
    return (
      <div className="p-5 max-w-xl">
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-[#FEF2F2] rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-[#DC2626]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0F172A]">Could not load work packages</div>
              <div className="text-[12px] text-[#64748B] mt-0.5">{fetchError}</div>
            </div>
          </div>
          <Btn onClick={() => router.push(`/dashboard/schedule/import-csv?projectId=${projectId}&workspaceId=${workspaceId}`)}>
            <ArrowLeft size={13} /> Back to Schedule
          </Btn>
        </Card>
      </div>
    );
  }

  // ── confirmed ──
  if (confirmed !== null) {
    return <ConfirmedState versionNumber={confirmed} projectId={projectId} workspaceId={workspaceId} />;
  }

  if (!data) return null;

  const summary = data.extractionSummary;
  const assumedResourceTypes = new Set(
    data.availableResourceTypes.filter(r => r.resourceBasis === "assumed").map(r => r.type)
  );

  // Group by phase, preserving extraction order
  const phaseOrder: string[] = [];
  const byPhase = new Map<string, WorkPackage[]>();
  for (const wp of data.workPackages) {
    if (!byPhase.has(wp.phase)) { phaseOrder.push(wp.phase); byPhase.set(wp.phase, []); }
    byPhase.get(wp.phase)!.push(wp);
  }

  const dirtyCount = edits.size;
  const indianNormCount = data.workPackages.filter(wp => wp.productivityBasis === "indian_norm").length;
  const warningCount = data.workPackages.filter(wp =>
    assumedResourceTypes.has(wp.resourceType) || wp.quantityBasis === "estimated" || wp.productivityBasis === "indian_norm"
  ).length;

  return (
    <div className="p-5 space-y-4 max-w-5xl">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/schedule/import-csv?projectId=${projectId}&workspaceId=${workspaceId}`)}
          className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <ArrowLeft size={16} className="text-[#64748B]" />
        </button>
        <div>
          <SectionTitle>
            Review Work Packages{versionNumber != null ? ` — v${versionNumber}` : ""}
          </SectionTitle>
          <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-2">
            <span className="capitalize">{constructionType.replace(/_/g, " ")}</span>
            <span className="text-[#CBD5E1]">·</span>
            <span>{summary.totalPackages} packages</span>
            {warningCount > 0 && (
              <>
                <span className="text-[#CBD5E1]">·</span>
                <span className="text-[#D97706] flex items-center gap-1">
                  <AlertTriangle size={11} /> {warningCount} need review
                </span>
              </>
            )}
            {data.monsoonMonths.length > 0 && (
              <>
                <span className="text-[#CBD5E1]">·</span>
                <span className="text-[#0891B2]">🌧 monsoon {data.monsoonMonths.map(m => MONTH_NAMES[m - 1]).join(", ")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── SUMMARY STATS ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Total packages"    value={summary.totalPackages} />
        <StatPill label="From BOQ"          value={summary.boqDerived}       color="green" />
        <StatPill label="Drawing measured"  value={summary.drawingMeasured}   color="blue" />
        <StatPill label="Estimated"         value={summary.estimated}         color={summary.estimated > 0 ? "amber" : "green"} />
      </div>

      {/* ── ALERT BANNERS ── */}
      {indianNormCount > 0 && <IndianNormBanner count={indianNormCount} />}
      {summary.productivityConflicts.length > 0 && (
        <ConflictsBanner conflicts={summary.productivityConflicts} />
      )}
      {summary.missingData.length > 0 && (
        <MissingDataBanner items={summary.missingData} />
      )}

      {/* ── RESOURCES ── */}
      {data.availableResourceTypes.length > 0 && (
        <ResourcesCard resources={data.availableResourceTypes} />
      )}

      {/* ── WORK PACKAGES TABLE ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#0F172A]">Work Packages</span>
          <span className="text-[11px] text-[#64748B]">Edit quantity, resource units, or productivity rate directly</span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1.1fr_1.2fr_0.8fr_1.3fr_0.9fr] text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0] gap-3">
          <div>Package</div>
          <div>Quantity</div>
          <div>Resource</div>
          <div>Units</div>
          <div>Productivity</div>
          <div>Basis</div>
        </div>

        {phaseOrder.map(phase => {
          const pkgs = byPhase.get(phase)!;
          return (
            <div key={phase}>
              <div className="px-4 py-1.5 bg-[#F1F5F9] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.1em] capitalize">
                  {phase.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-[#94A3B8]">{pkgs.length} package{pkgs.length !== 1 ? "s" : ""}</span>
              </div>
              {pkgs.map((wp, i) => (
                <WorkPackageRow
                  key={wp.id}
                  wp={wp}
                  editedQty={getVal(wp, "quantity")}
                  editedUnits={getVal(wp, "resourceUnitsRequired")}
                  editedRate={getVal(wp, "productivityRate")}
                  isAssumed={assumedResourceTypes.has(wp.resourceType)}
                  isLast={i === pkgs.length - 1}
                  onEditQty={v => setEdit(wp.id, "quantity", v)}
                  onEditUnits={v => setEdit(wp.id, "resourceUnitsRequired", v)}
                  onEditRate={v => setEdit(wp.id, "productivityRate", v)}
                />
              ))}
            </div>
          );
        })}
      </Card>

      {/* ── ACTION ERROR ── */}
      {actionError && (
        <div className="flex items-center gap-2 text-[12px] text-[#DC2626] px-1">
          <AlertTriangle size={13} />
          {actionError}
        </div>
      )}

      {/* ── ACTION BAR ── */}
      <div className="flex items-center justify-between pt-1 pb-4">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="text-[12px] text-[#8C959F] hover:text-[#CF222E] font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {cancelling && <Loader size={12} className="animate-spin" />}
          {cancelling ? "Cancelling…" : "Cancel — discard and start over"}
        </button>

        <div className="flex items-center gap-3">
          {dirtyCount > 0 && (
            <span className="text-[11px] text-[#2563EB] font-medium">
              {dirtyCount} edit{dirtyCount !== 1 ? "s" : ""} applied
            </span>
          )}
          <Btn
            primary
            onClick={handleConfirm}
            disabled={confirming}
            className="min-w-[200px] justify-center"
          >
            {confirming && <Loader size={13} className="animate-spin" />}
            {confirming ? "Confirming…" : "Confirm & build schedule →"}
          </Btn>
        </div>
      </div>

    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ReviewPackagesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-16 text-[#64748B] gap-2">
        <Loader size={16} className="animate-spin" />
        <span className="text-[13px]">Loading…</span>
      </div>
    }>
      <ReviewPackagesContent />
    </Suspense>
  );
}
