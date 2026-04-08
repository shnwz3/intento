const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

module.exports = [
    {
        name: 'settings handlers return public config and broadcast redacted updates',
        async run() {
            const handlers = new Map();
            const sent = [];
            let publicSaveCalled = false;
            let legacySaveCalled = false;
            let refreshCalled = false;

            const publicConfig = {
                activeProvider: 'grok',
                keys: {
                    grok: '',
                    openai: '',
                    gemini: '',
                    anthropic: '',
                    openrouter: '',
                },
                keyStatus: {
                    grok: true,
                },
                typing: {
                    mode: 'type',
                    countdownSeconds: 5,
                },
            };

            const { registerSettingsHandlers } = loadWithMocks(
                path.join(__dirname, '..', 'src', 'main', 'ipc', 'settings.handlers.js'),
                {
                    electron: {
                        ipcMain: {
                            handle(name, callback) {
                                handlers.set(name, callback);
                            },
                        },
                        BrowserWindow: {
                            getAllWindows() {
                                return [{
                                    webContents: {
                                        send(channel, payload) {
                                            sent.push([channel, payload]);
                                        },
                                    },
                                }];
                            },
                        },
                        shell: {
                            async openExternal() {},
                        },
                    },
                    '../services/ConfigService': {
                        getPublicConfig() {
                            return publicConfig;
                        },
                        savePublicConfig() {
                            publicSaveCalled = true;
                            return {
                                success: true,
                                config: {
                                    activeProvider: 'openai',
                                    keys: publicConfig.keys,
                                    keyStatus: {
                                        ...publicConfig.keyStatus,
                                        openai: true,
                                    },
                                    typing: {
                                        mode: 'paste',
                                        countdownSeconds: 3,
                                    },
                                },
                                publicConfig: {
                                    activeProvider: 'openai',
                                    keys: publicConfig.keys,
                                    keyStatus: {
                                        ...publicConfig.keyStatus,
                                        openai: true,
                                    },
                                    typing: {
                                        mode: 'paste',
                                        countdownSeconds: 3,
                                    },
                                },
                            };
                        },
                        saveConfig() {
                            legacySaveCalled = true;
                            return {
                                success: true,
                                publicConfig,
                            };
                        },
                        getProviderOverview() {
                            return [];
                        },
                        getCredits() {
                            return {};
                        },
                    },
                    '../services/ServiceManager': {
                        get(name) {
                            assert.equal(name, 'VisionService');
                            return {
                                refreshProviders() {
                                    refreshCalled = true;
                                },
                            };
                        },
                    },
                }
            );

            registerSettingsHandlers();

            const getConfig = handlers.get('getAIConfig');
            const saveConfig = handlers.get('saveAIConfig');

            assert.deepEqual(await getConfig(), publicConfig);

            const saveResult = await saveConfig(null, {
                config: {
                    activeProvider: 'openai',
                    typing: { mode: 'paste', countdownSeconds: 3 },
                },
                keyUpdates: { openai: 'new-secret' },
                clearKeys: [],
            });

            assert.equal(publicSaveCalled, true);
            assert.equal(legacySaveCalled, false);
            assert.equal(refreshCalled, true);
            assert.equal(saveResult.config.keys.openai, '');
            assert.equal(saveResult.config.keyStatus.openai, true);
            assert.deepEqual(sent, [['config:update', saveResult.config]]);
        },
    },
];
