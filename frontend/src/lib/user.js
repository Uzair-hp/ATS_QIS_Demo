// Display helpers for the signed-in account. Pure so they can be unit tested
// without a DOM (see __tests__/user.test.js).

export function initialsOf(name, fallback = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function displayName(user) {
  if (!user) return ''
  return user.full_name || user.username || ''
}

export function displaySubtitle(user) {
  if (!user) return ''
  return user.email || user.phone || `@${user.username || 'user'}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const USERNAME_RE = /^[A-Za-z0-9._-]{3,50}$/

// Mirrors the checks in backend/routes/auth.py so the user sees the error
// without a round trip. The backend remains the authority.
export function validateProfile(form) {
  const errors = {}

  const fullName = (form.full_name || '').trim()
  const email = (form.email || '').trim()
  const phone = (form.phone || '').trim()
  const username = (form.username || '').trim()

  if (fullName.length > 120) errors.full_name = 'Name must be 120 characters or fewer.'
  if (email) {
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
    else if (email.length > 150) errors.email = 'Email must be 150 characters or fewer.'
  }
  if (phone.length > 30) errors.phone = 'Phone must be 30 characters or fewer.'
  if (username && !USERNAME_RE.test(username)) {
    errors.username = 'Use 3-50 letters, numbers, dots, dashes or underscores.'
  }
  if (!username) errors.username = 'Username is required.'

  return errors
}

export function isProfileDirty(form, saved) {
  if (!saved) return false
  return ['full_name', 'email', 'phone', 'username'].some(
    (k) => (form[k] || '').trim() !== (saved[k] || '').trim()
  )
}