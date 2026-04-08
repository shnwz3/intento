const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

class StoreMock {
    constructor(initialData = {}) {
        this.data = { ...initialData };
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
    }
}

const safeStorageMock = {
    isEncryptionAvailable() {
        return true;
    },
    encryptString(value) {
        return Buffer.from(`enc:${value}`, 'utf8');
    },
    decryptString(buffer) {
        return buffer.toString('utf8').replace(/^enc:/, '');
    },
};

function loadConfigServiceModule(electronOverrides = {}) {
    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'ConfigService.js'), {
        electron: {
            safeStorage: safeStorageMock,
            ...electronOverrides,
        },
        'electron-store': StoreMock,
        axios: {
            get: async () => ({ status: 200 }),
            post: async () => ({ status: 200 }),
        },
    });
}

module.exports = [
    {
        name: 'ConfigService persists one-time capture consent in privacy settings',
        run() {
            const { ConfigService } = loadConfigServiceModule();
            const store = new StoreMock();
            const service = new ConfigService({
                store,
                safeStorage: safeStorageMock,
            });

            assert.equal(service.hasCaptureConsent(), false);

            const saveResult = service.acceptCaptureConsent('2026-03-27T18:00:00.000Z');

            assert.equal(saveResult.success, true);
            assert.equal(service.hasCaptureConsent(), true);
            assert.equal(
                service.getPrivacyConfig().captureConsentAcceptedAt,
                '2026-03-27T18:00:00.000Z'
            );
        },
    },
    {
        name: 'ConfigService stores API keys outside public config and preserves them across public saves',
        run() {
            const { ConfigService } = loadConfigServiceModule();
            const store = new StoreMock();
            const service = new ConfigService({
                store,
                safeStorage: safeStorageMock,
            });

            const firstSave = service.savePublicConfig(
                {
                    activeProvider: 'openai',
                    typing: { mode: 'paste', countdownSeconds: 2 },
                },
                {
                    keyUpdates: { openai: 'super-secret-key' },
                }
            );

            assert.equal(firstSave.success, true);
            assert.equal(service.getConfig().keys.openai, 'super-secret-key');
            assert.equal(service.getPublicConfig().keys.openai, '');
            assert.equal(service.getPublicConfig().keyStatus.openai, true);
            assert.equal(store.data.ai_config.keys.openai, '');
            assert.notEqual(store.data.ai_secrets.openai, 'super-secret-key');

            service.savePublicConfig({
                activeProvider: 'openai',
                typing: { mode: 'clipboard_only', countdownSeconds: 1 },
            });

            assert.equal(service.getConfig().keys.openai, 'super-secret-key');
            assert.equal(service.getTypingConfig().mode, 'type');
            assert.equal(service.getTypingConfig().countdownSeconds, 3);
        },
    },
    {
        name: 'ConfigService defers safeStorage-backed initialization until Electron is ready',
        run() {
            let readyCallback = null;
            let decryptCalls = 0;

            const { ConfigService } = loadConfigServiceModule({
                app: {
                    isReady() {
                        return false;
                    },
                    once(eventName, callback) {
                        assert.equal(eventName, 'ready');
                        readyCallback = callback;
                    },
                },
                safeStorage: {
                    ...safeStorageMock,
                    decryptString(buffer) {
                        decryptCalls += 1;
                        return safeStorageMock.decryptString(buffer);
                    },
                },
            });

            const store = new StoreMock({
                ai_secrets: {
                    openai: `enc:${Buffer.from('enc:stored-key', 'utf8').toString('base64')}`,
                },
            });

            new ConfigService({
                store,
                safeStorage: {
                    ...safeStorageMock,
                    decryptString(buffer) {
                        decryptCalls += 1;
                        return safeStorageMock.decryptString(buffer);
                    },
                },
            });

            assert.equal(decryptCalls, 0);
            assert.equal(typeof readyCallback, 'function');
        },
    },
    {
        name: 'ConfigService migrates legacy plaintext keys and can clear stored secrets',
        run() {
            const { ConfigService } = loadConfigServiceModule();
            const store = new StoreMock({
                ai_config: {
                    activeProvider: 'grok',
                    keys: {
                        grok: 'legacy-grok-key',
                    },
                },
            });
            const service = new ConfigService({
                store,
                safeStorage: safeStorageMock,
            });

            assert.equal(service.getConfig().keys.grok, 'legacy-grok-key');
            assert.equal(store.data.ai_config.keys.grok, '');
            assert.notEqual(store.data.ai_secrets.grok, 'legacy-grok-key');

            service.savePublicConfig({}, { clearKeys: ['grok'] });

            assert.equal(service.getConfig().keys.grok, '');
            assert.equal(service.getPublicConfig().keyStatus.grok, false);
        },
    },
];
