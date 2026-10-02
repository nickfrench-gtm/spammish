const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('spammish', Object.freeze({
  setupGuide: () => ipcRenderer.invoke('spammish:setupGuide'),
  status: () => ipcRenderer.invoke('spammish:status'),
  connect: (id) => ipcRenderer.invoke('spammish:connect', id),
  cancel: () => ipcRenderer.invoke('spammish:cancel'),
  enable: (id) => ipcRenderer.invoke('spammish:enable', id),
  pause: (id) => ipcRenderer.invoke('spammish:pause', id),
  review: () => ipcRenderer.invoke('spammish:review'),
  explainMessage: (id, messageId) => ipcRenderer.invoke('spammish:explainMessage', id, messageId),
  abyssMessage: (id, messageId) => ipcRenderer.invoke('spammish:abyssMessage', id, messageId),
  rescueMessage: (id, messageId) => ipcRenderer.invoke('spammish:rescueMessage', id, messageId),
  retry: () => ipcRenderer.invoke('spammish:retry'),
  disconnect: (id) => ipcRenderer.invoke('spammish:disconnect', id),
  abyss: (id) => ipcRenderer.invoke('spammish:abyss', id),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('spammish:status', listener);
    return () => ipcRenderer.removeListener('spammish:status', listener);
  },
}));
