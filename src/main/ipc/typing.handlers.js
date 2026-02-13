const { ipcMain } = require('electron');
const TypingService = require('../services/typing/TypingService');
const hudManager = require('../ui/HudManager');

const typing = new TypingService();

/**
 * Register all typing-related IPC handlers
 */
function registerTypingHandlers() {
    ipcMain.handle('text:typeAtCursor', async (_event, { text, countdown = 0 }) => {
        if (countdown > 0) {
            await hudManager.startCountdown(countdown, 'Place cursor! Typing in');
        }
        return typing.typeAtCursor(text, 0);
    });

    console.log('📡 Typing IPC handlers registered');
}

function getTyping() { return typing; }

module.exports = { registerTypingHandlers, getTyping };
