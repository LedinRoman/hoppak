# Build from the repo root:  docker build -f server/Dockerfile -t hoppak .
FROM node:22-bookworm-slim AS client
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /tmp/esb && cd /tmp/esb && npm init -y >/dev/null && npm i esbuild@0.24 >/dev/null
WORKDIR /repo
COPY game ./game
RUN bash game/build.sh

FROM node:22-bookworm-slim AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=server /app/package.json ./
COPY --from=server /app/node_modules ./node_modules
COPY --from=server /app/dist ./dist
COPY --from=client /repo/game/index.html /repo/game/hoppak.js ./public/
# Migrations (needs DATABASE_URL): npm run migration:run
#   or: node ./node_modules/typeorm/cli.js -d dist/db/data-source.js migration:run
EXPOSE 8787
HEALTHCHECK CMD node -e "fetch('http://localhost:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
