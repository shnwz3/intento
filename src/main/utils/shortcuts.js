const { globalShortcut } = require('electron');
const { getMainWindow, showHud, hideHud, startCountdown, setCapturing } = require('../windows/mainWindow');
const { getVision, getScreenshot, getBrain } = require('../ipc/vision.handlers');
const { getTyping } = require('../ipc/typing.handlers');

/**
 * Register all global keyboard shortcuts
 */
function registerShortcuts() {
    // Ctrl+Alt+I - Intelligence Mode (open overlay + capture)
    globalShortcut.register('CommandOrControl+Alt+I', triggerImageMode);

    // Ctrl+Alt+T - Direct Reply (screenshot → AI → type response)
    globalShortcut.register('CommandOrControl+Alt+T', triggerDirectTextMode);

    // Ctrl+Alt+F - Field Fill (screenshot → AI → type in field)
    globalShortcut.register('CommandOrControl+Alt+F', triggerFieldFillMode);

    console.log('⌨️ Global shortcuts registered: Ctrl+Alt+I, Ctrl+Alt+T, Ctrl+Alt+F');
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

// ============ SMART BRAIN CONTEXT ============

/**
 * Determine if brain context is needed for the current prompt.
 * Send brain data MOST of the time (for chat replies, form fills) but
 * skip it for purely informational/code tasks. The AI should know
 * WHO is asking, unless it's clearly irrelevant.
 * 
 * @param {string} prompt - The directive being sent to AI
 * @returns {string} Brain context string or empty
 */
function getSmartBrainContext(prompt) {
    const brain = getBrain();
    if (!brain.hasContext()) return '';

    // These keywords indicate purely technical queries where identity is irrelevant
    const skipKeywords = [
        'explain this code', 'debug', 'syntax error',
        'what does this error', 'documentation',
    ];

    const lowerPrompt = (prompt || '').toLowerCase();
    const shouldSkip = skipKeywords.some((k) => lowerPrompt.includes(k));

    if (shouldSkip) {
        console.log('🧠 Brain: Skipping (technical context)');
        return '';
    }

    // For most other tasks (chat replies, form fills, general questions),
    // brain context makes responses more personalized
    console.log('🧠 Brain: Injecting user memory');
    return brain.getContext();
}

// ============ SHORTCUT HANDLERS ============

/**
 * Ctrl+Alt+I: Intelligence Mode
 * Show the main overlay and trigger capture
 */
async function triggerImageMode() {
    console.log('📸 Ctrl+Alt+I: Intelligence triggered');
    const win = getMainWindow();

    if (win) {
        win.show();
        win.restore();
        win.focus();
        win.webContents.send('shortcut:image-mode');
    }
}

/**
 * Ctrl+Alt+T: Direct Text Mode
 * Screenshot → AI generates reply → Types at cursor
 */
async function triggerDirectTextMode() {
    console.log('⌨️ Ctrl+Alt+T: Direct Typing triggered');

    const screenshot = getScreenshot();
    const vision = getVision();
    const typing = getTyping();

    // 1. Screenshot
    let screenshotData;
    try {
        setCapturing(true);
        screenshotData = await screenshot.capture();
        setCapturing(false);
    } catch (err) {
        setCapturing(false);
        console.error('Failed to capture:', err.message);
        return;
    }

    // 2. Get selected text (if any)
    const selectedText = await typing.getSelectedText();

    const prompt = 'WRITER DIRECTIVE: Read the message on screen. GENERATE a substantive, high-IQ, and natural human reply (20-50 characters). NO robotic brevity. NO meta-talk. OUTPUT ONLY THE RESPONSE.';

    try {
        // 3. Analyze with AI (smart brain injection)
        showHud('Thinking of a direct reply...');
        const result = await vision.analyze(
            screenshotData.base64,
            selectedText,
            prompt,
            getSmartBrainContext(prompt)
        );
        hideHud();

        if (!result.success) {
            console.error('❌ AI failed:', result.error);
            return;
        }

        console.log('✨ AI Response generated!');

        // 4. Countdown then type
        await startCountdown(5, 'Position cursor! Typing in');
        await typing.typeAtCursor(result.response);
    } catch (err) {
        hideHud();
        console.error('❌ Direct text mode failed:', err.message);
    }
}

/**
 * Ctrl+Alt+F: Field Fill Mode
 * Screenshot → AI generates field value → Types at cursor
 * Brain context is VERY likely needed here (forms often ask personal data)
 */
async function triggerFieldFillMode() {
    console.log('📝 Ctrl+Alt+F: Silent Execution triggered');

    const screenshot = getScreenshot();
    const vision = getVision();
    const brain = getBrain();
    const typing = getTyping();

    // 1. Screenshot
    let screenshotData;
    try {
        setCapturing(true);
        screenshotData = await screenshot.capture();
        setCapturing(false);
    } catch (err) {
        setCapturing(false);
        console.error('Failed to capture:', err.message);
        return;
    }

    const prompt = 'WRITER DIRECTIVE: GENERATE a complete, substantive, and natural human-like value or response for the active field/chat (20-50 characters). NO robotic fillers like \'Got it\' or \'Ok\'. OUTPUT ONLY THE TEXT.';

    try {
        // 2. Analyze with AI
        // Field Fill ALWAYS gets brain context — forms nearly always need personal data
        showHud('Intento thinking...');
        const brainContext = brain.hasContext() ? brain.getContext() : '';
        const result = await vision.analyze(
            screenshotData.base64,
            '',
            prompt,
            brainContext
        );
        hideHud();

        if (!result.success) {
            console.error('❌ AI failed:', result.error);
            return;
        }

        console.log('✨ Intento response generated!');

        // 3. Countdown then type
        await startCountdown(2, 'Intento executing in');
        await typing.typeAtCursor(result.response);
    } catch (err) {
        hideHud();
        console.error('❌ Silent execution failed:', err.message);
    }
}

module.exports = { registerShortcuts, unregisterShortcuts };
