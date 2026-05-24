"use client";

import { useState } from "react";

interface Props {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function ExpandableCard({ trigger, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${className} ec-card${open ? " ec-open" : ""}`}>
      <div className="ec-trigger" onClick={() => setOpen(!open)} role="button" aria-expanded={open}>
        {trigger}
        <span className="ec-toggle" aria-hidden>{open ? "−" : "+"}</span>
      </div>
      <div className="ec-content">{children}</div>
    </div>
  );
}
