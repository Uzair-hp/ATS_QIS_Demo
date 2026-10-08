# PythonAnywhere deployment

The app is a Flask JSON API that serves the built React SPA. Two Bash commands,
two Web-tab clicks.

```bash
git clone https://github.com/Uzair-hp/ATS_QIS_Demo.git ATS-QIS
bash ~/ATS-QIS/deploy/setup.sh
```

Then in the Web tab: add a Manual-configuration web app pointing at the
`ats-qis` virtualenv, paste `deploy/pythonanywhere_wsgi.py` into the WSGI
config, and reload. Steps 1–3 below spell it out.

**Node.js is not required** — the frontend bundle is committed to the repo.

**Before you start:** the free tier expires the web app after one month unless
you log in. See [Free tier limits](#free-tier-limits) — fine for a demo, not
something to carry for live client data.

---

## Which repository

| Remote | Repository | Use |
|--------|-----------|-----|
| `demo` | `https://github.com/Uzair-hp/ATS_QIS_Demo.git` | Demos, trials, evaluation |
| `origin` | `https://github.com/brightlant223/ats-qis.git` | Production |

Swap the URL in step 1 to deploy production. Nothing else changes.

> The live site's data lives only on PythonAnywhere. The repo is code;
> `backend/instance/ats.db` is your clients, invoices and quotations. See
> [Backups](#backups).

---

## 1. Clone

In a **Bash console** (Files → Bash, or SSH):

```bash
cd ~
git clone https://github.com/Uzair-hp/ATS_QIS_Demo.git ATS-QIS
```

## 2. Set up

```bash
bash ~/ATS-QIS/deploy/setup.sh
```

Creates the virtualenv, installs Python dependencies, prepares the frontend, and
initialises the database. Safe to re-run.

Ends with:

```
    users=1 clients=0 quotations=0 profile='ATS Automation'
```

A non-zero exit before that line means the site will not start — read the error.
The script also prints your venv's Python path; copy it into step 3.

**If it says `npm not installed`**, that is expected and fine. PA does not
enable Node.js on every account, so `setup.sh` falls back to the bundle
committed at `frontend/dist`.

When you change `frontend/src`, rebuild and commit that bundle:

```bash
cd frontend && npm run build
git add -A frontend/dist && git commit -m "build: frontend bundle"
```

---

## 3. Point a web app at it

**Web** tab → **Add a new web app** → **Manual configuration**.

| Setting | Value |
|---|---|
| Python version | the one step 2 printed |
| Source code | leave **empty** — the project is already at `~/ATS-QIS` |
| Virtualenv | `ats-qis` |

**Edit the WSGI configuration file** and paste all of
`deploy/pythonanywhere_wsgi.py`. It puts `backend/` on the path, loads `.env`,
forces `FLASK_ENV=production`, fails loudly if `SECRET_KEY` is missing, then
imports the app. Edit `PROJECT_ROOT` at the top if you cloned elsewhere.

Do not point the web app at `backend/wsgi.py` — PA looks for a name called
`application`, which only the PA file provides.

## 4. Static files — optional

**Skip it and everything still works.** Flask serves `frontend/dist` and every
asset loads correctly with no mapping:

```
/app/assets/index-*.js    200  application/javascript
/app/assets/index-*.css   200  text/css
/app/assets/logo.png      200  image/png
```

Adding the mapping hands those requests to PA's front end instead of occupying
your one web worker. On the free tier that is worth two clicks, but it is an
optimisation, not a requirement.

**Web** tab → **Static files**:

| URL | Directory |
|---|---|
| `/app/assets/` | `/home/<username>/ATS-QIS/frontend/dist/assets` |

## 5. Reload and check

Click the green **RELOAD** button, then:

```
https://<username>.pythonanywhere.com/api/health
```

Expect `{"status":"ok","frontend":"built"}`. The endpoint is public, so it works
logged out.

Then open `/app/` and log in with `admin` / `ats@2026`.

> **Change the password immediately.** The defaults are public knowledge and
> this is a public URL.

### Smoke test

| Check | Expected |
|---|---|
| `/api/health` | `{"status":"ok","frontend":"built"}` |
| `/app/` | Login screen |
| `/app/quotations/1` | Login redirect — proves deep-links work |
| Login → dashboard | Loads |
| Quotation → Print / Save as PDF | A4 sheet, FORTIS layout |
| Same quotation → Download PDF | Same figures, server-rendered |
| Sidebar → Blank Letterhead | One-page PDF |

The print sheet and the PDF are separate pipelines and must show the **same
figures**. If they disagree, that is a bug — see `context_handover.md` §5.

---

## Environment variables

Set in the **Web** tab under **Environment variables**, or in `backend/.env`
(the WSGI file loads it):

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **yes** | The app refuses to start without it in production. `setup.sh` writes one. |
| `FLASK_ENV` | **yes** | `production`. |
| `ALLOWED_ORIGINS` | no | Only for a split deployment. **Not needed here** — the SPA is same-origin. |

Changing `SECRET_KEY` logs everyone out. No data is lost.

---

## Updating after a `git pull`

```bash
cd ~/ATS-QIS
source ~/.virtualenvs/ats-qis/bin/activate
pip install -r backend/requirements.txt     # only if deps changed
cd frontend && npm ci && npm run build && cd ..   # only if you have npm
```

Then **RELOAD**.

Schema changes need no manual step — `db.create_all()` and the migrations run
inside `create_app()` on import.

Full redeploy from scratch:

```bash
cd ~ && mv ATS-QIS/backend/instance/ats.db ~/ats-backup.db
rm -rf ATS-QIS
git clone https://github.com/Uzair-hp/ATS_QIS_Demo.git ATS-QIS
bash ~/ATS-QIS/deploy/setup.sh
mkdir -p ATS-QIS/backend/instance && mv ~/ats-backup.db ATS-QIS/backend/instance/ats.db
```

---

## Free tier limits

Measured 2026-10-08 from a clean clone.

| Limit | Value | Consequence here |
|---|---|---|
| Disk | 512 MiB | The clone is **4.1 MB** with the bundle in it. Not a concern. |
| Web workers | **1** | Requests are serial. The optional mapping in step 4 is worth adding. |
| CPU | 100 s/day | PDF generation dominates. A heavy printing day will exhaust it. |
| Web app expiry | **1 month** | **The app stops being served unless you log in.** PA emails first. Your data is *not* deleted — click the link to restart it. |
| MySQL / cron | unavailable on accounts created after 2026-01-15 | SQLite only, no scheduled tasks. |
| Consoles | 2 | Fine. |

The one-month expiry is the thing to plan around. It is not a hard failure — you
get an email, click a link, it runs another month — but it will catch you if you
stop paying attention. Fine for a demo; not something to carry for live client
data. The Developer plan is $10/month and removes it.

---

## Troubleshooting

**`npm not installed`**
Expected on many accounts. The committed bundle is used instead. Nothing to do.

**`setup.sh` fails at the venv step**
The pinned Python version is not on your account. Check the Web tab for your
available version and change the `--python=` flag in the script.

**Site blank, or every request 503s**
Check the **error log** on the Web tab. A missing `SECRET_KEY` raises at import
and takes the worker down; the WSGI file checks this first with a clearer
message than the app would give.

**`/app/` returns a JSON error about the frontend build**
`frontend/dist/index.html` is missing. Re-run `setup.sh`.

**CSS and JS 404, page unstyled**
Stale bundle. Check `/api/health` — `"missing"` means `dist/` is absent;
`"built"` with 404s means the browser cached an old `index.html`. Hard-reload
with Ctrl+Shift+R.

**Login works, then every request 403s**
`SESSION_COOKIE_SECURE` is on in production, so the session cookie only travels
over HTTPS. Use the `https://` URL.

**`405` on POST/PUT/DELETE**
The CSRF check found no token. Check `ALLOWED_ORIGINS`, and confirm
`FLASK_ENV=production` so `ProxyFix` is active.

**PDFs render blank or unstyled**
See `context_handover.md` §7 — xhtml2pdf drops several CSS features **without
an error**. If you edited a PDF template, read that first.

---

## Backups

`backend/instance/ats.db` is your entire dataset. **Nothing else backs it up.**

```bash
cp ~/ATS-QIS/backend/instance/ats.db ~/backup-$(date +%F).db
# restore, then RELOAD on the Web tab
cp ~/backup-2026-10-08.db ~/ATS-QIS/backend/instance/ats.db
```

Copy it off the platform if the data matters. Automated backups need a paid
account.

Start over with an empty system: Settings → Danger Zone → `DELETE ALL DATA`.

---

## Not covered here

- **Automated deploys.** No build hook on the free tier. `git pull` + RELOAD is
  fine for a system this size.
- **Custom domains.** Paid tier only.
- **Automated backups.** Manual on the free tier.
- **Zero-downtime reloads.** Expect a few seconds of downtime per reload.

---

## Reference

| File | Purpose |
|---|---|
| `setup.sh` | Everything scriptable |
| `pythonanywhere_wsgi.py` | Paste into the Web tab's WSGI config file |
| `backend/wsgi.py` | The app's WSGI entry point — do **not** paste this into PA |
| `../context_handover.md` | Architecture; xhtml2pdf constraints in §7 |
| `../AGENTS.md` | Which remote to push to; traps in this codebase |