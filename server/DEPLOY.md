# Хоппак online — deploy notes (not deployed yet)

One Node process serves the static client (`/`, `/hoppak.js`) **and** the WebSocket (`/ws`) on one port (8787),
so any HTTPS front works: a tunnel for demos, nginx on a VPS later.

## Demo from any machine (no hosting)
```bash
cd server && npm ci && bash scripts/demo.sh start          # Cloudflare quick tunnel (needs outbound :7844)
NGROK_AUTHTOKEN=xxx bash scripts/demo.sh start             # or ngrok (free account), works behind HTTPS-only proxies
bash scripts/demo.sh status | stop | server-only
```
The public URL is printed and saved in `server/demo-url.txt`. It changes on every restart.

## VPS (Hostinger etc.) with Docker
```bash
git clone <repo> hoppak && cd hoppak
docker compose -f server/docker-compose.yml up -d --build   # listens on 127.0.0.1:8787
```
nginx (TLS via certbot), WebSocket upgrade on `/ws`:
```nginx
server {
  listen 443 ssl http2;
  server_name hoppak.example.com;
  ssl_certificate     /etc/letsencrypt/live/hoppak.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/hoppak.example.com/privkey.pem;
  location /ws {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
  }
  location / { proxy_pass http://127.0.0.1:8787; proxy_set_header Host $host; }
}
```
Needed from Roman: SSH access, a (sub)domain pointed at the server, Docker or Node 22 installed.
Rooms live in memory: one instance only (for several instances add Redis + sticky sessions).

## Database and migrations (TypeORM)

`DATABASE_URL` is optional. Without it the process starts as today: in-memory rooms and `/api/health` work, the DB module is not loaded.

When Postgres is available, set `DATABASE_URL` (for example `postgres://user:pass@host:5432/hoppak`) in the environment. `synchronize` is off; schema changes go through migrations.

Run migrations against the compiled image, *before* the new server starts, in a one-off container from the same image:

```bash
docker compose -f server/docker-compose.yml run --rm --no-deps \
  -e DATABASE_URL="$DATABASE_URL" \
  hoppak npm run migration:run
```

Equivalent without npm:

```bash
node ./node_modules/typeorm/cli.js -d dist/db/data-source.js migration:run
```

Revert the last migration: `npm run migration:revert`. Generate a new one locally after `npm run build`: `npm run migration:generate -- src/db/migrations/Name`.

