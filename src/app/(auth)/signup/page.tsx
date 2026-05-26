"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [firmName, setFirmName] = useState("");

  const COUNTRY_CODES = [
    { code: "+91", flag: "🇮🇳", label: "IN" },
    { code: "+1",  flag: "🇺🇸", label: "US" },
    { code: "+44", flag: "🇬🇧", label: "GB" },
    { code: "+971", flag: "🇦🇪", label: "AE" },
    { code: "+65", flag: "🇸🇬", label: "SG" },
    { code: "+61", flag: "🇦🇺", label: "AU" },
    { code: "+49", flag: "🇩🇪", label: "DE" },
    { code: "+33", flag: "🇫🇷", label: "FR" },
    { code: "+974", flag: "🇶🇦", label: "QA" },
    { code: "+966", flag: "🇸🇦", label: "SA" },
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: phone.trim() ? `${countryCode}${phone.trim().replace(/\D/g, "")}` : undefined,
          companyName: firmName.trim(),
          source: "signup",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f6ff] to-[#f6f8fa]">
      <div className="bg-white border border-[#D0D7DE] rounded-lg w-[400px] p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <a href="/" className="logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <img src="/bluQ-logo (1).svg" alt="BluQ" style={{ height: "20px", width: "auto" }} />
          </a>
          <div className="text-[13px] text-[#57606a] mt-1">
            Project intelligence for construction
          </div>
        </div>

        {submitted ? (
          /* ── Confirmation screen ── */
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#dafbe1] flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A7F37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="text-[15px] font-bold text-[#24292f] mb-2">Request submitted!</div>
            <div className="text-[13px] text-[#57606a] leading-relaxed mb-1">
              We've received your request. Our team will verify your account and get back to you within <strong>24 hours</strong>.
            </div>
            <div className="text-[12px] text-[#8C959F] mt-3">
              Once approved, you'll receive an email to log in.
            </div>
            <div className="mt-6 text-xs text-[#57606a]">
              Already have an account?{" "}
              <Link href="/login" className="text-[#3A4EA2] font-semibold hover:underline">
                Log in
              </Link>
            </div>
          </div>
        ) : (
          /* ── Request access form ── */
          <>
            <div className="mb-5">
              <div className="text-[14px] font-bold text-[#24292f]">Request access</div>
              <div className="text-[12px] text-[#57606a] mt-0.5">
                We'll review your details and activate your account within 24 hours.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-[#57606a] mb-1">
                  Work Email
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
                  Phone Number
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-white border border-[#D0D7DE] rounded-md px-2 py-2 text-[13px] text-[#24292f] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent shrink-0"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#57606a] mb-1">
                  Firm / Company Name
                </label>
                <input
                  type="text"
                  placeholder="Acme Construction Pvt. Ltd."
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  required
                  className="w-full bg-white border border-[#D0D7DE] rounded-md px-3 py-2 text-[13px] text-[#24292f] placeholder:text-[#8C959F] focus:outline-none focus:ring-2 focus:ring-[#3A4EA2] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3A4EA2] text-white rounded-md py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0757b5] transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Request Access"}
              </button>
            </form>

            <div className="text-center text-xs text-[#57606a] mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-[#3A4EA2] font-semibold hover:underline">
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
