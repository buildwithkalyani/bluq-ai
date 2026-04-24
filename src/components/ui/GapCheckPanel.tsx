"use client";

import { useState } from "react";
import { acceptGapCheckItem } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuspectedGap {
  taskName: string;
  phase: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  alreadyCovered: boolean;
}

interface GapCheckPanelProps {
  scheduleVersionId: string;
  workspaceId: string;
  projectId: string;
  gaps: SuspectedGap[];
  onTaskAdded: () => void; // refresh Gantt
}

// ---------------------------------------------------------------------------
// Toast (self-contained, matches project pattern)
// ---------------------------------------------------------------------------

function Toast({ message, type, show }: { message: string; type: "success" | "error" | "info"; show: boolean }) {
  const bg =
    type === "success" ? "bg-[#2da44e]"
    : type === "error" ? "bg-[#CF222E]"
    : "bg-[#57606a]";
  return (
    <div
      className={`fixed bottom-5 right-5 ${bg} text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 z-50 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      {type === "success" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      )}
      {type === "error" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.25 3.75a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
        </svg>
      )}
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high:   "bg-[#ffebe9] text-[#CF222E] border border-[#ffc1ba]",
    medium: "bg-[#fff8c5] text-[#9A6700] border border-[#f0d44e]",
    low:    "bg-[#f0f1f3] text-[#57606a] border border-[#d0d7de]",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${styles[level]}`}>
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Individual gap card
// ---------------------------------------------------------------------------

function GapCard({
  gap,
  scheduleVersionId,
  workspaceId,
  projectId,
  onResolved,
  showToast,
  onTaskAdded,
}: {
  gap: SuspectedGap;
  scheduleVersionId: string;
  workspaceId: string;
  projectId: string;
  onResolved: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onTaskAdded: () => void;
}) {
  const [addLoading, setAddLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const callAccept = (dismissedFlag: boolean) =>
    acceptGapCheckItem({
      scheduleVersionId,
      workspaceId,
      projectId,
      taskName: gap.taskName,
      phase: gap.phase,
      reason: gap.reason,
      dismissed: dismissedFlag,
    });

  const handleAdd = async () => {
    setAddLoading(true);
    try {
      await callAccept(false);
      showToast("Task added to schedule", "success");
      onTaskAdded();
      onResolved();
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("no tasks") || msg.includes("Cannot auto-place")) {
        showToast("Could not auto-place task. Please add manually.", "error");
      } else {
        showToast("Could not auto-place task. Please add manually.", "error");
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleDismiss = () => {
    // Optimistic — remove card immediately, fire request in background
    setDismissed(true);
    onResolved();
    showToast("Dismissed", "info");
    callAccept(true).catch(() => {/* non-fatal */});
  };

  if (dismissed) return null;

  return (
    <div className="flex items-start justify-between gap-4 p-3 bg-white border border-[#D0D7DE] rounded-lg shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[13px] font-semibold text-[#24292f] truncate">{gap.taskName}</span>
          <ConfidenceBadge level={gap.confidence} />
        </div>
        <div className="text-[11px] text-[#3A4EA2] font-medium mb-1 uppercase tracking-wide">{gap.phase.replace(/_/g, " ")}</div>
        <div className="text-[12px] text-[#57606a] leading-relaxed">{gap.reason}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <button
          onClick={handleAdd}
          disabled={addLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3A4EA2] hover:bg-[#2d3d8a] disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          {addLoading ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
            </svg>
          )}
          {addLoading ? "Adding…" : "Add to Schedule"}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-[12px] font-medium text-[#57606a] hover:text-[#24292f] hover:bg-gray-100 rounded-md transition-colors border border-[#D0D7DE]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function GapCheckPanel({
  scheduleVersionId,
  workspaceId,
  projectId,
  gaps,
  onTaskAdded,
}: GapCheckPanelProps) {
  const actionableGaps = gaps.filter(g => !g.alreadyCovered);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const remaining = actionableGaps.length - resolvedCount;

  const showToast = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const handleResolved = () => setResolvedCount(c => c + 1);

  // All resolved — show green confirmation bar
  if (remaining <= 0) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 bg-[#dafbe1] border border-[#1A7F37]/30 rounded-lg text-[13px] font-medium text-[#1A7F37]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
        All gap check items reviewed
      </div>
    );
  }

  return (
    <>
      <div className="mx-4 mt-3 rounded-lg border border-[#f0d44e] overflow-hidden">
        {/* Banner */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-[#fff8c5] hover:bg-[#fff3a8] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#9A6700">
              <path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0Z" />
            </svg>
            <span className="text-[13px] font-semibold text-[#9A6700]">
              AI found {remaining} potentially missing task{remaining !== 1 ? "s" : ""}. Review before sharing with contractor.
            </span>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="#9A6700"
            className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z" />
          </svg>
        </button>

        {/* Expanded card list */}
        {expanded && (
          <div className="flex flex-col gap-2 p-3 bg-[#fffdf0] border-t border-[#f0d44e]">
            {actionableGaps.map((gap, i) => (
              <GapCard
                key={`${gap.taskName}-${i}`}
                gap={gap}
                scheduleVersionId={scheduleVersionId}
                workspaceId={workspaceId}
                projectId={projectId}
                onResolved={handleResolved}
                showToast={showToast}
                onTaskAdded={onTaskAdded}
              />
            ))}
          </div>
        )}
      </div>

      <Toast
        message={toast?.msg ?? ""}
        type={toast?.type ?? "info"}
        show={toastVisible}
      />
    </>
  );
}
