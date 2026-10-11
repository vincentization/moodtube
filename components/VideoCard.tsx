"use client";

import { formatDuration, thumbUrl, timeAgo, watchUrl } from "@/lib/format";
import type { Video } from "@/lib/types";

type Props = {
  video: Video;
  queuePos: number; // 0 = not queued
  watched: boolean;
  later: boolean;
  onToggleQueue: () => void;
  onToggleLater: () => void;
  onToggleWatched: () => void;
};

export default function VideoCard({ video, queuePos, watched, later, onToggleQueue, onToggleLater, onToggleWatched }: Props) {
  const duration = formatDuration(video.duration);
  return (
    <article className={`card${watched ? " watched" : ""}`}>
      <button
        className={`thumb${queuePos ? " queued" : ""}`}
        onClick={onToggleQueue}
        aria-label={queuePos ? `Remove "${video.title}" from queue` : `Add "${video.title}" to queue`}
      >
        <img src={thumbUrl(video.id)} alt="" loading="lazy" />
        {duration && <span className="badge">{video.isShort ? "Short" : duration}</span>}
        {queuePos > 0 && <span className="queue-pos">{queuePos}</span>}
      </button>
      <div className="card-body">
        <a className="card-title" href={watchUrl(video.id)} target="_blank" rel="noreferrer" title={video.title}>
          {video.title}
        </a>
        <div className="card-meta">
          {video.channelTitle} · {timeAgo(video.published)}
        </div>
        <div className="card-actions">
          <button className={`btn ghost sm${queuePos ? " on" : ""}`} onClick={onToggleQueue}>
            {queuePos ? "Queued" : "Queue"}
          </button>
          <button className={`btn ghost sm${later ? " on" : ""}`} onClick={onToggleLater}>
            {later ? "Saved" : "Later"}
          </button>
          <button className={`btn ghost sm${watched ? " on" : ""}`} onClick={onToggleWatched}>
            {watched ? "Watched" : "Mark watched"}
          </button>
        </div>
      </div>
    </article>
  );
}
