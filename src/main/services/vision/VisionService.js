const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const promptService = require('../../prompts/PromptService');
const configService = require('../ConfigService');
const AIRouter = require('../ai/AIRouter');
const AITraceLogger = require('../ai/AITraceLogger');
const {
    CATALOG_VERSION,
    getOwnerRoutingConfig,
    getTaskProfile,
} = require('../ai/ModelCatalog');
const { ProviderRegistry } = require('../ai/ProviderRegistry');
const ResponseValidator = require('../ai/ResponseValidator');
const executeOpenAICompatible = require('../ai/providers/OpenAICompatibleAdapter');
const executeGemini = require('../ai/providers/GeminiAdapter');
const executeAnthropic = require('../ai/providers/AnthropicAdapter');
const executeOllama = require('../ai/providers/OllamaAdapter');

let aiConfig = {
    system_prompt: promptService.SYSTEM_PROMPT,
    model_params: { max_tokens: 500, temperature: 0.75 },
    routing: {
        localFallbackModel: '',
    },
};

try {
    const appRoot = app.getAppPath();
    const configPath = path.join(appRoot, 'ai_config.json');
    if (fs.existsSync(configPath)) {
        aiConfig = {
            ...aiConfig,
            ...JSON.parse(fs.readFileSync(configPath, 'utf8')),
            routing: {
                ...aiConfig.routing,
                ...(JSON.parse(fs.readFileSync(configPath, 'utf8')).routing || {}),
            },
        };
    }
} catch (_error) {
    console.warn('Failed to load ai_config.json, using defaults.');
}

const ROUTE_REQUEST_METADATA_FIELDS = Object.freeze([
    'expectedItemCount',
]);

class VisionService {
    constructor(options = {}) {
        this.promptService = options.promptService || promptService;
        this.configService = options.configService || configService;
        this.registry = options.registry || new ProviderRegistry();
        this.validator = options.validator || new ResponseValidator();
        this.traceLogger = options.traceLogger || new AITraceLogger();
        this.router = options.router || new AIRouter({
            registry: this.registry,
            validator: this.validator,
            executeProviderRequest: this._executeProviderRequest.bind(this),
            traceLogger: this.traceLogger,
        });
        this.providers = [];
        this.catalogVersion = CATALOG_VERSION;
        this.refreshProviders();
    }

    refreshProviders() {
        const config = this.configService.getConfig();
        const ownerRouting = getOwnerRoutingConfig(aiConfig);
        this.providers = this.registry.getExecutionOrder(config, ownerRouting);
        console.log(`VisionService initialized with ${this.providers.length} provider(s)`);
    }

    isReady() {
        return this.providers.length > 0;
    }

    getRecentTraces(limit = 50) {
        return this.traceLogger.getRecent(limit);
    }

    async analyze(input, selectedText = '', prompt = '', brainContext = '') {
        const request = this._normalizeAnalyzeRequest(input, selectedText, prompt, brainContext);
        return this._routeRequest(request);
    }

    async analyzeText(input) {
        if (!input || typeof input !== 'object' || !input.taskKind) {
            throw new Error('analyzeText now requires an object request with taskKind.');
        }

        return this._routeRequest(this._normalizeTaskRequest(input));
    }

    async analyzeTextOnly(prompt) {
        throw new Error('analyzeTextOnly is deprecated. Use analyzeText({ taskKind, prompt }) instead.');
    }

    async _routeRequest(request) {
        const config = this.configService.getConfig();
        const ownerRouting = getOwnerRoutingConfig(aiConfig);
        const taskProfile = getTaskProfile(request.taskKind, {
            hasImages: Array.isArray(request.images) && request.images.length > 0,
        });
        const normalizedRequest = {
            ...request,
            images: this._prepareImages(request.images, taskProfile),
        };

        return this.router.route(normalizedRequest, {
            config,
            ownerRouting,
            aiConfig,
        });
    }

    _normalizeAnalyzeRequest(input, selectedText, prompt, brainContext) {
        if (input && typeof input === 'object' && input.taskKind) {
            return this._normalizeTaskRequest(input);
        }

        return this._normalizeTaskRequest({
            taskKind: 'screen_reply',
            images: input,
            selectedText,
            prompt,
            brainContext,
        });
    }

    _normalizeTaskRequest(request = {}) {
        const images = request.images ?? request.imageBase64 ?? request.base64Images ?? [];
        const normalizedImages = Array.isArray(images)
            ? images
            : (images ? [images] : []);
        const taskKind = request.taskKind || 'screen_reply';
        const prompt = String(request.prompt || '').trim();
        const selectedText = String(request.selectedText || '').trim();
        const brainContext = String(request.brainContext || '').trim();
        const userPrompt = this._buildUserPrompt({
            taskKind,
            prompt,
            selectedText,
            brainContext,
        });
        const metadata = {};

        for (const field of ROUTE_REQUEST_METADATA_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(request, field) || request[field] === undefined) {
                continue;
            }
            metadata[field] = request[field];
        }

        return {
            taskKind,
            prompt,
            selectedText,
            brainContext,
            userPrompt,
            images: normalizedImages.map((image) => this._normalizeImageBase64(image)).filter(Boolean),
            ...metadata,
        };
    }

    _buildUserPrompt({ taskKind, prompt, selectedText, brainContext }) {
        let userPrompt = prompt;

        if (!userPrompt && taskKind === 'screen_reply') {
            userPrompt = this.promptService.DEFAULT_VISION_PROMPT;
        }

        if (selectedText) {
            userPrompt = this.promptService.wrapWithSelectionContext(selectedText, userPrompt);
        }

        if (brainContext) {
            userPrompt = this.promptService.wrapWithBrainContext(brainContext, userPrompt);
        }

        return userPrompt;
    }

    _normalizeImageBase64(input) {
        if (Buffer.isBuffer(input)) {
            return input.toString('base64');
        }

        if (typeof input !== 'string') {
            return '';
        }

        return input.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    }

    _prepareImages(images, taskProfile) {
        if (!Array.isArray(images) || images.length === 0) {
            return [];
        }

        return images
            .map((image) => this._resizeImageIfNeeded(image, taskProfile.maxImageDimension))
            .filter(Boolean);
    }

    _resizeImageIfNeeded(base64, maxDimension) {
        if (!base64 || !nativeImage?.createFromDataURL || !maxDimension) {
            return base64;
        }

        try {
            const image = nativeImage.createFromDataURL(`data:image/png;base64,${base64}`);
            const size = image.getSize();
            if (!size.width || !size.height) {
                return base64;
            }

            const largestDimension = Math.max(size.width, size.height);
            if (largestDimension <= maxDimension) {
                return base64;
            }

            const scale = maxDimension / largestDimension;
            const resized = image.resize({
                width: Math.max(1, Math.round(size.width * scale)),
                height: Math.max(1, Math.round(size.height * scale)),
            });

            return resized.toPNG().toString('base64');
        } catch (_error) {
            return base64;
        }
    }

    async _executeProviderRequest({ provider, model, request, taskProfile, aiConfig: runtimeConfig }) {
        const systemPrompt = taskProfile.systemPromptMode === 'structured'
            ? this.promptService.TEXT_ONLY_SYSTEM_PROMPT
            : runtimeConfig.system_prompt || this.promptService.SYSTEM_PROMPT;

        if (provider.transport === 'openai-compatible') {
            return executeOpenAICompatible({
                provider,
                apiKey: provider.apiKey,
                model,
                request,
                taskProfile,
                aiConfig: runtimeConfig,
                systemPrompt,
            });
        }

        if (provider.transport === 'google-native') {
            return executeGemini({
                apiKey: provider.apiKey,
                model,
                request,
                systemPrompt,
            });
        }

        if (provider.transport === 'anthropic-native') {
            return executeAnthropic({
                provider,
                apiKey: provider.apiKey,
                model,
                request,
                aiConfig: runtimeConfig,
                systemPrompt,
            });
        }

        if (provider.transport === 'ollama-local') {
            return executeOllama({
                model,
                request,
                systemPrompt,
            });
        }

        throw new Error(`Unsupported provider transport: ${provider.transport}`);
    }
}

module.exports = VisionService;
