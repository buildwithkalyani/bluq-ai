"use client";

import { useState } from "react";
import Image from "next/image";
import MobileNav from "../components/MobileNav";
import ExpandableCard from "../components/ExpandableCard";

const Logo = () => (
  <a href="/" className="n-logo">
    <Image src="/bluq-logo.png" alt="BluQ" width={120} height={32} style={{ height: 32, width: "auto" }} />
  </a>
);

export default function Contact() {
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("failed");
      setSuccess(true);
      form.reset();
    } catch {
      alert("Something went wrong. Email us at team@bluq.ai");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="n-nav">
        <div className="n-nav-inner">
          <Logo />
          <div className="n-nav-links">
            <a href="/">Home</a>
            <a href="/#problem">Problem</a>
            <a href="/#product">Product</a>
            <a href="/#built-for">Who it&apos;s for</a>
            <a href="/about">About</a>
            <a href="/contact" style={{ color: "var(--text)" }}>Contact us</a>
            <a href="/#demo" className="n-nav-cta">Get a Demo →</a>
          </div>
          <MobileNav links={[
            { href: "/",          label: "Home" },
            { href: "/#problem",  label: "Problem" },
            { href: "/#product",  label: "Product" },
            { href: "/#built-for",label: "Who it's for" },
            { href: "/about",     label: "About" },
            { href: "/contact",   label: "Contact us" },
            { href: "/#demo",     label: "Get a Demo →" },
          ]} />
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="n-hero n-contact-hero">
        <div className="n-orb n-orb-1" />
        <div className="n-orb n-orb-2" />
        <div className="n-wrap" style={{ position: "relative", zIndex: 2 }}>
          <div className="n-hero-badge">
            <span className="n-badge-dot" />
            TALK TO US
          </div>
          <h1 className="n-hero-h1">
            Let&apos;s build something<br />
            <span className="n-accent">together.</span>
          </h1>
          <p className="n-hero-sub">
            Book a demo, ask a question, or talk to the founders directly. We reply fast, usually within the same day.
          </p>
        </div>
      </section>

      {/* ── CONTACT SECTION ──────────────────────────────────────────────── */}
      <section className="n-section n-contact-section">
        <div className="n-wrap">
          <div className="n-contact-grid">

            {/* Left — info */}
            <div className="n-contact-info">
              <div className="n-eyebrow" style={{ marginBottom: 28 }}>GET IN TOUCH</div>

              <div className="n-contact-channel">
                <div className="n-channel-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <div className="n-channel-label">Email us</div>
                  <a href="mailto:aishna@bluq.ai" className="n-channel-value">aishna@bluq.ai</a>
                  <br />
                  <a href="mailto:kalyani@bluq.ai" className="n-channel-value">kalyani@bluq.ai</a>
                </div>
              </div>

              <div className="n-contact-channel">
                <div className="n-channel-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div className="n-channel-label">Response time</div>
                  <div className="n-channel-value">Within one working day</div>
                </div>
              </div>

              <div className="n-contact-divider" />

              <div className="n-contact-quickfacts">
                <div className="n-eyebrow" style={{ marginBottom: 16 }}>DEMO DETAILS</div>
                <ul className="n-contact-facts">
                  <li><span className="n-check-accent">✓</span> 30 min session, no sales pitch</li>
                  <li><span className="n-check-accent">✓</span> Bring your own project file</li>
                  <li><span className="n-check-accent">✓</span> We show what BluQ would have caught</li>
                  <li><span className="n-check-accent">✓</span> Completely free</li>
                </ul>
              </div>
            </div>

            {/* Right — form */}
            <div className="n-contact-form-wrap">
              {success ? (
                <div className="df-success">
                  <div className="df-success-icon">✓</div>
                  <h3 className="df-success-title">Message received!</h3>
                  <p className="df-success-body">We&apos;ll get back to you within one working day.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="df-row">
                    <div className="df-field">
                      <label className="df-label">Your name <span style={{ color: "var(--red)" }}>*</span></label>
                      <input className="df-input" type="text" name="name" required placeholder="Rajesh Kumar" />
                    </div>
                    <div className="df-field">
                      <label className="df-label">Your role <span style={{ color: "var(--red)" }}>*</span></label>
                      <select className="df-input" name="role" required defaultValue="">
                        <option value="" disabled>Select...</option>
                        <option>PMC / Project Manager</option>
                        <option>EPC / Contractor</option>
                        <option>Developer</option>
                        <option>Site Engineer</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="df-row">
                    <div className="df-field">
                      <label className="df-label">Work email <span style={{ color: "var(--red)" }}>*</span></label>
                      <input className="df-input" type="email" name="email" required placeholder="you@company.com" />
                    </div>
                    <div className="df-field">
                      <label className="df-label">Company</label>
                      <input className="df-input" type="text" name="company" placeholder="Your firm name" />
                    </div>
                  </div>
                  <div className="df-field">
                    <label className="df-label">What&apos;s on your mind? <span style={{ color: "var(--red)" }}>*</span></label>
                    <textarea
                      className="df-input"
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell us about your project, delays you're dealing with, or just say hi..."
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <button type="submit" className="df-submit" disabled={loading}>
                    {loading ? "Sending…" : "Send Message →"}
                  </button>
                  <p className="df-note">We reply within one working day</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="n-section" id="faq">
        <div className="n-wrap">
          <div className="n-section-head n-head-center">
            <div className="n-eyebrow">QUICK ANSWERS</div>
            <h2 className="n-section-h2">Before you write to us.</h2>
          </div>
          <div className="n-faq-grid">
            {[
              {
                q: "How long is a demo?",
                a: "30 minutes. Bring your actual project file and we walk through BluQ on your real schedule, not a sandbox. You leave knowing exactly what changes on day one.",
              },
              {
                q: "What file formats can we import?",
                a: "MS Project (.mpp), Primavera P6 (.xer), and Excel (.xlsx). All tasks, baselines, and dependencies carry over. Or drop your drawings and BOQ and BluQ builds the schedule from scratch.",
              },
              {
                q: "How fast can we go live?",
                a: "One afternoon. 10 minutes to import your schedule, 30 minutes to connect your site team on WhatsApp, first DPR sent to your client that evening.",
              },
              {
                q: "What does early access mean?",
                a: "Direct line to the product team. Priority onboarding. Pricing locked for life. And a real say in what we build next. Early access clients have shaped every major feature so far.",
              },
              {
                q: "Do site engineers need to learn a new tool?",
                a: "No. They reply on WhatsApp exactly as they do today. BluQ's bot parses those messages and structures the data automatically. Zero behavior change on site.",
              },
              {
                q: "Is our project data secure?",
                a: "Yes. Data is encrypted at rest and in transit. We're hosted on enterprise-grade infrastructure in India with role-based access controls for every user.",
              },
            ].map((item) => (
              <ExpandableCard
                key={item.q}
                className="n-faq-card"
                trigger={<h4 className="n-faq-q">{item.q}</h4>}
              >
                <p className="n-faq-a">{item.a}</p>
              </ExpandableCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="n-footer">
        <div className="n-wrap">
          <div className="n-footer-grid">
            <div className="n-footer-brand">
              <Logo />
              <p className="n-footer-tagline">The AI-powered construction intelligence platform. Prevent delays before they happen.</p>
            </div>
            <div className="n-footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="/#product">Daily Task Tracking</a></li>
                <li><a href="/#product">Gantt &amp; Critical Path</a></li>
                <li><a href="/#product">AI Delay Analytics</a></li>
                <li><a href="/#product">Schedule Import</a></li>
                <li><a href="/#product">WhatsApp Bot</a></li>
              </ul>
            </div>
            <div className="n-footer-col">
              <h4>Built for</h4>
              <ul>
                <li><a href="/#built-for">PMC Firms</a></li>
                <li><a href="/#built-for">EPC &amp; Contractors</a></li>
                <li><a href="/#built-for">Developers</a></li>
              </ul>
            </div>
            <div className="n-footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="/about">About</a></li>
                <li><a href="/#demo">Book a Demo</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="/terms">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="n-footer-bottom">
            <span className="n-footer-copy">© 2026 BluQ Technologies. Building in public.</span>
            <div className="n-footer-legal">
              <a href="#">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
