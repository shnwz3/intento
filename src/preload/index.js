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

    // Form Automation
    inspectForm: (base64) => ipcRenderer.invoke('form:inspect', { base64 }),
    automateForm: () => ipcRenderer.invoke('form:automate'),
    cancelFormAutomation: () => ipcRenderer.invoke('form:cancel'),

    // Brain — Tag System
    openBrain: () => ipcRenderer.invoke('brain:open'),
    brainUploadDoc: () => ipcRenderer.invoke('brain:uploadDoc'),
    brainExtractTags: (documentText) =>
        ipcRenderer.invoke('brain:extractTags', { documentText }),
    brainSaveTags: (tags) => ipcRenderer.invoke('brain:saveTags', tags),
    brainGetTags: () => ipcRenderer.invoke('brain:getTags'),

    // Tag CRUD
    brainAddTag: (headingId, label, value) =>
        ipcRenderer.invoke('brain:addTag', { headingId, label, value }),
    brainUpdateTag: (id, updates) =>
        ipcRenderer.invoke('brain:updateTag', { id, ...updates }),
    brainDeleteTag: (id) => ipcRenderer.invoke('brain:deleteTag', { id }),

    // Heading CRUD
    brainAddHeading: (label, section) => ipcRenderer.invoke('brain:addHeading', { label, section }),
    brainUpdateHeading: (id, label) => ipcRenderer.invoke('brain:updateHeading', { id, label }),
    brainDeleteHeading: (id) => ipcRenderer.invoke('brain:deleteHeading', { id }),

    getBrainStatus: () => ipcRenderer.invoke('brain:status'),

    // Multi-Brain Profile Management
    brainList: () => ipcRenderer.invoke('brain:list'),
    brainCreate: (name) => ipcRenderer.invoke('brain:create', { name }),
    brainDeleteProfile: (id) => ipcRenderer.invoke('brain:delete', { id }),
    brainRenameProfile: (id, newName) =>
        ipcRenderer.invoke('brain:rename', { id, newName }),
    brainSetActive: (id) => ipcRenderer.invoke('brain:setActive', { id }),
    brainSetActiveAgent: (agentId) => ipcRenderer.invoke('brain:setActiveAgent', { agentId }),

    // Legacy brain
    saveBrain: (data) => ipcRenderer.invoke('brain:save', data),
    uploadDoc: () => ipcRenderer.invoke('doc:upload'),

    // Window
    minimize: () => ipcRenderer.invoke('window:minimize'),
    restore: () => ipcRenderer.invoke('window:restore'),

    // Events from main
    onShortcut: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('shortcut:image-mode', listener);
        return () => ipcRenderer.removeListener('shortcut:image-mode', listener);
    },
    onHudUpdate: (callback) => {
        const listener = (_event, text) => callback(text);
        ipcRenderer.on('hud:update', listener);
        return () => ipcRenderer.removeListener('hud:update', listener);
    },
    onBrainUpdate: (callback) => {
        const listener = (_event, status) => callback(status);
        ipcRenderer.on('brain:update', listener);
        return () => ipcRenderer.removeListener('brain:update', listener);
    },
    onConfigUpdate: (callback) => {
        const listener = (_event, config) => callback(config);
        ipcRenderer.on('config:update', listener);
        return () => ipcRenderer.removeListener('config:update', listener);
    },

    // HUD Control
    hudShow: (text) => ipcRenderer.invoke('hud:show', { text }),
    hudHide: () => ipcRenderer.invoke('hud:hide'),
    hudReset: () => ipcRenderer.invoke('hud:reset'),

    // Settings & Models
    getAIConfig: () => ipcRenderer.invoke('getAIConfig'),
    saveAIConfig: (config) => ipcRenderer.invoke('saveAIConfig', config),
    getProviderOverview: () => ipcRenderer.invoke('getProviderOverview'),
    getAICredits: (provider) => ipcRenderer.invoke('getAICredits', provider),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
