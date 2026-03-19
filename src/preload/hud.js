const { contextBridge, ipcRenderer } = require('electron');

/**
 * HUD Preload — exposes only the hud:update listener to the renderer
 */
contextBridge.exposeInMainWorld('hudAPI', {
    onUpdate: (callback) => {
        ipcRenderer.on('hud:update', (_event, text) => callback(text));
    },
});
