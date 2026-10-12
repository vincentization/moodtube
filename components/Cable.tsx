// Patch cable running from the CRT's output jack down into the Watch now/later deck.
export default function Cable() {
  return (
    <div className="cable" aria-hidden>
      <svg viewBox="0 0 120 56" width="120" height="56">
        <defs>
          <linearGradient id="plug-metal" x1="0" x2="1">
            <stop offset="0" stopColor="#6d6a62" />
            <stop offset="0.45" stopColor="#d9d4c7" />
            <stop offset="1" stopColor="#5a5750" />
          </linearGradient>
        </defs>
        <path className="cable-cord" d="M92 18 C92 38, 28 18, 28 38" />
        <path className="cable-shine" d="M92 18 C92 38, 28 18, 28 38" />
        {/* Top plug, seated in the bezel. */}
        <rect x="85" y="0" width="14" height="10" rx="1" fill="url(#plug-metal)" />
        <rect x="83" y="9" width="18" height="10" rx="2" className="cable-boot" />
        {/* Bottom plug, seated in the stack. */}
        <rect x="19" y="37" width="18" height="10" rx="2" className="cable-boot" />
        <rect x="21" y="46" width="14" height="10" rx="1" fill="url(#plug-metal)" />
      </svg>
    </div>
  );
}
