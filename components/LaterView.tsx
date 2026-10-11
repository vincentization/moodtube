"use client";

import { formatDuration, thumbUrl, timeAgo, watchUrl } from "@/lib/format";
import type { LaterItem } from "@/lib/types";

type Props = {
  later: LaterItem[];
  onMoveToQueue: (items: LaterItem[]) => void;
  onWatched: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function LaterView({ later, onMoveToQueue, onWatched, onRemove }: Props) {
  if (later.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing saved for later</h2>
        <p>Use “Later” on any video in your feed. It stays here until you watch or remove it.</p>
      </div>
    );
  }
  return (
    <>
      <div className="toolbar">
        <span className="status">
          {later.length} saved video{later.length === 1 ? "" : "s"}
        </span>
        <button className="btn sm" onClick={() => onMoveToQueue(later)}>
          Move all to Watch now
        </button>
      </div>
      <div className="list">
        {later.map((v) => (
          <div className="row" key={v.id}>
            <a className="row-thumb" href={watchUrl(v.id)} target="_blank" rel="noreferrer">
              <img src={thumbUrl(v.id)} alt="" loading="lazy" />
              {formatDuration(v.duration) && <span className="badge">{formatDuration(v.duration)}</span>}
            </a>
            <div className="row-body">
              <a className="row-title" href={watchUrl(v.id)} target="_blank" rel="noreferrer" title={v.title}>
                {v.title}
              </a>
              <div className="muted small">
                {v.channelTitle} · {timeAgo(v.published)}
              </div>
            </div>
            <div className="row-actions">
              <button className="btn ghost sm" onClick={() => onMoveToQueue([v])}>
                To Watch now
              </button>
              <button className="btn ghost sm" onClick={() => onWatched(v.id)}>
                Watched
              </button>
              <button className="btn ghost sm" onClick={() => onRemove(v.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
