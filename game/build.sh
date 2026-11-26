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
#
# Prod-host guard (BUG-55): the production host (76-13-250-251.sslip.io) and its bare IP
# must never be baked into any artifact. The build FAILS (exit 2, nothing written) if
# HOP_SERVER_URL or HOP_SERVER points at them in ANY form (http/https/ws/wss, port, path,
# trailing slash, userinfo, upper case, no scheme). Sub-domains such as
# staging.76-13-250-251.sslip.io are different hosts and stay allowed. After building,
# every generated file (hoppak.js, page-build, site/, site/v/<ver>/) is scanned again.
set -e
cd "$(dirname "$0")"
ESB=/tmp/esb/node_modules/.bin/esbuild
CLIENT_VER="${HOP_VERSION:-0.58.0}"
PROD_HOST_GUARD="76-13-250-251.sslip.io"
PROD_IP_GUARD="76.13.250.251"

# host_of <url-ish>: prints the lower-case hostname (scheme, userinfo, port, path, query, trailing dot stripped)
host_of() {
  python3 - "$1" << 'PY'
import re, sys
u = sys.argv[1].strip().lower()
u = re.sub(r"^[a-z][a-z0-9+.\-]*://", "", u)
u = re.split(r"[/?#\\]", u, 1)[0]
u = u.rsplit("@", 1)[-1]
if u.startswith("["):
    u = u[1:].split("]", 1)[0]
else:
    u = u.split(":", 1)[0]
print(u.rstrip("."))
PY
}

# Refuse a prod target before doing any work (every build path: local, page-build, site, site/v/<ver>).
for _var in HOP_SERVER_URL HOP_SERVER; do
  _val="${!_var:-}"
  [ -z "$_val" ] && continue
  _host="$(host_of "$_val")"
  if [ "$_host" = "$PROD_HOST_GUARD" ] || [ "$_host" = "$PROD_IP_GUARD" ]; then
    echo "ERROR: build.sh: $_var=$_val points at the PRODUCTION host ($_host). Refusing to bake the prod address into the client." >&2
    echo "       Use the default same-origin build (leave HOP_SERVER_URL/HOP_SERVER unset) or a staging host such as https://staging.$PROD_HOST_GUARD" >&2
    exit 2
  fi
done

# scan_no_prod <files...>: fails if a file contains the prod host / IP as a whole host
# (a sub-domain like staging.<prod host> is NOT a match).
scan_no_prod() {
  python3 - "$@" << 'PY'
import re, sys
from pathlib import Path
pat = re.compile(r"(?<![A-Za-z0-9.\-])(76-13-250-251\.sslip\.io|76\.13\.250\.251)(?![A-Za-z0-9\-])")
bad = 0
for f in sys.argv[1:]:
    p = Path(f)
    if p.is_file() and pat.search(p.read_text(errors="replace")):
        print("ERROR: %s contains the hard-coded PRODUCTION host (76-13-250-251.sslip.io / 76.13.250.251)" % f, file=sys.stderr)
        bad = 1
sys.exit(bad)
PY
}
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

scan_no_prod hoppak.js page-build/hop.canvas.tsx || exit 2

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
  fi
  scan_no_prod site/hoppak.js site/index.html || exit 2
  mkdir -p "site/v/${CLIENT_VER}"
  cp site/index.html "site/v/${CLIENT_VER}/index.html"
  cp site/hoppak.js "site/v/${CLIENT_VER}/hoppak.js"
  scan_no_prod "site/v/${CLIENT_VER}/hoppak.js" "site/v/${CLIENT_VER}/index.html" || exit 2
  echo "site versioned: site/v/${CLIENT_VER}/ (ver=${CLIENT_VER})"
fi
