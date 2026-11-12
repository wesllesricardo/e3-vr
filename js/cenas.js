// =============================================================================
// Cenas da frente (na luz da E3). Cada cena recebe o grupo "g" onde monta tudo;
// ao trocar de cena o grupo inteiro sai com animação.
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, FRENTE, panel, rich, eyebrow, cardBg, fitFont, pill, card, botao, setLabel,
  clicavel, place, mk, disc, glow, tw, E, reveal, leave, setAlpha, op, clamp, lerp, addUpdater, app, camera, S, R,
} from './motor.js';
import { CONTEUDO as K } from './conteudo.js';
import { sfx, narrar } from './audio.js';

const D = 0.35;
const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

function heading(g, eb, titulo, { sub, tam = 12.5, y = 2.4, r = R } = {}) {
  const h = 0.6;
  const p = panel(3.3, h, (ctx, W, H) => {
    const o = { font: F_HEAD, weight: 700, align: 'center', lh: 1.12 };
    const so = { color: COL.mute, align: 'center', weight: 500 };
    const th = rich(ctx, titulo, 0, 0, W, tam, { ...o, dry: true });
    const sh = sub ? rich(ctx, sub, 0, 0, W, 4.6, { ...so, dry: true }) + 3 : 0;
    const yy = H - 1 - sh - th;
    eyebrow(ctx, eb, 0, yy - 10, W, { align: 'center' });
    rich(ctx, titulo, 0, yy, W, tam, o);
    if (sub) rich(ctx, sub, 0, yy + th + 3, W, 4.6, so);
  });
  place(p, 0, y + h / 2, r);
  g.add(p);
  reveal(p, { delay: D, owner: g });
  sfx('whoosh', p.getWorldPosition(v3));
  return p;
}
function matBrilho(cor = ORG, int = 0.55) {
  return new THREE.MeshStandardMaterial({ color: 0x1b120b, emissive: cor, emissiveIntensity: int, roughness: 0.35, metalness: 0.35, transparent: true });
}

// ====================================================== 0. luz e números ===
function cenaLuz(g) {
  const L = K.luz;
  heading(g, L.eyebrow, L.titulo, { y: 2.3 });
  L.numeros.forEach((it, i) => {
    const c = card(0.98, 0.48, (ctx, W, H, s) => {
      cardBg(ctx, W, H);
      const alvo = it.prefixo + it.valor.toLocaleString('pt-BR') + it.sufixo;
      const str = it.prefixo + Math.round(it.valor * s.k).toLocaleString('pt-BR') + it.sufixo;
      fitFont(ctx, alvo, 800, 16, F_HEAD, W - 16);
      ctx.fillStyle = s.k >= 1 ? COL.yellow : COL.text;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, W / 2, 20);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `700 4.4px ${F_BODY}`; ctx.letterSpacing = '0.5px';
      const lbl = it.rotulo.toUpperCase(), lw = ctx.measureText(lbl).width;
      ctx.fillStyle = COL.mute; ctx.fillText(lbl, (W - lw) / 2, 34);
    }, { k: 0 });
    place(c, (i % 2 ? 1 : -1) * 10.5, i < 2 ? 1.86 : 1.3);
    g.add(c);
    reveal(c, { delay: D + 0.12 * i, owner: g });
    const m = c.userData.mesh;
    tw(1.8, k => { m.userData.state.k = k; m.userData.redraw(); }, { delay: D + 0.4 + 0.14 * i, owner: g, ease: E.out });
  });
  // dicas para olhar para os lados
  [[-1, `‹  ${L.dicaEsquerda}`], [1, `${L.dicaDireita}  ›`]].forEach(([lado, txt], i) => {
    const p = panel(0.8, 0.16, (ctx, W, H) => pill(ctx, W, H, txt, { size: 6 }));
    place(p, lado * 36, 1.05, 2.4);
    g.add(p);
    reveal(p, { delay: D + 1.2 + i * 0.2, owner: g });
    addUpdater(g, t => { p.position.x = Math.sin(lado * 36 * DEG) * 2.4 + lado * 0.04 * Math.sin(t * 3); });
    // a luz-guia mostra os depoimentos e, depois, os resultados
    tw(lado > 0 ? 6 : 11, () => {}, { owner: g, done: () => app.guiar(p) });
  });
}

// ========================================================= 1. método CPP ===
function formaPilar(tipo) {
  const g = new THREE.Group();
  const mat = matBrilho(ORG, 0.5), linhas = new THREE.LineBasicMaterial({ color: YEL, transparent: true, opacity: 0.6 });
  if (tipo === 'funil') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 32, 1, true), mat);
    cone.rotation.x = Math.PI;
    g.add(cone);
    for (const [y, r] of [[0.1, 0.17], [0.0, 0.11], [-0.09, 0.05]]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 40), new THREE.MeshBasicMaterial({ color: YEL, transparent: true }));
      t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t);
    }
  } else if (tipo === 'cristal') {
    const geo = new THREE.OctahedronGeometry(0.19, 0);
    g.add(new THREE.Mesh(geo, mat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), linhas));
    g.scale.set(1, 1.3, 1);
  } else {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 14, 40), mat);
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 14, 40), matBrilho(YEL, 0.45));
    a.position.x = -0.07; b.position.x = 0.07; b.rotation.y = Math.PI / 2;
    g.add(a, b);
  }
  g.userData.mat = mat;
  return g;
}
function cenaMetodo(g) {
  const M = K.metodo;
  heading(g, M.eyebrow, M.titulo, { sub: M.dica });
  const info = card(1.7, 0.4, (ctx, W, H, s) => {
    if (s.i < 0) return;
    const p = M.pilares[s.i];
    cardBg(ctx, W, H, { accent: COL.yellow, strong: true });
    eyebrow(ctx, `Pilar ${p.n}`, 9, 7, W, { color: COL.yellow, size: 4 });
    rich(ctx, p.titulo, 9, 15, 50, 9, { font: F_HEAD, weight: 700, lh: 1.05 });
    rich(ctx, p.texto, 62, H / 2, W - 72, 5.4, { lh: 1.4, valign: 'middle' });
  }, { i: -1 });
  const im = info.userData.mesh;
  const desenhar = i => { im.userData.state.i = i; im.userData.redraw(); };
  place(info, 0, 2.05, 2.5);
  info.visible = false;
  g.add(info);
  const abrir = i => {
    if (!info.visible) { info.visible = true; reveal(info, { owner: g, dy: 0.05 }); }
    desenhar(i);
    pilares.forEach((p, j) => { p.userData.ativo = j === i; });
  };
  const pilares = M.pilares.map((p, i) => {
    const base = new THREE.Group();
    place(base, (i - 1) * 19, 0, 2.3);
    g.add(base);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 48), new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.8 }));
    aro.rotation.x = Math.PI / 2; aro.position.y = 1.2;
    base.add(aro);
    const brilho = glow(0.6, ORG, 0.5); brilho.position.y = 1.23; base.add(brilho);
    const rot = panel(0.7, 0.14, (ctx, W, H) => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 5px ${F_BODY}`; ctx.fillStyle = COL.orange; ctx.fillText(p.n, W / 2, 3.6);
      ctx.font = `700 6.4px ${F_HEAD}`; ctx.fillStyle = COL.text; ctx.fillText(p.titulo, W / 2, 9.6);
    });
    rot.position.y = 1.06;
    base.add(rot);
    const obj = new THREE.Group();
    obj.position.y = 1.5;
    base.add(obj);
    const forma = formaPilar(p.forma);
    obj.add(forma);
    const alvo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    obj.add(alvo);
    alvo.userData.grab = obj;
    clicavel(alvo, () => { abrir(i); sfx('clique'); });
    alvo.userData.onGrab = () => abrir(i);
    alvo.userData.hoverFn = h => {
      forma.userData.mat.emissiveIntensity = 0.5 + 0.5 * Math.min(h, 1) + (obj.userData.held ? 0.5 : 0);
      if (!obj.userData.held) obj.scale.setScalar(1 + 0.12 * Math.min(h, 1));
    };
    reveal(base, { delay: D + 0.2 + i * 0.15, owner: g, escala: false });
    addUpdater(g, (t, dt) => {
      forma.rotation.y += dt * (base.userData.ativo || obj.userData.held ? 1.6 : 0.5);
      if (!obj.userData.held) obj.position.y = 1.5 + Math.sin(t * 1.4 + i) * 0.03;
      aro.material.color.set(base.userData.ativo ? YEL : ORG);
    });
    base.userData.obj = obj;
    return base;
  });
  app.guiar(pilares[0].userData.obj);
}

// ===================================================== 2. portais de entrada ===
function cenaEntrada(g) {
  const P = K.entrada;
  heading(g, P.eyebrow, P.titulo);
  const n = P.passos.length, X = 0.72, Y = 1.45;
  const aneis = P.passos.map((p, i) => {
    const z = -(2.7 + i * 1.05);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.07, 0.02, 10, 80),
      new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.55, toneMapped: false }));
    aro.position.set(X, Y, z);
    g.add(aro);
    const rot = panel(0.32, 0.14, (ctx, W, H, s) => pill(ctx, W, H, p.n, { primary: s.on, size: 6 }), { on: false });
    rot.position.set(X, Y + 0.55 + i * 0.07 + 0.12, z);
    g.add(rot);
    aro.userData.rot = rot;
    clicavel(rot, () => ativar(i, true));
    setAlpha(aro, 0); setAlpha(rot, 0);
    tw(0.7, k => { setAlpha(aro, k); setAlpha(rot, k); aro.scale.setScalar(0.6 + 0.4 * k); }, { delay: D + 0.25 + i * 0.18, owner: g, ease: E.back });
    return aro;
  });
  const pulso = glow(0.35, YEL); pulso.position.set(X, Y, -1.6); g.add(pulso); op(pulso, 0);
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2 + 0.3;
    const pts = aneis.map((aro, i) => new THREE.Vector3(X + Math.cos(ang) * (0.55 + i * 0.07), Y + Math.sin(ang) * (0.55 + i * 0.07), aro.position.z));
    const trilho = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.28, toneMapped: false }));
    g.add(trilho);
    setAlpha(trilho, 0);
    tw(1.2, kk => setAlpha(trilho, kk), { delay: D + 1.0, owner: g });
  }
  const cardP = card(1.25, 0.76, (ctx, W, H, s) => {
    const p = P.passos[s.i];
    cardBg(ctx, W, H, { r: 6 });
    ctx.font = `800 20px ${F_HEAD}`; ctx.lineWidth = 0.6; ctx.strokeStyle = COL.orange; ctx.strokeText(p.n, 10, 8);
    const q = p.quando.toUpperCase();
    ctx.font = `700 4px ${F_BODY}`;
    const qw = ctx.measureText(q).width + 8;
    ctx.beginPath(); ctx.roundRect(W - 10 - qw, 10, qw, 7, 3.5); ctx.fillStyle = 'rgba(255,236,0,0.14)'; ctx.fill();
    ctx.fillStyle = COL.yellow; ctx.fillText(q, W - 6 - qw, 11.5);
    const y = rich(ctx, p.titulo, 10, 33, W - 20, 9, { font: F_HEAD, weight: 700, lh: 1.1 });
    rich(ctx, p.texto, 10, y + 3, W - 20, 5.4, { color: COL.mute, lh: 1.4 });
  }, { i: 0 });
  place(cardP, -17, 1.55, 2.4);
  g.add(cardP);
  reveal(cardP, { delay: D + 0.3, owner: g });
  const bts = [
    botao(0.36, 0.14, '‹', () => ativar(atual - 1, true)),
    botao(0.62, 0.14, 'Próximo portal ›', () => ativar(atual + 1, true), { primary: true }),
  ];
  bts.forEach((b, i) => { place(b, -17 + (i ? 4.5 : -9.5), 1.04, 2.4); g.add(b); reveal(b, { delay: D + 0.5, owner: g }); });
  app.guiar(bts[1]);
  let atual = -1, tAtivo = 0, manual = false;
  function ativar(i, porToque) {
    i = (i + n) % n;
    if (porToque) manual = true;
    atual = i;
    tAtivo = 0;
    cardP.userData.mesh.userData.state.i = i;
    cardP.userData.mesh.userData.redraw();
    aneis.forEach((a, j) => {
      const on = j <= i;
      a.material.color.set(j === i ? YEL : on ? 0xffa060 : ORG);
      a.userData.rot.userData.state.on = j === i;
      a.userData.rot.userData.redraw();
    });
    const alvoZ = aneis[i].position.z;
    tw(0.9, k => { pulso.position.z = lerp(-1.6, alvoZ, k); op(pulso, Math.sin(k * Math.PI)); }, { owner: g, ease: E.inOut });
    tw(0.8, k => aneis[i].scale.setScalar(1 + 0.18 * Math.sin(k * Math.PI)), { delay: 0.8, owner: g, ease: E.lin });
    sfx('chamado', aneis[i].getWorldPosition(v3));
  }
  ativar(0);
  addUpdater(g, (t, dt) => {
    tAtivo += dt;
    if (!manual && tAtivo > 4.6 && atual < n - 1) ativar(atual + 1);
    aneis.forEach((a, j) => { a.rotation.z = t * 0.2 * (j % 2 ? 1 : -1); });
  });
}

// ===================================================== 3. estrutura (módulos) ===
const VIS = {
  midia(v) {
    const base = mk(0.86, 0.006, 0xffffff, 0.25); base.position.set(0, -0.37, 0.02); v.add(base);
    const bars = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const b = mk(0.085, 1, i === 6 ? YEL : ORG, i === 6 ? 1 : 0.45 + i * 0.08);
      b.geometry.translate(0, 0.5, 0);
      b.position.set(-0.36 + i * 0.12, -0.365, 0.02);
      v.add(b);
      return b;
    });
    return t => bars.forEach((b, i) => {
      const grow = E.out(clamp(t * 1.1 - i * 0.13, 0, 1));
      b.scale.y = Math.max(0.001, (0.16 + 0.085 * i + 0.035 * Math.sin(t * 2.2 + i * 1.3)) * grow);
    });
  },
  crm(v) {
    for (let i = 0; i < 4; i++) { const c = mk(0.2, 0.84, i === 3 ? YEL : 0xffffff, i === 3 ? 0.1 : 0.05); c.position.set(-0.36 + i * 0.24, 0, 0.02); v.add(c); }
    const ds = Array.from({ length: 10 }, () => { const d = disc(0.03, ORG); v.add(d); return d; });
    return t => ds.forEach((d, j) => {
      const s = (t * 0.32 + j * 0.37) % 3.4, col = Math.min(3, Math.floor(s)), f = s - col;
      const pos = col >= 3 ? 3 : col + E.inOut(clamp(f * 2.2, 0, 1));
      d.position.set(-0.36 + pos * 0.24, 0.32 - (j % 5) * 0.16 + (j > 4 ? 0.08 : 0), 0.03);
      d.material.color.set(pos > 2.5 ? YEL : ORG);
      op(d, clamp(s * 5, 0, 1) * clamp((3.4 - s) * 5, 0, 1));
    });
  },
  landing(v) {
    const page = mk(0.62, 0.86, 0x24201c, 1); page.position.z = 0.02; v.add(page);
    const defs = [
      [0, 0.36, 0.52, 0.035, 0xffffff, 0.22], [-0.07, 0.25, 0.38, 0.07, 0xffffff, 0.85], [-0.11, 0.165, 0.3, 0.028, 0xffffff, 0.3],
      [0, 0.0, 0.52, 0.22, ORG, 0.4], [-0.14, -0.2, 0.24, 0.1, 0xffffff, 0.14], [0.14, -0.2, 0.24, 0.1, 0xffffff, 0.14],
      [0, -0.34, 0.28, 0.075, YEL, 1],
    ];
    const bl = defs.map(([x, y, w, h, c, o]) => { const b = mk(w, h, c, o); b.position.set(x, y, 0.03); b.renderOrder = 3; b.userData = { x, o }; v.add(b); return b; });
    return t => {
      const cyc = t % 5.5, out = clamp((5.5 - cyc) / 0.4, 0, 1);
      bl.forEach((b, i) => {
        const k = E.out(clamp((cyc - i * 0.3) / 0.45, 0, 1));
        b.position.x = b.userData.x - 0.09 * (1 - k);
        op(b, b.userData.o * k * out);
      });
      bl[6].scale.setScalar(1 + (cyc > 2.4 ? 0.07 * Math.abs(Math.sin((cyc - 2.4) * 3.2)) : 0));
    };
  },
  vendas(v) {
    const N = 36, ticks = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, tk = mk(0.02, 0.085, ORG, 0.12);
      tk.position.set(Math.sin(a) * 0.34, Math.cos(a) * 0.34, 0.02);
      tk.rotation.z = -a;
      v.add(tk);
      ticks.push(tk);
    }
    const hub = glow(0.3, YEL, 0.5); hub.position.z = 0.03; v.add(hub);
    const steps = [0, 1, 2].map(i => { const s = mk(0.07, 0.07 + i * 0.07, 0xffffff, 0.8); s.position.set(-0.09 + i * 0.09, -0.07 + i * 0.035, 0.04); v.add(s); return s; });
    return t => {
      const p = Math.min(1, (t * 0.3) % 1.35);
      ticks.forEach((tk, i) => { const lit = i / N < p; tk.material.color.set(lit && i / N > 0.75 ? YEL : ORG); op(tk, lit ? 1 : 0.12); });
      hub.scale.setScalar(0.25 + p * 0.3);
      steps.forEach((s, i) => op(s, p > (i + 1) / 3.2 ? 0.95 : 0.25));
    };
  },
  ia(v) {
    const layers = [[-0.34, 3], [0, 4], [0.34, 2]], nodes = [], edges = [];
    layers.forEach(([x, n], li) => {
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * 0.21, d = disc(0.036, li === 2 ? YEL : ORG);
        d.position.set(x, y, 0.03);
        v.add(d);
        nodes.push({ li, p: new THREE.Vector3(x, y, 0.025), d });
      }
    });
    const lp = [];
    nodes.forEach(a => nodes.forEach(b => { if (b.li === a.li + 1) { edges.push([a.p, b.p]); lp.push(a.p, b.p); } }));
    const ls = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.3, depthWrite: false }));
    ls.renderOrder = 2;
    v.add(ls);
    const ps = Array.from({ length: 7 }, () => { const s = glow(0.09, YEL); v.add(s); return s; });
    return t => {
      ps.forEach((s, j) => {
        const c = t * 0.9 + j * 0.43, e = edges[(Math.floor(c) * 7 + j * 3) % edges.length], f = c % 1;
        s.position.lerpVectors(e[0], e[1], E.inOut(f));
        s.position.z = 0.04;
        op(s, Math.sin(f * Math.PI));
      });
      nodes.forEach((n, i) => n.d.scale.setScalar(1 + 0.18 * Math.sin(t * 2.4 + i)));
    };
  },
  criativos(v) {
    const cols = [0x3a332d, 0x7a3413, ORG, 0xb8480f, YEL];
    const cs = cols.map((c, i) => {
      const k = mk(0.3, 0.42, c, 1);
      k.renderOrder = 3 + i;
      const a = mk(0.22, 0.16, 0x000000, 0.22); a.position.set(0, 0.08, 0.001); a.renderOrder = 9 + i;
      const b = mk(0.16, 0.03, 0x000000, 0.3); b.position.set(-0.03, -0.08, 0.001); b.renderOrder = 9 + i;
      k.add(a, b);
      v.add(k);
      return k;
    });
    return t => {
      const f = E.inOut(0.5 - 0.5 * Math.cos(t * 1.15));
      cs.forEach((k, i) => {
        const d = i - 2;
        k.position.set(d * 0.15 * f, -Math.abs(d) * 0.035 * f, 0.02 + i * 0.006);
        k.rotation.z = -d * 0.15 * f;
      });
    };
  },
};

function cenaEstrutura(g) {
  const e = K.estrutura, vistos = new Set();
  let sub = null;
  function trocar(fn) {
    if (sub) leave(sub);
    sub = new THREE.Group();
    g.add(sub);
    fn(sub);
  }
  function grade(delay) {
    trocar(s => {
      const dica = vistos.size ? `${e.dica} · ${vistos.size} de ${e.modulos.length} vistos` : e.dica;
      heading(s, e.eyebrow, e.titulo, { sub: dica });
      e.modulos.forEach((m, i) => {
        const c = card(0.96, 0.56, (ctx, W, H) => {
          const visto = vistos.has(i);
          cardBg(ctx, W, H, { accent: visto ? COL.yellow : COL.orange });
          ctx.font = `700 5px ${F_BODY}`; ctx.fillStyle = COL.orange; ctx.fillText(m.n, 8, 7.5);
          if (visto) { ctx.font = `700 3.8px ${F_BODY}`; ctx.fillStyle = COL.yellow; ctx.textAlign = 'right'; ctx.fillText('VISTO', W - 8, 8.5); ctx.textAlign = 'left'; }
          rich(ctx, m.titulo, 8, 17, W - 16, 8, { font: F_HEAD, weight: 700, lh: 1.08 });
          rich(ctx, m.chamada, 8, H - 7, W - 16, 4.6, { color: COL.mute, lh: 1.3, valign: 'bottom' });
        }, {}, () => abrir(i));
        place(c, ((i % 3) - 1) * 21, i < 3 ? 1.86 : 1.26);
        s.add(c);
        if (i === e.modulos.findIndex((_, j) => !vistos.has(j))) app.guiar(c);
        reveal(c, { delay: delay + 0.07 * i, owner: s });
      });
    });
    app.navPadrao();
  }
  function abrir(i) {
    vistos.add(i);
    const m = e.modulos[i], ultimo = i === e.modulos.length - 1;
    narrar(m.id);
    trocar(s => {
      const txt = panel(1.75, 1.32, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 6 });
        const x = 12, w = W - 24;
        let y = 12;
        ctx.font = `700 4.4px ${F_BODY}`; ctx.letterSpacing = '0.8px'; ctx.fillStyle = COL.orange;
        ctx.fillText(`${m.n} / 0${e.modulos.length}  ·  ESTRUTURA E3`, x, y);
        ctx.letterSpacing = '0px';
        y = rich(ctx, m.titulo, x, y + 10, w, 12, { font: F_HEAD, weight: 700, lh: 1.1 }) + 4;
        y = rich(ctx, m.chamada, x, y, w, 6.6, { weight: 600, lh: 1.3 }) + 4;
        y = rich(ctx, m.texto, x, y, w, 5.6, { color: COL.mute, lh: 1.42 }) + 6;
        ctx.fillStyle = COL.line; ctx.fillRect(x, y, w, 0.3);
        y += 6;
        for (const b of m.itens) {
          ctx.strokeStyle = COL.orange; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + 0.5, y + 3.6); ctx.lineTo(x + 2.4, y + 5.5); ctx.lineTo(x + 5.6, y + 1.6); ctx.stroke();
          y = rich(ctx, b, x + 10, y, w - 10, 5.4, { lh: 1.35 }) + 3;
        }
      });
      place(txt, -12, 1.62, 2.6);
      s.add(txt);
      reveal(txt, { delay: 0.3, owner: s });
      const v = new THREE.Group();
      v.add(panel(1.05, 1.05, (ctx, W, H) => cardBg(ctx, W, H, { r: 6 })));
      const upd = VIS[m.id] ? VIS[m.id](v) : null;
      place(v, 22, 1.62, 2.5);
      s.add(v);
      reveal(v, { delay: 0.45, owner: s });
      if (upd) addUpdater(s, t => upd(Math.max(0, t - 0.5)));
    });
    app.setNav({
      back: { label: '← Módulos', fn: () => grade(0.3) },
      next: ultimo ? { label: 'Continuar →', fn: () => app.avancar() } : { label: 'Próximo módulo →', fn: () => abrir(i + 1) },
    });
    tw(4, () => {}, { owner: g, done: () => app.guiarContinuar() });
  }
  grade(D);
}

// ========================================================= 4. diagnóstico ===
function cenaDiagnostico(g) {
  const Q = K.diagnostico, resp = app.estado.respostas;
  let sub = null;
  heading(g, Q.eyebrow, Q.titulo);
  function trocar(fn) { if (sub) leave(sub); sub = new THREE.Group(); g.add(sub); fn(sub); }
  function pergunta(qi) {
    if (qi >= Q.perguntas.length) return resultado();
    const q = Q.perguntas[qi];
    trocar(s => {
      const p = panel(2.4, 0.26, (ctx, W, H) => {
        eyebrow(ctx, `Pergunta ${qi + 1} de ${Q.perguntas.length}`, 0, 0, W, { align: 'center', color: COL.mute, size: 4 });
        rich(ctx, q.texto, 0, 10, W, 8.5, { font: F_HEAD, weight: 700, align: 'center' });
      });
      place(p, 0, 2.0, 2.6);
      s.add(p);
      reveal(p, { delay: 0.2, owner: s });
      const cols = q.opcoes.length > 4 ? 3 : 2;
      q.opcoes.forEach((o, i) => {
        const b = card(cols === 3 ? 0.78 : 1.12, 0.22, (ctx, W, H, st) => pill(ctx, W, H, o, { primary: st.on, size: 6.2 }), { on: resp[q.id] === o }, () => {
          resp[q.id] = o;
          b.userData.mesh.userData.state.on = true; b.userData.mesh.userData.redraw();
          sfx('sucesso');
          setTimeout(() => pergunta(qi + 1), 450);
        });
        const col = i % cols, lin = Math.floor(i / cols);
        const ang = cols === 3 ? (col - 1) * 17.5 : (col - 0.5) * 25;
        place(b, ang, 1.62 - lin * 0.3, 2.5);
        s.add(b);
        if (i === 0) app.guiar(b);
        reveal(b, { delay: 0.3 + i * 0.06, owner: s });
      });
    });
    app.setNav({ back: qi > 0 ? { label: '← Voltar', fn: () => pergunta(qi - 1) } : { label: '← Voltar', fn: () => app.voltar() }, next: null });
  }
  function resultado() {
    const desafio = resp.desafio;
    const pid = Q.recomendacao[desafio] || 'estruturacao';
    const prog = K.programas.find(p => p.id === pid);
    app.estado.programa = pid;
    narrar('resultado');
    trocar(s => {
      const c = panel(2.1, 0.92, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
        eyebrow(ctx, Q.resultadoTitulo, 12, 10, W, { color: COL.yellow });
        const chips = [resp.area, resp.canal, resp.desafio].filter(Boolean);
        let x = 12;
        ctx.font = `600 4.2px ${F_BODY}`;
        for (const t of chips) {
          const w = ctx.measureText(t).width + 8;
          ctx.beginPath(); ctx.roundRect(x, 21, w, 7.5, 3.75); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
          ctx.fillStyle = COL.mute; ctx.fillText(t, x + 4, 22.6);
          x += w + 3;
        }
        const y = rich(ctx, `*${prog.nome}*`, 12, 36, W - 24, 15, { font: F_HEAD, weight: 800, hi: COL.text, lh: 1.05 });
        ctx.font = `700 5px ${F_BODY}`; ctx.fillStyle = COL.orange; ctx.fillText(prog.duracao.toUpperCase(), 12, y + 3);
        rich(ctx, prog.resumo, 12, y + 13, W - 24, 6, { color: COL.mute, lh: 1.4 });
      });
      place(c, 0, 1.62, 2.5);
      s.add(c);
      reveal(c, { delay: 0.2, owner: s });
      sfx('acender', c.getWorldPosition(v3));
      const b = botao(0.9, 0.2, Q.botaoJornada, () => app.irPara('jornada'), { primary: true });
      place(b, 9, 1.0, 2.4);
      s.add(b);
      app.guiar(b);
      reveal(b, { delay: 0.7, owner: s });
      const refazer = botao(0.6, 0.2, 'Refazer', () => { for (const k of Object.keys(resp)) delete resp[k]; pergunta(0); });
      place(refazer, -9, 1.0, 2.4);
      s.add(refazer);
      reveal(refazer, { delay: 0.8, owner: s });
    });
    app.setNav({ back: { label: '← Voltar', fn: () => app.voltar() }, next: { label: 'Continuar →', fn: () => app.irPara('jornada') } });
  }
  pergunta(0);
}

// ====================================================== 5. jornada (espiral) ===
const ICONES = {
  alvo: (c, r) => { for (const k of [1, 0.62, 0.25]) { c.beginPath(); c.arc(0, 0, r * k, 0, 7); c.stroke(); } },
  pessoas: (c, r) => { c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.28, 0, 7); c.stroke(); c.beginPath(); c.arc(-r * 0.3, r * 0.6, r * 0.55, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(r * 0.4, -r * 0.2, r * 0.22, 0, 7); c.stroke(); },
  caneta: (c, r) => { c.beginPath(); c.moveTo(-r * 0.7, r * 0.7); c.lineTo(r * 0.5, -r * 0.5); c.lineTo(r * 0.75, -r * 0.25); c.lineTo(-r * 0.45, r * 0.95); c.closePath(); c.stroke(); },
  balao: (c, r) => { c.beginPath(); c.roundRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.1, r * 0.25); c.stroke(); c.beginPath(); c.moveTo(-r * 0.4, r * 0.5); c.lineTo(-r * 0.6, r * 0.9); c.lineTo(-r * 0.05, r * 0.5); c.stroke(); },
  megafone: (c, r) => { c.beginPath(); c.moveTo(-r * 0.7, -r * 0.25); c.lineTo(r * 0.6, -r * 0.7); c.lineTo(r * 0.6, r * 0.7); c.lineTo(-r * 0.7, r * 0.25); c.closePath(); c.stroke(); },
  camadas: (c, r) => { for (const y of [-0.4, 0, 0.4]) { c.beginPath(); c.moveTo(-r * 0.8, y * r); c.lineTo(0, y * r - r * 0.35); c.lineTo(r * 0.8, y * r); c.lineTo(0, y * r + r * 0.35); c.closePath(); c.stroke(); } },
  aperto: (c, r) => { c.beginPath(); c.moveTo(-r * 0.9, 0); c.lineTo(-r * 0.3, -r * 0.4); c.lineTo(r * 0.3, 0); c.lineTo(r * 0.9, -r * 0.4); c.stroke(); c.beginPath(); c.moveTo(-r * 0.4, r * 0.1); c.lineTo(0, r * 0.5); c.lineTo(r * 0.4, r * 0.1); c.stroke(); },
  sol: (c, r) => { c.beginPath(); c.arc(0, 0, r * 0.35, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); c.stroke(); } },
  insta: (c, r) => { c.beginPath(); c.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.45); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.38, 0, 7); c.stroke(); },
  grafico: (c, r) => { c.beginPath(); c.moveTo(-r * 0.9, r * 0.6); c.lineTo(-r * 0.3, 0); c.lineTo(r * 0.1, r * 0.3); c.lineTo(r * 0.9, -r * 0.6); c.stroke(); c.beginPath(); c.moveTo(r * 0.45, -r * 0.6); c.lineTo(r * 0.9, -r * 0.6); c.lineTo(r * 0.9, -r * 0.15); c.stroke(); },
  barras: (c, r) => { [[-0.6, 0.4], [0, 0.9], [0.6, 0.6]].forEach(([x, h]) => { c.beginPath(); c.moveTo(x * r, r * 0.8); c.lineTo(x * r, r * (0.8 - h * 1.5)); c.stroke(); }); },
  raio: (c, r) => { c.beginPath(); c.moveTo(r * 0.2, -r * 0.95); c.lineTo(-r * 0.5, r * 0.1); c.lineTo(0, r * 0.1); c.lineTo(-r * 0.2, r * 0.95); c.lineTo(r * 0.5, -r * 0.1); c.lineTo(0, -r * 0.1); c.closePath(); c.stroke(); },
  telefone: (c, r) => { c.beginPath(); c.roundRect(-r * 0.45, -r * 0.85, r * 0.9, r * 1.7, r * 0.2); c.stroke(); },
  engrenagem: (c, r) => { c.beginPath(); c.arc(0, 0, r * 0.45, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); c.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); c.stroke(); } },
  medalha: (c, r) => { c.beginPath(); c.arc(0, -r * 0.2, r * 0.5, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-r * 0.3, r * 0.25); c.lineTo(-r * 0.45, r * 0.95); c.lineTo(0, r * 0.7); c.lineTo(r * 0.45, r * 0.95); c.lineTo(r * 0.3, r * 0.25); c.stroke(); },
};
function desenharIcone(ctx, nome, x, y, r, cor) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = cor; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  (ICONES[nome] || ICONES.alvo)(ctx, r);
  ctx.restore();
}
function rotuloSprite(texto, cor) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const x = c.getContext('2d');
  x.font = `700 34px ${F_BODY}`; x.fillStyle = cor; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(texto, 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(0.42, 0.118, 1);
  s.renderOrder = 6;
  return s;
}

function cenaJornada(g) {
  const J = K.jornada;
  const pid = app.estado.programa || 'estruturacao';
  const prog = K.programas.find(p => p.id === pid) || K.programas[0];
  app.estado.programa = prog.id;
  heading(g, `${prog.nome} · ${prog.duracao}`, J.titulo, { tam: 11, y: 2.66 });
  // seletor de programas
  K.programas.forEach((p, i) => {
    const b = botao(0.6, 0.13, p.nome, () => { if (p.id !== app.estado.programa) { app.estado.programa = p.id; app.irPara('jornada', { fala: false }); } }, { primary: p.id === prog.id });
    place(b, (i - 2) * 13.6, 2.4, 2.5);
    g.add(b);
    reveal(b, { delay: D + 0.1 + i * 0.05, owner: g });
  });
  // espiral subindo em direção à luz
  const n = prog.etapas.length, C = new THREE.Vector3(0.6, 0, -4.4), RAIO = 1.45, Y0 = 0.55, Y1 = 3.1, VOLTAS = 1.1;
  const ponto = t => { const a = -Math.PI * 0.62 + t * Math.PI * 2 * VOLTAS; return new THREE.Vector3(C.x + Math.sin(a) * RAIO, Y0 + t * (Y1 - Y0), C.z + Math.cos(a) * RAIO); };
  const curva = new THREE.CatmullRomCurve3(Array.from({ length: 80 }, (_, i) => ponto(i / 79)));
  const trilho = new THREE.Mesh(new THREE.TubeGeometry(curva, 320, 0.016, 6), new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.45, toneMapped: false }));
  const feito = new THREE.Mesh(new THREE.TubeGeometry(curva, 320, 0.026, 6), new THREE.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.9, toneMapped: false }));
  const totalIdx = feito.geometry.index.count;
  feito.geometry.setDrawRange(0, 0);
  g.add(trilho, feito);
  setAlpha(trilho, 0);
  tw(1.4, k => setAlpha(trilho, k), { delay: D, owner: g });
  const tNo = i => (n === 1 ? 0 : i / (n - 1));
  const nos = prog.etapas.map((et, i) => {
    const p = ponto(tNo(i));
    const grp = new THREE.Group();
    grp.position.copy(p);
    g.add(grp);
    const gema = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), matBrilho(ORG, 0.35));
    grp.add(gema);
    const brilho = glow(0.6, ORG, 0.4); grp.add(brilho);
    const rot = rotuloSprite(et.quando.replace(' · Pro', ''), COL.text);
    rot.position.y = 0.2;
    rot.scale.set(0.56, 0.157, 1);
    grp.add(rot);
    const alvo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
    grp.add(alvo);
    clicavel(alvo, () => ativar(i, true));
    alvo.userData.hoverFn = h => { gema.scale.setScalar(1 + 0.4 * Math.min(h, 1) + (i === atual ? 0.6 : 0)); };
    setAlpha(grp, 0);
    tw(0.6, k => { setAlpha(grp, k); grp.position.y = p.y - 0.3 * (1 - k); }, { delay: D + 0.5 + i * 0.12, owner: g, ease: E.back });
    return { grp, gema, brilho, rot, p };
  });
  // cartão da etapa (à esquerda)
  const cardE = card(1.3, 0.72, (ctx, W, H, s) => {
    const et = prog.etapas[s.i];
    cardBg(ctx, W, H, { r: 6 });
    desenharIcone(ctx, et.icone, 18, 18, 8, COL.orange);
    eyebrow(ctx, et.quando, 32, 10, W - 40, { size: 4.6 });
    ctx.font = `600 4px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.textAlign = 'right';
    ctx.fillText(`${s.i + 1} de ${n}`, W - 10, 11);
    ctx.textAlign = 'left';
    const y = rich(ctx, et.titulo, 32, 18, W - 42, 8.6, { font: F_HEAD, weight: 700, lh: 1.08 });
    rich(ctx, et.texto, 10, Math.max(y + 5, 36), W - 20, 5.6, { color: COL.mute, lh: 1.42 });
    // barra de progresso
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(10, H - 8, W - 20, 1.2);
    ctx.fillStyle = COL.yellow; ctx.fillRect(10, H - 8, (W - 20) * (s.i + 1) / n, 1.2);
  }, { i: 0 });
  place(cardE, -21, 1.45, 2.4);
  g.add(cardE);
  app.guiar(cardE);
  reveal(cardE, { delay: D + 0.4, owner: g });
  const bts = [
    botao(0.3, 0.14, '‹', () => ativar(atual - 1, true)),
    botao(0.3, 0.14, '❚❚', () => { pausa = !pausa; setLabel(bts[1], pausa ? '▶' : '❚❚'); }),
    botao(0.3, 0.14, '›', () => ativar(atual + 1, true)),
  ];
  bts.forEach((b, i) => { place(b, -21 + (i - 1) * 7.6, 0.95, 2.4); g.add(b); reveal(b, { delay: D + 0.6, owner: g }); });
  // feixe do nó ativo até o cartão
  const feixe = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: YEL, transparent: true, opacity: 0.5, toneMapped: false }));
  g.add(feixe);
  const viajante = glow(0.3, YEL); g.add(viajante); op(viajante, 0);
  let atual = -1, tAtivo = 0, pausa = false, progAtual = 0;
  function ativar(i, toque) {
    i = clamp(i, 0, n - 1);
    if (toque) tAtivo = -3;     // toque manual dá mais tempo na etapa
    else tAtivo = 0;
    const de = atual < 0 ? 0 : tNo(atual), para = tNo(i);
    atual = i;
    cardE.userData.mesh.userData.state.i = i;
    cardE.userData.mesh.userData.redraw();
    nos.forEach((no, j) => {
      const cor = j < i ? YEL : j === i ? 0xffffff : ORG;
      no.gema.material.emissive.set(j <= i ? YEL : ORG);
      no.gema.material.emissiveIntensity = j === i ? 1.2 : j < i ? 0.7 : 0.3;
      no.brilho.material.color.set(cor);
      op(no.brilho, j === i ? 0.9 : j < i ? 0.45 : 0.25);
      no.gema.scale.setScalar(j === i ? 1.6 : 1);
    });
    tw(0.9, k => {
      const t = lerp(de, para, k);
      progAtual = t;
      feito.geometry.setDrawRange(0, Math.floor(totalIdx * t / 6) * 6);
      viajante.position.copy(curva.getPointAt(clamp(t, 0, 1)));
      op(viajante, Math.sin(k * Math.PI));
    }, { owner: g, ease: E.inOut });
    sfx('chamado', nos[i].grp.getWorldPosition(v3));
    const pa = feixe.geometry.attributes.position;
    v4.set(0.62, 0, 0.01); cardE.userData.mesh.localToWorld(v4); g.worldToLocal(v4);
    pa.setXYZ(0, nos[i].p.x, nos[i].p.y, nos[i].p.z);
    pa.setXYZ(1, v4.x, v4.y, v4.z);
    pa.needsUpdate = true;
    if (i === n - 1) app.destacarContinuar();
  }
  tw(1.3, () => {}, { owner: g, done: () => ativar(0) });
  addUpdater(g, (t, dt) => {
    if (atual < 0) return;
    if (!pausa) tAtivo += dt;
    if (tAtivo > 4.5 && atual < n - 1) ativar(atual + 1);
    nos.forEach((no, j) => { no.gema.rotation.y += dt * (j === atual ? 2 : 0.6); });
    op(feixe, 0.35 + 0.25 * Math.sin(t * 4));
  });
}

// ===================================================== 6. acompanhamento ===
function cenaAcompanhamento(g) {
  const A = K.acompanhamento;
  heading(g, A.eyebrow, A.titulo, { y: 2.5 });
  const centro = new THREE.Vector3(0, 1.5, -3.5);
  const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), matBrilho(ORG, 0.9));
  nucleo.position.copy(centro);
  g.add(nucleo);
  app.guiar(nucleo);
  const halo = glow(1.4, ORG, 0.5); halo.position.copy(centro); g.add(halo);
  const orbita = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.006, 6, 120), new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.4 }));
  orbita.rotation.x = Math.PI / 2; orbita.position.copy(centro); g.add(orbita);
  const chips = A.itens.map((t, i) => {
    const p = panel(1.12, 0.2, (ctx, W, H) => pill(ctx, W, H, t, { size: 6.4 }));
    g.add(p);
    p.userData.a0 = (i / A.itens.length) * Math.PI * 2;
    setAlpha(p, 0);
    tw(0.6, k => setAlpha(p, k), { delay: D + 0.4 + i * 0.1, owner: g });
    return p;
  });
  const txt = panel(2.0, 0.24, (ctx, W, H) => rich(ctx, A.texto, 0, 2, W, 5.4, { color: COL.mute, align: 'center', lh: 1.4 }));
  place(txt, 0, 2.3, 2.6);
  g.add(txt);
  reveal(txt, { delay: D + 0.9, owner: g });
  addUpdater(g, (t, dt) => {
    nucleo.rotation.y += dt * 0.8; nucleo.rotation.x += dt * 0.3;
    camera.getWorldPosition(v3);
    chips.forEach((p, i) => {
      const a = p.userData.a0 + t * 0.22;
      p.position.set(centro.x + Math.sin(a) * 1.45, centro.y + Math.sin(a * 2 + i) * 0.14, centro.z + Math.cos(a) * 1.45);
      p.parent.localToWorld(v4.copy(p.position));
      p.lookAt(v3.x, v4.y, v3.z);
      const frente = (Math.cos(a) + 1) / 2;
      p.scale.setScalar(0.8 + 0.35 * frente);
      p.renderOrder = frente > 0.5 ? 3 : 1;
    });
  });
}

// ============================================================ 7. simulador ===
function cenaSimulador(g) {
  const Sm = K.simulador;
  heading(g, Sm.eyebrow, Sm.titulo, { y: 2.55 });
  const st = { inv: Sm.inicial };
  const calc = inv => {
    const contatos = inv / Sm.custoPorContato, q = contatos * Sm.taxaQualificacao, a = q * Sm.taxaAtendimento, c = a * Sm.taxaFechamento;
    return [contatos, q, a, c].map(Math.round);
  };
  // funil 3D
  const centro = new THREE.Vector3(-0.45, 0, -3.0);
  const niveis = [2.05, 1.75, 1.45, 1.15], raios = [0.5, 0.38, 0.27, 0.16];
  const aneis = niveis.map((y, i) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(raios[i], 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: i === 3 ? YEL : ORG, transparent: true, opacity: 0.8, toneMapped: false }));
    a.rotation.x = Math.PI / 2;
    a.position.set(centro.x, y, centro.z);
    g.add(a);
    return a;
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.16, 0.9, 40, 1, true), new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.set(centro.x, 1.6, centro.z);
  g.add(cone);
  const gotas = Array.from({ length: 40 }, (_, i) => { const s = glow(0.07, ORG); g.add(s); s.userData.f = Math.random(); s.userData.a = Math.random() * 6.28; return s; });
  const rotulos = Sm.etapas.map((e, i) => {
    const p = panel(1.3, 0.24, (ctx, W, H, s) => {
      ctx.fillStyle = COL.line; ctx.fillRect(0, H / 2, 6, 0.3);
      ctx.font = `700 5.2px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.fillText(e.toUpperCase(), 9, 2.5);
      ctx.font = `800 11px ${F_HEAD}`; ctx.fillStyle = i === 3 ? COL.yellow : COL.text;
      ctx.fillText(s.v.toLocaleString('pt-BR') + (i === 3 ? ' por mês' : ''), 9, 9.5);
    }, { v: 0 });
    p.position.set(centro.x + raios[i] + 0.72, niveis[i], centro.z + 0.02);
    g.add(p);
    reveal(p, { delay: D + 0.3 + i * 0.12, owner: g });
    return p;
  });
  // controle deslizante
  const trilho = panel(1.6, 0.34, (ctx, W, H, s) => {
    cardBg(ctx, W, H, { r: 5 });
    ctx.font = `600 4.4px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.fillText(Sm.rotulo.toUpperCase(), 10, 6);
    ctx.font = `800 8px ${F_HEAD}`; ctx.fillStyle = COL.text; ctx.textAlign = 'right';
    ctx.fillText(`R$ ${s.inv.toLocaleString('pt-BR')}`, W - 10, 4.5);
    ctx.textAlign = 'left';
    const x0 = 10, x1 = W - 10, y = 23, k = (s.inv - Sm.min) / (Sm.max - Sm.min);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(x0, y - 1, x1 - x0, 2, 1); ctx.fill();
    const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, COL.orange); gr.addColorStop(1, COL.yellow);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x0, y - 1, (x1 - x0) * k, 2, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 3.6, 0, 7); ctx.fillStyle = COL.yellow; ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = COL.ink; ctx.stroke();
  }, st);
  place(trilho, 0, 1.06, 2.2);
  g.add(trilho);
  app.guiar(trilho);
  reveal(trilho, { delay: D + 0.5, owner: g });
  const atualizar = () => {
    trilho.userData.state.inv = st.inv;
    trilho.userData.redraw();
    calc(st.inv).forEach((v, i) => { rotulos[i].userData.state.v = v; rotulos[i].userData.redraw(); });
  };
  const definir = inv => {
    const novo = clamp(Math.round(inv / Sm.passo) * Sm.passo, Sm.min, Sm.max);
    if (novo !== st.inv) { st.inv = novo; atualizar(); sfx('hover'); }
  };
  trilho.userData.drag = (p, fase) => {
    if (!p) return;
    v3.copy(p); trilho.worldToLocal(v3);
    const k = clamp((v3.x + 0.7) / 1.4, 0, 1);
    definir(Sm.min + k * (Sm.max - Sm.min));
  };
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ visible: false }));
  plano.position.copy(trilho.position); plano.rotation.copy(trilho.rotation);
  g.add(plano);
  trilho.userData.dragPlane = plano;
  trilho.userData.hoverFn = () => {};
  clicavel(trilho, () => {});
  const menos = botao(0.18, 0.14, '−', () => definir(st.inv - Sm.passo * 2));
  const mais = botao(0.18, 0.14, '+', () => definir(st.inv + Sm.passo * 2));
  place(menos, -23.5, 1.06, 2.2); place(mais, 23.5, 1.06, 2.2);
  g.add(menos, mais);
  const aviso = panel(2.4, 0.12, (ctx, W, H) => rich(ctx, Sm.aviso, 0, 1, W, 4.3, { color: COL.mute, align: 'center' }));
  place(aviso, 0, 2.42, 2.7);
  g.add(aviso);
  atualizar();
  addUpdater(g, (t, dt) => {
    const vel = 0.25 + (st.inv - Sm.min) / (Sm.max - Sm.min) * 0.6;
    gotas.forEach((s, i) => {
      s.userData.f = (s.userData.f + dt * vel * 0.5) % 1;
      const f = s.userData.f, y = lerp(2.15, 1.1, f), r = lerp(0.46, 0.12, f) * (0.3 + 0.7 * Math.abs(Math.sin(s.userData.a)));
      const a = s.userData.a + t * 0.8;
      const sobrevive = i / gotas.length < [1, 0.7, 0.45, 0.22][Math.min(3, Math.floor(f * 4))];
      s.position.set(centro.x + Math.sin(a) * r, y, centro.z + Math.cos(a) * r);
      s.material.color.set(f > 0.75 ? YEL : ORG);
      op(s, sobrevive ? Math.sin(f * Math.PI) * 0.9 : 0);
    });
    aneis.forEach((a, i) => { a.rotation.z = t * (0.3 + i * 0.1); });
  });
}

// ================================================================== 8. CTA ===
function cenaCta(g) {
  const C = K.cta;
  heading(g, C.eyebrow, C.titulo, { sub: C.texto, y: 2.2 });
  const assinar = card(1.0, 0.3, (ctx, W, H) => pill(ctx, W, H, C.assinar, { primary: true, size: 9 }), {}, () => escolher('assinar'));
  const atend = card(1.0, 0.3, (ctx, W, H) => pill(ctx, W, H, C.atendente, { size: 9 }), {}, () => escolher('atendente'));
  place(assinar, -13.5, 1.55, 2.4);
  place(atend, 13.5, 1.55, 2.4);
  g.add(assinar, atend);
  app.guiar(assinar);
  reveal(assinar, { delay: D + 0.4, owner: g });
  reveal(atend, { delay: D + 0.55, owner: g });
  const brilho = glow(1.6, YEL, 0.25); brilho.position.copy(assinar.position); brilho.position.z -= 0.05; g.add(brilho);
  addUpdater(g, t => op(brilho, 0.18 + 0.12 * Math.sin(t * 3)));
  let escolhido = false;
  function escolher(tipo) {
    if (escolhido) return;
    escolhido = true;
    leave(assinar, 0.3); leave(atend, 0.3); op(brilho, 0);
    app.avisarCloser(tipo).then(ok => {
      narrar(tipo);
      const c = panel(2.2, 0.5, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 7, accent: ok ? COL.yellow : COL.orange, strong: true });
        const y = rich(ctx, ok ? (tipo === 'assinar' ? C.okAssinar : C.okAtendente) : C.erroAviso, 12, 10, W - 24, 9.5,
          { font: F_HEAD, weight: 700, hi: COL.yellow, lh: 1.15 });
        if (ok) rich(ctx, C.tireOculos, 12, y + 4, W - 24, 6, { color: COL.mute });
      });
      place(c, 0, 1.55, 2.4);
      g.add(c);
      reveal(c, { owner: g });
      sfx('sucesso');
      confete(g);
      const voltar = botao(0.8, 0.18, C.voltar, () => app.encerrar());
      place(voltar, 0, 1.08, 2.4);
      g.add(voltar);
      reveal(voltar, { delay: 1.2, owner: g });
    });
    app.setNav({ back: null, next: null });
  }
}
function confete(g) {
  const ps = Array.from({ length: 60 }, (_, i) => {
    const s = glow(0.08 + Math.random() * 0.1, i % 3 ? ORG : YEL);
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2.2;
    s.userData.to = new THREE.Vector3(Math.cos(a) * r, 1.6 + Math.sin(a) * r * 0.7, -2.4 - Math.random() * 1.2);
    g.add(s);
    return s;
  });
  const de = new THREE.Vector3(0, 1.55, -2.4);
  tw(2.4, k => ps.forEach(s => { s.position.lerpVectors(de, s.userData.to, k); op(s, Math.sin(k * Math.PI) * 0.9); }), { ease: E.expo, owner: g });
}

export const CENAS = [
  { id: 'luz', fala: 'luz', build: cenaLuz },
  { id: 'metodo', fala: 'metodo', build: cenaMetodo },
  { id: 'entrada', fala: 'entrada', build: cenaEntrada },
  { id: 'estrutura', fala: 'estrutura', build: cenaEstrutura },
  { id: 'diagnostico', fala: 'diagnostico', build: cenaDiagnostico },
  { id: 'jornada', fala: 'jornada', build: cenaJornada },
  { id: 'acompanhamento', fala: 'acompanhamento', build: cenaAcompanhamento },
  { id: 'simulador', fala: 'simulador', build: cenaSimulador },
  { id: 'cta', fala: 'cta', build: cenaCta },
];
