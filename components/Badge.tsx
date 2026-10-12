import type { GroupBadge } from "@/lib/groups";

// Small colored tag naming a group, e.g. "WO" for Woodworking.
export default function Badge({ group, className = "" }: { group: GroupBadge; className?: string }) {
  return (
    <span className={`gbadge mono ${className}`} style={{ "--badge": group.color } as React.CSSProperties} title={group.name}>
      {group.badge}
    </span>
  );
}
