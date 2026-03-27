const { ipcMain } = require('electron');
const serviceManager = require('../services/ServiceManager');

// We will fetch services lazily or after init
let vision, screenshot, brain;

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
        setCapturing(true);
        const result = await screenshot.capture();
        setCapturing(false);

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

            const result = await vision.analyze(
                lastScreenshot.base64,
                selectedText,
                prompt,
                brainContext
            );

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
