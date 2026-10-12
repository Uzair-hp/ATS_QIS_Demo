// Primitives shared by every document template.
//
// The previous print sheet hardcoded one layout whose geometry came from a
// 300 dpi measurement of a single sample scan: fixed mm row heights, a
// `min-height` floor on the items block, `white-space: nowrap` inside a 21mm
// column. That is why a one-item quotation left a 48mm gap and why
// "Authorized Signatory" ran past its cell. Nothing here fixes a height - every
// block is sized by its own content, so the items table grows and the totals
// follow it.

import watermarkUrl from '../../public/assets/watermark.svg'

/** The A4 page. `data-template` is what the stylesheet keys its look off. */
export function Sheet({ template, children, className = '' }) {
  return (
    <div className="doc-sheet-wrap">
      <div className={`doc-sheet doc-t-${template} ${className}`}>
        <div
          className="doc-watermark"
          aria-hidden="true"
          style={{ '--doc-watermark': `url(${watermarkUrl})` }}
        />
        {children}
      </div>
    </div>
  )
}

/** Company mark: the uploaded logo when there is one, else the company name. */
export function CompanyMark({ company, variant = 'plate', className = '' }) {
  return (
    <div className={`doc-mark doc-mark-${variant} ${className}`}>
      {company.logo ? (
        <img src={company.logo} alt={company.name} />
      ) : (
        <span className="doc-mark-text">{company.name || 'Company'}</span>
      )}
    </div>
  )
}

/** The stamp slot. Empty when the company has not uploaded one - deliberately
 *  no bundled fallback, which would print on every other company's document. */
export function Stamp({ company }) {
  if (!company.stamp) return <div className="doc-stamp-gap" />
  return <img className="doc-stamp" src={company.stamp} alt={`${company.name} stamp`} />
}

/** Label/value rows. Renders only what has a value, so a sparse profile does
 *  not produce a column of empty labels. */
export function MetaList({ rows, className = '' }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (!shown.length) return null
  return (
    <table className={`doc-meta ${className}`}>
      <tbody>
        {shown.map(([k, v, node]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{node || v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ItemsTable({ items, showUnit = false }) {
  return (
    <table className="doc-items">
      <thead>
        <tr>
          <th className="col-sr" scope="col">SR.<br />NO.</th>
          <th scope="col">Particular</th>
          {showUnit && <th className="col-unit" scope="col">UOM</th>}
          <th className="col-hsn" scope="col">HSN<br />NO.</th>
          <th className="col-qty" scope="col">QTY.</th>
          <th className="col-rate" scope="col">RATE</th>
          <th className="col-amt" scope="col">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.srNo}>
            <td className="doc-sr">{item.srNo}.</td>
            <td className="doc-particular">{item.description}</td>
            {showUnit && <td className="doc-num"></td>}
            <td className="doc-num">{item.hsn}</td>
            <td className="doc-num">{item.qty}</td>
            <td className="doc-num">{item.rate}</td>
            <td className="doc-num doc-amt">{item.amountFormatted}</td>
          </tr>
        ))}
        {!items.length && (
          <tr>
            <td colSpan={showUnit ? 7 : 6} className="doc-empty">No line items</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function TotalsPanel({ totals, rows, grandLabel }) {
  return (
    <table className="doc-totals">
      <tbody>
        {rows.map(([k, v, cls]) => (
          <tr key={k} className={cls}>
            <td className="doc-tot-label">{k}</td>
            <td className="doc-tot-value">{v}</td>
          </tr>
        ))}
        <tr className="doc-grand">
          <td className="doc-tot-label">{grandLabel}</td>
          <td className="doc-tot-value">{totals.grandTotalFormatted}</td>
        </tr>
      </tbody>
    </table>
  )
}

/** Company identity, GSTIN and bank details. Every row is conditional. */
export function CompanyPanel({ company }) {
  const rows = [
    company.gstin && ['GSTIN', company.gstin],
    company.msme && ['MSME', company.msme],
    company.bank && ['Bank', company.bank],
    company.branch && ['Branch', company.branch],
    company.accountNo && ['A/C No.', company.accountNo],
    company.ifsc && ['IFSC Code', company.ifsc],
    company.upiId && ['UPI ID', company.upiId],
    company.email && ['Email', company.email],
    company.website && ['Website', company.website],
    company.phone && ['Phone', company.phone],
  ].filter(Boolean)

  return (
    <div className="doc-company">
      <div className="doc-panel-head">Company &amp; Bank Details</div>
      <div className="doc-panel-body">
        <div className="doc-company-name">{company.name}</div>
        {company.address && <div className="doc-company-line">{company.address}</div>}
        {rows.length > 0 && (
          <table className="doc-company-table">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!rows.length && !company.address && (
          <div className="doc-muted">No company details recorded yet.</div>
        )}
      </div>
    </div>
  )
}

/** UPI QR. Invoices only - a quotation has nothing to pay yet. */
export function UpiBlock({ company, qrBase64, amountFormatted }) {
  if (!company.upiId || !qrBase64 || !(amountFormatted > 0)) return null
  return (
    <div className="doc-upi">
      <img src={`data:image/png;base64,${qrBase64}`} alt="Scan to pay" />
      <div>
        <div className="doc-panel-head">Scan &amp; Pay</div>
        <div className="doc-upi-id">{company.upiId}</div>
        <div className="doc-muted">{amountFormatted}</div>
      </div>
    </div>
  )
}

export function AmountWords({ label = 'Amount in words', text }) {
  return (
    <div className="doc-words">
      <strong>{label}:</strong> {text}
    </div>
  )
}

export function NotesPanel({ heading, notes }) {
  if (!notes) return null
  return (
    <div className="doc-panel doc-notes">
      <div className="doc-panel-head">{heading}</div>
      <div className="doc-panel-body doc-notes-body">{notes}</div>
    </div>
  )
}

/**
 * Signature block. `mode` picks the caption pair: an invoice is signed by the
 * company, a quotation is also countersigned by the client.
 */
export function SignaturePanel({ d, mode = 'signatory' }) {
  const c = d.company
  const captions = mode === 'acceptance'
    ? [d.signatureCaption, d.personCaption]
    : [d.signatureCaption, d.personCaption]
  return (
    <table className="doc-sign">
      <tbody>
        <tr>
          <td className="doc-sign-lines">
            {mode === 'acceptance' && <div className="doc-sign-for">Accepted by</div>}
            <div className="doc-sign-cap">{captions[0]}</div>
            <div className="doc-sign-rule" />
            <div className="doc-sign-cap">{captions[1]}</div>
            <div className="doc-sign-rule" />
          </td>
          <td className="doc-sign-box">
            <div className="doc-sign-for">
              <span className="doc-maroon">For</span> {c.name}
            </div>
            <Stamp company={c} />
            <div className="doc-sign-role">Authorized Signatory</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function FooterStrip({ company }) {
  const parts = [company.email, company.website, company.phone].filter(Boolean)
  // A profile with no contact details would otherwise print a bare blue
  // rectangle with nothing in it.
  if (!parts.length && !company.address) return null
  return (
    <div className="doc-footer">
      <div className="doc-footer-band" />
      {parts[0] && <div className="doc-footer-box">{parts[0]}</div>}
      {parts[1] && <div className="doc-footer-box">{parts[1]}</div>}
      <div className="doc-footer-box doc-footer-wide">
        {company.phone && <div>{company.phone}</div>}
        {company.address && <div className="doc-footer-addr">{company.address}</div>}
      </div>
    </div>
  )
}
