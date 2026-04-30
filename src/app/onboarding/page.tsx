"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/bluq-ui";
import { authClient } from "@/lib/auth-client";

const WORK_AREAS = [
  { id: "excavation",    label: "Excavation & Earthwork" },
  { id: "foundation",   label: "Foundation" },
  { id: "structure",    label: "Structure / RCC" },
  { id: "masonry",      label: "Masonry & Brickwork" },
  { id: "plumbing",     label: "Plumbing" },
  { id: "electrical",   label: "Electrical" },
  { id: "hvac",         label: "HVAC" },
  { id: "plastering",   label: "Plastering" },
  { id: "tiling",       label: "Tiling & Flooring" },
  { id: "painting",     label: "Painting" },
  { id: "carpentry",    label: "Carpentry & Woodwork" },
  { id: "glazing",      label: "Glazing & Facade" },
  { id: "waterproof",   label: "Waterproofing" },
  { id: "landscaping",  label: "Landscaping" },
  { id: "finishing",    label: "Interior Finishing" },
];

const STEPS = [
  { key: "org", label: "Create Org" },
  { key: "project", label: "Create Project" },
  { key: "team", label: "Invite Team" },
  { key: "whatsapp", label: "Connect WhatsApp" },
];

async function getAuthToken(): Promise<string> {
  const session = await authClient.getSession();
  return session?.data?.session?.token ?? "";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  // Created IDs — persisted in localStorage so returning users resume same org/project
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem("ob_workspaceId") : null
  );

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const ls = (key: string) => (typeof window !== "undefined" ? localStorage.getItem(key) : null);

  // Form states — initialised from localStorage so Back navigation restores data
  const [orgName, setOrgName] = useState(() => ls("ob_orgName") ?? "");
  const [projectName, setProjectName] = useState(() => ls("ob_projectName") ?? "");
  const [projectAddress, setProjectAddress] = useState(() => ls("ob_projectAddress") ?? "");
  const [projectStage, setProjectStage] = useState(() => ls("ob_projectStage") ?? "Foundation");
  const [projectType, setProjectType] = useState(() => ls("ob_projectType") ?? "Residential");
  const [startDate, setStartDate] = useState(() => ls("ob_startDate") ?? "");
  const [endDate, setEndDate] = useState(() => ls("ob_endDate") ?? "");
  const [projectCode, setProjectCode] = useState(() => ls("ob_projectCode") ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>(() => {
    try { return JSON.parse(ls("ob_invites") ?? "[]"); } catch { return []; }
  });
  const [eodTime, setEodTime] = useState(() => ls("ob_eodTime") ?? "18:00");

  // Contractor step state
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(
    () => ls("ob_projectId") ?? null
  );
  const [contractors, setContractors] = useState([
    { name: "", countryCode: "+91", phone: "", selectedTaskIds: [] as string[] },
  ]);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

  // Persist form fields to localStorage so Back navigation restores them
  useEffect(() => { localStorage.setItem("ob_orgName", orgName); }, [orgName]);
  useEffect(() => { localStorage.setItem("ob_projectName", projectName); }, [projectName]);
  useEffect(() => { localStorage.setItem("ob_projectAddress", projectAddress); }, [projectAddress]);
  useEffect(() => { localStorage.setItem("ob_projectStage", projectStage); }, [projectStage]);
  useEffect(() => { localStorage.setItem("ob_projectType", projectType); }, [projectType]);
  useEffect(() => { localStorage.setItem("ob_startDate", startDate); }, [startDate]);
  useEffect(() => { localStorage.setItem("ob_endDate", endDate); }, [endDate]);
  useEffect(() => { localStorage.setItem("ob_projectCode", projectCode); }, [projectCode]);
  useEffect(() => { localStorage.setItem("ob_invites", JSON.stringify(invites)); }, [invites]);
  useEffect(() => { localStorage.setItem("ob_eodTime", eodTime); }, [eodTime]);
  useEffect(() => {
    if (createdWorkspaceId) localStorage.setItem("ob_workspaceId", createdWorkspaceId);
  }, [createdWorkspaceId]);

  const endDateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (endDateRef.current) {
      if (startDate) endDateRef.current.min = startDate;
      else endDateRef.current.removeAttribute("min");
    }
  }, [startDate]);

  // Wait for session then restore step + org data
  useEffect(() => {
    if (sessionLoading) return;        // still loading — don't act yet
    if (!session?.user) {
      router.replace("/login");        // session resolved, no user → kick to login
      return;
    }

    const savedStep = parseInt(localStorage.getItem("onboarding_step") ?? "0") || 0;
    const fetchOrg = async () => {
      try {
        const token = await getAuthToken();
        const res = await fetch(`${backendUrl}/orgs/mine`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const orgs = await res.json();
        if (orgs?.[0]?.id) {
          setCreatedWorkspaceId(orgs[0].id);
          setOrgName(orgs[0].name ?? "");
          setStep(Math.max(1, savedStep));
        }
      } catch {}
    };
    fetchOrg();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, session?.user?.id]);

const apiPost = async (path: string, body: unknown) => {
    const token = await getAuthToken();
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Request failed: ${res.status}`);
    }
    return res.json();
  };

  const handleContinue = async () => {
    setApiError("");

    // Step 0: Create org + upload logo if provided
    if (step === 0) {
      if (!orgName.trim()) return;
      setSaving(true);
      try {
        // Reuse existing org if one already exists — prevents duplicate orgs on retry
        let org: { id: string; name: string } | null = null;
        if (createdWorkspaceId) {
          org = { id: createdWorkspaceId, name: orgName.trim() };
        } else {
          const token = await getAuthToken();
          const existing = await fetch(`${backendUrl}/orgs/mine`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (existing.ok) {
            const orgs = await existing.json();
            if (orgs?.[0]?.id) org = orgs[0];
          }
        }
        if (!org) {
          org = await apiPost("/orgs", { name: orgName.trim() });
        }
        if (!org?.id) throw new Error("Failed to create or load workspace.");
        setCreatedWorkspaceId(org.id);

        if (logoFile) {
          const token = await getAuthToken();
          const urlRes = await fetch(
            `${backendUrl}/orgs/logo-upload-url?orgId=${encodeURIComponent(org.id)}&fileName=${encodeURIComponent(logoFile.name)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          if (urlRes.ok) {
            const { signedUrl, publicUrl } = await urlRes.json();
            const uploadRes = await fetch(signedUrl, {
              method: "PUT",
              headers: { "Content-Type": logoFile.type || "image/png" },
              body: logoFile,
            });
            if (uploadRes.ok) {
              await fetch(`${backendUrl}/orgs/${org.id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ logoUrl: publicUrl }),
              });
            }
          }
        }

        setStep(1);
        localStorage.setItem("onboarding_step", "1");
      } catch (err: any) {
        setApiError(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Step 1: Create first project (optional — user can skip)
    if (step === 1) {
      if (projectName.trim()) {
        setSaving(true);
        try {
          // Resolve workspaceId — use in-memory value or re-fetch from backend
          let wsId = createdWorkspaceId;
          if (!wsId) {
            const token = await getAuthToken();
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
            const res = await fetch(`${backendUrl}/orgs/mine`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error("Could not load your workspace. Please refresh and try again.");
            const orgs = await res.json();
            wsId = orgs?.[0]?.id ?? null;
          }
          if (!wsId) throw new Error("No workspace found. Please complete step 1 first.");
          setCreatedWorkspaceId(wsId);
          const project = await apiPost("/projects", {
            workspaceId: wsId,
            projectName: projectName.trim(),
            projectCode: projectCode.trim() || undefined,
            address: projectAddress.trim() || undefined,
            stage: projectStage,
            category: projectType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: "active",
          });
          if (project?.id) {
            setCreatedProjectId(project.id);
            localStorage.setItem("ob_projectId", project.id);
          }
        } catch (err: any) {
          setApiError(err.message);
          setSaving(false);
          return;
        } finally {
          setSaving(false);
        }
      }
    }

    // Step 2: Send invites
    if (step === 2 && invites.length > 0) {
      setSaving(true);
      try {
        let wsId = createdWorkspaceId;
        if (!wsId) {
          const token = await getAuthToken();
          const res = await fetch(`${backendUrl}/orgs/mine`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const orgs = await res.json();
            wsId = orgs?.[0]?.id ?? null;
            if (wsId) setCreatedWorkspaceId(wsId);
          }
        }
        if (wsId) {
          await Promise.all(
            invites.map((email) =>
              apiPost("/team/invite", {
                email,
                name: email.split("@")[0],
                role: "member",
                workspaceId: wsId,
              })
            )
          );
        }
      } catch (err: any) {
        setApiError(err.message);
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    // For remaining steps just advance (they're informational/optional)
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      localStorage.setItem("onboarding_step", next.toString());
    } else {
      // Save contractors + team to project settingsJson so Project Settings page shows them
      if (createdProjectId) {
        const contractorEntries = contractors
          .filter((c) => c.name.trim() && c.phone.trim())
          .map((c) => ({
            id: crypto.randomUUID(),
            name: c.name.trim(),
            phone: `${c.countryCode}${c.phone.trim().replace(/\D/g, "")}`,
            trade: c.selectedTaskIds.length > 0
              ? (WORK_AREAS.find((a) => a.id === c.selectedTaskIds[0])?.label ?? "Civil")
              : "Civil",
          }));
        const teamEntries = invites.map((email) => ({
          id: crypto.randomUUID(),
          name: email.split("@")[0],
          email,
          role: "Editor" as const,
        }));
        if (contractorEntries.length > 0 || teamEntries.length > 0) {
          try {
            const token = await getAuthToken();
            await fetch(`${backendUrl}/projects/${createdProjectId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                settingsJson: {
                  contractors: contractorEntries,
                  team: teamEntries,
                  eodTime,
                },
              }),
            });

            // Fire-and-forget WhatsApp welcome messages (don't block navigation)
            if (contractorEntries.length > 0) {
              getAuthToken().then((token2) => {
                Promise.allSettled(
                  contractorEntries.map((c) =>
                    fetch(`${backendUrl}/whatsapp/send-welcome`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token2 ? { Authorization: `Bearer ${token2}` } : {}),
                      },
                      body: JSON.stringify({
                        phone: c.phone,
                        contractorName: c.name,
                        projectName: projectName.trim() || "your project",
                      }),
                    })
                  )
                );
              });
            }
          } catch {}
        }
      }

      localStorage.removeItem("onboarding_step");
      localStorage.setItem("onboarding_done", "true");
      localStorage.removeItem("ob_workspaceId");
      const params = new URLSearchParams();
      if (createdProjectId) params.set("projectId", createdProjectId);
      if (createdWorkspaceId) params.set("workspaceId", createdWorkspaceId);
      const qs = params.toString();
      router.push(`/dashboard/overview${qs ? `?${qs}` : ""}`);
    }
  };

  const back = () => {
    setApiError("");
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      localStorage.setItem("onboarding_step", prev.toString());
    }
  };
  const skip = () => {
    setApiError("");
    // Any skip = user explicitly done — mark complete, never redirect back to onboarding
    localStorage.removeItem("onboarding_step");
    localStorage.setItem("onboarding_done", "true");
    ["ob_orgName","ob_projectName","ob_projectAddress","ob_projectStage","ob_projectType",
     "ob_startDate","ob_endDate","ob_projectCode","ob_invites","ob_eodTime","ob_projectId","ob_workspaceId"]
      .forEach(k => localStorage.removeItem(k));
    const params = new URLSearchParams();
    if (createdWorkspaceId) params.set("workspaceId", createdWorkspaceId);
    if (createdProjectId)   params.set("projectId",   createdProjectId);
    const qs = params.toString();
    router.push(`/dashboard/overview${qs ? `?${qs}` : ""}`);
  };

  const addInvite = () => {
    if (inviteEmail && !invites.includes(inviteEmail)) {
      setInvites([...invites, inviteEmail]);
      setInviteEmail("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f8fa]">
      <div className="bg-white border border-[#D0D7DE] rounded-lg w-[520px] p-8 shadow-sm">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-sm transition-colors"
                style={{
                  width: 40,
                  background: i <= step ? "#3A4EA2" : "#e1e4e8",
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-[#8C959F]">
            {step + 1}/{STEPS.length}
          </span>
        </div>

        {/* API error */}
        {apiError && (
          <div className="my-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {apiError}
          </div>
        )}

        {/* ─── STEP 1: ORG ─────────────────────────────── */}
        {step === 0 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Set Up Your Workspace
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              This is your company&apos;s home on Bluq. Your branding will appear on
              reports shared with clients.
            </p>
            <FormField label="Company Name *">
              <input
                autoFocus
                type="text"
                placeholder="Bluq Engineering Consultants"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                className="form-input"
              />
            </FormField>
            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-[#57606a] mb-1">
                Company Logo (optional)
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-[#D0D7DE] rounded-lg p-6 text-center cursor-pointer hover:border-[#8C959F] transition-colors"
              >
                <div className="text-2xl mb-1">🖼️</div>
                {logoFile ? (
                  <div className="text-xs text-[#24292f] font-semibold">{logoFile.name}</div>
                ) : (
                  <>
                    <div className="text-xs text-[#57606a]">
                      Drag & drop or{" "}
                      <span className="text-[#3A4EA2] font-semibold">browse</span>
                    </div>
                    <div className="text-[10px] text-[#8C959F] mt-1">
                      PNG, JPG up to 2MB
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─── STEP 2: PROJECT ─────────────────────────── */}
        {step === 1 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Create Your First Project
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              Enter basic project details. You can edit these later in settings.
            </p>
            <FormField label="Project Name *">
              <input type="text" placeholder="Al Nakheel Tower" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="form-input" />
            </FormField>
            <FormField label="Project Address *">
              <input type="text" placeholder="Dubai Marina, Dubai, UAE" value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} className="form-input" />
            </FormField>
            <div className="flex gap-3">
              <FormField label="Stage *" className="flex-1">
                <select value={projectStage} onChange={(e) => setProjectStage(e.target.value)} className="form-input">
                  {["Foundation", "Structure", "Finishing", "Pre-Construction"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label="Type *" className="flex-1">
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="form-input">
                  {["Residential", "Commercial", "Mixed-Use", "Infrastructure"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </FormField>
            </div>
            <div className="flex gap-3">
              <FormField label="Start Date *" className="flex-1">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate("");
                  }}
                  className="form-input"
                />
              </FormField>
              <FormField label="End Date *" className="flex-1">
                <input
                  ref={endDateRef}
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input"
                />
              </FormField>
            </div>
            <FormField label="Project Code *">
              <input type="text" placeholder="ANT-2026-001" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className="form-input" />
            </FormField>
          </>
        )}

        {/* ─── STEP 3: INVITE ──────────────────────────── */}
        {step === 2 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Invite Your Team
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              Add team members who need access to this project.
            </p>
            <div className="flex gap-2 mb-3">
              <FormField label="Email Address" className="flex-1">
                <input
                  type="email"
                  placeholder="meera@pmcfirm.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInvite()}
                  className="form-input"
                />
              </FormField>
              <div className="pt-5">
                <Btn small primary onClick={addInvite}>
                  + Add
                </Btn>
              </div>
            </div>
            {invites.map((email, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-[#f6f8fa] border border-[#D0D7DE] rounded-md px-3 py-2 mb-2"
              >
                <div>
                  <div className="text-xs font-semibold text-[#24292f]">
                    {email}
                  </div>
                  <div className="text-[11px] text-[#57606a]">
                    Team Member • Invited
                  </div>
                </div>
                <span
                  className="text-[#CF222E] text-xs cursor-pointer"
                  onClick={() =>
                    setInvites(invites.filter((_, j) => j !== i))
                  }
                >
                  ✕
                </span>
              </div>
            ))}
          </>
        )}

        {/* ─── STEP 4: WHATSAPP ────────────────────────── */}
        {step === 3 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Link Contractors via WhatsApp
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              Add contractors and assign tasks. The Bluq bot will collect daily
              updates from them on WhatsApp.
            </p>

            {contractors.map((contractor, ci) => (
              <div key={ci} className="bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg p-3.5 mb-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-[#57606a]">
                    Contractor {ci + 1}
                  </span>
                  {contractors.length > 1 && (
                    <span
                      className="text-[11px] text-[#CF222E] cursor-pointer"
                      onClick={() => setContractors(prev => prev.filter((_, j) => j !== ci))}
                    >
                      Remove
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mb-2.5">
                  <FormField label="Contractor Name" className="flex-1">
                    <input
                      type="text"
                      placeholder="Rajesh Kumar"
                      value={contractor.name}
                      onChange={(e) => setContractors(prev =>
                        prev.map((c, j) => j === ci ? { ...c, name: e.target.value } : c)
                      )}
                      className="form-input"
                    />
                  </FormField>
                  <FormField label="WhatsApp Number" className="flex-1">
                    <div className="flex gap-1">
                      <select
                        value={contractor.countryCode}
                        onChange={(e) => setContractors(prev =>
                          prev.map((c, j) => j === ci ? { ...c, countryCode: e.target.value } : c)
                        )}
                        className="form-input"
                        style={{ width: 90, flexShrink: 0 }}
                      >
                        {[
                          { code: "+91", flag: "🇮🇳", label: "IN" },
                          { code: "+971", flag: "🇦🇪", label: "AE" },
                          { code: "+1",  flag: "🇺🇸", label: "US" },
                          { code: "+44", flag: "🇬🇧", label: "GB" },
                          { code: "+966", flag: "🇸🇦", label: "SA" },
                          { code: "+974", flag: "🇶🇦", label: "QA" },
                          { code: "+968", flag: "🇴🇲", label: "OM" },
                          { code: "+965", flag: "🇰🇼", label: "KW" },
                          { code: "+973", flag: "🇧🇭", label: "BH" },
                          { code: "+92",  flag: "🇵🇰", label: "PK" },
                          { code: "+880", flag: "🇧🇩", label: "BD" },
                          { code: "+94",  flag: "🇱🇰", label: "LK" },
                          { code: "+60",  flag: "🇲🇾", label: "MY" },
                          { code: "+65",  flag: "🇸🇬", label: "SG" },
                        ].map(({ code, flag, label }) => (
                          <option key={code} value={code}>{flag} {code}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        placeholder="50 123 4567"
                        value={contractor.phone}
                        onChange={(e) => setContractors(prev =>
                          prev.map((c, j) => j === ci ? { ...c, phone: e.target.value } : c)
                        )}
                        className="form-input"
                      />
                    </div>
                  </FormField>
                </div>
                <label className="block text-xs font-semibold text-[#57606a] mb-1">
                  Assign Work Areas <span className="font-normal text-[#8C959F]">(optional)</span>
                </label>
                <p className="text-[11px] text-[#8C959F] mb-1.5">Select what this contractor is responsible for. You can fine-tune task assignments later.</p>
                <div className="flex flex-wrap gap-1.5">
                  {WORK_AREAS.map((area) => {
                    const selected = contractor.selectedTaskIds.includes(area.id);
                    return (
                      <span
                        key={area.id}
                        onClick={() => setContractors(prev =>
                          prev.map((c, j) => j !== ci ? c : {
                            ...c,
                            selectedTaskIds: selected
                              ? c.selectedTaskIds.filter(id => id !== area.id)
                              : [...c.selectedTaskIds, area.id],
                          })
                        )}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer border transition-colors ${
                          selected
                            ? "bg-[#ddf4ff] text-[#3A4EA2] border-[#3A4EA240]"
                            : "bg-[#f0f1f3] text-[#8C959F] border-[#D0D7DE]"
                        }`}
                      >
                        {selected ? "✓ " : ""}{area.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}

            <Btn
              small
              className="mb-4"
              onClick={() => setContractors(prev => [
                ...prev,
                { name: "", countryCode: "+91", phone: "", selectedTaskIds: [] },
              ])}
            >
              + Add Another Contractor
            </Btn>

            <div className="border-t border-[#e1e4e8] pt-3 flex items-center gap-3">
              <label className="text-xs font-semibold text-[#57606a]">
                EOD Prompt Time
              </label>
              <input
                type="time"
                value={eodTime}
                onChange={(e) => setEodTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#3A4EA2]"
              />
              <span className="text-[11px] text-[#8C959F]">
                Bot sends daily prompts at this time
              </span>
            </div>
          </>
        )}

        {/* ─── NAVIGATION BUTTONS ──────────────────────── */}
        <div className="flex gap-2.5 justify-end mt-6">
          {step > 0 && <Btn onClick={back}>Back</Btn>}
          {step >= 1 && <Btn onClick={skip}>Skip for now</Btn>}
          <Btn
            primary
            onClick={handleContinue}
            disabled={
              saving ||
              (step === 0 && !orgName.trim()) ||
              (step === 1 && (
                !projectName.trim() ||
                !projectAddress.trim() ||
                !startDate ||
                !endDate ||
                !projectCode.trim()
              )) ||
              false
            }
          >
            {saving
              ? "Saving..."
              : step === STEPS.length - 1
              ? "Save & Go Live 🚀"
              : "Continue →"}
          </Btn>
        </div>
      </div>

      {/* Global styles for form inputs */}
      <style jsx global>{`
        .form-input {
          width: 100%;
          background: white;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #24292f;
          outline: none;
          transition: all 0.15s;
        }
        .form-input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #3A4EA2;
        }
        .form-input::placeholder {
          color: #8c959f;
        }
      `}</style>
    </div>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3.5 ${className}`}>
      <label className="block text-xs font-semibold text-[#57606a] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
