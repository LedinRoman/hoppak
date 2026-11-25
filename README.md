# Хоппак

Пиксельный мультиплеерный джампер (веб, v0.5). Сначала игра для друзей, дальше — живой онлайн.

## Важно про это дерево

В исходниках `game/src/`, в `game/build.sh` и в `game/page-build/` могут быть незавершённые правки UX-аудита (ветка `client/ui-audit`). Это не обязательно чистое состояние релиза.

Стабильный снимок v0.5, который сейчас на странице:

`game/backups/hop.canvas.v0.5.spritefix.tsx`

## Структура

```
game/                 клиент
  src/                исходники (01_core, 02_world, 03_draw, 04_shell)
  build.sh            сборка страницы и локального JS
  index.html          локальный запуск (подключает hoppak.js)
  hoppak.page.tsx     собранный исходник страницы (генерируется)
  hoppak.js           локальный бандл (генерируется)
  page-build/         минифицированный TSX для загрузки в Canvas
  tests/              проверки
  screens/            скриншоты
  backups/            снимки версий, включая стабильный v0.5
sprites_in/           исходники спрайтов и арты
sprites_out/          готовые листы спрайтов
sprites_tool/         скрипты сборки спрайтов
concepts/             концепты экранов
concepts_pixel/       пиксельные концепты
```

## Сборка и запуск

Нужны `bash`, `python3`, `node` и `esbuild` по пути `/tmp/esb/node_modules/.bin/esbuild`.

```bash
cd game
./build.sh
```

Скрипт склеивает `src/*.tsx` в `hoppak.page.tsx`, собирает `hoppak.js` для локального запуска и кладёт минифицированный файл в `page-build/hop.canvas.tsx`.

Дальше открой `game/index.html` в браузере или раздай папку `game/` локальным сервером:

```bash
cd game
python3 -m http.server 8080
```

Затем открой http://localhost:8080/

Ветки: `main` — базовая линия, `client/ui-audit` — правки клиента, `net` — живой онлайн.
