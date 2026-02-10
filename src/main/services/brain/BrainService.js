const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const pdf = require('pdf-parse');
const { DEFAULT_TAGS } = require('./defaultTags');

/**
 * BrainService - Supports multiple structured tag-based memory profiles.
 * 
 * Each "Brain" has its own tags and context.
 * Profiles can be created, renamed, deleted, and switched.
 * Data persists to brain.json.
 */
class BrainService {
    constructor() {
        this.brainPath = path.join(app.getPath('userData'), 'brain.json');
        this.brains = {};
        this.activeBrainId = 'default';
        this._loadFromDisk();
    }

    // ============ PERSISTENCE ============

    /** @private */
    _loadFromDisk() {
        try {
            if (fs.existsSync(this.brainPath)) {
                const data = JSON.parse(fs.readFileSync(this.brainPath, 'utf8'));

                // Migrate from old single-brain structure if needed
                if (data.tags && !data.brains) {
                    console.log('🔄 Migrating legacy single-brain to multi-brain structure...');
                    this.brains = {
                        'default': {
                            id: 'default',
                            name: 'General Brain',
                            tags: data.tags || [],
                            rawDocText: data.rawDocText || ''
                        }
                    };
                    this.activeBrainId = 'default';
                    this._saveToDisk();
                } else {
                    this.brains = data.brains || {};
                    this.activeBrainId = data.activeBrainId || 'default';
                }

                // Ensure at least one brain exists
                if (Object.keys(this.brains).length === 0) {
                    this._createInitialBrain();
                }

                console.log(`🧠 Brains loaded: ${Object.keys(this.brains).length} profiles`);
            } else {
                this._createInitialBrain();
            }
        } catch (e) {
            console.error('Failed to load brain.json:', e.message);
            this._createInitialBrain();
        }
    }

    /** @private */
    _createInitialBrain() {
        this.activeBrainId = 'default';
        this.brains = {
            'default': {
                id: 'default',
                name: 'General Brain',
                tags: DEFAULT_TAGS.map((t) => ({ ...t })),
                rawDocText: ''
            }
        };
        this._saveToDisk();
        console.log(`🧠 Initialized with default brain profile`);
    }

    /** @private */
    _saveToDisk() {
        try {
            const data = {
                activeBrainId: this.activeBrainId,
                brains: this.brains
            };
            fs.writeFileSync(this.brainPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Failed to save brain.json:', e.message);
        }
    }

    // ============ BRAIN PROFILE MANAGEMENT ============

    /**
     * List all brains
     */
    listBrains() {
        return Object.values(this.brains).map(b => ({
            id: b.id,
            name: b.name,
            isActive: b.id === this.activeBrainId,
            tagCount: b.tags.length,
            filledCount: b.tags.filter(t => t.value && t.value.trim() !== '').length
        }));
    }

    /**
     * Create a new brain profile
     */
    createBrain(name) {
        const id = 'brain_' + Date.now();
        this.brains[id] = {
            id,
            name: name || `Brain ${Object.keys(this.brains).length + 1}`,
            tags: DEFAULT_TAGS.map((t) => ({ ...t })),
            rawDocText: ''
        };
        this.activeBrainId = id;
        this._saveToDisk();
        return { success: true, brain: this.brains[id] };
    }

    /**
     * Switch active brain
     */
    setActiveBrain(id) {
        if (!this.brains[id]) return { success: false, error: 'Brain not found' };
        this.activeBrainId = id;
        this._saveToDisk();
        return { success: true };
    }

    /**
     * Rename active or specific brain
     */
    renameBrain(id, newName) {
        const targetId = id || this.activeBrainId;
        if (!this.brains[targetId]) return { success: false, error: 'Brain not found' };
        this.brains[targetId].name = newName;
        this._saveToDisk();
        return { success: true };
    }

    /**
     * Delete a brain profile
     */
    deleteBrain(id) {
        if (Object.keys(this.brains).length <= 1) {
            return { success: false, error: 'Cannot delete the only brain profile' };
        }
        if (!this.brains[id]) return { success: false, error: 'Brain not found' };

        delete this.brains[id];

        // If we deleted the active one, switch to another
        if (this.activeBrainId === id) {
            this.activeBrainId = Object.keys(this.brains)[0];
        }

        this._saveToDisk();
        return { success: true, activeBrainId: this.activeBrainId };
    }

    getActiveBrain() {
        return this.brains[this.activeBrainId];
    }

    // ============ TAG CRUD (Active Brain) ============

    saveTags(tags) {
        const active = this.getActiveBrain();
        if (active) {
            active.tags = tags;
            this._saveToDisk();
            return { success: true, count: tags.length };
        }
        return { success: false, error: 'No active brain' };
    }

    getTags() {
        const active = this.getActiveBrain();
        if (!active) return [];

        // Merge saved values with latest metadata (like options, category, placeholder)
        return active.tags.map((tag) => {
            const defaultMetadata = DEFAULT_TAGS.find((dt) => dt.id === tag.id);
            if (defaultMetadata) {
                return { ...defaultMetadata, ...tag };
            }
            return tag;
        });
    }

    getDefaults() {
        return DEFAULT_TAGS;
    }

    addTag(label, value) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const tag = {
            id: Date.now().toString(),
            label,
            value,
            category: 'custom',
        };
        active.tags.push(tag);
        this._saveToDisk();
        return { success: true, tag };
    }

    updateTag(id, value) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const tag = active.tags.find((t) => t.id === id);
        if (!tag) return { success: false, error: 'Tag not found' };

        tag.value = value;
        this._saveToDisk();
        return { success: true };
    }

    deleteTag(id) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        active.tags = active.tags.filter((t) => t.id !== id);
        this._saveToDisk();
        return { success: true };
    }

    mergeExtractedTags(extractedTags) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        for (const extracted of extractedTags) {
            const existing = active.tags.find(
                (t) => t.label.toLowerCase() === extracted.label.toLowerCase()
            );

            if (existing) {
                if (!existing.value || existing.value.trim() === '') {
                    existing.value = extracted.value;
                }
            } else {
                active.tags.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                    label: extracted.label,
                    value: extracted.value,
                    category: 'extracted',
                });
            }
        }

        this._saveToDisk();
        return { success: true, tags: active.tags };
    }

    // ============ DOCUMENT UPLOAD ============

    async uploadDocument(filePath) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const ext = path.extname(filePath).toLowerCase();

        try {
            let text = '';
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                text = data.text;
            } else {
                text = fs.readFileSync(filePath, 'utf8');
            }

            active.rawDocText = text;
            console.log(`🧠 Document loaded for [${active.name}]: ${text.length} chars`);
            return { success: true, text, fileName: path.basename(filePath) };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ============ SMART CONTEXT ============

    getContext() {
        const active = this.getActiveBrain();
        if (!active) return '';

        const filled = active.tags.filter((t) => t.value && t.value.trim() !== '');
        if (filled.length === 0) return '';

        const lines = filled.map((t) => `- ${t.label}: ${t.value}`);
        return `[USER PROFILE MEMORY: ${active.name}]:\n${lines.join('\n')}`;
    }

    hasContext() {
        const active = this.getActiveBrain();
        return active ? active.tags.some((t) => t.value && t.value.trim() !== '') : false;
    }

    getTagCount() {
        const active = this.getActiveBrain();
        return active ? active.tags.length : 0;
    }

    getFilledCount() {
        const active = this.getActiveBrain();
        return active ? active.tags.filter((t) => t.value && t.value.trim() !== '').length : 0;
    }
}

module.exports = BrainService;
