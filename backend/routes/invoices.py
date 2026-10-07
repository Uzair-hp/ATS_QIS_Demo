"""
Invoice routes — JSON CRUD, status management, PDF download, CSV export.
"""

import io
import os
import base64
import re
import csv
from datetime import datetime, timedelta

import qrcode
from flask import (
    Blueprint, request, jsonify, current_app, make_response, render_template
)
from flask_login import login_required
from models import db, Client, Service, Invoice, InvoiceItem, CompanyProfile, now_ist, IST
from routes.validation import (
    validate_client_id, validate_discount, validate_gst_percent,
    validate_due_days, validate_advance_amount, parse_item_quantity,
    parse_item_rate, validate_item_name, validation_error_response
)

invoices_bp = Blueprint('invoices', __name__)


# ── Helpers ───────────────────────────────────────────

def generate_invoice_number():
    year = datetime.now().year
    pattern = f'ATS-INV-{year}-%'
    last = (
        Invoice.query
        .filter(Invoice.invoice_number.like(pattern))
        .order_by(Invoice.id.desc())
        .first()
    )
    if last:
        match = re.search(r'(\d+)$', last.invoice_number)
        seq = int(match.group(1)) + 1 if match else 1
    else:
        old_pattern = f'BL-INV-{year}-%'
        last_old = (
            Invoice.query
            .filter(Invoice.invoice_number.like(old_pattern))
            .order_by(Invoice.id.desc())
            .first()
        )
        if last_old:
            match = re.search(r'(\d+)$', last_old.invoice_number)
            seq = int(match.group(1)) + 1 if match else 1
        else:
            seq = 1
    return f'ATS-INV-{year}-{seq:03d}'


def get_logo_base64():
    logo_path = os.path.join(current_app.static_folder, 'img', 'logo.png')
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return ''


def generate_upi_qr_base64(amount, invoice_number):
    profile = CompanyProfile.get_profile()
    upi_id = profile.upi_id or 'your-upi-id@upi'
    upi_name = profile.upi_name or profile.name
    upi_url = (
        f"upi://pay?pa={upi_id}&pn={upi_name}"
        f"&am={amount:.2f}&cu=INR&tn=Invoice%20{invoice_number}"
    )
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(upi_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


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


def _invoice_json(inv, detailed=False):
    data = {
        'id': inv.id,
        'invoice_number': inv.invoice_number,
        'client_id': inv.client_id,
        'client_name': inv.client.name if inv.client else '',
        'date_created': inv.date_created.isoformat() if inv.date_created else None,
        'due_date': inv.due_date.isoformat() if inv.due_date else None,
        'sub_total': inv.sub_total,
        'discount': inv.discount,
        'discount_type': inv.discount_type,
        'discount_amount': inv.discount_amount,
        'total_amount': inv.total_amount,
        'advance_amount': inv.advance_amount,
        'balance_due': inv.balance_due,
        'status': inv.status,
        'payment_mode': inv.payment_mode,
        'notes': inv.notes,
        'is_archived': inv.is_archived,
        'ref_quotation_number': inv.ref_quotation_number,
        'subject': inv.subject,
        'delivery_address': inv.delivery_address,
        'payment_terms': inv.payment_terms,
        'voucher_number': inv.voucher_number,
        'gst_percent': inv.gst_percent,
        'gst_amount': inv.gst_amount,
        'is_overdue': inv.is_overdue,
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
            } for it in inv.items
        ]
        data['client'] = {
            'id': inv.client.id,
            'name': inv.client.name,
            'company_name': inv.client.company_name,
            'email': inv.client.email,
            'phone': inv.client.phone,
            'address': inv.client.address,
            'gst_number': inv.client.gst_number,
        } if inv.client else None
    return data


def _query_invoices():
    search = request.args.get('q', '').strip()
    status_filter = request.args.get('status', '').strip()

    query = Invoice.query
    if search:
        query = query.filter(
            db.or_(
                Invoice.invoice_number.ilike(f'%{search}%'),
                Invoice.client.has(Client.name.ilike(f'%{search}%'))
            )
        )
    if status_filter == 'Archived':
        query = query.filter(Invoice.is_archived == True)
    else:
        query = query.filter(Invoice.is_archived == False)
        if status_filter in ('Pending', 'Partially Paid', 'Paid'):
            query = query.filter(Invoice.status == status_filter)
    return query, search, status_filter


# ── LIST / EXPORT ─────────────────────────────────────

@invoices_bp.route('/')
@login_required
def list_invoices():
    query, search, status_filter = _query_invoices()
    invoices = query.order_by(Invoice.date_created.desc()).all()
    return jsonify({
        'invoices': [_invoice_json(i) for i in invoices],
        'search': search,
        'status_filter': status_filter,
    })


@invoices_bp.route('/export')
@login_required
def export_invoices():
    query, _, _ = _query_invoices()
    invoices = query.order_by(Invoice.date_created.desc()).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Invoice Number', 'Client Name', 'Date Created', 'Due Date', 'Total Amount', 'Amount Received', 'Balance Due', 'Status'])

    for inv in invoices:
        due_date = inv.due_date.strftime('%Y-%m-%d') if inv.due_date else ''
        cw.writerow([
            inv.invoice_number,
            inv.client.name if inv.client else '',
            inv.date_created.strftime('%Y-%m-%d'),
            due_date,
            f"{inv.total_amount:.2f}",
            f"{inv.advance_amount:.2f}",
            f"{inv.balance_due:.2f}",
            inv.status
        ])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=invoices_export.csv"
    output.headers["Content-type"] = "text/csv"
    return output


@invoices_bp.route('/meta')
@login_required
def invoice_meta():
    clients = Client.query.filter_by(is_archived=False).order_by(Client.name).all()
    services = Service.query.order_by(Service.name).all()
    profile = CompanyProfile.get_profile()
    return jsonify({
        'clients': [{'id': c.id, 'name': c.name} for c in clients],
        'services': [{'id': s.id, 'name': s.name, 'description': s.description or '', 'hsn_code': s.hsn_code or '', 'base_price': s.base_price} for s in services],
        'company': {
            'name': profile.name,
            'default_due_days': profile.default_due_days,
            'default_gst_percent': profile.default_gst_percent,
            'default_terms': profile.default_terms,
        },
    })


# ── CREATE ────────────────────────────────────────────

@invoices_bp.route('/', methods=['POST'])
@login_required
def create_invoice():
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
        return validation_error_response('Please add at least one service item.')

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

    # Validate due_days
    try:
        due_days = validate_due_days(data.get('due_days'), profile.default_due_days or 15)
    except ValueError as e:
        return validation_error_response(str(e))

    payment_mode = data.get('payment_mode') or None
    notes = (data.get('notes') or '').strip()

    # Validate advance_amount
    try:
        advance_amount = validate_advance_amount(data.get('advance_amount'))
    except ValueError as e:
        return validation_error_response(str(e))

    subject = (data.get('subject') or '').strip() or None
    delivery_address = (data.get('delivery_address') or '').strip() or None
    payment_terms = (data.get('payment_terms') or '').strip() or None
    voucher_number = (data.get('voucher_number') or '').strip() or None

    # Validate gst_percent
    try:
        gst_percent = validate_gst_percent(data.get('gst_percent'))
    except ValueError as e:
        return validation_error_response(str(e))

    now = now_ist()
    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        client_id=client_id,
        date_created=now,
        due_date=now + timedelta(days=due_days),
        discount=discount_val,
        discount_type=discount_type,
        status='Pending',
        payment_mode=payment_mode,
        notes=notes or profile.default_terms,
        subject=subject,
        delivery_address=delivery_address,
        payment_terms=payment_terms,
        voucher_number=voucher_number,
        gst_percent=gst_percent,
    )

    # Validate and build items
    try:
        item_names = [validate_item_name(n) for n in item_names]
        item_qtys = [parse_item_quantity(q) for q in item_qtys]
        item_rates = [parse_item_rate(r) for r in item_rates]
    except ValueError as e:
        return validation_error_response(str(e))

    sub_total = _build_items(invoice, item_names, item_descs, item_qtys, item_rates, item_hsns, InvoiceItem)
    invoice.sub_total = round(sub_total, 2)
    invoice.discount_amount, invoice.gst_amount, invoice.total_amount = _calc_totals(
        sub_total, discount_val, discount_type, gst_percent
    )
    invoice.advance_amount = advance_amount

    if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
        invoice.status = 'Paid'
    elif invoice.advance_amount > 0:
        invoice.status = 'Partially Paid'
    else:
        invoice.status = 'Pending'

    db.session.add(invoice)
    db.session.commit()
    return jsonify(_invoice_json(invoice, detailed=True)), 201


# ── VIEW ──────────────────────────────────────────────

@invoices_bp.route('/<int:id>')
@login_required
def view_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    profile = CompanyProfile.get_profile()
    qr_b64 = generate_upi_qr_base64(invoice.balance_due, invoice.invoice_number)

    from urllib.parse import quote
    due_date_str = invoice.due_date.strftime('%d %b %Y') if invoice.due_date else 'N/A'
    msg_text = (
        f"Dear {invoice.client.name},\n\n"
        f"I hope this message finds you well.\n\n"
        f"Please find attached your invoice ({invoice.invoice_number}) from {profile.name} for the recent services provided.\n\n"
        f"Invoice Summary:\n"
        f"• Total Amount: ₹{'{:,.2f}'.format(invoice.total_amount)}\n"
        f"• Balance Due: ₹{'{:,.2f}'.format(invoice.balance_due)}\n"
        f"• Due Date: {due_date_str}\n\n"
        f"Kindly review the attached PDF for full details. If you have any questions, please do not hesitate to reach out.\n\n"
        f"Thank you for your business!\n\n"
        f"Best regards,\n"
        f"{profile.name}"
    )

    whatsapp_url = ""
    if invoice.client.phone:
        clean_phone = ''.join(filter(str.isdigit, invoice.client.phone))
        whatsapp_url = f"https://wa.me/{clean_phone}?text={quote(msg_text)}"

    subject = f"Invoice {invoice.invoice_number} from {profile.name}"
    email_url = ""
    if invoice.client.email:
        email_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={invoice.client.email}&su={quote(subject)}&body={quote(msg_text)}"

    return jsonify({
        **_invoice_json(invoice, detailed=True),
        'qr_base64': qr_b64,
        'logo_base64': get_logo_base64(),
        'whatsapp_url': whatsapp_url,
        'email_url': email_url,
        'profile': {
            'name': profile.name,
            'tagline': profile.tagline,
            'email': profile.email,
            'phone': profile.phone,
            'address': profile.address,
            'bank_name': profile.bank_name,
            'bank_account': profile.bank_account,
            'bank_ifsc': profile.bank_ifsc,
            'bank_branch': profile.bank_branch,
            'upi_id': profile.upi_id,
            'gst_number': profile.gst_number,
        },
    })


# ── EDIT ──────────────────────────────────────────────

@invoices_bp.route('/<int:id>', methods=['PUT'])
@login_required
def edit_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    if invoice.status not in ('Pending', 'Partially Paid'):
        return validation_error_response('Only pending or partially paid invoices can be edited.')

    data = request.get_json(silent=True) or request.form
    client_id = data.get('client_id')
    if not client_id:
        return validation_error_response('Please select a client.')

    # Validate client_id
    try:
        client_id = validate_client_id(client_id)
    except ValueError as e:
        return validation_error_response(str(e))
    invoice.client_id = client_id

    # Validate discount
    try:
        discount_val = validate_discount(data.get('discount'), data.get('discount_type', 'flat'))
    except ValueError as e:
        return validation_error_response(str(e))
    invoice.discount = discount_val
    invoice.discount_type = data.get('discount_type', 'flat')
    invoice.payment_mode = data.get('payment_mode') or None
    invoice.notes = (data.get('notes') or '').strip()
    invoice.subject = (data.get('subject') or '').strip() or None
    invoice.delivery_address = (data.get('delivery_address') or '').strip() or None
    invoice.payment_terms = (data.get('payment_terms') or '').strip() or None
    invoice.voucher_number = (data.get('voucher_number') or '').strip() or None

    # Validate gst_percent
    try:
        invoice.gst_percent = validate_gst_percent(data.get('gst_percent'))
    except ValueError as e:
        return validation_error_response(str(e))

    # Validate due_days
    try:
        due_days = validate_due_days(data.get('due_days'))
    except ValueError as e:
        return validation_error_response(str(e))
    invoice.due_date = invoice.date_created + timedelta(days=due_days)

    # Validate advance_amount
    try:
        advance_amount = validate_advance_amount(data.get('advance_amount'))
    except ValueError as e:
        return validation_error_response(str(e))
    invoice.advance_amount = advance_amount

    InvoiceItem.query.filter_by(invoice_id=invoice.id).delete()

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

    sub_total = _build_items(invoice, item_names, item_descs, item_qtys, item_rates, item_hsns, InvoiceItem)
    invoice.sub_total = round(sub_total, 2)
    invoice.discount_amount, invoice.gst_amount, invoice.total_amount = _calc_totals(
        sub_total, discount_val, invoice.discount_type, invoice.gst_percent
    )

    if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
        invoice.status = 'Paid'
    elif invoice.advance_amount > 0:
        invoice.status = 'Partially Paid'
    else:
        invoice.status = 'Pending'

    db.session.commit()
    return jsonify(_invoice_json(invoice, detailed=True))


# ── STATUS ────────────────────────────────────────────

@invoices_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def update_status(id):
    invoice = Invoice.query.get_or_404(id)
    data = request.get_json(silent=True) or request.form
    advance_amount_str = data.get('advance_amount')
    payment_mode = data.get('payment_mode')

    try:
        advance_amount = validate_advance_amount(advance_amount_str)
    except ValueError as e:
        return validation_error_response(str(e))

    if advance_amount < 0:
        advance_amount = 0.0
    if advance_amount > invoice.total_amount:
        advance_amount = invoice.total_amount

    invoice.advance_amount = advance_amount
    invoice.payment_mode = payment_mode or None

    if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
        invoice.status = 'Paid'
    elif invoice.advance_amount > 0:
        invoice.status = 'Partially Paid'
    else:
        invoice.status = 'Pending'

    db.session.commit()
    return jsonify(_invoice_json(invoice, detailed=True))


# ── ARCHIVE ───────────────────────────────────────────

@invoices_bp.route('/<int:id>/archive', methods=['POST'])
@login_required
def archive_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    invoice.is_archived = True
    db.session.commit()
    return jsonify({'message': f'Invoice {invoice.invoice_number} archived.'})


@invoices_bp.route('/<int:id>/unarchive', methods=['POST'])
@login_required
def unarchive_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    invoice.is_archived = False
    db.session.commit()
    return jsonify({'message': f'Invoice {invoice.invoice_number} restored.'})


# ── PDF ───────────────────────────────────────────────

@invoices_bp.route('/<int:id>/pdf')
@login_required
def download_pdf(id):
    invoice = Invoice.query.get_or_404(id)
    profile = CompanyProfile.get_profile()
    qr_b64 = generate_upi_qr_base64(invoice.balance_due, invoice.invoice_number)
    logo_b64 = get_logo_base64()

    html_string = render_template(
        'invoices/pdf_template.html',
        invoice=invoice, qr_base64=qr_b64,
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
            f'attachment; filename={invoice.invoice_number}.pdf'
        )
        return response
    except Exception as e:
        return jsonify({'error': f'PDF generation failed: {e}'}), 500
