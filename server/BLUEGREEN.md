# Хоппак: серверная часть blue-green деплоя

Ветка: `feat/bluegreen-server` (база: `net @ 2e6bfc0`).
Изоляция от будущих правок профиля: вся новая логика вынесена в `src/bluegreen/*`, изменения в общих файлах (`src/app.module.ts`, `src/game.gateway.ts`, `src/protocol.ts`, `src/rooms.service.ts`) минимальны.

## 1. Конфигурация поля (без хардкода ширины)

Параметры игрового поля для протокола `v2+` задаются конфигом сервера (`server/field.config.json` или `FIELD_CONFIG_PATH`) с переопределением через env:

| Источник / переменная | По умолчанию | Назначение |
|---|---|---|
| `FIELD_CONFIG_PATH` | `field.config.json` | Путь к JSON-конфигу `{ "w": 160, "h": 346, "pxPerM": 8 }`. |
| `FIELD_W` (алиас `NET_LW`) | `160` | Логическая ширина поля для v2-комнат (`room.lw`, `field.w`). |
| `FIELD_H` | `346` | Логическая высота поля (`field.h`). |
| `FIELD_PX_PER_M` (алиас `FIELD_SCALE`) | `8` | Масштаб физики: пикселей на метр (`field.pxPerM`). |
| `FIELD_W_V1` (алиас `NET_LW_V1`) | `180` | Ширина комнат для legacy-клиентов протокола `v1` (`v0.56` / `v0.57`). |

- Значения сохраняются **на комнату** при `create`: v2-комнаты получают `field = { w, h, pxPerM }` (текущая линия: `{ w: 160, h: 346, pxPerM: 8 }`), v1-комнаты остаются на `lw = 180` (`v0.56`/`v0.57` читают `N.room.lw` и не ломаются).
- Смешанный вход v1 и v2 в одну комнату отклоняется с `err.code = "PROTOCOL_MISMATCH"`.
- Сервер отправляет `field` v2-клиентам в `hello.field`, `room.field` и `start.field`, поэтому в 2.0 размер поля и масштаб физики меняются через конфиг сервера без переделки сетевого протокола.

## 2. Переменные окружения сервера

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `8787` | Публичный HTTP/WS порт (`/api/health`, `/ws`). |
| `INTERNAL_PORT` | отключён | Внутренний HTTP/WS порт для `/internal/*`. Включается числовым портом (например `3001`); `0`/`off`/`none`/`false` или пустое значение отключают внутренний сервер. |
| `INTERNAL_HOST` | `127.0.0.1` | Адрес бинда внутреннего сервера. Для межконтейнерной сети в Docker задавайте `0.0.0.0` **обязательно вместе с `INTERNAL_TOKEN`**. |
| `INTERNAL_TOKEN` | `""` | Общий секрет для всех запросов `/internal/*` и `/internal/ws` (`x-internal-token` или `Authorization: Bearer <token>`). При не-loopback `INTERNAL_HOST` без токена сервер **не стартует** (BUG-48). |
| `NODE_NAME` | `local` | Имя слота (`blue` или `green`). Передаётся в `hello`, `/api/health`, `/internal/*`. |
| `APP_VERSION` | **обязательна** в prod/blue-green | Версия сборки для `/api/health`, `hello` (v2) и `update`. Без неё при `NODE_ENV=production` или `NODE_NAME=blue|green` сервер не стартует (BUG-34); локально — версия из `package.json`. |
| `PEER_INTERNAL_URL` | `""` | URL внутреннего порта соседнего слота (например `http://game_green:3001` для `blue` и `http://game_blue:3001` для `green`). |
| `PEER_TIMEOUT_MS` | `800` | Таймаут HTTP/WS запросов к соседнему слоту (мс). |
| `PEER_AUTH_TTL_MS` | `3000` | Как часто обновлять `peerAuth` (фон и кэш `/api/health`). |
| `WS_PING_MS` | `25000` | Интервал серверных WS-фреймов `ws.ping()` ко всем сокетам (публичным, `/internal/ws` и прокси-туннелям), чтобы idle-соединения в лобби/итогах не обрывались egress/NAT-таймаутом (BUG-50). |
| `WS_PONG_TIMEOUT_MS` | `60000` | Через сколько мс без `pong` мёртвый WS-сокет принудительно закрывается (`ws.terminate()`). |
| `ROOM_CODE_MIN` / `ROOM_CODE_MAX` | `blue`: `1000..5499`, `green`: `5500..9999` | Непересекающиеся диапазоны 4-значных кодов комнат по слотам (устраняет коллизии кодов между слотами). |
| `DRAIN_LOBBY_TTL_MS` | `15000` | Через сколько мс закрывать неактивную лобби-комнату на слоте в режиме `drain`. |
| `DRAIN_RESULTS_CLOSE_MS` | `1500` | Задержка после завершения раунда (`results`) перед автоматическим закрытием/переводом комнаты в `drain`. |
| `MIGRATE_GRACE_MS` | `30000` | Сколько переехавшая комната ждёт `resume` своих игроков на новом слоте. |
| `GRACEFUL_SHUTDOWN_MS` | `25000` | Максимальное ожидание завершения активных матчей при `SIGTERM`/`SIGINT` до принудительного финиша с рассылкой `results`. |

## 3. HTTP и внутренние эндпоинты

### Публичный порт (`PORT`, например `8787`)
- `GET /api/health` — возвращает `{ ok, rooms, players, uptime, stats, version, protocol, minProtocol, node, draining, shuttingDown, peerAuth }`.
  `peerAuth` **живой**: если кэш старше ~3 с (`PEER_AUTH_TTL_MS`, по умолчанию 3000), слот перед ответом проверяет соседа `GET $PEER_INTERNAL_URL/internal/stats` с `INTERNAL_TOKEN` (таймаут `PEER_TIMEOUT_MS`). Параллельно тот же зонд идёт каждые ~3 с и при любом обращении к соседу.
  Значения: `ok` — сосед ответил прикладным кодом (2xx / 404 / 409) и принял токен; `unauthorized` — 401/403, токены слотов разные; `unreachable` — сосед не отвечает, таймаут или 5xx (в том числе 502/503 от мёртвого апстрима); `none` — `PEER_INTERNAL_URL` не задан; `unknown` — ещё не было ни одного зонда. Не 401/403 больше не считается `ok`. Во время graceful shutdown эндпоинт отдаёт **503** (`shutting_down`).
- `/internal/*` на публичном порту не зарегистрированы и всегда отдают **404**.

### Внутренний порт (`INTERNAL_PORT`, например `3001`)
Все маршруты требуют заголовок `x-internal-token: <INTERNAL_TOKEN>` (или `Authorization: Bearer <INTERNAL_TOKEN>`), если задан `INTERNAL_TOKEN` или `INTERNAL_HOST` не loopback:
- `POST /internal/drain` (опционально JSON `{ "version": "0.58.0" }` или `?version=...`)
  Переводит слот в режим `draining = true`:
  - новые комнаты (`create`) здесь не создаются: v2 получает `redirect` на живого соседа, v1 — прозрачно проксируется к соседу и создаёт комнату там (BUG-43);
  - новый раунд (`start`) на слоте в `drain` не начинается: вместо этого **вся комната переезжает** на соседа (см. ниже), и хост жмёт СТАРТ уже там;
  - текущие раунды доигрываются до результатов; через `DRAIN_RESULTS_CLOSE_MS` после `results`, а лобби — через `DRAIN_LOBBY_TTL_MS`, комната **переезжает** на соседа;
  - `update` v2-клиентам уходит **только если в запросе передана `version`** (выкладка новой версии). Запоминается для переподключившихся. **Drain без `version` (откат) `update` не шлёт** и не подставляет `APP_VERSION` соседа.
- `POST /internal/undrain` — снимает режим `drain`, очищает таймеры закрытия комнат и `announcedVersion` (для отката).
- `POST /internal/announce-update` — принудительно рассылает `update` всем `v2+` клиентам.
- `GET /internal/stats` — `{ rooms, players, connections, draining, shuttingDown, node, version, protocol, minProtocol, uptime, peerAuth }`. `peerAuth` освежается так же, как в `/api/health`.
- `GET /internal/rooms/:code` — `200 { exists: true, code, node, phase, proto, lw, field, players }` или `404`.
- `GET /internal/tokens/:token` — `200 { exists: true, code, node }` или `404` (используется при реконнекте).
- `POST /internal/rooms/import` — принимает снимок комнаты от соседа при переезде (BUG-32): `{ code, host, map, proto, lw, field, round, nextPid, players: [{ pid, slot, name, kind, token }] }` → `200 { ok, code, node }` (новый код из диапазона этого слота) или `409` если этот слот сам в `drain`.
- Любой отказ по токену (`401`) пишется в лог `ERROR [InternalHTTP] rejected ...` (не чаще раза в 10 с), а сторона-клиент пишет `ERROR [BlueGreen] peer ... rejected INTERNAL_TOKEN (401)` и выставляет `peerAuth=unauthorized`.
- `WS /internal/ws?p=1|2&proxied=1` — внутренний туннель, через который активный слот прозрачно проксирует `resume` и v1 `join` на уходящий слот (`BUG-24`, `BUG-29`).

## 4. Протокол N=2, N-1=1 и схема `hello`

Все WS-фреймы используют формат `WsAdapter`: `{"event": "<type>", "data": {...}}`.
Клиент передаёт протокол в query: `/ws?p=2`. Без `?p` или при `?p=1` клиент считается **v1** (`v0.56`, `v0.57`).

| Подключение | Ответ сервера (`hello` / `err`) | Поведение |
|---|---|---|
| `/ws` или `/ws?p=1` | `hello { "v": 1, "s": <ms>, "node": "<NODE_NAME>" }` | Совместимо с v0.56/v0.57 (`d.v === 1` строго, комнаты с `lw = 180`). |
| `/ws?p=2` | `hello { "v": 2, "s": <ms>, "node": "<NODE_NAME>", "version": "<APP_VERSION>", "field": { "w": 160, "h": 346, "pxPerM": 8 } }` | Полная поддержка `field`, `redirect`, `update`. |
| Неподдерживаемый `?p` | `err UNSUPPORTED_PROTOCOL` + `hello { ..., supported: false }` | Сокет закрывается с кодом `4002`. |

## 5. Поведение `redirect`, прозрачный прокси и `SIGTERM`

1. **Прозрачный WS-прокси для v1 и слепого реконнекта (`BUG-24`, `BUG-29`):**
   - Если `resume { token }` попадает на слот, где токена нет (например, активный `green` после переключения балансировщика, включая v0.56/v0.57 или переоткрытую вкладку), слот запрашивает `GET $PEER_INTERNAL_URL/internal/tokens/:token` и при нахождении открывает внутренний туннель `WS .../internal/ws?p=<proto>&proxied=1`, пересылая `resume` и все последующие фреймы в обоих направлениях. Клиент восстанавливает своё место и счёт без знания о слотах.
   - Аналогично при v1 `join { code }`, если комната живёт у соседа, активный слот проксирует подключение к соседу вместо ошибки `WRONG_NODE`. Для v2 `join` по-прежнему отправляет `redirect { node, code }`.
2. **Проверка живости соседа (`BUG-26`):**
   - Перед отправкой `redirect` на `create` или `start` в режиме `drain` сервер проверяет `GET $PEER_INTERNAL_URL/internal/stats` (сосед должен отвечать `200`, `!draining`, `!shuttingDown`). Если сосед недоступен — возвращается `err DRAINING`, а не редирект на мёртвый узел.
3. **Graceful shutdown (`BUG-25`, `BUG-45`):**
   - По `SIGTERM` / `SIGINT` сервер включает `shuttingDown` + `draining` (`/api/health` начинает отдавать `503`), сразу переносит лобби-комнаты на соседа (если соседа нет — `err SERVER_SHUTDOWN` «Сервер перезагружается» и чистое закрытие `1000`), ждёт завершения активных матчей (после `results` они тоже переезжают), а по истечении `GRACEFUL_SHUTDOWN_MS` принудительно завершает оставшиеся матчи с рассылкой `results` и `err SERVER_SHUTDOWN`, после чего закрывает все сокеты `1001` и выходит с кодом `0`.
   - **Повторный сигнал (выбранный вариант: игнорировать до таймаута).** Обработчики стоят через `process.on`, поэтому 2-й, 3-й и т. д. `SIGTERM`/`SIGINT` во время graceful shutdown ничего не ускоряют и не убивают процесс — в лог пишется `ignored repeated SIGTERM`, а жёсткий стоп только один: принудительные `results` по `GRACEFUL_SHUTDOWN_MS` (+ страховочный `exit 1` ещё через 5 с, если что-то зависло).
4. **Переезд комнаты на активный слот (`BUG-32`, `BUG-35`, `BUG-43`, `BUG-44`):**
   - Слот в `drain` делает `POST $PEER_INTERNAL_URL/internal/rooms/import` со снимком комнаты (игроки, `pid`, токены, хост, номер раунда, карта, протокол, поле). Сосед создаёт комнату с новым кодом из своего диапазона; игроки там «не в сети» с увеличенным окном `MIGRATE_GRACE_MS` (по умолчанию `30000`) и занимают места по `resume { token }`.
   - **v2:** каждый игрок получает один и тот же `redirect { node, code, resume: true, reason: "migrate" }`, переподключается к `/ws/<node>` и шлёт `resume` — компания, хост и счёт вечера сохраняются (клиент переносит счёт по совпадающему токену).
   - **v1 (v0.56/v0.57):** старый слот открывает к соседу внутренний WS-туннель и шлёт `resume` за игрока; клиент просто получает `room` с новым кодом и дальше играет через этот туннель (в том числе реванш). Когда старый слот остановят, сокет закроется `1001`, клиент v1 переподключится по `/ws` к активному слоту и вернётся на своё место по тому же токену.
   - **Поздний реконнект (BUG-35):** старый слот помнит, куда уехали токены (`MIGRATE_GRACE_MS × 4`, не меньше 2 мин): `resume` по такому токену даёт v2 `redirect … resume:true`, а v1 — прокси к соседу. Поэтому обрыв сокета в окне закрытия (в т. ч. Caddy без `stream_close_delay`) не приводит к «КОМНАТА ЗАКРЫТА».
   - **Если сосед недоступен / отказал:** всем игрокам комнаты `err NO_SESSION`, затем понятная причина (v1: «Другая версия. Обновите!» — 24 символа из шрифта, v2: «Сервер обновляется»; при shutdown — `SERVER_SHUTDOWN` «Сервер перезагружается») и **закрытие сокета** через 150 мс, чтобы «ЕЩЁ РАЗ» у старых клиентов открыл новый сокет (BUG-43). Тот же закрывающий ответ получает любой `resume` с `NO_SESSION`.
   - **Привязка прокси (BUG-44):** проксируемый к соседу v1-сокет привязан к соседу только на одну комнату: `leave` пересылается соседу и туннель закрывается, новые `create`/`join` обрабатывает уже этот слот (и при необходимости снова проксирует к нужному).
   - **BUG-36:** кадры `st`/`ev` вне комнаты (например, пока идёт слепой `resume`) молча отбрасываются, без тоста «Ты не в комнате».
   - **Правило «переключать при 0 комнат»** остаётся страховкой в `release.sh` (Producer): см. шаг 5 в разделе 6.

## 6. Интеграция для Devops

1. **Порты и сеть:**
   - Публиковать на хост только Caddy (`80`/`443`).
   - Контейнеры `game_blue` и `game_green` слушают:
     - `PORT=8787` (HTTP + WS `/api/health`, `/ws`) — в общую docker-сеть с Caddy;
     - `INTERNAL_PORT=3001` — **не публиковать на хост (`ports:` запрещён)**; оставить только во внутренней docker-сети для взаимодействия `game_blue <-> game_green` и `deploy.sh`.
   - Сеть между прокси и слотами и между слотами (`proxy-to-peer`): `game_blue`, `game_green` и `caddy` (или `deploy.sh` через `docker exec`/internal network) должны резолвить друг друга по DNS (`game_blue`, `game_green`), чтобы работали `PEER_INTERNAL_URL` и внутренний WS-прокси `/internal/ws`.
2. **Обязательные env-переменные для `game_blue` и `game_green`:**
   - `NODE_NAME=blue` (для `game_blue`) / `NODE_NAME=green` (для `game_green`)
   - `PORT=8787`
   - `INTERNAL_PORT=3001`
   - `INTERNAL_HOST=0.0.0.0` (в Docker для общения между контейнерами)
   - `INTERNAL_TOKEN=<длинный-случайный-секрет-из-.env>` (одинаковый для обоих слотов и `deploy.sh`; без него на `0.0.0.0` внутренние эндпоинты возвращают `401`)
   - `PEER_INTERNAL_URL=http://game_green:3001` (на `blue`) и `http://game_blue:3001` (на `green`)
   - `APP_VERSION=<версия-релиза>` (например `0.58.0`)
   - `GRACEFUL_SHUTDOWN_MS=25000`
   - Опционально (по умолчанию берётся из `server/field.config.json`): `FIELD_W=160`, `FIELD_H=346`, `FIELD_PX_PER_M=8` (и `FIELD_W_V1=180`).
3. **Маршруты Caddyfile:**
   - `/internal/*`: **закрыть на уровне Caddy** (`handle /internal/* { respond 404 }`) перед всеми остальными правилами.
   - `/ws`: проксировать на активный слот (`reverse_proxy <active_slot>:8787`).
   - `/ws/blue`: переписать путь в `/ws` с сохранением query (`uri path_regexp ^/ws/blue$ /ws` или `handle_path /ws/blue* { rewrite * /ws; reverse_proxy game_blue:8787 }`) — `@WebSocketGateway({ path: '/ws' })` требует путь `/ws` и query `?p=...` в upstream.
   - `/ws/green`: аналогично rewrite `/ws/green` -> `/ws` с сохранением query на `game_green:8787`.
   - `/api/*` (и `/health`): проксировать на активный слот (`reverse_proxy <active_slot>:8787`).
4. **Перезагрузка Caddy без обрыва WS (`stream_close_delay`, BUG-46):**
   - `stream_close_delay` — это **подопция `reverse_proxy`**, а не глобального блока `servers { }` (в `servers` такой опции нет: Caddy либо не стартует, либо опция будет проигнорирована). Источник: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy (раздел *Streaming*: `stream_timeout`, `stream_close_delay`).
   - Задавать её нужно в **каждом** `reverse_proxy`, через который идут WebSocket'ы (`/ws`, `/ws/blue`, `/ws/green`), иначе `caddy reload` при переключении `blue <-> green` закроет все активные WS сразу:
     ```caddyfile
     handle /internal/* {
         respond 404
     }
     handle /ws/blue {
         rewrite * /ws
         reverse_proxy game_blue:8787 {
             stream_close_delay 30m
         }
     }
     handle /ws/green {
         rewrite * /ws
         reverse_proxy game_green:8787 {
             stream_close_delay 30m
         }
     }
     handle /ws {
         reverse_proxy {$ACTIVE_SLOT}:8787 {   # game_blue | game_green
             stream_close_delay 30m
         }
     }
     ```
     (`rewrite * /ws` сохраняет query `?p=2`.) `30m` — с запасом больше любой партии; после закрытия старого слота его сокеты всё равно закроются сервером (`1001`), и клиенты переподключатся.
   - Сервер переживает и обрыв без `stream_close_delay` (клиент v2 переподключается к слоту комнаты, v1 — через `/ws` с прозрачным прокси), но это лишний «мигающий» реконнект у всех игроков.
5. **Остановка контейнера (`SIGTERM` / `stop_grace_period`):**
   - В `docker-compose.yml` задать `stop_grace_period: 35s` (больше `GRACEFUL_SHUTDOWN_MS=25000`), чтобы Docker не слал `SIGKILL` раньше, чем сервер доиграет активные матчи и отправит `results`.
   - **Правило одного `SIGTERM`** (страховка): посылать ровно один `SIGTERM` (`docker stop`/`compose stop`) и ждать выхода процесса. Сервер сам защищён (BUG-45): повторные `SIGTERM`/`SIGINT` во время graceful shutdown **игнорируются** (в лог пишется `ignored repeated SIGTERM`), жёсткий стоп — только по таймауту `GRACEFUL_SHUTDOWN_MS` (принудительные `results` + `err SERVER_SHUTDOWN` всем) или `SIGKILL` от Docker по `stop_grace_period`. Но `docker kill -s KILL`, повторный `compose down` с маленьким таймаутом и т. п. по-прежнему рвут матч — не делать.
6. **Шаги переключения (`release.sh` / `deploy.sh`):**
   1) Поднять неактивный слот с **явным** `APP_VERSION=<новая версия>` (без него в `NODE_ENV=production` или при `NODE_NAME=blue|green` сервер не стартует, см. ниже) и дождаться `200` от `/api/health` этого слота **и** `GET /internal/stats` с токеном (проверка, что `INTERNAL_TOKEN` у слотов совпадает — шаг 2).
   2) **Проверка токенов (BUG-48):** с машины деплоя `curl -s -o /dev/null -w '%{http_code}' -H "x-internal-token: $INTERNAL_TOKEN" http://<new_slot>:3001/internal/stats` и то же для `<old_slot>` — оба должны вернуть `200`. Это каноническая проверка на переключении. Дополнительно `/api/health` (и `/internal/stats`) каждого слота отдаёт **живой** `peerAuth` (кэш ~3 с, см. §3): `"ok"` — сосед принимает наш токен, `"unauthorized"` — токены разные (в логе слота `ERROR peer ... rejected INTERNAL_TOKEN (401)`), `"unreachable"` — сосед не отвечает или отвечает 5xx. После старта соседа `ok` появляется за несколько секунд, после остановки — `unreachable`. Переключать только при `peerAuth === "ok"` на новом слоте (и 200 по токену в обе стороны).
   3) Переключить маршрут `/ws` и `/api/*` Caddy на новый слот, `caddy reload`.
   4) `POST http://<old_slot>:3001/internal/drain` (заголовок `x-internal-token`, тело `{"version":"<new_ver>"}`).
      После `drain` комнаты старого слота **переезжают целиком** на новый слот (BUG-32): сразу после `results` (через `DRAIN_RESULTS_CLOSE_MS`), при попытке реванша, или по `DRAIN_LOBBY_TTL_MS` для лобби. Код комнаты меняется, состав, хост, номер раунда и токены игроков сохраняются; v2-клиенты получают `redirect {node, code, resume:true}`, v1-клиенты (v0.56/v0.57) продолжают играть через прозрачный прокси старого слота. Идущие раунды доигрываются на старом слоте.
   5) Поллить `GET http://<old_slot>:3001/internal/stats` до `rooms === 0` **с лимитом ожидания** (страховка Producer: по умолчанию в `release.sh`, рекомендую `DRAIN_WAIT_MAX=600` с, т. е. 10 минут — длиннее любой партии). Если лимит истёк — в лог `release.sh` предупреждение со списком `rooms/players` и всё равно переход к шагу 6 (слот сам принудительно завершит матчи с `results` по `GRACEFUL_SHUTDOWN_MS`). `connections > 0` при `rooms === 0` — это проксируемые v1-сокеты, их можно не ждать: при остановке слота они переподключатся к новому слоту по тому же токену.
   6) Один `docker stop` (`compose stop game_<old>`) старого слота → он получает `SIGTERM` и выходит сам.
7. **Пошаговый откат (новый слот плохой):**
   1) Если старый слот ещё жив (шаги 4–5): `POST http://<old_slot>:3001/internal/undrain` — снимает drain и `update`; затем вернуть маршрут `/ws` и `/api/*` в Caddy на старый слот, `caddy reload`.
   2) `POST http://<new_slot>:3001/internal/drain` **без** `version` — комнаты нового слота переедут обратно на старый тем же механизмом, v2-клиентам **не** уходит `update` (сервер не подставляет версию соседа). Дождаться `rooms === 0` (с тем же лимитом), один `docker stop` нового слота.
   3) Если старый слот уже остановлен: поднять его заново из предыдущего образа с прежним `APP_VERSION`, дождаться `/api/health` + `peerAuth: "ok"`, дальше как в пп. 1–2.
   4) После отката клиенты v2 со свежей сборкой увидят на старом сервере `hello.version` меньше своей — плашки «обновить» не будет (плашка показывается только если версия сервера **строго больше** версии клиента).
8. **Конфиг поля в Docker (BUG-47):** `server/Dockerfile` в этой ветке **не копирует** `server/field.config.json` (файл Docker — зона Devops, здесь его не меняем). Без доп. действий в контейнере работают только env/дефолты (`160×346×8`, v1 = `180`). Выбор Devops: (а) смонтировать файл, как уже сделано на staging: `volumes: - ./server/field.config.json:/app/field.config.json:ro` (или `FIELD_CONFIG_PATH`), (б) добавить `COPY server/field.config.json ./` в **свой** Dockerfile, (в) задавать `FIELD_W/FIELD_H/FIELD_PX_PER_M/FIELD_W_V1` в env. При старте сервер пишет в лог источник и итоговое поле (`[Field] v2 field: {...} (file: ...)` и `[Field] v1 room width: 180`); битый файл/невалидные значения — `ERROR` в логе и дефолт для этого параметра. Допустимые границы: `w` и `FIELD_W_V1` 120..320, `h` 200..800, `pxPerM` 2..32.
9. **Обязательные проверки на старте (сервер откажется стартовать с понятной ошибкой в логе и `exit 1`):**
   - `APP_VERSION` пуст при `NODE_ENV=production` или `NODE_NAME=blue|green` (BUG-34: иначе версия бралась из `package.json` = `0.1.0`, и клиенты видели вечную плашку обновления);
   - включён `INTERNAL_PORT`, `INTERNAL_HOST` не loopback (например `0.0.0.0`) и пуст `INTERNAL_TOKEN` (BUG-48).

## 7. Запуск проверок

Из `server/`:
```bash
npm run build
npm run test:bluegreen
```
Порты тестовых слотов берутся из env (`BLUE_PUB`, `BLUE_INT`, `GREEN_PUB`, `GREEN_INT`), остальные (одиночные серверы для SIGTERM/поля/токенов) — свободные порты ОС; `INTERNAL_TOKEN` тоже из env (по умолчанию `smoke-secret-token`).

И проверка совместимости v1 (`APP_VERSION` обязателен при `NODE_NAME=blue|green`):
```bash
PORT=8910 NODE_NAME=blue APP_VERSION=0.58.0 node dist/main.js &
node ../game/tests/net-protocol.js ws://127.0.0.1:8910/ws
```
