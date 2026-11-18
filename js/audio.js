// =============================================================================
// Áudio: trilha generativa (fria no escuro, quente na luz), efeitos espaciais
// (vêm da direção de cada objeto), narração com "ducking" e som dos vídeos.
// Tudo sintetizado na hora, sem arquivos de música com direitos autorais.
// =============================================================================
import { THREE, camera } from './motor.js';

let listener = null, ctx = null;
const bus = {};
let noiseBuf = null, padFrio = null, padLuz = null, humor = 'nenhum', proxNota = 0, proxTick = 0;
let narrando = false, videoTocando = false, tokenVoz = 0, fonteVoz = null, analisador = null, amostras = null, nivel = 0;
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
  // a voz sai da luz-guia: panner que acompanha a posição dela
  bus.vozPan = ctx.createPanner();
  bus.vozPan.panningModel = 'HRTF'; bus.vozPan.distanceModel = 'inverse'; bus.vozPan.refDistance = 1.2; bus.vozPan.rolloffFactor = 0.25;
  bus.vozPan.connect(bus.voz);
  analisador = ctx.createAnalyser(); analisador.fftSize = 256;
  bus.voz.connect(analisador);
  amostras = new Uint8Array(analisador.fftSize);
  bus.video = ganho(bus.master, 1.0);
  // eco suave para a trilha
  const eco = ctx.createDelay(1.0), fb = ctx.createGain(), mix = ctx.createGain();
  eco.delayTime.value = 0.388; fb.gain.value = 0.3; mix.gain.value = 0.3;   // colcheia pontuada a 116 BPM
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
  // na luz, os acordes da trilha animada substituem os pads parados (que destoariam da progressão)
  rampa(padFrio.gain, h === 'frio' ? 0.5 : 0, seg);
  rampa(padLuz.gain, 0, seg);
  rampa(bus.musica.gain, h === 'nenhum' ? 0 : volumeMusica(), seg);
  if (h === 'luz' && !batidaLigada) { batidaLigada = true; passo = 0; proxPasso = ctx.currentTime + 0.15; }
  if (h !== 'luz') batidaLigada = false;
}
// volume da trilha: baixa com a narração e quase some com um vídeo tocando
function volumeMusica() { return videoTocando ? 0.06 : narrando ? 0.26 : 0.6; }
function duck(on) {
  narrando = on;
  if (!ctx || humor === 'nenhum') return;
  rampa(bus.musica.gain, volumeMusica(), 0.6);
}

// --- trilha animada da luz: 116 BPM, progressão Dó – Lá menor – Fá – Sol ---------
// Bumbo marcando o tempo, palma no 2 e no 4, chimbal, baixo sincopado, arpejo e
// acordes. Tudo sintetizado e agendado um pouco à frente no relógio do áudio.
const BPM = 116, P16 = 60 / BPM / 4;
const ACORDES = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
const BAIXO = [65.41, 55.0, 87.31, 98.0];
const RITMO_BAIXO = { 0: 1, 3: 1, 6: 1, 8: 2, 10: 1, 14: 1 };
let batidaLigada = false, passo = 0, proxPasso = 0;
function agendarBatida() {
  const agora = ctx.currentTime;
  if (proxPasso < agora) proxPasso = agora + 0.05;   // aba ficou parada: recomeça sem atropelar
  while (proxPasso < agora + 0.25) {
    tocarPasso(passo, proxPasso);
    passo = (passo + 1) % 64;
    proxPasso += P16;
  }
}
function tocarPasso(p, t) {
  const c = Math.floor(p / 16), s = p % 16, ac = ACORDES[c];
  const entrada = p < 16 && !tocouVolta;            // 1º compasso sem bateria: a trilha "entra"
  if (s === 0) acorde(ac, t, P16 * 15);
  if (!entrada) {
    if (s % 4 === 0) bumbo(t);
    if (s === 4 || s === 12) palma(t);
    if (s % 2 === 1) chimbal(t, s % 4 === 3 ? 0.05 : 0.028);
  }
  if (RITMO_BAIXO[s]) baixo(BAIXO[c] * RITMO_BAIXO[s], t, P16 * 1.6);
  if (s % 2 === 0) pluck(ac[(s / 2) % 3] * (s % 8 >= 4 ? 2 : 1), t);
  if (p === 63) tocouVolta = true;
}
let tocouVolta = false;
function bumbo(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g); g.connect(bus.musica); o.start(t); o.stop(t + 0.35);
}
function palma(t) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(f); f.connect(g); g.connect(bus.eco); src.start(t, Math.random()); src.stop(t + 0.2);
}
function chimbal(t, vol) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(f); f.connect(g); g.connect(bus.musica); src.start(t, Math.random()); src.stop(t + 0.06);
}
function baixo(freq, t, dur) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur); f.Q.value = 4;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(bus.musica); o.start(t); o.stop(t + dur + 0.02);
}
function pluck(freq, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq * 2;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(bus.eco); o.start(t); o.stop(t + 0.25);
}
function acorde(freqs, t, dur) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.08); g.gain.setValueAtTime(0.07, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g); g.connect(bus.musica);
  for (const fr of freqs) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.05);
  }
}

// trilha animada e tique-taque, chamados a cada quadro
export function updateAudio() {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (humor === 'luz' && batidaLigada) agendarBatida();
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
    case 'guia': [1567.98, 2093.0].forEach((f, i) => nota(f, 0.035, 0.6, d, i * 0.07)); break;
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
    src.connect(bus.vozPan);
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
  videoTocando = on;
  if (!ctx) return;
  if (on) pararNarracao();
  rampa(bus.musica.gain, humor === 'nenhum' ? 0 : volumeMusica(), 0.5);
}

// Volume atual da narração (0 a ~0.5), para a luz-guia pulsar enquanto fala.
export function nivelVoz() {
  if (!analisador || !fonteVoz) { nivel *= 0.9; return nivel; }
  analisador.getByteTimeDomainData(amostras);
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) { const x = (amostras[i] - 128) / 128; soma += x * x; }
  nivel = nivel * 0.6 + Math.sqrt(soma / amostras.length) * 0.4;
  return nivel;
}
export function setPosVoz(p) {
  if (!bus.vozPan) return;
  bus.vozPan.positionX.value = p.x; bus.vozPan.positionY.value = p.y; bus.vozPan.positionZ.value = p.z;
}
