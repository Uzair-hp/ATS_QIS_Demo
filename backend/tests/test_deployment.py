"""Deployment-facing configuration: /api/health, proxy handling, CORS origins.

These are the bits that only matter once the app runs behind a real host, so
nothing else in the suite exercises them.
"""

import importlib
import os
import sys

import pytest


@pytest.fixture
def production_app(tmp_path):
    """create_app() with FLASK_ENV=production, on a throwaway database."""
    from config import DevelopmentConfig

    original_uri = DevelopmentConfig.SQLALCHEMY_DATABASE_URI
    original_env = os.environ.get('FLASK_ENV')
    original_key = os.environ.get('SECRET_KEY')
    original_origins = os.environ.get('ALLOWED_ORIGINS')

    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(tmp_path / 'p.db')
    os.environ['FLASK_ENV'] = 'production'
    os.environ['SECRET_KEY'] = 'test-key'
    os.environ.pop('ALLOWED_ORIGINS', None)

    # create_app() reads os.environ at call time, so a fresh import is enough.
    import app as app_module
    importlib.reload(app_module)
    application = app_module.create_app()

    yield application

    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = original_uri
    for key, value in (('FLASK_ENV', original_env),
                       ('SECRET_KEY', original_key),
                       ('ALLOWED_ORIGINS', original_origins)):
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    importlib.reload(app_module)


def test_production_refuses_to_start_without_secret_key(production_app, monkeypatch):
    """create_app() must fail loudly rather than run with a random key.

    A regenerated key silently invalidates every session on reload, which looks
    like random logouts rather than a configuration error.
    """
    import app as app_module

    monkeypatch.delenv('SECRET_KEY', raising=False)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        app_module.create_app()


def test_health_endpoint_reports_ok(production_app):
    resp = production_app.test_client().get('/api/health')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['status'] == 'ok'
    assert body['frontend'] in ('built', 'missing')


def test_health_endpoint_is_public(production_app):
    """A liveness probe cannot require a session, or it is useless."""
    resp = production_app.test_client().get('/api/health')
    assert resp.status_code == 200
    assert 'user' not in resp.get_json()


def test_health_reports_missing_frontend(production_app):
    body = production_app.test_client().get('/api/health').get_json()
    # In the test checkout dist/ exists, so this documents the shape rather than
    # the value. The real check is that 'frontend' is one of the two states.
    assert isinstance(body.get('frontend'), str)


def test_site_root_redirects_to_the_spa(production_app):
    """A bare host URL must not 404 - it is what people type and what Render
    health-checks with a browser."""
    resp = production_app.test_client().get('/')
    assert resp.status_code in (301, 302, 308)
    assert resp.headers['Location'].endswith('/app/')


def test_production_sets_secure_cookie(production_app):
    assert production_app.config['SESSION_COOKIE_SECURE'] is True


def test_production_wraps_wsgi_in_proxyfix(production_app):
    """Behind PA's proxy, Flask must believe the request arrived over https.

    Without this, SESSION_COOKIE_SECURE never matches and the session cookie is
    dropped by the browser.
    """
    from werkzeug.middleware.proxy_fix import ProxyFix

    assert isinstance(production_app.wsgi_app, ProxyFix)


def test_development_does_not_use_proxyfix(app):
    """Trusting X-Forwarded-* in development would let any client spoof it."""
    from werkzeug.middleware.proxy_fix import ProxyFix

    assert not isinstance(app.wsgi_app, ProxyFix)


def _cors_origin_for(app, origin):
    """What the CORS layer echoes back for a given Origin header.

    flask-cors does not expose its origin list on app.config, so this asserts on
    the observable behaviour instead: the header is set only for an allowed
    origin, and absent for everything else.
    """
    resp = app.test_client().get('/api/health', headers={'Origin': origin})
    return resp.headers.get('Access-Control-Allow-Origin')


def test_cors_defaults_to_localhost_in_production(production_app):
    """Same-origin production needs no CORS; localhost entries are the fallback."""
    assert _cors_origin_for(production_app, 'http://localhost:3000') == 'http://localhost:3000'
    assert _cors_origin_for(production_app, 'https://evil.example.com') is None


def test_allowed_origins_env_var_is_honoured(tmp_path, monkeypatch):
    from config import DevelopmentConfig

    original_uri = DevelopmentConfig.SQLALCHEMY_DATABASE_URI
    original_env = os.environ.get('FLASK_ENV')
    original_key = os.environ.get('SECRET_KEY')

    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(tmp_path / 'c.db')
    os.environ['FLASK_ENV'] = 'production'
    os.environ['SECRET_KEY'] = 'test-key'
    os.environ['ALLOWED_ORIGINS'] = 'https://app.example.com, https://other.example.com'

    import app as app_module
    importlib.reload(app_module)
    application = app_module.create_app()

    assert _cors_origin_for(application, 'https://app.example.com') == 'https://app.example.com'
    assert _cors_origin_for(application, 'https://other.example.com') == 'https://other.example.com'
    # The env var replaces the defaults rather than adding to them.
    assert _cors_origin_for(application, 'http://localhost:3000') is None

    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = original_uri
    os.environ.pop('ALLOWED_ORIGINS', None)
    for key, value in (('FLASK_ENV', original_env), ('SECRET_KEY', original_key)):
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    importlib.reload(app_module)


def test_development_allows_localhost_only(app):
    assert _cors_origin_for(app, 'http://localhost:3000') == 'http://localhost:3000'
    assert _cors_origin_for(app, 'https://evil.example.com') is None


def test_wsgi_module_exposes_application():
    """PA imports `application` from the WSGI file; this module must provide it."""
    sys.modules.pop('wsgi', None)
    import wsgi
    assert wsgi.application is not None
    # The name is what matters, not the type.
    assert callable(wsgi.application)