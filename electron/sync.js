// electron/sync.js
const { createClient } = require('@supabase/supabase-js')
const { getUnsyncedEntries, markEntriesSynced, getAllClients } = require('./db')

const SYNC_INTERVAL_MS = 30_000
const CLIENT_SYNC_INTERVAL_MS = 5 * 60_000

let supabase = null
let syncInterval = null
let lastClientSync = 0

function getSupabase() {
  if (supabase) return supabase

  // Leer las vars acá adentro — ya están cargadas por dotenv en main.js
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  console.log('[sync] URL:', url ? url.substring(0, 30) + '...' : 'undefined')
  console.log('[sync] KEY:', key ? 'OK' : 'undefined')

  if (!url || !key) {
    console.warn('[sync] Variables de Supabase no encontradas en process.env')
    return null
  }

  supabase = createClient(url, key)
  return supabase
}

async function syncClients() {
  const sb = getSupabase()
  if (!sb) return

  const now = Date.now()
  if (now - lastClientSync < CLIENT_SYNC_INTERVAL_MS) return
  lastClientSync = now

  const clients = getAllClients()
  if (clients.length === 0) return

  const rows = clients.map(c => ({
    id:       c.id,
    name:     c.name,
    rate_usd: c.rate_usd,
    active:   c.active === 1 || c.active === true,
  }))

  const { error } = await sb.from('clients').upsert(rows, { onConflict: 'id' })
  if (error) { console.error('[sync] Error clientes:', error.message); return }
  console.log('[sync] Clientes sincronizados:', clients.length)
}

async function syncEntries() {
  const sb = getSupabase()
  if (!sb) return

  const entries = getUnsyncedEntries()
  if (entries.length === 0) return

  console.log('[sync] Subiendo', entries.length, 'entradas...')

  const rows = entries.map(e => ({
    id: e.id, client_id: e.client_id, task_type: e.task_type,
    started_at: e.started_at, ended_at: e.ended_at,
    duration_sec: e.duration_sec, source: e.source,
    window_title: e.window_title, note: e.note,
  }))

  const { error } = await sb.from('time_entries').upsert(rows, { onConflict: 'id' })
  if (error) { console.error('[sync] Error entradas:', error.message); return }

  markEntriesSynced(entries.map(e => e.id))
  console.log('[sync] OK —', entries.length, 'entradas sincronizadas')
}

async function runSync() {
  try {
    await syncClients()
    await syncEntries()
  } catch (err) {
    console.error('[sync] Error inesperado:', err.message)
  }
}

function start() {
  if (syncInterval) return
  console.log('[sync] Iniciado, sincronizando cada', SYNC_INTERVAL_MS / 1000, 'seg')
  runSync()
  syncInterval = setInterval(runSync, SYNC_INTERVAL_MS)
}

function stop() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
}

async function syncNow() { await runSync() }

module.exports = { start, stop, syncNow }
