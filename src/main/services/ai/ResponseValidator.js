const { cleanText, isLowQuality, isRefusal } = require('../vision/utils/textCleaner');

const FORM_FIELD_TYPES = new Set([
    'text',
    'email',
    'phone',
    'textarea',
    'dropdown',
    'number',
    'date',
    'day',
    'month',
    'year',
    'password',
    'url',
    'checkbox',
    'radio',
    'other',
]);

const META_RESPONSE_PATTERNS = [
    /\bthe (screen|screenshot|image|document|form) (shows|contains)\b/i,
    /\bhere(?:'s| is) (the )?(response|answer|reply|json|result)\b/i,
    /\bi can(?:not|'t) determine\b/i,
    /\bunable to determine\b/i,
];

const PLACEHOLDER_ONLY_PATTERNS = [
    /^n\/?a$/i,
    /^unknown$/i,
    /^none$/i,
    /^not (provided|visible|available)$/i,
    /^unable to determine$/i,
];

class ResponseValidator {
    validate(taskProfile, rawResponse, request = {}) {
        const rawText = this._normalizeText(rawResponse);

        if (!rawText) {
            return this._failure('EMPTY_RESPONSE', 'Provider returned an empty response.');
        }

        if (isRefusal(rawText)) {
            return this._failure('PROVIDER_REFUSAL', 'Provider refused the request.');
        }

        const preCleanTextValidation = this._validateRawTextPayload(taskProfile.taskKind, rawText);
        if (!preCleanTextValidation.ok) {
            return this._failure(preCleanTextValidation.code, preCleanTextValidation.message, rawText);
        }

        if (taskProfile.responseFormat === 'json') {
            const parsed = this._parseJSON(rawText);
            if (!parsed.ok) {
                return this._failure('INVALID_JSON', 'Provider returned invalid JSON.', rawText);
            }

            const structured = this._validateStructuredPayload(taskProfile.taskKind, parsed.value, request);
            if (!structured.ok) {
                return this._failure(structured.code, structured.message, parsed.cleaned);
            }

            return {
                success: true,
                responseText: parsed.cleaned,
                parsed: structured.normalized,
            };
        }

        const cleaned = cleanText(rawText);
        if (isLowQuality(cleaned)) {
            return this._failure('LOW_QUALITY_RESPONSE', 'Provider returned a weak response.', cleaned);
        }

        const textValidation = this._validateTextPayload(taskProfile.taskKind, cleaned, request);
        if (!textValidation.ok) {
            return this._failure(textValidation.code, textValidation.message, cleaned);
        }

        return {
            success: true,
            responseText: cleaned,
            parsed: null,
        };
    }

    isRetryableQualityFailure(code) {
        return new Set([
            'EMPTY_RESPONSE',
            'PROVIDER_REFUSAL',
            'LOW_QUALITY_RESPONSE',
            'INVALID_JSON',
            'INVALID_STRUCTURED_PAYLOAD',
        ]).has(code);
    }

    _failure(code, message, responseText = '') {
        return {
            success: false,
            code,
            message,
            responseText,
        };
    }

    _normalizeText(rawResponse) {
        if (Array.isArray(rawResponse)) {
            return rawResponse.map((item) => this._normalizeText(item)).filter(Boolean).join('\n');
        }

        if (typeof rawResponse === 'string') {
            return rawResponse.trim();
        }

        if (rawResponse && typeof rawResponse === 'object') {
            if (typeof rawResponse.text === 'string') {
                return rawResponse.text.trim();
            }

            if (Array.isArray(rawResponse.content)) {
                return rawResponse.content
                    .map((item) => {
                        if (typeof item === 'string') return item;
                        if (item && typeof item.text === 'string') return item.text;
                        return '';
                    })
                    .join('\n')
                    .trim();
            }
        }

        return String(rawResponse || '').trim();
    }

    _parseJSON(text) {
        const cleaned = this._cleanJSONText(text);

        try {
            return {
                ok: true,
                cleaned,
                value: JSON.parse(cleaned),
            };
        } catch (_error) {
            for (const pattern of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
                const match = cleaned.match(pattern);
                if (!match) continue;

                try {
                    return {
                        ok: true,
                        cleaned: match[0],
                        value: JSON.parse(match[0]),
                    };
                } catch (_nestedError) {
                    continue;
                }
            }
        }

        return { ok: false, cleaned };
    }

    _cleanJSONText(text) {
        return String(text || '')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
    }

    _validateTextPayload(taskKind, text, request) {
        const normalized = String(text || '').trim();
        const alphanumericLength = normalized.replace(/[^a-z0-9]/gi, '').length;

        if (alphanumericLength < this._getMinimumTextLength(taskKind, request)) {
            return {
                ok: false,
                code: 'LOW_QUALITY_RESPONSE',
                message: 'Provider returned a weak response.',
            };
        }

        if (PLACEHOLDER_ONLY_PATTERNS.some((pattern) => pattern.test(normalized))) {
            return {
                ok: false,
                code: 'LOW_QUALITY_RESPONSE',
                message: 'Provider returned a placeholder response.',
            };
        }

        if (this._shouldRejectMetaResponse(taskKind) && META_RESPONSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
            return {
                ok: false,
                code: 'LOW_QUALITY_RESPONSE',
                message: 'Provider returned meta commentary instead of the requested answer.',
            };
        }

        return { ok: true };
    }

    _validateRawTextPayload(taskKind, text) {
        if (this._shouldRejectMetaResponse(taskKind) && META_RESPONSE_PATTERNS.some((pattern) => pattern.test(String(text || '').trim()))) {
            return {
                ok: false,
                code: 'LOW_QUALITY_RESPONSE',
                message: 'Provider returned meta commentary instead of the requested answer.',
            };
        }

        return { ok: true };
    }

    _getMinimumTextLength(taskKind, request) {
        if (taskKind === 'screen_reply' || taskKind === 'field_autofill') {
            return 2;
        }

        if (taskKind === 'rewrite_with_context') {
            const selectedTextLength = String(request.selectedText || '').replace(/[^a-z0-9]/gi, '').length;
            return selectedTextLength >= 20 ? 3 : 2;
        }

        return 1;
    }

    _shouldRejectMetaResponse(taskKind) {
        return taskKind === 'screen_reply'
            || taskKind === 'field_autofill'
            || taskKind === 'rewrite_with_context';
    }

    _validateStructuredPayload(taskKind, value, request) {
        if (taskKind === 'form_scene_parse') {
            return this._validateFormScene(value);
        }

        if (taskKind === 'form_fill_values') {
            return this._validateStringArray(value, request.expectedItemCount, 'Provider returned invalid form fill data.');
        }

        if (taskKind === 'form_choice_select') {
            return this._validateChoiceSelections(value, request.expectedItemCount);
        }

        if (taskKind === 'brain_doc_extract_vision' || taskKind === 'brain_doc_extract_text') {
            return this._validateBrainExtraction(value);
        }

        return {
            ok: true,
            normalized: value,
        };
    }

    _validateFormScene(value) {
        const normalizedObject = Array.isArray(value)
            ? { fields: value, submitVisible: false, submitLabel: null }
            : value;

        if (!normalizedObject || typeof normalizedObject !== 'object' || !Array.isArray(normalizedObject.fields)) {
            return this._invalid('Provider returned invalid form scene data.');
        }

        const fields = [];
        for (const field of normalizedObject.fields) {
            const normalizedField = this._normalizeFormField(field);
            if (!normalizedField) {
                return this._invalid('Provider returned invalid form scene data.');
            }
            fields.push(normalizedField);
        }

        return {
            ok: true,
            normalized: {
                fields,
                submitVisible: this._normalizeBoolean(normalizedObject.submitVisible, false),
                submitLabel: this._normalizeOptionalString(normalizedObject.submitLabel),
            },
        };
    }

    _normalizeFormField(field) {
        if (!field || typeof field !== 'object') {
            return null;
        }

        const label = this._normalizeRequiredString(field.label);
        const question = this._normalizeRequiredString(field.question);
        const type = String(field.type || '').trim().toLowerCase();

        if (!label || !question || !FORM_FIELD_TYPES.has(type)) {
            return null;
        }

        const options = this._normalizeStringList(field.options);
        if (!options.ok) {
            return null;
        }

        return {
            label,
            question,
            type,
            options: options.values,
            checked: this._normalizeBoolean(field.checked, false),
            hasValue: this._normalizeBoolean(field.hasValue, false),
        };
    }

    _validateStringArray(value, expectedItemCount, message) {
        if (!Array.isArray(value)) {
            return this._invalid(message);
        }

        if (Number.isInteger(expectedItemCount) && value.length !== expectedItemCount) {
            return this._invalid(message);
        }

        const normalized = [];
        for (const item of value) {
            if (!this._isScalar(item)) {
                return this._invalid(message);
            }
            normalized.push(String(item ?? '').trim());
        }

        return {
            ok: true,
            normalized,
        };
    }

    _validateChoiceSelections(value, expectedItemCount) {
        if (!Array.isArray(value)) {
            return this._invalid('Provider returned invalid choice selection data.');
        }

        if (Number.isInteger(expectedItemCount) && value.length !== expectedItemCount) {
            return this._invalid('Provider returned invalid choice selection data.');
        }

        const normalized = [];
        for (const selection of value) {
            if (Array.isArray(selection)) {
                const options = this._normalizeStringList(selection);
                if (!options.ok) {
                    return this._invalid('Provider returned invalid choice selection data.');
                }
                normalized.push(options.values);
                continue;
            }

            if (this._isScalar(selection)) {
                const text = String(selection ?? '').trim();
                normalized.push(text ? [text] : []);
                continue;
            }

            return this._invalid('Provider returned invalid choice selection data.');
        }

        return {
            ok: true,
            normalized,
        };
    }

    _validateBrainExtraction(value) {
        if (!Array.isArray(value)) {
            return this._invalid('Provider returned invalid brain extraction data.');
        }

        const sections = [];
        for (const section of value) {
            if (!section || typeof section !== 'object') {
                return this._invalid('Provider returned invalid brain extraction data.');
            }

            const category = this._normalizeRequiredString(section.category || section.heading || section.title);
            if (!category || !Array.isArray(section.tags)) {
                return this._invalid('Provider returned invalid brain extraction data.');
            }

            const tags = [];
            for (const tag of section.tags) {
                if (!tag || typeof tag !== 'object') {
                    return this._invalid('Provider returned invalid brain extraction data.');
                }

                const label = this._normalizeRequiredString(tag.label || tag.key || tag.name);
                const valueText = this._normalizeRequiredString(tag.value);
                if (!label || !valueText) {
                    return this._invalid('Provider returned invalid brain extraction data.');
                }

                tags.push({ label, value: valueText });
            }

            sections.push({ category, tags });
        }

        return {
            ok: true,
            normalized: sections,
        };
    }

    _normalizeStringList(input) {
        if (input == null) {
            return { ok: true, values: [] };
        }

        if (!Array.isArray(input)) {
            return { ok: false, values: [] };
        }

        const values = [];
        for (const item of input) {
            if (!this._isScalar(item)) {
                return { ok: false, values: [] };
            }

            const text = String(item ?? '').trim();
            if (text) {
                values.push(text);
            }
        }

        return { ok: true, values };
    }

    _normalizeRequiredString(value) {
        const normalized = this._normalizeOptionalString(value);
        return normalized || '';
    }

    _normalizeOptionalString(value) {
        if (value == null) return null;
        const normalized = String(value).trim();
        return normalized || null;
    }

    _normalizeBoolean(value, fallback) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            if (value.trim().toLowerCase() === 'true') return true;
            if (value.trim().toLowerCase() === 'false') return false;
        }
        return fallback;
    }

    _isScalar(value) {
        return ['string', 'number', 'boolean'].includes(typeof value) || value == null;
    }

    _invalid(message) {
        return {
            ok: false,
            code: 'INVALID_STRUCTURED_PAYLOAD',
            message,
        };
    }
}

module.exports = ResponseValidator;
