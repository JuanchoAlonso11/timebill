import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import IdlePopup from './IdlePopup.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IdlePopup />
  </StrictMode>
)