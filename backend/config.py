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
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'instance', 'ats.db')
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
