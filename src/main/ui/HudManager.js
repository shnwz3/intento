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

        this.hudWindow.hide();

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

        if (!messages || messages.length === 0) return;

        let index = 0;
        this.show(messages[0]);

        this.cycleInterval = setInterval(() => {
            index = (index + 1) % messages.length;
            this.show(messages[index]);
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
     * Run a visual countdown on the HUD
     * @param {number} seconds
     * @param {string} actionText
     */
    async startCountdown(seconds, actionText = 'Typing in', autohide = true) {
        this.stopCycle();
        for (let i = seconds; i > 0; i--) {
            this.show(`${actionText} ${i}s...`);
            await new Promise((r) => setTimeout(r, 1000));
        }
        if (autohide) {
            this.hide();
        }
    }
}

module.exports = new HudManager();
