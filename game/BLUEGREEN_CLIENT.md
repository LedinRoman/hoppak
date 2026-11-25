# Хоппак: клиентская часть blue-green деплоя

Ветка: `feat/bluegreen-client` (база: `client/v052 @ a898d1f`).
Серверная часть: ветка `feat/bluegreen-server` (`/workspace/jumper-bluegreen/server/BLUEGREEN.md`).

## 1. Что изменено

- **`game/build.sh`**:
  - Переменная сборки `CLIENT_VER="${HOP_VERSION:-0.57.0}"` передаётся в `esbuild` через `--define:HOP_VERSION=""${CLIENT_VER}""` для всех таргетов (`hoppak.js`, `page-build/hop.canvas.tsx`, `site/hoppak.js`).
  - Для `build.sh site` артефакты также кладутся в `game/site/v/${CLIENT_VER}/` (`index.html`, `hoppak.js`) в дополнение к `game/site/`.
- **`game/src/01_core.tsx` и `game/src/04_shell.tsx`**:
  - Выделены значения по умолчанию для соло (`DEFAULT_LW = 160`, `DEFAULT_LH = 346`, `DEFAULT_PX_PER_M = 8`).
  - Для онлайна `resize()` и `startNet()` берут `{ w, h, pxPerM }` из `NET.fixedField()` (`hello.field` / `room.field` / `start.field`), а не из зашитых констант. При выходе в меню (`goMenu()`) и переходе в `net` (`setPhase("net")`) сброс `fieldLocked = false` возвращает размеры соло или применяет новый `field`.
  - `drawUpdateBanner()`: компактная пиксельная плашка `152×22` («ДОСТУПНА НОВАЯ ВЕРСИЯ / ОБНОВИТЬ?» + `X`) рисуется и кликается **только** в `menu`, `lobby`, `results` и `net`; во время активного раунда (`phase === "play"`) её нет.
- **`game/src/net.tsx`**:
  - `NET_PROTO = 2`, `CLIENT_VERSION` из `HOP_VERSION` (по умолчанию `"0.57.0"`).
  - Подключение через `/ws?p=2`. Принимает `hello` с `v: 2` (`node`, `version`, `field: { w, h, pxPerM }`) и `v: 1` (совместимость со старыми серверами, комнаты `lw = 180`).
  - `N.fixedField()` возвращает `{ w, h, pxPerM }` текущей комнаты или `hello.field` в фазе `net`; позиции спавна слотов `slotSpawnX` при нестандартной ширине (2.0) масштабируются пропорционально `LW`.
  - Очистка `N.room`/`sessionStorage` при `ROOM_CLOSED`, `SERVER_SHUTDOWN` и `redirect` для `create`.
  - При обрыве связи (`startReconnect` / `tryResume`) переподключается на `/ws/<node>?p=2` и отправляет `resume { token }`.
  - Обработка `redirect` (`{ node, code }` и `{ node, reason: "draining" }`) с защитой от зацикливания (`NET_MAX_REDIRECTS = 2` -> «СЕРВЕР ПЕРЕГРУЖЕН»).
  - Отслеживание обновлений через `update`, `hello.version`, `probeHealth` и `GET /api/health` раз в 60 с.
- **`game/tests/bluegreen-e2e.mjs`**:
  - Сквозной тест на двух реальных серверах из `/workspace/jumper-bluegreen/server` (с `INTERNAL_TOKEN` и `INTERNAL_HOST=127.0.0.1`), прокси в стиле Caddy, v1-only сервере, fault-сервере и сервере с кастомным полем (`FIELD_W=208, FIELD_H=416, FIELD_PX_PER_M=10`), на реальном headless Chromium.
  - Проверяет `lw=160` на v2, `lw=180` на v1, `401` без `INTERNAL_TOKEN`, слепой реконнект через активный `green` во время `drain` (`BUG-24`), редирект рематча/закрытия комнаты (`BUG-25`), динамическую подстройку `LW`/`LH`/`PX_PER_M` от сервера и изоляцию ассетов в `/v/<ver>/`.

## 2. Проверка изоляции ассетов (`/v/<ver>/`)

1. `game/index.html` содержит только встроенный `data:image/svg+xml` favicon и относительный `<script src="hoppak.js"></script>`.
2. Все спрайты, шрифт и Web Audio звуки встроены в `hoppak.js`. В логе сети headless Chromium до нажатия «ОБНОВИТЬ?» запрашиваются только `/v/0.57.0/`, `/v/0.57.0/hoppak.js`, `/api/health` и `/ws*`.

## 3. Как запустить проверки

Из корня worktree `/workspace/jumper-bluegreen-client`:

```bash
HOP_VERSION=0.57.0 bash game/build.sh site
node game/tests/bluegreen-e2e.mjs
```
