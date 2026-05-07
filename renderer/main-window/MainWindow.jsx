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
  const [entry, setEntry]           = useState(null)
  const [user, setUser]             = useState(null)
  const [idleModal, setIdleModal]       = useState(false)
  const [threshold, setThreshold]       = useState(5)
  const [reminder, setReminder]         = useState(15)
  const [saving, setSaving]             = useState(false)
  const [syncOnline, setSyncOnline] = useState(true)

  useEffect(() => {
    window.timebill.auth.getUser().then(setUser)
    window.timebill.sync.onStatus((online) => setSyncOnline(online))
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

  const handleOpenIdleModal = async () => {
    try {
      const ms = await window.timebill.timer.getThreshold()
      setThreshold(Math.round(ms / 60000))
    } catch { }
    try {
      const ms = await window.timebill.timer.getReminderInterval()
      setReminder(Math.round(ms / 60000))
    } catch { }
    setIdleModal(true)
  }

  const handleSaveThreshold = async () => {
    setSaving(true)
    try {
      await window.timebill.timer.setThreshold(threshold * 60 * 1000)
    } catch { }
    try {
      await window.timebill.timer.setReminderInterval(reminder * 60 * 1000)
    } catch { }
    setSaving(false)
    setIdleModal(false)
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
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal-card {
          background: #0e1018;
          border: 1px solid #1e2230;
          border-radius: 12px;
          padding: 24px;
          width: 260px;
        }
        .modal-title {
          font-size: 14px;
          font-weight: 600;
          color: #eef0f5;
          margin-bottom: 6px;
        }
        .modal-sub {
          font-size: 11px;
          color: #4a5060;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .threshold-options {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .threshold-btn {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #1e2230;
          background: #080a0f;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
          transition: all .15s;
        }
        .threshold-btn:hover { border-color: #4f8ef7; color: #c8cdd8; }
        .threshold-btn.selected {
          background: #4f8ef7;
          border-color: #4f8ef7;
          color: #fff;
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .modal-btn {
          padding: 7px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: opacity .15s;
        }
        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-btn.secondary { background: #1e2230; color: #6b7280; }
        .modal-btn.secondary:hover { color: #c8cdd8; }
        .modal-btn.primary { background: #4f8ef7; color: #fff; }
        .modal-btn.primary:hover:not(:disabled) { opacity: .85; }
        .sync-offline {
          font-size: 11px;
          color: #e5534b;
          margin-left: 8px;
        }
      `}</style>
      {/* Header */}
      <header className="header">
        <span className="logo">Smart Hours</span>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => window.timebill.app.openOnboarding()} title="Ayuda">
            ❓
          </button>
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

        <button className="action-btn" onClick={handleOpenIdleModal}>
          <span className="action-icon">⏱️</span>
          Configurar período de inactividad
        </button>
      </div>

      {/* Footer */}
      <div className="footer">
        <span className="user-email">{user?.email || ''}</span>
        {!syncOnline && (
          <span className="sync-offline" title="Sin conexión — datos guardados localmente">⚠ Sin sync</span>
        )}
        <div className="footer-btns">
          <button className="footer-btn" onClick={handleLogout}>Cerrar sesión</button>
          <button className="footer-btn danger" onClick={handleQuit}>Cerrar app</button>
        </div>
      </div>
      {/* Modal: período de inactividad */}
      {idleModal && (
        <div className="modal-overlay" onClick={() => setIdleModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⏱️ Período de inactividad</div>
            <div className="modal-sub">La app pausará el timer si no detecta actividad durante este tiempo.</div>

            <div className="threshold-options">
              {[5, 10, 15, 20, 30].map(min => (
                <button
                  key={min}
                  className={`threshold-btn ${threshold === min ? 'selected' : ''}`}
                  onClick={() => setThreshold(min)}
                >
                  {min} min
                </button>
              ))}
            </div>

            <div className="modal-title" style={{ marginTop: 8 }}>🔔 Recordatorio de timer activo</div>
            <div className="modal-sub">Beep cada cierto tiempo mientras el timer está corriendo.</div>

            <div className="threshold-options">
              {[0, 5, 10, 15, 20, 30].map(min => (
                <button
                  key={min}
                  className={`threshold-btn ${reminder === min ? 'selected' : ''}`}
                  onClick={() => setReminder(min)}
                >
                  {min === 0 ? 'Desactivado' : `${min} min`}
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setIdleModal(false)}>Cancelar</button>
              <button className="modal-btn primary" onClick={handleSaveThreshold} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
