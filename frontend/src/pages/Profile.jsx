import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import ChangePasswordForm from '../components/ChangePasswordForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { displayName, initialsOf, isProfileDirty, validateProfile } from '../lib/user'

const EMPTY_FORM = { full_name: '', email: '', phone: '', username: '' }

export default function Profile() {
  const { user, refresh } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saved, setSaved] = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const photoRef = useRef(null)

  useEffect(() => {
    let active = true
    api.get('/auth/profile')
      .then((res) => {
        if (!active) return
        const next = {
          full_name: res.data.user.full_name || '',
          email: res.data.user.email || '',
          phone: res.data.user.phone || '',
          username: res.data.user.username || '',
        }
        setForm(next)
        setSaved(next)
      })
      .catch(() => { if (active) setLoadError('Could not load your profile.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const setVal = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const dirty = isProfileDirty(form, saved) || photo !== null || removePhoto

  // Guard against losing edits by navigating away inside the SPA.
  useEffect(() => {
    if (!dirty || loading) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, loading])

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    setForm(saved || EMPTY_FORM)
    setErrors({})
    setPhoto(null)
    setRemovePhoto(false)
    if (photoRef.current) photoRef.current.value = ''
  }

  const save = async (e) => {
    e.preventDefault()
    const found = validateProfile(form)
    if (Object.keys(found).length) {
      setErrors(found)
      push('Please correct the highlighted fields.', 'danger')
      document.getElementById(`profile-${Object.keys(found)[0]}`)?.focus()
      return
    }
    if (photo && photo.size > MAX_PHOTO_BYTES) {
      setErrors({ avatar: `Photo is too large. Maximum is ${Math.round(MAX_PHOTO_BYTES / 1024)} KB.` })
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v.trim()))
      if (photo) fd.append('avatar', photo)
      if (removePhoto) fd.append('remove_avatar', '1')

      const res = await api.post('/auth/profile', fd)
      const next = {
        full_name: res.data.user.full_name || '',
        email: res.data.user.email || '',
        phone: res.data.user.phone || '',
        username: res.data.user.username || '',
      }
      setForm(next)
      setSaved(next)
      setPhoto(null)
      setRemovePhoto(false)
      if (photoRef.current) photoRef.current.value = ''
      // Repaint the sidebar menu without re-authenticating.
      await refresh()
      push('Profile updated.', 'success')
    } catch (err) {
      const body = err.response?.data
      setErrors(body?.fields || {})
      push(body?.error || 'Failed to save your profile.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const name = displayName(user)
  const initials = initialsOf(name, (user?.username || 'U').slice(0, 2).toUpperCase())
  const preview = photo
    ? URL.createObjectURL(photo)
    : user?.avatar_image
      ? `data:${user.avatar_mime || 'image/png'};base64,${user.avatar_image}`
      : null

  const field = (key, label, type = 'text', hint = '') => {
    const id = `profile-${key}`
    return (
      <div>
        <label className="form-label" htmlFor={id}>{label}</label>
        <input
          id={id}
          type={type}
          className={`form-control${errors[key] ? ' is-invalid' : ''}`}
          value={form[key]}
          onChange={setVal(key)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        {errors[key]
          ? <div className="invalid-feedback d-block" id={`${id}-error`}>{errors[key]}</div>
          : hint && <div className="form-text" id={`${id}-hint`}>{hint}</div>}
      </div>
    )
  }

  return (
    <Layout
      title="Profile"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Profile</span>
        </>
      }
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Profile Settings</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Your personal details and account security
          </p>
        </div>
        <span className="profile-role-pill">
          <i className="bi bi-shield-lock me-1" aria-hidden="true"></i>
          {user?.role || 'Administrator'}
        </span>
      </div>

      {loading && (
        <div className="inf-card p-5 text-center">
          <span className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading…</span>
          </span>
        </div>
      )}

      {!loading && loadError && (
        <div className="alert alert-danger border-0 shadow-sm d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => navigate(0)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <form className="inf-card animate-in" onSubmit={save} noValidate>
              <div className="inf-card-header">
                <h6 className="mb-0" style={{ fontWeight: 800 }}>
                  <i className="bi bi-person-badge me-2 text-primary" aria-hidden="true"></i>
                  Personal Details
                </h6>
              </div>
              <div className="inf-card-body">
                <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
                  <span className="profile-avatar-xl">
                    {preview ? <img src={preview} alt="" /> : initials}
                  </span>
                  <div className="flex-grow-1">
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      className="form-control form-control-sm"
                      aria-label="Upload profile photo"
                      onChange={(e) => {
                        setPhoto(e.target.files?.[0] || null)
                        setRemovePhoto(false)
                        if (e.target.files?.[0]) setErrors((x) => ({ ...x, avatar: undefined }))
                      }}
                    />
                    <div className="form-text">PNG, JPEG, GIF or WebP. Up to {Math.round(MAX_PHOTO_BYTES / 1024)} KB.</div>
                    {user?.avatar_image && !photo && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0"
                        onClick={() => { setRemovePhoto(!removePhoto); setPhoto(null) }}
                      >
                        <i className={`bi ${removePhoto ? 'bi-arrow-counterclockwise' : 'bi-trash'} me-1`}></i>
                        {removePhoto ? 'Keep current photo' : 'Remove photo'}
                      </button>
                    )}
                  </div>
                </div>
                {errors.avatar && <div className="text-danger mb-3" style={{ fontSize: '0.8rem' }}>{errors.avatar}</div>}

                <div className="row g-3">
                  <div className="col-12">{field('full_name', 'Full Name', 'text', 'Shown in the sidebar and on your profile.')}</div>
                  <div className="col-12 col-md-6">{field('email', 'Email Address', 'email', 'Optional. Used for your account only.')}</div>
                  <div className="col-12 col-md-6">{field('phone', 'Phone', 'tel', 'Optional.')}</div>
                  <div className="col-12">{field('username', 'Username', 'text', 'Used to sign in. 3–50 letters, numbers, dots, dashes or underscores.')}</div>
                </div>

                <div className="alert alert-secondary border-0 mt-4 mb-0" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
                  Your role and account status are managed by the application and cannot be changed here.
                </div>
              </div>
              <div className="inf-card-body border-top" style={{ borderColor: 'var(--inf-border-light) !important' }}>
                <div className="d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-inf-outline" onClick={cancel} disabled={saving || !dirty}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-inf" disabled={saving || !dirty}>
                    {saving ? (
                      <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Saving…</>
                    ) : (
                      <><i className="bi bi-check-lg me-1"></i>Save Changes</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="col-12 col-lg-5">
            <div className="inf-card animate-in">
              <div className="inf-card-header">
                <h6 className="mb-0" style={{ fontWeight: 800 }}>
                  <i className="bi bi-shield-lock me-2 text-primary" aria-hidden="true"></i>
                  Account &amp; Security
                </h6>
              </div>
              <div className="inf-card-body">
                <dl className="row mb-4" style={{ fontSize: '0.85rem' }}>
                  <dt className="col-5 text-muted fw-semibold">Signed in as</dt>
                  <dd className="col-7 mb-1">{user?.username || '—'}</dd>
                  <dt className="col-5 text-muted fw-semibold">Role</dt>
                  <dd className="col-7 mb-1">{user?.role || 'Administrator'}</dd>
                  <dt className="col-5 text-muted fw-semibold">Status</dt>
                  <dd className="col-7 mb-0">
                    <span className="badge" style={{ background: 'var(--inf-success-subtle)', color: 'var(--inf-success)' }}>
                      <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i>Active
                    </span>
                  </dd>
                </dl>

                <hr className="my-4" style={{ borderColor: 'var(--inf-border-light)' }} />

                <h6 className="fw-bold mb-3">
                  <i className="bi bi-key me-2 text-primary" aria-hidden="true"></i>
                  Change Password
                </h6>
                <ChangePasswordForm />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// Mirrors MAX_STAMP_BYTES on the backend; the API rejects anything larger.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024