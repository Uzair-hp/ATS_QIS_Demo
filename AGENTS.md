# AGENTS.md — instructions for AI agents working in this repo

Read this before doing anything else. It overrides any habit you have from
other repositories.

## 1. Where to push — READ THIS FIRST

There are **two** remotes, and they are not interchangeable.

| Remote | Repository | Use for |
|--------|-----------|---------|
| `demo` | `https://github.com/Uzair-hp/ATS_QIS_Demo.git` | **Everything, by default** |
| `origin` | `https://github.com/brightlant223/ats-qis.git` | The production repo — do not push unless explicitly told |

**When the user says "push", they mean `git push demo main`.**

Never push to `origin` unless the user says so in those words — for example
"push to main", "push to production", or "push to brightlant". "push", "commit
and push", "push it", or any casual phrasing means **demo**.

```bash
git push demo main          # correct — the default meaning of "push"
git push origin main        # WRONG unless the user explicitly asked for it
```

Being wrong here publishes unreviewed work to the production repo, and that is
not recoverable by deleting the branch. When in doubt, push to `demo` and say
so.

If the `demo` remote is missing, add it — do not fall back to `origin`:

```bash
git remote add demo https://github.com/Uzair-hp/ATS_QIS_Demo.git
```

## 2. Before you commit

- Run both suites. A change is not done until they pass.
  ```bash
  cd backend  && pytest -q      # 74 tests
  cd frontend && npm test       # 135 tests
  cd frontend && npm run build
  cd frontend && node tools/verify-templates.mjs   # 19 live browser checks
  ```
- `backend/requirements.txt` is runtime-only. Test deps are in
  `requirements-dev.txt`, so a production host never installs pytest.
- Never commit `.env`, `*.db`, or anything under `.kilo/`.
- Stage deliberately (`git add <paths>`) rather than `git add -A`, so you can
  see what you are about to include. Check `git status` before committing.

## 3. Running the app

```powershell
# Terminal 1 — API on :5000
cd backend; python app.py

# Terminal 2 — Vite on :3000, proxies /api to :5000
cd frontend; npm run dev
# open http://localhost:3000/app/   login: admin / ats@2026
```

Single process: `npm run build` in `frontend/`, then `python app.py` in
`backend/` — Flask serves `frontend/dist` under `/app`.

Production hosts use `backend/wsgi.py` instead — see `deploy/README.md`.

## 4. Architecture you must not break

- `backend/` is a **JSON-only** REST API. It holds **no page templates**.
- `frontend/` is the React 18 + Vite SPA. Router basename is `/app/`, so an
  internal link is `to="/quotations/1"` - **not** `to="/app/quotations/1"`.
  Getting this wrong produces a `/app/app/...` URL.
- `company_profile` is a singleton row. `CompanyProfile.get_profile()` is the
  only way to read it.
- State-changing requests need the CSRF token from `GET /api/auth/me`, sent as
  `X-CSRFToken`. `frontend/src/api/client.js` does this automatically.

## 5. There is ONE document renderer - this is the rule

Invoice and quotation documents are rendered by React components and printed by
the browser. There is no server-side PDF engine and no second copy of any
layout.

```
pdf_theme key -> frontend/src/templates/registry.js -> layout component
                                                          -> .doc-sheet -> print
```

The **same** component renders the create/edit live preview, the print view, and
what Print / Save as PDF produces. Adding or changing a layout lands everywhere
at once. `frontend/src/templates/__tests__/registry.test.js` reads
`backend/pdf_themes.py` and fails if the backend offers a key the frontend
cannot render.

Do not reintroduce a second renderer. Two existed once (a React sheet and a set
of Jinja/xhtml2pdf templates) plus a folder of PNGs pretending to be previews,
and the three surfaces silently disagreed - the template dropdown only rewrote a
`?theme=` query string, so the sheet on screen never moved. Two backend tests
guard this: `test_server_side_pdf_endpoint_no_longer_exists` and
`test_theme_preview_image_endpoint_is_gone`.

| File | Role |
|---|---|
| `frontend/src/lib/docData.js` | **the** data contract; one shape for both document types |
| `frontend/src/templates/registry.js` | key -> component. The only place that mapping exists |
| `frontend/src/templates/layouts.jsx` | five layout archetypes |
| `frontend/src/templates/parts.jsx` | shared blocks (items table, totals, signature, footer) |
| `frontend/src/styles/print.css` | the single stylesheet; palettes keyed off `data-template` |
| `backend/pdf_themes.py` | which keys the API accepts |

Totals are computed twice - `computeTotals` in `frontend/src/lib/quotation.js`
and `_calc_totals` in the backend. They must agree to the paisa.
`computeTotals` prefers the API's stored totals; the tests in
`backend/tests/test_calc_totals.py` and
`frontend/src/lib/__tests__/quotation.test.js` pin both sides. If you change
one, change both, and update the tests.

## 6. Never hard-code a layout height

The print stylesheet used to be measured from a single 300 dpi sample scan and
carried fixed mm row heights. That produced a ~48mm blank gap under a one-item
items table, a second page for an ordinary document, and `white-space: nowrap`
text overflowing a 21mm cell.

Every block is now sized by its own content. **If you find yourself adding a
height, a `min-height` or a `nowrap` to lay something out, that is the bug.**
Look at the result in a browser instead: `node tools/verify-templates.mjs`
drives the real app and writes screenshots to `.render/verify/`.

## 7. Never bundle company-specific defaults

Do not add a fallback stamp, logo, GSTIN or bank detail for company-specific
fields. A checked-in ATS stamp prints on every company profile that has not
uploaded its own — that bug shipped once and is now covered by a test. If a
value is absent, render the slot empty.

## 8. Style

- Match the surrounding code. Comments explain *why*, not *what*.
- Backend: no type hints (the codebase has none), plain Flask idioms.
- Frontend: functional components, no TypeScript, 2-space indent, no semicolons
  in JSX.
- Prefer editing an existing file over creating a new one.
- No comments in code unless the reasoning is genuinely non-obvious.

## 9. Reference material

- `context_handover.md` — full architecture, data flow, engine constraints.
  Read this if you have not already.
- `deploy/README.md` — PythonAnywhere deployment, free-tier limits, troubleshooting.
- `work_to_be_done.md` — what is done, what is open. The open items are all
  visual QA in §3.7.
- `FORTIS HOSPITAL_page-0001.jpg` — the reference invoice the layouts descend
  from. It is inspiration, not a measurement spec: the old print sheet was built
  by copying its geometry millimetre-for-millimetre, which is exactly the
  hard-coded-heights trap in §6. Do not reintroduce numbers read off it.
- `QIS_USER_GUIDE.md` — end-user documentation.
