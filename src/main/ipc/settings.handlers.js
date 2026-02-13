const { ipcMain, shell } = require('electron');
const configService = require('../services/ConfigService');

function registerSettingsHandlers() {
    ipcMain.handle('getAIConfig', async () => {
        return configService.getConfig();
    });

    ipcMain.handle('saveAIConfig', async (event, config) => {
        return configService.saveConfig(config);
    });

    ipcMain.handle('getAICredits', async (event, provider) => {
        return configService.getCredits(provider);
    });

    ipcMain.handle('shell:openExternal', async (event, url) => {
        await shell.openExternal(url);
        return { success: true };
    });
}

module.exports = { registerSettingsHandlers };
