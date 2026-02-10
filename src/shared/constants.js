/**
 * Shared constants between main and renderer
 */

const SHORTCUTS = {
    INTELLIGENCE: 'CommandOrControl+Alt+I',
    DIRECT_TEXT: 'CommandOrControl+Alt+T',
    FIELD_FILL: 'CommandOrControl+Alt+F',
};

const MODES = {
    INTELLIGENCE: 'intelligence',
    DIRECT_TEXT: 'direct_text',
    FIELD_FILL: 'field_fill',
};

const PROMPTS = {
    DIRECT_REPLY:
        'WRITER DIRECTIVE: Read the message on screen. GENERATE a substantive, high-IQ, and natural human reply (20-50 characters). NO robotic brevity. NO meta-talk. OUTPUT ONLY THE RESPONSE.',
    FIELD_FILL:
        "WRITER DIRECTIVE: GENERATE a complete, substantive, and natural human-like value or response for the active field/chat (20-50 characters). NO robotic fillers like 'Got it' or 'Ok'. OUTPUT ONLY THE TEXT.",
    DEFAULT:
        'Look at this screen and GENERATE the next substantive reply or data. OUTPUT ONLY THE TEXT.',
};

module.exports = { SHORTCUTS, MODES, PROMPTS };
