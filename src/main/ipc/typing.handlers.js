const { ipcMain } = require('electron');
const serviceManager = require('../services/ServiceManager');
const hudManager = require('../ui/HudManager');

let typing;

function registerTypingHandlers() {
    typing = serviceManager.get('TypingService');

    ipcMain.handle('text:typeAtCursor', async (_event, { text, countdown = 0 }) => {
        if (countdown > 0) {
            await hudManager.startCountdown(countdown, 'Place cursor! Typing in');
        }
        return typing.typeAtCursor(text, countdown);
    });

    console.log('Typing IPC handlers registered');
}

module.exports = { registerTypingHandlers };
