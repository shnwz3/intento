const { BrowserWindow } = require('electron');
const path = require('path');

let brainWindow = null;

/**
 * Open the Brain onboarding window
 * @param {boolean} isDev
 */
function createBrainWindow(isDev) {
    brainWindow = new BrowserWindow({
        width: 900,
        height: 850,
        backgroundColor: '#0d0d12',
        webPreferences: {
            preload: path.join(__dirname, '../../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    brainWindow.setMenu(null);

    if (isDev) {
        brainWindow.loadURL('http://localhost:5173/brain.html');
    } else {
        brainWindow.loadFile(path.join(__dirname, '../../dist/brain.html'));
    }

    brainWindow.on('closed', () => {
        brainWindow = null;
    });
}

function closeBrainWindow() {
    if (brainWindow) {
        brainWindow.close();
        brainWindow = null;
    }
}

function getBrainWindow() {
    return brainWindow;
}

module.exports = { createBrainWindow, closeBrainWindow, getBrainWindow };
