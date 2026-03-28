# TimeBill — Semana 1

Motor de detección automática de ventanas + timer local.

## Setup

```bash
git clone https://github.com/TU_USUARIO/timebill.git
cd timebill
npm install           # también corre postinstall que compila better-sqlite3
npm run dev           # arranca Vite + Electron juntos
```

> **Nota Windows:** si `postinstall` falla, corré `npm run rebuild` manualmente.  
> **Nota Mac:** puede pedir permisos de Accesibilidad en Sistema → Privacidad para leer ventanas activas.

## Qué hace en este estado

- Arranca en el tray (ícono verde con T)
- Monitorea la ventana activa cada 3 segundos
- Cuando detecta un título que contiene keywords de un cliente → muestra popup
- El popup tiene countdown de 15s, confirmar arranca el timer
- El timer se muestra en el tray (MM:SS actualizado cada segundo)
- Click en el tray → abre widget con cronómetro, selector de tarea y botón stop
- Todo se guarda en SQLite local (`~/Library/Application Support/timebill/timebill.db` en Mac)
- Clientes de prueba cargados automáticamente en modo dev:
  - **García S.A.** — keywords: garcia, garcía, exp-2024-047
  - **Martínez Hnos.** — keywords: martinez, escritura
  - **Pérez & Asociados** — keywords: perez, demanda-civil

## Para probar

Abrí un archivo o carpeta con el nombre de un cliente, por ejemplo:
- `Contrato_GarcíaSA_v2.docx` → detecta García S.A.
- Cualquier ventana con "martinez" en el título → detecta Martínez Hnos.

## Estructura

```
timebill/
├── electron/
│   ├── main.js           ← entry point, tray, IPC
│   ├── windowMonitor.js  ← polling ventana activa (active-win)
│   ├── ruleEngine.js     ← match keywords → cliente
│   ├── timer.js          ← timer + idle detection (pausa a 5 min)
│   ├── db.js             ← SQLite (better-sqlite3)
│   └── preload.js        ← bridge seguro main ↔ renderer
├── renderer/
│   ├── popup.html        ← shell del popup de detección
│   ├── tray.html         ← shell del widget del timer
│   ├── popup/
│   │   ├── main.jsx      ← entry React del popup
│   │   └── DetectionPopup.jsx
│   └── tray/
│       ├── main.jsx      ← entry React del timer widget
│       └── TimerWidget.jsx
├── assets/
│   └── tray-icon.png
└── vite.config.js
```

## Schema SQLite

```sql
clients      (id, name, rate_usd, active, synced)
rules        (id, client_id, keyword, match_type)
time_entries (id, client_id, task_type, started_at, ended_at, duration_sec, source, synced)
```

`synced = 0` marca registros pendientes de subir a Supabase (semana 3).

## Roadmap

| Semana | Qué se agrega |
|--------|---------------|
| **1** ✓ | Monitor + timer + popup + SQLite |
| **2** | Popup idle, registro manual, config de clientes |
| **3** | Dashboard web React + sync Supabase |
| **4** | Reportes PDF + envío WhatsApp |
