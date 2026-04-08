const PROVIDER_ORDER = Object.freeze(['grok', 'openai', 'gemini', 'anthropic', 'openrouter']);

const PROVIDERS = Object.freeze({
    grok: Object.freeze({
        id: 'grok',
        label: 'Groq',
        transport: 'openai-compatible',
        baseURL: 'https://api.groq.com/openai/v1',
        supportsText: true,
        supportsVision: true,
        isLocal: false,
        supportsImageDetail: false,
    }),
    openai: Object.freeze({
        id: 'openai',
        label: 'OpenAI',
        transport: 'openai-compatible',
        baseURL: 'https://api.openai.com/v1',
        supportsText: true,
        supportsVision: true,
        isLocal: false,
        supportsImageDetail: true,
    }),
    gemini: Object.freeze({
        id: 'gemini',
        label: 'Gemini',
        transport: 'google-native',
        supportsText: true,
        supportsVision: true,
        isLocal: false,
        supportsImageDetail: false,
    }),
    anthropic: Object.freeze({
        id: 'anthropic',
        label: 'Anthropic',
        transport: 'anthropic-native',
        baseURL: 'https://api.anthropic.com/v1',
        supportsText: true,
        supportsVision: true,
        isLocal: false,
        supportsImageDetail: false,
    }),
    openrouter: Object.freeze({
        id: 'openrouter',
        label: 'OpenRouter',
        transport: 'openai-compatible',
        baseURL: 'https://openrouter.ai/api/v1',
        supportsText: true,
        supportsVision: true,
        isLocal: false,
        supportsImageDetail: true,
        extraHeaders: Object.freeze({
            'HTTP-Referer': 'https://github.com/intento-app',
            'X-Title': 'Intento Vision',
        }),
    }),
    ollama: Object.freeze({
        id: 'ollama',
        label: 'Ollama',
        transport: 'ollama-local',
        supportsText: true,
        supportsVision: true,
        isLocal: true,
        supportsImageDetail: false,
    }),
});

class ProviderRegistry {
    getProvider(providerId) {
        return PROVIDERS[providerId] || null;
    }

    getExecutionOrder(config = {}, ownerRouting = {}) {
        const activeProvider = config.activeProvider;
        const keys = config.keys || {};
        const orderedIds = [];

        if (activeProvider && keys[activeProvider] && PROVIDERS[activeProvider] && !PROVIDERS[activeProvider].isLocal) {
            orderedIds.push(activeProvider);
        }

        for (const providerId of PROVIDER_ORDER) {
            if (providerId === activeProvider) continue;
            if (!keys[providerId] || !PROVIDERS[providerId]) continue;
            orderedIds.push(providerId);
        }

        if (ownerRouting.allowLocalFallback && ownerRouting.localFallbackModel) {
            orderedIds.push('ollama');
        }

        return orderedIds
            .map((providerId) => {
                const provider = PROVIDERS[providerId];
                if (!provider) return null;

                return {
                    ...provider,
                    apiKey: keys[providerId] || '',
                    localModel: providerId === 'ollama' ? ownerRouting.localFallbackModel : '',
                };
            })
            .filter(Boolean);
    }
}

module.exports = {
    ProviderRegistry,
    PROVIDERS,
    PROVIDER_ORDER,
};
