"""pdf_theme end to end: stored on the document, on the company profile, and
the ?theme= override that must never persist.

The theme keys drive which Jinja template renders the document, so these tests
are about two things going wrong: a key that is not valid for the document type
being stored, and an override being written back to the database.
"""

import io

import pytest
from pypdf import PdfReader

import pdf_themes
from models import Client, Invoice, InvoiceItem, Quotation, QuotationItem, db


def _pdf(resp):
    assert resp.status_code == 200, resp.get_data(as_text=True)[:400]
    body = resp.get_data()
    assert body[:5] == b'%PDF-'
    return body


def _text(resp):
    return '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(_pdf(resp))).pages)


def _fingerprint(resp):
    """What "identical output" means here, given the render-time timestamp.

    xhtml2pdf writes /CreationDate and /ModDate into the PDF trailer, so two
    renders of the same template are never byte-identical. Page count, extracted
    text and embedded image count are the stable parts of the output.
    """
    reader = PdfReader(io.BytesIO(_pdf(resp)))
    return (len(reader.pages),
            '\n'.join(p.extract_text() or '' for p in reader.pages),
            sum(len(p.images) for p in reader.pages))


def _invoice_payload(**overrides):
    payload = {
        'client_id': 1,
        'items': [{'name': 'Gate Motor', 'hsn_code': '841319',
                   'quantity': 1.0, 'rate': 1000.0}],
    }
    payload.update(overrides)
    return payload


def _post(login, path, payload):
    """POST with the session CSRF token.

    The app enforces CSRF on every unsafe method once a session exists, and a
    JSON body cannot carry the token, so it goes in the header. `login` is the
    conftest fixture, which stashes the token on the client.
    """
    return login.post(path, json=payload,
                      headers={'X-CSRFToken': login.csrf_token})


def _put(login, path, payload):
    return login.put(path, json=payload,
                     headers={'X-CSRFToken': login.csrf_token})


def _post_form(login, path, fields):
    return login.post(path, data=dict(fields, csrf_token=login.csrf_token),
                      content_type='multipart/form-data')


@pytest.fixture
def client_row(ctx):
    from models import CompanyProfile
    company = CompanyProfile.get_profile()
    company.gst_number = '27BTHPT0851K1Z9'
    company.bank_name = 'HDFC Bank'
    company.bank_account = '50200097301710'
    company.bank_ifsc = 'HDFC0001234'
    client = Client(name='Prakash Pituha', company_name='NAVAL DOCKYARD KOLABA',
                    email='p@example.com', phone='+91-9000000000',
                    address='Kolaba, Mumbai')
    db.session.add(client)
    db.session.commit()
    return client


@pytest.fixture
def invoice(ctx, client_row):
    inv = Invoice(invoice_number='ATS-INV-THEME-1', client=client_row,
                  sub_total=1000.0, gst_percent=18.0, gst_amount=180.0,
                  total_amount=1180.0, subject='GATE MOTOR')
    inv.items.append(InvoiceItem(service_name='Gate Motor', hsn_code='841319',
                                 quantity=1.0, rate=1000.0, amount=1000.0))
    db.session.add(inv)
    db.session.commit()
    return inv


@pytest.fixture
def quotation(ctx, client_row):
    q = Quotation(quotation_number='ATS-QT-THEME-1', client=client_row,
                  sub_total=1000.0, gst_percent=18.0, gst_amount=180.0,
                  total_amount=1180.0, subject='GATE MOTOR')
    q.items.append(QuotationItem(service_name='Gate Motor', hsn_code='841319',
                                 quantity=1.0, rate=1000.0, amount=1000.0))
    db.session.add(q)
    db.session.commit()
    return q


def _cid(client_row):
    return client_row.id


# ── store on the document ────────────────────────────────────────────────

def test_create_invoice_stores_a_valid_theme(login, ctx, client_row):
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme='t3_minimal'))
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['pdf_theme'] == 't3_minimal'
    assert Invoice.query.get(resp.get_json()['id']).pdf_theme == 't3_minimal'


def test_create_quotation_stores_a_valid_theme(login, ctx, client_row):
    resp = _post(login, '/api/quotations/', {
        'client_id': _cid(client_row),
        'items': [{'name': 'S', 'quantity': 1.0, 'rate': 100.0}],
        'pdf_theme': 'q2_proposal',
    })
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['pdf_theme'] == 'q2_proposal'


def test_blank_theme_stores_null(login, ctx, client_row):
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme=''))
    assert resp.status_code == 201
    assert resp.get_json()['pdf_theme'] is None


def test_absent_theme_stores_null(login, ctx, client_row):
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row)))
    assert resp.get_json()['pdf_theme'] is None


def test_update_changes_the_theme(login, ctx, invoice):
    resp = _put(login, f'/api/invoices/{invoice.id}', _invoice_payload(
        client_id=invoice.client_id, pdf_theme='t5_compact_dense'))
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['pdf_theme'] == 't5_compact_dense'


def test_update_with_blank_clears_the_theme(login, ctx, invoice):
    invoice.pdf_theme = 't3_minimal'
    db.session.commit()
    resp = _put(login, f'/api/invoices/{invoice.id}', _invoice_payload(
        client_id=invoice.client_id, pdf_theme=''))
    assert resp.get_json()['pdf_theme'] is None


def test_update_omitting_the_key_leaves_it_alone(login, ctx, invoice):
    invoice.pdf_theme = 't3_minimal'
    db.session.commit()
    resp = _put(login, f'/api/invoices/{invoice.id}', _invoice_payload(
        client_id=invoice.client_id))
    assert resp.get_json()['pdf_theme'] == 't3_minimal'


# ── invalid and cross-type values ────────────────────────────────────────

def test_unknown_theme_is_rejected_with_a_clear_error(login, ctx, client_row):
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme='does-not-exist'))
    assert resp.status_code == 400
    assert 'does-not-exist' in resp.get_json()['error']


def test_cross_type_theme_is_rejected_on_create(login, ctx, client_row):
    """A quotation key on an invoice is the dangerous case: it must not store."""
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme='q1_classic'))
    assert resp.status_code == 400
    assert 'q1_classic' in resp.get_json()['error']


def test_cross_type_theme_is_rejected_on_update(login, ctx, invoice):
    invoice.pdf_theme = 't3_minimal'
    db.session.commit()
    resp = _put(login, f'/api/invoices/{invoice.id}', _invoice_payload(
        client_id=invoice.client_id, pdf_theme='q3_minimal'))
    assert resp.status_code == 400
    db.session.refresh(invoice)
    assert invoice.pdf_theme == 't3_minimal', 'a rejected update must not persist'


def test_excluded_template_is_rejected(login, ctx, client_row):
    """t8_mono_bw stays in the repo but is not selectable."""
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme='t8_mono_bw'))
    assert resp.status_code == 400


def test_invoice_key_is_rejected_on_a_quotation(login, ctx, client_row):
    resp = _post(login, '/api/quotations/', {
        'client_id': _cid(client_row),
        'items': [{'name': 'S', 'quantity': 1.0, 'rate': 100.0}],
        'pdf_theme': 't3_minimal',
    })
    assert resp.status_code == 400
    assert 't3_minimal' in resp.get_json()['error']


def test_theme_error_lists_the_available_keys(login, ctx, client_row):
    resp = _post(login, '/api/invoices/', _invoice_payload(
        client_id=_cid(client_row), pdf_theme='nope'))
    for key in pdf_themes.allowed_keys('invoice'):
        assert key in resp.get_json()['error']


# ── duplicate and convert ────────────────────────────────────────────────

def test_duplicating_a_quotation_copies_the_theme(login, ctx, quotation):
    quotation.pdf_theme = 'q2_proposal'
    db.session.commit()

    resp = _post(login, f'/api/quotations/{quotation.id}/duplicate', {})
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['pdf_theme'] == 'q2_proposal'
    assert Quotation.query.get(resp.get_json()['id']).pdf_theme == 'q2_proposal'


def test_duplicating_a_quotation_with_no_theme_stays_null(login, ctx, quotation):
    resp = _post(login, f'/api/quotations/{quotation.id}/duplicate', {})
    assert resp.get_json()['pdf_theme'] is None


def test_converting_does_not_copy_the_theme(login, ctx, quotation):
    """Invoice and quotation template sets are disjoint - a copied key would be
    invalid on the invoice."""
    quotation.pdf_theme = 'q2_proposal'
    db.session.commit()

    resp = _post(login, f'/api/quotations/{quotation.id}/convert', {})
    assert resp.status_code == 201, resp.get_json()
    assert Invoice.query.get(resp.get_json()['invoice_id']).pdf_theme is None


# ── company default ──────────────────────────────────────────────────────

def test_company_default_is_saved_and_validated(login, ctx):
    resp = _post_form(login, '/api/settings/', {
        'name': 'ATS Automation',
        'invoice_pdf_theme': 't2_letterhead',
        'quotation_pdf_theme': 'q3_minimal',
    })
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body['invoice_pdf_theme'] == 't2_letterhead'
    assert body['quotation_pdf_theme'] == 'q3_minimal'


def test_company_default_reset_stores_null(login, ctx):
    _post_form(login, '/api/settings/', {'name': 'ATS Automation',
                                       'invoice_pdf_theme': 't3_minimal'})
    resp = _post_form(login, '/api/settings/', {'name': 'ATS Automation',
                                              'invoice_pdf_theme': ''})
    assert resp.get_json()['invoice_pdf_theme'] is None


def test_company_default_rejects_a_cross_type_key(login, ctx):
    resp = _post_form(login, '/api/settings/', {'name': 'ATS Automation',
                                              'invoice_pdf_theme': 'q1_classic'})
    assert resp.status_code == 400
    assert 'q1_classic' in resp.get_json()['error']


def test_company_default_rejects_an_excluded_key(login, ctx):
    resp = _post_form(login, '/api/settings/', {'name': 'ATS Automation',
                                              'quotation_pdf_theme': 't7_ledger'})
    assert resp.status_code == 400


def test_settings_json_reports_both_defaults(login, ctx):
    body = login.get('/api/settings/').get_json()
    assert 'invoice_pdf_theme' in body
    assert 'quotation_pdf_theme' in body


def _company_default(**themes):
    from models import CompanyProfile

    profile = CompanyProfile.get_profile()
    for key, value in themes.items():
        setattr(profile, key, value)
    db.session.commit()
    return profile


def test_existing_documents_with_null_follow_the_company_default(login, ctx, invoice):
    """A document saved before this feature existed must pick up the company
    default rather than freezing on the original template."""
    invoice.pdf_theme = None
    db.session.commit()
    baseline = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    _company_default(invoice_pdf_theme='t3_minimal')
    with_default = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    assert with_default != baseline, 'a NULL document ignored the company default'


def test_document_theme_beats_the_company_default(login, ctx, invoice):
    """Setting the company default must not repaint a document that chose its
    own template."""
    invoice.pdf_theme = 't5_compact_dense'
    db.session.commit()
    document_choice = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    _company_default(invoice_pdf_theme='t3_minimal')
    assert _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf')) == \
        document_choice


def test_changing_the_company_default_leaves_existing_documents_alone(login, ctx, invoice):
    invoice.pdf_theme = 't5_compact_dense'
    db.session.commit()
    before = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    _company_default(invoice_pdf_theme='t4_corporate_slate')

    assert _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf')) == before


# ── the ?theme= override ─────────────────────────────────────────────────

def test_theme_query_overrides_the_document_template(login, ctx, invoice):
    from models import CompanyProfile

    invoice.pdf_theme = 't3_minimal'
    CompanyProfile.get_profile().invoice_pdf_theme = None
    db.session.commit()

    plain = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))
    over = _fingerprint(
        login.get(f'/api/invoices/{invoice.id}/pdf?theme=t5_compact_dense'))
    assert plain != over, 'the override changed nothing'


def test_theme_query_never_writes_to_the_database(login, ctx, invoice):
    from models import CompanyProfile

    invoice.pdf_theme = 't3_minimal'
    CompanyProfile.get_profile().invoice_pdf_theme = 't2_letterhead'
    db.session.commit()

    login.get(f'/api/invoices/{invoice.id}/pdf?theme=t5_compact_dense')

    db.session.expire_all()
    assert Invoice.query.get(invoice.id).pdf_theme == 't3_minimal'
    assert CompanyProfile.get_profile().invoice_pdf_theme == 't2_letterhead'


def test_quotation_theme_query_never_writes_to_the_database(login, ctx, quotation):
    quotation.pdf_theme = 'q1_classic'
    db.session.commit()

    login.get(f'/api/quotations/{quotation.id}/pdf?theme=q4_compact')

    db.session.expire_all()
    assert Quotation.query.get(quotation.id).pdf_theme == 'q1_classic'


def test_no_param_download_is_identical_to_a_saved_theme(login, ctx, invoice):
    """A document whose stored theme is X must render exactly as the no-param
    download did before X existed.

    Compared by page count, extracted text and image count rather than bytes:
    xhtml2pdf stamps /CreationDate and /ModDate into the trailer at render time
    (verified), so two renders of one template differ by a second. Text and
    image content is what "unchanged output" actually means here.
    """
    first = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    invoice.pdf_theme = 'classic_gst'
    db.session.commit()
    stored = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    invoice.pdf_theme = None
    db.session.commit()
    again = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))

    assert first == stored == again


@pytest.mark.parametrize('theme', ['does-not-exist', '', 'q1_classic', 't99'])
def test_bad_theme_param_falls_back_to_the_no_param_output(login, ctx, invoice, theme):
    baseline = _fingerprint(login.get(f'/api/invoices/{invoice.id}/pdf'))
    assert _fingerprint(
        login.get(f'/api/invoices/{invoice.id}/pdf?theme={theme}')) == baseline


def test_theme_param_keeps_the_download_headers(login, ctx, invoice):
    resp = login.get(f'/api/invoices/{invoice.id}/pdf?theme=t3_minimal')
    assert resp.status_code == 200
    assert resp.headers['Content-Type'] == 'application/pdf'
    assert 'attachment' in resp.headers['Content-Disposition']
    assert invoice.invoice_number in resp.headers['Content-Disposition']


def test_pdf_still_requires_login(client, ctx, invoice):
    resp = client.get(f'/api/invoices/{invoice.id}/pdf?theme=t3_minimal')
    assert resp.status_code in (302, 401, 403, 308)


def test_themes_endpoint_requires_login(client, ctx):
    assert client.get('/api/settings/themes').status_code in (302, 401, 403, 308)


def test_themes_endpoint_returns_only_the_allowlist(login, ctx):
    body = login.get('/api/settings/themes').get_json()
    inv = [i['key'] for g in body['invoices'] for i in g['items']]
    quo = [i['key'] for g in body['quotations'] for i in g['items']]
    assert inv == pdf_themes.allowed_keys('invoice')
    assert quo == pdf_themes.allowed_keys('quotation')
    assert body['default_invoice'] == 'classic_gst'
    assert body['default_quotation'] == 'classic'


def test_all_ten_templates_render_over_http(login, ctx, invoice, quotation):
    """Each allowlisted key must produce a real PDF through the API."""
    for key in pdf_themes.allowed_keys('invoice'):
        assert _pdf(login.get(f'/api/invoices/{invoice.id}/pdf?theme={key}'))
    for key in pdf_themes.allowed_keys('quotation'):
        assert _pdf(login.get(f'/api/quotations/{quotation.id}/pdf?theme={key}'))