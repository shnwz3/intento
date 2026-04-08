const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

const ResponseValidator = loadWithMocks(
    path.join(__dirname, '..', 'src', 'main', 'services', 'ai', 'ResponseValidator.js'),
    {}
);

module.exports = [
    {
        name: 'ResponseValidator rejects meta commentary for screen replies',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'screen_reply', responseFormat: 'text' },
                'The screen shows a message asking for a reply.'
            );

            assert.equal(result.success, false);
            assert.equal(result.code, 'LOW_QUALITY_RESPONSE');
        },
    },
    {
        name: 'ResponseValidator accepts natural rewrite text that contains conversational phrasing',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'rewrite_with_context', responseFormat: 'text' },
                'I see your point, and I would be happy to help with that.',
                { selectedText: 'help me respond politely' }
            );

            assert.equal(result.success, true);
            assert.equal(result.responseText, 'I see your point, and I would be happy to help with that.');
        },
    },
    {
        name: 'ResponseValidator enforces expected counts for form fill JSON',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'form_fill_values', responseFormat: 'json' },
                '["One value"]',
                { expectedItemCount: 2 }
            );

            assert.equal(result.success, false);
            assert.equal(result.code, 'INVALID_STRUCTURED_PAYLOAD');
        },
    },
    {
        name: 'ResponseValidator normalizes scalar form fill values into strings',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'form_fill_values', responseFormat: 'json' },
                '[180000, true, "Node.js"]',
                { expectedItemCount: 3 }
            );

            assert.equal(result.success, true);
            assert.deepEqual(result.parsed, ['180000', 'true', 'Node.js']);
        },
    },
    {
        name: 'ResponseValidator normalizes brain extraction sections into strict objects',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'brain_doc_extract_text', responseFormat: 'json' },
                '[{"heading":"Identity","tags":[{"name":"Full Name","value":"Feroz Rahil"}]}]'
            );

            assert.equal(result.success, true);
            assert.deepEqual(result.parsed, [
                {
                    category: 'Identity',
                    tags: [
                        { label: 'Full Name', value: 'Feroz Rahil' },
                    ],
                },
            ]);
        },
    },
    {
        name: 'ResponseValidator rejects malformed form scene payloads',
        run() {
            const validator = new ResponseValidator();
            const result = validator.validate(
                { taskKind: 'form_scene_parse', responseFormat: 'json' },
                '{"fields":[{"label":"","question":"Question","type":"text"}]}'
            );

            assert.equal(result.success, false);
            assert.equal(result.code, 'INVALID_STRUCTURED_PAYLOAD');
        },
    },
];
