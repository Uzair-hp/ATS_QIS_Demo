"""
PDF template catalogue.

This used to map a key to a Jinja file on disk, because the server rendered the
document with xhtml2pdf. It no longer does: the document is rendered in the
browser by a React component chosen in frontend/src/templates/registry.js, so
this file is only the list of keys the API will accept and the labels the
selectors show.

That split is deliberate and each side is guarded. Here, a key is accepted only
if it is on this document type's allowlist, so a quotation key can never be
saved on an invoice. There, every key offered here must resolve to a component,
which `missingKeys` and the frontend test suite enforce. A key added in one
place without the other fails loudly instead of quietly falling back.

The keys are unchanged from the Jinja era on purpose: they are already stored in
invoices.pdf_theme / quotations.pdf_theme and in the company defaults, so
renaming them would need a data migration for no benefit.
"""

# key -> (label, category, description)
INVOICE_THEMES = {
    'classic_gst': (
        'Original',
        'Default',
        'Dense bordered layout. Safest for CA / filing.',
    ),
    't2_letterhead': (
        'Letterhead',
        'Professional',
        'Full-bleed blue band with the logo on it.',
    ),
    't4_corporate_slate': (
        'Corporate Slate',
        'Professional',
        'Navy hero panel and cards. Enterprise B2B feel.',
    ),
    't3_minimal': (
        'Minimal',
        'Modern',
        'No boxes, hairline rules, lots of whitespace.',
    ),
    't5_compact_dense': (
        'Compact Dense',
        'Compact',
        'Tight leading, minimal chrome - fits long item lists per page.',
    ),
}

QUOTATION_THEMES = {
    'classic': (
        'Original',
        'Default',
        'Original boxed layout under an ATS blue band.',
    ),
    'q1_classic': (
        'Classic',
        'Professional',
        'ATS blue, with GST rows, HSN column and subject/delivery/terms.',
    ),
    'q2_proposal': (
        'Proposal',
        'Specialised',
        'Pitch-style navy hero, scope-first framing.',
    ),
    'q3_minimal': (
        'Minimal',
        'Modern',
        'Clean hairlines, ATS blue accents, generous whitespace.',
    ),
    'q4_compact': (
        'Compact',
        'Compact',
        'Dense single-page layout for long item lists (AMC renewals etc).',
    ),
}

# The original templates stay the default so documents generated before the
# theme system existed keep rendering the way they always have.
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

# Display order. The default is first in both lists and is labelled as the
# company standard, so it is the value a fresh selector shows before anything
# has been chosen.
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


def themes_json():
    """The allowlisted themes for the frontend, grouped by category."""
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
