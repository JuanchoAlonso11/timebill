# Smart Hours

Aplicación de escritorio para tracking automático de horas profesionales. Detecta la ventana activa, identifica el cliente según keywords configurables y registra el tiempo trabajado — todo de forma local y sincronizado con la nube.

---

## Características

- **Detección automática** — monitorea la ventana activa y arranca el timer cuando detecta un cliente
- **Registro manual** — Ctrl+Shift+B para registrar tareas retroactivas o iniciar el timer manualmente
- **Idle detection** — pausa el timer automáticamente si no hay actividad, con beep de recordatorio configurable
- **Dashboard** — log de horas por cliente con totales, importes y generación de reportes PDF
- **Reportes** — exportación a PDF y envío por WhatsApp
- **Multi-usuario** — RLS por área/organización vía Supabase, con roles admin y empleado
- **Offline-first** — SQLite local con sync automático a Supabase cada 30 segundos
- **Auto-update** — actualizaciones automáticas vía GitHub Releases

---

## Stack

- **Electron 29** + React/Vite
- **SQLite** (better-sqlite3) — almacenamiento local
- **Supabase** (PostgreSQL, São Paulo) — sync en la nube + Auth + RLS
- **electron-builder** — empaquetado Windows (.exe NSIS)
- **electron-updater** — auto-update vía GitHub Releases

---

## Setup de desarrollo

```bash
git clone https://github.com/JuanchoAlonso11/timebill.git
cd timebill
npm install
```

> Si `postinstall` falla en Windows, corré `npm run rebuild` manualmente.

**Arrancar en desarrollo:**

```bash
# Terminal 1
npm run dev

# Terminal 2
npx cross-env NODE_ENV=development electron .
```

---

## Build y distribución

```bash
# Generar .exe y publicar en GitHub Releases
$env:GH_TOKEN="tu_personal_access_token"
npm run dist -- --publish always
```

> Recordar actualizar `"version"` en `package.json` antes de cada release.

---

## Estructura del proyecto

```
timebill/
├── electron/
│   ├── main.js           ← entry point, ventanas, IPC handlers
│   ├── preload.js        ← bridge seguro main ↔ renderer
│   ├── timer.js          ← timer, idle detection, reminder beep
│   ├── sync.js           ← sync SQLite ↔ Supabase
│   ├── db.js             ← SQLite (better-sqlite3)
│   ├── windowMonitor.js  ← polling ventana activa (PowerShell)
│   └── ruleEngine.js     ← match keywords → cliente
├── renderer/
│   ├── login/            ← pantalla de login + recuperación de contraseña
│   ├── main-window/      ← ventana principal con timer y acciones
│   ├── dashboard/        ← dashboard de horas (empleado y admin)
│   ├── config/           ← configuración de clientes y tipos de tarea
│   ├── manual/           ← registro manual de tareas
│   ├── popup/            ← popup de detección automática
│   ├── idle/             ← popup de inactividad
│   └── onboarding/       ← onboarding de 3 pasos
├── assets/
│   └── icon-256.png
├── getwindow.ps1         ← script PowerShell para detectar ventana activa
└── vite.config.js
```

---

## Schema SQLite

```sql
clients      (id, name, rate_usd, active, area_id, synced)
rules        (id, client_id, keyword, match_type)
time_entries (id, client_id, task_type, started_at, ended_at, duration_sec, source, area_id, user_id, synced)
```

---

## Schema Supabase

```sql
organizations  (id, name, active_until)
areas          (id, organization_id, name)
memberships    (id, user_id, area_id, role)  -- role: 'admin' | 'employee'
clients        (id, name, rate_usd, active, area_id, user_id)
time_entries   (id, client_id, task_type, started_at, ended_at, duration_sec, source, area_id, user_id)
```

RLS activo en todas las tablas — cada usuario solo accede a los datos de su área.

---

## Alta de nuevos clientes (organizaciones)

La gestión de organizaciones, áreas y usuarios se realiza manualmente en el dashboard de Supabase. Roadmap incluye panel de administración web.

---

## Reset de contraseña

Página hosteada en Netlify: [smarthours-reset.netlify.app/reset-password.html](https://smarthours-reset.netlify.app/reset-password.html)
