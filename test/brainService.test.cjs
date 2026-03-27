const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'intento-brain-test-'));
}

function loadBrainService() {
    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'brain', 'BrainService.js'), {
        electron: { app: { getPath: () => makeTempDir() } },
    });
}

module.exports = [
    {
        name: 'BrainService recovers from corrupt brain.json by backing it up and reinitializing',
        run() {
            const BrainService = loadBrainService();
            const dir = makeTempDir();
            const brainPath = path.join(dir, 'brain.json');
            fs.writeFileSync(brainPath, '{not-valid-json');

            const service = new BrainService({
                app: { getPath: () => dir },
                brainPath,
            });

            assert.equal(service.getActiveBrain().name, 'General Brain');
            const backupFiles = fs.readdirSync(dir).filter((file) => file.includes('brain.json.parse-failure'));
            assert.ok(backupFiles.length >= 1);
        },
    },
    {
        name: 'BrainService rejects duplicate brain names and invalid tag heading references',
        run() {
            const BrainService = loadBrainService();
            const dir = makeTempDir();
            const service = new BrainService({
                app: { getPath: () => dir },
                brainPath: path.join(dir, 'brain.json'),
            });

            const created = service.createBrain('Work');
            assert.equal(created.success, true);

            const duplicate = service.createBrain('work');
            assert.equal(duplicate.success, false);
            assert.equal(duplicate.code, 'DUPLICATE_BRAIN');

            const badSave = service.saveTags([{ id: 't_1', headingId: 'missing', label: 'Role', value: 'Dev' }]);
            assert.equal(badSave.success, false);
            assert.equal(badSave.code, 'INVALID_TAG_HEADING');
        },
    },
    {
        name: 'BrainService migrates legacy category tags into headings and heading ids',
        run() {
            const BrainService = loadBrainService();
            const dir = makeTempDir();
            const brainPath = path.join(dir, 'brain.json');
            fs.writeFileSync(brainPath, JSON.stringify({
                activeBrainId: 'default',
                brains: {
                    default: {
                        id: 'default',
                        name: 'Legacy Brain',
                        rawDocText: '',
                        tags: [
                            { id: 'legacy-1', label: 'Full Name', value: 'Feroz', category: 'personal' },
                            { id: 'legacy-2', label: 'Reply Style', value: 'Concise', category: 'behavior' },
                        ],
                    },
                },
            }));

            const service = new BrainService({
                app: { getPath: () => dir },
                brainPath,
            });

            const data = service.getTagsAndHeadings();
            assert.equal(data.headings.length >= 2, true);
            assert.equal(data.tags.every((tag) => Boolean(tag.headingId)), true);
            assert.equal(service.getContext().includes('Full Name: Feroz'), true);
        },
    },
];
