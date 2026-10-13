"use client";

import { useState, type ReactNode } from "react";

/** A link styled exactly like the footer's « Faire une demande » button (the
 *  `request-btn` class in globals.css). The pressed state is set from pointer
 *  events so a finger gets the same sinking effect as a mouse, without relying
 *  on :hover or on :active (which iOS only applies after a touch listener). */
export function GoldLink({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      data-pressed={pressed ? "true" : "false"}
      className="request-btn request-btn--link"
    >
      {children}
    </a>
  );
}
