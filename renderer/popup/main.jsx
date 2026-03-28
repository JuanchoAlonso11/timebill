import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DetectionPopup from './DetectionPopup.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DetectionPopup />
  </StrictMode>
)
