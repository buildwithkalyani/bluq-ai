"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard/overview";

  const [otpStep, setOtpStep] = useState<"email" | "verify">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGoogleLogin = async () => {
    await authClient.signIn.social({ provider: "google", callbackURL: redirect });
  };

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
      const { exists } = await checkRes.json();
      if (!exists) {
        setError("No account found with this email. Please sign up first.");
        setLoading(false);
        return;
      }

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
      {/* Google */}
      <button
        onClick={handleGoogleLogin}
        className="w-full bg-[#f6f8fa] border border-[#D0D7DE] rounded-md px-4 py-2.5 text-[13px] font-semibold text-[#24292f] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#eef1f5] transition-colors mb-4"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="text-center text-xs text-[#8C959F] my-3">or</div>

      {/* OTP flow */}
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
          {success && (
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
          <button
            type="button"
            onClick={() => { setOtpStep("email"); setOtp(""); setError(""); setSuccess(""); }}
            className="text-[11px] text-[#3A4EA2] hover:underline mb-3.5 block"
          >
            Resend OTP
          </button>
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
            <img src="/bluq-logo.png" alt="BluQ" style={{ height: "15px", width: "auto" }} />
          </a>
          <div className="text-[13px] text-[#57606a] mt-1">Project intelligence for construction</div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
