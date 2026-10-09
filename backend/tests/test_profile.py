"""Per-account profile: what a user may change about themselves, and what they may not."""

import io

import pytest

from models import User


def _profile(client, **fields):
    return client.post(
        '/api/auth/profile',
        data=dict(fields, csrf_token=client.csrf_token),
        content_type='multipart/form-data',
    )


# ── reads ────────────────────────────────────────────────────────────────

def test_me_returns_the_profile_fields(login):
    body = login.get('/api/auth/me').get_json()
    assert body['authenticated'] is True
    assert body['user']['username'] == 'admin'
    assert body['user']['role'] == 'Administrator'


def test_me_never_leaks_the_password_hash(login):
    assert 'password_hash' not in login.get('/api/auth/me').get_json()['user']
    assert 'password_hash' not in login.get('/api/auth/profile').get_json()['user']


def test_profile_requires_login(client, ctx, sample):
    assert client.get('/api/auth/profile').status_code in (401, 403, 308)


# ── writes ───────────────────────────────────────────────────────────────

def test_profile_update_round_trips(login, ctx):
    resp = _profile(login, full_name='Uzair Mansoori', email='u@example.com',
                    phone='+91-9000000000', username='uzair')
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()['user']
    assert body['full_name'] == 'Uzair Mansoori'
    assert body['email'] == 'u@example.com'
    assert body['phone'] == '+91-9000000000'
    assert body['username'] == 'uzair'

    stored = User.query.filter_by(username='uzair').first()
    assert stored.email == 'u@example.com'


def test_blank_optional_fields_are_stored_as_null(login, ctx):
    _profile(login, full_name='Someone', email='a@b.com', username='admin')
    _profile(login, full_name='', email='', phone='', username='admin')
    body = login.get('/api/auth/profile').get_json()['user']
    assert body['email'] is None
    assert body['full_name'] is None


def test_invalid_email_is_rejected_with_a_field_error(login, ctx):
    resp = _profile(login, full_name='A B', email='not-an-email', username='admin')
    assert resp.status_code == 400
    assert 'email' in resp.get_json()['fields']


def test_invalid_username_is_rejected_with_a_field_error(login, ctx):
    resp = _profile(login, full_name='A B', email='', phone='', username='no spaces!')
    assert resp.status_code == 400
    assert 'username' in resp.get_json()['fields']


def test_oversized_name_is_rejected(login, ctx):
    resp = _profile(login, full_name='x' * 121, email='', phone='', username='admin')
    assert resp.status_code == 400
    assert 'full_name' in resp.get_json()['fields']


def test_a_rejected_update_changes_nothing(login, ctx):
    before = login.get('/api/auth/profile').get_json()['user']
    _profile(login, full_name='Should Not Stick', email='bad-email', username='admin')
    assert login.get('/api/auth/profile').get_json()['user'] == before


# ── account boundaries ───────────────────────────────────────────────────

def test_role_cannot_be_changed_by_the_user(login, ctx):
    resp = login.post(
        '/api/auth/profile',
        json={'full_name': 'A B', 'username': 'admin', 'role': 'superuser',
              'id': 999, 'is_admin': True},
        headers={'X-CSRFToken': login.csrf_token},
    )
    assert resp.status_code == 200
    body = resp.get_json()['user']
    assert body['role'] == 'Administrator'
    assert body['id'] == User.query.filter_by(username='admin').first().id


def test_profile_update_needs_the_csrf_token(login, ctx):
    resp = login.post('/api/auth/profile', json={'full_name': 'A B', 'username': 'admin'})
    assert resp.status_code == 403


def test_a_second_account_cannot_take_a_duplicate_email(login, ctx):
    other = User(username='second', email='taken@example.com')
    other.set_password('ats@2026')
    from models import db
    db.session.add(other)
    db.session.commit()

    resp = _profile(login, full_name='A B', email='taken@example.com', username='admin')
    assert resp.status_code == 400
    assert 'email' in resp.get_json()['fields']

    resp = _profile(login, full_name='A B', email='', username='second')
    assert resp.status_code == 400
    assert 'username' in resp.get_json()['fields']


def test_profile_update_does_not_touch_company_settings(login, ctx, sample):
    from models import CompanyProfile
    before = CompanyProfile.get_profile()
    name, gst, bank = before.name, before.gst_number, before.bank_account

    _profile(login, full_name='A B', email='a@b.com', username='admin')

    after = CompanyProfile.get_profile()
    assert (after.name, after.gst_number, after.bank_account) == (name, gst, bank)


def test_profile_update_does_not_touch_business_records(login, ctx, sample):
    from models import Quotation
    qid = sample['quotation'].id
    _profile(login, full_name='A B', email='a@b.com', username='admin')
    assert Quotation.query.get(qid).total_amount == 212.4


# ── avatar ───────────────────────────────────────────────────────────────

PNG_1PX = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08'
    b'\x06\x00\x00\x00\x1f\x15\xc4\x89'
)


def test_avatar_upload_is_stored_and_served_back(login, ctx):
    resp = login.post(
        '/api/auth/profile',
        data={'full_name': 'A B', 'username': 'admin', 'csrf_token': login.csrf_token,
              'avatar': (io.BytesIO(PNG_1PX), 'me.png')},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 200, resp.get_json()
    user = resp.get_json()['user']
    assert user['avatar_mime'] == 'image/png'
    assert user['avatar_image']


def test_avatar_rejects_a_non_image(login, ctx):
    resp = login.post(
        '/api/auth/profile',
        data={'full_name': 'A B', 'username': 'admin', 'csrf_token': login.csrf_token,
              'avatar': (io.BytesIO(b'<script>alert(1)</script>'), 'me.png')},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 400
    assert 'avatar' in resp.get_json()['fields']


def test_avatar_can_be_removed(login, ctx):
    login.post(
        '/api/auth/profile',
        data={'full_name': 'A B', 'username': 'admin', 'csrf_token': login.csrf_token,
              'avatar': (io.BytesIO(PNG_1PX), 'me.png')},
        content_type='multipart/form-data',
    )
    resp = _profile(login, full_name='A B', username='admin', remove_avatar='1')
    assert resp.get_json()['user']['avatar_image'] is None
    assert resp.get_json()['user']['avatar_mime'] is None


# ── password ─────────────────────────────────────────────────────────────

def test_change_password_still_requires_the_current_one(login, ctx):
    resp = login.post(
        '/api/settings/change_password',
        json={'old_password': 'wrong', 'new_password': 'newpass1',
              'confirm_password': 'newpass1'},
        headers={'X-CSRFToken': login.csrf_token},
    )
    assert resp.status_code == 400


def test_change_password_does_not_return_the_hash(login, ctx):
    resp = login.post(
        '/api/settings/change_password',
        json={'old_password': 'ats@2026', 'new_password': 'newpass1',
              'confirm_password': 'newpass1'},
        headers={'X-CSRFToken': login.csrf_token},
    )
    assert resp.status_code == 200
    assert 'password' not in resp.get_json()
    assert 'password_hash' not in resp.get_json()