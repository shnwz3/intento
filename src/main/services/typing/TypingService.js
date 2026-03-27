const robot = require('@jitsi/robotjs');
const ClipboardManager = require('./ClipboardManager');
const configService = require('../ConfigService');

class TypingCancelledError extends Error {
    constructor() {
        super('Typing cancelled by user');
        this.name = 'TypingCancelledError';
    }
}

/**
 * TypingService - Handles smart text input, paste, and key presses.
 */
class TypingService {
    constructor(options = {}) {
        this.robot = options.robot || robot;
        this.clipboard = options.clipboard || new ClipboardManager();
        this._sleepImpl = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this._isCancelled = false;
    }

    /**
     * Cancel any ongoing typing operation
     */
    cancel() {
        console.log('Typing cancellation requested');
        this._isCancelled = true;
    }

    /**
     * Type text at the current cursor position
     * @param {string} text
     * @param {number} countdown
     * @returns {Promise<{success: boolean, code: string, message: string, data?: {typedLength: number, usedClipboardFallback: boolean}}>}
     */
    async typeAtCursor(text, countdown = 0, options = {}) {
        this._isCancelled = false;

        if (!text || !text.trim()) {
            return {
                success: false,
                code: 'EMPTY_TEXT',
                message: 'There was no text to type.',
                error: 'There was no text to type.',
            };
        }

        const typingConfig = configService.getTypingConfig();
        const mode = options.mode || typingConfig.mode || 'type';

        try {
            console.log(`Typing ${text.length} chars at cursor with mode "${mode}"...`);
            await this._executeMode(mode, text);
            return {
                success: true,
                code: countdown > 0 ? 'TYPE_OK_AFTER_COUNTDOWN' : 'TYPE_OK',
                message: this._getSuccessMessage(mode),
                data: {
                    typedLength: text.length,
                    usedClipboardFallback: mode === 'paste' || mode === 'clipboard_only' || /[^\x00-\x7F]/.test(text),
                    mode,
                },
            };
        } catch (err) {
            if (err instanceof TypingCancelledError) {
                console.log('Typing stopped gracefully.');
                return {
                    success: false,
                    code: 'TYPE_CANCELLED',
                    message: 'Typing was cancelled by the user.',
                    error: 'Cancelled by user',
                };
            }

            console.error('Typing failed:', err.message);
            return {
                success: false,
                code: 'TYPE_FAILED',
                message: err.message || 'Typing failed.',
                error: err.message || 'Typing failed.',
            };
        }
    }

    async fillFieldValue(text, options = {}) {
        const mode = options.mode || 'paste';
        return this.typeAtCursor(text, 0, { mode });
    }

    async selectDropdownValue(text) {
        this._isCancelled = false;

        if (!text || !text.trim()) {
            return {
                success: false,
                code: 'EMPTY_TEXT',
                message: 'There was no dropdown value to select.',
                error: 'There was no dropdown value to select.',
            };
        }

        try {
            this.robot.keyTap('space');
            await this._sleep(140);
            await this._typeTextSmart(text);
            await this._sleep(120);
            this.robot.keyTap('enter');
            await this._sleep(120);

            return {
                success: true,
                code: 'SELECT_OK',
                message: 'Dropdown value selected successfully.',
                data: {
                    selectedLength: text.length,
                },
            };
        } catch (err) {
            if (err instanceof TypingCancelledError) {
                return {
                    success: false,
                    code: 'TYPE_CANCELLED',
                    message: 'Dropdown selection was cancelled by the user.',
                    error: 'Cancelled by user',
                };
            }

            return {
                success: false,
                code: 'TYPE_FAILED',
                message: err.message || 'Dropdown selection failed.',
                error: err.message || 'Dropdown selection failed.',
            };
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
            this.clipboard.write('');
            await this._sleep(50);

            console.log('Sending Ctrl+C...');
            this.robot.keyTap('c', 'control');
            await this._sleep(400);

            selectedText = this.clipboard.read();
        } catch (err) {
            console.log('Failed to get selected text:', err.message);
        } finally {
            this.clipboard.write(original);
        }

        if (selectedText) {
            console.log(`Captured selection (${selectedText.length} chars)`);
        }
        return selectedText;
    }

    async pressKey(key, modifier) {
        this._throwIfCancelled();
        if (typeof modifier === 'undefined') {
            this.robot.keyTap(key);
        } else {
            this.robot.keyTap(key, modifier);
        }
        await this._sleep(80);
    }

    async scrollVertical(amount = -720) {
        this._throwIfCancelled();
        this.robot.scrollMouse(0, amount);
        await this._sleep(120);
    }

    async _typeTextSmart(text) {
        const chunks = text.match(/[\x00-\x7F]+|[^\x00-\x7F]+/g) || [];

        for (const chunk of chunks) {
            this._throwIfCancelled();

            if (this._containsUnicode(chunk)) {
                await this._pasteUnicode(chunk);
            } else {
                await this._typeASCII(chunk);
            }
        }
    }

    async _typeASCII(text) {
        let prevChar = '';
        for (const char of text) {
            this._throwIfCancelled();

            if (char === prevChar) {
                await this._sleep(60);
                this.robot.keyTap(char.toLowerCase());
            } else {
                this.robot.typeString(char);
            }
            await this._sleep(10);
            prevChar = char;
        }
    }

    async _pasteUnicode(text) {
        this._throwIfCancelled();

        const previous = this.clipboard.read();
        try {
            this.clipboard.write(text);
            this.robot.keyTap('v', 'control');
            await this._sleep(100);
        } finally {
            this.clipboard.write(previous);
        }
    }

    async _executeMode(mode, text) {
        if (mode === 'clipboard_only') {
            this.clipboard.write(text);
            return;
        }

        if (mode === 'paste') {
            await this._pasteText(text);
            return;
        }

        await this._typeTextSmart(text);
    }

    async _pasteText(text) {
        this._throwIfCancelled();

        const previous = this.clipboard.read();
        try {
            this.clipboard.write(text);
            this.robot.keyTap('v', 'control');
            await this._sleep(120);
        } finally {
            this.clipboard.write(previous);
        }
    }

    _getSuccessMessage(mode) {
        if (mode === 'clipboard_only') {
            return 'Text copied to clipboard. Paste it where you need it.';
        }

        if (mode === 'paste') {
            return 'Text pasted successfully.';
        }

        return 'Text typed successfully.';
    }

    _containsUnicode(str) {
        return /[^\x00-\x7F]/.test(str);
    }

    _throwIfCancelled() {
        if (this._isCancelled) {
            throw new TypingCancelledError();
        }
    }

    _sleep(ms) {
        return this._sleepImpl(ms);
    }
}

module.exports = TypingService;
