"use client";

import { useEffect, useRef, useState } from "react";
import { ageShort, durLabel, thumbUrl } from "@/lib/format";
import type { GroupBadge } from "@/lib/groups";
import type { Group, Video } from "@/lib/types";
import Badge from "./Badge";

type Props = {
  video: Video;
  num: number;
  inQueue: boolean;
  inLater: boolean;
  // On the ALL page: a LATER key per group the channel is in, filing it on that group's shelf.
  groupLater: { badge: GroupBadge; on: boolean }[];
  groups: Group[];
  badges: GroupBadge[];
  onQueue: () => void;
  onLater: () => void;
  onGroupLater: (groupId: string) => void;
  onToggleGroup: (groupId: string, on: boolean) => void;
  onCreateGroup: (name: string) => void;
};

// Hovering shows the keys; touch screens have no hover, so a tap shows them and a
// second tap (or a tap anywhere else) hides them.
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

export default function Cartridge(p: Props) {
  const [active, setActive] = useState(false);
  const [menu, setMenu] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const memberOf = (g: Group) => g.channelIds.includes(p.video.channelId);

  useEffect(() => {
    if (!active || canHover()) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setActive(false);
        setMenu(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  return (
    <div
      ref={ref}
      className={`cart${active ? " active" : ""}`}
      onMouseEnter={() => canHover() && setActive(true)}
      onMouseLeave={() => {
        if (!canHover()) return;
        setActive(false);
        setMenu(false);
      }}
      onClick={(e) => {
        if (canHover() || (e.target as HTMLElement).closest("button, input, form")) return;
        setActive(!active);
        setMenu(false);
      }}
    >
      <div className="face front">
        {p.badges.length > 0 && (
          <span className="badges">
            {p.badges.map((b) => (
              <Badge key={b.id} group={b} />
            ))}
          </span>
        )}
        <div className="ridges">
          <span />
          <span />
        </div>
        <div className="well">
          <div className="label">
            <div className="thumb">
              <img src={thumbUrl(p.video.id)} alt="" loading="lazy" />
              <span className="dur mono">{durLabel(p.video.duration)}</span>
            </div>
            <div className="label-text">
              <span className="title2" title={p.video.title}>
                {p.video.title}
              </span>
              <span className="meta">
                {p.video.channelTitle.toUpperCase()} · {ageShort(p.video.published)} AGO
              </span>
            </div>
          </div>
        </div>
        <div className="connector" />
        {active && (
          <div
            className="hover-keys"
            onClick={(e) => {
              if (canHover() && !p.inQueue && !(e.target as HTMLElement).closest("button")) p.onQueue();
            }}
          >
            <button className={`ckey hkey later${p.inLater ? " on" : ""}`} onClick={p.onLater} title="Watch later" aria-pressed={p.inLater}>
              <span className="hled" />
              LATER
            </button>
            {p.groupLater.map(({ badge, on }) => (
              <button
                key={badge.id}
                className={`ckey hkey later glater${on ? " on" : ""}`}
                onClick={() => p.onGroupLater(badge.id)}
                title={`Watch later on ${badge.name}`}
                aria-pressed={on}
              >
                <span className="hled" />
                <Badge group={badge} />
              </button>
            ))}
            <button className="ckey hkey more" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Groups" title="Groups">
              ⋮
            </button>
          </div>
        )}
      </div>

      {active && menu && (
        <div className="gmenu" role="group" aria-label={`Groups for ${p.video.channelTitle}`}>
          {p.groups.map((g) => (
            <button key={g.id} className={`gmenu-item${memberOf(g) ? " on" : ""}`} onClick={() => p.onToggleGroup(g.id, !memberOf(g))}>
              <span className="gmenu-led" />
              <span>{g.name.toUpperCase()}</span>
            </button>
          ))}
          <form
            className="gmenu-new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              p.onCreateGroup(newName.trim());
              setNewName("");
            }}
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New group" aria-label="New group name" />
            <button className="ckey" type="submit" disabled={!newName.trim()}>
              + NEW
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
