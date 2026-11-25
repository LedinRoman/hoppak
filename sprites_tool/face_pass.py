"""Serious-face pass (Роман: faces like knight/robot/ninja — closed, focused, no cute smile).
Works on raw art-res sheets (7 cells of 54x48): finds the face (largest skin blob in the upper part
of each cell) and repaints eyes/brows/mouth; adds captain's goggles, pirate's bandana, mage's hat shadow."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
RAW = "/workspace/jumper/sprites_out/raw/%s.png"; OUT = "/workspace/jumper/sprites_out/raw_f/%s.png"
CELLS = 7
DARK = np.array([34, 20, 26, 255]); BROW = np.array([46, 26, 22, 255])
def skin_mask(c):
    r, g, b = [c[:, :, i].astype(int) for i in range(3)]
    return (c[:, :, 3] > 0) & (r > 160) & (g > 100) & (g < 225) & (b > 60) & (b < 190) & (r - b > 45) & (r - g > 12) & (r - g < 90)
def face_box(c):
    m = skin_mask(c); H = c.shape[0]
    m[int(H * 0.86):] = False
    lab, n = ndimage.label(m)
    if not n: return None
    sz = ndimage.sum(m, lab, range(1, n + 1)); k = int(np.argmax(sz)) + 1
    if sz[k - 1] < 10: return None
    ys, xs = np.where(lab == k)
    return ys.min(), ys.max(), xs.min(), xs.max(), lab == k
def process(c, hero):
    fb = face_box(c)
    if fb is None: return c
    y0, y1, x0, x1, fm = fb
    c = c.copy(); H = y1 - y0 + 1
    skin = np.array(list(np.median(c[fm][:, :3], axis=0).astype(int)) + [255])
    inside = np.zeros(c.shape[:2], bool)
    for y in range(y0, y1 + 1):
        xs = np.where(fm[y, x0:x1 + 1])[0]
        if len(xs): inside[y, x0 + xs.min(): x0 + xs.max() + 1] = True
    col = c[:, :, :3].astype(int); lum = col.mean(2); sat = col.max(2) - col.min(2)
    feat = inside & ~fm
    best, ey = -1, None
    for y in range(y0 + 1, y0 + max(3, int(H * 0.7))):
        n = int((feat[y] & (lum[y] < 130)).sum())
        if n > best: best, ey = n, y
    if best <= 0: ey = y0 + int(round(H * 0.45))
    # eye centres from dark feature clusters on the eye rows, else a template
    cols = sorted({x for x in range(x0, x1 + 1) for yy in (ey - 1, ey, ey + 1) if y0 <= yy <= y1 and feat[yy, x] and lum[yy, x] < 130})
    groups = []
    for x in cols:
        if groups and x - groups[-1][-1] <= 1: groups[-1].append(x)
        else: groups.append([x])
    groups = sorted(groups, key=len, reverse=True)[:2]
    cxs = sorted(int(round(np.mean(g))) for g in groups)
    w = x1 - x0 + 1
    if len(cxs) < 2 or cxs[1] - cxs[0] < 3:
        mid = x0 + w // 2 + (1 if w > 7 else 0); cxs = [mid - 2, mid + 2]
    # 1) wipe the old face: features + white sclera/highlights touching the face
    wipe = feat.copy()
    for y in range(max(0, ey - 2), min(c.shape[0], ey + 3)):
        for x in range(max(0, x0 - 1), min(c.shape[1], x1 + 2)):
            if c[y, x, 3] and lum[y, x] > 190 and sat[y, x] < 60: wipe[y, x] = True
    c[wipe] = skin
    mouth_y = min(y1 - 1, ey + 3)
    mx = int(round((cxs[0] + cxs[1]) / 2)) + 1
    def put(y, x, v):
        if 0 <= y < c.shape[0] and 0 <= x < c.shape[1] and c[y, x, 3]: c[y, x] = v
    if hero == "pilot":
        RIM = [196, 118, 40, 255]; LENS = [52, 146, 214, 255]; HI = [190, 236, 255, 255]; STRAP = [74, 42, 26, 255]
        for x in range(x0, x1 + 1):
            if inside[ey, x]: put(ey, x, STRAP)
        for ex in cxs:
            for x in range(ex - 1, ex + 2):
                put(ey - 1, x, RIM); put(ey + 1, x, RIM)
            put(ey, ex - 1, RIM); put(ey, ex + 1, RIM); put(ey, ex, LENS)
        put(ey, cxs[0], HI)
        put(mouth_y, mx - 1, DARK); put(mouth_y, mx, DARK)
    elif hero == "pirate":
        for i, ex in enumerate(cxs):
            put(ey, ex, DARK); put(ey, ex + (1 if i == 1 else -1), DARK)
            inner = ex + (1 if i == 0 else -1)
            put(ey - 1, ex - 1, BROW); put(ey - 1, ex, BROW); put(ey - 1, ex + 1, BROW); put(ey, inner, BROW)
        for y in range(ey + 2, y1 + 1):
            for x in range(x0 - 1, x1 + 2):
                if inside[y, min(max(x, x0), x1)] and c[y, x, 3] and (inside[y, x] or lum[y, x] > 120):
                    c[y, x] = [196, 52, 52, 255] if y == ey + 2 else [150, 30, 36, 255]
        for x in range(x0, x1 + 1):
            if inside[y1, x]: c[y1, x] = [96, 18, 26, 255]
    elif hero == "mage":
        for y in range(y0, ey + 1):
            for x in range(x0, x1 + 1):
                if inside[y, x]: c[y, x, :3] = (skin[:3] * (0.34 if y < ey else 0.5)).astype("uint8")
        for ex in cxs: put(ey, ex, [150, 240, 255, 255])
        for x in range(x0, x1 + 1):
            if inside[ey + 1, x]: c[ey + 1, x, :3] = (skin[:3] * 0.75).astype("uint8")
        put(mouth_y, mx - 1, DARK); put(mouth_y, mx, DARK)
    return c
def remove_hat_goggles(c):
    """captain: goggles moved to the eyes, so repaint the ones on the cap with cap white."""
    fb = face_box(c)
    if fb is None: return c
    y0 = fb[0]; r, g, b = [c[:, :, i].astype(int) for i in range(3)]
    hat = np.zeros(c.shape[:2], bool); hat[:y0] = True
    gog = hat & (c[:, :, 3] > 0) & (((b > r + 30) & (b > 110)) | ((r > 170) & (g > 90) & (g < 190) & (b < 100)))
    light = hat & (c[:, :, 3] > 0) & (r > 200) & (g > 200) & (b > 200)
    if light.any() and gog.any():
        col = np.median(c[light][:, :3], axis=0).astype("uint8")
        # goggles + their dark rims, but keep the cap's outer outline (pixels next to transparency)
        zone = ndimage.binary_dilation(gog, iterations=1) & hat & (c[:, :, 3] > 0)
        edge = ndimage.binary_dilation(c[:, :, 3] == 0) & (c[:, :, 3] > 0)
        c = c.copy(); c[zone & ~edge, :3] = col
        shade = np.clip(col.astype(int) - 40, 0, 255).astype("uint8")
        ys, xs = np.where(zone & ~edge)
        if len(ys):  # a thin shade line under the cap band so it still reads as a brim
            yb = ys.max()
            for x in xs[ys == yb]: c[yb, x, :3] = shade
    return c
for hero in ["pilot", "pirate", "mage"]:
    a = np.array(Image.open(RAW % hero).convert("RGBA")); cw = a.shape[1] // CELLS
    for i in range(CELLS):
        cell = a[:, i * cw:(i + 1) * cw]
        if hero == "pilot": cell = remove_hat_goggles(cell)
        if i not in (5, 6): a[:, i * cw:(i + 1) * cw] = process(cell, hero)
    # ko = greyed processed fall pose (as make_sheet does), blink = idle (no closed-eye smile)
    ko = a[:, 3 * cw:4 * cw].copy(); g = ko[:, :, :3].mean(2, keepdims=True)
    ko[:, :, :3] = (ko[:, :, :3] * 0.35 + g * 0.52).astype("uint8"); a[:, 5 * cw:6 * cw] = ko
    a[:, 6 * cw:7 * cw] = a[:, 0:cw]
    Image.fromarray(a).save(OUT % hero)
    print("ok", hero)
