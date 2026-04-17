"use client";

import { useEffect, useState } from "react";
import {
  getWhatsAppConvos,
  getWhatsAppMessages,
  type WhatsAppConvo,
  type WhatsAppMessage,
} from "@/lib/mock-data-extended";
import {
  Card,
  SectionTitle,
  GroupToggle,
} from "@/components/ui/bluq-ui";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects, type BackendProject } from "@/lib/api-client";

export default function WhatsAppFeedPage() {
  const { workspaceId, isDesignMode } = useWorkspace();
  const [projects, setProjects] = useState<BackendProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<BackendProject | null>(null);

  const [convos, setConvos] = useState<WhatsAppConvo[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<number | null>(null);

  const [filter, setFilter] = useState(0); // 0=All, 1=EOD, 2=Warnings
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── Load projects ───────────────────────────────────
  useEffect(() => {
    if (isDesignMode) {
      // Design account — use mock convos (no real backend for WA history)
      import("@/lib/mock-data-extended").then(m => {
        m.getProjects().then(p => {
          setProjects(p.map(x => ({ id: String(x.id), workspaceId: "", projectName: x.name, projectCode: null, address: null, stage: null, category: null, startDate: null, endDate: null, status: "active", clientName: null, percentComplete: null })));
          setLoading(false);
        });
      });
      return;
    }
    if (workspaceId) {
      fetchProjects(workspaceId).then((p) => {
        setProjects(p);
        if (p.length > 0) setSelectedProject(p[0]);
        else setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [workspaceId]);

  // ── Load convos when project changes ────────────────
  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    setSelectedConvo(null);
    if (isDesignMode) {
      import("@/lib/mock-data-extended").then(m => {
        m.getWhatsAppConvos(Number(selectedProject.id) || 0).then(c => { setConvos(c); setLoading(false); });
      });
    } else {
      // No backend WhatsApp history endpoint yet
      setConvos([]);
      setLoading(false);
    }
  }, [selectedProject, isDesignMode]);

  // ── Load messages when a convo is selected ──────────
  useEffect(() => {
    if (selectedConvo === null) return;
    if (isDesignMode) {
      getWhatsAppMessages(selectedConvo).then(setMessages);
    }
  }, [selectedConvo, isDesignMode]);

  // ── Simulate live sync ──────────────────────────────
  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  const filteredConvos =
    filter === 0
      ? convos
      : filter === 1
      ? convos.filter((c) => c.type === "EOD")
      : convos.filter((c) => c.type === "Warning");

  // ─── LOADING STATE ─────────────────────────────────
  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-[#f0f1f3] rounded" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#f0f1f3] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ─── CONVERSATION DETAIL ───────────────────────────
  if (selectedConvo !== null) {
    const convo = convos.find((c) => c.id === selectedConvo);
    return (
      <div className="p-5 overflow-y-auto h-full flex justify-center">
        <div className="w-full max-w-xl">
          <div className="mb-3">
            <div
              onClick={() => setSelectedConvo(null)}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[13px] text-[#3A4EA2] font-semibold hover:underline"
            >
              ← Back to Feed
            </div>
          </div>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#f6f8fa] flex items-center justify-center text-base">
              👷
            </div>
            <div>
              <div className="text-[15px] font-bold">{convo?.name}</div>
              <div className="text-xs text-[#57606a]">
                {convo?.type} Update • {convo?.time} •{" "}
                <span
                  className="font-bold"
                  style={{ color: convo?.color }}
                >
                  {convo?.status}
                </span>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div className="w-full space-y-3">
            {messages.map((m, i) => (
              <div key={i}>
                {/* Bot message */}
                <div className="bg-[#f6f8fa] rounded-xl rounded-bl-[4px] px-3 py-2 text-xs text-[#24292f] max-w-[85%] mb-1 border border-[#e1e4e8] whitespace-pre-line">
                  <div className="text-[10px] text-[#3A4EA2] font-bold mb-1 font-mono">
                    BLUQ BOT
                  </div>
                  {m.bot}
                </div>

                {/* User reply */}
                {m.reply && (
                  <div className="flex justify-end">
                    <div className="bg-[#3A4EA2] text-white rounded-xl rounded-br-[4px] px-3 py-2 text-xs max-w-[70%] text-right">
                      {m.reply}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Linked data card */}
          <Card className="w-full mt-8 !bg-[#24292f] !border-none shadow-md">
            <div className="text-xs font-bold mb-1.5 text-[#f0f1f3]">
              Linked Data
            </div>
            <div className="flex gap-4 text-xs text-[#8c959f]">
              <span>📋 Task: {convo?.task}</span>
              <span>📸 Photos: {convo?.photos || 0} Linked</span>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ─── FEED LIST ─────────────────────────────────────
  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <SectionTitle>WhatsApp Bot Feed</SectionTitle>

          {/* Project Selector — driven by mock data */}
          <div className="relative">
            <select
              value={selectedProject?.id ?? ""}
              onChange={(e) => {
                const proj = projects.find((p) => p.id === e.target.value);
                if (proj) setSelectedProject(proj);
              }}
              className="appearance-none bg-white border border-[#D0D7DE] rounded-md py-1.5 pl-3 pr-8 text-[13px] font-semibold text-[#24292f] cursor-pointer outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#57606a]">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Sync button */}
          <button
            onClick={handleSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-[#D0D7DE] bg-white cursor-pointer hover:bg-[#f6f8fa] transition-all ${
              syncing ? "text-[#3A4EA2]" : "text-[#57606a]"
            }`}
          >
            <span className={syncing ? "animate-spin" : ""}>🔄</span>
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <GroupToggle
            options={["All", "EOD Updates", "Warnings"]}
            active={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      {/* Live sync indicator */}
      {syncing && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#ddf4ff] rounded-md">
          <span className="w-2 h-2 rounded-full bg-[#3A4EA2] animate-pulse" />
          <span className="text-xs text-[#3A4EA2] font-semibold">
            Fetching latest messages from WhatsApp...
          </span>
        </div>
      )}

      {/* Empty state */}
      {filteredConvos.length === 0 && (
        <div className="text-center py-16 text-[#8C959F]">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm font-medium">No conversations found</div>
          <div className="text-xs mt-1">
            {filter !== 0
              ? 'Try switching to "All" to see everything.'
              : "No WhatsApp updates for this project yet."}
          </div>
        </div>
      )}

      {/* Conversation cards */}
      <div className="space-y-2">
        {filteredConvos.map((c) => (
          <Card
            key={c.id}
            onClick={() => setSelectedConvo(c.id)}
            className={`cursor-pointer hover:shadow-sm transition-shadow ${
              c.type === "Warning" ? "!border-l-4 !border-l-[#CF222E]" : ""
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#f6f8fa] flex items-center justify-center text-sm flex-shrink-0">
                  👷
                </div>
                <div>
                  <div className="text-[13px] font-bold">{c.name}</div>
                  <div className="text-xs text-[#57606a]">{c.task}</div>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    c.type === "Warning"
                      ? "bg-[#ffebe9] text-[#CF222E]"
                      : "bg-[#ddf4ff] text-[#3A4EA2]"
                  }`}
                >
                  {c.type}
                </span>
                <div className="text-[11px] text-[#8C959F] mt-1 font-mono">
                  {c.time}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-[#57606a]">
              <span style={{ color: c.color }} className="font-bold">
                {c.status}
              </span>
              {c.photos > 0 && <span>📸 {c.photos} photos</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
