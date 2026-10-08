"""Blank letterhead PDF: same chrome as the other documents, empty body."""

import io

from pypdf import PdfReader


def _reader(resp):
    assert resp.status_code == 200, resp.get_data(as_text=True)[:400]
    assert resp.headers['Content-Type'] == 'application/pdf'
    body = resp.get_data()
    assert body[:5] == b'%PDF-'
    return PdfReader(io.BytesIO(body))


def _text(reader):
    return '\n'.join(p.extract_text() for p in reader.pages)


def test_letterhead_requires_login(client, ctx, sample):
    assert client.get('/api/letterhead/download').status_code in (302, 401, 403, 308)


def test_letterhead_downloads_as_a_pdf(login, ctx, sample):
    resp = login.get('/api/letterhead/download')
    reader = _reader(resp)
    assert len(reader.pages) == 1
    assert 'attachment' in resp.headers['Content-Disposition']
    assert 'letterhead' in resp.headers['Content-Disposition'].lower()


def test_letterhead_filename_uses_the_company_name(login, ctx, sample):
    resp = login.get('/api/letterhead/download')
    assert 'ATS-Automation' in resp.headers['Content-Disposition']


def test_letterhead_carries_the_letterhead_artwork(login, ctx, sample):
    """The swoosh, logo and footer must survive - it is the same chrome."""
    images = sum(len(p.images) for p in _reader(login.get('/api/letterhead/download')).pages)
    assert images >= 3, f'only {images} images; header/footer art is missing'


def test_letterhead_shows_the_company_details(login, ctx, sample):
    text = _text(_reader(login.get('/api/letterhead/download')))
    assert 'ATS AUTOMATION' in text or 'ATS Automation' in text
    assert 'info@atsautomation.in' in text


def test_letterhead_has_no_business_content(login, ctx, sample):
    """A blank letterhead must not leak the sample client's data."""
    text = _text(_reader(login.get('/api/letterhead/download')))
    for leak in ('NAVAL DOCKYARD', 'Prakash Pituha', 'ATS-QT-2026-001',
                 'Grand Total', 'SUBTOTAL', 'HDFC'):
        assert leak not in text, f'letterhead contains {leak!r}'


def test_letterhead_survives_a_bare_profile(login, ctx):
    """No bank details, no GSTIN, no stamp - it must still render."""
    from models import CompanyProfile, db

    profile = CompanyProfile.get_profile()
    profile.bank_name = None
    profile.bank_account = None
    profile.bank_ifsc = None
    profile.gst_number = None
    profile.msme_number = None
    profile.stamp_image = None
    profile.email = None
    profile.website = None
    db.session.commit()

    reader = _reader(login.get('/api/letterhead/download'))
    assert len(reader.pages) == 1
    # Footer joins only the populated fields, so an all-empty footer is fine.
    assert 'AUTHORIZATION' not in _text(reader).upper()
