#!/usr/bin/env python3
"""v1.0 64 px art packer: studio assets → game/src/01b_art64.tsx.

Heroes (pilot = Капитан, ninja, robot): the studio's native *_64.png frames, copied 1:1
with no resize. Cell is 72 art px wide (36 game px, same as the engine SPR_CW) and tall
enough for the tallest used frame; feet on the bottom row, head centre at x=32 (SPR_AX*2).
Poses: idle, squash, up, fall, ability, ko, blink (engine order).
Stray near-white sparkle on platforms/springs is mapped to the sprite's own palette
(ice and cloud stay white — they are white objects).
Hero light pixels (HSL L>=80% and HSV/HSL sat<=25%, plus near #fff) are remapped to a
darker colour from that sprite's palette. Eye whites become a readable light non-white
(#b8c4d0). Alpha is forced binary. Studio originals are not edited.
Backgrounds city/jungle: 1 px = 1 game px = 2 art px (no 320-grid version yet).
"""
import base64, glob, io, json, os
import numpy as np
from PIL import Image

STUDIO = '/workspace/studio'
ANIM = STUDIO + '/hero-assets-64/anim'
A64 = STUDIO + '/assets-64'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', '01b_art64.tsx')
SHOTS = STUDIO + '/v1-64px/shots'
INK = (0x14, 0x0c, 0x1c)
CW, AX = 72, 32  # art px; CH is max used frame height

# pose order: idle, squash, up, fall, ability, ko(source), blink, crouch, apex, fstart (HERO64_POSES) — paths under ANIM/<hero>/
HEROES = {
    'pilot': ['64/frame_01_64.png', '64/rest/land_64.png', '64/frame_11_64.png', '64/rest/fall_64.png',
              '64/rest/dash_fly_64.png', '64/rest/fall_start_64.png', '64/frame_02_64.png',
              '64/rest/land_64.png', '64/rest/apex_64.png', '64/rest/fall_start_64.png'],
    'ninja': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
              '64/push_64.png', '64/fall_start_64.png', '64/idle2_64.png',
              '64/crouch_64.png', '64/apex_64.png', '64/fall_start_64.png'],
    'robot': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
              '64/dome_on_64.png', '64/fall_start_64.png', '64/idle2_64.png',
              '64/crouch_64.png', '64/apex_64.png', '64/fall_start_64.png'],
    # v1.0 wave 2. cells 10-12 = ab2, ab3, ab4 (ability phases, render-only state in 04_shell animPose)
    'mage': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
             '64/tele_cast_64.png', '64/fall_start_64.png', '64/idle2_64.png',
             '64/crouch_64.png', '64/apex_64.png', '64/fall_start_64.png',
             '64/tele_out_64.png', '64/tele_in_64.png', '64/tele_land_64.png'],
    'knight': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
               '64/ram_dive_64.png', '64/fall_start_64.png', '64/idle2_64.png',
               '64/crouch_64.png', '64/apex_64.png', '64/fall_start_64.png',
               '64/ram_up_64.png', '64/ram_hit_64.png', '64/ram_jump_64.png'],
    'pirate': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
               '64/hook_throw_64.png', '64/fall_start_64.png', '64/idle2_64.png',
               '64/crouch_64.png', '64/apex_64.png', '64/fall_start_64.png',
               '64/hook_grab_64.png', '64/hook_pull_64.png', '64/hook_hit_64.png'],
}
# first-wave heroes: ab2..ab4 repeat their single ability frame
for _h in ('pilot', 'ninja', 'robot'):
    HEROES[_h] = HEROES[_h] + [HEROES[_h][4]] * 3
# wave-2 heroes: head centre = median x of the top third (staff tip / hook / rope above the head do not pull it)
ROBUST_HEAD = {'mage', 'knight', 'pirate'}
POSE_NAMES = ["idle", "squash", "up", "fall", "ability", "ko", "blink", "crouch", "apex", "fstart", "ab2", "ab3", "ab4"]

# heroes whose studio *_64.png lost armour to background keying: rebuilt from the hi-res frames
REPIX = {'robot'}
# sheet cells: 2 up, 3 fall, 8 apex, 9 fstart (ability/ko keep feet pinned)
AIR_POSES = {2, 3, 8, 9}

def rgba(p):
    return Image.open(p).convert('RGBA')

def ko(q):
    a = np.asarray(q).astype(float)
    g = a[..., :3].mean(2, keepdims=True)
    a[..., :3] = (a[..., :3] * 0.35 + g * 0.65) * 0.62
    return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')

def head_x(q):
    a = np.asarray(q)[..., 3] > 0
    top = a[: max(4, q.height // 4)]
    ys, xs = np.where(top)
    if not len(xs):
        return q.width / 2.0
    return (xs.min() + xs.max() + 1) / 2.0

def head_x_robust(q):
    a = np.asarray(q)[..., 3] > 0
    ys, xs = np.where(a)
    if not len(xs):
        return q.width / 2.0
    top = ys.min()
    band = (ys < top + max(6, (ys.max() - top) // 3))
    return float(np.median(xs[band])) + 0.5

def keep_fx(raw, q):
    """Wave 2: effect pixels (dust, speed lines, sparkles = everything not 8-connected to the body) keep
    their drawn colours; the light-pixel rule only applies to the hero body."""
    from scipy import ndimage
    r = np.asarray(raw.convert('RGBA')).copy()
    op = r[..., 3] >= 128
    lab, n = ndimage.label(op, structure=np.ones((3, 3)))
    if n <= 1:
        return q
    sizes = ndimage.sum(op, lab, range(1, n + 1))
    fx = op & (lab != 1 + int(np.argmax(sizes)))
    o = np.asarray(q).copy()
    o[fx, :3] = r[fx, :3]; o[fx, 3] = 255
    return Image.fromarray(o, 'RGBA')

# light pixels that ARE the object: the pirate's hook / sabre steel stays a light steel (#b8c4d0, the eye-white
# tone) so the hook never turns ink-dark and disappears; the mage's teleport glow (lilac) keeps its drawn colour.
STEEL = {('pirate', f) for f in ('hook_throw_64.png', 'hook_grab_64.png', 'hook_pull_64.png', 'hook_hit_64.png')}
GLOW = {('mage', f) for f in ('tele_cast_64.png', 'tele_out_64.png', 'tele_in_64.png', 'tele_land_64.png')}

def keep_special(hid, fname, raw, q):
    if (hid, fname) not in STEEL and (hid, fname) not in GLOW:
        return q
    r = np.asarray(raw.convert('RGBA')).astype(int)
    o = np.asarray(q).copy()
    op = r[..., 3] >= 128
    for y, x in zip(*np.where(op)):
        R, G, B = r[y, x, :3]
        if not is_hero_light(R, G, B):
            continue
        if (hid, fname) in GLOW:
            if B > G + 12 and R > G + 4:
                o[y, x, :3] = (R, G, B); o[y, x, 3] = 255
        else:
            o[y, x, :3] = (0xb8, 0xc4, 0xd0); o[y, x, 3] = 255
    return Image.fromarray(o.astype(np.uint8), 'RGBA')

def rope_anchor(q):
    """End of the rope / hook drawn in the sprite: the opaque pixel furthest up-forward (max x - y)."""
    a = np.asarray(q)[..., 3] > 0
    ys, xs = np.where(a)
    k = int(np.argmax(xs - ys))
    return int(xs[k]), int(ys[k])

def is_sparkle(r, g, b, al):
    if al < 16:
        return False
    mn = min(r, g, b)
    mx = max(r, g, b)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sat = 0 if mx == 0 else (mx - mn) / mx
    return mn >= 240 or (luma >= 245 and sat < 0.08)

def nearest_palette(a, x, y):
    """Nearest opaque non-sparkle neighbour, else the image's lightest non-sparkle, else outline."""
    h, w = a.shape[:2]
    best = None
    for rad in range(1, 8):
        cands = []
        for dy in range(-rad, rad + 1):
            for dx in range(-rad, rad + 1):
                if abs(dx) != rad and abs(dy) != rad and rad > 1:
                    continue
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    r, g, b, al = map(int, a[yy, xx])
                    if al >= 16 and not is_sparkle(r, g, b, al):
                        cands.append((dx * dx + dy * dy, r, g, b))
        if cands:
            cands.sort()
            return cands[0][1:]
    # global fallback: most common non-sparkle colour
    flat = a.reshape(-1, 4)
    cols = {}
    for r, g, b, al in flat:
        if al >= 16 and not is_sparkle(int(r), int(g), int(b), int(al)):
            t = (int(r), int(g), int(b))
            cols[t] = cols.get(t, 0) + 1
    if cols:
        return max(cols.items(), key=lambda kv: kv[1])[0]
    return INK

def clean_whites(im, tag, skip=False):
    """Replace stray near-white pixels. Returns (image, list of changes). skip=True keeps the image as-is and records kept whites."""
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    changes, kept = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, al = map(int, a[y, x])
            if not is_sparkle(r, g, b, al):
                continue
            rec = {'tag': tag, 'x': x, 'y': y, 'from': [r, g, b, al]}
            if skip:
                rec['keep'] = True
                kept.append(rec)
                continue
            nr, ng, nb = nearest_palette(a, x, y)
            a[y, x, 0] = nr; a[y, x, 1] = ng; a[y, x, 2] = nb
            rec['to'] = [int(nr), int(ng), int(nb)]
            changes.append(rec)
    return Image.fromarray(a, 'RGBA'), changes, kept


EYE_TONE = (0xb8, 0xc4, 0xd0)  # readable light non-white for sclera

def hsl(r, g, b):
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    L = (mx + mn) / 2.0
    if mx == mn:
        return 0.0, 0.0, L
    S = (mx - mn) / (1.0 - abs(2.0 * L - 1.0))
    if mx == r:
        H = ((g - b) / (mx - mn)) % 6.0
    elif mx == g:
        H = (b - r) / (mx - mn) + 2.0
    else:
        H = (r - g) / (mx - mn) + 4.0
    return H * 60.0, S, L

def hsv_sat(r, g, b):
    mx = max(r, g, b)
    return 0.0 if mx == 0 else (mx - min(r, g, b)) / mx

def is_hero_light(r, g, b, al=255):
    """High lightness, low saturation, or near-white. Catches skin highlights like #e9dace (HSV sat is low)."""
    if al < 16:
        return False
    if min(r, g, b) >= 235:
        return True
    _H, S_hsl, L = hsl(r, g, b)
    S_hsv = hsv_sat(r, g, b)
    return L >= 0.80 and (S_hsv <= 0.25 or S_hsl <= 0.25)

def hsl_to_rgb(H, S, L):
    C = (1.0 - abs(2.0 * L - 1.0)) * S
    Hp = (H % 360) / 60.0
    X = C * (1.0 - abs(Hp % 2.0 - 1.0))
    if 0 <= Hp < 1: rp, gp, bp = C, X, 0
    elif 1 <= Hp < 2: rp, gp, bp = X, C, 0
    elif 2 <= Hp < 3: rp, gp, bp = 0, C, X
    elif 3 <= Hp < 4: rp, gp, bp = 0, X, C
    elif 4 <= Hp < 5: rp, gp, bp = X, 0, C
    else: rp, gp, bp = C, 0, X
    m = L - C / 2.0
    return tuple(max(0, min(255, int(round((v + m) * 255)))) for v in (rp, gp, bp))

def darken_self(src):
    H, S, L = hsl(*src)
    return hsl_to_rgb(H, min(S, 0.22), 0.52)

def pick_darker(src, palette):
    """A mid, darker colour already in the sprite, preferring a similar hue."""
    Hs, Ss, Ls = hsl(*src)
    Ss_hsv = hsv_sat(*src)
    chroma_s = max(src) - min(src)
    cands = []
    for (r, g, b), n in palette.items():
        H, S, L = hsl(r, g, b)
        if L >= 0.78 or L < 0.25:
            continue
        dh = min(abs(H - Hs), 360 - abs(H - Hs))
        Sd = hsv_sat(r, g, b)
        chroma_d = max(r, g, b) - min(r, g, b)
        # grey highlights must not become red cloth; pale ones must not become gold
        if chroma_s < 18 and chroma_d > 40:
            continue
        if Ss_hsv < 0.25 and Sd > 0.75:
            continue
        hue_pen = (dh / 180.0) * (0.3 if Ss_hsv < 0.15 else 2.0)
        warm = (15 <= Hs <= 55) and dh < 30
        light_pen = abs(L - (0.58 if warm else 0.50))
        sat_jump = max(0.0, Sd - Ss_hsv - 0.35) * (0.25 if warm else 2.0)
        rare = 0.25 if n < 3 else 0
        cands.append((hue_pen + light_pen + sat_jump + rare, r, g, b))
    if not cands:
        return darken_self(src)
    cands.sort()
    return cands[0][1:]

def connected(flags):
    h, w = flags.shape
    seen = np.zeros_like(flags)
    comps = []
    for y in range(h):
        for x in range(w):
            if not flags[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            pts = []
            while stack:
                cy, cx = stack.pop()
                pts.append((cy, cx))
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                    yy, xx = cy + dy, cx + dx
                    if 0 <= yy < h and 0 <= xx < w and flags[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
            comps.append(pts)
    return comps

def hires_to_64(src_path, ref_size):
    """Re-pixelate a studio hi-res frame (pixel art on a flat light-gray background, closed black outline)
    onto the 64 px grid of the existing *_64.png (same w x h, so placement/scale stay identical).
    The background is removed by a flood from the image border only, so armour of the same gray stays."""
    from scipy import ndimage
    a = np.asarray(Image.open(src_path).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    corner = np.concatenate([a[:40, :40].reshape(-1, 3), a[:40, -40:].reshape(-1, 3), a[-40:, :40].reshape(-1, 3), a[-40:, -40:].reshape(-1, 3)])
    bgc = np.median(corner, 0)
    near = np.abs(a - bgc).max(2) < 16
    lab, n = ndimage.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    op = ~bg
    ys, xs = np.where(op)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    w, h = ref_size
    sx, sy = (x1 - x0) / w, (y1 - y0) / h
    out = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        for i in range(w):
            cx0, cx1 = x0 + (i + 0.25) * sx, x0 + (i + 0.75) * sx
            cy0, cy1 = y0 + (j + 0.25) * sy, y0 + (j + 0.75) * sy
            bx = slice(int(cx0), max(int(cx0) + 1, int(cx1))); by = slice(int(cy0), max(int(cy0) + 1, int(cy1)))
            m = op[by, bx]
            if m.mean() < 0.5:
                continue
            px = a[by, bx][m]
            q = (px >> 3)
            keys, inv, cnt = np.unique(q, axis=0, return_inverse=True, return_counts=True)
            k = cnt.argmax()
            sel = px[inv.reshape(-1) == k]
            out[j, i, :3] = np.median(sel, 0).round().astype(np.uint8)
            out[j, i, 3] = 255
    return Image.fromarray(out, 'RGBA')


def fill_key_holes(im):
    """Studio robot frames were keyed off a light-gray background that matched the armour, leaving
    enclosed transparent holes inside the body. Fill enclosed transparent components that are not
    ringed by dark outline (real gaps between limbs are) with the neighbouring armour colour."""
    from scipy import ndimage
    a = np.asarray(im.convert('RGBA')).copy()
    t = a[..., 3] < 128
    lab0, n0 = ndimage.label(t)
    border0 = set(np.unique(np.concatenate([lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]).tolist()))
    enclosed = t & ~np.isin(lab0, list(border0))
    # plus narrow pockets bitten into the silhouette edge (closing with a 5x5 disk)
    pad = np.pad(~t, 3)
    disk = np.array([[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0]], bool)
    closed = ndimage.binary_closing(pad, structure=disk)[3:-3, 3:-3]
    cand = enclosed | (closed & t)
    lab, n = ndimage.label(cand)
    border = set()
    h, w = t.shape
    filled = 0
    for i in range(1, n + 1):
        if i in border:
            continue
        m = lab == i
        ring = ndimage.binary_dilation(m) & ~m & ~t
        ys, xs = np.where(ring)
        if not len(ys):
            continue
        Ls = [hsl(*map(int, a[y, x, :3]))[2] for y, x in zip(ys, xs)]
        dark = sum(1 for L in Ls if L < 0.30) / len(Ls)
        if dark >= 0.6:
            continue  # a real gap outlined in black
        pend = set(zip(*np.where(m)))
        while pend:
            nxt = set()
            for (y, x) in list(pend):
                cols = {}
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and a[yy, xx, 3] >= 128 and (yy, xx) not in pend:
                        c = tuple(int(v) for v in a[yy, xx, :3])
                        if hsl(*c)[2] >= 0.30:
                            cols[c] = cols.get(c, 0) + 2
                        else:
                            cols[c] = cols.get(c, 0) + 1
                if cols:
                    c = max(cols.items(), key=lambda kv: kv[1])[0]
                    nxt.add((y, x, c))
            if not nxt:
                break
            for (y, x, c) in nxt:
                a[y, x, :3] = c; a[y, x, 3] = 255; pend.discard((y, x)); filled += 1
    return Image.fromarray(a, 'RGBA'), filled


def hero_dewhite(im):
    """Remap light desaturated pixels; keep eyes readable; force binary alpha.
    Returns (image, stats dict)."""
    a = np.asarray(im.convert('RGBA')).copy()
    # binary alpha
    a[..., 3] = np.where(a[..., 3] < 128, 0, 255).astype(np.uint8)
    h, w = a.shape[:2]
    hit = np.zeros((h, w), dtype=bool)
    pal = {}
    for y in range(h):
        for x in range(w):
            r, g, b, al = map(int, a[y, x])
            if al < 16:
                continue
            if is_hero_light(r, g, b, al):
                hit[y, x] = True
            else:
                t = (r, g, b)
                pal[t] = pal.get(t, 0) + 1
    # outline 1 px light specks just below the main threshold
    for y in range(h):
        for x in range(w):
            r, g, b, al = map(int, a[y, x])
            if al < 16 or hit[y, x]:
                continue
            _H, S_hsl, L = hsl(r, g, b)
            S_hsv = hsv_sat(r, g, b)
            if not (L >= 0.70 and (S_hsv <= 0.35 or S_hsl <= 0.35)):
                continue
            trans = 0
            similar = 0
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or a[yy, xx, 3] < 16:
                    trans += 1
                elif is_hero_light(*map(int, a[yy, xx, :3]), 255) or hit[yy, xx]:
                    similar += 1
            if trans >= 1 and similar <= 2:
                hit[y, x] = True
    if not hit.any():
        return Image.fromarray(a, 'RGBA'), {'n': 0, 'map': {}, 'eyes': 0}
    # opaque bbox for eye placement. Use the central column as the "core"
    # (head+torso) so raised-arm cuffs at the sides are not treated as eyes.
    ys, xs = np.where(a[..., 3] >= 16)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    bw, bh = x1 - x0, y1 - y0
    cx0 = x0 + int(bw * 0.20)
    cx1 = x0 + int(bw * 0.80)
    core = (a[..., 3] >= 16) & (np.arange(w)[None, :] >= cx0) & (np.arange(w)[None, :] < cx1)
    cys, cxs = np.where(core)
    if cys.size:
        cy0, cy1 = int(cys.min()), int(cys.max()) + 1
    else:
        cy0, cy1 = y0, y1
    head_y = cy0 + int((cy1 - cy0) * 0.50)
    eye_x0 = x0 + int(bw * 0.22)
    eye_x1 = x0 + int(bw * 0.78)
    eye_mask = np.zeros_like(hit)
    for pts in connected(hit):
        if not (2 <= len(pts) <= 8):
            continue
        ys_ = [p[0] for p in pts]; xs_ = [p[1] for p in pts]
        if max(ys_) - min(ys_) > 4 or max(xs_) - min(xs_) > 4:
            continue
        cy = sum(ys_) / len(pts)
        cx = sum(xs_) / len(pts)
        if cy > head_y or cx < eye_x0 or cx > eye_x1:
            continue
        dark_n = False
        for py, px in pts:
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = py + dy, px + dx
                if 0 <= yy < h and 0 <= xx < w and a[yy, xx, 3] >= 16 and not hit[yy, xx]:
                    _H, _S, L = hsl(*map(int, a[yy, xx, :3]))
                    if L < 0.30:
                        dark_n = True
        if dark_n:
            for py, px in pts:
                eye_mask[py, px] = True
    # v1.0 (Roman 14:32): delete or outline-black, never re-tint (except eyes; blobs see below)
    OUTLINE = (0x14, 0x0c, 0x1c)
    orig = a.copy()
    N4 = ((-1, 0), (1, 0), (0, -1), (0, 1))
    def is_dark(y, x):
        _H, _S, L = hsl(*map(int, orig[y, x, :3]))
        return L < 0.30
    # v1.0 fix (Roman 14:39): deletion is NOT propagated inward. A light pixel may go transparent only
    # if it sits on the ORIGINAL outer edge (touches original transparency) and every opaque neighbour that
    # stays is dark, so the silhouette keeps a closed dark outline. Shrink-only fixpoint, never grows.
    orig_tr = orig[..., 3] == 0
    pend = hit & ~eye_mask
    cand = np.zeros_like(hit)
    for y in range(h):
        for x in range(w):
            if not pend[y, x]:
                continue
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or orig_tr[yy, xx]:
                    cand[y, x] = True; break
    changed = True
    while changed:
        changed = False
        for y in range(h):
            for x in range(w):
                if not cand[y, x]:
                    continue
                for dy, dx in N4:
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < h and 0 <= xx < w) or orig_tr[yy, xx] or cand[yy, xx]:
                        continue
                    if pend[yy, xx]:
                        continue  # stays light -> becomes outline black below, closes the edge
                    if eye_mask[yy, xx] or not is_dark(yy, xx):
                        cand[y, x] = False; changed = True; break
    removed = cand
    a[removed, 3] = 0
    rest = pend & ~removed
    blob_mask = np.zeros_like(hit)
    for pts in connected(rest):
        s = set(pts)
        interior = [q for q in pts if all((q[0] + dy, q[1] + dx) in s for dy, dx in N4)]
        if len(interior) >= 4:  # a light AREA (visor, plate): keep it solid in a darker own tone
            for q in pts:
                blob_mask[q] = True
    # isolated 1-2 px light specks floating inside a non-dark area (dome sparkles, glints): erase them into
    # the surrounding colour instead of a black dot; no transparency, no hole
    speck_fill = {}
    for pts in connected(rest & ~blob_mask):
        if len(pts) > 2:
            continue
        s = set(pts); cols = {}; ok = True
        for (py, px) in pts:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = py + dy, px + dx
                    if (yy, xx) in s or (dy == 0 and dx == 0):
                        continue
                    if not (0 <= yy < h and 0 <= xx < w) or a[yy, xx, 3] == 0 or hit[yy, xx] or is_dark(yy, xx):
                        ok = False; continue
                    c = tuple(int(v) for v in orig[yy, xx, :3]); cols[c] = cols.get(c, 0) + 1
        if ok and cols:
            c = max(cols.items(), key=lambda kv: kv[1])[0]
            for q in pts:
                speck_fill[q] = c
    counts = {}
    mapping = {}
    eye_n = int(eye_mask.sum())
    def bump(key):
        counts[key] = counts.get(key, 0) + 1
    for y in range(h):
        for x in range(w):
            if not hit[y, x]:
                continue
            src = (int(orig[y, x, 0]), int(orig[y, x, 1]), int(orig[y, x, 2]))
            if eye_mask[y, x]:
                a[y, x, :3] = EYE_TONE; bump(('eye', 'eye'))
            elif removed[y, x]:
                bump(('removed', 'transparent'))
            elif blob_mask[y, x]:
                if src not in mapping:
                    mapping[src] = pick_darker(src, pal)
                a[y, x, :3] = mapping[src]; bump(('blob', '#%02x%02x%02x' % mapping[src]))
            elif speck_fill.get((y, x)) is not None:
                a[y, x, :3] = speck_fill[(y, x)]; bump(('speck', 'neighbour'))
            else:
                a[y, x, :3] = OUTLINE; bump(('outline', '#140c1c'))
    pretty = [{'role': k[0], 'to': k[1], 'n': n} for k, n in sorted(counts.items(), key=lambda kv: -kv[1])]
    return Image.fromarray(a, 'RGBA'), {'n': int(hit.sum()), 'eyes': eye_n, 'removed': int(removed.sum()),
                                        'outline': counts.get(('outline', '#140c1c'), 0), 'speck': counts.get(('speck', 'neighbour'), 0),
                                        'blob': int(blob_mask.sum()), 'map': pretty}


def hero_sheet(hid, files, ch):
    sheet = Image.new('RGBA', (CW * len(files), ch), (0, 0, 0, 0))
    info = []
    # head line for airborne poses = top of the rise ('up', index 2) frame as it would sit feet-pinned
    _up = rgba(os.path.join(ANIM, hid, files[2]))
    air_top = ch - _up.height + int(np.where(np.asarray(_up)[..., 3] > 0)[0].min())
    for i, f in enumerate(files):
        raw = rgba(os.path.join(ANIM, hid, f))
        raw0 = raw
        # Advisor 2026-11-27: all 6 hero sheets are already dust-cleaned and
        # dewhited in the studio sources (eye whites #b8c4d0, binary alpha).
        # Do not recolour lights, fill key holes, or rebuild from hi-res here.
        a = np.asarray(raw).copy()
        a[..., 3] = np.where(a[..., 3] < 128, 0, 255).astype(np.uint8)
        q = Image.fromarray(a, 'RGBA')
        st = {'n': 0, 'eyes': 0, 'removed': 0, 'outline': 0, 'speck': 0, 'blob': 0, 'map': [], 'holes': 0}
        if i == 5:
            raw = ko(raw); q = ko(q); raw0 = ko(raw0)
        if q.height > ch:
            q = q.crop((0, q.height - ch, q.width, q.height))
        hx = head_x_robust(q) if hid in ROBUST_HEAD else head_x(q)
        x = int(round(AX - hx))
        x = max(0, min(CW - q.width, x))
        y = ch - q.height
        if i in AIR_POSES:
            # airborne frames: keep the head line steady (same top as the rise frame) instead of pinning the
            # feet, so up -> apex -> fall_start -> fall reads as one motion; tucked legs simply ride higher
            y = max(0, air_top - int(np.where(np.asarray(q)[..., 3] > 0)[0].min()))
        sheet.alpha_composite(q, (i * CW + x, y))
        info.append({'file': os.path.basename(f), 'size': list(q.size), 'placeX': x, 'placeY': y, 'q': q, 'headX': round(hx, 1),
                     'before': raw0, 'after': q, 'dewhite': st})
    return sheet, info

def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def bottom_fill(im):
    a = np.asarray(im); row = a[-1]; op = row[row[:, 3] > 0]
    if not len(op):
        return '#000000'
    vals, cnt = np.unique(op[:, :3], axis=0, return_counts=True); c = vals[cnt.argmax()]
    return '#%02x%02x%02x' % tuple(int(v) for v in c)

def add(d, k, im):
    d[k] = uri(im); d[k + 'W'] = im.width; d[k + 'H'] = im.height; d[k + 'Fill'] = bottom_fill(im)

def zoom_pair(before, after, path, scale=10, bg=(40, 30, 60, 255)):
    def z(im):
        im = im.convert('RGBA')
        c = Image.new('RGBA', im.size, bg)
        c.alpha_composite(im)
        return c.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b, a = z(before), z(after)
    gap = 8
    out = Image.new('RGBA', (b.width + gap + a.width, max(b.height, a.height)), (16, 12, 28, 255))
    out.paste(b, (0, 0)); out.paste(a, (b.width + gap, 0))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path)

def main():
    os.makedirs(SHOTS, exist_ok=True)
    # cell height = tallest used native frame (no resample, no vertical crop if we can avoid it)
    heights = []
    for hid, files in HEROES.items():
        for f in files:
            heights.append(rgba(os.path.join(ANIM, hid, f)).height)
    ch = max(heights)
    out = {'hero': {}, 'plat': {}, 'bg': {}, 'cell': {'w': CW, 'h': ch, 'ax': AX}}
    report = {'cellH': ch, 'heroes': {}, 'cleanup': {'changed': [], 'kept_platform_white': [], 'kept_hero_lights': []}}
    all_changes = []

    for hid, files in HEROES.items():
        sh, info = hero_sheet(hid, files, ch)
        dewhite = []
        total = 0
        eyes = 0
        # before/after face crop of the idle (pose 0) and a mid pose
        for i, meta in enumerate(info):
            st = meta['dewhite']
            total += st['n']; eyes += st['eyes']
            dewhite.append({'file': meta['file'], 'n': st['n'], 'eyes': st['eyes'], 'removed': st['removed'], 'outline': st['outline'], 'blob': st['blob'], 'holes': st.get('holes', 0), 'map': st['map']})
        for i, tag in ((0, 'idle'), (2, 'up')):
            meta = info[i]
            before, after = meta['before'], meta['after']
            # face: top ~40 rows of the frame, shared canvas
            H = 42
            def face(im):
                c = Image.new('RGBA', (max(im.width, 44), H), (40, 30, 60, 255))
                y = 0
                c.alpha_composite(im, (2, y))
                return c
            zoom_pair(face(before), face(after), os.path.join(SHOTS, 'white-hero-%s-%s.png' % (hid, tag)), scale=8)
        slim = [{'file': m['file'], 'size': m['size'], 'placeX': m['placeX'], 'headX': m['headX']} for m in info]
        report['heroes'][hid] = {'cell': slim, 'pixels': total, 'eyes': eyes, 'poses': dewhite}
        out['hero'][hid] = uri(sh)
        if hid == 'pirate':
            # rope start for the code-drawn rope, cell art coords: throw = hook in hand, grab/pull = rope end at
            # the sprite edge, hit = the free hand / hilt (no rope in the art). ability=4, ab2=10, ab3=11, ab4=12
            anc = {}
            for ci, nm in ((4, 'ability'), (10, 'ab2'), (11, 'ab3'), (12, 'ab4')):
                m = info[ci]; ax_, ay_ = rope_anchor(m['q'])
                anc[nm] = [m['placeX'] + ax_, m['placeY'] + ay_]
            out.setdefault('anchor', {})['pirate'] = anc
            report['heroes'][hid]['anchor'] = anc
        sh.resize((sh.width * 4, sh.height * 4), Image.NEAREST).save('/tmp/art64_%s_x4.png' % hid)

    WHITE_OK = {'cloud', 'ice', 'normal_ice'}  # body is white
    land = {'break': 2, 'bounce': 2, 'cloud': 7}
    for p in sorted(glob.glob(A64 + '/platforms/*_1x.png')):
        n = os.path.basename(p)[:-7]
        if n in ('break_1x_v1', 'break_1x_v2', 'spring_gpt_cut') or n.endswith('_v1') or n.endswith('_v2'):
            continue
        raw = rgba(p)
        if n in WHITE_OK:
            im, changes, kept = clean_whites(raw, 'plat:' + n, skip=True)
            report['cleanup']['kept_platform_white'].append({'plat': n, 'n': len(kept), 'why': 'white is the object colour'})
        else:
            before = raw.copy()
            im, changes, kept = clean_whites(raw, 'plat:' + n, skip=False)
            if changes:
                all_changes += changes
                # before/after crop around the first change
                x, y = changes[0]['x'], changes[0]['y']
                pad = 8
                box = (max(0, x - pad), max(0, y - pad), min(raw.width, x + pad), min(raw.height, y + pad))
                zoom_pair(before.crop(box), im.crop(box), os.path.join(SHOTS, 'white-before-after-%s.png' % n), scale=12)
        out['plat'][n] = {'src': uri(im), 'w': im.width, 'h': im.height, 'land': land.get(n, 1)}

    coin_raw = rgba(A64 + '/coin/coin_strip_1x.png')
    coin, coin_ch, coin_kept = clean_whites(coin_raw, 'coin', skip=False)
    if coin_ch:
        all_changes += coin_ch
        zoom_pair(coin_raw, coin, os.path.join(SHOTS, 'white-before-after-coin.png'), scale=8)
    # coins have gold highlights, not true white — record if nothing changed
    if not coin_ch:
        report['cleanup']['kept_coin'] = 'no true-white pixels; gold highlights (e.g. #fce59a) kept'
    out['coin'] = {'src': uri(coin), 'n': 8, 'cw': coin.width // 8, 'ch': coin.height}

    B = A64 + '/bg/'
    # v1.0 final backgrounds (Design, approved 27.11): every layer is a 160x346 PNG placed as it looks at the
    # layer's "shown" height (refs/bg/layers_meta.json). Strips (far/near/floor) keep everything from their top
    # row down; objects (sun/moon, planet, aurora, sunbeams) are cropped to their box with the box position;
    # moving fields (stars, clouds, snow, embers, bubbles, nebulae, asteroids) stay full 160x346 tiles.
    meta = json.load(open(A64 + '/refs/bg/layers_meta.json'))
    # space was rebuilt from the GPT sheet at its m=0 frame (README: moon centre y=36 at m=0, planet centre ~30)
    for _k in ('sun_moon', 'planet', 'nebulae', 'asteroids', 'stars'):
        meta['space'][_k] = 0
    TILES = ('stars', 'nebulae', 'asteroids', 'bubbles', 'snow', 'embers', 'clouds_small', 'clouds_big')
    SPRITES = ('sun_moon', 'planet', 'aurora', 'sunbeams')
    out['bg'] = {}
    for wld in ('city', 'jungle', 'ice', 'lava', 'aqua', 'space'):
        d = out['bg'][wld] = {'L': {}}
        files = {os.path.basename(f)[3:-7]: f for f in glob.glob(B + wld + '/[0-9][0-9]_*_1x.png')}
        def strip(name):
            im = rgba(files[name]); bb = im.getbbox()
            return im.crop((0, bb[1], 160, 346)), bb[1]
        im, top = strip('horizon_far'); add(d, 'far', im); d['farY0'] = top
        im, top = strip('horizon_near'); add(d, 'near', im); d['nearY0'] = top
        im, top = strip('floor_props' if 'floor_props' in files else 'floor'); add(d, 'floor', im); d['floorRow'] = 279 - top
        for name, f in sorted(files.items()):
            if name in TILES:
                im = rgba(f)
                d['L'][name] = {'src': uri(im), 'x': 0, 'y': 0, 'w': im.width, 'h': im.height, 'm': meta[wld].get(name, 700)}
            elif name in SPRITES:
                im = rgba(f); bb = im.getbbox()
                c = im.crop(bb)
                d['L'][name] = {'src': uri(c), 'x': bb[0], 'y': bb[1], 'w': c.width, 'h': c.height, 'm': meta[wld].get(name, 700)}
        report.setdefault('bg', {})[wld] = {'farY0': d['farY0'], 'nearY0': d['nearY0'], 'floorRow': d['floorRow'], 'layers': {k: [v['x'], v['y'], v['w'], v['h'], v['m']] for k, v in d['L'].items()}}

    # summarise cleanup
    by = {}
    for c in all_changes:
        by.setdefault(c['tag'], 0)
        by[c['tag']] += 1
    report['cleanup']['changed'] = [{'tag': k, 'n': v} for k, v in sorted(by.items())]
    report['cleanup']['changed_total'] = len(all_changes)
    os.makedirs('/tmp', exist_ok=True)
    json.dump(report, open('/tmp/art64_report.json', 'w'), indent=2)

    js = json.dumps(out, separators=(',', ':'))
    with open(OUT, 'w') as f:
        f.write('/* v1.0 wave 1: 64 px art, generated by game/tools64/build_art64.py from /workspace/studio. Do not edit. */\n')
        f.write('var ART64: any = ' + js + ';\n')
        f.write(''.join('HERO_SPRITES.%s = ART64.hero.%s; ' % (h, h) for h in HEROES) + '\n')
        f.write('var HERO64: any = { ' + ', '.join('%s: 1' % h for h in HEROES) + ' };\n')
        f.write('var HERO64_POSES = ' + json.dumps(POSE_NAMES) + ';\n')
    print(json.dumps({'cellH': ch, 'changed': report['cleanup']['changed'], 'bytes': len(js),
                      'bg': report.get('bg')}))

main()
