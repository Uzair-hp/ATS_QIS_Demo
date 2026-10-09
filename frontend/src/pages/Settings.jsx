import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const fields = [
  ['name', 'Company Name'], ['tagline', 'Tagline'], ['email', 'Email'], ['phone', 'Phone'],
  ['website', 'Website'], ['address', 'Address'], ['upi_id', 'UPI ID'], ['upi_name', 'UPI Name'],
  ['bank_name', 'Bank Name'], ['bank_account', 'Bank Account'], ['bank_ifsc', 'Bank IFSC'],
  ['bank_branch', 'Bank Branch'], ['gst_number', 'GST Number'], ['msme_number', 'MSME Number'],
  ['default_gst_percent', 'Default GST %'], ['default_due_days', 'Default Due Days'],
]

export default function Settings() {
  const [form, setForm] = useState({})
  const [pwd, setPwd] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [confirmWipe, setConfirmWipe] = useState('')
  const [stampFile, setStampFile] = useState(null)
  const [removeStamp, setRemoveStamp] = useState(false)
  const { push } = useToast()
  const fileRef = useRef()

  useEffect(() => {
    api.get('/settings/').then((res) => setForm(res.data))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v) })
    if (stampFile) fd.append('stamp_image', stampFile)
    if (removeStamp) fd.append('remove_stamp', '1')
    try {
      // No Content-Type header: the central api client drops it for FormData
      // so the browser can add the multipart boundary itself.
      await api.post('/settings/', fd)
      push('Company settings saved!', 'success')
      setStampFile(null); setRemoveStamp(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch { push('Failed to save settings.', 'danger') }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    try {
      await api.post('/settings/change_password', pwd)
      push('Password changed successfully!', 'success')
      setPwd({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) { push(err.response?.data?.error || 'Failed.', 'danger') }
  }

  const wipe = async () => {
    try {
      await api.post('/settings/wipe-data', { confirm_wipe: confirmWipe })
      push('All business data wiped.', 'success')
      setConfirmWipe('')
    } catch (err) { push(err.response?.data?.error || 'Failed.', 'danger') }
  }

  return (
    <Layout title="Settings" breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><span className="current">Settings</span></>}>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="inf-card mb-3"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Company Profile</h6>
            <form onSubmit={save} className="row g-3">
              {fields.map(([key, label]) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-control" value={form[key] ?? ''} onChange={set(key)} />
                </div>
              ))}
              <div className="col-12">
                <label className="form-label">Default Invoice Terms</label>
                <textarea className="form-control" rows="2" value={form.default_terms ?? ''} onChange={set('default_terms')} />
              </div>
              <div className="col-12">
                <label className="form-label">Default Quotation Terms</label>
                <textarea className="form-control" rows="2" value={form.default_quotation_terms ?? ''} onChange={set('default_quotation_terms')} />
              </div>
              <div className="col-12">
                <label className="form-label">Stamp / Seal Image</label>
                {form.stamp_image && !removeStamp && (
                  <div className="mb-2">
                    {/* The MIME type is sniffed server-side from the upload's
                        magic bytes and stored alongside the blob; a saved JPEG
                        stamp would not render under a hardcoded image/png. */}
                    <img
                      src={`data:${form.stamp_mime || 'image/png'};base64,${form.stamp_image}`}
                      alt="Stamp"
                      style={{ maxHeight: 80 }}
                    />
                    <div><button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => setRemoveStamp(true)}>Remove stamp</button></div>
                  </div>
                )}
                <input type="file" ref={fileRef} className="form-control" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(e) => { setStampFile(e.target.files[0]); setRemoveStamp(false) }} />
                <div className="form-text">PNG, JPEG, GIF, WebP or SVG. Maximum 2 MB.</div>
              </div>
              <div className="col-12"><button className="btn btn-inf">Save Settings</button></div>
            </form>
          </div></div>
        </div>

        <div className="col-lg-4">
          <div className="inf-card mb-3"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Change Password</h6>
            <form onSubmit={changePassword}>
              <label className="form-label small">Current Password</label>
              <input type="password" className="form-control form-control-sm mb-2" value={pwd.old_password} onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} required />
              <label className="form-label small">New Password</label>
              <input type="password" className="form-control form-control-sm mb-2" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} required />
              <label className="form-label small">Confirm New Password</label>
              <input type="password" className="form-control form-control-sm mb-3" value={pwd.confirm_password} onChange={(e) => setPwd({ ...pwd, confirm_password: e.target.value })} required />
              <button className="btn btn-inf btn-sm w-100">Update Password</button>
            </form>
          </div></div>

          <div className="inf-card"><div className="card-body p-4">
            <h6 className="fw-bold mb-3 text-danger">Danger Zone</h6>
            <p className="small text-muted">Type <strong>DELETE ALL DATA</strong> to wipe all clients, services, invoices and quotations.</p>
            <input className="form-control form-control-sm mb-2" value={confirmWipe} onChange={(e) => setConfirmWipe(e.target.value)} />
            <button className="btn btn-danger-solid btn-sm w-100" onClick={wipe}>Wipe All Data</button>
          </div></div>
        </div>
      </div>
    </Layout>
  )
}
