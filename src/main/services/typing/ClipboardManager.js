const { clipboard } = require('electron');

/**
 * ClipboardManager - Safe clipboard read/write wrapper using Electron native API
 * Handles errors silently (clipboard access can fail)
 */
class ClipboardManager {
    /**
     * Read text from clipboard
     * @returns {string}
     */
    read() {
        try {
            return clipboard.readText() || '';
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
            clipboard.writeText(text);
        } catch (e) {
            // Silently fail - clipboard may be locked
        }
    }
}

module.exports = ClipboardManager;

