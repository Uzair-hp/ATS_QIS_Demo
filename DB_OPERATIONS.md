# ATS QIS â€” Database Operations Guide
### SQLite & SQLAlchemy Command Reference

> **Project Path:** `/path/to/your/project/`  
> **Database File:** `instance/ats.db`  
> **ORM:** Flask-SQLAlchemy  
> **Live URL:** [your-domain.com](https://your-domain.com)  
> **Hosting:** Your preferred platform  
> **Console:** Your platform's terminal/console

---

## âš ï¸ Important: Before Any Operation

```bash
# ALWAYS backup your database before running any destructive commands!
cp instance/ats.db instance/ats_backup.db
```

---

## Table of Contents

1. [Setup â€” Python Shell Access](#1-setup--python-shell-access)
2. [Setup â€” SQLite CLI Access](#2-setup--sqlite-cli-access)
3. [Users](#3-users)
4. [Company Profile](#4-company-profile)
5. [Clients](#5-clients)
6. [Services](#6-services)
7. [Quotations](#7-quotations)
8. [Quotation Items](#8-quotation-items)
9. [Invoices](#9-invoices)
10. [Invoice Items](#10-invoice-items)
11. [Bulk & Advanced Operations](#11-bulk--advanced-operations)
12. [Database Maintenance](#12-database-maintenance)

---

## 1. Setup â€” Python Shell Access

> âš ï¸ **Python Shell** = yahan sirf Python/ORM commands chalenge (`.query`, `db.session`, etc.)  
> SQLite commands (`.tables`, `.headers`) yahan **NAHI** chalenge!

### Steps:

**Step 1:** Open your terminal/console (Bash, PowerShell, CMD)

**Step 2:** Ye commands ek ek karke paste karo:

```bash
cd /home/bims/ims
python
```

**Step 3:** Python shell khulega (`>>>` dikhega), ab ye paste karo:

```python
from app import create_app
from models import db, User, CompanyProfile, Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem
app = create_app()
ctx = app.app_context()
ctx.push()
```

**Step 4:** Ab tum neeche diye gaye **ORM commands** chala sakte ho âœ…

**Step 5:** Python shell se bahar aane ke liye:

```python
exit()
```

> ðŸ’¡ Neeche jitne bhi `# ORM` wale commands hain, wo sab **Python shell** (`>>>`) ke andar chalane hain.

---

## 2. Setup â€” SQLite CLI Access

> âš ï¸ **SQLite CLI** = yahan sirf SQL queries chalenge (`SELECT`, `DELETE`, etc.)  
> Python commands (`User.query.all()`) yahan **NAHI** chalenge!

### Steps:

**Step 1:** Open your terminal/console (Bash, PowerShell, CMD)

**Step 2:** Ye command paste karo:

```bash
sqlite3 instance/ats.db
```

**Step 3:** SQLite shell khulega (`sqlite>` dikhega), ab ye paste karo:

```sql
.headers on
.mode column
```

**Step 4:** Ab tum neeche diye gaye **SQL commands** chala sakte ho âœ…

Kuch useful commands:

```sql
-- Saari tables dekhne ke liye
.tables

-- Kisi table ka structure dekhne ke liye
.schema clients
.schema invoices
.schema quotations
```

**Step 5:** SQLite shell se bahar aane ke liye:

```sql
.quit
```

> ðŸ’¡ Neeche jitne bhi `-- SQL` wale commands hain, wo sab **SQLite shell** (`sqlite>`) ke andar chalane hain.

---

## ðŸ”´ Important â€” Kya Kahan Chalega?

| Command Type | Kahan chalega? | Shell prompt | Pehchaan |
|---|---|---|---|
| `User.query.all()` | **Python Shell** | `>>>` | `# ORM` likha hoga |
| `SELECT * FROM users;` | **SQLite CLI** | `sqlite>` | `-- SQL` likha hoga |
| `cd`, `cp`, `ls` | **Bash Console** | `$` | `#` comment wale |

> âš ï¸ **Dono ko mix mat karo!** Pehle ek shell se bahar aao (`exit()` ya `.quit`), phir doosra kholo.

---

## 3. Users

### ðŸ” SELECT (Read)

```python
# ORM â€” Get all users
users = User.query.all()
for u in users:
    print(u.id, u.username)

# ORM â€” Get specific user
user = User.query.filter_by(username='admin').first()
print(user.id, user.username)

# ORM â€” Get user by ID
user = User.query.get(1)
```

```sql
-- SQL â€” All users
SELECT * FROM users;

-- SQL â€” Specific user
SELECT * FROM users WHERE username = 'admin';
```

### âž• INSERT (Create)

```python
# ORM â€” Create new user
new_user = User(username='manager')
new_user.set_password('secure_password_123')
db.session.add(new_user)
db.session.commit()
print(f"Created user ID: {new_user.id}")
```

```sql
-- SQL â€” (password must be pre-hashed, prefer Python method above)
INSERT INTO users (username, password_hash)
VALUES ('manager', '<hashed_password>');
```

### âœï¸ UPDATE (Modify)

```python
# ORM â€” Change password
user = User.query.filter_by(username='admin').first()
user.set_password('new_password_here')
db.session.commit()

# ORM â€” Change username
user = User.query.get(1)
user.username = 'superadmin'
db.session.commit()
```

```sql
-- SQL â€” Change username
UPDATE users SET username = 'superadmin' WHERE id = 1;
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete user by username
user = User.query.filter_by(username='manager').first()
if user:
    db.session.delete(user)
    db.session.commit()
    print("User deleted!")

# ORM â€” Delete user by ID
user = User.query.get(2)
if user:
    db.session.delete(user)
    db.session.commit()
```

```sql
-- SQL â€” Delete user
DELETE FROM users WHERE username = 'manager';

-- SQL â€” Delete user by ID
DELETE FROM users WHERE id = 2;
```

> âš ï¸ **Warning:** Do NOT delete the last admin user, or you will be locked out!

---

## 4. Company Profile

### ðŸ” SELECT

```python
# ORM â€” Get company profile (singleton)
profile = CompanyProfile.get_profile()
print(profile.name, profile.email, profile.phone)
print(profile.upi_id, profile.bank_name, profile.bank_account)
```

```sql
-- SQL
SELECT * FROM company_profile;
```

### âœï¸ UPDATE

```python
# ORM â€” Update company info
profile = CompanyProfile.get_profile()
profile.name = 'ATS Automation'
profile.email = 'contact@atsautomation.in'
profile.phone = '+91 9876543210'
profile.address = '123 Tech Street, Pune, Maharashtra'
profile.upi_id = 'atsautomation@upi'
profile.upi_name = 'ATS Automation'
profile.bank_name = 'State Bank of India'
profile.bank_account = '1234567890'
profile.bank_ifsc = 'SBIN0001234'
profile.bank_branch = 'MG Road Branch'
profile.default_due_days = 30
db.session.commit()
```

```sql
-- SQL â€” Update company details
UPDATE company_profile SET
    name = 'ATS Automation',
    email = 'contact@atsautomation.in',
    phone = '+91 9876543210',
    default_due_days = 30
WHERE id = 1;
```

### ðŸ—‘ï¸ DELETE & RECREATE

```python
# ORM â€” Reset company profile to defaults
profile = CompanyProfile.query.first()
if profile:
    db.session.delete(profile)
    db.session.commit()
# Call get_profile() to recreate with defaults
new_profile = CompanyProfile.get_profile()
print("Profile reset to defaults!")
```

```sql
-- SQL â€” Delete and let app recreate on next load
DELETE FROM company_profile;
```

---

## 5. Clients

### ðŸ” SELECT

```python
# ORM â€” All active clients
clients = Client.query.filter_by(is_archived=False).all()
for c in clients:
    print(c.id, c.name, c.company_name, c.email, c.phone)

# ORM â€” All clients (including archived)
all_clients = Client.query.all()

# ORM â€” Search by name
client = Client.query.filter(Client.name.ilike('%john%')).all()

# ORM â€” Get client by ID
client = Client.query.get(5)

# ORM â€” Get client with invoice count
client = Client.query.get(1)
print(f"{client.name} â€” {client.invoice_count} invoices, â‚¹{client.total_billed} billed")
```

```sql
-- SQL â€” All active clients
SELECT * FROM clients WHERE is_archived = 0;

-- SQL â€” Search client
SELECT * FROM clients WHERE name LIKE '%john%';

-- SQL â€” Client with invoice count
SELECT c.name, COUNT(i.id) as invoice_count, COALESCE(SUM(i.total_amount), 0) as total_billed
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id AND i.is_archived = 0
WHERE c.is_archived = 0
GROUP BY c.id;
```

### âž• INSERT

```python
# ORM â€” Add new client
new_client = Client(
    name='Rahul Sharma',
    company_name='TechVision Pvt Ltd',
    email='rahul@techvision.com',
    phone='+91 9876543210',
    address='456 Business Park, Mumbai'
)
db.session.add(new_client)
db.session.commit()
print(f"Client created with ID: {new_client.id}")
```

```sql
-- SQL
INSERT INTO clients (name, company_name, email, phone, address, is_archived)
VALUES ('Rahul Sharma', 'TechVision Pvt Ltd', 'rahul@techvision.com', '+91 9876543210', '456 Business Park, Mumbai', 0);
```

### âœï¸ UPDATE

```python
# ORM â€” Update client
client = Client.query.get(1)
client.name = 'Rahul K. Sharma'
client.email = 'rahul.new@techvision.com'
db.session.commit()

# ORM â€” Archive client (soft delete)
client = Client.query.get(3)
client.is_archived = True
db.session.commit()

# ORM â€” Unarchive client
client = Client.query.get(3)
client.is_archived = False
db.session.commit()
```

```sql
-- SQL â€” Update client
UPDATE clients SET name = 'Rahul K. Sharma', email = 'rahul.new@techvision.com' WHERE id = 1;

-- SQL â€” Archive client
UPDATE clients SET is_archived = 1 WHERE id = 3;

-- SQL â€” Unarchive client
UPDATE clients SET is_archived = 0 WHERE id = 3;
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete client (CASCADE: also deletes all their invoices & quotations!)
client = Client.query.get(5)
if client:
    print(f"âš ï¸  Deleting {client.name} and ALL their invoices & quotations...")
    db.session.delete(client)
    db.session.commit()
    print("Deleted!")

# ORM â€” Delete ONLY archived clients
archived = Client.query.filter_by(is_archived=True).all()
for c in archived:
    db.session.delete(c)
db.session.commit()
print(f"Deleted {len(archived)} archived clients")
```

```sql
-- SQL â€” Delete client (WARNING: manually delete related records first!)
DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE client_id = 5);
DELETE FROM quotations WHERE client_id = 5;
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = 5);
DELETE FROM invoices WHERE client_id = 5;
DELETE FROM clients WHERE id = 5;

-- SQL â€” Delete all archived clients
DELETE FROM clients WHERE is_archived = 1;
```

> âš ï¸ **CASCADE Warning:** ORM delete automatically removes related invoices, invoice items, quotations & quotation items. SQL requires manual cleanup!

---

## 6. Services

### ðŸ” SELECT

```python
# ORM â€” All services
services = Service.query.all()
for s in services:
    print(s.id, s.name, f"â‚¹{s.base_price}")

# ORM â€” Search by name
services = Service.query.filter(Service.name.ilike('%web%')).all()

# ORM â€” Sort by price
services = Service.query.order_by(Service.base_price.desc()).all()
```

```sql
-- SQL â€” All services
SELECT * FROM services;

-- SQL â€” Search by name
SELECT * FROM services WHERE name LIKE '%web%';

-- SQL â€” Sorted by price
SELECT * FROM services ORDER BY base_price DESC;
```

### âž• INSERT

```python
# ORM â€” Add service
new_service = Service(name='Website Development', base_price=25000.0)
db.session.add(new_service)
db.session.commit()
print(f"Service created with ID: {new_service.id}")

# ORM â€” Add multiple services at once
services = [
    Service(name='Mobile App Development', base_price=50000.0),
    Service(name='SEO Optimization', base_price=8000.0),
    Service(name='Logo Design', base_price=5000.0),
]
db.session.add_all(services)
db.session.commit()
```

```sql
-- SQL â€” Add service
INSERT INTO services (name, base_price) VALUES ('Website Development', 25000.0);

-- SQL â€” Add multiple services
INSERT INTO services (name, base_price) VALUES
    ('Mobile App Development', 50000.0),
    ('SEO Optimization', 8000.0),
    ('Logo Design', 5000.0);
```

### âœï¸ UPDATE

```python
# ORM â€” Update service
service = Service.query.get(1)
service.name = 'Full Stack Website Development'
service.base_price = 30000.0
db.session.commit()
```

```sql
-- SQL
UPDATE services SET name = 'Full Stack Website Development', base_price = 30000.0 WHERE id = 1;
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete service by ID
service = Service.query.get(3)
if service:
    db.session.delete(service)
    db.session.commit()
    print("Service deleted!")

# ORM â€” Delete service by name
service = Service.query.filter_by(name='Logo Design').first()
if service:
    db.session.delete(service)
    db.session.commit()

# ORM â€” Delete ALL services
Service.query.delete()
db.session.commit()
print("All services deleted!")
```

```sql
-- SQL â€” Delete specific service
DELETE FROM services WHERE id = 3;

-- SQL â€” Delete by name
DELETE FROM services WHERE name = 'Logo Design';

-- SQL â€” Delete ALL services
DELETE FROM services;
```

> â„¹ï¸ Deleting a service does NOT affect existing quotation/invoice items â€” they store the service name as a copy.

---

## 7. Quotations

### ðŸ” SELECT

```python
# ORM â€” All active quotations
quotations = Quotation.query.filter_by(is_archived=False).order_by(Quotation.date_created.desc()).all()
for q in quotations:
    print(q.quotation_number, q.client.name, q.status, f"â‚¹{q.total_amount}")

# ORM â€” Filter by status
drafts = Quotation.query.filter_by(status='Draft', is_archived=False).all()
accepted = Quotation.query.filter_by(status='Accepted', is_archived=False).all()
sent = Quotation.query.filter_by(status='Sent', is_archived=False).all()

# ORM â€” Get by quotation number
q = Quotation.query.filter_by(quotation_number='BL-QT-2026-001').first()

# ORM â€” Get quotation with items
q = Quotation.query.get(1)
print(f"Quotation: {q.quotation_number}")
for item in q.items:
    print(f"  {item.service_name} â€” {item.quantity} Ã— â‚¹{item.rate} = â‚¹{item.amount}")

# ORM â€” Quotations for a specific client
client_quotations = Quotation.query.filter_by(client_id=1, is_archived=False).all()
```

```sql
-- SQL â€” All active quotations with client name
SELECT q.*, c.name as client_name
FROM quotations q
JOIN clients c ON q.client_id = c.id
WHERE q.is_archived = 0
ORDER BY q.date_created DESC;

-- SQL â€” Filter by status
SELECT * FROM quotations WHERE status = 'Draft' AND is_archived = 0;

-- SQL â€” Get quotation items
SELECT qi.*, q.quotation_number
FROM quotation_items qi
JOIN quotations q ON qi.quotation_id = q.id
WHERE q.id = 1;
```

### âž• INSERT

```python
# ORM â€” Create quotation (prefer using the web UI for auto-numbering)
from datetime import datetime, timedelta
from models import IST, now_ist

q = Quotation(
    quotation_number='BL-QT-2026-010',
    client_id=1,
    date_created=now_ist(),
    valid_until=now_ist() + timedelta(days=15),
    estimated_timeline='2-3 weeks',
    sub_total=25000.0,
    discount=0,
    discount_type='flat',
    discount_amount=0,
    total_amount=25000.0,
    status='Draft',
    notes='Custom quotation'
)
db.session.add(q)
db.session.commit()

# Add items to the quotation
item1 = QuotationItem(
    quotation_id=q.id,
    service_name='Website Development',
    description='Full responsive website',
    quantity=1,
    rate=25000.0,
    amount=25000.0
)
db.session.add(item1)
db.session.commit()
```

### âœï¸ UPDATE

```python
# ORM â€” Change status
q = Quotation.query.filter_by(quotation_number='BL-QT-2026-001').first()
q.status = 'Accepted'
db.session.commit()

# ORM â€” Update amounts
q = Quotation.query.get(1)
q.discount = 10
q.discount_type = 'percent'
q.discount_amount = q.sub_total * 10 / 100
q.total_amount = q.sub_total - q.discount_amount
db.session.commit()

# ORM â€” Archive quotation
q = Quotation.query.get(2)
q.is_archived = True
db.session.commit()
```

```sql
-- SQL â€” Change status
UPDATE quotations SET status = 'Accepted' WHERE quotation_number = 'BL-QT-2026-001';

-- SQL â€” Archive quotation
UPDATE quotations SET is_archived = 1 WHERE id = 2;
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete quotation by ID (CASCADE: also deletes its items)
q = Quotation.query.get(5)
if q:
    print(f"Deleting quotation {q.quotation_number}...")
    db.session.delete(q)
    db.session.commit()
    print("Deleted!")

# ORM â€” Delete quotation by number
q = Quotation.query.filter_by(quotation_number='BL-QT-2026-003').first()
if q:
    db.session.delete(q)
    db.session.commit()

# ORM â€” Delete all archived quotations
archived = Quotation.query.filter_by(is_archived=True).all()
for q in archived:
    db.session.delete(q)
db.session.commit()
print(f"Deleted {len(archived)} archived quotations")

# ORM â€” Delete all DRAFT quotations
drafts = Quotation.query.filter_by(status='Draft').all()
for q in drafts:
    db.session.delete(q)
db.session.commit()
```

```sql
-- SQL â€” Delete quotation (manually delete items first!)
DELETE FROM quotation_items WHERE quotation_id = 5;
DELETE FROM quotations WHERE id = 5;

-- SQL â€” Delete by quotation number
DELETE FROM quotation_items WHERE quotation_id = (SELECT id FROM quotations WHERE quotation_number = 'BL-QT-2026-003');
DELETE FROM quotations WHERE quotation_number = 'BL-QT-2026-003';

-- SQL â€” Delete all archived quotations
DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE is_archived = 1);
DELETE FROM quotations WHERE is_archived = 1;

-- SQL â€” Delete ALL quotations (DANGEROUS!)
DELETE FROM quotation_items;
DELETE FROM quotations;
```

---

## 8. Quotation Items

### ðŸ” SELECT

```python
# ORM â€” Get items for a quotation
items = QuotationItem.query.filter_by(quotation_id=1).all()
for item in items:
    print(item.service_name, item.quantity, item.rate, item.amount)
```

```sql
-- SQL
SELECT * FROM quotation_items WHERE quotation_id = 1;
```

### âž• INSERT

```python
# ORM â€” Add item to existing quotation
item = QuotationItem(
    quotation_id=1,
    service_name='API Development',
    description='REST API with authentication',
    quantity=1,
    rate=15000.0,
    amount=15000.0
)
db.session.add(item)

# Don't forget to recalculate quotation totals!
q = Quotation.query.get(1)
q.sub_total = sum(i.amount for i in q.items) + item.amount
q.total_amount = q.sub_total - q.discount_amount
db.session.commit()
```

### âœï¸ UPDATE

```python
# ORM â€” Update item
item = QuotationItem.query.get(3)
item.quantity = 2
item.rate = 12000.0
item.amount = item.quantity * item.rate
db.session.commit()

# Recalculate parent quotation
q = item.quotation
q.sub_total = sum(i.amount for i in q.items)
q.total_amount = q.sub_total - q.discount_amount
db.session.commit()
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete specific item
item = QuotationItem.query.get(3)
q = item.quotation
db.session.delete(item)

# Recalculate totals
q.sub_total = sum(i.amount for i in q.items if i.id != item.id)
q.total_amount = q.sub_total - q.discount_amount
db.session.commit()
```

```sql
-- SQL
DELETE FROM quotation_items WHERE id = 3;

-- SQL â€” Delete all items of a quotation
DELETE FROM quotation_items WHERE quotation_id = 1;
```

---

## 9. Invoices

### ðŸ” SELECT

```python
# ORM â€” All active invoices
invoices = Invoice.query.filter_by(is_archived=False).order_by(Invoice.date_created.desc()).all()
for inv in invoices:
    print(inv.invoice_number, inv.client.name, inv.status, f"â‚¹{inv.total_amount}", f"Balance: â‚¹{inv.balance_due}")

# ORM â€” Filter by status
pending = Invoice.query.filter_by(status='Pending', is_archived=False).all()
paid = Invoice.query.filter_by(status='Paid', is_archived=False).all()

# ORM â€” Get overdue invoices
all_invoices = Invoice.query.filter_by(is_archived=False).all()
overdue = [inv for inv in all_invoices if inv.is_overdue]

# ORM â€” Get by invoice number
inv = Invoice.query.filter_by(invoice_number='BL-INV-2026-001').first()

# ORM â€” Total revenue (all paid invoices)
from sqlalchemy import func
total_revenue = db.session.query(func.sum(Invoice.total_amount)).filter_by(status='Paid').scalar() or 0
print(f"Total Revenue: â‚¹{total_revenue}")

# ORM â€” Invoices for a specific client
client_invoices = Invoice.query.filter_by(client_id=1, is_archived=False).all()
```

```sql
-- SQL â€” All active invoices with client name
SELECT i.*, c.name as client_name
FROM invoices i
JOIN clients c ON i.client_id = c.id
WHERE i.is_archived = 0
ORDER BY i.date_created DESC;

-- SQL â€” Total revenue
SELECT SUM(total_amount) as total_revenue FROM invoices WHERE status = 'Paid';

-- SQL â€” Overdue invoices
SELECT * FROM invoices
WHERE status != 'Paid' AND status != 'Cancelled'
  AND due_date < datetime('now')
  AND is_archived = 0;

-- SQL â€” Revenue by month
SELECT strftime('%Y-%m', date_created) as month,
       SUM(total_amount) as revenue
FROM invoices
WHERE status = 'Paid'
GROUP BY month
ORDER BY month DESC;
```

### âž• INSERT

```python
# ORM â€” Create invoice (prefer using the web UI for auto-numbering)
from models import now_ist
from datetime import timedelta

inv = Invoice(
    invoice_number='BL-INV-2026-010',
    client_id=1,
    date_created=now_ist(),
    due_date=now_ist() + timedelta(days=15),
    sub_total=25000.0,
    discount=0,
    discount_type='flat',
    discount_amount=0,
    total_amount=25000.0,
    advance_amount=0,
    status='Pending',
    payment_mode='Bank Transfer',
    notes='Payment via NEFT'
)
db.session.add(inv)
db.session.commit()

# Add items
item = InvoiceItem(
    invoice_id=inv.id,
    service_name='Website Development',
    description='Full responsive website',
    quantity=1,
    rate=25000.0,
    amount=25000.0
)
db.session.add(item)
db.session.commit()
```

### âœï¸ UPDATE

```python
# ORM â€” Mark invoice as Paid
inv = Invoice.query.filter_by(invoice_number='BL-INV-2026-001').first()
inv.status = 'Paid'
db.session.commit()

# ORM â€” Update advance amount
inv = Invoice.query.get(1)
inv.advance_amount = 10000.0
db.session.commit()
print(f"Balance due: â‚¹{inv.balance_due}")

# ORM â€” Cancel invoice
inv = Invoice.query.get(2)
inv.status = 'Cancelled'
db.session.commit()

# ORM â€” Archive invoice
inv = Invoice.query.get(3)
inv.is_archived = True
db.session.commit()
```

```sql
-- SQL â€” Mark as Paid
UPDATE invoices SET status = 'Paid' WHERE invoice_number = 'BL-INV-2026-001';

-- SQL â€” Update advance
UPDATE invoices SET advance_amount = 10000.0 WHERE id = 1;

-- SQL â€” Archive
UPDATE invoices SET is_archived = 1 WHERE id = 3;
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete invoice by ID (CASCADE: also deletes its items)
inv = Invoice.query.get(5)
if inv:
    print(f"Deleting invoice {inv.invoice_number}...")
    db.session.delete(inv)
    db.session.commit()
    print("Deleted!")

# ORM â€” Delete by invoice number
inv = Invoice.query.filter_by(invoice_number='BL-INV-2026-003').first()
if inv:
    db.session.delete(inv)
    db.session.commit()

# ORM â€” Delete all cancelled invoices
cancelled = Invoice.query.filter_by(status='Cancelled').all()
for inv in cancelled:
    db.session.delete(inv)
db.session.commit()
print(f"Deleted {len(cancelled)} cancelled invoices")

# ORM â€” Delete all archived invoices
archived = Invoice.query.filter_by(is_archived=True).all()
for inv in archived:
    db.session.delete(inv)
db.session.commit()
```

```sql
-- SQL â€” Delete invoice (manually delete items first!)
DELETE FROM invoice_items WHERE invoice_id = 5;
DELETE FROM invoices WHERE id = 5;

-- SQL â€” Delete by invoice number
DELETE FROM invoice_items WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'BL-INV-2026-003');
DELETE FROM invoices WHERE invoice_number = 'BL-INV-2026-003';

-- SQL â€” Delete all cancelled invoices
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE status = 'Cancelled');
DELETE FROM invoices WHERE status = 'Cancelled';

-- SQL â€” Delete ALL invoices (DANGEROUS!)
DELETE FROM invoice_items;
DELETE FROM invoices;
```

---

## 10. Invoice Items

### ðŸ” SELECT

```python
# ORM â€” Get items for an invoice
items = InvoiceItem.query.filter_by(invoice_id=1).all()
for item in items:
    print(item.service_name, item.quantity, item.rate, item.amount)
```

```sql
-- SQL
SELECT * FROM invoice_items WHERE invoice_id = 1;
```

### âž• INSERT

```python
# ORM â€” Add item to existing invoice
item = InvoiceItem(
    invoice_id=1,
    service_name='Hosting Setup',
    description='AWS hosting configuration',
    quantity=1,
    rate=5000.0,
    amount=5000.0
)
db.session.add(item)

# Recalculate invoice totals
inv = Invoice.query.get(1)
inv.sub_total = sum(i.amount for i in inv.items) + item.amount
inv.total_amount = inv.sub_total - inv.discount_amount
db.session.commit()
```

### âœï¸ UPDATE

```python
# ORM â€” Update item
item = InvoiceItem.query.get(3)
item.quantity = 2
item.rate = 5000.0
item.amount = item.quantity * item.rate
db.session.commit()

# Recalculate parent invoice
inv = item.invoice
inv.sub_total = sum(i.amount for i in inv.items)
inv.total_amount = inv.sub_total - inv.discount_amount
db.session.commit()
```

### ðŸ—‘ï¸ DELETE

```python
# ORM â€” Delete specific item
item = InvoiceItem.query.get(3)
inv = item.invoice
db.session.delete(item)

# Recalculate totals
inv.sub_total = sum(i.amount for i in inv.items if i.id != item.id)
inv.total_amount = inv.sub_total - inv.discount_amount
db.session.commit()
```

```sql
-- SQL
DELETE FROM invoice_items WHERE id = 3;

-- SQL â€” Delete all items of an invoice
DELETE FROM invoice_items WHERE invoice_id = 1;
```

---

## 11. Bulk & Advanced Operations

### ðŸ§¹ Delete All Data (Full Reset)

```python
# ORM â€” Nuclear option: delete everything
InvoiceItem.query.delete()
Invoice.query.delete()
QuotationItem.query.delete()
Quotation.query.delete()
Service.query.delete()
Client.query.delete()
# Optionally reset company profile
# CompanyProfile.query.delete()
db.session.commit()
print("All data cleared!")
```

```sql
-- SQL â€” Full reset (order matters due to foreign keys!)
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM quotation_items;
DELETE FROM quotations;
DELETE FROM services;
DELETE FROM clients;
-- DELETE FROM company_profile;  -- optional
```

### ðŸ“Š Useful Reports

```python
# ORM â€” Revenue summary
from sqlalchemy import func

total_revenue = db.session.query(func.sum(Invoice.total_amount)).filter_by(status='Paid').scalar() or 0
total_pending = db.session.query(func.sum(Invoice.total_amount)).filter_by(status='Pending').scalar() or 0
total_clients = Client.query.filter_by(is_archived=False).count()
total_quotations = Quotation.query.filter_by(is_archived=False).count()

print(f"Revenue: â‚¹{total_revenue}")
print(f"Pending: â‚¹{total_pending}")
print(f"Active Clients: {total_clients}")
print(f"Quotations: {total_quotations}")
```

```sql
-- SQL â€” Full business summary
SELECT
    (SELECT COUNT(*) FROM clients WHERE is_archived = 0) as active_clients,
    (SELECT COUNT(*) FROM quotations WHERE is_archived = 0) as total_quotations,
    (SELECT COUNT(*) FROM invoices WHERE is_archived = 0) as total_invoices,
    (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'Paid') as total_revenue,
    (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'Pending') as total_pending;
```

### ðŸ”— Transfer Client's Data to Another Client

```python
# ORM â€” Move all invoices from client 2 to client 1
old_client_id = 2
new_client_id = 1

Invoice.query.filter_by(client_id=old_client_id).update({'client_id': new_client_id})
Quotation.query.filter_by(client_id=old_client_id).update({'client_id': new_client_id})
db.session.commit()
print(f"All records moved from client {old_client_id} to client {new_client_id}")
```

---

## 12. Database Maintenance

### ðŸ”’ Backup

```bash
# Simple copy
cp /home/bims/ims/instance/ats.db /home/bims/ims/instance/ats_backup.db

# With timestamp
cp /home/bims/ims/instance/ats.db /home/bims/ims/instance/backup_$(date +%Y%m%d_%H%M%S).db
```

### ðŸ“¦ Export to SQL (Full Dump)

```bash
sqlite3 /home/bims/ims/instance/ats.db .dump > /home/bims/ims/backup_full.sql
```

### ðŸ“¥ Restore from Backup

```bash
# Reload the web app after restoring
cp instance/ats_backup.db instance/ats.db
```

> ðŸ’¡ After restoring, restart your web application to apply changes.

### ðŸ”§ Check Database Integrity

```sql
-- Inside sqlite3 shell
PRAGMA integrity_check;
```

### ðŸ“ Database Size

```bash
ls -lh /home/bims/ims/instance/ats.db

# Or more detailed
du -sh /home/bims/ims/instance/ats.db
```

### ðŸ—œï¸ Compact Database (after bulk deletes)

```sql
-- Reclaim unused space
VACUUM;
```

### ðŸ”„ Reload App After DB Changes

> After making any database changes via console, restart your web application to apply changes to the live site.

---

> ðŸ’¡ **Pro Tip:** Always prefer using the web UI for creating quotations and invoices â€” it handles auto-numbering, calculations, and validation automatically. Use these commands for bulk operations, data fixes, and admin tasks.

---

*ATS QIS â€” Database Operations Guide*  
*Built with â¤ï¸ by ATS Automation*
