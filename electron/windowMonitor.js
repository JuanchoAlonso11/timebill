// electron/windowMonitor.js
const { matchWindow } = require('./ruleEngine')
const { getActiveEntry } = require('./timer')
const { execSync } = require('child_process')

const POLL_INTERVAL_MS = 3_000
const MIN_WINDOW_TIME_MS = 8_000

let pollInterval = null
let lastTitle = null
let titleSince = null
let onDetectionCallback = null

function getActiveWindow() {
  try {
    const title = execSync(
      'powershell -ExecutionPolicy Bypass -File "getwindow.ps1"',
      { timeout: 3000, cwd: 'C:\\Users\\ASUS G14\\Desktop\\Work\\timebill' }
    ).toString().trim()
    return title ? { title } : null
  } catch {
    return null
  }
}

async function poll() {
  try {
    const win = getActiveWindow()
    if (!win) return

    const title = win.title || ''

    if (title !== lastTitle) {
      lastTitle = title
      titleSince = Date.now()
      return
    }

    if (Date.now() - titleSince < MIN_WINDOW_TIME_MS) return

    const match = matchWindow(title)
    const current = getActiveEntry()

    if (match) {
      const { client } = match
      if (current?.clientId === client.id) return

      onDetectionCallback?.({
        client,
        windowTitle: title,
        matchedKeywords: match.matchedKeywords,
      })
    }
    // Nota: ya NO cerramos el timer automáticamente cuando no hay match.
    // El timer solo se cierra manualmente o por idle.
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
