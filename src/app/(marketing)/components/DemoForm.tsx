"use client";

import { useState } from "react";

export default function DemoForm() {
  const [firm, setFirm] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ firm?: string; email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!firm.trim()) e.firm = "required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "valid email required";
    if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/[\s\-()]/g, ""))) e.phone = "valid number required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: firm, email, phone }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch {
      alert("Something went wrong. Email us at team@bluq.ai");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="m-demo-panel">
      <div className="dp-tag">/ book a demo</div>
      <h3>see BluQ on your <span className="serif-it">own project.</span></h3>

      {submitted ? (
        <div className="dp-success">
          ✓ you&apos;re booked. we&apos;ll reach out to <strong>{email}</strong> to confirm the session.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="dp-field">
            <label>firm name</label>
            <input
              type="text"
              placeholder="your company"
              value={firm}
              onChange={(e) => setFirm(e.target.value)}
            />
            {errors.firm && <div className="dp-err">{errors.firm}</div>}
          </div>
          <div className="dp-field">
            <label>work email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <div className="dp-err">{errors.email}</div>}
          </div>
          <div className="dp-field">
            <label>mobile number</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {errors.phone && <div className="dp-err">{errors.phone}</div>}
          </div>
          <button type="submit" className="m-btn big dp-submit" disabled={loading}>
            {loading ? "submitting..." : <>book my demo <span className="m-btn-arrow">→</span></>}
          </button>
          <div className="dp-note">30 min · bring your own schedule file · free</div>
        </form>
      )}
    </div>
  );
}
