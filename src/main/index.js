const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
require('dotenv').config();

const { registerIpcHandlers } = require('./ipc/vision.handlers');
const { registerTypingHandlers } = require('./ipc/typing.handlers');
const { registerBrainHandlers } = require('./ipc/brain.handlers');
const { registerWindowHandlers } = require('./ipc/window.handlers');
const { registerSettingsHandlers } = require('./ipc/settings.handlers');
const { registerShortcuts, unregisterShortcuts } = require('./utils/shortcuts');
const { createMainWindow, getMainWindow } = require('./windows/mainWindow');
const hudManager = require('./ui/HudManager');
const { createBrainWindow } = require('./windows/brainWindow');
const serviceManager = require('./services/ServiceManager');
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

    // Initialize Services (DI Container)
    serviceManager.initialize();

    // Create windows
    createMainWindow(isDev);
    hudManager.createHudWindow();

    // Register all IPC handlers
    registerIpcHandlers();
    registerTypingHandlers();
    registerBrainHandlers(isDev);
    registerWindowHandlers();
    registerSettingsHandlers();

    // Register global shortcuts
    registerShortcuts();

    // Check if brain onboarding is needed
    const brain = new BrainService();
    if (!brain.hasContext()) {
        setTimeout(() => createBrainWindow(isDev), 1000);
    }

    console.log('✅ Intento: Your Intent, Executed');

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
