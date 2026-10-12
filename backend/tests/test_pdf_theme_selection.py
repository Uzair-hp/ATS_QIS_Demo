"""The template catalogue and the per-document save endpoint.

Replaces the deleted test_pdf_theme_selection.py, which asserted against the
Jinja render. The rules it protected are unchanged; only the thing being
selected changed from a file path to a React component key.
"""

from models import Quotation, Invoice, db


# ── catalogue ────────────────────────────────────────────────────────────

def test_themes_json_offers_both_sides(login):
    data = login.get('/api/settings/themes').get_json()
    assert 'invoices' in data and 'quotations' in data
    assert data['default_invoice'] == 'classic_gst'
    assert data['default_quotation'] == 'classic'


def test_invoice_and_quotation_keys_are_disjoint(login):
    data = login.get('/api/settings/themes').get_json()

    def keys(side):
        return [i['key'] for g in data[side] for i in g['items']]

    assert not set(keys('invoices')) & set(keys('quotations'))


def test_company_standard_is_first_and_labelled(login):
    data = login.get('/api/settings/themes').get_json()
    for side, default in (('invoices', 'default_invoice'),
                          ('quotations', 'default_quotation')):
        first = data[side][0]['items'][0]
        assert first['label'] == 'Default (Company Standard)'
        assert first['key'] == data[default]


def test_catalogue_groups_are_not_empty(login):
    data = login.get('/api/settings/themes').get_json()
    for side in ('invoices', 'quotations'):
        for group in data[side]:
            assert group['category']
            assert group['items']


def test_every_entry_has_a_description(login):
    data = login.get('/api/settings/themes').get_json()
    for side in ('invoices', 'quotations'):
        for group in data[side]:
            for item in group['items']:
                assert item['description'], item['key']


# ── validation ───────────────────────────────────────────────────────────

def test_rejects_a_key_from_the_other_document_type(put_csrf, sample):
    r = put_csrf(f'/api/quotations/{sample["quotation"].id}/pdf-theme',
                 {'pdf_theme': 'classic_gst'})
    assert r.status_code == 400
    assert 'not an available quotation' in r.get_json()['error']


def test_rejects_an_unknown_key(put_csrf, sample):
    r = put_csrf(f'/api/quotations/{sample["quotation"].id}/pdf-theme',
                 {'pdf_theme': 'nope'})
    assert r.status_code == 400


def test_blank_clears_the_template_to_the_company_default(put_csrf, sample):
    qid = sample['quotation'].id
    Quotation.query.get(qid).pdf_theme = 'q2_proposal'
    db.session.commit()

    r = put_csrf(f'/api/quotations/{qid}/pdf-theme', {'pdf_theme': ''})
    assert r.status_code == 200
    assert r.get_json()['pdf_theme'] is None
    assert Quotation.query.get(qid).pdf_theme is None


# ── persistence ──────────────────────────────────────────────────────────

def test_saves_and_reloads_the_template_on_a_quotation(login, put_csrf, sample):
    qid = sample['quotation'].id

    r = put_csrf(f'/api/quotations/{qid}/pdf-theme', {'pdf_theme': 'q2_proposal'})
    assert r.status_code == 200
    assert r.get_json()['pdf_theme'] == 'q2_proposal'

    # Reopened from the detail endpoint, which is what the print view reads.
    # This is the check that "chosen at creation, used later" holds.
    assert login.get(f'/api/quotations/{qid}').get_json()['pdf_theme'] == 'q2_proposal'


def test_saves_and_reloads_the_template_on_an_invoice(ctx, login, put_csrf, sample):
    from models import now_ist
    inv = Invoice(invoice_number='ATS-INV-2026-001',
                  client_id=sample['client'].id, date_created=now_ist(),
                  sub_total=100.0, total_amount=118.0,
                  gst_percent=18.0, gst_amount=18.0)
    db.session.add(inv)
    db.session.commit()

    r = put_csrf(f'/api/invoices/{inv.id}/pdf-theme', {'pdf_theme': 't3_minimal'})
    assert r.status_code == 200
    assert r.get_json()['pdf_theme'] == 't3_minimal'
    assert login.get(f'/api/invoices/{inv.id}').get_json()['pdf_theme'] == 't3_minimal'


def test_theme_change_does_not_touch_the_financial_record(login, put_csrf, sample):
    """The endpoint exists so a presentation change cannot rebuild items or
    recompute status the way PUT /<id> does."""
    qid = sample['quotation'].id
    before = login.get(f'/api/quotations/{qid}').get_json()

    put_csrf(f'/api/quotations/{qid}/pdf-theme', {'pdf_theme': 'q3_minimal'})

    after = login.get(f'/api/quotations/{qid}').get_json()
    for field in ('sub_total', 'discount_amount', 'gst_amount', 'total_amount',
                  'status', 'notes', 'subject', 'payment_terms'):
        assert after[field] == before[field], field
    assert after['items'] == before['items']


def test_theme_change_is_allowed_on_a_locked_document(put_csrf, sample):
    """Changing a template is not editing the quotation, so an Invoiced
    quotation keeps its template editable."""
    qid = sample['quotation'].id
    sample['quotation'].status = 'Invoiced'
    db.session.commit()

    assert put_csrf(f'/api/quotations/{qid}', {}).status_code == 400
    assert put_csrf(f'/api/quotations/{qid}/pdf-theme',
                    {'pdf_theme': 'q4_compact'}).status_code == 200


# ── the retired server PDF is gone ───────────────────────────────────────

def test_server_side_pdf_endpoint_no_longer_exists(login, sample):
    """There must be no second renderer to drift out of sync. A 404 is the
    intended outcome; a 200 here would mean a layout came back."""
    assert login.get(f'/api/quotations/{sample["quotation"].id}/pdf').status_code == 404
    assert login.get('/api/invoices/1/pdf').status_code == 404


def test_theme_preview_image_endpoint_is_gone(login):
    assert login.get('/api/settings/themes/preview/quotations/classic/1').status_code == 404


# ── company details reach the document ───────────────────────────────────

def test_quotation_detail_carries_the_same_company_block_as_an_invoice(login, sample):
    """The quotation endpoint used to return five profile keys while the invoice
    endpoint returned eleven, which is why the print sheet had to fetch settings
    separately and could show an empty bank block."""
    data = login.get(f'/api/quotations/{sample["quotation"].id}').get_json()
    assert set(data['profile']) == {
        'name', 'tagline', 'email', 'phone', 'address',
        'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch',
        'upi_id', 'gst_number',
    }
