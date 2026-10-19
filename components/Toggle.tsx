"use client";

import * as sfx from "@/lib/sfx";

// Flat label + small square-cornered switch. "now" = green when on, "later" = amber.
// With `ctl`, the track is a slide switch drawn by the tray's Three.js hardware (TrayHull), and it sounds like one.
type Props = {
  label: string;
  on: boolean;
  tone: "now" | "later";
  onClick: () => void;
  title?: string;
  ctl?: string;
};

export default function Toggle({ label, on, tone, onClick, title, ctl }: Props) {
  return (
    <button
      className={`toggle ${tone}${on ? " on" : ""}`}
      onClick={() => {
        if (ctl) sfx.slide(!on);
        onClick();
      }}
      title={title ?? label}
      role="switch"
      aria-checked={on}
    >
      <span className="toggle-label">{label}</span>
      <span className="track" data-key={ctl}>
        <span className="knob" />
      </span>
    </button>
  );
}
