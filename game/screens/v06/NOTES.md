# v0.6rc screens

Headless Chrome, 428×745 (touch, so the client treats it as a phone) and 1280×800. `file://` with `window.__hopTg = { linked: true, name: "Roman-Иван!" }` so the badge draws without Telegram or a server. The hyphen is in the font, so it is kept; `!` is not, so it is dropped. The name is uppercased and cut at 10 glyphs: `ТГ ROMAN-ИВАН`.

| file | what |
| --- | --- |
| 01_428x745_menu_tg.png | Menu. Coins stay top-right. Name is top-left, to the right of the gear, above the title. |
| 02_1280x800_menu_tg.png | Same menu on a desktop frame. |
| 03_428x745_shop_hero.png | Hero card: plate name, description, charge. No second yellow role line. Coins in the same corner as the menu. |
| 04_428x745_campaign.png | Campaign list. |
| 05_428x745_campaign_selected.png | Tap on an open map only highlights it (gold frame). No ИГРАТЬ popup. |
| 06_428x745_online.png | Online menu. Same coin corner. «НЕТ СВЯЗИ» because this build has no baked server. |
| 07_428x745_ability_hint.png | First run, phone: «ТАП СЛЕВА / СПРАВА» and «СВАЙП ↑ РЫВОК». Desktop uses «← → ХОД» and «↑ РЫВОК». |
| 08_428x745_ability_ready.png | Ready disc (gold ring) plus «ГОТОВ». The height readout is shifted right so the two do not share pixels. |
| 09_428x745_remote_alpha.png | Own hero opaque, the other hero at `REMOTE_ALPHA` 0.8, with a dim name tag. |
| 10_428x745_staging_alpha.png | Staging build only: settings row «ЧУЖИЕ: 0.8». |
| 11_428x745_staging_alpha_09.png | Same row after one tap, stored `hoppak_remote_alpha` = `0.9` (cycle is 0.7 / 0.8 / 0.9). |

Shots 10 and 11 use `bash game/build.sh staging` (defines `HOP_STAGING`) paired with the plain `index.html`, so the page does not wait on telegram.org. The plain `index.html` does not load `telegram-web-app.js`; `index.staging.html` does.
