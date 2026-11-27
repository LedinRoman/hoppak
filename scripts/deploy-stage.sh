#!/bin/bash
# Build the `staging` git branch and publish the client to
#   https://staging.76-13-250-251.sslip.io/stage/
#
# Run from a hoppak checkout that can build the game (esbuild at /tmp/esb or $ESB):
#   bash scripts/deploy-stage.sh
#
# Env:
#   HOP_SERVER      default https://staging.76-13-250-251.sslip.io
#   HOP_VER_LABEL   default v1.0-w18 (page title / JS header)
#   SSH_KEY         default ~/.ssh/hopper_hostinger
#   SSH_HOST        default root@76.13.250.251
#   SITE_ROOT       default /srv/hopper-staging/site
#   DRY_RUN=1       build locally, do not copy or reload
set -euo pipefail

ORIGIN="${HOP_SERVER:-https://staging.76-13-250-251.sslip.io}"
LABEL="${HOP_VER_LABEL:-v1.0-w18}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hopper_hostinger}"
SSH_HOST="${SSH_HOST:-root@76.13.250.251}"
SITE_ROOT="${SITE_ROOT:-/srv/hopper-staging/site}"
REMOTE_STAGE="${SITE_ROOT}/stage"

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "staging" ]; then
  echo "deploy-stage.sh: checkout the staging branch first (now on $branch)" >&2
  exit 1
fi
sha=$(git rev-parse --short=12 HEAD)
echo "building staging $sha  origin=$ORIGIN  label=$LABEL"

cd game
HOP_SERVER="$ORIGIN" bash build.sh site
python3 - << PY
import hashlib, re
from pathlib import Path
label = "${LABEL}"
html_path = Path("site/index.html")
html = html_path.read_text()
for old in ("Хоппак v0.6rc", "Хоппак v0.6", "Хоппак v1.0-w18", "Хоппак v1.0"):
    html = html.replace(old, "Хоппак " + label)
html_path.write_text(html)
js = Path("site/hoppak.js")
text = js.read_text()
text = re.sub(r"^/\* Хоппак .*? site —", "/* Хоппак %s site —" % label, text, count=1)
js.write_text(text)

def stamp(html, name, file):
    ver = hashlib.sha1(Path(file).read_bytes()).hexdigest()[:8]
    new, n = re.subn(r'(src="' + re.escape(name) + r')(?:\?v=[0-9a-fA-F]*)?(")', r'\1?v=' + ver + r'\2', html, count=1)
    if n != 1:
        raise SystemExit("cache-bust: script tag not found: " + name)
    print("cache", name, ver)
    return new
html = html_path.read_text()
html = stamp(html, "tg-boot.js", "site/tg-boot.js")
html = stamp(html, "hoppak.js", "site/hoppak.js")
html_path.write_text(html)
baked = Path("site/hoppak.js").read_text().count("${ORIGIN}")
if baked < 1:
    raise SystemExit("HOP_SERVER origin was not baked into site/hoppak.js")
print("baked origin count", baked)
PY

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1: built game/site/, not copying"
  exit 0
fi

ssh() { command ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes "$SSH_HOST" "$@"; }
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TAR=/tmp/hoppak-stage-site-$STAMP.tgz
tar -C "$ROOT/game/site" -czf "$TAR" .
ssh "set -e
  mkdir -p /srv/hopper-staging/backups $REMOTE_STAGE
  if [ -d $REMOTE_STAGE ] && [ -f $REMOTE_STAGE/index.html ]; then
    mkdir -p /srv/hopper-staging/backups/site-stage-$STAMP
    cp -a $REMOTE_STAGE /srv/hopper-staging/backups/site-stage-$STAMP/stage
    echo backed up $REMOTE_STAGE
  fi
"
scp -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes "$TAR" "$SSH_HOST:/tmp/hoppak-stage-site.tgz"
ssh "set -e
  mkdir -p $REMOTE_STAGE
  find $REMOTE_STAGE -mindepth 1 -delete
  tar xzf /tmp/hoppak-stage-site.tgz -C $REMOTE_STAGE
  rm -f /tmp/hoppak-stage-site.tgz
  printf '%s\n' '$sha' '${ORIGIN}' \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > $REMOTE_STAGE/DEPLOYED
"
rm -f "$TAR"

echo "deployed $sha to $REMOTE_STAGE"
echo "open ${ORIGIN}/stage/"
