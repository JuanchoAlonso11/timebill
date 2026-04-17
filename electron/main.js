// electron/main.js
require('dotenv').config()
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut } = require('electron')
const path = require('path')
const { start: startMonitor, stop: stopMonitor } = require('./windowMonitor')
const { startEntry, stopEntry, pauseEntry, resumeEntry, getActiveEntry, updateTaskType, setOnIdle, setOnStop } = require('./timer')
const { getAllClients, upsertClient, setClientRules, insertEntry, closeEntry } = require('./db')
const { start: startSync, stop: stopSync, syncNow } = require('./sync')

const IS_DEV = process.env.NODE_ENV === 'development'

let tray = null
let popupWindow = null
let configWindow = null
let pendingDetection = null
let lastDetectedClientId = null
let lastDetectedWindowTitle = null

// ─── App lifecycle ───────────────────────────────────────────────────

app.whenReady().then(() => {
  createTray()
  setupIPC()

  setOnIdle(() => {
    if (popupWindow?.isVisible()) return
    showIdlePopup()
  })

  setOnStop(() => {
    updateTrayTitle()
    lastDetectedClientId = null
    lastDetectedWindowTitle = null
  })

  if (IS_DEV) seedDevData()

  startSync()

  globalShortcut.register('CommandOrControl+Shift+B', () => {
    showManualEntryPopup()
  })

  startMonitor((detection) => {
    const active = getActiveEntry()
    if (active?.clientId === detection.client.id) return
    if (active) return
    if (lastDetectedClientId === detection.client.id &&
        lastDetectedWindowTitle === detection.windowTitle) return

    lastDetectedClientId = detection.client.id
    lastDetectedWindowTitle = detection.windowTitle
    pendingDetection = detection
    showDetectionPopup(detection)
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (e) => e.preventDefault())

app.on('before-quit', () => {
  stopMonitor()
  stopSync()
  stopEntry()
})

// ─── Tray ────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png')
  ).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('TimeBill')
  updateTrayTitle()

  tray.on('click', () => {
    const entry = getActiveEntry()
    if (entry) showTimerPopup()
  })
}

function updateTrayTitle() {
  const entry = getActiveEntry()
  if (entry && !entry.paused) {
    const mins = Math.floor(entry.elapsedSec / 60)
    const secs = entry.elapsedSec % 60
    tray?.setTitle(` ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`)
  } else {
    tray?.setTitle('')
  }

  const menu = Menu.buildFromTemplate([
    {
      label: entry ? `${entry.clientName} · ${formatDuration(entry.elapsedSec)}` : 'Sin actividad',
      enabled: false,
    },
    { type: 'separator' },
    { label: 'Detener timer', enabled: !!entry, click: () => stopEntry() },
    { label: 'Registrar tarea manual  Ctrl+Shift+B', click: () => showManualEntryPopup() },
    { type: 'separator' },
    { label: 'Configurar clientes', click: () => showConfigWindow() },
    { type: 'separator' },
    { label: 'Abrir dashboard', click: () => openDashboard() },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ])
  tray?.setContextMenu(menu)
}

setInterval(() => {
  const entry = getActiveEntry()
  if (entry && !entry.paused) updateTrayTitle()
}, 1000)

// ─── Popup de detección ──────────────────────────────────────────────

function showDetectionPopup(detection) {
  if (popupWindow) {
    popupWindow.close()
    popupWindow = null
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  popupWindow = new BrowserWindow({
    width: 320,
    height: 320,
    x: width - 340,
    y: height - 340,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/popup'
    : `file://${path.join(__dirname, '../dist/popup.html')}`

  popupWindow.loadURL(url)

  popupWindow.webContents.once('did-finish-load', () => {
    popupWindow?.webContents.send('detection:data', {
      ...detection,
      allClients: getAllClients(),
    })
  })

  setTimeout(() => {
    if (popupWindow?.isVisible()) {
      popupWindow.close()
      popupWindow = null
      pendingDetection = null
    }
  }, 15_000)

  popupWindow.on('closed', () => {
    popupWindow = null
  })
}

// ─── Popup de idle ───────────────────────────────────────────────────

function showIdlePopup() {
  if (popupWindow) return

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  popupWindow = new BrowserWindow({
    width: 300,
    height: 200,
    x: width - 320,
    y: height - 220,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/idle'
    : `file://${path.join(__dirname, '../dist/idle.html')}`

  popupWindow.loadURL(url)

  setTimeout(() => {
    if (popupWindow?.isVisible()) {
      pauseEntry('idle')
      popupWindow.close()
      popupWindow = null
    }
  }, 30_000)

  popupWindow.on('closed', () => {
    popupWindow = null
  })
}

// ─── Popup de timer activo ───────────────────────────────────────────

function showTimerPopup() {
  if (popupWindow) {
    popupWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  popupWindow = new BrowserWindow({
    width: 300,
    height: 260,
    x: width - 320,
    y: height - 280,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/tray'
    : `file://${path.join(__dirname, '../dist/tray.html')}`

  popupWindow.loadURL(url)

  popupWindow.on('blur', () => {
    popupWindow?.close()
    popupWindow = null
  })

  popupWindow.on('closed', () => {
    popupWindow = null
  })
}

// ─── Popup de registro manual ─────────────────────────────────────────

function showManualEntryPopup() {
  if (popupWindow) {
    popupWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  popupWindow = new BrowserWindow({
    width: 320,
    height: 360,
    x: width - 340,
    y: height - 380,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/manual'
    : `file://${path.join(__dirname, '../dist/manual.html')}`

  popupWindow.loadURL(url)

  popupWindow.webContents.once('did-finish-load', () => {
    popupWindow?.webContents.send('manual:data', {
      allClients: getAllClients(),
    })
  })

  popupWindow.on('closed', () => {
    popupWindow = null
  })
}

// ─── Ventana de configuración ─────────────────────────────────────────

function showConfigWindow() {
  if (configWindow) {
    configWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  configWindow = new BrowserWindow({
    width: 520,
    height: 420,
    x: Math.round((width - 520) / 2),
    y: Math.round((height - 420) / 2),
    frame: true,
    title: 'TimeBill — Configurar clientes',
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/config'
    : `file://${path.join(__dirname, '../dist/config.html')}`

  configWindow.loadURL(url)
  configWindow.setMenuBarVisibility(false)

  configWindow.webContents.once('did-finish-load', () => {
    configWindow?.webContents.send('config:data', {
      clients: getAllClients(),
    })
  })

  configWindow.on('closed', () => {
    configWindow = null
  })
}

function openDashboard() {
  // TODO: semana 3
}

// ─── IPC handlers ────────────────────────────────────────────────────

function setupIPC() {

  ipcMain.handle('timer:start', (_, { clientId, clientName, taskType, windowTitle }) => {
    const entry = startEntry({ clientId, clientName, taskType, windowTitle, source: 'auto' })
    popupWindow?.close()
    popupWindow = null
    pendingDetection = null
    return entry
  })

  ipcMain.handle('timer:stop', () => {
    return stopEntry()
  })

  ipcMain.handle('timer:updateTask', (_, taskType) => {
    updateTaskType(taskType)
    return getActiveEntry()
  })

  ipcMain.handle('timer:getActive', () => {
    return getActiveEntry()
  })

  ipcMain.handle('detection:ignore', () => {
    popupWindow?.close()
    popupWindow = null
    pendingDetection = null
    return null
  })

  ipcMain.handle('clients:getAll', () => getAllClients())

  ipcMain.handle('clients:upsert', (_, client) => {
    upsertClient(client)
    return getAllClients()
  })

  ipcMain.handle('clients:setRules', (_, { clientId, keywords }) => {
    setClientRules(clientId, keywords)
    const { invalidateCache } = require('./ruleEngine')
    invalidateCache()
    return true
  })

  ipcMain.handle('idle:continue', () => {
    popupWindow?.close()
    popupWindow = null
    resumeEntry()
    return true
  })

  ipcMain.handle('idle:stop', () => {
    popupWindow?.close()
    popupWindow = null
    stopEntry()
    return true
  })

  ipcMain.handle('manual:startNow', (_, { clientId, clientName, taskType }) => {
    const entry = startEntry({ clientId, clientName, taskType, windowTitle: null, source: 'manual' })
    popupWindow?.close()
    popupWindow = null
    return entry
  })

  ipcMain.handle('manual:saveRetro', (_, { clientId, taskType, minutesAgo }) => {
    const { randomUUID } = require('crypto')
    const now = Date.now()
    const startedAt = new Date(now - minutesAgo * 60 * 1000).toISOString()
    const endedAt = new Date(now).toISOString()
    const durationSec = minutesAgo * 60
    const id = randomUUID()
    insertEntry({ id, client_id: clientId, task_type: taskType, started_at: startedAt, window_title: null, source: 'manual' })
    closeEntry({ id, ended_at: endedAt, duration_sec: durationSec })
    popupWindow?.close()
    popupWindow = null
    console.log('[manual] Entrada retroactiva guardada:', minutesAgo, 'minutos')
    return true
  })

  ipcMain.handle('manual:close', () => {
    popupWindow?.close()
    popupWindow = null
    return null
  })

  // Config de clientes
  ipcMain.handle('config:getClients', () => {
    return getAllClients()
  })

  ipcMain.handle('config:saveClient', (_, { id, name, rate_usd }) => {
    upsertClient({ id, name, rate_usd })
    return true
  })

  ipcMain.handle('config:setKeywords', (_, { clientId, keywords }) => {
    setClientRules(clientId, keywords)
    const { invalidateCache } = require('./ruleEngine')
    invalidateCache()
    return true
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDuration(totalSec) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function seedDevData() {
  const db = require('./db')
  const clients = [
    { id: 'client-1', name: 'García S.A.', rate_usd: 85, keywords: ['garcia', 'garcía', 'exp-2024-047'] },
    { id: 'client-2', name: 'Martínez Hnos.', rate_usd: 70, keywords: ['martinez', 'martínez', 'escritura'] },
    { id: 'client-3', name: 'Pérez & Asociados', rate_usd: 95, keywords: ['perez', 'pérez', 'demanda-civil'] },
  ]
  for (const { id, name, rate_usd, keywords } of clients) {
    db.upsertClient({ id, name, rate_usd })
    db.setClientRules(id, keywords)
  }
  console.log('[dev] Clientes de prueba sembrados')
}
