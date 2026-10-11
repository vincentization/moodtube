"use client";

// The design's knob switch: label printed on the knob, LED as the only state indicator.
// "now" = orange knob + green LED, "later" = amber knob + amber LED.
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
      <span className="track">
        <span className="knob">{label}</span>
      </span>
      <span className="toggle-led" />
    </button>
  );
}
