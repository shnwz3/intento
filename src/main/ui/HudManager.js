const { BrowserWindow, screen } = require('electron');
const path = require('path');

class HudManager {
    constructor() {
        this.hudWindow = null;
        this.cycleInterval = null;
    }

    /**
     * Create the HUD (heads-up display) window
     */
    createHudWindow() {
        if (this.hudWindow) return;

        this.hudWindow = new BrowserWindow({
            width: 500,
            height: 60,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            focusable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });

        this.hudWindow.setIgnoreMouseEvents(true);

        if (!require('electron').app.isPackaged) {
            this.hudWindow.loadURL('http://localhost:5173/hud.html');
        } else {
            this.hudWindow.loadFile(path.join(__dirname, '../../../dist/hud.html'));
        }

        this.hudWindow.showInactive();
        this.reset();

        // Position at bottom center of screen
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        this.hudWindow.setPosition(Math.floor((width - 500) / 2), height - 100);

        this.hudWindow.on('closed', () => {
            this.hudWindow = null;
        });
    }

    getHudWindow() {
        return this.hudWindow;
    }

    /**
     * Show HUD with a message (without stealing focus)
     * @param {string} text
     */
    show(text) {
        if (!this.hudWindow) this.createHudWindow();
        // console.log(`🖥️ HUD: ${text}`);
        try {
            this.hudWindow.webContents.send('hud:update', text);
            this.hudWindow.showInactive();
        } catch (e) {
            console.error('Failed to update HUD:', e.message);
        }
    }

    /**
     * Hide the HUD
     */
    hide() {
        if (this.hudWindow) {
            this.stopCycle(); // Ensure cycle stops when hidden
            this.hudWindow.hide();
        }
    }

    /**
     * Start cycling HUD messages
     * @param {string[]} messages
     */
    startCycle(messages) {
        this.stopCycle();
        const SPINNER = `<div class="spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></div>`;

        if (!messages || messages.length === 0) return;

        let index = 0;
        this.show(`${SPINNER} ${messages[0]}`);

        this.cycleInterval = setInterval(() => {
            index = (index + 1) % messages.length;
            this.show(`${SPINNER} ${messages[index]}`);
        }, 2000);
    }

    /**
     * Stop HUD cycle
     */
    stopCycle() {
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval);
            this.cycleInterval = null;
        }
    }

    /**
     * Reset the HUD to idle state
     */
    reset() {
        this.stopCycle();
        const WAND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wand-2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`;
        this.show(WAND_ICON);
    }

    /**
     * Run a visual countdown on the HUD
     * @param {number} seconds
     * @param {string} actionText
     */
    async startCountdown(seconds, actionText = 'Typing in', autoReset = true) {
        this.stopCycle();
        for (let i = seconds; i > 0; i--) {
            this.show(`${actionText} ${i}s...`);
            await new Promise((r) => setTimeout(r, 1000));
        }
        if (autoReset) {
            this.reset();
        }
    }
}

module.exports = new HudManager();
