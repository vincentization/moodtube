"use client";

import { useState } from "react";
import { durLabel, totalLabel } from "@/lib/format";
import type { Video } from "@/lib/types";

type List = "queue" | "later";

type Props = {
  queue: Video[];
  later: Video[];
  currentId: string | null;
  watched: Set<string>;
  onPlay: (id: string) => void;
  onReorder: (list: List, ids: string[]) => void;
  onEject: (list: List, id: string) => void;
  onLaterToNow: (id: string) => void;
  onClearWatched: () => void;
};

const seconds = (vs: Video[]) => vs.reduce((n, v) => n + (v.duration ?? 0), 0);

export default function Stack(p: Props) {
  const [side, setSide] = useState<"A" | "B">("A");
  const [drag, setDrag] = useState<{ list: List; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const onA = side === "A";
  const list: List = onA ? "queue" : "later";
  const items = onA ? p.queue : p.later;
  const watchedCount = p.queue.filter((v) => p.watched.has(v.id)).length;
  // Watch Now total counts what's left to watch.
  const total = onA ? seconds(p.queue.filter((v) => !p.watched.has(v.id))) : seconds(p.later);

  function drop(targetId: string) {
    if (!drag || drag.list !== list || drag.id === targetId) return;
    const ids = items.map((v) => v.id);
    const to = ids.indexOf(targetId);
    const next = ids.filter((x) => x !== drag.id);
    next.splice(to, 0, drag.id);
    p.onReorder(list, next);
  }

  return (
    <div className="stack">
      <div className="tabs">
        <button className={`tab${onA ? " on" : ""}`} onClick={() => setSide("A")}>
          NOW · {p.queue.length} {p.queue.length === 1 ? "video" : "videos"}
        </button>
        <button className={`tab${!onA ? " on" : ""}`} onClick={() => setSide("B")}>
          LATER · {p.later.length}
        </button>
      </div>
      <div className="stack-head">
        <span className="stack-title">{onA ? "WATCH NOW STACK" : "WATCH LATER STACK"}</span>
        <span className="stack-total mono">{totalLabel(total)}</span>
        {onA && watchedCount > 0 && (
          <button className="ckey" onClick={p.onClearWatched}>
            CLEAR WATCHED
          </button>
        )}
      </div>
      <div className="stack-well">
        {items.map((v, i) => {
          const playing = onA && v.id === p.currentId;
          const seen = onA && p.watched.has(v.id);
          return (
            <div
              key={v.id}
              className={`slot${drag?.id === v.id ? " dragging" : ""}`}
              style={{ zIndex: 100 - i }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                try {
                  e.dataTransfer.setData("text/plain", v.id);
                } catch {}
                setTimeout(() => setDrag({ list, id: v.id }), 0);
              }}
              onDragOver={(e) => {
                if (!drag || drag.list !== list) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== v.id) setOver(v.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(v.id);
                setDrag(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
            >
              <div className={`drop-bar${over === v.id && drag && drag.id !== v.id ? " on" : ""}`} />
              <div className="mini">
                <span className="mini-ridges">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="mini-num mono">{String(i + 1).padStart(2, "0")}</span>
                {onA ? (
                  <button className={`mini-label${playing ? " playing" : ""}`} onClick={() => p.onPlay(v.id)} title={`Play ${v.title}`}>
                    <span className="mini-title">
                      {seen && "✓ "}
                      {v.title}
                    </span>
                    <span className="mini-dur mono">{durLabel(v.duration)}</span>
                  </button>
                ) : (
                  <div className="mini-label">
                    <span className="mini-title" title={v.title}>
                      {v.title}
                    </span>
                    <span className="mini-dur mono">{durLabel(v.duration)}</span>
                  </div>
                )}
                {!onA && (
                  <button className="okey" onClick={() => p.onLaterToNow(v.id)} title="Move to Watch now">
                    NOW
                  </button>
                )}
                <button className="ckey eject" onClick={() => p.onEject(list, v.id)} title="Eject">
                  ⏏
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="empty">{onA ? "Stack empty — flip NOW on a cartridge." : "Nothing saved — flip LATER on a cartridge."}</div>
        )}
      </div>
    </div>
  );
}
