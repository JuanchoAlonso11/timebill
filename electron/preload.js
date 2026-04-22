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

  manual: {
    startNow:  (args) => ipcRenderer.invoke('manual:startNow', args),
    saveRetro: (args) => ipcRenderer.invoke('manual:saveRetro', args),
    close:     ()     => ipcRenderer.invoke('manual:close'),
    onData:    (fn)   => ipcRenderer.on('manual:data', (_, data) => fn(data)),
  },

  config: {
    getClients:  ()                     => ipcRenderer.invoke('config:getClients'),
    saveClient:  (client)               => ipcRenderer.invoke('config:saveClient', client),
    setKeywords: (clientId, keywords)   => ipcRenderer.invoke('config:setKeywords', { clientId, keywords }),
    onData:      (fn)                   => ipcRenderer.on('config:data', (_, data) => fn(data)),
  },

  auth: {
    login:   (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
    logout:  ()                => ipcRenderer.invoke('auth:logout'),
    getUser: ()                => ipcRenderer.invoke('auth:getUser'),
  },

  app: {
    quit:            () => ipcRenderer.invoke('app:quit'),
    openDashboard:   () => ipcRenderer.invoke('app:openDashboard'),
    openConfig:      () => ipcRenderer.invoke('app:openConfig'),
    openManual:      () => ipcRenderer.invoke('app:openManual'),
    openOnboarding:  () => ipcRenderer.invoke('app:openOnboarding'),
    closeOnboarding: () => ipcRenderer.invoke('app:closeOnboarding'),
    beep:            () => ipcRenderer.invoke('app:beep'),
  },

  dashboard: {
    getData: (from, to) => ipcRenderer.invoke('dashboard:getData', { from, to }),
  },

  report: {
    getData:   ()       => ipcRenderer.invoke('report:getData'),
    generate:  (args)   => ipcRenderer.invoke('report:generate', args),
    save:      (args)   => ipcRenderer.invoke('report:save', args),
    whatsapp:  (args)   => ipcRenderer.invoke('report:whatsapp', args),
  },

  clients: {
    getAll:   ()                     => ipcRenderer.invoke('clients:getAll'),
    upsert:   (client)               => ipcRenderer.invoke('clients:upsert', client),
    setRules: (clientId, keywords)   => ipcRenderer.invoke('clients:setRules', { clientId, keywords }),
  },
})
