# v0.59 notes

## Width (Roman, option A, bottom crop) — supersedes hotfix-width/NOTES.md top-crop policy
- Phone play (`fieldLocked && phase === "play"`, not desktop): cssScale = availW / lw (full width), leftover height hidden at the BOTTOM (`VIEW_BOT`). The view above the hero equals a full 346 field (hero top on camera line LH*0.42 = 145.3 world px).
- Render-only look-down `VIEW_SHIFT` (0..VIEW_BOT): keeps the hero's feet >= 20 px above the visible bottom; snaps down, eases back 2 px/frame. Hero stays visible until the sim death line (camY+LH), same as 0.58. Sim, camera, death, net unchanged (NET_PROTO 1).
- Cap: VIEW_BOT <= LH - (LH*0.42 + PH + JUMP_H + 12) = 91 world px (normal landing stays visible without look-down). Excess goes to a top crop (<= 80), then side strips.
- Menu/shop/results: old fit (whole 346 UI). Canvas bottom-aligned when cropped, centered otherwise.
- Numbers: width_measure.json.

## Ocean ray -> fish swap point
`MOB_SPRITES.ray` in game/src/03_draw.tsx now holds Design's fish (fish_strip_72x12.png as a data-URI): 72×12, 3 frames
24×12, facing RIGHT, ox -4 / oy -2, hitbox MOBS.ray 16×8 untouched. Left-facing is mirrored in drawMobSprite.
A procedural coral-orange ray remains only as a decode fallback.

## Ninja walls
Design's 8×16 brick tile (ninja_wall_tile_8x16.png) as a data-URI, world-anchored, right wall mirrored.
Own hero: full-height columns. Other players: a short segment with 8×4 caps (1 px overlap, bottom cap flipped).
Blink last 60 ticks and net bits 8192/16384 unchanged. Hero is drawn on top of the walls.
While clinging, facing into the field is render-only: p.face is used by dash/kick and is synced, so sim is unchanged.
