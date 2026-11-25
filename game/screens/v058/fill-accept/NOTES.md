# v0.58 fill acceptance (0.56 scale on phones)

Phone scale is the 0.56 fractional nearest-neighbor fill. No integer/k8 toggle.
World stays LW=160, LH=346, NET_LW unchanged (server room.lw, typically 180).

## 1) Field width equals 0.56

| viewport | build | fieldCssW | pScale | fieldOx (device) |
|---|---|---:|---:|---:|
| 390×844@3 | 0.56 | 390 | 7.3125 | 0 |
| 390×844@3 | v0.58 fill | 390 | 7.3125 | 0 |
| 390×720@3 (Telegram) | 0.56 | 332.9479768786127 | 6.2427745664739875 | (VIEW_PAD unsnapped) |
| 390×720@3 (Telegram) | v0.58 fill | 332.9479768786127 | 6.2427745664739875 | 86 (VIEW_PAD*sx snapped) |

Screens: compare-phone.png, compare-tg.png, v056-*.png, v058fill-*.png.

## 2) Balance / height unchanged

- LW=160, LH=346, NET_LW via N.room.lw (180).
- Platform gen seed 7, city, to 200 m: identical to 0.56 (n=85, w 39–54, avg 46.4588, spread 152, wall 4+4, jumpH≈81.059, gapCap=75, rowSep=28).

## 3) BUG-37 under fill

Device-pixel clip after drawBg (ceil left / floor right) so a 1-device-px sliver cannot leak under fractional k.

Same-tick harness (dt=0 redraw after mutate), non-background pixels in side margins:

- 390×844@3: no side pads (field fills width). All 9 cases N/A, changed=0.
- 390×720@3: after a first mid_control warmup frame, wrap/dash/jumpfx/slime/other cases changed=0. hero_x0 = 2 isolated pixels at the outer canvas edge (margin x=85 of 86, not the field boundary).
- 360×640@2: 2–8 pixels in the leftmost canvas column (device x=0, outer edge, not the field boundary at ox=64). Wrap cases do not add pixels at the field edge.

Official bug37_margin_check.js on padded viewports also flags sky/camera when the world ticks between baseline and compare; those counts are not wrap leaks. Edge screens: bug37-edge-phone.png, bug37-edge-tg.png.

## 4) Shimmer

Camera snap is render-only: cam = round(cameraY * pScaleY) / pScaleY. Physics camY is unrounded.
48 frames, camera -= 0.25 world px each. Max frame-to-frame sprite size:

- 390×844@3: platform Δw=0 (w=337), Δh=8 (=1 world px at k=7.3125); hero Δw=0 (w=103).
- 390×720@3: platform Δw=0 (w=287), Δh=6 (≈1 world px at k≈6.24); hero Δw=0 (w=90).

Width is stable. Height can change by 1 world pixel from world-space rounding, same as 0.56.
Honest: fractional k=7.3125 still makes 1-world-px features 7 or 8 device px (mixed pixel sizes, as in 0.56). See shimmer.json.
