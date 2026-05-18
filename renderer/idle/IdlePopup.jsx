import { useState, useEffect } from 'react'

export default function IdlePopup() {
  const [idleMinutes, setIdleMinutes] = useState(5)

  useEffect(() => {
    window.timebill.app.beep()
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-sans)' }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          ¿Seguís trabajando?
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
        No se detectó actividad en los últimos {idleMinutes} minutos.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Descontar</span>
        <input
          type="number"
          min={1}
          max={60}
          value={idleMinutes}
          onChange={e => setIdleMinutes(Number(e.target.value))}
          style={{ width: 52, textAlign: 'center', fontSize: 12 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>minutos</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => window.timebill.idle['continue']()}
          style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 500, background: 'var(--color-background-info)', color: 'var(--color-text-info)', border: '0.5px solid var(--color-border-info)', borderRadius: 6, cursor: 'pointer' }}
        >
          Sí, seguí
        </button>
        <button
          onClick={() => window.timebill.idle.stop(idleMinutes)}
          style={{ flex: 1, padding: '8px 0', fontSize: 12, color: 'var(--color-text-danger)', background: 'var(--color-background-danger)', border: '0.5px solid var(--color-border-danger)', borderRadius: 6, cursor: 'pointer' }}
        >
          No, pausar
        </button>
      </div>
    </div>
  )
}
