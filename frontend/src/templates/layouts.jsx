// The five layout archetypes a template key resolves to.
//
// Structure lives here; colour lives in print.css, keyed off the sheet's
// `data-template` attribute. A template is therefore (archetype, palette) -
// which is why ten templates can share these five components without becoming
// ten copies of the same markup, and why a layout fix lands in one place.
//
// Every archetype renders the same field set from the same `d` object, so
// changing template never changes what a document says, only how it looks.

import {
  AmountWords,
  CompanyMark,
  CompanyPanel,
  FooterStrip,
  ItemsTable,
  MetaList,
  NotesPanel,
  Sheet,
  SignaturePanel,
  TotalsPanel,
  UpiBlock,
} from './parts.jsx'

/** The rows that make up the totals block. Shared so no archetype can omit
 *  one by accident - the retirement of the old sheet is what stopped that. */
function totalsRows(d) {
  const t = d.totals
  const rows = [['SUBTOTAL', t.subtotalFormatted]]
  if (t.hasDiscount) {
    const pct = t.discountType === 'percent' ? ` (${t.discountPercent}%)` : ''
    rows.push([`DISCOUNT${pct}`, `- ${t.discountFormatted}`])
    rows.push(['NET', t.netFormatted])
  }
  if (t.gstPercent > 0) rows.push([`GST @ ${t.gstPercent}%`, t.gstFormatted])
  if (t.hasAdvance) {
    rows.push(['Advance Received', t.advanceFormatted])
    rows.push(['Balance Due', t.balanceFormatted])
  }
  return rows
}

function metaRows(d) {
  const rows = [
    [`${d.docLabel.replace(/:-$/, '')}`, d.number],
    ['Date', formatShort(d.date)],
    d.dueDate && ['Due Date', formatShort(d.dueDate)],
    d.validUntil && ['Valid Until', formatShort(d.validUntil)],
    d.voucherNo && ['Voucher No', d.voucherNo],
    d.paymentTerm && ['Payment Term', d.paymentTerm],
    d.timeline && ['Est. Timeline', d.timeline],
    d.delivery && ['Delivery', d.delivery],
    d.refQuotation && ['Ref. Quotation', d.refQuotation],
    d.client.gstNo && ['Client GSTIN', d.client.gstNo],
    d.status && ['Status', d.status],
  ]
  return rows.filter(Boolean)
}

function formatShort(value) {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value)
}

function PartyCard({ d, heading }) {
  const client = d.client || {}
  return (
    <div className="doc-panel doc-party">
      <div className="doc-panel-head">{heading}</div>
      <div className="doc-panel-body">
        <div className="doc-party-name">{client.name}</div>
        {client.kindAttn && client.kindAttn !== client.name && (
          <div className="doc-party-line">Attn: {client.kindAttn}</div>
        )}
        {client.address && <div className="doc-party-line">{client.address}</div>
        }
        {client.phone && <div className="doc-party-line">Ph: {client.phone}</div>}
        {client.email && <div className="doc-party-line">{client.email}</div>}
        {!client.name && <div className="doc-muted">No client selected.</div>}
      </div>
    </div>
  )
}

// ── classic: boxed tables under an ATS navy band. The company standard. ──
function ClassicLayout({ d }) {
  return (
    <Sheet template="classic">
      <header className="doc-header doc-band">
        <div className="doc-header-left">
          <CompanyMark company={d.company} />
          <div className="doc-tagline">{d.company.tagline}</div>
        </div>
        <div className="doc-header-right">
          <div className="doc-heading">{d.docHeading}</div>
          {d.number && <div className="doc-number">{d.number}</div>}
          {d.company.gstin && <div className="doc-gstin">GSTIN: {d.company.gstin}</div>}
        </div>
      </header>

      {d.subject && <div className="doc-subject-bar">Subject: {d.subject}</div>}

      <div className="doc-cols">
        <PartyCard d={d} heading={d.counterpartLine} />
        <div className="doc-panel">
          <div className="doc-panel-head">Details</div>
          <div className="doc-panel-body">
            <MetaList rows={metaRows(d)} />
          </div>
        </div>
      </div>

      <ItemsTable items={d.items} />

      <div className="doc-cols doc-cols-tight">
        <div className="doc-stack">
          <CompanyPanel company={d.company} />
          <UpiBlock company={d.company} qrBase64={d.qrBase64} amountFormatted={d.totals.balanceFormatted} />
          <AmountWords text={d.amountWords} />
        </div>
        <TotalsPanel totals={d.totals} rows={totalsRows(d)} grandLabel={d.grandLabel} />
      </div>

      <NotesPanel heading={d.notesHeading} notes={d.notes} />
      <SignaturePanel d={d} mode={d.isInvoice ? 'signatory' : 'acceptance'} />
      <FooterStrip company={d.company} />
    </Sheet>
  )
}

// ── hero: a subject-led hero panel above two cards. Pitch / proposal feel. ──
function HeroLayout({ d }) {
  return (
    <Sheet template="hero">
      <header className="doc-header doc-hero">
        <CompanyMark company={d.company} variant="onband" />
        <div className="doc-hero-body">
          <div className="doc-heading">{d.docHeading}</div>
          {/* `title` falls back to the document name, so printing it when there
              is no subject just repeats the heading. */}
          {d.subject && <div className="doc-hero-title">{d.title}</div>}
          <div className="doc-hero-meta">
            {d.number} · {formatShort(d.date)}
            {d.dueDate ? ` · Due ${formatShort(d.dueDate)}` : ''}
            {d.validUntil ? ` · Valid till ${formatShort(d.validUntil)}` : ''}
          </div>
        </div>
      </header>

      <div className="doc-cols">
        <PartyCard d={d} heading={d.counterpartLine} />
        <div className="doc-panel">
          <div className="doc-panel-head">Details</div>
          <div className="doc-panel-body">
            <MetaList rows={metaRows(d)} />
          </div>
        </div>
      </div>

      <ItemsTable items={d.items} />

      <div className="doc-cols doc-cols-tight">
        <div className="doc-stack">
          <CompanyPanel company={d.company} />
          <UpiBlock company={d.company} qrBase64={d.qrBase64} amountFormatted={d.totals.balanceFormatted} />
          <AmountWords text={d.amountWords} />
        </div>
        <TotalsPanel totals={d.totals} rows={totalsRows(d)} grandLabel={d.grandLabel} />
      </div>

      <NotesPanel heading={d.notesHeading} notes={d.notes} />
      <SignaturePanel d={d} mode={d.isInvoice ? 'signatory' : 'acceptance'} />
      <FooterStrip company={d.company} />
    </Sheet>
  )
}

// ── minimal: no boxes, hairline rules, generous whitespace. ──
function MinimalLayout({ d }) {
  return (
    <Sheet template="minimal">
      <header className="doc-header doc-minimal">
        <CompanyMark company={d.company} variant="bare" />
        <div className="doc-minimal-meta">
          <h1 className="doc-heading">{d.docHeading}</h1>
          {d.number && <div className="doc-number">{d.number}</div>}
          <div className="doc-muted">{formatShort(d.date)}</div>
        </div>
      </header>

      {d.subject && <div className="doc-subject-plain">{d.subject}</div>}

      <div className="doc-minimal-parties">
        <div>
          <div className="doc-label">{d.counterpartLine}</div>
          <div className="doc-party-name">{d.client.name}</div>
          {d.client.kindAttn && d.client.kindAttn !== d.client.name && (
            <div className="doc-muted">Attn: {d.client.kindAttn}</div>
          )}
          {d.client.address && <div className="doc-muted">{d.client.address}</div>}
          {d.client.gstNo && <div className="doc-muted">GSTIN: {d.client.gstNo}</div>}
        </div>
        <MetaList rows={metaRows(d).filter(([k]) => k !== `${d.docLabel.replace(/:-$/, '')}`)} />
      </div>

      <ItemsTable items={d.items} />

      <div className="doc-cols doc-cols-tight">
        <div className="doc-stack">
          <CompanyPanel company={d.company} />
          <UpiBlock company={d.company} qrBase64={d.qrBase64} amountFormatted={d.totals.balanceFormatted} />
          <AmountWords text={d.amountWords} />
        </div>
        <TotalsPanel totals={d.totals} rows={totalsRows(d)} grandLabel={d.grandLabel} />
      </div>

      <NotesPanel heading={d.notesHeading} notes={d.notes} />
      <SignaturePanel d={d} mode={d.isInvoice ? 'signatory' : 'acceptance'} />
      <FooterStrip company={d.company} />
    </Sheet>
  )
}

// ── compact: small type, tight leading, for long item lists. ──
function CompactLayout({ d }) {
  return (
    <Sheet template="compact">
      <header className="doc-header doc-compact-head">
        <CompanyMark company={d.company} variant="bare" />
        <div className="doc-compact-title">
          <span className="doc-heading">{d.docHeading}</span>
          {d.number && <span className="doc-number"> · {d.number}</span>}
        </div>
      </header>

      <div className="doc-compact-meta">
        <MetaList rows={metaRows(d)} className="doc-meta-inline" />
      </div>

      {d.subject && <div className="doc-subject-plain">{d.subject}</div>}

      <div className="doc-compact-parties">
        <PartyCard d={d} heading={d.counterpartLine} />
      </div>

      <ItemsTable items={d.items} />

      <div className="doc-cols doc-cols-tight">
        <div className="doc-stack">
          <CompanyPanel company={d.company} />
          <UpiBlock company={d.company} qrBase64={d.qrBase64} amountFormatted={d.totals.balanceFormatted} />
          <AmountWords text={d.amountWords} />
        </div>
        <TotalsPanel totals={d.totals} rows={totalsRows(d)} grandLabel={d.grandLabel} />
      </div>

      <NotesPanel heading={d.notesHeading} notes={d.notes} />
      <SignaturePanel d={d} mode={d.isInvoice ? 'signatory' : 'acceptance'} />
      <FooterStrip company={d.company} />
    </Sheet>
  )
}

// ── letterhead: a full-bleed blue band with the logo on it. ──
function LetterheadLayout({ d }) {
  return (
    <Sheet template="letterhead">
      <header className="doc-header doc-fullband">
        <CompanyMark company={d.company} variant="onband" />        <div className="doc-fullband-meta">
          <div className="doc-heading">{d.docHeading}</div>
          {d.company.gstin && <div className="doc-onband-muted">GSTIN: {d.company.gstin}</div>}
          {d.number && <div className="doc-onband-number">{d.number}</div>}
        </div>
      </header>

      {d.subject && <div className="doc-subject-bar">{d.subject}</div>}

      <div className="doc-cols">
        <PartyCard d={d} heading={d.counterpartLine} />
        <div className="doc-panel">
          <div className="doc-panel-head">Details</div>
          <div className="doc-panel-body">
            <MetaList rows={metaRows(d)} />
          </div>
        </div>
      </div>

      <ItemsTable items={d.items} />

      <div className="doc-cols doc-cols-tight">
        <div className="doc-stack">
          <CompanyPanel company={d.company} />
          <UpiBlock company={d.company} qrBase64={d.qrBase64} amountFormatted={d.totals.balanceFormatted} />
          <AmountWords text={d.amountWords} />
        </div>
        <TotalsPanel totals={d.totals} rows={totalsRows(d)} grandLabel={d.grandLabel} />
      </div>

      <NotesPanel heading={d.notesHeading} notes={d.notes} />
      <SignaturePanel d={d} mode={d.isInvoice ? 'signatory' : 'acceptance'} />
      <FooterStrip company={d.company} />
    </Sheet>
  )
}

export const ARCHETYPES = {
  classic: ClassicLayout,
  hero: HeroLayout,
  minimal: MinimalLayout,
  compact: CompactLayout,
  letterhead: LetterheadLayout,
}
