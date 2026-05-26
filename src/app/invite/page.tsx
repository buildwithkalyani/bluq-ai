"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { verifyTeamInvite, acceptTeamInvite } from "@/lib/api-client";

interface InviteDetails {
  email: string;
  name: string;
  role: string;
  workspaceId: string;
  orgName: string;
}

function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    if (!token) { setError("Invalid invite link."); setLoading(false); return; }

    Promise.all([
      verifyTeamInvite(token).catch(() => null),
      authClient.getSession().catch(() => null),
    ]).then(([inv, sess]) => {
      if (!inv) { setError("This invite link is invalid or has expired."); }
      else { setInvite(inv as InviteDetails); }
      setSession((sess as any)?.data ?? null);
      setLoading(false);
    });
  }, [token]);

  // If logged in and invite is valid, auto-accept
  useEffect(() => {
    if (!session || !invite || accepting) return;
    if (session.user?.email?.toLowerCase() !== invite.email.toLowerCase()) return;
    setAccepting(true);
    acceptTeamInvite(token)
      .then(({ workspaceId }) => {
        // Mark onboarding done so workspace context doesn't redirect to /onboarding
        localStorage.setItem(`onboarding_done_${session.user.id}`, "true");
        // Clear any stale workspace cache so context re-fetches with new membership
        localStorage.removeItem("bluq_workspace");
        // Hard reload so workspace context re-fetches /orgs/mine with the new membership
        window.location.href = `/dashboard/overview?workspaceId=${workspaceId}`;
      })
      .catch((err) => {
        setError(err.message ?? "Failed to accept invite.");
        setAccepting(false);
      });
  }, [session, invite]);

  if (loading || accepting) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] flex items-center justify-center">
        <div className="text-sm text-[#57606a]">{accepting ? "Joining workspace…" : "Loading…"}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] flex items-center justify-center p-4">
        <div className="bg-white border border-[#D0D7DE] rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-[15px] font-bold text-[#24292f] mb-2">Invite link problem</div>
          <div className="text-sm text-[#57606a]">{error}</div>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const isWrongAccount = session && session.user?.email?.toLowerCase() !== invite.email.toLowerCase();
  const inviteRedirect = encodeURIComponent(`/invite?token=${token}`);
  const loginUrl = `/login?redirect=${inviteRedirect}`;
  const signupUrl = `/signup?email=${encodeURIComponent(invite.email)}&redirect=${inviteRedirect}`;

  return (
    <div className="min-h-screen bg-[#f6f8fa] flex items-center justify-center p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-8 max-w-md w-full shadow-sm">
        {/* Logo */}
        <div className="text-[22px] font-black text-[#3A4EA2] tracking-tight mb-6">BluQ</div>

        <div className="text-[18px] font-bold text-[#24292f] mb-2">
          You've been invited to {invite.orgName}
        </div>
        <p className="text-sm text-[#57606a] mb-1">
          You'll have access to all projects and updates for <strong>{invite.orgName}</strong>.
        </p>
        <p className="text-sm text-[#57606a] mb-6">
          This invite was sent to <span className="font-semibold text-[#24292f]">{invite.email}</span>.
        </p>

        {isWrongAccount ? (
          <div className="bg-[#ffebe9] border border-[#ff818266] rounded-lg p-3 text-xs text-[#CF222E] mb-4">
            You're logged in as <strong>{session.user.email}</strong> but this invite was sent to <strong>{invite.email}</strong>. Please log out and sign in with the correct account.
          </div>
        ) : null}

        {!session ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push(loginUrl)}
              className="w-full bg-[#3A4EA2] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#2d3d8a] transition-colors"
            >
              Log in to accept invite
            </button>
            <button
              onClick={() => router.push(signupUrl)}
              className="w-full bg-white border border-[#D0D7DE] text-[#24292f] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#f6f8fa] transition-colors"
            >
              Create a new account
            </button>
          </div>
        ) : isWrongAccount ? (
          <button
            onClick={() => authClient.signOut().then(() => router.push(loginUrl))}
            className="w-full bg-white border border-[#D0D7DE] text-[#24292f] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#f6f8fa] transition-colors"
          >
            Log out and switch account
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense>
      <InvitePage />
    </Suspense>
  );
}
