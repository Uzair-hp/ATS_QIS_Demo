"""The allowlist, the resolution order, and the defaults.

Three separate things are pinned here, and the distinctions matter:

1. DEFAULT_* values must never change - they decide what every existing
   document renders as.
2. The allowlist is what the API will accept. A template file being present in
   the repo must not, by itself, make a template user-selectable.
3. Resolution has to survive a NULL / blank / unknown / cross-type value at any
   level, because all four are reachable from real data.
"""

import pytest

import pdf_themes

APPROVED_INVOICES = ['classic_gst', 't2_letterhead', 't4_corporate_slate',
                     't3_minimal', 't5_compact_dense']
APPROVED_QUOTATIONS = ['classic', 'q1_classic', 'q2_proposal', 'q3_minimal',
                       'q4_compact']

# Kept in the repo as reference, never offered or accepted.
EXCLUDED = ['t1_classic_gst', 't6_amber_accent', 't7_ledger', 't8_mono_bw',
            't9_legal_compliance', 't10_modern_saas', 't11_retail_pos']


# ── defaults ─────────────────────────────────────────────────────────────

def test_defaults_are_pinned():
    """If these drift, every document with no stored theme changes appearance."""
    assert pdf_themes.DEFAULT_INVOICE_THEME == 'classic_gst'
    assert pdf_themes.DEFAULT_QUOTATION_THEME == 'classic'
    assert pdf_themes.DEFAULTS == {'invoice': 'classic_gst', 'quotation': 'classic'}


def test_defaults_are_always_allowlisted():
    for doc_type in ('invoice', 'quotation'):
        assert pdf_themes.default_theme(doc_type) in pdf_themes.allowed_keys(doc_type)


def test_download_with_nothing_selected_is_the_original_template():
    """No ?theme=, no document theme, no company default -> the original file."""
    assert pdf_themes.resolve_path('invoice', None, None, None) == \
        'invoices/pdf_template.html'
    assert pdf_themes.resolve_path('quotation', None, None, None) == \
        'quotations/pdf_template.html'


# ── allowlist ────────────────────────────────────────────────────────────

def test_allowlists_are_exactly_the_approved_ten():
    assert pdf_themes.allowed_keys('invoice') == APPROVED_INVOICES
    assert pdf_themes.allowed_keys('quotation') == APPROVED_QUOTATIONS


@pytest.mark.parametrize('doc_type', ['invoice', 'quotation'])
def test_default_is_first_in_every_selector(doc_type):
    assert pdf_themes.allowed_keys(doc_type)[0] == pdf_themes.default_theme(doc_type)


@pytest.mark.parametrize('key', EXCLUDED)
def test_excluded_templates_are_not_allowed(key):
    assert not pdf_themes.is_allowed('invoice', key)
    assert not pdf_themes.is_allowed('quotation', key)


@pytest.mark.parametrize('key', EXCLUDED)
def test_excluded_templates_are_absent_from_themes_json(key):
    payload = pdf_themes.themes_json()
    for group in payload['invoices']:
        assert all(item['key'] != key for item in group['items'])
    for group in payload['quotations']:
        assert all(item['key'] != key for item in group['items'])


def test_excluded_templates_are_still_in_the_registry():
    """Not offered, not deleted - still renderable by hand."""
    for key in EXCLUDED:
        assert key in pdf_themes.INVOICE_THEMES


def test_every_allowlisted_key_exists_in_its_registry():
    for doc_type, registry in pdf_themes.REGISTRIES.items():
        for key in pdf_themes.allowed_keys(doc_type):
            assert key in registry


def test_default_can_never_be_removed_or_hidden():
    for doc_type in ('invoice', 'quotation'):
        keys = pdf_themes.allowed_keys(doc_type)
        assert pdf_themes.default_theme(doc_type) in keys
        assert keys.count(pdf_themes.default_theme(doc_type)) == 1
        assert pdf_themes.is_allowed(doc_type, pdf_themes.default_theme(doc_type))


# ── themes_json shape ────────────────────────────────────────────────────

def test_themes_json_is_grouped_by_category():
    payload = pdf_themes.themes_json()
    for side in ('invoices', 'quotations'):
        groups = payload[side]
        assert groups, side
        for group in groups:
            assert group['items'], 'an empty category group'
            assert all(item['category'] == group['category'] for item in group['items'])
        categories = [g['category'] for g in groups]
        assert categories == sorted(categories, key=categories.index), 'grouped, not repeated'


def test_themes_json_default_is_labelled_company_standard():
    payload = pdf_themes.themes_json()
    assert payload['invoices'][0]['items'][0]['label'] == 'Default (Company Standard)'
    assert payload['quotations'][0]['items'][0]['label'] == 'Default (Company Standard)'


def test_themes_json_items_carry_label_and_description():
    payload = pdf_themes.themes_json()
    for side in ('invoices', 'quotations'):
        for group in payload[side]:
            for item in group['items']:
                assert item['label'], item
                assert item['description'], item


def test_themes_json_totals_ten_templates():
    payload = pdf_themes.themes_json()
    for side in ('invoices', 'quotations'):
        keys = [i['key'] for g in payload[side] for i in g['items']]
        assert len(keys) == 5, keys


# ── resolution order ─────────────────────────────────────────────────────

def test_override_wins_over_everything():
    assert pdf_themes.resolve_key('invoice', 't3_minimal', 't5_compact_dense',
                                  't2_letterhead') == 't3_minimal'


def test_document_theme_wins_over_company_default():
    assert pdf_themes.resolve_key('invoice', None, 't5_compact_dense',
                                  't2_letterhead') == 't5_compact_dense'


def test_company_default_is_used_when_the_document_has_none():
    assert pdf_themes.resolve_key('invoice', None, None,
                                  't2_letterhead') == 't2_letterhead'


def test_original_default_is_the_last_resort():
    assert pdf_themes.resolve_key('invoice', None, None, None) == 'classic_gst'
    assert pdf_themes.resolve_key('quotation', None, None, None) == 'classic'


@pytest.mark.parametrize('bad', [None, '', '   ', 'does-not-exist', 't99_nope'])
def test_blank_and_unknown_levels_are_skipped(bad):
    """A junk value at one level must fall through, not blank the document."""
    assert pdf_themes.resolve_key('invoice', bad, 't3_minimal', 't2_letterhead') == \
        't3_minimal'
    assert pdf_themes.resolve_key('invoice', bad, bad, bad) == 'classic_gst'


@pytest.mark.parametrize('cross', ['q1_classic', 'q2_proposal', 'q3_minimal',
                                   'q4_compact', 'classic'])
def test_a_quotation_key_is_rejected_on_an_invoice(cross):
    assert pdf_themes.resolve_key('invoice', cross, 't3_minimal') == 't3_minimal'
    assert pdf_themes.resolve_key('invoice', cross) == 'classic_gst'


@pytest.mark.parametrize('cross', ['classic_gst', 't2_letterhead', 't3_minimal',
                                   't4_corporate_slate', 't5_compact_dense'])
def test_an_invoice_key_is_rejected_on_a_quotation(cross):
    assert pdf_themes.resolve_key('quotation', cross, 'q1_classic') == 'q1_classic'
    assert pdf_themes.resolve_key('quotation', cross) == 'classic'


def test_clean_key_is_the_gate_used_by_validation():
    assert pdf_themes.clean_key('invoice', ' t3_minimal ') == 't3_minimal'
    assert pdf_themes.clean_key('invoice', '') is None
    assert pdf_themes.clean_key('invoice', None) is None
    assert pdf_themes.clean_key('invoice', 'q1_classic') is None


def test_resolve_path_maps_every_approved_key_to_its_template(ctx):
    for doc_type, registry in pdf_themes.REGISTRIES.items():
        for key in pdf_themes.allowed_keys(doc_type):
            assert pdf_themes.resolve_path(doc_type, key) == registry[key][0]


def test_resolve_path_never_leaves_the_registry(ctx):
    """Whatever comes in, the result is a real registered file."""
    from pathlib import Path
    from flask import current_app

    templates = Path(current_app.template_folder)
    for doc_type in ('invoice', 'quotation'):
        for candidate in (None, '', 'junk', 'classic', 't3_minimal', 'q1_classic'):
            assert (templates / pdf_themes.resolve_path(doc_type, candidate)).is_file()


# ── previews ───────────────────────────────────────────────────────────

def test_preview_pages_are_reported_for_allowlisted_keys():
    """The Settings preview is driven by preview_pages on the allowlist only."""
    payload = pdf_themes.themes_json()
    for side in ('invoices', 'quotations'):
        for group in payload[side]:
            for item in group['items']:
                assert 'preview_pages' in item
                assert isinstance(item['preview_pages'], list)


def test_preview_path_refuses_an_unknown_document_type():
    assert pdf_themes.preview_path('credit_notes', 'classic_gst', 1) is None


def test_preview_path_refuses_a_unsafe_key():
    """The key is joined onto the filesystem, so it is constrained first."""
    assert pdf_themes.preview_path('invoices', '../../secrets', 1) is None
    assert pdf_themes.preview_path('invoices', 'classic_gst/../x', 1) is None


def test_preview_serves_an_allowlisted_template(login):
    resp = login.get('/api/settings/themes/preview/invoices/classic_gst/1')
    assert resp.status_code == 200, resp.get_json()
    assert resp.data[:8] == b'\x89PNG\r\n\x1a\n'


@pytest.mark.parametrize('key', EXCLUDED)
def test_preview_of_an_excluded_template_is_not_reachable(login, key):
    """_preview/ holds images for the reference templates too.

    They are deliberately left out of the allowlist, so the endpoint must not
    serve them just because the filename is known. Without this check a caller
    could fetch any preview in the directory.
    """
    resp = login.get(f'/api/settings/themes/preview/invoices/{key}/1')
    assert resp.status_code == 404, resp.data[:80]


def test_preview_of_a_missing_page_is_404(login):
    assert login.get('/api/settings/themes/preview/invoices/classic_gst/99').status_code == 404


def test_preview_requires_login(client, ctx):
    assert client.get('/api/settings/themes/preview/invoices/classic_gst/1').status_code in (302, 401)