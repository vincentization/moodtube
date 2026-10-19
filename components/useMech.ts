"use client";

import { useRef, useState } from "react";

// Mechanical key travel for the Three.js hardware: pointer and keyboard both drive a key down and back up
// (the click itself still does the action). `down` runs as the key goes down and can return what it saw then,
// which `up` gets back on release; Enter clicks on keydown, so by release the state may already have changed.
export function useMech() {
  const [pressed, setPressed] = useState<string | null>(null);
  const held = useRef<unknown>(undefined);

  function bind<C>(id: string, down: () => C, up: (seen: C) => void) {
    const press = () => {
      held.current = down();
      setPressed(id);
    };
    const release = () => {
      setPressed((p) => (p === id ? null : p));
      up(held.current as C);
    };
    return {
      "data-key": id,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId); // so the key comes back up wherever the pointer is released
        } catch {}
        press();
      },
      onPointerUp: () => pressed === id && release(),
      onPointerCancel: () => setPressed(null),
      onKeyDown: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && !e.repeat && press(),
      onKeyUp: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && pressed === id && release(),
      onBlur: () => pressed === id && setPressed(null),
    };
  }

  // Let go of whatever is held without a release sound, e.g. when the pressed key is swapped out of the DOM.
  const reset = () => setPressed(null);

  return { pressed, bind, reset };
}
