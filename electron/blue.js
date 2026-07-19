// electron/blue.js
// Obtiene la cotización del dólar blue (valor de VENTA) desde dolarapi.com.
// Usa el módulo `net` de Electron (stack de red de Chromium): más robusto que
// el fetch de Node en el proceso principal (respeta proxy/certs del sistema).
// Cachea el último valor unos minutos para no golpear la API en cada tarea.

const { net } = require('electron')

const BLUE_URL = 'https://dolarapi.com/v1/dolares/blue'
const CACHE_MS = 5 * 60 * 1000   // 5 minutos
const TIMEOUT_MS = 8000

let cached = { venta: null, at: 0 }

// Consulta fresca a la API. Devuelve el número de venta, o null si falla.
function fetchBlueVenta() {
  return new Promise((resolve) => {
    let settled = false
    const done = (val) => { if (!settled) { settled = true; resolve(val) } }

    try {
      const request = net.request(BLUE_URL)
      let body = ''

      const timeout = setTimeout(() => {
        try { request.abort() } catch {}
        console.error('[blue] Timeout consultando la cotización')
        done(null)
      }, TIMEOUT_MS)

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          clearTimeout(timeout)
          console.error('[blue] HTTP', response.statusCode)
          done(null)
          return
        }
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => {
          clearTimeout(timeout)
          try {
            const data = JSON.parse(body)
            const venta = Number(data?.venta)
            if (Number.isFinite(venta) && venta > 0) {
              cached = { venta, at: Date.now() }
              console.log('[blue] Cotización venta:', venta)
              done(venta)
            } else {
              console.error('[blue] Respuesta sin venta válida')
              done(null)
            }
          } catch (e) {
            console.error('[blue] Error parseando respuesta:', e.message)
            done(null)
          }
        })
      })

      request.on('error', (err) => {
        clearTimeout(timeout)
        console.error('[blue] Error de red:', err.message)
        done(null)
      })

      request.end()
    } catch (err) {
      console.error('[blue] Error al consultar:', err.message)
      done(null)
    }
  })
}

// Devuelve la cotización usando el cache reciente si existe; si no, consulta.
// Puede devolver null si no hay internet y no hay nada cacheado.
async function getBlueVenta() {
  if (cached.venta && (Date.now() - cached.at) < CACHE_MS) {
    return cached.venta
  }
  return await fetchBlueVenta()
}

function getCachedBlue() {
  return cached.venta
}

module.exports = { getBlueVenta, fetchBlueVenta, getCachedBlue }
