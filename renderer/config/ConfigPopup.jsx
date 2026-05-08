import { useState, useEffect } from 'react'

const EMPTY_CLIENT = { name: '', rate_usd: 85, keywords: '' }

export default function ConfigPopup() {
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_CLIENT)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [section, setSection] = useState('clients') // 'clients' | 'tasks'
  const [taskTypes, setTaskTypes] = useState([])
  const [newTaskLabel, setNewTaskLabel] = useState('')

  useEffect(() => {
    window.timebill.auth.getRole().then(setUserRole)
    window.timebill.config.onData((data) => {
      setClients(data.clients || [])
    })
    window.timebill.config.getTaskTypes().then(setTaskTypes)
  }, [])

  function handleSelect(client) {
    setSelected(client.id)
    setForm({
      name: client.name,
      rate_usd: client.rate_usd,
      keywords: client.keywords?.join(', ') || '',
    })
    setSaved(false)
  }

  function handleNew() {
    setSelected('new')
    setForm(EMPTY_CLIENT)
    setSaved(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await window.timebill.clients.delete(selected)
    const updated = await window.timebill.config.getClients()
    setClients(updated)
    setSelected(null)
    setForm(EMPTY_CLIENT)
    setConfirmDelete(false)
  }

  async function handleAddTaskType() {
    const label = newTaskLabel.trim()
    if (!label) return
    const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const updated = [...taskTypes, { value, label }]
    setTaskTypes(updated)
    await window.timebill.config.saveTaskTypes(updated)
    setNewTaskLabel('')
  }

  async function handleDeleteTaskType(value) {
    const updated = taskTypes.filter(t => t.value !== value)
    setTaskTypes(updated)
    await window.timebill.config.saveTaskTypes(updated)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const id = selected === 'new'
      ? 'client-' + Date.now()
      : selected

    const keywords = form.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean)

    await window.timebill.config.saveClient({ id, name: form.name.trim(), rate_usd: Number(form.rate_usd) })
    await window.timebill.config.setKeywords(id, keywords)

    const updated = await window.timebill.config.getClients()
    setClients(updated)
    setSelected(id)
    setSaved(true)
  }

  const selectedClient = clients.find(c => c.id === selected)

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Lista de clientes */}
      <div style={{ width: 160, borderRight: '0.5px solid var(--color-border-tertiary)', padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '0 12px', marginBottom: 8, letterSpacing: '0.05em' }}>
          CLIENTES
        </p>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {clients.map(c => (
            <div
              key={c.id}
              onClick={() => { setSection('clients'); setSelected(c.id); handleSelect(c) }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: section === 'clients' && selected === c.id ? 'var(--color-text-info)' : 'var(--color-text-primary)',
                background: section === 'clients' && selected === c.id ? 'var(--color-background-info)' : 'transparent',
                borderLeft: section === 'clients' && selected === c.id ? '2px solid var(--color-border-info)' : '2px solid transparent',
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          <button
            onClick={() => { setSection('clients'); handleNew() }}
            style={{
              width: '100%',
              padding: '6px 0',
              fontSize: 12,
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            + Nuevo
          </button>
        </div>

        {/* Sección tipos de tarea */}
        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '10px 12px 4px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6, letterSpacing: '0.05em' }}>
            TIPOS DE TAREA
          </p>
          <div
            onClick={() => { setSection('tasks'); setSelected(null) }}
            style={{
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 12,
              borderRadius: 4,
              color: section === 'tasks' ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              background: section === 'tasks' ? 'var(--color-background-info)' : 'transparent',
            }}
          >
            Gestionar tipos
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>

        {/* Panel clientes */}
        {section === 'clients' && (
          <>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  Seleccioná un cliente o creá uno nuevo
                </p>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: García S.A."
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                      Tarifa (USD/hora)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.rate_usd}
                      onChange={e => setForm(f => ({ ...f, rate_usd: e.target.value }))}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                      Keywords de detección
                    </label>
                    <textarea
                      value={form.keywords}
                      onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                      placeholder="garcia, garcía, exp-2024-047"
                      style={{ width: '100%', fontSize: 12, height: 64, resize: 'none' }}
                    />
                    <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                      Separadas por coma. El detector busca estas palabras en el título de la ventana activa.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {selected !== 'new' && userRole === 'admin' && (
                    <button
                      onClick={handleDelete}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        background: confirmDelete ? 'rgba(229,83,75,0.15)' : 'transparent',
                        color: 'var(--color-text-danger, #e5534b)',
                        border: '0.5px solid rgba(229,83,75,0.3)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
                    </button>
                  )}
                  <button
                    onClick={handleSave}
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
                    Guardar
                  </button>
                  {saved && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-success)' }}>
                      Guardado
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Panel tipos de tarea */}
        {section === 'tasks' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
              TIPOS DE TAREA
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {taskTypes.map(t => (
                <div key={t.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{t.label}</span>
                  <button
                    onClick={() => handleDeleteTaskType(t.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-tertiary)',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '0 4px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type="text"
                value={newTaskLabel}
                onChange={e => setNewTaskLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTaskType()}
                placeholder="Nuevo tipo..."
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                onClick={handleAddTaskType}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'var(--color-background-info)',
                  color: 'var(--color-text-info)',
                  border: '0.5px solid var(--color-border-info)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                + Agregar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
