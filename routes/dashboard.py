"""
Dashboard — key metrics and recent invoices.
"""

from flask import Blueprint, render_template
from flask_login import login_required
from models import db, Client, Service, Invoice, now_ist

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def index():
    total_clients = Client.query.filter(Client.is_archived == False).count()
    total_invoices = Invoice.query.filter(Invoice.is_archived == False).count()
    total_services = Service.query.count()

    from models import Quotation
    total_quotations = Quotation.query.filter(Quotation.is_archived == False).count()

    # Revenue breakdown
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

    # Overdue count
    now = now_ist()
    overdue_count = Invoice.query.filter(
        Invoice.status != 'Paid',
        Invoice.due_date < now,
        Invoice.is_archived == False
    ).count()

    # Pending count
    pending_count = Invoice.query.filter(Invoice.status == 'Pending', Invoice.is_archived == False).count()

    recent_invoices = Invoice.query.filter(Invoice.is_archived == False).order_by(Invoice.date_created.desc()).limit(8).all()

    return render_template(
        'dashboard.html',
        total_clients=total_clients,
        total_invoices=total_invoices,
        total_services=total_services,
        total_quotations=total_quotations,
        total_revenue=total_revenue,
        paid_revenue=paid_revenue,
        pending_revenue=pending_revenue,
        overdue_count=overdue_count,
        pending_count=pending_count,
        recent_invoices=recent_invoices,
    )
