"""Guards for the PDF theme registry.

The registry itself is dormant - no route resolves a theme yet - so these tests
exist to pin the one thing that would quietly change every existing document:
which template an unselected download resolves to.
"""

import pdf_themes


def test_original_templates_are_the_defaults():
    """The pre-theme templates must stay the fallback.

    If this drifts, every quotation and invoice generated without an explicit
    theme changes appearance, including documents that already exist.
    """
    assert pdf_themes.DEFAULT_INVOICE_THEME == 'classic_gst'
    assert pdf_themes.DEFAULT_QUOTATION_THEME == 'classic'


def test_defaults_point_at_the_original_template_files():
    """Not just the right key - the right file on disk."""
    assert pdf_themes.INVOICE_THEMES[pdf_themes.DEFAULT_INVOICE_THEME][0] == \
        'invoices/pdf_template.html'
    assert pdf_themes.QUOTATION_THEMES[pdf_themes.DEFAULT_QUOTATION_THEME][0] == \
        'quotations/pdf_template.html'


def test_resolve_without_a_request_uses_the_default():
    assert pdf_themes.resolve(
        pdf_themes.INVOICE_THEMES, None, pdf_themes.DEFAULT_INVOICE_THEME
    ) == 'invoices/pdf_template.html'
    assert pdf_themes.resolve(
        pdf_themes.QUOTATION_THEMES, None, pdf_themes.DEFAULT_QUOTATION_THEME
    ) == 'quotations/pdf_template.html'


def test_resolve_ignores_an_unknown_key():
    """A bad ?theme= value falls back; it must never raise."""
    assert pdf_themes.resolve(
        pdf_themes.INVOICE_THEMES, 'does-not-exist', pdf_themes.DEFAULT_INVOICE_THEME
    ) == 'invoices/pdf_template.html'


def test_resolve_honours_a_known_key():
    assert pdf_themes.resolve(
        pdf_themes.INVOICE_THEMES, 't3_minimal', pdf_themes.DEFAULT_INVOICE_THEME
    ) == 'invoices/themes/t3_minimal.html'


def test_every_registered_theme_file_exists(ctx):
    """A registry entry pointing at a missing file is a 500 on download."""
    from pathlib import Path

    from flask import current_app

    templates = Path(current_app.template_folder)
    for registry in (pdf_themes.INVOICE_THEMES, pdf_themes.QUOTATION_THEMES):
        for key, entry in registry.items():
            assert (templates / entry[0]).is_file(), f'{key} -> {entry[0]} is missing'


def test_themes_json_reports_the_originals_as_default(ctx):
    payload = pdf_themes.themes_json()
    assert payload['default_invoice'] == 'classic_gst'
    assert payload['default_quotation'] == 'classic'
    assert payload['invoices'][0]['key'] == 'classic_gst'
    assert payload['quotations'][0]['key'] == 'classic'