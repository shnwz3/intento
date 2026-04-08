const { BrowserWindow, ipcMain, shell } = require('electron');
const configService = require('../services/ConfigService');
const serviceManager = require('../services/ServiceManager');

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSavePayload(payload) {
    if (!isPlainObject(payload) || !Object.prototype.hasOwnProperty.call(payload, 'config') || !isPlainObject(payload.config)) {
        throw new Error('saveAIConfig requires a payload shaped like { config, keyUpdates, clearKeys }.');
    }

    if (payload.keyUpdates != null && !isPlainObject(payload.keyUpdates)) {
        throw new Error('saveAIConfig keyUpdates must be an object when provided.');
    }

    if (payload.clearKeys != null && !Array.isArray(payload.clearKeys)) {
        throw new Error('saveAIConfig clearKeys must be an array when provided.');
    }

    return {
        config: payload.config,
        keyUpdates: payload.keyUpdates || {},
        clearKeys: payload.clearKeys || [],
    };
}

function registerSettingsHandlers() {
    ipcMain.handle('getAIConfig', async () => {
        return configService.getPublicConfig();
    });

    ipcMain.handle('saveAIConfig', async (_event, payload) => {
        const normalizedPayload = normalizeSavePayload(payload);
        const result = configService.savePublicConfig(normalizedPayload.config, {
            keyUpdates: normalizedPayload.keyUpdates,
            clearKeys: normalizedPayload.clearKeys,
        });
        const publicConfig = result.publicConfig || configService.getPublicConfig();

        try {
            const vision = serviceManager.get('VisionService');
            vision.refreshProviders();
        } catch (e) {
            console.warn('Could not refresh VisionService:', e.message);
        }

        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('config:update', publicConfig);
        });

        return {
            ...result,
            config: publicConfig,
        };
    });

    ipcMain.handle('getProviderOverview', async () => {
        return configService.getProviderOverview();
    });

    ipcMain.handle('getAICredits', async (_event, provider) => {
        return configService.getCredits(provider);
    });

    ipcMain.handle('shell:openExternal', async (_event, url) => {
        if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
            return { success: false, error: 'Invalid URL: only http/https allowed' };
        }
        await shell.openExternal(url);
        return { success: true };
    });
}

module.exports = { registerSettingsHandlers };
