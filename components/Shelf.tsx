"use client";

import { durLabel, totalLabel } from "@/lib/format";
import type { GroupBadge } from "@/lib/groups";
import type { Video } from "@/lib/types";
import Badge from "./Badge";
import { FoldKey, SourceKey } from "./Stack";
import { useReorder } from "./useReorder";

type Props = {
  id: string;
  name: string;
  badge?: GroupBadge; // absent for the ALL shelf
  later: Video[];
  currentId: string | null; // null unless this shelf is the active source
  active: boolean;
  folded: boolean;
  onFold: () => void;
  playing: boolean;
  onSource: () => void;
  onPlay: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onToNow: (id: string) => void;
};

// Watch later for a group: tapes lying on a wooden shelf. Patch the CRT into it to play straight off the shelf.
export default function Shelf(p: Props) {
  const { rowProps, isDragging, isOver } = useReorder(
    p.later.map((v) => v.id),
    p.onReorder,
  );
  const total = p.later.reduce((n, v) => n + (v.duration ?? 0), 0);

  return (
    <div
      className={`shelf${p.folded ? " folded" : ""}`}
      data-jack={p.id}
      style={p.badge ? ({ "--badge": p.badge.color } as React.CSSProperties) : undefined}
    >
      <span className="jack" />
      <div className="shelf-head">
        <SourceKey active={p.active} playing={p.playing} onClick={p.onSource} title={`Play the ${p.name} shelf`} />
        {p.badge && <Badge group={p.badge} className="lg" />}
        <span className="shelf-plate" title={`Watch later for ${p.name}`}>
          {p.name.toUpperCase()} · LATER
        </span>
        <span className="count mono" title={`${p.later.length} on the ${p.name} shelf`}>
          {p.later.length}
        </span>
        <span className="shelf-total mono">{totalLabel(total)}</span>
        <FoldKey folded={p.folded} onClick={p.onFold} name={`the ${p.name} shelf`} />
      </div>
      {!p.folded && (
        <div className="shelf-boards">
          {p.later.map((v) => (
            <div key={v.id} className={`board${isDragging(v.id) ? " dragging" : ""}`} {...rowProps(v.id)}>
              <div className={`drop-bar${isOver(v.id) ? " on" : ""}`} />
              <div className="spine">
                <button
                  className={`spine-label${v.id === p.currentId ? " playing" : ""}`}
                  onClick={() => p.onPlay(v.id)}
                  title={`Play ${v.title}`}
                >
                  <span className="spine-title" title={v.title}>
                    {v.title}
                  </span>
                  <span className="spine-meta mono">
                    {v.channelTitle} · {durLabel(v.duration)}
                  </span>
                </button>
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
      )}
    </div>
  );
}
