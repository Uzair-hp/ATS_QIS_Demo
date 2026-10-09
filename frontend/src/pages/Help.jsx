import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

/* ── Content ────────────────────────────────────────────────────────────────
   Kept as data rather than JSX so the search box can filter it and so the
   same text can be checked against the app's real behaviour. */

const QUICK_START = [
  { t: 'Add your company details once', d: 'Open Company Settings and fill in GSTIN, MSME/Udyam number, bank account, IFSC and UPI ID. Every invoice and quotation PDF pulls these from there — fill it once, not per document.', to: '/settings' },
  { t: 'Create a client', d: 'Clients → Add Client. Add the GSTIN if the client is registered; it appears on the bill as "GST NO." and is needed for input tax credit.', to: '/clients/add' },
  { t: 'Load your service catalogue', d: 'Services Catalog is the shortcut that saves the most typing. Store each service once with its HSN/SAC code, base price and description.', to: '/services' },
  { t: 'Send a quotation', d: 'Create Quotation → pick the client → pick services from the catalogue. The rate, HSN and description fill in automatically when you choose a service.', to: '/quotations/create' },
  { t: 'Convert it to an invoice', d: 'When the client accepts, open the quotation → Convert to Invoice. Every field and line item carries over, and the quotation is locked as "Invoiced".', to: '/quotations' },
  { t: 'Record the payment', d: 'On the invoice, enter the advance received. Status becomes Partially Paid, and Balance Due updates automatically.', to: '/invoices' },
]

const SECTIONS = [
  {
    id: 'basics',
    icon: 'bi-rocket-takeoff-fill',
    title: 'Getting started',
    items: [
      { q: 'What is the login?', a: 'Open the app and sign in with the admin account. The username is admin. If you have changed the password and forgotten it, it has to be reset from the server — see "Still stuck?" at the bottom of this page.' },
      { q: 'Do I have to fill company details on every bill?', a: 'No. Company Settings is a single profile. GSTIN, MSME number, bank details, UPI ID, stamp image and the default GST % and payment terms all come from there and appear on every PDF automatically.' },
      { q: 'How do I change the default GST % and due days?', a: 'Company Settings has Default GST % and Default Due (days). New invoices pick these up when they are created. Existing invoices keep whatever value they were saved with.' },
    ],
  },
  {
    id: 'clients',
    icon: 'bi-people-fill',
    title: 'Clients',
    items: [
      { q: 'What is Archive vs Delete?', a: 'Archiving hides a client from every list without touching any of their invoices or quotations, and you can restore them later. Use it instead of deleting — it keeps your billing history intact.' },
      { q: 'Why does a client show an "Outstanding" amount?', a: 'That is the sum of balance due on all of their non-archived invoices. An invoice is outstanding until the advance received equals the grand total.' },
      { q: 'Can I change a client name after invoices exist?', a: 'Yes, but existing PDFs keep the name that was there when they were generated. Re-download the PDF if you need the new name on it.' },
    ],
  },
  {
    id: 'services',
    icon: 'bi-box-seam-fill',
    title: 'Services catalogue',
    items: [
      { q: 'How does the catalogue save time?', a: 'On the invoice and quotation forms, typing a service name that matches the catalogue fills in its rate, HSN/SAC code and description as soon as you leave the field.' },
      { q: 'What if a service is not in the catalogue?', a: 'Just type it. The fields fill in only on an exact name match; anything else is free text and you can type the rate and HSN yourself.' },
      { q: 'Is deleting a service safe?', a: 'Yes for past documents. Existing invoices and quotations keep the name, rate and HSN they were created with — they do not read back from the catalogue. Only future items are affected.' },
    ],
  },
  {
    id: 'quotations',
    icon: 'bi-file-earmark-text-fill',
    title: 'Quotations',
    items: [
      { q: 'What do the statuses mean?', a: 'Draft, Sent, Accepted, Declined, Invoiced and Expired. Sent is the usual one while the client is deciding. Invoiced means the quotation has already been converted and cannot be converted again.' },
      { q: 'What does Duplicate do?', a: 'It creates a copy as a new revision, numbered like ATS-QT-2026-001-R2. Use it when a client asks for a revised price — the original stays untouched as a record.' },
      { q: 'Can I convert a quotation to an invoice more than once?', a: 'No. Converting sets the quotation to Invoiced and links the invoice back to it. Converting a second time returns an error rather than creating a duplicate invoice.' },
      { q: 'What carries over when I convert?', a: 'Client, every line item with its rate and HSN, subject, delivery address, payment terms, GST % and the notes. The invoice gets a fresh number and starts at Pending with zero advance.' },
    ],
  },
  {
    id: 'invoices',
    icon: 'bi-receipt',
    title: 'Invoices',
    items: [
      { q: 'How is the total worked out?', a: 'Subtotal = sum of quantity × rate for every line. Discount is subtracted, then GST is calculated on the discounted amount, and Grand Total = that plus GST. Balance Due = Grand Total − advance received.' },
      { q: 'How do I mark an invoice paid?', a: 'On the invoice page, enter the amount received in Advance Received and save. Once it equals the grand total the status becomes Paid automatically.' },
      { q: 'Why can I not edit a Paid invoice?', a: 'Only Pending and Partially Paid invoices can be edited. A paid invoice is a financial record — archive it if it must not appear in the list, but the amounts stay as they were.' },
      { q: 'Can a discount be a percentage?', a: 'Yes. In the Invoice Summary, pick % instead of ₹ next to the discount field.' },
    ],
  },
  {
    id: 'pdf',
    icon: 'bi-file-earmark-pdf-fill',
    title: 'PDF & printing',
    items: [
      { q: 'How do I download the PDF?', a: 'Every invoice and quotation has a Download PDF button. The PDF is generated on the server from your company settings, the client details and the line items.' },
      { q: 'The UPI QR code is not showing.', a: 'The QR is only printed when a UPI ID is saved in Company Settings and the balance due is above zero. On a quotation there is no QR because nothing is being asked for yet.' },
      { q: 'My stamp image is not on the PDF.', a: 'Check that a stamp was uploaded in Company Settings and that it was not marked for removal. The stamp sits above the "Authorized Signatory" line.' },
      { q: 'How do I share a bill on WhatsApp?', a: 'The invoice page builds the message for you — it includes the invoice number, total, balance due and the due date. The Share on WhatsApp button opens it with the client number already filled.' },
      { q: 'The PDF is missing the amount in words.', a: 'Only the newer templates include it. Download the PDF from the invoice page and check which template is in use.' },
    ],
  },
  {
    id: 'troubleshoot',
    icon: 'bi-tools',
    title: 'Troubleshooting',
    items: [
      { q: '"Authentication required" or I keep getting logged out.', a: 'The session expired. Sign in again. If it keeps happening, the server clock or the secret key may have changed between restarts — the secret key must stay constant in production.' },
      { q: 'A save fails with "CSRF token missing" or "validation failed".', a: 'Your session expired mid-request. Refresh the page and try again — the security token is issued when the app loads.' },
      { q: 'It says "must be a finite number" when I enter a GST %.', a: 'NaN and Infinity are rejected on purpose — they would silently corrupt every total. Enter a number between 0 and 100.' },
      { q: 'A discount of more than 100% was rejected.', a: 'Same reason. A percentage discount is capped at 100; use the ₹ (flat) option for a straight rupee amount.' },
      { q: 'The app shows "Frontend build not found".', a: 'The server serves the built SPA and it is missing. Run npm install then npm run build inside the frontend folder, then reload.' },
      { q: 'I typed a service name but nothing filled in.', a: 'Auto-fill matches the catalogue name exactly. Check the spelling, or add the service to the catalogue with the exact name.' },
      { q: 'A quotation PDF has no GST on it.', a: 'The GST % on that quotation is 0. Open it and set the GST %, or set a default in Company Settings so new quotations pick it up.' },
    ],
  },
]

const ALL_ITEMS = SECTIONS.flatMap((s) =>
  s.items.map((it) => ({ ...it, section: s.title, sectionId: s.id, icon: s.icon }))
)

function match(item, q) {
  if (!q) return true
  const hay = `${item.q} ${item.a} ${item.section}`.toLowerCase()
  return hay.includes(q.toLowerCase())
}

export default function Help() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState({})   // sectionId -> bool
  const [openItem, setOpenItem] = useState(null)

  const results = useMemo(() => ALL_ITEMS.filter((i) => match(i, query.trim())), [query])

  const bySection = useMemo(() => {
    const map = new Map()
    for (const r of results) {
      if (!map.has(r.sectionId)) map.set(r.sectionId, [])
      map.get(r.sectionId).push(r)
    }
    return map
  }, [results])

  const { user } = useAuth()

  const toggleSection = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }))
  const isSectionOpen = (id) => (query.trim() ? true : !!open[id])

  return (
    <Layout
      title="Help &amp; Support"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Help &amp; Support</span>
        </>
      }
    >
      {/* Intro */}
      <div className="inf-card mb-3">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div style={{ maxWidth: 620 }}>
              <h5 className="fw-bold mb-2">How can we help?</h5>
              <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                Everything about clients, quotations, invoices, GST and PDF
                generation. Searching below covers the full answer set.
              </p>
            </div>
            <div className="help-search">
              <i className="bi bi-search"></i>
              <input
                type="search"
                className="form-control"
                placeholder="Search for GST, HSN, discount, PDF, archive…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search help"
              />
              {query && (
                <button
                  type="button"
                  className="help-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}
            </div>
          </div>
          {query.trim() && (
            <div className="mt-3 small text-muted">
              {results.length
                ? `${results.length} answer${results.length === 1 ? '' : 's'} matching “${query.trim()}”`
                : `Nothing matches “${query.trim()}”. Try a shorter word, or ask below.`}
            </div>
          )}
        </div>
      </div>

      {/* Quick start */}
      {!query.trim() && (
        <div className="inf-card mb-3">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-1">
              <i className="bi bi-signpost-split me-2 text-primary"></i>
              First-time setup
            </h6>
            <p className="text-muted small mb-3">
              Six steps, in order. Done once — everything after this is routine.
            </p>
            <div className="row g-3">
              {QUICK_START.map((s, i) => (
                <div className="col-md-6 col-xl-4" key={s.t}>
                  <div className="help-step h-100">
                    <span className="help-step-n">{i + 1}</span>
                    <div>
                      <div className="fw-bold" style={{ fontSize: '0.87rem' }}>{s.t}</div>
                      <p className="text-muted mb-2" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {s.d}
                      </p>
                      <Link to={s.to} className="help-step-link">
                        Open <i className="bi bi-arrow-right"></i>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAQ */}
      {SECTIONS.filter((s) => bySection.has(s.id)).map((s) => {
        const items = bySection.get(s.id) || []
        return (
          <div className="inf-card mb-3" key={s.id}>
            <button
              type="button"
              className="help-accordion-head"
              onClick={() => toggleSection(s.id)}
              aria-expanded={isSectionOpen(s.id)}
            >
              <span>
                <i className={`bi ${s.icon} me-2 text-primary`}></i>
                {s.title}
              </span>
              <span className="d-flex align-items-center gap-2">
                <span className="help-count">{items.length}</span>
                <i className={`bi ${isSectionOpen(s.id) ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </span>
            </button>

            {isSectionOpen(s.id) && (
              <div className="card-body p-0">
                {items.map((it) => {
                  const key = `${it.sectionId}:${it.q}`
                  const isOpen = query.trim() ? true : openItem === key
                  return (
                    <div className="help-qa" key={key}>
                      <button
                        type="button"
                        className="help-qa-q"
                        onClick={() => setOpenItem(isOpen ? null : key)}
                        aria-expanded={isOpen}
                      >
                        <span>{it.q}</span>
                        <i className={`bi ${isOpen ? 'bi-dash' : 'bi-plus'} ms-2`}></i>
                      </button>
                      {isOpen && (
                        <div className="help-qa-a">
                          <p className="mb-0" dangerouslySetInnerHTML={{ __html: it.a }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Still stuck */}
      <div className="inf-card mb-3">
        <div className="card-body p-4">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-life-preserver me-2 text-primary"></i>
            Still stuck?
          </h6>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="help-tip h-100">
                <div className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>Check the browser console</div>
                <p className="text-muted mb-0" style={{ fontSize: '0.79rem', lineHeight: 1.5 }}>
                  Press <kbd>F12</kbd> → Console. API errors are printed there with
                  the exact message the server returned, which is usually enough
                  to identify the problem.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="help-tip h-100">
                <div className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>Export before bulk edits</div>
                <p className="text-muted mb-0" style={{ fontSize: '0.79rem', lineHeight: 1.5 }}>
                  Invoices, Quotations and Clients all have a CSV export. Take
                  one before large changes so you always have a copy of the
                  current numbers.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="help-tip h-100">
                <div className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>Never wipe without a backup</div>
                <p className="text-muted mb-0" style={{ fontSize: '0.79rem', lineHeight: 1.5 }}>
                  The Wipe All Data action in Company Settings permanently
                  deletes every client, service, invoice and quotation. Copy the
                  database file first.
                </p>
              </div>
            </div>
          </div>

          <hr className="my-4" />

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="fw-bold" style={{ fontSize: '0.88rem' }}>Need a person?</div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                Signed in as <strong>{user?.username || 'admin'}</strong>. Quote the
                invoice or quotation number and the exact error message.
              </div>
            </div>
            <div className="d-flex gap-2">
              <a href="mailto:info@atsautomation.in" className="btn btn-inf-outline">
                <i className="bi bi-envelope me-1"></i>Email support
              </a>
              <Link to="/settings" className="btn btn-inf">
                <i className="bi bi-gear me-1"></i>Company Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}