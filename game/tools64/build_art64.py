#!/usr/bin/env python3
"""Wave 1 of the 64 px art (Hoppak v1.0): packs studio assets into game/src/01b_art64.tsx.

Heroes (pilot = Капитан, ninja, robot): rebuilt from the GPT originals in /workspace/studio/hero-assets-64/anim
with the studio's own pipeline (bg mask, nearest downscale, 32-colour quantize), but at the PARITY height
46 art px (the studio *_64.png frames are 64 px of visible hero = 41 % bigger than today; Producer asked for ~46).
Cell 72x64 art px = 36x32 game px (same cell as the old 54x48 sheet), feet on the bottom row, head centre at x=32.
Poses: idle, squash, up, fall, ability, ko, blink (engine order).
Platforms, spring, coin: studio 1x PNGs as is (1 art px = 0.5 game px).
Backgrounds city/jungle: studio 1x layers (1 px = 1 game px = 2 art px; no 320-grid version exists yet).
"""
import base64, glob, io, json, os, sys
import numpy as np
from PIL import Image

STUDIO = '/workspace/studio'
ANIM = STUDIO + '/hero-assets-64/anim'
A64 = STUDIO + '/assets-64'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', '01b_art64.tsx')
VIS = 46          # visible hero height, art px
CW, CH, AX = 72, 64, 32

def load(p):
    im = Image.open(p).convert('RGB'); a = np.asarray(im).astype(int)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); bg = np.median(edge, axis=0)
    m = np.abs(a - bg).sum(2) > 40; ys, xs = np.where(m)
    return im, m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

def frame(path, s):
    im, m, (x0, y0, x1, y1) = load(path)
    w = max(1, round((x1 - x0) * s)); h = max(1, round((y1 - y0) * s))
    rgb = im.crop((x0, y0, x1, y1)).resize((w, h), Image.NEAREST)
    al = Image.fromarray((m[y0:y1, x0:x1] * 255).astype('uint8')).resize((w, h), Image.NEAREST)
    q = rgb.quantize(32).convert('RGBA'); q.putalpha(al)
    return q

def ko(q):
    a = np.asarray(q).astype(float)
    g = a[..., :3].mean(2, keepdims=True)
    a[..., :3] = (a[..., :3] * 0.35 + g * 0.65) * 0.62
    return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')

def head_x(q):
    a = np.asarray(q)[..., 3] > 0
    top = a[: max(4, q.height // 4)]
    ys, xs = np.where(top)
    return (xs.min() + xs.max() + 1) / 2.0

HEROES = {
    # pose order: idle, squash, up, fall, ability, ko(source), blink
    'pilot': ('pilot/pilot_base.png', ['pilot/frame_01.png', 'pilot/rest/land.png', 'pilot/frame_11.png', 'pilot/rest/fall.png',
                                        'pilot/rest/dash_fly.png', 'pilot/rest/fall_start.png', 'pilot/frame_02.png']),
    'ninja': ('ninja/ninja_base.png', ['ninja/idle1.png', 'ninja/land.png', 'ninja/rise.png', 'ninja/fall.png',
                                        'ninja/push.png', 'ninja/fall_start.png', 'ninja/idle2.png']),
    'robot': ('robot/robot_base.png', ['robot/idle1.png', 'robot/land.png', 'robot/rise.png', 'robot/fall.png',
                                        'robot/dome_full.png', 'robot/fall_start.png', 'robot/idle2.png']),
}

def hero_sheet(base, files):
    _, _, b = load(os.path.join(ANIM, base)); s = VIS / (b[3] - b[1])
    sheet = Image.new('RGBA', (CW * 7, CH), (0, 0, 0, 0))
    info = []
    for i, f in enumerate(files):
        q = frame(os.path.join(ANIM, f), s)
        if i == 5: q = ko(q)
        if q.height > CH: q = q.crop((0, q.height - CH, q.width, q.height))
        hx = head_x(q)
        x = int(round(AX - hx)); x = max(0, min(CW - q.width, x))
        sheet.alpha_composite(q, (i * CW + x, CH - q.height))
        info.append((os.path.basename(f), q.size))
    return sheet, info

def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def rgba(p): return Image.open(p).convert('RGBA')

def bottom_fill(im):
    a = np.asarray(im); row = a[-1]; op = row[row[:, 3] > 0]
    if not len(op): return '#000000'
    vals, cnt = np.unique(op[:, :3], axis=0, return_counts=True); c = vals[cnt.argmax()]
    return '#%02x%02x%02x' % tuple(int(v) for v in c)

def add(d, k, im):
    d[k] = uri(im); d[k + 'W'] = im.width; d[k + 'H'] = im.height; d[k + 'Fill'] = bottom_fill(im)

def main():
    out = {'hero': {}, 'plat': {}, 'bg': {'city': {}, 'jungle': {}}}
    report = {}
    for hid, (base, files) in HEROES.items():
        sh, info = hero_sheet(base, files)
        out['hero'][hid] = uri(sh); report[hid] = info
        sh.resize((sh.width * 4, sh.height * 4), Image.NEAREST).save('/tmp/art64_%s_x4.png' % hid)
    land = {'break': 2, 'bounce': 2, 'cloud': 7}
    for p in sorted(glob.glob(A64 + '/platforms/*_1x.png')):
        n = os.path.basename(p)[:-7]
        if n in ('break_1x_v1', 'break_1x_v2', 'spring_gpt_cut') or n.endswith('_v1') or n.endswith('_v2'): continue
        im = rgba(p)
        out['plat'][n] = {'src': uri(im), 'w': im.width, 'h': im.height, 'land': land.get(n, 1)}
    c = rgba(A64 + '/coin/coin_strip_1x.png')
    out['coin'] = {'src': uri(c), 'n': 8, 'cw': c.width // 8, 'ch': c.height}
    B = A64 + '/bg/'
    city = out['bg']['city']
    add(city, 'far', rgba(B + 'city/_far_sprite_1x.png'))
    add(city, 'near', rgba(B + 'city/_near_sprite_1x.png'))
    add(city, 'floor', rgba(B + 'city/_floor_sprite_1x.png')); city['floorRow'] = 23
    add(city, 'moon', rgba(B + 'city/_moon_sprite_1x.png'))
    city['cs'] = [uri(rgba(B + 'city/_cloud_small_sprite_1x.png'))]
    city['cb'] = [uri(rgba(B + 'city/_cloud_big_sprite_1x.png'))]
    city['cloudAlpha'] = 0  # 0 = keep the engine alpha
    jg = out['bg']['jungle']
    add(jg, 'far', rgba(B + 'jungle/_far_sprite_1x.png'))
    add(jg, 'near', rgba(B + 'jungle/_near_sprite_1x.png'))
    fl = rgba(B + 'jungle/15_floor_1x.png'); bb = fl.getbbox()
    add(jg, 'floor', fl.crop((0, bb[1], 160, 346))); jg['floorRow'] = 0
    add(jg, 'sun', rgba(B + 'jungle/_sun_sprite_1x.png'))
    jg['cs'] = [uri(rgba(p)) for p in sorted(glob.glob(B + 'jungle/_cloud_small*_sprite_1x.png'))]
    jg['cb'] = [uri(rgba(p)) for p in sorted(glob.glob(B + 'jungle/_cloud_big*_sprite_1x.png'))]
    jg['cloudAlpha'] = 1  # README: opaque clouds in the jungle
    js = json.dumps(out, separators=(',', ':'))
    with open(OUT, 'w') as f:
        f.write('/* v1.0 wave 1: 64 px art, generated by game/tools64/build_art64.py from /workspace/studio. Do not edit. */\n')
        f.write('var ART64: any = ' + js + ';\n')
        f.write('HERO_SPRITES.pilot = ART64.hero.pilot; HERO_SPRITES.ninja = ART64.hero.ninja; HERO_SPRITES.robot = ART64.hero.robot;\n')
        f.write('var HERO64: any = { pilot: 1, ninja: 1, robot: 1 };\n')
    print(json.dumps(report), 'jungle clouds', len(jg['cs']), len(jg['cb']), 'bytes', len(js))

main()
