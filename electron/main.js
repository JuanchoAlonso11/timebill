// electron/main.js
require('dotenv').config()
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut } = require('electron')
const path = require('path')
const { start: startMonitor, stop: stopMonitor } = require('./windowMonitor')
const { startEntry, stopEntry, pauseEntry, resumeEntry, getActiveEntry, updateTaskType, setOnIdle, setOnStop } = require('./timer')
const { getAllClients, upsertClient, setClientRules, insertEntry, closeEntry, getEntriesInRange } = require('./db')
const { start: startSync, stop: stopSync, syncNow, setSupabase, setUserId } = require('./sync')
const Store = require('electron-store')
const store = new Store()

const IS_DEV = process.env.NODE_ENV === 'development'

let tray = null
let popupWindow = null
let configWindow = null
let dashboardWindow = null
let loginWindow = null
let mainWindow = null
let onboardingWindow = null
let pendingDetection = null
let pendingReportData = null
let supabaseClient = null
let currentUser = null

const SUPABASE_URL  = 'https://qosofkwkiujexuiptixh.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc29ma3draXVqZXh1aXB0aXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTA2MTcsImV4cCI6MjA5MjAyNjYxN30.D_2JfMXSdXvR1oqqHZ5a0YAMJU27_qBnI8lsatvH6tQ'
let lastDetectedClientId = null
let lastDetectedWindowTitle = null

// ─── App lifecycle ───────────────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC()
  showLoginWindow()
})

function startApp(user) {
  currentUser = user
  setUserId(user.id)

  createTray()
  showMainWindow()

  // Mostrar onboarding si es primera vez
  const onboardingSeen = store.get(`onboarding-seen-${user.id}`, false)
  if (!onboardingSeen) {
    setTimeout(() => showOnboardingWindow(), 400)
  }

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
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (e) => e.preventDefault())

app.on('before-quit', () => {
  stopMonitor()
  stopSync()
  stopEntry()
})

function showLoginWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  loginWindow = new BrowserWindow({
    width: 400,
    height: 480,
    x: Math.round((width - 400) / 2),
    y: Math.round((height - 480) / 2),
    frame: true,
    title: 'Smart Hours',
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/login.html'
    : `file://${path.join(__dirname, '../dist/login.html')}`

  loginWindow.loadURL(url)
  loginWindow.setMenuBarVisibility(false)

  loginWindow.on('closed', () => {
    loginWindow = null
    if (!currentUser) app.quit()
  })
}

function showOnboardingWindow() {
  if (onboardingWindow) {
    onboardingWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  onboardingWindow = new BrowserWindow({
    width: 480,
    height: 540,
    x: Math.round((width - 480) / 2),
    y: Math.round((height - 540) / 2),
    frame: true,
    title: 'Smart Hours — Bienvenido',
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/onboarding.html'
    : `file://${path.join(__dirname, '../dist/onboarding.html')}`

  onboardingWindow.loadURL(url)
  onboardingWindow.setMenuBarVisibility(false)

  onboardingWindow.on('closed', () => {
    onboardingWindow = null
  })
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.isMinimized() ? mainWindow.restore() : mainWindow.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 340,
    height: 520,
    minWidth: 280,
    minHeight: 420,
    frame: true,
    title: 'Smart Hours',
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/main-window.html'
    : `file://${path.join(__dirname, '../dist/main-window.html')}`

  mainWindow.loadURL(url)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Tray ────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png')
  ).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('Smart Hours')
  updateTrayTitle()

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isMinimized() ? mainWindow.restore() : mainWindow.focus()
    }
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
    ? 'http://localhost:5173/popup.html'
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
    ? 'http://localhost:5173/idle.html'
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
    ? 'http://localhost:5173/tray.html'
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
    ? 'http://localhost:5173/manual.html'
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
    ? 'http://localhost:5173/config.html'
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
  if (dashboardWindow) {
    dashboardWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  dashboardWindow = new BrowserWindow({
    width: 900,
    height: 640,
    x: Math.round((width - 900) / 2),
    y: Math.round((height - 640) / 2),
    frame: true,
    title: 'TimeBill — Dashboard',
    resizable: true,
    minWidth: 720,
    minHeight: 500,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  const url = IS_DEV
    ? 'http://localhost:5173/dashboard.html'
    : `file://${path.join(__dirname, '../dist/dashboard.html')}`

  dashboardWindow.loadURL(url)
  dashboardWindow.setMenuBarVisibility(false)

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })
}

// ─── IPC handlers ────────────────────────────────────────────────────

function setupIPC() {

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  ipcMain.handle('app:openDashboard', () => {
    openDashboard()
  })

  ipcMain.handle('app:openConfig', () => {
    showConfigWindow()
  })

  ipcMain.handle('app:openManual', () => {
    showManualEntryPopup()
  })

  ipcMain.handle('app:openOnboarding', () => {
    showOnboardingWindow()
  })

  ipcMain.handle('app:closeOnboarding', () => {
    if (currentUser) {
      store.set(`onboarding-seen-${currentUser.id}`, true)
    }
    onboardingWindow?.close()
    onboardingWindow = null
  })

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

  ipcMain.handle('auth:login', async (_, { email, password }) => {
    const { createClient } = require('@supabase/supabase-js')
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON)
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    setSupabase(supabaseClient)
    setUserId(data.user.id)
    loginWindow?.close()
    loginWindow = null
    startApp(data.user)
    return { user: data.user }
  })

  ipcMain.handle('auth:logout', async () => {
    if (supabaseClient) await supabaseClient.auth.signOut()
    currentUser = null
    stopMonitor()
    stopSync()
    stopEntry()
    globalShortcut.unregisterAll()
    tray?.destroy()
    tray = null
    showLoginWindow()
    return true
  })

  ipcMain.handle('auth:getUser', () => currentUser)

  ipcMain.handle('dashboard:getData', (_, { from, to }) => {
    const entries = getEntriesInRange(from, to)
    const clients = getAllClients()
    return { entries, clients }
  })

  ipcMain.handle('report:getData', () => {
    return pendingReportData
  })

  ipcMain.handle('report:generate', async (_, { entries, clientName, from, to }) => {
    pendingReportData = { entries, clientName, from, to }

    const reportWin = new BrowserWindow({
      width: 794,
      height: 1123,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
      },
    })

    const url = IS_DEV
      ? 'http://localhost:5173/report.html'
      : `file://${path.join(__dirname, '../dist/report.html')}`

    await reportWin.loadURL(url)
    await new Promise(r => setTimeout(r, 900))

    const pdfData = await reportWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' },
    })

    reportWin.close()

    const os  = require('os')
    const fs  = require('fs')
    const safe = clientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')
    const dateStr = from.slice(0, 10)
    const fileName = `TimeBill_${safe}_${dateStr}.pdf`
    const tempPath = path.join(os.tmpdir(), fileName)
    fs.writeFileSync(tempPath, pdfData)

    return { filePath: tempPath, fileName }
  })

  ipcMain.handle('report:save', async (_, { filePath: sourcePath, fileName }) => {
    const { dialog, shell } = require('electron')
    const result = await dialog.showSaveDialog(dashboardWindow, {
      defaultPath: fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!result.canceled && result.filePath) {
      const fs = require('fs')
      fs.copyFileSync(sourcePath, result.filePath)
      shell.openPath(result.filePath)
      return result.filePath
    }
    return null
  })

  ipcMain.handle('report:whatsapp', (_, { message }) => {
    const { shell } = require('electron')
    shell.openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`)
    return true
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
