"use client";

import { durLabel, totalLabel } from "@/lib/format";
import type { Video } from "@/lib/types";
import { useReorder } from "./useReorder";

type Props = {
  queue: Video[];
  currentId: string | null; // null unless the stack is the active source
  active: boolean;
  folded: boolean;
  onFold: () => void;
  playing: boolean;
  watched: Set<string>;
  onSource: () => void;
  onPlay: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onEject: (id: string) => void;
  onClearWatched: () => void;
};

// Patches the CRT into this unit; on the active one it's play/pause.
export function SourceKey(p: { active: boolean; playing: boolean; onClick: () => void; title: string }) {
  const pause = p.active && p.playing;
  return (
    <button className={`ckey srckey${p.active ? " on" : ""}`} onClick={p.onClick} title={pause ? "Pause" : p.title} aria-pressed={p.active}>
      <span className="hled" />
      {pause ? "❚❚" : "▶"}
    </button>
  );
}

// Folds a watch list down to its header (and opens it back up); the item count stays on the header either way.
export function FoldKey(p: { folded: boolean; onClick: () => void; name: string }) {
  return (
    <button
      className="ckey fold"
      onClick={p.onClick}
      aria-expanded={!p.folded}
      aria-label={`${p.folded ? "Expand" : "Collapse"} ${p.name}`}
      title={p.folded ? "Expand" : "Collapse"}
    >
      {p.folded ? "▸" : "▾"}
    </button>
  );
}

const seconds = (vs: Video[]) => vs.reduce((n, v) => n + (v.duration ?? 0), 0);

// Watch now: the tapes queued in the deck, fed to the CRT over the cable.
export default function Stack(p: Props) {
  const { rowProps, isDragging, isOver } = useReorder(
    p.queue.map((v) => v.id),
    p.onReorder,
  );
  const watchedCount = p.queue.filter((v) => p.watched.has(v.id)).length;
  // The total counts what's left to watch.
  const total = seconds(p.queue.filter((v) => !p.watched.has(v.id)));

  return (
    <div className={`stack${p.folded ? " folded" : ""}`} data-jack="now">
      <span className="jack" />
      <div className="stack-head">
        <SourceKey active={p.active} playing={p.playing} onClick={p.onSource} title="Play Watch now" />
        <span className="stack-title">WATCH NOW</span>
        <span className="count mono" title={`${p.queue.length} in Watch now`}>
          {p.queue.length}
        </span>
        <span className="stack-total mono">{totalLabel(total)}</span>
        {watchedCount > 0 && !p.folded && (
          <button className="ckey" onClick={p.onClearWatched}>
            CLEAR WATCHED
          </button>
        )}
        <FoldKey folded={p.folded} onClick={p.onFold} name="Watch now" />
      </div>
      {!p.folded && (
        <div className="stack-well">
          {p.queue.map((v, i) => {
            const playing = v.id === p.currentId;
            const seen = p.watched.has(v.id);
            return (
              <div key={v.id} className={`slot${isDragging(v.id) ? " dragging" : ""}`} style={{ zIndex: 100 - i }} {...rowProps(v.id)}>
                <div className={`drop-bar${isOver(v.id) ? " on" : ""}`} />
                <div className="mini">
                  <span className="mini-ridges">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="mini-num mono">{String(i + 1).padStart(2, "0")}</span>
                  <button className={`mini-label${playing ? " playing" : ""}`} onClick={() => p.onPlay(v.id)} title={`Play ${v.title}`}>
                    <span className="mini-title">
                      {seen && "✓ "}
                      {v.title}
                    </span>
                    <span className="mini-dur mono">{durLabel(v.duration)}</span>
                  </button>
                  <button className="ckey eject" onClick={() => p.onEject(v.id)} title="Eject">
                    ⏏
                  </button>
                </div>
              </div>
            );
          })}
          {p.queue.length === 0 && <div className="empty">Stack empty — flip NOW on a cartridge.</div>}
        </div>
      )}
    </div>
  );
}
