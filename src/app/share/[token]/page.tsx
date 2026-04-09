"use client";

import { useEffect, useState } from "react";
import {
  getProjects,
  getScheduleTasks,
  getAnalytics,
  STATUS_CONFIG,
  type Project,
  type ScheduleTask,
  type AnalyticsData,
} from "@/lib/mock-data";
import {
  Card,
  MetricCard,
  StatusBadge,
  ProgressBar,
} from "@/components/ui/bluq-ui";

export default function ShareTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, _setInvalid] = useState(false);

  useEffect(() => {
    // TODO: Replace with actual share token validation
    // const data = await fetch(`/api/share/${params.token}`).then(r => r.json());
    // if (!data.valid) { setInvalid(true); return; }

    Promise.all([getProjects(), getScheduleTasks(0), getAnalytics(0)]).then(
      ([projects, t, a]) => {
        setProject(projects[0]); // Mock: always show first project
        setTasks(t);
        setAnalytics(a);
        setLoading(false);
      }
    );
  }, [params.token]);

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8fa]">
        <Card className="w-[400px] p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <div className="text-base font-bold text-[#24292f] mb-2">
            Invalid or Expired Link
          </div>
          <div className="text-[13px] text-[#57606a]">
            This share link is no longer valid. Please contact the project owner
            for a new link.
          </div>
        </Card>
      </div>
    );
  }

  if (loading || !project || !analytics) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] p-6">
        <div className="animate-pulse space-y-4 max-w-6xl mx-auto">
          <div className="h-8 w-64 bg-[#f0f1f3] rounded" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-20 bg-[#f0f1f3] rounded-lg" />
            ))}
          </div>
          <div className="h-[400px] bg-[#f0f1f3] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      {/* Shared view banner */}
      <div className="bg-[#0D1117] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-extrabold text-[#3A4EA2] tracking-tight">
            BLUQ
          </span>
          <span className="text-[#30363d]">|</span>
          <span className="text-sm font-semibold">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3FB950]" />
          <span className="text-xs text-[#8b949e]">
            Read-only view • Shared link
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Project header */}
        <div className="mb-4">
          <div className="text-xl font-bold text-[#24292f]">{project.name}</div>
          <div className="text-xs text-[#8C959F] font-mono mt-1">
            {project.code} • {project.startDate} → {project.endDate} •{" "}
            {project.address}
          </div>
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 mb-5">
          <MetricCard
            label="Overall Progress"
            value={`${project.pct}%`}
            color={STATUS_CONFIG[project.status].color}
          />
          <MetricCard
            label="Tasks at Risk"
            value={analytics.tasksAtRisk}
            color="#CF222E"
          />
          <MetricCard
            label="Schedule Variance"
            value={`${analytics.scheduleVarianceDays}d`}
            color="#CF222E"
          />
          <MetricCard
            label="Workers On-Site"
            value={project.workers}
            color="#3A4EA2"
          />
        </div>

        {/* Progress bar */}
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#57606a]">
              OVERALL PROGRESS
            </span>
            <span
              className="text-sm font-bold font-mono"
              style={{ color: STATUS_CONFIG[project.status].color }}
            >
              {project.pct}%
            </span>
          </div>
          <ProgressBar pct={project.pct} status={project.status} height={10} />
        </Card>

        {/* Task table (read-only) */}
        <Card className="!p-0 overflow-hidden mb-5">
          <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#e1e4e8]">
            <span className="text-xs font-bold text-[#57606a] tracking-wider">
              SCHEDULE
            </span>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#f6f8fa] border-b border-[#e1e4e8]">
                {["Task", "Contractor", "Duration", "Progress", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left font-bold text-[#57606a] text-[11px]"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-[#f0f1f3]">
                  <td className="px-4 py-2.5 font-semibold">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                        style={{
                          background: STATUS_CONFIG[t.status].color,
                        }}
                      />
                      {t.name}
                      {t.critical && (
                        <span className="text-[9px] font-bold text-[#CF222E] bg-[#ffebe9] px-1 py-0.5 rounded font-mono">
                          CRIT
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#57606a]">
                    {t.contractor}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[#57606a]">
                    {t.startDate} → {t.endDate}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#f0f1f3] rounded h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${t.pct}%`,
                            background: STATUS_CONFIG[t.status].color,
                          }}
                        />
                      </div>
                      <span
                        className="font-mono font-bold text-[11px]"
                        style={{ color: STATUS_CONFIG[t.status].color }}
                      >
                        {t.pct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Footer */}
        <div className="text-center text-[11px] text-[#8C959F] mt-8 pb-6">
          Powered by{" "}
          <span className="font-bold text-[#3A4EA2]">BLUQ</span> •
          Project intelligence for construction
        </div>
      </div>
    </div>
  );
}
