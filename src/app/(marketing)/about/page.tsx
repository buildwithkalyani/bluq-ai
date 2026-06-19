import type { Metadata } from "next";
import Image from "next/image";
import MobileNav from "../components/MobileNav";
import ScrollReveal from "../components/ScrollReveal";
import CountUp from "../components/CountUp";
import ExpandableCard from "../components/ExpandableCard";

export const metadata: Metadata = {
  title: "About · BluQ — AI-powered construction intelligence",
  description: "Why we're building BluQ. The story behind the platform that prevents construction delays before they happen.",
};

const Logo = () => (
  <a href="/" className="n-logo">
    <Image src="/bluq-logo.png" alt="BluQ" width={120} height={32} style={{ height: 32, width: "auto" }} />
  </a>
);

export default function About() {
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
            <a href="/about" style={{ color: "var(--text)" }}>About</a>
            <a href="/contact">Contact us</a>
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
      <section className="n-hero n-about-hero">
        <div className="n-orb n-orb-1" />
        <div className="n-orb n-orb-2" />
        <div className="n-orb n-orb-3" />
        <div className="n-wrap" style={{ position: "relative", zIndex: 2 }}>
          <div className="n-hero-badge">
            <span className="n-badge-dot" />
            OUR STORY
          </div>
          <h1 className="n-hero-h1">
            Construction runs the world.<br />
            <span className="n-accent">Its software should catch up.</span>
          </h1>
          <p className="n-hero-sub">
            98% of major projects run over time or over budget. Most of those delays aren&apos;t bad luck.
            They&apos;re information arriving too late. We&apos;re building the platform that fixes that.
          </p>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="n-section n-about-stats-section">
        <div className="n-wrap">
          <div className="n-about-stats">
            <div className="n-about-stat">
              <div className="n-about-stat-num"><CountUp to={12} /></div>
              <div className="n-about-stat-label">Active projects</div>
              <div className="n-about-stat-sub">running on BluQ across India and the Gulf</div>
            </div>
            <div className="n-about-stat-div" />
            <div className="n-about-stat">
              <div className="n-about-stat-num"><CountUp to={842} /></div>
              <div className="n-about-stat-label">Tasks tracked daily</div>
              <div className="n-about-stat-sub">updated automatically from WhatsApp check-ins</div>
            </div>
            <div className="n-about-stat-div" />
            <div className="n-about-stat">
              <div className="n-about-stat-num"><CountUp to={19} /><span className="n-about-stat-unit">hr/wk</span></div>
              <div className="n-about-stat-label">Saved per engineer</div>
              <div className="n-about-stat-sub">on DPRs, status calls, and manual reporting</div>
            </div>
            <div className="n-about-stat-div" />
            <div className="n-about-stat">
              <div className="n-about-stat-num">₹<CountUp to={4} />Cr+</div>
              <div className="n-about-stat-label">Average savings</div>
              <div className="n-about-stat-sub">in overruns identified and prevented per project</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STORY ────────────────────────────────────────────────────────── */}
      <section className="n-section" id="story">
        <div className="n-wrap">
          <div className="n-eyebrow">THE GAP</div>
          <div className="n-about-story">
            <ScrollReveal>
            <ExpandableCard
              className="n-about-story-row"
              trigger={<div className="n-about-story-label">why now</div>}
            >
              <div className="n-about-story-body">
                <p>A delay that will hit you on Friday is already visible in your site data on Wednesday. Most tools wait for it to appear in a weekly report. By then, three days of budget and schedule are already gone.</p>
                <p>BluQ reads those signals 48 hours early and tells you exactly how to stop it, before it ever touches your budget or handover date.</p>
              </div>
            </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={100}>
            <ExpandableCard
              className="n-about-story-row"
              trigger={<div className="n-about-story-label">what we built</div>}
            >
              <div className="n-about-story-body">
                <p>Your site engineer sends his evening WhatsApp update, the same way he always has. By end of day, your schedule is updated, your delay is flagged, and the DPR is already on its way to your client.</p>
                <p>Nobody typed a report. Nobody filled a form. Zero behavior change on site. Full intelligence in your office.</p>
              </div>
            </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={200}>
            <ExpandableCard
              className="n-about-story-row"
              trigger={<div className="n-about-story-label">who we are</div>}
            >
              <div className="n-about-story-body">
                <p>We&apos;re builders who got tired of watching construction projects fail for the same preventable reason: delayed information. Every feature in BluQ came from a real site, a real delay, and a real person who needed a better answer.</p>
                <p>We don&apos;t guess what the industry needs. We&apos;ve seen it.</p>
              </div>
            </ExpandableCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── BELIEFS ──────────────────────────────────────────────────────── */}
      <section className="n-section" id="beliefs">
        <div className="n-wrap">
          <div className="n-section-head">
            <div className="n-eyebrow">WHAT WE BELIEVE</div>
            <h2 className="n-section-h2">Six principles.<br /><span className="n-accent">One obsession.</span></h2>
            <p className="n-section-sub">Prevent the delay. Not chase it.</p>
          </div>
          <div className="n-beliefs-grid">
            {[
              {
                n: "01",
                title: "Site data is the main thing.",
                body: "Not a spreadsheet afterthought. If BluQ can't read what's happening on site in real time, nothing else we build matters.",
              },
              {
                n: "02",
                title: "No new apps. Ever.",
                body: "Your site engineer is not downloading a new app. He's replying on WhatsApp. BluQ works inside that habit, not against it.",
              },
              {
                n: "03",
                title: "A delay caught early costs nothing.",
                body: "The hour after slippage is where cost and time are actually saved. BluQ doesn't just detect the delay. It tells you exactly what to move and who to call.",
              },
              {
                n: "04",
                title: "Proof, not argument.",
                body: "When the penalty notice arrives, the side with the timestamped trail wins. We build BluQ so that side is always yours.",
              },
              {
                n: "05",
                title: "Built on construction sites.",
                body: "Every feature came from a real site, a real delay, a real person who needed a better answer. We don't guess what the industry needs.",
              },
              {
                n: "06",
                title: "Complexity is the enemy.",
                body: "If it takes more than one WhatsApp message to update your schedule, we've failed. BluQ removes friction, not adds it.",
              },
            ].map((b) => (
              <ExpandableCard
                key={b.n}
                className="n-belief-card"
                trigger={
                  <>
                    <div className="n-belief-n">{b.n}</div>
                    <h3 className="n-belief-title">{b.title}</h3>
                  </>
                }
              >
                <p className="n-belief-body">{b.body}</p>
              </ExpandableCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="n-cta" id="demo">
        <div className="n-orb n-orb-cta" />
        <div className="n-wrap" style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <div className="n-eyebrow" style={{ marginBottom: 18 }}>WANT TO KNOW MORE?</div>
          <h2 className="n-cta-h2" style={{ maxWidth: 600, margin: "0 auto 18px" }}>
            See it on your<br />
            <span className="n-accent">own project.</span>
          </h2>
          <p className="n-cta-sub" style={{ maxWidth: 440, margin: "0 auto 36px" }}>
            Bring a project file. We&apos;ll show you exactly what BluQ would have caught and what it would have saved.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/#demo" className="n-btn-primary n-btn-large">Book a Free Demo →</a>
            <a href="/contact" className="n-btn-ghost" style={{ padding: "16px 24px", fontSize: 15 }}>Contact us</a>
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
