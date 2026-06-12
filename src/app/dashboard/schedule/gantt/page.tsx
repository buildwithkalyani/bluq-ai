"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from 'react';
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getScheduleTasks, getScheduleDeps, type ScheduleTask, type TaskDependency } from "@/lib/mock-data";
import { fetchTasks, fetchTaskDependencies, createTaskDependency, deleteTaskDependency, fetchLatestScheduleVersion, isRealProject, updateTask, createTask, fetchProject, type ScheduleVersion } from "@/lib/api-client";
import { GapCheckPanel, type SuspectedGap } from "@/components/ui/GapCheckPanel";
import { useWorkspace } from "@/context/workspace";
import { useActivityFeed } from "@/context/activity-feed";
import { usePermissions } from "@/context/permissions";
import { useTaskSocket } from "@/hooks/useTaskSocket";

// ─────────────────────────────────────────────────────────────
// Data & Types
// ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  completed:   { color: "#22c55e", label: "Completed" },
  inProgress:  { color: "#3b82f6", label: "In progress" },
  runningLate: { color: "#d97706", label: "Running late" },
  delayed:     { color: "#ef4444", label: "Delayed" },
  notStarted:  { color: "#6366f1", label: "Not started" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;
type StatusFilter = StatusKey | "All" | "atRisk";

interface ActivityUpdate {
  id: string;
  source: "whatsapp" | "email" | "manual";
  from: string;
  timeAgo: string;
  message: string;
  impact: string;
  severity: "fresh" | "warning" | "neutral";
  taskId?: string;
}

// Mock recent activity — wire up to real socket/API in production.
// Use useTaskSocket payloads or fetch from /api/activity endpoint.
const SAMPLE_ACTIVITY: ActivityUpdate[] = [
  { id: "a1", source: "whatsapp", from: "Rajesh K.",  timeAgo: "4m", message: "column casting done, slab tomorrow morning", impact: "Foundation → 55%",      severity: "fresh" },
  { id: "a2", source: "whatsapp", from: "Site photo", timeAgo: "2h", message: "rain delay, no work today on east wing",     impact: "Foundation +3d slip",   severity: "warning" },
  { id: "a3", source: "email",    from: "Priya (PM)", timeAgo: "5h", message: "steel delivery confirmed for 12th",          impact: "Structure on track",    severity: "neutral" },
  { id: "a4", source: "whatsapp", from: "Arvind",     timeAgo: "1d", message: "MEP rough-in starts Monday with 4-man crew", impact: "MEP scheduled",         severity: "neutral" },
];

const ROW_H = 48;
const GROUP_H = 36;
const AREA_H = 28;
const HEADER_H = 44;
const SUB_ROW_H = 36;

// Ordered list covering building + all infra project types.
// Phases present in a schedule are filtered from this list at render time.
const PHASE_ORDER = [
  // Pre-construction (all types)
  "Surveys & Investigations",
  "Regulatory Approvals",
  "Land Acquisition",
  "Site Preparation",
  "Earthworks",
  "Civil & Earthworks",
  // Tunnel underground works
  "Portal Works",
  "Tunnel Excavation",
  "Primary Support",
  "Waterproofing & Lining",
  // Foundation / substructure
  "Foundation",
  "Foundation & Piling",
  "Reclamation",
  // Marine / offshore
  "Marine Works",
  "Marine Structures",
  "Quay & Berth",
  // Building structure
  "Structure",
  "Substructure",
  "Superstructure",
  // Rail / transit
  "Viaduct",
  "Rail Infrastructure",
  "Rail Siding",
  "Bridges & Culverts",
  "Stations",
  "Track Works",
  "Signalling & Telecom",
  "Traction & Power",
  "Depot",
  // Pavement / roads
  "Runway & Taxiway",
  "Pavement",
  "Pavement & Yard",
  "Yard & Pavement",
  "Road Connectivity",
  "Road / Rail Finishing",
  // Storage & processing
  "Storage Tanks",
  "Pipeline & Piping",
  "Civil Structures",
  // Buildings & facilities
  "Terminal Buildings",
  "Terminal Building",
  "Warehouse & Sheds",
  "Warehousing & Sheds",
  "Customs Facilities",
  "Intermodal Yard",
  // MEP & technical systems
  "MEP & Safety",
  "MEP",
  "Mechanical Equipment",
  "Piping & Valves",
  "Fire & Safety Systems",
  "Electrical & Instrumentation",
  "Systems & E&M",
  "Systems & Technology",
  "Systems & Gate",
  "ATC Facilities",
  // Equipment
  "Equipment Installation",
  "Navigational Aids",
  // Civil finishes & safety
  "Structures",
  "Deck & Finishes",
  "Approaches",
  "Drainage & Invert",
  "Drainage",
  "Perimeter & Security",
  "Safety & Furniture",
  "Toll & ITS",
  "Utilities",
  // Finishing & handover
  "Finishing",
  "Testing & Commissioning",
  "Commissioning & Handover",
  "Handover",
];

// Fixed accent colors per phase — shown as a left-edge color strip on group headers.
// Building phases use neutral tones; infra phases use bolder, domain-specific colors.
const PHASE_COLOR_MAP: Record<string, string> = {
  // Pre-construction
  "Surveys & Investigations":   "#64748B",
  "Regulatory Approvals":       "#E11D48",
  "Land Acquisition":           "#DC2626",
  "Site Preparation":           "#64748B",
  "Earthworks":                 "#B45309",
  "Civil & Earthworks":         "#B45309",
  // Tunnel
  "Portal Works":               "#78716C",
  "Tunnel Excavation":          "#92400E",
  "Primary Support":            "#475569",
  "Waterproofing & Lining":     "#4B5563",
  // Foundation
  "Foundation":                 "#78716C",
  "Foundation & Piling":        "#78716C",
  "Reclamation":                "#D97706",
  // Marine
  "Marine Works":               "#0369A1",
  "Marine Structures":          "#0369A1",
  "Quay & Berth":               "#0891B2",
  // Structure
  "Structure":                  "#2563EB",
  "Substructure":               "#1D4ED8",
  "Superstructure":             "#4338CA",
  "Viaduct":                    "#6D28D9",
  // Rail
  "Rail Infrastructure":        "#334155",
  "Rail Siding":                "#334155",
  "Bridges & Culverts":         "#7C3AED",
  "Stations":                   "#4338CA",
  "Track Works":                "#1E293B",
  "Signalling & Telecom":       "#6D28D9",
  "Traction & Power":           "#F97316",
  "Depot":                      "#4B5563",
  // Runway / pavement / road
  "Runway & Taxiway":           "#4338CA",
  "Pavement":                   "#374151",
  "Pavement & Yard":            "#374151",
  "Yard & Pavement":            "#374151",
  "Road Connectivity":          "#374151",
  "Road / Rail Finishing":      "#374151",
  // Storage
  "Storage Tanks":              "#C2410C",
  "Pipeline & Piping":          "#0F766E",
  "Civil Structures":           "#1D4ED8",
  // Buildings / facilities
  "Terminal Buildings":         "#7C3AED",
  "Terminal Building":          "#7C3AED",
  "Warehouse & Sheds":          "#B45309",
  "Warehousing & Sheds":        "#B45309",
  "Customs Facilities":         "#DC2626",
  "Intermodal Yard":            "#374151",
  // MEP / systems
  "MEP & Safety":               "#0F766E",
  "MEP":                        "#0F766E",
  "Mechanical Equipment":       "#C2410C",
  "Piping & Valves":            "#0F766E",
  "Fire & Safety Systems":      "#B91C1C",
  "Electrical & Instrumentation":"#6D28D9",
  "Systems & E&M":              "#6D28D9",
  "Systems & Technology":       "#6D28D9",
  "Systems & Gate":             "#059669",
  "ATC Facilities":             "#6D28D9",
  // Equipment
  "Equipment Installation":     "#C2410C",
  "Navigational Aids":          "#2563EB",
  // Civil finishes
  "Structures":                 "#1D4ED8",
  "Deck & Finishes":            "#7C3AED",
  "Approaches":                 "#475569",
  "Drainage & Invert":          "#0891B2",
  "Drainage":                   "#0891B2",
  "Perimeter & Security":       "#475569",
  "Safety & Furniture":         "#CA8A04",
  "Toll & ITS":                 "#059669",
  "Utilities":                  "#0891B2",
  // Finishing / handover
  "Finishing":                  "#7C3AED",
  "Testing & Commissioning":    "#059669",
  "Commissioning & Handover":   "#059669",
  "Handover":                   "#059669",
};

const DEFAULT_PHASE_COLOR = "#94A3B8";

const PHASE_KEYWORDS: [string, string[]][] = [
  // Building phases
  ["Site Preparation", ["site survey","demarcation","layout","site clearing","clearing","grubbing","excavation","earthwork","dewatering","temporary fencing","temporary office","site office","mobilisation","mobilization","hoarding"]],
  ["Foundation", ["bored pile","driven pile","footing","foundation","raft","plinth","grade beam","pile cap","underpinning","anti-termite","damp proof"]],
  ["Structure", ["column","beam","slab","rcc","rc ","reinforced concrete","reinforcement","rebar","formwork","shuttering","centering","casting","concreting","structural wall","core wall","shear wall","lift core","staircase","lintel","sunshade","parapet"]],
  ["MEP", ["plumbing","sanitary","water supply","fire fighting","fire sprinkler","electrical","wiring","conduit","switchboard","panel","mep","hvac","air conditioning","duct","ductwork","ventilation","elevator","lift installation","escalator","bms"]],
  ["Finishing", ["plaster","plastering","render","paint","putty","tile","tiling","flooring","marble","granite","vitrified","false ceiling","gypsum","drywall","partition","interior","waterproof","waterproofing","cladding","facade","glazing","aluminium","aluminum","window","door","carpentry","woodwork","cabinet","railing","handrail","landscaping","finishing"]],
  ["Handover", ["snag","snagging","defect","punch list","punch","completion"]],
  // Infra — pre-construction
  ["Surveys & Investigations", ["survey","hydrographic","bathymetric","geotechnical","investigation","eia","environmental impact","soil test","bore log"]],
  ["Regulatory Approvals", ["peso","pngrb","oisd","cbic","gazette","licence","approval","hazop","feed","dpr","detailed project report","noc","clearance"]],
  ["Land Acquisition", ["land acquisition","larr","land award","land possession","revenue","compensation","resettlement","r&r","sarfaesi","demarcation"]],
  ["Earthworks", ["earthwork","earthfill","embankment","cut and fill","grading","subgrade","compaction","lime treatment"]],
  ["Civil & Earthworks", ["earthwork","earthfill","embankment","compaction","grading"]],
  // Marine
  ["Marine Works", ["dredg","breakwater","quay","berth","marine","cofferdam","reclamation","piling marine","wharf"]],
  ["Marine Structures", ["jetty","trestle","dolphin","mooring","fender","berthing","offshore pile","marine pile"]],
  ["Quay & Berth", ["quay","berth","copng","fender","bollard"]],
  // Structure / infra structure
  ["Foundation & Piling", ["pile","piling","well foundation","caisson","pile cap"]],
  ["Substructure", ["pier","abutment","substructure","pier cap","well cap"]],
  ["Superstructure", ["girder","span","deck","launching","erection","balanced cantilever","cable stayed","truss","steel superstructure"]],
  ["Viaduct", ["viaduct","elevated","precast segmental","u-girder","box girder elevated"]],
  // Rail / transit
  ["Rail Infrastructure", ["rail track","railway track","rail siding","rail link","mor","last mile rail","ballast","sleeper","fish plate"]],
  ["Rail Siding", ["rail siding","siding","wagon","locomotive","track yard"]],
  ["Bridges & Culverts", ["minor bridge","major bridge","culvert","rob","rub","road over bridge","road under bridge","viaduct rail","railway bridge","psc girder","steel truss bridge","well foundation railway"]],
  ["Stations", ["station","station box","concourse","platform","cut and cover station","station building","passenger amenity","pab","fob","foot over bridge"]],
  ["Track Works", ["track laying","track alignment","traction","third rail","overhead catenary","ohe","ballast laying","psc sleeper","lwr","long welded rail","flash butt","thermit weld","tamping","dtm","track geometry"]],
  ["Signalling & Telecom", ["electronic interlocking","ei installation","relay interlocking","colour light signal","axle counter","track circuit","abs","automatic block","ofc","optical fibre","telecom","rdso signal","signal commissioning"]],
  ["Traction & Power", ["ohe mast","ohe wiring","catenary","contact wire","traction substation","tss","switching station","25kv","overhead electrification","cea clearance","electric traction"]],
  ["Depot", ["depot","rolling stock","stabling","maintenance shed","loco shed","running room","crew lobby"]],
  // Runway / road
  ["Runway & Taxiway", ["runway","taxiway","apron","pcn","pavement classification","runway marking","tora","toda"]],
  ["Pavement", ["pavement","bm layer","dbm","bituminous","gsb","wbm","granular sub base","pqc","dry lean concrete","dlc","road surface"]],
  ["Pavement & Yard", ["pavement","yard paving","concrete pavement","pcc","rigid pavement","yard surface"]],
  ["Road Connectivity", ["road","approach road","internal road","rcc road","flexibility pavement","road widening"]],
  // Storage / processing
  ["Storage Tanks", ["storage tank","ast","api 650","floating roof","fixed roof","bullet","sphere","mounded","tank farm","bund wall","dyke"]],
  ["Pipeline & Piping", ["pipeline","piping","manifold","loading arm","submarine pipe","underground pipe","vapor recovery","vru","fire line","header"]],
  ["Civil Structures", ["clarifier","sedimentation","filtration","flocculation","aeration tank","sump","pump house","civil structure"]],
  // Facilities
  ["Terminal Buildings", ["terminal building","cfs building","transit shed","admin block","terminal","cargo shed"]],
  ["Terminal Building", ["terminal building","passenger terminal","terminal","airport terminal"]],
  ["Warehouse & Sheds", ["warehouse","shed","peb","pre-engineered","cold storage","reefer","godown"]],
  ["Warehousing & Sheds", ["warehouse","transit shed","cfs","container freight","customs shed","examination shed"]],
  ["Customs Facilities", ["customs","examination","x-ray","scanner","cbic","bonded","icegate"]],
  ["Intermodal Yard", ["container yard","cy","stacking","rtg","rmg","reach stacker","fork lift","intermodal"]],
  // MEP / systems
  ["Mechanical Equipment", ["pump","compressor","blower","aeration","diffuser","membrane","mbr","filter media","mechanical equipment","vaporiser","loading arm install"]],
  ["Piping & Valves", ["piping","valves","gate valve","butterfly valve","pipe laying","flanged joint","pressure test"]],
  ["Fire & Safety Systems", ["firewater","foam","fire ring main","fds","gas detection","esd","emergency shutdown","safety valve","fire suppression"]],
  ["Electrical & Instrumentation", ["scada","instrumentation","plc","dcs","cable tray","earthing","bonding","hazardous area","atex","metering","flow meter","custody transfer"]],
  ["Systems & E&M", ["signaling","cbtc","traction power","overhead equipment","signalling","trackside","communication system metro"]],
  ["Systems & Technology", ["tos","wms","tms","erp","software","gate management","rfid","weighbridge"]],
  ["Systems & Gate", ["gate","rfid gate","boom barrier","weigh bridge","truck","tms","tos","icegate integration"]],
  ["ATC Facilities", ["atc","air traffic control","ils","instrument landing","dvor","ndb","approach lighting","papi","reil","vhf","radar"]],
  // Equipment
  ["Equipment Installation", ["sts crane","rtg install","rmg install","reach stacker","forklift","gantry crane","hoist","material handling","equipment erection"]],
  ["Navigational Aids", ["navigational aid","aids to navigation","aton","buoy","lighthouse","channel marker","vts","vessel traffic"]],
  // Tunnel
  ["Portal Works", ["portal","portal face","portal headwall","approach cutting","wingwall","adit","launch shaft","tbm launch"]],
  ["Tunnel Excavation", ["tunnel excavation","natm","drill blast","drill and blast","tbm","tunnel boring","cut and cover","face advance","mucking","spoil disposal","geological mapping","probe drilling","cross-passage"]],
  ["Primary Support", ["rock bolt","shotcrete","steel rib","lattice girder","primary support","h-frame","instrumentation convergence","extensometer","geotechnical monitoring"]],
  ["Waterproofing & Lining", ["waterproof membrane","hdpe membrane","drainage fleece","secondary lining","cast in situ lining","travelling formwork","contact grouting","pressure tunnel","steel liner"]],
  ["Drainage & Invert", ["invert concrete","invert slab","side drainage channel","sump","dewatering pump","penstock","surge shaft"]],
  ["MEP & Safety", ["jet fan","ventilation shaft","tunnel lighting","led luminaire","fire detection","deluge","water mist","scada tunnel","tms","sos telephone","pa system","cctv tunnel","electrification tunnel","ohe tunnel","hydromechanical"]],
  ["Road / Rail Finishing", ["carriageway pavement","anti-skid","road marking tunnel","signage tunnel","track laying tunnel","ballasted track tunnel","slab track tunnel","tunnel finishing"]],
  // Infra finishes / handover
  ["Deck & Finishes", ["deck slab","wearing coat","waterproofing deck","expansion joint","crash barrier","approach slab"]],
  ["Approaches", ["approach road","approach embankment","approach viaduct","ramp"]],
  ["Drainage", ["drainage","storm water","culvert","cross drain","side drain","box drain","soakage pit"]],
  ["Perimeter & Security", ["perimeter wall","boundary wall","fencing","cctv","access control","security","boom gate","perimeter"]],
  ["Safety & Furniture", ["guard rail","crash barrier","road marking","signage","signboard","delineator","rumble strip","road furniture"]],
  ["Toll & ITS", ["toll","fas tag","its","variable message","electronic toll","plaza","toll gantry"]],
  ["Utilities", ["utility","power supply","hv line","transformer","substation","water supply","overhead tank","stp on site","sewage"]],
  // Commissioning
  ["Testing & Commissioning", ["testing","commissioning","trial run","trial","functional test","integration test","cmrs","dgca","oisd audit","peso final","crs inspection","morth safety audit","hydraulic pressure test","fire noc tunnel","emergency response drill"]],
  ["Commissioning & Handover", ["commissioning","handover","certificate","completion","noc","final inspection","handover","punch list","first product","first train","first flight","tunnel readiness certificate","operational handover"]],
];

function detectPhase(name: string): string {
  const lower = name.toLowerCase();
  for (const [phase, kws] of PHASE_KEYWORDS) {
    if (kws.some(kw => lower.includes(kw))) return phase;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────
// Date Math Utilities
// ─────────────────────────────────────────────────────────────
const MS_PER_DAY = 86400000;
const parseDate = (d: string) => new Date(d).getTime();
const diffDays = (d1: string, d2: string) => Math.round((parseDate(d2) - parseDate(d1)) / MS_PER_DAY);
const addDays = (d: string, days: number) => {
  const date = new Date(parseDate(d) + days * MS_PER_DAY);
  return date.toISOString().split("T")[0];
};
const formatDateStr = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ─────────────────────────────────────────────────────────────
// Critical Path Calculation
// ─────────────────────────────────────────────────────────────
function calculateCriticalPath(tasks: ScheduleTask[], deps: TaskDependency[]): Set<string> {
  if (tasks.length === 0) return new Set();
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const graph: Record<string, string[]> = {};
  const durationMap = new Map(tasks.map(t => [t.id, diffDays(t.startDate, t.endDate)]));

  tasks.forEach(t => { graph[t.id] = []; });
  deps.forEach(dep => { if (graph[dep.from]) graph[dep.from].push(dep.to); });

  const memo = new Map<string, number>();
  function longestPathFrom(taskId: string): number {
    if (memo.has(taskId)) return memo.get(taskId)!;
    let max = durationMap.get(taskId) || 0;
    for (const nextId of graph[taskId] || []) {
      max = Math.max(max, (durationMap.get(taskId) || 0) + longestPathFrom(nextId));
    }
    memo.set(taskId, max);
    return max;
  }

  let maxTotalDuration = -1;
  let startTaskId: string | null = null;
  tasks.forEach(task => {
    const pathLength = longestPathFrom(task.id);
    if (pathLength > maxTotalDuration) {
      maxTotalDuration = pathLength;
      startTaskId = task.id;
    }
  });

  const criticalTasks = new Set<string>();
  let current: string | null = startTaskId;
  while (current !== null) {
    criticalTasks.add(current);
    const successors = deps.filter(d => d.from === current);
    if (successors.length === 0) break;
    let bestNext: string | null = null;
    let bestLength = -1;
    for (const succ of successors) {
      const remainingLength = longestPathFrom(succ.to);
      if (remainingLength > bestLength) {
        bestLength = remainingLength;
        bestNext = succ.to;
      }
    }
    if (bestNext === null) break;
    current = bestNext;
  }
  return criticalTasks;
}

// ─────────────────────────────────────────────────────────────
// Slip detection — drives the reoptimize banner
// ─────────────────────────────────────────────────────────────
interface SlipSummary {
  slippedTasks: ScheduleTask[];
  worstSlipDays: number;
  affectedPhases: string[];
}
function detectSlip(tasks: ScheduleTask[]): SlipSummary {
  const today = new Date().toISOString().split("T")[0];
  const slipped = tasks.filter(t => {
    if (t.status === "completed") return false;
    if (t.status === "delayed" || t.status === "runningLate") return true;
    // Schedule-driven slip: end date passed but task not done
    return parseDate(t.endDate) < parseDate(today) && t.pct < 100;
  });
  const worstSlipDays = slipped.reduce((max, t) => {
    const daysLate = parseDate(t.endDate) < parseDate(today) ? diffDays(t.endDate, today) : 0;
    return Math.max(max, daysLate);
  }, 0);
  const affectedPhases = Array.from(new Set(slipped.map(t => t.phase || "Other")));
  return { slippedTasks: slipped, worstSlipDays, affectedPhases };
}

// ─────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────
const effectiveStatus = (t: { status: string; pct: number; endDate?: string; startDate?: string }): StatusKey => {
  if (t.status === "completed") return "completed";
  const today = new Date().toISOString().split("T")[0];
  if (t.endDate && t.pct < 100 && t.endDate < today) return "delayed";
  if (t.status === "notStarted" && t.pct > 0) return "inProgress";
  return t.status as StatusKey;
};

// ─────────────────────────────────────────────────────────────
// Live Status Pill — communicates the "live" product positioning
// ─────────────────────────────────────────────────────────────
function LiveStatusPill({ lastUpdate }: { lastUpdate: ActivityUpdate | null }) {
  if (!lastUpdate) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#64748B] text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
        No recent updates
      </div>
    );
  }
  const sourceLabel = lastUpdate.source === "whatsapp" ? "WhatsApp" : lastUpdate.source === "email" ? "Email" : "Manual";
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-medium border border-green-100">
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-green-400 opacity-75 animate-ping" />
        <span className="relative w-2 h-2 rounded-full bg-green-500" />
      </span>
      Live · updated {lastUpdate.timeAgo} ago via {sourceLabel}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reoptimize Banner — appears when slip is detected
// ─────────────────────────────────────────────────────────────
function ReoptimizeBanner({
  slipSummary,
  totalTasks,
  onReoptimize,
  onDismiss,
}: {
  slipSummary: SlipSummary;
  totalTasks: number;
  onReoptimize: () => void;
  onDismiss: () => void;
}) {
  const { slippedTasks, worstSlipDays, affectedPhases } = slipSummary;
  if (slippedTasks.length === 0) return null;
  const phaseStr = affectedPhases.slice(0, 2).join(", ") + (affectedPhases.length > 2 ? `, +${affectedPhases.length - 2} more` : "");
  return (
    <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.732 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-amber-900 truncate">
            {slippedTasks.length} of {totalTasks} tasks slipping — worst: {worstSlipDays}d late in {phaseStr}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5 truncate">
            Auto-detected from recent updates. Re-sequencing can recover lost time.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onReoptimize}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
          Reoptimize
        </button>
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded-md"
          title="Dismiss"
        >✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Activity Feed — collapsible right-side panel showing WhatsApp/email updates
// ─────────────────────────────────────────────────────────────
function ActivityFeed({ updates, onClose, onTaskFocus }: { updates: ActivityUpdate[]; onClose: () => void; onTaskFocus: (taskId: string) => void }) {
  const sourceIcon = (s: ActivityUpdate["source"]) => {
    if (s === "whatsapp") {
      return (
        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
        </svg>
      );
    }
    if (s === "email") {
      return (
        <svg className="w-3 h-3 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      );
    }
    return null;
  };
  const borderColor = (sev: ActivityUpdate["severity"]) => sev === "fresh" ? "border-green-500" : sev === "warning" ? "border-amber-500" : "border-[#CBD5E1]";
  const impactColor = (sev: ActivityUpdate["severity"]) => sev === "fresh" ? "text-green-700" : sev === "warning" ? "text-amber-700" : "text-[#64748B]";

  return (
    <div className="w-[260px] border-l border-[#E2E8F0] flex flex-col shrink-0 bg-[#F8FAFC] h-full">
      <div className="px-3 py-2.5 border-b border-[#E2E8F0] bg-white flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1E293B]">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-green-500" />
          </span>
          Live activity
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-sm" title="Hide activity feed">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {updates.length === 0 && (
          <div className="text-[11px] text-[#94A3B8] text-center py-6">No updates yet. Updates from WhatsApp and email will appear here in real time.</div>
        )}
        {updates.map(u => (
          <div
            key={u.id}
            className={`pl-2.5 border-l-2 ${borderColor(u.severity)} cursor-pointer hover:bg-white rounded-r p-1 transition-colors`}
            onClick={() => u.taskId && onTaskFocus(u.taskId)}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {sourceIcon(u.source)}
              <span className="font-semibold text-[11px] text-[#1E293B]">{u.from}</span>
              <span className="text-[10px] text-[#94A3B8]">{u.timeAgo}</span>
            </div>
            <div className="italic text-[11px] text-[#475569] leading-snug mb-1">"{u.message}"</div>
            <div className={`text-[10px] font-medium ${impactColor(u.severity)}`}>→ {u.impact}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gantt Row — with baseline ghost bar
// ─────────────────────────────────────────────────────────────
function GanttRow({ t, selected, chartStart, pixelsPerDay, onSelect, onUpdateDates, isOnCriticalPath, showCriticalPath, onStartConnection, onDropConnection, onDropEndpointMove, drawingDep, movingDep, showBaseline, rowAbsoluteY }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef({ mode: "move", startX: 0, initStart: "", initEnd: "" });
  const isSubTask = !!t.parentTaskId;
  const rowH = isSubTask ? SUB_ROW_H : ROW_H;
  const barTop = isSubTask ? 9 : 11;
  const barH = isSubTask ? 18 : 26;

  const leftPx = diffDays(chartStart, t.startDate) * pixelsPerDay;
  const widthPx = Math.max(4, diffDays(t.startDate, t.endDate) * pixelsPerDay);
  const opacity = showCriticalPath && !isOnCriticalPath ? 0.35 : 1;

  // Baseline (if present) — graceful fallback to current dates when absent.
  const baselineStart = (t as any).baselineStartDate || t.startDate;
  const baselineEnd   = (t as any).baselineEndDate   || t.endDate;
  const baselineLeftPx  = diffDays(chartStart, baselineStart) * pixelsPerDay;
  const baselineWidthPx = Math.max(4, diffDays(baselineStart, baselineEnd) * pixelsPerDay);
  const hasBaselineVariance = baselineStart !== t.startDate || baselineEnd !== t.endDate;

  const handleMouseDown = (mode: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { mode, startX: e.clientX, initStart: t.startDate, initEnd: t.endDate };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - dragRef.current.startX) / pixelsPerDay);
      let ns = dragRef.current.initStart, ne = dragRef.current.initEnd;
      if (dragRef.current.mode === "move") { ns = addDays(ns, delta); ne = addDays(ne, delta); }
      else if (dragRef.current.mode === "left") { ns = addDays(ns, delta); if (parseDate(ns) >= parseDate(ne)) ns = addDays(ne, -1); }
      else if (dragRef.current.mode === "right") { ne = addDays(ne, delta); if (parseDate(ne) <= parseDate(ns)) ne = addDays(ns, 1); }
      onUpdateDates(t.id, ns, ne);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging, t, onUpdateDates, pixelsPerDay]);

  const sc = STATUS_CONFIG[effectiveStatus(t)];
  const isCrit = showCriticalPath && isOnCriticalPath;
  const barColor = isCrit ? "#ef4444" : sc.color;
  const showPorts = hovered || !!drawingDep || !!movingDep;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseUp={(e) => {
        if (drawingDep && drawingDep.fromId !== t.id) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const barCenter = leftPx + widthPx / 2;
          onDropConnection && onDropConnection(t.id, mx < barCenter ? "start" : "end");
          return;
        }
        if (movingDep) { onDropEndpointMove && onDropEndpointMove(t.id); }
      }}
      className={`flex border-b border-[#E2E8F0] cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-[#F8FAFC]"}`}
      style={{ height: rowH, width: "100%", opacity }}
    >
      <div className="relative w-full h-full">
        {/* Baseline ghost bar — sits behind, dashed */}
        {showBaseline && hasBaselineVariance && (
          <div
            className="absolute pointer-events-none rounded-[5px]"
            style={{
              top: barTop - 2,
              left: baselineLeftPx,
              width: baselineWidthPx,
              height: 6,
              border: "1px dashed #94a3b8",
              background: "#f1f5f9",
            }}
            title={`Baseline: ${formatDateStr(baselineStart)} → ${formatDateStr(baselineEnd)}`}
          />
        )}

        {/* Left port — large hit area, visible on hover */}
        <div
          style={{ position: "absolute", top: barTop - 4, left: leftPx - 14, width: 24, height: barH + 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "crosshair", zIndex: 20, opacity: showPorts ? 1 : 0, pointerEvents: showPorts ? "all" : "none", transition: "opacity 0.12s" }}
          onMouseDown={e => { e.stopPropagation(); onStartConnection && onStartConnection(t.id, "start", leftPx, (rowAbsoluteY ?? 0) + barTop + barH / 2); }}
          onMouseUp={e => { e.stopPropagation(); if (drawingDep && drawingDep.fromId !== t.id) { onDropConnection && onDropConnection(t.id, "start"); } else if (movingDep) { onDropEndpointMove && onDropEndpointMove(t.id); } }}
        >
          <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2.5px solid ${barColor}`, background: "white", boxShadow: `0 0 0 2px white, 0 1px 4px rgba(0,0,0,0.18)` }} />
        </div>

        {/* Bar */}
        <div className="absolute" style={{ top: barTop, left: leftPx, width: widthPx, height: barH }} onMouseDown={handleMouseDown("move")}>
          <div className="absolute inset-0 rounded-[5px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{ background: `${barColor}18`, boxShadow: isCrit ? `0 0 0 2px ${barColor}` : `inset 0 0 0 1.5px ${barColor}` }}>
            <div className="absolute left-0 top-0 bottom-0" style={{ width: `${t.pct}%`, background: barColor, minWidth: t.pct > 0 ? 3 : 0 }} />
            {widthPx >= 36 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold whitespace-nowrap px-1"
                  style={{
                    color: t.pct >= 50 ? "white" : barColor,
                    textShadow: t.pct >= 50 ? "0 1px 4px rgba(0,0,0,0.6)" : "none",
                  }}>{t.pct}%</span>
              </div>
            )}
          </div>
          <div onMouseDown={handleMouseDown("left")}  className="absolute left-0  top-0 bottom-0 w-2 cursor-col-resize z-10" />
          <div onMouseDown={handleMouseDown("right")} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10" />
        </div>

        {/* Right port — large hit area with arrow icon, drag from here to create dependency */}
        <div
          style={{ position: "absolute", top: barTop - 4, left: leftPx + widthPx - 10, width: 28, height: barH + 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "crosshair", zIndex: 20, opacity: showPorts ? 1 : 0, pointerEvents: showPorts ? "all" : "none", transition: "opacity 0.12s" }}
          onMouseDown={e => { e.stopPropagation(); onStartConnection && onStartConnection(t.id, "end", leftPx + widthPx, (rowAbsoluteY ?? 0) + barTop + barH / 2); }}
          onMouseUp={e => { e.stopPropagation(); if (drawingDep && drawingDep.fromId !== t.id) { onDropConnection && onDropConnection(t.id, "end"); } else if (movingDep) { onDropEndpointMove && onDropEndpointMove(t.id); } }}
        >
          <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2.5px solid ${barColor}`, background: barColor, boxShadow: `0 0 0 2px white, 0 1px 4px rgba(0,0,0,0.18)` }} />
        </div>
      </div>
    </div>
  );
}

const DEP_LABELS: Record<string, string> = { FS: "Finish → Start", SS: "Start → Start", FF: "Finish → Finish", SF: "Start → Finish" };

function curvedPath(pts: [number, number][], r = 10): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const len1 = Math.hypot(cx - px, cy - py);
    const len2 = Math.hypot(nx - cx, ny - cy);
    if (len1 < 0.01 || len2 < 0.01) { d += ` L ${cx},${cy}`; continue; }
    const rc = Math.min(r, len1 / 2, len2 / 2);
    const bx = cx - (cx - px) / len1 * rc;
    const by = cy - (cy - py) / len1 * rc;
    const ax = cx + (nx - cx) / len2 * rc;
    const ay = cy + (ny - cy) / len2 * rc;
    d += ` L ${bx},${by} Q ${cx},${cy} ${ax},${ay}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]},${last[1]}`;
  return d;
}

function SVGArrows({ deps, tasks, taskYMap, chartStart, pixelsPerDay, totalH, showCriticalPath, criticalPathTasks, onDeleteDep, onChangeDep, drawingDep, movingDep, onStartEndpointMove, mousePos }: any) {
  const [hoveredDep, setHoveredDep] = useState<number | null>(null);
  const [editingDep, setEditingDep] = useState<number | null>(null);
  const isDragging = !!(drawingDep || movingDep);

  return (
    <svg className="absolute top-0 overflow-visible" style={{ left: 0, width: "100%", height: totalH, zIndex: 25, pointerEvents: "none" }}>
      <defs>
        <marker id="arr-crit"  markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 Z" fill="#ef4444" /></marker>
        <marker id="arr-norm"  markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 Z" fill="#64748b" /></marker>
        <marker id="arr-hover" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 Z" fill="#3b82f6" /></marker>
        <marker id="arr-draw"  markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 Z" fill="#3b82f6" /></marker>
      </defs>

      {deps.map((dep: any, i: number) => {
        const fromT = tasks.find((t: any) => t.id === dep.from);
        const toT   = tasks.find((t: any) => t.id === dep.to);
        if (!fromT || !toT || taskYMap[dep.from] === undefined || taskYMap[dep.to] === undefined) return null;

        const isOnCritical = showCriticalPath && criticalPathTasks.has(dep.from) && criticalPathTasks.has(dep.to);
        const isHov = hoveredDep === i || editingDep === i;
        const baseOpacity = showCriticalPath && !isOnCritical ? 0.2 : 1;
        const color = isHov ? "#3b82f6" : isOnCritical ? "#ef4444" : "#64748b";
        const sw = isHov ? 2.5 : isOnCritical ? 2.5 : 1.5;
        const marker = isHov ? "url(#arr-hover)" : isOnCritical ? "url(#arr-crit)" : "url(#arr-norm)";

        const fromStartX = diffDays(chartStart, fromT.startDate) * pixelsPerDay;
        const fromEndX   = diffDays(chartStart, fromT.endDate)   * pixelsPerDay;
        const toStartX   = diffDays(chartStart, toT.startDate)   * pixelsPerDay;
        const toEndX     = diffDays(chartStart, toT.endDate)     * pixelsPerDay;

        const midBarY = (t: any) => {
          const bt = t.parentTaskId ? 9 : 11;
          const bh = t.parentTaskId ? 18 : 26;
          return (taskYMap[t.id] ?? 0) + bt + bh / 2;
        };

        const dotY1 = midBarY(fromT);
        const dotY2 = midBarY(toT);

        let x1: number, x2: number, pathD: string;

        if (dep.type === "FS") {
          x1 = fromEndX; x2 = toStartX;
          if (x2 > x1 + 1) {
            // Gap: route via midpoint, approach toStartX from the left.
            const vx = Math.round((x1 + x2) / 2);
            pathD = curvedPath([[x1, dotY1], [vx, dotY1], [vx, dotY2], [x2, dotY2]], 6);
          } else {
            // Overlap: go right past both bars, route above the to-bar, then approach
            // toStartX from the left so the path never crosses the bar interior.
            const toVEnd = Math.max(toEndX, x2 + 4);
            const vx = Math.max(x1, toVEnd) + 16;
            const bt2 = toT.parentTaskId ? 9 : 11;
            const topAbove = (taskYMap[toT.id] ?? 0) + bt2 - 4;
            const leftApproach = Math.max(0, x2 - 14);
            pathD = curvedPath([[x1, dotY1], [vx, dotY1], [vx, topAbove], [leftApproach, topAbove], [leftApproach, dotY2], [x2, dotY2]], 6);
          }
        } else if (dep.type === "SS") {
          x1 = fromStartX; x2 = toStartX;
          const vx = Math.min(x1, x2) - 12;
          pathD = curvedPath([[x1, dotY1], [vx, dotY1], [vx, dotY2], [x2, dotY2]], 6);
        } else if (dep.type === "FF") {
          x1 = fromEndX; x2 = toEndX;
          const vx = Math.max(x1, x2) + 12;
          pathD = curvedPath([[x1, dotY1], [vx, dotY1], [vx, dotY2], [x2, dotY2]], 6);
        } else { // SF
          x1 = fromStartX; x2 = toEndX;
          const vx = Math.min(x1, x2) - 12;
          pathD = curvedPath([[x1, dotY1], [vx, dotY1], [vx, dotY2], [x2, dotY2]], 6);
        }

        const labelX = Math.round((x1 + x2) / 2);
        const labelY = Math.round((dotY1 + dotY2) / 2);
        const PW = 160; const PH = 72;
        const popX = labelX - PW / 2;
        const popY = labelY + 14;

        return (
          <g key={i} opacity={baseOpacity} style={{ pointerEvents: "all" }}
            onMouseEnter={() => setHoveredDep(i)}
            onMouseLeave={() => setHoveredDep(null)}
          >
            {/* Wide transparent hit area — click to open delete popup; disabled during drag so mouseup reaches bars */}
            <path d={pathD} fill="none" stroke="transparent" strokeWidth={18}
              style={{ cursor: "pointer", pointerEvents: isDragging ? "none" : "all" }}
              onClick={(e) => { e.stopPropagation(); setEditingDep(editingDep === i ? null : i); }} />
            <path d={pathD} fill="none" stroke={color} strokeWidth={sw} markerEnd={marker} style={{ pointerEvents: "none" }} />

            {/* Endpoint drag handles — disabled during OTHER dep's drag so mouseup reaches bar below */}
            <circle cx={x1} cy={dotY1} r={12} fill="transparent"
              style={{ pointerEvents: isDragging ? "none" : "all", cursor: "grab" }}
              onMouseDown={e => { e.stopPropagation(); onStartEndpointMove && onStartEndpointMove(i, "from", x2, dotY2); }} />

            <circle cx={x2} cy={dotY2} r={12} fill="transparent"
              style={{ pointerEvents: isDragging ? "none" : "all", cursor: "grab" }}
              onMouseDown={e => { e.stopPropagation(); onStartEndpointMove && onStartEndpointMove(i, "to", x1, dotY1); }} />

            {/* Delete popup — click arrow to open; auto-close during drag */}
            {editingDep === i && !isDragging && (
              <g style={{ pointerEvents: "all" }}>
                <rect x={-9999} y={-9999} width={19998} height={19998} fill="transparent"
                  onClick={(e) => { e.stopPropagation(); setEditingDep(null); }} />
                <rect x={popX} y={popY} width={PW} height={40} rx={7}
                  fill="white" stroke="#e2e8f0" strokeWidth={1.5}
                  filter="drop-shadow(0 4px 12px rgba(0,0,0,0.18))" />
                <g style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); onDeleteDep(i); setEditingDep(null); }}>
                  <rect x={popX + 8} y={popY + 8} width={PW - 16} height={24} rx={5} fill="#fef2f2" stroke="#fca5a5" strokeWidth={1} />
                  <text x={labelX} y={popY + 24} textAnchor="middle" fill="#dc2626" fontSize={12} fontFamily="sans-serif" fontWeight="600">Delete dependency</text>
                </g>
              </g>
            )}
          </g>
        );
      })}

      {drawingDep && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={drawingDep.x} y1={drawingDep.y} x2={mousePos.x} y2={mousePos.y}
            stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#arr-draw)" />
          <circle cx={drawingDep.x} cy={drawingDep.y} r={5} fill="#3b82f6" />
        </g>
      )}
      {movingDep && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={movingDep.anchorX} y1={movingDep.anchorY} x2={mousePos.x} y2={mousePos.y}
            stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#arr-draw)" />
          <circle cx={movingDep.anchorX} cy={movingDep.anchorY} r={4} fill="#f59e0b" />
          <circle cx={mousePos.x} cy={mousePos.y} r={5} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Detail Panel — provenance-first, photo conditional on real data
// ─────────────────────────────────────────────────────────────
function TaskDetailPanel({ task, deps, tasks, onClose, onEditClick, onDelete, criticalPathTasks, taskActivity }: any) {
  const es = effectiveStatus(task);
  const sc = STATUS_CONFIG[es];
  const predecessors = deps.filter((d: any) => d.to === task.id);
  const successors   = deps.filter((d: any) => d.from === task.id);

  const today = new Date().toISOString().split("T")[0];
  const durationDays = diffDays(task.startDate, task.endDate);
  const daysLate = es !== "completed" && parseDate(task.endDate) < parseDate(today)
    ? diffDays(task.endDate, today) : 0;

  const isOnCritical = criticalPathTasks?.has(task.id) || task.critical;
  const hasRealPhoto = Array.isArray(task.photos) && task.photos.length > 0;
  const lastUpdate: ActivityUpdate | undefined = taskActivity?.[0];

  return (
    <div className="w-[320px] border-l border-[#E2E8F0] flex flex-col shrink-0 bg-white h-full z-20">
      <div className="p-3 px-3.5 border-b border-[#E2E8F0] flex justify-between items-start">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[#0F172A] truncate">{task.name}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5 truncate">{task.contractor} · {task.space}</div>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] shrink-0 ml-2">✕</button>
      </div>

      {/* Site photo — only if a real attachment exists */}
      {hasRealPhoto && (
        <div className="px-3.5 pt-3">
          <img src={task.photos[0]} alt="Site photo" className="w-full h-40 object-cover rounded-lg shadow-sm" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">

        {/* Last update — the provenance card */}
        {lastUpdate && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              {lastUpdate.source === "whatsapp" && (
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" /></svg>
              )}
              <div className="text-[10px] font-semibold text-[#334155]">{lastUpdate.from}</div>
              <div className="text-[10px] text-[#94A3B8]">· {lastUpdate.timeAgo} ago</div>
            </div>
            <div className="italic text-[12px] text-[#334155] leading-snug">"{lastUpdate.message}"</div>
          </div>
        )}

        {/* Status */}
        <div>
          <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Status</div>
          <span className="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: `${sc.color}15`, color: sc.color }}>{sc.label}</span>
        </div>

        {/* Progress */}
        <div>
          <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Progress</div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${task.pct ?? 0}%`, background: sc.color }} />
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: sc.color }}>{task.pct ?? 0}%</span>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Schedule</div>
          <div className="text-[13px] font-medium text-[#0F172A]">{formatDateStr(task.startDate)} → {formatDateStr(task.endDate)}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Duration: {durationDays}d</div>
          {daysLate > 0 && (
            <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100">{daysLate}d late</span>
          )}
        </div>

        {/* Downstream impact for critical-path tasks */}
        {isOnCritical && (
          <div className="bg-red-50 border border-red-100 rounded-md p-2.5">
            <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zm-1 4.5v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>
              On critical path
            </div>
            <div className="text-[11px] text-red-700 leading-snug">Any slip here directly pushes the project finish date. {successors.length} downstream task{successors.length === 1 ? "" : "s"} depend on this.</div>
          </div>
        )}

        {predecessors.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Predecessors</div>
            {predecessors.map((d: any) => (
              <div key={d.from} className="text-[11px] text-[#475569] py-1.5 border-b border-[#F1F5F9] flex justify-between items-center">
                <span className="font-medium truncate pr-2">{tasks.find((t: any) => t.id === d.from)?.name}</span>
                <span className="text-[#94A3B8] font-mono text-[10px] shrink-0">( {d.type} )</span>
              </div>
            ))}
          </div>
        )}

        {successors.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Successors</div>
            {successors.map((d: any) => (
              <div key={d.to} className="text-[11px] text-[#475569] py-1.5 border-b border-[#F1F5F9] flex justify-between items-center">
                <span className="font-medium truncate pr-2">{tasks.find((t: any) => t.id === d.to)?.name}</span>
                <span className="text-[#94A3B8] font-mono text-[10px] shrink-0">( {d.type} )</span>
              </div>
            ))}
          </div>
        )}

        {/* No-photo placeholder — invites the WhatsApp loop */}
        {!hasRealPhoto && (
          <div className="border border-dashed border-[#E2E8F0] rounded-lg p-3 text-center bg-[#F8FAFC]">
            <div className="text-[11px] text-[#64748B] mb-1">No site photo yet</div>
            <div className="text-[10px] text-[#94A3B8]">Drop a photo here, or send to the project WhatsApp number to auto-attach.</div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#E2E8F0] flex gap-2">
        <button onClick={onEditClick} className="flex-1 py-1.5 text-[12px] rounded-md bg-blue-50 text-blue-600 border border-blue-200 font-semibold">Edit</button>
        <button onClick={() => { if(window.confirm("Delete?")) onDelete(task.id); }} className="flex-1 py-1.5 text-[12px] rounded-md bg-red-50 text-red-600 border border-red-200 font-semibold">Delete</button>
      </div>
    </div>
  );
}

const PHASE_OPTIONS = [
  // Building
  "Site Preparation","Foundation","Structure","MEP","Finishing","Handover",
  // Common infra
  "Surveys & Investigations","Regulatory Approvals","Land Acquisition","Earthworks","Civil & Earthworks",
  // Marine / port / LCT
  "Marine Works","Marine Structures","Quay & Berth","Reclamation",
  "Storage Tanks","Pipeline & Piping","Fire & Safety Systems",
  "Terminal Buildings","Equipment Installation","Navigational Aids",
  // Airport
  "Runway & Taxiway","Terminal Building","ATC Facilities","Perimeter & Security",
  // Highway / bridge
  "Foundation & Piling","Substructure","Superstructure","Deck & Finishes",
  "Approaches","Pavement","Road Connectivity","Structures","Drainage","Safety & Furniture","Toll & ITS",
  // Metro
  "Viaduct","Stations","Track Works","Depot","Systems & E&M",
  // Mainline Railway
  "Bridges & Culverts","Signalling & Telecom","Traction & Power",
  // MMLP / ICD
  "Rail Infrastructure","Rail Siding","Warehouse & Sheds","Warehousing & Sheds",
  "Customs Facilities","Intermodal Yard","Pavement & Yard","Yard & Pavement",
  "Systems & Technology","Systems & Gate",
  // WTP
  "Civil Structures","Mechanical Equipment","Piping & Valves","Electrical & Instrumentation",
  // Tunnel
  "Portal Works","Tunnel Excavation","Primary Support","Waterproofing & Lining",
  "Drainage & Invert","MEP & Safety","Road / Rail Finishing",
  // Cross-type
  "Utilities","Testing & Commissioning","Commissioning & Handover",
];

function DonutRing({ pct, size = 20, color = "#2563EB" }: { pct: number; size?: number; color?: string }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(pct / 100, 1)) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}33`} strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function TaskModal({ isOpen, mode, task, tasks, deps, onClose, onSave, onDelete, defaultPhase, defaultArea, projectStartDate, projectEndDate }: any) {
  const emptyForm = { name: "", phase: "", contractor: "", space: "", startDate: "", endDate: "", status: "notStarted" as StatusKey, pct: 0 };
  const [formData, setFormData] = useState(emptyForm);
  const [selectedPreds, setSelectedPreds] = useState<{id: string, type: string}[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && task) {
        const autoPhase = task.phase || detectPhase(task.name);
        setFormData({ name: task.name, phase: autoPhase, contractor: task.contractor || "", space: task.space || "", startDate: task.startDate, endDate: task.endDate, status: task.status || "notStarted", pct: task.pct ?? 0 });
        setSelectedPreds(deps.filter((d: any) => d.to === task.id).map((d: any) => ({ id: d.from, type: d.type })));
      } else {
        setFormData({ ...emptyForm, phase: defaultPhase || "", space: defaultArea || "" });
        setSelectedPreds([]);
      }
      setError("");
    }
  }, [isOpen, mode, task, deps]);

  if (!isOpen) return null;

  const labelCls = "block text-[11px] font-bold text-[#475569] mb-1 uppercase tracking-wider";
  const inputCls = "w-full bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]";

  const f = formData;
  const set = (k: string, v: any) => setFormData(p => {
    const next: typeof p = { ...p, [k]: v };
    if (k === "status" && v === "completed") next.pct = 100;
    if (k === "status" && v === "notStarted") next.pct = 0;
    if (k === "pct" && v === 100) next.status = "completed";
    if (k === "pct" && v === 0) next.status = "notStarted";
    if (k === "pct" && v > 0 && v < 100) next.status = "inProgress";
    return next;
  });

  const handleSave = () => {
    if (!f.name.trim())    return setError("Task name is required.");
    if (!f.phase)          return setError("Phase is required.");
    if (!f.startDate)      return setError("Start date is required.");
    if (!f.endDate)        return setError("End date is required.");
    if (f.endDate < f.startDate) return setError("End date must be after start date.");
    if (projectStartDate && f.startDate < projectStartDate) return setError(`Start date cannot be before project start (${projectStartDate}).`);
    onSave(formData, selectedPreds);
    onClose();
  };

  const togglePred = (id: string) => setSelectedPreds(p => p.find(x => x.id === id) ? p.filter(x => x.id !== id) : [...p, { id, type: "FS" }]);
  const changePredType = (id: string, type: string) => setSelectedPreds(p => p.map(x => x.id === id ? { ...x, type } : x));

  const parentTasks = tasks.filter((t: any) => !t.parentTaskId && t.id !== task?.id);

  return (
    <div className="fixed inset-0 bg-[#09090b]/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
          <h2 className="text-[15px] font-bold text-[#0F172A]">{mode === "add" ? "Add new task" : "Edit task"}</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-[#0F172A]">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className={labelCls}>Task name *</label>
            <input type="text" placeholder="e.g. Column formwork level 3" value={f.name} onChange={e => set("name", e.target.value)} className={inputCls} />
          </div>

          {!(defaultPhase && defaultArea) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phase *</label>
                <select value={f.phase} onChange={e => set("phase", e.target.value)} className={inputCls}>
                  <option value="">Select phase…</option>
                  {PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Space / zone</label>
                <input type="text" placeholder="e.g. Zone A — L3" value={f.space} onChange={e => set("space", e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
          {defaultPhase && defaultArea && (
            <div className="text-[12px] text-[#64748B] bg-[#F8FAFC] rounded-md px-3 py-2">
              Adding to <span className="font-semibold text-[#1E293B]">{defaultPhase}</span> › <span className="font-semibold text-[#1E293B]">{defaultArea}</span>
            </div>
          )}

          {!(defaultPhase && defaultArea) && (
            <div>
              <label className={labelCls}>Contractor</label>
              <input type="text" placeholder="e.g. Rajesh Kumar" value={f.contractor} onChange={e => set("contractor", e.target.value)} className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start date *</label>
              <input type="date" value={f.startDate} min={projectStartDate || undefined} max={f.endDate || undefined} onChange={e => set("startDate", e.target.value)} className={inputCls + " text-[#0F172A]"} />
            </div>
            <div>
              <label className={labelCls}>End date *</label>
              <input type="date" value={f.endDate} min={f.startDate || projectStartDate || undefined} onChange={e => set("endDate", e.target.value)} className={inputCls + " text-[#0F172A]"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={f.status} onChange={e => set("status", e.target.value)} className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>% Complete</label>
              <div className="flex items-center gap-2 pt-1">
                <input type="range" min={0} max={100} step={5} value={f.pct} onChange={e => set("pct", Number(e.target.value))} className="flex-1 accent-[#2563EB]" />
                <span className="text-[13px] font-bold font-mono text-[#2563EB] w-10 text-right">{f.pct}%</span>
              </div>
            </div>
          </div>

          {parentTasks.length > 0 && (
            <div>
              <label className={labelCls}>Dependencies (predecessors)</label>
              <div className="border border-[#E2E8F0] rounded-md p-2 max-h-36 overflow-y-auto space-y-1 bg-[#fafbfc]">
                {parentTasks.map((t: any) => {
                  const sel = selectedPreds.find(x => x.id === t.id);
                  return (
                    <div key={t.id} className="flex justify-between items-center py-0.5 px-1 hover:bg-[#f0f6fc] rounded">
                      <label className="flex gap-2 text-[12px] items-center cursor-pointer">
                        <input type="checkbox" checked={!!sel} onChange={() => togglePred(t.id)} className="accent-[#2563EB]" />
                        <span className="text-[#0F172A]">{t.name}</span>
                      </label>
                      {sel && (
                        <select value={sel.type} onChange={e => changePredType(t.id, e.target.value)}
                          className="text-[11px] border border-[#E2E8F0] rounded px-1.5 py-0.5 bg-white">
                          <option value="FS">FS — Finish to start</option>
                          <option value="SS">SS — Start to start</option>
                          <option value="FF">FF — Finish to finish</option>
                          <option value="SF">SF — Start to finish</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-[#DC2626] font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
          <div>
            {mode === "edit" && (
              <button onClick={() => { onDelete(task?.id); onClose(); }} className="px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] border border-[#DC2626] rounded-lg hover:bg-[#FEF2F2] transition-colors">Delete task</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-[13px] font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC]">Cancel</button>
            <button onClick={handleSave} className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] shadow-sm">
              {mode === "add" ? "Add task" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Zoom Presets
// ─────────────────────────────────────────────────────────────
const ZOOM_PRESETS = [
  { label: "Year",    value: 0.15 },
  { label: "Quarter", value: 0.35 },
  { label: "Month",   value: 0.7 },
  { label: "Week",    value: 1.0 },
  { label: "Day",     value: 2.0 },
] as const;

function getActivePreset(zoom: number): string | null {
  const match = ZOOM_PRESETS.find(p => Math.abs(p.value - zoom) < 0.08);
  return match?.label ?? null;
}

// ─────────────────────────────────────────────────────────────
// Gantt Cache (stale-while-revalidate)
// ─────────────────────────────────────────────────────────────
type GanttCache = {
  tasks: ScheduleTask[];
  deps: TaskDependency[];
  depIds: Record<string, string>;
  lastFetchedAt: number;
};

function readGanttCache(projectId: string): GanttCache | null {
  try {
    const raw = localStorage.getItem(`bluq_gantt_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeGanttCache(projectId: string, data: Omit<GanttCache, "lastFetchedAt">): void {
  try {
    localStorage.setItem(`bluq_gantt_${projectId}`, JSON.stringify({ ...data, lastFetchedAt: Date.now() }));
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
function GanttChartContent() {
  const searchParams = useSearchParams();
  const { isDesignMode, workspaceId: ctxWorkspaceId, loading: wsLoading } = useWorkspace();
  const { can } = usePermissions();
  const canEdit = can("schedule", "edit");
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWs = searchParams.get("workspaceId");
  const workspaceId = (urlWs && urlWs !== "null") ? urlWs : ctxWorkspaceId;
  const versionId = searchParams.get("versionId") ?? undefined;
  const urlProjectEndDate = searchParams.get("projectEndDate") ?? null;
  const urlProjectStartDate = searchParams.get("projectStartDate") ?? null;
  const real = !wsLoading && !isDesignMode && isRealProject(projectIdParam) && !!workspaceId;

  const [projectEndDate, setProjectEndDate] = useState<string | null>(urlProjectEndDate);
  const [projectStartDate, setProjectStartDate] = useState<string | null>(urlProjectStartDate);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [deps, setDeps] = useState<TaskDependency[]>([]);
  const [depIds, setDepIds] = useState<Record<string, string>>({});
  const [scheduleVersion, setScheduleVersion] = useState<ScheduleVersion | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const depIdKey = (from: string, to: string) => `${from}__${to}`;

  // Activity feed — mock data only in design mode; real mode shows empty until socket/API wired
  const [activity, setActivity] = useState<ActivityUpdate[]>(isDesignMode ? SAMPLE_ACTIVITY : []);
  const { showActivityFeed, setShowActivityFeed } = useActivityFeed();

  // UI state for the new UX layer
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  const [showBaseline, setShowBaseline] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Resolve project start/end dates: URL param → projects localStorage cache → API
  useEffect(() => {
    if (urlProjectEndDate && urlProjectStartDate) return; // already have both
    // Try localStorage cache first (written by overview page)
    if (workspaceId) {
      try {
        const raw = localStorage.getItem(`bluq_projects_cache_${workspaceId}`);
        if (raw) {
          const cache = JSON.parse(raw);
          const proj = cache?.data?.find((p: any) => String(p.id) === projectIdParam);
          if (proj?.endDate && proj?.startDate) {
            if (!urlProjectEndDate) setProjectEndDate(proj.endDate);
            if (!urlProjectStartDate) setProjectStartDate(proj.startDate);
            return;
          }
        }
      } catch {}
    }
    // Fall back to API
    if (real) {
      fetchProject(projectIdParam)
        .then(p => {
          if (p.endDate && !urlProjectEndDate) setProjectEndDate(p.endDate);
          if (p.startDate && !urlProjectStartDate) setProjectStartDate(p.startDate);
        })
        .catch(() => {});
    }
  }, [real, projectIdParam, workspaceId, urlProjectEndDate, urlProjectStartDate]);

  useEffect(() => {
    if (real) {
      const controller = new AbortController();
      const { signal } = controller;

      // Show cached data instantly so chart isn't blank on navigate-back
      const cached = readGanttCache(projectIdParam);
      if (cached) {
        setTasks(cached.tasks);
        setDeps(cached.deps);
        setDepIds(cached.depIds);
      } else {
        setDataLoading(true);
      }

      // Fetch tasks + deps first (critical path); schedule version is non-blocking
      Promise.all([
        fetchTasks(projectIdParam, workspaceId!, signal, versionId),
        fetchTaskDependencies(projectIdParam, workspaceId!, signal),
      ]).then(([freshTasks, depRows]) => {
        const freshDeps = depRows.map(r => ({ from: r.predecessorId, to: r.successorId, type: r.dependencyType, label: r.dependencyType }));
        const freshDepIds: Record<string, string> = {};
        depRows.forEach(r => { freshDepIds[depIdKey(r.predecessorId, r.successorId)] = r.id; });

        setTasks(freshTasks);
        setDeps(freshDeps);
        setDepIds(freshDepIds);
        setDataLoading(false);
        writeGanttCache(projectIdParam, { tasks: freshTasks, deps: freshDeps, depIds: freshDepIds });

        // Lazily load schedule version after tasks are visible
        fetchLatestScheduleVersion(projectIdParam, workspaceId!)
          .then(setScheduleVersion)
          .catch(() => {});
      }).catch(err => {
        if (err?.name !== "AbortError") setDataLoading(false);
      });

      return () => controller.abort();
    } else if (isDesignMode) {
      const numId = Number(projectIdParam);
      getScheduleTasks(numId).then(setTasks);
      getScheduleDeps(numId).then(setDeps);
    } else {
      setTasks([]);
      setDeps([]);
    }
  }, [projectIdParam, workspaceId, isDesignMode, versionId]);

  const gapCheckGaps: SuspectedGap[] =
    scheduleVersion?.scheduleJson?.gapCheck?.suspectedGaps?.filter(g => !g.alreadyCovered) ?? [];

  const refreshTasksAndDeps = useCallback(() => {
    if (!real) return;
    Promise.all([
      fetchTasks(projectIdParam, workspaceId!, undefined, versionId),
      fetchTaskDependencies(projectIdParam, workspaceId!),
    ]).then(([freshTasks, depRows]) => {
      const freshDeps = depRows.map(r => ({ from: r.predecessorId, to: r.successorId, type: r.dependencyType, label: r.dependencyType }));
      const freshDepIds: Record<string, string> = {};
      depRows.forEach(r => { freshDepIds[depIdKey(r.predecessorId, r.successorId)] = r.id; });
      setTasks(freshTasks);
      setDeps(freshDeps);
      setDepIds(freshDepIds);
      writeGanttCache(projectIdParam, { tasks: freshTasks, deps: freshDeps, depIds: freshDepIds });
    }).catch(console.error);
  }, [real, projectIdParam, workspaceId, versionId]);

  const refreshTasks = refreshTasksAndDeps;

  // Listen for import completion from the import-csv page
  useEffect(() => {
    const handler = (e: Event) => {
      const { projectId: pid } = (e as CustomEvent).detail;
      if (pid === projectIdParam) refreshTasksAndDeps();
    };
    window.addEventListener("bluq_tasks_imported", handler);
    return () => window.removeEventListener("bluq_tasks_imported", handler);
  }, [projectIdParam, refreshTasksAndDeps]);

  useTaskSocket({ projectId: real ? projectIdParam : null, setTasks });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterContractor, setFilterContractor] = useState("All");
  const [filterSpace, setFilterSpace] = useState("All");
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const didInit = useRef(false);

  // Smart default: collapse only when project is large enough to warrant it
  useEffect(() => {
    if (didInit.current || tasks.length === 0) return;
    didInit.current = true;
    if (tasks.length < 15) return; // small projects render fully expanded
    const phases = new Set(tasks.map(t => t.phase || "Other"));
    const areas = new Set(tasks.map(t => `${t.phase || "Other"}__${t.space || "General"}`));
    const parentIds = new Set(tasks.filter(t => !t.parentTaskId).map(t => t.id));
    setCollapsedPhases(phases);
    setCollapsedAreas(areas);
    setCollapsedTasks(parentIds);
  }, [tasks]);

  const [drawingDep, setDrawingDep] = useState<{ fromId: string; fromSide: "start"|"end"; x: number; y: number } | null>(null);
  const [movingDep, setMovingDep] = useState<{ depIdx: number; end: "from"|"to"; anchorX: number; anchorY: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const togglePhase = (phase: string) =>
    setCollapsedPhases(p => { const s = new Set(p); s.has(phase) ? s.delete(phase) : s.add(phase); return s; });
  const toggleArea = (key: string) =>
    setCollapsedAreas(p => { const s = new Set(p); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleTask = (id: string) =>
    setCollapsedTasks(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const [zoomLevel, setZoomLevel] = useState(1);
  const BASE_PIXELS_PER_DAY = 20;
  const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;

  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: "add", taskId: null as string | null, defaultPhase: "", defaultArea: "" });
  const [showContractors, setShowContractors] = useState(false);
  const leftPanelW = showContractors ? 500 : 400;

  const zoomIn = () => setZoomLevel(p => Math.min(3, +(p + 0.2).toFixed(1)));
  const zoomOut = () => setZoomLevel(p => Math.max(0.1, +(p - 0.2).toFixed(1)));
  const setZoomPreset = (val: number) => setZoomLevel(val);

  const contractorOptions = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.contractor).map(t => t.contractor))).sort()], [tasks]);
  const spaceOptions      = useMemo(() => ["All", ...Array.from(new Set(tasks.filter(t => t.space).map(t => t.space))).sort()], [tasks]);

  // Header stats
  const headerStats = useMemo(() => {
    const parents = tasks.filter(t => !t.parentTaskId);
    const completed   = parents.filter(t => effectiveStatus(t) === "completed").length;
    const inProgress  = parents.filter(t => effectiveStatus(t) === "inProgress").length;
    const runningLate = parents.filter(t => effectiveStatus(t) === "runningLate").length;
    const delayed     = parents.filter(t => effectiveStatus(t) === "delayed").length;
    const notStarted  = parents.filter(t => effectiveStatus(t) === "notStarted").length;
    const atRisk      = runningLate + delayed;
    const total       = parents.length;
    // Duration-weighted progress (industry standard — Primavera P6 / MS Project)
    // Each task contributes proportional to its planned duration, not just task count
    const overall = (() => {
      if (total === 0) return 0;
      let weightedSum = 0;
      let totalDur = 0;
      parents.forEach(t => {
        const dur = Math.max(diffDays(t.startDate, t.endDate), 1);
        weightedSum += t.pct * dur;
        totalDur += dur;
      });
      return totalDur > 0 ? Math.round(weightedSum / totalDur) : 0;
    })();
    const ends = parents.map(t => t.endDate).filter(Boolean).sort();
    // When tasks exist → last task end date. When no tasks → project's configured end date. Never today as fallback.
    const projectedEnd = ends.length > 0 ? ends[ends.length - 1] : (projectEndDate ?? null);
    return { completed, inProgress, runningLate, delayed, notStarted, atRisk, total, overall, projectedEnd };
  }, [tasks, projectEndDate]);

  // Slip detection drives the reoptimize banner
  const slipSummary = useMemo(() => detectSlip(tasks.filter(t => !t.parentTaskId)), [tasks]);

  // Filter — memoized so downstream useMemos don't re-run on every render
  const filteredTasks = useMemo(() => tasks.filter((t) => {
    if (t.milestone) return false;
    if (!t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterContractor !== "All" && t.contractor !== filterContractor) return false;
    if (filterSpace !== "All" && t.space !== filterSpace) return false;
    if (filterStatus !== "All") {
      const es = effectiveStatus(t);
      if (filterStatus === "atRisk") {
        if (es !== "runningLate" && es !== "delayed") return false;
      } else if (es !== filterStatus) {
        return false;
      }
    }
    return true;
  }), [tasks, searchTerm, filterContractor, filterSpace, filterStatus]);

  const { chartStart, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const year = new Date().getFullYear();
      return { chartStart: `${year}-01-01`, totalDays: 365 };
    }
    let minD = parseDate(filteredTasks[0].startDate);
    let maxD = parseDate(filteredTasks[0].endDate);
    filteredTasks.forEach(t => {
      if (parseDate(t.startDate) < minD) minD = parseDate(t.startDate);
      if (parseDate(t.endDate) > maxD) maxD = parseDate(t.endDate);
    });
    const start = new Date(minD - 14 * MS_PER_DAY).toISOString().split("T")[0];
    const end = new Date(maxD + 28 * MS_PER_DAY).toISOString().split("T")[0];
    return { chartStart: start, totalDays: diffDays(start, end) };
  }, [filteredTasks]);

  const timelineWidthPx = totalDays * pixelsPerDay;

  const criticalPathTasks = useMemo(() => {
    if (!showCriticalPath) return new Set<string>();
    return calculateCriticalPath(filteredTasks, deps);
  }, [filteredTasks, deps, showCriticalPath]);

  const groupedData = useMemo(() => {
    const childrenOf = new Map<string, ScheduleTask[]>();
    filteredTasks.forEach(t => {
      if (t.parentTaskId) {
        const arr = childrenOf.get(t.parentTaskId);
        if (arr) arr.push(t); else childrenOf.set(t.parentTaskId, [t]);
      }
    });
    const phaseMap: Record<string, Record<string, ScheduleTask[]>> = {};
    filteredTasks.filter(t => !t.parentTaskId).forEach((t) => {
      const phase = t.phase || "Other";
      const area = t.space || "General";
      if (!phaseMap[phase]) phaseMap[phase] = {};
      if (!phaseMap[phase][area]) phaseMap[phase][area] = [];
      phaseMap[phase][area].push(t);
      (childrenOf.get(t.id) ?? []).forEach(s => phaseMap[phase][area].push(s));
    });
    const toEntry = (phaseKey: string): [string, [string, ScheduleTask[]][]] =>
      [phaseKey, Object.entries(phaseMap[phaseKey])];
    const ordered = PHASE_ORDER.filter(p => phaseMap[p]).map(toEntry);
    const rest = Object.keys(phaseMap).filter(k => !PHASE_ORDER.includes(k)).map(toEntry);
    return [...ordered, ...rest];
  }, [filteredTasks]);

  const phaseAvgPct = (areas: [string, ScheduleTask[]][]) => {
    const parents = areas.flatMap(([, ts]) => ts).filter(t => !t.parentTaskId);
    if (!parents.length) return 0;
    let weightedSum = 0;
    let totalDur = 0;
    parents.forEach(t => {
      const dur = Math.max(diffDays(t.startDate, t.endDate), 1);
      weightedSum += t.pct * dur;
      totalDur += dur;
    });
    return totalDur > 0 ? Math.round(weightedSum / totalDur) : 0;
  };

  const { taskYMap, totalH, wbsMap } = useMemo(() => {
    const yMap: Record<string, number> = {};
    const wbs: Record<string, string> = {};
    let y = 0;
    let phaseIdx = 0;
    groupedData.forEach(([phase, areas]) => {
      phaseIdx++;
      y += GROUP_H;
      if (!collapsedPhases.has(phase)) {
        let areaIdx = 0;
        areas.forEach(([area, ts]) => {
          areaIdx++;
          const areaKey = `${phase}__${area}`;
          const showAreaRow = area !== "General" || areas.length > 1;
          if (showAreaRow) y += AREA_H;
          if (!showAreaRow || !collapsedAreas.has(areaKey)) {
            let taskIdx = 0;
            ts.filter(t => !t.parentTaskId).forEach((t) => {
              taskIdx++;
              const taskWbs = `${phaseIdx}.${areaIdx}.${taskIdx}`;
              wbs[t.id] = taskWbs;
              yMap[t.id] = y;
              y += ROW_H;
              if (!collapsedTasks.has(t.id)) {
                let subIdx = 0;
                ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                  subIdx++;
                  wbs[s.id] = `${taskWbs}.${subIdx}`;
                  yMap[s.id] = y;
                  y += SUB_ROW_H;
                });
              }
            });
          }
        });
      }
    });
    return { taskYMap: yMap, totalH: y, wbsMap: wbs };
  }, [groupedData, collapsedPhases, collapsedAreas, collapsedTasks]);

  const STATUS_PRIORITY: StatusKey[] = ["delayed", "runningLate", "inProgress", "notStarted", "completed"];
  const rollupColor = (ts: ScheduleTask[]) => {
    const parents = ts.filter(t => !t.parentTaskId);
    for (const s of STATUS_PRIORITY) {
      if (parents.some(t => effectiveStatus(t) === s)) return STATUS_CONFIG[s].color;
    }
    return STATUS_CONFIG.notStarted.color;
  };

  const spanOf = (ts: ScheduleTask[]) => {
    const parents = ts.filter(t => !t.parentTaskId);
    if (!parents.length) return null;
    const start = parents.reduce((m, t) => parseDate(t.startDate) < parseDate(m) ? t.startDate : m, parents[0].startDate);
    const end   = parents.reduce((m, t) => parseDate(t.endDate)   > parseDate(m) ? t.endDate   : m, parents[0].endDate);
    let weightedSum = 0, totalDur = 0;
    parents.forEach(t => {
      const dur = Math.max(diffDays(t.startDate, t.endDate), 1);
      weightedSum += t.pct * dur;
      totalDur += dur;
    });
    const avg = totalDur > 0 ? Math.round(weightedSum / totalDur) : 0;
    return { start, end, avg };
  };

  const today = new Date().toISOString().split("T")[0];
  const todayOffsetDays = diffDays(chartStart, today);
  const todayX = todayOffsetDays * pixelsPerDay;

  // Map frontend status keys → backend DB values
  const toDbStatus = (s: string) => ({ notStarted: "not_started", inProgress: "in_progress", runningLate: "running_late", delayed: "delayed", completed: "completed" } as Record<string, string>)[s] ?? s;

  // Handlers
  const handleUpdateDates = (id: string, start: string, end: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, startDate: start, endDate: end, duration: `${diffDays(start, end)}d` } : t)));
    if (real) updateTask(id, { startDate: start, endDate: end }).catch(console.error);
  };
  const handleWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoomLevel(p => Math.max(0.1, Math.min(3, p - e.deltaY * 0.005))); } };
  const handleChangeDep = (idx: number, newType: string) => setDeps(p => p.map((d, i) => i === idx ? { ...d, type: newType as any } : d));

  const handleDeleteTask = (id: string) => {
    setTasks(p => p.filter(t => t.id !== id));
    setDeps(p => p.filter(d => d.from !== id && d.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleReoptimize = () => {
    setBannerDismissed(true);
  };

const handleSaveModal = (data: any, newPreds: any) => {
    setSaveError(null);
    let targetId = modalConfig.taskId;
    if (modalConfig.mode === "add") {
      targetId = `t_${Date.now()}`;
      const days = diffDays(data.startDate, data.endDate);
      const newTask = {
        id: targetId, projectId: 0, name: data.name, phase: data.phase, space: data.space || "General",
        contractor: data.contractor || "—", startDate: data.startDate, endDate: data.endDate,
        duration: `${days}d`, pct: data.pct ?? 0, status: data.status ?? "notStarted",
        critical: false, group: "", delay: null, left: 0, width: 0, photos: [] as string[],
      } as any;
      const optimisticTasks = [...tasks, newTask];
      setTasks(optimisticTasks);
      writeGanttCache(projectIdParam, { tasks: optimisticTasks, deps, depIds });
    } else {
      setTasks(p => p.map(t => t.id === targetId
        ? { ...t, ...data, duration: `${diffDays(data.startDate, data.endDate)}d` } : t));
    }
    setDeps(p => {
      const filtered = p.filter(d => d.to !== targetId);
      return [...filtered, ...newPreds.map((pr: any) => ({ from: pr.id, to: targetId, type: pr.type, label: pr.type }))];
    });
    if (real && workspaceId && targetId) {
      if (modalConfig.mode === "add") {
        createTask({
          workspaceId,
          projectId: projectIdParam,
          title: data.name,
          status: toDbStatus(data.status ?? "notStarted"),
          startDate: data.startDate,
          endDate: data.endDate,
          percentComplete: data.pct ?? 0,
          contractor: data.contractor || undefined,
          area: data.space || undefined,
          phase: data.phase || undefined,
          scheduleVersionId: versionId || undefined,
        }).then(created => {
          setTasks(p => p.map(t => t.id === targetId ? { ...t, id: created.id } : t));
          setDeps(p => p.map(d => d.to === targetId ? { ...d, to: created.id } : d));
          refreshTasks();
          newPreds.forEach((pr: any) => {
            createTaskDependency({ workspaceId: workspaceId!, predecessorId: pr.id, successorId: created.id, dependencyType: pr.type })
              .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(pr.id, created.id)]: r.id })); })
              .catch(console.error);
          });
        }).catch((err) => {
          console.error("createTask failed:", err);
          setSaveError("Failed to save task. Please try again.");
          setTasks(p => p.filter(t => t.id !== targetId));
        });
      } else if (modalConfig.mode === "edit") {
        updateTask(targetId, {
          title: data.name,
          status: toDbStatus(data.status),
          startDate: data.startDate,
          endDate: data.endDate,
          percentComplete: data.pct ?? 0,
          contractor: data.contractor || null,
          area: data.space || null,
          phase: data.phase || null,
        }).catch((err) => {
          console.error("updateTask failed:", err);
          setSaveError("Failed to save changes. Please try again.");
        });
      }
      // For edits: delete old deps then recreate (add mode handles deps in createTask.then above)
      if (modalConfig.mode === "edit") {
        const oldDeps = deps.filter(d => d.to === targetId);
        oldDeps.forEach(d => {
          const bid = depIds[depIdKey(d.from, d.to)];
          if (bid) deleteTaskDependency(bid).catch(console.error);
        });
        newPreds.forEach((pr: any) => {
          createTaskDependency({ workspaceId: workspaceId!, predecessorId: pr.id, successorId: targetId!, dependencyType: pr.type })
            .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(pr.id, targetId!)]: r.id })); })
            .catch(console.error);
        });
      }
    }
  };

  const handleExport = async () => {
    if (!chartRef.current || isExporting) return;
    setIsExporting(true);
    const prevPhases = new Set(collapsedPhases);
    const prevAreas  = new Set(collapsedAreas);
    const prevTasks  = new Set(collapsedTasks);
    setCollapsedPhases(new Set());
    setCollapsedAreas(new Set());
    setCollapsedTasks(new Set());
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        scrollX: 0, scrollY: 0,
        width: chartRef.current.scrollWidth, height: chartRef.current.scrollHeight,
        windowWidth: chartRef.current.scrollWidth, windowHeight: chartRef.current.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `gantt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCollapsedPhases(prevPhases);
      setCollapsedAreas(prevAreas);
      setCollapsedTasks(prevTasks);
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = tasks.map(t => ({
        "Task Name": t.name,
        "Phase": t.phase ?? "",
        "Group": t.group ?? "",
        "Space": t.space ?? "",
        "Start Date": t.startDate,
        "End Date": t.endDate,
        "Duration (days)": diffDays(t.startDate, t.endDate),
        "Progress %": t.pct,
        "Status": STATUS_CONFIG[t.status as StatusKey]?.label ?? t.status,
        "Contractor": t.contractor ?? "",
        "Delay": t.delay ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto column widths
      const colWidths = Object.keys(rows[0] ?? {}).map(k => ({
        wch: Math.max(k.length, ...rows.map(r => String((r as any)[k] ?? "").length)) + 2,
      }));
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Schedule");
      XLSX.writeFile(wb, `schedule-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderHeaders = () => {
    const showYearLevel = pixelsPerDay < 5;
    const upperTier: { label: string; days: number; startDayOffset: number }[] = [];
    const lowerTier: { label: string; days: number; offset: number }[] = [];

    let curUpperKey = ""; let daysInUpper = 0; let upperOffset = 0;
    let curMonthKey = ""; let daysInMonth = 0; let monthOffset = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(chartStart, i);
      const date = new Date(d);
      const upperKey = showYearLevel ? date.getFullYear().toString() : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (upperKey !== curUpperKey) {
        if (curUpperKey !== "") upperTier.push({ label: curUpperKey, days: daysInUpper, startDayOffset: upperOffset });
        curUpperKey = upperKey; daysInUpper = 1; upperOffset = i;
      } else daysInUpper++;

      if (pixelsPerDay >= 15) {
        lowerTier.push({ label: date.getDate().toString(), days: 1, offset: i });
      } else if (pixelsPerDay >= 5) {
        if (date.getDay() === 1) lowerTier.push({ label: formatDateStr(d), days: 7, offset: i });
      } else {
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthKey !== curMonthKey) {
          if (curMonthKey !== "") {
            lowerTier.push({
              label: new Date(addDays(chartStart, monthOffset)).toLocaleDateString("en-US", { month: "short" }),
              days: daysInMonth, offset: monthOffset,
            });
          }
          curMonthKey = monthKey; daysInMonth = 1; monthOffset = i;
        } else daysInMonth++;
      }
    }

    upperTier.push({ label: curUpperKey, days: daysInUpper, startDayOffset: upperOffset });
    if (curMonthKey && pixelsPerDay < 5) {
      lowerTier.push({
        label: new Date(addDays(chartStart, monthOffset)).toLocaleDateString("en-US", { month: "short" }),
        days: daysInMonth, offset: monthOffset,
      });
    }

    const showToday = todayOffsetDays >= 0 && todayOffsetDays <= totalDays;

    return (
      <div className="flex flex-col border-b border-[#E2E8F0] bg-[#F8FAFC] sticky top-0 z-20 overflow-visible" style={{ height: HEADER_H, width: timelineWidthPx }}>
        <div className="flex-1 flex border-b border-[#E2E8F0] relative">
          {upperTier.map((m, i) => (
            <div key={i} className="flex items-center justify-center text-[11px] font-semibold text-[#334155] border-r border-[#E2E8F0]" style={{ width: m.days * pixelsPerDay }}>
              {m.label}
            </div>
          ))}
          {showToday && (
            <div className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: todayX, top: 3 }}>
              <div className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-red-500 whitespace-nowrap leading-tight">TODAY</div>
            </div>
          )}
        </div>
        <div className="flex-1 flex relative">
          {lowerTier.map((item, i) => (
            <div key={i} className="absolute flex items-center justify-center text-[10px] text-[#94A3B8] font-medium border-l border-[#E2E8F0] h-full" style={{ left: item.offset * pixelsPerDay, width: item.days * pixelsPerDay }}>
              {item.label}
            </div>
          ))}
          {showToday && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none" style={{ left: todayX }} />
          )}
        </div>
      </div>
    );
  };

  const selectedTask = tasks.find(t => t.id === selectedId);
  const activePreset = getActivePreset(zoomLevel);
  const showReoptimizeBanner = !bannerDismissed && slipSummary.slippedTasks.length > 0;
  const lastUpdate = activity[0] || null;

  // Status filter chip — used in stats row and legend
  const StatusChip = ({
    label, count, color, active, onClick, dot = true,
  }: { label: string; count?: number; color: string; active: boolean; onClick: () => void; dot?: boolean }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-all border ${
        active ? "border-current shadow-sm" : "border-transparent hover:border-[#E2E8F0]"
      }`}
      style={{ color, background: active ? `${color}15` : "transparent" }}
    >
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      {count !== undefined && <span className="font-semibold tabular-nums">{count}</span>}
      <span>{label}</span>
    </button>
  );

  // Filter activity to the currently selected task (or show all)
  const taskActivity = selectedTask
    ? activity.filter(a => a.taskId === selectedTask.id || a.impact.toLowerCase().includes((selectedTask.phase || "").toLowerCase()))
    : [];

  if (dataLoading) {
    return (
      <div className="flex w-full h-full min-h-[600px] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white font-sans">
        <div className="flex-1 flex flex-col min-w-0 animate-pulse p-4 gap-3">
          <div className="flex items-center gap-3 pb-2 border-b border-[#E2E8F0]">
            <div className="h-5 w-20 bg-[#E2E8F0] rounded" />
            <div className="h-5 w-32 bg-[#E2E8F0] rounded-full" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 rounded bg-[#E2E8F0]" style={{ width: `${120 + (i % 3) * 40}px` }} />
              <div className="flex-1 h-4 bg-[#F1F5F9] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full min-h-[600px] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white font-sans relative">
      <div className="flex-1 flex flex-col min-w-0">

        {/* 1. Heading: title + live pill + stats */}
        <div className="px-4 py-2.5 border-b border-[#E2E8F0] bg-white flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-bold text-[#0F172A]">Gantt</span>
            <LiveStatusPill lastUpdate={lastUpdate} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Progress</span>
              <div className="w-[100px] h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div className="h-full bg-[#2563EB] transition-all" style={{ width: `${headerStats.overall}%` }} />
              </div>
              <span className="text-[14px] font-bold text-[#2563EB] tabular-nums">{headerStats.overall}%</span>
            </div>
            <div className="w-px h-4 bg-[#E2E8F0]" />
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                  {tasks.filter(t => !t.parentTaskId).length > 0 ? "Projected Handover" : "Planned Handover"}
                </span>
                <span className="text-[14px] font-bold text-[#0F172A]">
                  {headerStats.projectedEnd
                    ? new Date(headerStats.projectedEnd).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </span>
              </div>
              {headerStats.projectedEnd && projectEndDate && (() => {
                const diff = diffDays(projectEndDate, headerStats.projectedEnd);
                if (diff > 0) return <span className="text-[11px] font-semibold text-[#DC2626]">+{diff} days behind</span>;
                if (diff < 0) return <span className="text-[11px] font-semibold text-[#059669]">{diff} days ahead</span>;
                return <span className="text-[11px] font-semibold text-[#94A3B8]">On track</span>;
              })()}
            </div>
          </div>
        </div>

        {/* 2. Reoptimize banner (conditional) */}
        {showReoptimizeBanner && (
          <ReoptimizeBanner
            slipSummary={slipSummary}
            totalTasks={headerStats.total}
            onReoptimize={handleReoptimize}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {saveError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-[12px] text-red-700 font-medium flex items-center justify-between">
            <span>⚠ {saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-[14px] leading-none">✕</button>
          </div>
        )}

        {/* 3. Gap Check Panel */}
        {real && scheduleVersion && gapCheckGaps.length > 0 && (
          <GapCheckPanel
            scheduleVersionId={scheduleVersion.id}
            workspaceId={workspaceId!}
            projectId={projectIdParam}
            gaps={gapCheckGaps}
            onTaskAdded={refreshTasks}
          />
        )}

        {/* 4. Toolbar */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-wrap gap-3">

          <div className="flex items-center gap-4">

            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={showCriticalPath} onChange={() => setShowCriticalPath(!showCriticalPath)} className="sr-only peer" />
                <div className="w-9 h-5 bg-[#E2E8F0] rounded-full peer peer-checked:bg-[#2563EB] transition-colors"></div>
                <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full shadow transition-all peer-checked:translate-x-4"></div>
              </label>
              <span className="text-[13px] font-semibold text-[#475569] whitespace-nowrap">Critical path</span>
            </div>

            <div className="flex items-center gap-1 border-l border-[#E2E8F0] pl-4 h-6">
              <button onClick={zoomOut} disabled={zoomLevel <= 0.1}
                className="w-6 h-6 flex items-center justify-center rounded text-[14px] font-bold text-[#475569] hover:bg-[#E2E8F0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Zoom out">−</button>
              <select value={activePreset ?? ""} onChange={(e) => {
                const preset = ZOOM_PRESETS.find(p => p.label === e.target.value);
                if (preset) setZoomPreset(preset.value);
              }}
                className="h-7 pl-2 pr-6 text-[13px] font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
                {ZOOM_PRESETS.map((preset) => (<option key={preset.label} value={preset.label}>{preset.label}</option>))}
              </select>
              <button onClick={zoomIn} disabled={zoomLevel >= 3}
                className="w-6 h-6 flex items-center justify-center rounded text-[14px] font-bold text-[#475569] hover:bg-[#E2E8F0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Zoom in">+</button>
              <span className="text-[10px] text-[#94A3B8] font-mono tabular-nums ml-0.5 min-w-[32px] text-right">{Math.round(zoomLevel * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">

            <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md px-2.5 py-1.5 bg-white shadow-sm focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] transition-all">
              <Search size={12} className="text-[#94A3B8] shrink-0" />
              <input type="text" placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] border-none outline-none bg-transparent w-40" />
            </div>

            <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)}
              className="h-8 pl-2 pr-6 text-[13px] font-medium text-[#0F172A] border border-[#E2E8F0] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#2563EB] outline-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
              {contractorOptions.map(c => <option key={c} value={c}>{c === "All" ? "All contractors" : c}</option>)}
            </select>

            <select value={filterSpace} onChange={e => setFilterSpace(e.target.value)}
              className="h-8 pl-2 pr-6 text-[13px] font-medium text-[#0F172A] border border-[#E2E8F0] rounded-md bg-white shadow-sm appearance-none cursor-pointer focus:border-[#2563EB] outline-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2357606a'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
              {spaceOptions.map(s => <option key={s} value={s}>{s === "All" ? "All spaces" : s}</option>)}
            </select>

            {/* Download dropdown */}
            <div className="relative">
              {showExportMenu && (
                <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
              )}
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 h-8 text-[13px] font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-md shadow-sm hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <svg className="animate-spin w-3.5 h-3.5 text-[#64748B]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                )}
                {isExporting ? "Downloading…" : "Download"}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-[#94A3B8]"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>

              {showExportMenu && !isExporting && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => { setShowExportMenu(false); handleExport(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 21V9"/></svg>
                    Export as PNG
                  </button>
                  <button
                    onClick={() => { setShowExportMenu(false); handleExportExcel(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Export as Excel
                  </button>
                </div>
              )}
            </div>

            {canEdit && (
              <button
                onClick={() => {
                  setModalConfig({ isOpen: true, mode: "add", taskId: null, defaultPhase: "", defaultArea: "" });
                }}
                title={undefined}
                className="px-4 py-1.5 text-[13px] font-semibold bg-[#2563EB] text-white rounded-md flex items-center gap-1.5 shadow-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2563EB]">
                + Add task
              </button>
            )}
          </div>
        </div>

        {/* 5. Status legend → clickable filter chips with counts */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#E2E8F0] bg-white">
          {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => {
            const countMap: Record<StatusKey, number> = {
              completed:   headerStats.completed,
              inProgress:  headerStats.inProgress,
              runningLate: headerStats.runningLate,
              delayed:     headerStats.delayed,
              notStarted:  headerStats.notStarted,
            };
            return (
              <StatusChip key={key} label={cfg.label} count={countMap[key]} color={cfg.color}
                active={filterStatus === key}
                onClick={() => setFilterStatus(filterStatus === key ? "All" : key)}
              />
            );
          })}
          {filterStatus !== "All" && (
            <button onClick={() => setFilterStatus("All")} className="ml-1 text-[10px] text-[#64748B] hover:text-[#1E293B] underline">Clear</button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => {
              if (chartRef.current) {
                const visibleW = chartRef.current.clientWidth - leftPanelW;
                chartRef.current.scrollLeft = Math.max(0, todayX - visibleW / 2);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 h-6 text-[11px] font-semibold text-white bg-[#EF4444] rounded-md hover:bg-[#DC2626] transition-colors shrink-0"
          >
            ← Today
          </button>
        </div>

        {/* 6. Chart Area */}
        <div ref={chartRef} className="flex-1 overflow-auto relative flex" id="chart-scroll"
          onWheel={handleWheel}
          onMouseMove={e => {
            if ((drawingDep || movingDep) && rowsRef.current) {
              const rect = rowsRef.current.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
          }}
          onMouseUp={() => { setDrawingDep(null); setMovingDep(null); }}
        >
          {/* Frozen Left Column */}
          <div className="sticky left-0 z-30 bg-white border-r border-[#E2E8F0] shadow-[1px_0_0_0_#e5e7eb]" style={{ width: leftPanelW, minWidth: leftPanelW, minHeight: HEADER_H + Math.max(totalH, 600) }}>
            <div className="flex items-center border-b text-[13px] font-semibold text-[#64748B]" style={{ height: HEADER_H }}>
              <div className="flex-1 px-4 bg-[#F1F5F9] h-full flex items-center justify-between">
                <span>Task name</span>
                {!showContractors && (
                  <button onClick={() => setShowContractors(true)} className="text-[11px] text-[#A5B4FC] hover:text-[#4F46E5] outline-none focus:outline-none pr-1" title="Show contractors">Contractors ▶</button>
                )}
              </div>
              {showContractors && (
                <div className="w-[160px] shrink-0 border-l-2 border-[#E2E8F0] flex items-center justify-between px-3 h-full bg-[#EEF2FF] text-[#4F46E5]">
                  <span>Contractors</span>
                  <button onClick={() => setShowContractors(false)} className="text-[11px] text-[#A5B4FC] hover:text-[#4F46E5] outline-none focus:outline-none" title="Hide contractors">◀</button>
                </div>
              )}
              <div className="w-[60px] shrink-0 border-l-2 border-[#E2E8F0] bg-[#F1F5F9] h-full" />
            </div>
            <div>
              {groupedData.map(([phase, areas]) => {
                const avg = phaseAvgPct(areas);
                const collapsed = collapsedPhases.has(phase);
                return (
                  <div key={`col-${phase}`}>
                    <div className="flex items-center border-b bg-[#F8FAFC] cursor-pointer hover:bg-[#F1F5F9] transition-colors" style={{ height: GROUP_H }} onClick={() => togglePhase(phase)}>
                      <div className="w-[3px] shrink-0 h-full" style={{ background: PHASE_COLOR_MAP[phase] ?? DEFAULT_PHASE_COLOR }} />
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-2 h-full">
                        <span className="text-[10px] text-[#94A3B8] shrink-0">{collapsed ? "▶" : "▼"}</span>
                        <span className="text-[14px] font-semibold text-[#1E293B] truncate">{phase}</span>
                      </div>
                      {showContractors && <div className="w-[160px] shrink-0 h-full bg-[#F0F4FF] border-l-2 border-[#E2E8F0]" />}
                      {(() => {
                        const phaseColor = rollupColor(areas.flatMap(([, ts]) => ts as ScheduleTask[]));
                        return (
                          <div className="w-[60px] flex items-center justify-end gap-1 shrink-0 pr-1 border-l-2 border-[#E2E8F0] bg-[#F1F5F9] h-full">
                            <DonutRing pct={avg} size={18} color={phaseColor} />
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: phaseColor }}>{avg}%</span>
                          </div>
                        );
                      })()}
                    </div>
                    {!collapsed && areas.map(([area, ts]) => {
                      const areaKey = `${phase}__${area}`;
                      const areaCollapsed = collapsedAreas.has(areaKey);
                      const showAreaRow = area !== "General" || areas.length > 1;
                      return (
                        <div key={`col-${phase}-${area}`}>
                          {showAreaRow && (
                          <div className="flex items-center border-b bg-[#F8FAFC] cursor-pointer hover:bg-slate-100 transition-colors" style={{ height: AREA_H }} onClick={() => toggleArea(areaKey)}>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-5 h-full">
                              <span className="text-[9px] text-[#94A3B8] shrink-0">{areaCollapsed ? "▶" : "▼"}</span>
                              <span className="text-[12px] font-semibold text-[#475569] truncate">{area}</span>
                            </div>
                            {showContractors && <div className="w-[160px] shrink-0 h-full bg-[#F5F3FF]/30 border-l-2 border-[#E2E8F0]" />}
                            <div className="w-[60px] shrink-0 h-full flex items-center justify-center border-l-2 border-[#E2E8F0] bg-[#F1F5F9]">
                              <button onClick={e => { e.stopPropagation(); setModalConfig({ isOpen: true, mode: "add", taskId: null, defaultPhase: phase, defaultArea: area }); }}
                                className="w-5 h-5 flex items-center justify-center rounded text-[#94A3B8] hover:bg-blue-100 hover:text-blue-600 text-[14px] font-bold leading-none" title={`Add task to ${area}`}>+</button>
                            </div>
                          </div>
                          )}
                          {(!showAreaRow || !areaCollapsed) && ts.filter(t => !t.parentTaskId).flatMap((t) => {
                            const taskCollapsed = collapsedTasks.has(t.id);
                            const hasChildren = ts.some(s => s.parentTaskId === t.id);
                            const rows = [];
                            rows.push(
                              <div key={`name-${t.id}`}
                                className={`flex items-center border-b cursor-pointer ${selectedId === t.id ? "bg-blue-50" : "hover:bg-[#F8FAFC]"}`}
                                style={{ height: ROW_H, opacity: showCriticalPath && !criticalPathTasks.has(t.id) ? 0.4 : 1 }}
                                onClick={() => setSelectedId(t.id)}
                              >
                                <div className="flex items-center gap-1 flex-1 min-w-0 pl-2 h-full">
                                <span className="text-[10px] text-[#94A3B8] font-mono shrink-0 w-[38px] text-right pr-1.5">{wbsMap[t.id]}</span>
                                <span className="text-[9px] text-[#94A3B8] shrink-0 w-3 text-center cursor-pointer"
                                  onClick={e => { e.stopPropagation(); if (hasChildren) toggleTask(t.id); }}>
                                  {hasChildren ? (taskCollapsed ? "▶" : "▼") : ""}
                                </span>
                                <span className="truncate text-[14px] font-medium text-[#0F172A] flex-1 min-w-0">{t.name}</span>
                                </div>
                                {showContractors && (
                                  <span className="w-[160px] shrink-0 border-l-2 border-[#E2E8F0] px-3 text-[12px] text-[#4F46E5] font-medium truncate bg-[#F5F3FF]/60">{t.contractor || "—"}</span>
                                )}
                                <div className="w-[60px] flex items-center justify-end gap-1 shrink-0 pr-1 border-l-2 border-[#E2E8F0] bg-[#F8FAFC]">
                                  <DonutRing pct={t.pct} size={18} color={STATUS_CONFIG[effectiveStatus(t)].color} />
                                  <span className="text-[11px] font-bold tabular-nums" style={{ color: STATUS_CONFIG[effectiveStatus(t)].color }}>{t.pct}%</span>
                                </div>
                              </div>
                            );
                            if (!taskCollapsed) {
                              ts.filter(s => s.parentTaskId === t.id).forEach(s => {
                                rows.push(
                                  <div key={`name-${s.id}`}
                                    onClick={() => setSelectedId(s.id)}
                                    className={`flex items-center border-b cursor-pointer ${selectedId === s.id ? "bg-blue-50" : "hover:bg-[#F8FAFC]"}`}
                                    style={{ height: SUB_ROW_H, opacity: showCriticalPath && !criticalPathTasks.has(s.id) ? 0.4 : 1 }}
                                  >
                                    <div className="flex items-center gap-1 flex-1 min-w-0 pl-2 h-full">
                                    <span className="text-[10px] text-[#94A3B8] font-mono shrink-0 w-[38px] text-right pr-1.5">{wbsMap[s.id]}</span>
                                    <span className="w-3 shrink-0 text-[#CBD5E1] text-[10px] text-center">└</span>
                                    <span className="truncate text-[13px] text-[#475569] flex-1 min-w-0 font-medium">{s.name}</span>
                                    </div>
                                    {showContractors && (
                                      <span className="w-[160px] shrink-0 border-l-2 border-[#E2E8F0] px-3 text-[12px] text-[#6366F1] truncate bg-[#F5F3FF]/40">{s.contractor || "—"}</span>
                                    )}
                                    <div className="w-[60px] flex items-center justify-end gap-1 shrink-0 pr-1 border-l-2 border-[#E2E8F0] bg-[#F8FAFC]">
                                      <DonutRing pct={s.pct} size={18} color={STATUS_CONFIG[effectiveStatus(s)].color} />
                                      <span className="text-[11px] tabular-nums" style={{ color: STATUS_CONFIG[effectiveStatus(s)].color }}>{s.pct}%</span>
                                    </div>
                                  </div>
                                );
                              });
                            }
                            return rows;
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Timeline Area */}
          <div className="relative" style={{ width: timelineWidthPx }} ref={timelineRef}>
            {renderHeaders()}
            <div className="relative" style={{ minHeight: Math.max(totalH, 600) }} ref={rowsRef}>
              {Array.from({ length: totalDays }).map((_, i) => {
                const date = new Date(new Date(chartStart).getTime() + i * MS_PER_DAY);
                const dow = date.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isAltWeek = Math.floor(i / 7) % 2 === 1;
                if (!isWeekend && !isAltWeek) return null;
                return (
                  <div key={i} className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: i * pixelsPerDay, width: pixelsPerDay, background: isWeekend ? "rgba(219,228,255,0.45)" : "rgba(240,242,255,0.25)" }} />
                );
              })}
              {todayOffsetDays >= 0 && todayOffsetDays <= totalDays && (
                <div className="absolute top-0 pointer-events-none z-10" style={{ left: todayX - 1, width: 2, height: totalH, background: "#ef4444", opacity: 0.7 }} />
              )}

              {groupedData.map(([phase, areas]) => {
                const collapsed = collapsedPhases.has(phase);
                const phaseTasks = areas.flatMap(([, ts]) => ts);
                const phaseSpan = spanOf(phaseTasks);
                const phaseColor = rollupColor(phaseTasks);
                const phaseAccent = PHASE_COLOR_MAP[phase] ?? DEFAULT_PHASE_COLOR;
                const phaseLeftPx  = phaseSpan ? diffDays(chartStart, phaseSpan.start) * pixelsPerDay : 0;
                const phaseWidthPx = phaseSpan ? Math.max(4, diffDays(phaseSpan.start, phaseSpan.end) * pixelsPerDay) : 0;
                const phaseHasCritical = phaseTasks.some(t => criticalPathTasks.has(t.id));
                const phaseBarOpacity = showCriticalPath && !phaseHasCritical ? 0.2 : 1;
                return (
                  <div key={`time-${phase}`}>
                    <div className="relative border-b border-[#E2E8F0] bg-[#F8FAFC]/30" style={{ height: GROUP_H }}>
                      {phaseSpan && (
                        <div className="absolute transition-opacity"
                          style={{ top: 8, left: phaseLeftPx, width: phaseWidthPx, height: GROUP_H - 16, opacity: phaseBarOpacity }}>
                          <div className="absolute inset-0 rounded overflow-hidden" style={{ background: `${phaseAccent}18`, border: `1.5px solid ${phaseAccent}` }}>
                            <div className="absolute left-0 top-0 bottom-0 rounded-l" style={{ width: `${phaseSpan.avg}%`, background: phaseColor }} />
                            {phaseWidthPx >= 40 && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold whitespace-nowrap px-1"
                                  style={{ color: phaseSpan.avg >= 50 ? "white" : phaseAccent, textShadow: phaseSpan.avg >= 50 ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}>{phaseSpan.avg}%</span>
                              </div>
                            )}
                          </div>
                          {phaseWidthPx < 40 && (
                            <span className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold pointer-events-none whitespace-nowrap"
                              style={{ left: phaseWidthPx + 4, color: phaseAccent }}>{phaseSpan.avg}%</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!collapsed && areas.map(([area, ts]) => {
                      const areaKey = `${phase}__${area}`;
                      const areaCollapsed = collapsedAreas.has(areaKey);
                      const showAreaRow = area !== "General" || areas.length > 1;
                      const areaColor = rollupColor(ts);
                      const areaSpan = spanOf(ts);
                      const areaLeftPx  = areaSpan ? diffDays(chartStart, areaSpan.start) * pixelsPerDay : 0;
                      const areaWidthPx = areaSpan ? Math.max(4, diffDays(areaSpan.start, areaSpan.end) * pixelsPerDay) : 0;
                      const areaHasCritical = ts.some(t => criticalPathTasks.has(t.id));
                      const areaBarOpacity = showCriticalPath && !areaHasCritical ? 0.2 : 1;
                      return (
                        <div key={`time-${phase}-${area}`}>
                          {showAreaRow && <div className="relative border-b border-[#F1F5F9] bg-[#F8FAFC]/60" style={{ height: AREA_H }}>
                            {areaSpan && (
                              <div className="absolute transition-opacity" style={{ top: 5, left: areaLeftPx, width: areaWidthPx, height: AREA_H - 10, opacity: areaBarOpacity }}>
                                <div className="absolute inset-0 rounded overflow-hidden" style={{ background: `${areaColor}25`, border: `1px solid ${areaColor}` }}>
                                  <div className="absolute left-0 top-0 bottom-0 rounded-l" style={{ width: `${areaSpan.avg}%`, background: areaColor }} />
                                  {areaWidthPx >= 36 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <span className="text-[9px] font-bold whitespace-nowrap px-1"
                                        style={{ color: areaSpan.avg >= 50 ? "white" : areaColor, textShadow: areaSpan.avg >= 50 ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}>{areaSpan.avg}%</span>
                                    </div>
                                  )}
                                </div>
                                {areaWidthPx < 36 && (
                                  <span className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold pointer-events-none whitespace-nowrap"
                                    style={{ left: areaWidthPx + 4, color: areaColor }}>{areaSpan.avg}%</span>
                                )}
                              </div>
                            )}
                          </div>}
                          {(!showAreaRow || !areaCollapsed) && ts.filter(t => !t.parentTaskId).flatMap((t) => {
                            const taskCollapsed = collapsedTasks.has(t.id);
                            const rows = [
                              <GanttRow key={t.id} t={t} selected={selectedId === t.id}
                                chartStart={chartStart} pixelsPerDay={pixelsPerDay}
                                onSelect={() => setSelectedId(t.id)} onUpdateDates={canEdit ? handleUpdateDates : undefined}
                                isOnCriticalPath={criticalPathTasks.has(t.id)} showCriticalPath={showCriticalPath}
                                showBaseline={showBaseline} drawingDep={drawingDep} movingDep={movingDep}
                                rowAbsoluteY={taskYMap[t.id]}
                                onStartConnection={canEdit ? (fromId: string, side: "start"|"end", barX: number, barY: number) => {
                                  setDrawingDep({ fromId, fromSide: side, x: barX, y: barY });
                                } : undefined}
                                onDropConnection={canEdit ? (toId: string, toSide: "start"|"end") => {
                                  if (!drawingDep || drawingDep.fromId === toId) { setDrawingDep(null); return; }
                                  const fs = drawingDep.fromSide; const ts2 = toSide;
                                  const type = fs === "end" && ts2 === "start" ? "FS" : fs === "start" && ts2 === "start" ? "SS" : fs === "end" && ts2 === "end" ? "FF" : "SF";
                                  const fromId = drawingDep.fromId;
                                  setDeps(p => [...p.filter(d => !((d.from === fromId && d.to === toId) || (d.from === toId && d.to === fromId))), { from: fromId, to: toId, type, label: type }]);
                                  setDrawingDep(null);
                                  if (real && workspaceId) {
                                    createTaskDependency({ workspaceId, predecessorId: fromId, successorId: toId, dependencyType: type })
                                      .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(fromId, toId)]: r.id })); })
                                      .catch(console.error);
                                  }
                                } : undefined}
                                onDropEndpointMove={(toId: string) => {
                                  if (!movingDep) return;
                                  const dep = deps[movingDep.depIdx];
                                  if (!dep) { setMovingDep(null); return; }
                                  const oldFrom = dep.from; const oldTo = dep.to;
                                  const newDep = movingDep.end === "from"
                                    ? { ...dep, from: toId }
                                    : { ...dep, to: toId };
                                  if (newDep.from === newDep.to) { setMovingDep(null); return; }
                                  setDeps(p => p.map((d, idx) => idx === movingDep.depIdx ? newDep : d).filter((d, idx) => idx === movingDep.depIdx || !((d.from === newDep.from && d.to === newDep.to) || (d.from === newDep.to && d.to === newDep.from))));
                                  setMovingDep(null);
                                  if (real && workspaceId) {
                                    const bid = depIds[depIdKey(oldFrom, oldTo)];
                                    if (bid) deleteTaskDependency(bid).catch(console.error);
                                    createTaskDependency({ workspaceId, predecessorId: newDep.from, successorId: newDep.to, dependencyType: newDep.type })
                                      .then(r => { if (r) setDepIds(p => { const n = { ...p }; delete n[depIdKey(oldFrom, oldTo)]; n[depIdKey(newDep.from, newDep.to)] = r.id; return n; }); })
                                      .catch(console.error);
                                  }
                                }}
                              />
                            ];
                            if (!taskCollapsed) {
                              ts.filter(s => s.parentTaskId === t.id).forEach(s => rows.push(
                                <GanttRow key={s.id} t={s} selected={selectedId === s.id}
                                  chartStart={chartStart} pixelsPerDay={pixelsPerDay}
                                  onSelect={() => setSelectedId(s.id)} onUpdateDates={canEdit ? handleUpdateDates : undefined}
                                  isOnCriticalPath={criticalPathTasks.has(s.id)} showCriticalPath={showCriticalPath}
                                  showBaseline={showBaseline} drawingDep={drawingDep} movingDep={movingDep}
                                  rowAbsoluteY={taskYMap[s.id]}
                                  onStartConnection={canEdit ? (fromId: string, side: "start"|"end", barX: number, barY: number) => {
                                    setDrawingDep({ fromId, fromSide: side, x: barX, y: barY });
                                  } : undefined}
                                  onDropConnection={canEdit ? (toId: string, toSide: "start"|"end") => {
                                    if (!drawingDep || drawingDep.fromId === toId) { setDrawingDep(null); return; }
                                    const fs = drawingDep.fromSide; const ts2 = toSide;
                                    const type = fs === "end" && ts2 === "start" ? "FS" : fs === "start" && ts2 === "start" ? "SS" : fs === "end" && ts2 === "end" ? "FF" : "SF";
                                    const fromId = drawingDep.fromId;
                                    setDeps(p => [...p.filter(d => !((d.from === fromId && d.to === toId) || (d.from === toId && d.to === fromId))), { from: fromId, to: toId, type, label: type }]);
                                    setDrawingDep(null);
                                    if (real && workspaceId) {
                                      createTaskDependency({ workspaceId, predecessorId: fromId, successorId: toId, dependencyType: type })
                                        .then(r => { if (r) setDepIds(p => ({ ...p, [depIdKey(fromId, toId)]: r.id })); })
                                        .catch(console.error);
                                    }
                                  } : undefined}
                                  onDropEndpointMove={(toId: string) => {
                                    if (!movingDep) return;
                                    const dep = deps[movingDep.depIdx];
                                    if (!dep) { setMovingDep(null); return; }
                                    const oldFrom = dep.from; const oldTo = dep.to;
                                    const newDep = movingDep.end === "from"
                                      ? { ...dep, from: toId }
                                      : { ...dep, to: toId };
                                    if (newDep.from === newDep.to) { setMovingDep(null); return; }
                                    setDeps(p => p.map((d, idx) => idx === movingDep.depIdx ? newDep : d).filter((d, idx) => idx === movingDep.depIdx || !((d.from === newDep.from && d.to === newDep.to) || (d.from === newDep.to && d.to === newDep.from))));
                                    setMovingDep(null);
                                    if (real && workspaceId) {
                                      const bid = depIds[depIdKey(oldFrom, oldTo)];
                                      if (bid) deleteTaskDependency(bid).catch(console.error);
                                      createTaskDependency({ workspaceId, predecessorId: newDep.from, successorId: newDep.to, dependencyType: newDep.type })
                                        .then(r => { if (r) setDepIds(p => { const n = { ...p }; delete n[depIdKey(oldFrom, oldTo)]; n[depIdKey(newDep.from, newDep.to)] = r.id; return n; }); })
                                        .catch(console.error);
                                    }
                                  }}
                                />
                              ));
                            }
                            return rows;
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <SVGArrows
                deps={deps} tasks={filteredTasks} taskYMap={taskYMap}
                chartStart={chartStart} pixelsPerDay={pixelsPerDay} totalH={totalH}
                showCriticalPath={showCriticalPath} criticalPathTasks={criticalPathTasks}
                drawingDep={drawingDep} movingDep={movingDep} mousePos={mousePos}
                onStartEndpointMove={(depIdx: number, end: "from"|"to", anchorX: number, anchorY: number) => {
                  setMovingDep({ depIdx, end, anchorX, anchorY });
                }}
                onDeleteDep={(i: number) => {
                  const dep = deps[i];
                  setDeps(p => p.filter((_, idx) => idx !== i));
                  if (real && dep) {
                    const bid = depIds[depIdKey(dep.from, dep.to)];
                    if (bid) deleteTaskDependency(bid).catch(console.error);
                    setDepIds(p => { const n = { ...p }; delete n[depIdKey(dep.from, dep.to)]; return n; });
                  }
                }}
                onChangeDep={handleChangeDep}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {selectedTask && (
        <TaskDetailPanel task={selectedTask} deps={deps} tasks={filteredTasks} criticalPathTasks={criticalPathTasks} onClose={() => setSelectedId(null)} onEditClick={() => { setSelectedId(null); setModalConfig({ isOpen: true, mode: "edit", taskId: selectedTask.id, defaultPhase: "", defaultArea: "" }); }} onDelete={handleDeleteTask} />
      )}

      {/* Modal */}
      <TaskModal isOpen={modalConfig.isOpen} mode={modalConfig.mode} task={tasks.find(t => t.id === modalConfig.taskId)} tasks={filteredTasks} deps={deps} defaultPhase={modalConfig.defaultPhase} defaultArea={modalConfig.defaultArea} projectStartDate={projectStartDate} projectEndDate={projectEndDate} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} onSave={handleSaveModal} onDelete={handleDeleteTask} />
    </div>
  );
}

export default function GanttChart() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#94A3B8]">Loading...</div>}>
      <GanttChartContent />
    </Suspense>
  );
}