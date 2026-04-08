const fs = require('fs/promises');
const path = require('path');
const { Worker } = require('worker_threads');
const pdf = require('pdf-parse');
const yauzl = require('yauzl');

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.txt', '.json', '.docx']);

function decodeXmlEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function extractDocxText(documentXml) {
    const text = documentXml
        .replace(/<w:tab[^>]*\/>/g, '\t')
        .replace(/<w:(?:br|cr)[^>]*\/>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<\/w:p>/g, '\n\n')
        .replace(/<[^>]+>/g, '');

    return decodeXmlEntities(text)
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function openZip(yauzlModule, filePath) {
    return new Promise((resolve, reject) => {
        yauzlModule.open(filePath, { lazyEntries: true }, (error, zipFile) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(zipFile);
        });
    });
}

function readZipEntryText(zipFile, entryName) {
    return new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            zipFile.removeListener('entry', handleEntry);
            zipFile.removeListener('error', handleError);
            zipFile.removeListener('end', handleEnd);
        };

        const finish = (callback) => (value) => {
            if (settled) return;
            settled = true;
            cleanup();

            try {
                zipFile.close();
            } catch (_error) {
                // Ignore close errors after the result is settled.
            }

            callback(value);
        };

        const handleError = finish((error) => {
            reject(error);
        });

        const handleEnd = finish(() => {
            const error = new Error(`${entryName} was not found in the DOCX file.`);
            error.code = 'DOCUMENT_UPLOAD_FAILED';
            reject(error);
        });

        const handleEntry = (entry) => {
            if (entry.fileName !== entryName) {
                zipFile.readEntry();
                return;
            }

            zipFile.openReadStream(entry, (error, stream) => {
                if (error) {
                    handleError(error);
                    return;
                }

                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('end', finish(() => {
                    resolve(Buffer.concat(chunks).toString('utf8'));
                }));
                stream.on('error', handleError);
            });
        };

        zipFile.on('entry', handleEntry);
        zipFile.on('error', handleError);
        zipFile.on('end', handleEnd);
        zipFile.readEntry();
    });
}

async function loadDocumentFromPath(filePath, options = {}) {
    const fsModule = options.fsModule || fs;
    const pathModule = options.pathModule || path;
    const pdfParser = options.pdfParser || pdf;
    const yauzlModule = options.yauzlModule || yauzl;
    const ext = pathModule.extname(filePath).toLowerCase();

    if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)) {
        const error = new Error('Please upload a PDF, DOCX, TXT, or JSON file.');
        error.code = 'UNSUPPORTED_DOCUMENT_TYPE';
        throw error;
    }

    if (ext === '.pdf') {
        const dataBuffer = await fsModule.readFile(filePath);
        const data = await pdfParser(dataBuffer);
        return {
            success: true,
            text: data.text,
        };
    }

    if (ext === '.docx') {
        const zipFile = await openZip(yauzlModule, filePath);
        const documentXml = await readZipEntryText(zipFile, 'word/document.xml');
        return {
            success: true,
            text: extractDocxText(documentXml),
        };
    }

    return {
        success: true,
        text: await fsModule.readFile(filePath, 'utf8'),
    };
}

function createDocumentLoader(options = {}) {
    const WorkerClass = options.WorkerClass || Worker;
    const pathModule = options.pathModule || path;
    const workerPath = options.workerPath || pathModule.join(__dirname, 'documentLoader.worker.js');

    return function loadDocument(filePath) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const worker = new WorkerClass(workerPath, {
                workerData: { filePath },
            });

            const finish = (callback) => (value) => {
                if (settled) return;
                settled = true;
                callback(value);

                if (typeof worker.terminate === 'function') {
                    Promise.resolve(worker.terminate()).catch(() => {});
                }
            };

            worker.once('message', finish((message) => {
                if (message?.success) {
                    resolve(message);
                    return;
                }

                const error = new Error(message?.message || 'Failed to load document.');
                if (message?.code) {
                    error.code = message.code;
                }
                reject(error);
            }));

            worker.once('error', finish((error) => {
                reject(error);
            }));

            worker.once('exit', (code) => {
                if (!settled && code !== 0) {
                    settled = true;
                    reject(new Error(`Document loader exited with code ${code}.`));
                }
            });
        });
    };
}

module.exports = {
    SUPPORTED_DOCUMENT_EXTENSIONS,
    createDocumentLoader,
    extractDocxText,
    loadDocumentFromPath,
};
