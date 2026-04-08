const { ipcMain } = require('electron');
const serviceManager = require('../services/ServiceManager');
const hudManager = require('../ui/HudManager');
const configService = require('../services/ConfigService');

let typing;

function registerTypingHandlers() {
    typing = serviceManager.get('TypingService');

    ipcMain.handle('text:typeAtCursor', async (_event, { text, countdown = 0 }) => {
        const incoming = Number(countdown);
        const fallback = Number(configService.getTypingConfig()?.countdownSeconds);
        const resolved = Number.isFinite(incoming) ? incoming : (Number.isFinite(fallback) ? fallback : 0);
        const safeCountdown = Math.max(3, Math.min(15, Math.floor(resolved)));

        if (safeCountdown > 0) {
            await hudManager.startCountdown(safeCountdown, 'Place cursor! Typing in');
        }
        return typing.typeAtCursor(text, safeCountdown);
    });

    console.log('Typing IPC handlers registered');
}

module.exports = { registerTypingHandlers };
