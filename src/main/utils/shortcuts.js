const { globalShortcut } = require('electron');
const { getMainWindow, setCapturing } = require('../windows/mainWindow');
const { getScreenshot } = require('../ipc/vision.handlers');
const { getTyping } = require('../ipc/typing.handlers');
const serviceManager = require('../services/ServiceManager');
const hudManager = require('../ui/HudManager');

const WAND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wand-2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`;

// Services
let smartWriterService;

/**
 * Register all global keyboard shortcuts
 */
function registerShortcuts() {
    // Lazy load or load on registration
    try {
        smartWriterService = serviceManager.get('SmartWriterService');
    } catch (e) {
        console.error('Failed to load services for shortcuts:', e.message);
    }

    // Ctrl+Alt+C - Intelligence Mode (open overlay + capture)
    globalShortcut.register('CommandOrControl+Alt+C', triggerImageMode);



    // Ctrl+Alt+Right - Field Fill (screenshot → AI → type in field)
    globalShortcut.register('CommandOrControl+Alt+Right', triggerFieldFillMode);

    // Ctrl+Alt+F - Fix Grammar (screenshot + selection → AI → fix text)
    globalShortcut.register('CommandOrControl+Alt+F', triggerFixGrammarMode);

    console.log('⌨️ Global shortcuts registered: Ctrl+Alt+C, Ctrl+Alt+Right, Ctrl+Alt+F');
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

// ============ SHORTCUT HANDLERS ============

/**
 * Ctrl+Alt+C: Intelligence Mode
 * Show the main overlay and trigger capture
 */
async function triggerImageMode() {
    console.log('📸 Ctrl+Alt+C: Intelligence triggered');
    const win = getMainWindow();

    if (win) {
        win.show();
        win.restore();
        win.focus();
        win.webContents.send('shortcut:image-mode');
    }
}



/**
 * Ctrl+Alt+F: Field Fill Mode
 * Screenshot → AI generates field value → Types at cursor
 */
async function triggerFieldFillMode() {
    console.log('📝 Ctrl+Alt+Right: Silent Execution triggered');

    try {
        // 1. Screenshot
        const captureResult = await captureScreenSafely();
        if (!captureResult) return;

        // 2. Process
        const messages = [
            'Analyzing form data...',
            'Extracting context...',
            'Generating field value...',
            'Double checking...',
            'Ready to type...'
        ];
        hudManager.startCycle(messages);

        const response = await smartWriterService.autoFill(captureResult);

        hudManager.stopCycle();
        hudManager.show(`${WAND_ICON} &nbsp; Intent Generated!`);
        await new Promise(r => setTimeout(r, 800));

        // 3. Output
        const typing = getTyping();
        await hudManager.startCountdown(2, 'Executing your intent in', false);

        await typeWithCancellation(typing, response);
        hudManager.reset();

    } catch (err) {
        hudManager.show(`${WAND_ICON} Sorry, try again`);
        console.error('❌ Silent execution failed:', err.message);
        await new Promise(r => setTimeout(r, 2000));
        hudManager.reset();
    }
}

/**
 * Ctrl+Alt+F: Fix Grammar Mode
 * Screenshot + Selection → AI fixes grammar/spelling → Types at cursor
 */
async function triggerFixGrammarMode() {
    console.log('✨ Ctrl+Alt+F: Fix Grammar triggered');

    try {
        // 1. Screenshot
        const captureResult = await captureScreenSafely();
        if (!captureResult) return;

        // 2. Get Input
        const typing = getTyping();
        const selectedText = await typing.getSelectedText();

        // 3. Process
        const messages = [
            'Checking grammar...',
            'Fixing typos...',
            'Improving sentence flow...',
            'Polishing style...',
            'Finalizing edits...'
        ];
        hudManager.startCycle(messages);

        const fixedText = await smartWriterService.rewrite(selectedText, captureResult);

        hudManager.stopCycle();
        hudManager.show(`${WAND_ICON} &nbsp; Grammar fixed!`);
        await new Promise(r => setTimeout(r, 800));

        // 4. Output
        await hudManager.startCountdown(2, 'Pasting fixed text...', false);

        await typeWithCancellation(typing, fixedText);
        hudManager.reset();

    } catch (err) {
        hudManager.show(`${WAND_ICON} Sorry, try again`);
        console.error('❌ Fix Grammar mode failed:', err.message);
        await new Promise(r => setTimeout(r, 2000));
        hudManager.reset();
    }
}

/**
 * Helper to handle safe typing with cancellation
 * @param {TypingService} typing
 * @param {string} text
 */
async function typeWithCancellation(typing, text) {
    if (!text) return;

    // Register Escape to cancel
    const cancelShortcut = globalShortcut.register('Escape', () => {
        console.log('🛑 Escape pressed: Cancelling typing...');
        typing.cancel();
    });

    if (!cancelShortcut) {
        console.warn('⚠️ Failed to register Escape shortcut for cancellation');
    }

    try {
        hudManager.show(`${WAND_ICON} Typing... (Esc to stop)`);
        const result = await typing.typeAtCursor(text);

        if (!result.success && result.error === 'Cancelled by user') {
            hudManager.show(`${WAND_ICON} &nbsp; Stopped`);
            await new Promise(r => setTimeout(r, 1000));
        }
    } finally {
        // Always unregister Escape
        globalShortcut.unregister('Escape');
    }
}

// Helper to handle safe capturing
async function captureScreenSafely() {
    try {
        setCapturing(true);
        const screenshot = getScreenshot();
        const result = await screenshot.capture();
        setCapturing(false);
        return result;
    } catch (err) {
        setCapturing(false);
        console.error('Failed to capture:', err.message);
        return null;
    }
}

module.exports = { registerShortcuts, unregisterShortcuts };
