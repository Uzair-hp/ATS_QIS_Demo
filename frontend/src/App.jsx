import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClientsList from './pages/ClientsList'
import ClientForm from './pages/ClientForm'
import ClientDetail from './pages/ClientDetail'
import ServicesList from './pages/ServicesList'
import InvoicesList from './pages/InvoicesList'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceView from './pages/InvoiceView'
import QuotationsList from './pages/QuotationsList'
import QuotationForm from './pages/QuotationForm'
import QuotationView from './pages/QuotationView'
import QuotationPrintPage from './pages/QuotationPrintPage'
import Settings from './pages/Settings'
import Help from './pages/Help'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={loading ? null : (user ? <Navigate to="/" replace /> : <Login />)} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsList /></ProtectedRoute>} />
      <Route path="/clients/add" element={<ProtectedRoute><ClientForm /></ProtectedRoute>} />
      <Route path="/clients/edit/:id" element={<ProtectedRoute><ClientForm /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><ServicesList /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoicesList /></ProtectedRoute>} />
      <Route path="/invoices/create" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
      <Route path="/invoices/edit/:id" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
      <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceView /></ProtectedRoute>} />
      <Route path="/quotations" element={<ProtectedRoute><QuotationsList /></ProtectedRoute>} />
      <Route path="/quotations/create" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
      <Route path="/quotations/edit/:id" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
      <Route path="/quotations/:id" element={<ProtectedRoute><QuotationView /></ProtectedRoute>} />
      <Route path="/quotations/:id/print" element={<ProtectedRoute><QuotationPrintPage /></ProtectedRoute>} />
      {/* Sample preview: no id, so the page renders the checked-in FORTIS
          HOSPITAL sample. A static segment outranks :id in the matcher, the
          same way /quotations/create already does. */}
      <Route path="/quotations/print" element={<ProtectedRoute><QuotationPrintPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
