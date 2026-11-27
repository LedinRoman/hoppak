#!/usr/bin/env python3
"""v1.0 64 px art packer: studio assets → game/src/01b_art64.tsx.

Heroes (pilot = Капитан, ninja, robot): the studio's native *_64.png frames, copied 1:1
with no resize. Cell is 72 art px wide (36 game px, same as the engine SPR_CW) and tall
enough for the tallest used frame; feet on the bottom row, head centre at x=32 (SPR_AX*2).
Poses: idle, squash, up, fall, ability, ko, blink (engine order).
Stray near-white sparkle on platforms/springs is mapped to the sprite's own palette
(ice and cloud stay white — they are white objects). Hero frames have no true-white
sparkle; intentional lights are listed in the cleanup report.
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

def hero_sheet(hid, files, ch):
    sheet = Image.new('RGBA', (CW * 7, ch), (0, 0, 0, 0))
    info = []
    for i, f in enumerate(files):
        q = rgba(os.path.join(ANIM, hid, f))
        if i == 5:
            q = ko(q)
        if q.height > ch:
            q = q.crop((0, q.height - ch, q.width, q.height))
        hx = head_x(q)
        x = int(round(AX - hx))
        x = max(0, min(CW - q.width, x))
        sheet.alpha_composite(q, (i * CW + x, ch - q.height))
        info.append({'file': os.path.basename(f), 'size': list(q.size), 'placeX': x, 'headX': round(hx, 1)})
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
    out = {'hero': {}, 'plat': {}, 'bg': {'city': {}, 'jungle': {}}, 'cell': {'w': CW, 'h': ch, 'ax': AX}}
    report = {'cellH': ch, 'heroes': {}, 'cleanup': {'changed': [], 'kept_platform_white': [], 'kept_hero_lights': []}}
    all_changes = []

    for hid, files in HEROES.items():
        sh, info = hero_sheet(hid, files, ch)
        # heroes: record intentional light pixels, do not rewrite (no true-white sparkle)
        a = np.asarray(sh)
        kept_hero = []
        # eye-ish / blade / shirt: minRGB>=200 clusters — listed, not removed
        for i, meta in enumerate(info):
            x0 = i * CW
            cell = a[:, x0:x0 + CW]
            ys, xs = np.where((cell[..., 3] >= 16) & (cell[..., 0] >= 200) & (cell[..., 1] >= 200) & (cell[..., 2] >= 200))
            if len(xs):
                cols = {}
                for y, x in zip(ys, xs):
                    t = tuple(int(v) for v in cell[y, x, :3])
                    cols[t] = cols.get(t, 0) + 1
                kept_hero.append({'hero': hid, 'pose': meta['file'], 'n': int(len(xs)), 'colors': {str(k): v for k, v in cols.items()}})
        report['heroes'][hid] = info
        report['cleanup']['kept_hero_lights'] += kept_hero
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
                      'sun': [jg['sunW'], jg['sunH']]}))

main()
