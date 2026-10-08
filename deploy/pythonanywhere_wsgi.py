"""
WSGI entry point for PythonAnywhere.

Paste the contents of this file into the WSGI configuration file that
PythonAnywhere generates on the Web tab. Do NOT point the web app at this file
directly - PythonAnywhere imports it and looks for a module-level name called
`application`.

To deploy: see deploy/README.md.
"""

import os
import sys

# --- 1. Point at the project root ------------------------------------------
# Replace <username> with your own. The project lives at ~/ATS-QIS, so this is
# /home/<username>/ATS-QIS.
PROJECT_ROOT = os.path.expanduser('~/ATS-QIS')
BACKEND = os.path.join(PROJECT_ROOT, 'backend')

if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# --- 2. Environment --------------------------------------------------------
# PA reads environment variables from a file named .env in the project root, but
# it does NOT read it into os.environ for you. Do it here, before importing the
# app, because create_app() validates SECRET_KEY at import time.
#
# You can also set these in the Web tab's "Environment variables" section. If you
# do it there, this block finds nothing to load and the values already present
# win, because load_dotenv does not override by default.
from dotenv import load_dotenv

load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

# Fail loudly here rather than with an opaque 500 later. create_app() also
# raises on a missing SECRET_KEY in production, but a clear message at startup
# is easier to act on than a broken site.
if not os.environ.get('SECRET_KEY'):
    raise RuntimeError(
        'SECRET_KEY is not set. Generate one with:\n'
        '    python -c "import secrets; print(secrets.token_hex(32))"\n'
        'then put SECRET_KEY=<value> and FLASK_ENV=production in '
        f'{PROJECT_ROOT}/.env, or set them in the Web tab.'
    )

# PRODUCTION must be a real value. Some PA configurations set it to the string
# 'False', which is truthy in Python - the old FLASK_ENV name is accepted so
# existing deployments keep working.
_env = (os.environ.get('FLASK_ENV') or '').strip().lower()
if _env not in ('production', 'development'):
    os.environ['FLASK_ENV'] = 'production'
elif _env == 'development':
    os.environ['FLASK_ENV'] = 'production'
    print('*** FLASK_ENV was "development"; forcing production. '
          'Debug mode is never appropriate on a public host.')

# --- 3. The application ----------------------------------------------------
# wsgi.py calls create_app(), which runs the column migrations and creates the
# admin user on first import. That is safe here: PA imports this file once per
# worker reload, and the migrations are individually wrapped in try/except so a
# duplicate ALTER TABLE is a no-op.
from wsgi import application  # noqa: E402,F401

# --- 4. Static files -------------------------------------------------------
# Do NOT map these here. Serving the SPA's assets from Flask works (there is a
# fallback route for /app/<path>) but ties up a web worker for every CSS and JS
# request, and the free tier has one worker.
#
# Instead, in the Web tab under "Static files", add:
#
#   URL                Directory
#   /app/assets/       <PROJECT_ROOT>/frontend/dist/assets
#   /app/assets/logo.png  <PROJECT_ROOT>/frontend/dist/assets
#
# The hashed /app/assets/ entry covers index-*.css and index-*.js. The logo and
# the stamp are unhashed, so they need a mapping of their own or they will fall
# through to the Flask route (which still works, just slower).