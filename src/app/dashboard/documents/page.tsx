"use client";

import { useState, useRef, useEffect } from "react";
import { getProjects, type Project } from "@/lib/mock-data-extended";

// --- TYPESCRIPT INTERFACES ---
type ApprovalStatus = "pending" | "approved" | "rejected";

interface FileRecord {
  id: number;
  folderId: string;
  name: string;
  date: string;
  docType: string;
  format: string;
  uploadedBy: string;
  approvedBy: string | null;
  approvalStatus: ApprovalStatus;
  ver: string;
  thumb: string;
}

interface Folder {
  id: string;
  name: string;
  icon: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: keyof FileRecord | null; direction: SortDirection; }

// --- STATIC DATA ---
const FOLDER_DOC_TYPES: Record<string, string[]> = {
  drawings: ["Architectural", "Structural", "MEP", "Civil", "Landscape", "Other Drawing"],
  reports:  ["Progress Report", "Geotechnical Report", "Environmental Report", "MEP Report", "Site Report", "Other Report"],
  permits:  ["Building Permit", "NOC", "Environmental Permit", "Safety Permit", "Other Permit"],
  boqs:     ["Master BOQ", "Civil BOQ", "MEP BOQ", "Structural BOQ", "Other BOQ"],
};

const SUPPORTED_FORMATS = [
  "3DS File (*.3ds)", "AutoCAD DWG File (*.dwg)", "AutoCAD DXF File (*.dxf)",
  "COLLADA File (*.dae)", "FBX File (*.fbx)", "Google Earth File (*.kmz)",
  "IFC File (*.ifc)", "TrimBIM File (*.trb)", "OBJ File (*.obj)",
  "STereoLithography File (*.stl)", "VRML File (*.wrl)", "XSI File (*.xsi)",
  "glTF Binary File (*.glb)", "USDZ File (*.usdz)", "ZIP Archive (*.zip)",
  "PDF Document (*.pdf)",
];

const FOLDERS: Folder[] = [
  { id: "drawings", name: "Drawings", icon: "📐" },
  { id: "reports",  name: "Reports",  icon: "📄" },
  { id: "permits",  name: "Permits",  icon: "📜" },
  { id: "boqs",     name: "BOQs",     icon: "📊" },
];

const INITIAL_FILES: FileRecord[] = [
  { id: 1, folderId: "drawings", name: "ANT-ARCH-001-Ground_Floor.dwg",      date: "Mar 12, 2:30 PM",  docType: "Architectural", format: "DWG", uploadedBy: "Aayush P.",    approvedBy: "Meera S.",  approvalStatus: "approved", ver: "v3", thumb: "📐" },
  { id: 2, folderId: "drawings", name: "ANT-STR-001-Foundation_Layout.pdf",   date: "Mar 10, 11:00 AM", docType: "Structural",    format: "PDF", uploadedBy: "Meera S.",     approvedBy: null,        approvalStatus: "pending",  ver: "v2", thumb: "📄" },
  { id: 3, folderId: "reports",  name: "Presswood Overview - China.pdf",      date: "Mar 28, 1:16 PM",  docType: "MEP Report",    format: "PDF", uploadedBy: "Current User", approvedBy: null,        approvalStatus: "pending",  ver: "v1", thumb: "📄" },
  { id: 4, folderId: "boqs",     name: "bluq-logo.png",                       date: "Mar 28, 1:02 PM",  docType: "Master BOQ",    format: "PNG", uploadedBy: "Current User", approvedBy: null,        approvalStatus: "rejected", ver: "v1", thumb: "📄" },
];

const TABLE_HEADERS: { label: string; key: keyof FileRecord | null }[] = [
  { label: "",            key: null },
  { label: "File Name",   key: "name" },
  { label: "Date/Time",   key: "date" },
  { label: "Type",        key: "docType" },
  { label: "Format",      key: "format" },
  { label: "Uploaded By", key: "uploadedBy" },
  { label: "Approved By", key: "approvedBy" },
  { label: "Status",      key: "approvalStatus" },
  { label: "Version",     key: "ver" },
  { label: "",            key: null },
];

// --- COMPONENTS ---
const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white border border-[#D0D7DE] rounded-lg p-3 ${className}`} style={style}>{children}</div>
);

const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => {
  const cfg = {
    approved: { bg: "#dafbe1", color: "#1A7F37", label: "Approved" },
    rejected: { bg: "#ffebe9", color: "#CF222E", label: "Rejected" },
    pending:  { bg: "#fff8c5", color: "#9A6700", label: "Pending"  },
  }[status];
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

export default function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileRecord[]>(INITIAL_FILES);
  const [activeFolderId, setActiveFolderId] = useState<string>("drawings");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: "asc" });

  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadDocType, setUploadDocType] = useState<string>("");
  const [uploadFileType, setUploadFileType] = useState<string>(SUPPORTED_FORMATS[15]);
  const [uploadFileVersion, setUploadFileVersion] = useState<string>("v1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProjects().then((p) => {
      setProjects(p);
      if (p.length > 0) setActiveProject(p[0]);
    });
  }, []);

  const activeFolder = FOLDERS.find(f => f.id === activeFolderId) || FOLDERS[0];
  const currentFolderTypes = FOLDER_DOC_TYPES[activeFolderId] || ["Other"];

  let processedFiles = files.filter(f =>
    f.folderId === activeFolderId &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (sortConfig.key) {
    processedFiles.sort((a, b) => {
      let av: any = a[sortConfig.key!];
      let bv: any = b[sortConfig.key!];
      if (sortConfig.key === "date") { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime(); }
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  const getFolderCount = (folderId: string) => files.filter(f => f.folderId === folderId).length;

  const handleSort = (key: keyof FileRecord) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const handleApprove = (id: number) => {
    setFiles(prev => prev.map(f => f.id === id
      ? { ...f, approvalStatus: "approved", approvedBy: "Current User" }
      : f
    ));
  };

  const handleReject = (id: number) => {
    setFiles(prev => prev.map(f => f.id === id
      ? { ...f, approvalStatus: "rejected", approvedBy: "Current User" }
      : f
    ));
  };

  const openUploadModal = () => { setUploadDocType(currentFolderTypes[0]); setShowUpload(true); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadFileName) setUploadFileName(file.name);
    }
  };

  const resetUploadState = () => { setShowUpload(false); setUploadFile(null); setUploadFileName(""); };

  const handleUploadSubmit = () => {
    if (!uploadFile) return;
    const match = uploadFileType.match(/\*\.([a-z0-9]+)\)/i);
    const fmt = match ? match[1].toUpperCase() : "DOC";
    const thumb = ["DWG","DXF"].includes(fmt) ? "📐" : ["ZIP","RAR"].includes(fmt) ? "📦" : ["3DS","OBJ","IFC","FBX","DAE","GLB"].includes(fmt) ? "🧊" : "📄";

    const newFile: FileRecord = {
      id: Date.now(),
      folderId: activeFolderId,
      name: uploadFileName.trim() || uploadFile.name,
      date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      docType: uploadDocType,
      format: fmt,
      uploadedBy: "Current User",
      approvedBy: null,
      approvalStatus: "pending",
      ver: uploadFileVersion,
      thumb,
    };
    setFiles([newFile, ...files]);
    resetUploadState();
  };

  const toggleMenu = (id: number, e: React.MouseEvent) => { e.stopPropagation(); setMenuOpenId(menuOpenId === id ? null : id); };
  const handleDelete = (id: number) => { if (window.confirm("Delete this document?")) setFiles(files.filter(f => f.id !== id)); setMenuOpenId(null); };
  const startEdit = (file: FileRecord) => { setEditingFile({ ...file }); setMenuOpenId(null); };
  const handleSaveEdit = () => {
    if (!editingFile) return;
    if (!editingFile.name.trim()) return alert("File name cannot be empty");
    setFiles(files.map(f => f.id === editingFile.id ? editingFile : f));
    setEditingFile(null);
  };

  return (
    <div className="p-4 overflow-y-auto h-full bg-white" onClick={() => setMenuOpenId(null)}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="text-lg font-bold text-[#24292f]">Documents</div>
        <div className="relative">
          <select
            value={activeProject?.id ?? ""}
            onChange={(e) => { const p = projects.find(p => p.id === Number(e.target.value)); if (p) setActiveProject(p); }}
            className="appearance-none bg-white border border-[#D0D7DE] rounded-md py-1.5 pl-3 pr-8 text-[13px] font-semibold text-[#24292f] cursor-pointer outline-none focus:border-[#3A4EA2] focus:ring-1 focus:ring-[#3A4EA2] shadow-sm"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#57606a]">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex gap-5" style={{ height: "calc(100% - 60px)" }}>
        {/* Sidebar */}
        <div className="w-[180px] shrink-0">
          <div className="text-[13px] font-bold text-[#24292f] mb-2 px-2">Folders</div>
          {FOLDERS.map(folder => {
            const isActive = folder.id === activeFolderId;
            return (
              <div key={folder.id} onClick={() => { setActiveFolderId(folder.id); setSearchQuery(""); }}
                className="px-2.5 py-1.5 rounded-md cursor-pointer flex justify-between items-center mb-0.5 transition-colors"
                style={{ background: isActive ? "#ddf4ff" : "transparent" }}>
                <span className="text-[13px] flex items-center gap-2" style={{ fontWeight: isActive ? 600 : 400, color: isActive ? "#3A4EA2" : "#24292f" }}>
                  <span className="text-sm">{folder.icon}</span>{folder.name}
                </span>
                <span className="text-[11px] text-[#8C959F] bg-[#f0f1f3] px-2 py-0.5 rounded-full font-mono">{getFolderCount(folder.id)}</span>
              </div>
            );
          })}
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-auto pb-10">
          {/* Action Bar */}
          <div className="flex justify-between items-center mb-3">
            <div className="text-base font-bold text-[#24292f]">{activeFolder.name}</div>
            <div className="flex gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="border border-[#D0D7DE] rounded-md pl-7 pr-3 py-1 text-[13px] text-[#24292f] outline-none focus:border-[#3A4EA2] w-64" />
              </div>
              <button onClick={openUploadModal}
                className="bg-[#3A4EA2] hover:bg-[#0353a4] text-white rounded-md px-3 py-1 text-[13px] font-semibold flex items-center gap-1.5 transition-colors">
                📤 Upload
              </button>
            </div>
          </div>

          {/* Edit Modal */}
          {editingFile && (
            <Card className="mb-4 !border-2 !border-[#3A4EA2] shadow-sm relative z-20">
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <span className="text-[14px] font-bold text-[#24292f]">Edit Document Details</span>
                <button onClick={() => setEditingFile(null)} className="text-[#8C959F] hover:text-gray-700 text-base">✕</button>
              </div>
              <div className="flex flex-col gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">File Name</label>
                  <input type="text" value={editingFile.name} onChange={e => setEditingFile({ ...editingFile, name: e.target.value })}
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">Doc Type</label>
                    <select value={editingFile.docType} onChange={e => setEditingFile({ ...editingFile, docType: e.target.value })}
                      className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]">
                      {(FOLDER_DOC_TYPES[editingFile.folderId] || ["Other"]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">Version</label>
                    <input type="text" value={editingFile.ver} onChange={e => setEditingFile({ ...editingFile, ver: e.target.value })}
                      className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setEditingFile(null)} className="px-3 py-1.5 text-[13px] font-semibold border border-[#D0D7DE] rounded-md text-[#24292f]">Cancel</button>
                <button onClick={handleSaveEdit} className="px-3 py-1.5 text-[13px] font-semibold bg-[#3A4EA2] text-white rounded-md">Save Changes</button>
              </div>
            </Card>
          )}

          {/* Upload Modal */}
          {showUpload && !editingFile && (
            <Card className="mb-4 !border-2 !border-[#3A4EA2] shadow-sm relative">
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <span className="text-[14px] font-bold text-[#24292f]">Upload to {activeFolder.name}</span>
                <button onClick={resetUploadState} className="text-[#8C959F] hover:text-gray-700 text-base">✕</button>
              </div>
              <div className="flex flex-col gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">File Name</label>
                  <input type="text" value={uploadFileName} onChange={e => setUploadFileName(e.target.value)}
                    placeholder="Enter file name (or select a file to auto-fill)"
                    className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">Doc Type</label>
                    <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}
                      className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]">
                      {currentFolderTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">File Format</label>
                    <select value={uploadFileType} onChange={e => setUploadFileType(e.target.value)}
                      className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]">
                      {SUPPORTED_FORMATS.map((f, i) => <option key={i} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="w-24 shrink-0">
                    <label className="block text-[11px] font-bold text-[#57606a] mb-1 uppercase tracking-wider">Version</label>
                    <select value={uploadFileVersion} onChange={e => setUploadFileVersion(e.target.value)}
                      className="w-full bg-white border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3A4EA2]">
                      {["v1","v2","v3","v4","v5"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <input type="file" accept=".3ds,.dwg,.dxf,.dae,.fbx,.kmz,.ifc,.trb,.obj,.stl,.wrl,.xsi,.glb,.usdz,.zip,.pdf"
                ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              <div onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed ${uploadFile ? "border-[#3A4EA2] bg-[#ddf4ff]" : "border-[#D0D7DE] bg-[#fafbfc]"} hover:border-[#3A4EA2] rounded-lg p-6 text-center mb-3 cursor-pointer transition-colors`}>
                <div className="text-2xl mb-1">{uploadFile ? "📄" : "📂"}</div>
                <div className="text-[13px] text-[#57606a]">
                  {uploadFile ? <span className="text-[#3A4EA2] font-bold">{uploadFile.name}</span> : <>Drag & drop files here or <span className="text-[#3A4EA2] font-semibold">browse</span></>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={resetUploadState} className="px-3 py-1.5 text-[13px] font-semibold border border-[#D0D7DE] rounded-md text-[#24292f]">Cancel</button>
                <button onClick={handleUploadSubmit} disabled={!uploadFile}
                  className={`px-3 py-1.5 text-[13px] font-semibold text-white rounded-md ${uploadFile ? "bg-[#3A4EA2] hover:bg-[#0353a4]" : "bg-[#8C959F]"}`}>
                  Upload File
                </button>
              </div>
            </Card>
          )}

          {/* Table */}
          {processedFiles.length > 0 ? (
            <Card className="!p-0 overflow-visible shadow-sm">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f6f8fa] border-b border-[#e1e4e8]">
                    {TABLE_HEADERS.map((h, i) => (
                      <th key={i} onClick={() => h.key && handleSort(h.key)}
                        className={`px-3 py-2 text-left font-bold text-[#57606a] text-[11px] uppercase tracking-wider ${h.key ? "cursor-pointer hover:bg-gray-200 select-none" : ""}`}>
                        <div className="flex items-center gap-1">
                          {h.label}
                          {sortConfig.key === h.key && <span className="text-[9px] text-[#3A4EA2]">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedFiles.map(f => (
                    <tr key={f.id} className="border-b border-[#f0f1f3] hover:bg-[#f6f8fa] transition-colors group">
                      <td className="px-3 py-2.5 text-base w-8 text-center text-[#8C959F]">{f.thumb}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#3A4EA2]">{f.name}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#57606a] whitespace-nowrap">{f.date}</td>
                      <td className="px-3 py-2.5"><span className="bg-[#ddf4ff] text-[#3A4EA2] px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">{f.docType}</span></td>
                      <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-[#57606a]">{f.format}</td>
                      <td className="px-3 py-2.5 text-[#57606a] whitespace-nowrap">{f.uploadedBy}</td>
                      <td className="px-3 py-2.5 text-[#57606a] whitespace-nowrap">{f.approvedBy ?? <span className="text-[#8C959F] italic">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ApprovalBadge status={f.approvalStatus} />
                          {f.approvalStatus === "pending" && (
                            <div className="flex gap-1">
                              <button onClick={() => handleApprove(f.id)}
                                className="px-2 py-0.5 text-[11px] font-bold rounded bg-[#dafbe1] text-[#1A7F37] hover:bg-[#b4f1be] transition-colors">
                                ✓ Approve
                              </button>
                              <button onClick={() => handleReject(f.id)}
                                className="px-2 py-0.5 text-[11px] font-bold rounded bg-[#ffebe9] text-[#CF222E] hover:bg-[#ffc1ba] transition-colors">
                                ✕ Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-medium text-[#8C959F] text-[12px]">{f.ver}</td>
                      <td className="px-3 py-2.5 relative text-right w-10">
                        <button onClick={(e) => toggleMenu(f.id, e)} className="text-[#8C959F] hover:text-[#24292f] p-1 rounded">⋮</button>
                        {menuOpenId === f.id && (
                          <div className="absolute right-6 top-6 w-28 bg-white border border-[#D0D7DE] rounded-md shadow-lg py-1 z-10 text-left">
                            <button onClick={() => startEdit(f)} className="w-full text-left px-3 py-1.5 text-[13px] text-[#24292f] hover:bg-[#f6f8fa]">✏️ Edit</button>
                            <button onClick={() => handleDelete(f.id)} className="w-full text-left px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50">🗑️ Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <div className="text-center py-12 border border-dashed border-[#D0D7DE] rounded-lg bg-[#fafbfc]">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-[#24292f] font-bold text-[14px] mb-1">
                {searchQuery ? "No search results found" : `No files in ${activeFolder.name}`}
              </div>
              {!searchQuery && (
                <button onClick={openUploadModal} className="mt-3 bg-[#3A4EA2] hover:bg-[#0353a4] text-white rounded-md px-4 py-1.5 text-[13px] font-semibold">
                  Upload a Document
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
