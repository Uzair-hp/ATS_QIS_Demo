import numpy as np
from PIL import Image
for name, path in [("TARGET", r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"),
                   ("RENDER", r"D:\Brightlant-Work\ATS-QIS\frontend\.render\shot22.png")]:
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    sy = 3513.0/a.shape[0]; sx = 2488.0/a.shape[1]
    print(name)
    for x in (60, 300, 700, 900, 1250, 1600, 1750, 2100, 2450):
        xx = min(int(x*sx), a.shape[1]-1)
        col = a[:, xx]
        # saturated blue: B clearly above R, and not near-white
        m = (col[:,2] - col[:,0] > 45) & (col.sum(axis=1) < 700)
        ys = [yy for yy in range(a.shape[0]) if m[yy]]
        ys = [y for y in ys if y/sy > 3250]
        if ys:
            print(f"   x={x:5}: blue y {round(min(ys)*sy)}..{round(max(ys)*sy)}"
                  f"   h={round((max(ys)-min(ys))*sy)}")
        else:
            print(f"   x={x:5}: no blue")
    # horizontal extents of each box at a row inside the strip
    y = int(3470*sy)
    row = a[y]; lum = row.sum(axis=1)
    m = (row[:,2]-row[:,0] > 45) & (lum < 700)
    runs=[]; st=None
    for x in range(a.shape[1]):
        if m[x] and st is None: st=x
        elif not m[x] and st is not None:
            if x-st>20: runs.append((round(st*sx), round(x*sx)))
            st=None
    if st is not None: runs.append((round(st*sx), round(a.shape[1]*sx)))
    print(f"   y=3470 boxes x: {runs}")

