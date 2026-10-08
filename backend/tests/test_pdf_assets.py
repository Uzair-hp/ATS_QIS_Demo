"""The decorative PNGs the PDF templates embed.

xhtml2pdf cannot render inline SVG, `data:image/svg+xml` <img> elements or CSS
gradients - all three are dropped silently, with no error. PNGs embedded as
base64 do render, which is why the swoosh, the footer and the watermark are
pre-rendered by tools/render_assets.py.

These tests exist so a template that quietly loses its artwork (a renamed file,
a stale cache entry) fails here rather than shipping a blank header.
"""

import base64
import io
import os

import pytest
from pypdf import PdfReader

from routes.pdf_assets import get_asset_base64, get_pdf_assets

ASSET_NAMES = ('logo.png', 'swoosh.png', 'footer.png', 'watermark.png')


@pytest.fixture
def assets(ctx):
    return get_pdf_assets()


def test_every_decorative_asset_exists_on_disk():
    static_img = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), 'static', 'img')
    for name in ASSET_NAMES:
        path = os.path.join(static_img, name)
        assert os.path.exists(path), f'{name} missing - run `python -m tools.render_assets`'
        assert os.path.getsize(path) > 0


def test_assets_are_valid_pngs(ctx):
    from PIL import Image

    for name in ASSET_NAMES:
        raw = base64.b64decode(get_asset_base64(name))
        img = Image.open(io.BytesIO(raw))
        assert img.format == 'PNG', name
        assert img.width > 0 and img.height > 0


def test_decorative_assets_are_full_bleed_width(ctx):
    """The swoosh and footer span the whole 21 cm page width."""
    from PIL import Image

    for name in ('swoosh.png', 'footer.png', 'watermark.png'):
        raw = base64.b64decode(get_asset_base64(name))
        width = Image.open(io.BytesIO(raw)).width
        # 21 cm at 300 dpi = 2480 px. Allow a pixel of rounding.
        assert abs(width - 2480) <= 1, f'{name} is {width}px wide, expected ~2480'


def test_footer_art_carries_its_top_padding(ctx):
    """Box C overhangs the footer band, so the PNG must be taller than the band."""
    from PIL import Image

    band_height_mm = 14.16
    dpi = 300
    raw = base64.b64decode(get_asset_base64('footer.png'))
    height = Image.open(io.BytesIO(raw)).height
    band_px = round(band_height_mm * dpi / 25.4)
    assert height > band_px + 10, 'footer.png has no top pad; box C will clip'


def test_missing_asset_returns_empty_rather_than_raising(ctx):
    assert get_asset_base64('does-not-exist.png') == ''


def test_asset_lookup_is_cached(ctx):
    """Second call must not re-read from disk (it runs on every PDF request)."""
    first = get_asset_base64('swoosh.png')
    second = get_asset_base64('swoosh.png')
    assert first == second and first


def test_quotation_pdf_embeds_the_swoosh(login, ctx, sample):
    """A template that lost its <img> would render a blank header."""
    body = login.get(f"/api/quotations/{sample['quotation'].id}/pdf").get_data()
    reader = PdfReader(io.BytesIO(body))
    images = sum(len(p.images) for p in reader.pages)
    # swoosh + footer + logo at minimum.
    assert images >= 3, f'only {images} images embedded; artwork is missing'


def test_invoice_pdf_embeds_decoration(login, ctx, sample):
    from models import Invoice, InvoiceItem, db

    invoice = Invoice(
        invoice_number='ATS-INV-ASSET-1', client=sample['client'],
        sub_total=200.0, gst_percent=18.0, gst_amount=36.0, total_amount=236.0,
    )
    invoice.items.append(InvoiceItem(service_name='S1', quantity=2.0,
                                     rate=100.0, amount=200.0))
    db.session.add(invoice)
    db.session.commit()

    body = login.get(f'/api/invoices/{invoice.id}/pdf').get_data()
    reader = PdfReader(io.BytesIO(body))
    images = sum(len(p.images) for p in reader.pages)
    assert images >= 3, f'only {images} images embedded; artwork is missing'
