# Хоппак

Пиксельный мультиплеерный джампер (веб и Telegram Mini App). Сначала игра для друзей, дальше — живой онлайн.

## Состояние (27.11.2026)

- Прод: https://76-13-250-251.sslip.io/ — v0.6, коммит `b683155`.
- Стейдж: https://staging.76-13-250-251.sslip.io/v/0.6rc/ — RC 0.6.1 (`rc.9`, `74b5556`), ветка `release/v0.6rc`, PR #2.
- Дальше: v1.0 — тот же функционал, все ассеты в 64 px. Всё, что планировалось на 0.61–1.0, переезжает в 1.01–1.xx.
- Подробно: `studio/PROJECT_STATE.md`. Как работают агенты: `studio/AGENT_PROTOCOL.md`.

## Структура

```
server/               сервер (NestJS/TypeORM, миграции БД, профиль и мультиплеер)
studio/               состояние проекта и протокол агентов
docs/                 документация API и концепты
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

Ветки: `release/v0.6rc` — текущая разработка (RC 0.6.1), `main` — отстаёт (v0.59), остальные — старые рабочие ветки. Подробнее в `studio/PROJECT_STATE.md`.
