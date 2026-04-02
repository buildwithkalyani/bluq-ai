"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDelayRows,
  getDelayDeepDive,
  DelayRow,
  DelayDeepDive,
} from "@/lib/mock-data-extended";

const Card = ({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`bg-white border border-[#D0D7DE] rounded-lg p-4 ${className}`}
    style={style}
  >
    {children}
  </div>
);

const GroupToggle = ({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: number;
  onChange: (i: number) => void;
}) => (
  <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE]">
    {options.map((o, i) => (
      <div
        key={i}
        onClick={() => onChange(i)}
        className="px-3.5 py-1 text-xs font-semibold cursor-pointer"
        style={{
          background: i === active ? "#3A4EA2" : "#fff",
          color: i === active ? "#fff" : "#57606a",
        }}
      >
        {o}
      </div>
    ))}
  </div>
);

// ─── Data-driven AI Analysis Panel ─────────────────────────────────────────
function AIPanel({ data }: { data: DelayDeepDive }) {
  const borderColor = data.onCriticalPath ? "#CF222E" : "#1A7F37";
  return (
    <Card className="mb-3" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-[#24292f]">{data.title}</div>
        <span className="text-[11px] text-[#8C959F] font-mono">
          {data.contractor} &bull; {data.delayDays}
        </span>
      </div>

      <div className="mb-3.5">
        <div className="text-xs font-bold text-[#57606a] mb-1.5">
          DOWNSTREAM IMPACT
        </div>
        {data.downstreamImpact.length === 0 ? (
          <div className="text-xs text-[#1A7F37] font-semibold">
            ✓ No downstream impact — this task is not on the critical path.
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-xs text-[#57606a]">
            {data.downstreamImpact.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[#CF222E]">→</span> {d.task}{" "}
                <span className="font-mono text-[#CF222E] font-bold">
                  {d.days}
                  {d.cascading ? " (cascading)" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#0D1117] rounded-lg p-3.5 text-[#c9d1d9]">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="w-2 h-2 rounded-full bg-[#3FB950]"
            style={{ boxShadow: "0 0 6px #3FB950" }}
          />
          <span className="text-[11px] font-bold text-[#3FB950] font-mono tracking-wide">
            AI DELAY ANALYSIS
          </span>
        </div>

        <div className="mb-3">
          <div className="text-[11px] font-bold text-[#8b949e] mb-1">
            ROOT CAUSE
          </div>
          <div className="text-sm leading-relaxed">{data.rootCause}</div>
        </div>

        {data.patternDetected && (
          <div className="mb-3">
            <div className="text-[11px] font-bold text-[#8b949e] mb-1">
              PATTERN DETECTED
            </div>
            <div className="text-sm leading-relaxed">
              {data.patternDetected}
              {data.supplierReliability && (
                <>
                  {" "}
                  Supplier reliability score:{" "}
                  <span className="text-[#CF222E] font-bold">
                    {data.supplierReliability}
                  </span>
                  .
                </>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] font-bold text-[#3FB950] mb-1">
            RECOMMENDED ACTIONS
          </div>
          <div className="text-sm leading-relaxed space-y-1">
            {data.recommendations.map((r, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-[#3FB950] shrink-0">{i + 1}.</span>
                <span>
                  <strong className="text-[#f0f6fc]">{r.action}</strong> —{" "}
                  {r.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DelayAnalyticsPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState(0);
  const [rows, setRows] = useState<DelayRow[]>([]);
  const [deepDive, setDeepDive] = useState<DelayDeepDive | null>(null);

  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");
  const prevProjectId = useRef(projectId);

  // Fetch rows when projectId changes — auto-select first row
  useEffect(() => {
    const projectChanged = prevProjectId.current !== projectId;
    prevProjectId.current = projectId;

    getDelayRows(projectId).then((data) => {
      setRows(data);
      // Auto-select the first row (or null if no delays for this project)
      if (projectChanged || selected === null) {
        setSelected(data.length > 0 ? data[0].id : null);
      }
    });
  }, [projectId]);

  // Fetch deep dive when selection changes
  useEffect(() => {
    if (selected === null) {
      setDeepDive(null);
      return;
    }
    getDelayDeepDive(selected).then((d) => setDeepDive(d ?? null));
  }, [selected]);

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex justify-between mb-3">
        {/* Left: Title */}
        <div className="flex items-center gap-4">
          <div className="text-[15px] font-bold text-[#24292f]">
            Delay Analytics
          </div>
        </div>

        {/* Right: Toggles */}
        <GroupToggle
          options={["By Contractor", "By Space"]}
          active={groupBy}
          onChange={setGroupBy}
        />
      </div>

      {/* Project Deadline at Risk banner */}
      <Card
        className="mb-3.5 !py-3.5 !px-4 flex items-center justify-between"
        style={{ borderLeft: "4px solid #CF222E" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#ffebe9] flex items-center justify-center text-lg shrink-0">
            ⚠
          </div>
          <div>
            <div className="text-sm font-bold text-[#CF222E]">
              Project Deadline at Risk
            </div>
            <div className="text-xs text-[#57606a] mt-0.5">
              Based on current delays, the predicted end date has shifted.
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-2">
            <div className="text-center">
              <div className="text-[10px] text-[#8C959F] font-semibold">
                PLANNED
              </div>
              <div className="text-sm font-bold text-[#57606a] font-mono">
                Apr 30
              </div>
            </div>
            <span className="text-base text-[#CF222E]">→</span>
            <div className="text-center">
              <div className="text-[10px] text-[#CF222E] font-semibold">
                PREDICTED
              </div>
              <div className="text-sm font-bold text-[#CF222E] font-mono">
                May 8
              </div>
            </div>
          </div>
          <div className="text-[11px] font-bold text-[#CF222E] font-mono mt-1">
            +8 days slippage
          </div>
        </div>
      </Card>

      {/* Delay Table */}
      <Card className="!p-0 overflow-hidden mb-3.5">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#f6f8fa] border-b border-[#e1e4e8]">
              {[
                groupBy === 0 ? "Contractor" : "Space",
                "Delayed Tasks",
                "Avg Delay",
                "Most Critical",
                "Deadline Impact",
              ].map((h, i) => (
                <th
                  key={i}
                  className="px-2.5 py-2 text-left font-bold text-[#57606a] text-[11px]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2.5 py-6 text-center text-sm text-[#8C959F]">
                  No delays found for this project.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    setSelected(selected === r.id ? null : r.id)
                  }
                  className="border-b border-[#f0f1f3] cursor-pointer transition-colors"
                  style={{
                    background:
                      selected === r.id ? "#ddf4ff" : "transparent",
                  }}
                >
                  <td className="px-2.5 py-2.5 font-semibold">
                    <span
                      className="mr-1.5"
                      style={{
                        color:
                          selected === r.id ? "#3A4EA2" : "#8C959F",
                      }}
                    >
                      {selected === r.id ? "▾" : "▸"}
                    </span>
                    {r.name}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className="bg-[#ffebe9] text-[#CF222E] font-bold px-2 py-0.5 rounded font-mono">
                      {r.count}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 font-mono">{r.avg}</td>
                  <td className="px-2.5 py-2.5">{r.critical}</td>
                  <td
                    className="px-2.5 py-2.5 font-bold font-mono"
                    style={{
                      color:
                        r.impact === "None" ? "#1A7F37" : "#CF222E",
                    }}
                  >
                    {r.impact}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* AI Detail Panel for selected row */}
      {deepDive && <AIPanel data={deepDive} />}
    </div>
  );
}
