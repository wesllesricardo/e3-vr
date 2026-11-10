// ============================================================================
// E3 Company · experiência VR (WebXR + Three.js)
// Roda no navegador do óculos (Meta Quest, Vision Pro, celular em suporte) e
// também em tela comum, para ensaio. Os textos ficam em conteudo.js.
// ============================================================================
import * as THREE from 'three';
import { CONTEUDO as K } from './conteudo.js';

const DEG = Math.PI / 180;
const ORG = 0xff5f1f, YEL = 0xffec00;
const COL = {
  bg: 0x070502, orange: '#FF5F1F', yellow: '#FFEC00', text: '#ECECEC', mute: '#A39E97',
  ink: '#0D0900', card: 'rgba(20,17,14,0.92)', line: 'rgba(255,255,255,0.12)',
};
const F_HEAD = '"Archivo", system-ui, sans-serif';
const F_BODY = '"Plus Jakarta Sans", system-ui, sans-serif';
const PPM = 800;          // pixels de textura por metro
const R = 3.2;            // distância padrão do conteúdo até o visitante (m)
const D = 0.35;           // atraso base das entradas de cena (s)
const OCIOSO = 150;       // segundos sem interação até voltar ao início
const OLHAR = 1.4;        // segundos de olhar fixo para "clicar" (sem controle)

const E = {
  out: k => 1 - Math.pow(1 - k, 3),
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  expo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- base 3D ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(1.2);
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);
const ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
scene.fog = new THREE.FogExp2(COL.bg, 0.04);

const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const world = new THREE.Group();   // cenas + navegação (sobe/desce conforme a altura do visitante)
scene.add(world);

function resize() {
  if (renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const vParaLargura = (2 * Math.atan(Math.tan(44 * DEG) / camera.aspect)) / DEG;
  camera.fov = clamp(vParaLargura, 58, 100);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- animações ---
const tweens = [];
function tw(dur, fn, { delay = 0, ease = E.out, done, owner } = {}) {
  fn(0);
  tweens.push({ dur, fn, delay, ease, done, owner, t: 0 });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    if (t.owner && (t.owner.userData.dead || t.owner.userData.leaving)) { tweens.splice(i, 1); continue; }
    if (t.delay > 0) { t.delay -= dt; continue; }
    t.t += dt;
    const k = Math.min(t.t / t.dur, 1);
    t.fn(t.ease(k));
    if (k >= 1) { tweens.splice(i, 1); if (t.done) t.done(); }
  }
}
const updaters = [];
function addUpdater(owner, fn) { updaters.push({ owner, fn, t: 0 }); }

// opacidade final de um material = base (o) x fator de entrada/saída (a)
function setAlpha(obj, a) {
  obj.traverse(n => {
    const m = n.material;
    if (!m) return;
    if (m.userData.o === undefined) m.userData.o = m.opacity;
    m.userData.a = a;
    m.opacity = m.userData.o * a;
  });
}
function op(mesh, v) {
  const m = mesh.material;
  m.userData.o = v;
  m.opacity = v * (m.userData.a ?? 1);
}
function reveal(o, { delay = 0, dy = 0.16, dur = 0.8, owner = current } = {}) {
  const y = o.position.y;
  tw(dur, k => {
    setAlpha(o, k);
    o.position.y = y - dy * (1 - k);
    o.scale.setScalar(0.9 + 0.1 * k);
  }, { delay, ease: E.expo, owner });
}
function leave(g) {
  g.userData.leaving = true;
  const mats = [];
  g.traverse(n => {
    const m = n.material;
    if (!m) return;
    if (m.userData.o === undefined) m.userData.o = m.opacity;
    mats.push([m, m.userData.a ?? 1]);
  });
  const z0 = g.position.z;
  tw(0.38, k => {
    for (const [m, a0] of mats) { m.userData.a = a0 * (1 - k); m.opacity = m.userData.o * m.userData.a; }
    g.position.z = z0 - 0.35 * k;
  }, { ease: E.inOut, done: () => kill(g) });
}
function isUnder(o, g) { for (let p = o; p; p = p.parent) if (p === g) return true; return false; }
function kill(g) {
  g.userData.dead = true;
  for (let i = hits.length - 1; i >= 0; i--) if (isUnder(hits[i], g)) hits.splice(i, 1);
  if (g.parent) g.parent.remove(g);
  g.traverse(n => {
    if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
    if (n.material) {
      const map = n.material.map;
      if (map && !map.userData.shared) map.dispose();
      n.material.dispose();
    }
  });
}

// ------------------------------------------------ texto e painéis (canvas) ---
// As funções de desenho trabalham em centímetros: um painel de 1,2 m tem W = 120.
function panel(w, h, draw, state = {}) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * PPM);
  cv.height = Math.round(h * PPM);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  mesh.renderOrder = 1;
  mesh.userData.state = state;
  mesh.userData.redraw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(PPM / 100, 0, 0, PPM / 100, 0, 0);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';
    draw(ctx, w * 100, h * 100, mesh.userData.state);
    tex.needsUpdate = true;
  };
  mesh.userData.redraw();
  return mesh;
}

// Texto com quebra de linha; *trechos entre asteriscos* saem na cor de destaque.
function rich(ctx, text, x, y, maxW, size, o = {}) {
  const { font = F_BODY, weight = 500, color = COL.text, hi = COL.orange, lh = 1.3, align = 'left', valign = 'top', dry = false } = o;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.letterSpacing = '0px';
  let on = false;
  const words = [];
  for (const raw of String(text).split(/\s+/)) {
    if (!raw) continue;
    const runs = [];
    raw.split('*').forEach((p, i) => {
      if (i > 0) on = !on;
      if (p) runs.push({ t: p, on, w: ctx.measureText(p).width });
    });
    if (runs.length) words.push({ runs, w: runs.reduce((a, r) => a + r.w, 0) });
  }
  const sp = ctx.measureText(' ').width;
  const lines = [];
  let line = [], lw = 0;
  for (const w of words) {
    const add = (line.length ? sp : 0) + w.w;
    if (line.length && lw + add > maxW) { lines.push({ line, lw }); line = [w]; lw = w.w; }
    else { line.push(w); lw += add; }
  }
  if (line.length) lines.push({ line, lw });
  const H = lines.length * size * lh;
  if (valign === 'bottom') y -= H;
  if (!dry) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((L, i) => {
      let cx = align === 'center' ? x + (maxW - L.lw) / 2 : x;
      const cy = y + i * size * lh;
      for (const w of L.line) {
        for (const r of w.runs) { ctx.fillStyle = r.on ? hi : color; ctx.fillText(r.t, cx, cy); cx += r.w; }
        cx += sp;
      }
    });
  }
  return y + H;
}
function eyebrow(ctx, t, x, y, maxW, { align = 'left', color = COL.orange, size = 4.6 } = {}) {
  ctx.font = `700 ${size}px ${F_BODY}`;
  ctx.letterSpacing = `${(size * 0.2).toFixed(2)}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(String(t).toUpperCase(), align === 'center' ? x + maxW / 2 : x, y);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  return y + size * 2;
}
function cardBg(ctx, W, H, { r = 5, accent = COL.orange, strong = false } = {}) {
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, r);
  ctx.fillStyle = COL.card;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, accent);
  if (strong) g.addColorStop(1, accent);
  else { g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.05)'); }
  ctx.lineWidth = strong ? 0.9 : 0.5;
  ctx.strokeStyle = g;
  ctx.stroke();
}
function fitFont(ctx, text, weight, size, font, maxW) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${font}`; s -= 0.5; } while (ctx.measureText(text).width > maxW && s > 4);
}

// ----------------------------------------------------- peças reutilizáveis ---
const hits = [];   // malhas clicáveis
function card(w, h, draw, state, onClick) {
  const grp = new THREE.Group();
  const m = panel(w, h, draw, state);
  grp.add(m);
  grp.userData.mesh = m;
  if (onClick) { m.userData.onClick = onClick; m.userData.h = 0; hits.push(m); }
  return grp;
}
function place(o, deg, y, r = R) {
  const a = deg * DEG;
  o.position.set(Math.sin(a) * r, y, -Math.cos(a) * r);
  o.rotation.y = -a;
  return o;
}
function mk(w, h, color, opacity = 1, additive = false) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  m.renderOrder = 2;
  return m;
}
function disc(r, color, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  m.renderOrder = 3;
  return m;
}
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  return t;
})();
function glow(size, color, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  s.renderOrder = 4;
  return s;
}
function heading(parent, eb, title, { size = 13, sub, delay = D, owner = current } = {}) {
  const h = 0.62;
  const p = panel(3.6, h, (ctx, W, H) => {
    const o = { font: F_HEAD, weight: 700, align: 'center', lh: 1.14 };
    const so = { color: COL.mute, align: 'center', weight: 500 };
    const th = rich(ctx, title, 0, 0, W, size, { ...o, dry: true });
    const sh = sub ? rich(ctx, sub, 0, 0, W, 4.6, { ...so, dry: true }) + 3 : 0;
    const y = H - 1 - sh - th;
    eyebrow(ctx, eb, 0, y - 10, W, { align: 'center' });
    rich(ctx, title, 0, y, W, size, o);
    if (sub) rich(ctx, sub, 0, y + th + 3, W, 4.6, so);
  });
  place(p, 0, 2.36 + h / 2);
  parent.add(p);
  reveal(p, { delay, owner });
  return p;
}

// ---------------------------------------------------------------- ambiente ---
const env = new THREE.Group();
scene.add(env);

const grid = new THREE.GridHelper(80, 80, 0x4a2a14, 0x231c15);
grid.material.transparent = true;
grid.material.opacity = 0.55;
env.add(grid);

const plat = new THREE.Mesh(
  new THREE.RingGeometry(1.25, 1.28, 96),
  new THREE.MeshBasicMaterial({ color: ORG, transparent: true, opacity: 0.8, depthWrite: false }),
);
plat.rotation.x = -Math.PI / 2;
plat.position.y = 0.01;
env.add(plat);
const pulse = plat.clone();
pulse.material = plat.material.clone();
env.add(pulse);

const stars = (() => {
  const N = 1500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = 5 + Math.random() * 17, th = Math.random() * Math.PI * 2;
    pos.set([Math.cos(th) * r, -1 + Math.random() * 11, Math.sin(th) * r], i * 3);
    const p = Math.random();
    c.set(p < 0.6 ? ORG : p < 0.75 ? YEL : 0xfff1e0).multiplyScalar(0.35 + Math.random() * 0.65);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.09, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
})();
env.add(stars);

const beamTex = (() => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,95,31,0)');
  g.addColorStop(0.5, 'rgba(255,125,55,1)');
  g.addColorStop(1, 'rgba(255,95,31,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in';
  const v = x.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.4, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0.2)');
  x.fillStyle = v;
  x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const beams = [-62, -40, -18, 7, 27, 50, 118, 176, -128].map((a, i) => {
  const b = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1 + (i % 3) * 0.5, 16),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  );
  place(b, a, 7.2, 13 + (i % 4) * 1.4);
  env.add(b);
  return b;
});

const rings = [9, 11.5, 14].map((r, i) => {
  const t = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.012, 6, 160),
    new THREE.MeshBasicMaterial({ color: i === 1 ? YEL : ORG, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  t.position.y = 2.5;
  t.rotation.set(1.1 + i * 0.5, i * 0.9, 0);
  env.add(t);
  return t;
});

const core = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.6, 1)),
  new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.22, depthWrite: false }),
);
core.position.set(0, 9.6, -12);
env.add(core);
const sun = glow(20, ORG, 0.22);
sun.position.set(0, 2.4, -16);
sun.renderOrder = 0;
env.add(sun);
let coreSpin = 0;

function updateEnv(T, dt) {
  stars.rotation.y = T * 0.012;
  rings.forEach((r, i) => { r.rotation.z = T * (0.03 + i * 0.012) * (i % 2 ? -1 : 1); });
  beams.forEach((b, i) => { b.material.opacity = 0.11 + 0.07 * Math.sin(T * 0.5 + i * 1.7); });
  coreSpin = Math.max(0, coreSpin - dt * 1.4);
  core.rotation.y += dt * (0.12 + coreSpin * 2.2);
  core.rotation.x += dt * 0.05;
  const k = (T * 0.35) % 1;
  pulse.scale.setScalar(1 + k * 1.4);
  pulse.material.opacity = 0.5 * (1 - k);
}

// ------------------------------------------------------------- navegação ---
function button(w, h, kind) {
  return card(w, h, (ctx, W, H, s) => {
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, W - 1, H - 1, (H - 1) / 2);
    if (kind === 'primary') { ctx.fillStyle = COL.yellow; ctx.fill(); ctx.fillStyle = COL.ink; }
    else {
      ctx.fillStyle = 'rgba(20,17,14,0.9)'; ctx.fill();
      ctx.lineWidth = 0.6; ctx.strokeStyle = COL.orange; ctx.stroke();
      ctx.fillStyle = COL.text;
    }
    fitFont(ctx, s.label || '', 700, H * 0.32, F_BODY, W - 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label || '', W / 2, H / 2 + 0.3);
  }, { label: '' }, () => {});
}
const nav = new THREE.Group();
nav.position.set(0, 0.72, -2.1);
nav.rotation.x = -0.3;
world.add(nav);
const btnNext = button(1.1, 0.26, 'primary');
const btnBack = button(0.66, 0.26, 'ghost');
nav.add(btnNext, btnBack);
const dots = panel(1.2, 0.06, (ctx, W, H, s) => {
  const seg = 7, act = 18, gap = 3, total = (s.n - 1) * (seg + gap) + act;
  let x = (W - total) / 2;
  for (let i = 0; i < s.n; i++) {
    const w = i === s.i ? act : seg;
    ctx.beginPath();
    ctx.roundRect(x, H / 2 - 0.8, w, 1.6, 0.8);
    ctx.fillStyle = i === s.i ? COL.orange : i < s.i ? 'rgba(255,95,31,0.45)' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    x += w + gap;
  }
}, { i: 0, n: 6 });
dots.position.y = 0.25;
nav.add(dots);

function setNav({ back = null, next = null }) {
  const apply = (b, cfg) => {
    b.visible = !!cfg;
    if (!cfg) return;
    const m = b.userData.mesh;
    if (m.userData.state.label !== cfg.label) { m.userData.state.label = cfg.label; m.userData.redraw(); }
    m.userData.onClick = cfg.fn;
  };
  apply(btnBack, back);
  apply(btnNext, next);
  if (back && next) { btnBack.position.x = -0.6; btnNext.position.x = 0.36; }
  else { btnBack.position.x = 0; btnNext.position.x = 0; }
}
function navPadrao() {
  const last = builders.length - 1;
  setNav({
    back: idx > 0 ? { label: '← Voltar', fn: () => goto(idx - 1) } : null,
    next: idx < last
      ? { label: idx === 0 ? 'Começar →' : 'Continuar →', fn: () => goto(idx + 1) }
      : { label: 'Recomeçar', fn: () => goto(0) },
  });
}

// ------------------------------------------------------------------ cenas ---
let current = null, idx = -1;

function buildAbertura(g) {
  const a = K.abertura;
  const logo = panel(1.7, 0.26, (ctx, W, H) => {
    ctx.textBaseline = 'middle';
    ctx.font = `800 17px ${F_HEAD}`;
    const w1 = ctx.measureText('E3').width;
    ctx.font = `700 9.5px ${F_HEAD}`;
    ctx.letterSpacing = '2.4px';
    const w2 = ctx.measureText('COMPANY').width;
    let x = (W - (w1 + 5 + w2)) / 2;
    ctx.letterSpacing = '0px';
    ctx.font = `800 17px ${F_HEAD}`;
    ctx.fillStyle = COL.orange;
    ctx.fillText('E3', x, H / 2);
    x += w1 + 5;
    ctx.font = `700 9.5px ${F_HEAD}`;
    ctx.letterSpacing = '2.4px';
    ctx.fillStyle = COL.text;
    ctx.fillText('COMPANY', x, H / 2 + 0.6);
  });
  place(logo, 0, 2.62);
  const head = panel(3.6, 1.0, (ctx, W) => {
    let y = eyebrow(ctx, a.eyebrow, 0, 4, W, { align: 'center' });
    y = rich(ctx, a.titulo, 10, y + 3, W - 20, 17, { font: F_HEAD, weight: 700, align: 'center', lh: 1.12 });
    rich(ctx, a.texto, 30, y + 6, W - 60, 6, { color: COL.mute, align: 'center', lh: 1.45 });
  });
  place(head, 0, 1.78);
  const selos = panel(3.4, 0.16, (ctx, W, H) => {
    ctx.font = `600 5px ${F_BODY}`;
    const gap = 12, dot = 5;
    const ws = a.selos.map(s => ctx.measureText(s).width + dot);
    let x = (W - (ws.reduce((p, c) => p + c, 0) + gap * (ws.length - 1))) / 2;
    ctx.textBaseline = 'middle';
    a.selos.forEach((s, i) => {
      ctx.fillStyle = COL.yellow;
      ctx.beginPath(); ctx.arc(x + 1.2, H / 2, 1.1, 0, 7); ctx.fill();
      ctx.fillStyle = COL.text;
      ctx.fillText(s, x + dot, H / 2 + 0.3);
      x += ws[i] + gap;
    });
  });
  place(selos, 0, 1.1);
  g.add(logo, head, selos);
  reveal(logo, { delay: D });
  reveal(head, { delay: D + 0.15 });
  reveal(selos, { delay: D + 0.45 });
}

function buildNumeros(g) {
  const n = K.numeros;
  heading(g, n.eyebrow, n.titulo);
  n.itens.forEach((it, i) => {
    const c = card(1.12, 0.9, (ctx, W, H, s) => {
      cardBg(ctx, W, H);
      ctx.fillStyle = COL.orange;
      ctx.fillRect(W / 2 - 7, 13, 14, 1);
      const str = it.prefixo + Math.round(it.valor * s.k).toLocaleString('pt-BR') + it.sufixo;
      fitFont(ctx, it.prefixo + it.valor.toLocaleString('pt-BR') + it.sufixo, 800, 22, F_HEAD, W - 16);
      ctx.fillStyle = COL.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, W / 2, 40);
      ctx.textAlign = 'left';
      ctx.font = `700 4.6px ${F_BODY}`;
      ctx.letterSpacing = '0.5px';
      const lbl = it.rotulo.toUpperCase();
      const lw = ctx.measureText(lbl).width;
      ctx.fillStyle = COL.mute;
      ctx.fillText(lbl, (W - lw) / 2, 66);
    }, { k: 0 });
    place(c, (i - 1.5) * 22, 1.5);
    g.add(c);
    reveal(c, { delay: D + 0.14 * i });
    const m = c.userData.mesh;
    tw(1.7, k => { m.userData.state.k = k; m.userData.redraw(); }, { delay: D + 0.35 + 0.14 * i, owner: g });
  });
  // curva de crescimento desenhada ao fundo
  const N = 100, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = (-44 + 88 * u) * DEG;
    const y = 0.7 + Math.pow(u, 2.1) * 2.1 + Math.sin(u * 15) * 0.05;
    pts.push(new THREE.Vector3(Math.sin(a) * 4.8, y, -Math.cos(a) * 4.8));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.75, depthWrite: false }));
  const ponta = glow(0.45, YEL);
  ponta.renderOrder = 0;
  g.add(ln, ponta);
  tw(2.6, k => {
    const j = Math.floor(k * N);
    geo.setDrawRange(0, j + 1);
    ponta.position.copy(pts[j]);
  }, { delay: D + 0.2, ease: E.inOut, owner: g });
}

function buildMetodo(g) {
  const m = K.metodo;
  heading(g, m.eyebrow, m.titulo);
  const cards = m.pilares.map((p, i) => {
    const c = card(1.2, 1.25, (ctx, W, H, s) => {
      cardBg(ctx, W, H, { strong: s.open, accent: s.open ? COL.yellow : COL.orange });
      if (!s.open) {
        ctx.font = `800 44px ${F_HEAD}`;
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = COL.orange;
        ctx.strokeText(p.n, 11, 12);
        rich(ctx, p.titulo, 12, 68, W - 24, 11, { font: F_HEAD, weight: 700, lh: 1.1 });
        ctx.font = `600 5px ${F_BODY}`;
        ctx.fillStyle = COL.mute;
        ctx.fillText('+  ' + m.dica, 12, H - 17);
      } else {
        eyebrow(ctx, 'Pilar ' + p.n, 12, 13, W - 24, { color: COL.yellow });
        const y = rich(ctx, p.titulo, 12, 24, W - 24, 11, { font: F_HEAD, weight: 700, lh: 1.1 });
        rich(ctx, p.texto, 12, y + 8, W - 24, 6.6, { lh: 1.45 });
      }
    }, { open: false }, () => toggle(i));
    place(c, (i - 1) * 24, 1.46);
    g.add(c);
    reveal(c, { delay: D + 0.16 * i });
    return c;
  });
  function toggle(i) {
    cards.forEach((c, j) => {
      const s = c.userData.mesh.userData.state;
      const open = j === i ? !s.open : false;
      if (open !== s.open) { s.open = open; c.userData.mesh.userData.redraw(); }
    });
  }
  // pulsos passando de um pilar ao outro
  const ps = [0, 1, 2, 3, 4].map(() => { const s = glow(0.16, ORG); s.renderOrder = 0; g.add(s); return s; });
  addUpdater(g, t => ps.forEach((s, j) => {
    const u = (t * 0.16 + j / ps.length) % 1, a = (-40 + 80 * u) * DEG;
    s.position.set(Math.sin(a) * 3.3, 1.46 + Math.sin(u * 9) * 0.04, -Math.cos(a) * 3.3);
    op(s, Math.sin(u * Math.PI));
    s.material.color.set(u > 0.66 ? YEL : ORG);
  }));
}

// pequenas animações que acompanham cada módulo da estrutura
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
    const ds = Array.from({ length: 10 }, (_, j) => { const d = disc(0.03, ORG); v.add(d); return d; });
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
      const cta = bl[6];
      cta.scale.setScalar(1 + (cyc > 2.4 ? 0.07 * Math.abs(Math.sin((cyc - 2.4) * 3.2)) : 0));
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
      ticks.forEach((tk, i) => {
        const lit = i / N < p;
        tk.material.color.set(lit && i / N > 0.75 ? YEL : ORG);
        op(tk, lit ? 1 : 0.12);
      });
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

function buildEstrutura(g) {
  const e = K.estrutura, vistos = new Set();
  let sub = null;

  function trocar(fn) {
    if (sub) leave(sub);
    sub = new THREE.Group();
    g.add(sub);
    fn(sub);
  }
  function mostrarGrade(delay) {
    trocar(s => {
      const dica = vistos.size ? `${e.dica} · ${vistos.size} de ${e.modulos.length} vistos` : e.dica;
      heading(s, e.eyebrow, e.titulo, { sub: dica, delay, owner: s });
      e.modulos.forEach((m, i) => {
        const c = card(1.1, 0.66, (ctx, W, H) => {
          const visto = vistos.has(i);
          cardBg(ctx, W, H, { accent: visto ? COL.yellow : COL.orange });
          ctx.font = `700 5px ${F_BODY}`;
          ctx.fillStyle = COL.orange;
          ctx.fillText(m.n, 9, 8.5);
          if (visto) {
            ctx.font = `700 3.8px ${F_BODY}`;
            ctx.letterSpacing = '0.5px';
            ctx.fillStyle = COL.yellow;
            ctx.textAlign = 'right';
            ctx.fillText('VISTO', W - 9, 9.5);
            ctx.textAlign = 'left';
            ctx.letterSpacing = '0px';
          }
          rich(ctx, m.titulo, 9, 19, W - 18, 8.4, { font: F_HEAD, weight: 700, lh: 1.1 });
          rich(ctx, m.chamada, 9, H - 8, W - 18, 4.5, { color: COL.mute, lh: 1.3, valign: 'bottom' });
        }, {}, () => abrir(i));
        place(c, ((i % 3) - 1) * 21.5, i < 3 ? 1.9 : 1.16);
        s.add(c);
        reveal(c, { delay: delay + 0.07 * i, owner: s });
      });
    });
    navPadrao();
  }
  function abrir(i) {
    vistos.add(i);
    const m = e.modulos[i], ultimo = i === e.modulos.length - 1;
    trocar(s => {
      const txt = panel(2.0, 1.7, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 6 });
        const x = 13, w = W - 26;
        let y = 13;
        ctx.font = `700 4.4px ${F_BODY}`;
        ctx.letterSpacing = '0.8px';
        ctx.fillStyle = COL.orange;
        ctx.fillText(`${m.n} / 0${e.modulos.length}  ·  ESTRUTURA E3`, x, y);
        ctx.letterSpacing = '0px';
        y = rich(ctx, m.titulo, x, y + 11, w, 13, { font: F_HEAD, weight: 700, lh: 1.1 }) + 5;
        y = rich(ctx, m.chamada, x, y, w, 7, { weight: 600, lh: 1.3 }) + 5;
        y = rich(ctx, m.texto, x, y, w, 5.6, { color: COL.mute, lh: 1.45 }) + 7;
        ctx.fillStyle = COL.line;
        ctx.fillRect(x, y, w, 0.3);
        y += 7;
        for (const b of m.itens) {
          ctx.strokeStyle = COL.orange;
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + 0.5, y + 3.6); ctx.lineTo(x + 2.4, y + 5.5); ctx.lineTo(x + 5.6, y + 1.6);
          ctx.stroke();
          y = rich(ctx, b, x + 10, y, w - 10, 5.4, { lh: 1.35 }) + 3.5;
        }
      });
      place(txt, -12, 1.62);
      s.add(txt);
      reveal(txt, { delay: 0.3, owner: s });

      const v = new THREE.Group();
      const fundo = panel(1.15, 1.15, (ctx, W, H) => cardBg(ctx, W, H, { r: 6 }));
      v.add(fundo);
      const upd = VIS[m.id] ? VIS[m.id](v) : null;
      place(v, 24.5, 1.62, 3.0);
      s.add(v);
      reveal(v, { delay: 0.45, owner: s });
      if (upd) addUpdater(s, t => upd(Math.max(0, t - 0.5)));
    });
    setNav({
      back: { label: '← Módulos', fn: () => mostrarGrade(0.3) },
      next: ultimo
        ? { label: 'Continuar →', fn: () => goto(idx + 1) }
        : { label: 'Próximo módulo →', fn: () => abrir(i + 1) },
    });
  }
  mostrarGrade(D);
}

function buildPorque(g) {
  const p = K.porque;
  heading(g, p.eyebrow, p.titulo);
  const n = p.etapas.length;
  p.etapas.forEach((s, i) => {
    const fim = i === n - 1;
    const c = panel(0.8, 0.2, (ctx, W, H) => {
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, W - 1, H - 1, (H - 1) / 2);
      ctx.fillStyle = fim ? COL.yellow : COL.card;
      ctx.fill();
      if (!fim) { ctx.lineWidth = 0.5; ctx.strokeStyle = COL.orange; ctx.stroke(); }
      fitFont(ctx, s, 700, 5.6, F_BODY, W - 10);
      ctx.fillStyle = fim ? COL.ink : COL.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, W / 2, H / 2 + 0.3);
    });
    place(c, (i - (n - 1) / 2) * 17.5, 1.9);
    g.add(c);
    reveal(c, { delay: D + 0.16 * i });
  });
  const ps = [0, 1, 2, 3, 4, 5].map(() => { const s = glow(0.14, ORG); s.renderOrder = 0; g.add(s); return s; });
  addUpdater(g, t => ps.forEach((s, j) => {
    const u = (t * 0.13 + j / ps.length) % 1, a = (-37 + 74 * u) * DEG;
    s.position.set(Math.sin(a) * 3.26, 1.9, -Math.cos(a) * 3.26);
    op(s, Math.min(1, t * 0.6) * Math.sin(u * Math.PI));
    s.material.color.set(u > 0.8 ? YEL : ORG);
  }));
  p.fatos.forEach((f, i) => {
    const c = card(1.12, 0.7, (ctx, W, H) => {
      cardBg(ctx, W, H);
      const y = rich(ctx, f.t, 9, 9, W - 18, 6.4, { font: F_HEAD, weight: 700, lh: 1.15 });
      rich(ctx, f.d, 9, y + 3.5, W - 18, 5, { color: COL.mute, lh: 1.38 });
    });
    place(c, (i - 1.5) * 22, 1.24);
    g.add(c);
    reveal(c, { delay: D + 0.5 + 0.12 * i });
  });
}

function buildCta(g) {
  const c = K.cta;
  const head = panel(3.6, 1.0, (ctx, W) => {
    let y = eyebrow(ctx, c.eyebrow, 0, 4, W, { align: 'center' });
    y = rich(ctx, c.titulo, 10, y + 3, W - 20, 17, { font: F_HEAD, weight: 700, align: 'center', lh: 1.12 });
    rich(ctx, c.texto, 30, y + 7, W - 60, 6, { color: COL.mute, align: 'center', lh: 1.45 });
  });
  place(head, 0, 2.02);
  const label = renderer.xr.isPresenting ? c.chipVR : c.chipTela;
  const chip = panel(2.4, 0.3, (ctx, W, H) => {
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, W - 1, H - 1, (H - 1) / 2);
    ctx.fillStyle = COL.yellow;
    ctx.fill();
    fitFont(ctx, label, 700, 9, F_BODY, W - 24);
    ctx.fillStyle = COL.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2 + 0.4);
  });
  place(chip, 0, 1.2);
  g.add(head, chip);
  reveal(head, { delay: D });
  reveal(chip, { delay: D + 0.5 });
  // explosão de partículas
  const ps = Array.from({ length: 46 }, (_, i) => {
    const s = glow(0.1 + Math.random() * 0.12, i % 3 ? ORG : YEL);
    const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 2.6;
    s.userData.to = new THREE.Vector3(Math.cos(a) * r, 1.9 + Math.sin(a) * r * 0.6, -3.6 - Math.random());
    g.add(s);
    return s;
  });
  const from = new THREE.Vector3(0, 1.9, -3.8);
  tw(2.2, k => ps.forEach(s => { s.position.lerpVectors(from, s.userData.to, k); op(s, Math.sin(k * Math.PI) * 0.9); }), { delay: D + 0.2, ease: E.expo, owner: g });
}

const builders = [buildAbertura, buildNumeros, buildMetodo, buildEstrutura, buildPorque, buildCta];

function goto(i) {
  i = clamp(i, 0, builders.length - 1);
  if (current) leave(current);
  idx = i;
  current = new THREE.Group();
  world.add(current);
  navPadrao();
  builders[i](current);
  dots.userData.state.i = i;
  dots.userData.redraw();
  coreSpin = 1;
  tocou();
  if (i === 0 && renderer.xr.isPresenting) calibrar();
}

// ---------------------------------------------------------------- som leve ---
let actx = null;
function blip(f = 660, d = 0.09, v = 0.05) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), gn = actx.createGain(), t = actx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
    gn.gain.setValueAtTime(v, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(actx.destination);
    o.start(t);
    o.stop(t + d);
  } catch (err) { /* sem áudio, segue */ }
}

// -------------------------------------------------------------- interação ---
const raycaster = new THREE.Raycaster();
raycaster.far = 14;
const tmpM = new THREE.Matrix4(), ro = new THREE.Vector3(), rd = new THREE.Vector3();
let lastInput = 0, T = 0;
function tocou() { lastInput = T; }

function isLive(m) {
  for (let p = m; p; p = p.parent) {
    if (!p.visible || p.userData.leaving || p.userData.dead) return false;
    if (p === scene) return true;
  }
  return false;
}
function cast() {
  const r = raycaster.intersectObjects(hits.filter(isLive), false);
  return r.length ? r[0] : null;
}
function click(mesh, ctrl) {
  tocou();
  mesh.userData.h = 1.9;
  blip(720, 0.1, 0.06);
  const gp = ctrl && ctrl.userData.src && ctrl.userData.src.gamepad;
  if (gp && gp.hapticActuators && gp.hapticActuators[0]) gp.hapticActuators[0].pulse(0.6, 45);
  mesh.userData.onClick();
}

// controles e mãos (raio) --------------------------------------------------
const ctrls = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.85, depthTest: false, fog: false }),
  );
  line.renderOrder = 20;
  line.visible = false;
  c.add(line);
  const tip = glow(0.07, YEL);
  tip.material.depthTest = false;
  tip.renderOrder = 21;
  tip.visible = false;
  scene.add(tip);
  c.userData = { on: false, mode: null, src: null, line, tip };
  c.addEventListener('connected', e => { c.userData.on = true; c.userData.mode = e.data.targetRayMode; c.userData.src = e.data; });
  c.addEventListener('disconnected', () => { c.userData.on = false; line.visible = false; tip.visible = false; });
  c.addEventListener('select', () => {
    rayFrom(c);
    const h = cast();
    if (h) click(h.object, c); else tocou();
  });
  rig.add(c);
  return c;
});
function rayFrom(c) {
  tmpM.identity().extractRotation(c.matrixWorld);
  ro.setFromMatrixPosition(c.matrixWorld);
  rd.set(0, 0, -1).applyMatrix4(tmpM);
  raycaster.set(ro, rd);
}

// olhar fixo (sem controle) --------------------------------------------------
const reticle = new THREE.Group();
const retRing = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.022, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
const retFill = new THREE.Mesh(new THREE.CircleGeometry(0.015, 32), new THREE.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.95, depthTest: false, fog: false }));
retRing.renderOrder = 22;
retFill.renderOrder = 23;
reticle.add(retRing, retFill);
reticle.position.z = -1.5;
reticle.visible = false;
camera.add(reticle);
let gazeAlvo = null, gazeT = 0, gazeFeito = false;

// mouse / toque ---------------------------------------------------------------
const el = renderer.domElement;
const mouse = new THREE.Vector2(9, 9);
let mouseIn = false, down = null, drag = false, yaw = 0, pitch = 0, tyaw = 0, tpitch = 0;
function setMouse(e) {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}
el.addEventListener('pointerdown', e => { setMouse(e); down = { x: e.clientX, y: e.clientY, yaw: tyaw, pitch: tpitch }; drag = false; });
el.addEventListener('pointermove', e => {
  setMouse(e);
  mouseIn = true;
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 6) drag = true;
    if (drag) { tyaw = clamp(down.yaw + dx * 0.0032, -1.4, 1.4); tpitch = clamp(down.pitch + dy * 0.0032, -0.5, 0.5); tocou(); }
  }
});
el.addEventListener('pointerup', e => {
  if (down && !drag && !renderer.xr.isPresenting) {
    setMouse(e);
    raycaster.setFromCamera(mouse, camera);
    const h = cast();
    if (h) click(h.object);
  }
  down = null;
});
el.addEventListener('pointerleave', () => { mouseIn = false; down = null; });
window.addEventListener('keydown', e => {
  if (!iniciou) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { if (btnNext.visible) click(btnNext.userData.mesh); }
  else if (e.key === 'ArrowLeft') { if (btnBack.visible) click(btnBack.userData.mesh); }
  else if (e.key === 'r' || e.key === 'R') goto(0);
});

const hov = new Set();
let hovAntes = null;
function updatePointers(dt) {
  hov.clear();
  const xr = renderer.xr.isPresenting;
  let comRaio = false;
  if (xr) {
    for (const c of ctrls) {
      const u = c.userData, ativo = u.on && u.mode === 'tracked-pointer';
      u.line.visible = ativo;
      u.tip.visible = false;
      if (!ativo) continue;
      comRaio = true;
      rayFrom(c);
      const h = cast();
      u.line.scale.z = h ? h.distance : 4;
      if (h) { hov.add(h.object); u.tip.visible = true; u.tip.position.copy(h.point); }
    }
  }
  const gaze = xr && !comRaio;
  reticle.visible = gaze;
  if (gaze) {
    camera.getWorldPosition(ro);
    camera.getWorldDirection(rd);
    raycaster.set(ro, rd);
    const h = cast();
    if (h) {
      hov.add(h.object);
      if (h.object !== gazeAlvo) { gazeAlvo = h.object; gazeT = 0; gazeFeito = false; }
      else if (!gazeFeito) {
        gazeT += dt;
        if (gazeT >= OLHAR) { gazeFeito = true; gazeT = 0; click(h.object); }
      }
    } else { gazeAlvo = null; gazeT = 0; gazeFeito = false; }
    retFill.scale.setScalar(Math.max(0.001, gazeT / OLHAR));
  }
  if (!xr && mouseIn && !drag) {
    raycaster.setFromCamera(mouse, camera);
    const h = cast();
    if (h) hov.add(h.object);
    el.style.cursor = h ? 'pointer' : down ? 'grabbing' : 'grab';
  }
  const primeiro = hov.values().next().value || null;
  if (primeiro && primeiro !== hovAntes) { blip(520, 0.05, 0.018); tocou(); }
  hovAntes = primeiro;
  const k = 1 - Math.exp(-dt * 14);
  for (const m of hits) {
    const u = m.userData;
    u.h += ((hov.has(m) ? 1 : 0) - u.h) * k;
    m.scale.setScalar(1 + 0.05 * u.h);
    m.position.z = 0.07 * Math.min(u.h, 1);
    m.material.color.setScalar(0.86 + 0.14 * clamp(u.h, 0, 1));
  }
}

// ------------------------------------------------------------------ sessão ---
// Ajusta a altura do conteúdo à altura dos olhos de quem está usando o óculos.
function calibrar() {
  setTimeout(() => {
    if (!renderer.xr.isPresenting) return;
    camera.getWorldPosition(ro);
    world.position.y = clamp(ro.y - 1.6, -0.7, 0.35);
  }, 700);
}
let hiddenAt = 0, iniciou = false;
async function entrarVR() {
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    session.addEventListener('visibilitychange', () => {
      // óculos tirado do rosto e recolocado: novo visitante, volta ao início
      if (session.visibilityState !== 'visible') hiddenAt = performance.now();
      else if (hiddenAt && performance.now() - hiddenAt > 6000) { hiddenAt = 0; goto(0); }
    });
    await renderer.xr.setSession(session);
    iniciar();
    goto(0);
  } catch (err) {
    status('Não foi possível iniciar o modo VR neste aparelho: ' + (err && err.message ? err.message : err));
  }
}
renderer.xr.addEventListener('sessionend', () => {
  world.position.y = 0;
  camera.position.set(0, 1.6, 0);
  camera.rotation.set(0, 0, 0);
  yaw = pitch = tyaw = tpitch = 0;
  resize();
  goto(0);
});

// ------------------------------------------------------------------- telas ---
const $ = id => document.getElementById(id);
function status(t) { $('status').textContent = t; }
function iniciar() {
  iniciou = true;
  $('intro').classList.add('off');
  $('hud').classList.remove('off');
  tocou();
}
$('entrarTela').addEventListener('click', () => { iniciar(); blip(720, 0.1, 0.05); });
$('entrarVR').addEventListener('click', entrarVR);
$('vrHud').addEventListener('click', entrarVR);

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    $('entrarVR').hidden = !ok;
    $('vrHud').hidden = !ok;
    status(ok ? 'Óculos detectado. Toque em "Entrar em VR".' : 'Modo tela. Abra este endereço no navegador do óculos para a versão imersiva.');
  }).catch(() => status('Modo tela.'));
} else {
  status('Modo tela. Abra este endereço no navegador do óculos para a versão imersiva.');
}

// -------------------------------------------------------------------- loop ---
const clock = new THREE.Clock();
function frame() {
  sim(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}
function sim(dt) {
  T += dt;
  updateTweens(dt);
  updateEnv(T, dt);
  for (let i = updaters.length - 1; i >= 0; i--) {
    const u = updaters[i];
    if (u.owner.userData.dead) { updaters.splice(i, 1); continue; }
    if (u.owner.userData.leaving) continue;
    u.t += dt;
    u.fn(u.t, dt);
  }
  updatePointers(dt);
  if (!renderer.xr.isPresenting) {
    const k = 1 - Math.exp(-dt * 8);
    const px = mouseIn && !down ? -mouse.x * 0.05 : 0, py = mouseIn && !down ? mouse.y * 0.03 : 0;
    yaw += (tyaw + px - yaw) * k;
    pitch += (tpitch + py - pitch) * k;
    camera.rotation.set(pitch, yaw, 0);
  }
  if (iniciou && idx > 0 && T - lastInput > OCIOSO) goto(0);
}

async function boot() {
  const fontes = ['700 20px "Archivo"', '800 20px "Archivo"', '500 20px "Plus Jakarta Sans"', '600 20px "Plus Jakarta Sans"', '700 20px "Plus Jakarta Sans"'];
  await Promise.race([
    Promise.all(fontes.map(f => document.fonts.load(f))).catch(() => {}),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  const q = new URLSearchParams(location.search);
  goto(q.has('cena') ? Number(q.get('cena')) || 0 : 0);
  if (q.has('cena')) iniciar();
  renderer.setAnimationLoop(frame);
  // apoio a testes: avança a simulação sem esperar o relógio
  const avancar = s => { for (let i = 0; i < s * 30; i++) sim(1 / 30); renderer.render(scene, camera); };
  window.__e3 = { goto, avancar, get cena() { return idx; }, hits, scene, camera };
}
boot();
