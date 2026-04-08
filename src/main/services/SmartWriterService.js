const promptService = require('../prompts/PromptService');

// Define AGENTS in main since we can't easily import from renderer source in some setups
// In a real app, this should be in a 'shared' directory.
const AGENTS = {
    'senior_dev': 'You are a Senior Software Architect. Prioritize performance, security, and maintainable patterns. Use project-specific context if available. Output code in clean markdown blocks.',
    'job_filler': 'You are an Expert Recruiter and Career Coach. Analyze the Job Description on screen and extract keywords. Use the user\'s Brain data to craft responses that maximize hireability and align with the role.',
    'ghostwriter': 'You are a Communications Expert. Detect the platform (Email, LinkedIn, Slack) and adjust the vocabulary and etiquette accordingly. Professional for work, casual for friends.',
    'elite_exec': 'You are an Elite Executive Assistant. Be extremely concise, anticipate the next 3 steps, and focus only on high-level outcomes.'
};

class SmartWriterService {
    constructor(visionService, brainService) {
        this.vision = visionService;
        this.brain = brainService;
    }

    _getDirective() {
        const agentId = this.brain.getActiveAgentId();
        return AGENTS[agentId] || '';
    }

    /**
     * Rewrite/Fix Grammar functionality
     */
    async rewrite(text, screenshotData) {
        if (!text) throw new Error('No text provided for rewrite.');

        const directive = this._getDirective();
        const prompt = promptService.getRewritePrompt(directive);
        const brainContext = '';

        const response = await this._analyze('rewrite_with_context', screenshotData, text, prompt, brainContext, {
            includeImage: false,
        });
        
        if (typeof response === 'string' && response.includes('NO_CHANGE_NEEDED')) {
            return { stay: true, original: text };
        }
        
        return response;
    }

    /**
     * Direct Reply functionality
     */
    async reply(selectedText, screenshotData) {
        const directive = this._getDirective();
        const prompt = promptService.getReplyPrompt(directive);
        const brainContext = this.brain.getSmartContext(prompt);

        return this._analyze('screen_reply', screenshotData, selectedText, prompt, brainContext);
    }

    /**
     * AutoFill/Field Fill functionality
     */
    async autoFill(screenshotData) {
        const directive = this._getDirective();
        const prompt = promptService.getAutoFillPrompt(directive);
        // AutoFill almost always benefits from brain context (forms, personal data)
        const brainContext = this.brain.hasContext() ? this.brain.getContext() : '';

        // AutoFill usually relies on screenshot context, not selected text
        return this._analyze('field_autofill', screenshotData, '', prompt, brainContext);
    }

    /**
     * Internal helper to call Vision Service
     */
    async _analyze(taskKind, screenshotData, selectedText, prompt, brainContext, options = {}) {
        const includeImage = options.includeImage !== false;
        const result = await this.vision.analyze({
            taskKind,
            images: includeImage ? (screenshotData?.base64 || '') : '',
            selectedText,
            prompt,
            brainContext,
        });

        if (!result.success) {
            throw new Error(result.error || 'AI analysis failed');
        }

        return result.response;
    }
}

module.exports = SmartWriterService;
