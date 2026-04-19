import { useState, useEffect } from 'react'

function fmtDuration(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}m`
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtAmount(sec, rate) {
  if (!sec || !rate) return '—'
  return `$${((sec / 3600) * rate).toFixed(2)} USD`
}

function totalSec(entries) {
  return entries.reduce((a, e) => a + (e.duration_sec || 0), 0)
}

function totalAmt(entries) {
  return entries.reduce((a, e) => {
    if (!e.duration_sec || !e.rate_usd) return a
    return a + (e.duration_sec / 3600) * e.rate_usd
  }, 0)
}

export default function Report() {
  const [data, setData] = useState(null)

  useEffect(() => {
    window.timebill.report.getData().then(setData)
  }, [])

  if (!data) return null

  const { entries = [], clientName, from, to } = data
  const secTotal = totalSec(entries)
  const amtTotal = totalAmt(entries)
  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>TimeBill</div>
          <div style={styles.brandSub}>Registro de horas profesionales</div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.reportLabel}>INFORME DE HORAS</div>
          <div style={styles.reportDate}>Emitido: {today}</div>
        </div>
      </div>

      {/* Meta */}
      <div style={styles.meta}>
        <div style={styles.metaBlock}>
          <div style={styles.metaLabel}>CLIENTE</div>
          <div style={styles.metaValue}>{clientName}</div>
        </div>
        <div style={styles.metaBlock}>
          <div style={styles.metaLabel}>PERÍODO</div>
          <div style={styles.metaValue}>{fmtDate(from)} — {fmtDate(to)}</div>
        </div>
        <div style={styles.metaBlock}>
          <div style={styles.metaLabel}>ENTRADAS</div>
          <div style={styles.metaValue}>{entries.length}</div>
        </div>
      </div>

      {/* Tabla */}
      <table style={styles.table}>
        <thead>
          <tr>
            {['Inicio', 'Fin', 'Tipo de tarea', 'Duración', 'Importe', 'Origen'].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
              <td style={styles.td}>{fmtDateTime(e.started_at)}</td>
              <td style={styles.td}>{fmtDateTime(e.ended_at)}</td>
              <td style={styles.td}>{e.task_type || '—'}</td>
              <td style={{ ...styles.td, ...styles.tdMono }}>{fmtDuration(e.duration_sec)}</td>
              <td style={{ ...styles.td, ...styles.tdMono, color: '#1a6640' }}>{fmtAmount(e.duration_sec, e.rate_usd)}</td>
              <td style={styles.td}>
                <span style={e.source === 'manual' ? styles.badgeManual : styles.badgeAuto}>
                  {e.source === 'manual' ? 'Manual' : 'Auto'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={styles.totalsWrap}>
        <div style={styles.totals}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Total horas trabajadas</span>
            <span style={styles.totalValue}>{fmtDuration(secTotal)}</span>
          </div>
          <div style={styles.totalDivider} />
          <div style={styles.totalRow}>
            <span style={styles.totalLabelBig}>Total a facturar</span>
            <span style={styles.totalValueBig}>${amtTotal.toFixed(2)} USD</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span>Generado con TimeBill — tracking automático de horas para estudios jurídicos</span>
      </div>
    </div>
  )
}

const styles = {
  page: {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: '11px',
    color: '#1a1a2e',
    background: '#ffffff',
    padding: '40px 48px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    paddingBottom: '20px',
    borderBottom: '2px solid #1a1a2e',
  },
  brand: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.5px',
  },
  brandSub: {
    fontSize: '10px',
    color: '#666',
    marginTop: '2px',
    letterSpacing: '0.05em',
  },
  headerRight: { textAlign: 'right' },
  reportLabel: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#1a1a2e',
  },
  reportDate: {
    fontSize: '10px',
    color: '#666',
    marginTop: '3px',
  },
  meta: {
    display: 'flex',
    gap: '0',
    marginBottom: '24px',
    background: '#f5f6fa',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #e0e2ea',
  },
  metaBlock: {
    flex: 1,
    padding: '12px 16px',
    borderRight: '1px solid #e0e2ea',
  },
  metaLabel: {
    fontSize: '9px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  metaValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a2e',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '24px',
  },
  th: {
    fontSize: '9px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    textAlign: 'left',
    padding: '8px 10px',
    background: '#f5f6fa',
    borderBottom: '1px solid #e0e2ea',
    borderTop: '1px solid #e0e2ea',
  },
  td: {
    padding: '7px 10px',
    fontSize: '10px',
    color: '#2a2a3e',
    borderBottom: '1px solid #eef0f5',
    verticalAlign: 'middle',
  },
  trEven: { background: '#ffffff' },
  trOdd:  { background: '#fafbff' },
  tdMono: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '10px',
  },
  badgeAuto: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    background: '#e8eeff',
    color: '#2a52be',
  },
  badgeManual: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    background: '#e6f7ef',
    color: '#1a6640',
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '32px',
  },
  totals: {
    width: '260px',
    background: '#f5f6fa',
    border: '1px solid #e0e2ea',
    borderRadius: '4px',
    padding: '14px 18px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  },
  totalLabel: {
    fontSize: '10px',
    color: '#666',
  },
  totalValue: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '11px',
    fontWeight: '600',
    color: '#1a1a2e',
  },
  totalDivider: {
    height: '1px',
    background: '#e0e2ea',
    margin: '8px 0',
  },
  totalLabelBig: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#1a1a2e',
  },
  totalValueBig: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a6640',
  },
  footer: {
    borderTop: '1px solid #e0e2ea',
    paddingTop: '12px',
    fontSize: '9px',
    color: '#aaa',
    textAlign: 'center',
  },
}
