"use client";

import { useState } from "react";

const TABS = [
  {
    id: "pmc",
    label: "PMC",
    heading: "your client pays you to catch this early.",
    body: "BluQ gives you a live dashboard, the proof trail, and a morning briefing. Across every project, every day. Your retainer is justified every single day.",
    bullets: ["portfolio-wide visibility", "client-ready DPRs in minutes", "evidence trail per milestone"],
  },
  {
    id: "epc",
    label: "EPC",
    heading: "LDs are eating your margin.",
    body: "When the timeline is disputed, proof wins, not argument. BluQ builds the record that defends your position and keeps your EoT claims solid.",
    bullets: ["dispute-ready audit trail", "EoT claim documentation", "subcontractor accountability"],
  },
  {
    id: "dev",
    label: "Developer",
    heading: "delays are costing you buyers.",
    body: "Know the real status of every tower on every site, without waiting for a weekly PMC review. See delays the day they happen. Protect your handover dates.",
    bullets: ["handover date certainty", "multi-project health, one screen", "independent audit layer"],
  },
];

export default function MobileAudienceTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="m-mob-tabs">
      <div className="m-mob-tab-bar">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            className={`m-mob-tab-btn${active === i ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="m-mob-tab-content" key={active}>
        <div className="m-mob-tab-idx">/ 0{active + 1}</div>
        <h3 className="m-mob-tab-heading">{tab.heading}</h3>
        <p className="m-mob-tab-body">{tab.body}</p>
        <div className="m-mob-tab-bullets">
          {tab.bullets.map((b) => (
            <div key={b} className="m-mob-tab-bullet">→ {b}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
