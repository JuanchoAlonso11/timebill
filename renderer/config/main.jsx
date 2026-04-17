import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ConfigPopup from './ConfigPopup.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigPopup />
  </StrictMode>
)
