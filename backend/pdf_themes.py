"""
PDF theme registry.

A "theme" is nothing but a Jinja template under
`templates/<doc>/themes/<id>.html`. Every theme is handed the SAME data
contract, so swapping a theme never changes what data is available:

  invoice     → invoice, logo_base64, qr_base64, profile
  quotation   → quotation, logo_base64, profile        (no QR — nothing to pay yet)

Add a new theme by dropping a file in the themes folder and listing it here.
"""

# key → (template path, human label, description)
INVOICE_THEMES = {
    'classic_gst': (
        'invoices/pdf_template.html',
        'Classic GST',
        'Original dense bordered layout. Safest for CA / filing. ATS blue.',
    ),
    't1_classic_gst': (
        'invoices/themes/t1_classic_gst.html',
        'T1 · Classic GST',
        'Refined classic: adds amount-in-words, notes block, inline item subtotal.',
    ),
    't2_letterhead': (
        'invoices/themes/t2_letterhead.html',
        'T2 · Letterhead',
        'Matches the Fortis Hospital reference: blue band header, subject banner, blue footer.',
    ),
    't3_minimal': (
        'invoices/themes/t3_minimal.html',
        'T3 · Minimal',
        'No boxes, hairline rules, lots of whitespace. Premium / white-glove feel.',
    ),
    't4_corporate_slate': (
        'invoices/themes/t4_corporate_slate.html',
        'T4 · Corporate Slate',
        'Navy + blue, status badges, card panels. Enterprise B2B feel.',
    ),
    't5_compact_dense': (
        'invoices/themes/t5_compact_dense.html',
        'T5 · Compact Dense',
        'Tight leading, minimal chrome — fits 40+ line items per page.',
    ),
    't6_amber_accent': (
        'invoices/themes/t6_amber_accent.html',
        'T6 · Amber Accent',
        'Warm amber/cream. Friendly for small & retail clients.',
    ),
    't7_ledger': (
        'invoices/themes/t7_ledger.html',
        'T7 · Ledger',
        'Monospace accounting register look, full ruled borders.',
    ),
    't8_mono_bw': (
        'invoices/themes/t8_mono_bw.html',
        'T8 · Mono B/W',
        'Pure black & white — survives fax / photocopy / thermal reprint.',
    ),
    't9_legal_compliance': (
        'invoices/themes/t9_legal_compliance.html',
        'T9 · Legal Compliance',
        'Adds CGST/SGST split, UOM column, declaration & jurisdiction text.',
    ),
    't10_modern_saas': (
        'invoices/themes/t10_modern_saas.html',
        'T10 · Modern SaaS',
        'Teal hero, chips, cards. Best when invoices are sent digitally.',
    ),
    't11_retail_pos': (
        'invoices/themes/t11_retail_pos.html',
        'T11 · Retail POS',
        'Total amount shown huge at the top. Good for counter / site handover.',
    ),
}

QUOTATION_THEMES = {
    'classic': (
        'quotations/pdf_template.html',
        'Classic (original)',
        'Original quotation layout — note it still uses the old indigo brand colour.',
    ),
    'q1_classic': (
        'quotations/themes/q1_classic.html',
        'Q1 · Classic',
        'ATS blue, with GST rows, HSN column, subject/delivery/terms included.',
    ),
    'q2_proposal': (
        'quotations/themes/q2_proposal.html',
        'Q2 · Proposal',
        'Pitch-style navy layout, timeline block, scope-first framing.',
    ),
    'q3_minimal': (
        'quotations/themes/q3_minimal.html',
        'Q3 · Minimal',
        'Clean hairlines, ATS blue accents, generous whitespace.',
    ),
    'q4_compact': (
        'quotations/themes/q4_compact.html',
        'Q4 · Compact',
        'Dense single-page layout for long item lists (AMC renewals etc).',
    ),
}

# The original templates stay the default so that documents generated before the
# theme system existed keep rendering byte-identically.
DEFAULT_INVOICE_THEME = 'classic_gst'
DEFAULT_QUOTATION_THEME = 'classic'


def resolve(registry, requested, fallback):
    """Return the template path for `requested`, or the fallback if unknown."""
    if requested and requested in registry:
        return registry[requested][0]
    return registry[fallback][0]


def themes_json():
    """Serialisable theme list for the frontend settings page."""
    return {
        'invoices': [{'key': k, 'label': v[1], 'description': v[2]} for k, v in INVOICE_THEMES.items()],
        'quotations': [{'key': k, 'label': v[1], 'description': v[2]} for k, v in QUOTATION_THEMES.items()],
        'default_invoice': DEFAULT_INVOICE_THEME,
        'default_quotation': DEFAULT_QUOTATION_THEME,
    }