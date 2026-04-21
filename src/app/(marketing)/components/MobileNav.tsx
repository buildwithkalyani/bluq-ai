"use client";

import { useState } from "react";

interface Props {
  links: { href: string; label: string; active?: boolean }[];
}

export default function MobileNav({ links }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="m-hamburger"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span className={open ? "bar bar-1 open" : "bar bar-1"} />
        <span className={open ? "bar bar-2 open" : "bar bar-2"} />
        <span className={open ? "bar bar-3 open" : "bar bar-3"} />
      </button>

      {open && (
        <div className="m-mobile-menu" onClick={() => setOpen(false)}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={l.active ? "active" : ""}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
