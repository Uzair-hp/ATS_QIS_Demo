"""
Dashboard — key metrics and recent invoices (JSON).
"""

from flask import Blueprint, jsonify
from flask_login import login_required
from models import db, Client, Service, Invoice, Quotation, now_ist

dashboard_bp = Blueprint('dashboard', __name__)


def _invoice_json(inv):
    return {
        'id': inv.id,
        'invoice_number': inv.invoice_number,
        'client_name': inv.client.name if inv.client else '',
        'date_created': inv.date_created.isoformat() if inv.date_created else None,
        'due_date': inv.due_date.isoformat() if inv.due_date else None,
        'total_amount': inv.total_amount,
        'advance_amount': inv.advance_amount,
        'balance_due': inv.balance_due,
        'status': inv.status,
    }


@dashboard_bp.route('/dashboard')
@login_required
def index():
    total_clients = Client.query.filter(Client.is_archived == False).count()
    total_invoices = Invoice.query.filter(Invoice.is_archived == False).count()
    total_services = Service.query.count()
    total_quotations = Quotation.query.filter(Quotation.is_archived == False).count()

    paid_full = db.session.query(
        db.func.coalesce(db.func.sum(Invoice.total_amount), 0)
    ).filter(Invoice.status == 'Paid', Invoice.is_archived == False).scalar()

    paid_partial = db.session.query(
        db.func.coalesce(db.func.sum(Invoice.advance_amount), 0)
    ).filter(Invoice.status == 'Partially Paid', Invoice.is_archived == False).scalar()

    paid_revenue = paid_full + paid_partial

    pending_total = db.session.query(
        db.func.coalesce(db.func.sum(Invoice.total_amount), 0)
    ).filter(Invoice.status != 'Paid', Invoice.is_archived == False).scalar()

    pending_revenue = pending_total - paid_partial
    total_revenue = paid_revenue + pending_revenue

    now = now_ist()
    overdue_count = Invoice.query.filter(
        Invoice.status != 'Paid',
        Invoice.due_date < now,
        Invoice.is_archived == False
    ).count()

    pending_count = Invoice.query.filter(Invoice.status == 'Pending', Invoice.is_archived == False).count()

    recent_invoices = Invoice.query.filter(Invoice.is_archived == False).order_by(Invoice.date_created.desc()).limit(8).all()

    return jsonify({
        'total_clients': total_clients,
        'total_invoices': total_invoices,
        'total_services': total_services,
        'total_quotations': total_quotations,
        'total_revenue': total_revenue,
        'paid_revenue': paid_revenue,
        'pending_revenue': pending_revenue,
        'overdue_count': overdue_count,
        'pending_count': pending_count,
        'recent_invoices': [_invoice_json(i) for i in recent_invoices],
    })
