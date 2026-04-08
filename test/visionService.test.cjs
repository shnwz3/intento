const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function loadVisionService(configOverrides = {}, electronOverrides = {}) {
    const defaultConfig = {
        activeProvider: 'grok',
        keys: {
            grok: '',
            openai: '',
            gemini: '',
            anthropic: '',
            openrouter: '',
        },
    };
    const resolvedConfig = {
        ...defaultConfig,
        ...configOverrides,
        keys: {
            ...defaultConfig.keys,
            ...(configOverrides.keys || {}),
        },
    };

    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'vision', 'VisionService.js'), {
        electron: {
            app: { getAppPath: () => process.cwd() },
            ...electronOverrides,
        },
        '../ConfigService': {
            getConfig() {
                return resolvedConfig;
            },
        },
        '../../prompts/PromptService': {
            SYSTEM_PROMPT: 'system',
            DEFAULT_VISION_PROMPT: 'default prompt',
            TEXT_ONLY_SYSTEM_PROMPT: 'text only',
            wrapWithSelectionContext: (selection, prompt) => `SEL:${selection}\n${prompt}`,
            wrapWithBrainContext: (brain, prompt) => `BRAIN:${brain}\n${prompt}`,
        },
    });
}

module.exports = [
    {
        name: 'VisionService keeps the active provider first and includes other configured cloud fallbacks',
        run() {
            const VisionService = loadVisionService({
                activeProvider: 'openai',
                keys: {
                    openai: 'openai-key',
                    grok: 'grok-key',
                    gemini: 'gemini-key',
                },
            });
            const service = new VisionService();

            assert.deepEqual(
                service.providers.map((provider) => provider.label),
                ['OpenAI', 'Groq', 'Gemini']
            );
        },
    },
    {
        name: 'VisionService does not include local fallback by default',
        run() {
            const VisionService = loadVisionService({
                activeProvider: 'openai',
                keys: {
                    openai: 'openai-key',
                },
            });
            const service = new VisionService();

            assert.deepEqual(
                service.providers.map((provider) => provider.label),
                ['OpenAI']
            );
        },
    },
    {
        name: 'VisionService normalizes screen reply requests before routing',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();
            let seenRequest = null;

            service.router = {
                async route(request) {
                    seenRequest = request;
                    return {
                        success: true,
                        response: 'usable answer',
                        provider: 'Groq',
                    };
                },
            };

            const result = await service.analyze(
                'data:image/png;base64,QUJDREVGRw==',
                'selection',
                'prompt',
                'brain'
            );

            assert.equal(result.success, true);
            assert.equal(seenRequest.taskKind, 'screen_reply');
            assert.deepEqual(seenRequest.images, ['QUJDREVGRw==']);
            assert.equal(seenRequest.userPrompt, 'BRAIN:brain\nSEL:selection\nprompt');
        },
    },
    {
        name: 'VisionService forwards text-only task requests through analyzeText',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();
            let seenRequest = null;

            service.router = {
                async route(request) {
                    seenRequest = request;
                    return {
                        success: true,
                        response: '["ok"]',
                        parsed: ['ok'],
                        provider: 'OpenAI',
                    };
                },
            };

            const result = await service.analyzeText({
                taskKind: 'form_fill_values',
                prompt: 'Fill these values',
                expectedItemCount: 3,
            });

            assert.equal(result.success, true);
            assert.equal(seenRequest.taskKind, 'form_fill_values');
            assert.deepEqual(seenRequest.images, []);
            assert.equal(seenRequest.userPrompt, 'Fill these values');
            assert.equal(seenRequest.expectedItemCount, 3);
        },
    },
    {
        name: 'VisionService rejects deprecated analyzeTextOnly usage',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();

            await assert.rejects(
                () => service.analyzeTextOnly('old prompt'),
                /analyzeTextOnly is deprecated/
            );
        },
    },
];
