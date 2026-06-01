"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWorkspace } from "@/context/workspace";
import { authClient } from "@/lib/auth-client";
import { fetchUserProfile, updateUserProfile } from "@/lib/api-client";

interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
}

const MOCK_PROFILE: ProfileForm = {
  fullName: "Aayush Patel",
  email: "aayush@pmcfirm.com",
  phone: "+971 50 987 6543",
};

const Toast = ({ message, show }: { message: string; show: boolean }) => (
  <div
    className={`fixed bottom-5 right-5 bg-[#2da44e] text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 z-50 ${
      show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
    }`}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </svg>
    {message}
  </div>
);

export default function MyProfilePage() {
  const { workspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const useMock = isDesignMode || (!wsLoading && !sessionPending && !workspaceId);

  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionPending) return;

    if (session?.user) {
      const fromSession: ProfileForm = {
        fullName: session.user.name ?? "",
        email: session.user.email ?? "",
        phone: "",
      };
      setSaved(fromSession);
      setForm(fromSession);
      setFetching(false);

      if (!isDesignMode) {
        fetchUserProfile()
          .then((profile) => {
            setSaved((prev) => prev ? { ...prev, phone: profile.phone } : prev);
            setForm((prev) => prev ? { ...prev, phone: profile.phone } : prev);
          })
          .catch(() => {});
      }
      return;
    }

    if (useMock) {
      setSaved(MOCK_PROFILE);
      setForm(MOCK_PROFILE);
    }
    setFetching(false);
  }, [session?.user?.id, sessionPending, useMock, isDesignMode]);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const photoKey = session?.user?.id ? `bluq_profile_photo_${session.user.id}` : null;

  useEffect(() => {
    if (!photoKey) return;
    try { setPhotoUrl(localStorage.getItem(photoKey)); } catch {}
  }, [photoKey]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!photoKey) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoUrl(dataUrl);
      try { localStorage.setItem(photoKey, dataUrl); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const initials = (form?.fullName ?? "").split(" ").map((w) => w[0]?.toUpperCase()).join("").slice(0, 2) || "U";

  const dirty = form && saved ? JSON.stringify(form) !== JSON.stringify(saved) : false;

  const set = useCallback(
    <K extends keyof ProfileForm>(key: K) =>
      (val: string) => setForm((prev) => prev ? { ...prev, [key]: val } : prev),
    []
  );

  const handleSave = async () => {
    if (!form) return;
    setLoading(true);
    setError("");
    try {
      if (!useMock) {
        await updateUserProfile({ name: form.fullName, phone: form.phone });
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setSaved(form);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching || !form) {
    return (
      <div className="p-5 flex items-center justify-center h-full">
        <div className="text-sm text-[#475569]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 overflow-y-auto h-full bg-[#F8FAFC]">
      <div className="text-[20px] font-bold text-[#0F172A] mb-1">My Profile</div>
      <div className="text-[13px] text-[#94A3B8] mb-5">Your personal account details.</div>

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {/* ── Profile photo ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <div className="text-[14px] font-semibold text-[#0F172A]">Profile Photo</div>
        </div>
        <div className="px-6 py-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xl font-bold overflow-hidden shrink-0 ring-4 ring-[#EFF6FF]">
            {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : initials}
          </div>
          <div>
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoChange} />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="px-4 py-1.5 text-xs font-semibold border border-[#E2E8F0] rounded-md bg-white cursor-pointer hover:bg-[#F8FAFC] transition"
            >
              Change photo
            </button>
            <div className="text-[11px] text-[#94A3B8] mt-1.5">PNG or JPEG · max 2 MB</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <div className="text-[14px] font-semibold text-[#0F172A]">Personal Info</div>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#475569] mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Email</label>
            <div className="flex items-center gap-2 h-[38px] px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <span className="text-sm text-[#475569] truncate flex-1">{form.email}</span>
              <span className="text-[10px] text-[#CBD5E1] shrink-0">read-only</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
            />
          </div>
        </div>
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading || !dirty}
            className="bg-[#2563EB] text-white border-none rounded-md px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
          >
            {loading ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
          {dirty && <span className="text-[12px] text-[#94A3B8]">Unsaved changes</span>}
        </div>
      </div>

      <Toast message="Profile saved!" show={toast} />
    </div>
  );
}
