const { ipcMain } = require('electron');
const { getMainWindow } = require('../windows/mainWindow');
const hudManager = require('../ui/HudManager');

/**
 * Register window control IPC handlers
 */
function registerWindowHandlers() {
    ipcMain.handle('window:minimize', () => {
        const win = getMainWindow();
        if (win) win.minimize();
    });

    ipcMain.handle('window:restore', () => {
        const win = getMainWindow();
        if (win && win.isMinimized()) win.restore();
        if (win) {
            win.show();
            win.focus();
        }
    });

    ipcMain.handle('hud:show', (_event, { text }) => {
        hudManager.show(text);
    });

    ipcMain.handle('hud:hide', () => {
        hudManager.hide();
    });

    ipcMain.handle('hud:reset', () => {
        hudManager.reset();
    });

    console.log('📡 Window IPC handlers registered');
}

module.exports = { registerWindowHandlers };
