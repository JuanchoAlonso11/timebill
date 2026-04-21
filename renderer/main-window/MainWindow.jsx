import { useState, useEffect } from 'react'

function formatTime(totalSec) {
  if (!totalSec) return '00:00'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function MainWindow() {
  const [entry, setEntry]   = useState(null)
  const [user, setUser]     = useState(null)

  useEffect(() => {
    window.timebill.auth.getUser().then(setUser)
  }, [])

  useEffect(() => {
    const poll = async () => {
      const active = await window.timebill.timer.getActive()
      setEntry(active)
    }
    poll()
    const interval = setInterval(poll, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleStop = async () => {
    await window.timebill.timer.stop()
    setEntry(null)
  }

  const handleLogout = async () => {
    await window.timebill.auth.logout()
  }

  const handleQuit = () => {
    window.timebill.app.quit()
  }

  const earned = entry?.rateUsd
    ? ((entry.elapsedSec / 3600) * entry.rateUsd).toFixed(2)
    : null

  const timerClass = entry?.paused ? 'paused' : entry ? '' : 'idle'
  const dotClass   = entry?.paused ? 'paused' : entry ? 'active' : 'idle'

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="logo">TimeBill</span>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => window.timebill.app.openDashboard()} title="Dashboard">
            📊
          </button>
          <button className="btn-icon" onClick={() => window.timebill.app.openConfig()} title="Configurar clientes">
            ⚙️
          </button>
        </div>
      </header>

      {/* Timer */}
      <div className="timer-block">
        <div className="timer-status">
          <div className={`status-dot ${dotClass}`} />
          <span className="status-client">
            {entry ? entry.clientName : 'Sin actividad'}
          </span>
          {entry && (
            <span className="status-label">
              {entry.paused ? 'pausado' : 'activo'}
            </span>
          )}
        </div>

        <div className={`timer-display ${timerClass}`}>
          {formatTime(entry?.elapsedSec || 0)}
        </div>

        {earned && (
          <div className="timer-earned">${earned} USD acumulados</div>
        )}

        {entry ? (
          <button className="timer-stop-btn" onClick={handleStop}>
            ■ Detener timer
          </button>
        ) : (
          <div className="timer-idle">La app detecta automáticamente tu actividad</div>
        )}
      </div>

      {/* Acciones */}
      <div className="actions">
        <button className="action-btn" onClick={() => window.timebill.app.openManual()}>
          <span className="action-icon">✏️</span>
          Registrar tarea manual
          <span className="action-shortcut">Ctrl+Shift+B</span>
        </button>

        <div className="actions-divider" />

        <button className="action-btn" onClick={() => window.timebill.app.openDashboard()}>
          <span className="action-icon">📊</span>
          Abrir dashboard
        </button>

        <button className="action-btn" onClick={() => window.timebill.app.openConfig()}>
          <span className="action-icon">⚙️</span>
          Configurar clientes
        </button>
      </div>

      {/* Footer */}
      <div className="footer">
        <span className="user-email">{user?.email || ''}</span>
        <div className="footer-btns">
          <button className="footer-btn" onClick={handleLogout}>Cerrar sesión</button>
          <button className="footer-btn danger" onClick={handleQuit}>Cerrar app</button>
        </div>
      </div>
    </div>
  )
}
