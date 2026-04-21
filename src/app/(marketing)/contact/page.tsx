"use client";

import { useState } from "react";
import MobileNav from "../components/MobileNav";
import MobileAccordion from "../components/MobileAccordion";

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
      {/* NAV */}
      <nav className="m-nav">
        <div className="m-nav-inner">
          <a href="/" className="m-logo">
            <span className="m-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 20 L4 10 L12 4 L20 10 L20 20" stroke="#F4F1E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 20 L9 14 L15 14 L15 20" stroke="#F4F1E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="m-logo-text">blu<span className="q">Q</span></span>
          </a>
          <div className="m-nav-links">
            <a href="/">home</a>
            <a href="/#problem">problems</a>
            <a href="/#product">product</a>
            <a href="/#features">features</a>
            <a href="/about">about</a>
            <a href="/contact" className="active">contact</a>
            <a href="/#demo" className="m-btn demo-nav">book demo <span className="m-btn-arrow">→</span></a>
          </div>
          <MobileNav links={[
            { href: "/", label: "home" },
            { href: "/#problem", label: "problems" },
            { href: "/#product", label: "product" },
            { href: "/#features", label: "features" },
            { href: "/about", label: "about" },
            { href: "/contact", label: "contact", active: true },
            { href: "/#demo", label: "book demo →" },
          ]} />
        </div>
      </nav>

      {/* HERO */}
      <section className="m-contact-hero">
        <div className="m-wrap">
          <div className="eyebrow">contact</div>
          <h1>let&apos;s build<br />something <span className="serif-it">together.</span></h1>
          <p className="m-contact-hero-sub">
            Book a demo, ask a question, or talk to the founders directly. We reply fast. Usually within the same day.
          </p>
        </div>
      </section>

      {/* CONTACT FORM */}
      <section className="m-contact-section">
        <div className="m-wrap">
          <div className="m-form-wrap">
            <div className="m-form-card">
              <div className="form-title">send us a note</div>
              <h3>tell us what you&apos;re <span className="serif-it">working on.</span></h3>
              {success && (
                <div className="m-form-success show">
                  ✓ got it. we&apos;ll be in touch within a day.
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="m-field-row">
                  <div className="m-field">
                    <label>your name<span className="req">*</span></label>
                    <input type="text" name="name" required placeholder="Rajesh Kumar" />
                  </div>
                  <div className="m-field">
                    <label>your role<span className="req">*</span></label>
                    <select name="role" required defaultValue="">
                      <option value="" disabled>select...</option>
                      <option>PMC / Project Manager</option>
                      <option>EPC / Contractor</option>
                      <option>Developer</option>
                      <option>Site Engineer</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="m-field-row">
                  <div className="m-field">
                    <label>work email<span className="req">*</span></label>
                    <input type="email" name="email" required placeholder="you@company.com" />
                  </div>
                  <div className="m-field">
                    <label>company</label>
                    <input type="text" name="company" placeholder="your firm name" />
                  </div>
                </div>
                <div className="m-field">
                  <label>what&apos;s on your mind?<span className="req">*</span></label>
                  <textarea name="message" required placeholder="Tell us about your project, the delays you're dealing with, or just say hi..."></textarea>
                </div>
                <button type="submit" className="m-btn big m-form-submit" disabled={loading}>
                  {loading ? "sending..." : <>send message <span className="m-btn-arrow">→</span></>}
                </button>
                <div className="m-form-foot">we reply within one working day</div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="m-faq">
        <div className="m-wrap">
          <div className="m-faq-head">
            <div className="eye">quick answers</div>
            <h2>before you <span className="serif-it">write to us.</span></h2>
          </div>
          <MobileAccordion variant="beliefs" items={[
            { label: "Q1", heading: "how long is a demo?", body: "30 minutes. Bring your actual project file and we walk through BluQ on your real schedule, not a sandbox. You leave knowing exactly what changes on day one." },
            { label: "Q2", heading: "what file formats can we import?", body: "MS Project (.mpp) and Excel (.xlsx). All tasks, baselines, and resources preserved. Or drop your drawings and BOQ and BluQ will build the schedule from scratch." },
            { label: "Q3", heading: "how fast can we go live?", body: "One afternoon. 10 minutes to import your schedule, 30 minutes to connect your site team on WhatsApp, first DPR sent to your client that evening." },
            { label: "Q4", heading: "what does early access mean?", body: "Direct line to the product team. Priority onboarding. Pricing locked for life. And a real say in what we build next. Early access clients have shaped every major feature so far." },
          ]} />

          <div className="m-faq-grid">
            <div className="m-faq-item">
              <h4>how long is a demo?</h4>
              <p>30 minutes. Bring your actual project file and we walk through BluQ on your real schedule, not a sandbox. You leave knowing exactly what changes on day one.</p>
            </div>
            <div className="m-faq-item">
              <h4>what file formats can we import?</h4>
              <p>MS Project (.mpp) and Excel (.xlsx). All tasks, baselines, and resources preserved. Or drop your drawings and BOQ and BluQ will build the schedule from scratch.</p>
            </div>
            <div className="m-faq-item">
              <h4>how fast can we go live?</h4>
              <p>One afternoon. 10 minutes to import your schedule, 30 minutes to connect your site team on WhatsApp, first DPR sent to your client that evening.</p>
            </div>
            <div className="m-faq-item">
              <h4>what does early access mean?</h4>
              <p>Direct line to the product team. Priority onboarding. Pricing locked for life. And a real say in what we build next. Early access clients have shaped every major feature so far.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="m-footer">
        <div className="m-wrap">
          <div className="m-foot-grid">
            <div className="m-foot-brand">
              <a href="/" className="m-logo">
                <span className="m-logo-mark" style={{background:"#F4F1E8"}}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 20 L4 10 L12 4 L20 10 L20 20" stroke="#111113" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 20 L9 14 L15 14 L15 20" stroke="#111113" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="m-logo-text">blu<span className="q">Q</span></span>
              </a>
              <p>the real-time audit &amp; delay platform for construction projects.</p>
            </div>
            <div className="m-foot-col">
              <h4>product</h4>
              <ul>
                <li><a href="/#features">auto scheduling</a></li>
                <li><a href="/#features">schedule import</a></li>
                <li><a href="/#features">field updates</a></li>
                <li><a href="/#features">delay flagging</a></li>
                <li><a href="/#features">auto dpr</a></li>
              </ul>
            </div>
            <div className="m-foot-col">
              <h4>built for</h4>
              <ul>
                <li><a href="/#audience">pmc firms</a></li>
                <li><a href="/#audience">epc · turnkey contractors</a></li>
                <li><a href="/#audience">developers</a></li>
              </ul>
            </div>
            <div className="m-foot-col">
              <h4>company</h4>
              <ul>
                <li><a href="/about">about</a></li>
                <li><a href="/contact">contact</a></li>
                <li><a href="#">early access</a></li>
                <li><a href="#">privacy</a></li>
                <li><a href="#">terms</a></li>
              </ul>
            </div>
          </div>
          <div className="m-foot-bottom">
            <div>© 2026 bluq technologies</div>
            <div>building in public</div>
          </div>
        </div>
      </footer>
    </>
  );
}
