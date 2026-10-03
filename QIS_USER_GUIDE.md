# ATS QIS â€” Quotation & Invoice System
### Complete User Guide & Technical Reference

> **Version:** 1.0  
> **Built by:** ATS Automation  
> **Stack:** Python Â· Flask Â· SQLite Â· Bootstrap 5 Â· PWA  
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
13. [Quotation â†’ Invoice Conversion](#quotation--invoice-conversion)
14. [Numbering System](#numbering-system)
15. [Status Reference](#status-reference)
16. [Database Schema](#database-schema)
17. [Project Structure](#project-structure)
18. [Frequently Asked Questions](#frequently-asked-questions)

---

## Overview

**ATS QIS** (Quotation & Invoice System) is a self-hosted, offline-capable web application designed for ATS Automation to manage the full client billing lifecycle â€” from creating professional quotations/proposals to generating, tracking, and exporting invoices.

### Core Features

| Feature | Description |
|---|---|
| ðŸ§¾ **Quotations** | Create professional proposals with line items, discounts, validity dates, and timelines |
| ðŸ§® **Invoices** | Generate GST-ready invoices linked to clients with payment tracking |
| ðŸ‘¥ **Clients** | Manage a client directory with company, contact, and billing history |
| ðŸ“¦ **Services** | Maintain a reusable service catalogue with base prices |
| ðŸ”„ **Quotationâ†’Invoice** | Convert accepted quotations into invoices in one click |
| ðŸ“„ **PDF Export** | Download professional branded PDFs for quotations and invoices |
| ðŸ“Š **Dashboard** | At-a-glance revenue, pending, overdue, and draft summaries |
| âš™ï¸ **Settings** | Configure company branding, bank details, UPI, and default terms |
| ðŸ“± **PWA** | Install as an app on desktop or mobile via the browser |

---

## System Requirements

- **Python** 3.10 or newer
- **pip** (Python package manager)
- **Windows / Linux / macOS**
- A modern web browser (Chrome, Edge, Firefox, Safari)
- No internet required after installation (fully offline)

---

## Installation & Setup

### Step 1 â€” Clone / Download the Project

Place the `ims` folder anywhere on your machine, for example:
```
C:\Users\offic\Desktop\ATS Automation\ims\
```

### Step 2 â€” Create a Virtual Environment

Open PowerShell inside the project folder and run:

```powershell
python -m venv venv
```

### Step 3 â€” Activate the Virtual Environment

```powershell
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows CMD
venv\Scripts\activate.bat

# macOS / Linux
source venv/bin/activate
```

### Step 4 â€” Install Dependencies

```powershell
pip install -r requirements.txt
```

Dependencies installed:
| Package | Purpose |
|---|---|
| `Flask` | Web framework |
| `Flask-SQLAlchemy` | ORM / database layer |
| `Flask-Login` | Session-based authentication |
| `Werkzeug` | Password hashing, utilities |
| `qrcode[pil]` | QR code generation on invoices |
| `xhtml2pdf` | HTML â†’ PDF conversion |
| `python-dotenv` | Load `.env` config file |

### Step 5 â€” Environment Variables (Optional)

Copy `.env.example` to `.env` and set your own secret key for production:

```env
SECRET_KEY=your-very-secret-key-here
FLASK_ENV=development
```

> If no `.env` is present, the app uses built-in defaults which are fine for local use.

---

## Running the Application

```powershell
# Make sure your venv is activated first
python app.py
```

The server starts at: **http://127.0.0.1:5000**

Open this URL in your browser. The app will automatically:
- Create the SQLite database at `instance/ats.db`
- Create the default company profile
- Create the default admin user

To stop the server press **Ctrl + C** in the terminal.

### Production (Hosted)

The app can be deployed to your preferred hosting platform.  
Configure your domain and WSGI server (e.g., Gunicorn, uWSGI) accordingly.

---

## Login & Authentication

### Default Credentials

| Field | Value |
|---|---|
| **Username** | `admin` |
| **Password** | `ats2024` |

> âš ï¸ Change your password after first login (currently via database or by modifying `app.py`).

All pages require login. Unauthenticated users are automatically redirected to the login page at `/auth/login`.

---

## Dashboard

**URL:** `/`

The dashboard provides a real-time summary of your business health:

| Metric Card | What it Shows |
|---|---|
| ðŸ’° **Total Revenue** | Sum of all paid invoices |
| â³ **Pending** | Sum of unpaid (non-overdue) invoices |
| ðŸ”´ **Overdue** | Sum of invoices past their due date |
| ðŸ“ **Draft Quotations** | Count of quotations in Draft status |

Below the metric cards you'll find:
- **Recent Quotations** â€” Latest 5 quotations with status badges
- **Recent Invoices** â€” Latest 5 invoices with amounts and status

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
| Name | âœ… Yes | Contact person's full name |
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
When creating a quotation or invoice, click **"Add from Catalogue"** to pick a service â€” its name and base price will auto-fill the line item. You can override the rate per document.

---

## Quotations

**URL:** `/quotations`

### Creating a Quotation
1. Click **"New Quotation"** in the sidebar or the list page
2. Fill in the header details:
   - **Client** â€” Select from your client list
   - **Quotation Date** â€” Defaults to today
   - **Valid Until** â€” Expiry date for the quotation
   - **Estimated Timeline** â€” e.g., "2â€“3 weeks"
   - **Notes** â€” Internal or client-facing notes
3. Add line items using the **"Add Item"** button or **"Add from Catalogue"**
4. Optionally apply a **Discount** (flat â‚¹ amount or percentage)
5. Click **Save Quotation**

### Quotation Number Format
Quotations are automatically numbered:
```
BL-QT-YYYY-NNN
```
Example: `BL-QT-2026-001`

Revised quotations get a suffix: `BL-QT-2026-001-R1`, `BL-QT-2026-001-R2`, etc.

### Quotation Statuses

| Status | Meaning |
|---|---|
| ðŸ”µ **Draft** | Just created, not yet sent to client |
| ðŸ“¤ **Sent** | Shared with client, awaiting response |
| âœ… **Accepted** | Client has approved the quotation |
| âŒ **Declined** | Client rejected the quotation |
| ðŸ” **Invoiced** | Converted into an invoice |
| â° **Expired** | Valid-until date has passed |

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
   - **Client** â€” Select from your client list
   - **Invoice Date** â€” Defaults to today
   - **Due Date** â€” Auto-calculated based on company default (15 days), editable
   - **Payment Mode** â€” Cash, Bank Transfer, UPI, Cheque, etc.
   - **Reference Quotation** â€” Optional quotation number linkage
   - **Notes** â€” Payment instructions or special notes
3. Add line items with service name, description, quantity, and rate
4. Optionally add a **Discount** and **Advance Payment** received
5. Click **Save Invoice**

### Invoice Number Format
```
BL-INV-YYYY-NNN
```
Example: `BL-INV-2026-001`

### Invoice Statuses

| Status | Meaning |
|---|---|
| â³ **Pending** | Invoice issued, payment not yet received |
| âœ… **Paid** | Full payment received |
| ðŸ”´ **Overdue** | Past due date, payment not received |
| âŒ **Cancelled** | Invoice voided |

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
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
= Total Amount
- Advance Received
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

Both quotations and invoices can be exported as professional PDFs.

### What's Included in a Quotation PDF
- Company logo & details
- Client information
- Quotation number, date, validity
- Estimated timeline
- Line items table (service, description, qty, rate, amount)
- Subtotal, discount, total
- Terms & Conditions

### What's Included in an Invoice PDF
- Company logo & details
- Client information
- Invoice number, date, due date
- Reference quotation number (if any)
- Line items table
- Subtotal, discount, total, advance, balance due
- Payment mode
- UPI QR Code (generated automatically from UPI ID)
- Bank transfer details
- Notes & Terms

### How to Download a PDF
1. Open any quotation or invoice
2. Click the **"Download PDF"** button
3. The PDF is generated and downloaded instantly

---

## Quotation â†’ Invoice Conversion

One of the most powerful features: convert an accepted quotation into an invoice in one click.

### Steps
1. Open a quotation in **Accepted** status
2. Click **"Convert to Invoice"**
3. Review the pre-filled invoice (all line items, client, amounts are carried over)
4. Adjust due date, payment mode, advance amount if needed
5. Save â€” the quotation status automatically changes to **Invoiced**

The invoice will store the originating quotation number in the `ref_quotation_number` field for traceability.

---

## Numbering System

| Document | Format | Example |
|---|---|---|
| Quotation | `BL-QT-YYYY-NNN` | `BL-QT-2026-001` |
| Quotation Revision | `BL-QT-YYYY-NNN-RN` | `BL-QT-2026-001-R2` |
| Invoice | `BL-INV-YYYY-NNN` | `BL-INV-2026-001` |

Numbers are auto-generated sequentially within the current calendar year. The sequence never goes backwards, even if records are deleted.

---

## Status Reference

### Quotation Statuses
```
Draft â†’ Sent â†’ Accepted â†’ Invoiced
                â†˜ Declined
         (auto) Expired
```

### Invoice Statuses
```
Pending â†’ Paid
        â†˜ Cancelled
(auto)  Overdue (when past due date)
```

---

## Database Schema

The application uses **SQLite** stored at `instance/ats.db`.

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
| client_id | INTEGER | Foreign key â†’ clients |
| date_created | DATETIME | Creation date (IST) |
| valid_until | DATETIME | Expiry date |
| estimated_timeline | VARCHAR(100) | Project timeline estimate |
| sub_total | FLOAT | Sum of line items |
| discount | FLOAT | Discount value entered |
| discount_type | VARCHAR(10) | `flat` or `percent` |
| discount_amount | FLOAT | Calculated â‚¹ discount |
| total_amount | FLOAT | Final total |
| status | VARCHAR(20) | Current status |
| notes | TEXT | Additional notes |
| is_archived | BOOLEAN | Soft-delete flag |

#### `quotation_items`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| quotation_id | INTEGER | Foreign key â†’ quotations |
| service_name | VARCHAR(200) | Item name |
| description | TEXT | Item description |
| quantity | FLOAT | Quantity |
| rate | FLOAT | Rate per unit |
| amount | FLOAT | qty Ã— rate |

#### `invoices`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| invoice_number | VARCHAR(50) | Unique auto-generated number |
| client_id | INTEGER | Foreign key â†’ clients |
| date_created | DATETIME | Invoice date (IST) |
| due_date | DATETIME | Payment due date |
| sub_total | FLOAT | Sum of line items |
| discount | FLOAT | Discount value entered |
| discount_type | VARCHAR(10) | `flat` or `percent` |
| discount_amount | FLOAT | Calculated â‚¹ discount |
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
ims/
â”œâ”€â”€ app.py                  # Application factory & entry point
â”œâ”€â”€ config.py               # Configuration (dev / production)
â”œâ”€â”€ models.py               # SQLAlchemy database models
â”œâ”€â”€ wsgi.py                 # WSGI entry point for production
â”œâ”€â”€ requirements.txt        # Python dependencies
â”œâ”€â”€ .env.example            # Environment variable template
â”œâ”€â”€ .gitignore
â”‚
â”œâ”€â”€ routes/
â”‚   â”œâ”€â”€ auth.py             # Login / logout
â”‚   â”œâ”€â”€ dashboard.py        # Dashboard metrics
â”‚   â”œâ”€â”€ clients.py          # Client CRUD
â”‚   â”œâ”€â”€ services.py         # Service catalogue CRUD
â”‚   â”œâ”€â”€ quotations.py       # Quotation CRUD + PDF + status
â”‚   â”œâ”€â”€ invoices.py         # Invoice CRUD + PDF + QR + CSV
â”‚   â””â”€â”€ settings.py         # Company settings
â”‚
â”œâ”€â”€ templates/
â”‚   â”œâ”€â”€ base.html           # Master layout (sidebar, navbar, theme)
â”‚   â”œâ”€â”€ auth/               # Login page
â”‚   â”œâ”€â”€ dashboard/          # Dashboard page
â”‚   â”œâ”€â”€ clients/            # Client list, create, edit
â”‚   â”œâ”€â”€ services/           # Service list, create, edit
â”‚   â”œâ”€â”€ quotations/         # Quotation list, create, view, edit, PDF
â”‚   â””â”€â”€ invoices/           # Invoice list, create, view, edit, PDF
â”‚
â”œâ”€â”€ static/
â”‚   â”œâ”€â”€ css/style.css       # Global application styles
â”‚   â”œâ”€â”€ js/app.js           # Theme toggle, toast, interactions
â”‚   â”œâ”€â”€ js/sw.js            # PWA Service Worker
â”‚   â”œâ”€â”€ manifest.json       # PWA manifest
â”‚   â””â”€â”€ img/logo.png        # Company logo
â”‚
â””â”€â”€ instance/
    â””â”€â”€ ats.db       # SQLite database (auto-created)
```

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
A: Copy the file `instance/ats.db` to a safe location. This single file contains all your data.

**Q: Can I run this on a server so multiple people can access it?**  
A: Yes. Set `FLASK_ENV=production` in your `.env` file and deploy using a WSGI server (e.g., Gunicorn on Linux). Use the provided `wsgi.py` as the entry point.

**Q: How do I change the company logo on PDFs?**  
A: Replace the file `static/img/logo.png` with your own logo (keep the same filename). Recommended size: 200Ã—200px or smaller PNG.

**Q: What happens when I archive a client?**  
A: They are hidden from the active client list but their data is preserved. Existing invoices and quotations remain untouched.

**Q: Can I export all invoices?**  
A: Yes. Inside any invoice view, click **"Export CSV"** to download invoice data. For bulk exports, you can also open the SQLite database directly with any DB viewer like DB Browser for SQLite.

**Q: What is the PWA feature?**  
A: When you open the app in Chrome or Edge, you'll see an "Install App" option in the browser's address bar. This lets you install QIS as a desktop app that opens without browser chrome, like a native application.

**Q: The PDF looks different from the on-screen view â€” is that normal?**  
A: Yes. PDFs are generated using `xhtml2pdf`, which uses a separate rendering engine. The layout is specifically designed for print/PDF and will look slightly different from the web view, but contains all the same information.

---

## Support & Maintenance

- **App developed by:** ATS Automation
- **Live URL:** [your-domain.com](https://your-domain.com)
- **Hosting Platform:** Your preferred platform
- **Database location:** `instance/ats.db`
- **Logs:** Run with `FLASK_ENV=development` to see detailed error logs in the terminal
- **Port:** Default `5000` (local) â€” change in `app.py` if needed

---

*ATS QIS â€” Built with â¤ï¸ by ATS Automation*
