"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [firm, setFirm] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phone?: string; firm?: string }>({});

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)";
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll<HTMLElement>(".feat-card,.prob-card,.stat-cell").forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(14px)";
      el.style.transition = "opacity .45s ease,transform .45s ease";
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function validate() {
    const newErrors: { email?: string; phone?: string; firm?: string } = {};
    if (!firm.trim()) newErrors.firm = "Firm name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Please enter a valid email";
    if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/[\s\-()]/g, ""))) newErrors.phone = "Please enter a valid mobile number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function submitDemo() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const response = await fetch("https://bluq-ai-production.up.railway.app/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: firm, email, phone }),
      });
      if (!response.ok) throw new Error("Failed to submit request.");
      setSubmitted(true);
    } catch (error) {
      console.error("Submission Error:", error);
      alert("Something went wrong. Please try again or contact us directly.");
    } finally {
      setIsLoading(false);
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      {/* NAV */}
      <nav>
        <a href="#" className="logo" style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Image src="/bluq-logo.png" alt="BluQ" width={100} height={28} style={{ height: "28px", width: "auto" }} />
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <div className="nav-r">
          <div className="nav-divider" />
          <a href="/login" className="btn-ghost">Log In</a>
          <a href="#demo" className="btn-blue">Book a Free Demo</a>
          <button
            className={`hamburger${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="mobile-menu open">
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
          <div className="mobile-ctas">
            <a href="/login" className="btn-ghost" onClick={closeMenu}>Log In</a>
            <a href="#demo" className="btn-blue" onClick={closeMenu} style={{ textAlign: "center" }}>Book a Free Demo</a>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge"><span className="badge-dot" />Now in Early Access</div>
        <h1>Schedule Intelligence for <br /><span>Construction</span></h1>
        <p className="hero-sub">BluQ auto-schedules your projects, warns you before delays escalate, collects field updates via WhatsApp, and generates your DPR within minutes.</p>
        <div className="hero-ctas">
          <a href="#demo" className="btn-hero">Book a Free Demo</a>
        </div>
      </div>

      {/* DASHBOARD PREVIEW */}
      <div className="preview">
        <div className="chrome">
          <div className="cdots">
            <span style={{ background: "#FF5F56" }} />
            <span style={{ background: "#FFBD2E" }} />
            <span style={{ background: "#27C93F" }} />
          </div>
          <div className="curl">bluq.ai / Al Nakheel Tower / Dashboard</div>
        </div>
        <div className="screen">
          <div className="stb">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="slogo">BluQ</span>
              <span className="sbc"><span>/</span>Al Nakheel Tower<span>/</span><strong style={{ color: "var(--text)" }}>Dashboard</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13 }}>🔔</span>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "'IBM Plex Mono',monospace" }}>AP</div>
            </div>
          </div>
          <div className="sbody">
            <div className="ssb">
              {[{ icon: "📊", label: "Overview", on: true }, { icon: "📅", label: "Schedule" }, { icon: "💬", label: "WhatsApp" }, { icon: "📁", label: "Docs" }, { icon: "📄", label: "Reports" }].map((item) => (
                <div key={item.label} className={`sni${item.on ? " on" : ""}`}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="smain">
              <div className="ai-card">
                <div className="ai-head">
                  <span className="ai-live" />
                  <span className="ai-lbl">AI BRIEFING</span>
                  <span className="ai-time">Updated 4 min ago</span>
                </div>
                <div className="ai-txt"><strong>3 items need attention:</strong> Foundation Works is 2 days behind schedule due to a cement shortage. MEP Rough-In shows 0% progress with no WhatsApp response from contractor. Tower B Waterproofing has been delayed 4 consecutive days. <span className="ai-cta">→ Escalate Foundation Works now.</span></div>
              </div>
              <div className="mrow">
                <div className="mc"><div className="mcv" style={{ color: "var(--green)" }}>8</div><div className="mcl">On Track</div></div>
                <div className="mc"><div className="mcv" style={{ color: "var(--amber)" }}>3</div><div className="mcl">Running Late</div></div>
                <div className="mc"><div className="mcv" style={{ color: "var(--red)" }}>1</div><div className="mcl">Delayed</div></div>
                <div className="mc"><div className="mcv" style={{ color: "var(--blue)" }}>12</div><div className="mcl">Total Active</div></div>
              </div>
              <div className="wcard">
                <div className="wlbl" style={{ color: "var(--red)" }}>⚠ HIGH PRIORITY: Material Shortage</div>
                <div className="wtitle">Foundation Works, Al Nakheel Tower</div>
                <div className="wsub">Rajesh Kumar · &quot;Cement delivery delayed by supplier, expected tomorrow&quot;</div>
              </div>
              <div className="wcard med">
                <div className="wlbl" style={{ color: "var(--amber)" }}>⚠ MEDIUM: Labour Gap</div>
                <div className="wtitle">Rebar Installation, Tower B</div>
                <div className="wsub">Ahmed Hassan · &quot;3 workers absent, replacements needed by 8 AM&quot;</div>
              </div>
              <div className="tbl">
                <div className="th"><span>Project</span><span>Progress</span><span>Status</span><span>Variance</span></div>
                <div className="tr">
                  <span className="tn">Al Nakheel Tower Ph.1</span>
                  <div><div className="bw"><div className="bf" style={{ width: "74%", background: "var(--green)" }} /></div><span style={{ fontSize: 9, color: "var(--text3)" }}>74%</span></div>
                  <span className="pill" style={{ background: "#DAFBE1", color: "var(--green)" }}>● Completed</span>
                  <span className="var" style={{ color: "var(--green)" }}>+2d ahead</span>
                </div>
                <div className="tr">
                  <span className="tn">Madinat Jumeirah Villas</span>
                  <div><div className="bw"><div className="bf" style={{ width: "52%", background: "var(--amber)" }} /></div><span style={{ fontSize: 9, color: "var(--text3)" }}>52%</span></div>
                  <span className="pill" style={{ background: "#FFF8C5", color: "var(--amber)" }}>⚠ Late</span>
                  <span className="var" style={{ color: "var(--red)" }}>−5d behind</span>
                </div>
                <div className="tr">
                  <span className="tn">Reem Island Commercial</span>
                  <div><div className="bw"><div className="bf" style={{ width: "38%", background: "var(--blue)" }} /></div><span style={{ fontSize: 9, color: "var(--text3)" }}>38%</span></div>
                  <span className="pill" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>● Active</span>
                  <span className="var" style={{ color: "var(--text3)" }}>On schedule</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="stats-strip">
        <div className="stats-inner">
          <div className="stat-cell">
            <div className="stat-num">80%</div>
            <div className="stat-label">Of construction projects exceed their original budget</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">12+ hrs</div>
            <div className="stat-label">Spent per week per engineer on manual schedule updates</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">7+ hrs</div>
            <div className="stat-label">Lost every week to manual progress reporting and DPR writing</div>
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <section>
        <div className="wrap">
          <div className="stag">The Problem</div>
          <h2>Most construction delays were<br />preventable.</h2>
          <p className="section-sub">Delays don&apos;t appear out of nowhere. They build through days of small signals that no one caught because there was no system in place to catch them.</p>
          <div className="prob-grid">
            {[
              { title: "Schedules live in spreadsheets", desc: "Every update means hunting for the right file, reconciling versions, and manually checking which tasks are behind. All before you even understand the actual problem." },
              { title: "You find out too late", desc: "By the time a delay surfaces in a weekly report, the critical path has already shifted and the window to recover quietly has closed." },
              { title: "DPRs consume your evenings", desc: "Project engineers spend 1 to 2 hours every night writing daily progress reports by hand. Time that should go into actual project oversight." },
            ].map((p) => (
              <div key={p.title} className="prob-card">
                <h3 className="prob-t">{p.title}</h3>
                <p className="prob-d">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="wrap">
          <div className="stag">Features</div>
          <h2>Built for how construction <br />project management actually works.</h2>
          <p className="section-sub">Not a generic PM tool retrofitted for construction. Every feature in BluQ exists because a PMC firm asked for it.</p>
          <div className="feat-grid">
            {[
              { ico: "📅", title: "Auto-Scheduling & Gantt", desc: "Import your existing Primavera P6, MS Project, or Excel schedule in one click. BluQ builds the Gantt, maps predecessors, and tracks your live critical path automatically.", tag: "Gantt · Critical Path · Import" },
              { ico: "⚠️", title: "Early Warning System", desc: "Get flagged before delays reach your critical path. BluQ monitors task progress against your baseline and raises colour-coded risk alerts so you act before things escalate.", tag: "Delay Prediction · Risk Flags" },
              { ico: "🤖", title: "AI Daily Briefing", desc: "Each morning, BluQ's AI reads all site updates and surfaces the 3 to 5 things that need your attention, with a recommended action.", tag: "AI · Summary · Action Items" },
              { ico: "💬", title: "WhatsApp Field Updates", desc: "BluQ's EOD bot prompts your site engineers on WhatsApp each evening. They reply in plain language with no app to download and no training needed.", tag: "WhatsApp Bot · EOD · No App" },
              { ico: "📄", title: "Automated DPR Generation", desc: "Stop writing daily progress reports by hand. BluQ generates branded, client-ready DPRs from field inputs automatically. Ready to send in minutes, not hours.", tag: "DPR · Auto-Generate · PDF" },
              { ico: "📊", title: "Baseline vs. Actual Tracking", desc: "Compare your original baseline against real-time actuals at any moment. Generate S-Curves, analyse delay trends, and present live performance data to your clients.", tag: "Baseline · S-Curve · Variance" },
            ].map((f) => (
              <div key={f.title} className="feat-card">
                <div className="feat-ico">{f.ico}</div>
                <h3 className="feat-t">{f.title}</h3>
                <p className="feat-d">{f.desc}</p>
                <span className="feat-tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="how-bg">
        <div className="wrap">
          <div className="stag">How It Works</div>
          <h2>Three steps from your existing <br />schedule to a live project.</h2>
          <p className="section-sub">No long implementations. No consultants. Import your existing schedule and go live the same week.</p>
          <div className="steps">
            {[
              { num: "01", title: "Import Your Schedule", desc: "Upload your .xer, .mpp, or Excel file. BluQ parses tasks, durations, predecessors, and contractors automatically, preserving all your existing work in under 10 minutes." },
              { num: "02", title: "Connect Your Site Team", desc: "Add site engineers via WhatsApp. BluQ's EOD bot prompts them each evening for progress updates. They respond in plain language with no app download or training required." },
              { num: "03", title: "Track, Warn & Report", desc: "BluQ updates your live schedule, raises warnings before delays escalate, and auto-generates your DPR every morning. Ready to send to your client without any manual effort." },
            ].map((s) => (
              <div key={s.num}>
                <div className="step-num">{s.num}</div>
                <h3 className="step-t">{s.title}</h3>
                <p className="step-d">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap-narrow">
          <div className="stag">FAQ</div>
          <h2>Questions we get before every demo.</h2>
          <div className="faq">
            {[
              { q: "Can BluQ import a Primavera P6 or MS Project schedule?", a: "Yes. BluQ supports direct import of .xer (Primavera P6), .mpp (MS Project), and .xlsx schedules. All tasks, durations, predecessors, resources, and baselines are preserved. You can re-import updated schedules at any time and BluQ reconciles changes without losing your historical data." },
              { q: "How does the WhatsApp EOD bot collect daily progress?", a: "At a configurable time each evening, BluQ's bot sends a structured prompt to each site engineer on WhatsApp. They respond with progress, issues, and remarks in plain language. The bot parses the response and updates both your live schedule and DPR automatically with no app or training needed for field staff." },
              { q: "What does the delay early warning system actually detect?", a: "BluQ continuously analyses actual progress against your baseline and critical path. It raises automatic alerts for tasks trending behind plan, critical path impacts, material delivery gaps, labour shortages, and external disruptions like weather events, each colour-coded by severity so you know exactly what to prioritise." },
              { q: "How fast can a new project go live on BluQ?", a: "Most PMC teams are fully live within a few hours. Importing your schedule takes under 10 minutes. Configuring contractors, team access, and the WhatsApp bot takes another 30 to 60 minutes. Our onboarding team provides live support for your first project at no extra cost." },
              { q: "Can I manage multiple projects from one account?", a: "Yes. BluQ is built for firms managing full project portfolios. Your Projects Dashboard shows the health of all active projects at a glance, whether on track, running late, or delayed. Drill into any project in one click." },
              { q: "What does being in early access mean for us?", a: "Early access customers work directly with our product team. You get priority onboarding, direct input into the product roadmap, and early-access pricing locked in for life. We ask for honest feedback and the occasional call to understand how your team uses the platform." },
            ].map((item) => (
              <details key={item.q}>
                <summary>{item.q}<span className="chev">+</span></summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="demo">
        <div className="cta-card">
          {submitted ? (
            <>
              <div className="stag" style={{ margin: "0 auto 16px", display: "inline-flex" }}>Confirmed</div>
              <h2 style={{ marginBottom: 12 }}>You&apos;re booked.</h2>
              <p style={{ color: "var(--text2)", fontSize: 15 }}>We&apos;ll reach out to <strong>{email}</strong> to schedule your session.</p>
            </>
          ) : (
            <>
              <div className="stag" style={{ margin: "0 auto 16px", display: "inline-flex" }}>Book a Free Demo</div>
              <h2>See BluQ on your actual projects.</h2>
              <p>Book a focused 30-minute session. Bring your own schedule file and we&apos;ll walk through exactly how BluQ would work on your projects from day one.</p>
              <div className="cta-form">
                <input className="inp" type="text" placeholder="Firm name" value={firm} onChange={(e) => setFirm(e.target.value)} />
                {errors.firm && <span className="err">{errors.firm}</span>}
                <input className="inp" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email && <span className="err">{errors.email}</span>}
                <input className="inp" type="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                {errors.phone && <span className="err">{errors.phone}</span>}
                <button className="btn-submit" onClick={submitDemo} disabled={isLoading}>
                  {isLoading ? "Submitting..." : "Book My Demo →"}
                </button>
              </div>
              <p className="cta-note">Early access · Onboarding support included</p>
            </>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="ft">
          <div className="fb">
            <div className="flogo">BluQ</div>
            <p className="fdesc">Construction schedule intelligence.</p>
          </div>
          {[
            { title: "Product", links: ["Auto-Scheduling", "Early Warning System", "AI Daily Briefing", "WhatsApp Updates", "DPR Generation", "Baseline vs Actual"] },
            { title: "Use Cases", links: ["PMC Firms", "Real Estate Developers", "Contractors"] },
            { title: "Company", links: ["About", "Early Access", "Contact", "Privacy Policy", "Terms of Service"] },
          ].map((col) => (
            <div key={col.title} className="fc">
              <h4>{col.title}</h4>
              <ul>{col.links.map((l) => <li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="fbot">
          <p>© 2026 BluQ Technologies. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}