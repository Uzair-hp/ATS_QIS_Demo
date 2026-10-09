import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const EMPTY = { old_password: '', new_password: '', confirm_password: '' }

// Shared by Settings and the Profile page so password rules live in one place.
export default function ChangePasswordForm({ onChanged }) {
  const [pwd, setPwd] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { push } = useToast()
  const firstRef = useRef(null)

  useEffect(() => {
    setPwd(EMPTY)
    setErrors({})
  }, [onChanged])

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!pwd.old_password) next.old_password = 'Enter your current password.'
    if (!pwd.new_password) next.new_password = 'Enter a new password.'
    else if (pwd.new_password.length < 6) next.new_password = 'Password must be at least 6 characters long.'
    if (pwd.new_password !== pwd.confirm_password) next.confirm_password = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) {
      const firstBad = Object.keys(next)[0]
      document.getElementById(`pwd-${firstBad}`)?.focus()
      return
    }

    setSaving(true)
    try {
      await api.post('/settings/change_password', pwd)
      push('Password changed successfully!', 'success')
      setPwd(EMPTY)
      setErrors({})
      onChanged?.()
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to change password.'
      setErrors({ old_password: message })
      push(message, 'danger')
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, extra = {}) => {
    const id = `pwd-${key}`
    return (
      <div className="mb-3" key={key}>
        <label className="form-label" htmlFor={id}>{label}</label>
        <input
          id={id}
          ref={key === 'old_password' ? firstRef : undefined}
          type="password"
          autoComplete={extra.autoComplete}
          className={`form-control${errors[key] ? ' is-invalid' : ''}`}
          value={pwd[key]}
          onChange={(e) => setPwd({ ...pwd, [key]: e.target.value })}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
        />
        {errors[key] && (
          <div className="invalid-feedback d-block" id={`${id}-error`}>{errors[key]}</div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      {field('old_password', 'Current Password', { autoComplete: 'current-password' })}
      {field('new_password', 'New Password', { autoComplete: 'new-password' })}
      {field('confirm_password', 'Confirm New Password', { autoComplete: 'new-password' })}
      <button type="submit" className="btn btn-inf" disabled={saving}>
        {saving ? (
          <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Updating…</>
        ) : (
          <><i className="bi bi-key me-1"></i>Update Password</>
        )}
      </button>
    </form>
  )
}