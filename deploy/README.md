# PythonAnywhere deployment

Deploying ATS QIS to PythonAnywhere. The app is a Flask JSON API that also
serves the built React SPA, so both halves have to be set up.

**Before you start:** the free tier is a real constraint, not a formality. See
[Free tier limits](#free-tier-limits) below — if this is going to be used for
real client data, a paid plan or a different host is the better call.

---

## 1. Get the code onto PythonAnywhere

From a Bash console, or over SSH:

```bash
git clone https://github.com/brightlant223/ats-qis.git ~/ATS-QIS
cd ~/ATS-QIS
```

Want to deploy the demo branch instead? `git clone -b main
https://github.com/Uzair-hp/ATS_QIS_Demo.git ~/ATS-QIS`

Do **not** clone into a path containing `.git` bloat you cannot delete later —
the disk quota is small.

---

## 2. Run the setup script

In the PythonAnywhere **Bash console**:

```bash
bash ~/ATS-QIS/deploy/setup.sh
```

It creates the virtualenv, installs Python dependencies, builds the frontend,
and initialises the database. Re-runnable.

If your account does not have Node.js, the `npm ci` step fails. Ask
PythonAnywhere to enable it, or build the frontend locally and push `dist/`:

```bash
# locally
cd frontend && npm ci && npm run build
git add -f frontend/dist && git commit -m "build: frontend bundle"
```

---

## 3. Configure the web app

Go to the **Web** tab.

| Setting | Value |
|---|---|
| Add a new web app | **Manual configuration** |
| Python version | must match the virtualenv created in step 2 |
| Source code | leave **empty** — the project is already at `~/ATS-QIS` |
| Virtualenv | `ats-qis` |

Then **Edit the WSGI configuration file** and paste the entire contents of
`deploy/pythonanywhere_wsgi.py`.

Edit the `PROJECT_ROOT` line near the top if you cloned somewhere other than
`~/ATS-QIS`.

---

## 4. Static files

Still on the **Web** tab, under **Static files**, add **both** mappings:

| URL | Directory |
|---|---|
| `/app/assets/` | `/home/<username>/ATS-QIS/frontend/dist/assets` |
| `/app/assets/logo.png` | `/home/<username>/ATS-QIS/frontend/dist/assets` |

Why both: the first covers the content-hashed `index-*.css` and `index-*.js`,
but `logo.png` and `stamp.png` are unhashed and need a mapping of their own.
Without them they still work — Flask falls through to a catch-all route — but
every request occupies a web worker, and the free tier has one.

Then click the green **RELOAD** button.

---

## 5. Verify

```
https://<username>.pythonanywhere.com/api/health
```

Expect:

```json
{"status":"ok","frontend":"built"}
```

`"frontend":"missing"` means the `npm run build` step did not run or went to the
wrong path. Check `deploy/setup.sh` output.

Then open `/app/` and log in with `admin` / `ats@2026`.

**Change the password immediately** (Settings → Change Password). The default
credentials are public knowledge.

---

## Environment variables

Set in the Web tab under **Environment variables**, or in
`backend/.env` (the WSGI file loads it):

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **yes** | The app refuses to start without it in production. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. Changing it logs everyone out. |
| `FLASK_ENV` | **yes** | `production`. `setup.sh` writes this. |
| `ALLOWED_ORIGINS` | no | Only for a split deployment where the SPA is on another host. Comma-separated. Not needed here — the SPA is same-origin. |

---

## Updating after a `git pull`

```bash
cd ~/ATS-QIS
source ~/.virtualenvs/ats-qis/bin/activate

cd frontend && npm ci && npm run build && cd ..
pip install -r backend/requirements.txt   # in case deps changed
```

Then click **RELOAD** on the Web tab.

`db.create_all()` and the column migrations run on import, so schema changes
apply on the next reload. No manual migration step.

---

## Free tier limits

As of 2026, a free PythonAnywhere account gets:

| Limit | Value | Consequence here |
|---|---|---|
| Disk | 512 MiB | The repo is ~26 MB; `node_modules` is ~51 MB. It fits, but only just — delete `.git` if you clone over SSH. |
| Web apps | 1 | Fine. |
| Web workers | 1 | Every request is serial. The static-file mappings above matter much more than usual. |
| CPU | 100 s/day | PDF generation is the expensive operation. A busy day of xhtml2pdf rendering will hit this. |
| Web app expiry | 1 month | **The app stops being served unless you log in.** PythonAnywhere emails first. Your data is not deleted — click the link to restart it. |
| MySQL / scheduled tasks | not available on accounts created after 2026-01-15 | SQLite only, and no cron. |

The monthly expiry is the one to plan around. If this is going to hold live
client data, budget for the Developer plan ($10/month) or use a different host.

---

## Troubleshooting

**`/app/` returns a JSON error about the frontend build**
`npm run build` did not run, or ran in the wrong directory. Check
`~/ATS-QIS/frontend/dist/index.html` exists.

**Everything is 503 or the site is blank after a reload**
Check the error log on the Web tab. A missing `SECRET_KEY` raises at import and
takes the whole worker down.

**`405` on any POST/PUT/DELETE**
The CSRF check in `backend/app.py` rejects requests with no token. This usually
means you are hitting a different origin — check `ALLOWED_ORIGINS`, and that
`ProxyFix` is active (it is, whenever `FLASK_ENV=production`).

**CSS and JS 404, page renders unstyled**
The static file mappings are missing or point at the wrong directory. The
catch-all route only serves `index.html` for unknown paths, so `/app/assets/...`
falls through to it and returns HTML with a JS content type.

**Login works, but then every request 403s**
`SESSION_COOKIE_SECURE` is on in production, so the session cookie is only sent
over HTTPS. Confirm the site is being served over https:// — not the
`http://<username>.pythonanywhere.com` URL, which PA redirects.

**PDFs render blank or unstyled**
See `context_handover.md` §7 — xhtml2pdf drops several CSS features silently,
and the templates work around each one. If you edited a PDF template, read that
section before assuming the engine will tell you what is wrong.

---

## Not covered here

- Automated deploys. PA has no build hook on the free tier; a scheduled task
  pulling `main` would need a paid account, and would pull into a branch the
  Web tab is pointed at, which is easy to get wrong.
- Custom domains. Paid tier only.
- Database backups. SQLite lives on the PA filesystem; copy it from the Files
  tab or the Bash console. Nothing else backs it up.