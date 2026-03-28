import { useState, useEffect } from 'react'

const TASK_TYPES = [
  { value: 'redaccion',    label: 'Redacción' },
  { value: 'revision',     label: 'Revisión de documentos' },
  { value: 'consulta',     label: 'Consulta / asesoramiento' },
  { value: 'audiencia',    label: 'Audiencia / representación' },
  { value: 'comunicacion', label: 'Email / comunicación' },
  { value: 'tramite',      label: 'Trámite administrativo' },
  { value: 'general',      label: 'General' },
]

function formatTime(totalSec) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function TimerWidget() {
  const [entry, setEntry] = useState(null)

  // Polling del estado del timer cada segundo
  useEffect(() => {
    const poll = async () => {
      const active = await window.timebill.timer.getActive()
      setEntry(active)
    }
    poll()
    const interval = setInterval(poll, 1000)
    return () => clearInterval(interval)
  }, [])

  async function handleStop() {
    await window.timebill.timer.stop()
    setEntry(null)
  }

  async function handleTaskChange(e) {
    const updated = await window.timebill.timer.updateTask(e.target.value)
    setEntry(updated)
  }

  if (!entry) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Sin actividad en curso
        </p>
      </div>
    )
  }

  const hourlyRate = entry.rateUsd || 0
  const earned = ((entry.elapsedSec / 3600) * hourlyRate).toFixed(2)

  return (
    <div style={{ padding: 16 }}>

      {/* Cliente + estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
            {entry.clientName}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {entry.paused ? 'pausado — sin actividad' : 'trackeando'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: entry.paused ? '#f59e0b' : '#22c55e',
          }} />
          <span style={{
            fontSize: 11,
            color: entry.paused ? 'var(--color-text-warning, #92400e)' : 'var(--color-text-success)',
          }}>
            {entry.paused ? 'pausado' : 'activo'}
          </span>
        </div>
      </div>

      {/* Cronómetro */}
      <div style={{ textAlign: 'center', margin: '16px 0' }}>
        <span style={{
          fontSize: 38,
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          letterSpacing: 2,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(entry.elapsedSec)}
        </span>
        {hourlyRate > 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-text-success)', margin: '4px 0 0' }}>
            ${earned} USD acumulados
          </p>
        )}
      </div>

      {/* Selector de tipo de tarea */}
      <select
        value={entry.taskType}
        onChange={handleTaskChange}
        style={{ width: '100%', marginBottom: 10 }}
      >
        {TASK_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Botón stop */}
      <button
        onClick={handleStop}
        style={{
          width: '100%',
          padding: 9,
          fontSize: 13,
          fontWeight: 500,
          background: 'var(--color-background-danger)',
          color: 'var(--color-text-danger)',
          border: '0.5px solid var(--color-border-danger)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        ■ Detener timer
      </button>

      {/* Info ventana detectada */}
      {entry.windowTitle && (
        <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: '10px 0 0', textAlign: 'center' }}>
          {entry.windowTitle.length > 45
            ? entry.windowTitle.substring(0, 45) + '…'
            : entry.windowTitle}
        </p>
      )}
    </div>
  )
}
