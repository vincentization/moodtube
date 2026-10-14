// Synthesized mechanical sounds for the CRT's Braun-style keys. Everything is built from filtered noise bursts
// (plastic clacks, contact ticks), pitch-dropping sines (the key body bottoming out) and decaying partials
// (the latch spring), so there are no audio files to load. The context is created on the first key press,
// which is a user gesture, so browsers allow it to start.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// ±amount random spread so repeated presses don't sound machine-identical.
const vary = (v: number, amount = 0.08) => v * (1 + (Math.random() * 2 - 1) * amount);

type Burst = { freq: number; q?: number; gain: number; decay: number; type?: BiquadFilterType };

// A short shaped noise burst through a filter: the click/clack of plastic and metal contacts.
function burst(c: AudioContext, t: number, { freq, q = 1, gain, decay, type = "bandpass" }: Burst) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = vary(1, 0.2);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = vary(freq);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vary(gain, 0.12), t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(out!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
}

type Tone = { from: number; to?: number; gain: number; decay: number; type?: OscillatorType };

// A decaying tone, optionally sliding in pitch: the hollow body thump of the key hitting its stop.
function tone(c: AudioContext, t: number, { from, to = from, gain, decay, type = "sine" }: Tone) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(vary(from, 0.05), t);
  o.frequency.exponentialRampToValueAtTime(vary(to, 0.05), t + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vary(gain, 0.1), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(out!);
  o.start(t);
  o.stop(t + decay + 0.02);
}

export type KeyKind = "momentary" | "latch" | "toggle";

// Braun-style key pushed in: a crisp, bright plastic click as the switch snaps over, a tiny snap of the
// contact spring right after, and only a little body; these keys are light and short-throw.
export function keyDown(kind: KeyKind) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  // A toggle only creaks against its spring until it snaps over on release.
  if (kind === "toggle") {
    burst(c, t, { freq: 2600, q: 1.5, gain: 0.08, decay: 0.03 });
    return;
  }
  burst(c, t, { freq: 3600, q: 3, gain: 0.75, decay: 0.009 });
  burst(c, t, { freq: 8000, type: "highpass", gain: 0.3, decay: 0.004 });
  burst(c, t + 0.006, { freq: 6000, q: 5, gain: 0.3, decay: 0.005 });
  tone(c, t, { from: kind === "latch" ? 260 : 320, to: 180, gain: 0.18, decay: 0.025 });
}

// Key let go: the spring returns it with a lighter, higher click against the top stop.
export function keyUp() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t + 0.012, { freq: 4400, q: 3, gain: 0.4, decay: 0.006 });
  burst(c, t + 0.012, { freq: 9000, type: "highpass", gain: 0.12, decay: 0.003 });
}

// Latching key caught at the bottom: a second, sharper metallic click from the catch.
export function latch() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t + 0.01, { freq: 5200, q: 8, gain: 0.5, decay: 0.008 });
  burst(c, t + 0.018, { freq: 2800, q: 3, gain: 0.25, decay: 0.01 });
}

// Latched key released: catch clicks open, then the key snaps back up with a bright clack.
export function unlatch() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t + 0.004, { freq: 5600, q: 7, gain: 0.35, decay: 0.006 });
  tone(c, t + 0.006, { from: 2400, to: 2300, gain: 0.025, decay: 0.05, type: "triangle" });
  burst(c, t + 0.026, { freq: 3800, q: 2.5, gain: 0.6, decay: 0.01 });
  tone(c, t + 0.026, { from: 300, to: 200, gain: 0.12, decay: 0.02 });
}

// Toggle switch snapping over centre: a hard, bright "tchk" from the over-centre spring hitting its stop,
// a little lower when flipped off.
export function toggle(on: boolean) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const f = on ? 1 : 0.85;
  burst(c, t, { freq: 4800 * f, q: 4, gain: 0.85, decay: 0.007 });
  burst(c, t, { freq: 9000, type: "highpass", gain: 0.3, decay: 0.003 });
  burst(c, t + 0.003, { freq: 2100 * f, q: 1.5, gain: 0.4, decay: 0.016 });
  tone(c, t + 0.002, { from: 950 * f, to: 760 * f, gain: 0.06, decay: 0.035, type: "triangle" });
}

// Tube warming up: relay clunk, a short degauss hum and a fizz of static as the beam comes on.
export function powerOn() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t, { freq: 700, type: "lowpass", gain: 0.5, decay: 0.05 });
  tone(c, t, { from: 75, to: 55, gain: 0.3, decay: 0.12 });
  tone(c, t + 0.02, { from: 60, gain: 0.12, decay: 0.7, type: "sawtooth" });
  tone(c, t + 0.02, { from: 120, gain: 0.05, decay: 0.5 });
  burst(c, t + 0.06, { freq: 3500, type: "highpass", gain: 0.06, decay: 0.45 });
}
