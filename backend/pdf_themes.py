"""
PDF theme registry.

A "theme" is nothing but a Jinja template under
`templates/<doc>/themes/<id>.html`. Every theme is handed the SAME data
contract, so swapping a theme never changes what data is available:

  invoice     → invoice, logo_base64, qr_base64, profile
  quotation   → quotation, logo_base64, profile        (no QR — nothing to pay yet)

Add a new theme by dropping a file in the themes folder and listing it here.

Two layers, deliberately
------------------------
INVOICE_THEMES / QUOTATION_THEMES are the full catalogue — everything that can
be rendered, including templates kept only as reference (t1, t6-t11).

USER_THEMES is the smaller allowlist of what the UI is allowed to offer. Keeping
them separate means a template can stay in the repo and be rendered by hand
without appearing in a user's dropdown, and adding a template file by itself
never silently exposes it.

Resolution order for a download (first valid wins):

  1. ?theme=<key>       one-time override from the URL, never persisted
  2. document.pdf_theme  the template saved on that invoice/quotation
  3. profile.*_pdf_theme the company default from Printing Settings
  4. DEFAULT_*_THEME     the original template

A key that is unknown, blank, or belongs to the other document type is skipped
at every level and the next one is used. This means the original template is
always reachable, whatever is in the database.
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

REGISTRIES = {
    'invoice': INVOICE_THEMES,
    'quotation': QUOTATION_THEMES,
}

DEFAULTS = {
    'invoice': DEFAULT_INVOICE_THEME,
    'quotation': DEFAULT_QUOTATION_THEME,
}

# doc_type → [(key, name, category), ...] in display order. The default is first
# in both lists and is labelled as the company standard, so it is the value a
# fresh selector shows before anything is chosen.
USER_THEMES = {
    'invoice': [
        ('classic_gst', 'Original', 'Default'),
        ('t2_letterhead', 'Letterhead', 'Professional'),
        ('t4_corporate_slate', 'Corporate Slate', 'Professional'),
        ('t3_minimal', 'Minimal', 'Modern'),
        ('t5_compact_dense', 'Compact Dense', 'Compact'),
    ],
    'quotation': [
        ('classic', 'Original', 'Default'),
        ('q1_classic', 'Classic', 'Professional'),
        ('q2_proposal', 'Proposal', 'Specialised'),
        ('q3_minimal', 'Minimal', 'Modern'),
        ('q4_compact', 'Compact', 'Compact'),
    ],
}

def default_theme(doc_type):
    return DEFAULTS[doc_type]


def allowed_keys(doc_type):
    """The keys the UI may offer for this document type, in display order."""
    return [key for key, _label, _category in USER_THEMES[doc_type]]


def is_allowed(doc_type, key):
    """True only for a key on this document type's allowlist."""
    return bool(key) and key in allowed_keys(doc_type)


def clean_key(doc_type, key):
    """Return a valid allowlisted key, or None.

    A blank value, an unknown key, and a key belonging to the other document
    type all collapse to None so the caller falls through to the next level.
    """
    if not key:
        return None
    key = str(key).strip()
    return key if is_allowed(doc_type, key) else None


def resolve_key(doc_type, *candidates):
    """First valid candidate for `doc_type`, else the original default."""
    for candidate in candidates:
        key = clean_key(doc_type, candidate)
        if key:
            return key
    return DEFAULTS[doc_type]


def resolve_path(doc_type, *candidates):
    """Template path for the winning key."""
    return REGISTRIES[doc_type][resolve_key(doc_type, *candidates)][0]


def themes_json():
    """The allowlisted themes for the frontend, grouped by category.

    Only allowlisted keys appear: t1 and t6-t11 stay in the repo and remain
    renderable by hand, but they are never offered or accepted from the API.
    """
    def groups(doc_type):
        out = []
        for key, name, category in USER_THEMES[doc_type]:
            entry = {
                'key': key,
                'label': (DEFAULTS[doc_type] == key) and 'Default (Company Standard)'
                         or name,
                'description': REGISTRIES[doc_type][key][2],
                'category': category,
            }
            if out and out[-1]['category'] == category:
                out[-1]['items'].append(entry)
            else:
                out.append({'category': category, 'items': [entry]})
        return out

    return {
        'invoices': groups('invoice'),
        'quotations': groups('quotation'),
        'default_invoice': DEFAULT_INVOICE_THEME,
        'default_quotation': DEFAULT_QUOTATION_THEME,
    }
