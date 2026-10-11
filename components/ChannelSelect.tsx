"use client";

import type { Group } from "@/lib/types";
import Toggle from "./Toggle";

export type ThumbSize = "s" | "m" | "l";
export const SIZE_COLUMNS: Record<ThumbSize, number> = { s: 5, m: 4, l: 3 };

type Props = {
  groups: Group[];
  groupId: string;
  onGroup: (id: string) => void;
  hideWatched: boolean;
  onHideWatched: (on: boolean) => void;
  hideShorts: boolean;
  onHideShorts: (on: boolean) => void;
  size: ThumbSize;
  onSize: (size: ThumbSize) => void;
};

export default function ChannelSelect(props: Props) {
  const keys = [{ id: "all", name: "ALL" }, ...props.groups.map((g) => ({ id: g.id, name: g.name.toUpperCase() }))];
  return (
    <div className="tray">
      <div className="tray-label">CHANNEL SELECT</div>
      <div className="keys">
        {keys.map((k, i) => {
          const on = k.id === props.groupId;
          return (
            <button key={k.id} className={`key${on ? " on" : ""}`} onClick={() => props.onGroup(k.id)} title={k.name}>
              <span className="key-led" />
              <span className="key-idx mono">{String(i).padStart(2, "0")}</span>
              <span className="key-name">{k.name}</span>
            </button>
          );
        })}
      </div>
      <div className="toggles">
        <Toggle label="HIDE WATCHED" tone="now" on={props.hideWatched} onClick={() => props.onHideWatched(!props.hideWatched)} />
        <Toggle label="HIDE SHORTS" tone="now" on={props.hideShorts} onClick={() => props.onHideShorts(!props.hideShorts)} />
      </div>
      <div className="size-keys" role="radiogroup" aria-label="Cartridge size">
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
      <div className="grille" />
    </div>
  );
}
