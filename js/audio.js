// Audio espacial: clips reales de Xeno-canto (species.clip) con PannerNode, y un canto sintetizado
// de respaldo para especies sin grabación (p. ej. la Turca). El AudioContext se crea con el primer
// clic (PRESS START), porque los navegadores bloquean el sonido hasta que hay interacción.
import { AUDIO_BASE } from './data.js';

let ac = null;
let master = null;
const buffers = new Map();

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
  }
  ac.resume();
  return ac;
}
export const audioReady = () => !!ac && ac.state === 'running';
export function setMuted(m) { if (master) master.gain.value = m ? 0 : 0.9; }

export async function loadClip(src) {
  if (!ac || !src) return null;
  if (buffers.has(src)) return buffers.get(src);
  const p = fetch(AUDIO_BASE + src).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).catch(() => null);
  buffers.set(src, p);
  return p;
}

function panner(pos) {
  const p = ac.createPanner();
  p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
  p.refDistance = 5; p.rolloffFactor = 1.1; p.maxDistance = 80;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
  else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(master);
  return p;
}

export function setListener(pos, forward) {
  if (!ac) return;
  const L = ac.listener;
  if (L.positionX) {
    L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
    L.forwardX.value = forward.x; L.forwardY.value = forward.y; L.forwardZ.value = forward.z;
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else {
    L.setPosition(pos.x, pos.y, pos.z);
    L.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
  }
}

// Reproduce un buffer en la posición dada. Devuelve la duración (s) o 0.
export function playAt(buffer, pos, gain = 1) {
  if (!audioReady() || !buffer) return 0;
  const src = ac.createBufferSource(); src.buffer = buffer;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(g); g.connect(panner(pos));
  src.start();
  return buffer.duration;
}

// Canto sintético de respaldo: serie de notas graves descendentes (tipo "hu-hu-hu-huuu").
export function playSynth(pos, seed = 1) {
  if (!audioReady()) return 0;
  const t0 = ac.currentTime + 0.03;
  const out = ac.createGain(); out.gain.value = 0.35; out.connect(panner(pos));
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(out);
  const n = 5 + (seed % 3);
  let t = t0;
  for (let i = 0; i < n; i++) {
    const d = i === n - 1 ? 0.35 : 0.13;
    const o = ac.createOscillator(); o.type = 'triangle';
    const f = 620 - i * 28;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.86, t + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + d + 0.02);
    t += d + 0.09;
  }
  return t - t0;
}

// Pequeño efecto de interfaz (8 bits).
export function blip(f = 880, d = 0.06) {
  if (!audioReady()) return;
  const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = ac.createGain(); g.gain.value = 0.05;
  o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + d);
}
