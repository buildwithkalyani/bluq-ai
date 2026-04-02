"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contractor {
  name: string;
  phone: string;
  tasks: string[];
}

interface TeamMember {
  email: string;
  role: string;
  status: "Active" | "Invited";
}

interface Project {
  id: number;
  name: string;
  address: string;
  stage: string;
  type: string;
  startDate: string;
  endDate: string;
  code: string;
  eodTime: string;
  contractors: Contractor[];
  team: TeamMember[];
}

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

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  {
    id: 1,
    name: "Al Nakheel Tower",
    address: "Dubai Marina, Dubai, UAE",
    stage: "Foundation",
    type: "Residential",
    startDate: "2026-03-15",
    endDate: "2026-09-30",
    code: "ANT-2026-001",
    eodTime: "6:00 PM",
    contractors: [
      { name: "Rajesh Kumar", phone: "+971 50 123 4567", tasks: ["Foundation Works", "Rebar Installation"] },
      { name: "Ahmad Hassan", phone: "+971 55 678 1234", tasks: ["Formwork"] },
    ],
    team: [
      { email: "meera@pmcfirm.com", role: "Team Member", status: "Invited" },
      { email: "salim@pmcfirm.com", role: "Project Owner", status: "Active" },
    ],
  },
  {
    id: 2,
    name: "Marina Heights",
    address: "JBR Walk, Dubai, UAE",
    stage: "Superstructure",
    type: "Mixed Use",
    startDate: "2025-11-01",
    endDate: "2027-02-28",
    code: "MHT-2025-003",
    eodTime: "5:30 PM",
    contractors: [
      { name: "Farooq Ali", phone: "+971 52 345 6789", tasks: ["Concrete Pouring", "Column Works"] },
      { name: "Vikram Singh", phone: "+971 56 789 0123", tasks: ["MEP Rough-in", "Ducting"] },
      { name: "Chen Wei", phone: "+971 54 111 2222", tasks: ["Steel Erection"] },
    ],
    team: [
      { email: "aayush@pmcfirm.com", role: "Project Owner", status: "Active" },
      { email: "fatima@pmcfirm.com", role: "Team Member", status: "Active" },
      { email: "john@pmcfirm.com", role: "Team Member", status: "Invited" },
    ],
  },
  {
    id: 3,
    name: "Palm Residences",
    address: "Palm Jumeirah, Dubai, UAE",
    stage: "Planning",
    type: "Residential",
    startDate: "2026-06-01",
    endDate: "2028-01-15",
    code: "PLR-2026-007",
    eodTime: "6:00 PM",
    contractors: [],
    team: [
      { email: "aayush@pmcfirm.com", role: "Project Owner", status: "Active" },
    ],
  },
];

const STAGE_OPTIONS = ["Planning", "Design", "Foundation", "Structure", "Superstructure", "MEP", "Finishing", "Handover"];
const TYPE_OPTIONS = ["Residential", "Commercial", "Industrial", "Mixed Use", "Infrastructure"];
const EOD_TIMES = ["4:00 PM", "5:00 PM", "5:30 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

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

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#57606a] mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-sm text-[#24292f] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
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

// ─── Project Selector ─────────────────────────────────────────────────────────

function ProjectSelector({
  projects,
  activeId,
  onChange,
}: {
  projects: Project[];
  activeId: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = projects.find((p) => p.id === activeId)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1 text-[13px] font-medium cursor-pointer select-none"
      >
        <span className="w-2 h-2 rounded-full bg-[#3fb950] inline-block" />
        {active.name}
        <span className="text-[#57606a] text-[11px] ml-0.5">▾</span>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[220px] bg-white border border-[#D0D7DE] rounded-lg shadow-lg z-50 py-1">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className="px-3 py-2 text-xs cursor-pointer flex items-center gap-2 hover:bg-[#f6f8fa]"
              style={{ fontWeight: p.id === activeId ? 700 : 400, color: p.id === activeId ? "#3A4EA2" : "#24292f" }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.id === activeId ? "#3A4EA2" : "#D0D7DE" }}
              />
              <div>
                <div>{p.name}</div>
                <div className="text-[10px] text-[#8C959F] font-normal mt-0.5">{p.code}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── General Tab (Editable) ───────────────────────────────────────────────────

function GeneralTab({ project }: { project: Project }) {
  const toFormData = (p: Project): ProjectFormData => ({
    name: p.name, address: p.address, stage: p.stage, type: p.type,
    startDate: p.startDate, endDate: p.endDate, code: p.code, eodTime: p.eodTime,
  });

  const [saved, setSaved] = useState<ProjectFormData>(toFormData(project));
  const [form, setForm] = useState<ProjectFormData>(toFormData(project));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const data = toFormData(project);
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
    await new Promise((r) => setTimeout(r, 800));
    setSaved(form);
    setLoading(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4">
          <InputField label="Project Name" value={form.name} onChange={set("name")} />
          <InputField label="Project Address" value={form.address} onChange={set("address")} />

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Stage" value={form.stage} onChange={set("stage")} options={STAGE_OPTIONS} />
            <SelectField label="Type" value={form.type} onChange={set("type")} options={TYPE_OPTIONS} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Project Start Date" value={form.startDate} onChange={set("startDate")} type="date" />
            <InputField label="Project End Date" value={form.endDate} onChange={set("endDate")} type="date" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Project Code" value={form.code} onChange={set("code")} />
            <SelectField label="EOD Bot Prompt Time" value={form.eodTime} onChange={set("eodTime")} options={EOD_TIMES} />
          </div>
        </div>

        <div className="mt-5">
          <SaveButton onClick={handleSave} loading={loading} dirty={dirty} />
        </div>
      </Card>

      <Toast message="Project settings saved!" show={toast} />
    </>
  );
}

// ─── Contractors Tab ──────────────────────────────────────────────────────────

function ContractorsTab({ project }: { project: Project }) {
  const [contractors, setContractors] = useState<Contractor[]>(project.contractors);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  // Form state for add/edit
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTasks, setFormTasks] = useState("");

  // Reset when project changes
  useEffect(() => {
    setContractors(project.contractors);
    setShowAddForm(false);
    setEditingIndex(null);
  }, [project.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormTasks("");
  };

  const handleAdd = () => {
    if (!formName.trim() || !formPhone.trim()) return;
    const tasks = formTasks.split(",").map((t) => t.trim()).filter(Boolean);
    setContractors((prev) => [...prev, { name: formName.trim(), phone: formPhone.trim(), tasks }]);
    resetForm();
    setShowAddForm(false);
    showToast("Contractor added!");
  };

  const handleDelete = (index: number) => {
    const name = contractors[index].name;
    setContractors((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
    showToast(`${name} removed`);
  };

  const startEdit = (index: number) => {
    const c = contractors[index];
    setEditingIndex(index);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormTasks(c.tasks.join(", "));
    setShowAddForm(false);
  };

  const handleEditSave = () => {
    if (editingIndex === null || !formName.trim() || !formPhone.trim()) return;
    const tasks = formTasks.split(",").map((t) => t.trim()).filter(Boolean);
    setContractors((prev) =>
      prev.map((c, i) => (i === editingIndex ? { name: formName.trim(), phone: formPhone.trim(), tasks } : c))
    );
    setEditingIndex(null);
    resetForm();
    showToast("Contractor updated!");
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingIndex(null);
    resetForm();
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-[#24292f]">Linked Contractors</div>
            <div className="text-xs text-[#57606a] mt-0.5">
              Manage contractors. The Bluq bot collects daily updates from them on WhatsApp.
            </div>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setEditingIndex(null); resetForm(); }}
            className="bg-[#3A4EA2] text-white border-none rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-[#2d3d8a] active:scale-95 transition-all"
          >
            + Add Contractor
          </button>
        </div>

        {/* Add / Edit Form */}
        {(showAddForm || editingIndex !== null) && (
          <div className="bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg p-3.5 mb-4">
            <div className="text-xs font-bold text-[#24292f] mb-3">
              {editingIndex !== null ? "Edit Contractor" : "New Contractor"}
            </div>
            <div className="flex flex-col gap-2.5">
              <InputField label="Name" value={formName} onChange={setFormName} />
              <InputField label="Phone" value={formPhone} onChange={setFormPhone} type="tel" />
              <InputField label="Tasks (comma-separated)" value={formTasks} onChange={setFormTasks} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={editingIndex !== null ? handleEditSave : handleAdd}
                disabled={!formName.trim() || !formPhone.trim()}
                className="bg-[#3A4EA2] text-white border-none rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
              >
                {editingIndex !== null ? "Save" : "Add"}
              </button>
              <button
                onClick={cancelForm}
                className="text-xs text-[#57606a] font-semibold border border-[#D0D7DE] rounded-md px-3.5 py-1.5 bg-white cursor-pointer hover:bg-[#f6f8fa] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {contractors.length === 0 && !showAddForm ? (
          <div className="bg-[#f6f8fa] border border-[#D0D7DE] border-dashed rounded-lg py-8 text-center">
            <div className="text-sm text-[#8C959F] mb-1">No contractors linked yet</div>
            <div className="text-xs text-[#8C959F]">Add a contractor to start collecting daily updates via WhatsApp.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {contractors.map((c, i) => (
              <div key={i} className="bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg p-3.5">
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[#24292f]">{c.name}</div>
                    <div className="text-[11px] text-[#57606a] mt-0.5">📱 {c.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(i)}
                      className="text-xs text-[#57606a] font-semibold border border-[#D0D7DE] rounded-md px-2.5 py-1 bg-white cursor-pointer hover:bg-[#f6f8fa] transition"
                    >
                      Edit
                    </button>
                    <span
                      onClick={() => handleDelete(i)}
                      className="text-[#CF222E] text-xs cursor-pointer font-semibold hover:opacity-70 transition"
                    >
                      ✕
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.tasks.map((t, j) => (
                    <span key={j} className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#ddf4ff] text-[#3A4EA2] border border-[#3A4EA2]/25">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#e1e4e8] mt-5 pt-3.5">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[#57606a]">EOD Prompt Time</label>
            <div className="bg-white border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5">
              🕕 {project.eodTime}
              <span className="text-[#8C959F] ml-1">▾</span>
            </div>
            <span className="text-[11px] text-[#8C959F]">Bot sends daily prompts at this time</span>
          </div>
        </div>
      </Card>

      <Toast message={toast} show={!!toast} />
    </>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ project }: { project: Project }) {
  const [members, setMembers] = useState<TeamMember[]>(project.team);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Team Member");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  // Reset when project changes
  useEffect(() => {
    setMembers(project.team);
    setEmail("");
    setRole("Team Member");
  }, [project.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleInvite = () => {
    if (!email.trim() || !email.includes("@")) return;
    const exists = members.some((m) => m.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) {
      showToast("This member is already added");
      return;
    }
    setMembers((prev) => [...prev, { email: email.trim(), role, status: "Invited" }]);
    setEmail("");
    setRole("Team Member");
    showToast("Invitation sent!");
  };

  const handleRemove = (index: number) => {
    const removed = members[index].email;
    setMembers((prev) => prev.filter((_, i) => i !== index));
    showToast(`${removed} removed`);
  };

  const handleCopy = async () => {
    const link = `https://app.bluq.io/invite/${project.code.toLowerCase()}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API isn't available
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-[#24292f]">Team Members</div>
            <div className="text-xs text-[#57606a] mt-0.5">Manage who has access to this project.</div>
          </div>
          <button
            onClick={handleInvite}
            disabled={!email.trim() || !email.includes("@")}
            className="bg-[#3A4EA2] text-white border-none rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
          >
            + Invite Member
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#57606a] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              placeholder="colleague@pmcfirm.com"
              className="w-full border border-[#D0D7DE] rounded-md px-3 py-2 text-sm text-[#24292f] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
            />
          </div>
          <div className="w-[160px]">
            <SelectField label="Role" value={role} onChange={setRole} options={["Team Member", "Project Owner", "Viewer"]} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {members.map((m, i) => (
            <div key={i} className="bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#24292f]">{m.email}</div>
                <div className="text-[11px] text-[#57606a] mt-0.5">
                  {m.role} •{" "}
                  <span className={m.status === "Active" ? "text-[#1a7f37]" : "text-[#9a6700]"}>
                    {m.status}
                  </span>
                </div>
              </div>
              <span
                onClick={() => handleRemove(i)}
                className="text-[#CF222E] text-xs cursor-pointer font-semibold hover:opacity-70 transition"
              >
                ✕
              </span>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="bg-[#f6f8fa] border border-[#D0D7DE] border-dashed rounded-lg py-6 text-center mt-2">
            <div className="text-sm text-[#8C959F]">No team members yet</div>
          </div>
        )}

        <div className="border-t border-[#e1e4e8] mt-5 pt-3.5">
          <label className="block text-xs font-semibold text-[#57606a] mb-1.5">Share invitation link</label>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#f6f8fa] border border-[#D0D7DE] rounded-md px-3 py-2 text-xs text-[#8C959F] overflow-hidden whitespace-nowrap text-ellipsis">
              https://app.bluq.io/invite/{project.code.toLowerCase()}...
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-semibold border border-[#D0D7DE] rounded-md bg-white cursor-pointer hover:bg-[#f6f8fa] transition"
            >
              {copied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>
        </div>
      </Card>

      <Toast message={toast} show={!!toast} />
    </>
  );
}

// ─── Main Page (default export) ───────────────────────────────────────────────

type SidebarItem = "General" | "Contractors" | "Team";

export default function ProjectSettingsPage() {
  const [sidebar, setSidebar] = useState<SidebarItem>("General");
  const [activeProjectId, setActiveProjectId] = useState(1);

  const project = PROJECTS.find((p) => p.id === activeProjectId)!;

  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="text-[15px] font-bold text-[#24292f]">Project Settings</div>
        <ProjectSelector
          projects={PROJECTS}
          activeId={activeProjectId}
          onChange={setActiveProjectId}
        />
      </div>

      {/* Sidebar + Content */}
      <div className="flex gap-4">
        <div className="w-36 shrink-0 pt-1">
          {(["General", "Contractors", "Team"] as SidebarItem[]).map((item) => (
            <button
              key={item}
              onClick={() => setSidebar(item)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] mb-0.5 transition ${
                sidebar === item
                  ? "bg-[#ddf4ff] text-[#0969da] font-semibold"
                  : "text-[#57606a] hover:bg-[#f6f8fa]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {sidebar === "General" && <GeneralTab project={project} />}
          {sidebar === "Contractors" && <ContractorsTab project={project} />}
          {sidebar === "Team" && <TeamTab project={project} />}
        </div>
      </div>
    </div>
  );
}
