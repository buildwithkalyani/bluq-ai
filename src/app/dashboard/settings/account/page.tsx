"use client";

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountSettings {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-5 ${className}`}>{children}</div>
);

const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  disabled?: boolean;
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

const SaveButton = ({
  onClick,
  loading,
  dirty,
}: {
  onClick: () => void;
  loading: boolean;
  dirty: boolean;
}) => (
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

// ─── Data ─────────────────────────────────────────────────────────────────────

const INITIAL_ACCOUNT: AccountSettings = {
  fullName: "Aayush Patel",
  email: "aayush@pmcfirm.com",
  phone: "+971 50 987 6543",
  companyName: "Bluq Engineering Consultants",
};

// ─── Main Page (default export) ──────────────────────────────────────────────

export default function AccountSettingsPage() {
  const [saved, setSaved] = useState<AccountSettings>(INITIAL_ACCOUNT);
  const [form, setForm] = useState<AccountSettings>(INITIAL_ACCOUNT);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = useCallback(
    <K extends keyof AccountSettings>(key: K) =>
      (val: string) => setForm((prev) => ({ ...prev, [key]: val })),
    []
  );

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaved(form);
    setLoading(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  const initials = form.companyName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="text-[15px] font-bold mb-4">Account Settings</div>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <div className="text-xs font-bold text-[#24292f] mb-3.5">Personal Info</div>
          <div className="flex flex-col gap-3.5">
            <InputField label="Full Name" value={form.fullName} onChange={set("fullName")} />
            <InputField label="Email" value={form.email} onChange={set("email")} type="email" />
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
                <div className="w-12 h-12 rounded-lg bg-[#ddf4ff] flex items-center justify-center text-lg font-extrabold text-[#3A4EA2]">
                  {initials || "?"}
                </div>
                <button className="px-3 py-1.5 text-xs font-semibold border border-[#D0D7DE] rounded-md bg-white cursor-pointer hover:bg-[#f6f8fa] transition">
                  Change Logo
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <SaveButton onClick={handleSave} loading={loading} dirty={dirty} />
      </div>

      <Toast message="Account settings saved!" show={toast} />
    </div>
  );
}
