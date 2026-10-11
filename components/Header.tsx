"use client";

import { useEffect, useState } from "react";

type Props = {
  page: "feed" | "channels";
  refreshing?: boolean;
  onRefresh?: () => void;
};

function Clock() {
  // Rendered after mount so server and client markup match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock mono">
      {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
    </div>
  );
}

export function Wordmark({ href }: { href?: string }) {
  return href ? (
    <a className="wordmark" href={href}>
      MOODTUBE
    </a>
  ) : (
    <div className="wordmark">MOODTUBE</div>
  );
}

export function Strip() {
  return (
    <div className="strip">
      <span style={{ background: "oklch(0.72 0.16 55)" }} />
      <span style={{ background: "oklch(0.8 0.15 85)" }} />
      <span style={{ background: "oklch(0.62 0.16 30)" }} />
    </div>
  );
}

export default function Header({ page, refreshing, onRefresh }: Props) {
  return (
    <div className="hdr">
      <Wordmark href={page === "channels" ? "/" : undefined} />
      <Strip />
      <div className="caption">CRT-84 · CARTRIDGE VIDEO SYSTEM</div>
      <div className="hdr-right">
        {page === "feed" ? (
          <>
            <a className="badge" href="/channels">
              CHANNELS
            </a>
            <button className="badge" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "REFRESHING…" : "REFRESH"}
            </button>
          </>
        ) : (
          <a className="badge" href="/">
            FEED
          </a>
        )}
        <form action="/api/logout" method="post" style={{ display: "contents" }}>
          <button className="badge" type="submit">
            LOG OUT
          </button>
        </form>
        <div className="badge">STEREO · HI-FI</div>
        <Clock />
      </div>
    </div>
  );
}
