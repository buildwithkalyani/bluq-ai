import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "about · bluq",
  description: "Why we're building BluQ. The story behind the real-time audit and delay platform for construction.",
};

export default function About() {
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
            <a href="/about" className="active">about</a>
            <a href="/contact">contact</a>
            <a href="/#demo" className="m-btn demo-nav">book demo <span className="m-btn-arrow">→</span></a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="m-about-hero">
        <div className="m-wrap">
          <div className="eyebrow">about</div>
          <h1>construction runs the world.<br /><span className="serif-it">its software should catch up.</span></h1>
          <p className="m-about-hero-sub">
            BluQ is being built to close a very real gap. The tools running construction today were not designed for the pace and pressure of modern projects. We are building the one that is.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="m-story">
        <div className="m-wrap">
          <div className="m-story-row">
            <div className="label">the gap</div>
            <div className="body">
              <p>98% of major construction projects run over time or over budget. Most of those delays are not bad luck. They are information arriving too late.</p>
              <p>A delay that will hit you on Friday is already visible in your site data on Wednesday. Most tools wait for it to show up in a report. BluQ reads the signals 48 hours early and tells you exactly how to stop it before it ever touches your schedule.</p>
            </div>
          </div>
          <div className="m-story-row">
            <div className="label">what we&apos;re building</div>
            <div className="body">
              <p>Picture this. Your site engineer sends his evening WhatsApp update, the same way he always has. By end of day, your schedule is updated, your delay is caught, and the DPR is already on its way to your client. Nobody typed a report. Nobody filled a form.</p>
              <p>We built BluQ because delays that formed on Tuesday were only showing up in reports on Friday. By then, three days of budget were already gone.</p>
              <p>Most delays are stoppable. But only if you know about them while there is still time to act. BluQ gives you that time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BELIEFS */}
      <section className="m-beliefs">
        <div className="m-wrap">
          <div className="m-beliefs-head">
            <div className="eye">what we believe</div>
            <h2>six beliefs. <span className="serif-it">one obsession.</span></h2>
          </div>
          <div className="m-belief-grid">
            <div className="m-belief">
              <div className="n">/ 01</div>
              <h3>site data is the <span className="serif-it">main thing.</span></h3>
              <p>Not a spreadsheet afterthought. If BluQ cannot read what is happening on site in real time, nothing else we build matters.</p>
            </div>
            <div className="m-belief">
              <div className="n">/ 02</div>
              <h3>no new apps. <span className="serif-it">ever.</span></h3>
              <p>Your site engineer is not downloading a new app. He is replying on WhatsApp. BluQ works inside that habit, not against it. Zero behavior change on site, full intelligence in your office.</p>
            </div>
            <div className="m-belief">
              <div className="n">/ 03</div>
              <h3>a delay caught early <span className="serif-it">costs nothing.</span></h3>
              <p>The hour after slippage is where cost and time are actually saved. So BluQ does not just detect the delay. It tells you exactly what to move, who to call, and what to reschedule. Before it touches your budget.</p>
            </div>
          </div>
          <div className="m-belief-grid" style={{marginTop:"2px"}}>
            <div className="m-belief">
              <div className="n">/ 04</div>
              <h3>proof, <span className="serif-it">not argument.</span></h3>
              <p>When the penalty notice arrives, the side with the timestamped trail wins. We build BluQ so that side is always yours.</p>
            </div>
            <div className="m-belief">
              <div className="n">/ 05</div>
              <h3>built on <span className="serif-it">construction sites.</span></h3>
              <p>Every feature in BluQ came from a real site, a real delay, and a real person who needed a better answer. We do not guess what the industry needs. We have seen it.</p>
            </div>
            <div className="m-belief">
              <div className="n">/ 06</div>
              <h3>complexity is <span className="serif-it">the enemy.</span></h3>
              <p>Your site already has enough moving parts. BluQ removes friction, not adds it. If it takes more than one WhatsApp message to update your schedule, we have failed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <div className="m-wrap">
        <div className="m-nums">
          <div className="m-num">
            <div className="r">active projects</div>
            <div className="n">12</div>
            <div className="l">running on BluQ across India and the Gulf.</div>
          </div>
          <div className="m-num">
            <div className="r">tasks tracked</div>
            <div className="n">842</div>
            <div className="l">updated automatically, every day.</div>
          </div>
          <div className="m-num">
            <div className="r">hours saved</div>
            <div className="n">19<sup>/wk</sup></div>
            <div className="l">per engineer on DPRs and manual updates.</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <section className="m-cta-c">
        <div className="m-wrap">
          <h2>want to know more?<br /><span className="serif-it">just ask.</span></h2>
          <p className="m-cta-c-sub">We&apos;re easy to reach. No long sales calls, no forms with 20 fields. Email, WhatsApp, or book a 30-minute demo.</p>
          <div className="m-cta-c-btns">
            <a href="/#demo" className="m-btn big">book a demo <span className="m-btn-arrow">→</span></a>
            <a href="/contact" className="m-btn ghost big">contact us</a>
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
                <li><a href="/#features">auto_scheduling</a></li>
                <li><a href="/#features">schedule_import</a></li>
                <li><a href="/#features">field_updates</a></li>
                <li><a href="/#features">delay_flagging</a></li>
                <li><a href="/#features">auto_dpr</a></li>
              </ul>
            </div>
            <div className="m-foot-col">
              <h4>built for</h4>
              <ul>
                <li><a href="/#audience">pmc_firms</a></li>
                <li><a href="/#audience">epc_turnkey</a></li>
                <li><a href="/#audience">developers</a></li>
              </ul>
            </div>
            <div className="m-foot-col">
              <h4>company</h4>
              <ul>
                <li><a href="/about">about</a></li>
                <li><a href="/contact">contact</a></li>
                <li><a href="#">early_access</a></li>
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
