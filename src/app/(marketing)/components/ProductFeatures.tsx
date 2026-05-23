"use client";

import { useState } from "react";
import Image from "next/image";

const features = [
  {
    num: "01",
    title: "Live Daily Tracking via WhatsApp",
    body: "Your site teams already use WhatsApp. BluQ's bot converts those messages into structured, geo-tagged task updates. Every completion, delay, and photo logs directly into an immutable audit trail. No new app. No new habit.",
    bullets: [
      "Geo-tagged photo proof from the field",
      "Tasks auto-linked by zone & contractor",
      "Auto-flags issues, labor shortages & delays",
      "Automated daily progress reports (DPRs)",
    ],
    screenshot: "/screenshots/whatsapp-feed.png",
    alt: "BluQ WhatsApp bot feed with live task updates",
  },
  {
    num: "02",
    title: "AI Delay Analytics",
    body: "When slippage happens, bluQ instantly identifies the root cause, models downstream cascade impact, and recommends resource actions to recover time before it compounds.",
    bullets: [
      "Critical path impact per contractor",
      "AI root cause analysis & recommendations",
      "MS Project & Primavera integration",
    ],
    screenshot: "/screenshots/delay-analytics.png",
    alt: "BluQ delay analytics",
  },
  {
    num: "03",
    title: "Interactive Gantt View",
    body: "See your entire schedule on a live Gantt chart, updated in real-time from WhatsApp check-ins. Critical path slippage is auto-detected and highlighted the moment it happens.",
    bullets: [
      "Live critical path with cascade impact",
      "Auto-detects slippage from field updates",
      "One-click AI Reoptimize to recover lost time",
    ],
    screenshot: "/screenshots/gantt-view.png",
    alt: "BluQ Gantt chart with live critical path",
  },
  {
    num: "04",
    title: "AI Schedule Import",
    body: "No existing schedule? BluQ reads your drawings, BOQ, and scope documents and builds a complete project schedule in under 2 minutes. Or import from MS Project, Primavera P6, or Excel instantly.",
    bullets: [
      "AI-generated from GFC drawings & BOQ",
      "Import .mpp, .xer, .xlsx; all relationships carry over",
      "Baseline versioning with change history",
    ],
    screenshot: "/screenshots/import-schedule.png",
    alt: "BluQ AI schedule import wizard",
  },
];

export default function ProductFeatures() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="pf-accordion">
      {features.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`pf-item${isOpen ? " pf-open" : ""}`}>
            <button
              className="pf-trigger"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="pf-num">{f.num}</span>
              <span className="pf-title">{f.title}</span>
              <span className="pf-chevron" aria-hidden>{isOpen ? "−" : "+"}</span>
            </button>
            <div className="pf-body">
              <div className="pf-body-grid">
                <div className="pf-copy">
                  <p className="n-feat-body">{f.body}</p>
                  <ul className="n-feat-bullets">
                    {f.bullets.map((b, j) => (
                      <li key={j}><span className="n-check-accent">✓</span>{b}</li>
                    ))}
                  </ul>
                </div>
                <div className="n-ss-frame">
                  <Image
                    src={f.screenshot}
                    alt={f.alt}
                    width={1400}
                    height={840}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
