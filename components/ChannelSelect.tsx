"use client";

import { useMemo, useRef, useState } from "react";
import type { GroupBadge } from "@/lib/groups";
import * as sfx from "@/lib/sfx";
import type { Group } from "@/lib/types";
import Badge from "./Badge";
import Toggle from "./Toggle";
import TrayHull, { KNOB_STEP, type TrayControl } from "./TrayHull";
import { useMech } from "./useMech";

export type ThumbSize = "s" | "m" | "l";
export const SIZE_COLUMNS: Record<ThumbSize, number> = { s: 5, m: 4, l: 3 };
const SIZES = ["s", "m", "l"] as const;

type Props = {
  groups: Group[];
  badges: Map<string, GroupBadge>;
  groupId: string;
  onGroup: (id: string) => void;
  onAddGroup: (name: string) => void;
  hideWatched: boolean;
  onHideWatched: (on: boolean) => void;
  hideShorts: boolean;
  onHideShorts: (on: boolean) => void;
  size: ThumbSize;
  onSize: (size: ThumbSize) => void;
  status?: string;
};

export default function ChannelSelect(props: Props) {
  const keys = [
    { id: "all", name: "ALL" },
    ...props.groups.map((g) => ({ id: g.id, name: g.name.toUpperCase() })),
  ];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const trayRef = useRef<HTMLDivElement>(null);
  const [has3d, setHas3d] = useState(false);
  const { pressed, bind, reset } = useMech();
  // Angle the thumbnail selector is held at while it's being dragged.
  const [turn, setTurn] = useState<number | null>(null);
  const sizeAt = SIZES.indexOf(props.size);

  // The ADD key stays down while the name is typed and springs back up when it's done.
  function commit() {
    const name = draft.trim();
    if (name) props.onAddGroup(name);
    setDraft("");
    setAdding(false);
    sfx.bankUp();
  }

  // Channel keys are an interlocking bank: one is always down, pressing another throws it back up.
  const controls = useMemo<TrayControl[]>(() => {
    const state = (id: string, latched: boolean) => (pressed === id ? "down" : latched ? "latched" : "up");
    return [
      ...keys.map((k): TrayControl => ({ id: k.id, kind: "key", state: state(k.id, k.id === props.groupId), lit: k.id === props.groupId })),
      { id: "add", kind: "key", state: state("add", adding), blank: true },
      { id: "hide-watched", kind: "slide", on: props.hideWatched },
      { id: "hide-shorts", kind: "slide", on: props.hideShorts },
      { id: "size", kind: "knob", stops: SIZES.length, value: sizeAt, turn },
    ];
  }, [keys.map((k) => k.id).join(), props.groupId, pressed, adding, props.hideWatched, props.hideShorts, sizeAt, turn]);

  // Turn the selector to stop i, ticking through every detent on the way; past either end it knocks on the stop.
  function turnTo(i: number) {
    if (i < 0 || i >= SIZES.length) return sfx.endStop();
    if (i === sizeAt) return;
    sfx.detent(Math.abs(i - sizeAt));
    props.onSize(SIZES[i]);
  }

  // Dragging the knob turns it (right or up is clockwise), pulled toward the nearest detent and clicking into
  // each one it reaches. A plain click turns it one step toward the side that was clicked.
  function grabKnob(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const knob = e.currentTarget;
    knob.setPointerCapture(e.pointerId);
    const box = knob.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, angle: (sizeAt - (SIZES.length - 1) / 2) * KNOB_STEP };
    const limit = ((SIZES.length - 1) / 2) * KNOB_STEP + 12;
    let at = sizeAt;
    let moved = false;
    let stopped = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      const raw = start.angle + (dx - dy) * 1.5;
      const angle = Math.max(-limit, Math.min(limit, raw));
      if (angle !== raw && !stopped) sfx.endStop();
      stopped = angle !== raw;
      const i = Math.max(0, Math.min(SIZES.length - 1, Math.round(angle / KNOB_STEP + (SIZES.length - 1) / 2)));
      if (i !== at) {
        sfx.detent();
        at = i;
        props.onSize(SIZES[i]);
      }
      const notch = (i - (SIZES.length - 1) / 2) * KNOB_STEP;
      setTurn(notch + (angle - notch) * 0.4);
    };
    const end = (ev: PointerEvent) => {
      if (!moved && ev.type === "pointerup") turnTo(sizeAt + (ev.clientX < box.left + box.width / 2 ? -1 : 1));
      setTurn(null);
      knob.removeEventListener("pointermove", move);
      knob.removeEventListener("pointerup", end);
      knob.removeEventListener("pointercancel", end);
    };
    knob.addEventListener("pointermove", move);
    knob.addEventListener("pointerup", end);
    knob.addEventListener("pointercancel", end);
  }

  // Arrow keys turn the selector a step, like a radio group.
  function dialKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = sizeAt + step;
    turnTo(i);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]")[i]?.focus();
  }

  return (
    <div className="left">
      <div ref={trayRef} className={`tray${has3d ? " has-3d" : ""}`}>
        <TrayHull tray={trayRef} controls={controls} onReady={setHas3d} />
        <section className="tray-section">
          <div className="tray-label">CHANNELS</div>
          <div className="keys">
            {keys.map((k, i) => {
              const on = k.id === props.groupId;
              const badge = props.badges.get(k.id);
              return (
                <button
                  key={k.id}
                  className={`key${on ? " on" : ""}`}
                  onClick={() => props.onGroup(k.id)}
                  title={k.name}
                  aria-pressed={on}
                  {...bind(
                    k.id,
                    () => {
                      sfx.bankDown();
                      return on;
                    },
                    (wasOn) => (wasOn ? sfx.reseat() : sfx.interlock()),
                  )}
                >
                  <span className="key-led" data-led />
                  {badge ? (
                    <Badge group={badge} className="lg" print />
                  ) : (
                    <span className="key-idx mono" data-print>
                      {String(i).padStart(2, "0")}
                    </span>
                  )}
                  <span className="key-name" data-print>
                    {k.name}
                  </span>
                </button>
              );
            })}
            {adding ? (
              <div className="key key-add editing" data-key="add">
                <span className="key-idx mono" data-print>
                  {String(keys.length).padStart(2, "0")}
                </span>
                <input
                  className="key-input"
                  autoFocus
                  placeholder="NAME"
                  aria-label="New group name"
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setDraft("");
                      setAdding(false);
                      sfx.bankUp();
                    }
                  }}
                />
              </div>
            ) : (
              <button
                className="key key-add"
                onClick={() => {
                  setAdding(true);
                  reset(); // the button is swapped for the name field, so its release never arrives
                }}
                title="Add group"
                {...bind("add", sfx.bankDown, () => {})}
              >
                <span className="key-idx mono" data-print>
                  +
                </span>
                <span className="key-name" data-print>
                  ADD
                </span>
              </button>
            )}
          </div>
        </section>
        <section className="tray-section">
          <div className="tray-label">FILTERS</div>
          <div className="toggles">
            <Toggle
              label="HIDE WATCHED"
              tone="now"
              ctl="hide-watched"
              on={props.hideWatched}
              onClick={() => props.onHideWatched(!props.hideWatched)}
            />
            <Toggle
              label="HIDE SHORTS"
              tone="now"
              ctl="hide-shorts"
              on={props.hideShorts}
              onClick={() => props.onHideShorts(!props.hideShorts)}
            />
          </div>
        </section>
        <section className="tray-section">
          <div className="tray-label">THUMBNAILS</div>
          {/* Three cream keys, or with the 3D tray a rotary selector with the sizes printed around it. */}
          <div className="size-keys" role="radiogroup" aria-label="Cartridge size" onKeyDown={dialKey}>
            <div className="size-knob" data-key="size" aria-hidden onPointerDown={grabKnob} />
            {SIZES.map((s, i) => (
              <button
                key={s}
                className={`size-key${props.size === s ? " on" : ""}`}
                role="radio"
                aria-checked={props.size === s}
                tabIndex={props.size === s ? 0 : -1}
                title={`${SIZE_COLUMNS[s]} per row`}
                style={{ "--a": `${(i - (SIZES.length - 1) / 2) * KNOB_STEP}deg` } as React.CSSProperties}
                onClick={() => turnTo(i)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </section>
        <div className="grille" />
      </div>
      {props.status && (
        <div className="status-line" role="status">
          {props.status}
        </div>
      )}
    </div>
  );
}
