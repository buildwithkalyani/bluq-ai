"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, RefreshCw, User, Image, MessageSquare, Inbox } from "lucide-react";
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
import { fetchWaConvos, fetchWaMessages, isRealProject, type WaConvo, type WaMessage } from "@/lib/api-client";

function WhatsAppFeedContent() {
  const searchParams = useSearchParams();
  const { workspaceId: ctxWorkspaceId, isDesignMode, loading: wsLoading } = useWorkspace();

  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  const [convos, setConvos] = useState<WhatsAppConvo[] | WaConvo[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[] | WaMessage[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<number | string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);

  const [filter, setFilter] = useState(0); // 0=All, 1=EOD, 2=Warnings
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── Load convos when project / workspace changes ──────
  useEffect(() => {
    if (wsLoading) return;

    setLoading(true);
    setSelectedConvo(null);
    setSelectedPhone(null);

    if (isDesignMode) {
      import("@/lib/mock-data-extended").then(m => {
        m.getWhatsAppConvos(Number(projectIdParam) || 0)
          .then(c => { setConvos(c); setLoading(false); });
      });
      return;
    }

    if (!real) {
      setConvos([]);
      setLoading(false);
      return;
    }

    fetchWaConvos(projectIdParam)
      .then(c => { setConvos(c); setLoading(false); })
      .catch(() => { setConvos([]); setLoading(false); });
  }, [projectIdParam, workspaceId, wsLoading, isDesignMode, real]);

  // ── Load messages when a convo is selected ──────────
  useEffect(() => {
    if (selectedConvo === null) return;
    if (isDesignMode) {
      getWhatsAppMessages(selectedConvo as number).then(setMessages);
    } else if (selectedPhone) {
      fetchWaMessages(projectIdParam, selectedPhone)
        .then(({ messages: msgs, photoCount: pc }) => {
          setMessages(msgs);
          setPhotoCount(pc);
        })
        .catch(() => setMessages([]));
    }
  }, [selectedConvo, isDesignMode, projectIdParam, selectedPhone]);

  const handleSync = () => {
    setSyncing(true);
    if (real) {
      fetchWaConvos(projectIdParam)
        .then(c => { setConvos(c); setSyncing(false); })
        .catch(() => setSyncing(false));
    } else {
      setTimeout(() => setSyncing(false), 1200);
    }
  };

  const filteredConvos =
    filter === 0
      ? (convos as any[])
      : filter === 1
      ? (convos as any[]).filter((c) => c.type === "EOD")
      : (convos as any[]).filter((c) => c.type === "Warning");

  // ─── LOADING STATE ─────────────────────────────────
  if (loading) {
    return (
      <div className="p-5 space-y-2.5">
        <div className="h-5 w-52 bg-[#E2E8F0] rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── CONVERSATION DETAIL ───────────────────────────
  if (selectedConvo !== null) {
    const convo = (convos as any[]).find((c) => c.id === selectedConvo);
    return (
      <div className="p-5 overflow-y-auto h-full flex justify-center">
        <div className="w-full max-w-xl">
          <div className="mb-3">
            <div
              onClick={() => setSelectedConvo(null)}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[13px] text-[#2563EB] font-semibold hover:underline"
            >
              ← Back to Feed
            </div>
          </div>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-[#2563EB]" />
            </div>
            <div>
              <div className="text-[15px] font-bold">{convo?.name}</div>
              <div className="text-xs text-[#475569]">
                {convo?.type} Update · {convo?.time} ·{" "}
                <span className="font-bold" style={{ color: convo?.color }}>
                  {convo?.status}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            {(messages as any[]).map((m, i) => (
              <div key={i}>
                {"bot" in m ? (
                  <>
                    <div className="bg-[#F8FAFC] rounded-xl rounded-bl-[4px] px-3 py-2 text-xs text-[#0F172A] max-w-[85%] mb-1 border border-[#E2E8F0] whitespace-pre-line">
                      <div className="text-[10px] text-[#2563EB] font-bold mb-1 font-mono">BLUQ BOT</div>
                      {m.bot}
                    </div>
                    {m.reply && (
                      <div className="flex justify-end">
                        <div className="bg-[#2563EB] text-white rounded-xl rounded-br-[4px] px-3 py-2 text-xs max-w-[70%] text-right">{m.reply}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-end">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="bg-[#2563EB] text-white rounded-xl rounded-br-[4px] px-3 py-2 text-xs max-w-[70%] text-right whitespace-pre-line">
                        {m.rawMessage}
                      </div>
                      {m.receivedAt && (
                        <div className="text-[10px] text-[#94A3B8] font-mono">
                          {new Date(m.receivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Card className="w-full mt-8 !bg-[#0F172A] !border-none shadow-md">
            <div className="text-xs font-bold mb-1.5 text-[#F1F5F9]">Linked Data</div>
            <div className="flex gap-4 text-xs text-[#8c959f]">
              <span className="inline-flex items-center gap-1">
                <ClipboardList size={12} /> Task: {convo?.task}
              </span>
              <span className="inline-flex items-center gap-1">
                <Image size={12} /> Photos: {isDesignMode ? (convo?.photos || 0) : photoCount} linked
              </span>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ─── FEED LIST ─────────────────────────────────────
  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-3">
        <SectionTitle>WhatsApp Bot Feed</SectionTitle>

        <div className="flex gap-2 items-center">
          <button
            onClick={handleSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E2E8F0] bg-white cursor-pointer hover:bg-[#F8FAFC] transition-all ${
              syncing ? "text-[#2563EB]" : "text-[#475569]"
            }`}
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <GroupToggle
            options={["All", "EOD Updates", "Warnings"]}
            active={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      {syncing && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#EFF6FF] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
          <span className="text-xs text-[#2563EB] font-semibold">
            Fetching latest messages from WhatsApp...
          </span>
        </div>
      )}

      {filteredConvos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[#94A3B8]">
          <Inbox size={36} className="mb-3 text-[#CBD5E1]" />
          <div className="text-sm font-semibold text-[#475569]">No conversations found</div>
          <div className="text-xs mt-1">
            {filter !== 0
              ? 'Switch to "All" to see everything.'
              : !real
              ? "Select a project to view WhatsApp updates."
              : "No WhatsApp updates for this project yet."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConvos.map((c) => {
            const hasMessages = (c as any).hasMessages !== false && c.messageCount > 0;
            return (
              <Card
                key={c.id}
                onClick={() => {
                  if (!hasMessages) return;
                  setSelectedConvo(c.id);
                  setSelectedPhone((c as any).senderPhone ?? null);
                }}
                className={`transition-shadow ${
                  hasMessages ? "cursor-pointer hover:shadow-md" : "opacity-60 cursor-default"
                } ${c.type === "Warning" ? "!border-l-4 !border-l-[#DC2626]" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-[#2563EB]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-bold text-[#0F172A]">{c.name}</div>
                        {(c as any).trade && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">
                            {(c as any).trade}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#475569]">{c.task}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {hasMessages ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          c.type === "Warning"
                            ? "bg-[#FEF2F2] text-[#DC2626]"
                            : "bg-[#EFF6FF] text-[#2563EB]"
                        }`}
                      >
                        {c.type}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-[#F1F5F9] text-[#94A3B8]">
                        LINKED
                      </span>
                    )}
                    <div className="text-[11px] text-[#94A3B8] mt-1 font-mono">{c.time}</div>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 text-[11px] text-[#475569]">
                  <span style={{ color: c.color }} className="font-bold">{c.status}</span>
                  {(c.photos ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Image size={11} /> {c.photos} photos
                    </span>
                  )}
                  {c.messageCount > 1 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={11} /> {c.messageCount} messages
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppFeedPage() {
  return (
    <Suspense fallback={
      <div className="p-5 space-y-2.5">
        <div className="h-5 w-52 bg-[#E2E8F0] rounded animate-pulse" />
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />)}
      </div>
    }>
      <WhatsAppFeedContent />
    </Suspense>
  );
}
