from PIL import Image
t = Image.open(r"D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg").convert("RGB")
r = Image.open(r"D:\Brightlant-Work\ATS-QIS\frontend\.render\shot20.png").convert("RGB").resize(t.size, Image.LANCZOS)
for tag,(y0,y1) in {"A":(0,1700), "B":(1700,3513)}.items():
    h = y1-y0
    s = Image.new("RGB",(t.width, h*2+12),(255,0,255))
    s.paste(t.crop((0,y0,t.width,y1)),(0,0))
    s.paste(r.crop((0,y0,t.width,y1)),(0,h+12))
    s.resize((s.width//2, s.height//2), Image.LANCZOS).save(rf"D:\Brightlant-Work\ATS-QIS\frontend\.render\pair_{tag}.png")
print("ok")
