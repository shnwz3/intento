/**
 * Text cleaning and quality checking utilities
 * Extracted from v4 vision.js for reusability
 */

/**
 * Clean AI-generated text by removing code blocks, filler phrases, and quotes
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
    if (!text) return '';
    let clean = text.trim();

    // Remove code block markers
    clean = clean.replace(/```[a-z]*\n?/gi, '');
    clean = clean.replace(/```/g, '');

    // Remove filler phrases from start
    const fillers = [
        'here is the description',
        'certainly',
        'sure',
        'based on the image',
        'the screen shows',
        'in the chat',
        'it appears',
        'i see',
        'the reply is:',
    ];

    let lower = clean.toLowerCase();
    for (const filler of fillers) {
        if (lower.startsWith(filler)) {
            clean = clean.substring(filler.length).replace(/^[:\s\n\-]*/, '');
            lower = clean.toLowerCase();
        }
    }

    // Remove leading/trailing quotes
    return clean.replace(/^["']|["']$/g, '').trim();
}

/**
 * Check if the AI refused to answer
 * @param {string} text
 * @returns {boolean}
 */
function isRefusal(text) {
    const refusalPhrases = ["i'm sorry", 'i cannot', "i can't", 'as an ai'];
    const lower = text.toLowerCase();
    return refusalPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Check if the response is too short or robotic
 * @param {string} text
 * @returns {boolean}
 */
function isLowQuality(text) {
    if (!text) return true;
    const clean = text.trim();

    // Hard length gate
    if (clean.length < 20) return true;

    // Robotic signatures
    const roboticSignatures = [
        'got it', 'i understand', 'i will', 'done.', 'ok.', 'sure.',
        'no problem', 'here is', 'the screen', 'it seems', 'message box',
        'at the bottom',
    ];
    const lower = clean.toLowerCase();

    return roboticSignatures.some((phrase) => {
        if (lower === phrase || lower === phrase + '.') return true;
        if (lower.startsWith(phrase) && clean.length < 35) return true;
        return false;
    });
}

module.exports = { cleanText, isRefusal, isLowQuality };
