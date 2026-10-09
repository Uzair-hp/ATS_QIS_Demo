import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import ChangePasswordForm from '../components/ChangePasswordForm'
import { useToast } from '../context/ToastContext'

const profileFields = [
  ['name', 'Company Name'],
  ['tagline', 'Tagline'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['gst_number', 'GST Number'],
  ['msme_number', 'MSME Number'],
  ['address', 'Address'],
  ['default_gst_percent', 'Default GST %'],
  ['default_due_days', 'Default Due Days'],
]

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
  const [themeForm, setThemeForm] = useState({ invoice_pdf_theme: 'classic_gst', quotation_pdf_theme: 'classic' })
  const { push } = useToast()
  const fileRef = useRef()
  const logoRef = useRef()

  useEffect(() => {
    api.get('/settings/').then((res) => {
      setForm(res.data)
      setThemeForm({
        invoice_pdf_theme: res.data.invoice_pdf_theme || 'classic_gst',
        quotation_pdf_theme: res.data.quotation_pdf_theme || 'classic',
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
    try {
      await api.post('/settings/', buildFormData())
      push('Company settings saved!', 'success')
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

  const invoiceTheme = themes.invoices?.find((t) => t.key === themeForm.invoice_pdf_theme)
  const quotationTheme = themes.quotations?.find((t) => t.key === themeForm.quotation_pdf_theme)

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

      <div className="inf-card animate-in">
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
                <div className="row g-3">
                  <div className="col-12">
                    <h6 className="fw-bold mb-3">
                      <i className="bi bi-person-badge me-2 text-primary"></i>
                      Company Profile
                    </h6>
                  </div>

                  {/* Logo upload box - compact left side */}
                  <div className="col-md-6">
                    <div className="profile-photo-block compact logo-paired">
                      <div className="profile-photo-avatar">
                        {form.logo_image && !removeLogo ? (
                          <img
                            src={`data:${form.logo_mime || 'image/png'};base64,${form.logo_image}`}
                            alt="Company logo"
                          />
                        ) : (
                          <span className="profile-photo-initials">{initialsOf(form.name)}</span>
                        )}
                      </div>
                      <div className="profile-photo-meta">
                        <label className="form-label mb-1">Company Logo</label>
                        <input
                          type="file"
                          ref={logoRef}
                          className="form-control form-control-sm"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                          onChange={(e) => { setLogoFile(e.target.files[0]); setRemoveLogo(false) }}
                        />
                        <div className="form-text mt-1">
                          PNG, JPEG, SVG. Max 2 MB.
                          {form.logo_image && !removeLogo && (
                            <>
                              {' · '}
                              <button type="button" className="btn btn-link btn-sm text-danger p-0 align-baseline" onClick={() => setRemoveLogo(true)}>
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {profileFields.map(([key, label]) => {
                    const isFullWidth = key === 'address'
                    return (
                      <div className={isFullWidth ? 'col-12' : 'col-md-6'} key={key}>
                        <label className="form-label">{label}</label>
                        {key === 'name' ? (
                          <div className="identity-row">
                            <div className="identity-avatar">
                              {form.logo_image && !removeLogo ? (
                                <img
                                  src={`data:${form.logo_mime || 'image/png'};base64,${form.logo_image}`}
                                  alt="Company logo"
                                />
                              ) : (
                                <span className="identity-initials">{initialsOf(form.name)}</span>
                              )}
                            </div>
                            <input className="form-control identity-input" value={form[key] ?? ''} onChange={setFormVal(key)} />
                          </div>
                        ) : key === 'address' ? (
                          <textarea className="form-control" rows="2" value={form[key] ?? ''} onChange={setFormVal(key)} />
                        ) : (
                          <input className="form-control" value={form[key] ?? ''} onChange={setFormVal(key)} />
                        )}
                      </div>
                    )
                  })}

                  <div className="col-12">
                    <label className="form-label">Stamp / Seal Image</label>
                    {form.stamp_image && !removeStamp && (
                      <div className="mb-2">
                        <img
                          src={`data:${form.stamp_mime || 'image/png'};base64,${form.stamp_image}`}
                          alt="Stamp"
                          style={{ maxHeight: 80 }}
                        />
                        <div>
                          <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => setRemoveStamp(true)}>Remove stamp</button>
                        </div>
                      </div>
                    )}
                    <input type="file" ref={fileRef} className="form-control" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(e) => { setStampFile(e.target.files[0]); setRemoveStamp(false) }} />
                    <div className="form-text">PNG, JPEG, GIF, WebP or SVG. Maximum 2 MB.</div>
                  </div>

                  <div className="col-12">
                    <button className="btn btn-inf">
                      <i className="bi bi-check-lg me-1"></i>
                      Save Company Settings
                    </button>
                  </div>
                </div>
              )}

              {companySub === 'bank' && (
                <div className="row g-3" style={{ maxWidth: 720 }}>
                  <div className="col-12">
                    <h6 className="fw-bold mb-3">
                      <i className="bi bi-bank me-2 text-primary"></i>
                      Bank &amp; Payment Details
                    </h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
                      These details appear on invoices and quotations.
                    </p>
                  </div>

                  {bankFields.map(([key, label]) => (
                    <div className="col-md-6" key={key}>
                      <label className="form-label">{label}</label>
                      <input className="form-control" value={form[key] ?? ''} onChange={setFormVal(key)} />
                    </div>
                  ))}

                  <div className="col-12">
                    <hr className="my-3" />
                    <h6 className="fw-bold mb-3">
                      <i className="bi bi-file-text me-2 text-primary"></i>
                      Terms &amp; Conditions
                    </h6>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Default Invoice Terms</label>
                    <textarea className="form-control" rows="2" value={form.default_terms ?? ''} onChange={setFormVal('default_terms')} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Default Quotation Terms</label>
                    <textarea className="form-control" rows="2" value={form.default_quotation_terms ?? ''} onChange={setFormVal('default_quotation_terms')} />
                  </div>

                  <div className="col-12">
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
            <form onSubmit={saveThemes} className="row g-3" style={{ maxWidth: 720 }}>
              <div className="col-12">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-printer me-2 text-primary"></i>
                  PDF Template Selection
                </h6>
                <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
                  Server-generated PDFs use these templates. Browser print (Print / Save as PDF) is unaffected.
                </p>
              </div>

              <div className="col-md-6 mt-2">
                <label className="form-label">Invoice Template</label>
                <select className="form-select" value={themeForm.invoice_pdf_theme} onChange={(e) => setThemeForm({ ...themeForm, invoice_pdf_theme: e.target.value })}>
                  {themes.invoices?.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                {invoiceTheme && (
                  <div className="form-text mt-1">{invoiceTheme.description}</div>
                )}
              </div>

              <div className="col-md-6 mt-2">
                <label className="form-label">Quotation Template</label>
                <select className="form-select" value={themeForm.quotation_pdf_theme} onChange={(e) => setThemeForm({ ...themeForm, quotation_pdf_theme: e.target.value })}>
                  {themes.quotations?.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                {quotationTheme && (
                  <div className="form-text mt-1">{quotationTheme.description}</div>
                )}
              </div>

              <div className="col-12 mt-2">
                <button className="btn btn-inf">
                  <i className="bi bi-check-lg me-1"></i>
                  Save Printing Settings
                </button>
              </div>
            </form>
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
