const CATALOG_VERSION = '2026-04-08-v1';

const TASK_PROFILES = Object.freeze({
    screen_reply: Object.freeze({
        taskKind: 'screen_reply',
        defaultModality: 'vision',
        allowTextWithoutImage: false,
        responseFormat: 'text',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'default',
    }),
    rewrite_with_context: Object.freeze({
        taskKind: 'rewrite_with_context',
        defaultModality: 'vision',
        allowTextWithoutImage: true,
        responseFormat: 'text',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'default',
    }),
    field_autofill: Object.freeze({
        taskKind: 'field_autofill',
        defaultModality: 'vision',
        allowTextWithoutImage: false,
        responseFormat: 'text',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'default',
    }),
    form_scene_parse: Object.freeze({
        taskKind: 'form_scene_parse',
        defaultModality: 'vision',
        allowTextWithoutImage: false,
        responseFormat: 'json',
        imageDetail: 'high',
        maxImageDimension: 1800,
        systemPromptMode: 'structured',
    }),
    form_fill_values: Object.freeze({
        taskKind: 'form_fill_values',
        defaultModality: 'text',
        allowTextWithoutImage: true,
        responseFormat: 'json',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'structured',
    }),
    form_choice_select: Object.freeze({
        taskKind: 'form_choice_select',
        defaultModality: 'text',
        allowTextWithoutImage: true,
        responseFormat: 'json',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'structured',
    }),
    brain_doc_extract_vision: Object.freeze({
        taskKind: 'brain_doc_extract_vision',
        defaultModality: 'vision',
        allowTextWithoutImage: false,
        responseFormat: 'json',
        imageDetail: 'high',
        maxImageDimension: 2000,
        systemPromptMode: 'structured',
    }),
    brain_doc_extract_text: Object.freeze({
        taskKind: 'brain_doc_extract_text',
        defaultModality: 'text',
        allowTextWithoutImage: true,
        responseFormat: 'json',
        imageDetail: 'low',
        maxImageDimension: 1440,
        systemPromptMode: 'structured',
    }),
});

const PROVIDER_TASK_MODELS = Object.freeze({
    grok: Object.freeze({
        screen_reply: Object.freeze([
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'llama-3.3-70b-versatile',
        ]),
        rewrite_with_context: Object.freeze([
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-20b',
        ]),
        field_autofill: Object.freeze([
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'llama-3.3-70b-versatile',
        ]),
        form_scene_parse: Object.freeze([
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'llama-3.3-70b-versatile',
        ]),
        form_fill_values: Object.freeze([
            'openai/gpt-oss-20b',
            'llama-3.3-70b-versatile',
        ]),
        form_choice_select: Object.freeze([
            'openai/gpt-oss-20b',
            'llama-3.3-70b-versatile',
        ]),
        brain_doc_extract_vision: Object.freeze([
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'llama-3.3-70b-versatile',
        ]),
        brain_doc_extract_text: Object.freeze([
            'openai/gpt-oss-20b',
            'llama-3.3-70b-versatile',
        ]),
    }),
    openai: Object.freeze({
        screen_reply: Object.freeze(['gpt-5-mini', 'gpt-5']),
        rewrite_with_context: Object.freeze(['gpt-5-mini', 'gpt-5']),
        field_autofill: Object.freeze(['gpt-5-mini', 'gpt-5']),
        form_scene_parse: Object.freeze(['gpt-5-mini', 'gpt-5']),
        form_fill_values: Object.freeze(['gpt-5-mini', 'gpt-5']),
        form_choice_select: Object.freeze(['gpt-5-mini', 'gpt-5']),
        brain_doc_extract_vision: Object.freeze(['gpt-5-mini', 'gpt-5']),
        brain_doc_extract_text: Object.freeze(['gpt-5-mini', 'gpt-5']),
    }),
    gemini: Object.freeze({
        screen_reply: Object.freeze(['gemini-2.5-flash']),
        rewrite_with_context: Object.freeze(['gemini-2.5-flash-lite', 'gemini-2.5-flash']),
        field_autofill: Object.freeze(['gemini-2.5-flash']),
        form_scene_parse: Object.freeze(['gemini-2.5-flash']),
        form_fill_values: Object.freeze(['gemini-2.5-flash-lite', 'gemini-2.5-flash']),
        form_choice_select: Object.freeze(['gemini-2.5-flash-lite', 'gemini-2.5-flash']),
        brain_doc_extract_vision: Object.freeze(['gemini-2.5-flash']),
        brain_doc_extract_text: Object.freeze(['gemini-2.5-flash-lite', 'gemini-2.5-flash']),
    }),
    anthropic: Object.freeze({
        screen_reply: Object.freeze(['claude-sonnet-4-20250514']),
        rewrite_with_context: Object.freeze(['claude-sonnet-4-20250514']),
        field_autofill: Object.freeze(['claude-sonnet-4-20250514']),
        form_scene_parse: Object.freeze(['claude-sonnet-4-20250514']),
        form_fill_values: Object.freeze(['claude-sonnet-4-20250514']),
        form_choice_select: Object.freeze(['claude-sonnet-4-20250514']),
        brain_doc_extract_vision: Object.freeze(['claude-sonnet-4-20250514']),
        brain_doc_extract_text: Object.freeze(['claude-sonnet-4-20250514']),
    }),
    openrouter: Object.freeze({
        screen_reply: Object.freeze([
            'google/gemini-2.5-flash',
            'openai/gpt-5-mini',
        ]),
        rewrite_with_context: Object.freeze([
            'google/gemini-2.5-flash-lite',
            'openai/gpt-5-mini',
        ]),
        field_autofill: Object.freeze([
            'google/gemini-2.5-flash',
            'openai/gpt-5-mini',
        ]),
        form_scene_parse: Object.freeze([
            'google/gemini-2.5-flash',
            'openai/gpt-5-mini',
        ]),
        form_fill_values: Object.freeze([
            'google/gemini-2.5-flash-lite',
            'openai/gpt-5-mini',
        ]),
        form_choice_select: Object.freeze([
            'google/gemini-2.5-flash-lite',
            'openai/gpt-5-mini',
        ]),
        brain_doc_extract_vision: Object.freeze([
            'google/gemini-2.5-flash',
            'openai/gpt-5-mini',
        ]),
        brain_doc_extract_text: Object.freeze([
            'google/gemini-2.5-flash-lite',
            'openai/gpt-5-mini',
        ]),
    }),
});

function dedupe(values = []) {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function getTaskProfile(taskKind, { hasImages = false } = {}) {
    const baseProfile = TASK_PROFILES[taskKind];
    if (!baseProfile) {
        throw new Error(`Unsupported AI task kind: ${taskKind}`);
    }

    const modality = baseProfile.defaultModality === 'vision' && baseProfile.allowTextWithoutImage && !hasImages
        ? 'text'
        : baseProfile.defaultModality;

    return {
        ...baseProfile,
        modality,
        hasImages,
    };
}

function getModelCandidates(providerId, taskKind, options = {}) {
    if (providerId === 'ollama') {
        return dedupe([options.localFallbackModel]);
    }

    const providerModels = PROVIDER_TASK_MODELS[providerId];
    if (!providerModels) return [];

    return dedupe(providerModels[taskKind]);
}

function getCreditCheckModel(providerId) {
    const candidates = getModelCandidates(providerId, 'rewrite_with_context');
    return candidates[0] || '';
}

function getOwnerRoutingConfig(runtimeConfig = {}) {
    const localFallbackModel = String(
        runtimeConfig?.routing?.localFallbackModel
        || process.env.INTENTO_LOCAL_FALLBACK_MODEL
        || ''
    ).trim();

    return {
        allowLocalFallback: Boolean(localFallbackModel),
        localFallbackModel,
    };
}

module.exports = {
    CATALOG_VERSION,
    TASK_PROFILES,
    getTaskProfile,
    getModelCandidates,
    getCreditCheckModel,
    getOwnerRoutingConfig,
};
