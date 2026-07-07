"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle, Loader, ChevronDown, ChevronUp } from "lucide-react";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import {
  fetchPendingInfraParams,
  cancelInfraParams,
  confirmInfraParams,
  type PendingInfraParamsResult,
} from "@/lib/api-client";
import { SCHEDULE_PENDING_PREFIX } from "@/hooks/useSchedulePoller";

// ─── Section editor ───────────────────────────────────────────────────────────

interface Section {
  id:                     string;
  name:                   string;
  quantityValue?:         number;
  quantityBasis?:         "document" | "estimated";
  quantityUnit?:          string;
  maxConcurrentActivities?: number;
  accessRoute?:           string;
}

interface Resource {
  type:   string;
  count:  number;
  basis:  "document" | "assumed";
}

// ─── Main page component (inner) ─────────────────────────────────────────────

function ReviewPageInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const jobId        = params.get("jobId") ?? "";
  const projectId    = params.get("projectId") ?? "";
  const workspaceId  = params.get("workspaceId") ?? "";

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [row, setRow]               = useState<PendingInfraParamsResult | null>(null);

  // Editable slices
  const [sections, setSections]     = useState<Section[]>([]);
  const [resources, setResources]   = useState<Resource[]>([]);
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!jobId) { setError("No job ID in URL"); setLoading(false); return; }
    fetchPendingInfraParams(jobId)
      .then(r => {
        setRow(r);
        setSections((r.data.params as any).sections ?? []);
        setResources((r.data.params as any).availableResources ?? []);
      })
      .catch(e => setError(e.message ?? "Failed to load parameters"))
      .finally(() => setLoading(false));
  }, [jobId]);

  const missingData: string[] = (row?.data.params as any)?.missingData ?? [];

  const handleConfirm = async () => {
    if (!row) return;
    setSubmitting(true);
    try {
      const editedParams = {
        ...(row.data.params as object),
        sections,
        availableResources: resources,
      };
      const result = await confirmInfraParams(jobId, editedParams);
      localStorage.removeItem(`${SCHEDULE_PENDING_PREFIX}${projectId}`);
      router.push(
        `/dashboard/schedule?projectId=${projectId}&workspaceId=${workspaceId}&versionId=${result.scheduleVersionId}`
      );
    } catch (e: any) {
      setError(e.message ?? "Failed to build schedule");
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try { await cancelInfraParams(jobId); } catch { /* no-op */ }
    localStorage.removeItem(`${SCHEDULE_PENDING_PREFIX}${projectId}`);
    router.push(`/dashboard/schedule/import-csv?projectId=${projectId}&workspaceId=${workspaceId}`);
  };

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-[#475569]">
        <Loader size={18} className="animate-spin" />
        <span className="text-[13px]">Loading extracted parameters…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-3">
        <div className="flex items-center gap-2 text-[#DC2626] text-[13px]">
          <AlertTriangle size={16} /> {error}
        </div>
        <Btn onClick={() => router.back()}>Go back</Btn>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-[12px] text-[#475569] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div>
        <SectionTitle>Review Extracted Parameters</SectionTitle>
        <p className="text-[12px] text-[#475569] mt-1">
          Claude extracted these values from your documents.
          Edit quantities or resource counts where needed, then confirm to build the schedule.
        </p>
      </div>

      {/* Missing data banner */}
      {missingData.length > 0 && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
          <div>
            <div className="text-[12px] font-semibold text-[#DC2626]">
              {missingData.length} field{missingData.length > 1 ? "s" : ""} could not be extracted
            </div>
            <div className="text-[11px] text-[#B91C1C] mt-0.5">
              {missingData.join(" · ")}
            </div>
            <div className="text-[11px] text-[#7F1D1D] mt-1">
              Default engineering norms applied. Edit sections below to override.
            </div>
          </div>
        </div>
      )}

      {/* Confidence + construction type */}
      <Card className="flex items-center justify-between py-3">
        <div className="text-[12px] text-[#475569]">
          Construction type: <span className="font-semibold text-[#0F172A]">{row?.constructionType}</span>
        </div>
        <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
          (row?.data.params as any)?.confidence === "high"
            ? "bg-[#F0FDF4] border-[#A7F3D0] text-[#059669]"
            : (row?.data.params as any)?.confidence === "medium"
            ? "bg-[#FFFBEB] border-[#FCD34D] text-[#D97706]"
            : "bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]"
        }`}>
          {(row?.data.params as any)?.confidence ?? "—"} confidence
        </div>
      </Card>

      {/* Sections */}
      {sections.length > 0 && (
        <Card className="space-y-3">
          <button
            className="w-full flex items-center justify-between text-[13px] font-semibold text-[#0F172A]"
            onClick={() => toggle("sections")}
          >
            Sections / zones ({sections.length})
            {expanded["sections"] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded["sections"] && (
            <div className="space-y-3 pt-1">
              {sections.map((sec, i) => (
                <div key={sec.id} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                  <div className="text-[12px] font-semibold text-[#0F172A]">{sec.name}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#64748B] uppercase tracking-wide">Quantity ({sec.quantityUnit ?? "unit"})</label>
                      <input
                        type="number"
                        className="mt-0.5 w-full border border-[#E2E8F0] rounded px-2 py-1 text-[12px] text-[#0F172A]"
                        value={sec.quantityValue ?? ""}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setSections(prev => prev.map((s, j) => j === i ? { ...s, quantityValue: isNaN(v) ? undefined : v } : s));
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] uppercase tracking-wide">Max concurrent activities</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-0.5 w-full border border-[#E2E8F0] rounded px-2 py-1 text-[12px] text-[#0F172A]"
                        value={sec.maxConcurrentActivities ?? 1}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          setSections(prev => prev.map((s, j) => j === i ? { ...s, maxConcurrentActivities: isNaN(v) ? 1 : Math.max(1, v) } : s));
                        }}
                      />
                    </div>
                  </div>
                  {sec.quantityBasis === "estimated" && (
                    <div className="text-[10px] text-[#D97706] flex items-center gap-1">
                      <AlertTriangle size={10} /> Estimated quantity — 20% contingency applied. Enter document value to override.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Resources */}
      {resources.length > 0 && (
        <Card className="space-y-3">
          <button
            className="w-full flex items-center justify-between text-[13px] font-semibold text-[#0F172A]"
            onClick={() => toggle("resources")}
          >
            Available resources ({resources.length})
            {expanded["resources"] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded["resources"] && (
            <div className="space-y-2 pt-1">
              {resources.map((res, i) => (
                <div key={res.type} className="flex items-center gap-3 border border-[#E2E8F0] rounded-lg p-3">
                  <div className="flex-1 text-[12px] text-[#0F172A]">
                    {res.type.replace(/_/g, " ")}
                    {res.basis === "assumed" && (
                      <span className="ml-2 text-[10px] text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded">assumed</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    className="w-20 border border-[#E2E8F0] rounded px-2 py-1 text-[12px] text-[#0F172A] text-right"
                    value={res.count}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      setResources(prev => prev.map((r, j) => j === i ? { ...r, count: isNaN(v) ? 1 : Math.max(1, v) } : r));
                    }}
                  />
                  <span className="text-[11px] text-[#64748B]">units</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Btn
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 justify-center"
        >
          {submitting
            ? <><Loader size={14} className="animate-spin" /> Building schedule…</>
            : <><CheckCircle size={14} /> Confirm &amp; Build Schedule</>
          }
        </Btn>
        <Btn onClick={handleCancel} disabled={submitting}>
          Cancel
        </Btn>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#DC2626] text-[12px]">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

// ─── Suspense wrapper (required for useSearchParams) ─────────────────────────

export default function ReviewPackagesPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center gap-3 text-[#475569]">
        <Loader size={18} className="animate-spin" />
        <span className="text-[13px]">Loading…</span>
      </div>
    }>
      <ReviewPageInner />
    </Suspense>
  );
}
