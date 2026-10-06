"""
Service catalog CRUD (JSON).
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required
from models import db, Service

services_bp = Blueprint('services', __name__)


def _service_json(s):
    return {
        'id': s.id,
        'name': s.name,
        'description': s.description or '',
        'hsn_code': s.hsn_code or '',
        'base_price': s.base_price,
    }


@services_bp.route('/')
@login_required
def list_services():
    search = request.args.get('q', '').strip()
    query = Service.query
    if search:
        query = query.filter(Service.name.ilike(f'%{search}%'))
    services = query.order_by(Service.name).all()
    return jsonify({'services': [_service_json(s) for s in services], 'search': search})


@services_bp.route('/json')
@login_required
def services_json():
    services = Service.query.order_by(Service.name).all()
    return jsonify([_service_json(s) for s in services])


@services_bp.route('/', methods=['POST'])
@login_required
def add_service():
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Service name is required.'}), 400
    try:
        price = float(data.get('base_price', 0) or 0)
    except (ValueError, TypeError):
        price = 0.0
    service = Service(
        name=name,
        description=(data.get('description') or '').strip() or None,
        hsn_code=(data.get('hsn_code') or '').strip() or None,
        base_price=price,
    )
    db.session.add(service)
    db.session.commit()
    return jsonify(_service_json(service)), 201


@services_bp.route('/<int:id>', methods=['PUT'])
@login_required
def edit_service(id):
    service = Service.query.get_or_404(id)
    data = request.get_json(silent=True) or request.form
    service.name = (data.get('name') or '').strip() or service.name
    service.description = (data.get('description') or '').strip() or None
    service.hsn_code = (data.get('hsn_code') or '').strip() or None
    try:
        service.base_price = float(data.get('base_price', service.base_price))
    except (ValueError, TypeError):
        pass
    db.session.commit()
    return jsonify(_service_json(service))


@services_bp.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_service(id):
    service = Service.query.get_or_404(id)
    name = service.name
    db.session.delete(service)
    db.session.commit()
    return jsonify({'message': f'Service "{name}" deleted.'})


@services_bp.route('/<int:id>/price')
@login_required
def get_service_price(id):
    s = Service.query.get_or_404(id)
    return jsonify({'id': s.id, 'name': s.name, 'base_price': s.base_price})
