# Хоппак: клиентская часть blue-green деплоя

Ветка: `feat/bluegreen-client` (база: `client/v052 @ a898d1f`).
Серверная часть: ветка `feat/bluegreen-server` (`/workspace/jumper-bluegreen/server/BLUEGREEN.md`).

## 1. Что изменено

- **`game/build.sh`**:
  - Добавлена переменная сборки `CLIENT_VER="${HOP_VERSION:-0.57.0}"`, передаётся в `esbuild` через `--define:HOP_VERSION="\"${CLIENT_VER}\""` для всех таргетов (`hoppak.js`, `page-build/hop.canvas.tsx`, `site/hoppak.js`).
  - Для `build.sh site` артефакты также кладутся в `game/site/v/${CLIENT_VER}/` (`index.html`, `hoppak.js`) в дополнение к `game/site/`.
- **`game/src/net.tsx`**:
  - `NET_PROTO = 2`, константа `CLIENT_VERSION` из `HOP_VERSION` (по умолчанию `"0.57.0"`).
  - Подключение через `/ws?p=2` (`buildWsUrl`). Принимается `hello` с `v: 2` (сохраняются `node`, `serverVersion`) и `v: 1` (совместимость со старыми серверами, игнорирующими `?p=`).
  - При `err.code === "UNSUPPORTED_PROTOCOL"`, `hello.supported === false`, неизвестном `v` или закрытии с кодом `4002` — штатное состояние `unsupported` и сообщение «ОНЛАЙН НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ».
  - При обрыве связи в комнате/матче (`startReconnect`, а также `tryResume` после перезагрузки вкладки) клиент переподключается на `/ws/<node>?p=2` (для `node !== "local"`) и отправляет `resume { token }`. `toHealth` корректно отрезает `/ws/<node>` до `/api/health`.
  - Обработка `redirect`:
    - `{ node, code }` — закрывает текущий сокет без триггера reconnect, подключается к `/ws/<node>?p=2` и повторяет `join`.
    - `{ node, reason: "draining" }` — подключается к `/ws/<node>?p=2` и повторяет `create`.
    - Защита от зацикливания: не более 2 редиректов (`NET_MAX_REDIRECTS = 2`), на 3-м редирект прерывается с ошибкой «СЕРВЕР ПЕРЕГРУЖЕН».
  - Отслеживание обновлений: WS-событие `update { version }`, `hello.version`, `probeHealth` и фоновый опрос `GET /api/health` каждые 60 с (`NET_HEALTH_MS = 60000`, переопределяется в тесте через `window.HOPPAK_HEALTH_MS`). Если `serverVersion !== CLIENT_VERSION`, выставляется `updateAvail = true`.
  - Методы баннера: `NET.shouldShowBanner()`, `NET.dismissUpdate()`, `NET.reloadApp()` (чисто выходит из комнаты/сессии и переходит на `/`).
- **`game/src/04_shell.tsx`**:
  - `drawUpdateBanner()`: компактная пиксельная плашка `152×22` («ДОСТУПНА НОВАЯ ВЕРСИЯ / ОБНОВИТЬ?» + кнопка закрытия `X`) в стиле HUD (`C.navy`, рамка `C.mint`, шрифт `FONT`, целое масштабирование).
  - Показывается **только** в `menu`, `lobby`, `results` и `net` (лобби комнаты / онлайн-меню); во время активного раунда (`phase === "play"`, включая паузу и ожидание после смерти) не рисуется и не перехватывает клики.
  - В `activate()` добавлены `update:reload` и `update:dismiss`; в `destroy()` останавливается таймер опроса `/api/health`.
- **`game/tests/bluegreen-e2e.mjs`**:
  - Однокомандный сквозной тест на двух реальных серверах из `/workspace/jumper-bluegreen/server`, прокси в стиле Caddy, v1-only сервере, fault-сервере и реальном headless Chromium.

## 2. Проверка изоляции ассетов (`/v/<ver>/`)

1. **Статический grep-аудит** (`game/index.html`, `game/src/*`):
   - `game/index.html`: только встроенный `data:image/svg+xml` favicon и относительный `<script src="hoppak.js"></script>` — при открытии `/v/0.57.0/` резолвится строго в `/v/0.57.0/hoppak.js`.
   - `game/src/*`: все спрайты (`01_core.tsx`), шрифт `FONT` и звуки (`hopSfx`, Web Audio API) встроены в бандл. Единственные сетевые обращения после загрузки — `GET /api/health` и WebSocket `/ws` (`/ws/<node>`), а также переход на `/` при явном нажатии на плашку обновления.
2. **Лог сети headless Chromium** (подтверждается в `bluegreen-e2e.mjs`):
   - При загрузке `/v/0.57.0/` запрашиваются только `/v/0.57.0/` и `/v/0.57.0/hoppak.js`, далее — только `/api/health` и `/ws*`. Ни одного запроса ассетов/JS/спрайтов в корень `/` до нажатия «ОБНОВИТЬ?» нет.

## 3. Как запустить проверки

Из корня worktree `/workspace/jumper-bluegreen-client`:

```bash
HOP_VERSION=0.57.0 bash game/build.sh site
node game/tests/bluegreen-e2e.mjs
```

Скриншоты прогона сохраняются в `game/screens/bluegreen/`:
- `01_mid_round_no_banner.png` — активный раунд на draining `blue`, плашки нет;
- `02_results_with_banner.png` — экран итогов, плашка обновления есть;
- `03_room_lobby_with_banner.png` — лобби комнаты, плашка обновления есть;
- `04_menu_with_banner.png` — главное меню, плашка обновления есть;
- `05_menu_banner_dismissed.png` — главное меню после закрытия плашки.
