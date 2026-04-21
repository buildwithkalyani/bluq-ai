"use client";

import { useEffect, useRef } from "react";

export default function HowSteps() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const steps = el.querySelectorAll<HTMLElement>(".m-how-step");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            steps.forEach((step, i) => {
              setTimeout(() => step.classList.add("in-view"), i * 350);
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="m-how-steps" ref={ref}>
      <div className="m-how-step how-step-anim">
        <div className="m-how-num">01</div>
        <div className="m-how-meta"><span className="s">step / 01</span><span className="t">~10 min</span></div>
        <h3>import or generate.</h3>
        <p>Upload your .mpp or .xlsx, or drop the drawings and BOQ and let BluQ build the schedule. Every task, baseline, and critical path. Ready before your first site meeting.</p>
        <div className="m-how-tags"><span>DWG · BOQ · MPP · XLSX</span></div>
      </div>
      <div className="m-how-step how-step-anim">
        <div className="m-how-num">02</div>
        <div className="m-how-meta"><span className="s">step / 02</span><span className="t">~20 min</span></div>
        <h3>add your site team.</h3>
        <p>Send your engineers a WhatsApp number. The bot introduces itself tonight at 6 PM. No app. No training. Nothing changes on site.</p>
        <div className="m-how-tags"><span>WhatsApp · no app · no training</span></div>
      </div>
      <div className="m-how-step how-step-anim">
        <div className="m-how-num">03</div>
        <div className="m-how-meta"><span className="s">step / 03</span><span className="t live-badge">● live · tomorrow evening</span></div>
        <h3>first delay already <span className="serif-it">caught.</span></h3>
        <p>Your live dashboard is up. DPR goes to your client this evening — automatically. BluQ has already spotted what needs your attention today.</p>
        <div className="m-how-tags"><span>AI briefing · live dashboard · DPR</span></div>
      </div>
    </div>
  );
}
