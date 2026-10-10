import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import TemplateSelect from '../components/TemplateSelect'
import ThemePreview from '../components/ThemePreview'
import { groupThemes, defaultFor, findTheme } from '../lib/pdfThemes'
import { useToast } from '../context/ToastContext'

const blankItem = { name: '', description: '', hsn_code: '', quantity: 1, rate: 0 }

export default function InvoiceForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()

  const [meta, setMeta] = useState({ clients: [], services: [], company: {} })
  const [clientId, setClientId] = useState('')
  const [dueDays, setDueDays] = useState(15)
  const [paymentMode, setPaymentMode] = useState('')
  const [subject, setSubject] = useState('')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('flat')
  const [gstPercent, setGstPercent] = useState(18)
  const [advanceAmount, setAdvanceAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...blankItem }])
  const [error, setError] = useState('')
  // '' means "follow the company default", so a new invoice starts on whatever
  // Printing Settings says and the stored value stays NULL until one is picked.
  const [pdfTheme, setPdfTheme] = useState('')
  // The catalogue TemplateSelect already fetched, reused to show the preview of
  // whatever is selected without a second request.
  const [themes, setThemes] = useState(null)
  const selectedTheme = useMemo(
    () => findTheme(groupThemes(themes, 'invoice'), pdfTheme || defaultFor(themes, 'invoice')),
    [themes, pdfTheme])

  useEffect(() => {
    api.get('/invoices/meta').then((res) => {
      setMeta(res.data)
      if (!id) {
        setDueDays(res.data.company.default_due_days || 15)
        setGstPercent(res.data.company.default_gst_percent ?? 0)
        setNotes(res.data.company.default_terms || '')
        // A new document pre-selects the company default, but leaves it
        // unsaved so that changing the company default later still moves it.
        setPdfTheme(res.data.company.invoice_pdf_theme || '')
      }
    })
    if (id) {
      api.get(`/invoices/${id}`).then((res) => {
        const inv = res.data
        setClientId(String(inv.client_id))
        setPaymentMode(inv.payment_mode || '')
        setSubject(inv.subject || '')
        setVoucherNumber(inv.voucher_number || '')
        setPaymentTerms(inv.payment_terms || '')
        setDeliveryAddress(inv.delivery_address || '')
        setDiscount(inv.discount)
        setDiscountType(inv.discount_type)
        setGstPercent(inv.gst_percent || 0)
        setAdvanceAmount(inv.advance_amount || 0)
        setNotes(inv.notes || '')
        // Edit mode pre-selects the template saved on this invoice.
        setPdfTheme(inv.pdf_theme || '')
        if (inv.date_created && inv.due_date) {
          const d = Math.max(1, Math.round((new Date(inv.due_date) - new Date(inv.date_created)) / 86400000))
          setDueDays(d)
        }
        setItems(inv.items.map((it) => ({ name: it.service_name, description: it.description || '', hsn_code: it.hsn_code || '', quantity: it.quantity, rate: it.rate })))
      })
    }
  }, [id])

  const subTotal = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0),
    [items]
  )
  const discountAmount = discountType === 'percent' ? subTotal * (parseFloat(discount) || 0) / 100 : parseFloat(discount) || 0
  const net = Math.max(subTotal - discountAmount, 0)
  const gstAmount = net * (parseFloat(gstPercent) || 0) / 100
  const total = net + gstAmount
  const balance = Math.max(total - (parseFloat(advanceAmount) || 0), 0)

  const updateItem = (i, field, value) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: value }
    setItems(next)
  }

  const onServicePick = (i, name) => {
    const s = meta.services.find((x) => x.name === name)
    const next = [...items]
    next[i] = { ...next[i], name, ...(s ? { rate: s.base_price, hsn_code: s.hsn_code, description: s.description } : {}) }
    setItems(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      client_id: clientId, due_days: dueDays, payment_mode: paymentMode, subject,
      voucher_number: voucherNumber, payment_terms: paymentTerms, delivery_address: deliveryAddress,
      discount, discount_type: discountType, gst_percent: gstPercent, advance_amount: advanceAmount, notes,
      items, pdf_theme: pdfTheme,
    }
    try {
      let res
      if (id) res = await api.put(`/invoices/${id}`, payload)
      else res = await api.post('/invoices/', payload)
      push(id ? 'Invoice updated.' : 'Invoice created.', 'success')
      navigate(`/invoices/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save invoice.')
    }
  }

  return (
    <Layout title={id ? 'Edit Invoice' : 'Create Invoice'} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/invoices">Invoices</Link><span className="separator">/</span><span className="current">{id ? 'Edit' : 'Create'}</span></>}>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="inf-card mb-3"><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}><i className="bi bi-person-fill me-2"></i>Client &amp; Details</h6>
              <div className="row g-3">
                <div className="col-md-5"><label className="form-label">Client *</label>
                  <select className="form-select" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="">Select client...</option>
                    {meta.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3"><label className="form-label">Due in (days)</label><input type="number" className="form-control" min="1" value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></div>
                <div className="col-md-4"><label className="form-label">Payment Mode</label>
                  <select className="form-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option value="">Not specified</option><option>Cash</option><option>UPI</option><option>Bank</option>
                  </select>
                </div>
              </div>
            </div></div>

            <div className="inf-card mb-3"><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}><i className="bi bi-file-earmark-text me-2"></i>Invoice Details</h6>
              <div className="row g-3">
                <div className="col-md-6"><label className="form-label">Subject</label><input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. GARAGE DOOR" /></div>
                <div className="col-md-6"><label className="form-label">Voucher Number</label><input className="form-control" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label">Payment Terms</label><input className="form-control" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label">Delivery Address</label><input className="form-control" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div>
              </div>
            </div></div>

            <div className="inf-card mb-3"><div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-list-check me-2"></i>Line Items</h6>
                <button type="button" className="btn btn-inf btn-sm" onClick={() => setItems([...items, { ...blankItem }])}><i className="bi bi-plus-lg me-1"></i>Add Item</button>
              </div>
              {/* Column captions. The row below is 12 columns wide in total; before this
                  existed the only clue to each field was its placeholder, which
                  disappears as soon as you start typing. */}
              <div className="row g-2 mb-1">
                <div className="col-md-3 item-grid-head">Service</div>
                <div className="col-md-2 item-grid-head">HSN / SAC</div>
                <div className="col-md-1 item-grid-head">Qty</div>
                <div className="col-md-2 item-grid-head">Rate</div>
                <div className="col-md-2 item-grid-head">Description</div>
                <div className="col-md-1 item-grid-head text-end">Amount</div>
                <div className="col-md-1" aria-hidden="true"></div>
              </div>
              {items.map((it, i) => (
                <div className="row g-2 mb-2 align-items-start" key={i}>
                  <div className="col-md-3">
                    <input className="form-control form-control-sm" list="services-datalist" placeholder="Service" value={it.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      onBlur={(e) => onServicePick(i, e.target.value)} />
                  </div>
                  <div className="col-md-2"><input className="form-control form-control-sm" placeholder="HSN" value={it.hsn_code} onChange={(e) => updateItem(i, 'hsn_code', e.target.value)} /></div>
                  <div className="col-md-1"><input type="number" className="form-control form-control-sm" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></div>
                  <div className="col-md-2"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Rate" value={it.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} /></div>
                  <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Description" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} /></div>
                  <div className="col-md-1 text-end item-grid-amount">₹{((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div className="col-md-1 text-end">
                    <button type="button" className="btn btn-inf-outline btn-sm text-danger" onClick={() => setItems(items.filter((_, x) => x !== i))}><i className="bi bi-trash"></i></button>
                  </div>
                </div>
              ))}
              <datalist id="services-datalist">
                {meta.services.map((s) => <option key={s.id} value={s.name} />)}
              </datalist>
            </div></div>

            <div className="inf-card mb-3"><div className="card-body p-4">
              <h6 className="fw-bold mb-2" style={{ fontSize: '0.9rem' }}><i className="bi bi-card-text me-2"></i>Notes / Terms</h6>
              <textarea className="form-control" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div></div>

            <div className="inf-card"><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}><i className="bi bi-file-earmark-pdf me-2"></i>PDF Template</h6>
              <div className="row g-3">
                <div className="col-md-6"><TemplateSelect docType="invoice" id="pdf_theme" value={pdfTheme} onChange={setPdfTheme} onLoaded={setThemes} /></div>
                <div className="col-md-6">
                  <ThemePreview
                    doc="invoices"
                    theme={selectedTheme}
                    title="Sample preview"
                    paged
                    showEmpty
                  />
                </div>
              </div>
            </div></div>
          </div>

          <div className="col-lg-4">
            <div className="inf-card" style={{ position: 'sticky', top: 70 }}><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}>Invoice Summary</h6>
              <div className="d-flex justify-content-between mb-2 small"><span className="text-muted">Sub Total</span><span className="fw-semibold">₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="mb-2"><label className="form-label small">Discount</label>
                <div className="input-group input-group-sm">
                  <input type="number" className="form-control" value={discount} min="0" step="0.01" onChange={(e) => setDiscount(e.target.value)} />
                  <select className="form-select" style={{ maxWidth: 80 }} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                    <option value="flat">₹</option><option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div className="d-flex justify-content-between mb-1 small"><span className="text-muted">Discount</span><span className="fw-semibold" style={{ color: 'var(--inf-danger)' }}>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="d-flex justify-content-between mb-2"><span className="fw-bold">Net Amount</span><span className="fw-semibold">₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="mb-2"><label className="form-label small">GST %</label><input type="number" className="form-control form-control-sm" value={gstPercent} min="0" max="100" step="0.5" onChange={(e) => setGstPercent(e.target.value)} /></div>
              <div className="d-flex justify-content-between mb-2 small"><span className="text-muted">GST Amount</span><span className="fw-semibold">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between mb-2"><span className="fw-bold">Grand Total</span><span className="fw-bold" style={{ fontSize: '1.15rem', color: 'var(--inf-success)' }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="mb-2"><label className="form-label small">Advance Received (₹)</label><input type="number" className="form-control form-control-sm" value={advanceAmount} min="0" step="0.01" onChange={(e) => setAdvanceAmount(e.target.value)} /></div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between mb-4"><span className="fw-bold">Balance Due</span><span className="fw-bold" style={{ fontSize: '1.15rem', color: 'var(--inf-danger)' }}>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <button type="submit" className="btn btn-inf w-100"><i className="bi bi-check-circle me-1"></i>{id ? 'Update Invoice' : 'Generate Invoice'}</button>
            </div></div>
          </div>
        </div>
      </form>
    </Layout>
  )
}
