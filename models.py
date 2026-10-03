"""
ATS Automation — Database Models
Defines CompanyProfile, Client, Service, Invoice, and InvoiceItem.
"""

from datetime import datetime, timezone, timedelta
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# IST offset
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist():
    """Return current datetime in IST."""
    return datetime.now(IST)


class User(db.Model, UserMixin):
    """Admin user model."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class CompanyProfile(db.Model):
    """Singleton model for company settings displayed on invoices."""
    __tablename__ = 'company_profile'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default='ATS Automation')
    tagline = db.Column(db.String(200), nullable=True, default='Security & Systems')
    email = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    address = db.Column(db.Text, nullable=True)
    # Payment details
    upi_id = db.Column(db.String(100), nullable=True)
    upi_name = db.Column(db.String(200), nullable=True)
    bank_name = db.Column(db.String(200), nullable=True)
    bank_account = db.Column(db.String(50), nullable=True)
    bank_ifsc = db.Column(db.String(20), nullable=True)
    bank_branch = db.Column(db.String(200), nullable=True)
    # Tax & registration details
    gst_number = db.Column(db.String(50), nullable=True)
    msme_number = db.Column(db.String(100), nullable=True)
    stamp_image = db.Column(db.Text, nullable=True)  # Base64 encoded stamp/seal image
    # Defaults
    default_gst_percent = db.Column(db.Float, default=18.0)
    default_terms = db.Column(db.Text, nullable=True,
                              default='Payment is due within 15 days of the invoice date.')
    default_quotation_terms = db.Column(db.Text, nullable=True,
                                        default='This quotation is valid for 15 days from the date of issue. 50% advance payment is required to commence work.')
    default_due_days = db.Column(db.Integer, default=15)

    @staticmethod
    def get_profile():
        """Get or create the singleton company profile."""
        profile = CompanyProfile.query.first()
        if not profile:
            profile = CompanyProfile(
                name='ATS Automation',
                tagline='Security & Systems',
                email='info@atsautomation.in',
                phone='+91-9967399864',
                website='www.atsautomation.in',
                address='Main St, Nallasopara East, Virar East, Vasai-Virar, Mumbai, Maharashtra 401209',
                default_terms='Payment is due within 15 days of the invoice date.',
                default_quotation_terms='This quotation is valid for 15 days from the date of issue. 50% advance payment is required to commence work.',
                default_due_days=15,
                default_gst_percent=18.0,
            )
            db.session.add(profile)
            db.session.commit()
        return profile


class Client(db.Model):
    """Represents a client/customer."""
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    company_name = db.Column(db.String(150), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    gst_number = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=now_ist)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)

    invoices = db.relationship('Invoice', backref='client', lazy=True, cascade='all, delete-orphan')

    @property
    def total_billed(self):
        return sum(inv.total_amount for inv in self.invoices if not inv.is_archived)

    @property
    def invoice_count(self):
        return sum(1 for inv in self.invoices if not inv.is_archived)

    def __repr__(self):
        return f'<Client {self.name}>'


class Service(db.Model):
    """Represents a service in the catalog."""
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    hsn_code = db.Column(db.String(20), nullable=True)  # HSN/SAC code
    base_price = db.Column(db.Float, nullable=False, default=0.0)

    def __repr__(self):
        return f'<Service {self.name} - ₹{self.base_price}>'


class Invoice(db.Model):
    """Represents a generated invoice."""
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    date_created = db.Column(db.DateTime, nullable=False, default=now_ist)
    due_date = db.Column(db.DateTime, nullable=True)
    sub_total = db.Column(db.Float, nullable=False, default=0.0)
    discount = db.Column(db.Float, nullable=False, default=0.0)
    discount_type = db.Column(db.String(10), nullable=False, default='flat')  # 'flat' or 'percent'
    discount_amount = db.Column(db.Float, nullable=False, default=0.0)  # calculated discount in ₹
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    advance_amount = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(20), nullable=False, default='Pending')
    payment_mode = db.Column(db.String(20), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    ref_quotation_number = db.Column(db.String(50), nullable=True)
    # ATS-specific fields
    subject = db.Column(db.String(200), nullable=True)  # e.g., "GARAGE DOOR"
    delivery_address = db.Column(db.Text, nullable=True)
    payment_terms = db.Column(db.String(100), nullable=True)  # e.g., "100% Advance"
    voucher_number = db.Column(db.String(50), nullable=True)
    gst_percent = db.Column(db.Float, default=0.0)
    gst_amount = db.Column(db.Float, default=0.0)

    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade='all, delete-orphan')

    @property
    def is_overdue(self):
        if self.status == 'Paid':
            return False
        if self.due_date:
            return datetime.now(IST) > self.due_date.replace(tzinfo=IST) if self.due_date.tzinfo is None else datetime.now(IST) > self.due_date
        return False

    @property
    def balance_due(self):
        return max(0.0, self.total_amount - self.advance_amount)

    def __repr__(self):
        return f'<Invoice {self.invoice_number} - ₹{self.total_amount}>'


class InvoiceItem(db.Model):
    """A single line item: quantity × rate = amount."""
    __tablename__ = 'invoice_items'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    service_name = db.Column(db.String(200), nullable=False)
    hsn_code = db.Column(db.String(20), nullable=True)  # HSN/SAC code
    description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Float, nullable=False, default=1.0)
    rate = db.Column(db.Float, nullable=False, default=0.0)
    amount = db.Column(db.Float, nullable=False, default=0.0)  # qty × rate

    def __repr__(self):
        return f'<InvoiceItem {self.service_name} - {self.quantity}×₹{self.rate}>'


class Quotation(db.Model):
    """Represents a client quotation/proposal."""
    __tablename__ = 'quotations'

    id = db.Column(db.Integer, primary_key=True)
    quotation_number = db.Column(db.String(50), unique=True, nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    date_created = db.Column(db.DateTime, nullable=False, default=now_ist)
    valid_until = db.Column(db.DateTime, nullable=True)
    estimated_timeline = db.Column(db.String(100), nullable=True)
    sub_total = db.Column(db.Float, nullable=False, default=0.0)
    discount = db.Column(db.Float, nullable=False, default=0.0)
    discount_type = db.Column(db.String(10), nullable=False, default='flat')  # 'flat' or 'percent'
    discount_amount = db.Column(db.Float, nullable=False, default=0.0)
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(20), nullable=False, default='Draft')  # 'Draft', 'Sent', 'Accepted', 'Declined', 'Invoiced', 'Expired'
    notes = db.Column(db.Text, nullable=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    # ATS-specific fields
    subject = db.Column(db.String(200), nullable=True)  # e.g., "BOOM BARRIER"
    delivery_address = db.Column(db.Text, nullable=True)
    gst_percent = db.Column(db.Float, default=0.0)
    gst_amount = db.Column(db.Float, default=0.0)

    items = db.relationship('QuotationItem', backref='quotation', lazy=True, cascade='all, delete-orphan')
    client = db.relationship('Client', backref=db.backref('quotations', lazy=True))

    @property
    def is_expired(self):
        if self.status in ('Accepted', 'Invoiced'):
            return False
        if self.valid_until:
            return datetime.now(IST) > self.valid_until.replace(tzinfo=IST) if self.valid_until.tzinfo is None else datetime.now(IST) > self.valid_until
        return False

    def __repr__(self):
        return f'<Quotation {self.quotation_number} - ₹{self.total_amount}>'


class QuotationItem(db.Model):
    """Line item inside a quotation."""
    __tablename__ = 'quotation_items'

    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)
    service_name = db.Column(db.String(200), nullable=False)
    hsn_code = db.Column(db.String(20), nullable=True)  # HSN/SAC code
    description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Float, nullable=False, default=1.0)
    rate = db.Column(db.Float, nullable=False, default=0.0)
    amount = db.Column(db.Float, nullable=False, default=0.0)  # qty * rate

    def __repr__(self):
        return f'<QuotationItem {self.service_name} - {self.quantity}×₹{self.rate}>'
