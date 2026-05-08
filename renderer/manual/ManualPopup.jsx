import { useState, useEffect } from 'react'

const DEFAULT_TASK_TYPES = [
  { value: 'llamada',      label: 'Llamada telefónica' },
  { value: 'reunion',      label: 'Reunión presencial' },
  { value: 'redaccion',    label: 'Redacción' },
  { value: 'revision',     label: 'Revisión de documentos' },
  { value: 'consulta',     label: 'Consulta / asesoramiento' },
  { value: 'audiencia',    label: 'Audiencia / representación' },
  { value: 'comunicacion', label: 'Email / comunicación' },
  { value: 'tramite',      label: 'Trámite administrativo' },
  { value: 'general',      label: 'General' },
]

export default function ManualPopup() {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [taskType, setTaskType] = useState('')
  const [taskTypes, setTaskTypes] = useState(DEFAULT_TASK_TYPES)
  const [showRetro, setShowRetro] = useState(false)
  const [minutesAgo, setMinutesAgo] = useState(15)

  useEffect(() => {
    window.timebill.config.getTaskTypes().then(types => {
      if (types?.length > 0) {
        setTaskTypes(types)
        setTaskType(types[0].value)
      } else {
        setTaskType(DEFAULT_TASK_TYPES[0].value)
      }
    }).catch(() => {
      setTaskType(DEFAULT_TASK_TYPES[0].value)
    })

    window.timebill.manual.onData((data) => {
      setClients(data.allClients || [])
      if (data.allClients?.length > 0) {
        setSelectedClientId(data.allClients[0].id)
      }
    })
  }, [])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  async function handleStartNow() {
    if (!selectedClientId) return
    await window.timebill.manual.startNow({
      clientId: selectedClientId,
      clientName: selectedClient?.name || '',
      taskType,
    })
  }

  async function handleSaveRetro() {
    if (!selectedClientId) return
    await window.timebill.manual.saveRetro({
      clientId: selectedClientId,
      taskType,
      minutesAgo,
    })
  }

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          Registrar tarea
        </span>
        <button
          onClick={() => window.timebill.manual.close()}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 16,
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
          Cliente
        </label>
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tipo de tarea */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
          Tipo de tarea
        </label>
        <select
          value={taskType}
          onChange={e => setTaskType(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        >
          {taskTypes.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Botón principal */}
      <button
        onClick={handleStartNow}
        style={{
          width: '100%',
          padding: '9px 0',
          fontSize: 13,
          fontWeight: 500,
          background: 'var(--color-background-info)',
          color: 'var(--color-text-info)',
          border: '0.5px solid var(--color-border-info)',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        Iniciar timer ahora
      </button>

      {/* Sección retroactiva */}
      {!showRetro ? (
        <button
          onClick={() => setShowRetro(true)}
          style={{
            width: '100%',
            padding: '7px 0',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            background: 'transparent',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Empecé hace un rato...
        </button>
      ) : (
        <div style={{
          background: 'var(--color-background-secondary)',
          borderRadius: 6,
          padding: '10px 12px',
          border: '0.5px solid var(--color-border-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Empecé hace</span>
            <input
              type="number"
              min={1}
              max={480}
              value={minutesAgo}
              onChange={e => setMinutesAgo(Number(e.target.value))}
              style={{ width: 52, textAlign: 'center', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>minutos</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveRetro}
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--color-background-success)',
                color: 'var(--color-text-success)',
                border: '0.5px solid var(--color-border-success)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Guardar
            </button>
            <button
              onClick={() => setShowRetro(false)}
              style={{
                padding: '7px 12px',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                background: 'transparent',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
