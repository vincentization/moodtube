"use client";

import { useEffect, useRef, useState } from "react";
import { durLabel, thumbUrl } from "@/lib/format";
import type { GroupBadge } from "@/lib/groups";
import type { Group, Video } from "@/lib/types";
import Badge, { TapeBand } from "./Badge";

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
  // Opens the channel's page; left out on that page itself.
  onChannel?: () => void;
  watched?: boolean;
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
      className={`cart${active ? " active" : ""}${p.watched ? " seen" : ""}`}
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
        <div className="ridges">
          <span />
          <span />
        </div>
        <div className="well">
          <div className="label">
            <div className="thumb">
              <img src={thumbUrl(p.video.id)} alt="" loading="lazy" />
            </div>
            <div className="vhs">
              <TapeBand badges={p.badges} className="vhs-band">
                <span className="vhs-chan">{p.video.channelTitle}</span>
                <span className="tape-time mono">{durLabel(p.video.duration)}</span>
              </TapeBand>
              <span className="vhs-title" title={p.video.title}>
                {p.video.title}
              </span>
            </div>
          </div>
        </div>
        <div className="connector" />
        {active && (
          <div
            className="hover-keys"
            onClick={(e) => {
              if (canHover() && !p.inQueue && !(e.target as HTMLElement).closest(".rail")) p.onQueue();
            }}
          >
            <div className="rail">
              <button className={`rkey${p.inLater ? " on" : ""}`} onClick={p.onLater} title="Watch later" aria-label="Watch later" aria-pressed={p.inLater}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 4.5V8l2.5 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {p.groupLater.map(({ badge, on }) => (
                <button
                  key={badge.id}
                  className={`rkey glater${on ? " on" : ""}`}
                  onClick={() => p.onGroupLater(badge.id)}
                  title={`Watch later on ${badge.name}`}
                  aria-label={`Watch later on ${badge.name}`}
                  aria-pressed={on}
                >
                  <Badge group={badge} />
                </button>
              ))}
              <button className={`rkey more${menu ? " on" : ""}`} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Groups" title="Groups">
                ⋮
              </button>
              {p.onChannel && (
                <button className="rkey" onClick={p.onChannel} title={`All videos from ${p.video.channelTitle}`} aria-label={`Open ${p.video.channelTitle}`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                    <rect x="1.5" y="5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 1.5 8 5l3-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
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
