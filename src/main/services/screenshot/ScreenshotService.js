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
     * @returns {Promise<{success: boolean, code: string, message: string, data?: {base64: string, width: number, height: number, timestamp: number}}>}
     */
    async capture() {
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.size;
            const scaleFactor = primaryDisplay.scaleFactor;

            const captureWidth = Math.floor(width * scaleFactor);
            const captureHeight = Math.floor(height * scaleFactor);

            const { desktopCapturer } = require('electron');
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: captureWidth, height: captureHeight },
            });

            if (!sources || sources.length === 0) {
                return {
                    success: false,
                    code: 'NO_SCREEN_SOURCE',
                    message: 'Intento could not access the current view.',
                    error: 'Intento could not access the current view.',
                };
            }

            const thumbnail = sources[0].thumbnail;
            const base64 = thumbnail.toPNG().toString('base64');

            this.lastScreenshot = {
                base64,
                width: captureWidth,
                height: captureHeight,
                timestamp: Date.now(),
            };

            console.log(`Screenshot captured: ${captureWidth}x${captureHeight}`);
            return {
                success: true,
                code: 'CAPTURE_OK',
                message: 'Intento is ready.',
                data: this.lastScreenshot,
            };
        } catch (err) {
            return {
                success: false,
                code: 'CAPTURE_FAILED',
                message: err.message || 'Intento could not access the current view.',
                error: err.message || 'Intento could not access the current view.',
            };
        }
    }

    /**
     * Get the last captured screenshot
     * @returns {{base64: string, width: number, height: number, timestamp: number}|null}
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
