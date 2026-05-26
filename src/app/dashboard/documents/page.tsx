"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import {
  Search, Pencil, Trash2, FileText, Ruler, BarChart2, ScrollText,
  Archive, Box, Upload, Inbox, Download, X, FolderOpen, Clock,
  ChevronUp, ChevronDown, Plus, MoreVertical, CheckCircle, XCircle,
  LayoutList, LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/workspace";
import {
  fetchProjects, fetchDocuments, isRealProject, registerDocument,
  updateDocumentApproval, type BackendProject,
} from "@/lib/api-client";
import { uploadFileToStorage } from "@/lib/supabase-storage";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface FileRecord {
  id: number;
  backendId?: string;
  folderId: string;
  name: string;
  date: string;
  docType: string;
  format: string;
  size?: string;
  uploadedBy: string;
  approvedBy: string | null;
  approvalStatus: ApprovalStatus;
  ver: string;
  url?: string;
}

interface Folder {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  isBuiltin?: boolean;
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: keyof FileRecord | null; direction: SortDirection; }

type AuditAction = "uploaded" | "approved" | "rejected" | "deleted" | "renamed";

interface AuditEvent {
  id: number;
  action: AuditAction;
  fileName: string;
  folderId: string;
  user: string;
  timestamp: string;
  detail?: string;
}

const AUDIT_STYLE: Record<AuditAction, { color: string; bg: string; label: string }> = {
  uploaded: { color: "#2563EB", bg: "#EFF6FF",  label: "Uploaded" },
  approved: { color: "#059669", bg: "#ECFDF5",  label: "Approved" },
  rejected: { color: "#DC2626", bg: "#FEF2F2",  label: "Rejected" },
  deleted:  { color: "#D97706", bg: "#FFFBEB",  label: "Deleted"  },
  renamed:  { color: "#7C3AED", bg: "#F5F3FF",  label: "Renamed"  },
};

const INITIAL_AUDIT: AuditEvent[] = [
  { id: 101, action: "uploaded", fileName: "Foundation_Layout_v3.pdf",  folderId: "drawings", user: "Aayush P.",    timestamp: "Mar 12, 2:30 PM" },
  { id: 102, action: "approved", fileName: "Foundation_Layout_v3.pdf",  folderId: "drawings", user: "Meera S.",     timestamp: "Mar 12, 3:45 PM" },
  { id: 103, action: "uploaded", fileName: "Foundation_Layout_v2.pdf",  folderId: "drawings", user: "Aayush P.",    timestamp: "Feb 28, 10:00 AM" },
  { id: 104, action: "uploaded", fileName: "Foundation_Layout_v1.pdf",  folderId: "drawings", user: "Aayush P.",    timestamp: "Jan 15, 9:00 AM" },
  { id: 105, action: "uploaded", fileName: "Structural_Drawings.dwg",   folderId: "drawings", user: "Meera S.",     timestamp: "Mar 10, 11:00 AM" },
  { id: 106, action: "uploaded", fileName: "Progress_Report_Mar.pdf",   folderId: "reports",  user: "Current User", timestamp: "Mar 28, 1:16 PM" },
  { id: 107, action: "uploaded", fileName: "Master_BOQ_v1.xlsx",        folderId: "boqs",     user: "Current User", timestamp: "Mar 28, 1:02 PM" },
  { id: 108, action: "rejected", fileName: "Master_BOQ_v1.xlsx",        folderId: "boqs",     user: "Meera S.",     timestamp: "Mar 29, 9:30 AM" },
];

const FOLDER_DOC_TYPES: Record<string, string[]> = {
  drawings: ["Architectural", "Structural", "MEP", "Civil", "Landscape", "Other Drawing"],
  reports:  ["Progress Report", "Geotechnical Report", "Environmental Report", "MEP Report", "Site Report", "Other Report"],
  permits:  ["Building Permit", "NOC", "Environmental Permit", "Safety Permit", "Other Permit"],
  boqs:     ["Master BOQ", "Civil BOQ", "MEP BOQ", "Structural BOQ", "Other BOQ"],
};

const INITIAL_FOLDERS: Folder[] = [
  { id: "drawings", name: "Drawings",  description: "Architectural, Structural, MEP", Icon: Ruler,      color: "#2563EB", bg: "#EFF6FF", isBuiltin: true },
  { id: "reports",  name: "Reports",   description: "Progress, Geo, Environmental",   Icon: FileText,   color: "#7C3AED", bg: "#F5F3FF", isBuiltin: true },
  { id: "permits",  name: "Permits",   description: "Building, NOC, Safety",           Icon: ScrollText, color: "#0891B2", bg: "#ECFEFF", isBuiltin: true },
  { id: "boqs",     name: "BOQs",      description: "Master, Civil, MEP, Structural",  Icon: BarChart2,  color: "#059669", bg: "#ECFDF5", isBuiltin: true },
];

const CUSTOM_FOLDER_PALETTE: Array<{ color: string; bg: string }> = [
  { color: "#DB2777", bg: "#FDF2F8" },
  { color: "#D97706", bg: "#FFFBEB" },
  { color: "#0D9488", bg: "#F0FDFA" },
  { color: "#6366F1", bg: "#EEF2FF" },
  { color: "#EA580C", bg: "#FFF7ED" },
  { color: "#0369A1", bg: "#F0F9FF" },
];

const INITIAL_FILES: FileRecord[] = [
  { id: 1, folderId: "drawings", name: "Foundation_Layout_v3.pdf",     date: "Mar 12, 2:30 PM",  docType: "Structural",    format: "PDF",  size: "2.4 MB",  uploadedBy: "Aayush P.",    approvedBy: "Meera S.",  approvalStatus: "approved", ver: "v3" },
  { id: 2, folderId: "drawings", name: "Structural_Drawings.dwg",      date: "Mar 10, 11:00 AM", docType: "Structural",    format: "DWG",  size: "8.1 MB",  uploadedBy: "Meera S.",     approvedBy: null,        approvalStatus: "pending",  ver: "v2" },
  { id: 3, folderId: "reports",  name: "Progress_Report_Mar.pdf",      date: "Mar 28, 1:16 PM",  docType: "Progress Report", format: "PDF", size: "1.2 MB", uploadedBy: "Current User", approvedBy: null,        approvalStatus: "pending",  ver: "v1" },
  { id: 4, folderId: "boqs",     name: "Master_BOQ_v1.xlsx",           date: "Mar 28, 1:02 PM",  docType: "Master BOQ",    format: "XLSX", size: "512 KB",  uploadedBy: "Current User", approvedBy: null,        approvalStatus: "rejected", ver: "v1" },
];

const FORMAT_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  PDF:  { bar: "#EF4444", badge: "#FEF2F2", text: "#DC2626" },
  DWG:  { bar: "#2563EB", badge: "#EFF6FF", text: "#2563EB" },
  DXF:  { bar: "#3B82F6", badge: "#EFF6FF", text: "#1D4ED8" },
  IFC:  { bar: "#7C3AED", badge: "#F5F3FF", text: "#7C3AED" },
  XLSX: { bar: "#059669", badge: "#ECFDF5", text: "#059669" },
  ZIP:  { bar: "#D97706", badge: "#FFFBEB", text: "#D97706" },
  PNG:  { bar: "#0891B2", badge: "#ECFEFF", text: "#0891B2" },
  JPG:  { bar: "#0891B2", badge: "#ECFEFF", text: "#0891B2" },
  DEFAULT: { bar: "#94A3B8", badge: "#F1F5F9", text: "#475569" },
};

function getFormatStyle(format: string) {
  return FORMAT_COLORS[format.toUpperCase()] ?? FORMAT_COLORS.DEFAULT;
}

function formatInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#2563EB","#7C3AED","#059669","#D97706","#0891B2","#DB2777"];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => {
  const cfg = {
    approved: { bg: "#ECFDF5", color: "#059669", label: "Approved" },
    rejected: { bg: "#FEF2F2", color: "#DC2626", label: "Rejected" },
    pending:  { bg: "#FFFBEB", color: "#D97706", label: "Pending"  },
  }[status];
  return (
    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

function FileIcon({ format, size = 15 }: { format: string; size?: number }) {
  const f = format.toUpperCase();
  if (["DWG","DXF"].includes(f)) return <Ruler size={size} />;
  if (["ZIP","RAR"].includes(f)) return <Archive size={size} />;
  if (["3DS","OBJ","IFC","FBX","DAE","GLB"].includes(f)) return <Box size={size} />;
  return <FileText size={size} />;
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronUp size={11} className="text-[#CBD5E1]" />;
  return direction === "asc"
    ? <ChevronUp size={11} className="text-[#2563EB]" />
    : <ChevronDown size={11} className="text-[#2563EB]" />;
}

function DocumentsPageContent() {
  const searchParams = useSearchParams();
  const { workspaceId: ctxWorkspaceId, isDesignMode, loading: wsLoading } = useWorkspace();
  const projectIdParam = searchParams.get("projectId") ?? "0";
  const urlWorkspaceId = searchParams.get("workspaceId");
  const workspaceId = urlWorkspaceId ?? ctxWorkspaceId;

  const [backendProjects, setBackendProjects] = useState<BackendProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    (!isDesignMode && isRealProject(projectIdParam)) ? projectIdParam : null
  );

  useEffect(() => {
    if (!isDesignMode && isRealProject(projectIdParam)) setActiveProjectId(projectIdParam);
  }, [projectIdParam]);

  const real = !isDesignMode && isRealProject(activeProjectId ?? "") && !!workspaceId;
  const [files, setFiles] = useState<FileRecord[]>(isDesignMode ? INITIAL_FILES : []);
  const [activeFolderId, setActiveFolderId] = useState<string>("drawings");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: "asc" });

  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);
  const [editError, setEditError] = useState("");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadDocType, setUploadDocType] = useState<string>("");
  const [uploadFileVersion, setUploadFileVersion] = useState<string>("v1");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  const [auditLog, setAuditLog] = useState<AuditEvent[]>(isDesignMode ? INITIAL_AUDIT : []);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filterApproval, setFilterApproval] = useState<ApprovalStatus | "all">("all");

  const addAudit = (action: AuditAction, fileName: string, folderId: string, user: string, detail?: string) => {
    setAuditLog(prev => [{
      id: Date.now(),
      action, fileName, folderId, user,
      timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      detail,
    }, ...prev]);
  };

  useEffect(() => {
    if (wsLoading || !workspaceId || isDesignMode) return;
    fetchProjects(workspaceId).then(rows => {
      setBackendProjects(rows);
      if (!activeProjectId && rows.length > 0) setActiveProjectId(rows[0].id);
    }).catch(console.error);
  }, [workspaceId, wsLoading, isDesignMode]);

  useEffect(() => {
    if (real && activeProjectId && workspaceId) {
      fetchDocuments(activeProjectId, workspaceId).then(docs => {
        setFiles(docs.map((d, i) => ({
          id: i + 1,
          folderId: d.folder ?? "drawings",
          name: d.fileName,
          date: new Date(d.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          docType: d.fileType ?? "Other",
          format: d.fileName.split(".").pop()?.toUpperCase() ?? "—",
          uploadedBy: d.uploadedBy ?? "Unknown",
          approvedBy: d.approvedBy ?? null,
          approvalStatus: (d.approvalStatus ?? "pending") as ApprovalStatus,
          ver: "v1",
          url: d.fileUrl,
          backendId: d.id,
        })));
      }).catch(console.error);
    }
  }, [activeProjectId, workspaceId, real]);

  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0];
  const currentFolderTypes = FOLDER_DOC_TYPES[activeFolderId] || ["Other"];

  const folderFiles = files.filter(f =>
    f.folderId === activeFolderId &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const approvalCounts = {
    all: folderFiles.length,
    pending:  folderFiles.filter(f => f.approvalStatus === "pending").length,
    approved: folderFiles.filter(f => f.approvalStatus === "approved").length,
    rejected: folderFiles.filter(f => f.approvalStatus === "rejected").length,
  };
  let processedFiles = filterApproval === "all"
    ? folderFiles
    : folderFiles.filter(f => f.approvalStatus === filterApproval);
  if (sortConfig.key) {
    processedFiles.sort((a, b) => {
      let av: any = a[sortConfig.key!];
      let bv: any = b[sortConfig.key!];
      if (sortConfig.key === "date") { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime(); }
      if (av == null) av = "";
      if (bv == null) bv = "";
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  const getFolderCount = (folderId: string) => files.filter(f => f.folderId === folderId).length;
  const totalFiles = files.length;
  const pendingCount = files.filter(f => f.approvalStatus === "pending").length;
  const lastUploadDate = files.length > 0
    ? files.reduce((latest, f) => {
        const t = new Date(f.date).getTime();
        return isNaN(t) ? latest : Math.max(latest, t);
      }, 0)
    : null;
  const lastUploadLabel = lastUploadDate
    ? new Date(lastUploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const activeProject = backendProjects.find(p => p.id === activeProjectId);

  const handleSort = (key: keyof FileRecord) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const handleApprove = (id: number) => {
    const f = files.find(x => x.id === id);
    // Optimistic update
    setFiles(prev => prev.map(x => x.id === id ? { ...x, approvalStatus: "approved", approvedBy: "Current User" } : x));
    if (f) addAudit("approved", f.name, f.folderId, "Current User");
    // Persist to backend
    if (f?.backendId && workspaceId) {
      updateDocumentApproval(f.backendId, workspaceId, "approved").catch(() => {
        // Revert on failure
        setFiles(prev => prev.map(x => x.id === id ? { ...x, approvalStatus: "pending", approvedBy: null } : x));
      });
    }
  };

  const handleReject = (id: number) => {
    const f = files.find(x => x.id === id);
    // Optimistic update
    setFiles(prev => prev.map(x => x.id === id ? { ...x, approvalStatus: "rejected", approvedBy: "Current User" } : x));
    if (f) addAudit("rejected", f.name, f.folderId, "Current User");
    // Persist to backend
    if (f?.backendId && workspaceId) {
      updateDocumentApproval(f.backendId, workspaceId, "rejected").catch(() => {
        // Revert on failure
        setFiles(prev => prev.map(x => x.id === id ? { ...x, approvalStatus: "pending", approvedBy: null } : x));
      });
    }
  };

  const openUploadModal = () => {
    setUploadDocType(currentFolderTypes[0]);
    setShowUpload(true);
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    if (!uploadFileName) setUploadFileName(file.name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const resetUploadState = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadFileName("");
    setUploadError(null);
    setDragOver(false);
  };

  const detectedFormat = uploadFile
    ? (uploadFile.name.split(".").pop()?.toUpperCase() ?? "DOC")
    : null;

  const baseName = uploadFileName
    ? uploadFileName.replace(/\.\w+$/, "").replace(/_v\d+$/i, "")
    : uploadFile ? uploadFile.name.replace(/\.\w+$/, "").replace(/_v\d+$/i, "") : null;
  const existingVersions = baseName
    ? files.filter(f => f.folderId === activeFolderId && f.name.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase() === baseName.toLowerCase())
    : [];
  const suggestedVersion = existingVersions.length > 0
    ? `v${existingVersions.length + 1}`
    : null;

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    const fmt = uploadFile.name.split(".").pop()?.toUpperCase() ?? "DOC";
    const displayName = uploadFileName.trim() || uploadFile.name;

    if (!real || !activeProjectId || !workspaceId) {
      setFiles([{
        id: Date.now(), folderId: activeFolderId, name: displayName,
        date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        docType: uploadDocType, format: fmt,
        size: uploadFile.size > 1024 * 1024
          ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(uploadFile.size / 1024)} KB`,
        uploadedBy: "Current User",
        approvedBy: null, approvalStatus: "pending", ver: uploadFileVersion,
      }, ...files]);
      addAudit("uploaded", displayName, activeFolderId, "Current User", uploadFileVersion);
      resetUploadState();
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const storagePath = await uploadFileToStorage(uploadFile, activeProjectId, workspaceId);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const fileUrl = `${supabaseUrl}/storage/v1/object/documents/${storagePath}`;
      const saved = await registerDocument({
        workspaceId,
        projectId: activeProjectId,
        fileName: displayName,
        fileUrl,
        fileType: uploadDocType,
        fileSize: uploadFile.size,
        folder: activeFolderId,
      });
      const uploader = saved.uploadedBy ?? "Current User";
      setFiles(prev => [{
        id: Date.now(), backendId: saved.id, folderId: activeFolderId, name: saved.fileName,
        date: new Date(saved.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        docType: saved.fileType ?? uploadDocType, format: fmt,
        size: uploadFile.size > 1024 * 1024
          ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(uploadFile.size / 1024)} KB`,
        uploadedBy: uploader,
        approvedBy: null, approvalStatus: "pending", ver: uploadFileVersion,
        url: fileUrl,
      }, ...prev]);
      addAudit("uploaded", saved.fileName, activeFolderId, uploader, uploadFileVersion);
      resetUploadState();
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleMenu = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpenId === id) { setMenuOpenId(null); setMenuPos(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.right - 128, y: rect.bottom + 4 });
    setMenuOpenId(id);
  };
  const handleDelete = (id: number) => {
    const f = files.find(x => x.id === id);
    if (window.confirm("Delete this document?")) {
      setFiles(files.filter(x => x.id !== id));
      if (f) addAudit("deleted", f.name, f.folderId, "Current User");
    }
    setMenuOpenId(null);
  };
  const startEdit = (file: FileRecord) => {
    setEditingFile({ ...file });
    setEditError("");
    setMenuOpenId(null);
  };
  const handleSaveEdit = () => {
    if (!editingFile) return;
    if (!editingFile.name.trim()) { setEditError("File name cannot be empty."); return; }
    const original = files.find(f => f.id === editingFile.id);
    setFiles(files.map(f => f.id === editingFile.id ? editingFile : f));
    if (original && original.name !== editingFile.name) {
      addAudit("renamed", editingFile.name, editingFile.folderId, "Current User", `was "${original.name}"`);
    }
    setEditingFile(null);
    setEditError("");
  };

  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    const palette = CUSTOM_FOLDER_PALETTE[(folders.length - INITIAL_FOLDERS.length) % CUSTOM_FOLDER_PALETTE.length];
    setFolders(prev => [...prev, { id, name, description: "Custom folder", Icon: FolderOpen, ...palette }]);
    setActiveFolderId(id);
    setNewFolderName("");
    setAddingFolder(false);
  };

  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setFiles(prev => prev.filter(f => f.folderId !== id));
    if (activeFolderId === id) setActiveFolderId("drawings");
    setFolderMenuOpenId(null);
    setConfirmDeleteFolderId(null);
  };

  const TABLE_COLS: { label: string; key: keyof FileRecord | null; width?: string }[] = [
    { label: "File Name",    key: "name" },
    { label: "Type",         key: "docType",        width: "130px" },
    { label: "Size",         key: "size",           width: "76px"  },
    { label: "Uploaded by",  key: "uploadedBy",     width: "170px" },
    { label: "Status",       key: "approvalStatus", width: "160px" },
    { label: "",             key: null,             width: "52px"  },
  ];

  if (!wsLoading && !isDesignMode && !activeProjectId && backendProjects.length === 0 && workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#F8FAFC]">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-10 flex flex-col items-center max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-4">
            <FileText size={26} className="text-[#2563EB]" />
          </div>
          <div className="text-[16px] font-bold text-[#0F172A] mb-2">No project selected</div>
          <p className="text-[13px] text-[#64748B] mb-6">
            Documents are organised per project. Create a project first or select one from the top menu.
          </p>
          <a
            href="/dashboard/overview"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold transition-colors"
          >
            Go to Overview
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full bg-[#F8FAFC]" onClick={() => { setMenuOpenId(null); setFolderMenuOpenId(null); }}>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">Documents</h1>
          {activeProject && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {activeProject.projectName}
            </span>
          )}
        </div>
        <button
          onClick={openUploadModal}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg px-4 py-2 text-[12px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <Plus size={13} /> Upload
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm px-4 py-3">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Total Files</div>
          <div className="text-[24px] font-bold text-[#0F172A] leading-none">{totalFiles}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm px-4 py-3">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Pending Approvals</div>
          <div className="text-[24px] font-bold leading-none" style={{ color: pendingCount > 0 ? "#D97706" : "#0F172A" }}>{pendingCount}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm px-4 py-3">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-1">Last Upload</div>
          <div className="text-[14px] font-bold text-[#0F172A] leading-none mt-1">{lastUploadLabel}</div>
        </div>
      </div>

      <div className="flex gap-5" style={{ minHeight: "calc(100% - 90px)" }}>

        {/* Folder Sidebar */}
        <div className="w-[192px] shrink-0 flex flex-col gap-1.5">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1 px-1">Folders</div>
          {folders.map(folder => {
            const isActive = folder.id === activeFolderId;
            const count = getFolderCount(folder.id);
            const folderPending = files.filter(f => f.folderId === folder.id && f.approvalStatus === "pending").length;
            return (
              <div key={folder.id} className="relative">
                <div
                  onClick={() => { setActiveFolderId(folder.id); setSearchQuery(""); setFilterApproval("all"); }}
                  className="cursor-pointer rounded-xl border transition-all group"
                  style={{
                    background: isActive ? folder.bg : "#FFFFFF",
                    borderColor: isActive ? folder.color : "#E2E8F0",
                    borderLeftWidth: isActive ? 3 : 1,
                    boxShadow: isActive ? "0 1px 4px 0 rgba(0,0,0,0.06)" : "none",
                    padding: "8px 10px",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: isActive ? folder.color : "#F1F5F9" }}>
                        <folder.Icon size={12} color={isActive ? "#FFFFFF" : "#64748B"} />
                      </div>
                      <span className="text-[13px] font-semibold truncate"
                        style={{ color: isActive ? folder.color : "#0F172A" }}>
                        {folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {folderPending > 0 && !isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706]">
                          {folderPending}
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: folder.color, color: "#FFFFFF" }}>
                          {count}
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setFolderMenuOpenId(folderMenuOpenId === folder.id ? null : folder.id); setConfirmDeleteFolderId(null); }}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#CBD5E1] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Folder context menu */}
                {folderMenuOpenId === folder.id && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1.5 z-30"
                    onClick={e => e.stopPropagation()}
                  >
                    {confirmDeleteFolderId === folder.id ? (
                      <div className="px-3 py-2">
                        <div className="text-[12px] font-medium text-[#0F172A] mb-2">Delete "{folder.name}"?</div>
                        <div className="text-[11px] text-[#64748B] mb-3">All files inside will be removed.</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="flex-1 py-1 text-[12px] font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteFolderId(null)}
                            className="flex-1 py-1 text-[12px] font-medium text-[#475569] bg-[#F1F5F9] rounded-lg hover:bg-[#E2E8F0] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteFolderId(folder.id)}
                        className="w-full text-left px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={12} /> Delete folder
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* New Folder */}
          {addingFolder ? (
            <div className="rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-3 py-2.5 flex flex-col gap-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); } }}
                placeholder="Folder name"
                className="text-[13px] border border-[#BFDBFE] rounded-lg px-2 py-1.5 outline-none focus:border-[#2563EB] bg-white w-full"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleAddFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 py-1 text-[12px] font-bold text-white rounded-lg transition-colors"
                  style={{ background: newFolderName.trim() ? "#2563EB" : "#CBD5E1", cursor: newFolderName.trim() ? "pointer" : "not-allowed" }}
                >
                  Create
                </button>
                <button
                  onClick={() => { setAddingFolder(false); setNewFolderName(""); }}
                  className="flex-1 py-1 text-[12px] font-bold text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingFolder(true)}
              className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-xl border border-dashed border-[#CBD5E1] hover:border-[#93C5FD] transition-colors"
            >
              <Plus size={13} /> New Folder
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-10 min-w-0">

          {/* Pending banner */}
          {approvalCounts.pending > 0 && filterApproval !== "pending" && (
            <div className="mb-4 px-4 py-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0 text-[14px]">⚠</div>
                <span className="text-[13px] font-semibold text-[#92400E]">
                  {approvalCounts.pending} file{approvalCounts.pending !== 1 ? "s" : ""} need{approvalCounts.pending === 1 ? "s" : ""} approval in {activeFolder.name}
                </span>
              </div>
              <button
                onClick={() => setFilterApproval("pending")}
                className="text-[12px] font-bold text-[#D97706] hover:text-[#B45309] whitespace-nowrap transition-colors"
              >
                Review →
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-between items-center mb-3">
            <div className="text-[16px] font-bold text-[#0F172A]">{activeFolder.name}</div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] bg-white w-56 transition-colors"
                />
              </div>
              <button
                onClick={() => { setShowHistory(v => !v); setHistoryFilter(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold border transition-colors ${showHistory ? "bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]"}`}
              >
                <Clock size={13} /> History {auditLog.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB] text-white ml-0.5">{auditLog.length}</span>}
              </button>
              <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  title="List view"
                  className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#2563EB] text-white" : "text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC]"}`}
                >
                  <LayoutList size={14} />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                  className={`w-8 h-8 flex items-center justify-center transition-colors border-l border-[#E2E8F0] ${viewMode === "grid" ? "bg-[#2563EB] text-white" : "text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC]"}`}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Approval filter tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[#F1F5F9] pb-3">
            {(["all", "pending", "approved", "rejected"] as const).map(status => {
              const count = approvalCounts[status];
              const active = filterApproval === status;
              const styles = {
                all:      { active: "#0F172A", activeBg: "#F1F5F9",  pill: "#E2E8F0",  pillText: "#475569" },
                pending:  { active: "#D97706", activeBg: "#FFFBEB",  pill: "#FDE68A",  pillText: "#92400E" },
                approved: { active: "#059669", activeBg: "#ECFDF5",  pill: "#A7F3D0",  pillText: "#065F46" },
                rejected: { active: "#DC2626", activeBg: "#FEF2F2",  pill: "#FECACA",  pillText: "#7F1D1D" },
              }[status];
              const label = status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <button key={status}
                  onClick={() => setFilterApproval(status)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={active
                    ? { background: styles.activeBg, color: styles.active }
                    : { color: "#64748B" }}>
                  {label}
                  {count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: active ? styles.pill : "#F1F5F9", color: active ? styles.pillText : "#64748B" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Edit Modal (inline) */}
          {editingFile && (
            <div className="mb-4 bg-white border-2 border-[#2563EB] rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#F1F5F9]">
                <span className="text-[14px] font-bold text-[#0F172A]">Edit Document</span>
                <button onClick={() => setEditingFile(null)} className="text-[#94A3B8] hover:text-[#334155] rounded-lg p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1.5">File Name</label>
                  <input type="text" value={editingFile.name} onChange={e => setEditingFile({ ...editingFile, name: e.target.value })}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1.5">Doc Type</label>
                    <select value={editingFile.docType} onChange={e => setEditingFile({ ...editingFile, docType: e.target.value })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]">
                      {(FOLDER_DOC_TYPES[editingFile.folderId] || ["Other"]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="w-28 shrink-0">
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1.5">Version</label>
                    <input type="text" value={editingFile.ver} onChange={e => setEditingFile({ ...editingFile, ver: e.target.value })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#2563EB]" />
                  </div>
                </div>
              </div>
              {editError && <p className="text-[12px] text-[#DC2626] font-semibold mb-3">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setEditingFile(null); setEditError(""); }}
                  className="px-4 py-2 text-[12px] font-bold border border-[#E2E8F0] rounded-lg text-[#0F172A] hover:bg-[#F8FAFC]">
                  Cancel
                </button>
                <button onClick={handleSaveEdit}
                  className="px-4 py-2 text-[12px] font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* File Table */}
          {processedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-[#E2E8F0] rounded-xl">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4">
                <Inbox size={24} className="text-[#CBD5E1]" />
              </div>
              <div className="text-[15px] font-bold text-[#0F172A] mb-1">
                {searchQuery ? "No results found" : `No files in ${activeFolder.name}`}
              </div>
              <p className="text-[13px] text-[#64748B] mb-5">
                {searchQuery
                  ? `No files match "${searchQuery}"`
                  : "Upload the first document to get started."}
              </p>
              {!searchQuery && (
                <button
                  onClick={openUploadModal}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg px-5 py-2 text-[12px] font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus size={13} /> Upload Document
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {processedFiles.map(f => {
                const fmtStyle = getFormatStyle(f.format);
                const fBase = f.name.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase();
                const isHistoryTarget = historyFilter
                  ? historyFilter.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase() === fBase
                  : false;
                return (
                  <div key={f.id} className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all group relative ${isHistoryTarget ? "border-[#7C3AED] ring-1 ring-[#7C3AED]" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`}>
                    {/* Preview area */}
                    <div className="relative h-[160px] flex items-center justify-center" style={{ background: `${fmtStyle.bar}18` }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: fmtStyle.badge, color: fmtStyle.text }}>
                        <FileIcon format={f.format} size={30} />
                      </div>
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-[#EDE9FE] hover:text-[#7C3AED] transition-colors"
                        style={{ background: "rgba(255,255,255,0.9)", color: "#64748B", border: "1px solid #E2E8F0" }}
                        onClick={() => { setShowHistory(true); setHistoryFilter(f.name); }}>
                        {f.ver}
                      </span>
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                        style={{ background: fmtStyle.badge, color: fmtStyle.text }}>
                        {f.format}
                      </span>
                      <div className="absolute inset-0 flex items-end justify-center pb-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.10) 0%, transparent 60%)" }}>
                        {f.approvalStatus === "pending" && (
                          <>
                            <button onClick={() => handleApprove(f.id)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-[#ECFDF5] text-[#059669] hover:bg-[#A7F3D0] transition-colors shadow-sm">
                              <CheckCircle size={10} /> Approve
                            </button>
                            <button onClick={() => handleReject(f.id)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FECACA] transition-colors shadow-sm">
                              <XCircle size={10} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                      <button onClick={e => toggleMenu(f.id, e)}
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-lg bg-white/80 text-[#94A3B8] hover:text-[#0F172A] hover:bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                        <MoreVertical size={12} />
                      </button>
                    </div>
                    {/* Card info */}
                    <div className="p-3 border-t border-[#F1F5F9]">
                      <div className="font-semibold text-[13px] text-[#0F172A] truncate mb-0.5 leading-snug" title={f.name}>{f.name}</div>
                      <div className="text-[12px] text-[#94A3B8] truncate mb-3">{f.docType}</div>
                      <div className="flex items-center justify-between gap-1">
                        <ApprovalBadge status={f.approvalStatus} />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ background: avatarColor(f.uploadedBy) }}>
                            {formatInitials(f.uploadedBy)}
                          </div>
                          <span className="text-[11px] text-[#94A3B8]">{f.date.split(",")[0]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full border-collapse" style={{ fontSize: 13, minWidth: 680 }}>
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    {TABLE_COLS.map((col, i) => (
                      <th
                        key={i}
                        onClick={() => col.key && handleSort(col.key as keyof FileRecord)}
                        style={{ width: col.width }}
                        className={`px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] ${col.key ? "cursor-pointer hover:text-[#475569] select-none" : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.key && (
                            <SortIcon
                              active={sortConfig.key === col.key}
                              direction={sortConfig.direction}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedFiles.map(f => {
                    const fmtStyle = getFormatStyle(f.format);
                    const fBase = f.name.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase();
                    const vCount = auditLog.filter(e => e.action === "uploaded" && e.folderId === f.folderId &&
                      e.fileName.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase() === fBase
                    ).length;
                    const isHistoryTarget = historyFilter
                      ? historyFilter.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase() === fBase
                      : false;
                    const isPending = f.approvalStatus === "pending";
                    return (
                      <tr key={f.id}
                        className={`border-b border-[#F1F5F9] transition-colors group relative ${isHistoryTarget ? "bg-[#FAF5FF]" : isPending ? "bg-[#FFFDF7] hover:bg-[#FFFBEB]" : "hover:bg-[#F8FAFC]"}`}>

                        {/* Pending left accent */}
                        {isPending && <td className="p-0 w-0"><div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#F59E0B] rounded-l" /></td>}

                        {/* File name — color bar + icon + name + format badge + version */}
                        <td className="px-4 py-3 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: fmtStyle.badge, color: fmtStyle.text }}>
                              <FileIcon format={f.format} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[13px] text-[#0F172A] truncate">{f.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                                  style={{ background: fmtStyle.badge, color: fmtStyle.text }}>
                                  {f.format}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => { setShowHistory(true); setHistoryFilter(f.name); }}
                              className="flex items-center gap-1 shrink-0"
                              title="View file history"
                            >
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] font-mono hover:bg-[#EDE9FE] hover:text-[#7C3AED] transition-colors">
                                {f.ver}
                              </span>
                              {vCount > 1 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED]">
                                  {vCount}v
                                </span>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F1F5F9] text-[#475569] whitespace-nowrap">
                            {f.docType}
                          </span>
                        </td>

                        {/* Size */}
                        <td className="px-4 py-3 text-[12px] text-[#64748B] font-mono whitespace-nowrap">
                          {f.size ?? "—"}
                        </td>

                        {/* Uploaded by — avatar + name + date stacked */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ background: avatarColor(f.uploadedBy) }}>
                              {formatInitials(f.uploadedBy)}
                            </div>
                            <div>
                              <div className="text-[12px] font-medium text-[#0F172A] whitespace-nowrap">
                                {f.uploadedBy === "Current User" ? "You" : f.uploadedBy}
                              </div>
                              <div className="text-[10px] text-[#94A3B8] whitespace-nowrap">{f.date}</div>
                            </div>
                          </div>
                        </td>

                        {/* Status — badge + hover approve/reject */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ApprovalBadge status={f.approvalStatus} />
                            {isPending && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleApprove(f.id)}
                                  title="Approve"
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-[#ECFDF5] text-[#059669] hover:bg-[#A7F3D0] transition-colors">
                                  <CheckCircle size={13} />
                                </button>
                                <button onClick={() => handleReject(f.id)}
                                  title="Reject"
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FECACA] transition-colors">
                                  <XCircle size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <button
                            onClick={(e) => toggleMenu(f.id, e)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-[260px] shrink-0 flex flex-col border border-[#E2E8F0] rounded-xl bg-white shadow-sm overflow-hidden" style={{ maxHeight: "calc(100vh - 160px)" }}>
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between shrink-0">
              <div>
                {historyFilter ? (
                  <div>
                    <button
                      onClick={() => setHistoryFilter(null)}
                      className="text-[10px] font-bold text-[#7C3AED] hover:underline mb-0.5 flex items-center gap-1"
                    >
                      ← All activity
                    </button>
                    <div className="text-[12px] font-bold text-[#0F172A] truncate max-w-[170px]">{historyFilter}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7C3AED]" />
                    <span className="text-[13px] font-bold text-[#0F172A]">Activity History</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9]"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {(() => {
                const filtered = historyFilter
                  ? auditLog.filter(e => {
                      const eb = e.fileName.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase();
                      const hb = historyFilter.replace(/\.\w+$/, "").replace(/_v\d+$/i, "").toLowerCase();
                      return eb === hb;
                    })
                  : auditLog;
                if (filtered.length === 0) return (
                  <div className="text-center py-8 text-[11px] text-[#94A3B8]">No activity yet</div>
                );
                return filtered.map(ev => {
                  const style = AUDIT_STYLE[ev.action];
                  return (
                    <div key={ev.id} className="flex gap-2.5">
                      <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: style.bg }}>
                        <span className="text-[9px] font-bold" style={{ color: style.color }}>
                          {ev.action === "uploaded" ? "↑" : ev.action === "approved" ? "✓" : ev.action === "rejected" ? "✕" : ev.action === "deleted" ? "🗑" : "✎"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: style.bg, color: style.color }}>
                            {style.label}
                          </span>
                          {ev.detail && (
                            <span className="text-[10px] text-[#94A3B8] font-mono">{ev.detail}</span>
                          )}
                        </div>
                        {!historyFilter && (
                          <div
                            className="text-[11px] font-semibold text-[#0F172A] truncate cursor-pointer hover:text-[#7C3AED]"
                            title={ev.fileName}
                            onClick={() => setHistoryFilter(ev.fileName)}
                          >
                            {ev.fileName}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                            style={{ background: avatarColor(ev.user) }}>
                            {formatInitials(ev.user)}
                          </div>
                          <span className="text-[10px] text-[#64748B]">{ev.user}</span>
                          <span className="text-[10px] text-[#94A3B8] ml-auto shrink-0">{ev.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Fixed-position row action dropdown */}
      {menuOpenId !== null && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMenuOpenId(null); setMenuPos(null); }} />
          <div
            className="fixed w-36 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-1 z-50"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {(() => {
              const f = files.find(x => x.id === menuOpenId);
              if (!f) return null;
              return (
                <>
                  <button onClick={() => { startEdit(f); setMenuOpenId(null); setMenuPos(null); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
                    <Pencil size={12} className="text-[#64748B]" /> Edit
                  </button>
                  {f.url && (
                    <button onClick={() => { window.open(f.url); setMenuOpenId(null); setMenuPos(null); }}
                      className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
                      <Download size={12} className="text-[#64748B]" /> Download
                    </button>
                  )}
                  <button onClick={() => { handleDelete(f.id); setMenuPos(null); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2">
                    <Trash2 size={12} /> Delete
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* Upload Modal Overlay */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(15,23,42,0.45)" }}
          onClick={resetUploadState}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <div>
                <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em]">Upload to</div>
                <div className="text-[16px] font-bold text-[#0F172A]">{activeFolder.name}</div>
              </div>
              <button
                onClick={resetUploadState}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? "#2563EB" : uploadFile ? "#2563EB" : "#CBD5E1",
                  background: dragOver ? "#EFF6FF" : uploadFile ? "#F8FBFF" : "#F8FAFC",
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleInputChange}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: getFormatStyle(detectedFormat ?? "").badge, color: getFormatStyle(detectedFormat ?? "").text }}>
                      <FileIcon format={detectedFormat ?? ""} />
                    </div>
                    <div className="text-[13px] font-bold text-[#0F172A]">{uploadFile.name}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {uploadFile.size > 1024 * 1024
                        ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.round(uploadFile.size / 1024)} KB`}
                      {detectedFormat && (
                        <span className="ml-2 px-1.5 py-0.5 rounded font-bold font-mono"
                          style={{ background: getFormatStyle(detectedFormat).badge, color: getFormatStyle(detectedFormat).text }}>
                          {detectedFormat}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadFileName(""); }}
                      className="text-[11px] text-[#94A3B8] hover:text-[#DC2626] underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[#E2E8F0] flex items-center justify-center">
                      <Upload size={18} className="text-[#94A3B8]" />
                    </div>
                    <div className="text-[13px] font-semibold text-[#475569]">
                      Drop a file here or <span className="text-[#2563EB] font-bold">browse</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">PDF, DWG, DXF, IFC, XLSX, ZIP and more</div>
                  </div>
                )}
              </div>

              {/* File name */}
              <div>
                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={e => setUploadFileName(e.target.value)}
                  placeholder="e.g. Foundation_Layout_v3.pdf"
                  className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>

              {/* Doc type + version row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-1.5">
                    Document Type
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={e => setUploadDocType(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB]"
                  >
                    {currentFolderTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="w-28 shrink-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.1em]">Version</label>
                    {suggestedVersion && (
                      <button
                        type="button"
                        onClick={() => setUploadFileVersion(suggestedVersion)}
                        className="text-[10px] font-bold text-[#7C3AED] hover:underline"
                      >
                        Use {suggestedVersion}
                      </button>
                    )}
                  </div>
                  <select
                    value={uploadFileVersion}
                    onChange={e => setUploadFileVersion(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB]"
                  >
                    {["v1","v2","v3","v4","v5","v6","v7","v8","v9","v10"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {suggestedVersion && uploadFileVersion !== suggestedVersion && (
                    <p className="text-[10px] text-[#D97706] mt-1">
                      Existing file found — suggested: {suggestedVersion}
                    </p>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="text-[12px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                  {uploadError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button
                onClick={resetUploadState}
                disabled={uploading}
                className="px-4 py-2 text-[12px] font-bold border border-[#E2E8F0] rounded-lg text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!uploadFile || uploading}
                className="px-5 py-2 text-[12px] font-bold text-white rounded-lg flex items-center gap-2 transition-colors"
                style={{ background: uploadFile && !uploading ? "#2563EB" : "#CBD5E1", cursor: uploadFile && !uploading ? "pointer" : "not-allowed" }}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <><Upload size={13} /> Upload File</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[#94A3B8]">Loading...</div>}>
      <DocumentsPageContent />
    </Suspense>
  );
}
