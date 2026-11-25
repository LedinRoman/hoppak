# Staging: отладочная страница Telegram safe area

Для Hopper Devops. Страница статическая, токена бота не содержит и не читает.
Бот Mini App: **@HoppakBot**. Токен уже должен быть в env сервера
(например `TELEGRAM_BOT_TOKEN`). Не печатать токен, не писать его в логи
вручную, не коммитить, не подставлять в HTML.

Ветка: `exp/tg-safearea`. Файл страницы: `game/tgdebug/index.html`.
Не деплоим `client/v058` этим изменением — только эту статику на staging.

## Что выкладывать

- Отдать каталог `game/tgdebug/` как статику по HTTPS.
- Предлагаемый путь: `https://<staging-host>/tgdebug/`
  (`index.html` как directory index, со слэшем в конце).
- Других файлов в каталоге нет (кроме этого DEPLOY.md — его отдавать не обязательно).
- **HTTPS обязателен.** Telegram не откроет Mini App по HTTP.
- Никакого бэкенда, токена, cookie и API на этой странице не нужно.
  Страница сама грузит `https://telegram.org/js/telegram-web-app.js`.
- Заголовки по желанию: `Cache-Control: no-cache` (это отладка, пусть не залипает).
- Страница должна открываться и по прямому HTTPS-URL вне Telegram
  (тогда она пишет «не в Telegram») — так можно проверить, что статика жива.

Домен staging нужно разрешить для бота. Иначе кнопка меню / Mini App link
не откроют страницу как Mini App:

- в @BotFather: `/mybots` → @HoppakBot → Bot Settings → Domain /
  `/setdomain` на `<staging-host>`;
- либо тот же домен указать при создании Mini App (`/newapp`).

Обычная ссылка `https://<staging-host>/tgdebug/`, кинутая в чат, часто
открывается во встроенном браузере Telegram, **не** как Mini App.
В этом режиме нет `requestFullscreen()`, а `safeAreaInset` будут не те.
Для замера нужен именно Mini App (меню или `t.me/HoppakBot/<shortname>`).

## Вариант 1. Кнопка меню бота

Bot API `setChatMenuButton`, кнопка на всех личных чатах с @HoppakBot
(без `chat_id` — дефолт):

```json
{
  "type": "web_app",
  "text": "Debug",
  "web_app": { "url": "https://<staging-host>/tgdebug/" }
}
```

Подставьте реальный HTTPS-URL staging. Токен только из env или из файла
на сервере, в команду — через переменную, без `echo`.

```sh
# BOT_TOKEN уже в окружении. Не печатать его.
if [ -z "${BOT_TOKEN:-$TELEGRAM_BOT_TOKEN}" ]; then
  echo "BOT_TOKEN / TELEGRAM_BOT_TOKEN is not set" >&2
  exit 1
fi
TOKEN="${BOT_TOKEN:-$TELEGRAM_BOT_TOKEN}"
URL="https://<staging-host>/tgdebug/"

# -sS: без прогресса, ошибки сети видны. Без -v, чтобы токен не ушёл в лог.
# Ответ API токен не содержит — можно смотреть ok.
curl -sS -X POST "https://api.telegram.org/bot${TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  --data-binary "$(printf '%s' "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Debug\",\"web_app\":{\"url\":\"${URL}\"}}}")" \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print("ok" if r.get("ok") else "failed: "+json.dumps(r))'
```

Проверка без утечки токена:

```sh
curl -sS "https://api.telegram.org/bot${TOKEN}/getChatMenuButton" \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r.get("result") if r.get("ok") else r)'
```

Альтернатива без curl: @BotFather → `/mybots` → @HoppakBot →
Bot Settings → Menu Button → `/setmenubutton` → тип Web App,
текст `Debug`, URL `https://<staging-host>/tgdebug/`.

Чтобы убрать кнопку после замера:

```sh
curl -sS -X POST "https://api.telegram.org/bot${TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  --data-binary '{"menu_button":{"type":"default"}}' \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print("ok" if r.get("ok") else r)'
```

## Вариант 2. Прямая ссылка Mini App (лучше для fullscreen)

В @BotFather:

1. `/newapp` (или /mybots → @HoppakBot → Bot Settings → Configure Mini App).
2. Выбрать @HoppakBot.
3. Title / description / иконка — любые отладочные, например «Hoppak safe area».
4. Web App URL: `https://<staging-host>/tgdebug/`.
5. Short name, например `tgdebug`.

Получится ссылка вида `https://t.me/HoppakBot/tgdebug`.

Эту ссылку Роман открывает на iPhone в Telegram — это полноценный Mini App,
на нём можно жать `expand()`, `requestFullscreen()` и снять safe area.
Если short name уже занят — выбрать другой и прислать итоговую ссылку.

## Что написать Code / Producer после выкладки

- Точный HTTPS-URL страницы (`https://<host>/tgdebug/`).
- Как открывать: кнопка «Debug» в меню @HoppakBot и/или `t.me/HoppakBot/<shortname>`.
- Что домен прописан у бота.

Дальше Producer просит Романа открыть страницу на iPhone, нажать
`requestFullscreen()`, сделать скрин (и по желанию «скопировать JSON»)
и прислать его.
