# PythonAnywhere deployment

Deploying ATS QIS to PythonAnywhere. The app is a Flask JSON API that also
serves the built React SPA, so both halves have to be set up.

**Before you start:** the free tier is a real constraint, not a formality. See
[Free tier limits](#free-tier-limits) — if this will hold real client data, a
paid plan or a different host is the better call.

**About 15 minutes.** Steps 1–3 are copy-paste in a Bash console; steps 4–5 are
clicks in the Web tab. The whole path was verified against a clean clone of the
demo repo — see [Verified](#verified-what-was-tested).

---

## Which repository to deploy

| Remote | Repository | Use |
|--------|-----------|-----|
| `demo` | `https://github.com/Uzair-hp/ATS_QIS_Demo.git` | Demos, trials, evaluation |
| `origin` | `https://github.com/brightlant223/ats-qis.git` | Production |

The commands below use **demo**. To deploy production instead, swap the clone
URL in step 1 — nothing else changes.

> Whichever you pick, the live site's data lives only on PythonAnywhere. The
> repo is code; the SQLite file is the record of your clients, invoices and
> quotations. See [Backups](#backups).

---

## 1. Get the code onto PythonAnywhere

In a **Bash console** (Files → Bash, or SSH):

```bash
cd ~
git clone https://github.com/Uzair-hp/ATS_QIS_Demo.git ATS-QIS
cd ATS-QIS
```

You should now see `backend/`, `frontend/`, `deploy/` and `AGENTS.md`.

```bash
ls deploy        # setup.sh and pythonanywhere_wsgi.py should be there
```

Everything after this point is steps 2 and 3 plus a handful of clicks in the
Web tab. Only steps 2 and 3 need the Bash console; the Web-tab steps (4 and 5)
cannot be scripted, because a click in the web interface is not something a
console can perform.

---

## 2. Run the setup script

```bash
bash ~/ATS-QIS/deploy/setup.sh
```

Creates the virtualenv, installs Python dependencies, builds the frontend, and
initialises the database. **Safe to re-run** — every step is idempotent.

At the end it prints:

```
    users=1 clients=0 quotations=0 profile='ATS Automation'
```

That confirms the database is live and the schema is correct. A non-zero exit
before that line means the site will not start — read the error.

### If `npm ci` fails: no Node.js

PA does not enable Node.js on every account. If the `npm ci` step fails with a
"command not found" or the script stops at the build, ask PythonAnywhere to
enable Node. Workaround if they won't — build the bundle locally and commit it:

```bash
# on your machine, in the repo
cd frontend && npm ci && npm run build
git add -f frontend/dist            # dist/ is gitignored
git commit -m "build: frontend bundle"
git push demo main
```

Then skip the build step on PA. Note this commits ~0.7 MB of generated assets
into history, which is why it is the fallback and not the default.

---

## 3. Configure the web app

**Web** tab → **Add a new web app** → **Manual configuration**.

| Setting | Value |
|---|---|
| Python version | must match the virtualenv. The script uses `3.11`; if you changed it, match that. |
| Source code | leave **empty** — the project is already at `~/ATS-QIS` |
| Virtualenv | `ats-qis` |

Then **Edit the WSGI configuration file** (link at the top of the Web tab) and
paste the entire contents of `deploy/pythonanywhere_wsgi.py`.

That file does four things in order: puts `backend/` on `sys.path`, loads
`.env`, forces `FLASK_ENV=production` and fails loudly if `SECRET_KEY` is
missing, then imports the app. **Edit `PROJECT_ROOT` near the top** if you
cloned somewhere other than `~/ATS-QIS`.

Do **not** point the web app at `backend/wsgi.py` directly — PA looks for a
module-level name called `application`, which only the PA file provides.

---

## 4. Static files

Still on the **Web** tab, under **Static files**, add **both** mappings:

| URL | Directory |
|---|---|
| `/app/assets/` | `/home/<username>/ATS-QIS/frontend/dist/assets` |
| `/app/assets/logo.png` | `/home/<username>/ATS-QIS/frontend/dist/assets` |

**Both are needed.** The first covers the content-hashed `index-*.css` and
`index-*.js`. The logo and stamp are unhashed, so they need a mapping of their
own. Without either, files still load — Flask falls through to a catch-all route
— but every request occupies a web worker, and the free tier has exactly one.

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

| `"frontend"` | Meaning |
|---|---|
| `built` | Good. The bundle is present. |
| `missing` | `npm run build` did not run or went elsewhere. Check `~/ATS-QIS/frontend/dist/index.html` exists. |

This endpoint is public, so it works in a logged-out browser — useful for
checking a deploy from a phone.

Then open `/app/` and log in with `admin` / `ats@2026`.

> **Change the password immediately** — Settings → Change Password. The default
> credentials are public knowledge and this is a public URL.

## Verified: what was tested

This path was exercised on 2026-10-08 against a **clean clone of the demo
repo** — the same thing PA clones — with no `dist/`, no `node_modules/` and no
`.env` present. Results:

| Check | Result |
|---|---|
| Clone size | 3.5 MB |
| `npm ci && npm run build` | 47 MB deps, 0.7 MB bundle |
| `wsgi.py` imported the way PA does | OK |
| `/api/health` | `{"status":"ok","frontend":"built"}` |
| `/app/` | 200, SPA shell |
| `/app/quotations/1` | 200 — deep-link survives a refresh |
| `/api/quotations`, `/invoices`, `/clients`, `/settings` | 200, authenticated |
| `ProxyFix` active | yes |
| `SESSION_COOKIE_SECURE` | true |
| Database created, admin seeded | yes |

Also confirmed the failure mode is diagnosable: **before** `npm run build`,
`/app/` returns 503 and health reports `"frontend":"missing"`. A broken build
tells you, rather than serving a blank page.

What was **not** tested: anything requiring your account — the Web tab steps,
the actual PA proxy in front of the app, HTTPS termination, and the free-tier
CPU allowance under real traffic.

### Smoke test after you deploy

| Check | Expected |
|---|---|
| `/api/health` | `{"status":"ok","frontend":"built"}` |
| `/app/` | The login screen |
| `/app/quotations/1` | Login redirect — proves the SPA deep-link fallback works |
| Login | Dashboard loads |
| Open a quotation → Print / Save as PDF | A4 sheet with the FORTIS layout |
| Same quotation → Download PDF | Same figures, server-rendered |
| Blank letterhead (sidebar → System) | One-page PDF |

The print sheet and the PDF are two separate pipelines and must show the **same
figures**. If they disagree, that is a bug — see `context_handover.md` §5.

---

## Environment variables

Set in the **Web** tab under **Environment variables**, or in
`backend/.env` (the WSGI file loads it):

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **yes** | The app refuses to start without it in production. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. `setup.sh` writes one if absent. |
| `FLASK_ENV` | **yes** | `production`. |
| `ALLOWED_ORIGINS` | no | Only for a split deployment where the SPA is on a different host. Comma-separated. **Not needed here** — the SPA is same-origin. |

> Changing `SECRET_KEY` invalidates every session. Nobody loses data, but
> everyone gets logged out.

---

## Updating after a `git pull`

```bash
cd ~/ATS-QIS
source ~/.virtualenvs/ats-qis/bin/activate

cd frontend && npm ci && npm run build && cd ..
pip install -r backend/requirements.txt   # only if dependencies changed
```

Then **RELOAD** on the Web tab.

`db.create_all()` and the column migrations run inside `create_app()`, so schema
changes apply on the next reload. No manual migration step.

Full redeploy from scratch (moving machines, or a botched change):

```bash
cd ~
rm -rf ATS-QIS
git clone https://github.com/Uzair-hp/ATS_QIS_Demo.git ATS-QIS
bash ~/ATS-QIS/deploy/setup.sh
```

The database is *not* in the repo — copy `backend/instance/ats.db` aside first
if you want to keep it. See [Backups](#backups).

---

## Free tier limits

Measured figures from a clean clone on 2026-10-08. The free tier gives:

| Limit | Value | Consequence here |
|---|---|---|
| Disk | 512 MiB | Repo is **3.5 MB**; `node_modules` **47 MB**; `dist` 0.7 MB. Plenty of room. Delete `.git` if you want it back. |
| Web apps | 1 | Fine. |
| Web workers | **1** | Every request is serial. The static-file mappings in step 4 matter much more than usual. |
| CPU | 100 s/day | PDF generation dominates. A heavy day of quotation/invoice printing will exhaust this. |
| Web app expiry | **1 month** | **The app stops being served unless you log in.** PA emails before this. Your data is *not* deleted — click the link to restart it. |
| MySQL / scheduled tasks | unavailable on accounts created after 2026-01-15 | SQLite only, no cron. |
| Consoles | 2 | Fine for this. |

The one-month expiry is the thing to plan around. It is not a hard failure —
you get an email, click a link, it runs again for another month — but it will
catch you if you stop paying attention, and for a client-facing system that is
not a risk worth carrying. The Developer plan is $10/month and removes it.

---

## Troubleshooting

**`/app/` returns a JSON error about the frontend build**
`npm run build` did not run, or in the wrong directory. Check
`~/ATS-QIS/frontend/dist/index.html` exists.

**Site blank, or every request 503s**
Check the **error log** on the Web tab. A missing `SECRET_KEY` raises at import
and takes the whole worker down — the WSGI file checks this first with a clearer
message than the app would give.

**Login works, then every request 403s**
`SESSION_COOKIE_SECURE` is on in production, so the session cookie is only sent
over HTTPS. Make sure you are on the `https://` URL. PA redirects the `http://`
one, but if you are testing with curl or a script, force https explicitly.

**`405` on POST/PUT/DELETE**
The CSRF check rejects requests with no token. Usually means a different origin
than expected — check `ALLOWED_ORIGINS`, and confirm `FLASK_ENV=production`
so `ProxyFix` is active.

**CSS and JS 404, page renders unstyled**
Static file mappings missing or pointing at the wrong directory. The catch-all
route serves `index.html` for unknown paths, so `/app/assets/...` falls through
to it and returns HTML with a JavaScript content type.

**Logo or stamp missing but the rest of the page looks fine**
The second static mapping (for `logo.png`) is not set.

**PDFs render blank or unstyled**
See `context_handover.md` §7 — xhtml2pdf drops several CSS features **without
an error**, and the templates work around each one. If you edited a PDF
template, read that section before assuming the engine will tell you what broke.

**`setup.sh` fails at the venv step**
The pinned Python version may not be on your account. Check the Web tab for
your available version and change the `--python=` flag in the script.

---

## Backups

`backend/instance/ats.db` is your entire dataset — clients, quotations,
invoices, and the company profile. **Nothing else backs it up.**

```bash
# on PA
cp ~/ATS-QIS/backend/instance/ats.db ~/backup-$(date +%F).db

# restore
cp ~/backup-2026-10-08.db ~/ATS-QIS/backend/instance/ats.db
# then RELOAD on the Web tab
```

Copy it off the platform if the data matters — a lost account means a lost
database. Scheduled backups need a paid account; on the free tier this is a
manual step.

To start over with an empty system: Settings → Danger Zone → type
`DELETE ALL DATA`. This wipes business data but keeps the company profile.

---

## Not covered here

- **Automated deploys.** No build hook on the free tier. A scheduled task
  pulling `main` needs a paid account, and pulling into the branch the Web tab
  is pointed at is easy to get wrong. Manual `git pull` + RELOAD is fine for a
  system this size.
- **Custom domains.** Paid tier only.
- **Automated backups.** See above — manual only on the free tier.
- **Zero-downtime deploys.** PA reloads in place. Expect a few seconds of
  downtime on each reload.

---

## Reference

| File | Purpose |
|---|---|
| `setup.sh` | Everything scriptable: venv, deps, frontend build, database |
| `pythonanywhere_wsgi.py` | Paste into the Web tab's WSGI config file |
| `backend/wsgi.py` | The app factory's WSGI entry point — do **not** paste this into PA |
| `../context_handover.md` | Architecture and the xhtml2pdf constraints (§7) |
| `../AGENTS.md` | Which remote to push to, and the traps in this codebase |