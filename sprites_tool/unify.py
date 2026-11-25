"""Bring all hero sheets (raw RGBA from make_sheet.py) to one style:
same art grid (1.5 px per game px), same contrast/saturation, 1-px dark outline, one shared palette, hard alpha."""
import sys, colorsys, numpy as np
from PIL import Image
from scipy import ndimage
HEROES = ["pilot", "pirate", "robot", "knight", "mage", "ninja"]
import os
def RAWP(h):
    f = "/workspace/jumper/sprites_out/raw_f/%s.png" % h  # after face_pass.py (serious faces)
    return f if os.path.exists(f) else "/workspace/jumper/sprites_out/raw/%s.png" % h
OUT = "/workspace/jumper/sprites_out/hero_%s_sheet.png"
OUTLINE = (20, 12, 28); NCOL = 64; CELLS = 7
def norm(a):
    rgb = a[:, :, :3].astype(float) / 255; m = a[:, :, 3] > 0
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in rgb[m]])
    s_mean = hsv[:, 1].mean(); v = hsv[:, 2]
    lo, hi = np.percentile(v, 4), np.percentile(v, 97)
    ks = np.clip(0.48 / max(0.05, s_mean), 0.8, 1.35)
    hsv[:, 1] = np.clip(hsv[:, 1] * ks, 0, 1)
    vn = (v - lo) / max(0.05, hi - lo) * (0.92 - 0.10) + 0.10   # common contrast range
    hsv[:, 2] = np.clip(0.55 * vn + 0.45 * v, 0, 1)
    out = a.copy(); out[m, :3] = (np.array([colorsys.hsv_to_rgb(*p) for p in hsv]) * 255).round().astype("uint8")
    return out, round(s_mean, 3), round(float(lo), 2), round(float(hi), 2)
def outline(a):
    m = a[:, :, 3] > 0; cw = a.shape[1] // CELLS
    ring = np.zeros_like(m)
    for c in range(CELLS):
        sl = m[:, c * cw:(c + 1) * cw]
        d = ndimage.binary_dilation(sl, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))
        ring[:, c * cw:(c + 1) * cw] = d & ~sl
    # keep feet on the cell floor: no ring below the bottom row (dilation can't go there anyway)
    o = a.copy(); o[ring, :3] = OUTLINE; o[ring, 3] = 255
    return o
sheets = {}
for h in HEROES:
    a = np.array(Image.open(RAWP(h)).convert("RGBA"))
    cwr = a.shape[1] // CELLS; a[:, 6 * cwr:] = a[:, :cwr]  # blink = idle for everyone: open eyes, no cute closed-eye face
    a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)
    a, sm, lo, hi = norm(a); print(h, "sat", sm, "v", lo, hi)
    sheets[h] = outline(a)
# one shared palette from all heroes
rng = np.random.default_rng(1); parts = []
for s_ in sheets.values():   # equal weight per hero so small colour groups (mage purple) get palette slots
    px = s_[s_[:, :, 3] > 0][:, :3]; parts.append(px[rng.choice(len(px), 6000, replace=True)])
allpx = np.concatenate(parts)
# k-means palette (init: median cut), so every hero keeps its key hues
side = int(np.ceil(np.sqrt(len(allpx)))); buf = np.zeros((side * side, 3), "uint8"); buf[:len(allpx)] = allpx; buf[len(allpx):] = allpx[0]
init = Image.fromarray(buf.reshape(side, side, 3)).quantize(colors=NCOL, method=Image.MEDIANCUT, dither=Image.NONE)
cent = np.array(init.getpalette()[:NCOL * 3], float).reshape(-1, 3); X = allpx.astype(float)
for _ in range(25):
    d = ((X[:, None, :] - cent[None]) ** 2).sum(2); lab_ = d.argmin(1)
    for k in range(NCOL):
        if (lab_ == k).any(): cent[k] = X[lab_ == k].mean(0)
PAL = np.clip(cent.round(), 0, 255).astype("uint8")
PAL[np.argmin(PAL.sum(1))] = OUTLINE  # darkest slot = the shared outline colour
def to_pal(rgb):
    f = rgb.reshape(-1, 3).astype(float); d = ((f[:, None, :] - PAL[None].astype(float)) ** 2).sum(2)
    return PAL[d.argmin(1)].reshape(rgb.shape)
for h, a in sheets.items():
    q = to_pal(a[:, :, :3]); out = np.zeros_like(a); out[:, :, :3] = q; out[:, :, 3] = a[:, :, 3]
    out[out[:, :, 3] == 0] = 0
    im = Image.fromarray(out)
    # indexed PNG: palette = shared PAL (+ index 64 transparent) -> tiny files
    pidx = ((out[:, :, :3].reshape(-1, 1, 3).astype(int) - PAL[None].astype(int)) ** 2).sum(2).argmin(1).reshape(out.shape[:2])
    pidx[out[:, :, 3] == 0] = NCOL
    pim = Image.fromarray(pidx.astype("uint8"), "P"); pal = list(PAL.flatten()) + [0, 0, 0]
    pim.putpalette([int(v) for v in pal]); pim.info["transparency"] = NCOL
    pim.save(OUT % h, optimize=True, transparency=NCOL)
    sheets[h] = out
# previews: line-up of idle frames on a game-like backdrop + full sheets
cw = sheets["pilot"].shape[1] // CELLS; ch = sheets["pilot"].shape[0]
bg = Image.new("RGBA", (cw * len(HEROES) + 6 * len(HEROES) + 6, ch + 10), (58, 46, 120, 255))
for i, h in enumerate(HEROES):
    cell = Image.fromarray(sheets[h][:, 0:cw]); bg.alpha_composite(cell, (6 + i * (cw + 6), 4))
bg.resize((bg.width * 6, bg.height * 6), Image.NEAREST).save("/workspace/jumper/sprites_out/heroes_lineup.png")
full = Image.new("RGBA", (sheets["pilot"].shape[1], ch * len(HEROES)), (58, 46, 120, 255))
for i, h in enumerate(HEROES): full.alpha_composite(Image.fromarray(sheets[h]), (0, ch * i))
full.resize((full.width * 3, full.height * 3), Image.NEAREST).save("/workspace/jumper/sprites_out/heroes_all_frames.png")
