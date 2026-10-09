"""Smoke tests for the PDF endpoints.

These do not assert on layout - xhtml2pdf output is not testable that way.
They assert the contract the frontend depends on: a 200, a real PDF body, and
a filename header. They exist to catch template/route breakage ahead of the
template redesign work.
"""

import io

import pytest
from pypdf import PdfReader


def _assert_is_pdf(resp):
    assert resp.status_code == 200, resp.get_data(as_text=True)[:400]
    assert resp.headers['Content-Type'] == 'application/pdf'
    body = resp.get_data()
    assert body[:5] == b'%PDF-', 'response body is not a PDF'
    return body


def test_quotation_pdf_requires_login(client, ctx, sample):
    resp = client.get(f"/api/quotations/{sample['quotation'].id}/pdf")
    assert resp.status_code in (302, 401, 403, 308)


def test_quotation_pdf_renders(login, ctx, sample):
    qid = sample['quotation'].id
    body = _assert_is_pdf(login.get(f'/api/quotations/{qid}/pdf'))
    reader = PdfReader(io.BytesIO(body))
    assert len(reader.pages) >= 1
    assert 'attachment' in login.get(
        f'/api/quotations/{qid}/pdf').headers['Content-Disposition']


def test_quotation_pdf_contains_totals(login, ctx, sample):
    """The PDF must carry the rupee figures, not just render an empty shell."""
    body = _assert_is_pdf(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    text = PdfReader(io.BytesIO(body)).pages[0].extract_text()
    # The heading is the quotation's subject, matching the browser print sheet.
    assert 'BOOM BARRIER' in text
    # The grand total has paise, so they must survive formatting.
    assert '212.40' in text.replace(',', ''), text[:600]
    # A whole subtotal drops its ".00", matching the FORTIS reference style.
    assert '200' in text.replace(',', '')


def test_quotation_pdf_includes_gst_amount(login, ctx, sample):
    """total_amount includes GST, so the GST line must be printed."""
    body = _assert_is_pdf(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    text = PdfReader(io.BytesIO(body)).pages[0].extract_text()
    assert '32.40' in text.replace(',', ''), text[:600]


def test_quotation_pdf_includes_bank_details(login, ctx, sample):
    """Bank/GSTIN/MSME belong on a quotation, as they are on the invoice PDF."""
    body = _assert_is_pdf(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    text = PdfReader(io.BytesIO(body)).pages[0].extract_text()
    for expected in ('HDFC Bank', '50200097301710', 'HDFC0001234',
                     '27BTHPT0851K1Z9'):
        assert expected in text, f'{expected!r} missing from quotation PDF'


def test_quotation_pdf_omits_discount_row_when_there_is_none(login, ctx, sample):
    from models import db

    q = sample['quotation']
    q.discount = 0.0
    q.discount_type = 'flat'
    q.discount_amount = 0.0
    q.gst_amount = 36.0
    q.total_amount = 236.0
    db.session.commit()

    body = _assert_is_pdf(login.get(f'/api/quotations/{q.id}/pdf'))
    text = PdfReader(io.BytesIO(body)).pages[0].extract_text()
    assert 'Discount' not in text
    assert '236' in text.replace(',', '')


def test_quotation_pdf_survives_missing_optional_fields(login, ctx, sample):
    """A quotation with no subject/terms/address/timeline must still render."""
    from models import db

    q = sample['quotation']
    q.subject = None
    q.payment_terms = None
    q.valid_until = None
    q.estimated_timeline = None
    q.notes = None
    db.session.commit()

    _assert_is_pdf(login.get(f'/api/quotations/{q.id}/pdf'))


@pytest.mark.parametrize('field,value', [
    ('subject', 'B' * 400),
    ('delivery_address', 'Very long delivery address. ' * 30),
    ('payment_terms', '100% Advance'),
])
def test_quotation_pdf_survives_long_text(login, ctx, sample, field, value):
    from models import db

    setattr(sample['quotation'], field, value)
    db.session.commit()

    body = _assert_is_pdf(login.get(f"/api/quotations/{sample['quotation'].id}/pdf"))
    assert len(PdfReader(io.BytesIO(body)).pages) >= 1


def test_invoice_pdf_renders(login, ctx, sample):
    from models import Invoice, InvoiceItem, db

    invoice = Invoice(
        invoice_number='ATS-INV-2026-001',
        client=sample['client'],
        sub_total=200.0, gst_percent=18.0, gst_amount=36.0,
        total_amount=236.0, advance_amount=0.0,
        subject='BOOM BARRIER',
    )
    invoice.items.append(InvoiceItem(service_name='Service 1', quantity=2.0,
                                     rate=100.0, amount=200.0))
    db.session.add(invoice)
    db.session.commit()

    _assert_is_pdf(login.get(f'/api/invoices/{invoice.id}/pdf'))


def test_pdf_404s_for_unknown_id(login, ctx, sample):
    assert login.get('/api/quotations/999999/pdf').status_code == 404
    assert login.get('/api/invoices/999999/pdf').status_code == 404
