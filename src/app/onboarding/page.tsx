"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/bluq-ui";

const STEPS = [
  { key: "org", label: "Create Org" },
  { key: "project", label: "Create Project" },
  { key: "schedule", label: "Add Tasks" },
  { key: "team", label: "Invite Team" },
  { key: "whatsapp", label: "Connect WhatsApp" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Form states
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [projectStage, setProjectStage] = useState("Foundation");
  const [projectType, setProjectType] = useState("Residential");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [scheduleMethod, setScheduleMethod] = useState<"csv" | "manual" | "ai" | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [contractorName, setContractorName] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");
  const [eodTime, setEodTime] = useState("18:00");

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push("/dashboard/overview");
  };
  const back = () => step > 0 && setStep(step - 1);
  const skip = () => next();

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
                type="text"
                placeholder="Bluq Engineering Consultants"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="form-input"
              />
            </FormField>
            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-[#57606a] mb-1">
                Company Logo (optional)
              </label>
              <div className="border-2 border-dashed border-[#D0D7DE] rounded-lg p-6 text-center cursor-pointer hover:border-[#8C959F] transition-colors">
                <div className="text-2xl mb-1">🖼️</div>
                <div className="text-xs text-[#57606a]">
                  Drag & drop or{" "}
                  <span className="text-[#3A4EA2] font-semibold">browse</span>
                </div>
                <div className="text-[10px] text-[#8C959F] mt-1">
                  PNG, JPG up to 2MB
                </div>
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
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" />
              </FormField>
              <FormField label="End Date *" className="flex-1">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" />
              </FormField>
            </div>
            <FormField label="Project Code *">
              <input type="text" placeholder="ANT-2026-001" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className="form-input" />
            </FormField>
          </>
        )}

        {/* ─── STEP 3: SCHEDULE ────────────────────────── */}
        {step === 2 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Add Your Schedule
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              Choose how to populate your project schedule.
            </p>
            <div className="space-y-2.5">
              {[
                { key: "csv" as const, icon: "📥", title: "Import from Excel/CSV", desc: "Upload a .xlsx or .csv file and map columns to Bluq fields" },
                { key: "manual" as const, icon: "✏️", title: "Add tasks manually", desc: "Create tasks one by one with full control over dependencies" },
                { key: "ai" as const, icon: "🤖", title: "AI-generate from BOQ", desc: "Upload your BOQ and let Claude build the schedule automatically" },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setScheduleMethod(opt.key)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    scheduleMethod === opt.key
                      ? "border-[#3A4EA2] bg-[#ddf4ff]"
                      : "border-[#D0D7DE] hover:border-[#8C959F]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <div className="text-[13px] font-bold text-[#24292f]">
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-[#57606a] mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── STEP 4: INVITE ──────────────────────────── */}
        {step === 3 && (
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
            <div className="mt-3 flex gap-2">
              <div className="flex-1 bg-[#f6f8fa] border border-[#D0D7DE] rounded-md px-2.5 py-1.5 text-xs text-[#8C959F] overflow-hidden whitespace-nowrap text-ellipsis">
                https://app.bluq.io/invite/abc123...
              </div>
              <Btn small>📋 Copy</Btn>
            </div>
          </>
        )}

        {/* ─── STEP 5: WHATSAPP ────────────────────────── */}
        {step === 4 && (
          <>
            <div className="text-[15px] font-bold text-[#24292f] mb-1">
              Link Contractors via WhatsApp
            </div>
            <p className="text-[13px] text-[#57606a] mb-5">
              Add contractors and assign tasks. The Bluq bot will collect daily
              updates from them on WhatsApp.
            </p>
            <div className="bg-[#f6f8fa] border border-[#D0D7DE] rounded-lg p-3.5 mb-3">
              <div className="flex gap-3 mb-2.5">
                <FormField label="Contractor Name" className="flex-1">
                  <input type="text" placeholder="Rajesh Kumar" value={contractorName} onChange={(e) => setContractorName(e.target.value)} className="form-input" />
                </FormField>
                <FormField label="WhatsApp Number" className="flex-1">
                  <input type="tel" placeholder="+971 50 123 4567" value={contractorPhone} onChange={(e) => setContractorPhone(e.target.value)} className="form-input" />
                </FormField>
              </div>
              <label className="block text-xs font-semibold text-[#57606a] mb-1.5">
                Assign Tasks
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Foundation Works", "Rebar Installation", "Formwork"].map(
                  (t, i) => (
                    <span
                      key={i}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer border transition-colors ${
                        i < 2
                          ? "bg-[#ddf4ff] text-[#3A4EA2] border-[#3A4EA240]"
                          : "bg-[#f0f1f3] text-[#8C959F] border-[#D0D7DE]"
                      }`}
                    >
                      {i < 2 ? "✓ " : ""}
                      {t}
                    </span>
                  )
                )}
              </div>
            </div>
            <Btn small className="mb-4">
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
          {step >= 2 && <Btn onClick={skip}>Skip for now</Btn>}
          <Btn primary onClick={next}>
            {step === STEPS.length - 1 ? "Save & Go Live 🚀" : "Continue →"}
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
