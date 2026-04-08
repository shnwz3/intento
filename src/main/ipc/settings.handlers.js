const { BrowserWindow, ipcMain, shell } = require('electron');
const configService = require('../services/ConfigService');
const serviceManager = require('../services/ServiceManager');

function registerSettingsHandlers() {
    ipcMain.handle('getAIConfig', async () => {
        return configService.getPublicConfig();
    });

    ipcMain.handle('saveAIConfig', async (_event, payload) => {
        const hasPublicPayload = Boolean(payload?.config || payload?.keyUpdates || payload?.clearKeys);
        const result = hasPublicPayload
            ? configService.savePublicConfig(payload.config || {}, {
                keyUpdates: payload.keyUpdates || {},
                clearKeys: payload.clearKeys || [],
            })
            : configService.saveConfig(payload);
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
