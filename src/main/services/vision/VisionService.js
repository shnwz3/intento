const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { cleanText, isRefusal, isLowQuality } = require('./utils/textCleaner');

// Load AI Configuration
let aiConfig = {
    system_prompt:
        'You are INTENTO. Provide high-quality, humanized, and substantive responses ONLY.',
    model_params: { max_tokens: 500, temperature: 0.75 },
};

try {
    const configPath = path.join(__dirname, '../../../ai_config.json');
    if (fs.existsSync(configPath)) {
        aiConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (err) {
    console.warn('⚠️ Failed to load ai_config.json, using defaults.');
}

/**
 * VisionService - Orchestrates AI vision providers
 * Primary: Grok API
 * Fallback: Ollama (local dev)
 */
class VisionService {
    constructor() {
        this.providers = this._buildProviders();
        this.currentIndex = 0;
        console.log(`✅ VisionService initialized with ${this.providers.length} provider(s)`);
    }

    /**
     * Build the list of available providers from environment
     * @returns {Array<{name: string, call: Function}>}
     */
    _buildProviders() {
        const providers = [];
        const apiKey = process.env.GROK_API_KEY || process.env.OPENROUTER_API_KEY;

        if (apiKey) {
            if (apiKey.startsWith('gsk_')) {
                providers.push({ name: 'Grok', call: (img, prompt) => this._callGrok(apiKey, img, prompt) });
            } else if (apiKey.startsWith('AIza')) {
                providers.push({ name: 'Gemini', call: (img, prompt) => this._callGemini(apiKey, img, prompt) });
            } else if (apiKey.startsWith('sk-or-')) {
                providers.push({ name: 'OpenRouter', call: (img, prompt) => this._callOpenRouter(apiKey, img, prompt) });
            } else {
                providers.push({ name: 'OpenAI-Compatible', call: (img, prompt) => this._callGrok(apiKey, img, prompt) });
            }
        }

        // Ollama fallback (always available for dev)
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
        let userPrompt = prompt || 'Look at this screen and GENERATE the next substantive reply or data. OUTPUT ONLY THE TEXT.';

        if (selectedText) {
            userPrompt = `Context (User Selection): "${selectedText}"\n\nTask: ${userPrompt}`;
        }
        if (brainContext) {
            userPrompt = `[THE BRAIN / MY DETAILS]:\n${brainContext}\n\n[TASK]:\n${userPrompt}`;
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
                const raw = await provider.call(base64, userPrompt);
                const cleaned = cleanText(raw);

                if (isRefusal(cleaned)) {
                    console.log(`⚠️ ${provider.name} refused, trying next...`);
                    continue;
                }
                if (isLowQuality(cleaned)) {
                    console.log(`⚠️ ${provider.name} returned low-quality: "${cleaned}". Trying next...`);
                    continue;
                }

                console.log(`✅ High-quality response from ${provider.name}`);
                this.currentIndex = idx;
                return { success: true, response: cleaned };
            } catch (err) {
                console.warn(`⚠️ ${provider.name} failed:`, err.message);
                if ([401, 402, 429].includes(err.status) || err.message.includes('quota')) {
                    continue;
                }
            }
        }

        return { success: false, error: 'All AI providers failed. Please try again.' };
    }

    isReady() {
        return this.providers.length > 0;
    }

    /**
     * Text-only AI call (no image) — used for document tag extraction
     * @param {string} prompt
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async analyzeTextOnly(prompt) {
        const apiKey = process.env.GROK_API_KEY || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }

        try {
            let baseURL = 'https://api.groq.com/openai/v1';
            let model = 'llama-3.3-70b-versatile';

            if (apiKey.startsWith('sk-or-')) {
                baseURL = 'https://openrouter.ai/api/v1';
                model = 'google/gemini-2.0-flash-exp:free';
            }

            const client = new OpenAI({ apiKey, baseURL });
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: 'You are a precise data extraction engine. Return only what is asked.' },
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
     * Grok API call (OpenAI-compatible)
     */
    async _callGrok(apiKey, base64Image, userPrompt) {
        const client = new OpenAI({
            apiKey,
            baseURL: 'https://api.groq.com/openai/v1',
        });

        const response = await client.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
     * OpenRouter API call
     */
    async _callOpenRouter(apiKey, base64Image, userPrompt) {
        const client = new OpenAI({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/intento-app',
                'X-Title': 'Intento Vision',
            },
        });

        const response = await client.chat.completions.create({
            model: 'google/gemini-2.0-flash-exp:free',
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
