"""
Quotations routes — JSON CRUD, status, duplicate/revisions, convert to invoice, PDF, CSV.
"""

import io
import os
import base64
import re
import csv
from datetime import datetime, timedelta
from urllib.parse import quote

from flask import (
    Blueprint, request, jsonify, current_app, make_response, render_template
)
from flask_login import login_required
from models import db, Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem, CompanyProfile, now_ist, IST
from routes.validation import (
    validate_client_id, validate_discount, validate_gst_percent,
    validate_valid_days, parse_item_quantity, parse_item_rate,
    validate_item_name, validation_error_response
)

quotations_bp = Blueprint('quotations', __name__)


# ── Helpers ───────────────────────────────────────────

def generate_quotation_number():
    year = datetime.now().year
    pattern = f'ATS-QT-{year}-%'
    quotes = (
        Quotation.query
        .filter(Quotation.quotation_number.like(pattern))
        .order_by(Quotation.id.desc())
        .all()
    )
    max_seq = 0
    for q in quotes:
        base_num = re.sub(r'-R\d+$', '', q.quotation_number)
        match = re.search(r'(\d+)$', base_num)
        if match:
            seq = int(match.group(1))
            if seq > max_seq:
                max_seq = seq
    return f'ATS-QT-{year}-{(max_seq + 1):03d}'


def get_logo_base64():
    logo_path = os.path.join(current_app.static_folder, 'img', 'logo.png')
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return ''


def _calc_totals(sub_total, discount_val, discount_type, gst_percent=0.0):
    if discount_type == 'percent':
        disc_amt = round(sub_total * discount_val / 100, 2)
    else:
        disc_amt = round(discount_val, 2)
    net = max(round(sub_total - disc_amt, 2), 0)
    gst_amt = round(net * gst_percent / 100, 2) if gst_percent else 0.0
    total = round(net + gst_amt, 2)
    return disc_amt, gst_amt, total


def _build_items(parent, item_names, item_descs, item_qtys, item_rates, item_hsns, item_cls):
    sub_total = 0.0
    for name, desc, qty, rate, hsn in zip(item_names, item_descs, item_qtys, item_rates, item_hsns):
        name = name.strip()
        if not name:
            continue
        # Values are pre-validated; no silent fallbacks
        amount = round(qty * rate, 2)
        sub_total += amount
        parent.items.append(item_cls(
            service_name=name, description=desc.strip() or None,
            hsn_code=hsn.strip() or None,
            quantity=qty, rate=rate, amount=amount
        ))
    return sub_total


def _get_items_payload(data):
    items = data.get('items', [])
    names = [i.get('name', '') for i in items]
    descs = [i.get('description', '') for i in items]
    qtys = [i.get('quantity', 1) for i in items]
    rates = [i.get('rate', 0) for i in items]
    hsns = [i.get('hsn_code', '') for i in items]
    return names, descs, qtys, rates, hsns


def _quotation_json(q, detailed=False):
    data = {
        'id': q.id,
        'quotation_number': q.quotation_number,
        'client_id': q.client_id,
        'client_name': q.client.name if q.client else '',
        'date_created': q.date_created.isoformat() if q.date_created else None,
        'valid_until': q.valid_until.isoformat() if q.valid_until else None,
        'estimated_timeline': q.estimated_timeline,
        'sub_total': q.sub_total,
        'discount': q.discount,
        'discount_type': q.discount_type,
        'discount_amount': q.discount_amount,
        'total_amount': q.total_amount,
        'status': q.status,
        'notes': q.notes,
        'is_archived': q.is_archived,
        'subject': q.subject,
        'delivery_address': q.delivery_address,
        'payment_terms': q.payment_terms,
        'gst_percent': q.gst_percent,
        'gst_amount': q.gst_amount,
        'is_expired': q.is_expired,
    }
    if detailed:
        data['items'] = [
            {
                'id': it.id,
                'service_name': it.service_name,
                'hsn_code': it.hsn_code,
                'description': it.description,
                'quantity': it.quantity,
                'rate': it.rate,
                'amount': it.amount,
            } for it in q.items
        ]
        data['client'] = {
            'id': q.client.id,
            'name': q.client.name,
            'company_name': q.client.company_name,
            'email': q.client.email,
            'phone': q.client.phone,
            'address': q.client.address,
            'gst_number': q.client.gst_number,
        } if q.client else None
    return data


def _query_quotations():
    search = request.args.get('q', '').strip()
    status_filter = request.args.get('status', '').strip()

    query = Quotation.query
    if search:
        query = query.filter(
            db.or_(
                Quotation.quotation_number.ilike(f'%{search}%'),
                Quotation.client.has(Client.name.ilike(f'%{search}%'))
            )
        )
    if status_filter == 'Archived':
        query = query.filter(Quotation.is_archived == True)
    else:
        query = query.filter(Quotation.is_archived == False)
        if status_filter in ('Draft', 'Sent', 'Accepted', 'Declined', 'Invoiced', 'Expired'):
            query = query.filter(Quotation.status == status_filter)
    return query, search, status_filter


# ── LIST / EXPORT / META ──────────────────────────────

@quotations_bp.route('/')
@login_required
def list_quotations():
    query, search, status_filter = _query_quotations()
    quotations = query.order_by(Quotation.date_created.desc()).all()
    return jsonify({
        'quotations': [_quotation_json(q) for q in quotations],
        'search': search,
        'status_filter': status_filter,
    })


@quotations_bp.route('/export')
@login_required
def export_quotations():
    query, _, _ = _query_quotations()
    quotations = query.order_by(Quotation.date_created.desc()).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Quotation Number', 'Client Name', 'Date Created', 'Valid Until', 'Estimated Timeline', 'Total Amount', 'Status'])

    for q in quotations:
        valid_until = q.valid_until.strftime('%Y-%m-%d') if q.valid_until else ''
        cw.writerow([
            q.quotation_number,
            q.client.name if q.client else '',
            q.date_created.strftime('%Y-%m-%d'),
            valid_until,
            q.estimated_timeline or '',
            f"{q.total_amount:.2f}",
            q.status
        ])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=quotations_export.csv"
    output.headers["Content-type"] = "text/csv"
    return output


@quotations_bp.route('/meta')
@login_required
def quotation_meta():
    clients = Client.query.filter_by(is_archived=False).order_by(Client.name).all()
    services = Service.query.order_by(Service.name).all()
    profile = CompanyProfile.get_profile()
    return jsonify({
        'clients': [{'id': c.id, 'name': c.name} for c in clients],
        'services': [{'id': s.id, 'name': s.name, 'description': s.description or '', 'hsn_code': s.hsn_code or '', 'base_price': s.base_price} for s in services],
        'company': {
            'name': profile.name,
            'default_gst_percent': profile.default_gst_percent,
            'default_quotation_terms': profile.default_quotation_terms,
        },
    })


# ── CREATE ────────────────────────────────────────────

@quotations_bp.route('/', methods=['POST'])
@login_required
def create_quotation():
    data = request.get_json(silent=True) or request.form
    client_id = data.get('client_id')

    if request.is_json:
        item_names, item_descs, item_qtys, item_rates, item_hsns = _get_items_payload(data)
    else:
        item_names = request.form.getlist('item_name[]')
        item_descs = request.form.getlist('item_desc[]')
        item_qtys = request.form.getlist('item_qty[]')
        item_rates = request.form.getlist('item_rate[]')
        item_hsns = request.form.getlist('item_hsn[]')
        if not item_descs or len(item_descs) != len(item_names):
            item_descs = [''] * len(item_names)
        if not item_hsns or len(item_hsns) != len(item_names):
            item_hsns = [''] * len(item_names)

    if not client_id:
        return validation_error_response('Please select a client.')
    if not item_names or not any(str(n).strip() for n in item_names):
        return validation_error_response('Please add at least one line item.')

    # Validate client_id
    try:
        client_id = validate_client_id(client_id)
    except ValueError as e:
        return validation_error_response(str(e))

    profile = CompanyProfile.get_profile()

    # Validate discount
    try:
        discount_val = validate_discount(data.get('discount'), data.get('discount_type', 'flat'))
    except ValueError as e:
        return validation_error_response(str(e))
    discount_type = data.get('discount_type', 'flat')
    estimated_timeline = (data.get('estimated_timeline') or '').strip()
    notes = (data.get('notes') or '').strip()

    # Validate valid_days
    try:
        valid_days = validate_valid_days(data.get('valid_days'))
    except ValueError as e:
        return validation_error_response(str(e))

    subject = (data.get('subject') or '').strip() or None
    delivery_address = (data.get('delivery_address') or '').strip() or None
    payment_terms = (data.get('payment_terms') or '').strip() or None

    # Validate gst_percent
    try:
        gst_percent = validate_gst_percent(data.get('gst_percent'))
    except ValueError as e:
        return validation_error_response(str(e))

    now = now_ist()
    quotation = Quotation(
        quotation_number=generate_quotation_number(),
        client_id=client_id,
        date_created=now,
        valid_until=now + timedelta(days=valid_days),
        estimated_timeline=estimated_timeline,
        discount=discount_val,
        discount_type=discount_type,
        status='Draft',
        notes=notes or profile.default_quotation_terms,
        subject=subject,
        delivery_address=delivery_address,
        payment_terms=payment_terms,
        gst_percent=gst_percent,
    )

    # Validate and build items
    try:
        item_names = [validate_item_name(n) for n in item_names]
        item_qtys = [parse_item_quantity(q) for q in item_qtys]
        item_rates = [parse_item_rate(r) for r in item_rates]
    except ValueError as e:
        return validation_error_response(str(e))

    sub_total = _build_items(quotation, item_names, item_descs, item_qtys, item_rates, item_hsns, QuotationItem)
    quotation.sub_total = round(sub_total, 2)
    quotation.discount_amount, quotation.gst_amount, quotation.total_amount = _calc_totals(
        sub_total, discount_val, discount_type, gst_percent
    )

    db.session.add(quotation)
    db.session.commit()
    return jsonify(_quotation_json(quotation, detailed=True)), 201


# ── VIEW ──────────────────────────────────────────────

@quotations_bp.route('/<int:id>')
@login_required
def view_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    profile = CompanyProfile.get_profile()

    valid_date_str = quotation.valid_until.strftime('%d %b %Y') if quotation.valid_until else 'N/A'
    msg_text = (
        f"Dear {quotation.client.name},\n\n"
        f"Please find below the quotation summary ({quotation.quotation_number}) from {profile.name}.\n\n"
        f"Quotation Summary:\n"
        f"• Total Amount: ₹{'{:,.2f}'.format(quotation.total_amount)}\n"
        f"• Estimated Timeline: {quotation.estimated_timeline or 'N/A'}\n"
        f"• Valid Until: {valid_date_str}\n\n"
        f"Kindly review the details. Please let us know if you require any adjustments.\n\n"
        f"Thank you!\n\n"
        f"Best regards,\n"
        f"{profile.name}"
    )

    whatsapp_url = ""
    if quotation.client.phone:
        clean_phone = ''.join(filter(str.isdigit, quotation.client.phone))
        whatsapp_url = f"https://wa.me/{clean_phone}?text={quote(msg_text)}"

    subject = f"Project Quotation {quotation.quotation_number} from {profile.name}"
    email_url = ""
    if quotation.client.email:
        email_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={quotation.client.email}&su={quote(subject)}&body={quote(msg_text)}"

    return jsonify({
        **_quotation_json(quotation, detailed=True),
        'logo_base64': get_logo_base64(),
        'whatsapp_url': whatsapp_url,
        'email_url': email_url,
        'profile': {
            'name': profile.name,
            'tagline': profile.tagline,
            'email': profile.email,
            'phone': profile.phone,
            'address': profile.address,
        },
    })


# ── EDIT ──────────────────────────────────────────────

@quotations_bp.route('/<int:id>', methods=['PUT'])
@login_required
def edit_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    if quotation.status in ('Accepted', 'Invoiced'):
        return validation_error_response('Accepted or Invoiced quotations cannot be edited.')

    data = request.get_json(silent=True) or request.form
    client_id = data.get('client_id')
    if not client_id:
        return validation_error_response('Please select a client.')

    # Validate client_id
    try:
        client_id = validate_client_id(client_id)
    except ValueError as e:
        return validation_error_response(str(e))
    quotation.client_id = client_id

    # Validate discount
    try:
        discount_val = validate_discount(data.get('discount'), data.get('discount_type', 'flat'))
    except ValueError as e:
        return validation_error_response(str(e))
    quotation.discount = discount_val
    quotation.discount_type = data.get('discount_type', 'flat')
    quotation.estimated_timeline = (data.get('estimated_timeline') or '').strip()
    quotation.notes = (data.get('notes') or '').strip()
    quotation.subject = (data.get('subject') or '').strip() or None
    quotation.delivery_address = (data.get('delivery_address') or '').strip() or None
    quotation.payment_terms = (data.get('payment_terms') or '').strip() or None

    # Validate gst_percent
    try:
        quotation.gst_percent = validate_gst_percent(data.get('gst_percent'))
    except ValueError as e:
        return validation_error_response(str(e))

    # Validate valid_days
    try:
        valid_days = validate_valid_days(data.get('valid_days'))
    except ValueError as e:
        return validation_error_response(str(e))
    quotation.valid_until = quotation.date_created + timedelta(days=valid_days)

    QuotationItem.query.filter_by(quotation_id=quotation.id).delete()

    if request.is_json:
        item_names, item_descs, item_qtys, item_rates, item_hsns = _get_items_payload(data)
    else:
        item_names = request.form.getlist('item_name[]')
        item_descs = request.form.getlist('item_desc[]')
        item_qtys = request.form.getlist('item_qty[]')
        item_rates = request.form.getlist('item_rate[]')
        item_hsns = request.form.getlist('item_hsn[]')
        if not item_descs or len(item_descs) != len(item_names):
            item_descs = [''] * len(item_names)
        if not item_hsns or len(item_hsns) != len(item_names):
            item_hsns = [''] * len(item_names)

    # Validate and build items
    try:
        item_names = [validate_item_name(n) for n in item_names]
        item_qtys = [parse_item_quantity(q) for q in item_qtys]
        item_rates = [parse_item_rate(r) for r in item_rates]
    except ValueError as e:
        return validation_error_response(str(e))

    sub_total = _build_items(quotation, item_names, item_descs, item_qtys, item_rates, item_hsns, QuotationItem)
    quotation.sub_total = round(sub_total, 2)
    quotation.discount_amount, quotation.gst_amount, quotation.total_amount = _calc_totals(
        sub_total, discount_val, quotation.discount_type, quotation.gst_percent
    )

    db.session.commit()
    return jsonify(_quotation_json(quotation, detailed=True))


# ── STATUS ────────────────────────────────────────────

@quotations_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def update_status(id):
    quotation = Quotation.query.get_or_404(id)
    data = request.get_json(silent=True) or request.form
    new_status = data.get('status')

    if new_status in ('Draft', 'Sent', 'Accepted', 'Declined', 'Expired'):
        quotation.status = new_status
        db.session.commit()
        return jsonify(_quotation_json(quotation, detailed=True))
    return jsonify({'error': 'Invalid status operation.'}), 400


# ── DUPLICATE ─────────────────────────────────────────

@quotations_bp.route('/<int:id>/duplicate', methods=['POST'])
@login_required
def duplicate_quotation(id):
    original = Quotation.query.get_or_404(id)
    base_num = re.sub(r'-R\d+$', '', original.quotation_number)

    revisions = (
        Quotation.query
        .filter(Quotation.quotation_number.like(f'{base_num}%'))
        .all()
    )
    max_rev = 0
    for r in revisions:
        match = re.search(r'-R(\d+)$', r.quotation_number)
        if match:
            rev = int(match.group(1))
            if rev > max_rev:
                max_rev = rev

    new_num = f"{base_num}-R{max_rev + 1}"
    now = now_ist()
    new_quote = Quotation(
        quotation_number=new_num,
        client_id=original.client_id,
        date_created=now,
        valid_until=now + timedelta(days=15),
        estimated_timeline=original.estimated_timeline,
        sub_total=original.sub_total,
        discount=original.discount,
        discount_type=original.discount_type,
        discount_amount=original.discount_amount,
        total_amount=original.total_amount,
        status='Draft',
        notes=original.notes,
        subject=original.subject,
        delivery_address=original.delivery_address,
        payment_terms=original.payment_terms,
        gst_percent=original.gst_percent,
        gst_amount=original.gst_amount,
    )

    for item in original.items:
        new_quote.items.append(QuotationItem(
            service_name=item.service_name,
            description=item.description,
            hsn_code=item.hsn_code,
            quantity=item.quantity,
            rate=item.rate,
            amount=item.amount
        ))

    db.session.add(new_quote)
    db.session.commit()
    return jsonify(_quotation_json(new_quote, detailed=True)), 201


# ── CONVERT TO INVOICE ────────────────────────────────

@quotations_bp.route('/<int:id>/convert', methods=['POST'])
@login_required
def convert_to_invoice(id):
    quotation = Quotation.query.get_or_404(id)
    if quotation.status == 'Invoiced':
        existing = Invoice.query.filter_by(ref_quotation_number=quotation.quotation_number).first()
        if existing:
            return jsonify({'error': 'Already converted.', 'invoice_id': existing.id}), 409
        return jsonify({'error': 'This quotation has already been converted to an invoice.'}), 409

    from routes.invoices import generate_invoice_number
    now = now_ist()
    profile = CompanyProfile.get_profile()

    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        client_id=quotation.client_id,
        date_created=now,
        due_date=now + timedelta(days=profile.default_due_days or 15),
        sub_total=quotation.sub_total,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        discount_amount=quotation.discount_amount,
        gst_percent=quotation.gst_percent or 0.0,
        gst_amount=quotation.gst_amount or 0.0,
        total_amount=quotation.total_amount,
        advance_amount=0.0,
        status='Pending',
        payment_mode=None,
        notes=quotation.notes or profile.default_terms,
        ref_quotation_number=quotation.quotation_number,
        subject=quotation.subject,
        delivery_address=quotation.delivery_address,
        payment_terms=quotation.payment_terms,
    )

    for item in quotation.items:
        invoice.items.append(InvoiceItem(
            service_name=item.service_name,
            description=item.description,
            hsn_code=item.hsn_code,
            quantity=item.quantity,
            rate=item.rate,
            amount=item.amount
        ))

    quotation.status = 'Invoiced'
    db.session.add(invoice)
    db.session.commit()
    return jsonify({'invoice_id': invoice.id, 'invoice_number': invoice.invoice_number}), 201


# ── ARCHIVE ───────────────────────────────────────────

@quotations_bp.route('/<int:id>/archive', methods=['POST'])
@login_required
def archive_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    quotation.is_archived = True
    db.session.commit()
    return jsonify({'message': f'Quotation {quotation.quotation_number} archived.'})


@quotations_bp.route('/<int:id>/unarchive', methods=['POST'])
@login_required
def unarchive_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    quotation.is_archived = False
    db.session.commit()
    return jsonify({'message': f'Quotation {quotation.quotation_number} restored.'})


# ── PDF ───────────────────────────────────────────────

@quotations_bp.route('/<int:id>/pdf')
@login_required
def download_pdf(id):
    quotation = Quotation.query.get_or_404(id)
    profile = CompanyProfile.get_profile()
    logo_b64 = get_logo_base64()

    html_string = render_template(
        'quotations/pdf_template.html',
        quotation=quotation,
        logo_base64=logo_b64, profile=profile,
    )

    try:
        from xhtml2pdf import pisa
        result_buf = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(html_string), dest=result_buf)
        if pisa_status.err:
            return jsonify({'error': 'PDF generation encountered errors.'}), 500
        pdf_bytes = result_buf.getvalue()
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = (
            f'attachment; filename={quotation.quotation_number}.pdf'
        )
        return response
    except Exception as e:
        return jsonify({'error': f'PDF generation failed: {e}'}), 500
