// renderer/popup/DetectionPopup.jsx
// Se muestra cuando el motor detecta una ventana relacionada a un cliente.
// El usuario confirma, elige otro cliente, o ignora.

import { useState, useEffect } from 'react'

const TASK_TYPES = [
  { value: 'redaccion',     label: 'Redacción' },
  { value: 'revision',      label: 'Revisión de documentos' },
  { value: 'consulta',      label: 'Consulta / asesoramiento' },
  { value: 'audiencia',     label: 'Audiencia / representación' },
  { value: 'comunicacion',  label: 'Email / comunicación' },
  { value: 'tramite',       label: 'Trámite administrativo' },
  { value: 'general',       label: 'General' },
]

export default function DetectionPopup() {
  const [data, setData] = useState(null)         // { client, windowTitle, allClients }
  const [selectedClient, setSelectedClient] = useState(null)
  const [taskType, setTaskType] = useState('general')
  const [showClientList, setShowClientList] = useState(false)
  const [countdown, setCountdown] = useState(15)

  useEffect(() => {
    // Recibir datos de detección desde main process
    window.timebill.detection.onData((detection) => {
      setData(detection)
      setSelectedClient(detection.client)
    })
  }, [])

  // Countdown de auto-cierre
  useEffect(() => {
    if (!data) return
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          handleIgnore()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [data])

  async function handleStart() {
    await window.timebill.timer.start({
      clientId:    selectedClient.id,
      clientName:  selectedClient.name,
      taskType,
      windowTitle: data.windowTitle,
    })
  }

  async function handleIgnore() {
    await window.timebill.detection.ignore()
  }

  if (!data) {
    return <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
      Cargando...
    </div>
  }

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-background-success)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-success)', fontWeight: 500 }}>
            Actividad detectada
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {countdown}s
        </span>
      </div>

      {/* Ventana detectada */}
      <div style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 10,
        borderLeft: '3px solid var(--color-border-info)',
      }}>
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 2px' }}>
          Ventana detectada
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-primary)', margin: 0, fontWeight: 500 }}>
          {data.windowTitle.length > 50
            ? data.windowTitle.substring(0, 50) + '…'
            : data.windowTitle}
        </p>
      </div>

      {/* Cliente sugerido o selector */}
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>
        ¿Estás trabajando para?
      </p>

      {!showClientList ? (
        <>
          {/* Cliente detectado */}
          <div
            style={{
              background: 'var(--color-background-info)',
              border: '0.5px solid var(--color-border-info)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'default',
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-info)', margin: 0 }}>
                {selectedClient.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-info)', margin: 0, opacity: 0.8 }}>
                ${selectedClient.rate_usd} USD/h
              </p>
            </div>
            <span style={{ fontSize: 14, color: 'var(--color-text-info)' }}>✓</span>
          </div>

          {/* Opción de cambiar */}
          <div
            onClick={() => setShowClientList(true)}
            style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Otro cliente...
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>›</span>
          </div>
        </>
      ) : (
        /* Lista de todos los clientes */
        <div style={{ marginBottom: 10 }}>
          {data.allClients.map(client => (
            <div
              key={client.id}
              onClick={() => { setSelectedClient(client); setShowClientList(false) }}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                marginBottom: 4,
                cursor: 'pointer',
                background: selectedClient?.id === client.id
                  ? 'var(--color-background-info)'
                  : 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                {client.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tipo de tarea */}
      <select
        value={taskType}
        onChange={e => setTaskType(e.target.value)}
        style={{ width: '100%', fontSize: 12, marginBottom: 10 }}
      >
        {TASK_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleStart}
          style={{
            flex: 1,
            padding: '8px 0',
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--color-background-info)',
            color: 'var(--color-text-info)',
            border: '0.5px solid var(--color-border-info)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Iniciar timer
        </button>
        <button
          onClick={handleIgnore}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            background: 'transparent',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Ignorar
        </button>
      </div>

    </div>
  )
}
