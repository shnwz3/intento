class ServiceManager {
    constructor() {
        this.services = new Map();
    }

    register(name, service) {
        if (this.services.has(name)) {
            console.warn(`Service ${name} is already registered. Overwriting.`);
        }
        this.services.set(name, service);
        return service;
    }

    get(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found in ServiceManager.`);
        }
        return service;
    }

    /**
     * Initialize all services and their dependencies.
     * Order matters if we do manual dependency injection here.
     */
    initialize() {
        console.log('Initializing ServiceManager...');

        // 1. Core Services (No dependencies or low-level)
        const ScreenshotService = require('./screenshot/ScreenshotService');
        const BrainService = require('./brain/BrainService');
        const VisionService = require('./vision/VisionService');
        const TypingService = require('./typing/TypingService');
        const PromptService = require('../prompts/PromptService');

        this.register('ScreenshotService', new ScreenshotService());
        this.register('BrainService', new BrainService());
        this.register('VisionService', new VisionService());
        this.register('TypingService', new TypingService());
        this.register('PromptService', PromptService);

        // 2. Dependent Services (Need Vision, Brain, etc.)
        const SmartWriterService = require('./SmartWriterService');
        const FormFillerService = require('./formfill/FormFillerService');
        const FormAutomationService = require('./formfill/FormAutomationService');

        const screenshot = this.get('ScreenshotService');
        const vision = this.get('VisionService');
        const brain = this.get('BrainService');
        const typing = this.get('TypingService');
        const formFiller = new FormFillerService(vision, brain);

        this.register('SmartWriterService', new SmartWriterService(vision, brain));
        this.register('FormFillerService', formFiller);
        this.register('FormAutomationService', new FormAutomationService(
            screenshot,
            formFiller,
            typing
        ));

        console.log('All services initialized.');
    }
}

module.exports = new ServiceManager();
