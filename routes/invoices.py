"""
Invoice routes — create, list, view, edit, PDF, QR, status management.
"""

import io
import os
import base64
import re
import csv
from datetime import datetime, timedelta

import qrcode
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, current_app, make_response
)
from flask_login import login_required
from models import db, Client, Service, Invoice, InvoiceItem, CompanyProfile, now_ist, IST

invoices_bp = Blueprint('invoices', __name__)


# ── Helpers ───────────────────────────────────────────

def generate_invoice_number():
    """Generate ATS-INV-2026-001 style. Uses MAX sequence ever used, not last existing."""
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
        # Fallback to see if any older style invoice exists to maintain sequence
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
    """Read the logo file and return as base64 string for PDF embedding."""
    logo_path = os.path.join(current_app.static_folder, 'img', 'logo.png')
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return ''


def generate_upi_qr_base64(amount, invoice_number):
    """Generate a UPI QR code as base64 PNG."""
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
    """Calculate discount amount, GST amount, and grand total.
    Flow: Subtotal - Discount = Net → Net × GST% = GST → Net + GST = Grand Total
    """
    if discount_type == 'percent':
        disc_amt = round(sub_total * discount_val / 100, 2)
    else:
        disc_amt = round(discount_val, 2)
    net = max(round(sub_total - disc_amt, 2), 0)
    gst_amt = round(net * gst_percent / 100, 2) if gst_percent else 0.0
    total = round(net + gst_amt, 2)
    return disc_amt, gst_amt, total


def _build_invoice_items(invoice, item_names, item_descs, item_qtys, item_rates, item_hsns=None):
    """Process form lists into InvoiceItem objects and calculate subtotal."""
    sub_total = 0.0
    if not item_hsns:
        item_hsns = [''] * len(item_names)
    for name, desc, qty_s, rate_s, hsn in zip(item_names, item_descs, item_qtys, item_rates, item_hsns):
        name = name.strip()
        if not name:
            continue
        try:
            qty = float(qty_s)
            rate = float(rate_s)
        except (ValueError, TypeError):
            qty, rate = 1.0, 0.0
        amount = round(qty * rate, 2)
        sub_total += amount
        invoice.items.append(InvoiceItem(
            service_name=name, description=desc.strip() or None,
            hsn_code=hsn.strip() or None,
            quantity=qty, rate=rate, amount=amount
        ))
    return sub_total


# ── LIST ──────────────────────────────────────────────

@invoices_bp.route('/')
@login_required
def list_invoices():
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

    invoices = query.order_by(Invoice.date_created.desc()).all()
    return render_template('invoices/list.html', invoices=invoices,
                           search=search, status_filter=status_filter)


@invoices_bp.route('/export')
@login_required
def export_invoices():
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

    invoices = query.order_by(Invoice.date_created.desc()).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Invoice Number', 'Client Name', 'Date Created', 'Due Date', 'Total Amount', 'Amount Received', 'Balance Due', 'Status'])

    for inv in invoices:
        due_date = inv.due_date.strftime('%Y-%m-%d') if inv.due_date else ''
        cw.writerow([
            inv.invoice_number,
            inv.client.name,
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


# ── CREATE ────────────────────────────────────────────

@invoices_bp.route('/create', methods=['GET', 'POST'])
@login_required
def create_invoice():
    clients = Client.query.filter_by(is_archived=False).order_by(Client.name).all()
    services = Service.query.order_by(Service.name).all()
    profile = CompanyProfile.get_profile()

    if request.method == 'POST':
        client_id = request.form.get('client_id')
        item_names = request.form.getlist('item_name[]')
        item_descs = request.form.getlist('item_desc[]')
        item_qtys = request.form.getlist('item_qty[]')
        item_rates = request.form.getlist('item_rate[]')
        item_hsns = request.form.getlist('item_hsn[]')

        if not item_descs or len(item_descs) != len(item_names):
            item_descs = [''] * len(item_names)
        if not item_hsns or len(item_hsns) != len(item_names):
            item_hsns = [''] * len(item_names)

        def fail_with(message):
            flash(message, 'danger')
            return render_template(
                'invoices/create.html',
                clients=clients,
                services=services,
                company=profile,
                form_data=request.form,
                item_names=item_names,
                item_descs=item_descs,
                item_qtys=item_qtys,
                item_rates=item_rates,
                item_hsns=item_hsns,
            )

        if not client_id:
            return fail_with('Please select a client.')

        if not item_names or not any(n.strip() for n in item_names):
            return fail_with('Please add at least one service item.')

        # Collect form data
        try:
            discount_val = float(request.form.get('discount', 0))
        except ValueError:
            discount_val = 0.0
        discount_type = request.form.get('discount_type', 'flat')
        try:
            due_days = int(request.form.get('due_days', profile.default_due_days or 15))
        except ValueError:
            due_days = 15
        payment_mode = request.form.get('payment_mode') or None
        notes = request.form.get('notes', '').strip()

        try:
            advance_amount = float(request.form.get('advance_amount', 0))
        except ValueError:
            advance_amount = 0.0

        # ATS-specific fields
        subject = request.form.get('subject', '').strip() or None
        delivery_address = request.form.get('delivery_address', '').strip() or None
        payment_terms = request.form.get('payment_terms', '').strip() or None
        voucher_number = request.form.get('voucher_number', '').strip() or None
        try:
            gst_percent = float(request.form.get('gst_percent', 0))
        except ValueError:
            gst_percent = 0.0

        # Build invoice
        now = now_ist()
        invoice = Invoice(
            invoice_number=generate_invoice_number(),
            client_id=int(client_id),
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

        sub_total = _build_invoice_items(invoice, item_names, item_descs, item_qtys, item_rates, item_hsns)

        invoice.sub_total = round(sub_total, 2)
        invoice.discount_amount, invoice.gst_amount, invoice.total_amount = _calc_totals(
            sub_total, discount_val, discount_type, gst_percent
        )
        invoice.advance_amount = advance_amount

        # Auto-set status based on balance
        if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
            invoice.status = 'Paid'
        elif invoice.advance_amount > 0:
            invoice.status = 'Partially Paid'
        else:
            invoice.status = 'Pending'

        db.session.add(invoice)
        db.session.commit()
        flash(f'Invoice {invoice.invoice_number} created!', 'success')
        return redirect(url_for('invoices.view_invoice', id=invoice.id))

    return render_template('invoices/create.html', clients=clients, services=services, company=profile)


# ── VIEW ──────────────────────────────────────────────

from urllib.parse import quote

@invoices_bp.route('/<int:id>')
@login_required
def view_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    profile = CompanyProfile.get_profile()
    qr_b64 = generate_upi_qr_base64(invoice.balance_due, invoice.invoice_number)
    logo_b64 = get_logo_base64()

    # Pre-filled message text
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

    # WhatsApp URL
    whatsapp_url = ""
    if invoice.client.phone:
        clean_phone = ''.join(filter(str.isdigit, invoice.client.phone))
        whatsapp_url = f"https://wa.me/{clean_phone}?text={quote(msg_text)}"

    # Gmail Compose URL
    subject = f"Invoice {invoice.invoice_number} from {profile.name}"
    email_url = ""
    if invoice.client.email:
        email_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={invoice.client.email}&su={quote(subject)}&body={quote(msg_text)}"

    return render_template('invoices/view.html', invoice=invoice,
                           qr_base64=qr_b64, logo_base64=logo_b64, profile=profile,
                           whatsapp_url=whatsapp_url, email_url=email_url)


# ── EDIT (only Pending) ──────────────────────────────

@invoices_bp.route('/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    if invoice.status not in ('Pending', 'Partially Paid'):
        flash('Only pending or partially paid invoices can be edited.', 'warning')
        return redirect(url_for('invoices.view_invoice', id=invoice.id))

    clients = Client.query.filter((Client.is_archived == False) | (Client.id == invoice.client_id)).order_by(Client.name).all()
    services = Service.query.order_by(Service.name).all()

    if request.method == 'POST':
        client_id = request.form.get('client_id')
        if not client_id:
            flash('Please select a client.', 'danger')
            return render_template('invoices/edit.html', invoice=invoice,
                                   clients=clients, services=services)

        invoice.client_id = int(client_id)
        try:
            discount_val = float(request.form.get('discount', 0))
        except ValueError:
            discount_val = 0.0
        invoice.discount = discount_val
        invoice.discount_type = request.form.get('discount_type', 'flat')
        invoice.payment_mode = request.form.get('payment_mode') or None
        invoice.notes = request.form.get('notes', '').strip()

        # ATS-specific fields
        invoice.subject = request.form.get('subject', '').strip() or None
        invoice.delivery_address = request.form.get('delivery_address', '').strip() or None
        invoice.payment_terms = request.form.get('payment_terms', '').strip() or None
        invoice.voucher_number = request.form.get('voucher_number', '').strip() or None
        try:
            invoice.gst_percent = float(request.form.get('gst_percent', 0))
        except ValueError:
            invoice.gst_percent = 0.0

        try:
            due_days = int(request.form.get('due_days', 15))
        except ValueError:
            due_days = 15
        invoice.due_date = invoice.date_created + timedelta(days=due_days)

        try:
            advance_amount = float(request.form.get('advance_amount', 0))
        except ValueError:
            advance_amount = 0.0
        invoice.advance_amount = advance_amount

        # Clear old items
        InvoiceItem.query.filter_by(invoice_id=invoice.id).delete()

        item_names = request.form.getlist('item_name[]')
        item_descs = request.form.getlist('item_desc[]')
        item_qtys = request.form.getlist('item_qty[]')
        item_rates = request.form.getlist('item_rate[]')
        item_hsns = request.form.getlist('item_hsn[]')

        if not item_descs or len(item_descs) != len(item_names):
            item_descs = [''] * len(item_names)
        if not item_hsns or len(item_hsns) != len(item_names):
            item_hsns = [''] * len(item_names)

        sub_total = _build_invoice_items(invoice, item_names, item_descs, item_qtys, item_rates, item_hsns)

        invoice.sub_total = round(sub_total, 2)
        invoice.discount_amount, invoice.gst_amount, invoice.total_amount = _calc_totals(
            sub_total, discount_val, invoice.discount_type, invoice.gst_percent
        )
        
        # Auto-update status based on balance
        if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
            invoice.status = 'Paid'
        elif invoice.advance_amount > 0:
            invoice.status = 'Partially Paid'
        else:
            invoice.status = 'Pending'

        db.session.commit()
        flash(f'Invoice {invoice.invoice_number} updated.', 'success')
        return redirect(url_for('invoices.view_invoice', id=invoice.id))

    return render_template('invoices/edit.html', invoice=invoice,
                           clients=clients, services=services)


# ── STATUS ────────────────────────────────────────────

@invoices_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def update_status(id):
    invoice = Invoice.query.get_or_404(id)
    advance_amount_str = request.form.get('advance_amount')
    payment_mode = request.form.get('payment_mode')
    
    try:
        advance_amount = float(advance_amount_str)
    except (ValueError, TypeError):
        advance_amount = invoice.advance_amount
        
    if advance_amount < 0:
        advance_amount = 0.0
    if advance_amount > invoice.total_amount:
        advance_amount = invoice.total_amount
        
    invoice.advance_amount = advance_amount
    invoice.payment_mode = payment_mode or None
    
    # Auto-derive status
    if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
        invoice.status = 'Paid'
    elif invoice.advance_amount > 0:
        invoice.status = 'Partially Paid'
    else:
        invoice.status = 'Pending'
        
    db.session.commit()
    flash(f'Payment updated. Status is now "{invoice.status}".', 'success')
    return redirect(url_for('invoices.view_invoice', id=invoice.id))


# ── ARCHIVE ───────────────────────────────────────────

@invoices_bp.route('/<int:id>/archive', methods=['POST'])
@login_required
def archive_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    invoice.is_archived = True
    db.session.commit()
    flash(f'Invoice {invoice.invoice_number} archived.', 'success')
    return redirect(url_for('invoices.list_invoices'))


@invoices_bp.route('/<int:id>/unarchive', methods=['POST'])
@login_required
def unarchive_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    invoice.is_archived = False
    db.session.commit()
    flash(f'Invoice {invoice.invoice_number} restored.', 'success')
    return redirect(url_for('invoices.view_invoice', id=invoice.id))


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
            flash('PDF generation encountered errors.', 'danger')
            return redirect(url_for('invoices.view_invoice', id=invoice.id))
        pdf_bytes = result_buf.getvalue()
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = (
            f'attachment; filename={invoice.invoice_number}.pdf'
        )
        return response
    except Exception as e:
        flash(f'PDF generation failed: {e}', 'danger')
        return redirect(url_for('invoices.view_invoice', id=invoice.id))


# ── API ───────────────────────────────────────────────

@invoices_bp.route('/api/service/<int:id>')
@login_required
def get_service_price(id):
    s = Service.query.get_or_404(id)
    return {'id': s.id, 'name': s.name, 'base_price': s.base_price}
