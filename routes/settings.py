"""
Company profile / settings.
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from models import db, CompanyProfile
import base64

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/', methods=['GET', 'POST'])
@login_required
def company_settings():
    profile = CompanyProfile.get_profile()

    if request.method == 'POST':
        profile.name = request.form.get('name', '').strip() or profile.name
        profile.tagline = request.form.get('tagline', '').strip()
        profile.email = request.form.get('email', '').strip()
        profile.phone = request.form.get('phone', '').strip()
        profile.website = request.form.get('website', '').strip()
        profile.address = request.form.get('address', '').strip()
        profile.upi_id = request.form.get('upi_id', '').strip()
        profile.upi_name = request.form.get('upi_name', '').strip()
        profile.bank_name = request.form.get('bank_name', '').strip()
        profile.bank_account = request.form.get('bank_account', '').strip()
        profile.bank_ifsc = request.form.get('bank_ifsc', '').strip()
        profile.bank_branch = request.form.get('bank_branch', '').strip()
        profile.gst_number = request.form.get('gst_number', '').strip()
        profile.msme_number = request.form.get('msme_number', '').strip()
        try:
            profile.default_gst_percent = float(request.form.get('default_gst_percent', 18.0))
        except ValueError:
            profile.default_gst_percent = 18.0
        profile.default_terms = request.form.get('default_terms', '').strip()
        profile.default_quotation_terms = request.form.get('default_quotation_terms', '').strip()

        # Handle stamp image upload
        stamp_file = request.files.get('stamp_image')
        if stamp_file and stamp_file.filename:
            stamp_data = stamp_file.read()
            profile.stamp_image = base64.b64encode(stamp_data).decode('utf-8')
        elif request.form.get('remove_stamp') == '1':
            profile.stamp_image = None

        try:
            profile.default_due_days = int(request.form.get('default_due_days', 15))
        except ValueError:
            profile.default_due_days = 15

        db.session.commit()
        flash('Company settings saved!', 'success')
        return redirect(url_for('settings.company_settings'))

    return render_template('settings.html', profile=profile)

@settings_bp.route('/change_password', methods=['POST'])
@login_required
def change_password():
    old_password = request.form.get('old_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')

    if not current_user.check_password(old_password):
        flash('Incorrect current password.', 'danger')
        return redirect(url_for('settings.company_settings'))
        
    if new_password != confirm_password:
        flash('New passwords do not match.', 'danger')
        return redirect(url_for('settings.company_settings'))
        
    if len(new_password) < 6:
        flash('Password must be at least 6 characters long.', 'danger')
        return redirect(url_for('settings.company_settings'))

    current_user.set_password(new_password)
    db.session.commit()
    flash('Password changed successfully!', 'success')
    return redirect(url_for('settings.company_settings'))
@settings_bp.route('/wipe-data', methods=['POST'])
@login_required
def wipe_data():
    from models import Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem
    # Secure confirmation check
    confirm = request.form.get('confirm_wipe')
    if confirm != 'DELETE ALL DATA':
        flash('Data wipe cancelled. You must type "DELETE ALL DATA" exactly.', 'warning')
        return redirect(url_for('settings.company_settings'))

    try:
        # Delete billing data only (keep profile and user)
        db.session.query(InvoiceItem).delete()
        db.session.query(Invoice).delete()
        db.session.query(QuotationItem).delete()
        db.session.query(Quotation).delete()
        db.session.query(Client).delete()
        db.session.query(Service).delete()
        db.session.commit()
        flash('System reset successful. All business data has been wiped.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error wiping data: {e}', 'danger')
        
    return redirect(url_for('settings.company_settings'))
