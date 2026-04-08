const { parentPort, workerData } = require('worker_threads');
const { loadDocumentFromPath } = require('./documentLoader');

loadDocumentFromPath(workerData.filePath)
    .then((result) => {
        parentPort.postMessage(result);
    })
    .catch((error) => {
        parentPort.postMessage({
            success: false,
            code: error.code || 'DOCUMENT_UPLOAD_FAILED',
            message: error.message || 'Failed to load document.',
        });
    });
