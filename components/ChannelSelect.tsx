"use client";

import { useState } from "react";
import type { Group } from "@/lib/types";
import Toggle from "./Toggle";

export type ThumbSize = "s" | "m" | "l";
export const SIZE_COLUMNS: Record<ThumbSize, number> = { s: 5, m: 4, l: 3 };

type Props = {
  groups: Group[];
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

  function commit() {
    const name = draft.trim();
    if (name) props.onAddGroup(name);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="tray">
      <section className="tray-section">
        <div className="tray-label">CHANNELS</div>
        <div className="keys">
          {keys.map((k, i) => {
            const on = k.id === props.groupId;
            return (
              <button
                key={k.id}
                className={`key${on ? " on" : ""}`}
                onClick={() => props.onGroup(k.id)}
                title={k.name}
              >
                <span className="key-led" />
                <span className="key-idx mono">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="key-name">{k.name}</span>
              </button>
            );
          })}
          {adding ? (
            <div className="key key-add editing">
              <span className="key-idx mono">
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
                  }
                }}
              />
            </div>
          ) : (
            <button
              className="key key-add"
              onClick={() => setAdding(true)}
              title="Add group"
            >
              <span className="key-idx mono">+</span>
              <span className="key-name">ADD</span>
            </button>
          )}
        </div>
      </section>
      {props.status && (
        <section className="tray-section" role="status">
          <div className="tray-label">STATUS</div>
          <div className="tray-status">{props.status}</div>
        </section>
      )}
      <section className="tray-section">
        <div className="tray-label">FILTERS</div>
        <div className="toggles">
          <Toggle
            label="HIDE WATCHED"
            tone="now"
            on={props.hideWatched}
            onClick={() => props.onHideWatched(!props.hideWatched)}
          />
          <Toggle
            label="HIDE SHORTS"
            tone="now"
            on={props.hideShorts}
            onClick={() => props.onHideShorts(!props.hideShorts)}
          />
        </div>
      </section>
      <section className="tray-section">
        <div className="tray-label">THUMBNAILS</div>
        <div
          className="size-keys"
          role="radiogroup"
          aria-label="Cartridge size"
        >
          {(["s", "m", "l"] as const).map((s) => (
            <button
              key={s}
              className={`size-key${props.size === s ? " on" : ""}`}
              role="radio"
              aria-checked={props.size === s}
              title={`${SIZE_COLUMNS[s]} per row`}
              onClick={() => props.onSize(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </section>
      <div className="grille" />
    </div>
  );
}
