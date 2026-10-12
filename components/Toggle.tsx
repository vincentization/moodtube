"use client";

// Flat label + small square-cornered switch. "now" = green when on, "later" = amber.
type Props = {
  label: string;
  on: boolean;
  tone: "now" | "later";
  onClick: () => void;
  title?: string;
};

export default function Toggle({ label, on, tone, onClick, title }: Props) {
  return (
    <button
      className={`toggle ${tone}${on ? " on" : ""}`}
      onClick={onClick}
      title={title ?? label}
      role="switch"
      aria-checked={on}
    >
      <span className="toggle-label">{label}</span>
      <span className="track">
        <span className="knob" />
      </span>
    </button>
  );
}
