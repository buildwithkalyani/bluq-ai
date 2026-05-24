"use client";

import { useState } from "react";

export default function DemoForm() {
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; firm?: string; email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "required";
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
        body: JSON.stringify({ name, companyName: firm, email, phone }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch {
      alert("Something went wrong. Email us at team@bluq.ai");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="df-success">
        <div className="df-success-icon">✓</div>
        <h3 className="df-success-title">You&apos;re booked!</h3>
        <p className="df-success-body">We&apos;ll reach out to <strong>{email}</strong> to confirm your 30-min session.</p>
      </div>
    );
  }

  return (
    <form className="n-demo-form" onSubmit={handleSubmit}>
      <div className="df-row">
        <div className="df-field">
          <label className="df-label">Your name</label>
          <input
            className="df-input"
            type="text"
            placeholder="Rahul Verma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <span className="df-err">{errors.name}</span>}
        </div>
        <div className="df-field">
          <label className="df-label">Company / firm</label>
          <input
            className="df-input"
            type="text"
            placeholder="Larsen & Toubro"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
          />
          {errors.firm && <span className="df-err">{errors.firm}</span>}
        </div>
      </div>
      <div className="df-row">
        <div className="df-field">
          <label className="df-label">Work email</label>
          <input
            className="df-input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <span className="df-err">{errors.email}</span>}
        </div>
        <div className="df-field">
          <label className="df-label">Mobile number</label>
          <input
            className="df-input"
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {errors.phone && <span className="df-err">{errors.phone}</span>}
        </div>
      </div>
      <button type="submit" className="df-submit" disabled={loading}>
        {loading ? "Submitting…" : "Book My Free Demo →"}
      </button>
      <p className="df-note">30 min · bring your own schedule file · completely free</p>
    </form>
  );
}
