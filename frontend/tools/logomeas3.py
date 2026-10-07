import numpy as np
from PIL import Image
for name, path in [("TARGET", r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"),
                   ("RENDER", r"D:\Brightlant-Work\ATS-QIS\frontend\.render\shot14.png")]:
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    x0,y0,x1,y1 = 95,145,735,370
    sub = a[y0:y1, x0:x1]
    ink = sub.sum(axis=2) < 620
    ys, xs = np.where(ink)
    X0,X1,Y0,Y1 = xs.min()+x0, xs.max()+x0, ys.min()+y0, ys.max()+y0
    print(f"{name}: ink x {X0}..{X1} y {Y0}..{Y1}  w={X1-X0+1} h={Y1-Y0+1}")
    b = sub[:,:,2] - sub[:,:,0]
    m = (b > 45) & ink
    ys, xs = np.where(m)
    print(f"        blue x {xs.min()+x0}..{xs.max()+x0} y {ys.min()+y0}..{ys.max()+y0}")
    # card bounds from pure white rows
    s = a.sum(axis=2)
    row = s[250, 0:900]
    wx = [x for x in range(900) if row[x] > 730]
    col = s[0:430, 200]
    wy = [y for y in range(430) if col[y] > 730]
    print(f"        card row250 white x {min(wx)}..{max(wx)}   col200 white y {min(wy)}..{max(wy)}")
