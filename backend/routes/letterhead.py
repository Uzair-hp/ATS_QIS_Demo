"""
Blank company letterhead PDF.

Same header and footer as the quotation and invoice PDFs, empty body - for
letters, hand-written notes, and anything else that needs to go out on the ATS
letterhead without carrying a client, items or totals.

Shares the PDF assets and the chrome macros with the other templates, so a
change to the swoosh or footer reaches all three.
"""

import io

from flask import Blueprint, current_app, jsonify, make_response, render_template
from flask_login import login_required

from models import CompanyProfile
from routes.pdf_assets import get_pdf_assets

letterhead_bp = Blueprint('letterhead', __name__)


@letterhead_bp.route('/download')
@login_required
def download_letterhead():
    profile = CompanyProfile.get_profile()

    html_string = render_template(
        'letterhead/pdf_template.html',
        profile=profile,
        **get_pdf_assets(),
    )

    try:
        from xhtml2pdf import pisa
        result_buf = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(html_string), dest=result_buf)
        if pisa_status.err:
            return jsonify({'error': 'PDF generation encountered errors.'}), 500
        pdf_bytes = result_buf.getvalue()
    except Exception as e:
        current_app.logger.exception('Letterhead PDF generation failed')
        return jsonify({'error': f'PDF generation failed: {e}'}), 500

    response = make_response(pdf_bytes)
    response.headers['Content-Type'] = 'application/pdf'
    safe_name = (profile.name or 'letterhead').replace(' ', '-')
    response.headers['Content-Disposition'] = f'attachment; filename={safe_name}-letterhead.pdf'
    return response
