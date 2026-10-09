"""
Authentication routes (JSON login/logout/me).
"""

import re

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User

auth_bp = Blueprint('auth', __name__)

# Deliberately conservative: the username becomes a login identifier and lands
# in a URL path nowhere, but no reason to admit spaces or shell metacharacters.
USERNAME_RE = re.compile(r'^[A-Za-z0-9._-]{3,50}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')


def _csrf_token():
    """Mint-once CSRF token for the SPA, stored in the session."""
    return current_app.extensions['csrf_token']()


@auth_bp.route('/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({'user': current_user.to_public_dict()})

    data = request.get_json(silent=True) or {}
    username = data.get('username') or request.form.get('username')
    password = data.get('password') or request.form.get('password')
    remember = bool(data.get('remember') or request.form.get('remember') in ('on', 'true', 'True'))

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password or ''):
        return jsonify({'error': 'Invalid username or password.'}), 401

    login_user(user, remember=remember)
    return jsonify({'user': user.to_public_dict()})


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/me')
def me():
    # Unauthenticated-safe: this is where the SPA picks up its CSRF token, so
    # the token must be present in both branches.
    token = _csrf_token()
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_public_dict(),
            'csrf_token': token,
        })
    return jsonify({'authenticated': False, 'csrf_token': token}), 200


@auth_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({'user': current_user.to_public_dict()})


@auth_bp.route('/profile', methods=['POST', 'PUT'])
@login_required
def update_profile():
    """Update the authenticated user's own profile.

    Only the fields named here are read from the payload. Anything else in the
    body — role, id, password_hash — is ignored, so there is no path by which a
    caller can escalate or retarget another account.
    """
    from routes.settings import _validate_image_upload

    data = request.get_json(silent=True) or request.form
    errors = {}

    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    username = (data.get('username') or '').strip() or current_user.username

    if len(full_name) > 120:
        errors['full_name'] = 'Name must be 120 characters or fewer.'
    if email:
        if len(email) > 150:
            errors['email'] = 'Email must be 150 characters or fewer.'
        elif not EMAIL_RE.match(email):
            errors['email'] = 'Enter a valid email address.'
        else:
            taken = User.query.filter(User.email == email,
                                      User.id != current_user.id).first()
            if taken:
                errors['email'] = 'That email is already in use.'
    if phone and len(phone) > 30:
        errors['phone'] = 'Phone must be 30 characters or fewer.'

    if username != current_user.username:
        if not USERNAME_RE.match(username):
            errors['username'] = ('Use 3-50 letters, numbers, dots, dashes or '
                                  'underscores.')
        elif User.query.filter(User.username == username,
                               User.id != current_user.id).first():
            errors['username'] = 'That username is already taken.'

    avatar = None
    avatar_error = None
    remove_avatar = str(data.get('remove_avatar', '')) == '1'
    if 'avatar' in request.files and request.files['avatar']:
        avatar, avatar_error = _validate_image_upload(request.files['avatar'],
                                                      'Photo')
        if avatar_error:
            errors['avatar'] = avatar_error[0].get_json()['error']
    if errors:
        return jsonify({'error': 'Please correct the highlighted fields.',
                        'fields': errors}), 400

    if avatar:
        current_user.avatar_image, current_user.avatar_mime = avatar
    elif remove_avatar:
        current_user.avatar_image = None
        current_user.avatar_mime = None

    current_user.full_name = full_name or None
    current_user.email = email or None
    current_user.phone = phone or None
    current_user.username = username
    db.session.commit()

    return jsonify({'message': 'Profile updated.', 'user': current_user.to_public_dict()})
