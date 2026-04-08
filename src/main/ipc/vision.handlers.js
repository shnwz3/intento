const { dialog, ipcMain } = require('electron');
const configService = require('../services/ConfigService');
const serviceManager = require('../services/ServiceManager');
const { PROVIDERS } = require('../services/ai/ProviderRegistry');

// We will fetch services lazily or after init
let vision, screenshot, brain;

async function ensureCaptureConsent() {
    if (configService.hasCaptureConsent()) {
        return true;
    }

    const { getMainWindow } = require('../windows/mainWindow');
    const ownerWindow = getMainWindow();
    const { activeProvider } = configService.getConfig();
    const activeProviderLabel = PROVIDERS[activeProvider]?.label || activeProvider;
    const detail = [
        'Intento captures your full primary screen when you press Ctrl+Alt+C.',
        `That image may be sent to your selected AI provider (${activeProviderLabel}) to generate a response.`,
        'Make sure no sensitive information is visible before you continue.',
    ].join('\n\n');

    const options = {
        type: 'warning',
        buttons: ['Continue', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'Allow Screen Analysis',
        message: 'Intento needs permission to analyze your screen.',
        detail,
    };
    const result = ownerWindow
        ? await dialog.showMessageBox(ownerWindow, options)
        : await dialog.showMessageBox(options);

    if (result.response !== 0) {
        return false;
    }

    configService.acceptCaptureConsent();
    return true;
}

/**
 * Register all vision-related IPC handlers
 */
function registerIpcHandlers() {
    // Get instances from ServiceManager
    vision = serviceManager.get('VisionService');
    screenshot = serviceManager.get('ScreenshotService');
    brain = serviceManager.get('BrainService');

    // Check if vision AI is ready
    ipcMain.handle('vision:isReady', () => {
        return { ready: vision.isReady() };
    });

    // Capture screenshot
    ipcMain.handle('screenshot:capture', async () => {
        const { setCapturing } = require('../windows/mainWindow');
        try {
            const hasConsent = await ensureCaptureConsent();
            if (!hasConsent) {
                return {
                    success: false,
                    code: 'CAPTURE_CONSENT_REQUIRED',
                    message: 'Screen analysis was not approved.',
                    error: 'Screen analysis was not approved.',
                };
            }

            setCapturing(true);
            const result = await screenshot.capture();

            if (!result.success) {
                console.error('Screenshot capture failed:', result.message);
                return result;
            }

            return {
                success: true,
                code: result.code,
                message: result.message,
                base64: `data:image/png;base64,${result.data.base64}`,
                width: result.data.width,
                height: result.data.height,
                timestamp: result.data.timestamp,
            };
        } catch (error) {
            return {
                success: false,
                code: 'SCREENSHOT_CAPTURE_FAILED',
                message: error.message || 'Failed to capture the screen.',
                error: error.message || 'Failed to capture the screen.',
            };
        } finally {
            setCapturing(false);
        }
    });

    // Analyze screenshot with Vision LLM
    ipcMain.handle('vision:analyze', async (_event, { selectedText, prompt }) => {
        try {
            const lastScreenshot = screenshot.getLastScreenshot();
            if (!lastScreenshot) {
                return {
                    success: false,
                    code: 'NO_SCREENSHOT',
                    message: 'Press Ctrl+Alt+C before asking Intento for a response.',
                    error: 'Press Ctrl+Alt+C before asking Intento for a response.',
                };
            }

            // Smart brain injection — skip for purely technical prompts
            let brainContext = '';
            if (brain.hasContext()) {
                const skipKeywords = ['explain this code', 'debug', 'syntax error', 'documentation'];
                const lowerPrompt = (prompt || '').toLowerCase();
                const shouldSkip = skipKeywords.some((k) => lowerPrompt.includes(k));
                brainContext = shouldSkip ? '' : brain.getContext();
            }

            const result = await vision.analyze({
                taskKind: 'screen_reply',
                images: lastScreenshot.base64,
                selectedText,
                prompt,
                brainContext,
            });

            return result;
        } catch (err) {
            return {
                success: false,
                code: 'ANALYZE_HANDLER_FAILED',
                message: err.message || 'Vision analysis failed.',
                error: err.message || 'Vision analysis failed.',
            };
        }
    });

    console.log('📡 Vision IPC handlers registered');
}

// Export singletons for use in shortcuts
function getVision() { return vision; }
function getScreenshot() { return screenshot; }
function getBrain() { return brain; }

module.exports = { registerIpcHandlers, getVision, getScreenshot, getBrain };
