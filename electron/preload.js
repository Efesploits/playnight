'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pn', {
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    set: (data) => ipcRenderer.invoke('store:set', data),
    path: () => ipcRenderer.invoke('store:path'),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    fullscreen: () => ipcRenderer.send('win:fullscreen'),
    onState: (cb) => {
      const fn = (_e, s) => cb(s);
      ipcRenderer.on('window:state', fn);
      return () => ipcRenderer.removeListener('window:state', fn);
    },
  },
  shell: {
    open: (url) => ipcRenderer.invoke('shell:open', url),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (asset) => ipcRenderer.invoke('update:download', asset),
    install: (filePath) => ipcRenderer.invoke('update:install', filePath),
    cancel: () => ipcRenderer.send('update:cancel'),
    onProgress: (cb) => {
      const fn = (_e, p) => cb(p);
      ipcRenderer.on('update:progress', fn);
      return () => ipcRenderer.removeListener('update:progress', fn);
    },
  },
  dialog: {
    message: (opts) => ipcRenderer.invoke('dialog:message', opts),
  },
});
