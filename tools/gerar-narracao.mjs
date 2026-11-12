// Gera os áudios da narração (voz sintética local, Kokoro) a partir de js/narracao.js.
// Uso, dentro da pasta e3-vr:  node tools/gerar-narracao.mjs
// Requisitos: Python com kokoro-onnx e soundfile, e ffmpeg no PATH.
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { NARRACAO, VOZ } = await import(pathToFileURL(join(raiz, 'js', 'narracao.js')).href);
const pasta = join(raiz, 'media', 'narracao');
mkdirSync(pasta, { recursive: true });
const arqManifesto = join(pasta, 'manifest.json');
const manifesto = existsSync(arqManifesto) ? JSON.parse(readFileSync(arqManifesto, 'utf8')) : {};

for (const [chave, texto] of Object.entries(NARRACAO)) {
  const hash = createHash('sha1').update(VOZ + '|' + texto).digest('hex').slice(0, 12);
  const mp3 = join(pasta, `${chave}.mp3`);
  if (manifesto[chave]?.hash === hash && existsSync(mp3)) continue;
  const wav = join(pasta, `${chave}.wav`);
  // Roda dentro da pasta com nome de arquivo relativo: caminhos com espaço quebram o npx no Windows.
  execSync(`npx -y hyperframes@0.9.39 tts "${texto.replace(/"/g, '')}" --voice ${VOZ} --output "${chave}.wav"`, { cwd: pasta, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5', '-ac', '1', '-b:a', '64k', mp3]);
  unlinkSync(wav);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  manifesto[chave] = { hash, dur: Math.round(dur * 100) / 100 };
  writeFileSync(arqManifesto, JSON.stringify(manifesto, null, 2));
  console.log('ok', chave, manifesto[chave].dur, 's');
}
writeFileSync(arqManifesto, JSON.stringify(manifesto, null, 2));
console.log('FIM');
