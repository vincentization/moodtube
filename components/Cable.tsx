"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  target: string | null; // data-jack of the unit the CRT is fed from; null leaves it unplugged
};

type Geo = { xt: number; b: number; xb: number; t: number; gx: number };

// Patch cable from the CRT's output jack to the jack of whichever unit is feeding it, once something plays.
// The in-flow div keeps the gap under the CRT; the cord itself is drawn over the column,
// measured from the jacks, and dropped down the left gutter when it has to pass the stack.
export default function Cable({ target }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const gap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // The column is found from the spacer, not a parent ref: a parent's ref isn't attached yet when this first runs.
    const el = gap.current?.parentElement;
    if (!el || !target) return setGeo(null);
    const measure = () => {
      const out = el.querySelector<HTMLElement>(".jack.out");
      const into = el.querySelector<HTMLElement>(`[data-jack="${CSS.escape(target)}"] > .jack`);
      if (!out || !into) return setGeo(null);
      const base = el.getBoundingClientRect();
      const o = out.getBoundingClientRect();
      const i = into.getBoundingClientRect();
      const unit = into.parentElement!.getBoundingClientRect();
      const y = (r: number) => r - base.top + el.scrollTop;
      const x = (r: number) => r - base.left + el.scrollLeft;
      setGeo({
        xt: x(o.left + o.width / 2),
        b: y(o.top + o.height / 2),
        xb: x(i.left + i.width / 2),
        t: y(i.top + i.height / 2),
        gx: x(unit.left) - 12,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      for (const child of el.children) ro.observe(child);
    };
    watch();
    const mo = new MutationObserver(() => {
      watch();
      measure();
    });
    mo.observe(el, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [target]);

  let cord = "";
  if (geo) {
    const { xt, b, xb, t, gx } = geo;
    cord =
      t - b < 120
        ? `M${xt} ${b + 18} C${xt} ${b + 38}, ${xb} ${t - 38}, ${xb} ${t - 18}`
        : `M${xt} ${b + 18} C${xt} ${b + 44}, ${gx} ${b + 20}, ${gx} ${b + 48} L${gx} ${t - 46} C${gx} ${t - 20}, ${xb} ${t - 44}, ${xb} ${t - 18}`;
  }

  return (
    <>
      <div ref={gap} className="cable" aria-hidden />
      {geo && (
        <svg className="patch" width="1" height="1" aria-hidden>
          <defs>
            <linearGradient id="plug-metal" x1="0" x2="1">
              <stop offset="0" stopColor="#6d6a62" />
              <stop offset="0.45" stopColor="#d9d4c7" />
              <stop offset="1" stopColor="#5a5750" />
            </linearGradient>
          </defs>
          {/* Top plug, seated in the bezel. */}
          <rect x={geo.xt - 7} y={geo.b} width="14" height="10" rx="1" fill="url(#plug-metal)" />
          <rect x={geo.xt - 9} y={geo.b + 9} width="18" height="10" rx="2" className="cable-boot" />
          {/* Keyed by target so a re-patch replays the cord drawing in and the plug seating. */}
          <g key={target}>
            <path className="cable-cord" d={cord} pathLength={1} />
            <path className="cable-shine" d={cord} pathLength={1} />
            <g className="cable-plug">
              <rect x={geo.xb - 9} y={geo.t - 19} width="18" height="10" rx="2" className="cable-boot" />
              <rect x={geo.xb - 7} y={geo.t - 10} width="14" height="10" rx="1" fill="url(#plug-metal)" />
            </g>
          </g>
        </svg>
      )}
    </>
  );
}
