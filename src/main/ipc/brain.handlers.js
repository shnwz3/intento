const { ipcMain, dialog, BrowserWindow } = require('electron');
const { getBrain, getVision } = require('./vision.handlers');
const { createBrainWindow, closeBrainWindow } = require('../windows/brainWindow');

/**
 * Register all brain-related IPC handlers
 * Supports: doc upload, AI tag extraction + merge, tag CRUD, window open
 */
function registerBrainHandlers(isDev) {
    const brain = getBrain();

    // Helper to notify all windows of brain updates
    const notifyBrainUpdate = () => {
        const active = brain.getActiveBrain();
        const status = {
            hasContext: brain.hasContext(),
            tagCount: brain.getTagCount(),
            filledCount: brain.getFilledCount(),
            activeName: active ? active.name : 'No Brain',
            activeId: active ? active.id : null
        };

        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('brain:update', status);
        });
    };

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
        const uploadResult = await brain.uploadDocument(result.filePaths[0]);
        if (uploadResult.success) notifyBrainUpdate();
        return uploadResult;
    });

    // Extract tags from document text using AI, then MERGE into existing defaults
    ipcMain.handle('brain:extractTags', async (_event, { documentText }) => {
        const vision = getVision();

        // New Hierarchical Extraction Prompt
        const extractionPrompt = `You are a data extraction engine. Read the following document and extract structured information about this person.
        
        Group the information into logical HEADINGS (Categories).
        
        REQUIRED FORMAT:
        Return ONLY a valid JSON array of objects. Each object represents a HEADING and contains a list of TAGS.
        
        Example JSON Structure:
        [
          {
            "category": "Identity",
            "tags": [
              { "label": "Full Name", "value": "John Doe" },
              { "label": "Email", "value": "john@example.com" }
            ]
          },
          {
            "category": "Professional",
            "tags": [
              { "label": "Role", "value": "Software Engineer" },
              { "label": "Skills", "value": "React, Node.js" }
            ]
          }
        ]

        - Create Headings that make sense for the data (e.g., Identity, Work Experience, Education, soft Skills).
        - Extract as much relevant detail as possible.
        - Ignore generic boilerplate text.

        DOCUMENT:
        ${documentText.substring(0, 8000)}`;

        try {
            const result = await vision.analyzeTextOnly(extractionPrompt);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            // Parse JSON from AI response
            let extractedData;
            try {
                let cleaned = result.response.trim();
                // Basic cleanup for markdown code blocks
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
                }
                extractedData = JSON.parse(cleaned);
            } catch (parseErr) {
                console.error('AI JSON Parse Error:', parseErr);
                console.log('Raw response:', result.response);
                return { success: false, error: 'AI returned invalid format. Try again.', raw: result.response };
            }

            // Merge extracted into existing defaults
            const mergeResult = brain.mergeExtractedData(extractedData);
            notifyBrainUpdate();
            return { success: true, tags: mergeResult.active.tags, headings: mergeResult.active.headings, extracted: extractedData.length };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Save tags (full sync)
    ipcMain.handle('brain:saveTags', (_event, tags) => {
        const result = brain.saveTags(tags);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Get all tags AND headings
    ipcMain.handle('brain:getTags', () => {
        const data = brain.getTagsAndHeadings();
        return {
            tags: data.tags,
            headings: data.headings,
            filledCount: brain.getFilledCount(),
        };
    });

    // --- Heading CRUD ---
    ipcMain.handle('brain:addHeading', (_event, { label }) => {
        return brain.addHeading(label);
    });

    ipcMain.handle('brain:updateHeading', (_event, { id, label }) => {
        return brain.updateHeading(id, label);
    });

    ipcMain.handle('brain:deleteHeading', (_event, { id }) => {
        const result = brain.deleteHeading(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // --- Tag CRUD ---

    // Add single tag
    ipcMain.handle('brain:addTag', (_event, { headingId, label, value }) => {
        const result = brain.addTag(headingId, label, value);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Update tag
    ipcMain.handle('brain:updateTag', (_event, { id, ...updates }) => {
        // updates can contain value, label, headingId
        const result = brain.updateTag(id, updates);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Delete tag
    ipcMain.handle('brain:deleteTag', (_event, { id }) => {
        const result = brain.deleteTag(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Get brain status
    ipcMain.handle('brain:status', () => {
        const active = brain.getActiveBrain();
        return {
            hasContext: brain.hasContext(),
            tagCount: brain.getTagCount(),
            filledCount: brain.getFilledCount(),
            activeName: active ? active.name : 'No Brain',
            activeId: active ? active.id : null
        };
    });

    // Legacy
    ipcMain.handle('brain:save', async (_event, data) => {
        if (data.tags) {
            brain.saveTags(data.tags);
            notifyBrainUpdate();
        }
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
        const result = brain.createBrain(name);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Delete a brain
    ipcMain.handle('brain:delete', (_event, { id }) => {
        const result = brain.deleteBrain(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Rename a brain
    ipcMain.handle('brain:rename', (_event, { id, newName }) => {
        const result = brain.renameBrain(id, newName);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    // Switch active brain
    ipcMain.handle('brain:setActive', (_event, { id }) => {
        const result = brain.setActiveBrain(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('doc:upload', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'json'] }],
        });
        if (result.canceled) return { success: false, error: 'cancelled' };
        const uploadResult = await brain.uploadDocument(result.filePaths[0]);
        if (uploadResult.success) notifyBrainUpdate();
        return uploadResult;
    });

    console.log('📡 Brain IPC handlers registered (dynamic headings supported)');
}

module.exports = { registerBrainHandlers };
