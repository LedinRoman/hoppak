# Хоппак realtime server

NestJS 11 + `@nestjs/platform-ws` (plain WebSocket). Rooms by 4-digit code, up to 4 players.

```bash
npm ci && npm run build && npm run client && npm start     # http://localhost:8787  (ws: /ws, health: /api/health)
bash scripts/demo.sh server-only                           # same, in background with auto-restart
node ../game/tests/net-protocol.js                         # protocol test, headless node clients
node ../game/tests/net-e2e.js                              # 4 real game clients in headless Chrome
```

## Why plain ws, not socket.io
The client is one hand-built canvas bundle with no npm imports (it also ships as a Canvas Page), so a
native `WebSocket` costs 0 KB while socket.io-client adds ~45 KB plus its own framing. We need only a
handful of JSON messages, and reconnect/resume is game-specific anyway (seat token + 10 s grace), so
socket.io's extras would not be used. Handlers stay ordinary NestJS `@SubscribeMessage` methods
(`{event, data}` frames), so moving to socket.io later is a gateway-adapter swap.

## Model ("authoritative-light")
- Host creates a room, friends join by code, mark ready, host starts. Server picks the **seed** and a
  start time ~1.5 s ahead; every client builds the same map from the seed (map generator is a seeded
  mulberry32; online rooms also pin the world width `lw = 180`, because the generator depends on it).
- Each client simulates **only its own hero** and sends state at ~15 Hz; the server keeps the latest
  per player and broadcasts batched snapshots at up to 20 Hz. Clients render remote heroes ~150 ms in
  the past with interpolation (short extrapolation if a packet is late).
- Events: `dead` (with metres), `mob` (stomped mob id = kind:baseX:baseY, removed on every screen),
  `left`. The server ends the round when everyone has fallen (or left / went silent for 15 s) and sends
  the same ranking to all.
- Reconnect: the seat token lives in sessionStorage; on socket drop the client retries for 10 s and
  `resume`s the same seat; others see "НЕТ СВЯЗИ" meanwhile. After 10 s the seat is freed. Empty rooms
  are deleted immediately, idle rooms after 1 h.
- Validation: numbers clamped/finite, height can't decrease, message flood guard (60/s soft, 180/s kick),
  join/start/map rules enforced on the server. Climbs faster than physically possible are only *counted*
  (`suspicious`), not rejected.

## Future work
- Anti-cheat: server-side physics replay of inputs (the sim is deterministic), signed results.
- Shared coins/bonuses (now per-player), PvP interactions, spectator join mid-round.
- Equal screen height for fairness (taller phones see slightly more below before falling out).
- Persistence (Redis) if more than one server instance is ever needed.

## Client integration (game/)
`game/src/net.tsx` holds all online code (protocol client, interpolation, room screens, countdown).
It is concatenated before `04_shell.tsx` by `game/build.sh`. Hooks in existing files:
- `02_world.tsx` `tickWorld`: skip `p.remote` heroes; no fall-death check for them; when `w.net`, the
  server (not the local rule) ends the round.
- `04_shell.tsx`: `resize()` pins `LW` while in a room; `startNet()`; `net:*` taps routed to `NET.tap`;
  phase `"net"` drawn by `NET.draw`; ticks wait for the countdown; `NET.frame` after ticks;
  `NET.overlay` after `drawPlay`; menu button "ОНЛАЙН"; `netApi` object; results "РЕВАНШ/МЕНЮ" in
  online mode go back to the room / leave it.
Offline (no server, e.g. the Canvas Page or file://): the online screen shows "НЕТ СВЯЗИ" with
"С БОТАМИ" (the bot squad); solo and bots are untouched.
Server URL: same host `/ws`, or `?server=wss://…/ws`, `window.HOPPAK_SERVER`, `localStorage['hoppak.server']`.
