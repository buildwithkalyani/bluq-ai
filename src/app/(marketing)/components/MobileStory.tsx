"use client";

import { useState } from "react";

interface StoryItem {
  label: string;
  paragraphs: string[];
}

export default function MobileStory({ items }: { items: StoryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="m-story-mob">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`m-story-mob-row${isOpen ? " open" : ""}`}>
            <button
              className="m-story-mob-trigger"
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="m-story-mob-label">{item.label}</span>
              <span className="m-story-mob-arrow">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="m-story-mob-body">
                {item.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
