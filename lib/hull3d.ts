// Shared pieces of the Three.js hardware (CRT hull and control tray): the oblique "seen from slightly above"
// stage, rounded-rect outlines, the moulded-plastic texture and the dished key face.
// Three is imported dynamically by the components, so everything here takes it as a parameter.

import type * as T from "three";

export type Three = typeof import("three");
export type Rect = { x: number; y: number; w: number; h: number };

// px of downward shift per unit toward the viewer; see CrtHull for the projection.
export const K = 0.32;
export const LABEL_SCALE = 4;

export async function loadThree() {
  const THREE = await import("three");
  const { RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  return { THREE, RoundedBoxGeometry, RoomEnvironment };
}

// Transparent renderer, a dim room for reflections, and a warm key light from the upper left that casts the shadows.
// Null when WebGL isn't available.
export function makeStage({ THREE, RoomEnvironment }: Awaited<ReturnType<typeof loadThree>>) {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.4;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 0, 1000);
  camera.near = 1;
  camera.far = 3000;

  const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x1c1b16, 0.7));

  return { renderer, canvas, scene, camera, sun };
}

// Frame a W-wide box from y = top down to y = bottom (world units, y up) with the oblique shear, and aim the
// sun's shadow camera so it covers the whole box.
export function frame(THREE: Three, camera: T.OrthographicCamera, sun: T.DirectionalLight, W: number, top: number, bottom: number) {
  camera.left = 0;
  camera.right = W;
  camera.top = top;
  camera.bottom = bottom;
  camera.updateProjectionMatrix();
  const shear = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, -K, -K * camera.position.z, 0, 0, 1, 0, 0, 0, 0, 1);
  camera.projectionMatrix.multiply(shear);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  const H = top - bottom;
  const cy = (top + bottom) / 2;
  const span = Math.max(W, H) * 0.75 + 80;
  sun.position.set(W / 2 - 600, cy + 900, 1100);
  sun.target.position.set(W / 2, cy, 0);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 4000 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.needsUpdate = true;
}

// A rounded rect in DOM coordinates (y down) traced into a Three path (y up).
export function rrPath<P extends T.Path>(p: P, { x, y, w, h }: Rect, r: number) {
  const t = -y, b = -(y + h), l = x, rt = x + w;
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(l + r, t);
  p.lineTo(rt - r, t);
  p.absarc(rt - r, t - r, r, Math.PI / 2, 0, true);
  p.lineTo(rt, b + r);
  p.absarc(rt - r, b + r, r, 0, -Math.PI / 2, true);
  p.lineTo(l + r, b);
  p.absarc(l + r, b + r, r, -Math.PI / 2, -Math.PI, true);
  p.lineTo(l, t - r);
  p.absarc(l + r, t - r, r, Math.PI, Math.PI / 2, true);
  return p;
}

// Fine moulded-plastic grain, sampled in world pixels through an extrusion's planar UVs.
export function grainTexture(THREE: Three) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 64, 1 / 64);
  return t;
}

type FaceOptions = {
  color?: number;
  dish?: number; // slope of the bowl at its rim
  dot?: string | null; // coloured dot printed in the middle
  paint?: (g: CanvasRenderingContext2D) => void; // print on the face, in face pixels
};

// Face of a key: a shallow spherical dish, done as a normal map so it shades with the light, plus whatever is
// printed on it (the TG 60's record key has a red dot; the tray's keys carry their badge and name).
export function keyFace(THREE: Three, w: number, h: number, { color = 0xe9e8e3, dish = 0.32, dot = null, paint }: FaceOptions = {}) {
  const cw = Math.round(w * LABEL_SCALE), ch = Math.round(h * LABEL_SCALE);
  const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) * 0.44;
  const n = document.createElement("canvas");
  n.width = cw;
  n.height = ch;
  const ng = n.getContext("2d")!;
  const img = ng.createImageData(cw, ch);
  for (let py = 0; py < ch; py++)
    for (let px = 0; px < cw; px++) {
      const dx = (px - cx) / R, dy = (cy - py) / R;
      const r = Math.hypot(dx, dy);
      // Concave bowl: slope grows toward the rim, then a soft lip back to the flat face.
      const k = r < 1 ? dish * Math.min(1, (1 - r) * 12) : 0;
      const nx = -dx * k, ny = -dy * k;
      const len = Math.hypot(nx, ny, 1);
      const i = (py * cw + px) * 4;
      img.data[i] = (nx / len) * 127.5 + 127.5;
      img.data[i + 1] = (ny / len) * 127.5 + 127.5;
      img.data[i + 2] = (1 / len) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  ng.putImageData(img, 0, 0);
  const normalMap = new THREE.CanvasTexture(n);
  const m = document.createElement("canvas");
  m.width = cw;
  m.height = ch;
  const mg = m.getContext("2d")!;
  mg.fillStyle = "#fff";
  mg.fillRect(0, 0, cw, ch);
  if (dot) {
    mg.fillStyle = dot;
    mg.beginPath();
    mg.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
    mg.fill();
  }
  if (paint) {
    mg.save();
    mg.scale(LABEL_SCALE, LABEL_SCALE);
    paint(mg);
    mg.restore();
  }
  const map = new THREE.CanvasTexture(m);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshPhysicalMaterial({ color, map, normalMap, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
}

// Dispose a rebuilt rig's geometry and its own materials and textures, leaving the shared ones alone.
export function disposeTree(o: T.Object3D, shared: object[]) {
  o.traverse((n) => {
    const m = n as T.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (shared.includes(mat)) continue;
      const s = mat as T.MeshStandardMaterial;
      s.map?.dispose();
      s.normalMap?.dispose();
      s.bumpMap?.dispose();
      mat.dispose();
    }
  });
}
