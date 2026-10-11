import type { Rules, Video } from "./types";

export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds === 0) return "Live";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Cartridge/stack readouts: unknown length shows dashes, like the design's empty readout.
export function durLabel(seconds: number | null): string {
  if (seconds == null) return "--:--";
  return seconds === 0 ? "LIVE" : formatDuration(seconds)!;
}

// Stack totals read "X H Y MIN" (the design uppercases "X h Y min").
export function totalLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} H ${m} MIN` : `${m} MIN`;
}

// Compact age for the cartridge meta line, e.g. "2H" in "NO. 01 · 2H AGO".
export function ageShort(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}M`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}H`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}D`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks}W`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}MO` : `${Math.round(days / 365)}Y`;
}

const NEW_MS = 24 * 60 * 60 * 1000;

export function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < NEW_MS;
}

export function thumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

// Videos with an unknown duration pass the length rule rather than silently disappearing.
export function matchesRules(v: Video, rules: Rules): boolean {
  if (rules.noShorts && v.isShort) return false;
  if (rules.minMinutes && v.duration != null && v.duration > 0 && v.duration < rules.minMinutes * 60) return false;
  if (rules.keyword) {
    const words = rules.keyword
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const title = v.title.toLowerCase();
    if (words.length && !words.some((w) => title.includes(w))) return false;
  }
  return true;
}
