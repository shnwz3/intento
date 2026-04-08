const { CATALOG_VERSION, getModelCandidates, getTaskProfile } = require('./ModelCatalog');

class AIRouter {
    constructor({ registry, validator, executeProviderRequest, traceLogger }) {
        this.registry = registry;
        this.validator = validator;
        this.executeProviderRequest = executeProviderRequest;
        this.traceLogger = traceLogger;
    }

    async route(request, { config, ownerRouting, aiConfig }) {
        const taskProfile = getTaskProfile(request.taskKind, {
            hasImages: Array.isArray(request.images) && request.images.length > 0,
        });

        const providers = this.registry.getExecutionOrder(config, ownerRouting)
            .filter((provider) => this._providerSupportsTask(provider, taskProfile));

        if (providers.length === 0) {
            return {
                success: false,
                code: 'NO_PROVIDER',
                message: 'No AI provider is configured. Add an API key in Settings.',
                error: 'No AI provider is configured. Add an API key in Settings.',
                failures: [],
            };
        }

        const failures = [];

        for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
            const provider = providers[providerIndex];
            const candidates = getModelCandidates(provider.id, request.taskKind, {
                hasImages: taskProfile.hasImages,
                localFallbackModel: provider.localModel,
            });

            if (candidates.length === 0) {
                failures.push({
                    success: false,
                    provider: provider.label,
                    providerId: provider.id,
                    code: 'MODEL_UNAVAILABLE',
                    message: `${provider.label} has no model configured for ${request.taskKind}.`,
                    error: `${provider.label} has no model configured for ${request.taskKind}.`,
                    model: '',
                });
                continue;
            }

            for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
                const model = candidates[candidateIndex];
                const attempt = await this._attempt(
                    provider,
                    model,
                    request,
                    taskProfile,
                    aiConfig,
                    {
                        providerIndex,
                        candidateIndex,
                    }
                );

                if (attempt.success) {
                    return {
                        ...attempt,
                        catalogVersion: CATALOG_VERSION,
                    };
                }

                failures.push(attempt);

                const hasNextModel = candidateIndex < candidates.length - 1;
                if (!(attempt.retrySameProvider && hasNextModel)) {
                    break;
                }
            }
        }

        const terminalFailure = failures[failures.length - 1];
        return {
            success: false,
            code: terminalFailure?.code || 'ANALYZE_FAILED',
            message: terminalFailure?.message || 'AI analysis failed.',
            error: terminalFailure?.message || 'AI analysis failed.',
            failures,
            catalogVersion: CATALOG_VERSION,
        };
    }

    _providerSupportsTask(provider, taskProfile) {
        return taskProfile.modality === 'vision'
            ? provider.supportsVision
            : provider.supportsText;
    }

    async _attempt(provider, model, request, taskProfile, aiConfig, { providerIndex = 0, candidateIndex = 0 } = {}) {
        const startedAt = Date.now();
        try {
            console.log(`Trying ${provider.label} (${model})...`);

            const responsePromise = this.executeProviderRequest({
                provider,
                model,
                request,
                taskProfile,
                aiConfig,
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT')), 15000);
            });

            const raw = await Promise.race([responsePromise, timeoutPromise]);
            const validated = this.validator.validate(taskProfile, raw, request);
            const tokensUsed = this._extractTokensUsed(raw);
            const latencyMs = Date.now() - startedAt;

            if (!validated.success) {
                this._recordTrace({
                    taskKind: request.taskKind,
                    provider: provider.label,
                    model,
                    latencyMs,
                    tokensUsed,
                    retryCount: candidateIndex,
                    fallbackUsed: providerIndex > 0,
                    success: false,
                    failureReason: validated.code,
                });

                return {
                    success: false,
                    provider: provider.label,
                    providerId: provider.id,
                    code: validated.code,
                    message: `${provider.label} ${validated.message.toLowerCase()}`,
                    error: `${provider.label} ${validated.message.toLowerCase()}`,
                    model,
                    retrySameProvider: this.validator.isRetryableQualityFailure(validated.code),
                };
            }

            this._recordTrace({
                taskKind: request.taskKind,
                provider: provider.label,
                model,
                latencyMs,
                tokensUsed,
                retryCount: candidateIndex,
                fallbackUsed: providerIndex > 0,
                success: true,
            });

            return {
                success: true,
                code: 'ANALYZE_OK',
                message: 'AI analysis completed successfully.',
                response: validated.responseText,
                parsed: validated.parsed,
                provider: provider.label,
                providerId: provider.id,
                model,
            };
        } catch (error) {
            const classified = this._classifyError(provider, error);
            this._recordTrace({
                taskKind: request.taskKind,
                provider: provider.label,
                model,
                latencyMs: Date.now() - startedAt,
                tokensUsed: this._extractTokensUsed(error?.response?.data || error),
                retryCount: candidateIndex,
                fallbackUsed: providerIndex > 0,
                success: false,
                failureReason: classified.code,
            });
            return {
                success: false,
                provider: provider.label,
                providerId: provider.id,
                model,
                ...classified,
            };
        }
    }

    _classifyError(provider, error) {
        const message = String(error?.message || `${provider.label} failed.`);
        const lowerMessage = message.toLowerCase();

        if (message === 'TIMEOUT') {
            return {
                code: 'PROVIDER_TIMEOUT',
                message: `${provider.label} timed out after 15 seconds.`,
                error: `${provider.label} timed out after 15 seconds.`,
                retrySameProvider: false,
            };
        }

        if ([401, 402, 403, 429].includes(error?.status) || lowerMessage.includes('quota')) {
            return {
                code: 'PROVIDER_AUTH_OR_QUOTA',
                message: `${provider.label} rejected the request due to auth or quota limits.`,
                error: `${provider.label} rejected the request due to auth or quota limits.`,
                retrySameProvider: false,
            };
        }

        if (lowerMessage.includes('model') && (lowerMessage.includes('not found') || lowerMessage.includes('does not exist') || lowerMessage.includes('unavailable'))) {
            return {
                code: 'MODEL_UNAVAILABLE',
                message: `${provider.label} could not use the selected model.`,
                error: `${provider.label} could not use the selected model.`,
                retrySameProvider: true,
            };
        }

        return {
            code: 'PROVIDER_ERROR',
            message,
            error: message,
            retrySameProvider: false,
        };
    }

    _recordTrace(trace) {
        this.traceLogger?.record?.(trace);
    }

    _extractTokensUsed(raw) {
        const usage = raw?.usage || raw?.usageMetadata || raw?.response?.usage || raw?.data?.usage;
        if (!usage || typeof usage !== 'object') {
            return undefined;
        }

        if (Number.isFinite(usage.total_tokens)) {
            return usage.total_tokens;
        }

        if (Number.isFinite(usage.totalTokenCount)) {
            return usage.totalTokenCount;
        }

        if (Number.isFinite(usage.input_tokens) || Number.isFinite(usage.output_tokens)) {
            return (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0);
        }

        if (Number.isFinite(usage.prompt_tokens) || Number.isFinite(usage.completion_tokens)) {
            return (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0);
        }

        if (Number.isFinite(usage.promptTokenCount) || Number.isFinite(usage.candidatesTokenCount)) {
            return (Number(usage.promptTokenCount) || 0) + (Number(usage.candidatesTokenCount) || 0);
        }

        if (Number.isFinite(usage.prompt_eval_count) || Number.isFinite(usage.eval_count)) {
            return (Number(usage.prompt_eval_count) || 0) + (Number(usage.eval_count) || 0);
        }

        return undefined;
    }
}

module.exports = AIRouter;
