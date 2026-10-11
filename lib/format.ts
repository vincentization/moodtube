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
