"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWorkspace } from "@/context/workspace";
import { authClient } from "@/lib/auth-client";
import { fetchUserProfile, updateUserProfile, updateOrg, fetchOrgLogoUploadUrl } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountForm {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
}

// ─── Mock data for design accounts ───────────────────────────────────────────

const MOCK_ACCOUNT: AccountForm = {
  fullName: "Aayush Patel",
  email: "aayush@pmcfirm.com",
  phone: "+971 50 987 6543",
  companyName: "Bluq Engineering Consultants",
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-5 ${className}`}>{children}</div>
);

const InputField = ({
  label, value, onChange, type = "text", disabled = false,
}: {
  label: string; value: string; onChange: (val: string) => void; type?: string; disabled?: boolean;
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#57606a] mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-sm text-[#24292f] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#f6f8fa] disabled:text-[#57606a] transition"
    />
  </div>
);

const SaveButton = ({ onClick, loading, dirty }: { onClick: () => void; loading: boolean; dirty: boolean }) => (
  <button
    onClick={onClick}
    disabled={loading || !dirty}
    className="bg-[#3A4EA2] text-white border-none rounded-md px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
  >
    {loading ? "Saving…" : dirty ? "Save Changes" : "Saved"}
  </button>
);

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const { workspaceId, orgName, isDesignMode } = useWorkspace();
  const { data: session } = authClient.useSession();

  const [saved, setSaved] = useState<AccountForm | null>(null);
  const [form, setForm] = useState<AccountForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDesignMode) {
      setSaved(MOCK_ACCOUNT);
      setForm(MOCK_ACCOUNT);
      setFetching(false);
      return;
    }

    if (!session?.user) return;

    // Pre-fill from session immediately so it doesn't look blank
    const fromSession: AccountForm = {
      fullName: session.user.name ?? "",
      email: session.user.email ?? "",
      phone: "",
      companyName: orgName ?? "",
    };
    setSaved(fromSession);
    setForm(fromSession);
    setFetching(false);

    // Enrich with phone + logoUrl from backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
    fetchUserProfile()
      .then((profile) => {
        setSaved((prev) => prev ? { ...prev, phone: profile.phone } : prev);
        setForm((prev) => prev ? { ...prev, phone: profile.phone } : prev);
      })
      .catch(() => {});

    authClient.getSession().then((s) => {
      const token = s?.data?.session?.token ?? "";
      fetch(`${backendUrl}/orgs/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data: any[]) => { if (data?.[0]?.logoUrl) setLogoUrl(data[0].logoUrl); })
        .catch(() => {});
    });
  }, [session?.user?.id, orgName, isDesignMode]);

  const dirty = form && saved ? JSON.stringify(form) !== JSON.stringify(saved) : false;

  const set = useCallback(
    <K extends keyof AccountForm>(key: K) =>
      (val: string) => setForm((prev) => prev ? { ...prev, [key]: val } : prev),
    []
  );

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setLogoUploading(true);
    setError("");
    try {
      const { signedUrl, publicUrl } = await fetchOrgLogoUploadUrl(workspaceId, file.name);
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      await updateOrg(workspaceId, { logoUrl: publicUrl });
      setLogoUrl(publicUrl);
    } catch (err: any) {
      setError(err.message ?? "Logo upload failed");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setLoading(true);
    setError("");
    try {
      if (isDesignMode) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        await Promise.all([
          updateUserProfile({ name: form.fullName, phone: form.phone }),
          workspaceId ? updateOrg(workspaceId, { name: form.companyName }) : Promise.resolve(),
        ]);
      }
      setSaved(form);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err: any) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initials = (form?.companyName ?? "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  if (fetching || !form) {
    return (
      <div className="p-5 flex items-center justify-center h-full">
        <div className="text-sm text-[#57606a]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="text-[15px] font-bold mb-4">Account Settings</div>

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <div className="text-xs font-bold text-[#24292f] mb-3.5">Personal Info</div>
          <div className="flex flex-col gap-3.5">
            <InputField label="Full Name" value={form.fullName} onChange={set("fullName")} />
            <InputField label="Email" value={form.email} onChange={() => {}} disabled />
            <InputField label="Phone" value={form.phone} onChange={set("phone")} type="tel" />
          </div>
        </Card>

        <Card>
          <div className="text-xs font-bold text-[#24292f] mb-3.5">Company Info</div>
          <div className="flex flex-col gap-3.5">
            <InputField label="Company Name" value={form.companyName} onChange={set("companyName")} />
            <div>
              <label className="block text-xs font-semibold text-[#57606a] mb-1">Company Logo</label>
              <div className="flex items-center gap-2.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-12 h-12 rounded-lg object-cover border border-[#D0D7DE]" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#ddf4ff] flex items-center justify-center text-lg font-extrabold text-[#3A4EA2]">
                    {initials}
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading || isDesignMode}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#D0D7DE] rounded-md bg-white cursor-pointer hover:bg-[#f6f8fa] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {logoUploading ? "Uploading…" : "Change Logo"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <SaveButton onClick={handleSave} loading={loading} dirty={!!dirty} />
      </div>

      <Toast message="Account settings saved!" show={toast} />
    </div>
  );
}
