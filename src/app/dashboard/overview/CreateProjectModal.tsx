"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, SectionTitle, Btn } from "@/components/ui/bluq-ui";
import type { Project } from "@/lib/mock-data";
import { useWorkspace } from "@/context/workspace";
import { createProject, updateProject } from "@/lib/api-client";
import { CheckCircle2, MapPin } from "lucide-react";

function parseIsoDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return "";
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
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
  const [addressValidated, setAddressValidated] = useState(isEditing); // existing projects assumed valid
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [stage, setStage] = useState(editingProject?.stage ?? "Foundation");
  const [type, setType] = useState("Residential");
  const [startDate, setStartDate] = useState(parseIsoDate(editingProject?.startDate ?? ""));
  const [endDate, setEndDate] = useState(parseIsoDate(editingProject?.endDate ?? ""));
  const [code, setCode] = useState(editingProject?.code ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) return;
    if (name) {
      const words = name.trim().split(/\s+/);
      const initials = words.map((w) => w[0]?.toUpperCase()).join("").slice(0, 3);
      if (!code) setCode(`${initials}-2026-${String(Math.floor(Math.random() * 900) + 100)}`);
    }
  }, [name]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 4) { setSuggestions([]); setSuggestionsOpen(false); return; }
    setLoadingSuggestions(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
      const res = await fetch(url, { headers: { "Accept-Language": "en", "User-Agent": "BLUQ-ConstructionPM/1.0" } });
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setSuggestionsOpen(true); // always open — shows suggestions or "use as typed" fallback
    } catch {
      setSuggestions([]);
      setSuggestionsOpen(true);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setAddressValidated(false);
    setCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 500);
  };

  const selectSuggestion = (s: NominatimResult) => {
    setAddress(s.display_name);
    setCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
    setAddressValidated(true);
    setSuggestionsOpen(false);
    setSuggestions([]);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !startDate || !endDate || !code.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!addressValidated) {
      setError("Select a valid address from the suggestions — this is needed for weather data.");
      return;
    }
    setSaving(true);
    setError("");

    // If validated via "use as typed" (no coords), attempt geocoding one more time
    let resolvedCoords = coords;
    if (!resolvedCoords && address.trim().length >= 4) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "BLUQ-ConstructionPM/1.0" } }
        );
        const data: NominatimResult[] = await res.json();
        if (data[0]) resolvedCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      } catch { /* proceed without coords */ }
    }

    const settingsJson = resolvedCoords ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng } : undefined;

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
          ...(settingsJson ? { settingsJson } : {}),
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
          settingsJson,
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

          {/* Address with autocomplete */}
          <div ref={dropdownRef} className="relative">
            <label className={labelClass}>Project Address *</label>
            <div className="relative">
              <input
                className={`${inputClass} pr-8 ${addressValidated ? "border-[#059669] ring-[#059669]/20" : ""}`}
                placeholder="Start typing an address…"
                value={address}
                onChange={e => handleAddressChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
                autoComplete="off"
              />
              {addressValidated && (
                <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#059669]" />
              )}
              {loadingSuggestions && !addressValidated && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {suggestionsOpen && !loadingSuggestions && (
              <div className="absolute z-[200] left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-xl overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-[12px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-start gap-2 transition-colors border-b border-[#F1F5F9] last:border-0"
                  >
                    <MapPin size={11} className="text-[#94A3B8] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{s.display_name}</span>
                  </button>
                ))}
                {suggestions.length === 0 && (
                  <div className="px-3 py-2 border-b border-[#F1F5F9]">
                    <p className="text-[11px] text-[#94A3B8] mb-1.5">No suggestions found for this address.</p>
                    <button
                      type="button"
                      onMouseDown={() => { setAddressValidated(true); setCoords(null); setSuggestionsOpen(false); }}
                      className="text-[12px] font-semibold text-[#2563EB] hover:underline"
                    >
                      Use "{address}" as typed
                    </button>
                  </div>
                )}
              </div>
            )}
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
                {["Residential", "Commercial", "Mixed Use", "Industrial / Warehouse", "Road / Highway", "Railway / Metro", "Bridge / Flyover", "Tunnel"].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date *</label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                max={endDate || undefined}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate("");
                }}
              />
            </div>
            <div>
              <label className={labelClass}>End Date *</label>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
              />
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
