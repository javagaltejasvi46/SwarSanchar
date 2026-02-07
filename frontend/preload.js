/**
 * Swarsanchar Media Suite - Preload Script
 * Exposes safe APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Dialog functions
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),

    // Backend URL
    getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

    // Platform info
    platform: process.platform
});
