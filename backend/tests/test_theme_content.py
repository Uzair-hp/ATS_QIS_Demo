"""Content assertions for the 10 approved templates, plus the Phase 1 fixes.

Parametrised over the allowlist rather than a hand-written list, so adding an
approved template without checking its content fails here.

xhtml2pdf fails silently (AGENTS.md section 6), so these check that the things
that would be dropped are actually present in the rendered text.
"""

import io

import pytest
from pypdf import PdfReader

import pdf_themes
from models import (Client, CompanyProfile, Invoice, InvoiceItem, Quotation,
                    QuotationItem, db)

BANK = ('HDFC Bank', '50200097301710', 'HDFC0001234')
MSME = 'UDYAM-MH-170148612'
GSTIN = '27BTHPT0851K1Z9'


@pytest.fixture
def docs(ctx):
    """One invoice and one quotation, both with three items and full details."""
    profile = CompanyProfile.get_profile()
    profile.tagline = 'Security & Systems'
    profile.email = 'info@atsautomation.in'
    profile.phone = '+91-9967399864'
    profile.address = 'Main St, Virar East, Mumbai 401209'
    profile.gst_number = GSTIN
    profile.msme_number = MSME
    profile.bank_name, profile.bank_account = BANK[0], BANK[1]
    profile.bank_ifsc = BANK[2]
    profile.bank_branch = 'Virar East'
    profile.upi_id = 'atsautomation@upi'
    profile.upi_name = 'ATS Automation'

    client = Client(name='Prakash Pituha', company_name='NAVAL DOCKYARD KOLABA',
                    email='p@example.com', phone='+91-9000000000',
                    address='Kolaba, Mumbai', gst_number='27AAAAA0000A1Z5')

    invoice = Invoice(
        invoice_number='ATS-INV-CONTENT-1', client=client,
        sub_total=246000.0, discount=5000.0, discount_type='flat',
        discount_amount=5000.0, gst_percent=18.0, gst_amount=43440.0,
        total_amount=284440.0, advance_amount=100000.0,
        subject='BOOM BARRIER & GATE AUTOMATION',
        payment_terms='50% Advance, Balance on Installation',
        notes='Civil work excluded.',
    )
    quotation = Quotation(
        quotation_number='ATS-QT-CONTENT-1', client=client,
        sub_total=246000.0, discount=5000.0, discount_type='flat',
        discount_amount=5000.0, gst_percent=18.0, gst_amount=43440.0,
        total_amount=284440.0, estimated_timeline='15-20 working days',
        subject='BOOM BARRIER & GATE AUTOMATION',
        payment_terms='50% Advance, Balance on Installation',
        notes='Supply and installation included.',
    )
    for name, hsn, qty, rate in (
        ('Automated Boom Barrier Installation', '996521', 2.0, 45000.0),
        ('Sliding Gate Motor 400kg', '841319', 1.0, 68500.0),
        ('Annual AMC - Preventive Maintenance', '998719', 3.0, 12500.0),
    ):
        invoice.items.append(InvoiceItem(service_name=name, hsn_code=hsn,
                                         quantity=qty, rate=rate,
                                         amount=qty * rate))
        quotation.items.append(QuotationItem(service_name=name, hsn_code=hsn,
                                             quantity=qty, rate=rate,
                                             amount=qty * rate))
    db.session.add_all([invoice, quotation])
    db.session.commit()
    return invoice, quotation


def _render(doc_type, key, docs):
    from pdf_render import render_pdf
    from routes.invoices import generate_upi_qr_base64
    from routes.pdf_assets import get_pdf_assets

    invoice, quotation = docs
    profile = CompanyProfile.get_profile()
    ctx = {'profile': profile, **get_pdf_assets()}
    if doc_type == 'invoice':
        ctx['invoice'] = invoice
        ctx['qr_base64'] = generate_upi_qr_base64(invoice.balance_due,
                                                  invoice.invoice_number)
    else:
        ctx['quotation'] = quotation
    data = render_pdf(pdf_themes.resolve_path(doc_type, key), **ctx)
    reader = PdfReader(io.BytesIO(data))
    return {
        'pages': len(reader.pages),
        'text': '\n'.join(p.extract_text() or '' for p in reader.pages),
        'images': sum(len(p.images) for p in reader.pages),
    }


INVOICE_KEYS = pdf_themes.allowed_keys('invoice')
QUOTATION_KEYS = pdf_themes.allowed_keys('quotation')


# ── per-template content ─────────────────────────────────────────────────

@pytest.mark.parametrize('key', INVOICE_KEYS)
def test_invoice_template_shows_the_document(ctx, docs, key):
    out = _render('invoice', key, docs)
    flat = out['text'].replace(',', '')
    assert 'ATS Automation'.lower() in out['text'].lower() or 'ATS AUTOMATION' in out['text']
    assert 'BOOM BARRIER' in out['text']
    assert 'Automated Boom Barrier Installation' in out['text']
    assert '996521' in out['text'], 'HSN missing'
    assert '284,440' in flat or '284440' in flat, 'grand total missing'
    assert GSTIN in out['text'], 'company GSTIN missing'


@pytest.mark.parametrize('key', QUOTATION_KEYS)
def test_quotation_template_shows_the_document(ctx, docs, key):
    out = _render('quotation', key, docs)
    flat = out['text'].replace(',', '')
    assert 'ATS AUTOMATION' in out['text'].upper()
    assert 'BOOM BARRIER' in out['text']
    assert 'Automated Boom Barrier Installation' in out['text']
    assert '996521' in out['text'], 'HSN missing'
    assert '284,440' in flat or '284440' in flat, 'total value missing'


@pytest.mark.parametrize('key', INVOICE_KEYS + QUOTATION_KEYS)
def test_no_literal_escaped_ampersand(ctx, docs, key):
    """&amp; printing literally is the double-escape bug from AGENTS.md."""
    out = _render('invoice' if key in INVOICE_KEYS else 'quotation', key, docs)
    assert '&amp;' not in out['text']


@pytest.mark.parametrize('key', QUOTATION_KEYS)
def test_quotation_has_no_payment_qr(ctx, docs, key):
    """Nothing to pay on a quotation, so no QR - and no UPI block either."""
    out = _render('quotation', key, docs)
    assert out['images'] <= 3, 'a quotation must not render a QR code'


# ── the originals must keep their decoration ────────────────────────────

@pytest.mark.parametrize('key,doc_type', [('classic_gst', 'invoice'),
                                          ('classic', 'quotation')])
def test_original_templates_keep_their_decoration(ctx, docs, key, doc_type):
    """The swoosh, footer and watermark are three embedded images.

    Scoped to the two originals on purpose: the other approved templates use
    flat colour blocks rather than the pre-rendered PNGs, so this count is a
    statement about the company standard, not a global rule.
    """
    out = _render(doc_type, key, docs)
    assert out['images'] >= 3, \
        f'{key} lost its decorative assets (images={out["images"]})'


# ── Phase 1 regressions ─────────────────────────────────────────────────

@pytest.mark.parametrize('key', ['q1_classic', 'q2_proposal'])
def test_q1_and_q2_show_bank_details(ctx, docs, key):
    """Phase 1: the quotation templates were missing bank details."""
    out = _render('quotation', key, docs)
    flat = out['text'].replace(' ', '').replace(',', '')
    assert BANK[1] in flat or BANK[1].replace('', '') in out['text'], \
        f'{key} missing the account number'
    assert 'HDFC0001234' in flat, f'{key} missing the IFSC'
    assert 'HDFC' in out['text'] and 'Bank' in out['text'], f'{key} missing bank name'
    assert 'Virar East' in out['text'], f'{key} missing the branch'


def test_q2_shows_msme(ctx, docs):
    out = _render('quotation', 'q2_proposal', docs)
    assert MSME in out['text']


def test_t5_shows_sub_total_exactly_once(ctx, docs):
    """Phase 1: t5 printed SUB TOTAL in the items table *and* Subtotal in the
    totals block."""
    out = _render('invoice', 't5_compact_dense', docs)
    assert 'SUB TOTAL' not in out['text'], 'the items-table SUB TOTAL row is back'
    assert out['text'].count('Subtotal') == 1, \
        f'Subtotal appears {out["text"].count("Subtotal")} times'


@pytest.mark.parametrize('key', INVOICE_KEYS + QUOTATION_KEYS)
def test_three_item_document_fits_on_one_page(ctx, docs, key):
    """Every approved template must hold a typical 3-item document on one page."""
    out = _render('invoice' if key in INVOICE_KEYS else 'quotation', key, docs)
    assert out['pages'] == 1, f'{key} spilled onto {out["pages"]} pages'


@pytest.mark.parametrize('key', INVOICE_KEYS)
def test_invoice_shows_balance_due_and_bank(ctx, docs, key):
    out = _render('invoice', key, docs)
    flat = out['text'].replace(',', '').replace(' ', '')
    assert '184440' in flat, 'balance due missing'
    assert 'HDFC0001234' in flat, 'IFSC missing from the invoice'


@pytest.mark.parametrize('key', QUOTATION_KEYS)
def test_quotation_shows_gst_row(ctx, docs, key):
    out = _render('quotation', key, docs)
    flat = out['text'].replace(',', '')
    assert '43,440' in flat or '43440' in flat, 'GST amount row missing'