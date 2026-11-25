# Хоппак — Profile API Contract (v0.6)

This document defines the HTTP JSON contract for the v0.6 guest profile.

- **Deployed / Staging Truth:** `feat/profile-db @ 2284797` (running on staging `https://staging.76-13-250-251.sslip.io` as `hs-profile` with Postgres 16).
- **Additive v0.6 Server Extension Branch:** `feat/profile-server-v06` (branched from `2284797`, adds `best`, `runId` idempotency, and `POST /api/profile/buy`).
- **Client Branch:** `feat/profile-v06` (targets `2284797` today and supports `feat/profile-server-v06` fields automatically).

---

## 1. Transport, Origin & Shared Profile Across `/v/<ver>/`

- **Base URL:** Same-origin `/api` by default (`window.location.origin + "/api/..."` on `http:` / `https:`).
  - Client override order: `?api=` query param → `window.HOPPAK_API` → `localStorage["hoppak.api"]` → build-time `HOP_API` → same-origin `location.origin` (on `http:`/`https:`).
- **CORS:** `feat/profile-db @ 2284797` does **not** call `app.enableCors()`. Caddy routes `/`, `/v/<ver>/`, and `/api/*` on the same origin (`https://staging.76-13-250-251.sslip.io` / prod).
- **One profile across all `/v/<ver>/` paths:** The client stores the Bearer token in `localStorage["hoppak_guest_token"]` (origin-scoped, shared across `/`, `/v/0.58/`, `/v/0.6/`, etc. on the same domain), along with the pending run queue (`hoppak_profile_queue`) and local purchase cache (`hoppak_profile_buys`).
- **Auth header:** `Authorization: Bearer <64-hex-token>`. The server stores only `sha256(token)` in `player.guest_token_hash`.
- **HTTP status on POST:** NestJS `@Post()` returns `201 Created` on success (`200 OK` on `GET`).

---

## 2. Deployed Server Contract (`feat/profile-db @ 2284797`, Source of Truth)

### Public Profile Object (`PublicProfile`)

```json
{
  "id": "uuid-v4",
  "coins": 0,
  "purchases": { "char:1": 1, "map:jungle": 1 },
  "migratedAt": "2026-11-26T00:00:00.000Z" | null,
  "createdAt": "2026-11-26T00:00:00.000Z",
  "telegramId": "123456789" | null
}
```

### `POST /api/profile/guest`

Create a guest profile, or return the existing one if a valid Bearer token is provided.

- **Auth:** Optional `Authorization: Bearer <token>`.
- **Request body:** None (ignored).
- **Response (`201`):**
  ```json
  { "ok": true, "token": "<64-hex>", "profile": { ...PublicProfile } }
  ```

### `GET /api/profile`

Fetch the current profile.

- **Auth:** Required `Authorization: Bearer <token>`.
- **Response (`200`):**
  ```json
  { "ok": true, "profile": { ...PublicProfile } }
  ```

### `POST /api/profile/migrate`

One-time, idempotent import of an existing browser `localStorage` save into a fresh guest profile.

- **Auth:** Required `Authorization: Bearer <token>`.
- **Request body:**
  ```json
  { "coins": 120, "purchases": { "char:1": 1, "map:jungle": 1 } }
  ```
- **Server rules (`server/src/profile/limits.ts`):**
  - If `profile.migratedAt !== null`, returns current `profile` unchanged (idempotent).
  - `MIGRATE_COINS_MAX = 8000`: incoming `coins` is clamped to `[0, 8000]`, and resulting `player.coins` is clamped to `[0, 8000]`.
  - `purchases`: keeps only keys matching `/^(hero|char|map):[a-z0-9_-]+$/i` with truthy/positive values normalized to `1`; merges into existing `purchases`.
  - Sets `migrated_at = now()`.
- **Response (`201`):**
  ```json
  { "ok": true, "profile": { ...PublicProfile } }
  ```

### `POST /api/run/finish`

Credit coins after a completed run (note path: `/api/run/finish`, not `/api/profile/run`).

- **Auth:** Required `Authorization: Bearer <token>`.
- **Request body:**
  ```json
  { "height": 420, "runCoins": 12, "bonusCoins": 5 }
  ```
  *(Extra fields like `runId`, `mode`, `map`, `ver` are ignored by `2284797` because no `ValidationPipe` whitelist is enabled.)*
- **Server calculation & anti-spam caps (`limits.ts`, labelled assumptions):**
  - `h = clamp(floor(height), 0, 20000)` → height reward `floor(h / 25)`
  - `c = clamp(floor(runCoins), 0, 80)`
  - `b = clamp(floor(bonusCoins), 0, 40)`
  - `want = clamp(floor(h / 25) + c + b, 0, 200)` (`RUN_AWARD_MAX = 200`)
  - Minimum interval between finishes: `FINISH_INTERVAL_MS = 8000` (8 s) → `429` `RATE_LIMIT`.
  - Rolling 1-hour award cap per player: `HOUR_AWARD_MAX = 400`. If remaining hourly room `< want`, only remaining room is granted and `"limited": "HOUR_CAP"` is returned.
- **Response (`201`):**
  ```json
  { "ok": true, "awarded": 33, "profile": { ...PublicProfile }, "limited": "HOUR_CAP" }
  ```
  (`limited` omitted unless capped.)

### `POST /api/auth/telegram` (present in `2284797`, next step)

- **Behavior:** Returns `503` `TELEGRAM_AUTH_UNAVAILABLE` when `TELEGRAM_BOT_TOKEN` is unset. Not called by the v0.6 client yet.

### Error Codes (`2284797`)

| HTTP | `error` | Meaning |
|---:|---|---|
| `401` | `UNAUTHORIZED` | Missing or unknown Bearer token |
| `429` | `RATE_LIMIT` | `/api/run/finish` called < 8 s after previous finish |
| `503` | `PROFILE_UNAVAILABLE` | `DATABASE_URL` not configured (client falls back to local save) |
| `503` | `TELEGRAM_AUTH_UNAVAILABLE` | `TELEGRAM_BOT_TOKEN` not set (step 2) |

### Database Migrations (`2284797`, TypeORM, `synchronize: false`)

1. `1795634271113-Init` — empty baseline (`migrations` bookkeeping table).
2. `1795634564759-AddPlayer` — creates `"player"` (`id`, `guest_token_hash`, `coins`, `purchases`, `migrated_at`, `created_at`, `last_finish_at`, `window_started_at`, `awarded_in_window`).
3. `1795638000000-AddTelegramToPlayer` — adds `telegram_id`, `telegram_linked_at`.

---

## 3. Gaps in `2284797` vs v0.6 Goals & Additive Server Branch (`feat/profile-server-v06`)

`feat/profile-db @ 2284797` has three gaps relative to full server-authoritative v0.6:

1. **No `best` record in DB or `PublicProfile`:** `2284797` does not store best height on the server (`localStorage["hoppak_save"]` shares `best`/`mapBest` across `/v/<ver>/` on the same origin only).
2. **No `runId` idempotency on `POST /api/run/finish`:** `2284797` relies only on the 8 s `RATE_LIMIT` and 400/h cap; a retried request after a dropped HTTP response > 8 s later could credit twice.
3. **No `POST /api/profile/buy`:** `2284797` cannot deduct coins or append to `purchases` after initial `migrate`. Until deployed, the client tracks unconfirmed local purchases (`hoppak_profile_buys`) so reloads/run-finishes do not restore spent coins.

**Additive changes implemented on separate server branch `feat/profile-server-v06` (from `2284797`):**

- **Migration `1795642000000-AddBestBuyRunId`:**
  - `ALTER TABLE "player" ADD COLUMN "best" integer NOT NULL DEFAULT 0`
  - `CREATE TABLE "player_run" ("player_id" uuid, "run_id" varchar(64), "awarded" int, "created_at" timestamptz, PK(player_id, run_id), FK -> player.id)`
- **`PublicProfile.best`:** returned on all profile endpoints; updated on `POST /api/profile/migrate` (optional `best?: number`) and `POST /api/run/finish` (`best = max(best, height)`).
- **Optional `runId` on `POST /api/run/finish`:** when provided (1–64 chars `[a-zA-Z0-9_.:-]+`), duplicates return `{ ok: true, awarded, duplicate: true, profile }` idempotently (bypassing `429 RATE_LIMIT` and without double-crediting). Invalid format → `400 INVALID_RUN_ID`.
- **`POST /api/profile/buy` `{ key: string }`:**
  - Authoritative price table matching `game/src/01_core.tsx` (`CHARS` & `MAPS`):
    - Heroes: `char:0` (0), `char:1` (150), `char:2` (200), `char:3` (240), `char:4` (280), `char:5` (320)
    - Maps: `map:city` (0), `map:jungle` (80), `map:ice` (100), `map:lava` (120), `map:aqua` (140), `map:space` (160)
  - Unknown key → `400 INVALID_ITEM`. Insufficient coins → `400 INSUFFICIENT_COINS`.
  - Already owned → `201 { ok: true, alreadyOwned: true, profile }` (idempotent).
  - Otherwise deducts `price` and sets `purchases[key] = 1` inside a row-locked transaction.

---

## 4. Merge Conflict Note (`feat/profile-db` vs `feat/bluegreen-server @ c432f62`)

Not resolved here (Devops currently runs `hs-profile` as a separate container on staging):
- `2284797` and `c432f62` share merge-base `2e6bfc0` and conflict in `server/package.json` and `server/src/app.module.ts`.
- `feat/profile-server-v06` intentionally leaves `server/package.json` and `server/src/app.module.ts` untouched so it adds zero new conflict hunks.
