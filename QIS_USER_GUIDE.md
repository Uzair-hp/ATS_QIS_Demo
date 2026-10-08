# ATS QIS — Quotation & Invoice System
### Complete User Guide & Technical Reference

> **Version:** 1.0  
> **Built by:** ATS Automation  
> **Stack:** Python · Flask · SQLite · Bootstrap 5 · PWA  
> **Live URL:** [your-domain.com](https://your-domain.com)

---

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Installation & Setup](#installation--setup)
4. [Running the Application](#running-the-application)
5. [Login & Authentication](#login--authentication)
6. [Dashboard](#dashboard)
7. [Clients](#clients)
8. [Services](#services)
9. [Quotations](#quotations)
10. [Invoices](#invoices)
11. [Settings](#settings)
12. [PDF Generation](#pdf-generation)
13. [Quotation → Invoice Conversion](#quotation--invoice-conversion)
14. [Numbering System](#numbering-system)
15. [Status Reference](#status-reference)
16. [Database Schema](#database-schema)
17. [Project Structure](#project-structure)
18. [Frequently Asked Questions](#frequently-asked-questions)

---

## Overview

**ATS QIS** (Quotation & Invoice System) is a self-hosted, offline-capable web application designed for ATS Automation to manage the full client billing lifecycle — from creating professional quotations/proposals to generating, tracking, and exporting invoices.

### Core Features

| Feature | Description |
|---|---|
| 🧾 **Quotations** | Create professional proposals with line items, discounts, validity dates, and timelines |
| 🧮 **Invoices** | Generate GST-ready invoices linked to clients with payment tracking |
| 👥 **Clients** | Manage a client directory with company, contact, and billing history |
| 📦 **Services** | Maintain a reusable service catalogue with base prices |
| 🔄 **Quotation→Invoice** | Convert accepted quotations into invoices in one click |
| 📄 **PDF Export** | Download professional branded PDFs for quotations and invoices |
| 📊 **Dashboard** | At-a-glance revenue, pending, overdue, and draft summaries |
| ⚙️ **Settings** | Configure company branding, bank details, UPI, and default terms |
| 📱 **PWA** | Install as an app on desktop or mobile via the browser |

---

## System Requirements

- **Python** 3.10 or newer
- **pip** (Python package manager)
- **Windows / Linux / macOS**
- **Node.js** 18 or newer (only to build the frontend; the released bundle runs without it)
- A modern web browser (Chrome, Edge, Firefox, Safari)

After `npm run build` the app runs entirely offline. During development the
frontend is served by Vite, which needs Node.js running locally.

---

## Installation & Setup

### Step 1 � Clone / Download the Project

Place the `ATS-QIS` folder anywhere on your machine, for example:
```
D:\Brightlant-Work\ATS-QIS\
```

### Step 2 � Create a Virtual Environment

Open PowerShell inside the project folder and run:

```powershell
python -m venv .venv
```

### Step 3 — Activate the Virtual Environment

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Windows CMD
.venv\Scripts\activate.bat

# macOS / Linux
source .venv/bin/activate
```

### Step 4 � Install Dependencies

```powershell
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

Backend dependencies:
| Package | Purpose |
|---|---|
| `Flask` | Web framework (REST API) |
| `Flask-SQLAlchemy` | ORM / database layer |
| `Flask-Login` | Session-based authentication |
| `Werkzeug` | Password hashing, utilities |
| `qrcode[pil]` | QR code generation on invoices |
| `xhtml2pdf` | HTML ? PDF conversion (server-side PDFs) |
| `python-dotenv` | Load `.env` config file |
| `pytest` | Test suite (`cd backend; pytest`) |

### Step 5 — Environment Variables (Optional)

Copy `.env.example` to `.env` and set your own secret key for production:

```env
SECRET_KEY=your-very-secret-key-here
FLASK_ENV=development
```

> If no `.env` is present, the app uses built-in defaults which are fine for local use.

---

## Running the Application

### Development (two processes)

```powershell
# Terminal 1 � API on :5000
cd backend
python app.py

# Terminal 2 � Vite dev server on :3000, proxies /api to :5000
cd frontend
npm run dev
```

Open **http://localhost:3000/app/**. The Vite dev server hot-reloads on save, so
you only rebuild for production.

The API server will automatically:
- Create the SQLite database at `backend/instance/ats.db`
- Run any pending column migrations
- Create the default company profile and admin user

Press **Ctrl + C** in each terminal to stop.

### Single-process (production-style)

```powershell
cd frontend
npm run build        # outputs to frontend/dist
cd ../backend
python app.py
```

Flask serves the built SPA under **http://127.0.0.1:5000/app/**, so one
process serves both the API and the interface.

### Running the tests

```powershell
cd backend  && pytest        # 40 tests: totals, PDFs, CSV, settings
cd frontend && npm test       # 41 tests: print-sheet totals and mapping
```

### Production (Hosted)

Build the frontend first (`npm run build`), point the WSGI server at
`backend/wsgi.py`, and set `SECRET_KEY` and `FLASK_ENV=production` in the
environment.

**PythonAnywhere** is set up in detail — see `deploy/README.md`. The short
version:

```bash
# on PythonAnywhere, from a Bash console
git clone https://github.com/brightlant223/ats-qis.git ~/ATS-QIS
bash ~/ATS-QIS/deploy/setup.sh
```

Then in the Web tab: add a **Manual configuration** web app using the
`ats-qis` virtualenv, paste `deploy/pythonanywhere_wsgi.py` into the WSGI
configuration file, add the two static-file mappings it documents, and reload.

Check it with:

```
https://<username>.pythonanywhere.com/api/health
```

Note the free tier's limits before putting real client data on it — the web app
expires after one month unless you log in, and there is one web worker.

---

## Login & Authentication

### Default Credentials

| Field | Value |
|---|---|
| **Username** | `admin` |
| **Password** | `ats@2026` |

> ?? Change your password after first login (Settings ? Change Password).

All pages require login. Unauthenticated users are automatically redirected to the login page at `/app/login`.

---

## Dashboard

**URL:** `/`

The dashboard provides a real-time summary of your business health:

| Metric Card | What it Shows |
|---|---|
| 💰 **Total Revenue** | Sum of all paid invoices |
| ⏳ **Pending** | Sum of unpaid (non-overdue) invoices |
| 🔴 **Overdue** | Sum of invoices past their due date |
| 📝 **Draft Quotations** | Count of quotations in Draft status |

Below the metric cards you'll find:
- **Recent Quotations** — Latest 5 quotations with status badges
- **Recent Invoices** — Latest 5 invoices with amounts and status

---

## Clients

**URL:** `/clients`

### Adding a Client
1. Click **"Add Client"** button on the Clients page
2. Fill in: Name *(required)*, Company Name, Email, Phone, Address
3. Click **Save Client**

### Editing a Client
Click the **Edit** (pencil) icon on the client's row.

### Archiving / Deleting a Client
- **Archive**: Hides the client from active lists without deleting data
- **Delete**: Permanently removes the client **and all their invoices/quotations**

### Client Fields

| Field | Required | Description |
|---|---|---|
| Name | ✅ Yes | Contact person's full name |
| Company Name | No | Business / organization name |
| Email | No | Client's email address |
| Phone | No | Contact number |
| Address | No | Billing address |

---

## Services

**URL:** `/services`

Services are a reusable catalogue of work items that can be quickly added as line items in quotations and invoices.

### Adding a Service
1. Go to **Services** in the sidebar
2. Click **"Add Service"**
3. Enter: Name *(required)*, Base Price *(required)*
4. Click **Save**

### Using Services
When creating a quotation or invoice, click **"Add from Catalogue"** to pick a service — its name and base price will auto-fill the line item. You can override the rate per document.

---

## Quotations

**URL:** `/quotations`

### Creating a Quotation
1. Click **"New Quotation"** in the sidebar or the list page
2. Fill in the header details:
   - **Client** — Select from your client list
   - **Quotation Date** — Defaults to today
   - **Valid Until** — Expiry date for the quotation
   - **Estimated Timeline** — e.g., "2–3 weeks"
   - **Notes** — Internal or client-facing notes
3. Add line items using the **"Add Item"** button or **"Add from Catalogue"**
4. Optionally apply a **Discount** (flat ₹ amount or percentage)
5. Click **Save Quotation**

### Quotation Number Format
Quotations are automatically numbered:
```
ATS-QT-YYYY-NNN
```
Example: `ATS-QT-2026-001`

Revised quotations get a suffix: `ATS-QT-2026-001-R1`, `ATS-QT-2026-001-R2`, etc.

### Quotation Statuses

| Status | Meaning |
|---|---|
| 🔵 **Draft** | Just created, not yet sent to client |
| 📤 **Sent** | Shared with client, awaiting response |
| ✅ **Accepted** | Client has approved the quotation |
| ❌ **Declined** | Client rejected the quotation |
| 🔁 **Invoiced** | Converted into an invoice |
| ⏰ **Expired** | Valid-until date has passed |

### Quotation Actions

| Action | Description |
|---|---|
| **View / PDF** | Preview the quotation or download as PDF |
| **Edit** | Modify details (only for Draft/Sent status) |
| **Change Status** | Update the quotation status |
| **Duplicate** | Create an identical copy as a new quotation |
| **Revise** | Create a revision (appends -R1, -R2, etc.) |
| **Convert to Invoice** | Instantly create an invoice from this quotation |
| **Archive** | Hide from active list |
| **Delete** | Permanently remove |

---

## Invoices

**URL:** `/invoices`

### Creating an Invoice
1. Click **"New Invoice"** in the sidebar
2. Fill in:
   - **Client** — Select from your client list
   - **Invoice Date** — Defaults to today
   - **Due Date** — Auto-calculated based on company default (15 days), editable
   - **Payment Mode** — Cash, Bank Transfer, UPI, Cheque, etc.
   - **Reference Quotation** — Optional quotation number linkage
   - **Notes** — Payment instructions or special notes
3. Add line items with service name, description, quantity, and rate
4. Optionally add a **Discount** and **Advance Payment** received
5. Click **Save Invoice**

### Invoice Number Format
```
ATS-INV-YYYY-NNN
```
Example: `ATS-INV-2026-001`

### Invoice Statuses

| Status | Meaning |
|---|---|
| ⏳ **Pending** | Invoice issued, payment not yet received |
| ✅ **Paid** | Full payment received |
| 🔴 **Overdue** | Past due date, payment not received |
| ❌ **Cancelled** | Invoice voided |

### Invoice Actions

| Action | Description |
|---|---|
| **View / PDF** | Preview invoice or download PDF |
| **Edit** | Modify the invoice |
| **Mark as Paid** | Update status to Paid |
| **Mark as Cancelled** | Void the invoice |
| **Archive** | Hide from active list |
| **Delete** | Permanently remove |
| **Export CSV** | Download invoice data as a CSV file |

### Amount Breakdown

Every invoice shows:
```
Sub Total
- Discount (flat or %)
─────────────────────
= Total Amount
- Advance Received
─────────────────────
= Balance Due
```

---

## Settings

**URL:** `/settings`

Configure your company's information that appears on all PDFs and documents.

### Company Information
| Field | Description |
|---|---|
| Company Name | Your business name |
| Tagline | Subtitle shown under company name |
| Email | Business email address |
| Phone | Contact number |
| Address | Full business address |

### Payment Details
| Field | Description |
|---|---|
| UPI ID | UPI payment address (e.g., atsautomation@upi) |
| UPI Name | Name shown on UPI payment |
| Bank Name | Bank name for NEFT/RTGS |
| Account Number | Bank account number |
| IFSC Code | Bank IFSC code |
| Branch | Bank branch name |

### Defaults
| Field | Description |
|---|---|
| Invoice Terms | Default payment terms for invoices |
| Quotation Terms | Default terms for quotations |
| Default Due Days | Days from invoice date until due (default: 15) |

---

## PDF Generation

Every document can be produced two ways. Both are supported; they differ in
where the layout is defined.

### 1. Print / Save as PDF (browser, quotations)

The recommended option for quotations. The layout lives in the React app and is
measured against the FORTIS HOSPITAL reference sheet:

- `frontend/src/styles/print.css` � the A4 sheet, every offset in millimetres
- `frontend/src/components/print/` � header, party details, items, totals,
  bank block, signature, footer
- `frontend/src/lib/quotation.js` � totals maths, kept in step with the API
- `frontend/src/lib/geometry.js` � the measured column positions

Open a quotation ? **Print / Save as PDF** ? choose "Save as PDF" in the browser
dialog. Open `/app/quotations/<id>/print` directly to see the bare sheet.

### 2. Download PDF (server)

Generated by the backend with `xhtml2pdf` from
`backend/templates/{quotations,invoices}/pdf_template.html`. This works
headlessly and for invoices.

### What's Included in a Quotation PDF
- Company logo & details, and the company stamp if one is uploaded
- Client information with client GSTIN
- Quotation number, date, validity, estimated timeline, payment terms
- Line items table (service, description, HSN, qty, rate, amount)
- Subtotal, discount, GST, grand total
- Bank details, GSTIN and MSME number
- Signature block and terms

### What's Included in an Invoice PDF
- Company logo & details, and the company stamp if one is uploaded
- Client information
- Invoice number, date, due date
- Reference quotation number (if any)
- Line items table with HSN codes
- Subtotal, discount, GST, total, advance, balance due
- Payment mode
- UPI QR Code (generated automatically from UPI ID)
- Bank transfer details
- Notes & Terms

### How to Download a PDF
- **Print / Save as PDF** � open the quotation and click the print button
- **Download PDF** � open the document and click **"Download PDF"**

---

## Quotation → Invoice Conversion

One of the most powerful features: convert an accepted quotation into an invoice in one click.

### Steps
1. Open a quotation in **Accepted** status
2. Click **"Convert to Invoice"**
3. Review the pre-filled invoice (all line items, client, amounts are carried over)
4. Adjust due date, payment mode, advance amount if needed
5. Save — the quotation status automatically changes to **Invoiced**

The invoice will store the originating quotation number in the `ref_quotation_number` field for traceability.

---

## Numbering System

| Document | Format | Example |
|---|---|---|
| Quotation | `ATS-QT-YYYY-NNN` | `ATS-QT-2026-001` |
| Quotation Revision | `ATS-QT-YYYY-NNN-RN` | `ATS-QT-2026-001-R2` |
| Invoice | `ATS-INV-YYYY-NNN` | `ATS-INV-2026-001` |

Numbers are auto-generated sequentially within the current calendar year. The sequence never goes backwards, even if records are deleted.

---

## Status Reference

### Quotation Statuses
```
Draft → Sent → Accepted → Invoiced
                ↘ Declined
         (auto) Expired
```

### Invoice Statuses
```
Pending → Paid
        ↘ Cancelled
(auto)  Overdue (when past due date)
```

---

## Database Schema

The application uses **SQLite** stored at `backend/instance/ats.db`.

### Tables

#### `users`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| username | VARCHAR(50) | Unique login name |
| password_hash | VARCHAR(255) | Bcrypt hashed password |

#### `company_profile`
Singleton table (always 1 row) storing company settings.

#### `clients`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | VARCHAR(150) | Contact name |
| company_name | VARCHAR(150) | Business name |
| email | VARCHAR(150) | Email address |
| phone | VARCHAR(20) | Phone number |
| address | TEXT | Billing address |
| created_at | DATETIME | Record creation (IST) |
| is_archived | BOOLEAN | Soft-delete flag |

#### `services`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | VARCHAR(200) | Service name |
| base_price | FLOAT | Default price |

#### `quotations`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| quotation_number | VARCHAR(50) | Unique auto-generated number |
| client_id | INTEGER | Foreign key → clients |
| date_created | DATETIME | Creation date (IST) |
| valid_until | DATETIME | Expiry date |
| estimated_timeline | VARCHAR(100) | Project timeline estimate |
| sub_total | FLOAT | Sum of line items |
| discount | FLOAT | Discount value entered |
| discount_type | VARCHAR(10) | `flat` or `percent` |
| discount_amount | FLOAT | Calculated ₹ discount |
| total_amount | FLOAT | Final total |
| status | VARCHAR(20) | Current status |
| notes | TEXT | Additional notes |
| is_archived | BOOLEAN | Soft-delete flag |

#### `quotation_items`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| quotation_id | INTEGER | Foreign key → quotations |
| service_name | VARCHAR(200) | Item name |
| description | TEXT | Item description |
| quantity | FLOAT | Quantity |
| rate | FLOAT | Rate per unit |
| amount | FLOAT | qty × rate |

#### `invoices`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| invoice_number | VARCHAR(50) | Unique auto-generated number |
| client_id | INTEGER | Foreign key → clients |
| date_created | DATETIME | Invoice date (IST) |
| due_date | DATETIME | Payment due date |
| sub_total | FLOAT | Sum of line items |
| discount | FLOAT | Discount value entered |
| discount_type | VARCHAR(10) | `flat` or `percent` |
| discount_amount | FLOAT | Calculated ₹ discount |
| total_amount | FLOAT | Final total |
| advance_amount | FLOAT | Advance payment received |
| status | VARCHAR(20) | Current status |
| payment_mode | VARCHAR(20) | Mode of payment |
| notes | TEXT | Payment notes |
| is_archived | BOOLEAN | Soft-delete flag |
| ref_quotation_number | VARCHAR(50) | Linked quotation reference |

#### `invoice_items`
Same structure as `quotation_items` but linked to `invoices`.

---

## Project Structure

```
ATS-QIS/
+-- backend/                     Flask REST API (JSON only)
�   +-- app.py                   Application factory, migrations, SPA serving
�   +-- config.py                Configuration (dev / production)
�   +-- models.py                SQLAlchemy database models
�   +-- wsgi.py                  WSGI entry point for production
�   +-- requirements.txt         Python dependencies
�   +-- routes/
�   �   +-- auth.py              Login / logout
�   �   +-- dashboard.py         Dashboard metrics
�   �   +-- clients.py           Client CRUD + CSV export
�   �   +-- services.py          Service catalogue CRUD
�   �   +-- quotations.py        Quotation CRUD + PDF + CSV + convert
�   �   +-- invoices.py          Invoice CRUD + PDF + QR + CSV
�   �   +-- settings.py          Company settings incl. stamp upload
�   �   +-- validation.py        Shared input validation
�   +-- templates/               PDF templates ONLY (no page templates)
�   �   +-- invoices/pdf_template.html
�   �   +-- quotations/pdf_template.html
�   +-- static/                  logo, PWA manifest + service worker
�   +-- tests/                   pytest suite
�   +-- instance/
�       +-- ats.db               SQLite database (auto-created)
�
+-- frontend/                    React 18 SPA (Vite)
�   +-- vite.config.js           base '/app/', dev proxy to :5000
�   +-- public/assets/           logo.png, watermark.svg
�   +-- src/
�       +-- api/client.js        Axios instance (baseURL /api)
�       +-- components/          Layout, ProtectedRoute, print/ sheet parts
�       +-- context/             AuthContext, ToastContext
�       +-- lib/                 quotation.js totals, mappers, geometry
�       +-- pages/               One file per screen
�       +-- styles/              style.css (app) + print.css (A4 sheet)
�
+-- .env / .env.example
+-- .gitignore
```

The old server-rendered page templates are gone. `backend/templates/` now holds
only the two PDF templates, and every screen is a React page under
`frontend/src/pages/`.

---

## Frequently Asked Questions

**Q: How do I reset my password?**  
A: Currently, open the Python shell inside the project and run:
```python
from app import create_app
from models import db, User
app = create_app()
with app.app_context():
    u = User.query.filter_by(username='admin').first()
    u.set_password('your-new-password')
    db.session.commit()
```

**Q: How do I back up my data?**  
A: Copy the file `backend/instance/ats.db` to a safe location. This single file contains all your data.

**Q: Can I run this on a server so multiple people can access it?**  
A: Yes. Set `FLASK_ENV=production` in your `.env` file and deploy using a WSGI server (e.g., Gunicorn on Linux). Use the provided `wsgi.py` as the entry point.

**Q: How do I change the company logo on PDFs?**  
A: Replace the file `static/img/logo.png` with your own logo (keep the same filename). Recommended size: 200×200px or smaller PNG.

**Q: What happens when I archive a client?**  
A: They are hidden from the active client list but their data is preserved. Existing invoices and quotations remain untouched.

**Q: Can I export all invoices?**  
A: Yes. Inside any invoice view, click **"Export CSV"** to download invoice data. For bulk exports, you can also open the SQLite database directly with any DB viewer like DB Browser for SQLite.

**Q: What is the PWA feature?**  
A: When you open the app in Chrome or Edge, you'll see an "Install App" option in the browser's address bar. This lets you install QIS as a desktop app that opens without browser chrome, like a native application.

**Q: Why do the two "print" options look different?**  
A: They are two different layouts. **Print / Save as PDF** renders the React
quotation sheet through the browser's own print engine, which is why it matches
the FORTIS HOSPITAL reference closely. **Download PDF** is rendered on the
server by `xhtml2pdf`, a limited engine that only supports a subset of CSS — no
SVG, no CSS gradients — so it looks plainer. Both carry the same figures.

**Q: The stamp did not appear on my PDF.**  
A: The stamp is only printed once you upload one under Settings → Stamp / Seal
Image. There is no built-in fallback stamp, deliberately: a bundled ATS seal
would otherwise appear on any company profile that has not uploaded its own.

---

## Support & Maintenance

- **App developed by:** ATS Automation
- **Live URL:** [your-domain.com](https://your-domain.com)
- **Hosting Platform:** Your preferred platform
- **Database location:** `backend/instance/ats.db`
- **Logs:** Run with `FLASK_ENV=development` to see detailed error logs in the terminal
- **Port:** Default `5000` (local) — change in `app.py` if needed

---

*ATS QIS — Built with ❤️ by ATS Automation*
