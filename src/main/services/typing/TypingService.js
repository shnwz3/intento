const robot = require('@jitsi/robotjs');
const ClipboardManager = require('./ClipboardManager');

/**
 * TypingService - Handles smart text input at cursor position
 * Supports Unicode, consecutive duplicate chars, and clipboard fallback
 */
class TypingService {
    constructor() {
        this.clipboard = new ClipboardManager();
    }

    /**
     * Type text at the current cursor position
     * @param {string} text - Text to type
     * @param {number} countdown - Countdown seconds before typing (0 = immediate)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async typeAtCursor(text, countdown = 0) {
        try {
            // Copy to clipboard as fallback (user can Ctrl+V if typing fails)
            this.clipboard.write(text);

            console.log(`⌨️ Typing ${text.length} chars at cursor...`);
            await this._typeTextSmart(text);
            return { success: true };
        } catch (err) {
            console.error('Typing failed:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Get currently selected text via Ctrl+C
     * @returns {Promise<string>}
     */
    async getSelectedText() {
        let selectedText = '';
        const original = this.clipboard.read();

        try {
            // Clear clipboard to detect new copy
            this.clipboard.write('');
            await this._sleep(50);

            console.log('⌨️ Sending Ctrl+C...');
            robot.keyTap('c', 'control');
            await this._sleep(400);

            selectedText = this.clipboard.read();

            // Restore original clipboard
            if (original) {
                this.clipboard.write(original);
            }
        } catch (err) {
            console.log('❌ Failed to get selected text:', err.message);
        }

        if (selectedText) {
            console.log(`✅ Captured: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`);
        }
        return selectedText;
    }

    /**
     * Smart typing that handles Unicode and duplicate chars
     * @param {string} text
     * @private
     */
    async _typeTextSmart(text) {
        if (!text) return;

        const chunks = text.match(/[\x00-\x7F]+|[^\x00-\x7F]+/g) || [];

        for (const chunk of chunks) {
            if (this._containsUnicode(chunk)) {
                await this._pasteUnicode(chunk);
            } else {
                await this._typeASCII(chunk);
            }
        }
    }

    /**
     * Type ASCII text char by char (handles consecutive duplicates)
     * @param {string} text
     * @private
     */
    async _typeASCII(text) {
        let prevChar = '';
        for (const char of text) {
            if (char === prevChar) {
                await this._sleep(60);
                robot.keyTap(char.toLowerCase());
            } else {
                robot.typeString(char);
            }
            await this._sleep(10);
            prevChar = char;
        }
    }

    /**
     * Paste Unicode text via clipboard (robotjs can't type Unicode)
     * @param {string} text
     * @private
     */
    async _pasteUnicode(text) {
        const previous = this.clipboard.read();
        try {
            this.clipboard.write(text);
            robot.keyTap('v', 'control');
            await this._sleep(100);
        } finally {
            this.clipboard.write(previous);
        }
    }

    /**
     * @param {string} str
     * @returns {boolean}
     * @private
     */
    _containsUnicode(str) {
        return /[^\x00-\x7F]/.test(str);
    }

    /**
     * @param {number} ms
     * @returns {Promise<void>}
     * @private
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = TypingService;
