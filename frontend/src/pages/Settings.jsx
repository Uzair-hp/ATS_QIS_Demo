import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import ChangePasswordForm from '../components/ChangePasswordForm'
import ThemePreview from '../components/ThemePreview'
import { useToast } from '../context/ToastContext'
import { groupThemes, defaultFor, describeTheme, findTheme } from '../lib/pdfThemes'

const contactFields = [
  ['tagline', 'Tagline'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['website', 'Website'],
]

const taxFields = [
  ['gst_number', 'GST Number'],
  ['msme_number', 'MSME Number'],
]

// Company-wide default picker. '' is the "Reset to default" state, which the
// backend stores as NULL and resolves to the original template.
function CompanyDefaultSelect({ docType, id, label, value, onChange, themes }) {
  const fallback = defaultFor(themes, docType)
  const groups = groupThemes(themes, docType)
  const selected = value || ''

  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="form-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      >
        <option value="">Reset to default{fallback ? ` (${fallback})` : ''}</option>
        {groups.map((group) => (
          <optgroup key={group.category} label={group.category}>
            {group.items.map((item) => (
              <option key={item.key} value={item.key} title={item.description}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="form-text" id={`${id}-hint`}>
        {selected
          ? describeTheme(groups, selected)
          : 'No company default set. New documents use the original template.'}
      </div>
    </div>
  )
}

function CompanyField({ name, id, label, value, onChange }) {
  return (
    <div className="company-field">
      <label className="company-field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="form-control company-field-input"
        value={value ?? ''}
        onChange={onChange}
      />
    </div>
  )
}

const bankFields = [
  ['bank_name', 'Bank Name'], ['bank_account', 'Bank Account'],
  ['bank_ifsc', 'Bank IFSC'], ['bank_branch', 'Bank Branch'],
  ['upi_id', 'UPI ID'], ['upi_name', 'UPI Name'],
]

const tabs = [
  { key: 'company', label: 'Company', icon: 'bi-building' },
  { key: 'account', label: 'Account', icon: 'bi-person-gear' },
  { key: 'printing', label: 'Printing', icon: 'bi-printer' },
  { key: 'security', label: 'Security', icon: 'bi-shield-lock' },
]

const companySubTabs = [
  { key: 'profile', label: 'Profile', icon: 'bi-person-badge' },
  { key: 'bank', label: 'Bank Details', icon: 'bi-bank' },
]

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company')
  const [companySub, setCompanySub] = useState('profile')
  const [form, setForm] = useState({})
  const [confirmWipe, setConfirmWipe] = useState('')
  const [stampFile, setStampFile] = useState(null)
  const [removeStamp, setRemoveStamp] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [themes, setThemes] = useState({ invoices: [], quotations: [] })
  // '' is "no company default set", which the backend stores as NULL.
  const [themeForm, setThemeForm] = useState({ invoice_pdf_theme: '', quotation_pdf_theme: '' })
  const { push } = useToast()
  const fileRef = useRef()
  const logoRef = useRef()

  useEffect(() => {
    api.get('/settings/').then((res) => {
      setForm(res.data)
      setThemeForm({
        invoice_pdf_theme: res.data.invoice_pdf_theme || '',
        quotation_pdf_theme: res.data.quotation_pdf_theme || '',
      })
    })
    api.get('/settings/themes').then((res) => setThemes(res.data))
  }, [])

  const setFormVal = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const buildFormData = () => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v) })
    if (logoFile) fd.append('logo_image', logoFile)
    if (removeLogo) fd.append('remove_logo', '1')
    if (stampFile) fd.append('stamp_image', stampFile)
    if (removeStamp) fd.append('remove_stamp', '1')
    return fd
  }

  const saveCompany = async (e) => {
    e.preventDefault()
    // Both sub-tabs post to the same endpoint, so name the tab that was saved.
    const isBank = companySub === 'bank'
    try {
      await api.post('/settings/', buildFormData())
      push(isBank ? 'Bank details saved!' : 'Company settings saved!', 'success')
      setStampFile(null); setRemoveStamp(false)
      setLogoFile(null); setRemoveLogo(false)
      if (fileRef.current) fileRef.current.value = ''
      if (logoRef.current) logoRef.current.value = ''
    } catch { push('Failed to save settings.', 'danger') }
  }

  const saveThemes = async (e) => {
    e.preventDefault()
    try {
      await api.post('/settings/', themeForm)
      push('Printing settings saved!', 'success')
    } catch { push('Failed to save printing settings.', 'danger') }
  }

  const wipe = async () => {
    try {
      await api.post('/settings/wipe-data', { confirm_wipe: confirmWipe })
      push('All business data wiped.', 'success')
      setConfirmWipe('')
    } catch (err) { push(err.response?.data?.error || 'Failed.', 'danger') }
  }

  // Grouped catalogue, split per document type so the two key sets can never
  // be confused. The per-side lookups below resolve against these, not against
  // the raw payload.
  const invoiceGroups = groupThemes(themes, 'invoice')
  const quotationGroups = groupThemes(themes, 'quotation')
  const invoiceTheme = findTheme(invoiceGroups, themeForm.invoice_pdf_theme)
  const quotationTheme = findTheme(quotationGroups, themeForm.quotation_pdf_theme)

  return (
    <Layout
      title="Settings"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Settings</span>
        </>
      }
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Settings</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Configure company profile, account, PDF templates and security
          </p>
        </div>
      </div>

      <div className={`inf-card animate-in${activeTab === 'company' ? ' company-profile-card' : ''}`}>
        <div style={{ borderBottom: '1px solid var(--inf-border-light)' }}>
          <ul className="nav settings-tabs" role="tablist">
            {tabs.map((tab) => (
              <li key={tab.key} className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                >
                  <i className={`bi ${tab.icon} me-2`}></i>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4">
          {activeTab === 'company' && (
            <form onSubmit={saveCompany}>
              {/* Sub-page navigation */}
              <div className="settings-subtabs mb-4">
                {companySubTabs.map((sub) => (
                  <button
                    type="button"
                    key={sub.key}
                    className={`settings-subtab ${companySub === sub.key ? 'active' : ''}`}
                    onClick={() => setCompanySub(sub.key)}
                  >
                    <i className={`bi ${sub.icon} me-2`}></i>
                    {sub.label}
                  </button>
                ))}
              </div>

              {companySub === 'profile' && (
                <div className="company-profile">
                  {/* Identity block: one logo, one name field, no duplicate avatar */}
                  <div className="company-profile-identity">
                    <button
                      type="button"
                      className="company-logo-avatar"
                      onClick={() => logoRef.current?.click()}
                      aria-label="Change company logo"
                      title="Change company logo"
                    >
                      {form.logo_image && !removeLogo ? (
                        <img
                          src={`data:${form.logo_mime || 'image/png'};base64,${form.logo_image}`}
                          alt="Company logo"
                        />
                      ) : (
                        <span>{initialsOf(form.name)}</span>
                      )}
                      <span className="company-logo-caret" aria-hidden="true">
                        <i className="bi bi-camera"></i>
                      </span>
                    </button>

                    <div className="company-profile-identity-fields">
                      <label className="company-field-label" htmlFor="cp-name">Company Name</label>
                      <input
                        id="cp-name"
                        className="form-control company-field-input"
                        value={form.name ?? ''}
                        onChange={setFormVal('name')}
                      />
                      <div className="company-field-hint">
                        PNG, JPEG, SVG. Max 2 MB.
                        {logoFile && <span className="company-file-name"> · {logoFile.name}</span>}
                        {form.logo_image && !removeLogo && !logoFile && (
                          <>
                            {' · '}
                            <button
                              type="button"
                              className="company-inline-action"
                              onClick={() => setRemoveLogo(true)}
                            >
                              Remove logo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={logoRef}
                    className="company-file-input"
                    tabIndex={-1}
                    aria-hidden="true"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={(e) => { setLogoFile(e.target.files[0]); setRemoveLogo(false) }}
                  />

                  <section className="company-section">
                    <h6 className="company-section-title">Contact Details</h6>
                    <div className="company-grid">
                      {contactFields.map(([key, label]) => (
                        <CompanyField
                          key={key}
                          name={key}
                          id={`cp-${key}`}
                          label={label}
                          value={form[key]}
                          onChange={setFormVal(key)}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="company-section">
                    <h6 className="company-section-title">Business &amp; Tax Details</h6>
                    <div className="company-grid">
                      {taxFields.map(([key, label]) => (
                        <CompanyField
                          key={key}
                          name={key}
                          id={`cp-${key}`}
                          label={label}
                          value={form[key]}
                          onChange={setFormVal(key)}
                        />
                      ))}
                      <div className="company-field company-field-full">
                        <label className="company-field-label" htmlFor="cp-address">Address</label>
                        <textarea
                          id="cp-address"
                          className="form-control company-textarea"
                          rows="3"
                          value={form.address ?? ''}
                          onChange={setFormVal('address')}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="company-section">
                    <h6 className="company-section-title">Invoice Defaults</h6>
                    <div className="company-grid">
                      <div className="company-field">
                        <label className="company-field-label" htmlFor="cp-default_gst_percent">Default GST %</label>
                        <input
                          id="cp-default_gst_percent"
                          type="number"
                          className="form-control company-field-input"
                          value={form.default_gst_percent ?? ''}
                          onChange={setFormVal('default_gst_percent')}
                        />
                        <div className="company-field-hint">%</div>
                      </div>
                      <div className="company-field">
                        <label className="company-field-label" htmlFor="cp-default_due_days">Default Due Days</label>
                        <input
                          id="cp-default_due_days"
                          type="number"
                          className="form-control company-field-input"
                          value={form.default_due_days ?? ''}
                          onChange={setFormVal('default_due_days')}
                        />
                        <div className="company-field-hint">days</div>
                      </div>
                    </div>
                  </section>

                  <section className="company-section">
                    <h6 className="company-section-title">Stamp / Seal</h6>
                    <div className="company-stamp-row">
                      <div
                        className={`company-stamp-preview${form.stamp_image && !removeStamp ? ' has-image' : ''}`}
                        aria-hidden={!(form.stamp_image && !removeStamp)}
                      >
                        {form.stamp_image && !removeStamp ? (
                          <img
                            src={`data:${form.stamp_mime || 'image/png'};base64,${form.stamp_image}`}
                            alt="Current stamp"
                          />
                        ) : (
                          <i className="bi bi-file-earmark-image"></i>
                        )}
                      </div>

                      <div className="company-stamp-meta">
                        <button
                          type="button"
                          className="btn btn-inf-outline btn-sm"
                          onClick={() => fileRef.current?.click()}
                        >
                          <i className="bi bi-upload me-1"></i>Upload
                        </button>
                        {stampFile && <div className="company-file-name mt-2">{stampFile.name}</div>}
                        <div className="company-field-hint">PNG, JPEG, GIF, WebP or SVG. Max 2 MB.</div>
                        {form.stamp_image && !removeStamp && !stampFile && (
                          <button
                            type="button"
                            className="company-inline-action danger mt-2"
                            onClick={() => setRemoveStamp(true)}
                          >
                            Remove stamp
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={fileRef}
                      className="company-file-input"
                      tabIndex={-1}
                      aria-hidden="true"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      onChange={(e) => { setStampFile(e.target.files[0]); setRemoveStamp(false) }}
                    />
                  </section>

                  <div className="company-profile-footer">
                    <button className="btn btn-inf">
                      <i className="bi bi-check-lg me-1"></i>
                      Save Company Settings
                    </button>
                  </div>
                </div>
              )}

              {companySub === 'bank' && (
                <div className="company-profile">
                  <section className="company-section company-section-first">
                    <h6 className="company-section-title">
                      <i className="bi bi-bank me-2 text-primary"></i>
                      Bank &amp; Payment Details
                    </h6>
                    <div className="company-grid">
                      {bankFields.map(([key, label]) => (
                        <CompanyField
                          key={key}
                          name={key}
                          id={`cp-${key}`}
                          label={label}
                          value={form[key]}
                          onChange={setFormVal(key)}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="company-section">
                    <h6 className="company-section-title">
                      <i className="bi bi-file-text me-2 text-primary"></i>
                      Terms &amp; Conditions
                    </h6>
                    <div className="company-grid">
                      <div className="company-field company-field-full">
                        <label className="company-field-label" htmlFor="cp-default_terms">Default Invoice Terms</label>
                        <textarea
                          id="cp-default_terms"
                          className="form-control company-textarea"
                          rows="3"
                          value={form.default_terms ?? ''}
                          onChange={setFormVal('default_terms')}
                        />
                      </div>
                      <div className="company-field company-field-full">
                        <label className="company-field-label" htmlFor="cp-default_quotation_terms">Default Quotation Terms</label>
                        <textarea
                          id="cp-default_quotation_terms"
                          className="form-control company-textarea"
                          rows="3"
                          value={form.default_quotation_terms ?? ''}
                          onChange={setFormVal('default_quotation_terms')}
                        />
                      </div>
                    </div>
                  </section>

                  <div className="company-profile-footer">
                    <button className="btn btn-inf">
                      <i className="bi bi-check-lg me-1"></i>
                      Save Bank Details
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {activeTab === 'account' && (
            <div className="row g-3" style={{ maxWidth: 480 }}>
              <div className="col-12">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-person-gear me-2 text-primary"></i>
                  Account Settings
                </h6>
              </div>
              <div className="col-12">
                <ChangePasswordForm />
              </div>
              <div className="col-12">
                <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
                  Your name, email and photo are managed on the{' '}
                  <Link to="/profile">Profile Settings</Link> page.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'printing' && (
            <div className="row g-3" style={{ maxWidth: 720 }}>
              <div className="col-12">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-printer me-2 text-primary"></i>
                  Printing Settings
                </h6>
                <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
                  Server-generated PDFs use these templates. Browser print (Print / Save as PDF) is unaffected.
                </p>
              </div>

<div className="col-12">
                <CompanyDefaultSelect
                  docType="invoice"
                  id="company-default-invoice"
                  label="Default Invoice Template"
                  value={themeForm.invoice_pdf_theme}
                  onChange={(v) => setThemeForm({ ...themeForm, invoice_pdf_theme: v })}
                  themes={themes}
                />
                <ThemePreview doc="invoices" theme={invoiceTheme} />
              </div>

              <div className="col-12">
                <CompanyDefaultSelect
                  docType="quotation"
                  id="company-default-quotation"
                  label="Default Quotation Template"
                  value={themeForm.quotation_pdf_theme}
                  onChange={(v) => setThemeForm({ ...themeForm, quotation_pdf_theme: v })}
                  themes={themes}
                />
                <ThemePreview doc="quotations" theme={quotationTheme} />
              </div>

              <div className="col-12">
                <div className="alert alert-secondary border-0 mb-0" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-info-circle me-1"></i>
                  This only sets the default for documents that have no template of their own.
                  Invoices and quotations saved with their own template keep it.
                </div>
              </div>

              <div className="col-12">
                <button className="btn btn-inf" onClick={saveThemes}>
                  <i className="bi bi-check-lg me-1"></i>
                  Save Printing Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="row g-3" style={{ maxWidth: 480 }}>
              <div className="col-12">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-shield-lock me-2 text-primary"></i>
                  Change Password
                </h6>
              </div>
              <ChangePasswordForm />

              <div className="col-12">
                <hr className="my-4" />
              </div>

              <div className="col-12">
                <h6 className="fw-bold mb-3 text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Danger Zone
                </h6>
                <p className="text-muted mb-2" style={{ fontSize: '0.82rem' }}>
                  Type <strong>DELETE ALL DATA</strong> to wipe all clients, services, invoices and quotations.
                </p>
                <input className="form-control form-control-sm mb-2" value={confirmWipe} onChange={(e) => setConfirmWipe(e.target.value)} />
                <button className="btn btn-inf-danger btn-sm" onClick={wipe}>
                  <i className="bi bi-trash me-1"></i>
                  Wipe All Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
