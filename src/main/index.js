const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
require('dotenv').config();

const { registerIpcHandlers } = require('./ipc/vision.handlers');
const { registerTypingHandlers } = require('./ipc/typing.handlers');
const { registerBrainHandlers } = require('./ipc/brain.handlers');
const { registerWindowHandlers } = require('./ipc/window.handlers');
const { registerShortcuts, unregisterShortcuts } = require('./utils/shortcuts');
const { createMainWindow, createHudWindow, getMainWindow, getHudWindow } = require('./windows/mainWindow');
const { createBrainWindow } = require('./windows/brainWindow');
const BrainService = require('./services/brain/BrainService');

// Disable caching for lightweight app
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-disk-cache');

// Determine dev vs prod
const isDev = !app.isPackaged;

// ============ APP LIFECYCLE ============

app.whenReady().then(async () => {
    console.log('🚀 Intento starting...');

    // Create windows
    createMainWindow(isDev);
    createHudWindow();

    // Register all IPC handlers
    registerIpcHandlers();
    registerTypingHandlers();
    registerBrainHandlers(isDev);
    registerWindowHandlers();

    // Register global shortcuts
    registerShortcuts();

    // Check if brain onboarding is needed
    const brain = new BrainService();
    if (!brain.hasContext()) {
        setTimeout(() => createBrainWindow(isDev), 1000);
    }

    console.log('✅ Intento ready!');

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow(isDev);
        }
    });
});

app.on('will-quit', () => {
    unregisterShortcuts();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
