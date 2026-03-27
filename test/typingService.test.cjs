const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function loadTypingService(robotMock) {
    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'typing', 'TypingService.js'), {
        '@jitsi/robotjs': robotMock,
        './ClipboardManager': class ClipboardManagerMock {
            constructor() {
                this.value = '';
            }

            read() {
                return this.value;
            }

            write(value) {
                this.value = value;
            }
        },
        '../ConfigService': {
            getTypingConfig() {
                return { mode: 'type' };
            },
        },
    });
}

function createClipboard(initialValue = '') {
    return {
        value: initialValue,
        read() {
            return this.value;
        },
        write(value) {
            this.value = value;
        },
    };
}

module.exports = [
    {
        name: 'TypingService.pressKey omits modifier when none is provided',
        async run() {
            const calls = [];
            const robotMock = {
                keyTap(...args) {
                    calls.push(args);
                },
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({ robot: robotMock, sleep: async () => {} });

            await service.pressKey('tab');
            await service.pressKey('v', 'control');

            assert.deepEqual(calls, [
                ['tab'],
                ['v', 'control'],
            ]);
        },
    },
    {
        name: 'TypingService.fillFieldValue forwards the requested mode',
        async run() {
            const robotMock = {
                keyTap() {},
                scrollMouse() {},
                typeString() {},
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({ robot: robotMock, sleep: async () => {} });
            const calls = [];

            service.typeAtCursor = async (text, countdown, options) => {
                calls.push([text, countdown, options]);
                return { success: true, code: 'TYPE_OK' };
            };

            await service.fillFieldValue('05/12/1998', { mode: 'type' });
            await service.fillFieldValue('feroz@example.com');

            assert.deepEqual(calls, [
                ['05/12/1998', 0, { mode: 'type' }],
                ['feroz@example.com', 0, { mode: 'paste' }],
            ]);
        },
    },
    {
        name: 'TypingService.scrollVertical uses robot mouse wheel scrolling',
        async run() {
            const calls = [];
            const robotMock = {
                keyTap() {},
                typeString() {},
                scrollMouse(...args) {
                    calls.push(args);
                },
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({ robot: robotMock, sleep: async () => {} });

            await service.scrollVertical();
            await service.scrollVertical(-240);

            assert.deepEqual(calls, [
                [0, -720],
                [0, -240],
            ]);
        },
    },
    {
        name: 'TypingService.selectDropdownValue uses keyboard selection flow',
        async run() {
            const calls = [];
            const robotMock = {
                keyTap(...args) {
                    calls.push(['keyTap', ...args]);
                },
                typeString(value) {
                    calls.push(['typeString', value]);
                },
                scrollMouse() {},
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({ robot: robotMock, sleep: async () => {} });

            const result = await service.selectDropdownValue('React');

            assert.equal(result.success, true);
            assert.deepEqual(calls, [
                ['keyTap', 'space'],
                ['typeString', 'R'],
                ['typeString', 'e'],
                ['typeString', 'a'],
                ['typeString', 'c'],
                ['typeString', 't'],
                ['keyTap', 'enter'],
            ]);
        },
    },
    {
        name: 'TypingService preserves clipboard contents for type and paste modes',
        async run() {
            const clipboard = createClipboard('original clipboard');
            const robotMock = {
                keyTap() {},
                typeString() {},
                scrollMouse() {},
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({
                robot: robotMock,
                clipboard,
                sleep: async () => {},
            });

            const typed = await service.typeAtCursor('Hello', 0, { mode: 'type' });
            assert.equal(typed.success, true);
            assert.equal(clipboard.read(), 'original clipboard');

            const pasted = await service.typeAtCursor('World', 0, { mode: 'paste' });
            assert.equal(pasted.success, true);
            assert.equal(clipboard.read(), 'original clipboard');
        },
    },
    {
        name: 'TypingService clipboard_only mode leaves the response on the clipboard',
        async run() {
            const clipboard = createClipboard('existing');
            const robotMock = {
                keyTap() {},
                typeString() {},
                scrollMouse() {},
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({
                robot: robotMock,
                clipboard,
                sleep: async () => {},
            });

            const result = await service.typeAtCursor('Copy me', 0, { mode: 'clipboard_only' });

            assert.equal(result.success, true);
            assert.equal(clipboard.read(), 'Copy me');
        },
    },
    {
        name: 'TypingService.getSelectedText restores an empty clipboard after reading selection',
        async run() {
            const clipboard = createClipboard('');
            const robotMock = {
                keyTap(key, modifier) {
                    if (key === 'c' && modifier === 'control') {
                        clipboard.write('selected text');
                    }
                },
                typeString() {},
                scrollMouse() {},
            };

            const TypingService = loadTypingService(robotMock);
            const service = new TypingService({
                robot: robotMock,
                clipboard,
                sleep: async () => {},
            });

            const selected = await service.getSelectedText();

            assert.equal(selected, 'selected text');
            assert.equal(clipboard.read(), '');
        },
    },
];
