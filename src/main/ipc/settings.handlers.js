const { BrowserWindow, ipcMain, shell } = require('electron');
const configService = require('../services/ConfigService');

function registerSettingsHandlers() {
    ipcMain.handle('getAIConfig', async () => {
        return configService.getConfig();
    });

    ipcMain.handle('saveAIConfig', async (_event, config) => {
        const result = configService.saveConfig(config);

        try {
            const serviceManager = require('../services/ServiceManager');
            const vision = serviceManager.get('VisionService');
            vision.refreshProviders();
        } catch (e) {
            console.warn('Could not refresh VisionService:', e.message);
        }

        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('config:update', result.config);
        });

        return result;
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
