// =============================================================================
// Ambiente: cúpula que dissolve a realidade, chão, lado sombrio (atrás) e a
// luz da E3 (frente). Tudo controlado por dois números:
//   prog: 0 = só a sala real (passthrough) · 1 = mundo virtual completo
//   luz:  0 = escuro · 1 = luz da E3 acesa
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, world, scene, FRENTE, TRAS, panel, rich, eyebrow, cardBg,
  place, glow, dotTex, setAlpha, op, clamp, lerp, tw, E,
} from './motor.js';
import { CONTEUDO as K } from './conteudo.js';
import { audio } from './audio.js';

export const amb = { prog: 0, luz: 0 };
const v3 = new THREE.Vector3();

// ------------------------------------------------------------------ cúpula ---
const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }`;
const domo = new THREE.Mesh(
  new THREE.SphereGeometry(42, 64, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: {
      uProg: { value: 0 }, uLuz: { value: 0 }, uTime: { value: 0 },
      uInicio: { value: new THREE.Vector3(0, 0.15, 1).normalize() },   // a dissolução começa no lado sombrio
      uLuzDir: { value: new THREE.Vector3(0, 0.08, -1).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uProg, uLuz, uTime; uniform vec3 uInicio, uLuzDir; varying vec3 vDir; ${NOISE}
      void main(){
        float d = 1.0 - (dot(vDir, uInicio) * 0.5 + 0.5);
        float n = n3(vDir * 4.0 + vec3(0.0, uTime * 0.06, 0.0)) * 0.35 + n3(vDir * 11.0) * 0.12;
        float borda = uProg * 1.55 - (d + n);
        if (borda < 0.0) discard;
        float y = vDir.y;
        vec3 frioTopo = vec3(0.010, 0.016, 0.026), frioHor = vec3(0.035, 0.050, 0.068);
        vec3 quenteTopo = vec3(0.030, 0.012, 0.004), quenteHor = vec3(0.16, 0.055, 0.015);
        float lado = smoothstep(-0.35, 1.0, dot(vDir, uLuzDir));
        float q = uLuz * (0.25 + 0.75 * lado);
        vec3 topo = mix(frioTopo, quenteTopo, q), hor = mix(frioHor, quenteHor, q);
        vec3 c = mix(hor, topo, smoothstep(-0.05, 0.6, y));
        c += vec3(1.0, 0.42, 0.12) * pow(max(dot(vDir, uLuzDir), 0.0), 18.0) * 0.55 * uLuz;
        float g = 1.0 - smoothstep(0.0, 0.07, borda);
        c += vec3(1.0, 0.37, 0.10) * g * 1.6 * (1.0 - smoothstep(0.95, 1.0, uProg));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
);
domo.renderOrder = -100;
domo.frustumCulled = false;
world.add(domo);

// -------------------------------------------------------------------- chão ---
const chao = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uProg: { value: 0 }, uLuz: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = vec2(position.x, -position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uProg, uLuz, uTime; varying vec2 vP;
      float linha(float c){ float d = abs(fract(c - 0.5) - 0.5) / fwidth(c); return 1.0 - min(d, 1.0); }
      void main(){
        float g = max(linha(vP.x), linha(vP.y));
        float dist = length(vP);
        float fade = exp(-dist * 0.085);
        float lado = smoothstep(-0.5, 1.0, dot(normalize(vP + 1e-4), vec2(0.0, -1.0)));
        vec3 frio = vec3(0.20, 0.28, 0.38), quente = vec3(1.0, 0.40, 0.13);
        vec3 c = mix(frio, quente, uLuz * lado);
        float r = mod(uTime * 1.4, 16.0);
        float pulso = exp(-abs(dist - r) * 2.5) * (0.25 + 0.75 * uLuz);
        float aro = exp(-abs(dist - 1.25) * 30.0) * 0.8;
        float a = (g * 0.55 + pulso * 0.5) * fade + aro * (0.3 + 0.7 * uLuz);
        gl_FragColor = vec4(c * (0.6 + g + pulso + aro), a * uProg);
      }`,
  }),
);
chao.rotation.x = -Math.PI / 2;
chao.position.y = 0.005;
chao.renderOrder = -50;
world.add(chao);

// ------------------------------------------------------------------- luzes ---
const hemi = new THREE.HemisphereLight(0x9db2c6, 0x0a0d10, 0.9);
scene.add(hemi);
const sol = new THREE.DirectionalLight(0xff8a40, 0);
sol.position.set(0, 4, -12);
world.add(sol);
world.add(sol.target);

// ----------------------------------------------------------- partículas ---
function particulas(n, gera, cor, tam) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos.set(gera(i), i * 3);
    c.set(cor(i)).multiplyScalar(0.35 + Math.random() * 0.65);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: tam, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

// ============================================================ lado sombrio ===
export const frio = new THREE.Group();
TRAS.add(frio);
const matEscuro = new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.85, metalness: 0.05, transparent: true });
const matCorpo = new THREE.MeshStandardMaterial({ color: 0x0d1116, roughness: 0.9, transparent: true });
function caixa(w, h, d, x, y, z, mat = matEscuro) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  frio.add(m);
  return m;
}
// mesa, cadeira e o advogado de cabeça baixa
caixa(1.6, 0.05, 0.75, 0, 0.76, -3.7);
for (const sx of [-0.74, 0.74]) for (const sz of [-0.32, 0.32]) caixa(0.04, 0.74, 0.04, sx, 0.37, -3.7 + sz);
caixa(0.5, 0.05, 0.5, 0, 0.47, -4.35);
caixa(0.5, 0.6, 0.05, 0, 0.8, -4.62);
const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), matCorpo);
corpo.position.set(0, 0.92, -4.3);
corpo.rotation.x = 0.28;
frio.add(corpo);
const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), matCorpo);
cabeca.position.set(0, 1.34, -4.12);
frio.add(cabeca);
for (const sx of [-0.2, 0.2]) {
  const braco = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.36, 4, 8), matCorpo);
  braco.position.set(sx, 0.9, -3.95);
  braco.rotation.x = 1.25;
  frio.add(braco);
}
// luminária fria que pisca
caixa(0.03, 0.42, 0.03, 0.55, 0.99, -3.85);
const cupula = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.15, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fc3ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
cupula.position.set(0.45, 1.2, -3.8);
cupula.rotation.z = 0.5;
frio.add(cupula);
const lampada = new THREE.PointLight(0x9fc3ff, 2.2, 5, 1.6);
lampada.position.set(0.42, 1.12, -3.75);
frio.add(lampada);
const halo = glow(0.9, 0x9fc3ff, 0.35);
halo.position.copy(lampada.position);
frio.add(halo);
// celular sem mensagens
const cel = panel(0.09, 0.17, (ctx, W, H) => {
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 1.5); ctx.fillStyle = '#0b0f14'; ctx.fill();
  ctx.fillStyle = '#5F7080'; ctx.font = `600 1.3px ${F_BODY}`; ctx.textAlign = 'center';
  ctx.fillText(K.escuro.celular, W / 2, H / 2);
});
cel.rotation.x = -Math.PI / 2;
cel.position.set(-0.25, 0.79, -3.55);
frio.add(cel);
audio.relogio = new THREE.Vector3();

// parede com agenda vazia e gráfico caindo
function painelFrio(w, h, desenho) {
  return panel(w, h, (ctx, W, H) => { cardBg(ctx, W, H, { fill: COL.cardFrio, accent: COL.frioMute }); desenho(ctx, W, H); });
}
const agenda = painelFrio(1.25, 0.85, (ctx, W, H) => {
  eyebrow(ctx, K.escuro.agenda, 7, 6, W - 14, { color: COL.frio, size: 4 });
  const dias = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], cw = (W - 14) / 5;
  dias.forEach((d, i) => {
    ctx.fillStyle = COL.frioMute; ctx.font = `700 3.4px ${F_BODY}`; ctx.fillText(d, 7 + i * cw + 2, 17);
    for (let r = 0; r < 5; r++) {
      ctx.strokeStyle = 'rgba(160,180,200,0.14)'; ctx.lineWidth = 0.3;
      ctx.strokeRect(7 + i * cw + 1, 24 + r * 9.5, cw - 2, 8);
    }
  });
  ctx.fillStyle = COL.frio; ctx.font = `600 5px ${F_BODY}`; ctx.textAlign = 'center';
  ctx.fillText(K.escuro.agendaVazia, W / 2, H - 13);
});
place(agenda, -24, 1.85, 5.0);
frio.add(agenda);
const PONTOS_G = [0.82, 0.78, 0.8, 0.66, 0.6, 0.52, 0.55, 0.4, 0.32, 0.26, 0.18];
const grafico = painelFrio(1.25, 0.85, (ctx, W, H) => {
  eyebrow(ctx, K.escuro.grafico, 7, 6, W - 14, { color: COL.frio, size: 4 });
  const x0 = 9, y0 = 20, gw = W - 18, gh = H - 30;
  ctx.strokeStyle = 'rgba(160,180,200,0.18)'; ctx.lineWidth = 0.3;
  for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x0, y0 + gh * i / 4); ctx.lineTo(x0 + gw, y0 + gh * i / 4); ctx.stroke(); }
  ctx.strokeStyle = '#E0524B'; ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
  ctx.beginPath();
  PONTOS_G.forEach((p, i) => { const x = x0 + gw * i / (PONTOS_G.length - 1), y = y0 + gh * (1 - p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
});
place(grafico, 24, 1.85, 5.0);
frio.add(grafico);
const pontoQueda = glow(0.22, 0xff5a50, 0.9);
frio.add(pontoQueda);
const tituloFrio = panel(3.6, 0.62, (ctx, W, H) => {
  eyebrow(ctx, K.escuro.eyebrow, 0, 2, W, { align: 'center', color: COL.frio, size: 6 });
  rich(ctx, K.escuro.titulo, 0, 16, W, 20, { font: F_HEAD, weight: 700, align: 'center', color: '#C9D5E0', hi: '#E0524B', lh: 1.1 });
});
place(tituloFrio, 0, 2.95, 5.2);
frio.add(tituloFrio);
// palavras que flutuam em volta
const palavras = K.escuro.palavras.map((t, i) => {
  const p = panel(1.4, 0.2, (ctx, W, H) => {
    ctx.font = `700 9px ${F_HEAD}`; ctx.fillStyle = COL.frio; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, W / 2, H / 2);
  });
  const ang = [-58, -40, 40, 58, -50, 50, -66, 66][i % 8], y = [2.4, 0.9, 2.2, 1.0, 1.55, 1.6, 2.9, 2.8][i % 8], r = 3.6 + (i % 3) * 0.5;
  place(p, ang, y, r);
  p.userData.y0 = y;
  p.material.opacity = 0.75;
  frio.add(p);
  return p;
});
const FRIO_C = 0x8fa6bc;
const poeira = particulas(500, () => [(Math.random() - 0.5) * 12, Math.random() * 5, -1 - Math.random() * 8], () => FRIO_C, 0.05);
poeira.material.opacity = 0.6;
frio.add(poeira);

// ================================================================ a luz ===
export const luzGrp = new THREE.Group();
FRENTE.add(luzGrp);
const solGlow = [glow(26, ORG, 0.22), glow(11, 0xff8a40, 0.4), glow(4.2, 0xffd9a0, 0.65)];
solGlow.forEach(s => { s.position.set(0, 3.8, -17); s.renderOrder = 0; luzGrp.add(s); });
const nucleo = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.6, 1)),
  new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.22, depthWrite: false }),
);
nucleo.position.set(0, 9.6, -12);
luzGrp.add(nucleo);
export let coreSpin = 0;
export function girarNucleo() { coreSpin = 1; }

const feixeTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,95,31,0)'); g.addColorStop(0.5, 'rgba(255,125,55,1)'); g.addColorStop(1, 'rgba(255,95,31,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in';
  const v = x.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.4, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0.2)');
  x.fillStyle = v; x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const feixes = [-72, -52, -32, -14, 9, 28, 47, 68].map((a, i) => {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1 + (i % 3) * 0.5, 16),
    new THREE.MeshBasicMaterial({ map: feixeTex, transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  place(b, a, 7.2, 13 + (i % 4) * 1.4);
  luzGrp.add(b);
  return b;
});
const aneis = [9, 11.5, 14].map((r, i) => {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 160),
    new THREE.MeshBasicMaterial({ color: i === 1 ? YEL : ORG, transparent: true, opacity: 0.22, depthWrite: false }));
  t.position.y = 2.5;
  t.rotation.set(1.1 + i * 0.5, i * 0.9, 0);
  luzGrp.add(t);
  return t;
});
const brasas = particulas(700, () => {
  const r = 3 + Math.random() * 15, a = (Math.random() - 0.5) * Math.PI * 1.3;
  return [Math.sin(a) * r, Math.random() * 9, -Math.cos(a) * r];
}, i => (i % 5 === 0 ? YEL : ORG), 0.08);
luzGrp.add(brasas);

// logo oficial (carregado no boot)
export const logo = new THREE.Group();
const LOGO_CEU = new THREE.Vector3(0, 6.9, -7.0), LOGO_PERTO = new THREE.Vector3(0, 1.75, -3.6);
logo.position.copy(LOGO_CEU);
let logoSubindo = false;
luzGrp.add(logo);
const logoHalo = glow(3.2, ORG, 0.35);
logoHalo.position.z = -0.2;
logo.add(logoHalo);
export function carregarLogo() {
  return new Promise(res => {
    new THREE.TextureLoader().load('media/logo-e3.png', tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.userData.shared = true;
      const w = 1.7, h = w * tex.image.height / tex.image.width;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
      m.renderOrder = 0;
      logo.add(m);
      logo.userData.tex = tex;
      aplicar();
      res(tex);
    }, undefined, () => res(null));
  });
}

// ---------------------------------------------------------------- controle ---
const corFrio = new THREE.Color(0x05080c), corQuente = new THREE.Color(0x120804);
export function aplicar() {
  const p = amb.prog, l = amb.luz;
  domo.material.uniforms.uProg.value = p;
  domo.material.uniforms.uLuz.value = l;
  chao.material.uniforms.uProg.value = p;
  chao.material.uniforms.uLuz.value = l;
  setAlpha(frio, clamp(p * 1.4 - 0.4, 0, 1) * (1 - 0.35 * l));
  setAlpha(luzGrp, clamp(p * 1.4 - 0.4, 0, 1) * (0.14 + 0.86 * l));
  sol.intensity = 2.4 * l * p;
  hemi.intensity = 0.25 + 0.75 * p;
  scene.fog.color.copy(corFrio).lerp(corQuente, l);
  frio.visible = p > 0.01;
  luzGrp.visible = p > 0.01;
}
export function setProg(k) { amb.prog = k; aplicar(); }
export function setLuz(k) { amb.luz = k; aplicar(); }

export function updateAmbiente(T, dt) {
  domo.material.uniforms.uTime.value = T;
  chao.material.uniforms.uTime.value = T;
  if (amb.prog <= 0.01) return;
  // lado sombrio
  lampada.intensity = 2.2 * (Math.random() > 0.985 ? 0.25 : 1) * (0.9 + 0.1 * Math.sin(T * 13));
  palavras.forEach((p, i) => {
    p.position.y = p.userData.y0 + Math.sin(T * 0.35 + i * 1.7) * 0.08;
    op(p, 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(T * 0.8 + i * 2.3)));
  });
  poeira.rotation.y = Math.sin(T * 0.05) * 0.2;
  const u = (T * 0.12) % 1, j = Math.min(Math.floor(u * (PONTOS_G.length - 1)), PONTOS_G.length - 2), f = u * (PONTOS_G.length - 1) - j;
  const pv = lerp(PONTOS_G[j], PONTOS_G[j + 1], f);
  v3.set(-0.535 + 1.07 * u, -0.425 + 0.2 + 0.55 * pv - 0.1, 0.01);
  grafico.localToWorld(v3);
  frio.worldToLocal(v3);
  pontoQueda.position.copy(v3);
  cel.getWorldPosition(audio.relogio);
  // luz
  coreSpin = Math.max(0, coreSpin - dt * 1.3);
  nucleo.rotation.y += dt * (0.12 + coreSpin * 2.2);
  nucleo.rotation.x += dt * 0.05;
  aneis.forEach((r, i) => { r.rotation.z = T * (0.03 + i * 0.012) * (i % 2 ? -1 : 1); });
  feixes.forEach((b, i) => op(b, 0.11 + 0.07 * Math.sin(T * 0.5 + i * 1.7)));
  brasas.rotation.y = T * 0.01;
  brasas.position.y = (T * 0.15) % 1 - 0.5;
  solGlow[2].scale.setScalar(4.2 + 0.3 * Math.sin(T * 1.3));
  if (!logoSubindo) logo.position.y = LOGO_CEU.y + Math.sin(T * 0.8) * 0.05;
}

// direção da luz no mundo (para saber se o visitante já se virou)
export function direcaoLuz(out = new THREE.Vector3()) {
  out.set(0, 0, -1).applyQuaternion(world.quaternion);
  return out;
}
export function posicaoChamado(out = new THREE.Vector3()) {
  out.set(0, 2.4, -4);
  return world.localToWorld(out);
}
export function flashLuz() {
  const s = solGlow[1], b = 11;
  tw(1.8, k => s.scale.setScalar(b * (1 + 1.6 * Math.sin(k * Math.PI))), { ease: E.lin });
  // o logo nasce perto do visitante e sobe para o céu, abrindo espaço para as cenas
  logoSubindo = true;
  logo.position.copy(LOGO_PERTO);
  tw(1.2, k => logo.scale.setScalar(0.3 + 0.4 * E.back(k)), { ease: E.lin });
  tw(1.8, k => { logo.position.lerpVectors(LOGO_PERTO, LOGO_CEU, k); logo.scale.setScalar(0.7 + 0.3 * k); },
    { delay: 1.6, ease: E.inOut, done: () => { logoSubindo = false; } });
}
