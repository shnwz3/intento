const Store = require('electron-store');
const axios = require('axios');

const ENV_KEY_MAP = {
    GROK_API_KEY: 'grok',
    OPENAI_API_KEY: 'openai',
    GEMINI_API_KEY: 'gemini',
    ANTHROPIC_API_KEY: 'anthropic',
    OPENROUTER_API_KEY: 'openrouter',
};

const PROVIDER_ENDPOINTS = {
    grok: 'https://api.groq.com/openai/v1',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
};

const DEFAULT_AI_CONFIG = {
    activeProvider: 'grok',
    keys: {
        openai: '',
        gemini: '',
        anthropic: '',
        grok: '',
        openrouter: '',
    },
    models: {
        openai: 'gpt-4o',
        gemini: 'gemini-1.5-flash',
        anthropic: 'claude-3-5-sonnet',
        grok: 'grok-2-vision-1212',
        openrouter: 'openai/gpt-4o',
    },
    typing: {
        mode: 'type',
        countdownSeconds: 5,
    },
};

class ConfigService {
    constructor() {
        this.store = new Store();
        this._initDefaults();
        this._syncEnvKeys();
    }

    _normalizeConfig(config = {}) {
        return {
            ...DEFAULT_AI_CONFIG,
            ...config,
            keys: {
                ...DEFAULT_AI_CONFIG.keys,
                ...(config.keys || {}),
            },
            models: {
                ...DEFAULT_AI_CONFIG.models,
                ...(config.models || {}),
            },
            typing: {
                ...DEFAULT_AI_CONFIG.typing,
                ...(config.typing || {}),
            },
        };
    }

    _initDefaults() {
        const config = this.store.get('ai_config');
        const normalized = this._normalizeConfig(config);
        this.store.set('ai_config', normalized);
    }

    _syncEnvKeys() {
        const config = this.getConfig();
        let changed = false;
        let firstEnvProvider = null;

        for (const [envVar, providerId] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envVar];
            if (envValue) {
                if (config.keys[providerId] !== envValue) {
                    config.keys[providerId] = envValue;
                    changed = true;
                    console.log(`Synced ${envVar} -> ${providerId}`);
                }
                if (!firstEnvProvider) firstEnvProvider = providerId;
            }
        }

        if (!config.keys[config.activeProvider] && firstEnvProvider) {
            config.activeProvider = firstEnvProvider;
            changed = true;
            console.log(`Auto-switched to ${firstEnvProvider} (has env key)`);
        }

        if (changed) {
            this.store.set('ai_config', config);
        }
    }

    getConfig() {
        return this._normalizeConfig(this.store.get('ai_config'));
    }

    saveConfig(config) {
        const normalized = this._normalizeConfig(config);
        this.store.set('ai_config', normalized);
        console.log('Config saved:', normalized.activeProvider, normalized.typing.mode);
        return { success: true, config: normalized };
    }

    getTypingConfig() {
        return this.getConfig().typing;
    }

    getProviderOverview() {
        const config = this.getConfig();
        return Object.keys(DEFAULT_AI_CONFIG.keys).map((providerId) => {
            const hasKey = Boolean(config.keys[providerId] && config.keys[providerId].trim());
            return {
                id: providerId,
                isActive: config.activeProvider === providerId,
                hasKey,
                status: hasKey ? (config.activeProvider === providerId ? 'active' : 'configured') : 'missing',
            };
        });
    }

    async getCredits(provider) {
        const config = this.getConfig();
        const key = config.keys[provider];

        if (!key) return { balance: 'No Key', status: 'missing' };

        try {
            if (provider === 'grok') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.grok}/models`, {
                    headers: { Authorization: `Bearer ${key}` },
                    timeout: 5000,
                });
                if (res.status === 200) {
                    return { balance: 'Valid Key', status: 'connected' };
                }
            }

            if (provider === 'openai') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.openai}/models`, {
                    headers: { Authorization: `Bearer ${key}` },
                    timeout: 5000,
                });
                if (res.status === 200) {
                    return { balance: 'Valid Key', status: 'connected' };
                }
            }

            if (provider === 'gemini') {
                const res = await axios.get(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
                    { timeout: 5000 }
                );
                if (res.status === 200) {
                    return { balance: 'Valid Key (Free/PAYG)', status: 'connected' };
                }
            }

            if (provider === 'anthropic') {
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
                        return { balance: 'Valid Key', status: 'connected' };
                    }
                } catch (anthropicErr) {
                    if (anthropicErr.response?.status === 400 || anthropicErr.response?.status === 200) {
                        return { balance: 'Valid Key', status: 'connected' };
                    }
                    if (anthropicErr.response?.status === 401) {
                        return { balance: 'Invalid Key', status: 'error' };
                    }
                    if (anthropicErr.response?.status === 429) {
                        return { balance: 'Valid (Rate Limited)', status: 'connected' };
                    }
                    throw anthropicErr;
                }
            }

            if (provider === 'openrouter') {
                const res = await axios.get(`${PROVIDER_ENDPOINTS.openrouter}/auth/key`, {
                    headers: { Authorization: `Bearer ${key}` },
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

            if (error.response?.status === 401) {
                return { balance: 'Invalid Key', status: 'error' };
            }
            if (error.response?.status === 403) {
                return { balance: 'Key Forbidden', status: 'error' };
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
