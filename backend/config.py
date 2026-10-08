"""
Application configuration - supports Development and Production modes.
"""

import os

from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration."""
    # SECRET_KEY is NOT set here. It must be provided via environment variable.
    # The app factory validates it: production fails fast if missing; development
    # auto-generates an ephemeral one if not set.

    # DATABASE_PATH lets a host put the SQLite file somewhere that survives a
    # redeploy. Render's filesystem is ephemeral unless a persistent disk is
    # attached, so leaving this unset there loses every quotation on each deploy.
    # Its render.yaml mounts a disk and points this at it.
    _default_db = os.path.join(basedir, 'instance', 'ats.db')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.environ.get('DATABASE_PATH', _default_db)

    # Render sets this automatically; gunicorn reads it to pick its port. Kept
    # here so `python -m gunicorn` can bind without an inline shell expression.
    PORT = int(os.environ.get('PORT', 5000))
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session cookie hardening. The app is cookie-authenticated, so these back
    # up the CSRF token check in app.py.
    SESSION_COOKIE_HTTPONLY = True
    # 'Lax' still sends the cookie on same-site requests while dropping it on
    # cross-site POSTs, which is what blocks the simple cross-site form POST.
    SESSION_COOKIE_SAMESITE = 'Lax'


class DevelopmentConfig(Config):
    DEBUG = True
    # Local dev runs over plain http on localhost, where a Secure cookie would
    # never be sent back and login would appear to fail.
    SESSION_COOKIE_SECURE = False


class ProductionConfig(Config):
    DEBUG = False
    # Serve over https only. Flip off if TLS is terminated such that Flask
    # still sees http.
    SESSION_COOKIE_SECURE = True


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}
