const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function loadDocumentLoader(yauzlMock) {
    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'brain', 'documentLoader.js'), {
        yauzl: yauzlMock,
        'pdf-parse': async () => ({ text: 'pdf text' }),
    });
}

module.exports = [
    {
        name: 'documentLoader extracts readable text from DOCX word XML',
        run() {
            const { extractDocxText } = loadDocumentLoader({
                open(_filePath, _options, callback) {
                    callback(new Error('not used in this test'));
                },
            });

            const xml = [
                '<w:document>',
                '<w:body>',
                '<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world</w:t></w:r></w:p>',
                '<w:p><w:r><w:t>Line 2</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Again</w:t></w:r></w:p>',
                '<w:p><w:r><w:t>Fish &amp; Chips</w:t></w:r></w:p>',
                '</w:body>',
                '</w:document>',
            ].join('');

            assert.equal(
                extractDocxText(xml),
                'Hello world\n\nLine 2\nAgain\n\nFish & Chips'
            );
        },
    },
    {
        name: 'documentLoader loads DOCX files through yauzl and parses document XML',
        async run() {
            const xml = '<w:document><w:body><w:p><w:r><w:t>Intento DOCX</w:t></w:r></w:p></w:body></w:document>';
            const yauzlMock = {
                open(_filePath, _options, callback) {
                    const zipFile = new EventEmitter();
                    zipFile.close = () => {};
                    zipFile.readEntry = () => {
                        setImmediate(() => {
                            zipFile.emit('entry', { fileName: 'word/document.xml' });
                        });
                    };
                    zipFile.openReadStream = (_entry, streamCallback) => {
                        streamCallback(null, Readable.from([Buffer.from(xml)]));
                    };

                    callback(null, zipFile);
                },
            };

            const { loadDocumentFromPath } = loadDocumentLoader(yauzlMock);
            const result = await loadDocumentFromPath('C:\\temp\\profile.docx');

            assert.equal(result.success, true);
            assert.equal(result.text, 'Intento DOCX');
        },
    },
];
