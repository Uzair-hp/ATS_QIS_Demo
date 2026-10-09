import { describe, it, expect } from 'vitest'
import {
  displayName,
  displaySubtitle,
  initialsOf,
  isProfileDirty,
  validateProfile,
} from '../user.js'

describe('initialsOf', () => {
  it('takes the first two words', () => {
    expect(initialsOf('Uzair Mansoori')).toBe('UM')
    expect(initialsOf('  Priya   Sharma ')).toBe('PS')
  })

  it('takes two letters from a single word', () => {
    expect(initialsOf('admin')).toBe('AD')
  })

  it('falls back when there is no name', () => {
    expect(initialsOf('', 'AD')).toBe('AD')
    expect(initialsOf(null, '??')).toBe('??')
  })
})

describe('displayName', () => {
  it('prefers the full name and falls back to the username', () => {
    expect(displayName({ full_name: 'Uzair M', username: 'admin' })).toBe('Uzair M')
    expect(displayName({ username: 'admin' })).toBe('admin')
    expect(displayName(null)).toBe('')
  })
})

describe('displaySubtitle', () => {
  it('prefers email, then phone, then the username', () => {
    expect(displaySubtitle({ email: 'a@b.com', phone: '1', username: 'admin' })).toBe('a@b.com')
    expect(displaySubtitle({ phone: '123', username: 'admin' })).toBe('123')
    expect(displaySubtitle({ username: 'admin' })).toBe('@admin')
  })
})

describe('validateProfile', () => {
  const base = { full_name: 'Uzair Mansoori', email: '', phone: '', username: 'admin' }

  it('accepts a clean form', () => {
    expect(validateProfile(base)).toEqual({})
  })

  it('rejects a malformed email', () => {
    expect(validateProfile({ ...base, email: 'nope' }).email).toMatch(/valid email/i)
    expect(validateProfile({ ...base, email: 'a@b' }).email).toBeTruthy()
  })

  it('allows an empty email', () => {
    expect(validateProfile({ ...base, email: '' })).toEqual({})
  })

  it('caps the field lengths', () => {
    expect(validateProfile({ ...base, full_name: 'x'.repeat(121) }).full_name).toBeTruthy()
    expect(validateProfile({ ...base, phone: '9'.repeat(31) }).phone).toBeTruthy()
  })

  it('enforces the username charset', () => {
    expect(validateProfile({ ...base, username: 'ab' }).username).toBeTruthy()
    expect(validateProfile({ ...base, username: 'has space' }).username).toBeTruthy()
    expect(validateProfile({ ...base, username: '' }).username).toBeTruthy()
    expect(validateProfile({ ...base, username: 'uzair.mansoori-1' })).toEqual({})
  })
})

describe('isProfileDirty', () => {
  const saved = { full_name: 'A B', email: '', phone: '', username: 'admin' }

  it('is false when nothing changed', () => {
    expect(isProfileDirty({ ...saved }, saved)).toBe(false)
  })

  it('ignores surrounding whitespace differences', () => {
    expect(isProfileDirty({ ...saved, full_name: ' A B ' }, saved)).toBe(false)
  })

  it('is true on any real change', () => {
    expect(isProfileDirty({ ...saved, email: 'a@b.com' }, saved)).toBe(true)
    expect(isProfileDirty({ ...saved, username: 'other' }, saved)).toBe(true)
  })

  it('is false before the form has loaded', () => {
    expect(isProfileDirty(saved, null)).toBe(false)
  })
})