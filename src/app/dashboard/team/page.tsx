"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Copy, Check, ChevronDown, X, Users, Shield, Pencil, Trash2, ChevronRight, Crown, FolderOpen } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import {
  fetchTeamMembers, removeTeamMember, updateMemberRole,
  getTeamInviteLink, sendTeamInvite, fetchProjects,
  fetchMemberProjectAccess, setMemberProjectAccess,
  fetchRoles, createRole, updateRole, deleteRole,
  TeamMember, WorkspaceRole, RolePermissions, PermLevel,
} from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────
type Tab = "team" | "roles";

type RoleOption = { name: string; description: string; isBuiltin?: boolean };

type SectionDef = {
  key: keyof RolePermissions;
  label: string;
  maxLevel?: PermLevel;
  levelHints: Partial<Record<PermLevel, string>>;
  editDanger?: boolean;
};

const SECTIONS: SectionDef[] = [
  {
    key: "overview",
    label: "Overview",
    levelHints: {
      view: "View project KPIs & progress summary",
      edit: "Create, edit & delete projects",
    },
  },
  {
    key: "schedule",
    label: "Schedule",
    levelHints: {
      view: "View Gantt chart & task list",
      edit: "Add, modify & delete tasks and dates",
    },
  },
  {
    key: "reports",
    label: "Reports / DPR",
    levelHints: {
      view: "Read submitted reports",
      edit: "Create, submit & approve daily reports",
    },
  },
  {
    key: "documents",
    label: "Documents",
    levelHints: {
      view: "View & download files",
      upload: "Upload new files (cannot delete or approve)",
      edit: "Upload, approve, reject & delete files",
    },
  },
  {
    key: "siteUpdates",
    label: "Site Updates",
    levelHints: {
      view: "View photos & field updates",
      edit: "Post photos, updates & comments",
    },
  },
  {
    key: "team",
    label: "Team & Roles",
    editDanger: true,
    levelHints: {
      view: "See the member list",
      edit: "Invite members, assign roles & remove access",
    },
  },
  {
    key: "settings",
    label: "Settings",
    editDanger: true,
    levelHints: {
      view: "View current settings",
      edit: "Modify project & workspace settings",
    },
  },
];

const LEVELS: { value: PermLevel; label: string; color: string; docsOnly?: boolean }[] = [
  { value: "none",   label: "No Access",    color: "#94A3B8" },
  { value: "view",   label: "View",         color: "#0891B2" },
  { value: "upload", label: "Upload",       color: "#7C3AED", docsOnly: true },
  { value: "edit",   label: "Full Access",  color: "#059669" },
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  overview: "view", schedule: "view", reports: "none",
  documents: "none", siteUpdates: "none", team: "none", settings: "none",
};

const BUILTIN_ROLES: Array<RoleOption & { scope: string; scopeColor: string; scopeBg: string; capabilities: string[]; cannotDo: string }> = [
  {
    name: "Super Admin",
    description: "Workspace owner. Cannot be removed or have their role changed by anyone.",
    isBuiltin: true,
    scope: "Workspace owner",
    scopeColor: "#7C3AED",
    scopeBg: "#F5F3FF",
    capabilities: ["Full access to all projects & sections", "Manage workspace settings & billing", "Add or remove any member"],
    cannotDo: "",
  },
  {
    name: "Admin",
    description: "Full access across all projects. Cannot change ownership or billing settings.",
    isBuiltin: true,
    scope: "Workspace-wide",
    scopeColor: "#2563EB",
    scopeBg: "#EFF6FF",
    capabilities: ["Full access to all projects & sections", "Invite members and manage roles", "Approve documents & reports"],
    cannotDo: "Cannot delete workspace or change billing. Can be removed by Super Admin.",
  },
];

// ── Helpers ───────────────────────────────────────────────────
function nameInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}

function avatarColor(name: string) {
  const colors = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── Permission matrix ─────────────────────────────────────────
const LEVEL_RANK_MAP: Record<PermLevel, number> = { none: 0, view: 1, upload: 2, edit: 3 };

function PermMatrix({
  permissions,
  onChange,
  readonly,
}: {
  permissions: RolePermissions;
  onChange?: (p: RolePermissions) => void;
  readonly?: boolean;
}) {
  const set = (key: keyof RolePermissions, val: PermLevel) => {
    if (!onChange) return;
    onChange({ ...permissions, [key]: val });
  };

  return (
    <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[200px_1fr_1fr_1fr_1fr] bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="px-4 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Section</div>
        {LEVELS.map(l => (
          <div key={l.value} className="px-2 py-2.5 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: l.docsOnly ? "#94A3B8" : l.color }}>{l.label}</div>
            {l.docsOnly && <div className="text-[9px] text-[#94A3B8] mt-0.5">documents only</div>}
          </div>
        ))}
      </div>
      {SECTIONS.map((s, i) => (
        <div key={s.key} className={`grid grid-cols-[200px_1fr_1fr_1fr_1fr] ${i < SECTIONS.length - 1 ? "border-b border-[#F1F5F9]" : ""}`}>
          <div className="px-4 py-3.5">
            <div className="text-[13px] font-medium text-[#0F172A]">{s.label}</div>
            {s.editDanger && (
              <div className="text-[10px] text-[#DC2626] mt-0.5">Sensitive — grant carefully</div>
            )}
          </div>
          {LEVELS.map(l => {
            const isDocsOnly = l.docsOnly && s.key !== "documents";
            const isBeyondMax = s.maxLevel !== undefined && LEVEL_RANK_MAP[l.value] > LEVEL_RANK_MAP[s.maxLevel];
            const isNA = isDocsOnly || isBeyondMax;
            const isSelected = permissions[s.key] === l.value;
            const hint = s.levelHints[l.value];
            return (
              <div key={l.value} className="flex flex-col items-center justify-start py-3 px-1">
                {isNA ? (
                  <span className="text-[13px] text-[#E2E8F0] leading-none mt-1">—</span>
                ) : (
                  <>
                    <button
                      disabled={readonly}
                      onClick={() => set(s.key, l.value)}
                      className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center shrink-0 ${
                        isSelected ? "border-transparent" : "border-[#CBD5E1] hover:border-[#94A3B8]"
                      } ${readonly ? "cursor-default" : "cursor-pointer"}`}
                      style={isSelected ? { background: l.color, borderColor: l.color } : {}}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                    {hint && isSelected && (
                      <div className="text-[10px] text-center leading-tight mt-1.5 max-w-[80px]" style={{ color: l.color }}>
                        {hint}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────
function RoleCard({
  role,
  onSave,
  onDelete,
}: {
  role: WorkspaceRole;
  onSave: (id: string, name: string, desc: string, permissions: RolePermissions) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description ?? "");
  const [permissions, setPermissions] = useState<RolePermissions>({ ...DEFAULT_PERMISSIONS, ...role.permissions });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(role.id, name, desc, permissions);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setName(role.name);
    setDesc(role.description ?? "");
    setPermissions({ ...DEFAULT_PERMISSIONS, ...role.permissions });
    setEditing(false);
  };

  const levelForSection = (key: keyof RolePermissions) => {
    const val = permissions[key];
    return LEVELS.find(l => l.value === val);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#FAFBFF] transition-colors"
        onClick={() => !editing && setExpanded(v => !v)}
      >
        <ChevronRight
          size={16}
          className={`text-[#94A3B8] transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-[14px] font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] w-48"
              />
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Description (optional)"
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-[13px] text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] flex-1"
              />
            </div>
          ) : (
            <div>
              <span className="text-[14px] font-semibold text-[#0F172A]">{role.name}</span>
              {role.description && <span className="ml-3 text-[13px] text-[#64748B]">{role.description}</span>}
            </div>
          )}
        </div>

        {/* Permission summary chips (collapsed only) */}
        {!expanded && !editing && (
          <div className="flex items-center gap-1.5 mr-2">
            {SECTIONS.slice(0, 4).map(s => {
              const lvl = levelForSection(s.key);
              if (!lvl || lvl.value === "none") return null;
              return (
                <span
                  key={s.key}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: `${lvl.color}18`, color: lvl.color }}
                >
                  {s.label}: {lvl.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-[12px] font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setExpanded(true); setEditing(true); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors cursor-pointer"
                title="Edit role"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(role.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                title="Delete role"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded: permission matrix */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[#F1F5F9]">
          <div className="mt-4">
            <PermMatrix
              permissions={permissions}
              onChange={editing ? setPermissions : undefined}
              readonly={!editing}
            />
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#2563EB] hover:underline cursor-pointer"
            >
              <Pencil size={13} /> Edit permissions
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── New role form ─────────────────────────────────────────────
function NewRoleForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, desc: string, permissions: RolePermissions) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [permissions, setPermissions] = useState<RolePermissions>({ ...DEFAULT_PERMISSIONS });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(name.trim(), desc.trim(), permissions);
    } catch (e: any) {
      setError(e.message ?? "Failed to create role");
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#2563EB]/30 rounded-xl shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <div className="text-[14px] font-semibold text-[#0F172A] mb-3">New Role</div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Role Name *</label>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Site Engineer"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Description</label>
            <input
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Optional"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
          </div>
        </div>
        {error && <div className="mt-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      <div className="px-5 py-4">
        <div className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">Permissions</div>
        <PermMatrix permissions={permissions} onChange={setPermissions} />
      </div>

      <div className="flex items-center gap-2 px-5 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC]">
        <button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-40"
        >
          {saving ? "Creating…" : "Create Role"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[13px] font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Role dropdown ─────────────────────────────────────────────
function RoleSelect({
  value, roleOptions, onChange, disabled,
}: {
  value: string; roleOptions: RoleOption[]; onChange: (r: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
          disabled
            ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] cursor-default"
            : "bg-white border-[#E2E8F0] text-[#0F172A] hover:border-[#CBD5E1] cursor-pointer"
        }`}
      >
        {value}
        {!disabled && <ChevronDown size={12} className="text-[#94A3B8]" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-100">
            {roleOptions.map(r => (
              <div
                key={r.name}
                onClick={() => { onChange(r.name); setOpen(false); }}
                className={`px-3 py-2.5 cursor-pointer rounded-lg mx-1 transition-colors ${
                  r.name === value ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
                }`}
              >
                <div className={`flex items-center gap-2 mb-0.5 ${r.name === value ? "text-[#2563EB]" : "text-[#0F172A]"}`}>
                  <span className="text-[13px] font-semibold">{r.name}</span>
                  {r.isBuiltin && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] uppercase tracking-wide">Built-in</span>}
                </div>
                <div className="text-[11px] text-[#64748B] leading-snug">{r.description}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Project access popover (inline, no full-screen modal) ────
function ProjectAccessPopover({
  member, workspaceId, anchorEl, onClose, onSaved,
}: {
  member: TeamMember; workspaceId: string;
  anchorEl: HTMLElement;
  onClose: () => void;
  onSaved: (userId: string, count: number) => void;
}) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Position below the anchor button
  const rect = anchorEl.getBoundingClientRect();
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 6,
    left: Math.min(rect.left, window.innerWidth - 320 - 8),
    width: 320,
    zIndex: 9999,
  };

  useEffect(() => {
    Promise.all([
      fetchProjects(workspaceId).then(ps => ps.map(p => ({ id: String(p.id), name: p.projectName ?? "" }))),
      fetchMemberProjectAccess(member.userId, workspaceId),
    ]).then(([ps, access]) => {
      setProjects(ps);
      setSelected(new Set(access));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [member.userId, workspaceId]);

  const visible = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const allChecked = visible.length > 0 && visible.every(p => selected.has(p.id));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) visible.forEach(p => next.delete(p.id));
    else visible.forEach(p => next.add(p.id));
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setMemberProjectAccess(member.userId, workspaceId, Array.from(selected));
      onSaved(member.userId, selected.size);
      onClose();
    } catch { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div style={popoverStyle} className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#F1F5F9]">
          <div className="text-[13px] font-semibold text-[#0F172A]">{member.name}</div>
          <div className="text-[11px] text-[#64748B]">Select which projects this member can access</div>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
            <Search size={12} className="text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" autoFocus
              className="flex-1 bg-transparent text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none" />
          </div>
        </div>

        {/* Select all */}
        {!loading && visible.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] cursor-pointer hover:bg-[#F1F5F9] transition-colors" onClick={toggleAll}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-[#2563EB] cursor-pointer" onClick={e => e.stopPropagation()} />
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
              {allChecked ? "Deselect all" : "Select all"}
            </span>
            <span className="ml-auto text-[11px] text-[#94A3B8]">{selected.size} selected</span>
          </div>
        )}

        {/* Project list */}
        <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
          {loading ? (
            <div className="py-8 text-center text-[12px] text-[#94A3B8]">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#94A3B8]">No projects found</div>
          ) : visible.map(p => (
            <div key={p.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              onClick={() => toggle(p.id)}
            >
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                className="w-3.5 h-3.5 rounded accent-[#2563EB] cursor-pointer shrink-0"
                onClick={e => e.stopPropagation()} />
              <span className="text-[13px] text-[#0F172A] truncate">{p.name}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[#F1F5F9] bg-[#F8FAFC]">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-40">
            {saving ? "Saving…" : "Apply"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ── Invite form ───────────────────────────────────────────────
function InviteForm({
  roleOptions, projects, onInvite, onCancel,
}: {
  roleOptions: RoleOption[];
  projects: { id: string; name: string }[];
  onInvite: (name: string, email: string, role: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.name ?? "Member");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = roleOptions.find(r => r.name === role);
  const isWorkspaceWide = !!selectedRole?.isBuiltin;

  const toggleProject = (id: string) => setSelectedProjects(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedProjects.size === projects.length) setSelectedProjects(new Set());
    else setSelectedProjects(new Set(projects.map(p => p.id)));
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSending(true); setError("");
    try { await onInvite(name.trim(), email.trim(), role); onCancel(); }
    catch (e: any) { setError(e.message ?? "Failed to send invite"); setSending(false); }
  };

  return (
    <div className="mx-6 mb-4 bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <div className="text-[13px] font-semibold text-[#0F172A] mb-3">New Team Member</div>
        {error && <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmed Hassan"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all" />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ahmed@example.com"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all" />
          </div>
          <div className="w-56 shrink-0">
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Role</label>
            <RoleSelect value={role} roleOptions={roleOptions} onChange={r => { setRole(r); setSelectedProjects(new Set()); }} />
            {selectedRole && (
              <div className="mt-1.5 text-[11px] text-[#64748B] leading-snug">{selectedRole.description}</div>
            )}
          </div>
        </div>
      </div>

      {/* Project access section */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#FAFBFF]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[12px] font-semibold text-[#0F172A]">Project Access</div>
            <div className="text-[11px] text-[#64748B]">
              {isWorkspaceWide
                ? "This role has automatic access to all projects"
                : selectedProjects.size === 0
                  ? "Select which projects this member can access"
                  : `${selectedProjects.size} of ${projects.length} project${projects.length !== 1 ? "s" : ""} selected`}
            </div>
          </div>
          {!isWorkspaceWide && projects.length > 0 && (
            <button onClick={toggleAll} className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer">
              {selectedProjects.size === projects.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-[12px] text-[#94A3B8] py-2">No projects in this workspace yet.</div>
        ) : isWorkspaceWide ? (
          <div className="grid grid-cols-2 gap-1.5">
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                <Check size={11} className="text-[#059669] shrink-0" />
                <span className="text-[12px] text-[#065F46] font-medium truncate">{p.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {projects.map(p => {
              const checked = selectedProjects.has(p.id);
              return (
                <div key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    checked ? "bg-[#EFF6FF] border-[#BFDBFE]" : "bg-white border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleProject(p.id)}
                    className="w-3.5 h-3.5 rounded accent-[#2563EB] cursor-pointer shrink-0"
                    onClick={e => e.stopPropagation()} />
                  <span className={`text-[12px] font-medium truncate ${checked ? "text-[#1D4ED8]" : "text-[#475569]"}`}>{p.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {!isWorkspaceWide && selectedProjects.size === 0 && projects.length > 0 && (
          <div className="mt-2 text-[11px] text-[#F59E0B] flex items-center gap-1.5">
            <FolderOpen size={11} />
            No projects selected — member won't see any project until you assign them.
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3">
        <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={sending || !email.trim()}
          className="px-5 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {sending ? "Sending…" : "Add Member"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function TeamPage() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [tab, setTab] = useState<Tab>("team");

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [accessPopover, setAccessPopover] = useState<{ member: TeamMember; anchor: HTMLElement } | null>(null);
  const [copied, setCopied] = useState(false);

  // Roles state
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);

  // Projects (for invite form project picker)
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);

  // Fetch members
  useEffect(() => {
    if (wsLoading) return;
    if (!workspaceId) { setLoadingMembers(false); return; }
    setLoadingMembers(true);
    fetchTeamMembers(workspaceId).then(setMembers).catch(() => {}).finally(() => setLoadingMembers(false));
  }, [workspaceId, wsLoading]);

  // Fetch roles (always, so team tab role dropdown has live data)
  useEffect(() => {
    if (wsLoading) return;
    if (!workspaceId) return;
    setLoadingRoles(true);
    fetchRoles(workspaceId).then(setRoles).catch(() => {}).finally(() => setLoadingRoles(false));
  }, [workspaceId, wsLoading]);

  // Fetch projects for invite form
  useEffect(() => {
    if (wsLoading || !workspaceId) return;
    fetchProjects(workspaceId)
      .then(ps => setAllProjects(ps.map(p => ({ id: String(p.id), name: p.projectName ?? "" }))))
      .catch(() => {});
  }, [workspaceId, wsLoading]);

  const allRoleOptions: RoleOption[] = [
    ...BUILTIN_ROLES,
    ...roles.map(r => ({ name: r.name, description: r.description ?? "Custom role — see Roles tab for permissions." })),
  ];

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async (name: string, email: string, role: string) => {
    if (!workspaceId) return;
    await sendTeamInvite(email, name, role, workspaceId);
  };

  const handleCopyLink = async () => {
    if (!workspaceId) return;
    const url = await getTeamInviteLink(workspaceId);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    if (!workspaceId) return;
    await updateMemberRole(memberId, role, workspaceId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  };

  const handleRemove = async (memberId: string) => {
    if (!workspaceId) return;
    if (!confirm("Remove this member from the workspace?")) return;
    await removeTeamMember(memberId, workspaceId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleProjectsSaved = (userId: string, count: number) => {
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, projectCount: count } : m));
  };

  const handleCreateRole = async (name: string, desc: string, permissions: RolePermissions) => {
    if (!workspaceId) return;
    const created = await createRole({ workspaceId, name, description: desc, permissions });
    setRoles(prev => [...prev, created]);
    setShowNewRole(false);
  };

  const handleSaveRole = async (id: string, name: string, desc: string, permissions: RolePermissions) => {
    if (!workspaceId) return;
    const updated = await updateRole(id, { workspaceId, name, description: desc, permissions });
    setRoles(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleDeleteRole = async (id: string) => {
    if (!workspaceId || !confirm("Delete this role?")) return;
    await deleteRole(id, workspaceId);
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC]">
      {/* Page tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 flex items-center">
        {([["team", "Team & Access"], ["roles", "Roles"]] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 py-3.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ── */}
      {tab === "team" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 flex items-start justify-between">
            <div>
              <h1 className="text-[20px] font-semibold text-[#0F172A] tracking-tight">Manage your Team Roles and Accessibility</h1>
              <p className="text-[13px] text-[#64748B] mt-1">
                {loadingMembers ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""} in this workspace`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium text-[#475569] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy invite link"}
              </button>
              <button onClick={() => setShowInviteForm(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer">
                <Plus size={15} /> Add Member
              </button>
            </div>
          </div>

          {showInviteForm && (
            <InviteForm roleOptions={allRoleOptions} projects={allProjects} onInvite={handleInvite} onCancel={() => setShowInviteForm(false)} />
          )}

          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl bg-white w-72 shadow-sm">
              <Search size={14} className="text-[#94A3B8]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
                className="flex-1 bg-transparent text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none" />
              {search && <button onClick={() => setSearch("")}><X size={12} className="text-[#94A3B8]" /></button>}
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1fr_180px_160px_160px] gap-4 px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Name</div>
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Role</div>
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Access</div>
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Action</div>
              </div>

              {loadingMembers ? (
                <div className="py-14 text-center text-[13px] text-[#94A3B8]">Loading members…</div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-14 text-center">
                  <Users size={32} className="mx-auto mb-3 text-[#CBD5E1]" />
                  <div className="text-[14px] font-medium text-[#64748B]">{search ? "No members match your search" : "No team members yet"}</div>
                  {!search && <div className="text-[13px] text-[#94A3B8] mt-1">Invite someone to get started</div>}
                </div>
              ) : (
                filteredMembers.map((m, i) => {
                  const isSuperAdmin = ["super admin", "superadmin"].includes(m.role.toLowerCase());
                  const isWorkspaceWide = isSuperAdmin || m.role.toLowerCase() === "admin";
                  return (
                    <div key={m.id} className={`grid grid-cols-[1fr_180px_160px_160px] gap-4 px-5 py-4 items-center ${i < filteredMembers.length - 1 ? "border-b border-[#F1F5F9]" : ""} hover:bg-[#FAFBFF] transition-colors`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 select-none"
                          style={{ background: avatarColor(m.name) }}>
                          {nameInitials(m.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-[#0F172A] truncate">{m.name}</div>
                          <div className="text-[12px] text-[#94A3B8] truncate">{m.email}</div>
                        </div>
                        {m.status === "pending" && (
                          <span className="shrink-0 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-semibold uppercase">Pending</span>
                        )}
                      </div>
                      <div>
                        <RoleSelect value={m.role} roleOptions={allRoleOptions} onChange={role => handleRoleChange(m.id, role)} disabled={isSuperAdmin} />
                      </div>
                      <div>
                        {isWorkspaceWide ? (
                          <div className="flex items-center gap-1.5">
                            {isSuperAdmin ? <Crown size={12} className="text-[#7C3AED]" /> : <Shield size={12} className="text-[#2563EB]" />}
                            <div>
                              <div className="text-[13px] font-medium text-[#0F172A]">All projects</div>
                              <div className="text-[10px] text-[#94A3B8]">Workspace-wide</div>
                            </div>
                          </div>
                        ) : m.projectCount === 0 ? (
                          <button onClick={e => setAccessPopover({ member: m, anchor: e.currentTarget })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-[12px] font-semibold hover:bg-red-100 transition-colors cursor-pointer">
                            <FolderOpen size={12} /> Assign projects
                          </button>
                        ) : (
                          <button onClick={e => setAccessPopover({ member: m, anchor: e.currentTarget })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] rounded-lg text-[12px] font-semibold hover:bg-[#DBEAFE] transition-colors cursor-pointer">
                            <FolderOpen size={12} /> {m.projectCount} project{m.projectCount !== 1 ? "s" : ""}
                            <Pencil size={10} className="ml-0.5 opacity-60" />
                          </button>
                        )}
                      </div>
                      <div>
                        {!isSuperAdmin && (
                          <button onClick={() => handleRemove(m.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-[13px] font-medium hover:bg-red-50 transition-colors cursor-pointer">
                            Remove Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ROLES TAB ── */}
      {tab === "roles" && (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-[20px] font-semibold text-[#0F172A] tracking-tight">Define Roles & Permissions</h1>
              <p className="text-[13px] text-[#64748B] mt-1">
                Set what each role can view or edit across the platform. Assign roles to members in the Team tab.
              </p>
            </div>
            <button onClick={() => setShowNewRole(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer shrink-0">
              <Plus size={15} /> New Role
            </button>
          </div>

          {/* Built-in roles */}
          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Built-in Roles</div>
            <div className="grid grid-cols-2 gap-3">
              {BUILTIN_ROLES.map(r => (
                <div key={r.name} className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    {r.name === "Super Admin"
                      ? <Crown size={14} style={{ color: r.scopeColor }} />
                      : <Shield size={13} style={{ color: r.scopeColor }} />
                    }
                    <span className="text-[14px] font-semibold text-[#0F172A]">{r.name}</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.scopeBg, color: r.scopeColor }}>{r.scope}</span>
                  </div>
                  <p className="text-[12px] text-[#64748B] mb-3">{r.description}</p>
                  <ul className="space-y-1 mb-2">
                    {r.capabilities.map(c => (
                      <li key={c} className="flex items-center gap-1.5 text-[11px] text-[#475569]">
                        <Check size={10} className="text-[#059669] shrink-0" />{c}
                      </li>
                    ))}
                  </ul>
                  {r.cannotDo && (
                    <p className="text-[11px] text-[#94A3B8] mt-2 pt-2 border-t border-[#F1F5F9]">{r.cannotDo}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
              <p className="text-[12px] text-[#92400E] leading-relaxed">
                <span className="font-semibold">Workspace-wide roles</span> (Admin, Super Admin) see all projects automatically — no assignment needed. Use <span className="font-semibold">custom roles</span> below for members who should only access specific projects.
              </p>
            </div>
          </div>

          {showNewRole && (
            <NewRoleForm onCreate={handleCreateRole} onCancel={() => setShowNewRole(false)} />
          )}

          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Custom Roles <span className="normal-case font-normal text-[#CBD5E1]">· project-specific</span></div>

          {loadingRoles ? (
            <div className="py-14 text-center text-[13px] text-[#94A3B8]">Loading roles…</div>
          ) : roles.length === 0 && !showNewRole ? (
            <div className="py-10 text-center bg-white border border-dashed border-[#E2E8F0] rounded-xl">
              <Shield size={28} className="mx-auto mb-3 text-[#CBD5E1]" />
              <div className="text-[14px] font-medium text-[#64748B]">No custom roles yet</div>
              <div className="text-[13px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                Create a role to control what a member can see and do — they'll only access the projects you assign them.
              </div>
              <button onClick={() => setShowNewRole(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-[#2563EB] border border-[#2563EB]/30 bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors cursor-pointer">
                <Plus size={14} /> Create first role
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {roles.map(r => (
                <RoleCard
                  key={r.id}
                  role={r}
                  onSave={handleSaveRole}
                  onDelete={handleDeleteRole}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex items-center flex-wrap gap-4">
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Legend:</span>
            {LEVELS.map(l => (
              <div key={l.value} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: l.docsOnly ? "#7C3AED" : l.color }} />
                <span className="text-[12px] text-[#475569]">{l.label}{l.docsOnly ? " (documents only)" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {accessPopover && workspaceId && (
        <ProjectAccessPopover
          member={accessPopover.member}
          anchorEl={accessPopover.anchor}
          workspaceId={workspaceId}
          onClose={() => setAccessPopover(null)}
          onSaved={handleProjectsSaved}
        />
      )}
    </div>
  );
}
