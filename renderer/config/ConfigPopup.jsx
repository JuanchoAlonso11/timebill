import { useState, useEffect } from 'react'

const EMPTY_CLIENT = { name: '', rate_usd: 85, keywords: '' }

export default function ConfigPopup() {
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_CLIENT)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.timebill.config.onData((data) => {
      setClients(data.clients || [])
    })
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
              onClick={() => handleSelect(c)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: selected === c.id ? 'var(--color-text-info)' : 'var(--color-text-primary)',
                background: selected === c.id ? 'var(--color-background-info)' : 'transparent',
                borderLeft: selected === c.id ? '2px solid var(--color-border-info)' : '2px solid transparent',
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          <button
            onClick={handleNew}
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
      </div>

      {/* Formulario */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
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
      </div>

    </div>
  )
}
