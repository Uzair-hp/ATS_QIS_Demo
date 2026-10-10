"""Render every registered theme for visual QA.

Usage:  python -m tools.render_themes [key ...]

With no keys every allowlisted template is rendered; naming one or more keys
renders only those. Writes one PNG per page per theme into backend/_qa/ (a
gitignored scratch directory) so the output can actually be looked at, per
AGENTS.md section 6.
"""

import io
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DevelopmentConfig  # noqa: E402

# A throwaway database, so rendering never touches the developer's ats.db.
# Pointed at before create_app() because the config is read inside the factory.
_qa_db = os.path.join(tempfile.gettempdir(), 'ats_qa_render.db')
if os.path.exists(_qa_db):
    os.remove(_qa_db)
DevelopmentConfig.SQLALCHEMY_DATABASE_URI = 'sqlite:///' + _qa_db

from app import create_app  # noqa: E402
from models import (Client, CompanyProfile, Invoice, InvoiceItem,  # noqa: E402
                    Quotation, QuotationItem, now_ist)
from pdf_themes import (INVOICE_THEMES, QUOTATION_THEMES,  # noqa: E402
                        DEFAULT_INVOICE_THEME, DEFAULT_QUOTATION_THEME)
# Only the 10 templates the UI exposes are rendered here; t1 and t6-t11 stay in
# the repo as reference but are not part of the QA set.
from pdf_themes import allowed_keys  # noqa: E402
from pdf_render import render_pdf  # noqa: E402
from routes.invoices import generate_upi_qr_base64  # noqa: E402
from routes.pdf_assets import get_pdf_assets  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   '_qa')

# 150 dpi is comfortable to read when checking a template by eye. The tracked
# images in _preview/ are A4 at 100 dpi (827x1170), so previews are rendered at
# that scale instead - see rasterise().
QA_SCALE = 150 / 72
PREVIEW_SCALE = 100 / 72

ITEMS = [
    ('Automated Boom Barrier Installation', '996521', 2.0, 45000.0),
    ('Sliding Gate Motor 400kg', '841319', 1.0, 68500.0),
    ('Annual AMC - Preventive Maintenance', '998719', 3.0, 12500.0),
]


def seed(app):
    with app.app_context():
        profile = CompanyProfile.get_profile()
        profile.tagline = 'Security & Systems'
        profile.email = 'info@atsautomation.in'
        profile.phone = '+91-9967399864'
        profile.website = 'www.atsautomation.in'
        profile.address = ('Main St, Nallasopara East, Virar East, '
                           'Vasai-Virar, Mumbai, Maharashtra 401209')
        profile.gst_number = '27BTHPT0851K1Z9'
        profile.msme_number = 'UDYAM-MH-170148612'
        profile.bank_name = 'HDFC Bank'
        profile.bank_account = '50200097301710'
        profile.bank_ifsc = 'HDFC0001234'
        profile.bank_branch = 'Virar East'
        profile.upi_id = 'atsautomation@upi'
        profile.upi_name = 'ATS Automation'

        client = Client(name='Prakash Pituha',
                        company_name='NAVAL DOCKYARD KOLABA',
                        email='p@example.com', phone='+91-9000000000',
                        address='Kolaba, Mumbai',
                        gst_number='27AAAAA0000A1Z5')

        invoice = Invoice(
            invoice_number='ATS-INV-2026-001', client=client,
            date_created=now_ist(), sub_total=246000.0, discount=5000.0,
            discount_type='flat', discount_amount=5000.0, gst_percent=18.0,
            gst_amount=43440.0, total_amount=284440.0,
            subject='BOOM BARRIER & GATE AUTOMATION',
            delivery_address='Gate No. 4, Naval Dockyard, Kolaba, Mumbai 400005',
            payment_terms='50% Advance, Balance on Installation',
            notes='Civil work, wiring and statutory approvals are excluded.',
        )
        for name, hsn, qty, rate in ITEMS:
            invoice.items.append(InvoiceItem(service_name=name, hsn_code=hsn,
                                             quantity=qty, rate=rate,
                                             amount=qty * rate))

        quotation = Quotation(
            quotation_number='ATS-QT-2026-001', client=client,
            date_created=now_ist(), sub_total=246000.0, discount=5000.0,
            discount_type='flat', discount_amount=5000.0, gst_percent=18.0,
            gst_amount=43440.0, total_amount=284440.0,
            subject='BOOM BARRIER & GATE AUTOMATION',
            payment_terms='50% Advance, Balance on Installation',
            valid_until=now_ist(), estimated_timeline='15-20 working days',
            notes='Supply, installation, commissioning and training included.',
        )
        for name, hsn, qty, rate in ITEMS:
            quotation.items.append(QuotationItem(service_name=name, hsn_code=hsn,
                                                 quantity=qty, rate=rate,
                                                 amount=qty * rate))

        from models import db
        db.session.add_all([invoice, quotation])
        db.session.commit()
        return invoice.id, quotation.id


def rasterise(base, pdf_bytes, out_dir, scale=QA_SCALE):
    """Write one PNG per page so the result can actually be looked at.

    xhtml2pdf output has to be opened and read - a passing render says nothing
    about clipping, overlap or pagination (AGENTS.md section 6). Returns the
    page count.

    QA renders at QA_SCALE because that is for human inspection. Previews go at
    PREVIEW_SCALE instead, which is what the already-tracked images in
    _preview/ use - mixing the two would replace every file in the directory
    with a differently sized one.
    """
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
    for i, page in enumerate(doc):
        page.render(scale=scale).to_pil().save(
            os.path.join(out_dir, f'{base}__p{i + 1}.png')
        )
    count = len(doc)
    doc.close()
    return count


def _wanted():
    """Theme keys named on the command line, or None for the whole allowlist.

    Flags are removed first, including the value that follows --preview-dir,
    so that naming a flag does not silently filter out every theme and render
    nothing. Parsed by hand because sys.argv[2:] would instead discard the
    first key, which also renders the wrong set with no error.
    """
    args = sys.argv[1:]
    if '--preview-dir' in args:
        args.pop(args.index('--preview-dir'))
        if args and not args[0].startswith('-'):
            args.pop(0)
    args = [a for a in args if not a.startswith('-')]
    return args or None


def _preview_dir():
    """The --preview-dir target, or None.

    Previews are written to a directory the caller names rather than straight
    into backend/_preview/, so a new set can be generated and compared before
    any tracked file is overwritten.
    """
    args = sys.argv[1:]
    if '--preview-dir' in args:
        return args[args.index('--preview-dir') + 1]
    return None


def main():
    preview = _preview_dir()
    out = preview or OUT
    os.makedirs(out, exist_ok=True)
    app = create_app()
    invoice_id, quotation_id = seed(app)

    with app.app_context():
        from models import Invoice, Quotation
        profile = CompanyProfile.get_profile()
        assets = get_pdf_assets()
        qr = generate_upi_qr_base64(50000.0, 'ATS-INV-2026-001')

        wanted = _wanted()
        for kind in ('invoice', 'quotation'):
            registry = INVOICE_THEMES if kind == 'invoice' else QUOTATION_THEMES
            for key in allowed_keys(kind):
                if wanted and key not in wanted:
                    continue
                entry = registry[key]
                path, label, desc = entry
                if kind == 'invoice':
                    doc = Invoice.query.get(invoice_id)
                    data = dict(invoice=doc, profile=profile,
                                qr_base64=qr, **assets)
                else:
                    doc = Quotation.query.get(quotation_id)
                    data = dict(quotation=doc, profile=profile, **assets)

                pdf = render_pdf(path, **data)
                base = f'{kind}__{key}'
                if not preview:
                    with open(os.path.join(out, base + '.pdf'), 'wb') as fh:
                        fh.write(pdf)
                pages = rasterise(base, pdf, out,
                                  PREVIEW_SCALE if preview else QA_SCALE)
                where = 'preview' if preview else 'qa'
                print(f'{where:8} {kind:10} {key:22} {pages} page(s)  {label}')

    if preview:
        print(f'\nwrote preview images to {preview}')


if __name__ == '__main__':
    main()