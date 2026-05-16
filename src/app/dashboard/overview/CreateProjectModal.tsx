"use client";

import { useState, useEffect } from "react";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import type { Project } from "@/lib/mock-data";
import { useWorkspace } from "@/context/workspace";
import { createProject, updateProject } from "@/lib/api-client";

function parseIsoDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return "";
}

interface Props {
  onClose: () => void;
  onCreate: (project: Project) => void;
  editingProject?: Project;
  onUpdate?: (project: Project) => void;
}

export default function CreateProjectModal({ onClose, onCreate, editingProject, onUpdate }: Props) {
  const { workspaceId } = useWorkspace();
  const isEditing = !!editingProject;

  const [name, setName] = useState(editingProject?.name ?? "");
  const [address, setAddress] = useState(editingProject?.address ?? "");
  const [stage, setStage] = useState(editingProject?.stage ?? "Foundation");
  const [type, setType] = useState("Residential");
  const [startDate, setStartDate] = useState(parseIsoDate(editingProject?.startDate ?? ""));
  const [endDate, setEndDate] = useState(parseIsoDate(editingProject?.endDate ?? ""));
  const [code, setCode] = useState(editingProject?.code ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    if (name) {
      const words = name.trim().split(/\s+/);
      const initials = words.map((w) => w[0]?.toUpperCase()).join("").slice(0, 3);
      if (!code) setCode(`${initials}-2026-${String(Math.floor(Math.random() * 900) + 100)}`);
    }
  }, [name]);

  const fmt = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !startDate || !endDate || !code.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");

    if (isEditing && editingProject && workspaceId) {
      try {
        await updateProject(String(editingProject.id), {
          projectName: name.trim(),
          address: address.trim(),
          stage,
          category: type,
          startDate,
          endDate,
          projectCode: code.trim(),
        });
        onUpdate?.({
          ...editingProject,
          name: name.trim(),
          address: address.trim(),
          stage,
          code: code.trim(),
          startDate,
          endDate,
        });
        return;
      } catch (err: any) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    if (workspaceId) {
      try {
        const p = await createProject({
          workspaceId,
          projectName: name.trim(),
          projectCode: code.trim(),
          address: address.trim(),
          stage,
          category: type,
          startDate,
          endDate,
        });
        onCreate({
          id: p.id as any,
          name: p.projectName,
          code: p.projectCode ?? code.trim(),
          pct: 0,
          status: "notStarted",
          tasks: 0,
          tasksDone: 0,
          workers: 0,
          issues: 0,
          stage,
          startDate,
          endDate,
          address: address.trim(),
        });
        onClose();
        return;
      } catch (err: any) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    // Mock fallback
    onCreate({
      id: Date.now(),
      name: name.trim(),
      code: code.trim(),
      pct: 0,
      status: "notStarted",
      tasks: 0,
      tasksDone: 0,
      workers: 0,
      issues: 0,
      stage,
      startDate,
      endDate,
      address: address.trim(),
    });
    onClose();
  };

  const inputClass =
    "w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all";
  const labelClass = "block text-xs font-semibold text-[#475569] mb-1";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b1f2380] backdrop-blur-[2px]">
      <Card className="w-[480px] !p-8 shadow-2xl bg-white relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-[#94A3B8] hover:text-[#0F172A] transition-colors"
        >
          ✕
        </button>

        <SectionTitle className="!mb-1">{isEditing ? "Edit Project" : "Add New Project"}</SectionTitle>
        <p className="text-[13px] text-[#475569] mb-6">
          {isEditing ? "Update the project details below." : "Enter basic project details. You can edit these later."}
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Project Name *</label>
            <input autoFocus className={inputClass} placeholder="Al Nakheel Tower" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Project Address *</label>
            <input className={inputClass} placeholder="Dubai Marina, Dubai, UAE" value={address} onChange={e => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stage</label>
              <select className={inputClass} value={stage} onChange={e => setStage(e.target.value)}>
                {["Foundation", "Structure", "MEP", "Finishing", "Handover"].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={type} onChange={e => setType(e.target.value)}>
                {["Residential", "Commercial", "Mixed-Use", "Industrial"].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>End Date *</label>
              <input type="date" className={inputClass} value={endDate} min={startDate || undefined} onChange={e => setEndDate(startDate && e.target.value < startDate ? startDate : e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Project Code *</label>
            <input className={inputClass} placeholder="ANT-2026-001" value={code} onChange={e => setCode(e.target.value)} />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[#DC2626] font-semibold">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary className="px-6" onClick={handleSubmit} disabled={saving}>
            {saving ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Project →"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
