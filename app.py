"""
ATS Automation — Invoice Management System
Main Application Entry Point
"""

import os
from flask import Flask
from flask_login import LoginManager
from models import db, now_ist, CompanyProfile, User
from config import config_by_name


def create_app():
    """Application factory."""
    app = Flask(__name__)

    # Load config
    env = os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config_by_name.get(env, config_by_name['development']))

    # Ensure instance folder
    os.makedirs(os.path.join(os.path.dirname(__file__), 'instance'), exist_ok=True)

    # Initialize DB
    db.init_app(app)

    # Initialize LoginManager
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # --- CSRF Protection & Global Context Injector ---
    import secrets
    from flask import session, request, abort

    @app.context_processor
    def inject_globals():
        profile = None
        try:
            profile = CompanyProfile.get_profile()
        except Exception:
            pass

        def get_csrf_token():
            if 'csrf_token' not in session:
                session['csrf_token'] = secrets.token_hex(32)
            return session['csrf_token']

        return {
            'now_ist': now_ist,
            'company': profile,
            'csrf_token': get_csrf_token,
        }

    @app.before_request
    def csrf_protect():
        if request.method == 'POST':
            token = request.form.get('csrf_token')
            session_token = session.get('csrf_token')
            if not session_token or not token or session_token != token:
                abort(400, description="CSRF token validation failed. Please refresh the page and try again.")

    # --- Register Blueprints ---
    from routes.dashboard import dashboard_bp
    from routes.clients import clients_bp
    from routes.services import services_bp
    from routes.invoices import invoices_bp
    from routes.quotations import quotations_bp
    from routes.settings import settings_bp
    from routes.auth import auth_bp

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(clients_bp, url_prefix='/clients')
    app.register_blueprint(services_bp, url_prefix='/services')
    app.register_blueprint(invoices_bp, url_prefix='/invoices')
    app.register_blueprint(quotations_bp, url_prefix='/quotations')
    app.register_blueprint(settings_bp, url_prefix='/settings')
    app.register_blueprint(auth_bp, url_prefix='/auth')

    # --- PWA Service Worker & Manifest Routes ---
    from flask import send_from_directory
    @app.route('/sw.js')
    def serve_sw():
        return send_from_directory(app.static_folder, 'js/sw.js', mimetype='application/javascript')

    @app.route('/manifest.json')
    def serve_manifest():
        return send_from_directory(app.static_folder, 'manifest.json', mimetype='application/json')

    # Create tables
    with app.app_context():
        db.create_all()

        # Run safe migrations for SQLite columns
        from sqlalchemy import text
        try:
            db.session.execute(text("ALTER TABLE company_profile ADD COLUMN default_quotation_terms TEXT"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(text("ALTER TABLE invoices ADD COLUMN ref_quotation_number VARCHAR(50)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(text("ALTER TABLE clients ADD COLUMN company_name VARCHAR(150)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # --- Phase 1: ATS Automation new columns ---

        # Task 1.1 — CompanyProfile new fields
        for col in [
            "ALTER TABLE company_profile ADD COLUMN gst_number VARCHAR(50)",
            "ALTER TABLE company_profile ADD COLUMN msme_number VARCHAR(100)",
            "ALTER TABLE company_profile ADD COLUMN stamp_image TEXT",
            "ALTER TABLE company_profile ADD COLUMN default_gst_percent FLOAT DEFAULT 18.0",
            "ALTER TABLE company_profile ADD COLUMN website VARCHAR(200)",
        ]:
            try:
                db.session.execute(text(col))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Task 1.2 — Client GST
        try:
            db.session.execute(text("ALTER TABLE clients ADD COLUMN gst_number VARCHAR(50)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Task 1.3 — Invoice new fields
        for col in [
            "ALTER TABLE invoices ADD COLUMN subject VARCHAR(200)",
            "ALTER TABLE invoices ADD COLUMN delivery_address TEXT",
            "ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(100)",
            "ALTER TABLE invoices ADD COLUMN voucher_number VARCHAR(50)",
            "ALTER TABLE invoices ADD COLUMN gst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE invoices ADD COLUMN gst_amount FLOAT DEFAULT 0.0",
        ]:
            try:
                db.session.execute(text(col))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Task 1.4 — InvoiceItem HSN
        try:
            db.session.execute(text("ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(20)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Task 1.5 — Quotation new fields
        for col in [
            "ALTER TABLE quotations ADD COLUMN subject VARCHAR(200)",
            "ALTER TABLE quotations ADD COLUMN delivery_address TEXT",
            "ALTER TABLE quotations ADD COLUMN gst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE quotations ADD COLUMN gst_amount FLOAT DEFAULT 0.0",
        ]:
            try:
                db.session.execute(text(col))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Task 1.6 — QuotationItem HSN
        try:
            db.session.execute(text("ALTER TABLE quotation_items ADD COLUMN hsn_code VARCHAR(20)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Service new fields
        for col in [
            "ALTER TABLE services ADD COLUMN hsn_code VARCHAR(20)",
            "ALTER TABLE services ADD COLUMN description TEXT",
        ]:
            try:
                db.session.execute(text(col))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Ensure default company profile exists
        CompanyProfile.get_profile()


        # Ensure default admin user exists
        if not User.query.filter_by(username='admin').first():
            admin_user = User(username='admin')
            admin_user.set_password('ats@2026')
            db.session.add(admin_user)
            db.session.commit()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
