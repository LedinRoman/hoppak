#!/bin/bash
# Builds hoppak.page.tsx (Page source), hoppak.js (local), page-build/hop.canvas.tsx
# (minified Page upload) and, with `site`, the deploy folder game/site/.
#
#   ./build.sh
#       Local hoppak.js (no baked server) + page-build. On file:// or localhost
#       without a server, ОНЛАЙН shows «НЕТ СВЯЗИ» and never opens a WebSocket.
#
#   ./build.sh site
#       Also writes game/site/ (index.html + hoppak.js) defaulting to same-origin
#       (window.location.origin -> wss://<host>/ws, /ws/<node>, /api/health;
#       ?server=... still overrides).
#
#   HOP_SERVER_URL=https://game.example.com ./build.sh site
#       Bakes an explicit server origin (only needed when static client files
#       are hosted on a different origin than the game server). HOP_SERVER is
#       accepted as a fallback alias for HOP_SERVER_URL.
set -e
cd "$(dirname "$0")"
ESB=/tmp/esb/node_modules/.bin/esbuild
CLIENT_VER="${HOP_VERSION:-0.58.0}"
PROD_HOST_GUARD="76-13-250-251.sslip.io"
BUILD_TMP="$(mktemp -d)"
trap 'rm -rf "$BUILD_TMP"' EXIT

cat src/01_core.tsx src/02_world.tsx src/03_draw.tsx src/net.tsx src/04_shell.tsx > hoppak.page.tsx
BUILD_TMP="$BUILD_TMP" python3 - << 'PY'
import os
from pathlib import Path
tmp = Path(os.environ["BUILD_TMP"])
src = Path("hoppak.page.tsx").read_text()
game = src.split("/* @@APP */")[0]
game = game.split("\n", 1)[1]  # drop grok/canvas import
(tmp / "hoppak.game.ts").write_text(
    game + "\n;(function(){var c=document.getElementById('c');if(c){window.__hoppak=startHoppak(c);}})();\n"
)
PY
$ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 --define:HOP_VERSION="\"${CLIENT_VER}\"" --outfile=hoppak.js --log-level=warning
sed -i '1i /* Хоппак v0.58 — generated from hoppak.page.tsx by build.sh, do not edit */' hoppak.js
mkdir -p page-build
$ESB hoppak.page.tsx --minify --line-limit=900 --charset=utf8 --format=esm --jsx=preserve --loader:.tsx=tsx --target=es2017 --define:HOP_PAGE=true --define:HOP_VERSION="\"${CLIENT_VER}\"" --outfile="$BUILD_TMP/hop.min.tsx" --log-level=warning
BUILD_TMP="$BUILD_TMP" python3 - << 'PY'
import os, re
from pathlib import Path
tmp = Path(os.environ["BUILD_TMP"])
t = (tmp / "hop.min.tsx").read_text().strip()
m = re.search(r"export\{(\w+) as default\};?\s*$", t)
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
Path("page-build/hop.canvas.tsx").write_text("// @ts-nocheck\n" + t + "\n")
print("page bytes", len(t.encode()))
PY
node --check hoppak.js && echo "js ok $(wc -c < hoppak.js) bytes"

for f in hoppak.js page-build/hop.canvas.tsx; do
  if grep -qF "$PROD_HOST_GUARD" "$f"; then
    echo "ERROR: $f unexpectedly contains hard-coded prod host $PROD_HOST_GUARD" >&2
    exit 1
  fi
done

if [ "${1:-}" = "site" ]; then
  SITE_ORIGIN="${HOP_SERVER_URL:-${HOP_SERVER:-}}"
  mkdir -p site
  if [ -n "$SITE_ORIGIN" ]; then
    $ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 \
      --define:HOP_SERVER="\"${SITE_ORIGIN}\"" \
      --define:HOP_VERSION="\"${CLIENT_VER}\"" \
      --outfile=site/hoppak.js --log-level=warning
    sed -i '1i /* Хоппак v0.58 site — HOP_SERVER baked in, do not edit */' site/hoppak.js
  else
    $ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 \
      --define:HOP_VERSION="\"${CLIENT_VER}\"" \
      --outfile=site/hoppak.js --log-level=warning
    sed -i '1i /* Хоппак v0.58 site — same-origin default (?server= override), do not edit */' site/hoppak.js
  fi
  python3 - << 'PY'
from pathlib import Path
html = Path("index.html").read_text()
html = html.replace("Хоппак v0.54", "Хоппак v0.58").replace("Хоппак v0.57", "Хоппак v0.58")
Path("site/index.html").write_text(html)
print("site js", Path("site/hoppak.js").stat().st_size, "bytes")
PY
  echo "site origin ${SITE_ORIGIN:-same-origin}"
  node --check site/hoppak.js && echo "site js ok $(wc -c < site/hoppak.js) bytes"
  if [ -n "$SITE_ORIGIN" ]; then
    grep -oF "${SITE_ORIGIN}" site/hoppak.js | head -1 | sed "s/^/baked: /"
  else
    if grep -qF "$PROD_HOST_GUARD" site/hoppak.js; then
      echo "ERROR: site/hoppak.js unexpectedly contains hard-coded prod host $PROD_HOST_GUARD" >&2
      exit 1
    fi
  fi
  mkdir -p "site/v/${CLIENT_VER}"
  cp site/index.html "site/v/${CLIENT_VER}/index.html"
  cp site/hoppak.js "site/v/${CLIENT_VER}/hoppak.js"
  if [ -z "$SITE_ORIGIN" ] && grep -qF "$PROD_HOST_GUARD" "site/v/${CLIENT_VER}/hoppak.js"; then
    echo "ERROR: site/v/${CLIENT_VER}/hoppak.js unexpectedly contains hard-coded prod host $PROD_HOST_GUARD" >&2
    exit 1
  fi
  echo "site versioned: site/v/${CLIENT_VER}/ (ver=${CLIENT_VER})"
fi
