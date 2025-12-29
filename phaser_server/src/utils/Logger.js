
// Default Configuration
// You can toggle these values to filter logs
const LOG_CONFIG = {
    enabled: true, // Master Switch
    minLevel: 'DEBUG', // DEBUG, INFO, WARN, ERROR
    categories: {
        'Server': true,
        'PlayerManager': true,
        'FoodManager': true,
        'SpawnManager': true,
        'Database': true,
        'Auth': true,
        'Network': false // Example: Disable network logs if too noisy
    }
};

const LEVELS = {
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3
};

class Logger {
    static get CONFIG() {
        return LOG_CONFIG;
    }

    static shouldLog(tag, levelStr) {
        if (!LOG_CONFIG.enabled) return false;

        const configLevel = LEVELS[LOG_CONFIG.minLevel] || 0;
        const msgLevel = LEVELS[levelStr] || 0;

        if (msgLevel < configLevel) return false;

        // If tag is not in config, default to true, or strictly check?
        // Let's default to true if undefined, unless explicitly false.
        if (LOG_CONFIG.categories[tag] === false) return false;

        return true;
    }

    static info(tag, message, ...args) {
        if (this.shouldLog(tag, 'INFO')) {
            console.log(this.format('INFO', tag, message), ...args);
        }
    }

    static debug(tag, message, ...args) {
        if (this.shouldLog(tag, 'DEBUG')) {
            console.log(this.format('DEBUG', tag, message), ...args);
        }
    }

    static warn(tag, message, ...args) {
        // Warnings might bypass category check? Or keep it for granularity?
        // Let's keep it consistent.
        if (this.shouldLog(tag, 'WARN')) {
            console.warn(this.format('WARN', tag, message), ...args);
        }
    }

    static error(tag, message, ...args) {
        // Errors usually should always be shown unless master switch is off
        if (LOG_CONFIG.enabled) {
            console.error(this.format('ERROR', tag, message), ...args);
        }
    }

    static format(level, tag, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${tag}] ${message}`;
    }
}

module.exports = Logger;
