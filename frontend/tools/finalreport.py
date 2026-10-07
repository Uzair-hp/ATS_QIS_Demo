"""Final report: pair each target rule with the nearest render rule and
report the signed delta in mm. Also summarises per-element ink deltas."""
import numpy as np
from PIL import Image

TARGET = r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"
RENDER = r"D:\Brightlant-Work\ATS-QIS\frontend\.render\final.png"
PXMM = 11.845


def load(p):
    im = Image.open(p).convert("RGB")
    return np.asarray(im).astype(int)


def runs(mask):
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i - 1))
            s = None
    if s is not None:
        out.append((s, len(mask) - 1))
    return out


t = load(TARGET)
r = load(RENDER)
TH, TW = t.shape[:2]
RH, RW = r.shape[:2]
sy, sx = RH / TH, RW / TW

td = t.sum(axis=2) < 420
rd = r.sum(axis=2) < 420

th_rules = [s for s, e in runs(np.isin(np.arange(TH), np.where(td.sum(axis=1) > TW * 0.25)[0]))
            if e - s < 30]
rh_rules = [s for s, e in runs(np.isin(np.arange(RH), np.where(rd.sum(axis=1) > RW * 0.25)[0]))
            if e - s < 30]

print(f"{'HORIZONTAL RULES (mm from top)':<44}")
print(f"{'target':>9} {'render':>9} {'delta':>8}")
print("-" * 30)
worst = []
used = set()
for ty in th_rules:
    ty_mm = ty / PXMM
    best, bd = None, 1e9
    for i, ry in enumerate(rh_rules):
        if i in used:
            continue
        d = abs(ry / sy / PXMM - ty_mm)
        if d < bd:
            best, bd = i, d
    if best is None or bd > 2.5:
        print(f"{ty_mm:9.2f} {'(none)':>9}")
        continue
    used.add(best)
    ry_mm = rh_rules[best] / sy / PXMM
    delta = ry_mm - ty_mm
    worst.append((abs(delta), ty_mm, ry_mm, delta))
    print(f"{ty_mm:9.2f} {ry_mm:9.2f} {delta:+8.2f}")
for i, ry in enumerate(rh_rules):
    if i not in used:
        print(f"{'(extra)':>9} {ry / sy / PXMM:9.2f}")

print()
if worst:
    worst.sort(reverse=True)
    print(f"worst horizontal rule delta: {worst[0][3]:+.2f} mm at {worst[0][1]:.1f} mm")
    print(f"mean |delta|: {sum(w[0] for w in worst) / len(worst):.3f} mm")

# columns
print()
print(f"{'VERTICAL RULES (mm from left)':<44}")
print(f"{'band':<14}{'target':>9} {'render':>9} {'delta':>8}")
for y0, y1, name in [(600, 670, "info r1"), (980, 1085, "items hdr"),
                     (1105, 1380, "item row 1"), (1650, 1700, "subtotal"),
                     (2400, 3050, "sig box")]:
    tc = np.where(td[int(y0):int(y1)].sum(axis=0) > (y1 - y0) * 0.7)[0]
    rc = np.where(rd[int(y0 * sy):int(y1 * sy)].sum(axis=0) > (y1 - y0) * 0.7)[0]
    tcols = [s for s, e in runs(np.isin(np.arange(TW), tc)) if e - s < 30]
    rcols = [s for s, e in runs(np.isin(np.arange(RW), rc)) if e - s < 30]
    print(f"  [{name}]")
    for x in tcols:
        x_mm = x / PXMM
        best = min(rcols, key=lambda v: abs(v / sx / PXMM - x_mm)) if rcols else None
        if best is None:
            print(f"    {x_mm:9.2f} {'(none)':>9}")
            continue
        r_mm = best / sx / PXMM
        print(f"    {x_mm:9.2f} {r_mm:9.2f} {r_mm - x_mm:+8.2f}")

# overall ink diff
target_small = Image.open(TARGET).convert("RGB").resize((RW, RH), Image.LANCZOS)
d = np.abs(np.asarray(target_small).astype(int) - r).sum(axis=2)
print()
print(f"pixels differing by >150 (of 765): {100 * (d > 150).mean():.1f}%")
