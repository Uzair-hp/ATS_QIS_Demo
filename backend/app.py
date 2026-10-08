"""
ATS Automation — Invoice Management System
REST API entry point (JSON only, no Jinja rendering).
"""

import os
import secrets
from flask import Flask, jsonify, session, request
from flask_cors import CORS
from flask_login import LoginManager, current_user
from werkzeug.exceptions import NotFound
from models import db, now_ist, CompanyProfile, User
from config import config_by_name

# Built React SPA, served under /app. One level up from backend/.
FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist'
)

CSRF_SESSION_KEY = 'csrf_token'
CSRF_HEADER = 'X-CSRFToken'
CSRF_SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')

# Endpoints reachable without a CSRF token: /api/auth/login (the very first
# call a browser makes, before it can hold a session) and /api/auth/logout
# (it only destroys the session, so a forged call cannot gain anything).
CSRF_EXEMPT_ENDPOINTS = ('auth.login', 'auth.logout')


def create_app():
    """Application factory."""
    app = Flask(__name__)

    env = os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config_by_name.get(env, config_by_name['development']))

    # Validate SECRET_KEY: production must have it explicitly set in environment;
    # development auto-generates an ephemeral one if missing (not persisted).
    secret_key = os.environ.get('SECRET_KEY')
    if env == 'production':
        if not secret_key:
            raise RuntimeError(
                'SECRET_KEY must be set in environment for production. '
                'Set it in .env or your deployment configuration.'
            )
        app.config['SECRET_KEY'] = secret_key
    elif not secret_key:
        # Development only: generate ephemeral secret so local dev works
        # without a committed secret. This changes on every restart.
        app.config['SECRET_KEY'] = secrets.token_hex(32)
    else:
        app.config['SECRET_KEY'] = secret_key

    os.makedirs(os.path.join(os.path.dirname(__file__), 'instance'), exist_ok=True)

    db.init_app(app)

    # Behind a reverse proxy (PythonAnywhere, nginx, a load balancer) Flask
    # otherwise believes every request arrived over plain HTTP. That breaks
    # SESSION_COOKIE_SECURE and makes Flask build http:// URLs on an https://
    # site, which the browser then blocks as mixed content.
    #
    # One proxy hop is the default. Raise it only if you front the app with
    # more than one - each extra hop lets a client spoof X-Forwarded-For.
    if env == 'production':
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # CORS: the React dev server on localhost during development. In production
    # the SPA is served from the same origin as the API, so no cross-origin
    # request is made and an extra allowed origin is not needed. ALLOWED_ORIGINS
    # is for a split deployment where the SPA lives on another host.
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '')
    origins = [o.strip() for o in allowed_origins.split(',') if o.strip()] or [
        'http://localhost:3000', 'http://127.0.0.1:3000',
        'http://localhost:5173', 'http://127.0.0.1:5173',
    ]
    CORS(app, origins=origins, supports_credentials=True)

    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': 'Authentication required'}), 401

    # --- CSRF Protection ---
    # Session-stored token, the same mechanism the Jinja app used. The token is
    # handed to the SPA once via GET /api/auth/me and echoed back on every
    # state-changing request in the X-CSRFToken header.
    def csrf_token():
        """The session's CSRF token, minted on first use."""
        if CSRF_SESSION_KEY not in session:
            session[CSRF_SESSION_KEY] = secrets.token_hex(32)
        return session[CSRF_SESSION_KEY]

    app.extensions['csrf_token'] = csrf_token

    def _submitted_csrf_token():
        # Header first (JSON API), then form body (multipart uploads).
        header = request.headers.get(CSRF_HEADER)
        if header:
            return header.strip()
        form = getattr(request, 'form', None)
        if form:
            return (form.get('csrf_token') or '').strip()
        args = getattr(request, 'args', None)
        if args:
            return (args.get('csrf_token') or '').strip()
        return ''

    @app.before_request
    def csrf_protect():
        if request.method in CSRF_SAFE_METHODS:
            return None
        if request.endpoint in CSRF_EXEMPT_ENDPOINTS:
            return None
        # Nothing to ride on without a session, so let @login_required answer
        # with 401 rather than masking it as a 403.
        if not current_user.is_authenticated:
            return None

        expected = session.get(CSRF_SESSION_KEY)
        submitted = _submitted_csrf_token()

        if not expected or not submitted:
            return jsonify({
                'error': 'CSRF token missing.',
                'detail': f'Send the token from GET /api/auth/me in the {CSRF_HEADER} header.',
            }), 403

        if not secrets.compare_digest(expected, submitted):
            return jsonify({
                'error': 'CSRF token validation failed.',
                'detail': 'Refresh the page and try again.',
            }), 403

        return None

    # --- Register Blueprints (JSON API under /api) ---
    from routes.dashboard import dashboard_bp
    from routes.clients import clients_bp
    from routes.services import services_bp
    from routes.invoices import invoices_bp
    from routes.quotations import quotations_bp
    from routes.settings import settings_bp
    from routes.letterhead import letterhead_bp
    from routes.auth import auth_bp

    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(invoices_bp, url_prefix='/api/invoices')
    app.register_blueprint(quotations_bp, url_prefix='/api/quotations')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(letterhead_bp, url_prefix='/api/letterhead')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Static + manifest endpoints (used by PDF templates / PWA assets)
    from flask import send_from_directory

    @app.route('/sw.js')
    def serve_sw():
        return send_from_directory(app.static_folder, 'js/sw.js', mimetype='application/javascript')

    @app.route('/manifest.json')
    def serve_manifest():
        return send_from_directory(app.static_folder, 'manifest.json', mimetype='application/json')

    # --- React SPA, served under /app ---
    # Registered after the blueprints and the /sw.js + /manifest.json routes so
    # those keep winning. Nothing is matched outside the /app/ prefix, so
    # /api/* and /static/* cannot be intercepted here.

    def spa_index():
        """The SPA shell. Returned for every client-side route."""
        try:
            return send_from_directory(FRONTEND_DIST, 'index.html')
        except NotFound:
            return jsonify({
                'error': 'Frontend build not found.',
                'detail': f'Expected {FRONTEND_DIST}/index.html. Run "npm run build" in frontend/.',
            }), 503

    @app.route('/app/')
    def serve_spa_root():
        return spa_index()

    @app.route('/app', defaults={'spa_path': ''})
    @app.route('/app/<path:spa_path>')
    def serve_spa(spa_path):
        """Serve a real file from dist/ when it exists, else index.html.

        Falling back to index.html is what makes client-side routes such as
        /app/quotations/1 survive a refresh.
        """
        if spa_path:
            try:
                return send_from_directory(FRONTEND_DIST, spa_path)
            except NotFound:
                pass
        return spa_index()

    @app.route('/api/health')
    def health():
        """Liveness probe. Public, so a platform can check the app is up.

        Deliberately says nothing about the database contents - it reports
        whether the process is serving, not what is in it.
        """
        return jsonify({
            'status': 'ok',
            'frontend': 'built' if os.path.exists(
                os.path.join(FRONTEND_DIST, 'index.html')) else 'missing',
        })

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Method not allowed'}), 405

    with app.app_context():
        db.create_all()

        from sqlalchemy import text
        migrations = [
            "ALTER TABLE company_profile ADD COLUMN default_quotation_terms TEXT",
            "ALTER TABLE invoices ADD COLUMN ref_quotation_number VARCHAR(50)",
            "ALTER TABLE clients ADD COLUMN company_name VARCHAR(150)",
            "ALTER TABLE company_profile ADD COLUMN gst_number VARCHAR(50)",
            "ALTER TABLE company_profile ADD COLUMN msme_number VARCHAR(100)",
            "ALTER TABLE company_profile ADD COLUMN stamp_image TEXT",
            "ALTER TABLE company_profile ADD COLUMN stamp_mime VARCHAR(30)",
            "ALTER TABLE company_profile ADD COLUMN default_gst_percent FLOAT DEFAULT 18.0",
            "ALTER TABLE company_profile ADD COLUMN website VARCHAR(200)",
            "ALTER TABLE clients ADD COLUMN gst_number VARCHAR(50)",
            "ALTER TABLE invoices ADD COLUMN subject VARCHAR(200)",
            "ALTER TABLE invoices ADD COLUMN delivery_address TEXT",
            "ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(100)",
            "ALTER TABLE invoices ADD COLUMN voucher_number VARCHAR(50)",
            "ALTER TABLE invoices ADD COLUMN gst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE invoices ADD COLUMN gst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(20)",
            "ALTER TABLE quotations ADD COLUMN subject VARCHAR(200)",
            "ALTER TABLE quotations ADD COLUMN delivery_address TEXT",
            "ALTER TABLE quotations ADD COLUMN payment_terms VARCHAR(100)",
            "ALTER TABLE quotations ADD COLUMN gst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE quotations ADD COLUMN gst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE quotation_items ADD COLUMN hsn_code VARCHAR(20)",
            "ALTER TABLE services ADD COLUMN hsn_code VARCHAR(20)",
            "ALTER TABLE services ADD COLUMN description TEXT",
        ]
        for col in migrations:
            try:
                db.session.execute(text(col))
                db.session.commit()
            except Exception:
                db.session.rollback()

        CompanyProfile.get_profile()

        if not User.query.filter_by(username='admin').first():
            admin_user = User(username='admin')
            admin_user.set_password('ats@2026')
            db.session.add(admin_user)
            db.session.commit()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=app.config.get('DEBUG', False), port=5000)
