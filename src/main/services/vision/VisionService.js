const OpenAI = require('openai');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { cleanText, isRefusal, isLowQuality } = require('./utils/textCleaner');

const promptService = require('../../prompts/PromptService');
const configService = require('../ConfigService');

// Load AI Configuration (system prompt & model params)
let aiConfig = {
    system_prompt: promptService.SYSTEM_PROMPT,
    model_params: { max_tokens: 500, temperature: 0.75 },
};

try {
    // In dev: resolve relative to source. In prod: resolve from app root.
    const appRoot = app.getAppPath();
    const configPath = path.join(appRoot, 'ai_config.json');
    if (fs.existsSync(configPath)) {
        aiConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (err) {
    console.warn('⚠️ Failed to load ai_config.json, using defaults.');
}

/**
 * Provider base URLs and models for each supported API
 */
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

/**
 * VisionService - Orchestrates AI vision providers
 * Reads API keys from ConfigService (user-configured via Settings UI)
 * Fallback: Ollama (local dev)
 */
class VisionService {
    constructor() {
        this.providers = this._buildProviders();
        this.currentIndex = 0;
        console.log(`✅ VisionService initialized with ${this.providers.length} provider(s)`);
    }

    /**
     * Refresh providers when user changes API config from Settings UI
     */
    refreshProviders() {
        this.providers = this._buildProviders();
        this.currentIndex = 0;
        console.log(`🔄 VisionService refreshed with ${this.providers.length} provider(s)`);
    }

    /**
     * Build the list of available providers from ConfigService (electron-store)
     * Falls back to process.env for backward compatibility
     * @returns {Array<{name: string, call: Function}>}
     */
    _buildProviders() {
        const providers = [];
        const config = configService.getConfig();
        const activeProvider = config.activeProvider;
        const activeKey = config.keys[activeProvider];

        // 1. Try user-configured provider from Settings UI (priority)
        if (activeKey && PROVIDER_CONFIG[activeProvider]) {
            const providerCfg = PROVIDER_CONFIG[activeProvider];
            if (providerCfg.type === 'google-native') {
                providers.push({
                    name: providerCfg.name,
                    call: (img, prompt) => this._callGemini(activeKey, img, prompt),
                });
            } else {
                providers.push({
                    name: providerCfg.name,
                    call: (img, prompt) => this._callOpenAICompatible(activeKey, providerCfg, img, prompt),
                });
            }
            console.log(`🔑 Using ${providerCfg.name} from Settings UI`);
        }

        // 2. If no UI key set, also try other saved keys as fallbacks
        if (!activeKey) {
            for (const [providerId, key] of Object.entries(config.keys)) {
                if (!key || providerId === activeProvider) continue;
                const providerCfg = PROVIDER_CONFIG[providerId];
                if (!providerCfg) continue;

                if (providerCfg.type === 'google-native') {
                    providers.push({
                        name: providerCfg.name,
                        call: (img, prompt) => this._callGemini(key, img, prompt),
                    });
                } else {
                    providers.push({
                        name: providerCfg.name,
                        call: (img, prompt) => this._callOpenAICompatible(key, providerCfg, img, prompt),
                    });
                }
            }
        }

        // 3. Ollama fallback (always available for dev)
        providers.push({ name: 'Ollama', call: (img, prompt) => this._callOllama(img, prompt) });

        return providers;
    }

    /**
     * Main entry point - analyze a screenshot with optional context
     * @param {string} imageBase64 - Base64 encoded screenshot
     * @param {string} selectedText - Any selected/highlighted text
     * @param {string} prompt - The user prompt or auto-generated directive
     * @param {string} brainContext - Brain persona context
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async analyze(imageBase64, selectedText = '', prompt = '', brainContext = '') {
        let userPrompt = prompt || promptService.DEFAULT_VISION_PROMPT;

        if (selectedText) {
            userPrompt = promptService.wrapWithSelectionContext(selectedText, userPrompt);
        }
        if (brainContext) {
            userPrompt = promptService.wrapWithBrainContext(brainContext, userPrompt);
        }

        // Ensure base64 string (not Buffer)
        const base64 = Buffer.isBuffer(imageBase64)
            ? imageBase64.toString('base64')
            : imageBase64;

        // Try each provider with rotation
        for (let i = 0; i < this.providers.length; i++) {
            const idx = (this.currentIndex + i) % this.providers.length;
            const provider = this.providers[idx];

            try {
                console.log(`🤖 Trying ${provider.name}...`);

                // Implement 15s timeout per provider
                const responsePromise = provider.call(base64, userPrompt);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 15000)
                );

                const raw = await Promise.race([responsePromise, timeoutPromise]);
                const cleaned = cleanText(raw);

                if (isRefusal(cleaned)) {
                    console.log(`⚠️ ${provider.name} refused, trying next...`);
                    continue;
                }
                if (isLowQuality(cleaned)) {
                    console.log(`⚠️ ${provider.name} returned an empty response. Trying next...`);
                    continue;
                }

                console.log(`✅ High-quality response from ${provider.name}`);
                this.currentIndex = idx;
                return { success: true, response: cleaned };
            } catch (err) {
                if (err.message === 'TIMEOUT') {
                    console.warn(`⏳ ${provider.name} timed out after 15s`);
                } else {
                    console.warn(`⚠️ ${provider.name} failed:`, err.message);
                }

                if ([401, 402, 429].includes(err.status) || err.message.includes('quota') || err.message === 'TIMEOUT') {
                    continue;
                }
            }
        }

        return { success: false, error: 'AI timed out or failed. Please try again.' };
    }

    isReady() {
        return this.providers.length > 0;
    }

    /**
     * Text-only AI call (no image) — used for document tag extraction
     * Reads from ConfigService (user-configured keys)
     * @param {string} prompt
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async analyzeTextOnly(prompt) {
        const config = configService.getConfig();
        const activeProvider = config.activeProvider;
        const apiKey = config.keys[activeProvider] || process.env.GROK_API_KEY || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return { success: false, error: 'No API key configured. Go to AI Engine settings to add your key.' };
        }

        try {
            const providerCfg = PROVIDER_CONFIG[activeProvider] || PROVIDER_CONFIG.grok;
            let baseURL = providerCfg.baseURL;
            let model = providerCfg.textModel;

            // Fallback detection for env var keys
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
                max_tokens: 1000,
                temperature: 0.3,
            });

            return { success: true, response: response.choices[0].message.content };
        } catch (err) {
            console.error('Text-only AI failed:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ============ PROVIDER IMPLEMENTATIONS ============

    /**
     * Generic OpenAI-compatible API call (works for Grok, OpenAI, OpenRouter, Anthropic)
     */
    async _callOpenAICompatible(apiKey, providerCfg, base64Image, userPrompt) {
        const clientOpts = {
            apiKey,
            baseURL: providerCfg.baseURL,
        };
        if (providerCfg.extraHeaders) {
            clientOpts.defaultHeaders = providerCfg.extraHeaders;
        }

        const client = new OpenAI(clientOpts);

        const response = await client.chat.completions.create({
            model: providerCfg.visionModel,
            messages: [
                { role: 'system', content: aiConfig.system_prompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/png;base64,${base64Image}` },
                        },
                    ],
                },
            ],
            max_tokens: aiConfig.model_params.max_tokens || 500,
            temperature: aiConfig.model_params.temperature || 0.7,
        });

        return response.choices[0].message.content;
    }

    /**
     * Gemini API call (native Google SDK)
     */
    async _callGemini(apiKey, base64Image, userPrompt) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent([
            { text: `${aiConfig.system_prompt}\n\nTask: ${userPrompt}` },
            { inlineData: { data: base64Image, mimeType: 'image/png' } },
        ]);

        return (await result.response).text();
    }

    /**
     * Local Ollama fallback
     */
    async _callOllama(base64Image, userPrompt) {
        const ollama = require('ollama').default;
        const response = await ollama.generate({
            model: 'moondream',
            prompt: `Instruction: ${aiConfig.system_prompt}\n\nTask: ${userPrompt}`,
            images: [base64Image],
            stream: false,
        });
        return response.response;
    }
}

module.exports = VisionService;
