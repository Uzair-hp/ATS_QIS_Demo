# ATS Automation QIS — Quotation & Invoice System

A self-hosted quotation & invoice management system for **ATS Automation**
(Gate Automation & Security Solutions, Mumbai). It handles clients, a service
catalog, quotations, invoices, GST calculations, and PDF generation.

The app is split into a Flask REST API backend and a React SPA frontend.

## Features

- **Client management** — CRUD, GST details, archive/unarchive, CSV export
- **Service catalog** — CRUD with HSN codes and base prices
- **Quotations** — create/edit, statuses (Draft/Sent/Accepted/Declined/
  Invoiced/Expired), duplicate, convert to invoice, PDF export, CSV export
- **Invoices** — create/edit, statuses, advance/balance tracking, PDF export,
  CSV export
- **GST-aware totals** — subtotal, discount, GST %, grand total, balance due
- **Settings** — company profile (name, GSTIN, MSME, bank details, stamp),
  default tax/terms, password change, wipe data
- **Branded PDFs** — letterhead-style invoice/quotation PDFs (xhtml2pdf)
- **Dashboard** — stats overview
- **PWA bits** — manifest + service worker served by the backend

## Structure

```
backend/               Flask REST API (JSON responses, no Jinja rendering)
  app.py               Application factory + DB migrations + blueprint wiring
  config.py            Config (SQLite at backend/instance/ats.db)
  models.py            SQLAlchemy models
  routes/              JSON endpoints (auth, dashboard, clients, services,
                       invoices, quotations, settings)
  templates/           PDF templates only
  static/              Logo, manifest, service worker
  wsgi.py

frontend/              React (Vite, functional components)
  src/
    api/client.js      Axios instance (baseURL /api, withCredentials)
    context/           AuthContext, ToastContext
    components/        Layout (sidebar+topbar), ProtectedRoute
    pages/             Login, Dashboard, Clients*, Services*, Invoices*,
                       Quotations*, Settings
    styles/            Bootstrap design system CSS
```

## Running

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py          # http://localhost:5000
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000, proxies /api -> :5000
```

### Production

```bash
cd frontend && npm run build
# serve frontend/dist via any static host or Flask
```

Login: `admin` / `ats@2026`

## API overview

All endpoints live under `/api/...` and return JSON. Auth uses the Flask
session cookie (flask-login); CORS is enabled with `supports_credentials=True`
for `localhost:3000` / `5173`.

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| GET | `/me` | Current user |

### Dashboard — `/api`
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Stats overview |

### Clients — `/api/clients`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List clients |
| POST | `/` | Create client |
| GET | `/export` | CSV export |
| GET | `/<id>` | Client detail |
| PUT | `/<id>` | Update client |
| POST | `/<id>/archive` | Archive |
| POST | `/<id>/unarchive` | Unarchive |

### Services — `/api/services`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List services |
| GET | `/json` | Service catalog (JSON) |
| POST | `/` | Create service |
| PUT | `/<id>` | Update service |
| DELETE | `/<id>` | Delete service |
| GET | `/<id>/price` | Get service price |

### Invoices — `/api/invoices`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List invoices |
| POST | `/` | Create invoice |
| GET | `/export` | CSV export |
| GET | `/meta` | Form metadata |
| GET | `/<id>` | Invoice detail |
| PUT | `/<id>` | Update invoice |
| POST | `/<id>/status` | Update status |
| POST | `/<id>/archive` | Archive |
| POST | `/<id>/unarchive` | Unarchive |
| GET | `/<id>/pdf` | Download PDF |

### Quotations — `/api/quotations`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List quotations |
| POST | `/` | Create quotation |
| GET | `/export` | CSV export |
| GET | `/meta` | Form metadata |
| GET | `/<id>` | Quotation detail |
| PUT | `/<id>` | Update quotation |
| POST | `/<id>/status` | Update status |
| POST | `/<id>/duplicate` | Duplicate |
| POST | `/<id>/convert` | Convert to invoice |
| POST | `/<id>/archive` | Archive |
| POST | `/<id>/unarchive` | Unarchive |
| GET | `/<id>/pdf` | Download PDF |

### Settings — `/api/settings`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Get company settings |
| POST/PUT | `/` | Update settings |
| POST | `/change_password` | Change password |
| POST | `/wipe-data` | Wipe all data |

PDF (`/api/invoices/:id/pdf`, `/api/quotations/:id/pdf`) and CSV export
endpoints return files and can be opened directly in a new tab.
