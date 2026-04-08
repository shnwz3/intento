const Store = require('electron-store');
const axios = require('axios');
const { app, safeStorage } = require('electron');
const { getCreditCheckModel } = require('./ai/ModelCatalog');

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

const SECRET_STORE_KEY = 'ai_secrets';
const SECRET_UNAVAILABLE = Symbol('secret-unavailable');

const DEFAULT_AI_CONFIG = {
    activeProvider: 'grok',
    keys: {
        openai: '',
        gemini: '',
        anthropic: '',
        grok: '',
        openrouter: '',
    },
    typing: {
        mode: 'type',
        countdownSeconds: 3,
    },
    privacy: {
        captureConsentAcceptedAt: null,
    },
};

function clampCountdown(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return DEFAULT_AI_CONFIG.typing.countdownSeconds;
    return Math.max(3, Math.min(15, Math.floor(seconds)));
}

class ConfigService {
    constructor(options = {}) {
        this.store = options.store || new Store();
        this.safeStorage = options.safeStorage || safeStorage;
        this._initialized = false;
        this._initialize();
    }

    _initialize() {
        const canObserveAppReady = typeof app?.isReady === 'function' && typeof app?.once === 'function';

        if (!canObserveAppReady || app.isReady()) {
            this._finishInitialization();
            return;
        }

        app.once('ready', () => {
            this._finishInitialization();
        });
    }

    _finishInitialization() {
        if (this._initialized) return;

        this._initialized = true;
        this._initDefaults();
        this._syncEnvKeys();
    }

    _emptyKeys() {
        return { ...DEFAULT_AI_CONFIG.keys };
    }

    _stripSecretKeys(config = {}) {
        return {
            ...config,
            keys: this._emptyKeys(),
        };
    }

    _normalizeConfig(config = {}) {
        return {
            activeProvider: String(config.activeProvider || DEFAULT_AI_CONFIG.activeProvider),
            keys: {
                ...DEFAULT_AI_CONFIG.keys,
                ...(config.keys || {}),
            },
            typing: {
                ...DEFAULT_AI_CONFIG.typing,
                ...(config.typing || {}),
                mode: 'type',
                countdownSeconds: clampCountdown(config.typing?.countdownSeconds ?? DEFAULT_AI_CONFIG.typing.countdownSeconds),
            },
            privacy: {
                ...DEFAULT_AI_CONFIG.privacy,
                ...(config.privacy || {}),
            },
        };
    }

    _getStoredConfig() {
        return this._normalizeConfig(this.store.get('ai_config'));
    }

    _decodeSecret(value) {
        if (!value || typeof value !== 'string') return '';

        if (value.startsWith('enc:')) {
            if (!this._canUseSafeStorage()) {
                return SECRET_UNAVAILABLE;
            }
            const encrypted = Buffer.from(value.slice(4), 'base64');
            return this.safeStorage?.decryptString ? this.safeStorage.decryptString(encrypted) : '';
        }

        if (value.startsWith('plain:')) {
            return Buffer.from(value.slice(6), 'base64').toString('utf8');
        }

        return value;
    }

    _encodeSecret(value) {
        if (!value) return '';

        if (this._canUseSafeStorage() && this.safeStorage?.isEncryptionAvailable?.()) {
            const encrypted = this.safeStorage.encryptString(value);
            return `enc:${encrypted.toString('base64')}`;
        }

        return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
    }

    _canUseSafeStorage() {
        return typeof app?.isReady !== 'function' || app.isReady();
    }

    _readStoredSecrets() {
        const rawSecrets = this.store.get(SECRET_STORE_KEY);
        const secrets = this._emptyKeys();
        const unavailable = new Set();

        if (!rawSecrets || typeof rawSecrets !== 'object') {
            return { secrets, unavailable, rawSecrets: {} };
        }

        for (const providerId of Object.keys(secrets)) {
            const decoded = this._decodeSecret(rawSecrets[providerId]);
            if (decoded === SECRET_UNAVAILABLE) {
                unavailable.add(providerId);
                continue;
            }
            secrets[providerId] = decoded;
        }

        return { secrets, unavailable, rawSecrets };
    }

    _writeStoredSecrets(secrets = {}, { preservedEntries = {} } = {}) {
        const serialized = {};

        for (const providerId of Object.keys(this._emptyKeys())) {
            const value = String(secrets[providerId] || '').trim();
            if (value) {
                serialized[providerId] = this._encodeSecret(value);
            } else if (preservedEntries[providerId]) {
                serialized[providerId] = preservedEntries[providerId];
            }
        }

        this.store.set(SECRET_STORE_KEY, serialized);
    }

    _resolveKeys() {
        const { secrets } = this._readStoredSecrets();
        const resolved = { ...secrets };

        for (const [envVar, providerId] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envVar];
            if (envValue) {
                resolved[providerId] = envValue;
            }
        }

        return resolved;
    }

    _buildKeyStatus(keys = this._resolveKeys()) {
        const storedSecretEntries = this.store.get(SECRET_STORE_KEY) || {};
        return Object.fromEntries(
            Object.keys(this._emptyKeys()).map((providerId) => [
                providerId,
                Boolean(
                    (keys[providerId] && keys[providerId].trim())
                    || storedSecretEntries[providerId]
                ),
            ])
        );
    }

    _storeConfig(config) {
        const sanitized = this._stripSecretKeys(this._normalizeConfig(config));
        this.store.set('ai_config', sanitized);
        return sanitized;
    }

    _migratePlaintextKeys(config) {
        const { secrets: storedSecrets, unavailable, rawSecrets } = this._readStoredSecrets();
        let changed = false;
        const preservedEntries = {};

        for (const providerId of Object.keys(this._emptyKeys())) {
            if (unavailable.has(providerId) && rawSecrets[providerId]) {
                preservedEntries[providerId] = rawSecrets[providerId];
            }

            const plaintextValue = String(config.keys?.[providerId] || '').trim();
            const hasStoredSecret = unavailable.has(providerId) || Boolean(storedSecrets[providerId]);
            if (plaintextValue && !hasStoredSecret) {
                storedSecrets[providerId] = plaintextValue;
                changed = true;
            }
        }

        if (changed) {
            this._writeStoredSecrets(storedSecrets, { preservedEntries });
        }

        return changed;
    }

    _initDefaults() {
        const normalized = this._normalizeConfig(this.store.get('ai_config'));
        this._migratePlaintextKeys(normalized);
        this._storeConfig(normalized);
    }

    _syncEnvKeys() {
        const config = this._getStoredConfig();
        let firstEnvProvider = null;

        for (const [envVar, providerId] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envVar];
            if (envValue) {
                if (!firstEnvProvider) firstEnvProvider = providerId;
            }
        }

        const { secrets: resolvedKeys, unavailable } = this._readStoredSecrets();
        for (const [envVar, providerId] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envVar];
            if (envValue) {
                resolvedKeys[providerId] = envValue;
            }
        }

        if (!resolvedKeys[config.activeProvider] && !unavailable.has(config.activeProvider) && firstEnvProvider) {
            config.activeProvider = firstEnvProvider;
            console.log(`Auto-switched to ${firstEnvProvider} (has env key)`);
            this._storeConfig(config);
        }
    }

    getConfig() {
        const config = this._getStoredConfig();
        return {
            ...config,
            keys: this._resolveKeys(),
        };
    }

    getPublicConfig() {
        const config = this._getStoredConfig();
        return {
            ...config,
            keys: this._emptyKeys(),
            keyStatus: this._buildKeyStatus(),
        };
    }

    saveConfig(config) {
        const normalized = this._normalizeConfig(config);
        this._writeStoredSecrets(normalized.keys);
        this._storeConfig(normalized);
        console.log('Config saved:', normalized.activeProvider, normalized.typing.mode);
        return {
            success: true,
            config: this.getConfig(),
            publicConfig: this.getPublicConfig(),
        };
    }

    savePublicConfig(config, { keyUpdates = {}, clearKeys = [] } = {}) {
        const currentConfig = this._getStoredConfig();
        const { secrets: storedSecrets, unavailable, rawSecrets } = this._readStoredSecrets();
        const nextKeys = {
            ...storedSecrets,
        };
        const preservedEntries = {};

        for (const providerId of Object.keys(this._emptyKeys())) {
            if (unavailable.has(providerId) && rawSecrets[providerId]) {
                preservedEntries[providerId] = rawSecrets[providerId];
            }
        }

        for (const [providerId, value] of Object.entries(keyUpdates || {})) {
            if (!Object.prototype.hasOwnProperty.call(nextKeys, providerId)) continue;
            nextKeys[providerId] = String(value || '').trim();
        }

        for (const providerId of clearKeys) {
            nextKeys[providerId] = '';
        }

        const normalized = this._normalizeConfig({
            ...currentConfig,
            ...config,
            typing: {
                ...currentConfig.typing,
                ...(config.typing || {}),
            },
            privacy: {
                ...currentConfig.privacy,
                ...(config.privacy || {}),
            },
            keys: nextKeys,
        });
        this._writeStoredSecrets(normalized.keys, { preservedEntries });
        this._storeConfig(normalized);
        console.log('Config saved:', normalized.activeProvider, normalized.typing.mode);
        return {
            success: true,
            config: this.getConfig(),
            publicConfig: this.getPublicConfig(),
        };
    }

    getTypingConfig() {
        return this.getConfig().typing;
    }

    getPrivacyConfig() {
        return this.getConfig().privacy;
    }

    hasCaptureConsent() {
        return Boolean(this.getPrivacyConfig().captureConsentAcceptedAt);
    }

    acceptCaptureConsent(acceptedAt = new Date().toISOString()) {
        const config = this._getStoredConfig();
        config.privacy.captureConsentAcceptedAt = acceptedAt;
        this._storeConfig(config);
        return { success: true, config: this.getPublicConfig() };
    }

    getProviderOverview() {
        const config = this.getConfig();
        const keyStatus = this._buildKeyStatus(config.keys);
        return Object.keys(DEFAULT_AI_CONFIG.keys).map((providerId) => {
            const hasKey = Boolean(keyStatus[providerId]);
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
                        model: getCreditCheckModel('anthropic'),
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
module.exports.ConfigService = ConfigService;
