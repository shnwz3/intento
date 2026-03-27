const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const dotenv = require('dotenv');
const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });


// Global crash handlers — prevent silent app death
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
});

const { registerIpcHandlers } = require('./ipc/vision.handlers');
const { registerTypingHandlers } = require('./ipc/typing.handlers');
const { registerBrainHandlers } = require('./ipc/brain.handlers');
const { registerWindowHandlers } = require('./ipc/window.handlers');
const { registerSettingsHandlers } = require('./ipc/settings.handlers');
const { registerFormHandlers } = require('./ipc/form.handlers');
const { registerShortcuts, unregisterShortcuts } = require('./utils/shortcuts');
const { createMainWindow, getMainWindow } = require('./windows/mainWindow');
const hudManager = require('./ui/HudManager');
const { createBrainWindow } = require('./windows/brainWindow');
const serviceManager = require('./services/ServiceManager');
const setupAutoUpdates = require('./utils/updater');
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

    // Onboarding: Warn if API keys missing (triggered when HUD is ready)
    const hudWin = hudManager.getHudWindow();
    if (hudWin) {
        hudWin.webContents.on('did-finish-load', () => {
            const configService = require('./services/ConfigService');
            const config = configService.getConfig();
            const hasKeys = Object.values(config.keys).some(key => key && key.trim() !== '');

            if (!hasKeys && !isDev) {
                setTimeout(() => {
                    hudManager.show(`✨ Please configure API keys in Settings to activate AI features`);
                    setTimeout(() => hudManager.reset(), 6000);
                }, 1000); // Small buffer for view mount
            }
        });
    }


    // Register all IPC handlers
    registerIpcHandlers();
    registerTypingHandlers();
    registerBrainHandlers(isDev);
    registerWindowHandlers();
    registerSettingsHandlers();
    registerFormHandlers();

    // Register global shortcuts
    registerShortcuts();

    // Start auto-updates check in production
    if (!isDev) {
        setupAutoUpdates();
    }


    // Check if brain onboarding is needed
    const brain = new BrainService();
    if (!brain.hasContext()) {
        setTimeout(() => createBrainWindow(isDev), 1000);
    }



    console.log('✅ Intento: Your Intent to Execute');


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
