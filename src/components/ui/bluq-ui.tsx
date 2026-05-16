"use client";
import React, { useState } from "react";
import { STATUS_CONFIG, type ProjectStatus } from "@/lib/mock-data";

// ─── STATUS BADGE ────────────────────────────────────────────
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.05em]"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────
export function ProgressBar({
  pct,
  status,
  height = 5,
}: {
  pct: number;
  status: ProjectStatus;
  height?: number;
}) {
  const color = STATUS_CONFIG[status]?.color || "#2563EB";
  return (
    <div className="bg-[#E2E8F0] rounded-full w-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ background: color, width: `${pct}%` }}
      />
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  color = "#2563EB",
  onClick,
}: {
  label: string;
  value: string | number;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F0] rounded-xl p-5 flex-1 min-w-[100px] shadow-sm ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <div
        className="text-[28px] font-bold tracking-tight"
        style={{ color, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#94A3B8] uppercase tracking-[0.06em] font-semibold mt-1.5">
        {label}
      </div>
    </div>
  );
}

// ─── CARD ────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────
export function Btn({
  children,
  primary,
  small,
  className = "",
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  primary?: boolean;
  small?: boolean;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer transition-all
        ${small ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"}
        ${
          primary
            ? "bg-[#2563EB] text-white border border-[#2563EB] hover:bg-[#1D4ED8] hover:border-[#1D4ED8]"
            : "bg-white text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// ─── SECTION TITLE ───────────────────────────────────────────
export function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-[18px] font-semibold tracking-tight text-[#0F172A] ${className}`}>
      {children}
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────
export function Select({
  label,
  options = [],
  value,
  onChange,
}: {
  label: string;
  options?: string[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394A3B8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_12px_center] bg-no-repeat transition-colors"
      >
        {Array.isArray(options) && options.length > 0 ? (
          options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))
        ) : (
          <option value="" disabled>No options available</option>
        )}
      </select>
    </div>
  );
}

// ─── PROJECT SELECTOR ────────────────────────────────────────
export function ProjectSelector({
  selected,
  options: _options = [],
  onSelect: _onSelect,
}: {
  selected: string;
  options: string[];
  onSelect: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white cursor-pointer text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
        {selected}
        <span className="text-[#94A3B8] text-[11px] ml-0.5">▾</span>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1.5">
          </div>
        </>
      )}
    </div>
  );
}

// ─── GROUP TOGGLE ────────────────────────────────────────────
export function GroupToggle({
  options = ["By Contractor", "By Space"],
  active = 0,
  onChange,
}: {
  options?: string[];
  active?: number;
  onChange?: (i: number) => void;
}) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC]">
      {options.map((o, i) => (
        <div
          key={i}
          onClick={() => onChange?.(i)}
          className={`px-3.5 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors ${
            i === active
              ? "bg-[#2563EB] text-white"
              : "bg-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-white"
          }`}
        >
          {o}
        </div>
      ))}
    </div>
  );
}

// ─── INPUT ───────────────────────────────────────────────────
export function Input({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mb-1.5">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
      />
    </div>
  );
}
