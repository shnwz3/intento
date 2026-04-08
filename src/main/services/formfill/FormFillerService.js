const promptService = require('../../prompts/PromptService');
const ProfileValueResolver = require('./ProfileValueResolver');
const SUPPORTED_FIELD_TYPES = new Set([
    'text', 'email', 'phone', 'textarea', 'dropdown', 'number',
    'date', 'day', 'month', 'year', 'password', 'url', 'checkbox', 'radio',
]);
const AI_FALLBACK_TYPES = new Set(['text', 'textarea', 'dropdown', 'number', 'url', 'date', 'day', 'month', 'year']);

/**
 * FormFillerService - Inspects visible form fields and generates fill values.
 */
class FormFillerService {
    constructor(visionService, brainService) {
        this.vision = visionService;
        this.brain = brainService;
    }

    /**
     * Inspect the currently visible form state, including whether submit is visible.
     * @param {string} base64 - Screenshot base64 data
     * @param {{minimumFields?: number}} options
     * @returns {Promise<{isForm: boolean, fields: Array, allFields: Array, submitVisible: boolean, submitLabel: string|null}>}
     */
    async inspectFormState(base64, options = {}) {
        const minimumFields = Number.isInteger(options.minimumFields) ? options.minimumFields : 2;
        const prompt = promptService.getFormScenePrompt(minimumFields);
        const result = await this.vision.analyze({
            taskKind: 'form_scene_parse',
            images: base64,
            prompt,
        });

        if (!result.success) {
            throw new Error(result.error || 'Form inspection failed');
        }

        const parsed = result.parsed || this._parseJSON(result.response);
        if (Array.isArray(parsed)) {
            return {
                ...this._normalizeFieldResult(parsed, minimumFields),
                submitVisible: false,
                submitLabel: null,
            };
        }

        if (!parsed || typeof parsed !== 'object') {
            return {
                isForm: false,
                fields: [],
                allFields: [],
                submitVisible: false,
                submitLabel: null,
            };
        }

        return {
            ...this._normalizeFieldResult(parsed.fields, minimumFields),
            submitVisible: Boolean(parsed.submitVisible),
            submitLabel: typeof parsed.submitLabel === 'string' ? parsed.submitLabel : null,
        };
    }

    /**
     * Generate fill plans for detected fields using direct Brain matches first,
     * then AI only for unresolved question-style fields.
     * @param {Array} fields - Detected form fields
     * @returns {Promise<Array>}
     */
    async generateFillValues(fields) {
        const { plans: initialPlans } = this.planVisibleFields(fields);
        const brainContext = this.brain.hasContext() ? this.brain.getContext() : '';
        let plans = initialPlans;

        if (brainContext) {
            const choiceGroups = this._collectChoiceGroupsNeedingAI(plans);
            if (choiceGroups.length > 0) {
                const groupSelections = await this._generateChoiceSelections(choiceGroups, brainContext);
                plans = this._applyChoiceSelections(plans, choiceGroups, groupSelections);
            }
        }

        const aiFields = plans.filter((plan) => this._shouldUseAIFallback(plan));

        if (aiFields.length === 0) {
            return plans;
        }

        if (!brainContext) {
            throw new Error('No brain data available. Add your details in Brain settings first.');
        }

        const aiValues = await this._generateAIValues(aiFields, brainContext);
        let aiIndex = 0;

        return plans.map((plan) => {
            if (!this._shouldUseAIFallback(plan)) {
                return plan;
            }

            const value = String(aiValues[aiIndex] || '').trim();
            aiIndex += 1;

            if (!value) {
                return {
                    ...plan,
                    strategy: 'skip',
                    value: '',
                    source: 'review',
                };
            }

            return this._applyAIValue(plan, value);
        });
    }

    planVisibleFields(fields) {
        const resolver = ProfileValueResolver.fromBrain(this.brain);
        const plans = fields.map((field) => resolver.resolve(field));

        return {
            plans,
            summary: this._summarizePlans(plans),
        };
    }

    _normalizeFieldResult(fields, minimumFields) {
        const allFields = this._normalizeFields(fields);
        const supportedFields = allFields.filter((field) => this._isSupportedField(field));
        const emptyFields = supportedFields.filter((field) => !field.hasValue);

        return {
            isForm: emptyFields.length >= minimumFields,
            fields: emptyFields,
            allFields,
            supportedFields,
        };
    }

    _normalizeFields(fields) {
        if (!Array.isArray(fields)) {
            return [];
        }

        return fields
            .filter(Boolean)
            .map((field, index) => {
                const label = String(field.label || field.question || `Field ${index + 1}`).trim();
                const question = String(field.question || field.label || `Field ${index + 1}`).trim() || label;
                const rawType = String(field.type || 'other').trim().toLowerCase();

                return {
                    label,
                    question,
                    type: this._normalizeDetectedType(rawType, label, question),
                    options: Array.isArray(field.options)
                        ? field.options.map((option) => String(option || '').trim()).filter(Boolean)
                        : [],
                    checked: Boolean(field.checked),
                    hasValue: Boolean(field.hasValue),
                };
            });
    }

    _isSupportedField(field) {
        return SUPPORTED_FIELD_TYPES.has(String(field.type || '').toLowerCase());
    }

    _normalizeDetectedType(rawType, label, question) {
        if (SUPPORTED_FIELD_TYPES.has(rawType)) {
            return rawType;
        }

        const normalizedLabel = this._normalizeText(label);
        const normalizedQuestion = this._normalizeText(question);
        const combinedText = `${normalizedLabel} ${normalizedQuestion}`.trim();

        if (normalizedLabel === 'your answer' || normalizedLabel === 'short answer text') {
            return 'text';
        }

        if (normalizedLabel === 'long answer text') {
            return 'textarea';
        }

        if (normalizedLabel === 'choose' || normalizedQuestion.includes('choose')) {
            return 'dropdown';
        }

        if (/(dd[-/ ]mm[-/ ]yyyy|mm[-/ ]dd[-/ ]yyyy|yyyy[-/ ]mm[-/ ]dd)/i.test(combinedText)) {
            return 'date';
        }

        if (normalizedQuestion.includes('select all')
            || normalizedQuestion.includes('all that apply')
            || normalizedQuestion.includes('technologies you have experience with')) {
            return 'checkbox';
        }

        if (normalizedQuestion.includes('rate your')
            || normalizedQuestion.includes('proficiency')
            || normalizedQuestion.includes('most proficient')
            || normalizedQuestion.includes('choose one')) {
            return 'radio';
        }

        return rawType;
    }

    /**
     * Parse JSON from AI response, handling common quirks
     */
    _parseJSON(text) {
        if (typeof text !== 'string') {
            return null;
        }

        try {
            const cleaned = this._cleanJSONText(text);

            return JSON.parse(cleaned);
        } catch (error) {
            for (const pattern of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
                const match = text.match(pattern);
                if (!match) continue;

                try {
                    return JSON.parse(this._cleanJSONText(match[0]));
                } catch {
                    // Continue trying other shapes.
                }
            }

            console.error('Failed to parse AI JSON response:', text);
            return null;
        }
    }

    _cleanJSONText(text) {
        let cleaned = String(text || '').trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        cleaned = cleaned.trim();

        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        return cleaned;
    }

    _normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    async _generateAIValues(fields, brainContext) {
        const prompt = promptService.getFormFillPrompt(fields, brainContext);
        const result = await this.vision.analyzeText({
            taskKind: 'form_fill_values',
            prompt,
            expectedItemCount: fields.length,
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate fill values');
        }

        const values = result.parsed || this._parseJSON(result.response);
        if (!Array.isArray(values) || values.length !== fields.length) {
            throw new Error('AI returned invalid fill data. Please try again.');
        }

        return values;
    }

    async _generateChoiceSelections(groups, brainContext) {
        const prompt = promptService.getFormChoicePrompt(groups, brainContext);
        const result = await this.vision.analyzeText({
            taskKind: 'form_choice_select',
            prompt,
            expectedItemCount: groups.length,
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate choice selections');
        }

        const selections = result.parsed || this._parseJSON(result.response);
        if (!Array.isArray(selections) || selections.length !== groups.length) {
            throw new Error('AI returned invalid choice selections. Please try again.');
        }

        return selections.map((selection) => Array.isArray(selection)
            ? selection.map((option) => String(option || '').trim()).filter(Boolean)
            : []);
    }

    _applyAIValue(plan, value) {
        if (plan.type === 'dropdown') {
            return {
                ...plan,
                strategy: 'dropdown',
                value,
                source: 'ai',
            };
        }

        if (this._isDateLikePlan(plan)) {
            return {
                ...plan,
                strategy: 'text',
                value,
                inputMode: 'type',
                source: 'ai',
            };
        }

        return {
            ...plan,
            strategy: 'text',
            value,
            source: 'ai',
        };
    }

    _shouldUseAIFallback(plan) {
        return plan.strategy === 'ai'
            || (plan.strategy === 'skip' && AI_FALLBACK_TYPES.has(String(plan.type || '').toLowerCase()));
    }

    _collectChoiceGroupsNeedingAI(plans) {
        const grouped = new Map();

        for (const plan of plans) {
            if (plan.type !== 'checkbox' && plan.type !== 'radio') {
                continue;
            }

            const groupKey = `${plan.type}::${String(plan.question || plan.label || '').trim().toLowerCase()}`;
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    key: groupKey,
                    question: plan.question || plan.label,
                    type: plan.type,
                    options: [],
                    plans: [],
                });
            }

            const group = grouped.get(groupKey);
            group.options.push(plan.label);
            group.plans.push(plan);
        }

        return [...grouped.values()].filter((group) =>
            group.options.length > 1
            && !group.plans.some((plan) => plan.shouldSelect)
        );
    }

    _applyChoiceSelections(plans, choiceGroups, selections) {
        const selectedByKey = new Map();

        choiceGroups.forEach((group, index) => {
            const allowedOptions = new Set(group.options.map((option) => String(option || '').trim().toLowerCase()));
            const selectedOptions = (selections[index] || [])
                .map((option) => String(option || '').trim())
                .filter((option) => allowedOptions.has(option.toLowerCase()));

            selectedByKey.set(group.key, new Set(selectedOptions.map((option) => option.toLowerCase())));
        });

        return plans.map((plan) => {
            const groupKey = `${plan.type}::${String(plan.question || plan.label || '').trim().toLowerCase()}`;
            const selectedOptions = selectedByKey.get(groupKey);
            if (!selectedOptions) {
                return plan;
            }

            return {
                ...plan,
                shouldSelect: selectedOptions.has(String(plan.label || '').trim().toLowerCase()),
                source: 'ai',
            };
        });
    }

    _isDateLikePlan(plan) {
        return ['date', 'day', 'month', 'year'].includes(String(plan.type || '').toLowerCase());
    }

    _summarizePlans(plans) {
        const directStrategies = new Set(['text', 'dropdown', 'checkbox', 'radio']);
        const typeCounts = {};
        let directCount = 0;
        let aiCount = 0;
        let reviewCount = 0;

        for (const plan of plans) {
            const type = String(plan.type || 'other').toLowerCase();
            typeCounts[type] = (typeCounts[type] || 0) + 1;

            if (plan.strategy === 'ai') {
                aiCount += 1;
            } else if (plan.strategy === 'skip') {
                reviewCount += 1;
            } else if (directStrategies.has(plan.strategy)) {
                directCount += 1;
            } else {
                reviewCount += 1;
            }
        }

        return {
            totalCount: plans.length,
            directCount,
            aiCount,
            reviewCount,
            typeCounts,
        };
    }
}

module.exports = FormFillerService;
