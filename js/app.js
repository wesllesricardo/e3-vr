// =============================================================================
// E3 Company · experiência imersiva (WebXR + Three.js), pensada para Meta Quest 3S.
// Fases: intro (sala real) → dissolve → escuro (lado sombrio) → vire-se → luz
// (jornada na frente, depoimentos à direita, cases à esquerda) → fim (volta à sala).
// Textos em conteudo.js · falas em narracao.js · roteiro do closer em closer.html
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, S, hooks, app, tocou, renderer, scene, camera, world, FRENTE, TRAS,
  panel, rich, eyebrow, cardBg, pill, card, botao, setLabel, place, glow, tw, E, reveal, leave, kill, setAlpha, op,
  clamp, updateTweens, updateUpdaters, updatePointers, updateCameraTela, olharTelaPara, anguloOlhar, yawCabeca, view,
  addUpdater, click, ctrls,
} from './motor.js';
import { CONTEUDO as K, CONFIG } from './conteudo.js';
import { iniciarAudio, setHumor, sfx, narrar, pararNarracao, updateAudio, setNarracaoAtiva, audio, duracaoFala, suspenderAudio } from './audio.js';
import { amb, setProg, setLuz, updateAmbiente, carregarLogo, direcaoLuz, posicaoChamado, flashLuz, girarNucleo } from './ambiente.js';
import { criarDepoimentos, ativarDepoimentos, criarCases, ativarCases, updateLaterais, pararVideos } from './laterais.js';
import { CENAS } from './cenas.js';
import { criarGuia, guia, updateGuia } from './guia.js';

const params = new URLSearchParams(location.search);
const ESTACAO = params.get('estacao') ? `Estação ${params.get('estacao')}` : CONFIG.estacaoPadrao;
const v3 = new THREE.Vector3();
let fase = 'intro';          // intro | dissolvendo | escuro | vire | luz | fim
let idx = -1, current = null, vireGrp = null, fimGrp = null, introGrp = null, ultimoChamado = 0, tFase = 0;

hooks.clique = m => sfx('clique', m.getWorldPosition(v3));
hooks.hover = () => sfx('hover');
hooks.pegar = m => sfx('pegar', m.getWorldPosition(v3));
hooks.soltar = m => sfx('soltar', m.getWorldPosition(v3));
renderer.setClearColor(0x2b2e33, 1);   // em tela, a "sala real" é um cinza neutro

function setFase(f) {
  fase = f; tFase = 0;
  if (typeof resetTras !== 'undefined') resetTras.visible = f === 'escuro' || f === 'vire';
  if (typeof fecharTras !== 'undefined') fecharTras.visible = f === 'escuro' || f === 'vire';
  if (typeof rotularReset === 'function' && confirmaAte) { confirmaAte = 0; rotularReset(false); }
}
function depois(seg, fn) { tw(seg, () => {}, { done: fn, ease: E.lin }); }

// ------------------------------------------------------------ alinhamento ---
// Gira o mundo para o lado sombrio (e a intro) ficarem de frente para o visitante.
function alinharMundo() { world.rotation.y = yawCabeca() + Math.PI; world.updateMatrixWorld(true); }

// No Quest, os primeiros quadros da sessão imersiva ainda não trazem a posição real
// da cabeça (e o "chão" do óculos pode ter outra frente). Alinhar nesse instante deixa
// o mundo girado e o visitante começa olhando para os depoimentos. Por isso esperamos
// alguns quadros seguidos com a cabeça rastreada antes de alinhar.
let esperaPose = null;
function quandoPoseValida(fn) {
  if (!renderer.xr.isPresenting) { fn(); return; }
  esperaPose = { fn, ok: 0, t0: performance.now() };
}
function checarPose() {
  if (!esperaPose) return;
  const f = renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  const pose = f && ref ? f.getViewerPose(ref) : null;
  esperaPose.ok = pose && !pose.emulatedPosition ? esperaPose.ok + 1 : 0;
  if (esperaPose.ok >= 20 || performance.now() - esperaPose.t0 > 4000) {
    const { fn } = esperaPose;
    esperaPose = null;
    fn();
  }
}
// Visitante recentralizou o óculos (segurar o botão Meta): o conteúdo volta para a frente dele.
function realinhar() {
  if (['intro', 'dissolvendo', 'escuro', 'vire'].includes(fase)) alinharMundo();
  else { world.rotation.y = yawCabeca(); world.updateMatrixWorld(true); }
}

// ------------------------------------------------------------------- intro ---
function mostrarIntro() {
  if (introGrp) kill(introGrp);
  introGrp = new THREE.Group();
  TRAS.add(introGrp);
  const I = K.intro;
  if (logoTex) {
    const w = 0.42, h = w * logoTex.image.height / logoTex.image.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false, toneMapped: false }));
    m.renderOrder = 3;
    place(m, 0, 2.08, 2.2);
    introGrp.add(m);
  }
  const p = panel(2.0, 0.62, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 7 });
    eyebrow(ctx, I.eyebrow, 0, 8, W, { align: 'center' });
    const y = rich(ctx, I.titulo, 10, 17, W - 20, 12, { font: F_HEAD, weight: 700, align: 'center', lh: 1.1 });
    rich(ctx, I.texto, 16, y + 4, W - 32, 5.6, { color: COL.mute, align: 'center', lh: 1.42 });
  });
  place(p, 0, 1.55, 2.2);
  introGrp.add(p);
  // Começar pede confirmação: 1º toque arma, 2º toque (em até 4 s) inicia. Não dispara só
  // com o olhar, e ignora toques no primeiro segundo depois de entrar no modo imersivo.
  const desde = S.T;
  let confirmaInicio = 0;
  const comecar = botao(1.1, 0.2, I.botao, () => {
    if (S.T - desde < 1) return;
    if (S.T < confirmaInicio) { confirmaInicio = 0; iniciarJornada(); return; }
    confirmaInicio = S.T + 4;
    setLabel(comecar, I.botaoConfirma);
    depois(4, () => { if (fase === 'intro' && S.T >= confirmaInicio) setLabel(comecar, I.botao); });
  }, { primary: true });
  comecar.userData.mesh.userData.semOlhar = true;
  place(comecar, 0, 1.05, 2.1);
  introGrp.add(comecar);
  guia.mostrar(true);
  guia.alvo(comecar, { avisar: false });
  const voz = botao(0.5, 0.13, vozLabel(), () => { alternarVoz(); setLabel(voz, vozLabel()); });
  place(voz, -6, 0.84, 2.1);
  introGrp.add(voz);
  const fecharIntro = criarFechar(0.42, 0.13);
  place(fecharIntro, 6, 0.84, 2.1);
  introGrp.add(fecharIntro);
  introGrp.children.forEach((c, i) => reveal(c, { delay: 0.2 + i * 0.1 }));
  const brilho = glow(1.3, YEL, 0.2);
  brilho.position.copy(comecar.position); brilho.position.z -= 0.05;
  introGrp.add(brilho);
  addUpdater(introGrp, t => op(brilho, 0.12 + 0.1 * Math.sin(t * 3)));
}
function vozLabel() { return audio.narracaoAtiva ? 'Narração: ligada' : 'Narração: desligada'; }
function aplicarVoz(v) {
  setNarracaoAtiva(v);
  const cb = document.getElementById('narracao');
  if (cb) cb.checked = v;
  try { localStorage.setItem('e3vr-narracao', v ? '1' : '0'); } catch (e) { /* sem storage */ }
  setLabel(vozBtn, v ? 'Voz ligada' : 'Voz desligada');
}
function alternarVoz() { aplicarVoz(!audio.narracaoAtiva); }

// --------------------------------------------------------- escuro → luz ---
// --------------------------------------------------------------- contagem ---
// No alto do lado sombrio: quanto falta para o visitante se virar e ver a E3.
let contagemGrp = null;
function mostrarContagem(seg, aoZerar) {
  if (contagemGrp) kill(contagemGrp);
  contagemGrp = new THREE.Group();
  TRAS.add(contagemGrp);
  const st = { resta: Math.ceil(seg), frac: 1, agora: false };
  const p = panel(1.7, 0.42, (ctx, W, H, s) => {
    cardBg(ctx, W, H, { r: 7 });
    eyebrow(ctx, K.escuro.contagemTopo, 0, 7, W, { align: 'center' });
    ctx.textBaseline = 'middle';
    if (s.agora) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.yellow; ctx.font = `800 13px ${F_HEAD}`;
      ctx.fillText(K.escuro.contagemAgora, W / 2, 21.5);
    } else {
      const a = `${K.escuro.contagemTexto} `, b = `${s.resta} s`;
      ctx.font = `700 11px ${F_HEAD}`;
      const wa = ctx.measureText(a).width;
      ctx.font = `800 13px ${F_HEAD}`;
      const wb = ctx.measureText(b).width, x0 = (W - wa - wb) / 2;
      ctx.textAlign = 'left';
      ctx.font = `700 11px ${F_HEAD}`; ctx.fillStyle = COL.text; ctx.fillText(a, x0, 21.5);
      ctx.font = `800 13px ${F_HEAD}`; ctx.fillStyle = COL.orange; ctx.fillText(b, x0 + wa, 21.5);
    }
    // barra do tempo restante
    const bw = W - 40, bx = 20, by = H - 7;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 1.8, 0.9); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(1.8, bw * s.frac), 1.8, 0.9); ctx.fillStyle = s.agora ? COL.yellow : COL.orange; ctx.fill();
  }, st);
  place(p, 0, 2.75, 2.6);
  p.rotation.x = 0.4;
  contagemGrp.add(p);
  reveal(p);
  let zerou = false;
  addUpdater(contagemGrp, t => {
    const resta = Math.max(0, seg - t);
    if (!zerou) {
      const r = Math.ceil(resta), f = resta / seg;
      if (r !== st.resta || Math.abs(f - st.frac) > 0.02) {
        if (r !== st.resta && r > 0 && r <= 3) sfx('tick');
        st.resta = r; st.frac = f; p.userData.redraw();
      }
      if (resta <= 0) { zerou = true; st.agora = true; st.frac = 1; p.userData.redraw(); if (aoZerar) aoZerar(); }
    } else {
      p.scale.setScalar(1 + 0.04 * Math.sin(t * 6));
    }
  });
}
function esconderContagem() { if (contagemGrp) { leave(contagemGrp, 0.4); contagemGrp = null; } }

function iniciarJornada() {
  if (fase !== 'intro') return;
  setFase('dissolvendo');
  iniciarAudio();
  sfx('dissolver');
  if (introGrp) { leave(introGrp, 0.6); introGrp = null; }
  setHumor('frio', 3.5);
  guia.casa();
  // a contagem cobre a dissolução, a narração do lado sombrio e uma pequena pausa
  const fala = audio.narracaoAtiva ? duracaoFala('escuro') : 0;
  mostrarContagem(3.4 + (fala ? fala + 0.6 : 7), mostrarVire);
  tw(3.4, k => setProg(k), { ease: E.inOut, done: () => {
    setFase('escuro');
    narrar('escuro');
  } });
}
function mostrarVire() {
  if (fase !== 'escuro') return;
  setFase('vire');
  narrar('vire');
  vireGrp = new THREE.Group();
  TRAS.add(vireGrp);
  const p = panel(2.0, 0.36, (ctx, W, H) => {
    rich(ctx, K.escuro.vire, 0, 2, W, 12, { font: F_HEAD, weight: 700, align: 'center', color: '#E6EDF3', hi: COL.orange });
    rich(ctx, K.escuro.vireSub, 0, 20, W, 6, { color: COL.frio, align: 'center' });
  });
  place(p, 0, 1.55, 2.3);
  vireGrp.add(p);
  const setas = [-1, 1].map(lado => {
    const s = panel(0.4, 0.2, (ctx, W, H) => {
      ctx.fillStyle = COL.orange; ctx.font = `800 16px ${F_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lado < 0 ? '‹‹‹' : '›››', W / 2, H / 2);
    });
    place(s, lado * 26, 1.55, 2.3);
    vireGrp.add(s);
    addUpdater(vireGrp, t => { s.position.x = Math.sin(lado * 26 * DEG) * 2.3 + lado * 0.08 * (0.5 + 0.5 * Math.sin(t * 4)); });
    return s;
  });
  // a luz-guia voa para trás do visitante, onde está a luz da E3
  guia.alvo(out => world.localToWorld(out.set(0, 1.55, -2.2)));
  const b = botao(0.7, 0.16, K.escuro.botaoVirar, () => virarParaLuz());
  place(b, 0, 1.15, 2.2);
  vireGrp.add(b);
  vireGrp.children.forEach((c, i) => reveal(c, { delay: 0.1 * i }));
  tw(4, k => setLuz(0.14 * k), { ease: E.inOut });
  ultimoChamado = S.T - 10;
}
const fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, fog: false }));
fadeMesh.renderOrder = 999;
fadeMesh.visible = false;
camera.add(fadeMesh);
function virarParaLuz() {
  if (fase !== 'vire') return;
  if (renderer.xr.isPresenting) {
    fadeMesh.visible = true;
    tw(0.25, k => { fadeMesh.material.opacity = k; }, { done: () => {
      world.rotation.y = yawCabeca();
      world.updateMatrixWorld(true);
      acenderLuz();
      tw(0.4, k => { fadeMesh.material.opacity = 1 - k; }, { done: () => { fadeMesh.visible = false; } });
    } });
  } else {
    olharTelaPara(direcaoLuz(v3));
    depois(0.7, acenderLuz);
  }
}
function acenderLuz() {
  if (fase !== 'vire') return;
  setFase('luz');
  esconderContagem();
  pararNarracao();
  if (vireGrp) { leave(vireGrp, 0.5); vireGrp = null; }
  sfx('acender', posicaoChamado(v3));
  flashLuz();
  girarNucleo();
  setHumor('luz', 2.5);
  guia.casa();
  const l0 = amb.luz;
  tw(2.6, k => setLuz(l0 + (1 - l0) * k), { ease: E.inOut });
  depois(2.6, () => {
    ativarDepoimentos(true);
    ativarCases(true);
    nav.visible = true;
    reveal(nav, { dy: 0.1 });
    goto(0);
  });
}

// --------------------------------------------------------------- navegação ---
const nav = new THREE.Group();
nav.position.set(0, 0.74, -1.9);
nav.rotation.x = -0.32;
FRENTE.add(nav);
nav.visible = false;
const btnNext = botao(0.9, 0.22, 'Continuar →', () => {}, { primary: true });
const btnBack = botao(0.55, 0.22, '← Voltar', () => {});
const vozBtn = botao(0.42, 0.13, 'Voz ligada', () => alternarVoz());
vozBtn.position.set(0.98, -0.02, 0);
nav.add(btnNext, btnBack, vozBtn);

// ---------------------------------------------------------- RESETAR ---
// Pede um segundo toque para confirmar, evitando reset sem querer.
let confirmaAte = 0;
const botoesReset = [];
function criarReset(w = 0.42, h = 0.13) {
  const b = card(w, h, (ctx, W, H, s) => pill(ctx, W, H, s.label, { fill: s.confirma ? '#E0524B' : 'rgba(20,16,12,0.92)', stroke: '#E0524B', color: COL.text, size: H * 0.36 }),
    { label: '↺ RESETAR', confirma: false }, () => pedirReset());
  botoesReset.push(b);
  return b;
}
function rotularReset(confirma) {
  botoesReset.forEach(b => {
    const st = b.userData.mesh.userData.state;
    st.confirma = confirma; st.label = confirma ? 'Toque de novo' : '↺ RESETAR';
    b.userData.mesh.userData.redraw();
  });
}
function pedirReset() {
  if (S.T < confirmaAte) { confirmaAte = 0; rotularReset(false); voltarAoInicio(); return; }
  confirmaAte = S.T + 3;
  rotularReset(true);
}
const resetFrente = criarReset();
resetFrente.position.set(-1.06, -0.02, 0);
nav.add(resetFrente);
// no lado sombrio (antes da virada) também dá para resetar
const resetTras = criarReset(0.5, 0.15);
place(resetTras, -9, 0.78, 2.0);
resetTras.rotation.x = -0.35;
TRAS.add(resetTras);
resetTras.visible = false;
// ---------------------------------------------------------- FECHAR ---
// Fecha tudo de verdade: sai do modo imersivo, para narração, música, vídeos e o desenho
// da cena. Também pede um segundo toque. "Abrir de novo" recarrega a página do zero.
let fechaAte = 0, fechado = false;
const botoesFechar = [];
function criarFechar(w = 0.42, h = 0.13) {
  const b = card(w, h, (ctx, W, H, s) => pill(ctx, W, H, s.label, { fill: s.confirma ? '#E0524B' : 'rgba(20,16,12,0.92)', stroke: '#E0524B', color: COL.text, size: H * 0.36 }),
    { label: '✕ FECHAR', confirma: false }, () => pedirFechar());
  botoesFechar.push(b);
  return b;
}
function rotularFechar(confirma) {
  botoesFechar.forEach(b => {
    const st = b.userData.mesh.userData.state;
    if (st.confirma === confirma) return;
    st.confirma = confirma; st.label = confirma ? 'Toque de novo' : '✕ FECHAR';
    b.userData.mesh.userData.redraw();
  });
}
function pedirFechar() {
  if (S.T < fechaAte) { fechaAte = 0; rotularFechar(false); fecharTudo(); return; }
  fechaAte = S.T + 3;
  rotularFechar(true);
  depois(3.05, () => { if (S.T >= fechaAte) rotularFechar(false); });
}
async function fecharTudo() {
  if (fechado) return;
  fechado = true;
  resetar({ fala: false });       // para narração, vídeos e cenas
  setHumor('nenhum', 0.2);
  const sessao = renderer.xr.getSession();
  if (sessao) await sessao.end().catch(() => {});
  renderer.setAnimationLoop(null);
  suspenderAudio();
  $('intro').classList.add('off');
  $('hud').classList.add('off');
  $('fechado').classList.remove('off');
  try { window.close(); } catch (e) { /* o navegador pode não deixar fechar a aba */ }
}
const fecharFrente = criarFechar();
fecharFrente.position.set(-1.06, -0.17, 0);
nav.add(fecharFrente);
const fecharTras = criarFechar(0.5, 0.15);
place(fecharTras, 9, 0.78, 2.0);
fecharTras.rotation.x = -0.35;
TRAS.add(fecharTras);
fecharTras.visible = false;

// segurar o botão B ou Y do controle por 2 segundos também reseta (atalho do closer)
let seguraReset = 0;
function checarBotaoReset(dt) {
  if (!renderer.xr.isPresenting || fase === 'intro') { seguraReset = 0; return; }
  const apertado = ctrls.some(c => { const gp = c.userData.src && c.userData.src.gamepad; return gp && gp.buttons[5] && gp.buttons[5].pressed; });
  seguraReset = apertado ? seguraReset + dt : 0;
  if (seguraReset > 2) { seguraReset = 0; voltarAoInicio(); }
}
const dots = panel(1.2, 0.05, (ctx, W, H, s) => {
  const seg = 6, act = 16, gap = 2.6, total = (s.n - 1) * (seg + gap) + act;
  let x = (W - total) / 2;
  for (let i = 0; i < s.n; i++) {
    const w = i === s.i ? act : seg;
    ctx.beginPath(); ctx.roundRect(x, H / 2 - 0.8, w, 1.6, 0.8);
    ctx.fillStyle = i === s.i ? COL.orange : i < s.i ? 'rgba(255,95,31,0.45)' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    x += w + gap;
  }
}, { i: 0, n: CENAS.length });
dots.position.y = 0.2;
nav.add(dots);

function setNav({ back = null, next = null }) {
  const aplicar = (b, cfg) => {
    b.visible = !!cfg;
    if (!cfg) return;
    setLabel(b, cfg.label);
    b.userData.mesh.userData.onClick = cfg.fn;
  };
  aplicar(btnBack, back);
  aplicar(btnNext, next);
  if (back && next) { btnBack.position.x = -0.52; btnNext.position.x = 0.3; }
  else { btnBack.position.x = 0; btnNext.position.x = 0; }
}
function navPadrao() {
  const ultimo = CENAS.length - 1;
  setNav({
    back: idx > 0 ? { label: '← Voltar', fn: () => goto(idx - 1) } : null,
    next: idx < ultimo ? { label: idx === 0 ? 'Começar a jornada →' : 'Continuar →', fn: () => goto(idx + 1) } : null,
  });
}
function goto(i, { fala = true } = {}) {
  i = clamp(i, 0, CENAS.length - 1);
  if (current) leave(current);
  idx = i;
  current = new THREE.Group();
  FRENTE.add(current);
  navPadrao();
  CENAS[i].build(current);
  dots.userData.state.i = i;
  dots.userData.redraw();
  // depois da fala, a luz-guia vai até o botão Continuar
  if (fala) narrar(CENAS[i].fala, () => depois(audio.narracaoAtiva ? 2.5 : 10, () => { if (idx === i && fase === 'luz') guiarContinuar(); }));
  girarNucleo();
  tocou();
}
function guiarContinuar() { if (btnNext.visible) guia.alvo(btnNext); }
function destacarContinuar() {
  if (!btnNext.visible) return;
  tw(1.6, k => btnNext.scale.setScalar(1 + 0.1 * Math.abs(Math.sin(k * Math.PI * 3))), { ease: E.lin });
}
Object.assign(app, {
  goto, setNav, navPadrao, destacarContinuar, guiarContinuar,
  guiar: o => guia.alvo(o),
  avancar: () => goto(idx + 1),
  voltar: () => goto(idx - 1),
  irPara: (id, op2) => goto(CENAS.findIndex(c => c.id === id), op2),
  avisarCloser, encerrar,
});

// ------------------------------------------------------- aviso ao closer ---
async function avisarCloser(tipo) {
  const assinar = tipo === 'assinar';
  // Junta o que o cliente respondeu no diagnóstico (nenhum dado pessoal) para o closer já chegar com o contrato certo.
  const r = app.estado.respostas || {};
  const prog = K.programas.find(p => p.id === app.estado.programa);
  const extras = [
    prog && `Programa sugerido: ${prog.nome} (${prog.duracao})`,
    r.area && `Área: ${r.area}`,
    r.desafio && `Desafio: ${r.desafio}`,
  ].filter(Boolean);
  const corpo = `${ESTACAO}: o cliente quer ${assinar ? 'ASSINAR O CONTRATO' : 'FALAR COM UM ATENDENTE'} agora.` + (extras.length ? '\n' + extras.join('\n') : '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(CONFIG.ntfyTopico)}`, {
      method: 'POST', body: corpo, signal: ctrl.signal,
      headers: { Title: assinar ? 'E3 VR - Assinar contrato' : 'E3 VR - Falar com atendente', Priority: 'urgent', Tags: assinar ? 'memo,rotating_light' : 'wave' },
    });
    return r.ok;
  } catch (e) {
    return false;
  } finally { clearTimeout(t); }
}

// ----------------------------------------------------------- fim e reinício ---
function encerrar() {
  if (fase === 'fim') return;
  setFase('fim');
  pararNarracao();
  pararVideos();
  ativarDepoimentos(false);
  ativarCases(false);
  if (current) { leave(current); current = null; }
  nav.visible = false;
  setHumor('nenhum', 3);
  guia.casa();
  sfx('dissolver');
  const p0 = amb.prog, l0 = amb.luz;
  tw(3.2, k => { setProg(p0 * (1 - k)); setLuz(l0 * (1 - k)); }, { ease: E.inOut });
  fimGrp = new THREE.Group();
  FRENTE.add(fimGrp);
  const p = panel(2.5, 0.44, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 7 });
    const y = rich(ctx, K.fim.titulo, 10, 9, W - 20, 10, { font: F_HEAD, weight: 700, align: 'center' });
    rich(ctx, K.fim.texto, 10, y + 3, W - 20, 5.6, { color: COL.mute, align: 'center' });
  });
  place(p, 0, 1.55, 2.2);
  fimGrp.add(p);
  reveal(p, { delay: 1.5 });
}
function resetar({ fala = true } = {}) {
  pararNarracao();
  pararVideos();
  ativarDepoimentos(false);
  ativarCases(false);
  [current, vireGrp, fimGrp, contagemGrp].forEach(g => { if (g) kill(g); });
  current = vireGrp = fimGrp = contagemGrp = null;
  idx = -1;
  nav.visible = false;
  setProg(0);
  setLuz(0);
  setHumor('nenhum', 1);
  app.estado.respostas = {};
  app.estado.programa = null;
  setFase('intro');
  alinharMundo();
  mostrarIntro();
  if (fala && audio.pronto) narrar('intro');
  tocou();
}

// ------------------------------------------------------------------ sessão ---
let hiddenAt = 0;
async function entrarXR() {
  const xr = navigator.xr;
  const modo = (await xr.isSessionSupported('immersive-ar').catch(() => false)) ? 'immersive-ar' : 'immersive-vr';
  try {
    const session = await xr.requestSession(modo, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    session.addEventListener('visibilitychange', () => {
      // óculos tirado e recolocado: novo visitante
      if (session.visibilityState !== 'visible') hiddenAt = performance.now();
      else if (hiddenAt && performance.now() - hiddenAt > 6000) { hiddenAt = 0; voltarAoInicio(); }
    });
    iniciarAudio();
    await renderer.xr.setSession(session);
    esconderTela();
    const ref = renderer.xr.getReferenceSpace();
    if (ref) ref.addEventListener('reset', () => quandoPoseValida(realinhar));
    // entra no modo imersivo e espera o visitante tocar em "Entrar no mundo da E3" (no ar)
    quandoPoseValida(() => resetar());
  } catch (err) {
    status('Não foi possível entrar no modo imersivo: ' + (err && err.message ? err.message : err));
  }
}
renderer.xr.addEventListener('sessionend', () => {
  esperaPose = null;
  if (fechado) return;
  view.yaw = view.pitch = view.tyaw = view.tpitch = 0;
  camera.position.set(0, 1.6, 0);
  mostrarTelaInicial();
  setTimeout(() => resetar({ fala: false }), 100);
});
// RESETAR: volta para a tela inicial ("Entrar no mundo da E3"); na próxima entrada a
// experiência recomeça completa (sala, contagem, virada para a luz).
function voltarAoInicio() {
  const sessao = renderer.xr.getSession();
  if (sessao) { sessao.end().catch(() => { mostrarTelaInicial(); resetar({ fala: false }); }); return; }
  mostrarTelaInicial();
  resetar({ fala: false });
}

// -------------------------------------------------------------------- tela ---
const $ = id => document.getElementById(id);
function status(t) { const s = $('status'); if (s) s.textContent = t; }
function esconderTela() {
  S.iniciou = true;
  $('intro').classList.add('off');
  $('hud').classList.remove('off');
}
function mostrarTelaInicial() {
  S.iniciou = false;
  $('intro').classList.remove('off');
  $('hud').classList.add('off');
}
// ------------------------------------------------------------ sem internet ---
// Internet do evento pode ser fraca: o botão baixa vídeos, fotos, narração e código para o
// próprio óculos (sw.js serve tudo dali). Fazer uma vez, com boa conexão, antes do evento.
const CACHE_MIDIA = 'e3vr-midia-v1', CACHE_CODIGO = 'e3vr-codigo-v1';
async function listaOffline() {
  const midia = ['media/logo-e3.png', K.reelFinal.video];
  for (const v of K.depoimentos.videos) midia.push(`media/depoimentos/${v.arquivo}.mp4`, `media/depoimentos/${v.arquivo}.jpg`);
  try {
    const man = await (await fetch('media/narracao/manifest.json', { cache: 'no-cache' })).json();
    for (const [k, v] of Object.entries(man)) midia.push(`media/narracao/${k}.mp3?v=${v.hash}`);
  } catch (e) { /* sem manifesto: segue sem a narração */ }
  const codigo = [new URL('./', location.href).href, 'closer.html', 'media/narracao/manifest.json'];
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if (u.hostname === 'ntfy.sh' || u.pathname.includes('/media/')) continue;
    codigo.push(e.name);
  }
  return { midia: midia.map(u => new URL(u, location.href).href), codigo: [...new Set(codigo)] };
}
function statusOffline(t, ok = false) { const el = $('offlineStatus'); el.textContent = t; el.classList.toggle('ok', ok); }
async function verificarOffline() {
  if (!('caches' in window)) return;
  const { midia } = await listaOffline();
  const c = await caches.open(CACHE_MIDIA);
  let tem = 0;
  for (const u of midia) if (await c.match(u)) tem++;
  $('offline').hidden = false;
  if (tem === midia.length) { statusOffline('✓ Tudo baixado neste aparelho: funciona sem internet.', true); $('offline').textContent = 'Baixar de novo'; }
  else statusOffline(tem ? `${tem} de ${midia.length} arquivos já estão neste aparelho.` : 'Faça isso uma vez, com boa internet, antes do evento.');
}
async function baixarOffline() {
  const b = $('offline');
  b.disabled = true;
  const { midia, codigo } = await listaOffline();
  const cm = await caches.open(CACHE_MIDIA), cc = await caches.open(CACHE_CODIGO);
  const total = midia.length + codigo.length;
  let feito = 0, falhas = 0;
  const um = async (cache, u) => {
    try {
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error(r.status);
      await cache.put(u, r);
    } catch (e) { falhas++; }
    feito++;
    statusOffline(`Baixando ${feito} de ${total}…`);
  };
  for (const u of codigo) await um(cc, u);
  for (const u of midia) await um(cm, u);
  b.disabled = false;
  if (falhas) statusOffline(`${falhas} arquivo(s) não baixaram. Confira a internet e toque de novo.`);
  else { statusOffline('✓ Tudo baixado neste aparelho: funciona sem internet.', true); b.textContent = 'Baixar de novo'; }
}
if ('serviceWorker' in navigator && 'caches' in window) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  $('offline').addEventListener('click', () => baixarOffline());
  verificarOffline().catch(() => {});
}

let temXR = false;
$('entrarVR').addEventListener('click', () => {
  if (temXR) return entrarXR();
  iniciarAudio();
  esconderTela();
  resetar();
});
$('vrHud').addEventListener('click', entrarXR);
$('resetHud').addEventListener('click', () => voltarAoInicio());
$('fecharHud').addEventListener('click', () => fecharTudo());
$('abrirDeNovo').addEventListener('click', () => location.reload());
$('narracao').addEventListener('change', e => aplicarVoz(e.target.checked));
{
  let salvo = null;
  try { salvo = localStorage.getItem('e3vr-narracao'); } catch (e) { /* sem storage */ }
  aplicarVoz(salvo === null ? CONFIG.narracaoPadrao : salvo === '1');
}
$('estacao').textContent = ESTACAO;

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    temXR = ok;
    $('vrHud').hidden = !ok;
    status(ok ? 'Óculos detectado.' : 'Modo tela, para ensaio. No Quest, este mesmo botão abre a versão imersiva.');
  }).catch(() => status('Modo tela.'));
} else {
  status('Modo tela, para ensaio. Abra este endereço no navegador do Quest para a versão imersiva.');
}

window.addEventListener('keydown', e => {
  if (!S.iniciou) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowright' || k === ' ') {
    if (fase === 'intro') iniciarJornada();
    else if (fase === 'vire') virarParaLuz();
    else if (fase === 'luz' && btnNext.visible) click(btnNext.userData.mesh);
  } else if (k === 'arrowleft') { if (fase === 'luz' && btnBack.visible) click(btnBack.userData.mesh); }
  else if (k === 'r') voltarAoInicio();
  else if (k === 't') virarParaLuz();
  else if (k === 'n') alternarVoz();
  else if (k === 'f') encerrar();
});

// -------------------------------------------------------------------- loop ---
const clock = new THREE.Clock();
function sim(dt) {
  if (confirmaAte && S.T > confirmaAte) { confirmaAte = 0; rotularReset(false); }
  checarBotaoReset(dt);
  S.T += dt;
  tFase += dt;
  updateTweens(dt);
  updateUpdaters(dt);
  updateAmbiente(S.T, dt);
  updateGuia(dt);
  updateLaterais();
  updatePointers(dt);
  updateCameraTela(dt);
  updateAudio();
  if (fase === 'vire') {
    if (anguloOlhar(direcaoLuz(v3)) < 40) acenderLuz();
    else if (S.T - ultimoChamado > 3.5) { ultimoChamado = S.T; sfx('chamado', posicaoChamado(v3)); }
  }
  if (fase === 'luz' && S.T - S.lastInput > CONFIG.ociosoSegundos) voltarAoInicio();
  if (fase === 'fim' && tFase > CONFIG.fimSegundos) voltarAoInicio();
}
function frame() {
  checarPose();
  sim(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

let logoTex = null;
async function boot() {
  const fontes = ['700 20px "Archivo"', '800 20px "Archivo"', '500 20px "Plus Jakarta Sans"', '600 20px "Plus Jakarta Sans"', '700 20px "Plus Jakarta Sans"'];
  await Promise.race([Promise.all(fontes.map(f => document.fonts.load(f))).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
  logoTex = await carregarLogo();
  criarDepoimentos();
  criarCases();
  criarGuia();
  resetar();
  // ensaio: ?cena=N pula direto para a luz na cena N
  if (params.has('cena')) {
    esconderTela();
    setProg(1);
    setFase('vire');
    if (introGrp) { kill(introGrp); introGrp = null; }
    world.rotation.y = yawCabeca();
    acenderLuz();
    depois(2.8, () => goto(Number(params.get('cena')) || 0, { fala: false }));
  }
  renderer.setAnimationLoop(frame);
  const avancarTempo = s => { for (let i = 0; i < s * 30; i++) sim(1 / 30); renderer.render(scene, camera); };
  window.__e3 = { goto, avancarTempo, iniciarJornada, virarParaLuz, encerrar, resetar, view, get fase() { return fase; }, get cena() { return idx; }, app };
}
boot();
