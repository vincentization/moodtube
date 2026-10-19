"use client";

import { useEffect, useRef } from "react";
import type * as T from "three";
import { disposeTree as dispose, frame as frameCamera, grainTexture, K, keyFace, LABEL_SCALE, loadThree, makeStage, rrPath, type Rect } from "@/lib/hull3d";

export type KeyGlyph = "prev" | "play" | "pause" | "next" | "led";
export type KeyState = "up" | "latched" | "down";
// A key is a push key unless `toggle` is set: then it's a bat-handle toggle switch, up when `lit`.
export type HullKey = { id: string; glyph: KeyGlyph; word: string; amber?: boolean; led?: boolean; toggle?: boolean; lit?: boolean; state: KeyState };

type Props = {
  bezel: React.RefObject<HTMLDivElement | null>;
  keys: HullKey[];
  power: boolean;
  onReady: (ok: boolean) => void;
};

// Units are CSS pixels: world x/y match the bezel's box (y flipped), +z points at the viewer.
// The camera is orthographic with an oblique shear, so everything in a z plane maps 1:1 onto the DOM
// (the tube glass at z = 0 lines up exactly with the iframe underneath) while depth shows as a downward shift,
// as if the set is seen from slightly above: the cabinet top peeks out and key travel is visible.
// Canvas overhang above and below the bezel box for the cabinet top and the keys' shift; the shear is purely vertical,
// so nothing needs room at the sides (which would also make the scrolling column scroll sideways).
const PAD = 40;
const FACE = 10; // bezel front face; the glass sits recessed at z = 0
const BODY = 70; // cabinet depth behind the bezel
const MASK = 12; // width of the sloped mask between the bezel face and the glass
// Keys in the manner of a Braun TG 60: square plastic keys with a dished face, packed into a slot in an
// slot in the bezel, pushed straight in. Legends are printed on the bezel underneath, which is one plain surface.
const PLATE = 0; // legends and the switch sit straight on the bezel face
const KEY_OUT = 24; // how far a key at rest stands proud of the bezel face
const KEY_D = 34;
const TRAVEL: Record<KeyState, number> = { up: 0, latched: 13, down: 21 };
// Toggle lever angle from straight out (radians, positive = down): up when on, down when off, held part-way
// toward centre while pressed. Up is thrown further because seen from above a raised lever foreshortens.
const LEVER_ON = -0.85;
const LEVER_OFF = 0.45;

export default function CrtHull({ bezel, keys, power, onReady }: Props) {
  const live = useRef({ keys, power, onReady });
  live.current = { keys, power, onReady };
  const sync = useRef<() => void>(() => {});

  useEffect(() => sync.current(), [keys, power]);

  useEffect(() => {
    const host = bezel.current;
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
      canvas.className = "crt-canvas";
      canvas.style.left = "0";
      canvas.style.top = `${-PAD}px`;
      host.appendChild(canvas);

      const grain = grainTexture(THREE);

      const mats = {
        hull: new THREE.MeshPhysicalMaterial({ color: 0x24251f, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, bumpMap: grain, bumpScale: 0.35 }),
        body: new THREE.MeshPhysicalMaterial({ color: 0x1f201b, roughness: 0.6, bumpMap: grain, bumpScale: 0.3 }),
        mask: new THREE.MeshStandardMaterial({ color: 0x141512, roughness: 0.78, side: THREE.DoubleSide, emissive: 0x9fb4c8, emissiveIntensity: 0 }),
        bed: new THREE.MeshStandardMaterial({ color: 0x0f0f0d, roughness: 0.9 }),
        vent: new THREE.MeshStandardMaterial({ color: 0x0b0b09, roughness: 0.95 }),
        screw: new THREE.MeshStandardMaterial({ color: 0x9a968b, metalness: 0.85, roughness: 0.32 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.22, envMapIntensity: 2.4 }),
        key: new THREE.MeshPhysicalMaterial({ color: 0xe9e8e3, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
        glass: new THREE.MeshBasicMaterial({ colorWrite: false }),
      };

      const family = getComputedStyle(host).fontFamily || "sans-serif";

      // Per-key moving parts survive rebuilds so a key mid-travel doesn't snap.
      type KeyRig = { group: T.Group; legend: T.CanvasTexture; legendCanvas: HTMLCanvasElement; glyph: KeyGlyph | null; led?: T.MeshStandardMaterial; lever?: T.Group; size: { w: number; h: number } };
      const toggleAngle = (key: HullKey) => (key.lit ? LEVER_ON : LEVER_OFF) * (key.state === "down" ? 0.35 : 1);
      const springs = new Map<string, { x: number; v: number; lit: number }>();
      let rigs = new Map<string, KeyRig>();
      let powerLed: T.MeshStandardMaterial | null = null;
      let glow = live.current.power ? 1 : 0;
      let rig: T.Group | null = null;
      let signature = "";

      // Points around a rounded rect, a fixed count per corner so two of them can be lofted together.
      function rrLoop({ x, y, w, h }: Rect, r: number, n = 10) {
        const pts: [number, number][] = [];
        const corners: [number, number, number][] = [
          [x + w - r, -(y + r), Math.PI / 2],
          [x + w - r, -(y + h - r), 0],
          [x + r, -(y + h - r), -Math.PI / 2],
          [x + r, -(y + r), -Math.PI],
        ];
        for (const [cx, cy, a0] of corners)
          for (let i = 0; i <= n; i++) {
            const a = a0 - (i / n) * (Math.PI / 2);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
        return pts;
      }

      // The sloped inner mask from the bezel opening down to the edge of the glass, like a moulded CRT surround.
      function loft(outer: [number, number][], zo: number, inner: [number, number][], zi: number) {
        const pos: number[] = [];
        for (const [px, py] of outer) pos.push(px, py, zo);
        for (const [px, py] of inner) pos.push(px, py, zi);
        const n = outer.length;
        const idx: number[] = [];
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          idx.push(i, n + i, j, j, n + i, n + j);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      }

      // Legend printed on the bezel under a key, lowercase like Braun's, with the transport arrows beside the word.
      function drawLabel(rig: KeyRig, key: HullKey) {
        const { w } = rig.size;
        const h = 12;
        const c = rig.legendCanvas;
        c.width = Math.round(w * LABEL_SCALE);
        c.height = Math.round(h * LABEL_SCALE);
        const g = c.getContext("2d")!;
        g.scale(LABEL_SCALE, LABEL_SCALE);
        g.clearRect(0, 0, w, h);
        const text = { prev: "◂◂ prev", next: "next ▸▸", play: "play", pause: "pause", led: "comments" }[key.glyph];
        g.font = `500 9px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        g.fillStyle = "#a9a598";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, w / 2, h / 2);
        rig.legend.needsUpdate = true;
        rig.glyph = key.glyph;
      }

      const disposeTree = (o: T.Object3D) => dispose(o, Object.values(mats));

      function build(W: number, H: number, screen: Rect, keyRects: Map<string, Rect>) {
        if (rig) {
          scene.remove(rig);
          disposeTree(rig);
        }
        rig = new THREE.Group();
        rigs = new Map();
        const add = (m: T.Mesh, cast = true, receive = true) => {
          m.castShadow = cast;
          m.receiveShadow = receive;
          rig!.add(m);
          return m;
        };

        // Bezel: an extruded plate with rounded edges, open over the tube and over the keybed.
        const B = 2.5, BT = 3, FD = 12;
        const outline = rrPath(new THREE.Shape(), { x: B, y: B, w: W - 2 * B, h: H - 2 * B }, 16 - B);
        const sr = 20;
        const opening: Rect = { x: screen.x - MASK, y: screen.y - MASK, w: screen.w + 2 * MASK, h: screen.h + 2 * MASK };
        outline.holes.push(rrPath(new THREE.Path(), opening, sr + MASK));
        // Each DOM button (the hit target) is exactly where a key's face projects at rest.
        const keyTop = (r: Rect) => r.y - (FACE + KEY_OUT) * K;
        const toggles = new Set(live.current.keys.filter((k) => k.toggle).map((k) => k.id));
        const rects = [...keyRects].filter(([id]) => !toggles.has(id)).map(([, r]) => r);
        let cluster: Rect | null = null;
        if (rects.length) {
          const l = Math.min(...rects.map((r) => r.x)) - 2;
          const r = Math.max(...rects.map((r) => r.x + r.w)) + 2;
          const t = Math.min(...rects.map(keyTop)) - 2;
          const b = Math.max(...rects.map((r) => keyTop(r) + r.h)) + 2;
          cluster = { x: l, y: t, w: r - l, h: b - t };
          outline.holes.push(rrPath(new THREE.Path(), { x: l - 2 - B, y: t - 2 - B, w: r - l + 4 + 2 * B, h: b - t + 4 + 2 * B }, 3));
          // Dark keybed floor visible in the gaps between the keys.
          const bed = add(new THREE.Mesh(new THREE.BoxGeometry(r - l + 8, b - t + 8, 4), mats.bed), false, true);
          bed.position.set((l + r) / 2, -(t + b) / 2, FACE - 13);
        }
        const plate = new THREE.ExtrudeGeometry(outline, { depth: FD, bevelEnabled: true, bevelThickness: BT, bevelSize: B, bevelSegments: 4, curveSegments: 14 });
        plate.translate(0, 0, FACE - FD - BT);
        add(new THREE.Mesh(plate, mats.hull));

        // Sloped mask from the opening down to the glass, and an invisible glass that only writes depth,
        // so nothing behind it is drawn and the video shows through the transparent canvas.
        add(new THREE.Mesh(loft(rrLoop({ x: opening.x + 1.5, y: opening.y + 1.5, w: opening.w - 3, h: opening.h - 3 }, sr + MASK - 1.5), FACE - 0.5, rrLoop(screen, sr), 0), mats.mask), false, true);
        const glass = new THREE.Mesh(new THREE.ShapeGeometry(rrPath(new THREE.Shape(), screen, sr), 14), mats.glass);
        glass.position.z = -0.05;
        glass.renderOrder = -1;
        rig.add(glass);

        // Cabinet behind the bezel; its top shows above the bezel with a row of cooling slots.
        const inset = 7;
        const bodyDepth = BODY + FACE - 12;
        const body = add(new THREE.Mesh(new RoundedBoxGeometry(W - 2 * inset, H - 2 * inset, bodyDepth, 4, 10), mats.body), true, true);
        body.position.set(W / 2, -H / 2, FACE - 12 - bodyDepth / 2);
        const slots = Math.max(4, Math.floor((W * 0.5) / 14));
        for (let i = 0; i < slots; i++) {
          const v = add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, BODY * 0.5), mats.vent), false, false);
          v.position.set(W / 2 + (i - (slots - 1) / 2) * 14, -inset + 0.05, -BODY * 0.45);
        }

        // Corner screws with randomly turned slots.
        for (const [sx, sy] of [[12, 12], [W - 12, 12]]) {
          const head = add(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 1.6, 24), mats.screw));
          head.rotation.x = Math.PI / 2;
          head.position.set(sx, -(sy - FACE * K), FACE + 0.6);
          const slot = add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 1, 1), mats.bed), false, false);
          slot.position.set(sx, -(sy - FACE * K), FACE + 1.1);
          slot.rotation.z = Math.random() * Math.PI;
        }

        powerLed = new THREE.MeshStandardMaterial({ color: 0x3a0c08, emissive: 0xff2a10, emissiveIntensity: 0.6, roughness: 0.25 });

        // Keys.
        const onPlate = (x: number, domY: number, z: number) => new THREE.Vector3(x, -(domY - (FACE + PLATE) * K), FACE + PLATE + z);
        const legendFor = (r: Rect, w: number) => {
          const legendCanvas = document.createElement("canvas");
          const legend = new THREE.CanvasTexture(legendCanvas);
          legend.colorSpace = THREE.SRGBColorSpace;
          legend.anisotropy = 4;
          const legendMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, 12),
            new THREE.MeshStandardMaterial({ map: legend, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
          );
          legendMesh.position.copy(onPlate(r.x + r.w / 2, r.y + r.h + 8, 0.05));
          rig!.add(legendMesh);
          return { legend, legendCanvas };
        };
        for (const key of live.current.keys) {
          const r = keyRects.get(key.id);
          if (!r || !key.toggle) continue;
          // Bat-handle toggle: washer, hex nut and bushing on the plate, a chrome lever pivoting in the bushing.
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 6;
          const part = (geo: T.BufferGeometry, z: number) => {
            const m = add(new THREE.Mesh(geo, mats.chrome));
            m.rotation.x = Math.PI / 2;
            m.position.copy(onPlate(cx, cy, z));
            return m;
          };
          part(new THREE.CylinderGeometry(10.5, 10.5, 1.2, 40), 0.6);
          part(new THREE.CylinderGeometry(8, 8, 3.4, 6), 2.9).rotation.y = Math.PI / 6;
          part(new THREE.CylinderGeometry(5, 5, 5.5, 28), 7.35);
          const lever = new THREE.Group();
          lever.position.copy(onPlate(cx, cy, 9.6));
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.2, 20, 22).rotateX(Math.PI / 2).translate(0, 0, 10), mats.chrome);
          const bat = new THREE.Mesh(new THREE.SphereGeometry(3.9, 24, 14), mats.chrome);
          bat.scale.set(1, 1, 1.4);
          bat.position.z = 20.5;
          for (const m of [stem, bat]) {
            m.castShadow = true;
            lever.add(m);
          }
          rig.add(lever);
          const { legend, legendCanvas } = legendFor(r, r.w + 20);
          const kr: KeyRig = { group: lever, legend, legendCanvas, glyph: null, lever, size: { w: r.w + 20, h: r.h } };
          drawLabel(kr, key);
          rigs.set(key.id, kr);
          if (!springs.has(key.id)) springs.set(key.id, { x: toggleAngle(key), v: 0, lit: key.lit ? 1 : 0 });
          // Power lamp just left of the switch.
          const lampAt = onPlate(r.x - 12, cy, 0.8);
          const lamp = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.6, 20), powerLed), false, false);
          lamp.rotation.x = Math.PI / 2;
          lamp.position.copy(lampAt);
          const ring = add(new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.9, 10, 24), mats.chrome), false, false);
          ring.position.copy(lampAt);
        }
        for (const key of live.current.keys) {
          const r = keyRects.get(key.id);
          if (!r || key.toggle) continue;
          const group = new THREE.Group();
          group.position.set(r.x + r.w / 2, -(keyTop(r) + r.h / 2), FACE + KEY_OUT);
          const rad = 3.5;
          const cap = new THREE.Mesh(new RoundedBoxGeometry(r.w, r.h, KEY_D, 4, rad), mats.key);
          cap.castShadow = cap.receiveShadow = true;
          cap.position.z = -KEY_D / 2;
          group.add(cap);
          const face = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 2 * rad, r.h - 2 * rad), keyFace(THREE, r.w - 2 * rad, r.h - 2 * rad, { dot: key.amber ? "#e0612e" : null }));
          face.position.z = 0.02;
          face.receiveShadow = true;
          group.add(face);
          const { legend, legendCanvas } = legendFor(r, r.w + 4);
          const kr: KeyRig = { group, legend, legendCanvas, glyph: null, size: { w: r.w + 4, h: r.h } };
          if (key.led) {
            kr.led = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x45ff6a, emissiveIntensity: 0, roughness: 0.2 });
            const led = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 8), kr.led);
            led.scale.z = 0.4;
            group.add(led);
          }
          drawLabel(kr, key);
          rig.add(group);
          rigs.set(key.id, kr);
          if (!springs.has(key.id)) springs.set(key.id, { x: TRAVEL[key.state], v: 0, lit: key.lit ? 1 : 0 });
        }

        scene.add(rig);

        // Camera framing the bezel box plus the overhang, then the oblique shear.
        frameCamera(THREE, camera, sun, W, PAD, -(H + PAD));

        renderer.setSize(W, H + 2 * PAD);
      }

      // Moving parts: key travel on a slightly bouncy spring, LED and tube glow easing in.
      let raf = 0;
      let last = 0;
      function frame(now: number) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        let busy = false;
        const { keys, power } = live.current;
        for (const key of keys) {
          const s = springs.get(key.id);
          const kr = rigs.get(key.id);
          if (!s || !kr) continue;
          const target = kr.lever ? toggleAngle(key) : TRAVEL[key.state];
          // Toggles snap over hard with a little overshoot; keys are stiff with a short bounce.
          const [stiff, damp] = kr.lever ? [1800, 38] : [2600, 62];
          for (let i = 0; i < 2; i++) {
            const a = stiff * (target - s.x) - damp * s.v;
            s.v += a * (dt / 2);
            s.x += s.v * (dt / 2);
          }
          const eps = kr.lever ? 0.001 : 0.01;
          if (Math.abs(target - s.x) > eps || Math.abs(s.v) > eps * 5) busy = true;
          else {
            s.x = target;
            s.v = 0;
          }
          s.lit += ((key.lit ? 1 : 0) - s.lit) * Math.min(1, dt * 14);
          if (Math.abs((key.lit ? 1 : 0) - s.lit) > 0.005) busy = true;
          if (kr.lever) kr.lever.rotation.x = s.x;
          else kr.group.position.z = FACE + KEY_OUT - s.x;
          if (kr.led) kr.led.emissiveIntensity = s.lit * 2.6;
        }
        glow += ((power ? 1 : 0) - glow) * Math.min(1, dt * 6);
        if (Math.abs((power ? 1 : 0) - glow) > 0.005) busy = true;
        mats.mask.emissiveIntensity = glow * 0.05;
        if (powerLed) {
          powerLed.emissive.setHex(power ? 0x3cff5a : 0xff2a10);
          powerLed.emissiveIntensity = power ? 1.6 : 0.7;
        }
        renderer.render(scene, camera);
        raf = busy ? requestAnimationFrame(frame) : 0;
      }
      function kick() {
        if (raf || !rig) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }

      function measure() {
        const b = host!.getBoundingClientRect();
        const screenEl = host!.querySelector<HTMLElement>(".screen");
        if (!screenEl || b.width < 10) return;
        const rel = (el: Element): Rect => {
          const r = el.getBoundingClientRect();
          return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
        };
        const screen = rel(screenEl);
        const keyRects = new Map<string, Rect>();
        for (const el of host!.querySelectorAll<HTMLElement>("[data-key]")) keyRects.set(el.dataset.key!, rel(el));
        const sig = JSON.stringify([b.width, b.height, screen, [...keyRects]]);
        if (sig === signature) return;
        signature = sig;
        build(b.width, b.height, screen, keyRects);
        kick();
      }

      let pending = 0;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(measure);
      });
      ro.observe(host);
      const screenEl = host.querySelector(".screen");
      if (screenEl) ro.observe(screenEl);

      sync.current = () => {
        for (const key of live.current.keys) {
          const kr = rigs.get(key.id);
          if (kr && kr.glyph !== key.glyph) drawLabel(kr, key);
        }
        kick();
      };

      measure();
      live.current.onReady(true);

      teardown = () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(pending);
        ro.disconnect();
        sync.current = () => {};
        if (rig) disposeTree(rig);
        for (const m of Object.values(mats)) m.dispose();
        grain.dispose();
        scene.environment?.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      dead = true;
      teardown();
    };
  }, [bezel]);

  return null;
}
