const { BrowserWindow, dialog, ipcMain } = require('electron');
const serviceManager = require('../services/ServiceManager');
const { createBrainWindow, closeBrainWindow } = require('../windows/brainWindow');

let brain;
let vision;

function registerBrainHandlers(isDev) {
    brain = serviceManager.get('BrainService');
    vision = serviceManager.get('VisionService');

    const notifyBrainUpdate = () => {
        const active = brain.getActiveBrain();
        const status = {
            hasContext: brain.hasContext(),
            tagCount: brain.getTagCount(),
            filledCount: brain.getFilledCount(),
            activeName: active ? active.name : 'No Brain',
            activeId: active ? active.id : null,
            activeAgentId: brain.getActiveAgentId(),
        };

        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('brain:update', status);
        });
    };

    ipcMain.handle('brain:open', () => {
        createBrainWindow(isDev);
    });

    ipcMain.handle('brain:uploadDoc', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'json', 'doc', 'docx'] }],
        });

        if (result.canceled) return { success: false, error: 'cancelled' };
        const uploadResult = await brain.uploadDocument(result.filePaths[0]);
        if (uploadResult.success) notifyBrainUpdate();
        return uploadResult;
    });

    ipcMain.handle('brain:extractTags', async (_event, { documentText }) => {
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
  }
]

- Create headings that make sense for the data.
- Extract as much relevant detail as possible.
- Ignore generic boilerplate text.

DOCUMENT:
${documentText.substring(0, 8000)}`;

        try {
            const result = await vision.analyzeTextOnly(extractionPrompt);
            if (!result.success) {
                return { success: false, error: result.error || result.message };
            }

            let extractedData;
            try {
                let cleaned = result.response.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
                }
                extractedData = JSON.parse(cleaned);
            } catch (parseErr) {
                console.error('AI JSON Parse Error:', parseErr);
                return { success: false, error: 'AI returned invalid format. Try again.', raw: result.response };
            }

            const mergeResult = brain.mergeExtractedData(extractedData);
            if (!mergeResult.success) return mergeResult;

            notifyBrainUpdate();
            return {
                success: true,
                tags: mergeResult.active.tags,
                headings: mergeResult.active.headings,
                extracted: extractedData.length,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('brain:saveTags', (_event, tags) => {
        const result = brain.saveTags(tags);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:getTags', () => {
        const data = brain.getTagsAndHeadings();
        return {
            tags: data.tags,
            headings: data.headings,
            filledCount: brain.getFilledCount(),
            activeAgentId: brain.getActiveAgentId(),
            persistenceIssue: data.persistenceIssue,
        };
    });

    ipcMain.handle('brain:addHeading', (_event, { label, section }) => {
        const result = brain.addHeading(label, section);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:updateHeading', (_event, { id, label }) => {
        const result = brain.updateHeading(id, label);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:deleteHeading', (_event, { id }) => {
        const result = brain.deleteHeading(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:addTag', (_event, { headingId, label, value }) => {
        const result = brain.addTag(headingId, label, value);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:updateTag', (_event, { id, ...updates }) => {
        const result = brain.updateTag(id, updates);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:deleteTag', (_event, { id }) => {
        const result = brain.deleteTag(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:status', () => {
        const active = brain.getActiveBrain();
        return {
            hasContext: brain.hasContext(),
            tagCount: brain.getTagCount(),
            filledCount: brain.getFilledCount(),
            activeName: active ? active.name : 'No Brain',
            activeId: active ? active.id : null,
            activeAgentId: brain.getActiveAgentId(),
        };
    });

    ipcMain.handle('brain:save', async (_event, data) => {
        if (data.tags) {
            const saveResult = brain.saveTags(data.tags);
            if (!saveResult.success) return saveResult;
            notifyBrainUpdate();
        }
        closeBrainWindow();
        return { success: true };
    });

    ipcMain.handle('brain:list', () => brain.listBrains());

    ipcMain.handle('brain:create', (_event, { name }) => {
        const result = brain.createBrain(name);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:delete', (_event, { id }) => {
        const result = brain.deleteBrain(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:rename', (_event, { id, newName }) => {
        const result = brain.renameBrain(id, newName);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:setActive', (_event, { id }) => {
        const result = brain.setActiveBrain(id);
        if (result.success) notifyBrainUpdate();
        return result;
    });

    ipcMain.handle('brain:setActiveAgent', (_event, { agentId }) => {
        const result = brain.setActiveAgent(agentId);
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

    console.log('Brain IPC handlers registered');
}

module.exports = { registerBrainHandlers };
