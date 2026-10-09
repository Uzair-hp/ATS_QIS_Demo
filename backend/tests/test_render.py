"""The pieces of render.yaml that only matter on Render.

The Blueprint itself is declarative YAML; these tests pin the decisions in it
that would otherwise fail silently. The free plan's filesystem is ephemeral, so
a mistake in DATABASE_PATH is the difference between a demo that resets and one
that keeps its records.
"""

import os

import pytest


def _yaml():
    yaml = pytest.importorskip('yaml')
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    with open(os.path.join(here, 'render.yaml'), encoding='utf-8') as f:
        return yaml.safe_load(f)


@pytest.fixture(scope='module')
def blueprint():
    return _yaml()


@pytest.fixture(scope='module')
def service(blueprint):
    return blueprint['services'][0]


def test_blueprint_parses(blueprint):
    assert 'services' in blueprint
    assert len(blueprint['services']) == 1


def test_service_is_a_python_web_service(service):
    assert service['type'] == 'web'
    assert service['runtime'] == 'python'


def test_plan_and_disk_agree_about_persistence(service):
    """The free plan has no disk, so the database cannot persist.

    These are the two halves of one decision. If the plan is ever moved off
    'free', a disk and a DATABASE_PATH on that disk have to come back with it -
    otherwise the deploy silently resets on every restart.
    """
    plan = service.get('plan')
    disk = service.get('disk')
    env = {e['key']: e.get('value') for e in service['envVars']}
    path = env.get('DATABASE_PATH')

    assert path, 'DATABASE_PATH is unset, so the database lands in the build dir'
    assert path.endswith('.db')

    if plan == 'free':
        assert not disk, 'the free plan does not support disks'
        assert path.startswith('/tmp/'), \
            f'{path} is outside /tmp; the free instance wipes the filesystem on restart'
    else:
        assert disk, f'plan {plan} costs money but has no disk: the database is wiped anyway'
        assert path.startswith(disk['mountPath']), \
            f'{path} is outside the disk at {disk["mountPath"]}; it will not persist'


def test_secret_key_is_generated_not_committed(service):
    """A hardcoded SECRET_KEY would be a committed credential."""
    env = {e['key']: e for e in service['envVars']}
    secret = env.get('SECRET_KEY')
    assert secret, 'SECRET_KEY is missing; the app refuses to start without it'
    assert secret.get('generateValue') is True, \
        'SECRET_KEY should use generateValue, not a literal value'
    assert 'value' not in secret, 'SECRET_KEY must not have a literal value'


def test_flask_env_is_production(service):
    """Development config sets SESSION_COOKIE_SECURE=False, which breaks auth
    on a TLS host, and skips ProxyFix so Flask thinks it is on plain HTTP."""
    env = {e['key']: e.get('value') for e in service['envVars']}
    assert env.get('FLASK_ENV') == 'production'


def test_build_installs_python_and_builds_the_frontend(service):
    build = service['buildCommand']
    assert 'pip install' in build and 'requirements.txt' in build
    assert 'npm' in build and 'build' in build, \
        'the SPA must be built or /app/ returns 503'


def test_start_command_binds_to_the_render_port(service):
    start = service['startCommand']
    assert 'gunicorn' in start
    assert '$PORT' in start, 'must bind $PORT or the health check cannot reach it'
    assert '0.0.0.0' in start, 'must bind 0.0.0.0, not localhost'
    assert 'wsgi:application' in start


def test_health_check_uses_the_endpoint_that_exists(service):
    assert service['healthCheckPath'] == '/api/health'


def test_gunicorn_timeout_exceeds_the_pdf_render_time(service):
    """xhtml2PDF is CPU-bound. The 120s gunicorn timeout protects PDF renders."""
    sc = service['startCommand']
    assert '--timeout' in sc
    parts = sc.split()
    idx = parts.index('--timeout')
    assert int(parts[idx + 1]) >= 120


def test_gunicorn_is_a_runtime_dependency():
    """The startCommand runs gunicorn; it has to be installable."""
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    with open(os.path.join(here, 'backend', 'requirements.txt'), encoding='utf-8') as f:
        assert 'gunicorn' in f.read()


# --- config.py behaviour -------------------------------------------------

def test_database_path_env_var_is_honoured(tmp_path, monkeypatch):
    """The mechanism the Blueprint depends on, tested directly."""
    import importlib

    target = tmp_path / 'render' / 'ats.db'
    monkeypatch.setenv('DATABASE_PATH', str(target))

    import config
    importlib.reload(config)
    assert config.Config.SQLALCHEMY_DATABASE_URI == f'sqlite:///{target}'

    monkeypatch.delenv('DATABASE_PATH', raising=False)
    importlib.reload(config)


def test_database_path_defaults_to_the_repo_instance(tmp_path, monkeypatch):
    import importlib

    monkeypatch.delenv('DATABASE_PATH', raising=False)
    import config
    importlib.reload(config)

    uri = config.Config.SQLALCHEMY_DATABASE_URI
    assert uri.startswith('sqlite:///')
    assert uri.endswith(os.path.join('backend', 'instance', 'ats.db').replace('\\', '/')) \
        or 'instance' in uri


def test_app_creates_the_directory_database_path_points_at(tmp_path):
    """A mounted disk starts empty, so the directory must be created.

    Run in a subprocess: create_app reads config_by_name at import time, so
    reloading config in-process would not actually exercise the new value.
    """
    import subprocess
    import sys

    nested = tmp_path / 'deep' / 'nested' / 'ats.db'
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    env = dict(os.environ,
               DATABASE_PATH=str(nested),
               FLASK_ENV='production',
               SECRET_KEY='render-test-key')

    proc = subprocess.run(
        [sys.executable, '-c',
         'from app import create_app; create_app(); print("ok")'],
        cwd=here, env=env, capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 0, proc.stderr[-500:]
    assert nested.parent.exists(), 'the SQLite directory was not created'
    assert nested.exists(), 'the database file was not created'