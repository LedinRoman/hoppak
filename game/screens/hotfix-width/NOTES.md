# WIP hotfix/v058-width (pause 26.11.2026 ~01:26 MSK)

## Root cause (confirmed)

Live prod is Хоппак v0.58, `client/v058@6a6585d`, https://76-13-250-251.sslip.io/ (also `/v/0.58/`). `/v/0.56/` is 312cbc9.

This is not a generation bug and not a BUG-37 leak.

- Platforms spawn in `findX` with `randInt(r, 4, LW - pw - 4)` on LW=160. Seed 7 to 200 m: x 4..156 (same as 0.56). The start platform is `x=8, w=LW-16`.
- Phone/narrow path (`!isWide`) uses height-limited fill: `cssScale = min(W/160, H/346)`, then `VIEW_PAD = (W/cssScale - 160)/2`. The canvas is full width; the sky/city is drawn in the pads, so the field *looks* full-width.
- At iPhone 14 Plus Safari 428×745@3: cssScale≈2.153, VIEW_PAD≈19.39 world px, field is 344.5 css of 428 = **80.5%** of the screen. Start platform is 72.5% of the screen (the “~70%” on Roman’s shot).
- Roman’s screenshot `/workspace/studio/width_iphone_2026-11-26.png` (1284×2778, game y=141..2376 = 428×745 css): field edges at device x=125..1158. Hero hair 125–191, wrap clip 1148–1157 — flush with the field, not the screen. Clip works.
- Desktop `isWide` (cssW≥540, no coarse pointer) has VIEW_PAD=0 and a canvas exactly 160×346, so it “looks perfect.”
- 0.56 uses the same fill+pad path, so 428×745 looks the same as 0.58.

## Fix in this WIP (policy: fill width on play, crop top)

During `fieldLocked` play, phone path does `cssScale = availW/lw`, VIEW_PAD=0, crops `VIEW_CROP` world px from the top, bottom-aligns the canvas, shifts play HUD with `hudY()`. Sim, death, and camera still use LH=346 / LW=160. Menu/shop still fit the whole 346 UI (pads if needed). Desktop unchanged.

Files: `game/src/01_core.tsx`, `game/src/04_shell.tsx`, rebuild artifacts, `game/build.sh` (minifier default-export regex now accepts `$f`).

## Not done

- Phone screenshots 428×745@3 and 390×720 (Telegram-like) before/after. Script `/tmp/hotfix-width-shots.cjs` failed: puppeteer-core rejected `emulateMediaFeatures({name:'pointer'})`. Desktop 1280×800 shots are here and match (320×692, pad 0, pScale 2).
- 450-bot median vs 6a6585d (expected unchanged: no `02_world` edits). Baseline in `/workspace/hoppak-qa/reports/balance-v058.json`: median 370.5 m (novice 288, medium 382.5, skilled 459).
- Cherry-pick onto `client/v059` is for the v059 worker, not this branch. Do not push `client/v059`.

## Next step

1. Re-shoot 428×745@3 and 390×720 with touch via `hasTouch`/`isMobile` only (drop `emulateMediaFeatures`).
2. Run `human_balance_test.js` on this build, same 25 seeds × 6 maps × 3 profiles.
3. FF-only, no deploy. Cherry-pick SHA(s) onto `client/v059` after that.
