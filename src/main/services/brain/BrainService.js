const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const {
    SUPPORTED_DOCUMENT_EXTENSIONS,
    createDocumentLoader,
} = require('./documentLoader');

const PERSONALITY_TAGS = new Set(['Communication Tone', 'Personality Traits', 'Reply Style']);

class BrainService {
    constructor(options = {}) {
        this.fs = options.fs || fs;
        this.path = options.path || path;
        this.app = options.app || app;
        this.brainPath = options.brainPath || this.path.join(this.app.getPath('userData'), 'brain.json');
        this.documentLoader = options.documentLoader || createDocumentLoader();
        this.brains = {};
        this.activeBrainId = 'default';
        this.activeAgentId = 'no_agent';
        this.lastPersistenceIssue = null;
        this._loadFromDisk();
    }

    _success(data = {}) {
        return { success: true, ...data };
    }

    _failure(code, message, extra = {}) {
        return { success: false, code, message, error: message, ...extra };
    }

    _createId(prefix) {
        return `${prefix}_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    }

    _trimmedName(name, fallback) {
        const trimmed = String(name || '').trim();
        return trimmed || fallback;
    }

    _normalizeSection(label, section) {
        if (section === 'identity' || section === 'personality') return section;

        const lower = String(label || '').toLowerCase();
        if (['persona', 'personality', 'behavior', 'style', 'context'].some((token) => lower.includes(token))) {
            return 'personality';
        }
        return 'identity';
    }

    _normalizeHeading(rawHeading, fallbackLabel = 'Untitled Heading') {
        const label = this._trimmedName(rawHeading?.label, fallbackLabel);
        return {
            id: rawHeading?.id || this._createId('h'),
            label,
            section: this._normalizeSection(label, rawHeading?.section),
        };
    }

    _normalizeTag(rawTag, headings) {
        const label = this._trimmedName(rawTag?.label, '');
        if (!label) return null;

        let headingId = rawTag?.headingId;
        if (!headingId && rawTag?.category) {
            const matchingHeading = headings.find((heading) =>
                heading.label.toLowerCase() === String(rawTag.category).toLowerCase()
            );
            headingId = matchingHeading?.id;
        }

        if (!headingId) {
            const fallbackHeading = headings[0];
            headingId = fallbackHeading?.id || null;
        }

        return {
            id: rawTag?.id || this._createId('t'),
            headingId,
            label,
            value: String(rawTag?.value || ''),
        };
    }

    _migrateLegacyBrain(brain) {
        const headings = [];
        const headingMap = new Map();
        const legacyDefinitions = {
            personal: { label: 'Identity', section: 'identity' },
            work: { label: 'Profession', section: 'identity' },
            behavior: { label: 'Persona', section: 'personality' },
            persona: { label: 'Persona', section: 'personality' },
            context: { label: 'Context', section: 'personality' },
        };

        for (const tag of brain.tags || []) {
            const legacy = legacyDefinitions[tag.category];
            if (!legacy) continue;
            if (!headingMap.has(tag.category)) {
                const heading = this._normalizeHeading({
                    id: this._createId('h'),
                    label: legacy.label,
                    section: legacy.section,
                });
                headingMap.set(tag.category, heading);
                headings.push(heading);
            }
        }

        const normalizedTags = (brain.tags || [])
            .map((tag) => {
                const mappedHeading = headingMap.get(tag.category);
                return this._normalizeTag({ ...tag, headingId: mappedHeading?.id }, headings);
            })
            .filter(Boolean);

        return {
            ...brain,
            headings,
            tags: normalizedTags,
        };
    }

    _normalizeBrainRecord(brain, fallbackId) {
        const baseBrain = {
            id: brain?.id || fallbackId || this._createId('brain'),
            name: this._trimmedName(brain?.name, 'Untitled Brain'),
            rawDocText: typeof brain?.rawDocText === 'string' ? brain.rawDocText : '',
            headings: Array.isArray(brain?.headings) ? brain.headings : [],
            tags: Array.isArray(brain?.tags) ? brain.tags : [],
        };

        let normalized = baseBrain;
        const hasLegacyCategories = normalized.tags.some((tag) => tag?.category);
        if (normalized.headings.length === 0 && hasLegacyCategories) {
            normalized = this._migrateLegacyBrain(normalized);
        }

        const headingMap = new Map();
        const headings = [];
        for (const rawHeading of normalized.headings || []) {
            const heading = this._normalizeHeading(rawHeading);
            if (headingMap.has(heading.id)) continue;
            headingMap.set(heading.id, heading);
            headings.push(heading);
        }

        const tags = [];
        for (const rawTag of normalized.tags || []) {
            const tag = this._normalizeTag(rawTag, headings);
            if (!tag) continue;

            if (!headingMap.has(tag.headingId)) {
                const inferredHeading = PERSONALITY_TAGS.has(tag.label)
                    ? this._normalizeHeading({ label: 'Persona', section: 'personality' })
                    : this._normalizeHeading({ label: 'Identity', section: 'identity' });
                headingMap.set(inferredHeading.id, inferredHeading);
                headings.push(inferredHeading);
                tag.headingId = inferredHeading.id;
            }

            tags.push(tag);
        }

        return {
            id: normalized.id,
            name: normalized.name,
            rawDocText: normalized.rawDocText,
            headings,
            tags,
        };
    }

    _backupCorruptFile(reason = 'corrupt') {
        try {
            if (!this.fs.existsSync(this.brainPath)) return;
            const backupPath = `${this.brainPath}.${reason}.${Date.now()}.bak`;
            this.fs.copyFileSync(this.brainPath, backupPath);
            this.lastPersistenceIssue = `Recovered from a damaged brain file. Backup: ${this.path.basename(backupPath)}`;
        } catch (backupError) {
            console.error('Failed to back up brain.json:', backupError.message);
        }
    }

    _loadFromDisk() {
        try {
            if (!this.fs.existsSync(this.brainPath)) {
                this._createInitialBrain();
                return;
            }

            const raw = this.fs.readFileSync(this.brainPath, 'utf8');
            const data = JSON.parse(raw);

            const rawBrains = data?.brains;
            if (!rawBrains || typeof rawBrains !== 'object') {
                if (Array.isArray(data?.tags) || data?.tags) {
                    this.brains = {
                        default: this._normalizeBrainRecord({
                            id: 'default',
                            name: 'General Brain',
                            tags: data.tags || [],
                            rawDocText: data.rawDocText || '',
                        }, 'default'),
                    };
                    this.activeBrainId = 'default';
                    this.activeAgentId = data?.activeAgentId || 'no_agent';
                    this._saveToDisk();
                    return;
                }

                this._backupCorruptFile('invalid-shape');
                this._createInitialBrain();
                return;
            }

            this.brains = Object.fromEntries(
                Object.entries(rawBrains).map(([id, brain]) => [id, this._normalizeBrainRecord(brain, id)])
            );

            if (Object.keys(this.brains).length === 0) {
                console.log('Brains loaded: 0 profiles');
            }

            this.activeBrainId = this.brains[data.activeBrainId] ? data.activeBrainId : (Object.keys(this.brains)[0] || null);
            this.activeAgentId = data?.activeAgentId || 'no_agent';

            this._repairData();
            this._saveToDisk();
            console.log(`Brains loaded: ${Object.keys(this.brains).length} profiles`);
        } catch (error) {
            console.error('Failed to load brain.json:', error.message);
            this._backupCorruptFile('parse-failure');
            this._createInitialBrain();
        }
    }

    _repairData() {
        Object.values(this.brains).forEach((brain) => {
            brain.headings = brain.headings.map((heading) =>
                this._normalizeHeading(heading, 'Untitled Heading')
            );

            let personaHeading = brain.headings.find(
                (heading) => heading.section === 'personality' && heading.label.toLowerCase() === 'persona'
            );

            brain.tags = brain.tags
                .map((tag) => {
                    if (!PERSONALITY_TAGS.has(tag.label)) return tag;

                    if (!personaHeading) {
                        personaHeading = this._normalizeHeading({ label: 'Persona', section: 'personality' });
                        brain.headings.push(personaHeading);
                    }

                    return { ...tag, headingId: personaHeading.id };
                })
                .filter(Boolean);
        });
    }

    _createInitialBrain() {
        this.activeBrainId = 'default';
        this.activeAgentId = 'no_agent';
        this.brains = {
            default: {
                id: 'default',
                name: 'General Brain',
                headings: [],
                tags: [],
                rawDocText: '',
            },
        };
        this._saveToDisk();
        console.log('Initialized with default brain profile');
    }

    _saveToDisk() {
        try {
            const data = {
                activeBrainId: this.activeBrainId,
                activeAgentId: this.activeAgentId,
                brains: this.brains,
            };
            this.fs.writeFileSync(this.brainPath, JSON.stringify(data, null, 2));
            this.lastPersistenceIssue = null;
            return this._success();
        } catch (error) {
            console.error('Failed to save brain.json:', error.message);
            this.lastPersistenceIssue = error.message;
            return this._failure('SAVE_FAILED', error.message || 'Failed to save brain data.');
        }
    }

    listBrains() {
        return Object.values(this.brains).map((brain) => ({
            id: brain.id,
            name: brain.name,
            isActive: brain.id === this.activeBrainId,
            tagCount: brain.tags.length,
            filledCount: brain.tags.filter((tag) => tag.value && tag.value.trim() !== '').length,
        }));
    }

    createBrain(name) {
        const trimmedName = this._trimmedName(name, `Brain ${Object.keys(this.brains).length + 1}`);
        const duplicate = Object.values(this.brains).find(
            (brain) => brain.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) {
            return this._failure('DUPLICATE_BRAIN', 'A brain with that name already exists.');
        }

        const id = this._createId('brain');
        this.brains[id] = {
            id,
            name: trimmedName,
            headings: [],
            tags: [],
            rawDocText: '',
        };
        this.activeBrainId = id;
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ brain: this.brains[id] });
    }

    setActiveBrain(id) {
        if (!this.brains[id]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');
        this.activeBrainId = id;
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ activeBrainId: id });
    }

    renameBrain(id, newName) {
        const targetId = id || this.activeBrainId;
        if (!this.brains[targetId]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');

        const trimmedName = this._trimmedName(newName, '');
        if (!trimmedName) return this._failure('INVALID_BRAIN_NAME', 'Brain name cannot be empty.');

        const duplicate = Object.values(this.brains).find(
            (brain) => brain.id !== targetId && brain.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) return this._failure('DUPLICATE_BRAIN', 'A brain with that name already exists.');

        this.brains[targetId].name = trimmedName;
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success();
    }

    deleteBrain(id) {
        if (!this.brains[id]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');

        delete this.brains[id];
        const remainingBrains = Object.keys(this.brains);
        
        if (this.activeBrainId === id || !this.brains[this.activeBrainId]) {
            this.activeBrainId = remainingBrains.length > 0 ? remainingBrains[0] : null;
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ activeBrainId: this.activeBrainId });
    }

    getActiveBrain() {
        return this.brains[this.activeBrainId] || null;
    }

    getActiveAgentId() {
        return this.activeAgentId;
    }

    setActiveAgent(agentId) {
        this.activeAgentId = agentId || 'no_agent';
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ agentId: this.activeAgentId });
    }

    addHeading(label, section = 'identity') {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const trimmedLabel = this._trimmedName(label, '');
        if (!trimmedLabel) return this._failure('INVALID_HEADING_LABEL', 'Heading label cannot be empty.');

        const duplicate = active.headings.find(
            (heading) => heading.label.toLowerCase() === trimmedLabel.toLowerCase()
        );
        if (duplicate) return this._failure('DUPLICATE_HEADING', 'A heading with that label already exists.');

        const newHeading = this._normalizeHeading({
            id: this._createId('h'),
            label: trimmedLabel,
            section,
        });
        active.headings.push(newHeading);
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ heading: newHeading });
    }

    updateHeading(id, label) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const heading = active.headings.find((item) => item.id === id);
        if (!heading) return this._failure('HEADING_NOT_FOUND', 'Heading not found.');

        const trimmedLabel = this._trimmedName(label, '');
        if (!trimmedLabel) return this._failure('INVALID_HEADING_LABEL', 'Heading label cannot be empty.');

        heading.label = trimmedLabel;
        heading.section = this._normalizeSection(trimmedLabel, heading.section);
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success();
    }

    deleteHeading(id) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const exists = active.headings.some((heading) => heading.id === id);
        if (!exists) return this._failure('HEADING_NOT_FOUND', 'Heading not found.');

        active.headings = active.headings.filter((heading) => heading.id !== id);
        active.tags = active.tags.filter((tag) => tag.headingId !== id);
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success();
    }

    saveTags(tags) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');
        if (!Array.isArray(tags)) return this._failure('INVALID_TAGS', 'Tags payload must be an array.');

        const headingIds = new Set(active.headings.map((heading) => heading.id));
        const normalizedTags = [];
        for (const rawTag of tags) {
            const tag = this._normalizeTag(rawTag, active.headings);
            if (!tag) {
                return this._failure('INVALID_TAGS', 'Every tag must have a label.');
            }
            if (!headingIds.has(tag.headingId)) {
                return this._failure('INVALID_TAG_HEADING', 'One or more tags reference a missing heading.');
            }
            normalizedTags.push(tag);
        }

        active.tags = normalizedTags;
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ count: normalizedTags.length });
    }

    getTagsAndHeadings() {
        const active = this.getActiveBrain();
        if (!active) return { tags: [], headings: [], persistenceIssue: this.lastPersistenceIssue };
        return {
            tags: active.tags || [],
            headings: active.headings || [],
            persistenceIssue: this.lastPersistenceIssue,
        };
    }

    getFilledProfileEntries() {
        const active = this.getActiveBrain();
        if (!active) return [];

        const headingMap = new Map(
            (active.headings || []).map((heading) => [heading.id, heading.label])
        );

        return (active.tags || [])
            .filter((tag) => tag.value && String(tag.value).trim() !== '')
            .map((tag) => ({
                label: tag.label,
                value: String(tag.value).trim(),
                heading: headingMap.get(tag.headingId) || '',
            }));
    }

    getProfileText() {
        const active = this.getActiveBrain();
        if (!active) return '';

        const entryLines = this.getFilledProfileEntries()
            .map((entry) => `${entry.heading ? `${entry.heading} - ` : ''}${entry.label}: ${entry.value}`);

        return [
            active.rawDocText || '',
            this.getContext(),
            ...entryLines,
        ]
            .filter(Boolean)
            .join('\n');
    }

    addTag(headingId, label, value = '') {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const heading = active.headings.find((item) => item.id === headingId);
        if (!heading) return this._failure('HEADING_NOT_FOUND', 'Heading not found.');

        const trimmedLabel = this._trimmedName(label, '');
        if (!trimmedLabel) return this._failure('INVALID_TAG_LABEL', 'Tag label cannot be empty.');

        const tag = {
            id: this._createId('t'),
            headingId,
            label: trimmedLabel,
            value: String(value || ''),
        };
        active.tags.push(tag);
        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ tag });
    }

    updateTag(id, updates) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const tag = active.tags.find((item) => item.id === id);
        if (!tag) return this._failure('TAG_NOT_FOUND', 'Tag not found.');

        if (Object.prototype.hasOwnProperty.call(updates, 'headingId')) {
            const headingExists = active.headings.some((heading) => heading.id === updates.headingId);
            if (!headingExists) {
                return this._failure('HEADING_NOT_FOUND', 'Target heading not found.');
            }
            tag.headingId = updates.headingId;
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
            const trimmedLabel = this._trimmedName(updates.label, '');
            if (!trimmedLabel) return this._failure('INVALID_TAG_LABEL', 'Tag label cannot be empty.');
            tag.label = trimmedLabel;
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'value')) {
            tag.value = String(updates.value || '');
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success();
    }

    deleteTag(id) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const before = active.tags.length;
        active.tags = active.tags.filter((tag) => tag.id !== id);
        if (active.tags.length === before) return this._failure('TAG_NOT_FOUND', 'Tag not found.');

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success();
    }

    mergeExtractedData(extractedData) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');
        if (!Array.isArray(extractedData)) {
            return this._failure('INVALID_EXTRACTION', 'Extracted data must be an array of heading groups.');
        }

        let addedHeadings = 0;
        let addedTags = 0;

        for (const group of extractedData) {
            const category = this._trimmedName(group?.category, '');
            if (!category) continue;

            let heading = active.headings.find(
                (item) => item.label.toLowerCase() === category.toLowerCase()
            );

            if (!heading) {
                heading = this._normalizeHeading({
                    id: this._createId('h'),
                    label: category,
                    section: this._normalizeSection(category),
                });
                active.headings.push(heading);
                addedHeadings += 1;
            }

            if (!Array.isArray(group.tags)) continue;

            for (const extractedTag of group.tags) {
                const normalizedTag = this._normalizeTag({ ...extractedTag, headingId: heading.id }, active.headings);
                if (!normalizedTag) continue;

                const existingTag = active.tags.find(
                    (tag) =>
                        tag.headingId === heading.id &&
                        tag.label.toLowerCase() === normalizedTag.label.toLowerCase()
                );

                if (existingTag) {
                    if (normalizedTag.value && normalizedTag.value.length > String(existingTag.value || '').length) {
                        existingTag.value = normalizedTag.value;
                    }
                    continue;
                }

                active.tags.push(normalizedTag);
                addedTags += 1;
            }
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ active, addedHeadings, addedTags });
    }

    async uploadDocument(filePath) {
        const active = this.getActiveBrain();
        if (!active) return this._failure('NO_ACTIVE_BRAIN', 'No active brain.');

        const ext = this.path.extname(filePath).toLowerCase();
        if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)) {
            return this._failure('UNSUPPORTED_DOCUMENT_TYPE', 'Please upload a PDF, DOCX, TXT, or JSON file.');
        }

        try {
            const { text } = await this.documentLoader(filePath);
            active.rawDocText = text;
            const saveResult = this._saveToDisk();
            if (!saveResult.success) return saveResult;
            console.log(`Document loaded for [${active.name}]: ${text.length} chars`);
            return this._success({ text, fileName: this.path.basename(filePath), ext, filePath });
        } catch (error) {
            return this._failure(
                error.code || 'DOCUMENT_UPLOAD_FAILED',
                error.message || 'Failed to load document.'
            );
        }
    }

    getContext() {
        const active = this.getActiveBrain();
        if (!active) return '';

        const filled = active.tags.filter((tag) => tag.value && tag.value.trim() !== '');
        if (filled.length === 0) return '';

        let contextOutput = `[USER PROFILE MEMORY: ${active.name}]`;
        active.headings.forEach((heading) => {
            const grouped = filled.filter((tag) => tag.headingId === heading.id);
            if (grouped.length === 0) return;
            contextOutput += `\n\n### ${heading.label}:`;
            grouped.forEach((tag) => {
                contextOutput += `\n- ${tag.label}: ${tag.value}`;
            });
        });

        return contextOutput;
    }

    hasContext() {
        const active = this.getActiveBrain();
        return active ? active.tags.some((tag) => tag.value && tag.value.trim() !== '') : false;
    }

    getSmartContext(prompt) {
        if (!this.hasContext()) return '';

        const skipKeywords = [
            'explain this code',
            'debug',
            'syntax error',
            'what does this error',
            'documentation',
        ];

        const lowerPrompt = String(prompt || '').toLowerCase();
        const shouldSkip = skipKeywords.some((keyword) => lowerPrompt.includes(keyword));
        return shouldSkip ? '' : this.getContext();
    }

    getTagCount() {
        const active = this.getActiveBrain();
        return active ? active.tags.length : 0;
    }

    getFilledCount() {
        const active = this.getActiveBrain();
        return active ? active.tags.filter((tag) => tag.value && tag.value.trim() !== '').length : 0;
    }
}

module.exports = BrainService;