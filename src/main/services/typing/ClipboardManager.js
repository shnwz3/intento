const clipboardy = require('clipboardy');

/**
 * ClipboardManager - Safe clipboard read/write wrapper
 * Handles errors silently (clipboard access can fail)
 */
class ClipboardManager {
    /**
     * Read text from clipboard
     * @returns {string}
     */
    read() {
        try {
            return clipboardy.readSync() || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Write text to clipboard
     * @param {string} text
     */
    write(text) {
        try {
            clipboardy.writeSync(text);
        } catch (e) {
            // Silently fail - clipboard may be locked
        }
    }
}

module.exports = ClipboardManager;
