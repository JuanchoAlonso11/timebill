// electron/preload.js
// Expone una API segura al renderer via contextBridge.
// El renderer NUNCA tiene acceso directo a Node.js — solo a estas funciones.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('timebill', {

  // Timer
  timer: {
    start:      (args) => ipcRenderer.invoke('timer:start', args),
    stop:       ()     => ipcRenderer.invoke('timer:stop'),
    updateTask: (type) => ipcRenderer.invoke('timer:updateTask', type),
    getActive:  ()     => ipcRenderer.invoke('timer:getActive'),
  },

  // Detección
  detection: {
    ignore: () => ipcRenderer.invoke('detection:ignore'),
    // Recibir datos de la detección desde main
    onData: (fn) => ipcRenderer.on('detection:data', (_, data) => fn(data)),
  },

  // Clientes
  clients: {
    getAll:   ()           => ipcRenderer.invoke('clients:getAll'),
    upsert:   (client)     => ipcRenderer.invoke('clients:upsert', client),
    setRules: (clientId, keywords) => ipcRenderer.invoke('clients:setRules', { clientId, keywords }),
  },
})
