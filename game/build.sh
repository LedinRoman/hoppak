#!/bin/bash
# Builds hoppak.page.tsx (Page source), hoppak.js (local), page-build/hop.canvas.tsx
# (minified Page upload) and, with `site`, the deploy folder game/site/.
#
#   ./build.sh
#       Local hoppak.js (no baked server) + page-build. On file:// or localhost
#       without a server, ОНЛАЙН shows «НЕТ СВЯЗИ» and never opens a WebSocket.
#
#   HOP_SERVER=https://76-13-250-251.sslip.io ./build.sh site
#       Also writes game/site/ (index.html + hoppak.js) with that origin baked in:
#       wss://<host>/ws and https://<host>/api/health.
#       Default HOP_SERVER for the site target is https://76-13-250-251.sslip.io
set -e
cd "$(dirname "$0")"
ESB=/tmp/esb/node_modules/.bin/esbuild
python3 - << 'I18N'
import json
from pathlib import Path
core = Path("src/01_core.tsx").read_text(encoding="utf-8")
header, core = core.split("\n", 1)
catalog = {lang: json.loads(Path(f"i18n/{lang}.json").read_text(encoding="utf-8")) for lang in ("ru", "en")}
parts = [header, "var GAME_I18N_BUILTIN = " + json.dumps(catalog, ensure_ascii=False) + ";",
         Path("src/00_i18n.tsx").read_text(encoding="utf-8").replace(
             "declare const GAME_I18N_BUILTIN: Record<GameLanguage, GameDictionary>;\n", ""), core]
parts.extend(Path(f"src/{name}.tsx").read_text(encoding="utf-8")
             for name in ("01b_art64", "01c_draw64", "02_world", "03_draw", "net", "profile", "04_shell"))
Path("hoppak.page.tsx").write_text("\n".join(parts), encoding="utf-8")
I18N
python3 - << 'PY'
src = open("hoppak.page.tsx", encoding="utf-8").read()
game = src.split("/* @@APP */")[0]
game = game.split("\n", 1)[1]  # drop grok/canvas import
open("/tmp/hoppak.game.ts", "w", encoding="utf-8").write(game + "\n;(function(){var c=document.getElementById('c');if(c){window.__hoppak=startHoppak(c);}})();\n")
PY
$ESB /tmp/hoppak.game.ts --loader:.ts=ts --format=iife --target=es2017 ${HOP_I18N_DEV:+--define:HOP_I18N_DEV=true} --outfile=hoppak.js --log-level=warning
sed -i '1i /* Хоппак v0.6 — generated from hoppak.page.tsx by build.sh, do not edit */' hoppak.js
mkdir -p page-build
$ESB hoppak.page.tsx --minify --line-limit=900 --charset=utf8 --format=esm --jsx=preserve --loader:.tsx=tsx --target=es2017 --define:HOP_PAGE=true --outfile=/tmp/hop.min.tsx --log-level=warning
python3 - << 'PY'
import re
t = open("/tmp/hop.min.tsx", encoding="utf-8").read().strip()
m = re.search(r"export\{([A-Za-z_$][\w$]*) as default\};?\s*$", t)
t = t[:m.start()] + "export default " + m.group(1) + ";"
# esbuild --line-limit wraps strings with backslash+newline. The Canvas TSX
# compiler may not honour that, which would corrupt data-URI sprite sheets.
# Rewrite as concatenation: "aaa" + \n "bbb"
lines = t.split("\n")
out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.endswith("\\") and not line.endswith("\\\\"):
        out.append(line[:-1] + '"+')
        i += 1
        if i < len(lines):
            lines[i] = '"' + lines[i]
        continue
    out.append(line)
    i += 1
t = "\n".join(out)
open("page-build/hop.canvas.tsx", "w", encoding="utf-8").write("// @ts-nocheck\n" + t + "\n")
print("page bytes", len(t.encode()))
PY
node --check hoppak.js && echo "js ok $(wc -c < hoppak.js) bytes"

if [ "${1:-}" = "site" ] || [ "${1:-}" = "staging" ]; then
  SITE_ORIGIN="${HOP_SERVER:-https://76-13-250-251.sslip.io}"
  mkdir -p site
  DEFS="--define:HOP_SERVER=\"${SITE_ORIGIN}\""
  HTML_SRC="index.html"
  if [ -n "${HOP_API:-}" ]; then DEFS="${DEFS} --define:HOP_API=\"${HOP_API}\""; fi
  # tg-boot.js loads telegram.org only inside Telegram. HOP_STAGING is the alpha toggle, not login.
  # The visible label is v0.6 on the prod page and v0.6rc on staging. Room admission
  # stays NET_GEN ("0.6") and NET_PROTO (1); this label is not that check.
  VER_LABEL="v0.6"
  if [ "${1:-}" = "staging" ]; then
    DEFS="${DEFS} --define:HOP_STAGING=true"
    HTML_SRC="index.staging.html"
    VER_LABEL="${HOP_VER_LABEL:-v0.6rc}"
  fi
  $ESB /tmp/hoppak.game.ts --loader:.ts=ts --format=iife --target=es2017 \
    ${DEFS} \
    --outfile=site/hoppak.js --log-level=warning
  sed -i "1i /* Хоппак ${VER_LABEL} site — HOP_SERVER baked in, do not edit */" site/hoppak.js
  python3 - << PY
from pathlib import Path
html = Path("${HTML_SRC}").read_text()
label = "Хоппак ${VER_LABEL}"
html = html.replace("Хоппак v0.6rc", "Хоппак __VER__").replace("Хоппак v0.59", "Хоппак __VER__").replace("Хоппак v0.58", "Хоппак __VER__").replace("Хоппак v0.6", "Хоппак __VER__")
html = html.replace("Хоппак __VER__", label)
Path("site/index.html").write_text(html)
print("site html", "${HTML_SRC}", label)
print("site js", Path("site/hoppak.js").stat().st_size, "bytes")
PY
  # fix the printed origin (the heredoc was unquoted wrongly for the env var)
  echo "site origin ${SITE_ORIGIN}"
  cp tg-boot.js site/tg-boot.js
  # Cache-bust like the live page: first 8 hex chars of SHA-1 of the file bytes.
  python3 - << 'PY'
import hashlib, re
from pathlib import Path
html_path = Path("site/index.html")
html = html_path.read_text()
def stamp(html, name, file):
    ver = hashlib.sha1(Path(file).read_bytes()).hexdigest()[:8]
    new, n = re.subn(
        r'(src="' + re.escape(name) + r')(?:\?v=[0-9a-fA-F]*)?(")',
        r'\1?v=' + ver + r'\2',
        html,
        count=1,
    )
    if n != 1:
        raise SystemExit("cache-bust: script tag not found: " + name)
    print("cache", name, ver)
    return new
html = stamp(html, "tg-boot.js", "site/tg-boot.js")
html = stamp(html, "hoppak.js", "site/hoppak.js")
html_path.write_text(html)
PY
  rm -rf site/audio
  mkdir -p site/audio
  cp -R audio/. site/audio/
  mkdir -p site/ui/tab site/ui/grid site/ui/portrait site/ui/menu site/ui/map_thumbs
  cp -R ui/tab/. site/ui/tab/
  cp -R ui/grid/. site/ui/grid/
  cp -R ui/portrait/. site/ui/portrait/
  cp -R ui/menu/. site/ui/menu/
  if [ -d ui/map_thumbs ]; then cp -R ui/map_thumbs/. site/ui/map_thumbs/; fi
  node --check site/hoppak.js && echo "site js ok $(wc -c < site/hoppak.js) bytes"
  # confirm the origin string is baked in
  grep -o "${SITE_ORIGIN}" site/hoppak.js | head -1 | sed "s/^/baked: /"
fi
