// =============================================================================
// Motor: renderizador, animações, texto em textura e interação
// (controle, mãos, olhar e mouse). Sem conteúdo da E3 aqui.
// =============================================================================
import * as THREE from 'three';
export { THREE };

export const DEG = Math.PI / 180;
export const ORG = 0xff5f1f, YEL = 0xffec00, FRIO = 0x9db2c6;
export const COL = {
  orange: '#FF5F1F', yellow: '#FFEC00', text: '#ECECEC', mute: '#A9A39C', ink: '#0D0900',
  card: 'rgba(20,16,12,0.9)', line: 'rgba(255,255,255,0.12)',
  frio: '#A9BCCD', frioMute: '#6B7C8C', cardFrio: 'rgba(10,14,19,0.88)',
};
export const F_HEAD = '"Archivo", system-ui, sans-serif';
export const F_BODY = '"Plus Jakarta Sans", system-ui, sans-serif';
export const PPM = 900;     // pixels de textura por metro (nitidez do texto)
export const R = 2.8;       // distância padrão do conteúdo (m)
export const OLHAR = 1.3;   // segundos de olhar fixo para "clicar"

export const E = {
  out: k => 1 - Math.pow(1 - k, 3),
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  expo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  back: k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  lin: k => k,
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;

// Estado global e ganchos que o app preenche (evita import circular).
export const S = { T: 0, lastInput: 0, iniciou: false };
export const hooks = { clique: () => {}, hover: () => {}, pegar: () => {}, soltar: () => {} };
// Funções do app (goto, setNav, narrar...) registradas em app.js.
export const app = { estado: { respostas: {}, programa: null } };
export function tocou() { S.lastInput = S.T; }

// ---------------------------------------------------------------- base 3D ---
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(1.25);   // Quest 3S: supersampling deixa o texto mais nítido
renderer.xr.setFoveation(0.5);
document.body.appendChild(renderer.domElement);
export const ANISO = renderer.capabilities.getMaxAnisotropy();

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070502, 0.028);
export const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 120);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0);
export const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

// "world" usa um referencial fixo: frente (-Z) é a luz da E3, trás (+Z) o lado
// sombrio, direita (+X) depoimentos, esquerda (-X) cases. No início ele é girado
// para o visitante ficar de frente para o lado sombrio.
export const world = new THREE.Group();
scene.add(world);
function face(yawDeg) { const g = new THREE.Group(); g.rotation.y = yawDeg * DEG; world.add(g); return g; }
export const FRENTE = face(0), DIREITA = face(-90), ESQUERDA = face(90), TRAS = face(180);

export function resize() {
  if (renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const v = (2 * Math.atan(Math.tan(44 * DEG) / camera.aspect)) / DEG;
  camera.fov = clamp(v, 58, 100);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- animações ---
const tweens = [];
export function tw(dur, fn, { delay = 0, ease = E.out, done, owner } = {}) {
  fn(0);
  tweens.push({ dur, fn, delay, ease, done, owner, t: 0 });
}
export function updateTweens(dt) {
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
export function addUpdater(owner, fn) { updaters.push({ owner, fn, t: 0 }); }
export function updateUpdaters(dt) {
  for (let i = updaters.length - 1; i >= 0; i--) {
    const u = updaters[i];
    if (u.owner && u.owner.userData.dead) { updaters.splice(i, 1); continue; }
    if (u.owner && u.owner.userData.leaving) continue;
    u.t += dt;
    u.fn(u.t, dt);
  }
}

// opacidade final = base (o) × fator de entrada/saída (a)
export function setAlpha(obj, a) {
  obj.traverse(n => {
    const m = n.material;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (mm.userData.o === undefined) mm.userData.o = mm.opacity;
      mm.userData.a = a;
      mm.opacity = mm.userData.o * a;
      mm.transparent = true;
    }
  });
}
export function op(mesh, v) {
  const m = mesh.material;
  m.userData.o = v;
  m.opacity = v * (m.userData.a ?? 1);
}
export function reveal(o, { delay = 0, dy = 0.14, dur = 0.8, owner = null, escala = true } = {}) {
  const y = o.position.y;
  tw(dur, k => {
    setAlpha(o, k);
    o.position.y = y - dy * (1 - k);
    if (escala) o.scale.setScalar(0.92 + 0.08 * k);
  }, { delay, ease: E.expo, owner });
}
export function leave(g, dur = 0.4) {
  if (!g || g.userData.leaving) return;
  g.userData.leaving = true;
  if (g.userData.aoSair) g.userData.aoSair();
  const mats = [];
  g.traverse(n => {
    const m = n.material;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (mm.userData.o === undefined) mm.userData.o = mm.opacity;
      mm.transparent = true;
      mats.push([mm, mm.userData.a ?? 1]);
    }
  });
  const z0 = g.position.z;
  tw(dur, k => {
    for (const [m, a0] of mats) { m.userData.a = a0 * (1 - k); m.opacity = m.userData.o * m.userData.a; }
    g.position.z = z0 - 0.3 * k;
  }, { ease: E.inOut, done: () => kill(g) });
}
function isUnder(o, g) { for (let p = o; p; p = p.parent) if (p === g) return true; return false; }
export function kill(g) {
  g.userData.dead = true;
  for (let i = hits.length - 1; i >= 0; i--) if (isUnder(hits[i], g)) hits.splice(i, 1);
  if (g.parent) g.parent.remove(g);
  g.traverse(n => {
    if (n.userData.video) { try { n.userData.video.pause(); } catch (e) { /* nada */ } }
    if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
    if (n.material) {
      for (const mm of Array.isArray(n.material) ? n.material : [n.material]) {
        if (mm.map && !mm.map.userData.shared) mm.map.dispose();
        mm.dispose();
      }
    }
  });
}

// ------------------------------------------------ texto e painéis (canvas) ---
// Funções de desenho trabalham em centímetros: um painel de 1,2 m tem W = 120.
export function panel(w, h, draw, state = {}) {
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

export function rich(ctx, text, x, y, maxW, size, o = {}) {
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
  if (valign === 'middle') y -= H / 2;
  if (!dry) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((L, i) => {
      let cx = align === 'center' ? x + (maxW - L.lw) / 2 : align === 'right' ? x + maxW - L.lw : x;
      const cy = y + i * size * lh;
      for (const w of L.line) {
        for (const r of w.runs) { ctx.fillStyle = r.on ? hi : color; ctx.fillText(r.t, cx, cy); cx += r.w; }
        cx += sp;
      }
    });
  }
  return y + H;
}
export function eyebrow(ctx, t, x, y, maxW, { align = 'left', color = COL.orange, size = 4.6 } = {}) {
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
export function cardBg(ctx, W, H, { r = 5, accent = COL.orange, strong = false, fill = COL.card } = {}) {
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, r);
  ctx.fillStyle = fill;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, accent);
  if (strong) g.addColorStop(1, accent);
  else { g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.05)'); }
  ctx.lineWidth = strong ? 0.9 : 0.5;
  ctx.strokeStyle = g;
  ctx.stroke();
}
export function fitFont(ctx, text, weight, size, font, maxW) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${font}`; s -= 0.5; } while (ctx.measureText(text).width > maxW && s > 4);
}
export function pill(ctx, W, H, label, { primary = false, fill, stroke, color, size } = {}) {
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, (H - 1) / 2);
  ctx.fillStyle = fill || (primary ? COL.yellow : 'rgba(20,16,12,0.92)');
  ctx.fill();
  if (!primary) { ctx.lineWidth = 0.6; ctx.strokeStyle = stroke || COL.orange; ctx.stroke(); }
  fitFont(ctx, label, 700, size || H * 0.34, F_BODY, W - 10);
  ctx.fillStyle = color || (primary ? COL.ink : COL.text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, H / 2 + 0.3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

// ----------------------------------------------------- peças reutilizáveis ---
export const hits = [];
export function card(w, h, draw, state, onClick) {
  const grp = new THREE.Group();
  const m = panel(w, h, draw, state);
  grp.add(m);
  grp.userData.mesh = m;
  if (onClick) clicavel(m, onClick);
  return grp;
}
export function clicavel(mesh, onClick) {
  mesh.userData.onClick = onClick;
  mesh.userData.h = 0;
  if (!hits.includes(mesh)) hits.push(mesh);
  return mesh;
}
export function botao(w, h, label, onClick, { primary = false } = {}) {
  return card(w, h, (ctx, W, H, s) => pill(ctx, W, H, s.label, { primary: s.primary }), { label, primary }, onClick);
}
export function setLabel(btn, label) {
  const m = btn.userData.mesh;
  if (m.userData.state.label !== label) { m.userData.state.label = label; m.userData.redraw(); }
}
// Posiciona num arco à frente do grupo: graus positivos = à direita do visitante.
export function place(o, deg, y, r = R) {
  const a = deg * DEG;
  o.position.set(Math.sin(a) * r, y, -Math.cos(a) * r);
  o.rotation.y = -a;
  return o;
}
export function mk(w, h, color, opacity = 1, additive = false) {
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
export function disc(r, color, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  m.renderOrder = 3;
  return m;
}
export const dotTex = (() => {
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
export function glow(size, color, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  s.renderOrder = 4;
  return s;
}

// -------------------------------------------------------------- interação ---
const raycaster = new THREE.Raycaster();
raycaster.far = 30;
const tmpM = new THREE.Matrix4(), ro = new THREE.Vector3(), rd = new THREE.Vector3();

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
export function click(mesh, ctrl) {
  tocou();
  mesh.userData.h = 1.9;
  hooks.clique(mesh);
  const gp = ctrl && ctrl.userData.src && ctrl.userData.src.gamepad;
  if (gp && gp.hapticActuators && gp.hapticActuators[0]) gp.hapticActuators[0].pulse(0.6, 45);
  if (mesh.userData.onClick) mesh.userData.onClick();
}
function rayFrom(c) {
  tmpM.identity().extractRotation(c.matrixWorld);
  ro.setFromMatrixPosition(c.matrixWorld);
  rd.set(0, 0, -1).applyMatrix4(tmpM);
  raycaster.set(ro, rd);
}

// pegar (objeto acompanha o controle/mão) ------------------------------------
function iniciarPega(c, mesh) {
  const obj = mesh.userData.grab;
  const info = { obj, mesh, parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone(), t0: S.T };
  obj.userData.held = true;
  c.attach(obj);
  c.userData.held = info;
  hooks.pegar(mesh);
  if (mesh.userData.onGrab) mesh.userData.onGrab();
}
function soltarPega(c) {
  const i = c.userData.held;
  c.userData.held = null;
  if (!i) return;
  i.parent.attach(i.obj);
  const p0 = i.obj.position.clone(), q0 = i.obj.quaternion.clone();
  tw(0.8, k => { i.obj.position.lerpVectors(p0, i.pos, k); i.obj.quaternion.slerpQuaternions(q0, i.quat, k); },
    { ease: E.back, done: () => { i.obj.userData.held = false; } });
  hooks.soltar(i.mesh);
  if (i.mesh.userData.onRelease) i.mesh.userData.onRelease();
  if (S.T - i.t0 < 0.3 && i.mesh.userData.onClick) click(i.mesh, c);
}

export const ctrls = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.85, depthTest: false, fog: false }),
  );
  line.renderOrder = 20;
  line.visible = false;
  c.add(line);
  const tip = glow(0.06, YEL);
  tip.material.depthTest = false;
  tip.renderOrder = 21;
  tip.visible = false;
  scene.add(tip);
  c.userData = { on: false, mode: null, src: null, line, tip, press: null, held: null, drag: null };
  c.addEventListener('connected', e => { c.userData.on = true; c.userData.mode = e.data.targetRayMode; c.userData.src = e.data; });
  c.addEventListener('disconnected', () => {
    if (c.userData.held) soltarPega(c);
    c.userData.on = false; line.visible = false; tip.visible = false;
  });
  const down = () => {
    tocou();
    rayFrom(c);
    const h = cast();
    c.userData.press = h ? h.object : null;
    if (!h) return;
    const u = h.object.userData;
    if (u.grab && !u.grab.userData.held) iniciarPega(c, h.object);
    else if (u.drag) { c.userData.drag = h.object; u.drag(h.point, 'start'); }
  };
  const up = () => {
    if (c.userData.held) { soltarPega(c); c.userData.press = null; return; }
    if (c.userData.drag) { c.userData.drag.userData.drag(null, 'end'); c.userData.drag = null; c.userData.press = null; return; }
    rayFrom(c);
    const h = cast();
    if (h && h.object === c.userData.press && h.object.userData.onClick) click(h.object, c);
    c.userData.press = null;
  };
  c.addEventListener('selectstart', down);
  c.addEventListener('selectend', up);
  c.addEventListener('squeezestart', () => { rayFrom(c); const h = cast(); if (h && h.object.userData.grab && !h.object.userData.grab.userData.held) iniciarPega(c, h.object); });
  c.addEventListener('squeezeend', () => { if (c.userData.held) soltarPega(c); });
  rig.add(c);
  return c;
});

// olhar fixo (sem controle) ----------------------------------------------------
const reticle = new THREE.Group();
const retRing = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.02, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
const retFill = new THREE.Mesh(new THREE.CircleGeometry(0.013, 32), new THREE.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.95, depthTest: false, fog: false }));
retRing.renderOrder = 22;
retFill.renderOrder = 23;
reticle.add(retRing, retFill);
reticle.position.z = -1.4;
reticle.visible = false;
camera.add(reticle);
let gazeAlvo = null, gazeT = 0, gazeFeito = false;

// mouse / toque (ensaio em tela) ------------------------------------------------
const el = renderer.domElement;
const mouse = new THREE.Vector2(9, 9);
export const view = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
let mouseIn = false, down = null, dragCam = false, mouseDrag = null;
function setMouse(e) { mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); }
function pickMouse() { raycaster.setFromCamera(mouse, camera); return cast(); }
el.addEventListener('pointerdown', e => {
  setMouse(e);
  const h = pickMouse();
  if (h && h.object.userData.drag) { mouseDrag = h.object; h.object.userData.drag(h.point, 'start'); tocou(); return; }
  down = { x: e.clientX, y: e.clientY, yaw: view.tyaw, pitch: view.tpitch, alvo: h ? h.object : null };
  dragCam = false;
});
el.addEventListener('pointermove', e => {
  setMouse(e);
  mouseIn = true;
  if (mouseDrag) {
    raycaster.setFromCamera(mouse, camera);
    const p = raycaster.intersectObject(mouseDrag.userData.dragPlane || mouseDrag, false)[0];
    if (p) mouseDrag.userData.drag(p.point, 'move');
    return;
  }
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 6) dragCam = true;
    if (dragCam) { view.tyaw = down.yaw + dx * 0.0032; view.tpitch = clamp(down.pitch + dy * 0.0032, -0.6, 0.6); tocou(); }
  }
});
el.addEventListener('pointerup', e => {
  if (mouseDrag) { mouseDrag.userData.drag(null, 'end'); mouseDrag = null; return; }
  if (down && !dragCam && !renderer.xr.isPresenting) {
    setMouse(e);
    const h = pickMouse();
    if (h && h.object === down.alvo && h.object.userData.onClick) click(h.object);
  }
  down = null;
});
el.addEventListener('pointerleave', () => { mouseIn = false; down = null; });
el.addEventListener('wheel', e => { view.tyaw += e.deltaX * 0.002; view.tpitch = clamp(view.tpitch + e.deltaY * 0.0015, -0.6, 0.6); }, { passive: true });

const hov = new Set();
let hovAntes = null;
export function updatePointers(dt) {
  hov.clear();
  const xr = renderer.xr.isPresenting;
  let comRaio = false;
  if (xr) {
    for (const c of ctrls) {
      const u = c.userData, ativo = u.on && u.mode === 'tracked-pointer';
      u.line.visible = ativo && !u.held;
      u.tip.visible = false;
      if (!ativo) continue;
      comRaio = true;
      rayFrom(c);
      if (u.drag) {
        const p = raycaster.intersectObject(u.drag.userData.dragPlane || u.drag, false)[0];
        if (p) u.drag.userData.drag(p.point, 'move');
        continue;
      }
      if (u.held) continue;
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
    const alvoOk = h && h.object.userData.onClick;
    if (h) hov.add(h.object);
    if (alvoOk) {
      if (h.object !== gazeAlvo) { gazeAlvo = h.object; gazeT = 0; gazeFeito = false; }
      else if (!gazeFeito) {
        gazeT += dt;
        if (gazeT >= OLHAR) { gazeFeito = true; gazeT = 0; click(h.object); }
      }
    } else { gazeAlvo = null; gazeT = 0; gazeFeito = false; }
    retFill.scale.setScalar(Math.max(0.001, gazeT / OLHAR));
  }
  if (!xr && mouseIn && !dragCam && !mouseDrag) {
    raycaster.setFromCamera(mouse, camera);
    const h = cast();
    if (h) hov.add(h.object);
    el.style.cursor = h ? 'pointer' : down ? 'grabbing' : 'grab';
  }
  const primeiro = hov.values().next().value || null;
  if (primeiro && primeiro !== hovAntes) { hooks.hover(primeiro); tocou(); }
  hovAntes = primeiro;
  const k = 1 - Math.exp(-dt * 14);
  for (const m of hits) {
    const u = m.userData;
    u.h = (u.h || 0) + ((hov.has(m) ? 1 : 0) - (u.h || 0)) * k;
    if (u.hoverFn) { u.hoverFn(clamp(u.h, 0, 1.9)); continue; }
    m.scale.setScalar(1 + 0.05 * u.h);
    m.position.z = 0.06 * Math.min(u.h, 1);
    if (m.material.color) m.material.color.setScalar(0.86 + 0.14 * clamp(u.h, 0, 1));
  }
}
export function estaOlhando(mesh) { return hov.has(mesh); }

// câmera em tela (fora do VR)
export function updateCameraTela(dt) {
  if (renderer.xr.isPresenting) return;
  const k = 1 - Math.exp(-dt * 7);
  const px = mouseIn && !down ? -mouse.x * 0.05 : 0, py = mouseIn && !down ? mouse.y * 0.03 : 0;
  view.yaw += (view.tyaw + px - view.yaw) * k;
  view.pitch += (view.tpitch + py - view.pitch) * k;
  camera.rotation.set(view.pitch, view.yaw, 0);
}
// Gira a câmera de tela até olhar para uma direção do mundo (vetor).
export function olharTelaPara(dirMundo) {
  const alvo = Math.atan2(-dirMundo.x, -dirMundo.z);
  let d = alvo - view.tyaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  view.tyaw += d;
  view.tpitch = 0;
}
// Ângulo (graus) entre o olhar e uma direção do mundo.
export function anguloOlhar(dirMundo) {
  camera.getWorldDirection(rd);
  rd.y = 0;
  rd.normalize();
  const d = dirMundo.clone().setY(0).normalize();
  return Math.acos(clamp(rd.dot(d), -1, 1)) / DEG;
}
export function yawCabeca() {
  camera.getWorldDirection(rd);
  return Math.atan2(-rd.x, -rd.z);
}
