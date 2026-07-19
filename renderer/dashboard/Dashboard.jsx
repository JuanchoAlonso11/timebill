import { useState, useEffect, useCallback } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function rangeFor(key) {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  if (key === 'hoy') {
    return {
      from: new Date(y, m, d, 0, 0, 0).toISOString(),
      to:   new Date(y, m, d, 23, 59, 59).toISOString(),
    }
  }
  if (key === 'semana') {
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
    const mon = new Date(y, m, d - dow, 0, 0, 0)
    const sun = new Date(y, m, d - dow + 6, 23, 59, 59)
    return { from: mon.toISOString(), to: sun.toISOString() }
  }
  if (key === 'mes') {
    return {
      from: new Date(y, m, 1, 0, 0, 0).toISOString(),
      to:   new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    }
  }
  return null
}

function fmtDuration(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// fecha_cobro viene como 'YYYY-MM-DD' (tipo date). La parseamos a mano para
// evitar el corrimiento de día por timezone que hace new Date('YYYY-MM-DD').
function fmtCobroDate(d) {
  if (!d) return ''
  const [, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}`
}

// Helpers para precargar inputs date/time desde un ISO, en hora LOCAL
function toLocalDateInput(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function toLocalTimeInput(d) {
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${mi}`
}
// Fecha + hora local legible para el historial de cambios
function fmtFullLocal(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function fmtAmount(sec, rateUsd) {
  if (!sec || !rateUsd) return '—'
  return `$${((sec / 3600) * rateUsd).toFixed(0)} USD`
}

// Monto en pesos con la cotización del blue CONGELADA al momento de la tarea.
function fmtArs(sec, rateUsd, blueVenta) {
  if (!sec || !rateUsd || !blueVenta) return '—'
  const ars = (sec / 3600) * rateUsd * blueVenta
  return `$${Math.round(ars).toLocaleString('es-AR')}`
}

function totalSec(entries) {
  return entries.reduce((acc, e) => acc + (e.duration_sec || 0), 0)
}

function totalAmount(entries) {
  return entries.reduce((acc, e) => {
    if (!e.duration_sec || !e.rate_usd) return acc
    return acc + (e.duration_sec / 3600) * e.rate_usd
  }, 0)
}

// ─── Component ────────────────────────────────────────────────────────────────

const RANGE_TABS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes' },
  { key: 'custom', label: 'Custom' },
]

export default function Dashboard() {
  const [tab, setTab]         = useState('hoy')
  const [customFrom, setFrom] = useState(toISODate(new Date()))
  const [customTo, setTo]     = useState(toISODate(new Date()))
  const [entries, setEntries] = useState([])
  const [clients, setClients] = useState([])
  const [activeClient, setActiveClient] = useState('all')
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportResult, setReportResult] = useState(null)
  const [showReportChoice, setShowReportChoice] = useState(false)
  const [reportCurrency, setReportCurrency] = useState('usd') // 'usd' | 'ars' | 'ambos'

  // ─── Cotización manual (fase C) ───────────────────────────────────────
  const [showBlueModal, setShowBlueModal] = useState(false)
  const [blueInput, setBlueInput] = useState('')
  const [blueSaving, setBlueSaving] = useState(false)
  const [role, setRole]             = useState(null)
  const [adminView, setAdminView]   = useState('area') // 'area' | 'personal'

  // ─── Cobrado (feature 2) ──────────────────────────────────────────────
  const [selected, setSelected]   = useState(() => new Set()) // ids seleccionados
  const [cobroDate, setCobroDate] = useState(toISODate(new Date())) // hoy por defecto
  const [marking, setMarking]     = useState(false)

  // ─── Registro manual (feature 3) ──────────────────────────────────────
  const [showManualModal, setShowManualModal] = useState(false)
  const [clientOptions, setClientOptions]     = useState([])
  const [typeOptions, setTypeOptions]         = useState([])
  const [mClient, setMClient] = useState('')
  const [mType, setMType]     = useState('')
  const [mDate, setMDate]     = useState(toISODate(new Date()))
  const [mStart, setMStart]   = useState('')
  const [mEnd, setMEnd]       = useState('')
  const [mSaving, setMSaving] = useState(false)

  // ─── Edición de tarea (feature 4) ─────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState(null)
  const [eClient, setEClient] = useState('')
  const [eType, setEType]     = useState('')
  const [eDate, setEDate]     = useState('')
  const [eStart, setEStart]   = useState('')
  const [eEnd, setEEnd]       = useState('')
  const [eNote, setENote]     = useState('')
  const [eSaving, setESaving] = useState(false)
  const [editHistory, setEditHistory] = useState([])

  const getRange = useCallback(() => {
    if (tab === 'custom') {
      return {
        from: new Date(customFrom + 'T00:00:00').toISOString(),
        to:   new Date(customTo   + 'T23:59:59').toISOString(),
      }
    }
    return rangeFor(tab)
  }, [tab, customFrom, customTo])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = getRange()
      const data = await window.timebill.dashboard.getData(from, to)
      setEntries(data.entries || [])
      setClients(data.clients || [])
      if (data.role) setRole(data.role)
    } catch (e) {
      console.error('[dashboard] Error:', e)
    } finally {
      setLoading(false)
    }
  }, [getRange])

  useEffect(() => { load() }, [load])

  // Datos derivados
  // Para admin en vista personal, filtrar solo sus propias entradas
  const visibleEntries = (role === 'admin' && adminView === 'personal')
    ? entries.filter(e => e.is_own)
    : entries

  const filtered = activeClient === 'all'
    ? visibleEntries
    : visibleEntries.filter(e => e.client_id === activeClient)

  const byClient = clients.map(c => {
    const ces = visibleEntries.filter(e => e.client_id === c.id)
    return { ...c, entries: ces, totalSec: totalSec(ces), totalAmt: totalAmount(ces) }
  }).filter(c => c.entries.length > 0)

  const globalSec = totalSec(filtered)
  const globalAmt = totalAmount(filtered)

  // ─── Cobrado: selección y marcado ─────────────────────────────────────────

  // Limpiar selección al cambiar de vista, cliente o rango (evita ids fantasma)
  useEffect(() => { setSelected(new Set()) }, [adminView, activeClient, tab, customFrom, customTo])

  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map(e => e.id)))
  }

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const markCobrado = async (cobrado) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setMarking(true)
    try {
      const res = await window.timebill.dashboard.setCobrado(ids, cobrado, cobrado ? cobroDate : null)
      if (res?.error) {
        alert(res.error)
        return
      }
      setSelected(new Set())
      await load()
    } catch (e) {
      console.error('[cobrado] Error:', e)
      alert('No se pudo actualizar. Revisá la conexión.')
    } finally {
      setMarking(false)
    }
  }

  // ─── Cotización manual ────────────────────────────────────────────────

  const saveBlue = async () => {
    const val = Number(String(blueInput).replace(',', '.'))
    if (!Number.isFinite(val) || val <= 0) {
      alert('Ingresá una cotización válida (mayor a 0).')
      return
    }
    setBlueSaving(true)
    try {
      const res = await window.timebill.dashboard.setEntryBlue([...selected], val)
      if (res?.error) { alert(res.error); return }
      setShowBlueModal(false)
      setBlueInput('')
      setSelected(new Set())
      await load()
    } catch (e) {
      console.error('[blue] Error:', e)
      alert('No se pudo guardar la cotización.')
    } finally {
      setBlueSaving(false)
    }
  }

  // ─── Registro manual ──────────────────────────────────────────────────

  const openManualModal = async () => {
    setShowManualModal(true)
    try {
      const [cls, tps] = await Promise.all([
        window.timebill.clients.getAll(),
        window.timebill.config.getTaskTypes(),
      ])
      setClientOptions(cls || [])
      setTypeOptions(tps || [])
    } catch (e) {
      console.error('[manual] Error cargando opciones:', e)
    }
  }

  // Duración calculada en vivo para el preview (null si los datos no son válidos)
  const manualDurationSec = (() => {
    if (!mDate || !mStart || !mEnd) return null
    const s = new Date(`${mDate}T${mStart}:00`)
    const e = new Date(`${mDate}T${mEnd}:00`)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
    return Math.round((e - s) / 1000)
  })()

  const saveManual = async () => {
    if (!mClient) { alert('Elegí un cliente.'); return }
    if (!mType)   { alert('Elegí un tipo de tarea.'); return }
    if (!mDate || !mStart || !mEnd) { alert('Completá fecha, hora de inicio y de fin.'); return }

    const startedAt = new Date(`${mDate}T${mStart}:00`)
    const endedAt   = new Date(`${mDate}T${mEnd}:00`)
    if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) { alert('Fecha u hora inválida.'); return }
    if (endedAt <= startedAt) { alert('La hora de fin debe ser posterior a la de inicio.'); return }

    setMSaving(true)
    try {
      const res = await window.timebill.dashboard.addManualEntry({
        clientId: mClient,
        taskType: mType,
        startedAt: startedAt.toISOString(),
        endedAt:   endedAt.toISOString(),
      })
      if (res?.error) { alert(res.error); return }
      setShowManualModal(false)
      // reset del formulario (la fecha la dejamos en hoy)
      setMClient(''); setMType(''); setMStart(''); setMEnd(''); setMDate(toISODate(new Date()))
      await load()
    } catch (e) {
      console.error('[manual] Error:', e)
      alert('No se pudo guardar la tarea.')
    } finally {
      setMSaving(false)
    }
  }

  // ─── Edición de tarea ─────────────────────────────────────────────────

  const openEditModal = async () => {
    if (selected.size !== 1) return
    const id = [...selected][0]
    const entry = visibleEntries.find(e => e.id === id)
    if (!entry) return

    const s = new Date(entry.started_at)
    const e2 = new Date(entry.ended_at)
    setEditingEntry(entry)
    setEClient(entry.client_id || '')
    setEType(entry.task_type || '')
    setEDate(toLocalDateInput(s))
    setEStart(toLocalTimeInput(s))
    setEEnd(toLocalTimeInput(e2))
    setENote(entry.note || '')
    setEditHistory([])

    try {
      const [cls, tps, hist] = await Promise.all([
        window.timebill.clients.getAll(),
        window.timebill.config.getTaskTypes(),
        window.timebill.dashboard.getEntryEdits(id),
      ])
      setClientOptions(cls || [])
      setTypeOptions(tps || [])
      setEditHistory(hist || [])
    } catch (e) {
      console.error('[edit] Error cargando datos:', e)
    }
  }

  const editDurationSec = (() => {
    if (!eDate || !eStart || !eEnd) return null
    const s = new Date(`${eDate}T${eStart}:00`)
    const e = new Date(`${eDate}T${eEnd}:00`)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
    return Math.round((e - s) / 1000)
  })()

  const saveEdit = async () => {
    if (!editingEntry) return
    if (!eClient) { alert('Elegí un cliente.'); return }
    if (!eType)   { alert('Elegí un tipo de tarea.'); return }
    if (!eDate || !eStart || !eEnd) { alert('Completá fecha y horas.'); return }

    const startedAt = new Date(`${eDate}T${eStart}:00`)
    const endedAt   = new Date(`${eDate}T${eEnd}:00`)
    if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) { alert('Fecha u hora inválida.'); return }
    if (endedAt <= startedAt) { alert('La hora de fin debe ser posterior a la de inicio.'); return }

    // Calcular el diff legible (campo, viejo → nuevo) solo de lo que cambió
    const orig = editingEntry
    const changes = []

    if (eClient !== (orig.client_id || '')) {
      const oldName = orig.client_name || orig.client_id || '(ninguno)'
      const newName = clientOptions.find(c => c.id === eClient)?.name || eClient
      changes.push({ field: 'cliente', oldValue: oldName, newValue: newName })
    }
    if (eType !== (orig.task_type || '')) {
      const oldLabel = typeOptions.find(t => t.value === orig.task_type)?.label || orig.task_type || '(ninguno)'
      const newLabel = typeOptions.find(t => t.value === eType)?.label || eType
      changes.push({ field: 'tipo', oldValue: oldLabel, newValue: newLabel })
    }
    if (startedAt.toISOString() !== new Date(orig.started_at).toISOString()) {
      changes.push({ field: 'inicio', oldValue: fmtFullLocal(orig.started_at), newValue: fmtFullLocal(startedAt.toISOString()) })
    }
    if (endedAt.toISOString() !== new Date(orig.ended_at).toISOString()) {
      changes.push({ field: 'fin', oldValue: fmtFullLocal(orig.ended_at), newValue: fmtFullLocal(endedAt.toISOString()) })
    }
    if ((eNote || '') !== (orig.note || '')) {
      changes.push({ field: 'nota', oldValue: orig.note || '(vacío)', newValue: eNote || '(vacío)' })
    }

    if (changes.length === 0) {
      setEditingEntry(null)
      setSelected(new Set())
      return
    }

    setESaving(true)
    try {
      const res = await window.timebill.dashboard.editEntry({
        id: orig.id,
        clientId: eClient,
        taskType: eType,
        startedAt: startedAt.toISOString(),
        endedAt:   endedAt.toISOString(),
        note: eNote || null,
        changes,
      })
      if (res?.error) { alert(res.error); return }
      setEditingEntry(null)
      setSelected(new Set())
      await load()
    } catch (e) {
      console.error('[edit] Error:', e)
      alert('No se pudo editar la tarea.')
    } finally {
      setESaving(false)
    }
  }

  // ─── Reporte ────────────────────────────────────────────────────────────────

  const generateReport = async (cobroFilter = 'all') => {
    if (activeClient === 'all') return

    // Filtrar por estado de cobro según lo elegido en el popup
    const reportEntries = cobroFilter === 'pending'
      ? filtered.filter(e => !e.cobrado)
      : filtered

    setShowReportChoice(false)

    if (reportEntries.length === 0) {
      alert('No hay entradas para ese filtro en este período.')
      return
    }

    // Si el reporte incluye pesos, todas las entradas necesitan cotización congelada
    if (reportCurrency !== 'usd') {
      const sinCotizacion = reportEntries.filter(e => !e.blue_venta).length
      if (sinCotizacion > 0) {
        const seguir = confirm(
          `${sinCotizacion} de ${reportEntries.length} tarea(s) no tienen cotización congelada y van a figurar sin monto en pesos.\n\n¿Generar igual?`
        )
        if (!seguir) return
      }
    }

    setGenerating(true)
    try {
      const { from, to } = getRange()
      const client = clients.find(c => c.id === activeClient)
      const result = await window.timebill.report.generate({
        entries: reportEntries,
        clientName: client?.name || activeClient,
        from,
        to,
        currency: reportCurrency,
      })
      setReportResult(result)
    } catch (e) {
      console.error('[report] Error:', e)
    } finally {
      setGenerating(false)
    }
  }

  const saveReport = async () => {
    if (!reportResult) return
    await window.timebill.report.save({ filePath: reportResult.filePath, fileName: reportResult.fileName })
  }

  const sendWhatsApp = () => {
    if (!reportResult) return
    const client = clients.find(c => c.id === activeClient)
    const h = Math.floor(globalSec / 3600)
    const m = Math.floor((globalSec % 3600) / 60)
    const hoursStr = h > 0 ? `${h}h ${m}m` : `${m}m`
    const message =
      `Hola! Te comparto el resumen de horas trabajadas:\n\n` +
      `📋 *${client?.name || activeClient}*\n` +
      `🕐 Total: ${hoursStr}\n` +
      `💵 Importe: $${globalAmt.toFixed(2)} USD\n\n` +
      `Te envío el informe detallado en PDF.`
    window.timebill.report.whatsapp({ message })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo">Smart Hours</span>
          <div className="sep" />
          <div className="range-tabs">
            {RANGE_TABS.map(t => (
              <button
                key={t.key}
                className={`range-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
              >{t.label}</button>
            ))}
          </div>
          {tab === 'custom' && (
            <div className="custom-range">
              <input type="date" className="date-input" value={customFrom} onChange={e => setFrom(e.target.value)} />
              <span className="date-sep">→</span>
              <input type="date" className="date-input" value={customTo}   onChange={e => setTo(e.target.value)} />
            </div>
          )}
        </div>
        <div className="topbar-right">
          {role === 'admin' && (
            <div className="range-tabs" style={{ marginRight: 8 }}>
              <button
                className={`range-tab${adminView === 'area' ? ' active' : ''}`}
                onClick={() => setAdminView('area')}
              >Área</button>
              <button
                className={`range-tab${adminView === 'personal' ? ' active' : ''}`}
                onClick={() => setAdminView('personal')}
              >Mis horas</button>
            </div>
          )}
          <button className="refresh-btn" onClick={openManualModal} style={{ marginRight: 8 }}>+ Registrar tarea</button>
          <button className="refresh-btn" onClick={load}>↻ Actualizar</button>
        </div>
      </header>

      <div className="content">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-label">Clientes</div>

          <div
            className={`total-card all-card${activeClient === 'all' ? ' active' : ''}`}
            onClick={() => setActiveClient('all')}
          >
            <div className="card-name">Todos los clientes</div>
            <div className="card-stats">
              <div className="card-hours">{fmtDuration(totalSec(entries))}</div>
              <div className="card-amount">${totalAmount(entries).toFixed(0)} USD</div>
            </div>
            <div className="card-entries">{entries.length} entradas</div>
          </div>

          {byClient.length > 0 && <div className="sidebar-divider" />}

          {byClient.map(c => (
            <div
              key={c.id}
              className={`total-card${activeClient === c.id ? ' active' : ''}`}
              onClick={() => setActiveClient(c.id)}
            >
              <div className="card-name">{c.name}</div>
              <div className="card-stats">
                <div className="card-hours">{fmtDuration(c.totalSec)}</div>
                <div className="card-amount">${c.totalAmt.toFixed(0)} USD</div>
              </div>
              <div className="card-entries">{c.entries.length} entrada{c.entries.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </aside>

        {/* Main */}
        <main className="main">
          {/* Summary bar */}
          <div className="summary-bar">
            <div className="summary-stat">
              <span className="summary-label">Total horas</span>
              <span className="summary-value">{fmtDuration(globalSec)}</span>
            </div>
            <div className="summary-bar-sep" />
            <div className="summary-stat">
              <span className="summary-label">Facturado</span>
              <span className="summary-value green">${globalAmt.toFixed(0)} USD</span>
            </div>
            <div className="summary-bar-sep" />
            <div className="summary-stat">
              <span className="summary-label">Entradas</span>
              <span className="summary-value">{filtered.length}</span>
            </div>
            {activeClient !== 'all' && (
              <>
                <div className="summary-bar-sep" />
                <button
                  className={`report-btn${generating ? ' report-btn-loading' : ''}`}
                  onClick={() => setShowReportChoice(true)}
                  disabled={generating || filtered.length === 0}
                >
                  {generating ? '⏳ Generando…' : '📄 Generar reporte'}
                </button>
              </>
            )}
          </div>

          {/* Popup: elegir qué incluir en el reporte */}
          {showReportChoice && (
            <div className="report-modal-overlay" onClick={() => setShowReportChoice(false)}>
              <div className="report-modal" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
                <div className="report-modal-title">Generar reporte</div>

                {/* Moneda */}
                <div style={{ width: '100%', marginTop: 10 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6,
                  }}>Moneda</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { key: 'usd',   label: 'Solo USD' },
                      { key: 'ars',   label: 'Solo ARS' },
                      { key: 'ambos', label: 'Ambas' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setReportCurrency(opt.key)}
                        style={{
                          flex: 1, padding: '7px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                          fontWeight: reportCurrency === opt.key ? 600 : 400,
                          background: reportCurrency === opt.key ? 'var(--accent)' : 'transparent',
                          color: reportCurrency === opt.key ? '#fff' : 'var(--text-dim)',
                          border: `1px solid ${reportCurrency === opt.key ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alcance */}
                <div style={{ width: '100%', marginTop: 14 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6,
                  }}>Qué incluir</div>
                  <div className="report-modal-actions" style={{ flexDirection: 'column', gap: 8, marginTop: 0 }}>
                    <button className="report-action-btn report-action-save" onClick={() => generateReport('all')}>
                      Todas las horas ({filtered.length})
                    </button>
                    <button className="report-action-btn report-action-wa" onClick={() => generateReport('pending')}>
                      Solo pendientes de cobro ({filtered.filter(e => !e.cobrado).length})
                    </button>
                  </div>
                </div>

                <button className="report-modal-close" onClick={() => setShowReportChoice(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Modal: setear cotización a mano */}
          {showBlueModal && (
            <div className="report-modal-overlay" onClick={() => !blueSaving && setShowBlueModal(false)}>
              <div className="report-modal" onClick={e => e.stopPropagation()} style={{ width: 340 }}>
                <div className="report-modal-title" style={{ marginBottom: 6 }}>Setear cotización</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 12 }}>
                  Se aplica a {selected.size} tarea{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}.
                </div>

                <div className="manual-form">
                  <label className="manual-field-label">
                    Dólar blue (venta)
                    <input
                      className="manual-field"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 1350"
                      value={blueInput}
                      onChange={e => setBlueInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !blueSaving) saveBlue() }}
                      autoFocus
                    />
                  </label>
                </div>

                <div className="report-modal-actions" style={{ marginTop: 14 }}>
                  <button
                    className="report-action-btn report-action-save"
                    onClick={saveBlue}
                    disabled={blueSaving}
                    style={{ opacity: blueSaving ? 0.6 : 1 }}
                  >
                    {blueSaving ? '⏳ Guardando…' : '💾 Aplicar cotización'}
                  </button>
                </div>
                <button className="report-modal-close" onClick={() => !blueSaving && setShowBlueModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Modal: registrar tarea manual */}
          {showManualModal && (
            <div className="report-modal-overlay" onClick={() => !mSaving && setShowManualModal(false)}>
              <div className="report-modal" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
                <div className="report-modal-title" style={{ marginBottom: 14 }}>Registrar tarea</div>

                <div className="manual-form">
                  <label className="manual-field-label">
                    Cliente
                    <select className="manual-field" value={mClient} onChange={e => setMClient(e.target.value)}>
                      <option value="">— Elegí un cliente —</option>
                      {clientOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="manual-field-label">
                    Tipo de tarea
                    <select className="manual-field" value={mType} onChange={e => setMType(e.target.value)}>
                      <option value="">— Elegí un tipo —</option>
                      {typeOptions.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="manual-field-label">
                    Fecha
                    <input className="manual-field" type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
                  </label>

                  <div className="manual-row">
                    <label className="manual-field-label">
                      Hora inicio
                      <input className="manual-field" type="time" value={mStart} onChange={e => setMStart(e.target.value)} />
                    </label>
                    <label className="manual-field-label">
                      Hora fin
                      <input className="manual-field" type="time" value={mEnd} onChange={e => setMEnd(e.target.value)} />
                    </label>
                  </div>

                  <div className="manual-duration">
                    {manualDurationSec !== null
                      ? <>Duración: <strong>{fmtDuration(manualDurationSec)}</strong></>
                      : (mStart && mEnd ? 'La hora de fin debe ser posterior a la de inicio.' : 'Completá las horas para ver la duración.')}
                  </div>
                </div>

                <div className="report-modal-actions" style={{ marginTop: 16 }}>
                  <button
                    className="report-action-btn report-action-save"
                    onClick={saveManual}
                    disabled={mSaving}
                    style={{ opacity: mSaving ? 0.6 : 1 }}
                  >
                    {mSaving ? '⏳ Guardando…' : '💾 Guardar tarea'}
                  </button>
                </div>
                <button className="report-modal-close" onClick={() => !mSaving && setShowManualModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Modal: editar tarea */}
          {editingEntry && (
            <div className="report-modal-overlay" onClick={() => !eSaving && setEditingEntry(null)}>
              <div className="report-modal" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
                <div className="report-modal-title" style={{ marginBottom: 14 }}>Editar tarea</div>

                <div className="manual-form">
                  <label className="manual-field-label">
                    Cliente
                    <select className="manual-field" value={eClient} onChange={e => setEClient(e.target.value)}>
                      <option value="">— Elegí un cliente —</option>
                      {clientOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="manual-field-label">
                    Tipo de tarea
                    <select className="manual-field" value={eType} onChange={e => setEType(e.target.value)}>
                      <option value="">— Elegí un tipo —</option>
                      {typeOptions.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="manual-field-label">
                    Fecha
                    <input className="manual-field" type="date" value={eDate} onChange={e => setEDate(e.target.value)} />
                  </label>

                  <div className="manual-row">
                    <label className="manual-field-label">
                      Hora inicio
                      <input className="manual-field" type="time" value={eStart} onChange={e => setEStart(e.target.value)} />
                    </label>
                    <label className="manual-field-label">
                      Hora fin
                      <input className="manual-field" type="time" value={eEnd} onChange={e => setEEnd(e.target.value)} />
                    </label>
                  </div>

                  <label className="manual-field-label">
                    Nota / observación
                    <textarea
                      className="manual-field"
                      rows={2}
                      value={eNote}
                      onChange={e => setENote(e.target.value)}
                      placeholder="Opcional"
                      style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                    />
                  </label>

                  <div className="manual-duration">
                    {editDurationSec !== null
                      ? <>Duración: <strong>{fmtDuration(editDurationSec)}</strong></>
                      : 'La hora de fin debe ser posterior a la de inicio.'}
                  </div>

                  {editHistory.length > 0 && (
                    <div className="edit-history">
                      <div className="edit-history-title">Historial de cambios</div>
                      {editHistory.map(h => (
                        <div key={h.id} className="edit-history-row">
                          <span className="edit-history-meta">
                            {fmtFullLocal(h.edited_at)} · {h.editor_email || 'usuario'}
                          </span>
                          <span className="edit-history-change">
                            <strong>{h.field}</strong>: {h.old_value || '(vacío)'} → {h.new_value || '(vacío)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="report-modal-actions" style={{ marginTop: 16 }}>
                  <button
                    className="report-action-btn report-action-save"
                    onClick={saveEdit}
                    disabled={eSaving}
                    style={{ opacity: eSaving ? 0.6 : 1 }}
                  >
                    {eSaving ? '⏳ Guardando…' : '💾 Guardar cambios'}
                  </button>
                </div>
                <button className="report-modal-close" onClick={() => !eSaving && setEditingEntry(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Modal reporte */}
          {reportResult && (
            <div className="report-modal-overlay" onClick={() => setReportResult(null)}>
              <div className="report-modal" onClick={e => e.stopPropagation()}>
                <div className="report-modal-icon">✅</div>
                <div className="report-modal-title">Reporte generado</div>
                <div className="report-modal-file">{reportResult.fileName}</div>
                <div className="report-modal-actions">
                  <button className="report-action-btn report-action-save" onClick={saveReport}>
                    💾 Guardar PDF
                  </button>
                  <button className="report-action-btn report-action-wa" onClick={sendWhatsApp}>
                    💬 Enviar por WhatsApp
                  </button>
                </div>
                <button className="report-modal-close" onClick={() => setReportResult(null)}>Cerrar</button>
              </div>
            </div>
          )}

          {/* Barra de cobro (solo admin, cuando hay selección) */}
          {selected.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '10px 14px', marginBottom: 10,
              background: 'rgba(52, 211, 153, 0.08)',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              borderRadius: 8,
            }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
              </span>

              {/* Controles de cobro: solo admin */}
              {role === 'admin' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Fecha de cobro:</label>
                  <input
                    type="date"
                    className="date-input"
                    value={cobroDate}
                    onChange={e => setCobroDate(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {/* Setear cotización a mano (ambos roles) */}
                <button
                  onClick={() => { setBlueInput(''); setShowBlueModal(true) }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text)',
                    border: '1px solid rgba(255,255,255,0.15)', fontSize: 12,
                  }}
                >
                  💵 Cotización
                </button>
                {/* Editar: cuando hay exactamente una seleccionada (cualquier rol) */}
                {selected.size === 1 && (
                  <button
                    onClick={openEditModal}
                    style={{
                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      fontWeight: 600, fontSize: 12,
                    }}
                  >
                    ✏️ Editar
                  </button>
                )}

                {role === 'admin' && (
                  <>
                    <button
                      onClick={() => markCobrado(true)}
                      disabled={marking}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: '#10b981', color: '#04241a', fontWeight: 600, fontSize: 12,
                        opacity: marking ? 0.6 : 1,
                      }}
                    >
                      {marking ? '⏳…' : '✓ Marcar cobradas'}
                    </button>
                    <button
                      onClick={() => markCobrado(false)}
                      disabled={marking}
                      style={{
                        padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', color: 'var(--text-dim)',
                        border: '1px solid rgba(255,255,255,0.15)', fontSize: 12,
                        opacity: marking ? 0.6 : 1,
                      }}
                    >
                      Marcar pendientes
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelected(new Set())}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-dim)',
                    border: '1px solid rgba(255,255,255,0.15)', fontSize: 12,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="table-wrap">
            {loading ? (
              <div className="loading">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">◌</div>
                <div className="empty-text">Sin entradas para este período</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        title="Seleccionar todo"
                      />
                    </th>
                    <th>Fecha</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Cliente</th>
                    {role === 'admin' && adminView === 'area' && <th>Empleado</th>}
                    <th>Tipo</th>
                    <th>Nota</th>
                    <th>Duración</th>
                    <th>Importe</th>
                    <th>ARS (blue)</th>
                    <th>Origen</th>
                    {role === 'admin' && <th>Cobrado</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr
                      key={e.id}
                      style={{ background: selected.has(e.id) ? 'rgba(52,211,153,0.06)' : undefined }}
                    >
                      <td style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggleOne(e.id)}
                        />
                      </td>
                      <td className="td-mono">{fmtDate(e.started_at)}</td>
                      <td className="td-mono">{fmtTime(e.started_at)}</td>
                      <td className="td-mono">{fmtTime(e.ended_at)}</td>
                      <td className="td-client">{e.client_name || '—'}</td>
                      {role === 'admin' && adminView === 'area' && (
                        <td style={{ fontSize: 11, color: e.is_own ? 'var(--accent)' : 'var(--text-dim)' }}>
                          {e.is_own ? 'Yo' : (e.user_email || '—')}
                        </td>
                      )}
                      <td>{e.task_type || '—'}</td>
                      <td
                        title={e.note || ''}
                        style={{
                          maxWidth: 180,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: e.note ? 'var(--text)' : 'var(--text-dim)',
                          fontSize: 12,
                        }}
                      >
                        {e.note || '—'}
                      </td>
                      <td className="td-duration">{fmtDuration(e.duration_sec)}</td>
                      <td className="td-amount">{fmtAmount(e.duration_sec, e.rate_usd)}</td>
                      <td
                        className="td-mono"
                        title={e.blue_venta ? `Blue venta congelado: $${e.blue_venta}` : 'Sin cotización congelada'}
                        style={{ whiteSpace: 'nowrap', color: e.blue_venta ? 'var(--text)' : 'var(--text-dim)', fontSize: 11 }}
                      >
                        {fmtArs(e.duration_sec, e.rate_usd, e.blue_venta)}
                      </td>
                      <td>
                        <span className={`badge badge-${e.source === 'manual' ? 'manual' : 'auto'}`}>
                          {e.source === 'manual' ? 'manual' : 'auto'}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td>
                          {e.cobrado ? (
                            <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              ✓ {fmtCobroDate(e.fecha_cobro)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                              Pendiente
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
