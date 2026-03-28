// electron/windowMonitor.js
// Hace polling de la ventana activa del OS cada 3 segundos.
// Cuando cambia el título, dispara el motor de reglas.
// Si hay match → arranca/cambia timer. Si no → cierra entrada activa.

const { matchWindow } = require('./ruleEngine')
const { startEntry, stopEntry, recordActivity, getActiveEntry } = require('./timer')

const POLL_INTERVAL_MS = 3_000
const MIN_WINDOW_TIME_MS = 8_000 // ignora ventanas activas por menos de 8s (cambios rápidos)

let pollInterval = null
let lastTitle = null
let titleSince = null   // timestamp desde el que el título actual está activo
let onDetectionCallback = null  // avisa a main.js para mostrar popup
let activeWin = null

async function loadActiveWin() {
  // active-win es ESM, lo importamos dinámicamente
  if (!activeWin) {
    const mod = await import('active-win')
    activeWin = mod.default
  }
  return activeWin
}

async function poll() {
  try {
    const getActiveWin = await loadActiveWin()
    const win = await getActiveWin()

    if (!win) return

    // Registra actividad para idle detection (si hay ventana activa, hay uso)
    recordActivity()

    const title = win.title || ''

    // Si el título cambió, reseteamos el temporizador de estabilidad
    if (title !== lastTitle) {
      lastTitle = title
      titleSince = Date.now()
      return // esperamos al próximo poll para confirmar que se quedó
    }

    // El título lleva menos de MIN_WINDOW_TIME_MS → todavía no reaccionamos
    if (Date.now() - titleSince < MIN_WINDOW_TIME_MS) return

    // Título estable → correr el motor de reglas
    const match = matchWindow(title)
    const current = getActiveEntry()

    if (match) {
      const { client } = match
      // Si ya estamos trackeando este cliente, no hacemos nada
      if (current?.clientId === client.id) return

      // Nuevo cliente detectado → notificar a main.js
      onDetectionCallback?.({
        client,
        windowTitle: title,
        matchedKeywords: match.matchedKeywords,
      })
    } else {
      // Sin match → si había una entrada activa, la cerramos
      if (current) {
        stopEntry()
      }
    }
  } catch (err) {
    console.error('[windowMonitor] Error en poll:', err.message)
  }
}

function start(onDetection) {
  if (pollInterval) return
  onDetectionCallback = onDetection
  pollInterval = setInterval(poll, POLL_INTERVAL_MS)
  console.log('[windowMonitor] Iniciado, polling cada', POLL_INTERVAL_MS / 1000, 'seg')
}

function stop() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

module.exports = { start, stop }
