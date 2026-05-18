// electron/sync.js
const { getUnsyncedEntries, markEntriesSynced, getAllClients } = require('./db')

const SYNC_INTERVAL_MS        = 30_000
const CLIENT_SYNC_INTERVAL_MS = 5 * 60_000

let supabase        = null
let syncInterval    = null
let lastClientSync  = 0
let currentUserId   = null
let currentAreaId   = null
let onStatusChange  = null

function setOnStatusChange(fn) { onStatusChange = fn }
function setAreaId(id) { currentAreaId = id }

function reportStatus(online) {
  onStatusChange?.(online)
}

function setSupabase(client) {
  supabase = client
}

function setUserId(uid) {
  currentUserId = uid
}

async function pullClients() {
  if (!supabase || !currentAreaId) return
  try {
    const { data: remoteClients, error } = await supabase
      .from('clients')
      .select('id, name, rate_usd, active')
      .eq('area_id', currentAreaId)

    if (error) { console.error('[sync] Error pull clientes:', error.message); return }
    if (!remoteClients?.length) return

    const { upsertClient, setClientRules } = require('./db')

    for (const c of remoteClients) {
      upsertClient({ id: c.id, name: c.name, rate_usd: c.rate_usd })
    }

    // Pull de rules también
    const { data: remoteRules } = await supabase
      .from('rules')
      .select('client_id, keyword')
      .in('client_id', remoteClients.map(c => c.id))

    if (remoteRules?.length) {
      const byClient = {}
      for (const r of remoteRules) {
        if (!byClient[r.client_id]) byClient[r.client_id] = []
        byClient[r.client_id].push(r.keyword)
      }
      for (const [clientId, keywords] of Object.entries(byClient)) {
        setClientRules(clientId, keywords)
      }
    }

    console.log('[sync] Pull clientes:', remoteClients.length)
  } catch (err) {
    console.error('[sync] Error inesperado en pull:', err.message)
  }
}

async function syncClients() {
  if (!supabase || !currentUserId || !currentAreaId) return

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
    user_id:  currentUserId,
    area_id:  currentAreaId,
  }))

  const { error } = await supabase.from('clients').upsert(rows, { onConflict: 'id' })
  if (error) { console.error('[sync] Error clientes:', error.message); reportStatus(false); return }
  console.log('[sync] Clientes sincronizados:', clients.length)
}

async function syncEntries() {
  if (!supabase || !currentUserId || !currentAreaId) return

  const entries = getUnsyncedEntries()
  if (entries.length === 0) return

  console.log('[sync] Subiendo', entries.length, 'entradas...')

  const rows = entries.map(e => ({
    id:           e.id,
    client_id:    e.client_id,
    task_type:    e.task_type,
    started_at:   e.started_at,
    ended_at:     e.ended_at,
    duration_sec: e.duration_sec,
    source:       e.source,
    window_title: e.window_title,
    note:         e.note,
    user_id:      currentUserId,
    area_id:      currentAreaId,
  }))

  const { error } = await supabase.from('time_entries').upsert(rows, { onConflict: 'id' })
  if (error) { console.error('[sync] Error entradas:', error.message); reportStatus(false); return }

  markEntriesSynced(entries.map(e => e.id))
  console.log('[sync] OK —', entries.length, 'entradas sincronizadas')
}

async function runSync() {
  try {
    await syncClients()
    await syncEntries()
    reportStatus(true)
  } catch (err) {
    console.error('[sync] Error inesperado:', err.message)
    reportStatus(false)
  }
}

function start() {
  if (syncInterval) return
  console.log('[sync] Iniciado, sincronizando cada', SYNC_INTERVAL_MS / 1000, 'seg')
  pullClients().then(() => runSync())
  syncInterval = setInterval(runSync, SYNC_INTERVAL_MS)
}

function stop() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
  supabase = null
  currentUserId = null
  lastClientSync = 0
}

async function syncNow() { await runSync() }

function resetClientSync() { lastClientSync = 0 }

module.exports = { start, stop, syncNow, setSupabase, setUserId, setOnStatusChange, setAreaId, resetClientSync }
