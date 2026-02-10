const { ipcMain, dialog } = require('electron');
const { getBrain, getVision } = require('./vision.handlers');
const { createBrainWindow, closeBrainWindow } = require('../windows/brainWindow');

/**
 * Register all brain-related IPC handlers
 * Supports: doc upload, AI tag extraction + merge, tag CRUD, window open
 */
function registerBrainHandlers(isDev) {
    const brain = getBrain();

    // Open Brain Window
    ipcMain.handle('brain:open', () => {
        createBrainWindow(isDev);
    });

    // Upload document → return raw text
    ipcMain.handle('brain:uploadDoc', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: ['pdf', 'txt', 'json', 'doc', 'docx'] },
            ],
        });
        if (result.canceled) return { success: false, error: 'cancelled' };
        return brain.uploadDocument(result.filePaths[0]);
    });

    // Extract tags from document text using AI, then MERGE into existing defaults
    ipcMain.handle('brain:extractTags', async (_event, { documentText }) => {
        const vision = getVision();

        // Build the extraction prompt with our known tag labels
        const defaultLabels = brain.getDefaults().map((t) => t.label);

        const extractionPrompt = `You are a data extraction engine. Read the following document and extract structured information about this person.

REQUIRED LABELS TO FILL (use these exact labels):
${defaultLabels.map((l) => `- ${l}`).join('\n')}

Also extract any OTHER relevant information not in the list above.

Return ONLY a valid JSON array of objects with "label" and "value" keys.
For labels you cannot find in the document, DO NOT include them.
Only include labels where the document provides clear information.

CRITICAL: Return ONLY the JSON array, no markdown, no explanation. Example:
[{"label":"Full Name","value":"John Doe"},{"label":"Key Skills","value":"React, Node.js"}]

DOCUMENT:
${documentText.substring(0, 4000)}`;

        try {
            const result = await vision.analyzeTextOnly(extractionPrompt);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            // Parse JSON from AI response
            let extractedTags;
            try {
                let cleaned = result.response.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
                }
                extractedTags = JSON.parse(cleaned);
            } catch (parseErr) {
                return { success: false, error: 'AI returned invalid format. Try again.' };
            }

            // Merge extracted into existing defaults
            const mergeResult = brain.mergeExtractedTags(extractedTags);
            return { success: true, tags: mergeResult.tags, extracted: extractedTags.length };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Save tags
    ipcMain.handle('brain:saveTags', (_event, tags) => brain.saveTags(tags));

    // Get all tags (includes defaults)
    ipcMain.handle('brain:getTags', () => ({
        tags: brain.getTags(),
        filledCount: brain.getFilledCount(),
    }));

    // Add single tag
    ipcMain.handle('brain:addTag', (_event, { label, value }) => brain.addTag(label, value));

    // Update tag
    ipcMain.handle('brain:updateTag', (_event, { id, value }) => brain.updateTag(id, value));

    // Delete tag
    ipcMain.handle('brain:deleteTag', (_event, { id }) => brain.deleteTag(id));

    // Get brain status
    ipcMain.handle('brain:status', () => ({
        hasContext: brain.hasContext(),
        tagCount: brain.getTagCount(),
        filledCount: brain.getFilledCount(),
    }));

    // Legacy
    ipcMain.handle('brain:save', async (_event, data) => {
        if (data.tags) brain.saveTags(data.tags);
        closeBrainWindow();
        return { success: true };
    });

    // --- Multi-Brain Profile Management ---

    // List all brains
    ipcMain.handle('brain:list', () => {
        return brain.listBrains();
    });

    // Create a new brain
    ipcMain.handle('brain:create', (_event, { name }) => {
        return brain.createBrain(name);
    });

    // Delete a brain
    ipcMain.handle('brain:delete', (_event, { id }) => {
        return brain.deleteBrain(id);
    });

    // Rename a brain
    ipcMain.handle('brain:rename', (_event, { id, newName }) => {
        return brain.renameBrain(id, newName);
    });

    // Switch active brain
    ipcMain.handle('brain:setActive', (_event, { id }) => {
        return brain.setActiveBrain(id);
    });

    ipcMain.handle('doc:upload', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'json'] }],
        });
        if (result.canceled) return { success: false, error: 'cancelled' };
        return brain.uploadDocument(result.filePaths[0]);
    });

    console.log('📡 Brain IPC handlers registered (tag system with defaults)');
}

module.exports = { registerBrainHandlers };
