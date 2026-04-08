const { globalShortcut } = require('electron');
const { getMainWindow, setCapturing } = require('../windows/mainWindow');
const serviceManager = require('../services/ServiceManager');
const hudManager = require('../ui/HudManager');
const configService = require('../services/ConfigService');

const WAND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wand-2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`;

let screenshotService;
let typingService;
let smartWriterService;
let formFillerService;
let formAutomationService;
let isFormAutomationRunning = false;

function getConfiguredCountdown() {
    const configured = Number(configService.getTypingConfig()?.countdownSeconds);
    if (!Number.isFinite(configured)) return 3;
    return Math.max(3, Math.min(15, Math.floor(configured)));
}

function registerShortcuts() {
    try {
        screenshotService = serviceManager.get('ScreenshotService');
        typingService = serviceManager.get('TypingService');
        smartWriterService = serviceManager.get('SmartWriterService');
        formFillerService = serviceManager.get('FormFillerService');
        formAutomationService = serviceManager.get('FormAutomationService');
    } catch (error) {
        console.error('Failed to load services for shortcuts:', error.message);
    }

    globalShortcut.register('CommandOrControl+Alt+C', triggerImageMode);
    globalShortcut.register('CommandOrControl+Alt+Right', triggerFieldFillMode);
    globalShortcut.register('CommandOrControl+Alt+A', triggerFormFillMode);
    globalShortcut.register('CommandOrControl+Alt+F', triggerFixGrammarMode);

    console.log('Global shortcuts registered: Ctrl+Alt+C, Ctrl+Alt+Right, Ctrl+Alt+A, Ctrl+Alt+F');
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

async function triggerImageMode() {
    console.log('Ctrl+Alt+C: Intelligence triggered');
    const win = getMainWindow();

    if (!win) return;

    if (!win.isMinimized()) {
        win.minimize();
        return;
    }

    win.restore();
    win.focus();
    win.webContents.send('shortcut:image-mode');
}

async function triggerFieldFillMode() {
    await runShortcutFlow({
        cycleMessages: [
            'Analyzing context...',
            'Understanding the message...',
            'Generating response...',
            'Polishing tone...',
            'Ready to type...',
        ],
        successMessage: 'Intent Generated!',
        countdownMessage: 'Executing your intent in',
        buildResponse: async (captureResult) => smartWriterService.autoFill(captureResult),
    });
}

async function triggerFormFillMode() {
    if (isFormAutomationRunning) {
        hudManager.show(`${WAND_ICON} Form fill already running`);
        await sleep(1200);
        hudManager.reset();
        return;
    }

    isFormAutomationRunning = true;
    const cancelRegistered = globalShortcut.register('Escape', () => {
        console.log('Escape pressed: Cancelling form automation...');
        typingService.cancel();
        formAutomationService.cancel();
        hudManager.show(`${WAND_ICON} Stopping form fill...`);
    });

    if (!cancelRegistered) {
        console.warn('Failed to register Escape shortcut for form automation cancellation');
    }

    try {
        const captureResult = await captureScreenSafely();
        if (!captureResult) {
            hudManager.show(`${WAND_ICON} Unable to read the form right now`);
            await sleep(1800);
            return;
        }

        const initialState = await formFillerService.inspectFormState(captureResult.base64, { minimumFields: 2 });
        if (!initialState.isForm) {
            hudManager.show(`${WAND_ICON} No form detected. Open a form and focus the first input.`);
            await sleep(2200);
            return;
        }

        const preview = formFillerService.planVisibleFields(initialState.fields);
        hudManager.show(`${WAND_ICON} ${formatFormPreview(preview.summary)}`);
        await sleep(900);

        const win = getMainWindow();
        if (win && !win.isMinimized()) {
            win.minimize();
        }

        await hudManager.startCountdown(getConfiguredCountdown(), 'Focus first input. Starting in', false);

        setCapturing(true);

        const result = await formAutomationService.run({
            initialState,
            onStatus: (message) => hudManager.show(`${WAND_ICON} ${message} (Esc to stop)`),
        });

        hudManager.show(`${WAND_ICON} ${formatFormAutomationResult(result)}`);
        await sleep(2200);
        hudManager.reset();
    } catch (error) {
        const wasCancelled = error?.name === 'FormAutomationCancelledError'
            || error?.name === 'TypingCancelledError'
            || /cancel/i.test(error?.message || '');

        if (wasCancelled) {
            hudManager.show(`${WAND_ICON} Stopped`);
            await sleep(1200);
        } else {
            hudManager.show(`${WAND_ICON} ${error.message}`);
            console.error('Form automation failed:', error.message);
            await sleep(2400);
        }

        hudManager.reset();
    } finally {
        setCapturing(false);
        globalShortcut.unregister('Escape');
        isFormAutomationRunning = false;
    }
}

async function triggerFixGrammarMode() {
    await runShortcutFlow({
        cycleMessages: [
            'Checking grammar...',
            'Fixing typos...',
            'Improving sentence flow...',
            'Polishing style...',
            'Finalizing edits...',
        ],
        successMessage: 'Grammar fixed!',
        countdownMessage: 'Pasting fixed text...',
        buildResponse: async (captureResult) => {
            const selectedText = await typingService.getSelectedText();
            return smartWriterService.rewrite(selectedText, captureResult);
        },
    });
}

async function runShortcutFlow({ cycleMessages, successMessage, countdownMessage, buildResponse }) {
    try {
        const captureResult = await captureScreenSafely();
        if (!captureResult) return;

        hudManager.startCycle(cycleMessages);
        const response = await buildResponse(captureResult);
        hudManager.stopCycle();

        if (response && typeof response === 'object' && response.stay) {
            hudManager.show(`${WAND_ICON} Text is proper!`);
            await sleep(2200);
            hudManager.reset();
            return;
        }

        hudManager.show(`${WAND_ICON} ${successMessage}`);
        await sleep(800);
        await hudManager.startCountdown(getConfiguredCountdown(), countdownMessage, false);
        await typeWithCancellation(response);
        hudManager.reset();
    } catch (error) {
        hudManager.show(`${WAND_ICON} ${error.message}`);
        console.error('Shortcut execution failed:', error.message);
        await sleep(2000);
        hudManager.reset();
    }
}

async function typeWithCancellation(text) {
    if (!text) return;

    const cancelRegistered = globalShortcut.register('Escape', () => {
        console.log('Escape pressed: Cancelling typing...');
        typingService.cancel();
    });

    if (!cancelRegistered) {
        console.warn('Failed to register Escape shortcut for cancellation');
    }

    try {
        hudManager.show(`${WAND_ICON} Typing... (Esc to stop)`);
        const result = await typingService.typeAtCursor(text);
        if (!result.success && result.code === 'TYPE_CANCELLED') {
            hudManager.show(`${WAND_ICON} Stopped`);
            await sleep(1000);
        }
    } finally {
        globalShortcut.unregister('Escape');
    }
}

async function captureScreenSafely() {
    setCapturing(true);
    try {
        const result = await screenshotService.capture();
        if (!result.success) {
            console.error('Failed to capture:', result.message || result.error);
            return null;
        }
        return result.data;
    } catch (error) {
        console.error('Failed to capture:', error.message);
        return null;
    } finally {
        setCapturing(false);
    }
}

function formatFormAutomationResult(result) {
    const detailParts = [];
    if (result.brainFilledCount > 0) {
        detailParts.push(`${result.brainFilledCount} Brain`);
    }
    if (result.aiFilledCount > 0) {
        detailParts.push(`${result.aiFilledCount} AI`);
    }
    if (result.selectedChoiceCount > 0) {
        detailParts.push(`${result.selectedChoiceCount} choice${result.selectedChoiceCount === 1 ? '' : 's'}`);
    }
    if (result.scrollRecoveryCount > 0) {
        detailParts.push(`${result.scrollRecoveryCount} scroll`);
    }

    const detailSuffix = detailParts.length > 0 ? ` ${detailParts.join(', ')}.` : '';
    const reviewSuffix = result.skippedCount > 0
        ? ` Review ${formatReviewLabelSummary(result.reviewLabels, result.skippedCount)} manually.`
        : ' Review and submit when ready.';

    if (result.stoppedReason === 'submit_visible') {
        return `Submit button found after filling ${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'}.${detailSuffix}${reviewSuffix}`;
    }

    if (result.stoppedReason === 'no_more_inputs') {
        return `No more visible inputs after filling ${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'}.${detailSuffix}${reviewSuffix}`;
    }

    if (result.stoppedReason === 'max_passes') {
        return `Reached navigation limit after filling ${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'}.${detailSuffix}${reviewSuffix}`;
    }

    return `Filled ${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'}.${detailSuffix}${reviewSuffix}`;
}

function formatFormPreview(summary) {
    const parts = [
        `${summary.totalCount} visible field${summary.totalCount === 1 ? '' : 's'}`,
        `${summary.directCount} Brain`,
    ];

    if (summary.aiCount > 0) {
        parts.push(`${summary.aiCount} AI`);
    }

    if (summary.reviewCount > 0) {
        parts.push(`${summary.reviewCount} review`);
    }

    return `Form detected: ${parts.join(', ')}.`;
}

function formatReviewLabelSummary(labels, skippedCount) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return `${skippedCount} field${skippedCount === 1 ? '' : 's'}`;
    }

    const visibleLabels = labels.slice(0, 2);
    if (labels.length === 1) {
        return visibleLabels[0];
    }

    if (labels.length === 2) {
        return `${visibleLabels[0]} and ${visibleLabels[1]}`;
    }

    return `${visibleLabels.join(', ')}, and ${labels.length - visibleLabels.length} more field${labels.length - visibleLabels.length === 1 ? '' : 's'}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { registerShortcuts, unregisterShortcuts };
