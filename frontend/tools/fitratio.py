"""Identify typefaces by ink aspect ratio (size-independent), then size them."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PXPT = 300 / 72.0
FONTS = {
    "Calibri Bold": r"C:\Windows\Fonts\calibrib.ttf",
    "Cambria Bold": r"C:\Windows\Fonts\cambriab.ttf",
    "Constantia Bold": r"C:\Windows\Fonts\constanb.ttf",
    "Georgia Bold": r"C:\Windows\Fonts\georgiab.ttf",
    "Times Bold": r"C:\Windows\Fonts\timesbd.ttf",
    "Arial Bold": r"C:\Windows\Fonts\arialbd.ttf",
    "Arial Black": r"C:\Windows\Fonts\ariblk.ttf",
    "Arial Narrow Bold": r"C:\Windows\Fonts\ARIALNB.TTF",
    "Franklin Gothic Medium": r"C:\Windows\Fonts\framd.ttf",
    "Franklin Gothic Demi": r"C:\Windows\Fonts\FRADM.TTF",
    "Franklin Gothic Heavy": r"C:\Windows\Fonts\FRAHVIT.TTF",
    "Trebuchet Bold": r"C:\Windows\Fonts\trebucbd.ttf",
    "Tahoma Bold": r"C:\Windows\Fonts\tahomabd.ttf",
    "Verdana Bold": r"C:\Windows\Fonts\verdanab.ttf",
    "Segoe UI Bold": r"C:\Windows\Fonts\segoeuib.ttf",
    "Impact": r"C:\Windows\Fonts\impact.ttf",
    "Tw Cen MT Cond Bold": r"C:\Windows\Fonts\TCBI____.TTF",
}
FONTS = {k: v for k, v in FONTS.items() if os.path.exists(v)}

_cache = {}


def box(fp, text, px):
    key = (fp, text)
    if key not in _cache:
        f = ImageFont.truetype(fp, 200)
        im = Image.new("L", (200 * len(text) + 400, 700), 255)
        ImageDraw.Draw(im).text((200, 250), text, font=f, fill=0)
        _cache[key] = im.point(lambda v: 255 if v < 200 else 0).getbbox()
    b = _cache[key]
    w = (b[2] - b[0]) / 200.0
    h = (b[3] - b[1]) / 200.0
    return w, h


CASES = [
    ("title", "GARAGE DOOR", 1637 - 1148, 547 - 502),
    ("INVOICENO:-", "INVOICENO:-", 1497 - 1181, 626 - 592),
    ("itemnum 998719", "998719", 1344 - 1216, 1138 - 1108),
    ("itemamt 19334/-", "19334/-", 2254 - 2125, 1139 - 1106),
    ("subtotal 79557", "79557/-/-", 2391 - 2196, 1698 - 1656),
    ("gst 14320", "14320/-", 2376 - 2220, 1767 - 1725),
    ("grand 93877", "93877/-", 2373 - 2215, 2158 - 2116),
    ("Signature", "Signature", 164 - 19, 3138 - 3101),
    ("PersonName", "Person Name:", 228 - 22, 3223 - 3193),
    ("Particular", "Particular", 904 - 702, 1020 - 986),
    ("Prakash", "Prakash Pituha", 416 - 134, 676 - 644),
    ("Installation", "Installation Charges", 862 - 409, 1577 - 1527),
    ("BankDetails", "Bank Details: HDFC BANK.", 736 - 143, 1989 - 1955),
    ("CompanyName", "CompanyName-ATS AUTOMATION.", 918 - 144, 1946 - 1902),
    ("Authorized", "Authorized Signatory", 2403 - 1954, 2905 - 2863),
    ("ForATS", "For ATS AUTOMATION", 2406 - 1935, 2406 - 2373),
    ("SNA6", "SNA6 preassembled guide 4m", 1096 - 406, 1452 - 1402),
]

for label, text, tw, th in CASES:
    tr = tw / th
    rows = []
    for name, fp in FONTS.items():
        w, h = box(fp, text, 200)
        if h <= 0:
            continue
        r = w / h
        # pt implied if this face's height matched the target height
        pt = th / h * (200.0 / PXPT)
        rows.append((abs(r - tr) / tr, name, r, pt))
    rows.sort()
    top = "  ".join(f"{n} r={r:.2f} ~{pt:.1f}pt e={e*100:.0f}%"
                    for e, n, r, pt in rows[:3])
    print(f"{label:16} target r={tr:5.2f}  {top}")