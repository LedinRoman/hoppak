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

# pose order: idle, squash, up, fall, ability, ko(source), blink — paths under ANIM/<hero>/
HEROES = {
    'pilot': ['64/frame_01_64.png', '64/rest/land_64.png', '64/frame_11_64.png', '64/rest/fall_64.png',
              '64/rest/dash_fly_64.png', '64/rest/fall_start_64.png', '64/frame_02_64.png'],
    'ninja': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
              '64/push_64.png', '64/fall_start_64.png', '64/idle2_64.png'],
    'robot': ['64/idle1_64.png', '64/land_64.png', '64/rise_64.png', '64/fall_64.png',
              '64/dome_full_64.png', '64/fall_start_64.png', '64/idle2_64.png'],
}

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
    # map each source colour once
    mapping = {}
    counts = {}
    eye_n = 0
    for y in range(h):
        for x in range(w):
            if not hit[y, x]:
                continue
            src = (int(a[y, x, 0]), int(a[y, x, 1]), int(a[y, x, 2]))
            if eye_mask[y, x]:
                dest = EYE_TONE
                eye_n += 1
            else:
                if src not in mapping:
                    mapping[src] = pick_darker(src, pal)
                dest = mapping[src]
            a[y, x, 0], a[y, x, 1], a[y, x, 2] = dest
            key = (src, dest, 'eye' if eye_mask[y, x] else 'body')
            counts[key] = counts.get(key, 0) + 1
    pretty = []
    for (src, dest, role), n in sorted(counts.items(), key=lambda kv: -kv[1]):
        pretty.append({'from': '#%02x%02x%02x' % src, 'to': '#%02x%02x%02x' % dest, 'role': role, 'n': n})
    return Image.fromarray(a, 'RGBA'), {'n': int(hit.sum()), 'eyes': eye_n, 'map': pretty}

def hero_sheet(hid, files, ch):
    sheet = Image.new('RGBA', (CW * 7, ch), (0, 0, 0, 0))
    info = []
    for i, f in enumerate(files):
        raw = rgba(os.path.join(ANIM, hid, f))
        if i == 5:
            raw = ko(raw)
        q, st = hero_dewhite(raw)
        if q.height > ch:
            q = q.crop((0, q.height - ch, q.width, q.height))
        hx = head_x(q)
        x = int(round(AX - hx))
        x = max(0, min(CW - q.width, x))
        sheet.alpha_composite(q, (i * CW + x, ch - q.height))
        info.append({'file': os.path.basename(f), 'size': list(q.size), 'placeX': x, 'headX': round(hx, 1),
                     'before': raw, 'after': q, 'dewhite': st})
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
    out = {'hero': {}, 'plat': {}, 'bg': {'city': {}, 'jungle': {}, 'ice': {}, 'lava': {}, 'aqua': {}}, 'cell': {'w': CW, 'h': ch, 'ax': AX}}
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
            dewhite.append({'file': meta['file'], 'n': st['n'], 'eyes': st['eyes'], 'map': st['map']})
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
    city = out['bg']['city']
    add(city, 'far', rgba(B + 'city/_far_sprite_1x.png'))
    add(city, 'near', rgba(B + 'city/_near_sprite_1x.png'))
    add(city, 'floor', rgba(B + 'city/_floor_sprite_1x.png')); city['floorRow'] = 23
    add(city, 'moon', rgba(B + 'city/_moon_sprite_1x.png'))
    city['cs'] = [uri(rgba(B + 'city/_cloud_small_sprite_1x.png'))]
    city['cb'] = [uri(rgba(B + 'city/_cloud_big_sprite_1x.png'))]
    city['cloudAlpha'] = 0
    jg = out['bg']['jungle']
    add(jg, 'far', rgba(B + 'jungle/_far_sprite_1x.png'))
    add(jg, 'near', rgba(B + 'jungle/_near_sprite_1x.png'))
    fl = rgba(B + 'jungle/15_floor_1x.png'); bb = fl.getbbox()
    add(jg, 'floor', fl.crop((0, bb[1], 160, 346))); jg['floorRow'] = 0
    add(jg, 'sun', rgba(B + 'jungle/_sun_sprite_1x.png'))
    jg['cs'] = [uri(rgba(p)) for p in sorted(glob.glob(B + 'jungle/_cloud_small*_sprite_1x.png'))]
    jg['cb'] = [uri(rgba(p)) for p in sorted(glob.glob(B + 'jungle/_cloud_big*_sprite_1x.png'))]
    jg['cloudAlpha'] = 1

    def pack_horizon(dst, folder, sun=None, floor_row=0, floor_src=None, clouds=True):
        add(dst, 'far', rgba(B + folder + '/_far_sprite_1x.png'))
        add(dst, 'near', rgba(B + folder + '/_near_sprite_1x.png'))
        flp = floor_src or (B + folder + '/15_floor_1x.png')
        fl = rgba(flp)
        bb = fl.getbbox()
        if bb:
            fl = fl.crop((0, bb[1], min(160, fl.width), fl.height))
        add(dst, 'floor', fl)
        dst['floorRow'] = floor_row
        if sun:
            add(dst, 'sun', rgba(B + folder + '/' + sun))
        if clouds:
            dst['cs'] = [uri(rgba(p)) for p in sorted(glob.glob(B + folder + '/_cloud_small*_sprite_1x.png'))]
            dst['cb'] = [uri(rgba(p)) for p in sorted(glob.glob(B + folder + '/_cloud_big*_sprite_1x.png'))]
            dst['cloudAlpha'] = 1

    # aqua: plants stick above the sand; crest is y=279 in the 346 layer (bbox top 265) → floorRow 14
    pack_horizon(out['bg']['aqua'], 'aqua', sun=None, floor_row=14, clouds=False)
    pack_horizon(out['bg']['ice'], 'ice', sun=None, floor_row=0)
    pack_horizon(out['bg']['lava'], 'lava', sun='_sun_sprite_1x.png', floor_row=0)

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
        f.write('HERO_SPRITES.pilot = ART64.hero.pilot; HERO_SPRITES.ninja = ART64.hero.ninja; HERO_SPRITES.robot = ART64.hero.robot;\n')
        f.write('var HERO64: any = { pilot: 1, ninja: 1, robot: 1 };\n')
    print(json.dumps({'cellH': ch, 'changed': report['cleanup']['changed'], 'bytes': len(js),
                      'jungleClouds': [len(jg['cs']), len(jg['cb'])],
                      'bg': {k: list(out['bg'][k].keys()) for k in out['bg']},
                      'sun': [jg['sunW'], jg['sunH']]}))

main()
