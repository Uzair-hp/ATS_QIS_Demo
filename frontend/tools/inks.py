"""Compare specific ink boxes between the target JPG and the render.

Each region is given in target pixel coordinates; the same region is sampled
in the render after scaling. Reports ink bbox + size deltas so text position
and type size can be tuned numerically.
"""
import sys
import numpy as np
from PIL import Image

TARGET = r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"
RENDER = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:\Brightlant-Work\ATS-QIS\frontend\.render\shot12.png"

t = np.asarray(Image.open(TARGET).convert("RGB")).astype(int)
r = np.asarray(Image.open(RENDER).convert("RGB")).astype(int)
TH, TW = t.shape[:2]
RH, RW = r.shape[:2]
SX, SY = RW / TW, RH / TH

# (label, x0, y0, x1, y1, kind)
REGIONS = [
    ("title", 1100, 495, 1700, 560, "blue"),
    ("TO line1", 110, 585, 500, 630, "dark"),
    ("Prakash", 110, 630, 700, 680, "dark"),
    ("Mira road", 110, 660, 700, 720, "dark"),
    ("INVOICENO:-", 1175, 580, 1700, 640, "dark"),
    ("Date:-", 2060, 575, 2400, 620, "dark"),
    ("27/05/2026", 2060, 620, 2400, 680, "dark"),
    ("Voucher no", 1690, 680, 2400, 725, "dark"),
    ("PaymentTerm", 1690, 730, 2400, 782, "dark"),
    ("Delivery L1", 1700, 790, 2400, 845, "dark"),
    ("KOLABA", 1700, 848, 2400, 895, "dark"),
    ("K/A", 150, 908, 900, 962, "dark"),
    ("GSTNO client", 1690, 908, 2400, 962, "dark"),
    ("SR.NO", 150, 960, 400, 1085, "dark"),
    ("Particular hdr", 500, 975, 1150, 1040, "dark"),
    ("HSN hdr", 1175, 965, 1375, 1085, "dark"),
    ("QTY hdr", 1380, 975, 1675, 1040, "dark"),
    ("RATE hdr", 1680, 975, 1945, 1040, "dark"),
    ("logo card", 95, 145, 735, 370, "logo"),
    ("AMOUNT hdr", 1950, 980, 2410, 1030, "dark"),
    ("item1 desc", 405, 1100, 1168, 1390, "dark"),
    ("998719", 1175, 1100, 1375, 1150, "dark"),
    ("53223", 1680, 1100, 1945, 1150, "dark"),
    ("53223/-", 1950, 1100, 2415, 1150, "dark"),
    ("item2 desc", 405, 1398, 1168, 1515, "dark"),
    ("item3 desc", 405, 1524, 1168, 1640, "dark"),
    ("SUBTOTAL", 1905, 1645, 2165, 1705, "dark"),
    ("79557/-/-", 2175, 1645, 2412, 1705, "dark"),
    ("GST@18", 1905, 1712, 2165, 1830, "dark"),
    ("14320/-", 2175, 1712, 2412, 1790, "dark"),
    ("GSTNO comp", 120, 1838, 1660, 1890, "dark"),
    ("company blk", 115, 1897, 1670, 2305, "dark"),
    ("Grand", 1905, 2100, 2165, 2170, "dark"),
    ("Total", 1905, 2175, 2165, 2235, "dark"),
    ("93877/-", 2175, 2100, 2412, 2180, "dark"),
    ("For ATS", 1905, 2320, 2415, 2420, "dark"),
    ("stamp", 1950, 2480, 2340, 2780, "colour"),
    ("Authorized", 1905, 2850, 2415, 2920, "dark"),
    ("Signature", 0, 3095, 400, 3150, "dark"),
    ("Person Name", 0, 3185, 400, 3235, "dark"),
    ("logo ink", 20, 40, 830, 420, "colour"),
    ("footer email", 100, 3450, 600, 3495, "light"),
]


def ink(img, x0, y0, x1, y1, kind):
    sub = img[y0:y1, x0:x1]
    if kind == "blue":
        m = (sub[:, :, 2] - sub[:, :, 0] > 100) & (sub[:, :, 2] > 150)
    elif kind == "dark":
        m = sub.sum(axis=2) < 380
    elif kind == "light":
        m = sub.sum(axis=2) > 640
    else:  # colour = anything clearly not white
        m = sub.sum(axis=2) < 690
    ys, xs = np.where(m)
    if not len(xs):
        return None
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())


print(f"{'region':16}{'target x0,y0,x1,y1':>26}{'render':>26}{'dx0':>7}{'dy0':>7}{'dw':>7}{'dh':>7}")
print("-" * 96)
for label, x0, y0, x1, y1, kind in REGIONS:
    # inset so cell borders are never mistaken for glyph ink
    x0, y0, x1, y1 = x0 + 8, y0 + 8, x1 - 8, y1 - 8
    a = ink(t, x0, y0, x1, y1, kind)
    rx0, ry0 = int(x0 * SX), int(y0 * SY)
    rx1, ry1 = int(x1 * SX), int(y1 * SY)
    b = ink(r, rx0, ry0, rx1, ry1, kind)
    if a is None or b is None:
        print(f"{label:16}{str(a):>26}{str(b):>26}")
        continue
    # express render back in target pixel space
    bx0, by0, bx1, by1 = b[0] / SX, b[1] / SY, b[2] / SX, b[3] / SY
    print(f"{label:16}"
          f"{f'{a[0]},{a[1]},{a[2]},{a[3]}':>26}"
          f"{f'{bx0:.0f},{by0:.0f},{bx1:.0f},{by1:.0f}':>26}"
          f"{bx0 - a[0]:+7.0f}{by0 - a[1]:+7.0f}"
          f"{(bx1 - bx0) - (a[2] - a[0]):+7.0f}{(by1 - by0) - (a[3] - a[1]):+7.0f}")