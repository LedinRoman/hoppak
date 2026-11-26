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
# trailing slash, userinfo, upper case, no scheme, percent-encoding (also double-encoded),
# Unicode dots such as U+3002 / U+FF0E, or the prod host hidden in the path/query/fragment).
# Sub-domains such as staging.76-13-250-251.sslip.io are different hosts and stay allowed.
# Everything is first built into a temp dir inside game/, scanned for the prod host, and only
# then moved into hoppak.js / hoppak.page.tsx / page-build/ / site/ / site/v/<ver>/. A failed
# or blocked build therefore never touches (or dirties) the real output files (BUG-57).
set -e
cd "$(dirname "$0")"
ESB=/tmp/esb/node_modules/.bin/esbuild
CLIENT_VER="${HOP_VERSION:-0.58.0}"
PROD_HOST_GUARD="76-13-250-251.sslip.io"
PROD_IP_GUARD="76.13.250.251"

# guard_url <url-ish>: exit 0 = fine, exit 3 = points at / contains the prod host or IP.
# Normalises first: repeated percent-decoding, NFKC, all Unicode dot variants -> '.', invisible
# format chars and whitespace removed, lower case. Then checks (1) the parsed hostname and
# (2) the WHOLE string (path, query, fragment too) for the prod host / IP as a complete host
# (a sub-domain like staging.<prod host> is not a match).
guard_url() {
  python3 - "$1" << 'PY'
import re, sys, unicodedata
from urllib.parse import unquote
PROD, IP = "76-13-250-251.sslip.io", "76.13.250.251"
DOTS = dict.fromkeys(map(ord, "\u3002\uff0e\uff61\u2024\u2027\ufe52\u0701\u0702\u06d4\u0589"), ".")
def norm(u):
    for _ in range(12):
        v = unquote(u)
        v = unicodedata.normalize("NFKC", v).translate(DOTS)
        v = "".join(c for c in v if unicodedata.category(c) != "Cf" and not c.isspace())
        v = v.lower()
        if v == u:
            break
        u = v
    return u
u = norm(sys.argv[1])
host = re.sub(r"^[a-z][a-z0-9+.\-]*://", "", u)
host = re.split(r"[/?#\\]", host, 1)[0].rsplit("@", 1)[-1]
host = host[1:].split("]", 1)[0] if host.startswith("[") else host.split(":", 1)[0]
host = host.strip(".")
if host in (PROD, IP):
    sys.exit(3)
pat = re.compile(r"(?<![a-z0-9.\-])(76-13-250-251\.sslip\.io|76\.13\.250\.251)(?![a-z0-9\-])")
sys.exit(3 if pat.search(u) else 0)
PY
}

# Refuse a prod target before doing any work (every build path: local, page-build, site, site/v/<ver>).
for _var in HOP_SERVER_URL HOP_SERVER; do
  _val="${!_var:-}"
  [ -z "$_val" ] && continue
  if ! guard_url "$_val"; then
    echo "ERROR: build.sh: $_var=$_val points at / contains the PRODUCTION host ($PROD_HOST_GUARD / $PROD_IP_GUARD). Refusing to bake the prod address into the client. Nothing was written." >&2
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

# All output goes to $OUT (inside game/ so that the final mv is an atomic same-filesystem rename).
BUILD_TMP="$(mktemp -d)"
OUT="$(mktemp -d "$PWD/.build-out.XXXXXX")"
trap 'rm -rf "$BUILD_TMP" "$OUT"' EXIT
mkdir -p "$OUT/page-build"

cat src/01_core.tsx src/02_world.tsx src/03_draw.tsx src/net.tsx src/04_shell.tsx > "$OUT/hoppak.page.tsx"
BUILD_TMP="$BUILD_TMP" OUT="$OUT" python3 - << 'PY'
import os
from pathlib import Path
tmp = Path(os.environ["BUILD_TMP"])
src = (Path(os.environ["OUT"]) / "hoppak.page.tsx").read_text()
game = src.split("/* @@APP */")[0]
game = game.split("\n", 1)[1]  # drop grok/canvas import
(tmp / "hoppak.game.ts").write_text(
    game + "\n;(function(){var c=document.getElementById('c');if(c){window.__hoppak=startHoppak(c);}})();\n"
)
PY
$ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 --define:HOP_VERSION="\"${CLIENT_VER}\"" --outfile="$OUT/hoppak.js" --log-level=warning
sed -i '1i /* Хоппак v0.58 — generated from hoppak.page.tsx by build.sh, do not edit */' "$OUT/hoppak.js"
$ESB "$OUT/hoppak.page.tsx" --minify --line-limit=900 --charset=utf8 --format=esm --jsx=preserve --loader:.tsx=tsx --target=es2017 --define:HOP_PAGE=true --define:HOP_VERSION="\"${CLIENT_VER}\"" --outfile="$BUILD_TMP/hop.min.tsx" --log-level=warning
BUILD_TMP="$BUILD_TMP" OUT="$OUT" python3 - << 'PY'
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
(Path(os.environ["OUT"]) / "page-build" / "hop.canvas.tsx").write_text("// @ts-nocheck\n" + t + "\n")
print("page bytes", len(t.encode()))
PY
node --check "$OUT/hoppak.js" && echo "js ok $(wc -c < "$OUT/hoppak.js") bytes"

DO_SITE=0
if [ "${1:-}" = "site" ]; then
  DO_SITE=1
  SITE_ORIGIN="${HOP_SERVER_URL:-${HOP_SERVER:-}}"
  mkdir -p "$OUT/site/v/${CLIENT_VER}"
  if [ -n "$SITE_ORIGIN" ]; then
    $ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 \
      --define:HOP_SERVER="\"${SITE_ORIGIN}\"" \
      --define:HOP_VERSION="\"${CLIENT_VER}\"" \
      --outfile="$OUT/site/hoppak.js" --log-level=warning
    sed -i '1i /* Хоппак v0.58 site — HOP_SERVER baked in, do not edit */' "$OUT/site/hoppak.js"
  else
    $ESB "$BUILD_TMP/hoppak.game.ts" --loader:.ts=ts --format=iife --target=es2017 \
      --define:HOP_VERSION="\"${CLIENT_VER}\"" \
      --outfile="$OUT/site/hoppak.js" --log-level=warning
    sed -i '1i /* Хоппак v0.58 site — same-origin default (?server= override), do not edit */' "$OUT/site/hoppak.js"
  fi
  OUT="$OUT" python3 - << 'PY'
import os
from pathlib import Path
html = Path("index.html").read_text()
html = html.replace("Хоппак v0.54", "Хоппак v0.58").replace("Хоппак v0.57", "Хоппак v0.58")
o = Path(os.environ["OUT"])
(o / "site" / "index.html").write_text(html)
print("site js", (o / "site" / "hoppak.js").stat().st_size, "bytes")
PY
  echo "site origin ${SITE_ORIGIN:-same-origin}"
  node --check "$OUT/site/hoppak.js" && echo "site js ok $(wc -c < "$OUT/site/hoppak.js") bytes"
  if [ -n "$SITE_ORIGIN" ]; then
    grep -oF "${SITE_ORIGIN}" "$OUT/site/hoppak.js" | head -1 | sed "s/^/baked: /"
  fi
  cp "$OUT/site/index.html" "$OUT/site/v/${CLIENT_VER}/index.html"
  cp "$OUT/site/hoppak.js" "$OUT/site/v/${CLIENT_VER}/hoppak.js"
fi

# Post-scan EVERYTHING that was produced while it is still in the temp dir.
SCAN_FILES=("$OUT/hoppak.js" "$OUT/hoppak.page.tsx" "$OUT/page-build/hop.canvas.tsx")
if [ "$DO_SITE" = 1 ]; then
  SCAN_FILES+=("$OUT/site/hoppak.js" "$OUT/site/index.html" "$OUT/site/v/${CLIENT_VER}/hoppak.js" "$OUT/site/v/${CLIENT_VER}/index.html")
fi
if ! scan_no_prod "${SCAN_FILES[@]}"; then
  echo "ERROR: build.sh: build output contains the PRODUCTION host - nothing was installed; existing hoppak.js / page-build / site/ left untouched." >&2
  exit 2
fi

# Install (atomic same-filesystem renames, only after the scan passed).
mkdir -p page-build
mv -f "$OUT/hoppak.page.tsx" hoppak.page.tsx
mv -f "$OUT/hoppak.js" hoppak.js
mv -f "$OUT/page-build/hop.canvas.tsx" page-build/hop.canvas.tsx
if [ "$DO_SITE" = 1 ]; then
  mkdir -p site "site/v/${CLIENT_VER}"
  mv -f "$OUT/site/hoppak.js" site/hoppak.js
  mv -f "$OUT/site/index.html" site/index.html
  mv -f "$OUT/site/v/${CLIENT_VER}/hoppak.js" "site/v/${CLIENT_VER}/hoppak.js"
  mv -f "$OUT/site/v/${CLIENT_VER}/index.html" "site/v/${CLIENT_VER}/index.html"
  echo "site versioned: site/v/${CLIENT_VER}/ (ver=${CLIENT_VER})"
fi
