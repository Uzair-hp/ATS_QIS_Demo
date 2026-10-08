"""Shared pytest fixtures.

Every test runs against a throwaway SQLite database so the developer's real
instance/ats.db is never touched.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DevelopmentConfig  # noqa: E402


@pytest.fixture
def app(tmp_path):
    db_file = tmp_path / 'test.db'
    original_uri = DevelopmentConfig.SQLALCHEMY_DATABASE_URI
    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(db_file)

    from app import create_app

    application = create_app()
    application.config.update(TESTING=True, WTF_CSRF_ENABLED=False)

    yield application

    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = original_uri


@pytest.fixture
def ctx(app):
    with app.app_context():
        yield app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def login(client):
    """Authenticate the seeded admin user and return the session client.

    Also stashes the CSRF token from GET /api/auth/me so tests can drive
    state-changing requests through `post_csrf`.
    """
    resp = client.post('/api/auth/login',
                       json={'username': 'admin', 'password': 'ats@2026'})
    assert resp.status_code == 200, resp.get_json()
    client.csrf_token = client.get('/api/auth/me').get_json().get('csrf_token')
    return client


@pytest.fixture
def post_csrf(login):
    """POST helper that carries the session's CSRF token.

    The app enforces CSRF on every unsafe method once a session exists, so
    multipart uploads must send the token as a form field.
    """
    def _post(path, **fields):
        data = dict(fields)
        data['csrf_token'] = login.csrf_token
        return login.post(path, data=data, content_type='multipart/form-data')

    return _post


@pytest.fixture
def sample(ctx):
    """A client, profile with bank details, and one fully-populated quotation."""
    from models import (Client, CompanyProfile, Quotation, QuotationItem,
                        now_ist)

    profile = CompanyProfile.get_profile()
    profile.gst_number = '27BTHPT0851K1Z9'
    profile.msme_number = 'UDYAM-MH-170148612'
    profile.bank_name = 'HDFC Bank'
    profile.bank_branch = 'Virar East'
    profile.bank_account = '50200097301710'
    profile.bank_ifsc = 'HDFC0001234'

    client = Client(name='Prakash Pituha', company_name='NAVAL DOCKYARD KOLABA',
                    email='p@example.com', phone='+91-9000000000',
                    address='Kolaba, Mumbai', gst_number='27AAAAA0000A1Z5')

    quotation = Quotation(
        quotation_number='ATS-QT-2026-001',
        client=client,
        date_created=now_ist(),
        sub_total=200.0,
        discount=20.0,
        discount_type='flat',
        discount_amount=20.0,
        gst_percent=18.0,
        gst_amount=32.4,
        total_amount=212.4,
        subject='BOOM BARRIER',
        payment_terms='50% Advance',
    )
    quotation.items.append(QuotationItem(service_name='Service 1', hsn_code='996521',
                                         quantity=2.0, rate=100.0, amount=200.0))

    from models import db
    db.session.add_all([profile, client, quotation])
    db.session.commit()

    return {'profile': profile, 'client': client, 'quotation': quotation}
