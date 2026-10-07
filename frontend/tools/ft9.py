import numpy as np
from PIL import Image
for name, path in [("TARGET", r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg"),
                   ("RENDER", r"D:\Brightlant-Work\ATS-QIS\frontend\.render\final.png")]:
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    sy = 3513.0/a.shape[0]; sx = 2488.0/a.shape[1]
    s = a.sum(axis=2)
    for tag,(x0,x1,y0,y1) in {"email":(60,700,3352,3398),
                              "website":(760,1520,3352,3398),
                              "phones":(1600,2460,3300,3345),
                              "address":(1600,2460,3348,3398)}.items():
        yy0,yy1 = int(y0*sy), int(y1*sy)
        reg = s[yy0:yy1, int(x0*sx):int(x1*sx)] > 690
        ys,xs = np.where(reg)
        if not len(xs): print(f"{name} {tag}: none"); continue
        print(f"{name} {tag}: w={round((xs.max()-xs.min()+1)*sx)}px "
              f"h={round((ys.max()-ys.min()+1)*sy)}px  "
              f"x {round(xs.min()*sx+x0*sx)}..{round(xs.max()*sx+x0*sx)} "
              f"y {round(ys.min()*sy+y0*sy)}..{round(ys.max()*sy+y0*sy)}")
