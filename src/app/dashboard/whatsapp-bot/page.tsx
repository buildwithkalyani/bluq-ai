"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CheckCircle2, Sun, Moon, Wrench, MapPin, MessageCircle, AlertTriangle } from "lucide-react";
import { Btn } from "@/components/ui/bluq-ui";
import type { FlowPhase } from "@/lib/flow-engine";

// ─── TYPES (matching flow-engine exports) ───────────────────
type ConversationMessage = {
  id: string;
  role: "bot" | "worker" | "system";
  text: string;
  timestamp: string;
  workerName: string;
  workerPhone: string;
  taskName: string;
  projectName: string;
  phase: FlowPhase;
};

type PMCAlert = {
  id: string;
  workerName: string;
  workerPhone: string;
  taskName: string;
  projectName: string;
  location: string;
  issueDesc: string;
  timestamp: string;
  resolved: boolean;
};

type ConversationState = {
  phone: string;
  workerName: string;
  profile: {
    name: string;
    taskName: string;
    projectName: string;
    location: string;
    phase: string;
  };
  flowPhase: FlowPhase;
  lastUpdated: string;
};

// ─── PHASE BADGE ─────────────────────────────────────────────
function phaseMeta(phase: FlowPhase): { label: string; bg: string; color: string } {
  if (phase === "complete")
    return { label: "Complete",   bg: "#ECFDF5", color: "#059669" };
  if (phase === "idle")
    return { label: "Idle",       bg: "#F1F5F9", color: "#94A3B8" };
  if (phase === "morning_prompted" || phase === "morning_ack" || phase === "morning_blocker_asked")
    return { label: "Morning",    bg: "#EFF6FF", color: "#2563EB" };
  if (phase === "issue_detected" || phase === "issue_impact_asked")
    return { label: "Issue!",     bg: "#FEF2F2", color: "#DC2626" };
  if (
    phase === "evening_prompted" ||
    phase === "eod_partial_quantity_asked" ||
    phase === "eod_workers_asked" ||
    phase === "eod_materials_asked" ||
    phase === "eod_photos_asked"
  )
    return { label: "Evening EOD", bg: "#FFFBEB", color: "#D97706" };
  return { label: phase, bg: "#F1F5F9", color: "#94A3B8" };
}

function PhaseBadge({ phase }: { phase: FlowPhase }) {
  const { label, bg, color } = phaseMeta(phase);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
      style={{ background: bg, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function WhatsAppBotPage() {
  const [log,     setLog]     = useState<ConversationMessage[]>([]);
  const [alerts,  setAlerts]  = useState<PMCAlert[]>([]);
  const [states,  setStates]  = useState<ConversationState[]>([]);
  const [toast,   setToast]   = useState<string | null>(null);
  const [loadingMorning, setLoadingMorning] = useState(false);
  const [loadingEvening, setLoadingEvening] = useState(false);
  const [confirmType, setConfirmType] = useState<"morning" | "evening" | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Polling ───────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch("/api/webhook/log");
        const data = await res.json();
        setLog(data.log ?? []);
        setAlerts(data.alerts ?? []);
        setStates(data.states ?? []);
      } catch {
        // silent fail
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll feed ─────────────────────────────────────
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [log]);

  // ── Toast helper ─────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Trigger ───────────────────────────────────────────────
  async function trigger(type: "morning" | "evening") {
    if (type === "morning") setLoadingMorning(true);
    else setLoadingEvening(true);
    try {
      const res  = await fetch("/api/cron/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      showToast(`Messages sent to ${data.workersSentTo ?? 0} workers`);
    } catch {
      showToast("Failed to send messages");
    } finally {
      if (type === "morning") setLoadingMorning(false);
      else setLoadingEvening(false);
    }
  }

  // ── Alert resolve (local) ─────────────────────────────────
  function resolveAlert(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
    );
  }

  function fmt(ts: string) {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  const visibleLog = log.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-full bg-[#F6F8FA] overflow-hidden">

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#059669] text-white px-4 py-2 rounded-lg shadow-lg text-[13px] font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle size={14} className="shrink-0" /> {toast}
        </div>
      )}

      {/* ── SECTION A: Trigger Panel ───────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 bg-white border-b border-[#E2E8F0] flex items-center gap-3">
        <span className="text-[12px] font-bold text-[#475569] uppercase tracking-wider mr-1">
          Bot Triggers
        </span>
        {confirmType ? (
          <div className="flex items-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-1.5">
            <AlertTriangle size={13} className="text-[#D97706] shrink-0" />
            <span className="text-[12px] font-semibold text-[#92400E]">
              Send {confirmType} message to all {states.length || "active"} workers?
            </span>
            <button
              onClick={() => { trigger(confirmType); setConfirmType(null); }}
              className="ml-1 px-2.5 py-1 bg-[#D97706] text-white text-[11px] font-bold rounded-md hover:bg-[#B45309] transition-colors cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmType(null)}
              className="px-2.5 py-1 bg-white border border-[#E2E8F0] text-[#475569] text-[11px] font-bold rounded-md hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <Btn primary small onClick={() => setConfirmType("morning")} disabled={loadingMorning}>
              <Sun size={13} strokeWidth={1.6} />
              {loadingMorning ? "Sending..." : "Morning Message"}
            </Btn>
            <Btn small onClick={() => setConfirmType("evening")} disabled={loadingEvening}>
              <Moon size={13} strokeWidth={1.6} />
              {loadingEvening ? "Sending..." : "Evening Message"}
            </Btn>
          </>
        )}
        <span className="ml-auto text-[11px] text-[#94A3B8]">
          Polls every 3s · {states.length} active workers
        </span>
      </div>

      {/* ── SECTION B: Worker Status Cards ────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[#E2E8F0] bg-[#F6F8FA]">
        <div className="text-[12px] font-bold text-[#475569] uppercase tracking-wider mb-2">
          Worker Status
        </div>
        {states.length === 0 ? (
          <div className="text-[12px] text-[#94A3B8] italic">
            No active workers today. Send the morning message to start.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {states.map((s) => (
              <div
                key={s.phone}
                className="flex-shrink-0 bg-white border border-[#E2E8F0] rounded-lg p-3 w-[220px]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="text-[13px] font-bold text-[#0F172A] leading-tight">
                      {s.workerName}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {s.profile.projectName}
                    </div>
                  </div>
                  <PhaseBadge phase={s.flowPhase} />
                </div>
                <div className="text-[11px] text-[#475569] mt-1 flex items-center gap-1">
                  <Wrench size={11} className="text-[#94A3B8] shrink-0" /> {s.profile.taskName}
                </div>
                <div className="text-[11px] text-[#475569] flex items-center gap-1">
                  <MapPin size={11} className="text-[#94A3B8] shrink-0" /> {s.profile.location}
                </div>
                <div className="text-[10px] text-[#94A3B8] mt-2 font-mono">
                  {fmt(s.lastUpdated)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTIONS C + D: Bottom two-column layout ────────── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ── SECTION C: Conversation Feed (70%) ─────────── */}
        <div className="flex-[7] flex flex-col overflow-hidden border-r border-[#E2E8F0]">
          <div className="flex-shrink-0 px-5 py-2.5 bg-white border-b border-[#E2E8F0]">
            <span className="text-[12px] font-bold text-[#475569] uppercase tracking-wider">
              Live Conversation Feed
            </span>
          </div>

          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            {visibleLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#94A3B8] py-16">
                <MessageCircle size={28} className="mb-2 text-[#CBD5E1]" />
                <div className="text-sm font-medium">No messages yet.</div>
                <div className="text-xs mt-1">Send the morning message to start.</div>
              </div>
            ) : (
              visibleLog.map((msg, i) => {
                const isWorker = msg.role === "worker";
                const showName =
                  i === 0 || visibleLog[i - 1].workerName !== msg.workerName;

                return (
                  <div key={msg.id}>
                    {showName && (
                      <div className="flex items-center gap-2 mb-1 mt-2">
                        <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {msg.workerName.charAt(0)}
                        </div>
                        <span className="text-[11px] font-bold text-[#475569]">
                          {msg.workerName}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">·</span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {msg.taskName}
                        </span>
                        <PhaseBadge phase={msg.phase} />
                      </div>
                    )}

                    <div className={`flex ${isWorker ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[72%] px-3 py-2 rounded-xl text-[12px] whitespace-pre-line ${
                          isWorker
                            ? "bg-[#2563EB] text-white rounded-br-[4px]"
                            : "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-[4px]"
                        }`}
                      >
                        {isWorker ? null : (
                          <div className="text-[10px] font-bold text-[#2563EB] mb-0.5 font-mono">
                            BLUQ BOT
                          </div>
                        )}
                        {msg.text}
                        <div
                          className={`text-[9px] mt-1 text-right font-mono ${
                            isWorker ? "text-white/60" : "text-[#94A3B8]"
                          }`}
                        >
                          {fmt(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── SECTION D: PMC Alert Panel (30%) ────────────── */}
        <div className="flex-[3] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2.5 bg-white border-b border-[#E2E8F0]">
            <span className="text-[12px] font-bold text-[#475569] uppercase tracking-wider">
              PMC Alerts
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {alerts.filter((a) => !a.resolved).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#94A3B8] py-10">
                <CheckCircle2 size={24} className="mb-1 text-[#059669]" />
                <div className="text-[12px] font-medium">No active alerts</div>
                <div className="text-[11px]">All clear</div>
              </div>
            ) : (
              alerts.map((alert) =>
                alert.resolved ? null : (
                  <div
                    key={alert.id}
                    className="bg-white border border-[#E2E8F0] border-l-4 border-l-[#DC2626] rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-[#0F172A] leading-tight">
                          {alert.workerName}
                        </div>
                        <div className="text-[11px] text-[#475569] truncate">
                          {alert.taskName}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold bg-[#FEF2F2] text-[#DC2626] px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        ALERT
                      </span>
                    </div>
                    <div className="text-[11px] text-[#0F172A] mt-2 leading-snug">
                      {alert.issueDesc}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-[#94A3B8] font-mono">
                        {fmt(alert.timestamp)}
                      </span>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-[10px] font-semibold text-[#059669] hover:underline cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
