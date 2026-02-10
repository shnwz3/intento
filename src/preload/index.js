const { contextBridge, ipcRenderer } = require('electron');

/**
 * Intento API exposed to React renderer
 * Uses contextBridge for secure IPC communication
 */
contextBridge.exposeInMainWorld('intentoAPI', {
    // Vision
    captureScreen: () => ipcRenderer.invoke('screenshot:capture'),
    analyze: (selectedText, prompt) =>
        ipcRenderer.invoke('vision:analyze', { selectedText, prompt }),
    isReady: () => ipcRenderer.invoke('vision:isReady'),

    // Typing
    typeAtCursor: (text, countdown) =>
        ipcRenderer.invoke('text:typeAtCursor', { text, countdown }),

    // Brain — Tag System
    openBrain: () => ipcRenderer.invoke('brain:open'),
    brainUploadDoc: () => ipcRenderer.invoke('brain:uploadDoc'),
    brainExtractTags: (documentText) =>
        ipcRenderer.invoke('brain:extractTags', { documentText }),
    brainSaveTags: (tags) => ipcRenderer.invoke('brain:saveTags', tags),
    brainGetTags: () => ipcRenderer.invoke('brain:getTags'),
    brainAddTag: (label, value) =>
        ipcRenderer.invoke('brain:addTag', { label, value }),
    brainUpdateTag: (id, value) =>
        ipcRenderer.invoke('brain:updateTag', { id, value }),
    brainDeleteTag: (id) => ipcRenderer.invoke('brain:deleteTag', { id }),
    getBrainStatus: () => ipcRenderer.invoke('brain:status'),

    // Multi-Brain Profile Management
    brainList: () => ipcRenderer.invoke('brain:list'),
    brainCreate: (name) => ipcRenderer.invoke('brain:create', { name }),
    brainDeleteProfile: (id) => ipcRenderer.invoke('brain:delete', { id }),
    brainRenameProfile: (id, newName) =>
        ipcRenderer.invoke('brain:rename', { id, newName }),
    brainSetActive: (id) => ipcRenderer.invoke('brain:setActive', { id }),

    // Legacy brain
    saveBrain: (data) => ipcRenderer.invoke('brain:save', data),
    uploadDoc: () => ipcRenderer.invoke('doc:upload'),

    // Window
    minimize: () => ipcRenderer.invoke('window:minimize'),
    restore: () => ipcRenderer.invoke('window:restore'),

    // Events from main
    onShortcut: (callback) => {
        ipcRenderer.on('shortcut:image-mode', () => callback());
    },
    onHudUpdate: (callback) => {
        ipcRenderer.on('hud:update', (_event, text) => callback(text));
    },
});
