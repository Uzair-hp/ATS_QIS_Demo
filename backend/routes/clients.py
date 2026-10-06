"""
Client CRUD + detail (JSON).
"""

import io
import csv
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response
from flask_login import login_required
from models import db, Client

clients_bp = Blueprint('clients', __name__)


def _client_json(c):
    outstanding = sum(inv.balance_due for inv in c.invoices if not inv.is_archived)
    return {
        'id': c.id,
        'name': c.name,
        'company_name': c.company_name,
        'email': c.email,
        'phone': c.phone,
        'address': c.address,
        'gst_number': c.gst_number,
        'created_at': c.created_at.isoformat() if c.created_at else None,
        'is_archived': c.is_archived,
        'total_billed': c.total_billed,
        'invoice_count': c.invoice_count,
        'outstanding': outstanding,
    }


def _query_clients():
    search = request.args.get('q', '').strip()
    show_archived = request.args.get('archived', '').strip()

    query = Client.query
    if search:
        query = query.filter(
            db.or_(
                Client.name.ilike(f'%{search}%'),
                Client.company_name.ilike(f'%{search}%')
            )
        )
    if show_archived == '1':
        query = query.filter(Client.is_archived == True)
    else:
        query = query.filter(Client.is_archived == False)
    return query, search, show_archived


@clients_bp.route('/')
@login_required
def list_clients():
    query, search, show_archived = _query_clients()
    clients = query.order_by(Client.name).all()
    return jsonify({
        'clients': [_client_json(c) for c in clients],
        'search': search,
        'show_archived': show_archived,
    })


@clients_bp.route('/export')
@login_required
def export_clients():
    query, _, _ = _query_clients()
    clients = query.order_by(Client.name).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Client Name', 'Company Name', 'Email', 'Phone', 'Address', 'Total Billed', 'Outstanding'])

    for c in clients:
        outstanding = sum(inv.balance_due for inv in c.invoices if not inv.is_archived)
        cw.writerow([
            c.name, c.company_name or '', c.email or '', c.phone or '', c.address or '',
            f"{c.total_billed:.2f}", f"{outstanding:.2f}"
        ])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=clients_export.csv"
    output.headers["Content-type"] = "text/csv"
    return output


@clients_bp.route('/<int:id>')
@login_required
def view_client(id):
    client = Client.query.get_or_404(id)
    data = _client_json(client)
    invoices = []
    for inv in sorted(client.invoices, key=lambda i: i.date_created or datetime.min, reverse=True):
        invoices.append({
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'date_created': inv.date_created.isoformat() if inv.date_created else None,
            'total_amount': inv.total_amount,
            'status': inv.status,
            'is_archived': inv.is_archived,
        })
    data['invoices'] = invoices
    return jsonify(data)


@clients_bp.route('/', methods=['POST'])
@login_required
def add_client():
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Client name is required.'}), 400
    client = Client(
        name=name,
        company_name=(data.get('company_name') or '').strip() or None,
        email=(data.get('email') or '').strip(),
        phone=(data.get('phone') or '').strip(),
        address=(data.get('address') or '').strip(),
        gst_number=(data.get('gst_number') or '').strip() or None,
    )
    db.session.add(client)
    db.session.commit()
    return jsonify(_client_json(client)), 201


@clients_bp.route('/<int:id>', methods=['PUT'])
@login_required
def edit_client(id):
    client = Client.query.get_or_404(id)
    data = request.get_json(silent=True) or request.form
    client.name = (data.get('name') or '').strip() or client.name
    client.company_name = (data.get('company_name') or '').strip() or None
    client.email = (data.get('email') or '').strip()
    client.phone = (data.get('phone') or '').strip()
    client.address = (data.get('address') or '').strip()
    client.gst_number = (data.get('gst_number') or '').strip() or None
    db.session.commit()
    return jsonify(_client_json(client))


@clients_bp.route('/<int:id>/archive', methods=['POST'])
@login_required
def archive_client(id):
    client = Client.query.get_or_404(id)
    client.is_archived = True
    db.session.commit()
    return jsonify({'message': f'Client "{client.name}" archived.'})


@clients_bp.route('/<int:id>/unarchive', methods=['POST'])
@login_required
def unarchive_client(id):
    client = Client.query.get_or_404(id)
    client.is_archived = False
    db.session.commit()
    return jsonify({'message': f'Client "{client.name}" restored.'})
