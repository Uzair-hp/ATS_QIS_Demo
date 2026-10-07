import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// print.css must be imported after app.css so its @media print rules win
import './styles/app.css'
import './styles/print.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)