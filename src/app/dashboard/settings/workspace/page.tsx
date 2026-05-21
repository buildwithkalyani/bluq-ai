"use client";

import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "@/context/workspace";
import { authClient } from "@/lib/auth-client";
import { updateOrg, fetchOrgLogoUploadUrl } from "@/lib/api-client";


export default function WorkspaceSettingsPage() {
  const { workspaceId, orgName, isDesignMode, setWorkspace, setOrgLogoUrl: setContextLogoUrl } = useWorkspace();

  const [companyName, setCompanyName] = useState(orgName ?? "");
  const [savedName, setSavedName] = useState(orgName ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDesignMode) {
      setCompanyName("Bluq Engineering Consultants");
      setSavedName("Bluq Engineering Consultants");
      return;
    }
    if (!workspaceId) return;
    authClient.getSession().then((s) => {
      const token = (s as any)?.data?.session?.token ?? "";
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
      fetch(`${backendUrl}/orgs/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data: any[]) => {
          if (data?.[0]?.logoUrl) setLogoUrl(data[0].logoUrl);
          if (data?.[0]?.name) {
            setCompanyName(data[0].name);
            setSavedName(data[0].name);
          }
        })
        .catch(() => {});
    });
  }, [workspaceId, isDesignMode]);

  const dirty = companyName !== savedName || pendingLogo !== null;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogo(file);
    setPendingLogoPreview(URL.createObjectURL(file));
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!dirty) return;
    setLoading(true);
    setError("");
    try {
      if (!isDesignMode && workspaceId) {
        const updates: Record<string, string> = {};
        if (companyName !== savedName) updates.name = companyName;
        if (pendingLogo) {
          const { signedUrl, publicUrl } = await fetchOrgLogoUploadUrl(workspaceId, pendingLogo.name);
          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": pendingLogo.type || "image/png" },
            body: pendingLogo,
          });
          if (!uploadRes.ok) throw new Error("Logo upload failed");
          updates.logoUrl = publicUrl;
        }
        if (Object.keys(updates).length > 0) await updateOrg(workspaceId, updates);
        if (updates.logoUrl) {
          if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
          setLogoUrl(updates.logoUrl);
          setContextLogoUrl(updates.logoUrl);
          setPendingLogo(null);
          setPendingLogoPreview(null);
        }
      }
      setSavedName(companyName);
      setWorkspace(workspaceId ?? "", companyName);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err: any) {
      setError(err.message ?? "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const initials = companyName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="px-6 py-5 overflow-y-auto h-full bg-[#F8FAFC]">
      <div className="text-[20px] font-bold text-[#0F172A] mb-1">Workspace Settings</div>
      <div className="text-[13px] text-[#94A3B8] mb-5">Admin-only. Changes apply across the entire workspace.</div>

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <div className="text-[14px] font-semibold text-[#0F172A]">Company Info</div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isDesignMode}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#F8FAFC] disabled:text-[#475569] transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Company Logo</label>
            <div className="flex items-center gap-4">
              {(pendingLogoPreview ?? logoUrl) ? (
                <img src={pendingLogoPreview ?? logoUrl!} alt="Company logo" className="w-14 h-14 rounded-xl object-cover border border-[#E2E8F0] shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-xl font-extrabold text-[#2563EB] shrink-0">
                  {initials}
                </div>
              )}
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={loading || (!workspaceId && !isDesignMode)}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#E2E8F0] rounded-md bg-white cursor-pointer hover:bg-[#F8FAFC] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingLogo ? "Change Logo ●" : "Change Logo"}
                </button>
                <div className="text-[11px] text-[#94A3B8] mt-1.5">PNG, JPEG or WebP · max 2 MB</div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading || !dirty}
            className="bg-[#2563EB] text-white border-none rounded-md px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d8a] active:scale-95 transition-all"
          >
            {loading ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
          {dirty && <span className="text-[12px] text-[#94A3B8]">Unsaved changes</span>}
        </div>
      </div>

      <div
        className={`fixed bottom-5 right-5 bg-[#2da44e] text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 z-50 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
        Workspace settings saved!
      </div>
    </div>
  );
}
