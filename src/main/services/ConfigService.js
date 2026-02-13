const Store = require('electron-store');
const axios = require('axios');

class ConfigService {
    constructor() {
        this.store = new Store();
        this._initDefaults();
    }

    /** @private */
    _initDefaults() {
        if (!this.store.get('ai_config')) {
            this.store.set('ai_config', {
                activeProvider: 'openai',
                keys: {
                    openai: '',
                    gemini: '',
                    anthropic: '',
                    grok: '',
                    openrouter: ''
                },
                models: {
                    openai: 'gpt-4o',
                    gemini: 'gemini-1.5-pro',
                    anthropic: 'claude-3-5-sonnet',
                    grok: 'grok-2-vision-1212',
                    openrouter: 'openai/gpt-4o'
                }
            });
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

    async getCredits(provider) {
        const config = this.getConfig();
        const key = config.keys[provider];

        if (!key) return { balance: 'No Key', status: 'missing' };

        try {
            if (provider === 'openai') {
                // OpenAI credit fetching is notoriously difficult via simple API key
                // We'll return a 'Connected' status for now as a baseline
                return { balance: 'Active', status: 'connected' };
            }
            if (provider === 'gemini') {
                return { balance: 'Unlimited (Free Tier/PAYG)', status: 'connected' };
            }
            if (provider === 'anthropic') {
                return { balance: 'Active', status: 'connected' };
            }
            return { balance: 'N/A', status: 'unknown' };
        } catch (error) {
            return { balance: 'Error', status: 'error' };
        }
    }
}

module.exports = new ConfigService();
