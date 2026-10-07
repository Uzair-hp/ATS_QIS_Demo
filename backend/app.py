"""
ATS Automation — Invoice Management System
REST API entry point (JSON only, no Jinja rendering).
"""

import os
from flask import Flask, jsonify, session, request
from flask_cors import CORS
from flask_login import LoginManager
from werkzeug.exceptions import NotFound
from models import db, now_ist, CompanyProfile, User
from config import config_by_name

# Built React SPA, served under /app. One level up from backend/.
FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist'
)


def create_app():
    """Application factory."""
    app = Flask(__name__)

    env = os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config_by_name.get(env, config_by_name['development']))

    os.makedirs(os.path.join(os.path.dirname(__file__), 'instance'), exist_ok=True)

    db.init_app(app)

    # CORS: allow the React dev server to talk to the API with cookies
    CORS(app, origins=[
        'http://localhost:3000', 'http://127.0.0.1:3000',
        'http://localhost:5173', 'http://127.0.0.1:5173',
    ], supports_credentials=True)

    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': 'Authentication required'}), 401

    # --- Register Blueprints (JSON API under /api) ---
    from routes.dashboard import dashboard_bp
    from routes.clients import clients_bp
    from routes.services import services_bp
    from routes.invoices import invoices_bp
    from routes.quotations import quotations_bp
    from routes.settings import settings_bp
    from routes.auth import auth_bp

    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(invoices_bp, url_prefix='/api/invoices')
    app.register_blueprint(quotations_bp, url_prefix='/api/quotations')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
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
    app.run(debug=True, port=5000)
