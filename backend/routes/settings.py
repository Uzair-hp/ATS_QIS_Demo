"""
Company profile / settings (JSON).
"""

import base64
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from models import db, CompanyProfile
from pdf_themes import themes_json, preview_path

settings_bp = Blueprint('settings', __name__)

# The stamp is stored base64-encoded in a TEXT column, so an unbounded upload
# would bloat every settings response (the API returns the whole blob on every
# GET). 2 MB of PNG is far more than a scanned signature needs.
MAX_STAMP_BYTES = 2 * 1024 * 1024

# Magic bytes -> MIME. Sniffed rather than trusted from the browser, because the
# value is embedded straight into a PDF/print data URI.
_RASTER_SIGNATURES = (
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'\xff\xd8\xff', 'image/jpeg'),
    (b'GIF87a', 'image/gif'),
    (b'GIF89a', 'image/gif'),
)


def _sniff_image_mime(data):
    """Return the MIME type of `data`, or None if it is not a known image.

    SVG is accepted deliberately: the stamp is a vector asset people upload, and
    the browser print sheet renders it through the same code path as a raster.
    An SVG referenced from an <img> cannot execute script, so this is not a way
    to smuggle active content into the printed sheet.
    """
    for signature, mime in _RASTER_SIGNATURES:
        if data.startswith(signature):
            return mime
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    # An SVG may open with an XML declaration or a doctype, so look for the
    # root element within the first chunk rather than requiring it first.
    if b'<svg' in data[:512]:
        return 'image/svg+xml'
    return None


def _validate_image_upload(file_storage, label):
    """Read and validate an uploaded image.

    Returns (base64_str, mime) on success, or (None, error_response) on failure.
    """
    data = file_storage.read()
    if len(data) > MAX_STAMP_BYTES:
        return None, (jsonify({
            'error': f'{label} is too large '
                     f'({len(data) // 1024} KB). '
                     f'Maximum is {MAX_STAMP_BYTES // 1024} KB.'
        }), 400)
    if not data:
        return None, (jsonify({'error': f'{label} is empty.'}), 400)
    mime = _sniff_image_mime(data)
    if mime is None:
        return None, (jsonify({
            'error': f'{label} must be a PNG, JPEG, GIF, WebP or SVG image.'
        }), 400)
    return (base64.b64encode(data).decode('utf-8'), mime), None


def _profile_json(p):
    return {
        'name': p.name,
        'tagline': p.tagline,
        'logo_image': p.logo_image,
        'logo_mime': p.logo_mime,
        'email': p.email,
        'phone': p.phone,
        'website': p.website,
        'address': p.address,
        'upi_id': p.upi_id,
        'upi_name': p.upi_name,
        'bank_name': p.bank_name,
        'bank_account': p.bank_account,
        'bank_ifsc': p.bank_ifsc,
        'bank_branch': p.bank_branch,
        'gst_number': p.gst_number,
        'msme_number': p.msme_number,
        'stamp_image': p.stamp_image,
        'stamp_mime': p.stamp_mime,
        'default_gst_percent': p.default_gst_percent,
        'default_terms': p.default_terms,
        'default_quotation_terms': p.default_quotation_terms,
        'default_due_days': p.default_due_days,
        'invoice_pdf_theme': p.invoice_pdf_theme,
        'quotation_pdf_theme': p.quotation_pdf_theme,
    }


@settings_bp.route('/', methods=['GET'])
@login_required
def company_settings():
    profile = CompanyProfile.get_profile()
    return jsonify(_profile_json(profile))


@settings_bp.route('/themes', methods=['GET'])
@login_required
def get_themes():
    return jsonify(themes_json())


@settings_bp.route('/themes/preview/<doc>/<key>/<int:page>', methods=['GET'])
@login_required
def theme_preview(doc, key, page):
    """Serve a pre-rendered preview image for a PDF theme.

    The key is validated against a safe pattern inside preview_path, so
    the URL cannot escape the _preview directory.
    """
    path = preview_path(doc, key, page)
    if not path:
        return jsonify({'error': 'preview not available'}), 404
    return send_file(path, mimetype='image/png')


@settings_bp.route('/', methods=['POST', 'PUT'])
@login_required
def update_settings():
    profile = CompanyProfile.get_profile()

    if request.is_json:
        data = request.get_json(silent=True) or {}
        stamp_file = None
        logo_file = None
    else:
        data = request.form
        stamp_file = request.files.get('stamp_image')
        logo_file = request.files.get('logo_image')

    def g(key, default=''):
        return (data.get(key) if data.get(key) is not None else default)

    profile.name = str(g('name', profile.name)).strip() or profile.name
    profile.tagline = str(g('tagline')).strip()
    profile.email = str(g('email')).strip()
    profile.phone = str(g('phone')).strip()
    profile.website = str(g('website')).strip()
    profile.address = str(g('address')).strip()
    profile.upi_id = str(g('upi_id')).strip()
    profile.upi_name = str(g('upi_name')).strip()
    profile.bank_name = str(g('bank_name')).strip()
    profile.bank_account = str(g('bank_account')).strip()
    profile.bank_ifsc = str(g('bank_ifsc')).strip()
    profile.bank_branch = str(g('bank_branch')).strip()
    profile.gst_number = str(g('gst_number')).strip()
    profile.msme_number = str(g('msme_number')).strip()
    try:
        profile.default_gst_percent = float(g('default_gst_percent', 18.0))
    except (ValueError, TypeError):
        profile.default_gst_percent = 18.0
    profile.default_terms = str(g('default_terms')).strip()
    profile.default_quotation_terms = str(g('default_quotation_terms')).strip()
    profile.invoice_pdf_theme = str(g('invoice_pdf_theme', 'classic_gst')).strip()
    profile.quotation_pdf_theme = str(g('quotation_pdf_theme', 'classic')).strip()

    if logo_file and logo_file.filename:
        result, error = _validate_image_upload(logo_file, 'Logo')
        if error:
            return error
        profile.logo_image, profile.logo_mime = result
    elif str(g('remove_logo', '')) == '1':
        profile.logo_image = None
        profile.logo_mime = None

    if stamp_file and stamp_file.filename:
        result, error = _validate_image_upload(stamp_file, 'Stamp')
        if error:
            return error
        profile.stamp_image, profile.stamp_mime = result
    elif str(g('remove_stamp', '')) == '1':
        profile.stamp_image = None
        profile.stamp_mime = None

    try:
        profile.default_due_days = int(g('default_due_days', 15))
    except (ValueError, TypeError):
        profile.default_due_days = 15

    db.session.commit()
    return jsonify(_profile_json(profile))


@settings_bp.route('/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json(silent=True) or request.form
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    if not current_user.check_password(old_password or ''):
        return jsonify({'error': 'Incorrect current password.'}), 400
    if new_password != confirm_password:
        return jsonify({'error': 'New passwords do not match.'}), 400
    if not new_password or len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    current_user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully!'})


@settings_bp.route('/wipe-data', methods=['POST'])
@login_required
def wipe_data():
    from models import Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem
    data = request.get_json(silent=True) or request.form
    confirm = data.get('confirm_wipe')
    if confirm != 'DELETE ALL DATA':
        return jsonify({'error': 'Data wipe cancelled. You must type "DELETE ALL DATA" exactly.'}), 400

    try:
        db.session.query(InvoiceItem).delete()
        db.session.query(Invoice).delete()
        db.session.query(QuotationItem).delete()
        db.session.query(Quotation).delete()
        db.session.query(Client).delete()
        db.session.query(Service).delete()
        db.session.commit()
        return jsonify({'message': 'System reset successful. All business data has been wiped.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error wiping data: {e}'}), 500
