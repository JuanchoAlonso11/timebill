// electron/db.js
// Base de datos local SQLite — opera offline-first.
// Supabase sync se agrega en semana 3 sobre esta misma estructura.

const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

const DB_PATH = path.join(app.getPath('userData'), 'timebill.db')

let db

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL') // mejor performance para escrituras frecuentes
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      rate_usd    REAL NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      synced      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      keyword     TEXT NOT NULL,
      match_type  TEXT NOT NULL DEFAULT 'title',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id           TEXT PRIMARY KEY,
      client_id    TEXT REFERENCES clients(id) ON DELETE SET NULL,
      task_type    TEXT NOT NULL DEFAULT 'general',
      started_at   TEXT NOT NULL,
      ended_at     TEXT,
      duration_sec INTEGER,
      source       TEXT NOT NULL DEFAULT 'auto',
      window_title TEXT,
      note         TEXT,
      synced       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_client ON time_entries(client_id);
    CREATE INDEX IF NOT EXISTS idx_entries_started ON time_entries(started_at);
    CREATE INDEX IF NOT EXISTS idx_entries_synced ON time_entries(synced);
  `)
}

// --- Clients ---

function getAllClients() {
  return getDb().prepare(`
    SELECT c.*, GROUP_CONCAT(r.keyword, '|') as keywords
    FROM clients c
    LEFT JOIN rules r ON r.client_id = c.id
    WHERE c.active = 1
    GROUP BY c.id
  `).all().map(row => ({
    ...row,
    keywords: row.keywords ? row.keywords.split('|') : []
  }))
}

function upsertClient({ id, name, rate_usd }) {
  getDb().prepare(`
    INSERT INTO clients (id, name, rate_usd)
    VALUES (@id, @name, @rate_usd)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      rate_usd = excluded.rate_usd,
      synced = 0
  `).run({ id, name, rate_usd })
}

function setClientRules(clientId, keywords) {
  const db = getDb()
  const deleteStmt = db.prepare(`DELETE FROM rules WHERE client_id = ?`)
  const insertStmt = db.prepare(`
    INSERT INTO rules (client_id, keyword, match_type)
    VALUES (?, ?, 'title')
  `)
  const transaction = db.transaction((clientId, keywords) => {
    deleteStmt.run(clientId)
    for (const kw of keywords) {
      if (kw.trim()) insertStmt.run(clientId, kw.trim().toLowerCase())
    }
  })
  transaction(clientId, keywords)
}

// --- Time entries ---

function insertEntry({ id, client_id, task_type, started_at, window_title, source = 'auto' }) {
  getDb().prepare(`
    INSERT INTO time_entries (id, client_id, task_type, started_at, window_title, source)
    VALUES (@id, @client_id, @task_type, @started_at, @window_title, @source)
  `).run({ id, client_id, task_type, started_at, window_title, source })
}

function closeEntry({ id, ended_at, duration_sec }) {
  getDb().prepare(`
    UPDATE time_entries
    SET ended_at = @ended_at, duration_sec = @duration_sec
    WHERE id = @id
  `).run({ id, ended_at, duration_sec })
}

function getEntriesInRange(fromDate, toDate) {
  return getDb().prepare(`
    SELECT
      te.*,
      c.name  AS client_name,
      c.rate_usd
    FROM time_entries te
    LEFT JOIN clients c ON c.id = te.client_id
    WHERE te.started_at >= ?
      AND te.started_at <= ?
      AND te.ended_at IS NOT NULL
    ORDER BY te.started_at DESC
  `).all(fromDate, toDate)
}

function getEntriesForClient(clientId, fromDate, toDate) {
  return getDb().prepare(`
    SELECT * FROM time_entries
    WHERE client_id = ?
      AND started_at >= ?
      AND started_at <= ?
      AND ended_at IS NOT NULL
    ORDER BY started_at DESC
  `).all(clientId, fromDate, toDate)
}

// Entradas aún no sincronizadas con Supabase (semana 3)
function getUnsyncedEntries() {
  return getDb().prepare(`
    SELECT * FROM time_entries
    WHERE synced = 0 AND ended_at IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 50
  `).all()
}

function markEntriesSynced(ids) {
  const stmt = getDb().prepare(`UPDATE time_entries SET synced = 1 WHERE id = ?`)
  const transaction = getDb().transaction((ids) => {
    for (const id of ids) stmt.run(id)
  })
  transaction(ids)
}

module.exports = {
  getDb,
  getAllClients,
  upsertClient,
  setClientRules,
  insertEntry,
  closeEntry,
  getEntriesInRange,
  getEntriesForClient,
  getUnsyncedEntries,
  markEntriesSynced
}
