"use client";

import { useEffect, useRef, useState } from "react";
import type { Group } from "@/lib/types";

type Props = {
  channelId: string;
  channelTitle: string;
  groups: Group[];
  onToggle: (groupId: string, on: boolean) => void;
  onCreate: (name: string) => void;
};

export default function GroupMenu({ channelId, channelTitle, groups, onToggle, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const memberCount = groups.filter((g) => g.channelIds.includes(channelId)).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className={`btn ghost sm${memberCount ? " on" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Groups{memberCount > 0 && ` · ${memberCount}`}
      </button>
      {open && (
        <div className="menu" role="group" aria-label={`Groups for ${channelTitle}`}>
          <div className="menu-head small muted" title={channelTitle}>
            {channelTitle}
          </div>
          {groups.map((g) => (
            <label className="menu-item" key={g.id}>
              <input
                type="checkbox"
                checked={g.channelIds.includes(channelId)}
                onChange={(e) => onToggle(g.id, e.target.checked)}
              />
              <span>{g.name}</span>
            </label>
          ))}
          <form
            className="menu-new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onCreate(name.trim());
              setName("");
            }}
          >
            <input
              type="text"
              placeholder="New group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="New group name"
            />
            <button className="btn sm" type="submit" disabled={!name.trim()}>
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
