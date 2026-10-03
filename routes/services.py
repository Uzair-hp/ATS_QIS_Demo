"""
Service catalog CRUD.
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required
from models import db, Service

services_bp = Blueprint('services', __name__)


@services_bp.route('/')
@login_required
def list_services():
    search = request.args.get('q', '').strip()
    query = Service.query
    if search:
        query = query.filter(Service.name.ilike(f'%{search}%'))
    services = query.order_by(Service.name).all()
    return render_template('services/list.html', services=services, search=search)


@services_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add_service():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        if not name:
            flash('Service name is required.', 'danger')
            return render_template('services/form.html', service=None)
        try:
            price = float(request.form.get('base_price', 0))
        except ValueError:
            price = 0.0
        service = Service(
            name=name,
            description=request.form.get('description', '').strip() or None,
            hsn_code=request.form.get('hsn_code', '').strip() or None,
            base_price=price,
        )
        db.session.add(service)
        db.session.commit()
        flash(f'Service "{service.name}" added!', 'success')
        return redirect(url_for('services.list_services'))
    return render_template('services/form.html', service=None)


@services_bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_service(id):
    service = Service.query.get_or_404(id)
    if request.method == 'POST':
        service.name = request.form.get('name', '').strip() or service.name
        service.description = request.form.get('description', '').strip() or None
        service.hsn_code = request.form.get('hsn_code', '').strip() or None
        try:
            service.base_price = float(request.form.get('base_price', service.base_price))
        except ValueError:
            pass
        db.session.commit()
        flash(f'Service "{service.name}" updated.', 'success')
        return redirect(url_for('services.list_services'))
    return render_template('services/form.html', service=service)


@services_bp.route('/delete/<int:id>', methods=['POST'])
@login_required
def delete_service(id):
    service = Service.query.get_or_404(id)
    name = service.name
    db.session.delete(service)
    db.session.commit()
    flash(f'Service "{name}" deleted.', 'success')
    return redirect(url_for('services.list_services'))


@services_bp.route('/api/json')
@login_required
def services_json():
    """JSON endpoint for service data (used by invoice/quotation forms for auto-fill)."""
    services = Service.query.order_by(Service.name).all()
    return jsonify([
        {
            'id': s.id,
            'name': s.name,
            'description': s.description or '',
            'hsn_code': s.hsn_code or '',
            'base_price': s.base_price,
        }
        for s in services
    ])
