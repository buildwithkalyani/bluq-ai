"use client";

import { useState } from "react";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import type { Project } from "@/lib/mock-data";

interface Props {
  onClose: () => void;
  onCreate: (project: Project) => void;
}

export default function CreateProjectModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [stage, setStage] = useState("Foundation");
  const [type, setType] = useState("Residential");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim() || !address.trim() || !startDate || !endDate || !code.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (endDate <= startDate) {
      setError("End date must be after start date.");
      return;
    }

    const fmt = (d: string) => {
      const dt = new Date(d);
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

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
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      address: address.trim(),
    });

    onClose();
  };

  const inputClass =
    "w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent transition-all";
  const labelClass = "block text-xs font-semibold text-[#57606a] mb-1";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b1f2380] backdrop-blur-[2px]">
      <Card className="w-[480px] !p-8 shadow-2xl bg-white relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-[#8C959F] hover:text-[#24292f] transition-colors"
        >
          ✕
        </button>

        <SectionTitle className="!mb-1">Add New Project</SectionTitle>
        <p className="text-[13px] text-[#57606a] mb-6">
          Enter basic project details. You can edit these later in settings.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Project Name *</label>
            <input className={inputClass} placeholder="Al Nakheel Tower" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Project Address *</label>
            <input className={inputClass} placeholder="Dubai Marina, Dubai, UAE" value={address} onChange={e => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stage *</label>
              <select className={inputClass} value={stage} onChange={e => setStage(e.target.value)}>
                {["Foundation", "Structure", "MEP", "Finishing", "Handover"].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Type *</label>
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
              <input type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Project Code *</label>
            <input className={inputClass} placeholder="ANT-2026-001" value={code} onChange={e => setCode(e.target.value)} />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[#CF222E] font-semibold">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary className="px-6" onClick={handleCreate}>Create Project →</Btn>
        </div>
      </Card>
    </div>
  );
}
