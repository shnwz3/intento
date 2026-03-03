const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let isCapturing = false;

/**
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
    return mainWindow;
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
        show: true, // Start visible so it shows in taskbar
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, '../../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Center on primary display
    mainWindow.center();

    // Initial focus
    mainWindow.focus();

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



module.exports = {
    createMainWindow,
    getMainWindow,
    setCapturing,
    getCapturing,
};
