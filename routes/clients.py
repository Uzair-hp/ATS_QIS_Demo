"""
Client CRUD + detail view.
"""

import io
import csv
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, make_response
from flask_login import login_required
from models import db, Client

clients_bp = Blueprint('clients', __name__)


@clients_bp.route('/')
@login_required
def list_clients():
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

    clients = query.order_by(Client.name).all()
    return render_template('clients/list.html', clients=clients, search=search,
                           show_archived=show_archived)


@clients_bp.route('/export')
@login_required
def export_clients():
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

    clients = query.order_by(Client.name).all()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Client Name', 'Company Name', 'Email', 'Phone', 'Address', 'Total Billed', 'Outstanding'])

    for c in clients:
        outstanding = sum(inv.balance_due for inv in c.invoices if not inv.is_archived)
        cw.writerow([
            c.name,
            c.company_name or '',
            c.email or '',
            c.phone or '',
            c.address or '',
            f"{c.total_billed:.2f}",
            f"{outstanding:.2f}"
        ])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=clients_export.csv"
    output.headers["Content-type"] = "text/csv"
    return output


@clients_bp.route('/<int:id>')
@login_required
def view_client(id):
    client = Client.query.get_or_404(id)
    return render_template('clients/detail.html', client=client)


@clients_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add_client():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        if not name:
            flash('Client name is required.', 'danger')
            return render_template('clients/form.html', client=None)
        client = Client(
            name=name,
            company_name=request.form.get('company_name', '').strip() or None,
            email=request.form.get('email', '').strip(),
            phone=request.form.get('phone', '').strip(),
            address=request.form.get('address', '').strip(),
            gst_number=request.form.get('gst_number', '').strip() or None,
        )
        db.session.add(client)
        db.session.commit()
        flash(f'Client "{client.name}" added successfully!', 'success')
        return redirect(url_for('clients.list_clients'))
    return render_template('clients/form.html', client=None)


@clients_bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_client(id):
    client = Client.query.get_or_404(id)
    if request.method == 'POST':
        client.name = request.form.get('name', '').strip() or client.name
        client.company_name = request.form.get('company_name', '').strip() or None
        client.email = request.form.get('email', '').strip()
        client.phone = request.form.get('phone', '').strip()
        client.address = request.form.get('address', '').strip()
        client.gst_number = request.form.get('gst_number', '').strip() or None
        db.session.commit()
        flash(f'Client "{client.name}" updated.', 'success')
        return redirect(url_for('clients.list_clients'))
    return render_template('clients/form.html', client=client)


@clients_bp.route('/archive/<int:id>', methods=['POST'])
@login_required
def archive_client(id):
    client = Client.query.get_or_404(id)
    client.is_archived = True
    db.session.commit()
    flash(f'Client "{client.name}" archived.', 'success')
    return redirect(url_for('clients.list_clients'))


@clients_bp.route('/unarchive/<int:id>', methods=['POST'])
@login_required
def unarchive_client(id):
    client = Client.query.get_or_404(id)
    client.is_archived = False
    db.session.commit()
    flash(f'Client "{client.name}" restored.', 'success')
    return redirect(url_for('clients.view_client', id=client.id))
