const { screen } = require('electron');

/**
 * ScreenshotService - Captures screen for vision analysis
 */
class ScreenshotService {
    constructor() {
        this.lastScreenshot = null;
    }

    /**
     * Capture the full primary screen
     * @returns {Promise<{base64: string, width: number, height: number}>}
     */
    async capture() {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        const scaleFactor = primaryDisplay.scaleFactor;

        const captureWidth = Math.floor(width * scaleFactor);
        const captureHeight = Math.floor(height * scaleFactor);

        // Use Electron's desktopCapturer or native screenshot
        const { desktopCapturer } = require('electron');
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: captureWidth, height: captureHeight },
        });

        if (!sources || sources.length === 0) {
            throw new Error('No screen sources found');
        }

        const thumbnail = sources[0].thumbnail;
        const base64 = thumbnail.toPNG().toString('base64');

        this.lastScreenshot = {
            base64,
            width: captureWidth,
            height: captureHeight,
            timestamp: Date.now(),
        };

        console.log(`📸 Screenshot captured: ${captureWidth}x${captureHeight}`);
        return this.lastScreenshot;
    }

    /**
     * Get the last captured screenshot
     * @returns {{base64: string, width: number, height: number}|null}
     */
    getLastScreenshot() {
        return this.lastScreenshot;
    }

    /**
     * Check if a screenshot exists
     * @returns {boolean}
     */
    hasScreenshot() {
        return this.lastScreenshot !== null;
    }
}

module.exports = ScreenshotService;
