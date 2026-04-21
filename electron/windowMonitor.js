// electron/windowMonitor.js
const { matchWindow } = require('./ruleEngine')
const { getActiveEntry } = require('./timer')
const { execSync } = require('child_process')
const path = require('path')
const { app } = require('electron')

const POLL_INTERVAL_MS = 3_000
const MIN_WINDOW_TIME_MS = 8_000

let pollInterval = null
let lastTitle = null
let titleSince = null
let onDetectionCallback = null

function getScriptPath() {
  // En producción el script está en resources/, en dev en la raíz del proyecto
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'getwindow.ps1')
  }
  return path.join(__dirname, '..', 'getwindow.ps1')
}

function getActiveWindow() {
  try {
    const scriptPath = getScriptPath()
    const title = execSync(
      `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 3000 }
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
