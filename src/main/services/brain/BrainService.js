const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const pdf = require('pdf-parse');
// const { DEFAULT_TAGS } = require('./defaultTags'); // No longer using static defaults for new brains

/**
 * BrainService - Supports multiple structured tag-based memory profiles.
 * Now supports dynamic HEADINGS and TAGS.
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

                // Migration: Ensure all brains have 'headings'
                let migrated = false;

                // 1. Load brains
                if (data.brains) {
                    this.brains = data.brains;
                    this.activeBrainId = data.activeBrainId || 'default';
                } else if (data.tags) {
                    // Legacy single brain migration
                    this.brains = {
                        'default': {
                            id: 'default',
                            name: 'General Brain',
                            tags: data.tags || [],
                            headings: [], // Will be populated by migration below
                            rawDocText: data.rawDocText || ''
                        }
                    };
                    this.activeBrainId = 'default';
                    migrated = true;
                } else {
                    this._createInitialBrain();
                    return;
                }

                // 2. Migrate Tags -> Headings for EACH brain
                Object.values(this.brains).forEach(brain => {
                    if (!brain.headings || brain.headings.length === 0) {
                        // Check if we have tags with legacy categories to migrate
                        const legacyCategories = ['personal', 'work', 'behavior', 'context'];
                        const hasLegacyTags = brain.tags.some(t => legacyCategories.includes(t.category));

                        if (hasLegacyTags) {
                            console.log(`🧠 Migrating brain [${brain.name}] to dynamic headings...`);

                            // Define default mappings
                            const headingMap = {
                                'personal': { id: 'h_identity', label: 'Identity', section: 'identity' },
                                'work': { id: 'h_profession', label: 'Profession', section: 'identity' },
                                'behavior': { id: 'h_persona', label: 'Persona', section: 'personality' },
                                'persona': { id: 'h_persona', label: 'Persona', section: 'personality' }, // Added for robust matching
                                'context': { id: 'h_context', label: 'Context', section: 'personality' }
                            };

                            brain.headings = Object.values(headingMap);

                            // Update tags to link to new headingIds
                            brain.tags = brain.tags.map(tag => {
                                const mapping = headingMap[tag.category];
                                if (mapping) {
                                    return { ...tag, headingId: mapping.id };
                                }
                                return { ...tag, headingId: 'h_context' }; // Fallback
                            });
                            migrated = true;
                        } else if (!brain.headings) {
                            // Just ensure array exists
                            brain.headings = [];
                            migrated = true;
                        }
                    }
                });

                if (migrated) this._saveToDisk();

                // Ensure at least one brain exists
                if (Object.keys(this.brains).length === 0) {
                    this._createInitialBrain();
                }

                // 3. Repair/Enforce Sections (Fixes misplaced tags from previous migrations)
                this._repairData();

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
    _repairData() {
        let repaired = false;
        Object.values(this.brains).forEach(brain => {
            if (!brain.headings) return;

            // A. Fix Heading Sections
            brain.headings.forEach(h => {
                const lowerLabel = h.label.toLowerCase();
                if (['persona', 'personality', 'behavior', 'style'].some(k => lowerLabel.includes(k))) {
                    if (h.section !== 'personality') {
                        h.section = 'personality';
                        repaired = true;
                    }
                } else if (['identity', 'personal', 'profession', 'work'].some(k => lowerLabel.includes(k))) {
                    if (h.section !== 'identity') {
                        h.section = 'identity';
                        repaired = true;
                    }
                }
            });

            // B. Move Specific Tags to Persona Heading
            const personalityTags = ['Communication Tone', 'Personality Traits', 'Reply Style'];

            // Find or Create target Persona heading
            let personaHeading = brain.headings.find(h => h.section === 'personality' && (h.label === 'Persona' || h.label === 'Personality'));

            if (brain.tags) {
                brain.tags.forEach(tag => {
                    if (personalityTags.includes(tag.label)) {
                        // Check if current parent heading is NOT in personality section
                        const currentHeading = brain.headings.find(h => h.id === tag.headingId);

                        if (!currentHeading || currentHeading.section !== 'personality') {
                            // Needs moving. exist or create heading?
                            if (!personaHeading) {
                                personaHeading = {
                                    id: 'h_' + Date.now() + Math.random().toString(36).substr(2, 4),
                                    label: 'Persona',
                                    section: 'personality'
                                };
                                brain.headings.push(personaHeading);
                                repaired = true;
                            }

                            if (tag.headingId !== personaHeading.id) {
                                tag.headingId = personaHeading.id;
                                repaired = true;
                            }
                        }
                    }
                });
            }
        });

        if (repaired) this._saveToDisk();
    }

    /** @private */
    _createInitialBrain() {
        this.activeBrainId = 'default';
        this.brains = {
            'default': {
                id: 'default',
                name: 'General Brain',
                headings: [], // Empty by default as requested
                tags: [],
                rawDocText: ''
            }
        };
        this._saveToDisk();
        console.log(`🧠 Initialized with default brain profile (Empty)`);
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

    listBrains() {
        return Object.values(this.brains).map(b => ({
            id: b.id,
            name: b.name,
            isActive: b.id === this.activeBrainId,
            tagCount: b.tags.length,
            filledCount: b.tags.filter(t => t.value && t.value.trim() !== '').length
        }));
    }

    createBrain(name) {
        const id = 'brain_' + Date.now();
        this.brains[id] = {
            id,
            name: name || `Brain ${Object.keys(this.brains).length + 1}`,
            headings: [],
            tags: [],
            rawDocText: ''
        };
        this.activeBrainId = id;
        this._saveToDisk();
        return { success: true, brain: this.brains[id] };
    }

    setActiveBrain(id) {
        if (!this.brains[id]) return { success: false, error: 'Brain not found' };
        this.activeBrainId = id;
        this._saveToDisk();
        return { success: true };
    }

    renameBrain(id, newName) {
        const targetId = id || this.activeBrainId;
        if (!this.brains[targetId]) return { success: false, error: 'Brain not found' };
        this.brains[targetId].name = newName;
        this._saveToDisk();
        return { success: true };
    }

    deleteBrain(id) {
        if (Object.keys(this.brains).length <= 1) {
            return { success: false, error: 'Cannot delete the only brain profile' };
        }
        if (!this.brains[id]) return { success: false, error: 'Brain not found' };

        delete this.brains[id];

        if (this.activeBrainId === id) {
            this.activeBrainId = Object.keys(this.brains)[0];
        }

        this._saveToDisk();
        return { success: true, activeBrainId: this.activeBrainId };
    }

    getActiveBrain() {
        return this.brains[this.activeBrainId];
    }

    // ============ HEADINGS CRUD ============

    // ============ HEADINGS CRUD ============

    addHeading(label, section = 'identity') {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const newHeading = {
            id: 'h_' + Date.now() + Math.random().toString(36).substr(2, 4),
            label: label || 'New Heading',
            section: section // 'identity' or 'personality'
        };

        if (!active.headings) active.headings = [];
        active.headings.push(newHeading);
        this._saveToDisk();
        return { success: true, heading: newHeading };
    }

    updateHeading(id, label) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const heading = active.headings.find(h => h.id === id);
        if (!heading) return { success: false, error: 'Heading not found' };

        heading.label = label;
        this._saveToDisk();
        return { success: true };
    }

    deleteHeading(id) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        // Remove heading
        active.headings = active.headings.filter(h => h.id !== id);

        // Remove tags associated with this heading (Cascade delete)
        // OR we could move them to 'Uncategorized', but user asked to delete.
        // Let's cascade delete for now as it's cleaner, or we can filter them out.
        active.tags = active.tags.filter(t => t.headingId !== id);

        this._saveToDisk();
        return { success: true };
    }

    // ============ TAG CRUD ============

    saveTags(tags) {
        // Full replace of tags (useful for drag-and-drop reordering if we send full list)
        // But for now, we usually just update individual values.
        // If the frontend sends the full state including headingIds, we save it.
        const active = this.getActiveBrain();
        if (active) {
            active.tags = tags;
            this._saveToDisk();
            return { success: true, count: tags.length };
        }
        return { success: false, error: 'No active brain' };
    }

    getTagsAndHeadings() {
        const active = this.getActiveBrain();
        if (!active) return { tags: [], headings: [] };
        return {
            tags: active.tags || [],
            headings: active.headings || []
        };
    }

    addTag(headingId, label, value = '') {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        // Verify heading exists
        const heading = active.headings.find(h => h.id === headingId);
        if (!heading) return { success: false, error: 'Heading not found' };

        const tag = {
            id: 't_' + Date.now() + Math.random().toString(36).substr(2, 4),
            headingId,
            label,
            value,
        };
        active.tags.push(tag);
        this._saveToDisk();
        return { success: true, tag };
    }

    updateTag(id, updates) {
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        const tag = active.tags.find((t) => t.id === id);
        if (!tag) return { success: false, error: 'Tag not found' };

        // Apply updates (value, label, headingId)
        Object.assign(tag, updates);

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

    // ============ AI EXTRACTION & MERGING ============

    mergeExtractedData(extractedData) {
        // extractedData should be: [{ category: "Identity", tags: [{ label, value }, ...] }, ...]
        const active = this.getActiveBrain();
        if (!active) return { success: false, error: 'No active brain' };

        if (!active.headings) active.headings = [];
        if (!active.tags) active.tags = [];

        let addedHeadings = 0;
        let addedTags = 0;

        extractedData.forEach(group => {
            // 1. Find or Create Heading
            let heading = active.headings.find(h => h.label.toLowerCase() === group.category.toLowerCase());
            if (!heading) {
                heading = {
                    id: 'h_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    label: group.category
                };
                active.headings.push(heading);
                addedHeadings++;
            }

            // 2. Merge Tags
            if (group.tags && Array.isArray(group.tags)) {
                group.tags.forEach(extractedTag => {
                    // Check if tag exists in this heading
                    const existingTag = active.tags.find(t =>
                        t.headingId === heading.id &&
                        t.label.toLowerCase() === extractedTag.label.toLowerCase()
                    );

                    if (existingTag) {
                        // Update value if empty or implied overwrite? 
                        // Let's overwrite only if new value is longer/meaningful
                        if (extractedTag.value && extractedTag.value.length > (existingTag.value || '').length) {
                            existingTag.value = extractedTag.value;
                        }
                    } else {
                        active.tags.push({
                            id: 't_' + Date.now() + Math.random().toString(36).substr(2, 4),
                            headingId: heading.id,
                            label: extractedTag.label,
                            value: extractedTag.value || ''
                        });
                        addedTags++;
                    }
                });
            }
        });

        this._saveToDisk();
        return { success: true, active };
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

        // Group by headings for better context structure
        let contextOutput = `[USER PROFILE MEMORY: ${active.name}]`;

        active.headings.forEach(h => {
            const groupTags = filled.filter(t => t.headingId === h.id);
            if (groupTags.length > 0) {
                contextOutput += `\n\n### ${h.label}:`;
                groupTags.forEach(t => {
                    contextOutput += `\n- ${t.label}: ${t.value}`;
                });
            }
        });

        return contextOutput;
    }

    hasContext() {
        const active = this.getActiveBrain();
        return active ? active.tags.some((t) => t.value && t.value.trim() !== '') : false;
    }

    getSmartContext(prompt) {
        if (!this.hasContext()) return '';

        const skipKeywords = [
            'explain this code', 'debug', 'syntax error',
            'what does this error', 'documentation',
        ];

        const lowerPrompt = (prompt || '').toLowerCase();
        const shouldSkip = skipKeywords.some((k) => lowerPrompt.includes(k));

        if (shouldSkip) {
            console.log('🧠 Brain: Skipping (technical context)');
            return '';
        }

        console.log('🧠 Brain: Injecting user memory');
        return this.getContext();
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
