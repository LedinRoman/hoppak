# Хоппак: серверная часть blue-green деплоя

Ветка: `feat/bluegreen-server` (база: `net @ 2e6bfc0`).
Изоляция от будущих правок профиля: вся новая логика вынесена в `src/bluegreen/*`, изменения в общих файлах (`src/app.module.ts`, `src/game.gateway.ts`, `src/protocol.ts`) минимальны.

## 1. Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `8787` | Публичный HTTP/WS порт (`/api/health`, `/ws`, статика). |
| `INTERNAL_PORT` | `3001` | Отдельный внутренний HTTP-порт для `/internal/*`. Значения `0`/`off`/`none`/`false` отключают внутренний сервер. **Не публиковать наружу.** |
| `NODE_NAME` | `local` | Имя слота (`blue` или `green`). Передаётся в `hello`, `/api/health`, `/internal/*`. |
| `APP_VERSION` | из `package.json` (`0.1.0`) | Версия сборки для `/api/health`, `hello` (v2) и `update`. |
| `PEER_INTERNAL_URL` | `""` | URL внутреннего порта соседнего слота (например, `http://game_green:3001` для blue и `http://game_blue:3001` для green). |
| `PEER_NODE_NAME` | вывод из `NODE_NAME` (`blue`<->`green`) | Запасное имя соседа, если `PEER_INTERNAL_URL` не ответил при `create` в режиме `drain`. |
| `PEER_TIMEOUT_MS` | `800` | Таймаут HTTP-запросов к соседнему слоту (мс). |

## 2. HTTP-эндпоинты

### Публичный порт (`PORT`, например `8787`)
- `GET /api/health` — возвращает прежние поля (`ok`, `rooms`, `players`, `uptime`, `stats`) плюс:
  ```json
  {
    "version": "0.57.0",
    "protocol": 2,
    "minProtocol": 1,
    "node": "blue",
    "draining": false
  }
  ```
- `/internal/*` на публичном порту не зарегистрированы и всегда отдают **404**.

### Внутренний порт (`INTERNAL_PORT`, например `3001`)
- `POST /internal/drain` (опционально JSON `{ "version": "0.58.0" }` или `?version=...`)
  Переводит слот в режим `draining = true`:
  - новые комнаты (`create`) не создаются;
  - вход по коду в существующие комнаты (`join`), `resume` и текущие матчи работают до завершения;
  - если `version` передан (или получен от соседа через `PEER_INTERNAL_URL/internal/stats`, когда у соседа другая версия), всем подключённым `v2+` клиентам сразу рассылается WS-сообщение `update`, а также запоминается для переподключившихся к слоту `v2+` клиентов.
- `POST /internal/undrain` — снимает режим `drain` и сбрасывает `announcedVersion` (удобно для `deploy.sh rollback`, если старый слот ещё жив).
- `POST /internal/announce-update` (опционально JSON `{ "version": "..." }`, по умолчанию `APP_VERSION`) — принудительно рассылает WS-сообщение `update` всем подключённым `v2+` клиентам.
- `GET /internal/stats` — возвращает `{ rooms, players, connections, draining, node, version, protocol, minProtocol, uptime }`.
- `GET /internal/rooms/:code` — `200 { exists: true, code, node, phase, players }` если комната жива на этом слоте, иначе `404 { exists: false, code, node }`.

## 3. Протокол N=2, N-1=1 и точная схема `hello`

Все WS-фреймы на `/ws` используют формат NestJS `WsAdapter`: `{"event": "<type>", "data": {...}}`.
Клиент передаёт версию протокола в query: `/ws?p=2`. Если параметр `p` отсутствует, клиент считается **v1** (совместимость со старыми клиентами v0.56 и v0.57).

| Подключение | Ответ сервера (`hello` / `err`) | Поведение |
|---|---|---|
| `/ws` (без `?p`) или `/ws?p=1` | `event: "hello"`, `data: { "v": 1, "s": <ms>, "node": "<NODE_NAME>" }` | Играет как в v0.56/v0.57 (`d.v === 1` строго сохранено; лишнее поле `node` клиент v1 игнорирует). |
| `/ws?p=2` | `event: "hello"`, `data: { "v": 2, "s": <ms>, "node": "<NODE_NAME>", "version": "<APP_VERSION>" }` | Полная поддержка `redirect` и `update`. При активном `announcedVersion` сразу следом уходит `update`. |
| Неподдерживаемый/неверный `?p` (`p < 1`, `p > 2`, не число) | `event: "err"`, `data: { "code": "UNSUPPORTED_PROTOCOL", "msg": "Онлайн недоступен, обновитесь", "minProtocol": 1, "protocol": 2 }` + `event: "hello"`, `data: { "v": 2, "s": <ms>, "node": "<NODE_NAME>", "minProtocol": 1, "protocol": 2, "supported": false }` | Сокет закрывается с кодом `4002` (`unsupported_protocol`). |

## 4. Поведение `redirect`, `drain` и `update`

1. **`join` незнакомой комнаты:** если комнаты `code` нет локально, сервер запрашивает `GET $PEER_INTERNAL_URL/internal/rooms/:code` (таймаут `PEER_TIMEOUT_MS`).
   - Если комната найдена у соседа (`exists: true`):
     - клиенту **v2** уходит `{"event": "redirect", "data": { "node": "<peer>", "code": "<code>" }}`;
     - клиенту **v1** уходит `{"event": "err", "data": { "code": "WRONG_NODE", "msg": "Комната на другом узле" }}`.
   - Если комнаты нет нигде или сосед недоступен — обычный `err` `NOT_FOUND` (`"Комната не найдена"`).
2. **`create` в режиме `drain`:**
   - клиенту **v2** сервер запрашивает `$PEER_INTERNAL_URL/internal/stats`: если сосед жив и не в `drain`, уходит `{"event": "redirect", "data": { "node": "<peer>", "reason": "draining" }}`; иначе `err` `DRAINING`;
   - клиенту **v1** уходит `{"event": "err", "data": { "code": "DRAINING", "msg": "Сервер обновляется" }}`.
3. **`update`:** `{"event": "update", "data": { "version": "<newVersion>" }}` отправляется **только v2+ клиентам** (как в комнатах, так и в меню). Хотя проверено по `game/src/net.tsx`, что v0.56/v0.57 молча игнорируют неизвестные `event`, не отправлять `redirect` и `update` на v1 безопаснее (v1 получает понятный `err` вместо зависания ожидания).

> Примечание по формату: в `PLAN.md` использована сокращённая запись `{t:"redirect", node}` и `{t:"update", version}`. На проводе используется стандартный конверт `WsAdapter` этого сервера (`{ event: "redirect", data: { node, ... } }` и `{ event: "update", data: { version } }`), который уже разбирает `game/src/net.tsx` (`onMsg(m.event, m.data)`).

## 5. Запуск проверок

Из `server/`:
```bash
npm run build
npm run test:bluegreen
```
Скрипт `scripts/smoke-bluegreen.mjs` поднимает два локальных процесса (`blue` на `8901/3901` и `green` на `8902/3902`), прогоняет health, 404 на публичном порту для `/internal/*`, согласование v1/v2/unsupported, матч v1 на `blue`, `POST /internal/drain`, рассылку `update`, `create` на `green`, кросс-слотовый `join` -> `redirect`, вход в существующую комнату при `drain` и завершение матча на `blue`.

Также для проверки обратной совместимости v1:
```bash
PORT=8910 INTERNAL_PORT=3910 NODE_NAME=blue node dist/main.js &
node ../game/tests/net-protocol.js ws://127.0.0.1:8910/ws
```

## 6. Что нужно от Hopper Devops

- В `docker-compose` задать обоим слотам (`game_blue`, `game_green`):
  - `PORT=8787`, `INTERNAL_PORT=3001` (публиковать в сеть Caddy только `8787`; `3001` оставить только во внутренней docker-сети);
  - `NODE_NAME=blue` / `NODE_NAME=green`;
  - `PEER_INTERNAL_URL=http://game_green:3001` (для `blue`) и `http://game_blue:3001` (для `green`);
  - `APP_VERSION=<ver>` (либо в `Dockerfile` добавить `COPY --from=server /app/package.json ./` и передавать `APP_VERSION` через env/build-arg).
- В Caddy проксировать `/ws`, `/api/*`, `/health` на активный слот, `/ws/blue` -> `game_blue:8787/ws` и `/ws/green` -> `game_green:8787/ws` (можно со срезкой префикса или без — сервер читает query `?p=` с любого path, но `@WebSocketGateway({ path: '/ws' })` требует путь `/ws` при передаче в upstream!).
- В `deploy.sh`: после переключения `active.caddy` вызывать `POST http://<old_slot>:3001/internal/drain` с `{ "version": "<new_ver>" }` (или без тела — если `APP_VERSION` задан на новом слоте, старый узнает его сам) и ждать `rooms === 0` по `GET http://<old_slot>:3001/internal/stats`. При откате на ещё живой старый слот — `POST /internal/undrain`.
