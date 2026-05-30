"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects, updateProject, sendContractorWelcome, sendTeamInvite, BackendProject } from "@/lib/api-client";
import { getProjects } from "@/lib/mock-data";

function parseMockDate(d: string): string | null {
  try { const t = new Date(d); return isNaN(t.getTime()) ? null : t.toISOString().split("T")[0]; }
  catch { return null; }
}

function mockToBackendProject(p: Awaited<ReturnType<typeof getProjects>>[number]): BackendProject {
  return {
    id: `mock-${p.id}`,
    workspaceId: "mock",
    projectName: p.name,
    projectCode: p.code,
    address: p.address,
    stage: p.stage,
    category: null,
    startDate: parseMockDate(p.startDate),
    endDate: parseMockDate(p.endDate),
    status: p.status,
    clientName: null,
    percentComplete: p.pct,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectFormData {
  name: string;
  address: string;
  stage: string;
  type: string;
  startDate: string;
  endDate: string;
  code: string;
  eodTime: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_OPTIONS = ["Planning", "Design", "Foundation", "Structure", "Superstructure", "MEP", "Finishing", "Handover"];
const TYPE_OPTIONS = ["Residential", "Commercial", "Mixed Use", "Industrial / Warehouse", "Road / Highway", "Railway / Metro", "Bridge / Flyover", "Tunnel"];
const EOD_TIMES = ["4:00 PM", "5:00 PM", "5:30 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectToForm(p: BackendProject): ProjectFormData {
  const settings = (p as any).settingsJson ?? {};
  return {
    name: p.projectName ?? "",
    address: p.address ?? "",
    stage: p.stage ?? "Planning",
    type: p.category ?? "Residential",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    code: p.projectCode ?? "",
    eodTime: settings.eodTime ?? "6:00 PM",
  };
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-[#E2E8F0] rounded-lg p-5 ${className}`}>{children}</div>
);

const InputField = ({
  label, value, onChange, type = "text", disabled = false, min,
}: {
  label: string; value: string; onChange: (val: string) => void; type?: string; disabled?: boolean; min?: string;
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#475569] mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#F8FAFC] disabled:text-[#475569] transition"
    />
  </div>
);

const SelectField = ({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (val: string) => void; options: string[];
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#475569] mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const DateField = ({
  label, value, onChange, min,
}: {
  label: string; value: string; onChange: (val: string) => void; min?: string;
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#475569] mb-1">{label}</label>
    <input
      type="date"
      value={value}
      min={min}
      onChange={(e) => {
        const val = e.target.value;
        if (min && val && val < min) return;
        onChange(val);
      }}
      className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
    />
  </div>
);

const SaveButton = ({ onClick, loading, dirty }: { onClick: () => void; loading: boolean; dirty: boolean }) => (
  <button
    onClick={onClick}
    disabled={loading || !dirty}
    className="bg-[#2563EB] text-white border-none rounded-md px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
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


// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ project, isMock = false, onSettingsUpdated }: { project: BackendProject; isMock?: boolean; onSettingsUpdated?: (id: string, s: Record<string, unknown>) => void }) {
  const [saved, setSaved] = useState<ProjectFormData>(projectToForm(project));
  const [form, setForm] = useState<ProjectFormData>(projectToForm(project));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const data = projectToForm(project);
    setSaved(data);
    setForm(data);
  }, [project.id]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = useCallback(
    <K extends keyof ProjectFormData>(key: K) =>
      (val: string) => setForm((prev) => ({ ...prev, [key]: val })),
    []
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      const existingSettings = (project as any).settingsJson ?? {};
      const newSettings = { ...existingSettings, eodTime: form.eodTime };
      if (!isMock) {
        await updateProject(project.id, {
          projectName: form.name,
          address: form.address,
          stage: form.stage,
          category: form.type,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          projectCode: form.code,
          settingsJson: newSettings,
        });
      }
      onSettingsUpdated?.(project.id, newSettings);
      setSaved(form);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        {/* Card header — project identity */}
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold text-[#0F172A] leading-tight">{form.name || "Untitled Project"}</div>
            {form.code && <code className="text-[11px] font-mono text-[#94A3B8] mt-0.5 block">{form.code}</code>}
          </div>
          {form.stage && (
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-[#EFF6FF] text-[#2563EB]">{form.stage}</span>
          )}
        </div>

        {/* Form body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <InputField label="Project Name" value={form.name} onChange={set("name")} />
          </div>
          <div className="col-span-2">
            <InputField label="Project Address" value={form.address} onChange={set("address")} />
          </div>
          <SelectField label="Stage" value={form.stage} onChange={set("stage")} options={STAGE_OPTIONS} />
          <SelectField label="Type" value={form.type} onChange={set("type")} options={TYPE_OPTIONS} />
          <DateField
            label="Start Date"
            value={form.startDate}
            onChange={(val) => {
              setForm((prev) => ({
                ...prev,
                startDate: val,
                endDate: prev.endDate && prev.endDate < val ? val : prev.endDate,
              }));
            }}
          />
          <DateField
            label="End Date"
            value={form.endDate}
            onChange={set("endDate")}
            min={form.startDate || undefined}
          />
          <SelectField label="EOD Bot Prompt Time" value={form.eodTime} onChange={set("eodTime")} options={EOD_TIMES} />
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Project Code</label>
            <div className="flex items-center gap-2 h-[38px] px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <code className="text-[13px] font-mono text-[#475569] flex-1 truncate">{form.code || "—"}</code>
              <span className="text-[10px] text-[#CBD5E1] shrink-0">read-only</span>
            </div>
          </div>
        </div>

        {/* Card footer */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center gap-3">
          <SaveButton onClick={handleSave} loading={loading} dirty={dirty} />
          {dirty && <span className="text-[12px] text-[#94A3B8]">Unsaved changes</span>}
        </div>
      </div>

      <Toast message="Project settings saved!" show={toast} />
    </>
  );
}

// ─── Contractors Tab ──────────────────────────────────────────────────────────

interface Contractor {
  id: string;
  name: string;
  phone: string;
  trade: string;
}

const TRADE_OPTIONS = [
  "Civil", "Structural", "MEP", "Electrical", "Plumbing", "HVAC",
  "Finishing", "Facade", "Landscaping", "Safety", "Other",
];

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "IN" },
  { code: "+971", flag: "🇦🇪", label: "AE" },
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+44", flag: "🇬🇧", label: "GB" },
  { code: "+966", flag: "🇸🇦", label: "SA" },
  { code: "+974", flag: "🇶🇦", label: "QA" },
  { code: "+965", flag: "🇰🇼", label: "KW" },
  { code: "+968", flag: "🇴🇲", label: "OM" },
  { code: "+973", flag: "🇧🇭", label: "BH" },
  { code: "+60", flag: "🇲🇾", label: "MY" },
  { code: "+65", flag: "🇸🇬", label: "SG" },
];

function ContractorsTab({ project, isMock = false, onSettingsUpdated }: { project: BackendProject; isMock?: boolean; onSettingsUpdated?: (id: string, s: Record<string, unknown>) => void }) {
  const settings = (project as any).settingsJson ?? {};
  const [contractors, setContractors] = useState<Contractor[]>(settings.contractors ?? []);
  const [saved, setSaved] = useState<Contractor[]>(settings.contractors ?? []);

  useEffect(() => {
    const s = (project as any).settingsJson ?? {};
    setContractors(s.contractors ?? []);
    setSaved(s.contractors ?? []);
    setAdding(false);
    setNewName(""); setNewPhone(""); setNewTrade("Civil"); setNewCountryCode("+91");
  }, [project.id]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCountryCode, setNewCountryCode] = useState("+91");
  const [newTrade, setNewTrade] = useState("Civil");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");

  const isValidPhone = (digits: string) => digits.replace(/\D/g, "").length === 10;

  const dirty = JSON.stringify(contractors) !== JSON.stringify(saved);

  const handleAdd = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    if (!isValidPhone(newPhone)) {
      setNewPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }
    const digits = newPhone.trim().replace(/\D/g, "");
    const fullPhone = `${newCountryCode}${digits}`;
    const entry: Contractor = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      phone: fullPhone,
      trade: newTrade,
    };
    setContractors((prev) => [...prev, entry]);
    setNewName("");
    setNewPhone("");
    setNewCountryCode("+91");
    setNewTrade("Civil");
    setNewPhoneError("");
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    const updated = contractors.filter((c) => c.id !== id);
    setContractors(updated);
    setSaving(true);
    try {
      setSaveError("");
      const newSettings = { ...settings, contractors: updated };
      if (!isMock) {
        await updateProject(project.id, { settingsJson: newSettings });
      }
      onSettingsUpdated?.(project.id, newSettings);
      setSaved(updated);
    } catch (err: any) {
      console.error("Failed to remove contractor:", err);
      setContractors((prev) => [...prev, contractors.find((c) => c.id === id)!]);
      setSaveError(err?.message ?? "Remove failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setSaveError("");
      const newSettings = { ...settings, contractors };
      if (!isMock) {
        await updateProject(project.id, { settingsJson: newSettings });
        // Send welcome WhatsApp to newly added contractors
        const savedIds = new Set(saved.map((c) => c.id));
        const newOnes = contractors.filter((c) => !savedIds.has(c.id));
        await Promise.allSettled(
          newOnes.map((c) =>
            sendContractorWelcome(c.phone, c.name, project.projectName ?? "your project")
          )
        );
      }
      onSettingsUpdated?.(project.id, newSettings);
      setSaved(contractors);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err: any) {
      console.error("Failed to save contractors:", err);
      setSaveError(err?.message ?? "Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-[#0F172A]">Linked Contractors</div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#2d3d8a] transition-colors"
          >
            <span className="text-sm leading-none">+</span> Add Contractor
          </button>
        </div>
        <div className="text-xs text-[#475569] mb-4">
          The Bluq bot collects daily updates from linked contractors on WhatsApp.
        </div>

        {/* Add form */}
        {adding && (
          <div className="mb-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex flex-col gap-3">
            <div className="text-xs font-semibold text-[#0F172A]">New Contractor</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">NAME *</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">WHATSAPP NUMBER *</label>
                <div className={`flex border rounded-md overflow-hidden focus-within:ring-2 bg-white ${newPhoneError ? "border-red-400 focus-within:border-red-400 focus-within:ring-red-400/20" : "border-[#E2E8F0] focus-within:border-[#0969da] focus-within:ring-[#0969da]/20"}`}>
                  <select
                    value={newCountryCode}
                    onChange={(e) => setNewCountryCode(e.target.value)}
                    className="shrink-0 border-r border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-1.5 text-xs text-[#0F172A] outline-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    value={newPhone}
                    onChange={(e) => { const val = e.target.value.replace(/\D/g, ""); setNewPhone(val); setNewPhoneError(val.length > 0 && !isValidPhone(val) ? "Please enter a valid 10-digit phone number." : ""); }}
                    placeholder="98765 43210"
                    className="flex-1 px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none min-w-0"
                  />
                </div>
                {newPhoneError && (
                  <p className="text-red-500 text-[11px] mt-1">{newPhoneError}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">TRADE</label>
                <select
                  value={newTrade}
                  onChange={(e) => setNewTrade(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                >
                  {TRADE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newPhone.trim() || (newPhone.trim().length > 0 && !isValidPhone(newPhone))}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#2d3d8a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setNewName(""); setNewPhone(""); setNewCountryCode("+91"); setNewTrade("Civil"); setNewPhoneError(""); }}
                className="px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contractor list */}
        {contractors.length === 0 ? (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] border-dashed rounded-lg py-8 text-center">
            <div className="text-sm text-[#94A3B8] mb-1">No contractors linked</div>
            <div className="text-xs text-[#94A3B8]">Add contractors to receive daily WhatsApp updates from them.</div>
          </div>
        ) : (
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">Name</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">WhatsApp</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">Trade</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {contractors.map((c, i) => (
                  <tr key={c.id} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}>
                    <td className="px-3 py-2.5 font-medium text-[#0F172A]">{c.name}</td>
                    <td className="px-3 py-2.5 text-[#475569] font-mono">{c.phone}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block bg-[#EFF6FF] text-[#0969da] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {c.trade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleRemove(c.id)}
                        className="text-[#94A3B8] hover:text-red-600 transition-colors text-base leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {saveError && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{saveError}</div>
        )}
        {dirty && (
          <div className="mt-4">
            <SaveButton
              onClick={handleSave}
              loading={saving}
              dirty={dirty && !(adding && newPhone.trim().length > 0 && !isValidPhone(newPhone))}
            />
          </div>
        )}
      </Card>

      <Toast message="Contractors saved!" show={toast} />
    </>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Editor" | "Viewer";
}

const ROLE_OPTIONS: TeamMember["role"][] = ["Super Admin", "Admin", "Editor", "Viewer"];

const ROLE_STYLE: Record<TeamMember["role"], { bg: string; text: string }> = {
  "Super Admin": { bg: "#F5F3FF", text: "#7C3AED" },
  Admin:         { bg: "#FEF2F2", text: "#DC2626" },
  Editor:        { bg: "#EFF6FF", text: "#0969da" },
  Viewer:        { bg: "#F1F5F9", text: "#475569" },
};

function TeamTab({ project, isMock = false, onSettingsUpdated }: { project: BackendProject; isMock?: boolean; onSettingsUpdated?: (id: string, s: Record<string, unknown>) => void }) {
  const settings = (project as any).settingsJson ?? {};
  const [members, setMembers] = useState<TeamMember[]>(settings.team ?? []);
  const [saved, setSaved] = useState<TeamMember[]>(settings.team ?? []);

  useEffect(() => {
    const s = (project as any).settingsJson ?? {};
    setMembers(s.team ?? []);
    setSaved(s.team ?? []);
    setAdding(false);
    setNewName(""); setNewEmail(""); setNewRole("Editor");
  }, [project.id]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamMember["role"]>("Editor");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [saveError, setSaveError] = useState("");

  const dirty = JSON.stringify(members) !== JSON.stringify(saved);

  const handleAdd = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const entry: TeamMember = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
    };
    setMembers((prev) => [...prev, entry]);
    setNewName("");
    setNewEmail("");
    setNewRole("Editor");
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    setSaving(true);
    try {
      setSaveError("");
      const newSettings = { ...settings, team: updated };
      if (!isMock) {
        await updateProject(project.id, { settingsJson: newSettings });
      }
      onSettingsUpdated?.(project.id, newSettings);
      setSaved(updated);
    } catch (err: any) {
      console.error("Failed to remove member:", err);
      setMembers((prev) => [...prev, members.find((m) => m.id === id)!]);
      setSaveError(err?.message ?? "Remove failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = (id: string, role: TeamMember["role"]) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setSaveError("");
      const newSettings = { ...settings, team: members };
      if (!isMock) {
        await updateProject(project.id, { settingsJson: newSettings });
        // Send invite emails to newly added members
        const savedIds = new Set(saved.map((m) => m.id));
        const newOnes = members.filter((m) => !savedIds.has(m.id));
        await Promise.allSettled(
          newOnes.map((m) =>
            sendTeamInvite(m.email, m.name, m.role, project.workspaceId)
          )
        );
      }
      onSettingsUpdated?.(project.id, newSettings);
      setSaved(members);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err: any) {
      console.error("Failed to save team:", err);
      setSaveError(err?.message ?? "Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-[#0F172A]">Team Members</div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#2d3d8a] transition-colors"
          >
            <span className="text-sm leading-none">+</span> Add Member
          </button>
        </div>
        <div className="text-xs text-[#475569] mb-4">
          Manage who has access to this project.
        </div>

        {/* Add form */}
        {adding && (
          <div className="mb-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex flex-col gap-3">
            <div className="text-xs font-semibold text-[#0F172A]">New Team Member</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">NAME *</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ahmed Hassan"
                  className="w-full border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">EMAIL *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ahmed@example.com"
                  className="w-full border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">ROLE</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as TeamMember["role"])}
                  className="w-full border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newEmail.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#2d3d8a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setNewName(""); setNewEmail(""); setNewRole("Editor"); }}
                className="px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Member list */}
        {members.length === 0 ? (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] border-dashed rounded-lg py-8 text-center">
            <div className="text-sm text-[#94A3B8] mb-1">No team members added</div>
            <div className="text-xs text-[#94A3B8]">Add team members to control who has access to this project.</div>
          </div>
        ) : (
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">Name</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">Email</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#475569]">Role</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}>
                    <td className="px-3 py-2.5 font-medium text-[#0F172A]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        {m.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#475569]">{m.email}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as TeamMember["role"])}
                        className="border border-[#E2E8F0] rounded px-1.5 py-0.5 text-[10px] font-semibold outline-none"
                        style={{ background: ROLE_STYLE[m.role].bg, color: ROLE_STYLE[m.role].text }}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="text-[#94A3B8] hover:text-red-600 transition-colors text-base leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {saveError && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{saveError}</div>
        )}
        {dirty && (
          <div className="mt-4">
            <SaveButton onClick={handleSave} loading={saving} dirty={dirty} />
          </div>
        )}
      </Card>

      <Toast message="Team saved!" show={toast} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SidebarItem = "General" | "Contractors";

function ProjectSettingsPageInner() {
  const { workspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const { isPending: sessionPending } = authClient.useSession();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<BackendProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [sidebar, setSidebar] = useState<SidebarItem>("General");

  // Use mock data when in design mode OR when no workspace is available (backend offline)
  const useMock = isDesignMode || (!wsLoading && !sessionPending && !workspaceId);

  const handleSettingsUpdated = useCallback((projectId: string, newSettingsJson: Record<string, unknown>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, settingsJson: newSettingsJson } as any : p
      )
    );
  }, []);

  useEffect(() => {
    // Wait for both workspace and session before deciding design vs real mode
    if (wsLoading || sessionPending) return;

    if (useMock) {
      setLoadingProjects(true);
      getProjects().then((mockProjects) => {
        const data = mockProjects.map(mockToBackendProject);
        setProjects(data);
        if (data.length > 0) {
          const preselect = urlProjectId && data.find((p) => p.id === urlProjectId);
          setActiveProjectId(preselect ? preselect.id : data[0].id);
        }
      }).finally(() => setLoadingProjects(false));
      return;
    }
    if (wsLoading) return; // workspace still resolving
    if (!workspaceId) { setLoadingProjects(false); return; }
    setLoadingProjects(true);
    fetchProjects(workspaceId)
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          const preselect = urlProjectId && data.find((p) => p.id === urlProjectId);
          setActiveProjectId(preselect ? preselect.id : data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingProjects(false));
  }, [workspaceId, wsLoading, urlProjectId, isDesignMode]);

  const project = projects.find((p) => p.id === activeProjectId);

  if (loadingProjects) {
    return (
      <div className="px-6 py-5 animate-pulse space-y-5">
        <div className="h-6 w-40 bg-[#E2E8F0] rounded" />
        <div className="h-4 w-24 bg-[#E2E8F0] rounded" />
        <div className="flex gap-6 border-b border-[#E2E8F0] pb-0">
          {[1, 2, 3].map((i) => <div key={i} className="h-4 w-20 bg-[#E2E8F0] rounded mb-3" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-[#E2E8F0] rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-5 flex items-center justify-center h-full">
        <div className="text-sm text-[#475569]">No projects found.</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 overflow-y-auto h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="mb-1">
        <div className="text-[20px] font-bold text-[#0F172A] leading-tight">Project Settings</div>
        <div className="text-[13px] text-[#64748B] mt-0.5">{project.projectName}</div>
      </div>

      {/* Underline tabs */}
      <div className="flex border-b border-[#E2E8F0] mt-4 mb-5">
        {(["General", "Contractors"] as SidebarItem[]).map((item) => (
          <button
            key={item}
            onClick={() => setSidebar(item)}
            className={`px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
              sidebar === item
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {sidebar === "General" && <GeneralTab project={project} isMock={useMock} onSettingsUpdated={handleSettingsUpdated} />}
      {sidebar === "Contractors" && <ContractorsTab project={project} isMock={useMock} onSettingsUpdated={handleSettingsUpdated} />}
    </div>
  );
}

export default function ProjectSettingsPage() {
  return (
    <Suspense>
      <ProjectSettingsPageInner />
    </Suspense>
  );
}
