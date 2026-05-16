"use client";

import { useActivityFeed, type ActivityUpdate } from "@/context/activity-feed";

function sourceIcon(s: ActivityUpdate["source"]) {
  if (s === "whatsapp") return (
    <svg className="w-3 h-3 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
    </svg>
  );
  if (s === "email") return (
    <svg className="w-3 h-3 text-[#64748B] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
  return null;
}

const borderColor = (sev: ActivityUpdate["severity"]) =>
  sev === "fresh" ? "border-green-500" : sev === "warning" ? "border-amber-500" : "border-[#CBD5E1]";
const impactColor = (sev: ActivityUpdate["severity"]) =>
  sev === "fresh" ? "text-green-700" : sev === "warning" ? "text-amber-700" : "text-[#64748B]";

export function LiveActivityButton() {
  const { showActivityFeed, setShowActivityFeed, activity } = useActivityFeed();
  const hasUpdates = activity.length > 0;

  return (
    <button
      onClick={() => setShowActivityFeed(v => !v)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors cursor-pointer
        ${showActivityFeed
          ? "bg-white border-green-300 text-green-700"
          : "bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-green-300 hover:text-green-700"
        }`}
    >
      <span className="relative flex w-2 h-2">
        <span className={`absolute inset-0 rounded-full ${hasUpdates ? "bg-green-400 animate-ping opacity-75" : "bg-[#94A3B8]"}`} />
        <span className={`relative w-2 h-2 rounded-full ${hasUpdates ? "bg-green-500" : "bg-[#94A3B8]"}`} />
      </span>
      Live Activity
    </button>
  );
}

export function LiveActivityPanel() {
  const { showActivityFeed, setShowActivityFeed, activity } = useActivityFeed();

  if (!showActivityFeed) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[280px] z-50 flex flex-col bg-[#F8FAFC] border-l border-[#E2E8F0] shadow-xl">
      <div className="px-4 py-3 border-b border-[#E2E8F0] bg-white flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-green-500" />
          </span>
          Live Activity
        </div>
        <button
          onClick={() => setShowActivityFeed(false)}
          className="text-[#94A3B8] hover:text-[#475569] text-[18px] leading-none cursor-pointer"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {activity.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="text-[11px] text-[#94A3B8] leading-relaxed">
              No updates yet. Updates from WhatsApp and email will appear here in real time.
            </div>
          </div>
        ) : (
          activity.map(u => (
            <div
              key={u.id}
              className={`pl-2.5 border-l-2 ${borderColor(u.severity)} rounded-r p-1.5 bg-white shadow-sm`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {sourceIcon(u.source)}
                <span className="font-semibold text-[11px] text-[#1E293B]">{u.from}</span>
                <span className="text-[10px] text-[#94A3B8] ml-auto">{u.timeAgo}</span>
              </div>
              <div className="italic text-[11px] text-[#475569] leading-snug mb-1">"{u.message}"</div>
              <div className={`text-[10px] font-medium ${impactColor(u.severity)}`}>→ {u.impact}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
