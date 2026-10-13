import type { Group } from "./types";

// Badge colors: evenly spaced hues at one lightness, so white badge text reads on all of them.
export const GROUP_COLORS = [
  "oklch(0.58 0.15 30)",
  "oklch(0.58 0.13 75)",
  "oklch(0.56 0.13 135)",
  "oklch(0.56 0.11 185)",
  "oklch(0.56 0.13 235)",
  "oklch(0.55 0.15 280)",
  "oklch(0.56 0.16 325)",
  "oklch(0.5 0.08 55)",
  "oklch(0.52 0.06 220)",
  "oklch(0.6 0.15 5)",
];

export type GroupBadge = { id: string; name: string; badge: string; color: string };

// "Woodworking" → "WO", "Home Lab" → "HL".
export function badgeText(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const text = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return text.toUpperCase();
}

// First palette color no group is using yet (cycles once all are taken).
export function nextGroupColor(groups: Group[]): string {
  const used = new Set(groups.map((g) => g.color));
  return GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.length % GROUP_COLORS.length];
}

// Badge + color per group. Groups saved before colors existed get the free palette colors in order.
export function groupBadges(groups: Group[]): Map<string, GroupBadge> {
  const out = new Map<string, GroupBadge>();
  const assigned: Group[] = groups.filter((g) => g.color);
  for (const g of groups) {
    const color = g.color ?? nextGroupColor(assigned);
    if (!g.color) assigned.push({ ...g, color });
    out.set(g.id, { id: g.id, name: g.name, badge: badgeText(g.name), color });
  }
  return out;
}

