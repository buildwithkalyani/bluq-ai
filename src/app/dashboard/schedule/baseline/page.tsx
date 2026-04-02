"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getScheduleTasks,
  STATUS_CONFIG,
  type ScheduleTask,
} from "@/lib/mock-data";
import { Card, GroupToggle } from "@/components/ui/bluq-ui";

export default function BaselineActualPage() {
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState(0);
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");
  
  useEffect(() => {
    setLoading(true);
    getScheduleTasks(projectId).then((t) => {
      setTasks(t);
      setLoading(false);
    });
  }, [projectId]);

  // Sort tasks alphabetically based on the selected grouping to keep the list organized
  const sortedTasks = [...tasks].sort((a, b) => {
    const valA = groupBy === 0 ? a.contractor : a.space;
    const valB = groupBy === 0 ? b.contractor : b.space;
    return valA.localeCompare(valB);
  });

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-[#f0f1f3] rounded" />
          <div className="h-[400px] bg-[#f0f1f3] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa]">
      <div className="flex justify-between items-center mb-4">
        {/* Left: Title */}
        <div className="flex items-center gap-4">
          <div className="text-[15px] font-bold text-[#24292f]">Baseline vs Actual</div>
        </div>

        {/* Right: Grouping Toggles */}
        <GroupToggle 
          options={["By Contractor", "By Space"]} 
          active={groupBy} 
          onChange={setGroupBy} 
        />
      </div>

      <Card className="p-4 shadow-sm border-[#D0D7DE]">
        {sortedTasks.length === 0 ? (
          <div className="text-sm text-[#8C959F] py-4 text-center">No tasks available for this project.</div>
        ) : (
          sortedTasks.map((t, i) => {
            // Safely mock a baseline if it's not explicitly in your ScheduleTask interface yet
            const baseline = (t as any).baseline ?? Math.min(100, t.pct + (t.status === 'delayed' || t.status === 'runningLate' ? 15 : -5));
            const actual = t.pct;
            const variance = actual - baseline;
            const statusConfig = STATUS_CONFIG[t.status] || { color: "#8C959F" };

            return (
              <div key={t.id} className="py-3.5" style={{ borderBottom: i < sortedTasks.length - 1 ? "1px solid #e1e4e8" : "none" }}>
                
                {/* Task Header & Variance */}
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[#24292f]">
                    {t.name} <span className="text-[#8C959F] font-normal">— {groupBy === 0 ? t.contractor : t.space}</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: variance >= 0 ? "#1A7F37" : "#CF222E" }}>
                    {variance > 0 ? "+" : ""}{variance}% variance
                  </span>
                </div>

                {/* Baseline Bar */}
                <div className="flex gap-2 items-center mb-1.5">
                  <span className="text-[10px] text-[#8C959F] w-14 font-mono uppercase tracking-wider">Baseline</span>
                  <div className="flex-1 bg-[#f0f1f3] rounded h-2 overflow-hidden">
                    <div className="h-full rounded opacity-50" style={{ width: `${baseline}%`, background: "#8C959F" }} />
                  </div>
                  <span className="text-[11px] font-mono text-[#8C959F] w-8 text-right">{baseline}%</span>
                </div>

                {/* Actual Bar */}
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-[#8C959F] w-14 font-mono uppercase tracking-wider">Actual</span>
                  <div className="flex-1 bg-[#f0f1f3] rounded h-2 overflow-hidden shadow-sm">
                    <div className="h-full rounded transition-all duration-500" style={{ width: `${actual}%`, background: statusConfig.color }} />
                  </div>
                  <span className="text-[11px] font-mono font-bold w-8 text-right" style={{ color: statusConfig.color }}>{actual}%</span>
                </div>

              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}