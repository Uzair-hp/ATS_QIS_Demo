import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import TemplateSelect from '../components/TemplateSelect'
import { useToast } from '../context/ToastContext'

const blankItem = { name: '', description: '', hsn_code: '', quantity: 1, rate: 0 }

export default function QuotationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()

  const [meta, setMeta] = useState({ clients: [], services: [], company: {} })
  const [clientId, setClientId] = useState('')
  const [validDays, setValidDays] = useState(15)
  const [estimatedTimeline, setEstimatedTimeline] = useState('')
  const [subject, setSubject] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('flat')
  const [gstPercent, setGstPercent] = useState(18)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...blankItem }])
  const [error, setError] = useState('')
  // '' means "follow the company default"; see InvoiceForm for the reasoning.
  const [pdfTheme, setPdfTheme] = useState('')

  useEffect(() => {
    api.get('/quotations/meta').then((res) => {
      setMeta(res.data)
      if (!id) {
        setGstPercent(res.data.company.default_gst_percent ?? 0)
        setNotes(res.data.company.default_quotation_terms || '')
        // A new quotation pre-selects the company default without saving it.
        setPdfTheme(res.data.company.quotation_pdf_theme || '')
      }
    })
    if (id) {
      api.get(`/quotations/${id}`).then((res) => {
        const q = res.data
        setClientId(String(q.client_id))
        setEstimatedTimeline(q.estimated_timeline || '')
        setSubject(q.subject || '')
        setPaymentTerms(q.payment_terms || '')
        setDeliveryAddress(q.delivery_address || '')
        setDiscount(q.discount)
        setDiscountType(q.discount_type)
        setGstPercent(q.gst_percent || 0)
        setNotes(q.notes || '')
        // Edit mode pre-selects the template saved on this quotation.
        setPdfTheme(q.pdf_theme || '')
        if (q.date_created && q.valid_until) {
          setValidDays(Math.max(1, Math.round((new Date(q.valid_until) - new Date(q.date_created)) / 86400000)))
        }
        setItems(q.items.map((it) => ({ name: it.service_name, description: it.description || '', hsn_code: it.hsn_code || '', quantity: it.quantity, rate: it.rate })))
      })
    }
  }, [id])

  const subTotal = useMemo(() => items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0), [items])
  const discountAmount = discountType === 'percent' ? subTotal * (parseFloat(discount) || 0) / 100 : parseFloat(discount) || 0
  const net = Math.max(subTotal - discountAmount, 0)
  const gstAmount = net * (parseFloat(gstPercent) || 0) / 100
  const total = net + gstAmount

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
      client_id: clientId, valid_days: validDays, estimated_timeline: estimatedTimeline,
      subject, payment_terms: paymentTerms, delivery_address: deliveryAddress,
      discount, discount_type: discountType, gst_percent: gstPercent, notes, items,
      pdf_theme: pdfTheme,
    }
    try {
      let res
      if (id) res = await api.put(`/quotations/${id}`, payload)
      else res = await api.post('/quotations/', payload)
      push(id ? 'Quotation updated.' : 'Quotation created.', 'success')
      navigate(`/quotations/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quotation.')
    }
  }

  return (
    <Layout title={id ? 'Edit Quotation' : 'Create Quotation'} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/quotations">Quotations</Link><span className="separator">/</span><span className="current">{id ? 'Edit' : 'Create'}</span></>}>
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
                <div className="col-md-3"><label className="form-label">Valid (days)</label><input type="number" className="form-control" min="1" value={validDays} onChange={(e) => setValidDays(e.target.value)} /></div>
                <div className="col-md-4"><label className="form-label">Est. Timeline</label><input className="form-control" value={estimatedTimeline} onChange={(e) => setEstimatedTimeline(e.target.value)} placeholder="e.g. 2 weeks" /></div>
              </div>
            </div></div>

            <div className="inf-card mb-3"><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}><i className="bi bi-file-earmark-text me-2"></i>Quotation Details</h6>
              <div className="row g-3">
                <div className="col-md-6"><label className="form-label">Subject</label><input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label">Payment Terms</label><input className="form-control" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                <div className="col-md-12"><label className="form-label">Delivery Address</label><input className="form-control" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div>
                <div className="col-md-6"><TemplateSelect docType="quotation" id="pdf_theme" value={pdfTheme} onChange={setPdfTheme} /></div>
              </div>
            </div></div>

            <div className="inf-card mb-3"><div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-list-check me-2"></i>Line Items</h6>
                <button type="button" className="btn btn-inf btn-sm" onClick={() => setItems([...items, { ...blankItem }])}><i className="bi bi-plus-lg me-1"></i>Add Item</button>
              </div>
              {/* Column captions, matching InvoiceForm. Placeholders vanish once you type,
                  so they cannot be the only label. 3+2+1+2+3+1 = 12 exactly. */}
              <div className="row g-2 mb-1">
                <div className="col-md-3 item-grid-head">Service</div>
                <div className="col-md-2 item-grid-head">HSN / SAC</div>
                <div className="col-md-1 item-grid-head">Qty</div>
                <div className="col-md-2 item-grid-head">Rate</div>
                <div className="col-md-3 item-grid-head">Description</div>
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
                  <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Description" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} /></div>
                  <div className="col-md-1 text-end"><button type="button" className="btn btn-inf-outline btn-sm text-danger" onClick={() => setItems(items.filter((_, x) => x !== i))}><i className="bi bi-trash"></i></button></div>
                </div>
              ))}
              <datalist id="services-datalist">
                {meta.services.map((s) => <option key={s.id} value={s.name} />)}
              </datalist>
            </div></div>

            <div className="inf-card"><div className="card-body p-4">
              <h6 className="fw-bold mb-2" style={{ fontSize: '0.9rem' }}><i className="bi bi-card-text me-2"></i>Notes</h6>
              <textarea className="form-control" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div></div>
          </div>

          <div className="col-lg-4">
            <div className="inf-card" style={{ position: 'sticky', top: 70 }}><div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem' }}>Quotation Summary</h6>
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
              <div className="d-flex justify-content-between mb-2"><span className="fw-bold">Net</span><span className="fw-semibold">₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="mb-2"><label className="form-label small">GST %</label><input type="number" className="form-control form-control-sm" value={gstPercent} min="0" max="100" step="0.5" onChange={(e) => setGstPercent(e.target.value)} /></div>
              <div className="d-flex justify-content-between mb-2 small"><span className="text-muted">GST</span><span className="fw-semibold">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between mb-4"><span className="fw-bold">Grand Total</span><span className="fw-bold" style={{ fontSize: '1.15rem', color: 'var(--inf-success)' }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <button type="submit" className="btn btn-inf w-100"><i className="bi bi-check-circle me-1"></i>{id ? 'Update Quotation' : 'Create Quotation'}</button>
            </div></div>
          </div>
        </div>
      </form>
    </Layout>
  )
}
