// electron/ruleEngine.js
// Cruza el título de la ventana activa contra las reglas de cada cliente.
// Retorna el cliente con más matches, o null si ninguno aplica.

const { getAllClients } = require('./db')

// Cache de clientes para no hacer DB query en cada poll (se invalida cada 30s)
let clientsCache = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000

function getClients() {
  const now = Date.now()
  if (!clientsCache || now - cacheTimestamp > CACHE_TTL_MS) {
    clientsCache = getAllClients()
    cacheTimestamp = now
  }
  return clientsCache
}

function invalidateCache() {
  clientsCache = null
}

/**
 * Recibe el título de la ventana activa y retorna:
 * { client, matchedKeywords, score } | null
 */
function matchWindow(windowTitle) {
  if (!windowTitle) return null

  const titleLower = windowTitle.toLowerCase()
  const clients = getClients()

  let bestMatch = null
  let bestScore = 0

  for (const client of clients) {
    if (!client.keywords?.length) continue

    const matched = client.keywords.filter(kw =>
      kw && titleLower.includes(kw.toLowerCase())
    )

    // Score = cantidad de keywords matcheadas.
    // Empate: gana el cliente con keyword más larga (más específica)
    if (matched.length > 0) {
      const score = matched.reduce((acc, kw) => acc + kw.length, 0)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { client, matchedKeywords: matched, score }
      }
    }
  }

  return bestMatch
}

/**
 * Dado un título, devuelve el cliente que matchea (o null).
 * Útil para testear reglas desde la UI sin arrancar el monitor.
 */
function testTitle(windowTitle) {
  return matchWindow(windowTitle)
}

module.exports = { matchWindow, testTitle, invalidateCache }
