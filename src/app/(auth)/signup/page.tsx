"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError("");

    const { error: authError } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0],
    });

    if (authError) {
      setError(authError.message || "Could not create account. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/onboarding");
  };

  const handleGoogleSignup = async () => {
    setError("");
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard/overview",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f6ff] to-[#f6f8fa]">
      <div className="bg-white border border-[#D0D7DE] rounded-lg w-[400px] p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <a href="/" className="logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <img src="/bluq-logo.png" alt="BluQ" style={{ height: "15px", width: "auto" }} />
          </a>
          <div className="text-[13px] text-[#57606a] mt-1">
            Project intelligence for construction
          </div>
        </div>

        {/* Google Signup */}
        <button
          onClick={handleGoogleSignup}
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

        {/* Email Signup */}
        <form onSubmit={handleSignup}>
          {error && (
            <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-[#57606a] mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
            />
          </div>

          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-[#57606a] mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full bg-[#3A4EA2] text-white rounded-md py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center text-xs text-[#57606a] mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#3A4EA2] font-semibold cursor-pointer hover:underline"
          >
            Log in
          </Link>
        </div>

        <div className="text-center text-[10px] text-[#8C959F] mt-4">
          <label className="flex items-start gap-1.5 justify-center cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#3A4EA2]"
            />
            I agree to the Terms of Service and Privacy Policy
          </label>
        </div>
      </div>
    </div>
  );
}
