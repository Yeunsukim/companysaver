const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('saver', {
  getPlaylist: () => ipcRenderer.invoke('playlist:get'),
  onPlaylist: (cb) => ipcRenderer.on('playlist', (_e, items) => cb(items)),
  quit: () => ipcRenderer.send('saver:quit'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (c) => ipcRenderer.invoke('config:save', c),
  testConfig: (c) => ipcRenderer.invoke('config:test', c),
});
