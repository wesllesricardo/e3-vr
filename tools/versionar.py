# Marca uma versão nova no index.html antes de publicar.
# Cada arquivo .js passa a ser carregado com ?v=<versão>, então o navegador do Quest
# baixa tudo de novo ao recarregar a página (sem esperar o cache de 10 min do GitHub).
# Uso: python tools/versionar.py
import io, json, re, glob, os, datetime
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
agora = datetime.datetime.now()
ver = agora.strftime('%Y%m%d%H%M')
rotulo = agora.strftime('Versão %d/%m %Hh%M')
p = os.path.join(raiz, 'index.html')
s = io.open(p, encoding='utf-8').read()
mods = sorted(os.path.basename(f) for f in glob.glob(os.path.join(raiz, 'js', '*.js')))
mapa = {'three': 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'}
for m in mods:
    mapa[f'./js/{m}'] = f'./js/{m}?v={ver}'
novo = '<script type="importmap">\n' + json.dumps({'imports': mapa}, indent=1, ensure_ascii=False) + '\n</script>'
s, n = re.subn(r'<script type="importmap">.*?</script>', lambda _: novo, s, count=1, flags=re.S)
assert n == 1
s, n = re.subn(r'<script type="module" src="js/app\.js[^"]*"></script>', f'<script type="module" src="js/app.js?v={ver}"></script>', s)
assert n == 1
s, n = re.subn(r'<div id="versao">[^<]*</div>', f'<div id="versao">{rotulo}</div>', s)
if n == 0:
    s = s.replace('<div id="status">Carregando…</div>', f'<div id="status">Carregando…</div>\n    <div id="versao">{rotulo}</div>', 1)
    s = s.replace('  #status {', '  #versao { margin-top:6px; font-size:12px; color:var(--mute); opacity:.7; font-variant-numeric:tabular-nums; }\n  #status {', 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print(rotulo, ver)
