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

SENT_FILES="hoppak.js hoppak.page.tsx page-build/hop.canvas.tsx site/hoppak.js site/index.html site/v/0.58.0/hoppak.js site/v/0.58.0/index.html site/v/0.59.0/hoppak.js"
fresh() {
  rm -rf "$TMP/g"; mkdir -p "$TMP/g"; cp -r "$HERE/src" "$HERE/index.html" "$HERE/build.sh" "$TMP/g/"
  # sentinel "previous good build" outputs: a blocked/failed build must leave them byte- and mtime-identical
  local f
  for f in $SENT_FILES; do mkdir -p "$TMP/g/$(dirname "$f")"; echo "SENTINEL $f" > "$TMP/g/$f"; touch -d "2020-01-01 00:00:00" "$TMP/g/$f"; done
}
snap() { (cd "$TMP/g" && for f in $SENT_FILES; do stat -c '%n %Y %s' "$f"; sha1sum "$f"; done; find . -path ./src -prune -o -type f -print | sort); }
ok()  { pass=$((pass+1)); echo "PASS $1"; }
bad() { fail=$((fail+1)); echo "FAIL $1"; }
has_prod() { grep -rEq "(^|[^A-Za-z0-9.-])(76-13-250-251\.sslip\.io|76\.13\.250\.251)([^A-Za-z0-9-]|$)" "$@" 2>/dev/null; }

# expect_block <label> <mode> VAR=value ...  -> must exit non-zero, mention PRODUCTION, leave no prod host in any output
expect_block() {
  local label="$1" mode="$2"; shift 2
  fresh
  local out rc before
  before="$(snap)"
  out="$(cd "$TMP/g" && env "$@" bash ./build.sh $mode 2>&1)"; rc=$?
  if [ $rc -ne 0 ] && echo "$out" | grep -q "PRODUCTION"; then
    if has_prod "$TMP/g/hoppak.js" "$TMP/g/site" "$TMP/g/page-build"; then bad "$label (exit $rc but prod host in output)"
    elif [ "$(snap)" != "$before" ]; then bad "$label (blocked exit $rc but output files / site/ changed)"
    else ok "$label -> blocked (exit $rc), site/ + outputs untouched"; fi
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

# BUG-57: percent-encoding (also double), Unicode dots, prod host hidden in query/fragment/path, mixed tricks
for mode in "" site; do
  m="${mode:-local}"
  expect_block "[$m] BUG-57 trailing %2e"                  "$mode" "HOP_SERVER_URL=https://$PROD%2e"
  expect_block "[$m] BUG-57 trailing %2E/"                 "$mode" "HOP_SERVER_URL=https://$PROD%2E/"
  expect_block "[$m] BUG-57 trailing %2F"                  "$mode" "HOP_SERVER_URL=https://$PROD%2F"
  expect_block "[$m] BUG-57 percent-encoded dots in host"  "$mode" "HOP_SERVER_URL=https://76-13-250-251%2esslip%2eio"
  expect_block "[$m] BUG-57 double-encoded %252e"          "$mode" "HOP_SERVER_URL=https://$PROD%252e"
  expect_block "[$m] BUG-57 fully %-encoded host letters"  "$mode" "HOP_SERVER_URL=https://%37%36-13-250-251.sslip.io"
  expect_block "[$m] BUG-57 prod host in query"            "$mode" "HOP_SERVER_URL=https://127.0.0.1/?redirect=https://$PROD"
  expect_block "[$m] BUG-57 prod host in query (encoded)"  "$mode" "HOP_SERVER_URL=https://127.0.0.1/?r=https%3A%2F%2F$PROD"
  expect_block "[$m] BUG-57 prod host in fragment"         "$mode" "HOP_SERVER_URL=https://game.example.com/#$PROD"
  expect_block "[$m] BUG-57 prod IP in query"              "$mode" "HOP_SERVER_URL=https://game.example.com/?ip=$IP"
  expect_block "[$m] BUG-57 prod host in path"             "$mode" "HOP_SERVER_URL=https://game.example.com/$PROD/ws"
  expect_block "[$m] BUG-57 ideographic dot U+3002"        "$mode" "HOP_SERVER_URL=https://$PROD。"
  expect_block "[$m] BUG-57 fullwidth dot U+FF0E"          "$mode" "HOP_SERVER_URL=https://$PROD．"
  expect_block "[$m] BUG-57 halfwidth ideographic U+FF61"  "$mode" "HOP_SERVER_URL=https://$PROD｡/"
  expect_block "[$m] BUG-57 U+3002 as host separators"     "$mode" "HOP_SERVER_URL=https://76-13-250-251。sslip。io"
  expect_block "[$m] BUG-57 fullwidth digits"              "$mode" "HOP_SERVER_URL=https://７６-13-250-251.sslip.io"
  expect_block "[$m] BUG-57 zero-width space inside"       "$mode" "HOP_SERVER_URL=https://76-13-250-251.sslip.io​/"
  expect_block "[$m] BUG-57 HOP_SERVER alias %2e"          "$mode" "HOP_SERVER=wss://$PROD%2e/ws"
  expect_block "[$m] BUG-57 IP with %2e"                   "$mode" "HOP_SERVER_URL=https://76%2e13%2e250%2e251"
  expect_block "[$m] BUG-57 whitespace + upper + trailing dot" "$mode" "HOP_SERVER_URL=  HTTPS://76-13-250-251.SSLIP.IO.  "
done
# staging / unrelated forms that must still be ALLOWED (no false positives)
expect_allow "[site]  staging with %2e-free query"        site "HOP_SERVER_URL=https://staging.$PROD/?v=1"
expect_allow "[site]  staging wss + path + fragment"      site "HOP_SERVER_URL=wss://staging.$PROD/ws/#x"
expect_allow "[site]  staging upper case + trailing dot"  site "HOP_SERVER_URL=HTTPS://STAGING.76-13-250-251.SSLIP.IO."
expect_allow "[site]  other host with look-alike IP 176.13.250.2510" site "HOP_SERVER_URL=https://game.example.com/?x=176.13.250.2510"
expect_allow "[site]  punycode of a different host"       site "HOP_SERVER_URL=https://xn--76-13-250-251-sslip-io.example.invalid"

# (b) atomic install: a build that FAILS the post-scan must not touch existing outputs / site/.
# Make the sources themselves contain the prod host (no env var -> pre-check cannot catch it).
for mode in "" site; do
  m="${mode:-local}"
  fresh
  echo "/* leak $PROD */" >> "$TMP/g/src/01_core.tsx"
  before="$(snap)"
  out="$(cd "$TMP/g" && bash ./build.sh $mode 2>&1)"; rc=$?
  if [ $rc -eq 2 ] && echo "$out" | grep -q "PRODUCTION" && [ "$(snap)" == "$before" ]; then ok "[$m] post-scan failure (prod host in sources) -> exit 2, nothing installed, site/ untouched"; else bad "[$m] post-scan failure left files changed or wrong exit ($rc)"; fi
done
fresh
(cd "$TMP/g" && bash ./build.sh site >/dev/null 2>&1)
if ! find "$TMP/g" -maxdepth 1 -name '.build-out.*' | grep -q .; then ok "temp output dir cleaned up after a successful build"; else bad "temp .build-out.* left behind"; fi

# Tester r5's 17 negative forms (my_neg.log), verbatim: VAR=value
while IFS= read -r line; do
  [ -z "$line" ] && continue
  expect_block "[site] r5 form: $line" site "$line"
done <<'FORMS'
HOP_SERVER_URL=https://76-13-250-251.sslip.io
HOP_SERVER=https://76-13-250-251.sslip.io
HOP_SERVER_URL=https://76-13-250-251.sslip.io/
HOP_SERVER_URL=wss://76-13-250-251.sslip.io/ws
HOP_SERVER_URL=http://76-13-250-251.sslip.io:443
HOP_SERVER_URL=HTTPS://76-13-250-251.SSLIP.IO
HOP_SERVER_URL=76-13-250-251.sslip.io
HOP_SERVER_URL=https://76-13-250-251.sslip.io.
HOP_SERVER_URL=https://76.13.250.251
HOP_SERVER_URL=https://76.13.250.251:8443/ws
HOP_SERVER=wss://76.13.250.251/ws
HOP_SERVER_URL=https://76-13-250-251.sslip.io./foo
HOP_SERVER_URL=https://user:pass@76-13-250-251.sslip.io
HOP_SERVER_URL=  https://76-13-250-251.sslip.io  
HOP_SERVER_URL=https://76-13-250-251.sslip.io#x
HOP_SERVER_URL=ws://76.13.250.251
HOP_SERVER_URL=https://76-13-250-251.sslip.io:443/
FORMS

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
