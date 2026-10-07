import { useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import QuotationPrint from './QuotationPrint'
import sampleQuotation from '../data/sampleQuotation'
import { parseQuotationJson, normaliseQuotation } from '../lib/quotation'

const ITEM_BLANK = { description: '', hsn: '', qty: 1, rate: 0 }

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

export default function QuotationForm() {
  const [quotation, setQuotation] = useState(() => normaliseQuotation(sampleQuotation))
  // react-to-print v3 prints whatever this ref points at
  const contentRef = useRef(null)
  const handlePrint = useReactToPrint({ contentRef })

  const [jsonText, setJsonText] = useState(() => JSON.stringify(sampleQuotation, null, 2))
  const [jsonStatus, setJsonStatus] = useState(null)

  const loadJson = () => {
    try {
      const next = parseQuotationJson(jsonText)
      setQuotation(next)
      setJsonStatus({ ok: true, text: `Loaded ${next.items.length} item(s).` })
    } catch (e) {
      setJsonStatus({ ok: false, text: e.message })
    }
  }

  const copyCurrent = async () => {
    const text = JSON.stringify(quotation, null, 2)
    setJsonText(text)
    try {
      await navigator.clipboard.writeText(text)
      setJsonStatus({ ok: true, text: 'Current quotation copied to clipboard.' })
    } catch {
      setJsonStatus({ ok: true, text: 'Current quotation put in the box below.' })
    }
  }

  const set = (path, value) =>
    setQuotation((q) => {
      const next = clone(q)
      const keys = path.split('.')
      let node = next
      while (keys.length > 1) node = node[keys.shift()]
      node[keys[0]] = value
      return next
    })

  const setItem = (index, key, value) =>
    setQuotation((q) => {
      const next = clone(q)
      next.items[index][key] = value
      return next
    })

  const addItem = () =>
    setQuotation((q) => ({ ...q, items: [...q.items, { ...ITEM_BLANK }] }))

  const removeItem = (index) =>
    setQuotation((q) => ({ ...q, items: q.items.filter((_, i) => i !== index) }))

  const reset = () => {
    setQuotation(clone(sampleQuotation))
    setJsonText(JSON.stringify(sampleQuotation, null, 2))
    setJsonStatus(null)
  }

  const c = quotation.company
  const cl = quotation.client

  return (
    <div className="app">
      <div className="app-bar no-print">
        <h1>ATS Quotation — print template</h1>
        <div className="app-bar-actions">
          <button type="button" className="btn" onClick={reset}>
            Reset to sample
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="app-grid">
        <section className="no-print app-form">
          <fieldset>
            <legend>Load a quotation as JSON</legend>
            <p className="hint">
              Paste a quotation object here to render it on the new sheet. Missing fields
              fall back to blanks, so a partial payload is fine. This box is a
              development convenience — it is the same seam that the
              <code> /api/quotations/:id </code> fetch will replace.
            </p>
            <textarea
              className="json-box"
              rows={10}
              spellCheck={false}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value)
                setJsonStatus(null)
              }}
            />
            <div className="json-actions">
              <button type="button" className="btn btn-primary" onClick={loadJson}>
                Load JSON
              </button>
              <button type="button" className="btn" onClick={copyCurrent}>
                Copy current as JSON
              </button>
            </div>
            {jsonStatus ? (
              <p className={jsonStatus.ok ? 'status status-ok' : 'status status-err'}>
                {jsonStatus.text}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>Document</legend>
            <Field label="Title" value={quotation.title} onChange={(v) => set('title', v)} />
            <Field label="Doc label" value={quotation.docLabel} onChange={(v) => set('docLabel', v)} />
            <Field label="Invoice no" value={quotation.invoiceNo} onChange={(v) => set('invoiceNo', v)} />
            <Field label="Date" type="date" value={quotation.date} onChange={(v) => set('date', v)} />
            <Field label="Voucher no" value={quotation.voucherNo} onChange={(v) => set('voucherNo', v)} />
            <Field
              label="Payment term"
              value={quotation.paymentTerm}
              onChange={(v) => set('paymentTerm', v)}
            />
            <Field label="Delivery" value={quotation.delivery} onChange={(v) => set('delivery', v)} />
            <Field
              label="GST %"
              type="number"
              value={quotation.gstPercent}
              onChange={(v) => set('gstPercent', Number(v))}
            />
          </fieldset>

          <fieldset>
            <legend>Client</legend>
            <Field label="Name" value={cl.name} onChange={(v) => set('client.name', v)} />
            <Field label="Address" value={cl.address} onChange={(v) => set('client.address', v)} />
            <Field label="Kind attn" value={cl.kindAttn} onChange={(v) => set('client.kindAttn', v)} />
            <Field label="GST No" value={cl.gstNo} onChange={(v) => set('client.gstNo', v)} />
          </fieldset>

          <fieldset>
            <legend>Items</legend>
            {quotation.items.map((item, i) => (
              <div className="item-row" key={i}>
                <div className="item-head">
                  <strong>Item {i + 1}</strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removeItem(i)}
                    disabled={quotation.items.length === 1}
                  >
                    Remove
                  </button>
                </div>
                <Field
                  label="Description"
                  value={item.description}
                  onChange={(v) => setItem(i, 'description', v)}
                />
                <Field label="HSN" value={item.hsn} onChange={(v) => setItem(i, 'hsn', v)} />
                <div className="field-pair">
                  <Field
                    label="Qty"
                    type="number"
                    value={item.qty}
                    onChange={(v) => setItem(i, 'qty', Number(v))}
                  />
                  <Field
                    label="Rate"
                    type="number"
                    value={item.rate}
                    onChange={(v) => setItem(i, 'rate', Number(v))}
                  />
                </div>
                <p className="amount-preview">
                  Amount <strong>{item.qty * item.rate}</strong>
                </p>
              </div>
            ))}
            <button type="button" className="btn" onClick={addItem}>
              + Add item
            </button>
          </fieldset>

          <fieldset>
            <legend>Company</legend>
            {[
              ['name', 'Name'],
              ['gstin', 'GSTIN'],
              ['bank', 'Bank'],
              ['branch', 'Branch'],
              ['accountNo', 'A/C No'],
              ['ifsc', 'IFSC'],
              ['msme', 'MSME'],
              ['email', 'Email'],
              ['website', 'Website'],
              ['phones', 'Phones'],
              ['address', 'Address'],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={c[key]}
                onChange={(v) => set(`company.${key}`, v)}
              />
            ))}
          </fieldset>
        </section>

        <section className="app-preview">
          <p className="preview-caption no-print">Live preview (A4, 210 mm)</p>
          <div ref={contentRef}>
            <QuotationPrint quotation={quotation} />
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}