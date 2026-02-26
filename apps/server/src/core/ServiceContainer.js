const Logger = require('../utils/Logger');

class ServiceContainer {
    constructor() {
        this.services = new Map();
    }

    register(name, instance) {
        if (this.services.has(name)) {
            Logger.warn('ServiceContainer', `Service ${name} already registered. Overwriting.`);
        }
        this.services.set(name, instance);
        // Logger.info('ServiceContainer', `Registered service: ${name}`);
    }

    get(name) {
        if (!this.services.has(name)) {
            Logger.error('ServiceContainer', `Service not found: ${name}`);
            throw new Error(`Service not found: ${name}`);
        }
        return this.services.get(name);
    }

    has(name) {
        return this.services.has(name);
    }
}

module.exports = ServiceContainer;
