// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('timebill', {

  timer: {
    start:      (args) => ipcRenderer.invoke('timer:start', args),
    stop:       ()     => ipcRenderer.invoke('timer:stop'),
    updateTask: (type) => ipcRenderer.invoke('timer:updateTask', type),
    getActive:  ()     => ipcRenderer.invoke('timer:getActive'),
  },

  detection: {
    ignore: () => ipcRenderer.invoke('detection:ignore'),
    onData: (fn) => ipcRenderer.on('detection:data', (_, data) => fn(data)),
  },

  idle: {
    'continue': () => ipcRenderer.invoke('idle:continue'),
    stop: (minutes) => ipcRenderer.invoke('idle:stop', minutes),
  },

  clients: {
    getAll:   ()           => ipcRenderer.invoke('clients:getAll'),
    upsert:   (client)     => ipcRenderer.invoke('clients:upsert', client),
    setRules: (clientId, keywords) => ipcRenderer.invoke('clients:setRules', { clientId, keywords }),
  },
})
