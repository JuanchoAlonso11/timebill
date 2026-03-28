// electron/timer.js
// Maneja el ciclo de vida de una entrada de tiempo:
// inicio → acumulación → pausa por idle → cierre → guardado en SQLite

const { randomUUID } = require('crypto')
const { insertEntry, closeEntry } = require('./db')

const IDLE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutos sin actividad
const IDLE_CHECK_INTERVAL_MS = 30_000    // chequea idle cada 30s

let activeEntry = null      // entrada en curso
let lastActivityAt = Date.now()
let idleCheckInterval = null
let onIdleCallback = null   // función a llamar cuando se detecta idle
let onStopCallback = null   // función a llamar al cerrar entrada (para actualizar UI)

// Registra cualquier evento de input del OS como "actividad"
function recordActivity() {
  lastActivityAt = Date.now()
  // Si el timer estaba pausado por idle, lo reanudamos
  if (activeEntry?.paused) {
    resumeEntry()
  }
}

function isIdle() {
  return Date.now() - lastActivityAt > IDLE_THRESHOLD_MS
}

// --- Inicio de entrada ---

function startEntry({ clientId, clientName, taskType = 'general', windowTitle, source = 'auto' }) {
  // Si hay una entrada activa para el mismo cliente, no arrancamos otra
  if (activeEntry && activeEntry.clientId === clientId && !activeEntry.paused) {
    return activeEntry
  }

  // Cerrar la anterior si era de otro cliente
  if (activeEntry) {
    stopEntry()
  }

  const now = new Date().toISOString()
  const id = randomUUID()

  activeEntry = {
    id,
    clientId,
    clientName,
    taskType,
    windowTitle,
    source,
    startedAt: now,
    pausedMs: 0,        // ms acumulados en pausa (no se cobran)
    pauseStart: null,
    paused: false,
  }

  insertEntry({
    id,
    client_id: clientId,
    task_type: taskType,
    started_at: now,
    window_title: windowTitle,
    source,
  })

  startIdleCheck()
  return activeEntry
}

// --- Pausa / reanudación ---

function pauseEntry(reason = 'idle') {
  if (!activeEntry || activeEntry.paused) return
  activeEntry.paused = true
  activeEntry.pauseStart = Date.now()
  activeEntry.pauseReason = reason
}

function resumeEntry() {
  if (!activeEntry || !activeEntry.paused) return
  if (activeEntry.pauseStart) {
    activeEntry.pausedMs += Date.now() - activeEntry.pauseStart
  }
  activeEntry.paused = false
  activeEntry.pauseStart = null
  activeEntry.pauseReason = null
}

// --- Cierre de entrada ---

function stopEntry() {
  if (!activeEntry) return null

  // Si estaba pausado, cerramos el tramo de pausa
  if (activeEntry.paused && activeEntry.pauseStart) {
    activeEntry.pausedMs += Date.now() - activeEntry.pauseStart
  }

  const endedAt = new Date().toISOString()
  const totalMs = new Date(endedAt) - new Date(activeEntry.startedAt)
  const billableMs = Math.max(0, totalMs - activeEntry.pausedMs)
  const durationSec = Math.round(billableMs / 1000)

  // No guardamos entradas menores a 30 segundos (ruido)
  if (durationSec >= 30) {
    closeEntry({ id: activeEntry.id, ended_at: endedAt, duration_sec: durationSec })
  }

  const stopped = { ...activeEntry, endedAt, durationSec }

  stopIdleCheck()
  activeEntry = null
  onStopCallback?.(stopped)

  return stopped
}

// --- Idle detection ---

function startIdleCheck() {
  if (idleCheckInterval) return
  idleCheckInterval = setInterval(() => {
    if (!activeEntry || activeEntry.paused) return
    if (isIdle()) {
      pauseEntry('idle')
      onIdleCallback?.()
    }
  }, IDLE_CHECK_INTERVAL_MS)
}

function stopIdleCheck() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval)
    idleCheckInterval = null
  }
}

// --- Estado actual (para UI) ---

function getActiveEntry() {
  if (!activeEntry) return null

  const now = Date.now()
  const startMs = new Date(activeEntry.startedAt).getTime()
  let elapsedMs = now - startMs - activeEntry.pausedMs

  // Si está pausado ahora, descontamos también el tramo actual de pausa
  if (activeEntry.paused && activeEntry.pauseStart) {
    elapsedMs -= (now - activeEntry.pauseStart)
  }

  return {
    ...activeEntry,
    elapsedSec: Math.max(0, Math.round(elapsedMs / 1000)),
  }
}

function setOnIdle(fn) { onIdleCallback = fn }
function setOnStop(fn) { onStopCallback = fn }

// Cambio de tarea en la entrada activa (sin cerrar)
function updateTaskType(taskType) {
  if (activeEntry) activeEntry.taskType = taskType
}

module.exports = {
  startEntry,
  stopEntry,
  pauseEntry,
  resumeEntry,
  recordActivity,
  getActiveEntry,
  updateTaskType,
  setOnIdle,
  setOnStop,
  isIdle,
}
