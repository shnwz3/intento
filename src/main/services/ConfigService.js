const Store = require('electron-store');
const axios = require('axios');

/**
 * Map of environment variable names to provider IDs
 */
const ENV_KEY_MAP = {
    GROK_API_KEY: 'grok',
    OPENAI_API_KEY: 'openai',
    GEMINI_API_KEY: 'gemini',
    ANTHROPIC_API_KEY: 'anthropic',
    OPENROUTER_API_KEY: 'openrouter',
};

/**
 * API base URLs for validation
 */
const PROVIDER_ENDPOINTS = {
    grok: 'https://api.groq.com/openai/v1',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
};

class ConfigService {
    constructor() {
        this.store = new Store();
        this._initDefaults();
        this._syncEnvKeys();
    }

    /** @private - Set initial config if none exists */
    _initDefaults() {
        if (!this.store.get('ai_config')) {
            this.store.set('ai_config', {
                activeProvider: 'grok',
                keys: {
                    openai: '',
                    gemini: '',
                    anthropic: '',
                    grok: '',
                    openrouter: ''
                },
                models: {
                    openai: 'gpt-4o',
                    gemini: 'gemini-1.5-flash',
                    anthropic: 'claude-3-5-sonnet',
                    grok: 'grok-2-vision-1212',
                    openrouter: 'openai/gpt-4o'
                }
            });
        }
    }

    /**
     * @private - Sync environment variable API keys into stored config
     * Always overwrites stored keys with env vars (env vars = source of truth for dev)
     * Production users won't have env vars, so their UI-entered keys stay untouched
     */
    _syncEnvKeys() {
        const config = this.store.get('ai_config');
        let changed = false;
        let firstEnvProvider = null;

        for (const [envVar, providerId] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envVar];
            if (envValue) {
                // Always sync env var into config (env var is source of truth for dev)
                if (config.keys[providerId] !== envValue) {
                    config.keys[providerId] = envValue;
                    changed = true;
                    console.log(`🔑 Synced ${envVar} → ${providerId}`);
                }
                if (!firstEnvProvider) firstEnvProvider = providerId;
            }
        }

        // If the current active provider has no key, switch to one that does
        if (!config.keys[config.activeProvider] && firstEnvProvider) {
            config.activeProvider = firstEnvProvider;
            changed = true;
            console.log(`🔄 Auto-switched to ${firstEnvProvider} (has env key)`);
        }

        if (changed) {
            this.store.set('ai_config', config);
        }
    }

    getConfig() {
        return this.store.get('ai_config');
    }

    saveConfig(config) {
        this.store.set('ai_config', config);
        console.log('🧪 Config saved:', config.activeProvider);
        return { success: true };
    }

    /**
     * Validate API key and get credit/balance info by making a real API call
     * @param {string} provider - Provider ID 
     * @returns {Promise<{balance: string, status: string}>}
     */
    async getCredits(provider) {
        const config = this.getConfig();
        const key = config.keys[provider];

        if (!key) return { balance: 'No Key', status: 'missing' };

        try {
            // === GROQ (Grok) ===
            if (provider === 'grok') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.grok}/models`, {
                    headers: { 'Authorization': `Bearer ${key}` },
                    timeout: 5000,
                });
                if (res.status === 200) {
                    return { balance: 'Valid Key ✓', status: 'connected' };
                }
            }

            // === OPENAI ===
            if (provider === 'openai') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.openai}/models`, {
                    headers: { 'Authorization': `Bearer ${key}` },
                    timeout: 5000,
                });
                if (res.status === 200) {
                    return { balance: 'Valid Key ✓', status: 'connected' };
                }
            }

            // === GEMINI ===
            if (provider === 'gemini') {
                const res = await axios.get(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
                    { timeout: 5000 }
                );
                if (res.status === 200) {
                    return { balance: 'Valid Key ✓ (Free/PAYG)', status: 'connected' };
                }
            }

            // === ANTHROPIC ===
            if (provider === 'anthropic') {
                // Anthropic doesn't have a lightweight list endpoint,
                // so we send a minimal message to validate the key
                try {
                    const res = await axios.post(`${PROVIDER_ENDPOINTS.anthropic}/messages`, {
                        model: 'claude-3-5-sonnet-20241022',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'hi' }],
                    }, {
                        headers: {
                            'x-api-key': key,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json',
                        },
                        timeout: 8000,
                    });
                    if (res.status === 200) {
                        return { balance: 'Valid Key ✓', status: 'connected' };
                    }
                } catch (anthropicErr) {
                    // 400 = valid key but bad request (still validates the key)
                    // 401 = invalid key
                    if (anthropicErr.response?.status === 400 || anthropicErr.response?.status === 200) {
                        return { balance: 'Valid Key ✓', status: 'connected' };
                    }
                    if (anthropicErr.response?.status === 401) {
                        return { balance: 'Invalid Key ✗', status: 'error' };
                    }
                    // 429 = rate limited but key is valid
                    if (anthropicErr.response?.status === 429) {
                        return { balance: 'Valid (Rate Limited)', status: 'connected' };
                    }
                    throw anthropicErr;
                }
            }

            // === OPENROUTER (has real credit balance API!) ===
            if (provider === 'openrouter') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.openrouter}/auth/key`, {
                    headers: { 'Authorization': `Bearer ${key}` },
                    timeout: 5000,
                });
                if (res.status === 200 && res.data?.data) {
                    const data = res.data.data;
                    const limit = data.limit !== null ? `$${(data.limit / 100).toFixed(2)}` : 'Unlimited';
                    const used = data.usage !== undefined ? `$${(data.usage / 100).toFixed(2)}` : '$0.00';
                    return { balance: `Used: ${used} / Limit: ${limit}`, status: 'connected' };
                }
            }

            return { balance: 'Unknown', status: 'unknown' };
        } catch (error) {
            console.error(`Credit check failed for ${provider}:`, error.message);

            // Check specific error codes
            if (error.response?.status === 401) {
                return { balance: 'Invalid Key ✗', status: 'error' };
            }
            if (error.response?.status === 403) {
                return { balance: 'Key Forbidden ✗', status: 'error' };
            }
            if (error.response?.status === 429) {
                return { balance: 'Valid (Rate Limited)', status: 'connected' };
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return { balance: 'Timeout', status: 'error' };
            }

            return { balance: 'Error', status: 'error' };
        }
    }
}

module.exports = new ConfigService();
