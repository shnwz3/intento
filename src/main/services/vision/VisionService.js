const OpenAI = require('openai');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { cleanText, isRefusal, isLowQuality } = require('./utils/textCleaner');

const promptService = require('../../prompts/PromptService');
const configService = require('../ConfigService');

let aiConfig = {
    system_prompt: promptService.SYSTEM_PROMPT,
    model_params: { max_tokens: 500, temperature: 0.75 },
};

try {
    const appRoot = app.getAppPath();
    const configPath = path.join(appRoot, 'ai_config.json');
    if (fs.existsSync(configPath)) {
        aiConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (err) {
    console.warn('Failed to load ai_config.json, using defaults.');
}

const PROVIDER_CONFIG = {
    grok: {
        name: 'Grok',
        baseURL: 'https://api.groq.com/openai/v1',
        visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
        textModel: 'llama-3.3-70b-versatile',
        type: 'openai-compatible',
    },
    openai: {
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        visionModel: 'gpt-4o',
        textModel: 'gpt-4o',
        type: 'openai-compatible',
    },
    gemini: {
        name: 'Gemini',
        type: 'google-native',
        visionModel: 'gemini-1.5-flash',
        textModel: 'gemini-1.5-flash',
    },
    anthropic: {
        name: 'Anthropic',
        baseURL: 'https://api.anthropic.com/v1',
        visionModel: 'claude-3-5-sonnet-20241022',
        textModel: 'claude-3-5-sonnet-20241022',
        type: 'openai-compatible',
    },
    openrouter: {
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        visionModel: 'google/gemini-2.0-flash-exp:free',
        textModel: 'google/gemini-2.0-flash-exp:free',
        type: 'openai-compatible',
        extraHeaders: {
            'HTTP-Referer': 'https://github.com/intento-app',
            'X-Title': 'Intento Vision',
        },
    },
};

class VisionService {
    constructor() {
        this.providers = this._buildProviders();
        this.currentIndex = 0;
        console.log(`VisionService initialized with ${this.providers.length} provider(s)`);
    }

    refreshProviders() {
        this.providers = this._buildProviders();
        this.currentIndex = 0;
        console.log(`VisionService refreshed with ${this.providers.length} provider(s)`);
    }

    _buildProviders() {
        const providers = [];
        const config = configService.getConfig();
        const activeProvider = config.activeProvider;
        const activeKey = config.keys[activeProvider];
        const fallbackProviderIds = Object.entries(config.keys)
            .filter(([providerId, key]) => providerId !== activeProvider && key && PROVIDER_CONFIG[providerId])
            .map(([providerId]) => providerId);

        if (activeKey && PROVIDER_CONFIG[activeProvider]) {
            const providerCfg = PROVIDER_CONFIG[activeProvider];
            providers.push(this._createProviderEntry(providerCfg, activeKey));
            console.log(`Using ${providerCfg.name} from Settings UI`);
        }

        for (const providerId of fallbackProviderIds) {
            providers.push(this._createProviderEntry(PROVIDER_CONFIG[providerId], config.keys[providerId]));
        }

        providers.push({
            name: 'Ollama',
            type: 'local',
            call: (img, prompt) => this._callOllama(img, prompt),
        });

        return providers;
    }

    _createProviderEntry(providerCfg, key) {
        if (providerCfg.type === 'google-native') {
            return {
                name: providerCfg.name,
                type: providerCfg.type,
                call: (img, prompt) => this._callGemini(key, img, prompt),
            };
        }

        return {
            name: providerCfg.name,
            type: providerCfg.type,
            call: (img, prompt) => this._callOpenAICompatible(key, providerCfg, img, prompt),
        };
    }

    _buildVisionPrompt(selectedText, prompt, brainContext) {
        let userPrompt = prompt || promptService.DEFAULT_VISION_PROMPT;

        if (selectedText) {
            userPrompt = promptService.wrapWithSelectionContext(selectedText, userPrompt);
        }
        if (brainContext) {
            userPrompt = promptService.wrapWithBrainContext(brainContext, userPrompt);
        }

        return userPrompt;
    }

    async analyze(imageBase64, selectedText = '', prompt = '', brainContext = '') {
        const userPrompt = this._buildVisionPrompt(selectedText, prompt, brainContext);
        const base64 = this._normalizeImageBase64(imageBase64);
        const configuredProviders = this.providers.filter((provider) => provider.name !== 'Ollama');
        const failures = [];

        for (let i = 0; i < this.providers.length; i++) {
            const idx = (this.currentIndex + i) % this.providers.length;
            const provider = this.providers[idx];
            const result = await this._tryProvider(provider, base64, userPrompt);

            if (result.success) {
                this.currentIndex = idx;
                return result;
            }

            failures.push(result);
        }

        if (configuredProviders.length === 0) {
            return {
                success: false,
                code: 'NO_PROVIDER',
                message: 'No AI provider is configured. Add an API key in Settings or start Ollama locally.',
                error: 'No AI provider is configured. Add an API key in Settings or start Ollama locally.',
                failures,
            };
        }

        const terminalFailure = failures[failures.length - 1];
        return {
            success: false,
            code: terminalFailure?.code || 'ANALYZE_FAILED',
            message: terminalFailure?.message || 'AI analysis failed.',
            error: terminalFailure?.message || 'AI analysis failed.',
            failures,
        };
    }

    _normalizeImageBase64(input) {
        if (Array.isArray(input)) {
            return input.map(item => this._normalizeImageBase64(item));
        }
        if (Buffer.isBuffer(input)) {
            return input.toString('base64');
        }
        if (typeof input !== 'string') {
            return input;
        }
        return input.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    }

    async _tryProvider(provider, base64, userPrompt) {
        try {
            console.log(`Trying ${provider.name}...`);

            const responsePromise = provider.call(base64, userPrompt);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 15000)
            );

            const raw = await Promise.race([responsePromise, timeoutPromise]);
            const cleaned = cleanText(raw);

            if (!cleaned) {
                return {
                    success: false,
                    provider: provider.name,
                    code: 'EMPTY_RESPONSE',
                    message: `${provider.name} returned an empty response.`,
                    error: `${provider.name} returned an empty response.`,
                };
            }

            if (isRefusal(cleaned)) {
                return {
                    success: false,
                    provider: provider.name,
                    code: 'PROVIDER_REFUSAL',
                    message: `${provider.name} refused the request.`,
                    error: `${provider.name} refused the request.`,
                };
            }

            if (isLowQuality(cleaned)) {
                return {
                    success: false,
                    provider: provider.name,
                    code: 'LOW_QUALITY_RESPONSE',
                    message: `${provider.name} returned a weak response.`,
                    error: `${provider.name} returned a weak response.`,
                };
            }

            console.log(`High-quality response from ${provider.name}`);
            return {
                success: true,
                code: 'ANALYZE_OK',
                message: 'AI analysis completed successfully.',
                response: cleaned,
                provider: provider.name,
            };
        } catch (err) {
            if (err.message === 'TIMEOUT') {
                return {
                    success: false,
                    provider: provider.name,
                    code: 'PROVIDER_TIMEOUT',
                    message: `${provider.name} timed out after 15 seconds.`,
                    error: `${provider.name} timed out after 15 seconds.`,
                };
            }

            if ([401, 402, 429].includes(err.status) || err.message.includes('quota')) {
                return {
                    success: false,
                    provider: provider.name,
                    code: 'PROVIDER_AUTH_OR_QUOTA',
                    message: `${provider.name} rejected the request due to auth or quota limits.`,
                    error: `${provider.name} rejected the request due to auth or quota limits.`,
                };
            }

            return {
                success: false,
                provider: provider.name,
                code: 'PROVIDER_ERROR',
                message: err.message || `${provider.name} failed.`,
                error: err.message || `${provider.name} failed.`,
            };
        }
    }

    isReady() {
        return this.providers.length > 0;
    }

    async analyzeTextOnly(prompt) {
        const config = configService.getConfig();
        const activeProvider = config.activeProvider;
        const apiKey = config.keys[activeProvider] || process.env.GROK_API_KEY || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return {
                success: false,
                code: 'NO_PROVIDER',
                message: 'No API key configured. Go to AI Engine settings to add your key.',
                error: 'No API key configured. Go to AI Engine settings to add your key.',
            };
        }

        try {
            const providerCfg = PROVIDER_CONFIG[activeProvider] || PROVIDER_CONFIG.grok;
            let baseURL = providerCfg.baseURL;
            let model = providerCfg.textModel;

            if (!config.keys[activeProvider] && apiKey.startsWith('sk-or-')) {
                baseURL = 'https://openrouter.ai/api/v1';
                model = 'google/gemini-2.0-flash-exp:free';
            }

            const client = new OpenAI({ apiKey, baseURL });
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: promptService.TEXT_ONLY_SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 4000,
                temperature: 0.3,
            });

            return {
                success: true,
                code: 'TEXT_ANALYZE_OK',
                message: 'Text-only analysis completed successfully.',
                response: response.choices[0].message.content,
                provider: providerCfg.name,
            };
        } catch (err) {
            console.error('Text-only AI failed:', err.message);
            return {
                success: false,
                code: 'TEXT_ANALYZE_FAILED',
                message: err.message || 'Text-only AI failed.',
                error: err.message || 'Text-only AI failed.',
            };
        }
    }

    async _callOpenAICompatible(apiKey, providerCfg, base64Images, userPrompt) {
        const clientOpts = {
            apiKey,
            baseURL: providerCfg.baseURL,
        };
        if (providerCfg.extraHeaders) {
            clientOpts.defaultHeaders = providerCfg.extraHeaders;
        }

        const client = new OpenAI(clientOpts);
        const images = Array.isArray(base64Images) ? base64Images : [base64Images];

        const contentArray = [
            { type: 'text', text: userPrompt }
        ];

        for (const b64 of images) {
            contentArray.push({
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${b64}` }
            });
        }

        const response = await client.chat.completions.create({
            model: providerCfg.visionModel,
            messages: [
                { role: 'system', content: aiConfig.system_prompt },
                {
                    role: 'user',
                    content: contentArray,
                },
            ],
            max_tokens: aiConfig.model_params.max_tokens || 500,
            temperature: aiConfig.model_params.temperature || 0.7,
        });

        return response.choices[0].message.content;
    }

    async _callGemini(apiKey, base64Images, userPrompt) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const images = Array.isArray(base64Images) ? base64Images : [base64Images];
        const parts = [
            { text: `${aiConfig.system_prompt}\n\nTask: ${userPrompt}` }
        ];

        for (const b64 of images) {
            parts.push({ inlineData: { data: b64, mimeType: 'image/png' } });
        }

        const result = await model.generateContent(parts);

        return (await result.response).text();
    }

    async _callOllama(base64Images, userPrompt) {
        const ollama = require('ollama').default;
        const images = Array.isArray(base64Images) ? base64Images : [base64Images];
        const response = await ollama.generate({
            model: 'moondream',
            prompt: `Instruction: ${aiConfig.system_prompt}\n\nTask: ${userPrompt}`,
            images: images,
            stream: false,
        });
        return response.response;
    }
}

module.exports = VisionService;
