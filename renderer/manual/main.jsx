import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ManualPopup from './ManualPopup.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ManualPopup />
  </StrictMode>
)
