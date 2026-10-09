"""
PDF rendering.

Why there are no @frame rules here
----------------------------------
xhtml2pdf's `@frame` support positions content precisely, but it does NOT
paginate. Content taller than the frame simply bleeds outside it and paints
over the header/footer band, silently, with no error and no warning. Verified
on xhtml2pdf 0.2.21: 60 paragraphs (2 pages' worth) inside a framed layout
still produced a single page with text drawn from y=-3 to y=762.

So every theme uses a plain `@page { size: a4 portrait; margin: ... }` and the
header/footer flow inline at the top and bottom of the body. That always
paginates correctly, and `repeat="1"` on the items table still repeats the
column headings across pages.

The only thing given up is the letterhead repeating on page 2+ — worth it,
because the alternative was unreadable output.
"""

import io

from flask import render_template
from xhtml2pdf import pisa


def render_pdf(template_path, **ctx):
    """Render a PDF theme to bytes. Raises on template/render failure."""
    source = render_template(template_path, **ctx)
    buf = io.BytesIO()
    pisa.CreatePDF(io.StringIO(source), dest=buf)
    return buf.getvalue()