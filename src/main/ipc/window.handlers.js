const { ipcMain } = require('electron');
const { getMainWindow } = require('../windows/mainWindow');

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

    console.log('📡 Window IPC handlers registered');
}

module.exports = { registerWindowHandlers };
