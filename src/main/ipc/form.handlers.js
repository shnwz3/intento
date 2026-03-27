const { ipcMain } = require('electron');
const serviceManager = require('../services/ServiceManager');
const hudManager = require('../ui/HudManager');

let formFiller, formAutomation;

function registerFormHandlers() {
  formFiller = serviceManager.get('FormFillerService');
  formAutomation = serviceManager.get('FormAutomationService');

  // Inspect form state
  ipcMain.handle('form:inspect', async (_event, { base64 }) => {
    try {
      return await formFiller.inspectFormState(base64);
    } catch (err) {
      console.error('Form inspection failed:', err);
      return {
        success: false,
        isForm: false,
        error: err.message || 'Form inspection failed',
      };
    }
  });

  // Automate form filling
  ipcMain.handle('form:automate', async () => {
    try {
      const result = await formAutomation.run({
        onStatus: (message) => {
          hudManager.show(message);
        },
      });
      return result;
    } catch (err) {
      console.error('Form automation failed:', err);
      return {
        success: false,
        error: err.message || 'Form automation failed',
      };
    }
  });

  // Cancel form automation
  ipcMain.handle('form:cancel', () => {
    formAutomation.cancel();
    return { success: true };
  });

  console.log('📡 Form IPC handlers registered');
}

module.exports = { registerFormHandlers };
