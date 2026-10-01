const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('spammish', Object.freeze({
  status: () => ipcRenderer.invoke('spammish:status'),
  connect: () => ipcRenderer.invoke('spammish:connect'),
  cancel: () => ipcRenderer.invoke('spammish:cancel'),
  enable: () => ipcRenderer.invoke('spammish:enable'),
  pause: () => ipcRenderer.invoke('spammish:pause'),
  retry: () => ipcRenderer.invoke('spammish:retry'),
  disconnect: () => ipcRenderer.invoke('spammish:disconnect'),
  abyss: () => ipcRenderer.invoke('spammish:abyss'),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('spammish:status', listener);
    return () => ipcRenderer.removeListener('spammish:status', listener);
  },
}));
