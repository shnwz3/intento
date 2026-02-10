const { ipcMain } = require('electron');
const TypingService = require('../services/typing/TypingService');

const typing = new TypingService();

/**
 * Register all typing-related IPC handlers
 */
function registerTypingHandlers() {
    ipcMain.handle('text:typeAtCursor', async (_event, { text, countdown = 0 }) => {
        return typing.typeAtCursor(text, countdown);
    });

    console.log('📡 Typing IPC handlers registered');
}

function getTyping() { return typing; }

module.exports = { registerTypingHandlers, getTyping };
