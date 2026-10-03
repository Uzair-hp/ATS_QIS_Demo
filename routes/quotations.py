"""
Quotations routes — create, list, view, edit, PDF, status management, duplication/revisions, and invoice conversion.
"""

import io
import os
import base64
import re
from datetime import datetime, timedelta
from urllib.parse import quote

from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, current_app, make_response
)
from flask_login import login_required
from models import db, Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem, CompanyProfile, now_ist, IST

quotations_bp = Blueprint('quotations', __name__)


# ── Helpers ───────────────────────────────────────────

def generate_quotation_number():
    """Generate base ATS-QT-2026-001 style (without revision suffix)."""
    year = datetime.now().year
    pattern = f'ATS-QT-{year}-%'
    
    # Get all quotes matching the pattern
    quotes = (
        Quotation.query
        .filter(Quotation.quotation_number.like(pattern))
        .order_by(Quotation.id.desc())
        .all()
    )
    
    # Filter out those that have revision suffixes to find the maximum base sequence
    max_seq = 0
    for q in quotes:
        num = q.quotation_number
        base_num = re.sub(r'-R\d+$', '', num)
        match = re.search(r'(\d+)$', base_num)
        if match:
            seq = int(match.group(1))
            if seq > max_seq:
                max_seq = seq
                
    return f'ATS-QT-{year}-{(max_seq + 1):03d}'


def get_logo_base64():
    """Read the logo file and return as base64 string for PDF embedding."""
    logo_path = os.path.join(current_app.static_folder, 'img', 'logo.png')
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return ''


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


def _build_quotation_items(quotation, item_names, item_descs, item_qtys, item_rates, item_hsns=None):
    """Process form lists into QuotationItem objects and calculate subtotal."""
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
        quotation.items.append(QuotationItem(
            service_name=name, description=desc.strip() or None,
            hsn_code=hsn.strip() or None,
            quantity=qty, rate=rate, amount=amount
        ))
    return sub_total


# ── LIST ──────────────────────────────────────────────

@quotations_bp.route('/')
@login_required
def list_quotations():
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

    quotations = query.order_by(Quotation.date_created.desc()).all()
    
    # Render is_expired property support
    return render_template('quotations/list.html', quotations=quotations,
                           search=search, status_filter=status_filter)


@quotations_bp.route('/export')
@login_required
def export_quotations():
    import csv
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

    quotations = query.order_by(Quotation.date_created.desc()).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Quotation Number', 'Client Name', 'Date Created', 'Valid Until', 'Estimated Timeline', 'Total Amount', 'Status'])

    for q in quotations:
        valid_until = q.valid_until.strftime('%Y-%m-%d') if q.valid_until else ''
        cw.writerow([
            q.quotation_number,
            q.client.name,
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


# ── CREATE ────────────────────────────────────────────

@quotations_bp.route('/create', methods=['GET', 'POST'])
@login_required
def create_quotation():
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
                'quotations/create.html',
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
            return fail_with('Please add at least one line item.')

        try:
            discount_val = float(request.form.get('discount', 0))
        except ValueError:
            discount_val = 0.0
        discount_type = request.form.get('discount_type', 'flat')
        estimated_timeline = request.form.get('estimated_timeline', '').strip()
        notes = request.form.get('notes', '').strip()

        try:
            valid_days = int(request.form.get('valid_days', 15))
        except ValueError:
            valid_days = 15

        # ATS-specific fields
        subject = request.form.get('subject', '').strip() or None
        delivery_address = request.form.get('delivery_address', '').strip() or None
        payment_terms = request.form.get('payment_terms', '').strip() or None
        try:
            gst_percent = float(request.form.get('gst_percent', 0))
        except ValueError:
            gst_percent = 0.0

        now = now_ist()
        quotation = Quotation(
            quotation_number=generate_quotation_number(),
            client_id=int(client_id),
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

        sub_total = _build_quotation_items(quotation, item_names, item_descs, item_qtys, item_rates, item_hsns)
        quotation.sub_total = round(sub_total, 2)
        quotation.discount_amount, quotation.gst_amount, quotation.total_amount = _calc_totals(
            sub_total, discount_val, discount_type, gst_percent
        )

        db.session.add(quotation)
        db.session.commit()
        flash(f'Quotation {quotation.quotation_number} created!', 'success')
        return redirect(url_for('quotations.view_quotation', id=quotation.id))

    return render_template('quotations/create.html', clients=clients, services=services, company=profile)


# ── VIEW ──────────────────────────────────────────────

@quotations_bp.route('/<int:id>')
@login_required
def view_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    profile = CompanyProfile.get_profile()
    logo_b64 = get_logo_base64()

    # Pre-filled sharing message
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

    # WhatsApp sharing URL
    whatsapp_url = ""
    if quotation.client.phone:
        clean_phone = ''.join(filter(str.isdigit, quotation.client.phone))
        whatsapp_url = f"https://wa.me/{clean_phone}?text={quote(msg_text)}"

    # Gmail compose URL
    subject = f"Project Quotation {quotation.quotation_number} from {profile.name}"
    email_url = ""
    if quotation.client.email:
        email_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={quotation.client.email}&su={quote(subject)}&body={quote(msg_text)}"

    return render_template('quotations/view.html', quotation=quotation,
                           logo_base64=logo_b64, profile=profile,
                           whatsapp_url=whatsapp_url, email_url=email_url)


# ── EDIT (only Draft/Sent) ───────────────────────────

@quotations_bp.route('/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    if quotation.status in ('Accepted', 'Invoiced'):
        flash('Accepted or Invoiced quotations cannot be edited.', 'warning')
        return redirect(url_for('quotations.view_quotation', id=quotation.id))

    clients = Client.query.filter((Client.is_archived == False) | (Client.id == quotation.client_id)).order_by(Client.name).all()
    services = Service.query.order_by(Service.name).all()
    profile = CompanyProfile.get_profile()

    if request.method == 'POST':
        client_id = request.form.get('client_id')
        if not client_id:
            flash('Please select a client.', 'danger')
            return render_template('quotations/edit.html', quotation=quotation,
                                   clients=clients, services=services, company=profile)

        quotation.client_id = int(client_id)
        try:
            discount_val = float(request.form.get('discount', 0))
        except ValueError:
            discount_val = 0.0
        quotation.discount = discount_val
        quotation.discount_type = request.form.get('discount_type', 'flat')
        quotation.estimated_timeline = request.form.get('estimated_timeline', '').strip()
        quotation.notes = request.form.get('notes', '').strip()

        # ATS-specific fields
        quotation.subject = request.form.get('subject', '').strip() or None
        quotation.delivery_address = request.form.get('delivery_address', '').strip() or None
        quotation.payment_terms = request.form.get('payment_terms', '').strip() or None
        try:
            quotation.gst_percent = float(request.form.get('gst_percent', 0))
        except ValueError:
            quotation.gst_percent = 0.0

        try:
            valid_days = int(request.form.get('valid_days', 15))
        except ValueError:
            valid_days = 15
        quotation.valid_until = quotation.date_created + timedelta(days=valid_days)

        # Clear old items
        QuotationItem.query.filter_by(quotation_id=quotation.id).delete()

        item_names = request.form.getlist('item_name[]')
        item_descs = request.form.getlist('item_desc[]')
        item_qtys = request.form.getlist('item_qty[]')
        item_rates = request.form.getlist('item_rate[]')
        item_hsns = request.form.getlist('item_hsn[]')

        if not item_descs or len(item_descs) != len(item_names):
            item_descs = [''] * len(item_names)
        if not item_hsns or len(item_hsns) != len(item_names):
            item_hsns = [''] * len(item_names)

        sub_total = _build_quotation_items(quotation, item_names, item_descs, item_qtys, item_rates, item_hsns)
        quotation.sub_total = round(sub_total, 2)
        quotation.discount_amount, quotation.gst_amount, quotation.total_amount = _calc_totals(
            sub_total, discount_val, quotation.discount_type, quotation.gst_percent
        )

        db.session.commit()
        flash(f'Quotation {quotation.quotation_number} updated.', 'success')
        return redirect(url_for('quotations.view_quotation', id=quotation.id))

    # Calculate current valid days (approximate)
    valid_days = 15
    if quotation.valid_until:
        diff = quotation.valid_until - quotation.date_created
        valid_days = max(1, diff.days)

    return render_template('quotations/edit.html', quotation=quotation,
                           clients=clients, services=services, company=profile, valid_days=valid_days)


# ── STATUS MANAGEMENT ─────────────────────────────────

@quotations_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def update_status(id):
    quotation = Quotation.query.get_or_404(id)
    new_status = request.form.get('status')
    
    if new_status in ('Draft', 'Sent', 'Accepted', 'Declined', 'Expired'):
        quotation.status = new_status
        db.session.commit()
        flash(f'Quotation status updated to {new_status}.', 'success')
    else:
        flash('Invalid status operation.', 'danger')
        
    return redirect(url_for('quotations.view_quotation', id=quotation.id))


# ── REVISION / DUPLICATE ─────────────────────────────

@quotations_bp.route('/<int:id>/duplicate', methods=['POST'])
@login_required
def duplicate_quotation(id):
    original = Quotation.query.get_or_404(id)
    
    # Strip any existing suffix to identify the base quotation number
    base_num = re.sub(r'-R\d+$', '', original.quotation_number)
    
    # Look for existing revisions in the database
    pattern = f'{base_num}%'
    revisions = (
        Quotation.query
        .filter(Quotation.quotation_number.like(pattern))
        .all()
    )
    
    # Find the maximum suffix revision number
    max_rev = 0
    for r in revisions:
        num = r.quotation_number
        match = re.search(r'-R(\d+)$', num)
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
    )
    
    for item in original.items:
        new_quote.items.append(QuotationItem(
            service_name=item.service_name,
            description=item.description,
            quantity=item.quantity,
            rate=item.rate,
            amount=item.amount
        ))
        
    db.session.add(new_quote)
    db.session.commit()
    
    flash(f'Created new revision {new_num} as Draft.', 'success')
    return redirect(url_for('quotations.edit_quotation', id=new_quote.id))


# ── CONVERT TO INVOICE ───────────────────────────────

@quotations_bp.route('/<int:id>/convert', methods=['POST'])
@login_required
def convert_to_invoice(id):
    quotation = Quotation.query.get_or_404(id)
    if quotation.status == 'Invoiced':
        flash('This quotation has already been converted to an invoice.', 'warning')
        existing = Invoice.query.filter_by(ref_quotation_number=quotation.quotation_number).first()
        if existing:
            return redirect(url_for('invoices.view_invoice', id=existing.id))
        return redirect(url_for('quotations.view_quotation', id=quotation.id))
        
    # Generate Invoice using current year sequencer
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
    
    flash(f'Quotation converted to Invoice {invoice.invoice_number}!', 'success')
    return redirect(url_for('invoices.view_invoice', id=invoice.id))


# ── ARCHIVE ───────────────────────────────────────────

@quotations_bp.route('/<int:id>/archive', methods=['POST'])
@login_required
def archive_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    quotation.is_archived = True
    db.session.commit()
    flash(f'Quotation {quotation.quotation_number} archived.', 'success')
    return redirect(url_for('quotations.list_quotations'))


@quotations_bp.route('/<int:id>/unarchive', methods=['POST'])
@login_required
def unarchive_quotation(id):
    quotation = Quotation.query.get_or_404(id)
    quotation.is_archived = False
    db.session.commit()
    flash(f'Quotation {quotation.quotation_number} restored.', 'success')
    return redirect(url_for('quotations.view_quotation', id=quotation.id))


# ── PDF GENERATION ────────────────────────────────────

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
            flash('PDF generation encountered errors.', 'danger')
            return redirect(url_for('quotations.view_quotation', id=quotation.id))
        pdf_bytes = result_buf.getvalue()
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = (
            f'attachment; filename={quotation.quotation_number}.pdf'
        )
        return response
    except Exception as e:
        flash(f'PDF generation failed: {e}', 'danger')
        return redirect(url_for('quotations.view_quotation', id=quotation.id))
