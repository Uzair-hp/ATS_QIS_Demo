"""Guards for the shared PDF template chrome.

Two failures here are silent in the PDF output and were found only by rendering
the result, so they are worth pinning:

1. A <style> block inside an `{% import %}`ed template is discarded. xhtml2pdf
   then renders the document with no styling at all - no table borders, no navy
   header row, no grand-total fill - and still reports success.
2. `section_head` receives pre-escaped entities, so double-escaping shows up as a
   literal "&amp;" in the printed heading.
"""

import io

from pypdf import PdfReader


def _text(resp):
    reader = PdfReader(io.BytesIO(resp.get_data()))
    return '\n'.join(p.extract_text() for p in reader.pages)


def _images(resp):
    reader = PdfReader(io.BytesIO(resp.get_data()))
    return sum(len(p.images) for p in reader.pages)


def test_quotation_pdf_is_styled(login, ctx, sample):
    """A regression guard for the discarded-stylesheet bug.

    Borders are vector strokes, not glyphs, so extracted text cannot see them.
    Instead this asserts on the FONT SIZE the stylesheet selects: the header row
    is 8.5pt bold Helvetica, and the grand-total row is 11.5pt. Unstyled, both
    fall back to the 9.5pt body default.
    """
    reader = PdfReader(io.BytesIO(
        login.get(f"/api/quotations/{sample['quotation'].id}/pdf").get_data()
    ))
    sizes = set()
    for page in reader.pages:
        def visitor(text, cm, tm, font_dict, font_size):
            if text.strip():
                sizes.add(round(font_size, 1))
        page.extract_text(visitor_text=visitor)

    assert 8.5 in sizes, f'8.5pt header style missing; sizes seen: {sorted(sizes)}'
    assert 11.5 in sizes, f'11.5pt grand-total style missing; sizes seen: {sorted(sizes)}'


def test_quotation_pdf_embeds_logo_and_decoration(login, ctx, sample):
    """Swoosh, footer and watermark, plus the logo.

    Scoped to the default template on purpose: the selectable themes use flat
    colour blocks instead of the pre-rendered decoration PNGs, so this count
    describes the company standard, not every template. See test_theme_content
    .py for the per-template content assertions.
    """
    assert _images(login.get(f"/api/quotations/{sample['quotation'].id}/pdf")) >= 3


def test_section_heading_is_not_double_escaped(login, ctx, sample):
    """&amp; must print as &, not as the literal text &amp;."""
    from models import db

    sample['quotation'].notes = 'Exclusions: civil work.'
    db.session.commit()

    text = _text(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    assert 'SCOPE OF WORK, EXCLUSIONS & TERMS' in text, \
        'heading missing or double-escaped'
    assert '&amp;' not in text, 'a heading was double-escaped'


def test_invoice_section_heading_is_not_double_escaped(login, ctx, sample):
    from models import Invoice, InvoiceItem, db

    invoice = Invoice(
        invoice_number='ATS-INV-ESC-1', client=sample['client'],
        sub_total=100.0, gst_percent=18.0, gst_amount=18.0, total_amount=118.0,
        notes='Pay within 30 days.',
    )
    invoice.items.append(InvoiceItem(service_name='S1', quantity=1.0,
                                     rate=100.0, amount=100.0))
    db.session.add(invoice)
    db.session.commit()

    text = _text(login.get(f'/api/invoices/{invoice.id}/pdf'))
    assert 'NOTES & TERMS' in text, 'heading missing or double-escaped'
    assert '&amp;' not in text


def test_grand_total_is_printed(login, ctx, sample):
    text = _text(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    assert 'Grand Total' in text
    assert '93,877.26' not in text, 'stale figure from an earlier render'
