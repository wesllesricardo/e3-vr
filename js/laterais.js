// =============================================================================
// Paredes laterais: à direita, depoimentos em vídeo passando; à esquerda,
// cases de antes e depois com números animados.
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, DIREITA, ESQUERDA, panel, rich, eyebrow, cardBg, fitFont, card,
  place, glow, tw, E, reveal, setAlpha, op, clamp, lerp, clicavel, estaOlhando, addUpdater, S, pill,
} from './motor.js';
import { CONTEUDO as K, CONFIG } from './conteudo.js';
import { somEspacialVideo, moverSomVideo, duckVideo, sfx } from './audio.js';

const v3 = new THREE.Vector3();

function cabecalho(grupo, eb, titulo, dica) {
  const p = panel(2.6, 0.5, (ctx, W, H) => {
    eyebrow(ctx, eb, 0, 2, W, { align: 'center' });
    rich(ctx, titulo, 0, 12, W, 12, { font: F_HEAD, weight: 700, align: 'center', lh: 1.1 });
    if (dica) rich(ctx, dica, 0, 30, W, 4.4, { color: COL.mute, align: 'center' });
  });
  place(p, 0, 2.42, 2.7);
  grupo.add(p);
  return p;
}

// ============================================================ depoimentos ===
const dep = { grupo: null, telas: [], ativo: false, base: 0, foco: null, ultimoGiro: 0, n: 0, girando: false, contador: null };
const PASSO = 19, RD = 2.6, WV = 0.5, HV = 0.89;

function texturaPlaceholder(nome) {
  const c = document.createElement('canvas'); c.width = 270; c.height = 480;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, '#2a1a10'); g.addColorStop(1, '#0d0900');
  x.fillStyle = g; x.fillRect(0, 0, 270, 480);
  x.fillStyle = '#FF5F1F'; x.font = `700 22px ${F_HEAD}`; x.textAlign = 'center';
  x.fillText('Depoimento', 135, 220);
  x.fillStyle = '#ECECEC'; x.font = `600 18px ${F_BODY}`; x.fillText(nome, 135, 255);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function criarTela() {
  const g = new THREE.Group();
  const moldura = panel(WV + 0.06, HV + 0.2, (ctx, W, H, s) => {
    cardBg(ctx, W, H, { r: 4, accent: s.foco ? COL.yellow : COL.orange, strong: s.foco });
    ctx.font = `700 4.6px ${F_BODY}`;
    fitFont(ctx, s.nome || '', 700, 4.6, F_BODY, W - 8);
    ctx.fillStyle = COL.text; ctx.textAlign = 'center';
    ctx.fillText(s.nome || '', W / 2, H - 8.5);
    ctx.textAlign = 'left';
  }, { nome: '', foco: false });
  moldura.position.set(0, -0.07, -0.005);
  g.add(moldura);
  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'auto';
  video.setAttribute('playsinline', '');
  const vtex = new THREE.VideoTexture(video);
  vtex.colorSpace = THREE.SRGBColorSpace;
  vtex.userData.shared = true;
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(WV, HV), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false }));
  tela.renderOrder = 2;
  tela.position.z = 0.002;
  g.add(tela);
  const t = { g, moldura, tela, video, vtex, item: null, poster: null, pronto: false, slot: 0 };
  // só troca o pôster pelo vídeo quando já existe um quadro de verdade (evita tela branca)
  video.addEventListener('timeupdate', () => {
    if (t.item && !t.pronto && video.currentTime > 0.05 && video.readyState >= 2) { tela.material.map = vtex; tela.material.needsUpdate = true; t.pronto = true; }
  });
  video.addEventListener('ended', () => { if (dep.foco === t) { desfocar(); dep.ultimoGiro = S.T - 6; } });
  video.addEventListener('error', () => { t.pronto = false; });
  tela.userData.video = null;  // não pausar ao destruir: as telas vivem a sessão toda
  clicavel(tela, () => (dep.foco === t ? desfocar() : focar(t)));
  tela.userData.hoverFn = h => { tela.scale.setScalar(1 + 0.03 * Math.min(h, 1)); };
  return t;
}

function carregarItem(t, item) {
  t.item = item;
  t.pronto = false;
  t.moldura.userData.state.nome = item.nome;
  t.moldura.userData.redraw();
  if (t.poster) { t.poster.dispose(); t.poster = null; }
  const ph = texturaPlaceholder(item.nome);
  t.tela.material.map = ph;
  t.tela.material.needsUpdate = true;
  new THREE.TextureLoader().load(`media/depoimentos/${item.arquivo}.jpg`, tx => {
    if (t.item !== item) { tx.dispose(); return; }
    tx.colorSpace = THREE.SRGBColorSpace;
    t.poster = tx;
    if (!t.pronto) { t.tela.material.map = tx; t.tela.material.needsUpdate = true; }
  }, undefined, () => {});
  t.video.src = `media/depoimentos/${item.arquivo}.mp4`;
  t.video.load();
  if (dep.ativo) t.video.play().catch(() => {});
}

function posicionar(t, slotF) {
  place(t.g, slotF * PASSO, 1.5, RD);
  const vis = 1 - clamp(Math.abs(slotF) - 1, 0, 1);
  setAlpha(t.g, vis);
  t.g.visible = vis > 0.01;
}

export function criarDepoimentos() {
  const g = new THREE.Group();
  DIREITA.add(g);
  dep.grupo = g;
  dep.n = K.depoimentos.videos.length;
  dep.base = 0;              // vídeo que está no centro
  cabecalho(g, K.depoimentos.eyebrow, K.depoimentos.titulo, K.depoimentos.dica);
  for (let i = 0; i < 4; i++) {
    const t = criarTela();
    t.slot = i - 1;          // -1, 0, 1 visíveis; o quarto fica escondido para entrar
    g.add(t.g);
    dep.telas.push(t);
    posicionar(t, t.slot);
  }
  // botões grandes para passar os depoimentos
  const ant = card(0.62, 0.2, (ctx, W, H) => pill(ctx, W, H, '‹  Anterior', { size: 7.4 }), {}, () => girar(-1, true));
  const prox = card(0.62, 0.2, (ctx, W, H) => pill(ctx, W, H, 'Próximo  ›', { primary: true, size: 7.4 }), {}, () => girar(1, true));
  dep.contador = panel(0.4, 0.1, (ctx, W, H, st) => {
    ctx.font = `600 5px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${st.i + 1} de ${st.n}`, W / 2, H / 2);
  }, { i: 0, n: dep.n });
  place(ant, -15, 0.84, 2.45);
  place(prox, 15, 0.84, 2.45);
  place(dep.contador, 0, 0.84, 2.45);
  g.add(ant, prox, dep.contador);
  g.visible = false;
  return g;
}

function itemDoSlot(slot) { return K.depoimentos.videos[((dep.base + slot) % dep.n + dep.n) % dep.n]; }

export function ativarDepoimentos(on) {
  dep.ativo = on;
  if (!dep.grupo) return;
  if (on) {
    dep.grupo.visible = true;
    dep.telas.forEach(t => { if (Math.abs(t.slot) <= 1 && t.item !== itemDoSlot(t.slot)) carregarItem(t, itemDoSlot(t.slot)); });
    dep.telas.forEach(t => { if (Math.abs(t.slot) <= 1) t.video.play().catch(() => {}); });
    reveal(dep.grupo, { dy: 0.2, dur: 1.2 });
    dep.ultimoGiro = S.T;
  } else {
    desfocar();
    dep.telas.forEach(t => t.video.pause());
    dep.grupo.visible = false;
  }
}

// dir = 1 avança (os vídeos andam para a esquerda), dir = -1 volta
function girar(dir = 1, manual = false) {
  if (dep.girando) return;
  if (dep.foco) desfocar();
  dep.girando = true;
  // depois de um toque, espera mais antes de voltar a girar sozinho
  dep.ultimoGiro = S.T + (manual ? 12 : 0);
  const telas = dep.telas;
  const reserva = telas.find(t => Math.abs(t.slot) > 1);
  reserva.slot = dir > 0 ? 2 : -2;
  reserva.video.pause();
  carregarItem(reserva, itemDoSlot(reserva.slot));
  reserva.video.pause();
  posicionar(reserva, reserva.slot);
  telas.forEach(t => { t.slot0 = t.slot; });
  tw(manual ? 0.8 : 1.3, k => telas.forEach(t => posicionar(t, t.slot0 - dir * k)), {
    ease: E.inOut,
    done: () => {
      telas.forEach(t => {
        t.slot = t.slot0 - dir;
        posicionar(t, t.slot);
        if (Math.abs(t.slot) <= 1) t.video.play().catch(() => {}); else t.video.pause();
      });
      dep.base = ((dep.base + dir) % dep.n + dep.n) % dep.n;
      dep.contador.userData.state.i = dep.base;
      dep.contador.userData.redraw();
      dep.girando = false;
    },
  });
}

function focar(t) {
  if (dep.foco) desfocar();
  dep.foco = t;
  dep.telas.forEach(o => { if (o !== t) o.video.pause(); });
  t.moldura.userData.state.foco = true;
  t.moldura.userData.redraw();
  t.tela.getWorldPosition(v3);
  somEspacialVideo(t.video, v3);
  moverSomVideo(t.video, v3);
  t.video.loop = false;
  t.video.currentTime = 0;
  t.video.muted = false;
  t.video.play().catch(() => { t.video.muted = true; t.video.play().catch(() => {}); });
  duckVideo(true);
  tw(0.6, k => t.g.scale.setScalar(1 + 0.22 * k), { ease: E.back });
}
function desfocar() {
  const t = dep.foco;
  if (!t) return;
  dep.foco = null;
  t.video.muted = true;
  t.video.loop = true;
  t.moldura.userData.state.foco = false;
  t.moldura.userData.redraw();
  duckVideo(false);
  tw(0.5, k => t.g.scale.setScalar(1.22 - 0.22 * k));
  dep.ultimoGiro = S.T;
  if (dep.ativo) dep.telas.forEach(o => { if (Math.abs(o.slot) <= 1) o.video.play().catch(() => {}); });
}
export function pararVideos() { desfocar(); }

// ================================================================== cases ===
const cs = { grupo: null, atual: null, idx: 0, ativo: false, ultimo: 0, chips: null };
const DUR_CASE = 9;

function nomeCase(c) { return CONFIG.mostrarNomesReais ? c.nome : c.anonimo; }

function cardCase(c, i, n) {
  const st = { k: 0 };
  const m = panel(1.7, 1.06, (ctx, W, H, s) => {
    cardBg(ctx, W, H, { r: 6 });
    eyebrow(ctx, `Case ${i + 1} de ${n}`, 10, 8, W - 20, { size: 4 });
    rich(ctx, nomeCase(c), 10, 17, W - 20, 7.4, { font: F_HEAD, weight: 700, lh: 1.1 });
    ctx.fillStyle = COL.mute; ctx.font = `600 4.6px ${F_BODY}`; ctx.fillText(c.metrica, 10, 30);
    // antes
    const yB = 66, x1 = 14, x2 = W / 2 + 6, bw = W / 2 - 22;
    ctx.font = `700 3.8px ${F_BODY}`; ctx.letterSpacing = '0.7px';
    ctx.fillStyle = COL.frio; ctx.fillText((c.antesRotulo || 'Antes').toUpperCase(), x1, 39);
    ctx.fillStyle = COL.orange; ctx.fillText((c.depoisRotulo || 'Com a E3').toUpperCase(), x2, 39);
    ctx.letterSpacing = '0px';
    const tam = Math.min(15, ...[c.antesTxt, c.depoisTxt].map(t => { fitFont(ctx, t, 800, 15, F_HEAD, bw); return parseFloat(ctx.font); }));
    ctx.font = `800 ${tam}px ${F_HEAD}`;
    ctx.fillStyle = '#C9D5E0'; ctx.fillText(c.antesTxt, x1, 45);
    const kd = E.out(clamp((s.k - 0.15) / 0.85, 0, 1));
    // números simples contam do zero; textos como "R$ 1 mi+" aparecem prontos
    const conta = /^[\d.,]+\+?$/.test(c.depoisTxt);
    const valD = c.depois * kd;
    const txtD = !conta || kd >= 0.999 ? c.depoisTxt : (c.depois >= 100 ? Math.round(valD).toString() : (Math.round(valD * 10) / 10).toString().replace('.', ','));
    ctx.globalAlpha = conta ? 1 : clamp(kd * 2, 0, 1);
    ctx.fillStyle = kd >= 0.999 ? COL.yellow : COL.text; ctx.fillText(txtD, x2, 45);
    ctx.globalAlpha = 1;
    // barras
    const mx = Math.max(c.antes, c.depois, 1);
    const ha = (c.antes / mx) * 18 * E.out(clamp(s.k * 3, 0, 1)), hd = (c.depois / mx) * 18 * kd;
    ctx.fillStyle = 'rgba(169,188,205,0.55)'; ctx.fillRect(x1, yB + 18 - ha, bw, Math.max(ha, 0.4));
    const gr = ctx.createLinearGradient(0, yB + 18, 0, yB);
    gr.addColorStop(0, COL.orange); gr.addColorStop(1, COL.yellow);
    ctx.fillStyle = gr; ctx.fillRect(x2, yB + 18 - hd, bw, Math.max(hd, 0.4));
    ctx.fillStyle = COL.line; ctx.fillRect(10, yB + 18.4, W - 20, 0.3);
    // frase
    rich(ctx, `“${c.frase}”`, 10, H - 9, W - 20, 5, { color: COL.text, weight: 500, lh: 1.35, valign: 'bottom' });
  }, st);
  return m;
}

function mostrarCase(i, manual = false) {
  const lista = K.cases.lista;
  cs.idx = (i + lista.length) % lista.length;
  cs.ultimo = S.T + (manual ? 10 : 0);   // depois de um toque, espera mais para trocar sozinho
  if (cs.atual) {
    const velho = cs.atual;
    tw(0.5, k => { setAlpha(velho, 1 - k); velho.position.x = -0.3 * k; }, { done: () => { velho.parent && velho.parent.remove(velho); velho.material.map.dispose(); velho.material.dispose(); velho.geometry.dispose(); } });
  }
  const m = cardCase(lista[cs.idx], cs.idx, lista.length);
  const holder = cs.holder;
  holder.add(m);
  cs.atual = m;
  setAlpha(m, 0);
  tw(0.6, k => { setAlpha(m, k); m.position.x = 0.3 * (1 - k); }, { delay: 0.25 });
  tw(2.2, k => { m.userData.state.k = k; m.userData.redraw(); }, { delay: 0.6, ease: E.lin, done: () => {
    sfx('sucesso', m.getWorldPosition(v3));
    explodir(m);
  } });
  cs.chips.userData.mesh.userData.state.i = cs.idx;
  cs.chips.userData.mesh.userData.redraw();
}
function explodir(m) {
  const ps = Array.from({ length: 18 }, (_, i) => {
    const s = glow(0.08 + Math.random() * 0.08, i % 3 ? ORG : YEL);
    s.position.set(0.42, -0.05, 0.05);
    s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.9, Math.random() * 0.4);
    m.add(s);
    return s;
  });
  tw(1.2, k => ps.forEach(s => { s.position.set(0.42 + s.userData.v.x * k, -0.05 + s.userData.v.y * k - 0.4 * k * k, 0.05 + s.userData.v.z * k); op(s, 1 - k); }),
    { ease: E.lin, done: () => ps.forEach(s => { m.remove(s); s.material.dispose(); }) });
}

export function criarCases() {
  const g = new THREE.Group();
  ESQUERDA.add(g);
  cs.grupo = g;
  cabecalho(g, K.cases.eyebrow, K.cases.titulo);
  const holder = new THREE.Group();
  place(holder, 0, 1.5, 2.6);
  g.add(holder);
  cs.holder = holder;
  const n = K.cases.lista.length;
  cs.chips = card(0.8, 0.08, (ctx, W, H, s) => {
    const w = 8, gap = 3, total = n * w + (n - 1) * gap;
    let x = (W - total) / 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.roundRect(x, H / 2 - 1, w, 2, 1);
      ctx.fillStyle = i === s.i ? COL.orange : 'rgba(255,255,255,0.2)'; ctx.fill();
      x += w + gap;
    }
  }, { i: 0 });
  place(cs.chips, 0, 0.86, 2.6);
  g.add(cs.chips);
  const ant = card(0.5, 0.2, (ctx, W, H) => pill(ctx, W, H, '‹  Anterior', { size: 7.4 }), {}, () => mostrarCase(cs.idx - 1, true));
  const prox = card(0.62, 0.2, (ctx, W, H) => pill(ctx, W, H, 'Próximo case  ›', { primary: true, size: 7.4 }), {}, () => mostrarCase(cs.idx + 1, true));
  place(ant, -14, 0.86, 2.45);
  place(prox, 15, 0.86, 2.45);
  g.add(ant, prox);
  addUpdater(null, () => {
    if (cs.ativo && S.T - cs.ultimo > DUR_CASE) mostrarCase(cs.idx + 1);
  });
  g.visible = false;
  return g;
}
export function ativarCases(on) {
  cs.ativo = on;
  if (!cs.grupo) return;
  cs.grupo.visible = on;
  if (on) { reveal(cs.grupo, { dy: 0.2, dur: 1.2 }); mostrarCase(0); }
}

// chamado a cada quadro
export function updateLaterais() {
  if (!dep.ativo) return;
  if (!dep.foco && !dep.girando && S.T - dep.ultimoGiro > 9) girar(1);
}
