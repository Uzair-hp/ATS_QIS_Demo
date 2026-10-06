"""
Authentication routes (JSON login/logout/me).
"""

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({'user': {'id': current_user.id, 'username': current_user.username}})

    data = request.get_json(silent=True) or {}
    username = data.get('username') or request.form.get('username')
    password = data.get('password') or request.form.get('password')
    remember = bool(data.get('remember') or request.form.get('remember') in ('on', 'true', 'True'))

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password or ''):
        return jsonify({'error': 'Invalid username or password.'}), 401

    login_user(user, remember=remember)
    return jsonify({'user': {'id': user.id, 'username': user.username}})


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/me')
def me():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'user': {'id': current_user.id, 'username': current_user.username}})
    return jsonify({'authenticated': False}), 200
