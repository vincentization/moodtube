import type { GroupBadge } from "@/lib/groups";

// Small colored tag naming a group, e.g. "WO" for Woodworking.
export default function Badge({ group, className = "" }: { group: GroupBadge; className?: string }) {
  return (
    <span className={`gbadge mono ${className}`} style={{ "--badge": group.color } as React.CSSProperties} title={group.name}>
      {group.badge}
    </span>
  );
}

// Tape label strip: bordered in the first group's color, opening with each group's chip.
export function TapeBand({ badges, className, children }: { badges: GroupBadge[]; className: string; children: React.ReactNode }) {
  return (
    <span className={`tape-band ${className}`} style={badges[0] ? ({ "--tape": badges[0].color } as React.CSSProperties) : undefined}>
      {badges.map((b) => (
        <span key={b.id} className="tape-chip mono" style={{ "--badge": b.color } as React.CSSProperties} title={b.name}>
          {b.badge}
        </span>
      ))}
      {children}
    </span>
  );
}

// Row label for the Watch now / Watch later strips: group chips, title over channel, boxed runtime.
export function TapeLabel({ badges, title, channel, duration }: { badges: GroupBadge[]; title: React.ReactNode; channel: string; duration: string }) {
  return (
    <>
      {badges.map((b) => (
        <span key={b.id} className="row-chip mono" style={{ "--badge": b.color } as React.CSSProperties} title={b.name}>
          {b.badge}
        </span>
      ))}
      <span className="row-text">
        <span className="row-title">{title}</span>
        <span className="row-chan">{channel}</span>
      </span>
      <span className="row-dur mono">{duration}</span>
    </>
  );
}
