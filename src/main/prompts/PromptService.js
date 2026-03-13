class PromptService {
    constructor() {
        // System Prompts
        this.SYSTEM_PROMPT = 'You are INTENTO. You are a direct-execution AI acting AS the user. NEVER provide suggestions, explanations, context, or meta-text like "Here is a reply". Output ONLY the exact, final text to be typed. Do not use quotation marks.';

        this.TEXT_ONLY_SYSTEM_PROMPT = 'You are a precise data extraction engine. Return only what is asked.';

        // Default Analysis Prompt
        this.DEFAULT_VISION_PROMPT = 'Look at this screen and GENERATE the next substantive reply or data. OUTPUT ONLY THE TEXT.';
    }

    /**
     * Get the base system prompt with agent instructions
     */
    getSystemPrompt(agentDirective = '') {
        const base = 'You are INTENTO. You are a direct-execution AI acting AS the user. NEVER provide suggestions, explanations, context, or meta-text like "Here is a reply". Output ONLY the exact, final text to be typed. Do not use quotation marks.';
        if (!agentDirective) return base;
        return `${base}\n\n[AGENT DIRECTIVE]: ${agentDirective}`;
    }

    /**
     * Get the prompt for fixing grammar/spelling.
     */
    getRewritePrompt(agentDirective = '') {
        let prompt = `WRITER DIRECTIVE: You are a professional editor and proofreader.
    - Your ONLY task is to rewrite the selected text with perfect grammar, spelling, and sentence structure.
    - DO NOT ANSWER the question.
    - DO NOT RESPOND to the content.
    - DO NOT add conversational fillers like "Here is the fixed text".
    - PRESERVE the original meaning and intent exactly.
    - OUTPUT ONLY THE CORRECTED TEXT.`;

        if (agentDirective) {
            prompt += `\n- AGENT STYLE OVERRIDE: ${agentDirective}`;
        }
        return prompt;
    }

    /**
     * Get the prompt for generating a direct reply.
     */
    getReplyPrompt(agentDirective = '') {
        let prompt = 'WRITER DIRECTIVE: Read the message on screen. GENERATE a substantive, high-IQ, and natural human reply (20-50 characters). NO robotic brevity. NO meta-talk. OUTPUT ONLY THE RESPONSE.';
        if (agentDirective) {
            prompt += `\n- AGENT STYLE OVERRIDE: ${agentDirective}`;
        }
        return prompt;
    }

    /**
     * Get the prompt for auto-filling a field.
     */
    getAutoFillPrompt(agentDirective = '') {
        let prompt = 'WRITER DIRECTIVE: GENERATE a complete, substantive, and natural human-like value or response for the active field/chat (20-50 characters). NO robotic fillers like \'Got it\' or \'Ok\'. OUTPUT ONLY THE TEXT.';
        if (agentDirective) {
            prompt += `\n- AGENT STYLE OVERRIDE: ${agentDirective}`;
        }
        return prompt;
    }

    /**
     * Wrap existing prompt with context about user selection.
     */
    wrapWithSelectionContext(selectedText, basePrompt) {
        return `Context (User Selection): "${selectedText}"\n\nTask: ${basePrompt}`;
    }

    /**
     * Wrap existing prompt with brain context.
     */
    wrapWithBrainContext(brainContext, basePrompt) {
        return `[THE BRAIN / MY DETAILS]:\n${brainContext}\n\n[TASK]:\n${basePrompt}`;
    }
}

module.exports = new PromptService();
