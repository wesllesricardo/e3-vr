// =============================================================================
// Áudio: trilha generativa (fria no escuro, quente na luz), efeitos espaciais
// (vêm da direção de cada objeto), narração com "ducking" e som dos vídeos.
// Tudo sintetizado na hora, sem arquivos de música com direitos autorais.
// =============================================================================
import { THREE, camera } from './motor.js';

let listener = null, ctx = null;
const bus = {};
let noiseBuf = null, padFrio = null, padLuz = null, humor = 'nenhum', proxNota = 0, proxTick = 0;
let narrando = false, tokenVoz = 0, fonteVoz = null;
const buffers = {};
let manifesto = {};

export const audio = {
  pronto: false,
  narracaoAtiva: true,
  relogio: null,          // Vector3 (mundo) de onde vem o tique-taque no lado sombrio
  fonteChamado: null,     // Vector3 (mundo) de onde vem o chamado "vire-se"
};

function ganho(dest, v) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
function rampa(param, alvo, seg) {
  const t = ctx.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(alvo, t + seg);
}

export function iniciarAudio() {
  if (listener) { ctx.resume(); return; }
  listener = new THREE.AudioListener();
  camera.add(listener);
  ctx = listener.context;
  const out = listener.getInput();
  bus.master = ganho(out, 1);
  bus.musica = ganho(bus.master, 0.0);
  bus.sfx = ganho(bus.master, 0.9);
  bus.voz = ganho(bus.master, 1.0);
  bus.video = ganho(bus.master, 1.0);
  // eco suave para a trilha
  const eco = ctx.createDelay(1.0), fb = ctx.createGain(), mix = ctx.createGain();
  eco.delayTime.value = 0.36; fb.gain.value = 0.32; mix.gain.value = 0.35;
  bus.eco = ctx.createGain();
  bus.eco.connect(eco); eco.connect(fb); fb.connect(eco); eco.connect(mix); mix.connect(bus.musica);
  bus.eco.connect(bus.musica);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  padFrio = pad([55, 82.41, 110.0, 155.56], 'sawtooth', 340, 0.5, 0.05);
  padLuz = pad([130.81, 196.0, 246.94, 293.66, 392.0], 'triangle', 1500, 0.42, 0.09);
  ctx.resume();
  audio.pronto = true;
  carregarNarracao();
}

function pad(freqs, tipo, corte, vol, lfoHz) {
  const g = ctx.createGain(); g.gain.value = 0;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = corte; f.Q.value = 0.8;
  f.connect(g); g.connect(bus.musica);
  freqs.forEach((fr, i) => {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = fr; o.detune.value = det + i * 2;
      const og = ctx.createGain(); og.gain.value = vol / freqs.length / 2;
      o.connect(og); og.connect(f); o.start();
    }
  });
  const lfo = ctx.createOscillator(); lfo.frequency.value = lfoHz;
  const lg = ctx.createGain(); lg.gain.value = corte * 0.4;
  lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  return g;
}

export function setHumor(h, seg = 3) {
  humor = h;
  if (!ctx) return;
  rampa(padFrio.gain, h === 'frio' ? 0.5 : h === 'luz' ? 0.08 : 0, seg);
  rampa(padLuz.gain, h === 'luz' ? 0.42 : 0, seg);
  rampa(bus.musica.gain, h === 'nenhum' ? 0 : (narrando ? 0.28 : 0.6), seg);
}
function duck(on) {
  narrando = on;
  if (!ctx || humor === 'nenhum') return;
  rampa(bus.musica.gain, on ? 0.28 : 0.6, 0.6);
}

// notas soltas e tique-taque, chamados a cada quadro
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
export function updateAudio() {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (humor === 'luz' && t > proxNota) {
    proxNota = t + 0.8 + Math.random() * 1.4;
    nota(PENTA[Math.floor(Math.random() * PENTA.length)], 0.05, 1.6, bus.eco);
  }
  if (humor === 'frio' && audio.relogio && t > proxTick) {
    proxTick = t + 1;
    sfx('tick', audio.relogio);
  }
}
function nota(freq, vol, dur, dest, quando = 0) {
  const t = ctx.currentTime + quando;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function ruido(dest, dur, { tipo = 'bandpass', f0 = 300, f1 = 2400, q = 0.9, vol = 0.12, ataque = 0.25 } = {}) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * ataque); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur + 0.05);
}
function varrer(dest, f0, f1, dur, vol, tipo = 'sine') {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function panner(pos) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.5; p.rolloffFactor = 0.5;
  p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
  p.connect(bus.sfx);
  return p;
}

// Efeito sonoro; com "pos" (Vector3 do mundo) ele vem daquela direção.
export function sfx(tipo, pos) {
  if (!ctx) return;
  const d = pos ? panner(pos) : bus.sfx;
  switch (tipo) {
    case 'clique': varrer(d, 720, 1080, 0.09, 0.06); break;
    case 'hover': varrer(d, 520, 760, 0.05, 0.018); break;
    case 'whoosh': ruido(d, 0.55, { f0: 280, f1: 2600, vol: 0.09 }); break;
    case 'pegar': varrer(d, 300, 620, 0.14, 0.08, 'triangle'); break;
    case 'soltar': varrer(d, 620, 300, 0.16, 0.06, 'triangle'); break;
    case 'tick': ruido(d, 0.035, { tipo: 'highpass', f0: 3200, f1: 3400, vol: 0.09, ataque: 0.1 }); break;
    case 'chamado': [880, 1318.5, 1760].forEach((f, i) => nota(f, 0.08, 2.4, d, i * 0.12)); break;
    case 'acender':
      varrer(d, 70, 32, 2.2, 0.4);
      ruido(d, 2.4, { tipo: 'lowpass', f0: 200, f1: 6000, vol: 0.14, ataque: 0.7 });
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => nota(f, 0.06, 3.2, d, 0.5 + i * 0.09));
      break;
    case 'sucesso': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, 0.09, 1.4, d, i * 0.1)); break;
    case 'dissolver': ruido(d, 3.0, { tipo: 'bandpass', f0: 120, f1: 1800, q: 0.6, vol: 0.12, ataque: 0.6 }); break;
    default: break;
  }
}

// ----------------------------------------------------------------- narração ---
async function carregarNarracao() {
  try {
    const r = await fetch('media/narracao/manifest.json', { cache: 'no-cache' });
    manifesto = r.ok ? await r.json() : {};
  } catch (e) { manifesto = {}; }
  for (const k of Object.keys(manifesto)) buscar(k).catch(() => {});
}
function buscar(k) {
  if (!buffers[k]) {
    buffers[k] = fetch(`media/narracao/${k}.mp3?v=${manifesto[k].hash}`)
      .then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
  }
  return buffers[k];
}
// Duração estimada de uma fala (segundos), mesmo com a narração desligada.
export function duracaoFala(k) {
  return manifesto[k]?.dur ?? 0;
}
export function pararNarracao() {
  tokenVoz++;
  if (fonteVoz) { try { fonteVoz.stop(); } catch (e) { /* já parou */ } fonteVoz = null; }
  duck(false);
}
// Toca uma fala. aoTerminar roda ao fim dela (ou logo, se não houver áudio).
export function narrar(k, aoTerminar) {
  pararNarracao();
  const meu = tokenVoz;
  const fim = () => { if (meu === tokenVoz && aoTerminar) aoTerminar(); };
  if (!ctx || !audio.narracaoAtiva || !manifesto[k]) { setTimeout(fim, 400); return; }
  buscar(k).then(buf => {
    if (meu !== tokenVoz) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus.voz);
    src.onended = () => { if (fonteVoz === src) { fonteVoz = null; duck(false); fim(); } };
    fonteVoz = src;
    duck(true);
    src.start();
  }).catch(() => fim());
}
export function setNarracaoAtiva(v) {
  audio.narracaoAtiva = v;
  if (!v) pararNarracao();
}

// --------------------------------------------------------------- vídeos ---
const fontesVideo = new WeakMap();
// Liga o som de um <video> a um ponto do espaço. Chamar uma vez por elemento.
export function somEspacialVideo(video, pos) {
  if (!ctx || fontesVideo.has(video)) return fontesVideo.get(video);
  try {
    const src = ctx.createMediaElementSource(video);
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 0.4;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    src.connect(p); p.connect(bus.video);
    fontesVideo.set(video, p);
    return p;
  } catch (e) { return null; }
}
export function moverSomVideo(video, pos) {
  const p = fontesVideo.get(video);
  if (!p) return;
  p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
}
export function duckVideo(on) {
  if (!ctx) return;
  rampa(bus.musica.gain, on ? 0.12 : (narrando ? 0.28 : 0.6), 0.5);
  if (on) pararNarracao();
}
