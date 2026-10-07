"""Solve for the target font sizes.

The target's ink extents were measured from the JPG. Here the same strings
are rendered with PIL using the real Windows Calibri / Cambria files and the
ink width is measured the same way, so the font size that reproduces the
target width can be read directly off.
"""
from PIL import Image, ImageDraw, ImageFont

PX_PER_PT = 300 / 72.0  # target was measured at 300 dpi

SANS_BOLD = r"C:\Windows\Fonts\calibrib.ttf"
SERIF_BOLD = r"C:\Windows\Fonts\cambriab.ttf"

SAMPLES = [
    # (label, font file, string, target ink width in target px)
    ("Prakash Pituha", SANS_BOLD, "Prakash Pituha", 416 - 134),
    ("Mira road", SANS_BOLD, "Mira road", None),
    ("Voucher no", SANS_BOLD, "Voucher no", 1988 - 1766),
    ("PaymentTerm", SANS_BOLD, "PaymentTerm:100%  Advance", 2324 - 1769),
    ("Delivery line1", SANS_BOLD, "Delivery :- NAVAL DOCKYARD", 2302 - 1727),
    ("Date value", SANS_BOLD, "27/05/2026", 2363 - 2131),
    ("Particular hdr", SANS_BOLD, "Particular", 904 - 702),
    ("AMOUNT hdr", SANS_BOLD, "AMOUNT", 2336 - 2129),
    ("QTY. hdr", SANS_BOLD, "QTY.", 1621 - 1529),
    ("RATE hdr", SANS_BOLD, "RATE", 1908 - 1807),
    ("item1 L1", SANS_BOLD, "Garage Door Size: Length", 1127 - 432),
    ("item1 L2", SANS_BOLD, "5330mm, Height 2580mm.", 1066 - 432),
    ("item1 L3", SANS_BOLD, "Model SN6041 Motor For", 1129 - 434),
    ("item1 L4", SANS_BOLD, "Garage Door", 728 - 432),
    ("item2 L1", SANS_BOLD, "SNA6 preassembled guide 4m", 1096 - 406),
    ("item2 L2", SANS_BOLD, "(3+1m)", 573 - 408),
    ("item3 L1", SANS_BOLD, "Installation Charges", 862 - 409),
    ("CompanyName", SANS_BOLD, "CompanyName-ATS AUTOMATION.", 918 - 144),
    ("Bank Details", SANS_BOLD, "Bank Details: HDFC BANK.", 736 - 143),
    ("Branch", SANS_BOLD, "Branch: KANDIVALI (E)", 671 - 143),
    ("AC No", SANS_BOLD, "A/C No.:50200097301710", 723 - 141),
    ("IFSC", SANS_BOLD, "IFSC Code: HDFC0000182.", 723 - 143),
    ("MSME", SANS_BOLD, "MSME:UDYAM-MH-170148612", 763 - 143),
    ("For ATS", SANS_BOLD, "For ATS AUTOMATION", 2406 - 1935),
    ("Authorized", SANS_BOLD, "Authorized Signatory", 2403 - 1954),
    ("Signature", SANS_BOLD, "Signature", 164 - 19),
    ("Person Name", SANS_BOLD, "Person Name:", 228 - 22),
    ("K/A", SANS_BOLD, "K/A: MR. Prakash", 495 - 185),
    ("Grand", SANS_BOLD, "Grand", 2095 - 1983),
    ("Total", SANS_BOLD, "Total", 2086 - 1981),
    ("GST@18", SANS_BOLD, "GST@18", 2097 - 1930),
    ("GSTNO-client", SANS_BOLD, "27AAZCS9860N1ZY", 2280 - 1820),
    ("INVOICENO:-", SERIF_BOLD, "INVOICENO:-", 1497 - 1181),
    ("998719", SERIF_BOLD, "998719", 1344 - 1216),
    ("53223", SERIF_BOLD, "53223", 1883 - 1780),
    ("19334/-", SERIF_BOLD, "19334/-", 2254 - 2125),
    ("79557/-/-", SERIF_BOLD, "79557/-/-", 2391 - 2196),
    ("14320/-", SERIF_BOLD, "14320/-", 2376 - 2220),
    ("93877/-", SERIF_BOLD, "93877/-", 2373 - 2215),
    ("7000", SERIF_BOLD, "7000", 1864 - 1780),
    ("GSTNO-cond", SERIF_BOLD, "GSTNO-27BTHPT0851K1Z9", 760 - 215),
]


def ink_width(font_path, text, pt):
    px = max(int(round(pt * PX_PER_PT * 4)), 40)
    font = ImageFont.truetype(font_path, px)
    img = Image.new("L", (px * len(text) + 200, px * 3), 255)
    d = ImageDraw.Draw(img)
    d.text((100, px), text, font=font, fill=0)
    bbox = img.point(lambda v: 255 if v < 200 else 0).getbbox()
    if bbox is None:
        return None
    return (bbox[2] - bbox[0]) / 4.0


print(f"{'sample':22} {'target px':>10} {'best pt':>8} {'err%':>7}")
print("-" * 52)
groups = {}
for label, path, text, target in SAMPLES:
    if target is None:
        continue
    best, besterr = None, 1e9
    for pt10 in range(60, 260):
        pt = pt10 / 10
        w = ink_width(path, text, pt)
        if w is None:
            continue
        err = abs(w - target) / target
        if err < besterr:
            best, besterr = pt, err
    fam = "serif" if "cambria" in path.lower() else "sans "
    groups.setdefault((fam, round(best, 1)), []).append((label, target))
    print(f"{label:22} {target:10} {best:8.1f} {besterr * 100:6.1f}%  {fam}")

print()
print("summary of fitted sizes:")
for (fam, pt), items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    print(f"  {fam} {pt:5.1f} pt  <- {len(items)} samples: {', '.join(i[0] for i in items)}")
