"use client";

import { useEffect, useState } from "react";
import {
  getProjects,
  STATUS_CONFIG,
  type Project,
} from "@/lib/mock-data";
import {
  Card,
  MetricCard,
  StatusBadge,
  ProgressBar,
  SectionTitle,
  Btn,
} from "@/components/ui/bluq-ui";
import ProjectDetailView from "./ProjectDetailView";
import CreateProjectModal from "./CreateProjectModal";
import { useWorkspace } from "@/context/workspace";
import { fetchProjects } from "@/lib/api-client";

export default function OverviewPage() {
  const { workspaceId, loading: wsLoading, isDesignMode } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (wsLoading) return; // wait for workspace to resolve

    if (workspaceId && !isDesignMode) {
      // Real backend
      fetchProjects(workspaceId)
        .then((rows) => {
          setProjects(
            rows.map((p) => ({
              id: p.id as any,
              name: p.projectName,
              code: p.projectCode ?? "",
              pct: Number(p.percentComplete ?? 0),
              status: "notStarted" as const,
              tasks: 0,
              tasksDone: 0,
              workers: 0,
              issues: 0,
              stage: p.stage ?? "",
              startDate: p.startDate ?? "",
              endDate: p.endDate ?? "",
              address: p.address ?? "",
            }))
          );
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (isDesignMode) {
      // Design account — always mock
      getProjects().then((data) => {
        setProjects(data);
        setLoading(false);
      });
    }
  }, [workspaceId, wsLoading, isDesignMode]);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject =
    selectedProjectId === null
      ? null
      : projects.find((p) => p.id === selectedProjectId) ?? null;

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-[#f0f1f3] rounded" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-20 bg-[#f0f1f3] rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-[#f0f1f3] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full relative">
      {selectedProjectId !== null ? (
        selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            onBack={() => setSelectedProjectId(null)}
            wrapperClassName="max-w-7xl mx-auto"
          />
        ) : (
          <div className="p-10 text-center">
            <h2 className="text-xl font-bold">Loading...</h2>
          </div>
        )
      ) : (
        <>
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Projects Dashboard</SectionTitle>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 border border-[#D0D7DE] rounded-md px-2.5 py-1.5 bg-white min-w-[180px]">
                <span className="text-[13px]">🔍</span>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs text-[#24292f] placeholder:text-[#8C959F] border-none outline-none bg-transparent w-full"
                />
              </div>
              <Btn primary small onClick={() => setIsCreateModalOpen(true)}>
                + New Project
              </Btn>
            </div>
          </div>

          {/* ── Summary Metrics ── */}
          <div className="flex gap-3 mb-4">
            <MetricCard label="Total Projects" value={projects.length} />
            <MetricCard
              label="On Track"
              value={projects.filter((p) => p.status === "inProgress").length}
              color="#1A7F37"
            />
            <MetricCard
              label="At Risk"
              value={projects.filter((p) => p.status === "runningLate").length}
              color="#9A6700"
            />
            <MetricCard
              label="Delayed"
              value={projects.filter((p) => p.status === "delayed").length}
              color="#CF222E"
            />
          </div>

          {/* ── Project Grid ── */}
          {filtered.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-5xl mb-4">🏗️</div>
                <div className="text-sm font-bold text-[#24292f] mb-1">
                  {search ? "No projects match your search" : "No projects yet"}
                </div>
                {!search && (
                  <Btn primary onClick={() => setIsCreateModalOpen(true)}>
                    + Create Your First Project
                  </Btn>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {filtered.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className="cursor-pointer hover:shadow-md transition-all relative overflow-hidden group"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[3.5px]"
                    style={{ background: STATUS_CONFIG[p.status].color }}
                  />

                  <div className="flex justify-between items-start mb-2.5 mt-1">
                    <div>
                      <div className="text-[15px] font-bold text-[#24292f] leading-tight group-hover:text-[#3A4EA2] transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-[#8C959F] font-mono mt-0.5">
                        {p.code} • {p.startDate} → {p.endDate}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <ProgressBar pct={p.pct} status={p.status} />
                    <span
                      className="text-[13px] font-bold font-mono min-w-[36px] text-right"
                      style={{ color: STATUS_CONFIG[p.status].color }}
                    >
                      {p.pct}%
                    </span>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f6f8fa] text-[11px] text-[#57606a] border border-[#e1e4e8]">
                      👷 <span className="font-semibold text-[#24292f]">{p.workers}</span> on-site
                    </span>

                    {p.issues > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#fff8c5] text-[11px] text-[#9A6700] font-semibold border border-[#d4a72c30]">
                        🔔 {p.issues} unresolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#dafbe1] text-[11px] text-[#1A7F37] font-semibold border border-[#1a7f3720]">
                        ✓ No issues
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#8C959F] mt-3 flex items-center gap-1 border-t border-[#f0f1f3] pt-2">
                    📍 {p.address}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Trigger */}
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(project) => {
            setProjects(prev => [...prev, project]);
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}