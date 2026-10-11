"use client";

import { useState } from "react";
import { formatDuration, thumbUrl } from "@/lib/format";
import type { Video } from "@/lib/types";

type Props = {
  queue: Video[];
  onMove: (index: number, delta: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onMarkAllWatched: () => void;
  onPlay: () => void;
  hidden?: boolean;
};

// watch_videos silently ignores anything past 50 IDs.
const MAX_PLAY = 50;

export default function QueueBar({ queue, onMove, onRemove, onClear, onMarkAllWatched, onPlay, hidden }: Props) {
  const [open, setOpen] = useState(false);
  const [played, setPlayed] = useState(false);
  // Hidden (not unmounted) while the player is open, so `played` survives.
  if (hidden || queue.length === 0) return null;

  const total = queue.reduce((sum, v) => sum + (v.duration ?? 0), 0);
  const playUrl = `https://www.youtube.com/watch_videos?video_ids=${queue
    .slice(0, MAX_PLAY)
    .map((v) => v.id)
    .join(",")}`;

  return (
    <div className="queue-bar" role="region" aria-label="Watch now queue">
      <div className="queue-head">
        <button className="title" onClick={() => setOpen(!open)} aria-expanded={open}>
          Watch now · {queue.length}
          <span className="muted small"> {total > 0 && `· ${formatDuration(total)}`}</span>
        </button>
        {played ? (
          <button
            className="btn sm"
            onClick={() => {
              onMarkAllWatched();
              setPlayed(false);
            }}
          >
            Mark watched &amp; clear
          </button>
        ) : (
          <button className="btn ghost sm" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Edit"}
          </button>
        )}
        <button
          className="btn primary sm"
          onClick={() => {
            setPlayed(true);
            onPlay();
          }}
        >
          Play here
        </button>
      </div>
      {open && (
        <div className="queue-items">
          <div className="list">
            {queue.map((v, i) => (
              <div className="row" key={v.id}>
                <div className="row-thumb">
                  <img src={thumbUrl(v.id)} alt="" loading="lazy" />
                </div>
                <div className="row-body">
                  <div className="row-title small" title={v.title}>
                    {i + 1}. {v.title}
                  </div>
                  <div className="muted small">{v.channelTitle}</div>
                </div>
                <div className="row-actions">
                  <button className="btn ghost sm" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => onMove(i, 1)}
                    disabled={i === queue.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button className="btn ghost sm" onClick={() => onRemove(v.id)} aria-label="Remove from queue">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="form-row" style={{ justifyContent: "space-between", padding: "8px 0" }}>
            <span className="form-row">
              <a className="btn ghost sm" href={playUrl} target="_blank" rel="noreferrer" onClick={() => setPlayed(true)}>
                Open in YouTube
              </a>
              <span className="muted small">
                {queue.length > MAX_PLAY && `YouTube plays the first ${MAX_PLAY} only.`}
              </span>
            </span>
            <button className="btn ghost sm danger" onClick={onClear}>
              Clear queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
