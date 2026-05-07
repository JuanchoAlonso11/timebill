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

function fmtAmount(sec, rateUsd) {
  if (!sec || !rateUsd) return '—'
  return `$${((sec / 3600) * rateUsd).toFixed(0)} USD`
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
  const [role, setRole]             = useState(null)
  const [adminView, setAdminView]   = useState('area') // 'area' | 'personal'

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

  // ─── Reporte ────────────────────────────────────────────────────────────────

  const generateReport = async () => {
    if (activeClient === 'all' || filtered.length === 0) return
    setGenerating(true)
    try {
      const { from, to } = getRange()
      const client = clients.find(c => c.id === activeClient)
      const result = await window.timebill.report.generate({
        entries: filtered,
        clientName: client?.name || activeClient,
        from,
        to,
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
          <span className="logo">TimeBill</span>
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
                  onClick={generateReport}
                  disabled={generating || filtered.length === 0}
                >
                  {generating ? '⏳ Generando…' : '📄 Generar reporte'}
                </button>
              </>
            )}
          </div>

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
                    <th>Fecha</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Cliente</th>
                    {role === 'admin' && adminView === 'area' && <th>Empleado</th>}
                    <th>Tipo</th>
                    <th>Duración</th>
                    <th>Importe</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td className="td-mono">{fmtDate(e.started_at)}</td>
                      <td className="td-mono">{fmtTime(e.started_at)}</td>
                      <td className="td-mono">{fmtTime(e.ended_at)}</td>
                      <td className="td-client">{e.client_name || '—'}</td>
                      {role === 'admin' && adminView === 'area' && (
                        <td style={{ fontSize: 11, color: e.is_own ? 'var(--color-text-info)' : 'var(--color-text-secondary)' }}>
                          {e.is_own ? 'Yo' : (e.user_email || '—')}
                        </td>
                      )}
                      <td>{e.task_type || '—'}</td>
                      <td className="td-duration">{fmtDuration(e.duration_sec)}</td>
                      <td className="td-amount">{fmtAmount(e.duration_sec, e.rate_usd)}</td>
                      <td>
                        <span className={`badge badge-${e.source === 'manual' ? 'manual' : 'auto'}`}>
                          {e.source === 'manual' ? 'manual' : 'auto'}
                        </span>
                      </td>
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
