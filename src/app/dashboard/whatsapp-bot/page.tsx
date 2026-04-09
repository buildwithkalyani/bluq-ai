"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Btn } from "@/components/ui/bluq-ui";
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
    return { label: "Complete",   bg: "#dafbe1", color: "#1A7F37" };
  if (phase === "idle")
    return { label: "Idle",       bg: "#f0f1f3", color: "#8C959F" };
  if (phase === "morning_prompted" || phase === "morning_ack" || phase === "morning_blocker_asked")
    return { label: "Morning",    bg: "#ddf4ff", color: "#3A4EA2" };
  if (phase === "issue_detected" || phase === "issue_impact_asked")
    return { label: "Issue!",     bg: "#ffebe9", color: "#CF222E" };
  if (
    phase === "evening_prompted" ||
    phase === "eod_partial_quantity_asked" ||
    phase === "eod_workers_asked" ||
    phase === "eod_materials_asked" ||
    phase === "eod_photos_asked"
  )
    return { label: "Evening EOD", bg: "#fff8c5", color: "#9A6700" };
  return { label: phase, bg: "#f0f1f3", color: "#8C959F" };
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
        <div className="fixed top-4 right-4 z-50 bg-[#1A7F37] text-white px-4 py-2 rounded-lg shadow-lg text-[13px] font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
          ✅ {toast}
        </div>
      )}

      {/* ── SECTION A: Trigger Panel ───────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 bg-white border-b border-[#D0D7DE] flex items-center gap-3">
        <span className="text-[12px] font-bold text-[#57606a] uppercase tracking-wider mr-1">
          Bot Triggers
        </span>
        <Btn
          primary
          small
          onClick={() => trigger("morning")}
          disabled={loadingMorning}
        >
          {loadingMorning ? "Sending..." : "🌅 Send Morning Message"}
        </Btn>
        <Btn
          small
          onClick={() => trigger("evening")}
          disabled={loadingEvening}
        >
          {loadingEvening ? "Sending..." : "🌙 Send Evening Message"}
        </Btn>
        <span className="ml-auto text-[11px] text-[#8C959F]">
          Polls every 3s · {states.length} active workers
        </span>
      </div>

      {/* ── SECTION B: Worker Status Cards ────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[#D0D7DE] bg-[#F6F8FA]">
        <div className="text-[12px] font-bold text-[#57606a] uppercase tracking-wider mb-2">
          Worker Status
        </div>
        {states.length === 0 ? (
          <div className="text-[12px] text-[#8C959F] italic">
            No active workers today. Send the morning message to start.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {states.map((s) => (
              <div
                key={s.phone}
                className="flex-shrink-0 bg-white border border-[#D0D7DE] rounded-lg p-3 w-[220px]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="text-[13px] font-bold text-[#24292f] leading-tight">
                      {s.workerName}
                    </div>
                    <div className="text-[11px] text-[#57606a]">
                      {s.profile.projectName}
                    </div>
                  </div>
                  <PhaseBadge phase={s.flowPhase} />
                </div>
                <div className="text-[11px] text-[#57606a] mt-1">
                  🔨 {s.profile.taskName}
                </div>
                <div className="text-[11px] text-[#57606a]">
                  📍 {s.profile.location}
                </div>
                <div className="text-[10px] text-[#8C959F] mt-2 font-mono">
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
        <div className="flex-[7] flex flex-col overflow-hidden border-r border-[#D0D7DE]">
          <div className="flex-shrink-0 px-5 py-2.5 bg-white border-b border-[#D0D7DE]">
            <span className="text-[12px] font-bold text-[#57606a] uppercase tracking-wider">
              Live Conversation Feed
            </span>
          </div>

          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            {visibleLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8C959F] py-16">
                <div className="text-3xl mb-2">💬</div>
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
                        <div className="w-5 h-5 rounded-full bg-[#3A4EA2] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {msg.workerName.charAt(0)}
                        </div>
                        <span className="text-[11px] font-bold text-[#57606a]">
                          {msg.workerName}
                        </span>
                        <span className="text-[10px] text-[#8C959F]">·</span>
                        <span className="text-[10px] text-[#8C959F]">
                          {msg.taskName}
                        </span>
                        <PhaseBadge phase={msg.phase} />
                      </div>
                    )}

                    <div className={`flex ${isWorker ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[72%] px-3 py-2 rounded-xl text-[12px] whitespace-pre-line ${
                          isWorker
                            ? "bg-[#3A4EA2] text-white rounded-br-[4px]"
                            : "bg-white border border-[#D0D7DE] text-[#24292f] rounded-bl-[4px]"
                        }`}
                      >
                        {isWorker ? null : (
                          <div className="text-[10px] font-bold text-[#3A4EA2] mb-0.5 font-mono">
                            BLUQ BOT
                          </div>
                        )}
                        {msg.text}
                        <div
                          className={`text-[9px] mt-1 text-right font-mono ${
                            isWorker ? "text-white/60" : "text-[#8C959F]"
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
          <div className="flex-shrink-0 px-4 py-2.5 bg-white border-b border-[#D0D7DE]">
            <span className="text-[12px] font-bold text-[#57606a] uppercase tracking-wider">
              PMC Alerts
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {alerts.filter((a) => !a.resolved).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8C959F] py-10">
                <div className="text-2xl mb-1">🟢</div>
                <div className="text-[12px] font-medium">No active alerts</div>
                <div className="text-[11px]">All clear</div>
              </div>
            ) : (
              alerts.map((alert) =>
                alert.resolved ? null : (
                  <div
                    key={alert.id}
                    className="bg-white border border-[#D0D7DE] border-l-4 border-l-[#CF222E] rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-[#24292f] leading-tight">
                          {alert.workerName}
                        </div>
                        <div className="text-[11px] text-[#57606a] truncate">
                          {alert.taskName}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold bg-[#ffebe9] text-[#CF222E] px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        ALERT
                      </span>
                    </div>
                    <div className="text-[11px] text-[#24292f] mt-2 leading-snug">
                      {alert.issueDesc}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-[#8C959F] font-mono">
                        {fmt(alert.timestamp)}
                      </span>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-[10px] font-semibold text-[#1A7F37] hover:underline cursor-pointer"
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
