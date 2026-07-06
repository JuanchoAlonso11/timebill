// electron/main.js
require('dotenv').config()
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut, dialog } = require('electron')
let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
} catch (e) {
  console.warn('[updater] electron-updater no disponible:', e.message)
}
const path = require('path')
const { start: startMonitor, stop: stopMonitor } = require('./windowMonitor')
const { startEntry, stopEntry, pauseEntry, resumeEntry, getActiveEntry, updateTaskType, setOnIdle, setOnStop, setOnReminder, suspendIdleCheck, resumeIdleCheck, setIdleThreshold, getIdleThreshold, setReminderInterval, getReminderInterval } = require('./timer')
const { getAllClients, upsertClient, setClientRules, insertEntry, closeEntry, getEntriesInRange } = require('./db')
const { start: startSync, stop: stopSync, syncNow, setSupabase, setUserId, setOnStatusChange, setAreaId, resetClientSync } = require('./sync')
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

// ─── Single instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Al intentar abrir otra instancia (acceso directo, buscador), traemos la app al frente.
    // La ventana pudo haberse cerrado (queda solo el tray), así que la recreamos como hace el tray.
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else if (currentUser) {
      // Sesión iniciada pero ventana cerrada → recrear la ventana principal
      showMainWindow()
    } else if (loginWindow && !loginWindow.isDestroyed()) {
      if (loginWindow.isMinimized()) loginWindow.restore()
      loginWindow.show()
      loginWindow.focus()
    } else {
      // Sin sesión y sin ventana de login → recrearla
      showLoginWindow()
    }
  })
}

// ─── App lifecycle ───────────────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC()
  showLoginWindow()

  // Auto-update (solo en producción)
  if (!IS_DEV && autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: 'Hay una nueva versión de Smart Hours disponible. Se descargará en segundo plano.',
        buttons: ['OK']
      })
    })

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: 'La actualización fue descargada. La app se reiniciará para instalarla.',
        buttons: ['Reiniciar ahora', 'Más tarde']
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message)
    })
  }
})

function startApp(user) {
  currentUser = user
  setUserId(user.id)

  // Limpiar SQLite si el usuario es distinto al último logueado
  const lastUserId = store.get('lastUserId', null)
  if (lastUserId && lastUserId !== user.id) {
    try {
      const db = require('./db').getDb()
      db.prepare('DELETE FROM rules').run()
      db.prepare('DELETE FROM clients').run()
      db.prepare('DELETE FROM time_entries').run()
      console.log('[login] SQLite limpiado por cambio de usuario')
    } catch (err) {
      console.error('[login] Error limpiando SQLite:', err.message)
    }
  }
  store.set('lastUserId', user.id)

  // Obtener membresía guardada
  const membership = store.get(`membership-${user.id}`, {})
  const areaId = membership.areaId || null
  setAreaId(areaId)

  // Restaurar threshold guardado
  const savedThreshold = store.get('idleThresholdMs', 5 * 60 * 1000)
  setIdleThreshold(savedThreshold)

  // Restaurar reminder guardado
  const savedReminder = store.get('reminderIntervalMs', 15 * 60 * 1000)
  setReminderInterval(savedReminder)

  // Beep de recordatorio
  setOnReminder(() => {
    const { shell } = require('electron')
    shell.beep()
  })

  // Notificar estado de sync al renderer
  setOnStatusChange((online) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:status', online)
    }
  })

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
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
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

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[mainWindow] Error al cargar:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[mainWindow] Renderer crasheó:', details.reason)
    mainWindow = null
    setTimeout(() => showMainWindow(), 500)
  })

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
    showMainWindow()
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
  suspendIdleCheck()

  const idleTimeout = setTimeout(() => {
    if (popupWindow?.isVisible()) {
      pauseEntry('idle')
      popupWindow.close()
      popupWindow = null
    }
  }, 30_000)

  popupWindow.on('closed', () => {
    clearTimeout(idleTimeout)
    resumeIdleCheck()
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
    title: 'Smart Hours — Configurar clientes',
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
    title: 'Smart Hours — Dashboard',
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

  ipcMain.handle('timer:getThreshold', () => getIdleThreshold())

  ipcMain.handle('timer:setThreshold', (_, ms) => {
    setIdleThreshold(ms)
    store.set('idleThresholdMs', ms)
    return true
  })

  ipcMain.handle('timer:getReminderInterval', () => getReminderInterval())

  ipcMain.handle('timer:setReminderInterval', (_, ms) => {
    setReminderInterval(ms)
    store.set('reminderIntervalMs', ms)
    return true
  })

  ipcMain.handle('app:beep', () => {
    const { shell } = require('electron')
    shell.beep()
  })

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  ipcMain.handle('app:openDashboard', () => {
    try {
      openDashboard()
    } catch (err) {
      console.error('[dashboard] Error abriendo:', err.message)
      dialog.showErrorBox('Error al abrir dashboard', err.message)
    }
  })

  ipcMain.handle('app:openConfig', () => {
    try {
      showConfigWindow()
    } catch (err) {
      console.error('[config] Error abriendo:', err.message)
      dialog.showErrorBox('Error al abrir configuración', err.message)
    }
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

  ipcMain.handle('clients:delete', async (_, clientId) => {
    const db = require('./db').getDb()
    db.prepare('DELETE FROM rules WHERE client_id = ?').run(clientId)
    db.prepare('DELETE FROM clients WHERE id = ?').run(clientId)
    // Borrar también en Supabase
    if (supabaseClient) {
      await supabaseClient.from('rules').delete().eq('client_id', clientId)
      await supabaseClient.from('clients').delete().eq('id', clientId)
    }
    return true
  })

  const DEFAULT_TASK_TYPES = [
    { value: 'llamada',      label: 'Llamada telefónica' },
    { value: 'reunion',      label: 'Reunión presencial' },
    { value: 'redaccion',    label: 'Redacción' },
    { value: 'revision',     label: 'Revisión de documentos' },
    { value: 'consulta',     label: 'Consulta / asesoramiento' },
    { value: 'audiencia',    label: 'Audiencia / representación' },
    { value: 'comunicacion', label: 'Email / comunicación' },
    { value: 'tramite',      label: 'Trámite administrativo' },
    { value: 'general',      label: 'General' },
  ]

  ipcMain.handle('config:getTaskTypes', () => {
    return store.get('taskTypes', DEFAULT_TASK_TYPES)
  })

  ipcMain.handle('config:saveTaskTypes', (_, types) => {
    store.set('taskTypes', types)
    return true
  })

  ipcMain.handle('clients:upsert', (_, client) => {
    upsertClient(client)
    resetClientSync()
    syncNow()
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
    console.log('[login] auth result:', { userId: data?.user?.id, error: error?.message })
    if (error) return { error: error.message }

    // Obtener membresía del usuario via función SECURITY DEFINER
    const { data: membershipRows, error: membershipError } = await supabaseClient
      .rpc('get_user_membership', { p_user_id: data.user.id })
    console.log('[login] membership:', { membershipRows, error: membershipError?.message })

    const membership = membershipRows?.[0]

    if (membershipError || !membership) {
      await supabaseClient.auth.signOut()
      return { error: 'Tu cuenta no está configurada. Contactá al administrador.' }
    }

    // Verificar que la organización esté activa
    if (membership.active_until && new Date(membership.active_until) < new Date()) {
      await supabaseClient.auth.signOut()
      return { error: 'La suscripción de tu organización venció. Contactá al administrador.' }
    }

    // Guardar membresía en store
    store.set(`membership-${data.user.id}`, {
      areaId: membership.area_id,
      role: membership.role,
      orgName: membership.org_name || '',
    })

    setSupabase(supabaseClient)
    setUserId(data.user.id)
    loginWindow?.close()
    loginWindow = null
    startApp(data.user)
    return { user: data.user }
  })

  ipcMain.handle('auth:forgotPassword', async (_, email) => {
    const { createClient } = require('@supabase/supabase-js')
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://smarthours-reset.netlify.app/reset-password.html',
    })
    return { error: error?.message ?? null }
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

    // Limpiar SQLite local al cambiar de usuario
    try {
      const db = require('./db').getDb()
      db.prepare('DELETE FROM rules').run()
      db.prepare('DELETE FROM clients').run()
      db.prepare('DELETE FROM time_entries').run()
      console.log('[logout] SQLite local limpiado')
    } catch (err) {
      console.error('[logout] Error limpiando SQLite:', err.message)
    }

    showLoginWindow()
    return true
  })

  ipcMain.handle('auth:getRole', () => {
    if (!currentUser) return null
    const membership = store.get(`membership-${currentUser.id}`, {})
    return membership.role || null
  })

  ipcMain.handle('auth:getUser', () => currentUser)

  ipcMain.handle('dashboard:getData', async (_, { from, to }) => {
    const membership = currentUser ? store.get(`membership-${currentUser.id}`, {}) : {}
    const role   = membership.role   || null
    const areaId = membership.areaId || null

    // Sin sesión / sin área / sin Supabase → fallback a SQLite local (modo offline)
    if (!currentUser || !supabaseClient || !areaId) {
      const entries = getEntriesInRange(from, to)
      const clients = getAllClients()
      return { entries, clients, role: role || 'employee', source: 'local' }
    }

    // Antes de leer, empujamos las entradas locales pendientes a Supabase
    // así el dashboard refleja las tareas recién terminadas sin esperar al próximo sync.
    // Si no hay nada pendiente es casi instantáneo (getUnsyncedEntries devuelve []).
    try { await syncNow() } catch (e) { console.error('[dashboard] syncNow falló:', e.message) }

    try {
      // Entradas del área (RLS filtra por área). El empleado, además, solo las suyas.
      let query = supabaseClient
        .from('time_entries')
        .select('*, clients(name, rate_usd)')
        .eq('area_id', areaId)
        .gte('started_at', from)
        .lte('started_at', to)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })

      if (role !== 'admin') {
        query = query.eq('user_id', currentUser.id)
      }

      const { data: entries, error } = await query

      if (error) {
        console.error('[dashboard] Error Supabase:', error.message)
        // Fallback a SQLite local
        const localEntries = getEntriesInRange(from, to)
        const clients = getAllClients()
        return { entries: localEntries, clients, role: role || 'employee', source: 'local-fallback' }
      }

      const rows = entries || []

      // Emails reales desde memberships.email (RLS deshabilitado en memberships).
      // Solo lo necesita el admin (vista de área); el empleado solo se ve a sí mismo.
      let userEmails = {}
      if (role === 'admin') {
        const userIds = [...new Set(rows.map(e => e.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: memberships, error: memErr } = await supabaseClient
            .from('memberships')
            .select('user_id, email')
            .in('user_id', userIds)
          if (memErr) {
            console.error('[dashboard] Error emails:', memErr.message)
          } else {
            for (const m of (memberships || [])) {
              if (m.email) userEmails[m.user_id] = m.email
            }
          }
        }
      }

      const normalizedEntries = rows.map(e => ({
        ...e,
        client_name: e.clients?.name ?? null,
        rate_usd:    e.clients?.rate_usd ?? null,
        user_email:  userEmails[e.user_id] || null,
        is_own:      e.user_id === currentUser.id,
      }))

      // Lista de clientes derivada de las entradas (cubre todos los del área con actividad,
      // incluyendo clientes de otros empleados que no están en el SQLite local del admin).
      const clientMap = {}
      for (const e of normalizedEntries) {
        if (e.client_id && !clientMap[e.client_id]) {
          clientMap[e.client_id] = {
            id:       e.client_id,
            name:     e.client_name,
            rate_usd: e.rate_usd,
          }
        }
      }
      const clients = Object.values(clientMap)

      return { entries: normalizedEntries, clients, role: role || 'employee', source: 'supabase' }
    } catch (err) {
      console.error('[dashboard] Error inesperado:', err.message)
      const localEntries = getEntriesInRange(from, to)
      const clients = getAllClients()
      return { entries: localEntries, clients, role: role || 'employee', source: 'local-error' }
    }
  })

  ipcMain.handle('dashboard:setCobrado', async (_, { ids, cobrado, fechaCobro }) => {
    const membership = currentUser ? store.get(`membership-${currentUser.id}`, {}) : {}
    const role   = membership.role   || null
    const areaId = membership.areaId || null

    if (role !== 'admin') {
      return { error: 'Solo un administrador puede marcar tareas como cobradas.' }
    }
    if (!supabaseClient || !areaId) {
      return { error: 'No hay conexión con el servidor. Probá de nuevo con internet.' }
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return { error: 'No se seleccionaron tareas.' }
    }

    // Si se marca cobrado, guardamos la fecha; si se desmarca, limpiamos la fecha.
    const payload = cobrado
      ? { cobrado: true,  fecha_cobro: fechaCobro || null }
      : { cobrado: false, fecha_cobro: null }

    // El .eq('area_id', areaId) es un cinturón extra además de la RLS:
    // un admin solo puede tocar tareas de su propia área.
    const { data, error } = await supabaseClient
      .from('time_entries')
      .update(payload)
      .in('id', ids)
      .eq('area_id', areaId)
      .select('id')

    if (error) {
      console.error('[cobrado] Error Supabase:', error.message)
      return { error: error.message }
    }

    const updated = data?.length || 0
    if (updated === 0) {
      // Update sin error pero 0 filas → casi seguro falta la policy RLS de UPDATE para admin.
      console.error('[cobrado] 0 filas actualizadas — ¿falta la policy admin_update_entries_area?')
      return { error: 'No se actualizó ninguna tarea. Verificá la policy RLS de UPDATE para admin.' }
    }

    console.log('[cobrado] Actualizadas:', updated, '| cobrado:', cobrado)
    return { ok: true, updated }
  })

  ipcMain.handle('dashboard:addManualEntry', async (_, { clientId, taskType, startedAt, endedAt }) => {
    if (!currentUser)            return { error: 'No hay sesión activa.' }
    if (!clientId)               return { error: 'Elegí un cliente.' }
    if (!taskType)               return { error: 'Elegí un tipo de tarea.' }
    if (!startedAt || !endedAt)  return { error: 'Faltan la fecha y las horas.' }

    const start = new Date(startedAt)
    const end   = new Date(endedAt)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: 'Fecha u hora inválida.' }
    }
    if (end <= start) {
      return { error: 'La hora de fin debe ser posterior a la de inicio.' }
    }

    const durationSec = Math.round((end.getTime() - start.getTime()) / 1000)

    // Tope de seguridad: 24hs (evita cargas accidentales gigantes)
    if (durationSec > 24 * 3600) {
      return { error: 'La duración no puede superar las 24 horas.' }
    }

    const { randomUUID } = require('crypto')
    const id = randomUUID()

    try {
      // Mismo patrón que manual:saveRetro → guarda en SQLite local
      insertEntry({ id, client_id: clientId, task_type: taskType, started_at: start.toISOString(), window_title: null, source: 'manual' })
      closeEntry({ id, ended_at: end.toISOString(), duration_sec: durationSec })
      // Empujar a Supabase para que aparezca en el dashboard sin esperar al sync periódico
      try { await syncNow() } catch (e) { console.error('[manual] syncNow falló:', e.message) }
      console.log('[manual] Entrada manual guardada:', durationSec, 'seg')
      return { ok: true, id, durationSec }
    } catch (e) {
      console.error('[manual] Error guardando:', e.message)
      return { error: 'No se pudo guardar la tarea.' }
    }
  })

  ipcMain.handle('dashboard:editEntry', async (_, { id, clientId, taskType, startedAt, endedAt, note, changes }) => {
    const membership = currentUser ? store.get(`membership-${currentUser.id}`, {}) : {}
    const role   = membership.role   || null
    const areaId = membership.areaId || null

    if (!currentUser)            return { error: 'No hay sesión activa.' }
    if (!supabaseClient || !areaId) return { error: 'No hay conexión con el servidor.' }
    if (!id)                     return { error: 'Falta el id de la tarea.' }
    if (!clientId)               return { error: 'Elegí un cliente.' }
    if (!taskType)               return { error: 'Elegí un tipo de tarea.' }

    const start = new Date(startedAt)
    const end   = new Date(endedAt)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: 'Fecha u hora inválida.' }
    if (end <= start) return { error: 'La hora de fin debe ser posterior a la de inicio.' }

    const durationSec = Math.round((end.getTime() - start.getTime()) / 1000)
    if (durationSec > 24 * 3600) return { error: 'La duración no puede superar las 24 horas.' }

    const payload = {
      client_id:    clientId,
      task_type:    taskType,
      started_at:   start.toISOString(),
      ended_at:     end.toISOString(),
      duration_sec: durationSec,
      note:         note || null,
    }

    // Admin edita cualquier tarea de su área; empleado solo las propias (cinturón extra sobre RLS)
    let q = supabaseClient.from('time_entries').update(payload).eq('id', id).eq('area_id', areaId)
    if (role !== 'admin') q = q.eq('user_id', currentUser.id)

    const { data, error } = await q.select('id')
    if (error) {
      console.error('[edit] Error update:', error.message)
      return { error: error.message }
    }
    if (!data || data.length === 0) {
      return { error: 'No se pudo editar (sin permisos o falta policy RLS de UPDATE).' }
    }

    // Historial: una fila por campo cambiado
    if (Array.isArray(changes) && changes.length > 0) {
      const { randomUUID } = require('crypto')
      const editGroup = randomUUID()
      const rows = changes.map(c => ({
        entry_id:   id,
        edited_by:  currentUser.id,
        field:      c.field,
        old_value:  c.oldValue == null ? null : String(c.oldValue),
        new_value:  c.newValue == null ? null : String(c.newValue),
        area_id:    areaId,
        edit_group: editGroup,
      }))
      const { error: histErr } = await supabaseClient.from('entry_edits').insert(rows)
      // Si falla el historial no abortamos: el cambio principal ya se guardó
      if (histErr) console.error('[edit] Error guardando historial:', histErr.message)
    }

    console.log('[edit] Tarea editada:', id, '| cambios:', changes?.length || 0)
    return { ok: true }
  })

  ipcMain.handle('dashboard:getEntryEdits', async (_, entryId) => {
    if (!supabaseClient || !entryId) return []
    const { data, error } = await supabaseClient
      .from('entry_edits')
      .select('*')
      .eq('entry_id', entryId)
      .order('edited_at', { ascending: false })

    if (error) { console.error('[edit] getEntryEdits:', error.message); return [] }

    // Resolver emails de quién editó
    const userIds = [...new Set((data || []).map(r => r.edited_by).filter(Boolean))]
    let emails = {}
    if (userIds.length > 0) {
      const { data: mem } = await supabaseClient
        .from('memberships')
        .select('user_id, email')
        .in('user_id', userIds)
      for (const m of (mem || [])) emails[m.user_id] = m.email
    }

    return (data || []).map(r => ({ ...r, editor_email: emails[r.edited_by] || null }))
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
    const fileName = `Informe_${safe}_${dateStr}.pdf`
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
    resetClientSync()
    syncNow()
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


