"use client";

import { durLabel, totalLabel } from "@/lib/format";
import type { Video } from "@/lib/types";
import { useReorder } from "./useReorder";

type Props = {
  name: string;
  later: Video[];
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onToNow: (id: string) => void;
};

// Watch later for the current group: tapes lying on a wooden shelf, off the deck until moved to Watch now.
export default function Shelf(p: Props) {
  const { rowProps, isDragging, isOver } = useReorder(
    p.later.map((v) => v.id),
    p.onReorder,
  );
  const total = p.later.reduce((n, v) => n + (v.duration ?? 0), 0);

  return (
    <div className="shelf">
      <div className="shelf-head">
        <span className="shelf-plate" title={`Watch later for ${p.name}`}>
          {p.name.toUpperCase()} · LATER · {p.later.length}
        </span>
        <span className="shelf-total mono">{totalLabel(total)}</span>
      </div>
      <div className="shelf-boards">
        {p.later.map((v) => (
          <div key={v.id} className={`board${isDragging(v.id) ? " dragging" : ""}`} {...rowProps(v.id)}>
            <div className={`drop-bar${isOver(v.id) ? " on" : ""}`} />
            <div className="spine">
              <span className="spine-label">
                <span className="spine-title" title={v.title}>
                  {v.title}
                </span>
                <span className="spine-meta mono">
                  {v.channelTitle} · {durLabel(v.duration)}
                </span>
              </span>
              <button className="okey" onClick={() => p.onToNow(v.id)} title="Move to Watch now">
                NOW
              </button>
              <button className="ckey eject" onClick={() => p.onRemove(v.id)} title="Take off the shelf">
                ✕
              </button>
            </div>
          </div>
        ))}
        {p.later.length === 0 && <div className="shelf-empty">{p.name} shelf empty — flip LATER on a cartridge.</div>}
      </div>
    </div>
  );
}
