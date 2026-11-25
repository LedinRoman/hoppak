#!/bin/bash
# Builds hoppak.page.tsx (Page source), hoppak.js (local) and dist-page/hop.canvas.tsx (minified Page upload)
set -e
cd "$(dirname "$0")"
ESB=/tmp/esb/node_modules/.bin/esbuild
cat src/01_core.tsx src/02_world.tsx src/03_draw.tsx src/net.tsx src/04_shell.tsx > hoppak.page.tsx
python3 - << 'PY'
src = open("hoppak.page.tsx").read()
game = src.split("/* @@APP */")[0]
game = game.split("\n", 1)[1]  # drop grok/canvas import
open("/tmp/hoppak.game.ts", "w").write(game + "\n;(function(){var c=document.getElementById('c');if(c){window.__hoppak=startHoppak(c);}})();\n")
PY
$ESB /tmp/hoppak.game.ts --loader:.ts=ts --format=iife --target=es2017 --outfile=hoppak.js --log-level=warning
sed -i '1i /* Хоппак v0.52 — generated from hoppak.page.tsx by build.sh, do not edit */' hoppak.js
mkdir -p page-build
$ESB hoppak.page.tsx --minify --line-limit=900 --charset=utf8 --format=esm --jsx=preserve --loader:.tsx=tsx --target=es2017 --define:HOP_PAGE=true --outfile=/tmp/hop.min.tsx --log-level=warning
python3 - << 'PY'
import re
t = open("/tmp/hop.min.tsx").read().strip()
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
open("page-build/hop.canvas.tsx", "w").write("// @ts-nocheck\n" + t + "\n")
print("page bytes", len(t.encode()))
PY
node --check hoppak.js && echo "js ok $(wc -c < hoppak.js) bytes"
