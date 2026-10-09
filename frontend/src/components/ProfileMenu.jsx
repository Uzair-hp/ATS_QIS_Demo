import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProfileMenu } from '../context/ProfileMenuContext'
import { useToast } from '../context/ToastContext'
import { displayName, displaySubtitle, initialsOf } from '../lib/user'

const EDGE_GAP = 10

// The sidebar scrolls and clips its overflow, so an absolutely-positioned popup
// would be cut off. Measure the trigger and place the popup in fixed coordinates
// instead: it escapes both the sidebar's overflow and a collapsed rail.
function useAnchoredPosition(open, triggerRef) {
  const [style, setStyle] = useState({})

  const measure = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 224)
    let left = r.left
    left = Math.max(EDGE_GAP, Math.min(left, window.innerWidth - width - EDGE_GAP))
    setStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      bottom: `${Math.max(EDGE_GAP, window.innerHeight - r.top + 8)}px`,
    })
  }

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, triggerRef])

  useEffect(() => {
    if (!open) return undefined
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  return style
}

export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const { open, setOpen, close, wrapRef, triggerRef } = useProfileMenu()
  const { push } = useToast()
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const position = useAnchoredPosition(open, triggerRef)

  const name = displayName(user)
  const subtitle = displaySubtitle(user)
  const initials = initialsOf(name, (user?.username || 'U').slice(0, 2).toUpperCase())
  const avatar = user?.avatar_image
    ? `data:${user.avatar_mime || 'image/png'};base64,${user.avatar_image}`
    : null

  const go = (to) => () => {
    close(false)
    navigate(to)
  }

  const handleLogout = async () => {
    close(false)
    await logout()
    push('Signed out.', 'success')
    navigate('/login')
  }

  // Roving arrow-key movement, so the popup is usable without a pointer.
  const onMenuKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = menuRef.current?.querySelectorAll('button.profile-menu-item')
    if (!items?.length) return
    const idx = Array.from(items).indexOf(document.activeElement)
    const next = e.key === 'ArrowDown'
      ? (idx + 1) % items.length
      : (idx - 1 + items.length) % items.length
    items[next].focus()
  }

  return (
    <div className="profile-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="profile-menu-trigger"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="profileMenuPopup"
      >
        <span className="sidebar-avatar">
          {avatar ? <img src={avatar} alt="" /> : initials}
        </span>
        <span className="profile-menu-text">
          <span className="profile-menu-name">{name}</span>
          <span className="profile-menu-role">{user?.role || 'Administrator'}</span>
        </span>
        <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} profile-menu-caret`} aria-hidden="true"></i>
      </button>

      {open && (
        <div
          id="profileMenuPopup"
          ref={menuRef}
          className="profile-menu-popup"
          style={position}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
        >
          <div className="profile-menu-head">
            <span className="sidebar-avatar profile-menu-avatar">
              {avatar ? <img src={avatar} alt="" /> : initials}
            </span>
            <div className="profile-menu-head-text">
              <div className="profile-menu-head-name">{name}</div>
              {subtitle && <div className="profile-menu-head-sub">{subtitle}</div>}
              <span className="profile-menu-badge">
                <i className="bi bi-shield-lock me-1" aria-hidden="true"></i>
                {user?.role || 'Administrator'}
              </span>
            </div>
          </div>

          <div className="profile-menu-divider" role="separator"></div>

          <Link to="/profile" className="profile-menu-item" role="menuitem" onClick={close}>
            <i className="bi bi-person-gear" aria-hidden="true"></i>
            Profile Settings
          </Link>
          <Link to="/settings" className="profile-menu-item" role="menuitem" onClick={close}>
            <i className="bi bi-gear" aria-hidden="true"></i>
            App Settings
          </Link>
          <Link to="/help" className="profile-menu-item" role="menuitem" onClick={close}>
            <i className="bi bi-question-circle" aria-hidden="true"></i>
            Help &amp; Support
          </Link>

          <div className="profile-menu-divider" role="separator"></div>

          <button type="button" className="profile-menu-item danger" role="menuitem" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}