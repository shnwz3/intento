const promptService = require('../prompts/PromptService');

class SmartWriterService {
    constructor(visionService, brainService) {
        this.vision = visionService;
        this.brain = brainService;
    }

    /**
     * Rewrite/Fix Grammar functionality
     */
    async rewrite(text, screenshotData) {
        if (!text) throw new Error('No text provided for rewrite.');

        const prompt = promptService.getRewritePrompt();
        // Rewrite is mechanical, usually no brain context needed
        const brainContext = '';

        return this._analyze(screenshotData, text, prompt, brainContext);
    }

    /**
     * Direct Reply functionality
     */
    async reply(selectedText, screenshotData) {
        const prompt = promptService.getReplyPrompt();
        const brainContext = this.brain.getSmartContext(prompt);

        return this._analyze(screenshotData, selectedText, prompt, brainContext);
    }

    /**
     * AutoFill/Field Fill functionality
     */
    async autoFill(screenshotData) {
        const prompt = promptService.getAutoFillPrompt();
        // AutoFill almost always benefits from brain context (forms, personal data)
        const brainContext = this.brain.hasContext() ? this.brain.getContext() : '';

        // AutoFill usually relies on screenshot context, not selected text
        return this._analyze(screenshotData, '', prompt, brainContext);
    }

    /**
     * Internal helper to call Vision Service
     */
    async _analyze(screenshotData, selectedText, prompt, brainContext) {
        const result = await this.vision.analyze(
            screenshotData.base64,
            selectedText,
            prompt,
            brainContext
        );

        if (!result.success) {
            throw new Error(result.error || 'AI analysis failed');
        }

        return result.response;
    }
}

module.exports = SmartWriterService;
