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
        console.log('🔧 Initializing ServiceManager...');

        // 1. Core Services (No dependencies or low-level)
        const ScreenshotService = require('./screenshot/ScreenshotService');
        const BrainService = require('./brain/BrainService');
        const VisionService = require('./vision/VisionService');
        const PromptService = require('../prompts/PromptService'); // It's already an instance, but let's register it for consistency

        this.register('ScreenshotService', new ScreenshotService());
        this.register('BrainService', new BrainService());
        this.register('VisionService', new VisionService());
        this.register('PromptService', PromptService);

        // 2. Dependent Services (Need Vision, Brain, etc.)
        const SmartWriterService = require('./SmartWriterService');

        const vision = this.get('VisionService');
        const brain = this.get('BrainService');

        this.register('SmartWriterService', new SmartWriterService(vision, brain));

        console.log('✅ All services initialized.');
    }
}

module.exports = new ServiceManager();
