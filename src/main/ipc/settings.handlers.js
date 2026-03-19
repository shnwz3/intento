const { ipcMain, shell } = require('electron');
const configService = require('../services/ConfigService');

function registerSettingsHandlers() {
    ipcMain.handle('getAIConfig', async () => {
        return configService.getConfig();
    });

    ipcMain.handle('saveAIConfig', async (event, config) => {
        const result = configService.saveConfig(config);

        // Refresh VisionService providers so the new key takes effect immediately
        try {
            const serviceManager = require('../services/ServiceManager');
            const vision = serviceManager.get('VisionService');
            vision.refreshProviders();
        } catch (e) {
            console.warn('⚠️ Could not refresh VisionService:', e.message);
        }

        return result;
    });

    ipcMain.handle('getAICredits', async (event, provider) => {
        return configService.getCredits(provider);
    });

    ipcMain.handle('shell:openExternal', async (event, url) => {
        if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
            return { success: false, error: 'Invalid URL: only http/https allowed' };
        }
        await shell.openExternal(url);
        return { success: true };
    });
}

module.exports = { registerSettingsHandlers };

