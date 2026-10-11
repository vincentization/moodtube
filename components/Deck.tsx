"use client";

import { useEffect, useRef, useState } from "react";
import { watchUrl } from "@/lib/format";
import type { Video } from "@/lib/types";

type YTPlayer = {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  // Captions go through the player's module API: it works in embeds but isn't formally documented.
  loadModule(name: string): void;
  unloadModule(name: string): void;
  getOption(module: string, option: string): unknown;
  setOption(module: string, option: string, value: unknown): void;
  destroy(): void;
};
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
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const UNPLAYABLE = new Set([2, 5, 100, 101, 150]); // bad id, HTML5 error, removed, embedding disabled
const AUTO_SKIP_MS = 4000;
const SEGMENTS = 28;

type Props = {
  queue: Video[];
  currentId: string | null;
  playing: boolean;
  watched: Set<string>;
  onSelect: (id: string | null) => void;
  onPlaying: (playing: boolean) => void;
  onFinished: (id: string) => void;
};

export default function Deck({ queue, currentId, playing, watched, onSelect, onPlaying, onFinished }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const loadedRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [frac, setFrac] = useState(0);
  const [error, setError] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [cc, setCc] = useState<string | null>(null); // active subtitle language code
  const [ccNone, setCcNone] = useState(false); // flashes when a video has no subtitles
  const [fullscreen, setFullscreen] = useState(false);

  const index = currentId ? queue.findIndex((v) => v.id === currentId) : -1;
  const current = index >= 0 ? queue[index] : null;
  const nextId = index >= 0 ? (queue[index + 1]?.id ?? null) : null;
  // PLAY with nothing loaded starts at the first unwatched item.
  const startItem = queue.find((v) => !watched.has(v.id)) ?? queue[0] ?? null;

  // Events are bound once, so they read the latest props through a ref.
  const latest = useRef({ currentId, nextId, onSelect, onPlaying, onFinished });
  latest.current = { currentId, nextId, onSelect, onPlaying, onFinished };

  function advance() {
    const { nextId, onSelect, onPlaying } = latest.current;
    if (nextId) onSelect(nextId);
    else {
      onSelect(null);
      onPlaying(false);
    }
  }

  // Create the player the first time something is selected; keep it for the session.
  useEffect(() => {
    if (!currentId || playerRef.current) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT || playerRef.current) return;
      const el = document.createElement("div"); // the API replaces this node with its iframe
      hostRef.current.appendChild(el);
      loadedRef.current = latest.current.currentId;
      playerRef.current = new window.YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        videoId: latest.current.currentId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            setReady(true);
          },
          onStateChange: (e: YTEvent) => {
            if (e.data === PLAYING) latest.current.onPlaying(true);
            else if (e.data === PAUSED) latest.current.onPlaying(false);
            else if (e.data === ENDED) {
              const id = latest.current.currentId;
              if (id) latest.current.onFinished(id);
              advance();
            }
          },
          onError: (e: YTEvent) => UNPLAYABLE.has(e.data) && setError(true),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [],
  );

  // Sync the player to the selected item and play state.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    if (!currentId) {
      player.stopVideo();
      loadedRef.current = null;
      return;
    }
    if (loadedRef.current !== currentId) {
      loadedRef.current = currentId;
      setError(false);
      setFrac(0);
      setCc(null);
      if (playing) player.loadVideoById(currentId);
      else player.cueVideoById(currentId);
      return;
    }
    if (playing) player.playVideo();
    else player.pauseVideo();
  }, [currentId, playing, ready]);

  // If the browser blocks playback (autoplay rules), show PLAY again instead of a stuck PAUSE.
  useEffect(() => {
    if (!playing || !currentId || !ready) return;
    const t = setTimeout(() => {
      const state = playerRef.current?.getPlayerState();
      if (state !== PLAYING && state !== BUFFERING) latest.current.onPlaying(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [playing, currentId, ready]);

  // Progress readout.
  useEffect(() => {
    if (!currentId || !ready) {
      setFrac(0);
      return;
    }
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const d = p.getDuration();
      setFrac(d > 0 ? Math.min(1, p.getCurrentTime() / d) : 0);
    }, 250);
    return () => clearInterval(t);
  }, [currentId, ready]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(advance, AUTO_SKIP_MS);
    return () => clearTimeout(t);
  }, [error]);

  function togglePlay() {
    if (!currentId) {
      if (!startItem) return;
      onSelect(startItem.id);
      onPlaying(true);
      return;
    }
    onPlaying(!playing);
  }

  function stop() {
    if (!currentId) return;
    onPlaying(false);
    playerRef.current?.seekTo(0, true);
    playerRef.current?.pauseVideo();
    setFrac(0);
  }

  function next() {
    if (!currentId) return;
    setError(false);
    advance();
  }

  const keysOn = !!currentId && ready;

  function seekBy(delta: number) {
    const p = playerRef.current;
    if (!p || !keysOn) return;
    p.seekTo(Math.max(0, p.getCurrentTime() + delta), true);
  }

  function toggleMute() {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) p.unMute();
    else p.mute();
    setMuted(p.isMuted());
  }

  function cycleRate() {
    const p = playerRef.current;
    if (!p) return;
    const rates = p.getAvailablePlaybackRates();
    if (!rates.length) return;
    const next = rates[(rates.indexOf(p.getPlaybackRate()) + 1) % rates.length];
    p.setPlaybackRate(next);
    setRate(next);
  }

  // Off -> each available subtitle language in turn -> off.
  function cycleCaptions() {
    const p = playerRef.current;
    if (!p) return;
    let tracks: { languageCode: string }[] = [];
    try {
      p.loadModule("captions");
      tracks = (p.getOption("captions", "tracklist") as typeof tracks) ?? [];
    } catch {}
    if (!tracks.length) {
      setCcNone(true);
      setTimeout(() => setCcNone(false), 1500);
      return;
    }
    const next = tracks[(cc ? tracks.findIndex((t) => t.languageCode === cc) : -1) + 1];
    if (next) {
      p.setOption("captions", "track", { languageCode: next.languageCode });
      setCc(next.languageCode);
    } else {
      p.setOption("captions", "track", {});
      p.unloadModule("captions");
      setCc(null);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else screenRef.current?.requestFullscreen?.();
  }

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === screenRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const lit = Math.round(frac * SEGMENTS);
  const isPlaying = playing && !!currentId;

  return (
    <>
      <div className="bezel">
        <span className="screw l" />
        <span className="screw r" />
        <div ref={screenRef} className="screen">
          <div ref={hostRef} className="screen-host" />
          {(!currentId || error) && (
            <div className="screen-text mono">
              <span className="out">VIDEO OUT</span>
              {error && current ? (
                <>
                  <span className="np">CAN&apos;T PLAY HERE</span>
                  <span className="acts">
                    <a className="ckey" href={watchUrl(current.id)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                      OPEN ON YOUTUBE
                    </a>
                    <button className="ckey" onClick={next}>
                      SKIP
                    </button>
                  </span>
                </>
              ) : (
                <span className="np">{startItem ? startItem.title.toUpperCase() : "NO SIGNAL"}</span>
              )}
            </div>
          )}
          <div className="scan" />
          <div className="glare" />
        </div>
        <div className="bezel-keys">
          <button className="bkey" onClick={() => seekBy(-10)} disabled={!keysOn} title="Back 10 seconds">
            ◂◂ 10
          </button>
          <button className="bkey" onClick={() => seekBy(10)} disabled={!keysOn} title="Forward 10 seconds">
            10 ▸▸
          </button>
          <button className={`bkey${muted ? " on" : ""}`} onClick={toggleMute} disabled={!keysOn} title="Mute" aria-pressed={muted}>
            {muted ? "MUTED" : "MUTE"}
          </button>
          <button className={`bkey${rate !== 1 ? " on" : ""}`} onClick={cycleRate} disabled={!keysOn} title="Playback speed">
            {rate}×
          </button>
          <button className={`bkey${cc ? " on" : ""}`} onClick={cycleCaptions} disabled={!keysOn} title="Subtitles (press to cycle languages)">
            {ccNone ? "NO CC" : cc ? `CC ${cc.toUpperCase()}` : "CC OFF"}
          </button>
          <button className={`bkey${fullscreen ? " on" : ""}`} onClick={toggleFullscreen} title="Fullscreen" aria-pressed={fullscreen}>
            ⛶ FULL
          </button>
        </div>
      </div>

      <div className="progress" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < lit ? "on" : undefined} />
        ))}
      </div>

      <div className="transport">
        <button className="tbtn play" onClick={togglePlay}>
          <span className="glyph">{isPlaying ? "❚❚" : "▶"}</span>
          <span className="word">{isPlaying ? "PAUSE" : "PLAY"}</span>
        </button>
        <button className="tbtn" onClick={stop}>
          <span className="glyph stop">■</span>
          <span className="word">STOP</span>
        </button>
        <button className="tbtn" onClick={next}>
          <span className="glyph">▸▸</span>
          <span className="word">NEXT</span>
        </button>
      </div>
    </>
  );
}
