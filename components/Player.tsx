"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, thumbUrl, watchUrl } from "@/lib/format";
import type { Video } from "@/lib/types";

type YTPlayer = { loadVideoById(id: string): void; destroy(): void };
type YTEvent = { data: number };

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, options: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

const ENDED = 0;
const UNPLAYABLE = new Set([2, 5, 100, 101, 150]); // bad id, HTML5 error, removed, embedding disabled
const AUTO_SKIP_MS = 4000;

export const PLAYER_MIN_WIDTH = 320;
export const FEED_MIN_WIDTH = 360;
export const PLAYER_DEFAULT_WIDTH = 520;

export function clampPlayerWidth(width: number): number {
  const max = Math.max(PLAYER_MIN_WIDTH, window.innerWidth - FEED_MIN_WIDTH);
  return Math.round(Math.min(max, Math.max(PLAYER_MIN_WIDTH, width)));
}

type Props = {
  queue: Video[];
  currentId: string;
  watched: Set<string>;
  width: number;
  onResize: (width: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onFinished: (id: string) => void;
  onClose: () => void;
};

export default function Player({ queue, currentId, watched, width, onResize, onSelect, onRemove, onFinished, onClose }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Track the current video by id so changing the queue mid-play doesn't break playback.
  const index = queue.findIndex((v) => v.id === currentId);
  const lastIndexRef = useRef(Math.max(0, index));
  const lastVideoRef = useRef<Video | null>(null);
  if (index >= 0) {
    lastIndexRef.current = index;
    lastVideoRef.current = queue[index];
  }
  const current = index >= 0 ? queue[index] : lastVideoRef.current;

  function neighbour(delta: number): string | null {
    // If the current video was removed, the item now at its old position counts as "next".
    const target = index >= 0 ? index + delta : lastIndexRef.current + (delta > 0 ? 0 : -1);
    return queue[target]?.id ?? null;
  }

  function advance() {
    const next = neighbour(1);
    if (next) onSelect(next);
    else setDone(true);
  }

  // Player events are bound once, so they read the latest props through a ref.
  const latest = useRef({ currentId, onFinished, advance });
  latest.current = { currentId, onFinished, advance };

  useEffect(() => {
    let cancelled = false;
    const frame = frameRef.current;
    loadYouTubeApi().then(() => {
      if (cancelled || !frame || !window.YT) return;
      // The API replaces its element with an iframe, so give it a node React doesn't own.
      const host = document.createElement("div");
      frame.appendChild(host);
      loadedIdRef.current = latest.current.currentId;
      playerRef.current = new window.YT.Player(host, {
        host: "https://www.youtube-nocookie.com",
        videoId: latest.current.currentId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e: YTEvent) => {
            if (e.data !== ENDED) return;
            latest.current.onFinished(latest.current.currentId);
            latest.current.advance();
          },
          onError: (e: YTEvent) => UNPLAYABLE.has(e.data) && setError(true),
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      if (frame) frame.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    setError(false);
    setDone(false);
    if (playerRef.current && loadedIdRef.current !== currentId) {
      loadedIdRef.current = currentId;
      playerRef.current.loadVideoById(currentId);
    }
  }, [currentId]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => latest.current.advance(), AUTO_SKIP_MS);
    return () => clearTimeout(timer);
  }, [error]);

  // Dragging the handle sets the width from the pointer's distance to the right edge.
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  }
  function moveResize(e: React.PointerEvent<HTMLDivElement>) {
    if (resizing) onResize(clampPlayerWidth(window.innerWidth - e.clientX));
  }
  function keyResize(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 80 : 20;
    if (e.key === "ArrowLeft") onResize(clampPlayerWidth(width + step));
    else if (e.key === "ArrowRight") onResize(clampPlayerWidth(width - step));
    else return;
    e.preventDefault();
  }

  const prev = neighbour(-1);
  const next = neighbour(1);

  return (
    <aside className={`player-panel${resizing ? " resizing" : ""}`} aria-label="Player">
      <div
        className="player-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize player"
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
        onDoubleClick={() => onResize(clampPlayerWidth(PLAYER_DEFAULT_WIDTH))}
        onKeyDown={keyResize}
      />
      <div className="player-frame">
        <div ref={frameRef} className="player-host" />
        {(error || done) && (
          <div className="player-notice">
            {done ? (
              <>
                <p>Queue finished.</p>
                <button className="btn" onClick={onClose}>
                  Close player
                </button>
              </>
            ) : (
              <>
                <p>This video can&apos;t be played here.</p>
                <div className="form-row" style={{ justifyContent: "center" }}>
                  <a className="btn" href={watchUrl(currentId)} target="_blank" rel="noreferrer">
                    Open on YouTube
                  </a>
                  <button className="btn" onClick={() => latest.current.advance()}>
                    Skip
                  </button>
                </div>
                <p className="muted small">Skipping in a moment…</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="player-controls">
        <div className="player-info">
          <a className="row-title" href={watchUrl(currentId)} target="_blank" rel="noreferrer" title={current?.title}>
            {current?.title}
          </a>
          <div className="muted small">
            {current?.channelTitle}
            {index >= 0 && ` · ${index + 1} of ${queue.length}`}
          </div>
        </div>
        <div className="player-buttons">
          <button className="btn ghost" onClick={() => prev && onSelect(prev)} disabled={!prev} aria-label="Previous">
            ⏮
          </button>
          <button className="btn ghost" onClick={() => next && onSelect(next)} disabled={!next} aria-label="Next">
            ⏭
          </button>
          <button className="btn ghost" onClick={onClose} aria-label="Close player">
            ✕
          </button>
        </div>
      </div>

      <div className="player-side">
        <div className="player-side-head small muted">Up next · tap thumbnails in the feed to add more</div>
        <div className="list">
          {queue.map((v, i) => (
            <div
              key={v.id}
              className={`row player-item${v.id === currentId ? " current" : ""}${watched.has(v.id) ? " seen" : ""}`}
            >
              <button className="player-item-main" onClick={() => onSelect(v.id)}>
                <div className="row-thumb">
                  <img src={thumbUrl(v.id)} alt="" loading="lazy" />
                  {formatDuration(v.duration) && <span className="badge">{formatDuration(v.duration)}</span>}
                </div>
                <div className="row-body">
                  <div className="row-title small" title={v.title}>
                    {watched.has(v.id) ? "✓ " : `${i + 1}. `}
                    {v.title}
                  </div>
                  <div className="muted small">{v.channelTitle}</div>
                </div>
              </button>
              <button className="btn ghost sm" onClick={() => onRemove(v.id)} aria-label={`Remove ${v.title} from queue`}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
