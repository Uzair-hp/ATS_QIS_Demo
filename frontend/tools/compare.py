"""Compare the rendered sheet against FORTIS HOSPITAL_page-0001.jpg.

Reports, for both images:
  * horizontal rule positions (mm from page top)
  * vertical rule positions (mm from page left)
plus a side-by-side image and a red/blue difference overlay.
"""
import sys
import numpy as np
from PIL import Image

TARGET = r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"
RENDER = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:\Brightlant-Work\ATS-QIS\frontend\.render\shot01.png"
OUT = r"D:\Brightlant-Work\ATS-QIS\frontend\.render"
PXMM = 11.845


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


def analyse(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    dark = a.sum(axis=2) < 420

    hrows = dark.sum(axis=1)
    hlines = [s for s, e in runs(np.isin(np.arange(H), np.where(hrows > W * 0.25)[0]))
              if e - s < 30]

    # verticals are only trustworthy in text-free bands
    vinfo = []
    for y0, y1, name in [(600, 670, "info r1"), (980, 1085, "items hdr"),
                         (1105, 1380, "item row 1"), (1650, 1700, "subtotal"),
                         (2400, 3050, "sig box")]:
        band = dark[y0:y1]
        cols = np.where(band.sum(axis=0) > (y1 - y0) * 0.7)[0]
        vinfo.append((name, [s for s, e in runs(np.isin(np.arange(W), cols)) if e - s < 30]))
    return a, W, H, hlines, vinfo


ta, TW, TH, th, tv = analyse(TARGET)
ra, RW, RH, rh, rv = analyse(RENDER)

print(f"target {TW}x{TH}   render {RW}x{RH}   ({TW/TH:.4f} vs {RW/RH:.4f} aspect)")
print()


def merge(a, b, sa, sb, tol=1.4):
    """sa/sb convert each image's px into the target image's px space."""
    out, i, j = [], 0, 0
    while i < len(a) or j < len(b):
        va = a[i] / sa if i < len(a) else None
        vb = b[j] / sb if j < len(b) else None
        if va is None or (vb is not None and vb < va - tol):
            out.append((None, vb)); j += 1
        elif vb is None or (va is not None and va < vb - tol):
            out.append((va, None)); i += 1
        else:
            out.append((va, vb)); i += 1; j += 1
    return out


print("HORIZONTAL RULES  (mm from page top)")
sa, sb = TH / 3513.0, RH / 3513.0
for va, vb in merge(th, rh, sa, sb):
    ma, mb = (va / PXMM if va is not None else None,
              vb / PXMM if vb is not None else None)
    ta_ = f"{ma:9.2f}" if ma is not None else "        -"
    tb_ = f"{mb:9.2f}" if mb is not None else "        -"
    d = f"{mb - ma:+8.2f}" if (ma is not None and mb is not None) else "       -"
    flag = "   <<<" if (ma is not None and mb is not None and abs(mb - ma) > 0.7) else ""
    print(f"{ta_} {tb_} {d}{flag}")

print()
print("VERTICAL RULES  (mm from page left)")
sa, sb = TW / 2488.0, RW / 2488.0
for name, cols in tv:
    rcols = dict(rv).get(name, [])
    print(f"  [{name}]")
    for va, vb in merge(cols, rcols, sa, sb, tol=2.4):
        ma, mb = (va / PXMM if va is not None else None,
                  vb / PXMM if vb is not None else None)
        ta_ = f"{ma:8.2f}" if ma is not None else "       -"
        tb_ = f"{mb:8.2f}" if mb is not None else "       -"
        d = f"{mb - ma:+8.2f}" if (ma is not None and mb is not None) else "       -"
        flag = "   <<<" if (ma is not None and mb is not None and abs(mb - ma) > 0.6) else ""
        print(f"    {ta_} {tb_} {d}{flag}")

# ---- visual artefacts -------------------------------------------------
target = Image.open(TARGET).convert("RGB").resize((RW, RH), Image.LANCZOS)
sbs = Image.new("RGB", (RW * 2 + 20, RH), (255, 0, 255))
sbs.paste(target, (0, 0))
sbs.paste(Image.fromarray(ra.astype("uint8")), (RW + 20, 0))
sbs.resize((sbs.width // 2, sbs.height // 2), Image.LANCZOS).save(OUT + r"\side_by_side.png")

ta2 = np.asarray(target).astype(int)
diff = np.abs(ta2 - ra).sum(axis=2)
mask = diff > 150
ov = np.full((RH, RW, 3), 255, dtype=np.uint8)
ov[..., 0] = np.where(mask, 220, 255)
ov[..., 1] = np.where(mask, np.clip(255 - ra.mean(axis=2) * 0.6, 0, 255), 255)
ov[..., 2] = np.where(mask, np.clip(255 - ra.mean(axis=2) * 0.6, 0, 255), 255)
Image.fromarray(ov).save(OUT + r"\diff_overlay.png")
print()
print(f"differing pixels: {mask.sum()} / {mask.size} ({mask.mean() * 100:.1f}%)")
print("wrote side_by_side.png and diff_overlay.png")