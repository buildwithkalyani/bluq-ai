"use client";
import React, { useState } from "react";
import { STATUS_CONFIG, type ProjectStatus } from "@/lib/mock-data";

// ─── STATUS BADGE ────────────────────────────────────────────
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────
export function ProgressBar({
  pct,
  status,
  height = 6,
}: {
  pct: number;
  status: ProjectStatus;
  height?: number;
}) {
  const color = STATUS_CONFIG[status]?.color || "#3A4EA2";
  return (
    <div
      className="bg-[#f0f1f3] rounded-full w-full overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-400"
        style={{ background: color, width: `${pct}%` }}
      />
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  color = "#3A4EA2",
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
      className={`bg-white border border-[#D0D7DE] rounded-lg p-4 text-center flex-1 min-w-[100px] ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <div className="text-[22px] font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-[#57606a] mt-1">{label}</div>
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
      className={`bg-white border border-[#D0D7DE] rounded-lg p-4 ${
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
        rounded-md font-semibold cursor-pointer transition-all
        ${small ? "px-3 py-1.5 text-xs" : "px-5 py-2 text-[13px]"}
        ${
          primary
            ? "bg-[#3A4EA2] text-white border-none hover:bg-[#0757b5]"
            : "bg-white text-[#24292f] border border-[#D0D7DE] hover:bg-[#f6f8fa]"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// ─── SECTION TITLE (Updated to accept className) ──────────────
export function SectionTitle({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <div className={`text-[15px] font-bold text-[#24292f] ${className}`}>
      {children}
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────
// ─── SELECT (Crash-Proof Version) ────────────────────────────
export function Select({
  label,
  options = [], // Safeguard 1: Defaults to an empty array if nothing is passed
  value,
  onChange,
}: {
  label: string;
  options?: string[]; // The '?' makes it optional so TypeScript won't yell
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="mb-3.5">
      <label className="block text-xs font-semibold text-[#57606a] mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%238C959F%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_12px_center] bg-no-repeat"
      >
        {/* Safeguard 2: Check if it's a valid array with items before mapping */}
        {Array.isArray(options) && options.length > 0 ? (
          options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))
        ) : (
          <option value="" disabled>
            No options available
          </option>
        )}
      </select>
    </div>
  );
}
// ─── UPDATED PROJECT SELECTOR in bluq-ui.tsx ─────────────────
export function ProjectSelector({
  selected,
  options = [],
  onSelect,
}: {
  selected: string;
  options: string[];
  onSelect: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false); // Changed from React.useState

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 border border-[#D0D7DE] rounded-md px-3 py-1.5 bg-white cursor-pointer text-[13px] font-semibold text-[#24292f] hover:bg-[#f6f8fa] transition-colors shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-[#3A4EA2]" />
        {selected}
        <span className="text-[#8C959F] text-[11px] ml-0.5">▾</span>
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#D0D7DE] rounded-md shadow-lg z-50 py-1">
             {/* ... mapping options ... */}
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
    <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE]">
      {options.map((o, i) => (
        <div
          key={i}
          onClick={() => onChange?.(i)}
          className={`px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
            i === active
              ? "bg-[#3A4EA2] text-white"
              : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"
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
    <div className="mb-3.5">
      <label className="block text-xs font-semibold text-[#57606a] mb-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent transition-all"
      />
    </div>
  );
}
