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
2 px cream/red hazard stripes (4 px world-anchored segments) + 1 px #140c1c outline, own hero full height, other players
a segment around their hero; blink last 60 ticks (1.2 s). Net bits 8192 (wall ability on) and 16384 (blink); old clients ignore them.
