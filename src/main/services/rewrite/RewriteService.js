const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ollama = require('ollama').default;
const fs = require('fs');
const path = require('path');

// Clean text utility (same as VisionService)
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/^["']|["']$/g, '')
        .replace(/^Here is the.*?:\s*/i, '')
        .trim();
}

/**
 * DictionaryService
 * Handles text correction (spelling/grammar) using:
 * 1. Online AI (Grok/OpenAI/Gemini) if available
 * 2. Offline AI (Ollama) as fallback
 */
class DictionaryService {
    constructor() {
        this.apiKeys = this._loadApiKeys();
        console.log('📖 DictionaryService initialized');
    }

    _loadApiKeys() {
        // Try loading from environment or config file
        const keys = {
            grok: process.env.GROK_API_KEY || process.env.OPENROUTER_API_KEY,
            gemini: process.env.GEMINI_API_KEY
        };

        try {
            const configPath = path.join(__dirname, '../../../ai_config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.api_key) keys.grok = config.api_key;
            }
        } catch (e) { /* ignore */ }

        return keys;
    }

    /**
     * Fix text using context from screenshot and selected text
     * @param {string} text - The selected text to fix
     * @param {string} screenshotBase64 - (Optional) Context from screen
     */
    async fixText(text, screenshotBase64 = null) {
        if (!text) return { success: false, error: 'No text provided' };

        const prompt = `
        TASK: Fix all spelling, grammar, and punctuation errors in the text below.
        CONTEXT: The user is typing this in an application.
        
        RULES:
        1. Access the context from the screenshot if provided to understand the intent.
        2. Preserve key technical terms, code snippets, or specific names.
        3. Do NOT change the tone unless it's clearly informal/broken.
        4. OUTPUT ONLY THE CORRECTED TEXT. NO PREAMBLE.

        TEXT TO FIX:
        "${text}"
        `;

        // 1. Try Online Providers first (if keys exist and we are online)
        if (this.apiKeys.grok || this.apiKeys.gemini) {
            try {
                if (this.apiKeys.grok) return await this._callGrok(prompt, screenshotBase64);
                if (this.apiKeys.gemini) return await this._callGemini(prompt, screenshotBase64);
            } catch (err) {
                console.warn('⚠️ Online Dictionary fix failed, falling back to Ollama:', err.message);
            }
        }

        // 2. Fallback to Offline Mode (Ollama)
        return await this._callOllama(prompt, screenshotBase64);
    }

    // --- Providers ---

    async _callGrok(prompt, imageBase64) {
        const client = new OpenAI({
            apiKey: this.apiKeys.grok,
            baseURL: this.apiKeys.grok.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : 'https://api.groq.com/openai/v1'
        });

        const messages = [{ role: 'user', content: prompt }];

        // Add image context if available and supported
        if (imageBase64) {
            messages[0].content = [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ];
        }

        const completion = await client.chat.completions.create({
            model: 'google/gemini-2.0-flash-exp:free', // Default low-cost/free model
            messages: messages
        });

        return { success: true, response: cleanText(completion.choices[0].message.content) };
    }

    async _callGemini(prompt, imageBase64) {
        const genAI = new GoogleGenerativeAI(this.apiKeys.gemini);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const parts = [{ text: prompt }];
        if (imageBase64) {
            parts.push({ inlineData: { data: imageBase64, mimeType: 'image/png' } });
        }

        const result = await model.generateContent(parts);
        return { success: true, response: cleanText(result.response.text()) };
    }

    async _callOllama(prompt, imageBase64) {
        try {
            const request = {
                model: 'mistral', // Fallback model
                prompt: prompt,
                stream: false
            };

            if (imageBase64) {
                request.images = [imageBase64];
            }

            const response = await ollama.generate(request);
            return { success: true, response: cleanText(response.response) };
        } catch (err) {
            console.error('❌ Ollama dictionary fix failed:', err.message);
            return { success: false, error: 'Offline correction failed. Is Ollama running?' };
        }
    }
}

module.exports = DictionaryService;