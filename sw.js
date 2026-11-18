// Guarda a experiência no próprio óculos para funcionar com internet fraca (ou sem internet).
// - Código (páginas, scripts, fontes, three.js): rede primeiro; se a rede demorar ou cair,
//   usa a cópia guardada.
// - Mídia (vídeos, fotos, narração): usa a cópia guardada; sem cópia, baixa da rede.
//   Vídeos pedem pedaços (Range): o pedaço é recortado da cópia guardada.
const CODIGO = 'e3vr-codigo-v1';
const MIDIA = 'e3vr-midia-v1';
const ESPERA_REDE = 4000;   // ms antes de usar a cópia guardada do código

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'ntfy.sh') return;
  const ehMidia = url.origin === self.location.origin && url.pathname.includes('/media/') && !url.pathname.endsWith('.json');
  e.respondWith(ehMidia ? midia(req) : codigo(req));
});

async function codigo(req) {
  const cache = await caches.open(CODIGO);
  const rede = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  const guardada = await cache.match(req);
  if (!guardada) return rede.catch(() => Response.error());
  // com cópia guardada: espera a rede um pouco; se não vier, segue com a cópia
  const limite = new Promise(r => setTimeout(() => r(guardada), ESPERA_REDE));
  return Promise.race([rede.catch(() => guardada), limite]);
}

async function midia(req) {
  const cache = await caches.open(MIDIA);
  const chave = req.url.split('#')[0];
  const r = await cache.match(chave);
  if (!r) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return r;
  const blob = await r.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const total = blob.size;
  let ini = m[1] ? parseInt(m[1], 10) : 0;
  let fim = m[2] ? parseInt(m[2], 10) : total - 1;
  if (!m[1] && m[2]) { ini = Math.max(0, total - parseInt(m[2], 10)); fim = total - 1; }
  fim = Math.min(fim, total - 1);
  if (ini > fim) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  return new Response(blob.slice(ini, fim + 1), {
    status: 206,
    headers: {
      'Content-Type': r.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${ini}-${fim}/${total}`,
      'Content-Length': String(fim - ini + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
