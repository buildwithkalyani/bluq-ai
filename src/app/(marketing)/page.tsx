import DemoForm from "./components/DemoForm";
import HowSteps from "./components/HowSteps";
import MobileNav from "./components/MobileNav";
import MobileAccordion from "./components/MobileAccordion";
import MobileAudienceTabs from "./components/MobileAudienceTabs";

export default function Home() {
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
            <a href="#home">home</a>
            <a href="#problem">problems</a>
            <a href="#product">product</a>
            <a href="#features">features</a>
            <a href="/about">about</a>
            <a href="/contact">contact</a>
            <a href="#demo" className="m-btn demo-nav">book demo <span className="m-btn-arrow">→</span></a>
          </div>
          <MobileNav links={[
            { href: "#home", label: "home" },
            { href: "#problem", label: "problems" },
            { href: "#product", label: "product" },
            { href: "#features", label: "features" },
            { href: "/about", label: "about" },
            { href: "/contact", label: "contact" },
            { href: "#demo", label: "book demo →" },
          ]} />
        </div>
      </nav>

      {/* HERO */}
      <section className="m-hero" id="home">
        <div className="m-wrap">
          <div className="m-hero-grid">
            <div className="m-hero-left">
              <div className="m-hero-eyebrow">
                <span className="pill pill-live"><span className="pill-dot"></span>early access</span>
                real-time audit · delay platform
              </div>
              <h1>
                your site is losing time and money<br />
                to delays you don&apos;t know<br />
                <span style={{whiteSpace:'nowrap'}}>exist yet.</span><br />
                <span className="serif-it">we stop them before they form.</span>
              </h1>
              <p className="m-hero-sub">
                BluQ predicts delays 72 hours early, auto-updates your schedule daily, and tells you exactly when to act. <strong>Projects finish faster. Budgets stay intact.</strong>
              </p>
              <div className="m-hero-cta">
                <a href="#demo" className="m-btn big">book a 30-min demo <span className="m-btn-arrow">→</span></a>
                <a href="https://bluq.ai/login" className="m-btn ghost big">login</a>
                <span className="m-hero-meta">12 projects live now</span>
              </div>
            </div>
            <div className="m-hero-right">
              <div className="m-build-scene">
                <span className="m-build-annot tl">tower_b / g+12</span>
                <span className="m-build-annot tr">↑ live</span>
                <div className="m-crane">
                  <svg width="110" height="80" viewBox="0 0 110 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="30" y1="10" x2="30" y2="70" stroke="#111113" strokeWidth="1.5"/>
                    <line x1="26" y1="15" x2="34" y2="15" stroke="#111113" strokeWidth="1"/>
                    <line x1="26" y1="25" x2="34" y2="25" stroke="#111113" strokeWidth="1"/>
                    <line x1="26" y1="35" x2="34" y2="35" stroke="#111113" strokeWidth="1"/>
                    <line x1="26" y1="45" x2="34" y2="45" stroke="#111113" strokeWidth="1"/>
                    <line x1="26" y1="55" x2="34" y2="55" stroke="#111113" strokeWidth="1"/>
                    <line x1="30" y1="10" x2="100" y2="10" stroke="#111113" strokeWidth="1.5"/>
                    <line x1="30" y1="10" x2="10" y2="10" stroke="#111113" strokeWidth="1.5"/>
                    <rect x="4" y="7" width="10" height="6" fill="#111113"/>
                    <line x1="80" y1="10" x2="80" y2="35" stroke="#111113" strokeWidth="0.8" strokeDasharray="2 2"/>
                    <rect x="76" y="35" width="8" height="5" fill="none" stroke="#111113" strokeWidth="1"/>
                    <line x1="30" y1="10" x2="60" y2="4" stroke="#111113" strokeWidth="0.8"/>
                    <line x1="60" y1="4" x2="100" y2="10" stroke="#111113" strokeWidth="0.8"/>
                  </svg>
                </div>
                <div className="m-building">
                  <div className="m-floor"></div>
                  <div className="m-floor"></div>
                  <div className="m-floor active"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor done"></div>
                  <div className="m-floor-ground"></div>
                  <div className="m-ground-label">grade · 0.00m</div>
                </div>
                <div className="m-build-chip m-chip-1"><span className="led"></span>L12 · <b>casting</b></div>
                <div className="m-build-chip m-chip-2"><span className="led"></span>L09 · <b>done</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="m-wrap">
        <div className="m-stats">
          <div className="m-stat">
            <div className="ref">/ref 01</div>
            <div className="n">80<sup>%</sup></div>
            <div className="l">of projects overrun budget.</div>
          </div>
          <div className="m-stat">
            <div className="ref">/ref 02</div>
            <div className="n">5–10<sup>%</sup></div>
            <div className="l">typical LD exposure on contract value.</div>
          </div>
          <div className="m-stat">
            <div className="ref">/ref 03</div>
            <div className="n">12<sup>hrs</sup></div>
            <div className="l">lost per week, per engineer, on manual updates.</div>
          </div>
          <div className="m-stat">
            <div className="ref">/ref 04</div>
            <div className="n">7<sup>hrs</sup></div>
            <div className="l">lost per week, hand-writing DPRs.</div>
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="m-ticker">
        <div className="m-ticker-track">
          <span>built for PMC firms</span><span className="s">/</span>
          <span>EPC · turnkey contractors</span><span className="s">/</span>
          <span>real estate developers</span><span className="s">/</span>
          <span>ms project native</span><span className="s">/</span>
          <span>excel native</span><span className="s">/</span>
          <span>whatsapp · sms · email updates</span><span className="s">/</span>
          <span>auto DPR · weekly reports · s-curve</span><span className="s">/</span>
          <span>built for PMC firms</span><span className="s">/</span>
          <span>EPC · turnkey contractors</span><span className="s">/</span>
          <span>real estate developers</span><span className="s">/</span>
          <span>ms project native</span><span className="s">/</span>
          <span>excel native</span><span className="s">/</span>
          <span>whatsapp · sms · email updates</span><span className="s">/</span>
          <span>auto DPR · weekly reports · s-curve</span><span className="s">/</span>
        </div>
      </div>

      {/* PROBLEM */}
      <section className="m-problem m-section" id="problem">
        <div className="m-wrap">
          <div className="m-section-head">
            <div className="eyebrow">the problems</div>
            <h2>every delay has a cost.<br /><span className="serif-it">most are preventable.</span></h2>
          </div>
          <div className="m-problem-grid">
            <div className="m-problem-item">
              <div className="m-problem-ico">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                </svg>
              </div>
              <div className="m-problem-num">failure / 01</div>
              <h3>you find out<br /><span className="serif-it">too late.</span></h3>
              <p>By the time you know a floor is delayed, your contractor has already moved on. You&apos;re negotiating yesterday&apos;s problem with no proof and no leverage.</p>
            </div>
            <div className="m-problem-item">
              <div className="m-problem-ico">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="11" height="14" rx="1" transform="rotate(-6 8 10)"/>
                  <rect x="9" y="6" width="11" height="14" rx="1" transform="rotate(5 14 13)"/>
                </svg>
              </div>
              <div className="m-problem-num">failure / 02</div>
              <h3>you fund delays<br /><span className="serif-it">you could&apos;ve stopped.</span></h3>
              <p>Labour short on Tuesday. You find out Friday. Those 3 days don&apos;t come back — but they show up in your final bill.</p>
            </div>
            <div className="m-problem-item">
              <div className="m-problem-ico">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 21V5a2 2 0 0 1 2-2h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>
                  <path d="M15 3v4h4"/><path d="M9 13l5-5 2 2-5 5h-2z"/>
                </svg>
              </div>
              <div className="m-problem-num">failure / 03</div>
              <h3>your schedule is<br /><span className="serif-it">fiction by week 3.</span></h3>
              <p>The Gantt your PM made on day one hasn&apos;t been touched since. Nobody has time to update it. So nobody trusts it. Decisions get made on gut feel and contractor promises.</p>
            </div>
          </div>
          <MobileAccordion variant="problems" items={[
            { label: "failure / 01", heading: "you find out too late.", body: "By the time you know a floor is delayed, your contractor has already moved on. You're negotiating yesterday's problem with no proof and no leverage." },
            { label: "failure / 02", heading: "you fund delays you could've stopped.", body: "Labour short on Tuesday. You find out Friday. Those 3 days don't come back — but they show up in your final bill." },
            { label: "failure / 03", heading: "your schedule is fiction by week 3.", body: "The Gantt your PM made on day one hasn't been touched since. Nobody has time to update it. So nobody trusts it. Decisions get made on gut feel and contractor promises." },
          ]} />

          {/* SITE LOG */}
          <div className="m-sitelog-wrap">
            <div className="m-sitelog-copy">
              <div className="tag">live · predicting your next delay</div>
              <h3>every update, <span className="serif-it">acted on automatically.</span></h3>
              <p>Your site engineer sends one WhatsApp message. BluQ updates your live schedule, flags what&apos;s falling behind, and tells your team exactly what to do next — before the day is lost.</p>
            </div>
            <div className="m-sitelog">
              <div className="m-sitelog-hdr">
                <span>evidence_log · tower_b</span>
                <span className="count">↑ 247 events today</span>
              </div>
              <div className="m-sitelog-body">
                <div className="m-log-line"><span className="t">09:14</span><span className="ic"></span><span className="m"><b>material_recv</b> · cement 50 bags · signed by Rajesh K.</span></div>
                <div className="m-log-line warn"><span className="t">09:02</span><span className="ic"></span><span className="m"><b>risk_flag</b> · L5 slab · labour shortage reported <span className="s">(whatsapp)</span></span></div>
                <div className="m-log-line"><span className="t">08:45</span><span className="ic"></span><span className="m"><b>task_complete</b> · L4 slab casting <span className="s">(3hr ahead)</span></span></div>
                <div className="m-log-line delay"><span className="t">08:22</span><span className="ic"></span><span className="m"><b>delay_logged</b> · MEP rough-in · 36hr no-response <span className="s">(auto)</span></span></div>
                <div className="m-log-line"><span className="t">07:58</span><span className="ic"></span><span className="m"><b>dpr_sent</b> · client distribution · al_nakheel</span></div>
                <div className="m-log-line"><span className="t">07:00</span><span className="ic"></span><span className="m"><b>ai_briefing</b> · 3 action items generated</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      <section className="m-product m-section" id="product">
        <div className="m-wrap">
          <div className="m-section-head bordered">
            <div className="eyebrow">the dashboard</div>
            <h2>one screen. every site.<br /><span className="serif-it">every delay.</span></h2>
          </div>
          <div className="m-dash-frame">
            <div className="m-dash-chrome">
              <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              <span className="url">bluq.ai / live overview</span>
            </div>
            <div className="m-dash">
              <aside className="m-side">
                <div className="brand">blu<span className="q">Q</span></div>
                <div className="cat">navigation</div>
                <div className="i on">▸ live_overview</div>
                <div className="i">▸ schedule</div>
                <div className="i">▸ field_updates</div>
                <div className="i">▸ evidence</div>
                <div className="i">▸ reports</div>
                <div className="cat">projects</div>
                <div className="i green"><span className="led"></span>al_nakheel_p1</div>
                <div className="i amber"><span className="led"></span>madinat_villas</div>
                <div className="i green"><span className="led"></span>reem_commercial</div>
                <div className="i red"><span className="led"></span>emerald_res_tb</div>
              </aside>
              <main className="m-main">
                <div className="m-main-top">
                  <div className="m-crumb">live_overview / <b>all_projects</b></div>
                  <div className="m-time">last sync · 4s ago</div>
                </div>
                <div className="m-ai">
                  <div className="hdr"><span>ai briefing</span><span>·</span><span className="live">live · updated 4m ago</span></div>
                  <p><b>3 items need action by 10:00.</b> Foundation works on Tower B is <span className="orange">2 days behind</span>. Cement delivery slipped from supplier. MEP rough-in shows <span className="red">0% progress, 36h silence</span> on contractor WhatsApp. Tower B waterproofing delayed 4 consecutive days. LD trigger risk at day 7.</p>
                  <div className="act">→ escalate foundation works now</div>
                </div>
                <div className="m-kpis">
                  <div className="m-kpi green"><span className="led"></span><div className="n">08</div><div className="l">on_track</div></div>
                  <div className="m-kpi amber"><span className="led"></span><div className="n">03</div><div className="l">running_late</div></div>
                  <div className="m-kpi red"><span className="led"></span><div className="n">01</div><div className="l">delayed</div></div>
                  <div className="m-kpi"><span className="led"></span><div className="n">12</div><div className="l">total</div></div>
                </div>
                <div className="m-plist">
                  <div className="hd"><span>project</span><span>progress</span><span>status</span><span style={{textAlign:"right"}}>variance</span></div>
                  <div className="m-pr">
                    <div className="nm"><span className="bar"></span>al_nakheel_p1</div>
                    <div className="pg"><span style={{width:"74%"}}></span></div>
                    <div className="st">on_track</div>
                    <div className="var">+2d</div>
                  </div>
                  <div className="m-pr amber">
                    <div className="nm"><span className="bar"></span>madinat_jumeirah_villas</div>
                    <div className="pg"><span style={{width:"52%"}}></span></div>
                    <div className="st">late</div>
                    <div className="var">−5d</div>
                  </div>
                  <div className="m-pr">
                    <div className="nm"><span className="bar"></span>reem_island_commercial</div>
                    <div className="pg"><span style={{width:"38%"}}></span></div>
                    <div className="st">on_track</div>
                    <div className="var">±0d</div>
                  </div>
                  <div className="m-pr red">
                    <div className="nm"><span className="bar"></span>emerald_residences_tb</div>
                    <div className="pg"><span style={{width:"61%"}}></span></div>
                    <div className="st">delayed</div>
                    <div className="var">−9d</div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="m-features m-section" id="features">
        <div className="m-wrap">
          <div className="m-section-head bordered">
            <div className="eyebrow">what it does</div>
            <h2>six things.<br /><span className="serif-it">that save you crores.</span></h2>
          </div>

          {/* 01 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">01 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 3v18"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>drawings in.<br /><span className="serif-it">schedule out.</span></h3>
              <p>Drop your DWG, SOW, and BOQ. BluQ reads the scope and builds a complete Gantt in minutes. Tasks, durations, critical path. Your baseline is ready before your first site meeting.</p>
              <div className="m-feat-tags">
                <span className="t">DWG</span><span className="t">BOQ</span><span className="t">SOW</span>
                <span className="t">auto-gantt</span><span className="t">CPM</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-files">
                <div className="hdr"><span>ingest / tower_b</span><span>↑ parsing</span></div>
                <div className="row"><span className="chk"></span><span>tower-b-arch.dwg</span><span className="sz">48.2 MB</span></div>
                <div className="row"><span className="chk"></span><span>boq-civil-final.xlsx</span><span className="sz">2.1 MB</span></div>
                <div className="row"><span className="chk"></span><span>sow-tower-b-rev3.pdf</span><span className="sz">4.8 MB</span></div>
                <div className="row"><span className="chk"></span><span>structural-calcs.pdf</span><span className="sz">12.4 MB</span></div>
                <div className="out"><span>→ output · 412 tasks · 6 months</span><span>↑ ready</span></div>
              </div>
            </div>
          </div>

          {/* 02 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">02 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v4H4zM4 10h12v4H4zM4 16h8v4H4z"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>MPP. XLSX.<br /><span className="serif-it">one click.</span></h3>
              <p>Already on MS Project or running everything in Excel? Import your .mpp or .xlsx file. BluQ keeps every task, resource, and baseline in sync. Export back anytime.</p>
              <div className="m-feat-tags">
                <span className="t">ms project</span><span className="t">excel</span>
                <span className="t">.mpp / .xlsx</span><span className="t">two-way sync</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-gantt">
                <div className="gh">
                  <span>task</span><span>w1</span><span>w2</span><span>w3</span><span>w4</span><span>w5</span><span>w6</span>
                </div>
                <div className="gr"><span>site_prep</span><div className="gb done"><span style={{left:"0",width:"18%"}}></span></div></div>
                <div className="gr"><span>excavation</span><div className="gb done"><span style={{left:"10%",width:"22%"}}></span></div></div>
                <div className="gr"><span>foundation</span><div className="gb crit"><span style={{left:"26%",width:"30%"}}></span></div></div>
                <div className="gr"><span>structure</span><div className="gb now"><span style={{left:"45%",width:"38%"}}></span></div></div>
                <div className="gr"><span>mep_rough</span><div className="gb pend"><span style={{left:"60%",width:"32%"}}></span></div></div>
                <div className="gr"><span>finishes</span><div className="gb pend"><span style={{left:"74%",width:"26%"}}></span></div></div>
              </div>
            </div>
          </div>

          {/* 03 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">03 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>whatsapp is already<br />your <span className="serif-it">field system.</span></h3>
              <p>Your engineer sends one message at 6 PM. BluQ reads it, updates the live schedule, logs the delay, and pings the supplier. Automatically. No app. No training. Nothing changes on site.</p>
              <div className="m-feat-tags">
                <span className="t">whatsapp</span><span className="t">sms</span>
                <span className="t">email</span><span className="t">multilingual</span><span className="t">no-app</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-chat">
                <div className="bub in">Hi Rajesh, EOD update for Tower B please.<div className="meta">bluq · 18:00 · auto</div></div>
                <div className="bub out">Slab casting done for L4. Cement truck didn&apos;t show, L5 delayed to tomorrow.<div className="meta">rajesh k · 18:14</div></div>
                <div className="bub sys">→ logged · material_delay flagged · schedule updated · supplier pinged<div className="meta">bluq · 18:14:04</div></div>
              </div>
            </div>
          </div>

          {/* 04 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">04 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>stopped before<br />they <span className="serif-it">cost you.</span></h3>
              <p>The moment a task slips, BluQ calculates the cost to your critical path and tells your team exactly what to do. Shift the crew, call the supplier, reschedule the pour. Not a warning. A decision.</p>
              <div className="m-feat-tags">
                <span className="t">risk flags</span><span className="t">critical path</span>
                <span className="t">recommendations</span><span className="t">trend analysis</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-alert">
                <div className="h"><span><span className="led"></span>high priority</span><span>09:14</span></div>
                <div className="title">material shortage · foundation works · tower b</div>
                <div className="rec">Cement delivery slipped by 24h · CP impact by Friday if unaddressed. <b>→ shift MEP crew to Zone 3 prep, save 1.5 days, preserve CP.</b></div>
              </div>
            </div>
          </div>

          {/* 05 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">05 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56"/><path d="M21 4v5h-5"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>an 8-day delay<br /><span className="serif-it">becomes 1. automatically.</span></h3>
              <p>When a task slips, BluQ redoes the downstream plan automatically. New critical path, new finish date, recovery options ranked. All before your morning chai. Your contingency stays intact.</p>
              <div className="m-feat-tags">
                <span className="t">auto-reschedule</span><span className="t">optimisation</span>
                <span className="t">recovery paths</span><span className="t">what-if</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-res">
                <div className="rr bs"><div className="lb">baseline</div><div className="bar"><span></span></div><div className="ed">planned</div></div>
                <div className="rr wa"><div className="lb">if_nothing</div><div className="bar"><span></span></div><div className="ed">+8d</div></div>
                <div className="arrow">— bluq optimised →</div>
                <div className="rr op"><div className="lb">recovery_v1</div><div className="bar"><span></span></div><div className="ed">+1d</div></div>
              </div>
            </div>
          </div>

          <MobileAccordion variant="features" items={[
            { label: "01 / 06", heading: "drawings in. schedule out.", body: "Drop your DWG, SOW, and BOQ. BluQ reads the scope and builds a complete Gantt in minutes. Tasks, durations, critical path. Your baseline is ready before your first site meeting.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 3v18"/></svg> },
            { label: "02 / 06", heading: "MPP. XLSX. one click.", body: "Already on MS Project or running everything in Excel? Import your .mpp or .xlsx file. BluQ keeps every task, resource, and baseline in sync. Export back anytime.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v4H4zM4 10h12v4H4zM4 16h8v4H4z"/></svg> },
            { label: "03 / 06", heading: "whatsapp is already your field system.", body: "Your engineer sends one message at 6 PM. BluQ reads it, updates the live schedule, logs the delay, and pings the supplier. Automatically. No app. No training. Nothing changes on site.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
            { label: "04 / 06", heading: "stopped before they cost you.", body: "The moment a task slips, BluQ calculates the cost to your critical path and tells your team exactly what to do. Shift the crew, call the supplier, reschedule the pour. Not a warning. A decision.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg> },
            { label: "05 / 06", heading: "an 8-day delay becomes 1.", body: "When a task slips, BluQ redoes the downstream plan automatically. New critical path, new finish date, recovery options ranked. All before your morning chai. Your contingency stays intact.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><path d="M21 4v5h-5"/></svg> },
            { label: "06 / 06", heading: "DPRs that write themselves.", body: "Every evening, your client receives a branded DPR without your PM typing a single word. Two hours saved per site, per day. Across 10 sites, that is a full-time salary back in your pocket.", icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6M9 9h1"/></svg> },
          ]} />

          {/* 06 */}
          <div className="m-feat">
            <div className="m-feat-num">
              <span className="n">06 / 06</span>
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1"/>
                </svg>
              </span>
            </div>
            <div className="m-feat-body">
              <h3>DPRs that <span className="serif-it">write themselves.</span></h3>
              <p>Every evening, your client receives a branded DPR without your PM typing a single word. Two hours saved per site, per day. Across 10 sites, that is a full-time salary back in your pocket.</p>
              <div className="m-feat-tags">
                <span className="t">auto DPR</span><span className="t">weekly reports</span>
                <span className="t">s-curve</span><span className="t">EoT docs</span>
              </div>
            </div>
            <div className="m-feat-viz">
              <div className="m-v-dpr">
                <div className="tt">tower_b · daily progress</div>
                <div className="ln"><span>slab_casting_L4</span><span className="g">completed</span></div>
                <div className="ln"><span>slab_casting_L5</span><span className="a">delayed +1d</span></div>
                <div className="ln"><span>rebar_prep_L6</span><span className="g">on_track</span></div>
                <div className="ln"><span>mep_zone_3</span><b>22% · on_track</b></div>
                <div className="ln"><span>manpower_site</span><b>142</b></div>
                <div className="ln"><span>material_recv</span><b>4 of 5</b></div>
                <div className="send"><span>→ auto-generated</span><span>→ send to client</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="m-section" id="audience">
        <div className="m-wrap">
          <div className="m-section-head bordered">
            <div className="eyebrow">built for</div>
            <h2>three teams.<br /><span className="serif-it">one real problem.</span></h2>
          </div>
          <MobileAudienceTabs />

          <div className="m-aud-grid">
            <div className="m-aud">
              <div className="m-aud-top"><div className="r">PMC firms</div><div className="i">/ 01</div></div>
              <h3>your client pays you to catch <span className="serif-it">this early.</span></h3>
              <p>BluQ gives you a live dashboard, the proof trail, and a morning briefing. Across every project, every day. Your retainer is justified every single day.</p>
              <div className="bull">
                <div className="b">portfolio-wide visibility</div>
                <div className="b">client-ready DPRs in minutes</div>
                <div className="b">evidence trail per milestone</div>
              </div>
            </div>
            <div className="m-aud">
              <div className="m-aud-top"><div className="r">EPC · turnkey</div><div className="i">/ 02</div></div>
              <h3>LDs are <span className="serif-it">eating your margin.</span></h3>
              <p>When the timeline is disputed, proof wins, not argument. BluQ builds the record that defends your position and keeps your EoT claims solid.</p>
              <div className="bull">
                <div className="b">dispute-ready audit trail</div>
                <div className="b">EoT claim documentation</div>
                <div className="b">subcontractor accountability</div>
              </div>
            </div>
            <div className="m-aud">
              <div className="m-aud-top"><div className="r">developers</div><div className="i">/ 03</div></div>
              <h3>delays are <span className="serif-it">costing you buyers.</span></h3>
              <p>Know the real status of every tower on every site, without waiting for a weekly PMC review. See delays the day they happen. Protect your handover dates.</p>
              <div className="bull">
                <div className="b">handover date certainty</div>
                <div className="b">multi-project health, one screen</div>
                <div className="b">independent audit layer</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="m-section" id="how">
        <div className="m-wrap">
          <div className="m-section-head bordered">
            <div className="eyebrow">getting started</div>
            <h2>from import to live in<br /><span className="serif-it">one afternoon.</span></h2>
          </div>
          <HowSteps />
        </div>
      </section>

      {/* FOUNDER'S NOTE */}
      <section className="m-note">
        <div className="m-wrap">
          <div className="m-note-inner">
            <div className="m-note-badge">/ a note</div>
            <div>
              <div className="m-note-text">
                BluQ exists because the tools running construction today, spreadsheets, WhatsApp groups, and manual DPRs, were not built for the pace of modern projects. <em>We&apos;re building the one that is.</em> Built alongside PMCs, EPCs, and developers who were tired of finding out too late and paying for it.
              </div>
              <div className="m-note-sig">~ the bluq team</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta" id="demo">
        <div className="m-wrap">
          <div className="m-cta-grid">
            <div>
              <h2>stop the delay<br /><span className="serif-it">before it starts.</span></h2>
              <p className="m-cta-sub">Book a 30-minute session. Bring one of your own project files. We&apos;ll show you exactly how BluQ would have caught the delay you&apos;re thinking of right now.</p>
              <div className="m-cta-btns">
                <a href="/contact" className="m-btn ghost big">talk to founders</a>
              </div>
              <div className="m-cta-foot">early access · onboarding included · pricing locked for life</div>
            </div>
            <DemoForm />
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
                <li><a href="#features">auto scheduling</a></li>
                <li><a href="#features">schedule import</a></li>
                <li><a href="#features">field updates</a></li>
                <li><a href="#features">delay flagging</a></li>
                <li><a href="#features">auto dpr</a></li>
              </ul>
            </div>
            <div className="m-foot-col">
              <h4>built for</h4>
              <ul>
                <li><a href="#audience">pmc firms</a></li>
                <li><a href="#audience">epc · turnkey contractors</a></li>
                <li><a href="#audience">developers</a></li>
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
