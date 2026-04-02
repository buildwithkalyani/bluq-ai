"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getScheduleTasks,
  getScheduleDeps,
  STATUS_CONFIG,
  type ScheduleTask,
  type TaskDependency,
} from "@/lib/mock-data";
import {
  Card,
  StatusBadge,
  SectionTitle,
  Btn,
} from "@/components/ui/bluq-ui";

export default function ListViewPage() {
const [tasks, setTasks] = useState<ScheduleTask[]>([]);
const [deps, setDeps] = useState<TaskDependency[]>([]);
const [selectedTask, setSelectedTask] = useState<string | null>(null);
const selectedTaskData = tasks.find(t => t.id === selectedTask) ?? null;
  
  // Toolbar State (Project state removed, relying on global layout)
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<"contractor" | "space">("contractor");
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("projectId") ?? "0");
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "",
    startDate: "",
    endDate: "",
    dependencies: [] as string[],
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([getScheduleTasks(projectId), getScheduleDeps(projectId)]).then(([t, d]) => {
      setTasks(t);
      setDeps(d);
      setLoading(false);
      setSelectedTask(null);
    });
  }, [projectId]);

  // Dynamic Search Filter
  const filteredTasks = tasks.filter((t) => {
    const query = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.contractor.toLowerCase().includes(query) ||
      t.space.toLowerCase().includes(query)
    );
  });

  // Dynamic Grouping Logic
  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const key = groupMode === "contractor" ? task.contractor : task.space;
    const safeKey = key || "Unassigned"; 
    
    if (!acc[safeKey]) acc[safeKey] = [];
    acc[safeKey].push(task);
    return acc;
  }, {} as Record<string, ScheduleTask[]>);

  // Sort the group headers alphabetically
  const groupKeys = Object.keys(groupedTasks).sort();

  // Helper for averages
  const avgPct = (arr: ScheduleTask[]) =>
    arr.length ? Math.round(arr.reduce((s, t) => s + t.pct, 0) / arr.length) : 0;

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-36 bg-[#f0f1f3] rounded" />
          <div className="h-[400px] bg-[#f0f1f3] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full bg-[#f6f8fa]">
      {/* Dynamic Header & Toolbar */}
      <div className="flex justify-between items-center mb-4">
        
        {/* Left: Title (Dropdown Removed) */}
        <div className="flex items-center gap-4">
          <SectionTitle>Task List</SectionTitle>
        </div>

        {/* Right: Search, Group Toggle, and Add Button */}
        <div className="flex gap-3 items-center">
          {/* Search */}
          <div className="flex items-center gap-2 border border-[#D0D7DE] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#3A4EA2] focus-within:ring-1 focus-within:ring-[#3A4EA2] transition-all">
            <span className="text-[12px] text-[#8C959F]">🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[13px] text-[#24292f] placeholder:text-[#8C959F] border-none outline-none bg-transparent w-40"
            />
          </div>

          {/* Custom Group Toggle */}
          <div className="inline-flex rounded-md overflow-hidden border border-[#D0D7DE] shadow-sm">
            <button
              onClick={() => setGroupMode("contractor")}
              className={`px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                groupMode === "contractor" ? "bg-[#3A4EA2] text-white" : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"
              }`}
            >
              By Contractor
            </button>
            <button
              onClick={() => setGroupMode("space")}
              className={`px-4 py-1.5 text-[12px] font-semibold transition-colors border-l border-[#D0D7DE] ${
                groupMode === "space" ? "bg-[#3A4EA2] text-white" : "bg-white text-[#57606a] hover:bg-[#f6f8fa]"
              }`}
            >
              By Space
            </button>
          </div>

          <Btn small primary onClick={() => setIsModalOpen(true)}>
            + Add Task
          </Btn>
        </div>
      </div>

      {/* Dynamic Table */}
      <Card className="p-0 overflow-hidden shadow-sm border-[#D0D7DE]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#f6f8fa] border-b border-[#e1e4e8]">
              {[
                "Task Name",
                "Contractor",
                "Space",
                "Start",
                "End",
                "%",
                "Status",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left font-bold text-[#57606a] text-[11px] uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Render Groups Dynamically */}
            {groupKeys.length > 0 ? (
              groupKeys.map((groupName) => (
                <div key={groupName} className="contents">
                  {/* Dynamic Group Header */}
                  <tr className="bg-[#f0f1f3] border-b border-[#e1e4e8]">
                    <td colSpan={8} className="px-4 py-2 font-bold text-[#24292f]">
                      ▾ {groupName}{" "}
                      <span className="text-[#8C959F] font-normal ml-2 text-[11px]">
                        — Avg Progress: {avgPct(groupedTasks[groupName])}%
                      </span>
                    </td>
                  </tr>
                  {/* Tasks inside this group */}
                  {groupedTasks[groupName].map((t) => (
                    <TaskRow
                      key={t.id}
                      t={t}
                      selected={selectedTask === t.id}
                      onClick={() =>
                        setSelectedTask(selectedTask === t.id ? null : t.id)
                      }
                    />
                  ))}
                </div>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[#57606a]">
                  No tasks match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Side Panel */}
{selectedTaskData && (
  <div className="fixed right-0 top-0 h-full w-[320px] bg-white border-l border-[#D0D7DE] shadow-xl z-40 flex flex-col">
    <div className="p-4 border-b border-[#D0D7DE] flex justify-between items-start">
      <div>
        <div className="text-[13px] font-semibold text-[#24292f]">{selectedTaskData.name}</div>
        <div className="text-[11px] text-[#8C959F] mt-0.5">{selectedTaskData.contractor} · {selectedTaskData.space}</div>
      </div>
      <button onClick={() => setSelectedTask(null)} className="text-[#8C959F] hover:text-[#24292f]">✕</button>
    </div>

    {selectedTaskData.photos?.[0] && (
      <div className="px-4 pt-4">
        <img src={selectedTaskData.photos[0]} alt="Site" className="w-full h-40 object-cover rounded-lg" />
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Status</div>
        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: `${STATUS_CONFIG[selectedTaskData.status].color}18`, color: STATUS_CONFIG[selectedTaskData.status].color }}>
          {STATUS_CONFIG[selectedTaskData.status].label}
        </span>
      </div>

      <div>
        <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Progress</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[#e1e4e8] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${selectedTaskData.pct}%`, background: STATUS_CONFIG[selectedTaskData.status].color }} />
          </div>
          <span className="text-[12px] font-bold font-mono" style={{ color: STATUS_CONFIG[selectedTaskData.status].color }}>{selectedTaskData.pct}%</span>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Schedule</div>
        <div className="text-[12px] text-[#24292f]">{selectedTaskData.startDate} → {selectedTaskData.endDate}</div>
        <div className="text-[11px] text-[#8C959F] mt-0.5">Duration: {selectedTaskData.duration}</div>
        {selectedTaskData.delay && (
          <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#ffebe9", color: "#CF222E" }}>{selectedTaskData.delay}</span>
        )}
      </div>

      <div>
        <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Critical Path</div>
        <span className={`text-[11px] font-semibold ${selectedTaskData.critical ? "text-[#CF222E]" : "text-[#8C959F]"}`}>
          {selectedTaskData.critical ? "⚠ On Critical Path" : "Not on critical path"}
        </span>
      </div>

      {deps.filter(d => d.to === selectedTaskData.id).length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Predecessors</div>
          {deps.filter(d => d.to === selectedTaskData.id).map((d, i) => (
            <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#f0f1f3]">
              <span className="text-[#24292f]">{tasks.find(t => t.id === d.from)?.name}</span>
              <span className="text-[#8C959F] font-mono">({d.type})</span>
            </div>
          ))}
        </div>
      )}

      {deps.filter(d => d.from === selectedTaskData.id).length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[#8C959F] uppercase mb-1">Successors</div>
          {deps.filter(d => d.from === selectedTaskData.id).map((d, i) => (
            <div key={i} className="flex justify-between text-[11px] py-1 border-b border-[#f0f1f3]">
              <span className="text-[#24292f]">{tasks.find(t => t.id === d.to)?.name}</span>
              <span className="text-[#8C959F] font-mono">({d.type})</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="p-4 border-t border-[#D0D7DE] flex gap-2">
      <button
        onClick={() => {
          setNewTask({
            name: selectedTaskData.name,
            startDate: selectedTaskData.startDate,
            endDate: selectedTaskData.endDate,
            dependencies: deps.filter(d => d.to === selectedTaskData.id).map(d => d.from),
          });
          setIsModalOpen(true);
        }}
        className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#ddf4ff] border border-[#3A4EA2] text-[#3A4EA2] hover:bg-[#b6e3ff] transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => {
          if (window.confirm(`Delete "${selectedTaskData.name}"?`)) {
            setTasks(prev => prev.filter(t => t.id !== selectedTaskData.id));
            setDeps(prev => prev.filter(d => d.from !== selectedTaskData.id && d.to !== selectedTaskData.id));
            setSelectedTask(null);
          }
        }}
        className="flex-1 py-1.5 text-[12px] font-semibold rounded-md bg-[#ffebe9] border border-[#CF222E] text-[#CF222E] hover:bg-[#ffc1bd] transition-colors"
      >
        Delete
      </button>
    </div>
  </div>
)}

      {/* --- CREATE TASK MODAL OVERLAY --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#e1e4e8]">
              <h2 className="text-lg font-bold text-[#24292f]">Create Task</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-[#57606a] hover:text-[#24292f] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] transition-all"
                />
              </div>

              {/* Dates Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Start (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={newTask.startDate}
                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] transition-all text-[#24292f]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">End (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={newTask.endDate}
                    onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] transition-all text-[#24292f]"
                  />
                </div>
              </div>

              {/* Dependencies List */}
              <div>
                <label className="block text-[11px] font-bold text-[#57606a] mb-1.5 uppercase tracking-wider">Dependencies</label>
                <div className="border border-[#D0D7DE] rounded-md p-2 h-40 overflow-y-auto bg-[#fafbfc]">
                  {tasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-[#f0f1f3] rounded cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={newTask.dependencies.includes(t.id)}
                        onChange={(e) => {
                          const updatedDeps = e.target.checked
                            ? [...newTask.dependencies, t.id]
                            : newTask.dependencies.filter((id) => id !== t.id);
                          setNewTask({ ...newTask, dependencies: updatedDeps });
                        }}
                        className="rounded border-[#D0D7DE] text-[#3A4EA2] focus:ring-[#3A4EA2]"
                      />
                      <span className="text-[13px] text-[#24292f] select-none">{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-[#e1e4e8] bg-[#f6f8fa] flex justify-end gap-2.5">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 text-[13px] font-semibold text-[#24292f] bg-white border border-[#D0D7DE] rounded-md hover:bg-[#f6f8fa] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Saving Task:", newTask);
                  setIsModalOpen(false);
                  setNewTask({ name: "", startDate: "", endDate: "", dependencies: [] });
                }}
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#3A4EA2] rounded-md hover:bg-[#0353A4] transition-colors shadow-sm"
              >
                Save
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function TaskRow({
  t,
  selected,
  onClick,
}: {
  t: ScheduleTask;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-[#f0f1f3] cursor-pointer transition-colors group ${
        selected ? "bg-[#ddf4ff]" : "bg-white hover:bg-[#f6f8fa]"
      }`}
    >
      <td className="px-4 py-3 font-semibold">
        <span className={selected ? "text-[#3A4EA2]" : "text-[#24292f]"}>
          {t.name}
        </span>
        {t.delay && (
          <span
            className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
            style={{
              backgroundColor: t.status === "delayed" ? "#ffebe9" : "#fff8c5",
              color: t.status === "delayed" ? "#CF222E" : "#9A6700",
            }}
          >
            {t.delay}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[#57606a]">{t.contractor}</td>
      <td className="px-4 py-3 text-[#57606a]">{t.space}</td>
      <td className="px-4 py-3 font-mono text-[11px] text-[#57606a]">{t.startDate}</td>
      <td className="px-4 py-3 font-mono text-[11px] text-[#57606a]">{t.endDate}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-[#e1e4e8] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
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
      <td className="px-4 py-3">
        <StatusBadge status={t.status} />
      </td>
      <td className="px-4 py-3 text-[#8C959F] text-right group-hover:text-[#24292f]">⋮</td>
    </tr>
  );
}