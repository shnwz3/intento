const { ipcMain } = require('electron');
const VisionService = require('../services/vision/VisionService');
const ScreenshotService = require('../services/screenshot/ScreenshotService');
const BrainService = require('../services/brain/BrainService');

// Shared singleton instances
const vision = new VisionService();
const screenshot = new ScreenshotService();
const brain = new BrainService();

/**
 * Register all vision-related IPC handlers
 */
function registerIpcHandlers() {
    // Check if vision AI is ready
    ipcMain.handle('vision:isReady', () => {
        return { ready: vision.isReady() };
    });

    // Capture screenshot
    ipcMain.handle('screenshot:capture', async () => {
        const { setCapturing } = require('../windows/mainWindow');
        try {
            setCapturing(true);
            const result = await screenshot.capture();
            setCapturing(false);
            return {
                success: true,
                base64: `data:image/png;base64,${result.base64}`,
                width: result.width,
                height: result.height,
            };
        } catch (err) {
            setCapturing(false);
            console.error('Screenshot capture failed:', err.message);
            return { success: false, error: err.message };
        }
    });

    // Analyze screenshot with Vision LLM
    ipcMain.handle('vision:analyze', async (_event, { selectedText, prompt }) => {
        try {
            const lastScreenshot = screenshot.getLastScreenshot();
            if (!lastScreenshot) {
                return { success: false, error: 'No screenshot captured yet.' };
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
            return { success: false, error: err.message };
        }
    });

    console.log('📡 Vision IPC handlers registered');
}

// Export singletons for use in shortcuts
function getVision() { return vision; }
function getScreenshot() { return screenshot; }
function getBrain() { return brain; }

module.exports = { registerIpcHandlers, getVision, getScreenshot, getBrain };
