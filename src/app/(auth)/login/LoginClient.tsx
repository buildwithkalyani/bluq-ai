"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard/overview";

  const { data: session, isPending } = authClient.useSession();

  const [otpStep, setOtpStep] = useState<"email" | "verify">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isNewUser, setIsNewUser] = useState(false);
  const isInviteFlow = redirect.startsWith("/invite");

  // Already logged in → skip login form
  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace(redirect);
    }
  }, [session, isPending, redirect, router]);

  if (isPending || session?.user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-[#3A4EA2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });

      if (!checkRes.ok) {
        setError("Unable to reach the server. Please try again later.");
        setLoading(false);
        return;
      }

      const { exists } = await checkRes.json();

      if (!exists && !isInviteFlow) {
        setError("No account found with this email. Please sign up first.");
        setLoading(false);
        return;
      }

      if (!exists) setIsNewUser(true);

      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: otpEmail,
        type: "sign-in",
      });

      if (sendError) {
        setError(sendError.message || "Could not send OTP. Please try again.");
        return;
      }

      setSuccess(`OTP sent to ${otpEmail}`);
      setOtpStep("verify");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email: otpEmail,
        otp,
        ...(rememberMe ? {} : { dontRememberMe: true }),
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid or expired OTP.");
        return;
      }

      router.push(redirect);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {otpStep === "email" ? (
        <form onSubmit={handleSendOtp}>
          {error && (
            <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-[#57606a] mb-1">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              required
              className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 mb-3.5">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#3A4EA2] cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-[12px] text-[#57606a] cursor-pointer select-none">
              Keep me logged in for 7 days
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3A4EA2] text-white rounded-md py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors disabled:opacity-50"
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          {isNewUser && (
            <div className="mb-3 text-[12px] text-[#0969da] bg-[#ddf4ff] border border-[#0969da30] rounded-md px-3 py-2">
              Creating your account — enter the OTP sent to {otpEmail}.
            </div>
          )}
          {success && !isNewUser && (
            <div className="mb-3 text-[12px] text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="mb-1.5">
            <label className="block text-xs font-semibold text-[#57606a] mb-1">OTP Code</label>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              inputMode="numeric"
              className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent tracking-widest font-mono"
            />
          </div>
          <div className="flex items-center gap-3 mb-3.5">
            <button
              type="button"
              onClick={() => { setOtpStep("email"); setOtp(""); setError(""); setSuccess(""); }}
              className="text-[11px] text-[#3A4EA2] hover:underline"
            >
              Resend OTP
            </button>
            <span className="text-[#D0D7DE] text-[11px]">·</span>
            <button
              type="button"
              onClick={() => { setOtpStep("email"); setOtpEmail(""); setOtp(""); setError(""); setSuccess(""); setIsNewUser(false); }}
              className="text-[11px] text-[#57606a] hover:underline"
            >
              Use a different account
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full bg-[#3A4EA2] text-white rounded-md py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & Log in"}
          </button>
        </form>
      )}

      <div className="text-center text-xs text-[#57606a] mt-4">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[#3A4EA2] font-semibold cursor-pointer hover:underline">
          Sign up
        </Link>
      </div>
    </>
  );
}

export default function LoginClient() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f6ff] to-[#f6f8fa]">
      <div className="bg-white border border-[#D0D7DE] rounded-lg w-[400px] p-8 shadow-sm">
        <div className="text-center mb-6">
          <a href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/bluQ-logo (1).svg" alt="BluQ" style={{ height: "20px", width: "auto" }} />
          </a>
          <div className="text-[13px] text-[#57606a] mt-1">Project intelligence for construction</div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
