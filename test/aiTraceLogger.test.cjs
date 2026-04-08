const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

const AITraceLogger = loadWithMocks(
    path.join(__dirname, '..', 'src', 'main', 'services', 'ai', 'AITraceLogger.js'),
    {}
);

module.exports = [
    {
        name: 'AITraceLogger keeps recent entries in reverse chronological order',
        run() {
            const logger = new AITraceLogger({ maxEntries: 2, isDev: false });

            logger.record({
                taskKind: 'screen_reply',
                provider: 'OpenAI',
                model: 'gpt-5-mini',
                latencyMs: 120,
                retryCount: 0,
                fallbackUsed: false,
                success: true,
                timestamp: 1,
            });
            logger.record({
                taskKind: 'form_scene_parse',
                provider: 'Gemini',
                model: 'gemini-2.5-flash',
                latencyMs: 220,
                retryCount: 0,
                fallbackUsed: false,
                success: false,
                failureReason: 'INVALID_JSON',
                timestamp: 2,
            });
            logger.record({
                taskKind: 'brain_doc_extract_text',
                provider: 'Groq',
                model: 'openai/gpt-oss-20b',
                latencyMs: 320,
                retryCount: 1,
                fallbackUsed: true,
                success: true,
                timestamp: 3,
            });

            const recent = logger.getRecent();
            assert.equal(recent.length, 2);
            assert.equal(recent[0].provider, 'Groq');
            assert.equal(recent[1].provider, 'Gemini');
            assert.equal(recent[0].fallbackUsed, true);
        },
    },
];
