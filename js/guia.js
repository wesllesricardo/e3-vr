// =============================================================================
// Luz-guia da E3: uma pequena luz laranja que acompanha o visitante, voa até o
// que ele deve olhar ou tocar, chama a atenção quando ele se perde e "fala" a
// narração (a voz sai da posição dela).
// =============================================================================
import { THREE, scene, camera, glow, S, clamp, ORG, YEL } from './motor.js';
import { nivelVoz, setPosVoz, sfx } from './audio.js';

// A luz-guia ficou invisível (pedido do cliente). A lógica segue só para posicionar a voz da narração.
const MOSTRAR = false;
const v = new THREE.Vector3(), cam = new THREE.Vector3(), fw = new THREE.Vector3(), dir = new THREE.Vector3();
const G = {
  grupo: null, nucleo: null, halo: null, brilho: null, faiscas: [], rastro: [], hist: [],
  pos: new THREE.Vector3(0, 1.5, -1), vel: new THREE.Vector3(),
  alvo: null, desde: 0, foraDeVista: 0, cutucando: 0, visivel: true, fade: 1,
};

export function criarGuia() {
  const g = new THREE.Group();
  scene.add(g);
  G.grupo = g;
  G.halo = glow(0.36, ORG, 0.55);
  G.brilho = glow(0.13, 0xffe9a8, 0.95);
  G.nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff7dc, transparent: true, fog: false, toneMapped: false }));
  G.nucleo.renderOrder = 30;
  [G.halo, G.brilho].forEach(s => { s.renderOrder = 29; s.material.depthTest = false; });
  G.nucleo.material.depthTest = false;
  g.add(G.halo, G.brilho, G.nucleo);
  for (let i = 0; i < 3; i++) {
    const f = glow(0.035, i ? YEL : 0xffffff, 0.9);
    f.material.depthTest = false; f.renderOrder = 31;
    g.add(f);
    G.faiscas.push(f);
  }
  for (let i = 0; i < 12; i++) {
    const r = glow(0.11 * (1 - i / 14), ORG, 0.35 * (1 - i / 12));
    r.material.depthTest = false; r.renderOrder = 28;
    scene.add(r);
    G.rastro.push(r);
  }
}

// Alvo: um Object3D, uma função que devolve um Vector3 do mundo, ou null (fica ao lado do visitante).
export const guia = {
  alvo(a, { avisar = true } = {}) {
    if (a === G.alvo) return;
    G.alvo = a;
    G.desde = S.T;
    G.foraDeVista = 0;
    if (a && avisar && MOSTRAR) sfx('guia', G.pos);
  },
  casa() { this.alvo(null, { avisar: false }); },
  mostrar(on) { G.visivel = on; },
  get pos() { return G.pos; },
};

function pontoAlvo(out) {
  const a = G.alvo;
  if (!a) return null;
  if (typeof a === 'function') return out.copy(a(out));
  if (!a.parent || a.userData.dead || a.userData.leaving || !a.visible) return null;
  a.getWorldPosition(out);
  out.y += 0.17;
  // um pouco para a frente do objeto, para não ficar escondida atrás do painel
  out.lerp(cam, 0.12);
  return out;
}
function pontoCasa(out) {
  // ao lado direito do olhar, um pouco abaixo, seguindo só o giro da cabeça
  camera.getWorldDirection(fw);
  fw.y = 0;
  if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1);
  fw.normalize();
  out.copy(cam).addScaledVector(fw, 0.85);
  out.x += -fw.z * 0.34; out.z += fw.x * 0.34;
  out.y = cam.y - 0.14;
  return out;
}

export function updateGuia(dt) {
  if (!G.grupo) return;
  camera.getWorldPosition(cam);
  let destino = pontoAlvo(v);
  // se o visitante não olha para o alvo por um tempo, a luz vem até ele e volta (cutucada)
  if (destino) {
    camera.getWorldDirection(fw);
    dir.copy(destino).sub(cam).normalize();
    G.foraDeVista = fw.dot(dir) < 0.55 ? G.foraDeVista + dt : 0;
    if (MOSTRAR && G.foraDeVista > 5 && G.cutucando <= 0) { G.cutucando = 1.8; G.foraDeVista = 0; sfx('guia', G.pos); }
  }
  if (G.cutucando > 0) {
    G.cutucando -= dt;
    const alvoTmp = destino ? destino.clone() : null;
    destino = pontoCasa(v);
    if (alvoTmp) destino.lerp(alvoTmp, 0.18);   // aparece na frente puxando para o lado do alvo
  }
  if (!destino) destino = pontoCasa(v);
  const t = S.T;
  // voo com mola: chega com um leve balanço
  destino.x += Math.cos(t * 1.7) * 0.05;
  destino.z += Math.sin(t * 1.7) * 0.05;
  destino.y += Math.sin(t * 2.3) * 0.025;
  G.vel.addScaledVector(destino.sub(G.pos), 16 * dt);
  G.vel.multiplyScalar(Math.exp(-5.5 * dt));
  G.pos.addScaledVector(G.vel, dt);
  G.grupo.position.copy(G.pos);
  // brilho pulsa com a voz
  const voz = nivelVoz();
  const pulso = 1 + 0.08 * Math.sin(t * 5) + voz * 2.2;
  G.halo.scale.setScalar(0.36 * pulso);
  G.brilho.scale.setScalar(0.13 * (1 + voz * 1.2));
  G.faiscas.forEach((f, i) => {
    const a = t * (3 + i) + i * 2.1;
    f.position.set(Math.cos(a) * 0.075, Math.sin(a * 1.3) * 0.04, Math.sin(a) * 0.075);
  });
  // rastro
  G.hist.unshift(G.pos.clone());
  if (G.hist.length > 40) G.hist.pop();
  G.rastro.forEach((r, i) => { const h = G.hist[Math.min(G.hist.length - 1, i * 3)]; if (h) r.position.copy(h); });
  // aparecer / sumir
  G.fade = clamp(G.fade + (G.visivel ? 1 : -1) * dt * 2, 0, 1);
  G.grupo.visible = MOSTRAR && G.fade > 0.01;
  G.rastro.forEach(r => { r.visible = G.grupo.visible; });
  G.grupo.scale.setScalar(G.fade);
  setPosVoz(G.pos);
}
