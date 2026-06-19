import Image from "next/image";
import MobileNav from "./components/MobileNav";
import DemoForm from "./components/DemoForm";
import ScrollReveal from "./components/ScrollReveal";
import CountUp from "./components/CountUp";
import ProductFeatures from "./components/ProductFeatures";
import ExpandableCard from "./components/ExpandableCard";

const Logo = () => (
  <a href="/" className="n-logo">
    <Image src="/bluq-logo.png" alt="BluQ" width={80} height={20} style={{ height: 32, width: "auto" }} />
  </a>
);


export default function Home() {
  return (
    <>
      {/* NAV */}
      <nav className="n-nav">
        <div className="n-nav-inner">
          <Logo />
          <div className="n-nav-links">
            <a href="/">Home</a>
            <a href="#problem">Problem</a>
            <a href="#product">Product</a>
            <a href="#built-for">Who it&apos;s for</a>
            <a href="/about">About</a>
            <a href="/contact">Contact us</a>
            <a href="#demo" className="n-nav-cta">Get a Demo →</a>
          </div>
          <MobileNav links={[
            { href: "/",          label: "Home" },
            { href: "#problem",   label: "Problem" },
            { href: "#product",   label: "Product" },
            { href: "#built-for", label: "Who it's for" },
            { href: "/about",     label: "About" },
            { href: "/contact",   label: "Contact us" },
            { href: "#demo",      label: "Get a Demo →" },
          ]} />
        </div>
      </nav>

      {/* HERO */}
      <section className="n-hero">
        <div className="n-orb n-orb-1" />
        <div className="n-orb n-orb-2" />
        <div className="n-orb n-orb-3" />
        <div className="n-wrap" style={{ position: "relative", zIndex: 2 }}>
          <h1 className="n-hero-h1">
            Prevent construction delays{' '}<br />
            <span className="n-accent">before they happen.</span>
          </h1>
          <p className="n-hero-sub">
            The intelligent SaaS platform for Indian PMCs, contractors, and developers.
            Live audit trails and AI-powered schedule re-optimization to save crores in overruns.
          </p>
          <div className="n-hero-ctas">
            <a href="#demo" className="n-btn-primary">Get a Demo →</a>
            <a href="/login" className="n-btn-ghost">Sign in →</a>
          </div>
          <div className="n-hero-ss-wrap">
            <div className="n-hero-ss n-float">
              <Image
                src="/screenshots/dashboard.png"
                alt="BluQ dashboard - live project overview"
                width={1400}
                height={840}
                style={{ width: "100%", height: "auto", display: "block" }}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="n-section" id="problem">
        <div className="n-wrap">
          <ScrollReveal>
            <div className="n-section-head">
              <h2 className="n-section-h2">
                Construction delays are costing<br />
                you <span className="n-red">crores.</span>
              </h2>
              <p className="n-section-sub">
                In the Indian construction sector, 70% of mega-projects face delays, leading to massive
                cost overruns. Fragmented communication and reactive planning are the culprits.
              </p>
            </div>
          </ScrollReveal>
          <div className="n-problem-grid">
            <ScrollReveal delay={0}>
              <ExpandableCard
                className="n-problem-card"
                trigger={
                  <>
                    <div className="n-prob-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                        <polyline points="16 7 22 7 22 13"/>
                      </svg>
                    </div>
                    <h3 className="n-problem-title">Cost Overruns</h3>
                  </>
                }
              >
                <p className="n-problem-body">Every day of delay adds compounding interest, labor costs, and material escalation penalties to your bottom line.</p>
              </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <ExpandableCard
                className="n-problem-card"
                trigger={
                  <>
                    <div className="n-prob-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    </div>
                    <h3 className="n-problem-title">Blind Spots</h3>
                  </>
                }
              >
                <p className="n-problem-body">Weekly WhatsApp updates and Excel sheets hide the real critical path. By the time a delay is reported, it&apos;s too late to fix.</p>
              </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <ExpandableCard
                className="n-problem-card"
                trigger={
                  <>
                    <div className="n-prob-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <h3 className="n-problem-title">Dispute Risks</h3>
                  </>
                }
              >
                <p className="n-problem-body">Without a single source of truth, contractors and developers spend months in arbitration arguing over who caused the delay.</p>
              </ExpandableCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      <section className="n-section" id="product">
        <div className="n-wrap">
          <ScrollReveal>
            <div className="n-eyebrow">THE PRODUCT</div>
            <h2 className="n-section-h2" style={{ marginBottom: 64 }}>
              Every view your team needs.<br />
              <span className="n-accent">One platform.</span>
            </h2>
          </ScrollReveal>

          {/* Desktop: original alternating rows */}
          <div className="pf-desktop-rows">
            <div className="n-feat-row">
              <div className="n-feat-copy">
                <div className="n-feat-eyebrow">01</div>
                <div className="n-feat-icon-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h3 className="n-feat-title">Live Daily Tracking via WhatsApp</h3>
                <p className="n-feat-body">Your site teams already use WhatsApp. BluQ&apos;s bot converts those messages into structured, geo-tagged task updates. Every completion, delay, and photo logs directly into an immutable audit trail. No new app. No new habit.</p>
                <ul className="n-feat-bullets">
                  <li><span className="n-check-accent">✓</span> Geo-tagged photo proof from the field</li>
                  <li><span className="n-check-accent">✓</span> Tasks auto-linked by zone &amp; contractor</li>
                  <li><span className="n-check-accent">✓</span> Auto-flags issues, labor shortages &amp; delays</li>
                  <li><span className="n-check-accent">✓</span> Automated daily progress reports (DPRs)</li>
                </ul>
              </div>
              <div className="n-ss-frame">
                <img src="/screenshots/whatsapp-feed.png" alt="BluQ WhatsApp bot feed" style={{width:"100%",height:"auto",display:"block"}} />
              </div>
            </div>
            <div className="n-feat-row n-feat-row-rev">
              <div className="n-ss-frame">
                <img src="/screenshots/delay-analytics.png" alt="BluQ delay analytics" style={{width:"100%",height:"auto",display:"block"}} />
              </div>
              <div className="n-feat-copy">
                <div className="n-feat-eyebrow">02</div>
                <div className="n-feat-icon-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <h3 className="n-feat-title">AI Delay Analytics</h3>
                <p className="n-feat-body">When slippage happens, bluQ instantly identifies the root cause, models downstream cascade impact, and recommends resource actions to recover time before it compounds.</p>
                <ul className="n-feat-bullets">
                  <li><span className="n-check-accent">✓</span> Critical path impact per contractor</li>
                  <li><span className="n-check-accent">✓</span> AI root cause analysis &amp; recommendations</li>
                  <li><span className="n-check-accent">✓</span> MS Project &amp; Primavera integration</li>
                </ul>
              </div>
            </div>
            <div className="n-feat-row">
              <div className="n-feat-copy">
                <div className="n-feat-eyebrow">03</div>
                <div className="n-feat-icon-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10" width="12" height="3" rx="1"/><rect x="3" y="16" width="15" height="3" rx="1"/>
                  </svg>
                </div>
                <h3 className="n-feat-title">Interactive Gantt View</h3>
                <p className="n-feat-body">See your entire schedule on a live Gantt chart, updated in real-time from WhatsApp check-ins. Critical path slippage is auto-detected and highlighted the moment it happens.</p>
                <ul className="n-feat-bullets">
                  <li><span className="n-check-accent">✓</span> Live critical path with cascade impact</li>
                  <li><span className="n-check-accent">✓</span> Auto-detects slippage from field updates</li>
                  <li><span className="n-check-accent">✓</span> One-click AI Reoptimize to recover lost time</li>
                </ul>
              </div>
              <div className="n-ss-frame">
                <img src="/screenshots/gantt-view.png" alt="BluQ Gantt chart" style={{width:"100%",height:"auto",display:"block"}} />
              </div>
            </div>
            <div className="n-feat-row n-feat-row-rev">
              <div className="n-ss-frame">
                <img src="/screenshots/import-schedule.png" alt="BluQ AI schedule import" style={{width:"100%",height:"auto",display:"block"}} />
              </div>
              <div className="n-feat-copy">
                <div className="n-feat-eyebrow">04</div>
                <div className="n-feat-icon-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <h3 className="n-feat-title">AI Schedule Import</h3>
                <p className="n-feat-body">No existing schedule? BluQ reads your drawings, BOQ, and scope documents and builds a complete project schedule in under 2 minutes. Or import from MS Project, Primavera P6, or Excel instantly.</p>
                <ul className="n-feat-bullets">
                  <li><span className="n-check-accent">✓</span> AI-generated from GFC drawings &amp; BOQ</li>
                  <li><span className="n-check-accent">✓</span> Import .mpp, .xer, .xlsx; all relationships carry over</li>
                  <li><span className="n-check-accent">✓</span> Baseline versioning with change history</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mobile: accordion */}
          <div className="pf-mobile-accordion">
            <ProductFeatures />
          </div>
        </div>
      </section>

      {/* BUILT FOR */}
      <section className="n-section" id="built-for">
        <div className="n-wrap">
          <ScrollReveal>
            <div className="n-section-head n-head-center">
              <h2 className="n-section-h2">Built for the Indian Construction Ecosystem</h2>
              <p className="n-section-sub n-section-sub-center">A unified platform that brings developers, contractors, and PMCs onto the same page.</p>
            </div>
          </ScrollReveal>
          <div className="n-audience-grid">
            <ScrollReveal delay={0}>
              <ExpandableCard
                className="n-aud-card"
                trigger={
                  <>
                    <div className="n-aud-icon n-icon-blue">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <h3 className="n-aud-title">For PMCs</h3>
                    <p className="n-aud-role">Project Management Consultants</p>
                  </>
                }
              >
                <p className="n-aud-body">Automate DPR validation, track contractor SLA compliance in real-time, and provide unassailable data to developers without spending hours in Excel.</p>
                <div className="n-aud-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:"var(--accent)"}}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                  40% less time on reporting
                </div>
              </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <ExpandableCard
                className="n-aud-card"
                trigger={
                  <>
                    <div className="n-aud-icon n-icon-teal">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 20h20M4 20V10l8-6 8 6v10M10 20v-6h4v6"/>
                      </svg>
                    </div>
                    <h3 className="n-aud-title">For Contractors</h3>
                    <p className="n-aud-role">EPC &amp; Sub-contractors</p>
                  </>
                }
              >
                <p className="n-aud-body">Protect your margins. Log delays caused by external factors instantly, secure faster billing approvals with geo-tagged proof, and optimize daily labor allocation.</p>
                <div className="n-aud-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:"var(--teal)"}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Zero unjustified penalties
                </div>
              </ExpandableCard>
            </ScrollReveal>
            <ScrollReveal delay={240}>
              <ExpandableCard
                className="n-aud-card"
                trigger={
                  <>
                    <div className="n-aud-icon n-icon-purple">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <path d="M8 21h8M12 17v4"/>
                      </svg>
                    </div>
                    <h3 className="n-aud-title">For Developers</h3>
                    <p className="n-aud-role">Real Estate &amp; Infrastructure</p>
                  </>
                }
              >
                <p className="n-aud-body">Get a bird&apos;s-eye view of your entire portfolio. Identify systemic bottlenecks, forecast cash flows accurately, and ensure RERA compliance effortlessly.</p>
                <div className="n-aud-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:"var(--purple)"}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Protect project ROI
                </div>
              </ExpandableCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* DEMO / CTA */}
      <section className="n-cta" id="demo">
        <div className="n-orb n-orb-cta" />
        <div className="n-wrap" style={{ position: "relative", zIndex: 2 }}>
          <div className="n-cta-grid">
            <ScrollReveal direction="left">
              <div className="n-cta-copy">
                <div className="n-eyebrow" style={{ marginBottom: 16 }}>BOOK A DEMO</div>
                <h2 className="n-cta-h2">
                  Stop managing delays.<br />
                  Start <span className="n-accent">preventing</span> them.
                </h2>
                <p className="n-cta-sub">
                  Bring one of your own project files. We&apos;ll show you exactly what BluQ would have caught and what it would have saved.
                </p>
                <div className="n-cta-proof">
                  <div className="n-proof-item">
                    <span className="n-proof-num"><CountUp to={30} />m</span>
                    <span className="n-proof-label">session</span>
                  </div>
                  <div className="n-proof-div" />
                  <div className="n-proof-item">
                    <span className="n-proof-num"><CountUp to={12} /></span>
                    <span className="n-proof-label">live projects</span>
                  </div>
                  <div className="n-proof-div" />
                  <div className="n-proof-item">
                    <span className="n-proof-num">₹<CountUp to={4} />Cr+</span>
                    <span className="n-proof-label">avg. saved</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="n-cta-form-wrap">
                <DemoForm />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="n-footer">
        <div className="n-wrap">
          <div className="n-footer-grid">
            <div className="n-footer-brand">
              <Logo />
              <p className="n-footer-tagline">
                The AI-powered construction intelligence platform. Prevent delays before they happen.
              </p>
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
                <li><a href="/privacy">Privacy Policy</a></li>
                <li><a href="/terms">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="n-footer-bottom">
            <span className="n-footer-copy">© 2026 BluQ Technologies Pvt Ltd. Building in public.</span>
            <div className="n-footer-legal">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
