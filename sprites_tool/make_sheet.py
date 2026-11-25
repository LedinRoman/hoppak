"""Cut a GPT hero sheet (1536x1024, transparent bg, top row = 6 big poses with caption pills below)
into the in-game sprite sheet: 7 cells (idle, squash, up, fall, ability, ko, blink), each CWxCH game px at x3.
Usage: python3 make_sheet.py in.png out.png [keep_blue_ability]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
SC = 1.5; TARGET_H = 22        # art grid = 1.5 px per game px (drawn x2 on the x3 canvas); idle height in game px
CW, CH, AX = 36, 32, 16        # cell (game px), anchor x of hat centre
def bands(v, th=0):
    v = [x if x > th else 0 for x in v]
    out = []; inb = False
    for i, x in enumerate(v):
        if x > 0 and not inb: s = i; inb = True
        if x == 0 and inb: out.append((s, i)); inb = False
    if inb: out.append((s, len(v)))
    return out
def clean(c, name):
    a = c.copy(); col0 = a[:, :, :3].astype(int)
    m = a[:, :, 3] > 245  # GPT speed lines / dust are semi-transparent, the hero is opaque
    if name == "ability": m |= (a[:, :, 3] > 110) & ((col0[:, :, 2] - col0[:, :, 0]) > 60)
    a[~m] = 0
    col = a[:, :, :3].astype(int); H, W = m.shape
    grey = m & ((col.max(2) - col.min(2)) < 48) & (col.sum(2) > 110) & (col.min(2) < 190)
    lab, k = ndimage.label(grey); rm = np.zeros_like(grey)
    for i in range(1, k + 1):
        ys, xs = np.where(lab == i)
        if ys.max() >= H - 4 or (ys.min() > H * 0.7 and (xs.mean() < W * 0.22 or xs.mean() > W * 0.8)): rm |= lab == i
    a[rm] = 0
    # thin speed lines / sparkles: pixels that a 7px opening removes AND are greyish or pure yellow
    m = a[:, :, 3] > 0
    opened = ndimage.binary_opening(m, structure=np.ones((7, 7)))
    thin = m & ~ndimage.binary_dilation(opened, iterations=2)
    col = a[:, :, :3].astype(int)
    greyish = (col.max(2) - col.min(2)) < 60
    yellow = (col[:, :, 0] > 180) & (col[:, :, 1] > 150) & (col[:, :, 2] < 110)
    a[thin & (greyish | yellow)] = 0
    m = a[:, :, 3] > 0; lab, k = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, k + 1)); o = np.argsort(-sz)
    keep = lab == (o[0] + 1)
    if name == "ability":
        for i in o[1:]:
            sl = lab == (i + 1); px = a[sl][:, :3].astype(int)
            if sz[i] > 30 and (px[:, 2] - px[:, 0]).mean() > 40: keep |= sl
    a[~keep] = 0
    ys, xs = np.where(a[:, :, 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def strip_backdrop(a):
    """GPT sometimes paints a grey noisy halo behind each pose (semi-transparent or opaque dark grey).
    Flood-fill from the image border over 'backdrop-like' pixels; the hero's black outline stops the fill."""
    c = a[:, :, :3].astype(int); al = a[:, :, 3]
    lum = c.mean(2); sat = c.max(2) - c.min(2)
    if (al < 60).mean() > 0.3: return a  # clean transparent sheet: nothing to strip
    bgl = (al < 245) | ((lum > 24) & (lum < 80) & (sat < 34))
    lab, k = ndimage.label(bgl)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # also pixels touching the backdrop that are semi-transparent
    a = a.copy(); a[bg] = 0
    return a
def white_to_alpha(a):
    """JPG with a white backdrop: flood-fill near-white/light-grey from the border -> transparent."""
    c = a[:, :, :3].astype(int); sat = c.max(2) - c.min(2)
    bgl = (c.min(2) > 200) & (sat < 40)
    lab, k = ndimage.label(bgl)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a = a.copy(); a[np.isin(lab, list(edge))] = 0
    # JPEG fringe, dust and floor shadows: light low-saturation pixels reachable from outside
    out = a[:, :, 3] == 0; c = a[:, :, :3].astype(int); sat = c.max(2) - c.min(2)
    lightish = (c.mean(2) > 150) & (sat < 60)
    reach = ndimage.binary_propagation(out, mask=out | lightish); a[reach] = 0
    return a
def strip_fx(a, kind):
    """Remove effects glued to a pose (mage's lavender glow, ninja's stone wall and speed lines):
    effect-coloured pixels reachable from the transparent outside without crossing the hero's dark outline."""
    c = a[:, :, :3].astype(int); r, g, b = c[:, :, 0], c[:, :, 1], c[:, :, 2]
    lum = c.mean(2); sat = c.max(2) - c.min(2); out = a[:, :, 3] == 0
    if kind == "mage": fx = (r > g + 25) & (b > g + 25) & (lum > 150)
    else: fx = ((sat < 45) & (lum > 70)) | ((b > r + 30) & (lum > 140))
    reach = ndimage.binary_propagation(out, mask=out | fx)
    a = a.copy(); a[reach & ~out] = 0
    return a
def row_frames(m, a, ri):
    rows = [b for b in bands(m.sum(1), 6) if b[1] - b[0] > 80]
    y0, y1 = rows[ri]
    out = []
    for c0, c1 in bands(m[y0:y1].sum(0), 6):
        if c1 - c0 < 40: continue
        col = m[y0:y1, c0:c1]; ys = np.where(col.any(1))[0]
        if ys.max() - ys.min() < 80: continue  # caption pill
        out.append(a[y0:y1, c0:c1])
    return out
def main(inp, out, abil=None, fx=None):
    src = Image.open(inp)
    a = np.array(src.convert("RGBA"))
    if src.mode != "RGBA": a = white_to_alpha(a)
    a = strip_backdrop(a)
    m = a[:, :, 3] > 245  # hero pixels are opaque; GPT noise/backdrops are semi-transparent
    m = ndimage.binary_opening(m, structure=np.ones((3, 3)))
    y0, y1 = [b for b in bands(m.sum(1), 6) if b[1] - b[0] > 80][0]
    cols = [c for c in bands(m[y0:y1].sum(0), 6) if c[1] - c[0] > 60]
    # caption pills sit under each pose; if they merged into the band, cut above the first pill
    sub = [b for b in bands(m[y0:y1, cols[0][0]:cols[0][1]].sum(1)) if b[1] - b[0] > 4]
    if len(sub) > 1: y1 = y0 + sub[1][0] - 2; cols = [c for c in bands(m[y0:y1].sum(0), 6) if c[1] - c[0] > 60]
    assert len(cols) == 6, cols
    names = ["idle", "squash", "up", "fall", "blink", "ability"]
    crops = {n: a[y0:y1, c0:c1] for n, (c0, c1) in zip(names, cols)}
    if fx: crops["ability"] = strip_fx(crops["ability"], fx)
    poses = {n: clean(crops[n], n) for n in names}
    s = SC * TARGET_H / poses["idle"].shape[0]
    abil_s = s
    if abil:  # take the ability pose from an animation row instead: "row,col"
        ri, ci = [int(v) for v in abil.split(",")]
        fr = row_frames(m, a, ri)
        small_idle = clean(fr[0], "idle")
        poses["ability"] = clean(fr[ci], "ability_small")
        abil_s = s * poses["idle"].shape[0] / small_idle.shape[0]
    order = ["idle", "squash", "up", "fall", "ability", "ko", "blink"]
    CWp, CHp = int(CW * SC), int(CH * SC)
    sheet = Image.new("RGBA", (CWp * len(order), CHp), (0, 0, 0, 0))
    for i, n in enumerate(order):
        src = Image.fromarray(poses["fall" if n == "ko" else n])
        ss = abil_s if n == "ability" else s
        nw, nh = max(1, round(src.width * ss)), max(1, round(src.height * ss))
        im = np.array(src.resize((nw, nh), Image.NEAREST))
        if n == "ko":
            g = im[:, :, :3].mean(2, keepdims=True); im[:, :, :3] = (im[:, :, :3] * 0.35 + g * 0.52).astype("uint8")
        if nw > CWp or nh > CHp:  # shrink oversize poses to fit the cell
            f = min(CWp / nw, CHp / nh); nw, nh = int(nw * f), int(nh * f)
            im = np.array(Image.fromarray(im).resize((nw, nh), Image.NEAREST))
        mm = im[:, :, 3] > 0; top = mm[: max(1, nh // 4)]; xs = np.where(top.any(0))[0]
        hx = (xs.min() + xs.max()) / 2 if n != "ability" else nw * 0.5
        if n == "ability":  # anchor on the body: centre of the lowest-third pixels
            low = mm[nh * 2 // 3:]; lx = np.where(low.any(0))[0]; hx = (lx.min() + lx.max()) / 2
        ox = int(round(AX * SC - hx)); ox = max(0, min(CWp - nw, ox)); oy = CHp - nh
        sheet.alpha_composite(Image.fromarray(im), (i * CWp + ox, oy))
        print(n, (nw, nh), "at", ox, oy)
    arr = np.array(sheet); arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0)
    Image.fromarray(arr).save(out)  # raw RGBA cells; unify.py makes the final shared-style sheets
if __name__ == "__main__":
    ar = [x for x in sys.argv[1:] if not x.startswith("--")]; fx = [x[5:] for x in sys.argv[1:] if x.startswith("--fx=")]
    main(ar[0], ar[1], ar[2] if len(ar) > 2 else None, fx[0] if fx else None)
