// electron/timer.js
const { randomUUID } = require('crypto')
const { insertEntry, closeEntry } = require('./db')

let idleThresholdMs = 5 * 60 * 1000  // 5 minutos (configurable)
const IDLE_CHECK_INTERVAL_MS = 5_000  // chequea cada 5 segundos

let activeEntry = null
let idleCheckInterval = null
let reminderInterval = null
let reminderIntervalMs = 15 * 60 * 1000  // 15 minutos (configurable)
let onIdleCallback = null
let onStopCallback = null
let onReminderCallback = null

// --- Inicio de entrada ---

function startEntry({ clientId, clientName, taskType = 'general', windowTitle, source = 'auto' }) {
  if (activeEntry && activeEntry.clientId === clientId && !activeEntry.paused) {
    return activeEntry
  }
  if (activeEntry) stopEntry()

  const now = new Date().toISOString()
  const id = randomUUID()

  activeEntry = {
    id, clientId, clientName, taskType, windowTitle, source,
    startedAt: now,
    pausedMs: 0,
    pauseStart: null,
    paused: false,
  }

  insertEntry({ id, client_id: clientId, task_type: taskType, started_at: now, window_title: windowTitle, source })
  startIdleCheck()
  startReminder()
  console.log('[timer] Entrada iniciada para:', clientName)
  return activeEntry
}

// --- Pausa / reanudación ---

function pauseEntry(reason = 'idle') {
  if (!activeEntry || activeEntry.paused) return
  activeEntry.paused = true
  activeEntry.pauseStart = Date.now()
  activeEntry.pauseReason = reason
  console.log('[timer] Pausado por:', reason)
}

function resumeEntry() {
  if (!activeEntry || !activeEntry.paused) return
  if (activeEntry.pauseStart) {
    activeEntry.pausedMs += Date.now() - activeEntry.pauseStart
  }
  activeEntry.paused = false
  activeEntry.pauseStart = null
  activeEntry.pauseReason = null
  console.log('[timer] Reanudado')
}

// --- Cierre de entrada ---

function stopEntry() {
  if (!activeEntry) return null

  if (activeEntry.paused && activeEntry.pauseStart) {
    activeEntry.pausedMs += Date.now() - activeEntry.pauseStart
  }

  const endedAt = new Date().toISOString()
  const totalMs = new Date(endedAt) - new Date(activeEntry.startedAt)
  const billableMs = Math.max(0, totalMs - activeEntry.pausedMs)
  const durationSec = Math.round(billableMs / 1000)

  if (durationSec >= 30) {
    closeEntry({ id: activeEntry.id, ended_at: endedAt, duration_sec: durationSec })
    console.log('[timer] Entrada guardada:', durationSec, 'segundos facturables')
  } else {
    console.log('[timer] Entrada descartada (menos de 30s)')
  }

  const stopped = { ...activeEntry, endedAt, durationSec }
  stopIdleCheck()
  stopReminder()
  activeEntry = null
  onStopCallback?.(stopped)
  return stopped
}

// --- Idle detection usando powerMonitor de Electron ---

function startIdleCheck() {
  if (idleCheckInterval) return
  idleCheckInterval = setInterval(() => {
    if (!activeEntry || activeEntry.paused || idleCheckSuspended) return
    try {
      const { powerMonitor } = require('electron')
      const idleSec = powerMonitor.getSystemIdleTime()
      console.log('[idle check] idle:', idleSec + 's | threshold:', idleThresholdMs / 1000 + 's')
      if (idleSec * 1000 >= idleThresholdMs) {
        console.log('[timer] Idle detectado — disparando popup')
        pauseEntry('idle')
        onIdleCallback?.()
      }
    } catch (err) {
      console.error('[timer] Error en idle check:', err.message)
    }
  }, IDLE_CHECK_INTERVAL_MS)
  console.log('[timer] Idle check iniciado')
}

function stopIdleCheck() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval)
    idleCheckInterval = null
  }
}

function startReminder() {
  stopReminder()
  if (!reminderIntervalMs) return  // 0 = desactivado
  reminderInterval = setInterval(() => {
    if (!activeEntry || activeEntry.paused) return
    onReminderCallback?.()
  }, reminderIntervalMs)
}

function stopReminder() {
  if (reminderInterval) {
    clearInterval(reminderInterval)
    reminderInterval = null
  }
}

// --- Estado actual (para UI) ---

function getActiveEntry() {
  if (!activeEntry) return null

  const now = Date.now()
  const startMs = new Date(activeEntry.startedAt).getTime()
  let elapsedMs = now - startMs - activeEntry.pausedMs

  if (activeEntry.paused && activeEntry.pauseStart) {
    elapsedMs -= (now - activeEntry.pauseStart)
  }

  return {
    ...activeEntry,
    elapsedSec: Math.max(0, Math.round(elapsedMs / 1000)),
  }
}

function recordActivity() {
  if (activeEntry?.paused) resumeEntry()
}

function isIdle() {
  try {
    const { powerMonitor } = require('electron')
    return powerMonitor.getSystemIdleTime() * 1000 >= idleThresholdMs
  } catch {
    return false
  }
}

let idleCheckSuspended = false

function suspendIdleCheck() { idleCheckSuspended = true }
function resumeIdleCheck() { idleCheckSuspended = false }
function setOnIdle(fn) { onIdleCallback = fn }
function setOnStop(fn) { onStopCallback = fn }
function updateTaskType(taskType) { if (activeEntry) activeEntry.taskType = taskType }

function setIdleThreshold(ms) { idleThresholdMs = ms }
function getIdleThreshold() { return idleThresholdMs }
function setReminderInterval(ms) {
  reminderIntervalMs = ms
  if (activeEntry) { stopReminder(); startReminder() }
}
function getReminderInterval() { return reminderIntervalMs }
function setOnReminder(fn) { onReminderCallback = fn }

module.exports = {
  startEntry, stopEntry, pauseEntry, resumeEntry,
  recordActivity, getActiveEntry, updateTaskType,
  setOnIdle, setOnStop, setOnReminder, isIdle,
  suspendIdleCheck, resumeIdleCheck,
  setIdleThreshold, getIdleThreshold,
  setReminderInterval, getReminderInterval,
}
