const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

const AIRouter = loadWithMocks(
    path.join(__dirname, '..', 'src', 'main', 'services', 'ai', 'AIRouter.js'),
    {}
);

module.exports = [
    {
        name: 'AIRouter records traces for failure then fallback success',
        async run() {
            const traces = [];
            const router = new AIRouter({
                registry: {
                    getExecutionOrder() {
                        return [
                            { id: 'gemini', label: 'Gemini', supportsText: true, supportsVision: true },
                            { id: 'grok', label: 'Groq', supportsText: true, supportsVision: true },
                        ];
                    },
                },
                validator: {
                    validate(_taskProfile, raw) {
                        if (raw === 'bad') {
                            return {
                                success: false,
                                code: 'LOW_QUALITY_RESPONSE',
                                message: 'Provider returned a weak response.',
                            };
                        }

                        return {
                            success: true,
                            responseText: raw.text || raw,
                            parsed: null,
                        };
                    },
                    isRetryableQualityFailure(code) {
                        return code === 'LOW_QUALITY_RESPONSE';
                    },
                },
                executeProviderRequest: async ({ provider }) => {
                    if (provider.id === 'gemini') {
                        return 'bad';
                    }

                    return {
                        text: 'usable answer',
                        usage: { total_tokens: 42 },
                    };
                },
                traceLogger: {
                    record(trace) {
                        traces.push(trace);
                    },
                },
            });

            const result = await router.route({
                taskKind: 'screen_reply',
                images: ['QUJD'],
                userPrompt: 'reply',
            }, {
                config: {},
                ownerRouting: {},
                aiConfig: {},
            });

            assert.equal(result.success, true);
            assert.equal(result.provider, 'Groq');
            assert.equal(traces.length, 2);
            assert.equal(traces[0].provider, 'Gemini');
            assert.equal(traces[0].success, false);
            assert.equal(traces[0].fallbackUsed, false);
            assert.equal(traces[1].provider, 'Groq');
            assert.equal(traces[1].success, true);
            assert.equal(traces[1].fallbackUsed, true);
            assert.equal(traces[1].tokensUsed, 42);
        },
    },
];
