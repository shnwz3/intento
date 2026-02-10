const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let hudWindow = null;
let isCapturing = false;

/**
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
    return mainWindow;
}

/**
 * @returns {BrowserWindow|null}
 */
function getHudWindow() {
    return hudWindow;
}

function setCapturing(value) {
    isCapturing = value;
}

function getCapturing() {
    return isCapturing;
}

/**
 * Create the main overlay window (search bar style)
 * @param {boolean} isDev
 */
function createMainWindow(isDev) {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 70,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, '../../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Load React app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Stealth: hide from screenshots
    mainWindow.setContentProtection(true);
    console.log('🕵️ Stealth Mode enabled');

    // Minimize on blur (unless capturing)
    mainWindow.on('blur', () => {
        if (!isCapturing) {
            mainWindow.minimize();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Create the HUD (heads-up display) window
 */
function createHudWindow() {
    hudWindow = new BrowserWindow({
        width: 300,
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

    hudWindow.setIgnoreMouseEvents(true);

    if (!require('electron').app.isPackaged) {
        hudWindow.loadURL('http://localhost:5173/hud.html');
    } else {
        hudWindow.loadFile(path.join(__dirname, '../../dist/hud.html'));
    }

    hudWindow.hide();

    // Position at bottom center of screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    hudWindow.setPosition(Math.floor((width - 300) / 2), height - 100);
}

/**
 * Show HUD with a message (without stealing focus)
 * @param {string} text
 */
function showHud(text) {
    if (!hudWindow) createHudWindow();
    console.log(`🖥️ HUD: ${text}`);
    hudWindow.webContents.send('hud:update', text);
    hudWindow.showInactive();
}

/**
 * Hide the HUD
 */
function hideHud() {
    if (hudWindow) hudWindow.hide();
}

/**
 * Run a visual countdown on the HUD
 * @param {number} seconds
 * @param {string} actionText
 */
async function startCountdown(seconds, actionText = 'Typing in') {
    for (let i = seconds; i > 0; i--) {
        showHud(`${actionText} ${i}s...`);
        await new Promise((r) => setTimeout(r, 1000));
    }
    hideHud();
}

module.exports = {
    createMainWindow,
    createHudWindow,
    getMainWindow,
    getHudWindow,
    showHud,
    hideHud,
    startCountdown,
    setCapturing,
    getCapturing,
};
