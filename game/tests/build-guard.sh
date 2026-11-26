#!/bin/bash
# BUG-55 regression test: build.sh must never bake the production host into any artifact.
# Runs build.sh on a throw-away copy of game/ (never touches the real hoppak.js / site/).
#   bash game/tests/build-guard.sh
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PROD="76-13-250-251.sslip.io"
IP="76.13.250.251"
pass=0; fail=0

fresh() { rm -rf "$TMP/g"; mkdir -p "$TMP/g"; cp -r "$HERE/src" "$HERE/index.html" "$HERE/build.sh" "$TMP/g/"; }
ok()  { pass=$((pass+1)); echo "PASS $1"; }
bad() { fail=$((fail+1)); echo "FAIL $1"; }
has_prod() { grep -rEq "(^|[^A-Za-z0-9.-])(76-13-250-251\.sslip\.io|76\.13\.250\.251)([^A-Za-z0-9-]|$)" "$@" 2>/dev/null; }

# expect_block <label> <mode> VAR=value ...  -> must exit non-zero, mention PRODUCTION, leave no prod host in any output
expect_block() {
  local label="$1" mode="$2"; shift 2
  fresh
  local out rc
  out="$(cd "$TMP/g" && env "$@" bash ./build.sh $mode 2>&1)"; rc=$?
  if [ $rc -ne 0 ] && echo "$out" | grep -q "PRODUCTION"; then
    if has_prod "$TMP/g/hoppak.js" "$TMP/g/site" "$TMP/g/page-build"; then bad "$label (exit $rc but prod host in output)"; else ok "$label -> blocked (exit $rc)"; fi
  else
    bad "$label -> NOT blocked (exit $rc)"
  fi
}

# expect_allow <label> <mode> [VAR=value ...] -> must exit 0; prod host not present as a bare host
expect_allow() {
  local label="$1" mode="$2"; shift 2
  fresh
  local out rc
  out="$(cd "$TMP/g" && env "$@" bash ./build.sh $mode 2>&1)"; rc=$?
  if [ $rc -eq 0 ] && ! has_prod "$TMP/g/hoppak.js" "$TMP/g/site" "$TMP/g/page-build"; then ok "$label -> built (exit 0)"; else bad "$label -> unexpected exit $rc: $(echo "$out" | tail -2)"; fi
}

for mode in "" site; do
  m="${mode:-local}"
  expect_block "[$m] HOP_SERVER_URL=https://$PROD"              "$mode" "HOP_SERVER_URL=https://$PROD"
  expect_block "[$m] HOP_SERVER_URL trailing slash"             "$mode" "HOP_SERVER_URL=https://$PROD/"
  expect_block "[$m] HOP_SERVER_URL with path"                  "$mode" "HOP_SERVER_URL=https://$PROD/ws/blue"
  expect_block "[$m] HOP_SERVER_URL wss://"                     "$mode" "HOP_SERVER_URL=wss://$PROD/ws"
  expect_block "[$m] HOP_SERVER_URL http:// + port"             "$mode" "HOP_SERVER_URL=http://$PROD:443"
  expect_block "[$m] HOP_SERVER_URL upper case"                 "$mode" "HOP_SERVER_URL=HTTPS://76-13-250-251.SSLIP.IO"
  expect_block "[$m] HOP_SERVER_URL no scheme"                  "$mode" "HOP_SERVER_URL=$PROD"
  expect_block "[$m] HOP_SERVER_URL userinfo trick"             "$mode" "HOP_SERVER_URL=https://game@$PROD/"
  expect_block "[$m] HOP_SERVER_URL trailing dot"               "$mode" "HOP_SERVER_URL=https://$PROD./"
  expect_block "[$m] HOP_SERVER=https://$PROD (alias)"          "$mode" "HOP_SERVER=https://$PROD"
  expect_block "[$m] HOP_SERVER=wss://$PROD (alias, wss)"       "$mode" "HOP_SERVER=wss://$PROD/ws/"
  expect_block "[$m] bare IP $IP"                               "$mode" "HOP_SERVER_URL=$IP"
  expect_block "[$m] https://$IP:8443/"                         "$mode" "HOP_SERVER_URL=https://$IP:8443/"
  expect_block "[$m] HOP_SERVER_URL ok but HOP_SERVER prod"     "$mode" "HOP_SERVER_URL=https://staging.$PROD" "HOP_SERVER=https://$PROD"
done

# site/v/<ver>/ path with a custom version
expect_block "[site] HOP_VERSION=0.59.0 + prod host" site "HOP_VERSION=0.59.0" "HOP_SERVER_URL=https://$PROD"

# allowed
expect_allow "[local] default same-origin"                    ""
expect_allow "[site]  default same-origin"                    site
expect_allow "[site]  HOP_SERVER_URL=https://staging.$PROD"   site "HOP_SERVER_URL=https://staging.$PROD"
expect_allow "[site]  HOP_SERVER_URL=wss://staging.$PROD/ws"  site "HOP_SERVER_URL=wss://staging.$PROD/ws"
expect_allow "[site]  HOP_SERVER=https://staging.$PROD/ (alias)" site "HOP_SERVER=https://staging.$PROD/"
expect_allow "[site]  other host https://game.example.com"    site "HOP_SERVER_URL=https://game.example.com"
expect_allow "[site]  HOP_VERSION=0.59.0 default"             site "HOP_VERSION=0.59.0"

# staging build really bakes the staging host into site/ and site/v/<ver>/ (and nothing else)
fresh
(cd "$TMP/g" && HOP_VERSION=0.59.0 HOP_SERVER_URL="https://staging.$PROD" bash ./build.sh site >/dev/null 2>&1)
if grep -qF "staging.$PROD" "$TMP/g/site/hoppak.js" && grep -qF "staging.$PROD" "$TMP/g/site/v/0.59.0/hoppak.js"; then ok "staging host baked into site/ and site/v/0.59.0/"; else bad "staging host not baked"; fi

# default build contains no server host at all
fresh
(cd "$TMP/g" && bash ./build.sh site >/dev/null 2>&1)
if ! grep -qF "sslip.io" "$TMP/g/site/hoppak.js" "$TMP/g/site/v/0.58.0/hoppak.js" "$TMP/g/hoppak.js"; then ok "default build has no sslip.io host in hoppak.js / site/"; else bad "default build mentions sslip.io"; fi

echo "build-guard: $pass passed, $fail failed"
[ $fail -eq 0 ]
