#!/bin/bash
# Playable demo from the box: one Node process (static client + /ws) on :8787 and a free
# Cloudflare quick tunnel in front of it. Prints the public https URL into server/demo-url.txt.
#   start:   bash server/scripts/demo.sh start
#   stop:    bash server/scripts/demo.sh stop
#   status:  bash server/scripts/demo.sh status
#   local:   bash server/scripts/demo.sh server-only
# Tunnel: TUNNEL=ngrok (default if NGROK_AUTHTOKEN is set; free ngrok account needed) or TUNNEL=cloudflare
# (free, no account, but needs outbound port 7844 — blocked on the Grok box, works on a normal PC/Mac).
# Quick-tunnel / free ngrok URLs change on every restart.
set -u
cd "$(dirname "$0")/.."
PORT=${PORT:-8787}
CF=/workspace/tools/cloudflared
LOGS=/workspace/jumper/server/logs
mkdir -p "$LOGS"
stop() {
  pkill -f "hoppak-demo-loop" 2>/dev/null
  pkill -f "node dist/main.js" 2>/dev/null
  pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null
  pkill -f "ngrok http $PORT" 2>/dev/null
  sleep 0.5
}
case "${1:-start}" in
  stop) stop; echo stopped; exit 0 ;;
  server-only) SERVER_ONLY=1 ;;
  status)
    curl -s "localhost:$PORT/api/health"; echo
    cat demo-url.txt 2>/dev/null; exit 0 ;;
esac
stop
[ -d node_modules ] || npm install --no-audit --no-fund
npx tsc -p tsconfig.json
bash scripts/build-client.sh
# server with auto-restart
setsid nohup bash -c "exec -a hoppak-demo-loop bash -c 'while true; do PORT=$PORT node dist/main.js >> $LOGS/server.log 2>&1; echo restart >> $LOGS/server.log; sleep 1; done'" >/dev/null 2>&1 &
sleep 2
curl -sf "localhost:$PORT/api/health" >/dev/null || { echo "server failed, see $LOGS/server.log"; exit 1; }
[ -n "${SERVER_ONLY:-}" ] && { echo "server on http://localhost:$PORT (no tunnel)"; exit 0; }
: > "$LOGS/tunnel.log"
TUNNEL=${TUNNEL:-$([ -n "${NGROK_AUTHTOKEN:-}" ] && echo ngrok || echo cloudflare)}
if [ "$TUNNEL" = ngrok ]; then
  # the box only allows HTTPS egress via its proxy; ngrok's agent speaks TLS on 443 and honours HTTPS_PROXY
  [ -n "${SAND_EGRESS_TUNNEL_PROXY_ADDR:-}" ] && export HTTPS_PROXY="http://$SAND_EGRESS_TUNNEL_PROXY_ADDR"
  setsid nohup /workspace/tools/ngrok http $PORT --log stdout --log-format logfmt ${NGROK_AUTHTOKEN:+--authtoken "$NGROK_AUTHTOKEN"} > "$LOGS/tunnel.log" 2>&1 &
  PAT='https://[a-z0-9.-]*\.ngrok[a-z.-]*\.(app|dev|io)'
else
  setsid nohup "$CF" tunnel --url "http://localhost:$PORT" --no-autoupdate > "$LOGS/tunnel.log" 2>&1 &
  PAT='https://[a-z0-9-]*\.trycloudflare\.com'
fi
for i in $(seq 1 40); do
  URL=$(grep -oE "$PAT" "$LOGS/tunnel.log" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "${URL:-}" ]; then echo "tunnel did not come up, see $LOGS/tunnel.log (server still runs on :$PORT)"; exit 1; fi
echo "$URL" > demo-url.txt
echo "Хоппак demo: $URL"
