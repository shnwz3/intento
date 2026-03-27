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
     * Get the prompt for inspecting the currently visible state of a form.
     */
    getFormScenePrompt(minimumFields = 2) {
        return `FORM STATE DIRECTIVE: Analyze this screenshot for the currently visible section of a form.

1. Identify all visible fillable controls such as text inputs, text areas, dropdowns, date fields, day/month/year fields, checkbox options, and radio options.
2. For each field return:
   - "label": the visible label or placeholder
   - "question": the full nearby question, section heading, helper text, or instruction that explains how the user should answer. This must never be empty
   - "type": one of "text", "email", "phone", "textarea", "dropdown", "number", "date", "day", "month", "year", "password", "url", "checkbox", "radio", "other"
   - "options": array of visible option labels when the control is a dropdown or grouped choice and the options are visible, otherwise []
   - "checked": true when a checkbox or radio option is already selected, otherwise false
   - "hasValue": true if the field already has a user-entered value or is already selected, false if empty/unselected
3. Determine whether a FINAL submit-style button is visible on screen right now.
4. Set "submitVisible" to true only for final actions such as Submit, Apply, Send, Finish, Complete, or Review & Submit.
5. For checkbox and radio questions, return each visible option as its own field in tab order with type "checkbox" or "radio", label as the option text, and question as the shared question text.
6. For dropdowns or select menus, return a single field entry for the control. If the options are visible, include them in "options". If the control is collapsed and only shows text like "Choose", it is still a dropdown.
7. For date questions, return ONE "date" field for the editable text box only. Do not return calendar icons or picker buttons as separate fields. Preserve visible placeholders such as dd-mm-yyyy or mm/dd/yyyy in the label if shown.
8. For Google Forms style controls: "Your answer" is a text input, linear scales like 1-5 are radio options, and "Select all..." style groups are checkbox options.
9. Do NOT treat Next, Continue, Back, Save Draft, Cancel, Close, or decorative chip displays as form fields.
10. Order fields from top to bottom, then left to right.

Return ONLY valid JSON in this exact shape:
{"fields":[{"label":"Full Name","question":"What is your full name?","type":"text","options":[],"checked":false,"hasValue":false}],"submitVisible":false,"submitLabel":null}

If fewer than ${minimumFields} empty visible fields are present, still return the same object shape with whatever fields you found.
No markdown. No explanation. JSON only.`;
    }

    /**
     * Get the prompt for generating fill values for detected form fields.
     */
    getFormFillPrompt(fields, brainContext) {
        const fieldList = fields
            .map((field, index) => {
                const question = field.question && field.question !== field.label
                    ? ` | question: "${field.question}"`
                    : '';
                const options = Array.isArray(field.options) && field.options.length > 0
                    ? ` | options: ${field.options.join(', ')}`
                    : '';
                return `${index + 1}. "${field.label}" (type: ${field.type}${question}${options})`;
            })
            .join('\n');

        return `FORM FILL DIRECTIVE: You are filling out a form AS the user. Use their personal data below to generate accurate, human-like values for each field.

[USER DATA]:
${brainContext}

[FORM FIELDS TO FILL]:
${fieldList}

RULES:
- Use EXACT data from user profile when available (name, email, phone, etc.)
- For dropdown fields, return the best matching option label only, not a sentence
- For description/message/question fields, write a short, natural, human-sounding response (1-3 sentences) based on the visible question and the user's profile
- Never invent sensitive personal data such as email, phone, address, date of birth, legal name, employer, or profile links. If that exact data is missing, return an empty string for that field
- For non-sensitive generic fields where the profile gives enough signal, generate the best grounded value from the available user data, even if it must be inferred
- For experience or salary style fields, return only the concise numeric or short value that should go into the form
- For date fields, preserve the visible placeholder format when it is shown in the field label or question (examples: dd-mm-yyyy, mm/dd/yyyy)
- For portfolio/personal website fields, reuse the best available existing profile link if a dedicated website URL is not present
- Keep answers concise and natural - no robotic or generic text
- Match the field type (email format for email fields, phone format for phone fields, etc.)

OUTPUT ONLY a valid JSON array of strings, one value per field, in the same order as the fields listed above.
Example: ["John Doe","john@email.com","+1234567890","I am a software developer with 5 years of experience."]

No explanation, no markdown, no code fences. ONLY the JSON array.`;
    }

    getFormChoicePrompt(groups, brainContext) {
        const groupList = groups
            .map((group, index) => `${index + 1}. question: "${group.question}" | type: ${group.type} | options: ${group.options.join(', ')}`)
            .join('\n');

        return `FORM CHOICE DIRECTIVE: You are selecting the best form options AS the user from their profile data.

[USER DATA]:
${brainContext}

[CHOICE GROUPS]:
${groupList}

RULES:
- For radio groups, choose exactly one best option label
- For checkbox groups, choose one or more option labels that are truly supported by the user data
- Prefer grounded selections based on technologies, experience, tools, platforms, and profile context
- If nothing is a strong match, choose the single safest option that is still reasonably supported by the user profile
- Return only labels that appear exactly in the provided options list

OUTPUT ONLY valid JSON in this exact shape:
[["React"],["Amazon Web Services (AWS)","Vercel/Netlify"]]

No explanation. No markdown. JSON only.`;
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
