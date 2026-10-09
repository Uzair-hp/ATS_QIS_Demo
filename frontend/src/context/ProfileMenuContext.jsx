import { useEffect, useRef, useState } from 'react'
import { createContext, useContext, useCallback } from 'react'

const ProfileMenuContext = createContext(null)

export function ProfileMenuProvider({ children }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)

  const close = useCallback((returnFocus) => {
    setOpen(false)
    if (returnFocus && triggerRef.current) triggerRef.current.focus()
  }, [])

  // Outside click and Escape both close; Escape also restores focus to the
  // trigger so keyboard users are not stranded at the top of the document.
  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(true)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  return (
    <ProfileMenuContext.Provider value={{ open, setOpen, close, wrapRef, triggerRef }}>
      {children}
    </ProfileMenuContext.Provider>
  )
}

export function useProfileMenu() {
  return useContext(ProfileMenuContext)
}