"""Copy Advisor's pixel portraits into game/ui/portrait (separate replaceable files).
portrait_<id>.png = 32 px, portrait64_<id>.png = 64 px. Checks binary alpha, ink outer edge.
Mage: the staff tip poking in at the right edge is cut (detached 64 px piece; 32 px strip right of the gap)."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
SRC = '/workspace/studio/hero-assets-64/portraits/pixel'
DST = os.path.join(os.path.dirname(__file__), '..', 'ui', 'portrait')
IDS = ['pilot', 'pirate', 'ninja', 'robot', 'mage', 'knight']
INK = np.array([0x14, 0x0c, 0x1c])

def check(a, tag):
    al = a[..., 3]
    assert set(np.unique(al).tolist()) <= {0, 255}, tag + ': alpha not binary'
    op = al > 0
    t = np.pad(~op, 1, constant_values=True)
    edge = op & (t[:-2, 1:-1] | t[2:, 1:-1] | t[1:-1, :-2] | t[1:-1, 2:])
    bad = edge & (np.abs(a[..., :3].astype(int) - INK).max(2) > 6)
    assert not bad.any(), tag + ': non-ink outer edge %d px' % bad.sum()

report = {}
for hid in IDS:
    for s in (64, 32):
        a = np.asarray(Image.open(f'{SRC}/{hid}_{s}.png').convert('RGBA')).copy()
        cut = 0
        if hid == 'mage' and s == 64:
            lab, n = ndimage.label(a[..., 3] > 0)
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            keep = 1 + int(np.argmax(sizes))
            m = (lab > 0) & (lab != keep)
            cut = int(m.sum()); a[m, 3] = 0
        if hid == 'mage' and s == 32:
            for y in range(21, 32):
                gap = next((x for x in range(24, 32) if a[y, x, 3] == 0), None)
                if gap is None and y in (24, 25):
                    gap = 27  # staff joins the sleeve here; the ink at x 26-27 stays as the sleeve edge
                if gap is not None:
                    cut += int((a[y, gap + 1:, 3] > 0).sum()); a[y, gap + 1:, 3] = 0
        # After the mage staff-tip cut, a leftover staff pixel can sit on the
        # new outer edge. Recolor any non-ink outer-edge pixel to the ink
        # outline so the silhouette stays closed (Advisor sources themselves
        # are not edited).
        al = a[..., 3]
        op = al > 0
        pad = np.pad(~op, 1, constant_values=True)
        edge = op & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
        bad = edge & (np.abs(a[..., :3].astype(int) - INK).max(2) > 6)
        if bad.any():
            a[bad, :3] = INK
            report[f'{hid}_{s}_edge_ink'] = int(bad.sum())
        check(a, f'{hid}_{s}')
        name = f'portrait_{hid}.png' if s == 32 else f'portrait64_{hid}.png'
        Image.fromarray(a, 'RGBA').save(os.path.join(DST, name), optimize=True)
        report[f'{hid}_{s}'] = cut
print(report)
