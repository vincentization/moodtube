"use client";

import { useState } from "react";
import type { DragEvent } from "react";

// Native drag-and-drop reordering for a vertical list; returns props to spread on each row.
export function useReorder(ids: string[], onReorder: (ids: string[]) => void) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function reset() {
    setDrag(null);
    setOver(null);
  }

  function rowProps(id: string) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", id);
        } catch {}
        setTimeout(() => setDrag(id), 0);
      },
      onDragOver: (e: DragEvent) => {
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (over !== id) setOver(id);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (drag && drag !== id) {
          const next = ids.filter((x) => x !== drag);
          next.splice(ids.indexOf(id), 0, drag);
          onReorder(next);
        }
        reset();
      },
      onDragEnd: reset,
    };
  }

  return {
    rowProps,
    isDragging: (id: string) => drag === id,
    isOver: (id: string) => over === id && drag !== null && drag !== id,
  };
}
