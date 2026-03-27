const assert = require('node:assert/strict');
const path = require('node:path');

const FormAutomationService = require(path.join(
    __dirname,
    '..',
    'src',
    'main',
    'services',
    'formfill',
    'FormAutomationService.js'
));

function createScreenshotService() {
    return {
        async capture() {
            return {
                success: true,
                data: {
                    base64: 'image-data',
                    width: 1200,
                    height: 900,
                },
            };
        },
    };
}

module.exports = [
    {
        name: 'FormAutomationService fills current field and advances with tab until submit is visible',
        async run() {
            const calls = [];
            const states = [
                {
                    isForm: true,
                    fields: [
                        { label: 'Full Name', question: 'What is your full name?', type: 'text' },
                        { label: 'Current Role', question: 'What is your current role?', type: 'dropdown' },
                    ],
                    submitVisible: false,
                    submitLabel: null,
                },
                {
                    isForm: true,
                    fields: [
                        { label: 'Project summary', question: 'Describe a recent project', type: 'textarea' },
                    ],
                    submitVisible: true,
                    submitLabel: 'Submit',
                },
            ];

            const formFiller = {
                async inspectFormState() {
                    return states.shift();
                },
                async generateFillValues(fields) {
                    return fields.map((field) => ({
                        ...field,
                        strategy: field.type === 'dropdown' ? 'dropdown' : 'text',
                        value: `${field.label} value`,
                    }));
                },
            };

            const typing = {
                cancel() {},
                async fillFieldValue(value) {
                    calls.push(['type', value]);
                    return { success: true, code: 'TYPE_OK' };
                },
                async pressKey(key) {
                    calls.push(['key', key]);
                },
            };

            const service = new FormAutomationService(
                createScreenshotService(),
                formFiller,
                typing,
                { sleep: async () => {} }
            );

            const result = await service.run();

            assert.equal(result.success, true);
            assert.equal(result.stoppedReason, 'submit_visible');
            assert.equal(result.fieldCount, 3);
            assert.deepEqual(calls, [
                ['type', 'Full Name value'],
                ['key', 'tab'],
                ['type', 'Current Role value'],
                ['key', 'enter'],
                ['key', 'tab'],
                ['type', 'Project summary value'],
            ]);
        },
    },
    {
        name: 'FormAutomationService types manual date values without forcing dropdown enter behavior',
        async run() {
            const fillCalls = [];
            const keyCalls = [];
            const formFiller = {
                async inspectFormState() {
                    return {
                        isForm: true,
                        fields: [
                            { label: 'Date of Birth', question: 'What is your date of birth?', type: 'date' },
                        ],
                        submitVisible: true,
                        submitLabel: 'Submit',
                    };
                },
                async generateFillValues() {
                    return [
                        {
                            label: 'Date of Birth',
                            question: 'What is your date of birth?',
                            type: 'date',
                            strategy: 'text',
                            value: '05/12/1998',
                            inputMode: 'type',
                        },
                    ];
                },
            };

            const typing = {
                cancel() {},
                async fillFieldValue(value, options) {
                    fillCalls.push([value, options]);
                    return { success: true, code: 'TYPE_OK' };
                },
                async pressKey(key) {
                    keyCalls.push(key);
                },
            };

            const service = new FormAutomationService(
                createScreenshotService(),
                formFiller,
                typing,
                { sleep: async () => {} }
            );

            const result = await service.run();

            assert.equal(result.success, true);
            assert.equal(result.stoppedReason, 'submit_visible');
            assert.deepEqual(fillCalls, [
                ['05/12/1998', { mode: 'type' }],
            ]);
            assert.deepEqual(keyCalls, []);
        },
    },
    {
        name: 'FormAutomationService requires the user to focus the first field before start',
        async run() {
            const service = new FormAutomationService(
                createScreenshotService(),
                {
                    async inspectFormState() {
                        return {
                            isForm: false,
                            fields: [{ label: 'Email', question: 'Email', type: 'email' }],
                            submitVisible: false,
                            submitLabel: null,
                        };
                    },
                    async generateFillValues() {
                        return [];
                    },
                },
                {
                    cancel() {},
                    async fillFieldValue() {
                        return { success: true };
                    },
                    async pressKey() {},
                },
                { sleep: async () => {} }
            );

            await assert.rejects(
                () => service.run(),
                /focus the first text input before starting/i
            );
        },
    },
    {
        name: 'FormAutomationService avoids re-filling the same field when a form section repeats',
        async run() {
            const calls = [];
            const repeatedState = {
                isForm: true,
                fields: [
                    { label: 'Email', question: 'What is your email?', type: 'email' },
                ],
                submitVisible: false,
                submitLabel: null,
            };

            const service = new FormAutomationService(
                createScreenshotService(),
                {
                    async inspectFormState() {
                        return repeatedState;
                    },
                    async generateFillValues(fields) {
                        return fields.map((field) => ({
                            ...field,
                            strategy: 'text',
                            value: 'feroz@example.com',
                        }));
                    },
                },
                {
                    cancel() {},
                    async fillFieldValue(value) {
                        calls.push(['type', value]);
                        return { success: true, code: 'TYPE_OK' };
                    },
                    async pressKey(key) {
                        calls.push(['key', key]);
                    },
                },
                { sleep: async () => {}, maxScrollRecoveries: 0 }
            );

            const result = await service.run();

            assert.equal(result.success, true);
            assert.equal(result.stoppedReason, 'no_more_inputs');
            assert.equal(result.fieldCount, 1);
            assert.deepEqual(calls, [
                ['type', 'feroz@example.com'],
                ['key', 'tab'],
                ['key', 'tab'],
            ]);
        },
    },
    {
        name: 'FormAutomationService scrolls to recover when no new visible fields are detected',
        async run() {
            const calls = [];
            const states = [
                {
                    isForm: true,
                    fields: [
                        { label: 'Full Name', question: 'What is your full name?', type: 'text' },
                    ],
                    submitVisible: false,
                    submitLabel: null,
                },
                {
                    isForm: true,
                    fields: [],
                    submitVisible: false,
                    submitLabel: null,
                },
                {
                    isForm: true,
                    fields: [
                        { label: 'Work Authorization', question: 'Are you legally authorized to work?', type: 'dropdown' },
                    ],
                    submitVisible: true,
                    submitLabel: 'Submit',
                },
            ];

            const service = new FormAutomationService(
                createScreenshotService(),
                {
                    async inspectFormState() {
                        return states.shift();
                    },
                    async generateFillValues(fields) {
                        return fields.map((field) => ({
                            ...field,
                            strategy: field.type === 'dropdown' ? 'dropdown' : 'text',
                            value: field.type === 'dropdown' ? 'Yes' : 'Feroz Rahil',
                            source: 'brain',
                        }));
                    },
                },
                {
                    cancel() {},
                    async fillFieldValue(value) {
                        calls.push(['type', value]);
                        return { success: true, code: 'TYPE_OK' };
                    },
                    async selectDropdownValue(value) {
                        calls.push(['select', value]);
                        return { success: true, code: 'SELECT_OK' };
                    },
                    async pressKey(key) {
                        calls.push(['key', key]);
                    },
                    async scrollVertical() {
                        calls.push(['scroll']);
                    },
                },
                { sleep: async () => {}, maxScrollRecoveries: 1 }
            );

            const result = await service.run();

            assert.equal(result.success, true);
            assert.equal(result.stoppedReason, 'submit_visible');
            assert.equal(result.scrollRecoveryCount, 1);
            assert.deepEqual(calls, [
                ['type', 'Feroz Rahil'],
                ['key', 'tab'],
                ['scroll'],
                ['select', 'Yes'],
            ]);
        },
    },
];
