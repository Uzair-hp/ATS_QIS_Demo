#!/bin/bash
#
# One-time PythonAnywhere setup. Run from a Bash console on PA:
#     bash ~/ATS-QIS/deploy/setup.sh
#
# Safe to re-run: every step is idempotent.
#
# Assumes the project is already at ~/ATS-QIS (clone it in the Files tab or
# over SSH first).

set -euo pipefail

PROJECT_ROOT="$HOME/ATS-QIS"
VENV="$HOME/.virtualenvs/ats-qis"
BACKEND="$PROJECT_ROOT/backend"

echo "==> Project root: $PROJECT_ROOT"
if [ ! -d "$BACKEND" ]; then
    echo "ERROR: $BACKEND not found. Clone the project to ~/ATS-QIS first." >&2
    exit 1
fi

# --- virtualenv ------------------------------------------------------------
# Pin the interpreter. PA's default can change under you; a named venv does not.
if [ ! -d "$VENV" ]; then
    echo "==> Creating virtualenv at $VENV"
    # Use whichever python PA offers. Check the Web tab for the exact path.
    mkvirtualenv --python=/usr/bin/python3.11 ats-qis
else
    echo "==> Virtualenv already exists, reusing it"
    source "$VENV/bin/activate"
fi

# --- python dependencies ---------------------------------------------------
# requirements.txt holds the runtime deps only; the test deps live in
# requirements-dev.txt so the production install stays small.
echo "==> Installing Python dependencies"
pip install --upgrade pip
pip install -r "$BACKEND/requirements.txt"

# --- frontend build --------------------------------------------------------
# PA has Node.js available. If it is not installed on your account, PA will say
# so when you open the Bash console; ask them to enable it.
echo "==> Building the frontend"
cd "$PROJECT_ROOT/frontend"
npm ci          # respects package-lock.json; use `npm install` if you have no lockfile
npm run build   # -> frontend/dist

if [ ! -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
    echo "ERROR: build produced no dist/index.html - the site will return 503." >&2
    exit 1
fi
echo "    dist/index.html OK"

# --- database --------------------------------------------------------------
# The app creates the schema and runs migrations on first import, but doing it
# here means any failure surfaces here rather than as a 500 on the first
# request.
echo "==> Initialising the database"
mkdir -p "$BACKEND/instance"
cd "$BACKEND"

if [ -f .env ]; then
    echo "    .env found - loading it"
    set -a; . ./.env; set +a
fi

if [ -z "${SECRET_KEY:-}" ]; then
    SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
    echo "==> No SECRET_KEY set; generating one"
    if [ -f .env ]; then
        printf 'SECRET_KEY=%s\n' "$SECRET_KEY" >> .env
    else
        printf 'SECRET_KEY=%s\nFLASK_ENV=production\n' "$SECRET_KEY" > .env
        chmod 600 .env
    fi
    echo "    written to $BACKEND/.env - do not commit it"
else
    echo "    SECRET_KEY already set"
fi

export FLASK_ENV=production
python -c "
from app import create_app
app = create_app()
from models import Quotation, Client, CompanyProfile, User
with app.app_context():
    print(f'    users={User.query.count()} clients={Client.query.count()} '
          f'quotations={Quotation.query.count()} profile={CompanyProfile.get_profile().name!r}')
"

# --- remind about the two things this script cannot do ---------------------
cat <<'EOF'

==> Done. Two steps remain, both in the PythonAnywhere web interface:

 1. Web tab -> add a Manual configuration web app, choose the same Python
    version as the virtualenv above, and set:
        Virtualenv:  ats-qis
        (leave Source code EMPTY if the project is at ~/ATS-QIS)

 2. Web tab -> edit the WSGI configuration file, and paste the whole of
        ~/ATS-QIS/deploy/pythonanywhere_wsgi.py

 3. Web tab -> Static files, add BOTH mappings (see the WSGI file for paths):
        /app/assets/            ->  ~/ATS-QIS/frontend/dist/assets
        /app/assets/logo.png    ->  ~/ATS-QIS/frontend/dist/assets

 4. Click the big green RELOAD button.

Then check  https://<username>.pythonanywhere.com/api/health
It should return {"status":"ok","frontend":"built"}.

EOF