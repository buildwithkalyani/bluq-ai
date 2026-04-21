"use client";

import { useState } from "react";
import React from "react";

export interface AccordionItem {
  label: string;
  heading: string;
  body: string;
  icon?: React.ReactNode;
}

interface Props {
  items: AccordionItem[];
  variant?: "problems" | "features" | "beliefs" | "default";
}

export default function MobileAccordion({ items, variant = "default" }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  if (variant === "problems") {
    return (
      <div className="m-acc-list m-acc-problems">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`m-prob-card${isOpen ? " open" : ""}`} onClick={() => setOpen(isOpen ? null : i)}>
              <div className="m-prob-card-top">
                <span className="m-prob-card-label">{item.label}</span>
                <span className="m-prob-card-arrow">{isOpen ? "−" : "+"}</span>
              </div>
              <div className="m-prob-card-heading">{item.heading}</div>
              {isOpen && <div className="m-prob-card-body">{item.body}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "features") {
    return (
      <div className="m-acc-list m-acc-features">
        <div className="m-feat-grid-mob">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className={`m-feat-tile${isOpen ? " open" : ""}`} onClick={() => setOpen(isOpen ? null : i)}>
                {item.icon && <div className="m-feat-tile-icon">{item.icon}</div>}
                <div className="m-feat-tile-num">{item.label}</div>
                <div className="m-feat-tile-heading">{item.heading}</div>
                {isOpen && <div className="m-feat-tile-body">{item.body}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === "beliefs") {
    return (
      <div className="m-acc-list m-acc-beliefs">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`m-belief-acc-item${isOpen ? " open" : ""}`}>
              <button
                className="m-belief-acc-trigger"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="m-belief-acc-label">{item.label}</span>
                <span className="m-belief-acc-heading">{item.heading}</span>
                <span className="m-belief-acc-arrow">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <div className="m-belief-acc-body">{item.body}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // default: stepper style (used for how-steps)
  return (
    <div className="m-acc-list m-acc-steps">
      {items.map((item, i) => {
        const isOpen = open === i;
        const num = String(i + 1).padStart(2, "0");
        return (
          <div key={i} className={`m-step-item${isOpen ? " open" : ""}`}>
            <div className="m-step-line-col">
              <div className="m-step-dot" />
              {i < items.length - 1 && <div className="m-step-line" />}
            </div>
            <div className="m-step-right">
              <button
                className="m-step-trigger"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <div className="m-step-meta">
                  <span className="m-step-num">{num}</span>
                  <span className="m-step-label">{item.label}</span>
                </div>
                <div className="m-step-heading">{item.heading}</div>
              </button>
              {isOpen && <div className="m-step-body">{item.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
