"use client";

import { useEffect, useRef } from "react";
import type * as T from "three";
import { disposeTree as dispose, frame as frameCamera, K, keyFace, loadThree, makeStage, rrPath, type Rect } from "@/lib/hull3d";
import type { KeyState } from "./CrtHull";

// What the tray's hardware shows. Keys are the interlocking channel bank (lit = its lamp is on; blank = the
// unprinted ADD key); slides are the filter switches; the knob is the rotary thumbnail selector, at stop `value`,
// or held at `turn` degrees while it's being dragged.
export type TrayControl =
  | { id: string; kind: "key"; state: KeyState; lit?: boolean; blank?: boolean }
  | { id: string; kind: "slide"; on: boolean }
  | { id: string; kind: "knob"; stops: number; value: number; turn: number | null };

type Props = {
  tray: React.RefObject<HTMLDivElement | null>;
  controls: TrayControl[];
  onReady: (ok: boolean) => void;
};

// Same oblique projection as the CRT (see CrtHull): the tray floor at z = 0 lines up 1:1 with the DOM, things
// standing out of it shift down by K per unit. Each control's DOM element is the hit target over what's drawn:
// a key's face, a slide's slot, the knob's top.
const KEY_OUT = 18; // how far a bank key at rest stands proud of the tray floor
const KEY_D = 26;
const TRAVEL: Record<KeyState, number> = { up: 0, latched: 10, down: 15 };
const SLIDE_OUT = 5; // slide knob above the floor
const KNOB_H = 11;
export const KNOB_STEP = 50; // degrees between the selector's positions

const deg = Math.PI / 180;
const knobAngle = (c: Extract<TrayControl, { kind: "knob" }>) => c.turn ?? (c.value - (c.stops - 1) / 2) * KNOB_STEP;

export default function TrayHull({ tray, controls, onReady }: Props) {
  const live = useRef({ controls, onReady });
  live.current = { controls, onReady };
  const sync = useRef<() => void>(() => {});

  useEffect(() => sync.current(), [controls]);

  useEffect(() => {
    const host = tray.current;
    if (!host) return;
    let dead = false;
    let teardown = () => {};

    (async () => {
      const kit = await loadThree();
      const { THREE, RoundedBoxGeometry } = kit;
      await document.fonts?.ready;
      if (dead) return;

      const stage = makeStage(kit);
      if (!stage) {
        live.current.onReady(false);
        return;
      }
      const { renderer, canvas, scene, camera, sun } = stage;
      canvas.className = "tray-canvas";
      host.prepend(canvas);

      // Knurled grip around the selector: fine ridges along its axis, used as a bump map.
      const knurl = (() => {
        const c = document.createElement("canvas");
        c.width = 192;
        c.height = 4;
        const g = c.getContext("2d")!;
        for (let x = 0; x < 192; x += 4) {
          g.fillStyle = "#fff";
          g.fillRect(x, 0, 2, 4);
          g.fillStyle = "#000";
          g.fillRect(x + 2, 0, 2, 4);
        }
        return new THREE.CanvasTexture(c);
      })();

      // The selector's top: aluminium turned on a lathe (concentric streaks) with an orange pointer line.
      const turned = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d")!;
        g.fillStyle = "#c4c4bf";
        g.fillRect(0, 0, 256, 256);
        for (let r = 1; r < 128; r += 0.75) {
          const v = 165 + Math.random() * 80;
          g.strokeStyle = `rgba(${v}, ${v}, ${v}, 0.5)`;
          g.lineWidth = 0.75;
          g.beginPath();
          g.arc(128, 128, r, 0, Math.PI * 2);
          g.stroke();
        }
        g.strokeStyle = "#e0612e";
        g.lineWidth = 11;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(128, 70);
        g.lineTo(128, 18);
        g.stroke();
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      })();

      const mats = {
        floor: new THREE.ShadowMaterial({ opacity: 0.3 }),
        // The shadow floor is transparent, so it's drawn last; this copy only writes depth, first, so the sockets
        // and the bottoms of the keys show only through their holes.
        occluder: new THREE.MeshBasicMaterial({ colorWrite: false }),
        key: new THREE.MeshPhysicalMaterial({ color: 0xefe8d8, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
        blank: new THREE.MeshPhysicalMaterial({ color: 0xdcd3bf, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.5 }),
        bed: new THREE.MeshStandardMaterial({ color: 0x12110e, roughness: 0.9 }),
        // Under the bank keys: the tray's own beige in shadow, so the hairline around a key reads as a seam, not a hole.
        socket: new THREE.MeshStandardMaterial({ color: 0x6b6352, roughness: 0.9 }),
        bezel: new THREE.MeshStandardMaterial({ color: 0x2a2823, metalness: 0.4, roughness: 0.38 }),
        lampOff: new THREE.MeshStandardMaterial({ color: 0x3a372f, roughness: 0.3 }),
        alu: new THREE.MeshStandardMaterial({ color: 0xd8d8d2, metalness: 0.85, roughness: 0.34, bumpMap: knurl, bumpScale: 0.8, envMapIntensity: 1.6 }),
        cap: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.3, map: turned, envMapIntensity: 1.6 }),
        skirt: new THREE.MeshPhysicalMaterial({ color: 0x24231f, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
        ink: new THREE.MeshStandardMaterial({ color: 0x5f584a, roughness: 0.8 }),
      };
      const disposeTree = (o: T.Object3D) => dispose(o, Object.values(mats));

      // Moving parts, which survive rebuilds so nothing snaps mid-travel. x is key travel, slide position (0..1)
      // or knob angle (degrees); lit fades the key's lamp or the slide's indicator.
      type Part = { move: (x: number) => void; lamp?: T.MeshStandardMaterial };
      const springs = new Map<string, { x: number; v: number; lit: number }>();
      let parts = new Map<string, Part>();
      let rig: T.Group | null = null;
      let signature = "";

      const target = (c: TrayControl) => (c.kind === "key" ? TRAVEL[c.state] : c.kind === "slide" ? (c.on ? 1 : 0) : knobAngle(c));
      const lit = (c: TrayControl) => (c.kind === "key" ? !!c.lit : c.kind === "slide" ? c.on : false);

      // Print what the DOM key shows ([data-print] children: badge chips, index, name) onto its face, so the
      // face reads exactly like the HTML key it replaces. (ox, oy) is where the face starts inside the key.
      function printFrom(el: HTMLElement, ox: number, oy: number) {
        return (g: CanvasRenderingContext2D) => {
          const base = el.getBoundingClientRect();
          for (const p of el.querySelectorAll<HTMLElement>("[data-print]")) {
            const r = p.getBoundingClientRect();
            const x = r.left - base.left - ox, y = r.top - base.top - oy;
            const cs = getComputedStyle(p);
            if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") {
              g.fillStyle = "rgba(0, 0, 0, 0.18)";
              g.beginPath();
              g.roundRect(x, y + 0.6, r.width, r.height, parseFloat(cs.borderTopLeftRadius) || 0);
              g.fill();
              g.fillStyle = cs.backgroundColor;
              g.beginPath();
              g.roundRect(x, y, r.width, r.height, parseFloat(cs.borderTopLeftRadius) || 0);
              g.fill();
            }
            const text = p.textContent?.trim();
            if (!text) continue;
            g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            g.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
            g.fillStyle = cs.color;
            g.textBaseline = "middle";
            const centered = cs.justifyContent === "center";
            g.textAlign = centered ? "center" : "left";
            const pad = centered ? 0 : parseFloat(cs.paddingLeft) || 0;
            let t = text;
            if (g.measureText(t).width > r.width - pad + 0.5) {
              while (t.length > 1 && g.measureText(t + "…").width > r.width - pad) t = t.slice(0, -1);
              t += "…";
            }
            g.fillText(t, centered ? x + r.width / 2 : x + pad, y + r.height / 2 + 0.5);
          }
        };
      }

      function build(W: number, H: number, found: Map<string, { r: Rect; el: HTMLElement }>) {
        if (rig) {
          scene.remove(rig);
          disposeTree(rig);
        }
        rig = new THREE.Group();
        parts = new Map();
        const add = (m: T.Mesh, cast = true, receive = true) => {
          m.castShadow = cast;
          m.receiveShadow = receive;
          rig!.add(m);
          return m;
        };
        const at = (o: T.Object3D, x: number, domY: number, z: number) => {
          o.position.set(x, -domY, z);
          return o;
        };

        // The floor only catches shadows over the CSS tray, with holes where keys and slides go down into it.
        const floor = rrPath(new THREE.Shape(), { x: 0, y: 0, w: W, h: H }, 8);
        const bed = (hole: Rect, depth: number, mat: T.Material = mats.bed) => {
          const b = add(new THREE.Mesh(new THREE.BoxGeometry(hole.w + 6, hole.h + 6, 3), mat), false, true);
          at(b, hole.x + hole.w / 2, hole.y + hole.h / 2, -depth - 1.5);
        };

        for (const c of live.current.controls) {
          const f = found.get(c.id);
          if (!f) continue;
          const { r, el } = f;
          if (!springs.has(c.id)) springs.set(c.id, { x: target(c), v: 0, lit: lit(c) ? 1 : 0 });

          if (c.kind === "key") {
            // A bank key: a deep cream cap on a long stroke, rising out of its own socket. The DOM key is where
            // its face projects at rest, so the cap itself sits KEY_OUT·K higher.
            const top = r.y - KEY_OUT * K;
            const hole = { x: r.x - 0.75, y: top - 0.75, w: r.w + 1.5, h: r.h + 1.5 };
            floor.holes.push(rrPath(new THREE.Path(), hole, 5.5));
            bed(hole, 12, mats.socket);
            const group = new THREE.Group();
            at(group, r.x + r.w / 2, top + r.h / 2, KEY_OUT);
            const rad = 5;
            const cap = new THREE.Mesh(new RoundedBoxGeometry(r.w, r.h, KEY_D, 4, rad), c.blank ? mats.blank : mats.key);
            cap.castShadow = cap.receiveShadow = true;
            cap.position.z = -KEY_D / 2;
            group.add(cap);
            const face = new THREE.Mesh(
              new THREE.PlaneGeometry(r.w - 2 * rad, r.h - 2 * rad),
              keyFace(THREE, r.w - 2 * rad, r.h - 2 * rad, { color: c.blank ? 0xdcd3bf : 0xefe8d8, dish: 0.16, paint: printFrom(el, rad, rad) }),
            );
            face.position.z = 0.02;
            face.receiveShadow = true;
            group.add(face);
            const part: Part = { move: (x) => (group.position.z = KEY_OUT - x) };
            // Indicator lamp set into the face, in a dark bezel, where the DOM key has its LED.
            const ledEl = el.querySelector<HTMLElement>("[data-led]");
            if (ledEl) {
              const lr = ledEl.getBoundingClientRect(), kr = el.getBoundingClientRect();
              const lx = lr.left + lr.width / 2 - (kr.left + kr.width / 2), ly = -(lr.top + lr.height / 2 - (kr.top + kr.height / 2));
              const rr = lr.width / 2;
              part.lamp = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x45ff6a, emissiveIntensity: 0, roughness: 0.2 });
              const lamp = new THREE.Mesh(new THREE.SphereGeometry(rr, 16, 8), part.lamp);
              lamp.scale.z = 0.45;
              lamp.position.set(lx, ly, 0.2);
              const ring = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.8, 0.8, 8, 24), mats.bezel);
              ring.position.set(lx, ly, 0.3);
              group.add(lamp, ring);
            }
            rig.add(group);
            parts.set(c.id, part);
          } else if (c.kind === "slide") {
            // Slide switch: a dark slot in the floor, a ribbed cream knob riding in it, a lamp at each end of the
            // slot that the knob uncovers (the left one lights green when on).
            floor.holes.push(rrPath(new THREE.Path(), r, 3));
            bed(r, 5);
            const lamp = new THREE.MeshStandardMaterial({ color: 0x1f2a1f, emissive: 0x45ff6a, emissiveIntensity: 0, roughness: 0.25 });
            for (const [x, m] of [[r.x + 7, lamp], [r.x + r.w - 7, mats.lampOff]] as const) {
              const l = add(new THREE.Mesh(new THREE.SphereGeometry(2.7, 16, 8), m), false, false);
              l.scale.z = 0.5;
              at(l, x, r.y + r.h / 2, -3.2);
            }
            const kw = 20, kh = r.h - 4;
            const knob = new THREE.Group();
            const body = new THREE.Mesh(new RoundedBoxGeometry(kw, kh, SLIDE_OUT + 6, 3, 2), mats.key);
            body.position.z = (SLIDE_OUT - 6) / 2;
            body.castShadow = body.receiveShadow = true;
            knob.add(body);
            for (const rx of [-4, -1.3, 1.3, 4]) {
              const rib = new THREE.Mesh(new THREE.BoxGeometry(0.9, kh - 6, 0.7), mats.key);
              rib.position.set(rx, 0, SLIDE_OUT + 0.2);
              rib.castShadow = true;
              knob.add(rib);
            }
            const y = r.y + r.h / 2 - SLIDE_OUT * K * 0.5;
            const x0 = r.x + 2 + kw / 2, x1 = r.x + r.w - 2 - kw / 2;
            at(knob, x0, y, 0);
            rig.add(knob);
            parts.set(c.id, { move: (t) => (knob.position.x = x0 + (x1 - x0) * t), lamp });
          } else {
            // Rotary selector: a knurled aluminium knob with a lathe-turned top and pointer, on a black skirt,
            // with a printed tick at each position. Its top face projects onto the DOM hit area.
            const R = Math.min(r.w, r.h) / 2 - 6;
            const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - KNOB_H * K;
            for (let i = 0; i < c.stops; i++) {
              const a = (i - (c.stops - 1) / 2) * KNOB_STEP * deg;
              const tick = add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.6, 0.2), mats.ink), false, true);
              at(tick, cx + Math.sin(a) * (R + 8), cy - Math.cos(a) * (R + 8), 0.1);
              tick.rotation.z = -a;
            }
            const knob = new THREE.Group();
            at(knob, cx, cy, 0);
            const cyl = (geo: T.BufferGeometry, mat: T.Material, z: number) => {
              const m = new THREE.Mesh(geo, mat);
              m.rotation.x = Math.PI / 2;
              m.position.z = z;
              m.castShadow = m.receiveShadow = true;
              knob.add(m);
              return m;
            };
            cyl(new THREE.CylinderGeometry(R + 3.5, R + 4.2, 2.4, 64), mats.skirt, 1.2);
            const grip = KNOB_H - 1 - 2.4;
            cyl(new THREE.CylinderGeometry(R, R, grip, 72, 1, true), mats.alu, 2.4 + grip / 2);
            cyl(new THREE.CylinderGeometry(R - 1.2, R, 1, 72), mats.alu, KNOB_H - 0.5);
            const top = new THREE.Mesh(new THREE.CircleGeometry(R - 1.2, 72), mats.cap);
            top.position.z = KNOB_H + 0.01;
            top.receiveShadow = true;
            knob.add(top);
            // White index line on the skirt, under the pointer.
            const index = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 0.4), new THREE.MeshStandardMaterial({ color: 0xece6d7, roughness: 0.5 }));
            index.position.set(0, R + 2, 2.5);
            knob.add(index);
            rig.add(knob);
            parts.set(c.id, { move: (a) => (knob.rotation.z = -a * deg) });
          }
        }

        const floorGeo = new THREE.ShapeGeometry(floor, 12);
        add(new THREE.Mesh(floorGeo, mats.floor), false, true);
        const occluder = new THREE.Mesh(floorGeo.clone(), mats.occluder);
        occluder.renderOrder = -1;
        rig.add(occluder);
        scene.add(rig);

        frameCamera(THREE, camera, sun, W, 0, -H);
        renderer.setSize(W, H);
      }

      // Keys on a stiff, slightly bouncy spring; slides snap over with a little overshoot; the knob swings into
      // its detent. Lamps ease on and off.
      const feel = { key: [2600, 62, 0.01], slide: [1500, 50, 0.001], knob: [900, 42, 0.05] } as const;
      let raf = 0;
      let last = 0;
      function frame(now: number) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        let busy = false;
        for (const c of live.current.controls) {
          const s = springs.get(c.id);
          const part = parts.get(c.id);
          if (!s || !part) continue;
          const goal = target(c);
          const [stiff, damp, eps] = feel[c.kind];
          for (let i = 0; i < 2; i++) {
            const a = stiff * (goal - s.x) - damp * s.v;
            s.v += a * (dt / 2);
            s.x += s.v * (dt / 2);
          }
          if (Math.abs(goal - s.x) > eps || Math.abs(s.v) > eps * 5) busy = true;
          else {
            s.x = goal;
            s.v = 0;
          }
          const on = lit(c) ? 1 : 0;
          s.lit += (on - s.lit) * Math.min(1, dt * 14);
          if (Math.abs(on - s.lit) > 0.005) busy = true;
          part.move(s.x);
          if (part.lamp) part.lamp.emissiveIntensity = s.lit * (c.kind === "key" ? 2.6 : 2);
        }
        renderer.render(scene, camera);
        raf = busy ? requestAnimationFrame(frame) : 0;
      }
      function kick() {
        if (raf || !rig) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }

      // Rebuild when the tray's layout or anything printed on a key changes.
      function measure() {
        const b = host!.getBoundingClientRect();
        if (b.width < 10) return;
        const found = new Map<string, { r: Rect; el: HTMLElement }>();
        const print: string[] = [];
        for (const el of host!.querySelectorAll<HTMLElement>("[data-key]")) {
          const r = el.getBoundingClientRect();
          found.set(el.dataset.key!, { r: { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }, el });
          for (const p of el.querySelectorAll<HTMLElement>("[data-print]")) print.push(p.textContent ?? "", getComputedStyle(p).backgroundColor);
        }
        const sig = JSON.stringify([b.width, b.height, [...found].map(([id, f]) => [id, f.r]), print]);
        if (sig === signature) return;
        signature = sig;
        build(b.width, b.height, found);
      }

      let pending = 0;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => {
          measure();
          kick();
        });
      });
      ro.observe(host);

      sync.current = () => {
        measure();
        kick();
      };

      // The tray switches to its 3D layout once ready; measure after that has rendered.
      live.current.onReady(true);
      pending = requestAnimationFrame(() => {
        measure();
        kick();
      });

      teardown = () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(pending);
        ro.disconnect();
        sync.current = () => {};
        if (rig) disposeTree(rig);
        for (const m of Object.values(mats)) m.dispose();
        knurl.dispose();
        turned.dispose();
        scene.environment?.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      dead = true;
      teardown();
    };
  }, [tray]);

  return null;
}
