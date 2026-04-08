const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const dotenv = require('dotenv');

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const isDev = !app.isPackaged;
let fatalExitTriggered = false;

function handleFatalProcessError(type, error) {
    console.error(`Fatal ${type}:`, error);

    if (isDev || fatalExitTriggered) {
        return;
    }

    fatalExitTriggered = true;

    const detail = error instanceof Error
        ? (error.stack || error.message)
        : String(error);

    try {
        dialog.showErrorBox(
            'Intento encountered a fatal error',
            `Intento will close to avoid unsafe automation state.\n\n${detail}`
        );
    } catch (dialogError) {
        console.error('Unable to show fatal error dialog:', dialogError);
    }

    app.exit(1);
}

process.on('uncaughtException', (error) => {
    handleFatalProcessError('uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
    handleFatalProcessError('unhandled rejection', reason);
});

const { registerIpcHandlers } = require('./ipc/vision.handlers');
const { registerTypingHandlers } = require('./ipc/typing.handlers');
const { registerBrainHandlers } = require('./ipc/brain.handlers');
const { registerWindowHandlers } = require('./ipc/window.handlers');
const { registerSettingsHandlers } = require('./ipc/settings.handlers');
const { registerFormHandlers } = require('./ipc/form.handlers');
const { registerShortcuts, unregisterShortcuts } = require('./utils/shortcuts');
const { createMainWindow } = require('./windows/mainWindow');
const hudManager = require('./ui/HudManager');
const { createBrainWindow } = require('./windows/brainWindow');
const serviceManager = require('./services/ServiceManager');
const setupAutoUpdates = require('./utils/updater');

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-disk-cache');

app.whenReady().then(() => {
    console.log('Intento starting...');

    serviceManager.initialize();

    createMainWindow(isDev);
    hudManager.createHudWindow();

    const hudWin = hudManager.getHudWindow();
    if (hudWin) {
        hudWin.webContents.on('did-finish-load', () => {
            const configService = require('./services/ConfigService');
            const config = configService.getConfig();
            const hasKeys = Object.values(config.keys).some((key) => key && key.trim() !== '');

            if (!hasKeys && !isDev) {
                setTimeout(() => {
                    hudManager.show('Please configure API keys in Settings to activate AI features');
                    setTimeout(() => hudManager.reset(), 6000);
                }, 1000);
            }
        });
    }

    registerIpcHandlers();
    registerTypingHandlers();
    registerBrainHandlers(isDev);
    registerWindowHandlers();
    registerSettingsHandlers();
    registerFormHandlers();

    registerShortcuts();

    if (!isDev) {
        setupAutoUpdates();
    }

    const brain = serviceManager.get('BrainService');
    if (!brain.hasContext()) {
        setTimeout(() => createBrainWindow(isDev), 1000);
    }

    console.log('Intento is ready.');

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
