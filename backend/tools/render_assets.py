"""Renders the decorative assets used by the server-side PDF templates.

xhtml2pdf cannot draw them: inline ``<svg>`` elements and ``<img>`` elements
pointing at ``data:image/svg+xml`` are both silently dropped (verified against
xhtml2pdf 0.2.21 / reportlab 5.0.1 / svglib 2.2.0 with renderPM absent), and
CSS ``linear-gradient`` is ignored. PNGs embedded as base64 do render.

So the swoosh, the footer strip and the watermark are pre-rendered here at
300 dpi and embedded as PNGs. Every coordinate and colour here is the same
value the browser print sheet uses in frontend/src/lib/geometry.js and
frontend/src/styles/print.css - the two pipelines are meant to look alike.

Regenerate with::

    python -m tools.render_assets

Output: backend/static/img/{swoosh,footer,watermark}.png
"""

import math
import os

from PIL import Image, ImageDraw

# 300 dpi, same as the FORTIS reference was measured at.
DPI = 300
MM = DPI / 25.4  # pixels per millimetre

# Fractions of the PNG width, copied from geometry.js / print.css.
# The browser sheet adds a third wedge below the band at the far left
# ([(0,326),(128,300),(0,408)] in Header.jsx). It reaches y=408 in a viewBox
# that is only 340 tall, so it is clipped to a sliver in both pipelines and
# reads as a white notch in the PDF. It is left out of the PNG deliberately.
BANNER_POLYGONS = [
    # (points in a 2100 x 340 viewBox, fill)
    ([(0, 0), (2100, 0), (2100, 46), (0, 294)], 'bannerNavy'),
    ([(0, 294), (2100, 46), (2100, 124), (0, 326)], 'bannerLight'),
]

# Exact values from frontend/src/styles/print.css, so the two print pipelines
# render the same colours.
COLORS = {
    'bannerNavy': (21, 87, 143),    # #15578F
    'bannerNavy2': (29, 110, 166),  # #1D6EA6
    'bannerLight': (54, 153, 208),  # #3699D0
    'footerBandTop': (27, 124, 187),   # #1b7cbb
    'footerBandBottom': (21, 88, 143),  # #15588f
    'footerBox': (42, 166, 220),       # #2aa6dc
    'footerCTop': (30, 123, 181),      # #1e7bb5
    'footerCBottom': (22, 94, 144),    # #165e90
    'footerRule': (63, 155, 218),      # #3f9bda
}

PAGE_W_MM = 210
BANNER_H_MM = 34.4      # print.css: .qp-banner-art height
FOOTER_H_MM = 14.16     # print.css: .qp-footer height
FOOTER_PAD_TOP_MM = 3.3  # box C sits at top:-3.3mm; pad so it is not clipped
WATERMARK_H_MM = 152    # print.css: .qp-watermark height
WATERMARK_ALPHA = 0.038  # print.css: opacity


def _lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def _vertical_gradient(size, top, bottom):
    """A 1 x H gradient strip, later resized to full width."""
    w, h = size
    strip = Image.new('RGB', (1, h))
    px = strip.load()
    for y in range(h):
        px[0, y] = _lerp(top, bottom, y / max(h - 1, 1))
    return strip.resize((w, h), Image.BILINEAR)


def _horizontal_gradient(size, left, right):
    w, h = size
    strip = Image.new('RGB', (w, 1))
    px = strip.load()
    for x in range(w):
        px[x, 0] = _lerp(left, right, x / max(w - 1, 1))
    return strip.resize((w, h), Image.BILINEAR)


def render_swoosh():
    """The navy header field with its light diagonal band."""
    w = round(PAGE_W_MM * MM)
    h = round(BANNER_H_MM * MM)
    img = Image.new('RGB', (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # The navy field is a gradient in the browser sheet; approximate it with a
    # left-to-right ramp between the two sampled navies.
    field = _horizontal_gradient((w, h), COLORS['bannerNavy'], COLORS['bannerNavy2'])
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).polygon(
        [(x * w / 2100, y * h / 340) for x, y in BANNER_POLYGONS[0][0]], fill=255,
    )
    img.paste(field, (0, 0), mask)

    for points, colour in BANNER_POLYGONS[1:]:
        draw.polygon([(x * w / 2100, y * h / 340) for x, y in points],
                     fill=COLORS[colour])

    return img


def render_footer():
    """Three overlapping rounded boxes on a gradient, plus the bottom rule.

    Geometry from print.css: box A at x 0 / 60.36mm wide, box B at 62.14mm /
    67.54mm, box C at 132.13mm / 77.33mm and taller; a full-width band starts
    5.83mm down and runs 8.44mm; a bright rule sits on the bottom edge. Box C is
    3.3mm taller than its band and sits at top:-3.3mm in the browser sheet, so
    the PNG carries a matching top pad and is cropped to it when placed.
    """
    pad = round(FOOTER_PAD_TOP_MM * MM)
    w = round(PAGE_W_MM * MM)
    h = round(FOOTER_H_MM * MM)
    img = Image.new('RGBA', (w, h + pad), (0, 0, 0, 0))

    def mm_box(left_mm, top_mm, width_mm, height_mm):
        return (
            round(left_mm * MM), pad + round(top_mm * MM),
            round((left_mm + width_mm) * MM), pad + round((top_mm + height_mm) * MM),
        )

    # Full-width band, gradient top-to-bottom.
    band = mm_box(0, 5.83, PAGE_W_MM, 5.83 + 8.44)
    grad = _vertical_gradient((band[2] - band[0], band[3] - band[1]),
                              COLORS['footerBandTop'], COLORS['footerBandBottom'])
    img.paste(grad, (band[0], band[1]))

    # Boxes A and B sit above the band; C overlaps them and rises past its top.
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(list(mm_box(0, 0, 60.36, 5.74)),
                           radius=round(1.6 * MM), fill=COLORS['footerBox'] + (255,))
    draw.rounded_rectangle(list(mm_box(62.14, 0, 62.14 + 67.54, 5.74)),
                           radius=round(1.6 * MM), fill=COLORS['footerBox'] + (255,))

    cbox = mm_box(132.13, -3.3, 132.13 + 77.33, -3.3 + 9.03)
    cgrad = _vertical_gradient((cbox[2] - cbox[0], cbox[3] - cbox[1]),
                               COLORS['footerCTop'], COLORS['footerCBottom'])
    mask = Image.new('L', (cbox[2] - cbox[0], cbox[3] - cbox[1]), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, cbox[2] - cbox[0] - 1, cbox[3] - cbox[1] - 1],
        radius=round(2.4 * MM), fill=255,
    )
    img.paste(cgrad, (cbox[0], cbox[1]), mask)

    draw.rectangle([0, pad + h - round(0.25 * MM), w, pad + h],
                   fill=COLORS['footerRule'] + (255,))

    return img


def render_watermark(logo_path):
    """The ATS logo at ~3.8% opacity, centred in a page-sized band."""
    w = round(PAGE_W_MM * MM)
    h = round(WATERMARK_H_MM * MM)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if not os.path.exists(logo_path):
        return img

    mark = Image.open(logo_path).convert('RGBA')
    # Fit inside with a margin so it does not touch the edges.
    box_w, box_h = round(w * 0.62), round(h * 0.72)
    mark.thumbnail((box_w, box_h), Image.LANCZOS)
    x = (w - mark.width) // 2
    y = (h - mark.height) // 2

    alpha = mark.getchannel('A').point(lambda v: round(v * WATERMARK_ALPHA))
    mark.putalpha(alpha)
    img.alpha_composite(mark, (x, y))
    return img


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(os.path.dirname(here), 'static', 'img')
    logo = os.path.join(out_dir, 'logo.png')
    os.makedirs(out_dir, exist_ok=True)

    for name, image in (
        ('swoosh.png', render_swoosh()),
        ('footer.png', render_footer()),
        ('watermark.png', render_watermark(logo)),
    ):
        path = os.path.join(out_dir, name)
        image.save(path, 'PNG', optimize=True)
        print(f'{name}: {image.width}x{image.height} -> {path}')


if __name__ == '__main__':
    main()
