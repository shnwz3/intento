const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function loadVisionService(configOverrides = {}) {
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
    const mockConfigService = {
        getConfig() {
            return resolvedConfig;
        },
    };

    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'vision', 'VisionService.js'), {
        electron: { app: { getAppPath: () => process.cwd() } },
        '../ConfigService': mockConfigService,
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
        name: 'VisionService returns NO_PROVIDER when only local fallback exists',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();

            service.providers = [{ name: 'Ollama' }];
            service._tryProvider = async () => ({
                success: false,
                code: 'PROVIDER_ERROR',
                message: 'Ollama unavailable',
                error: 'Ollama unavailable',
            });

            const result = await service.analyze('image');
            assert.equal(result.success, false);
            assert.equal(result.code, 'NO_PROVIDER');
        },
    },
    {
        name: 'VisionService rotates through providers and keeps the successful index',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();

            service.providers = [{ name: 'First' }, { name: 'Second' }];
            service._tryProvider = async (provider) => {
                if (provider.name === 'First') {
                    return {
                        success: false,
                        code: 'PROVIDER_TIMEOUT',
                        message: 'First timed out',
                        error: 'First timed out',
                    };
                }

                return {
                    success: true,
                    code: 'ANALYZE_OK',
                    message: 'ok',
                    response: 'usable answer',
                    provider: provider.name,
                };
            };

            const result = await service.analyze('image', 'selection', 'prompt', 'brain');
            assert.equal(result.success, true);
            assert.equal(result.provider, 'Second');
            assert.equal(service.currentIndex, 1);
        },
    },
    {
        name: 'VisionService keeps the active provider first and includes other configured fallbacks',
        async run() {
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
                service.providers.map((provider) => provider.name),
                ['OpenAI', 'Grok', 'Gemini', 'Ollama']
            );
        },
    },
    {
        name: 'VisionService strips data URL prefixes before provider calls',
        async run() {
            const VisionService = loadVisionService();
            const service = new VisionService();
            const seen = [];

            service.providers = [
                {
                    name: 'First',
                    call: async (base64) => {
                        seen.push(base64);
                        return 'ok';
                    },
                },
            ];

            const result = await service.analyze('data:image/png;base64,QUJDREVGRw==');

            assert.equal(result.success, true);
            assert.deepEqual(seen, ['QUJDREVGRw==']);
        },
    },
];
