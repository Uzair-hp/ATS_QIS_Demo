import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, category = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, category }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-container-custom" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`alert alert-${t.category === 'error' ? 'danger' : t.category} border-0 shadow mb-0 py-2 small`} role="alert">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
