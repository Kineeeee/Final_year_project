
// Client Logger Configuration
export const LOG_CONFIG = {
    enabled: false, // Master Switch
    minLevel: 'DEBUG', // DEBUG, INFO, WARN, ERROR
    categories: {
        'Game': true,
        'MainMenu': true,
        'Shop': true,
        'UI': true,
        'Network': true, // Socket events
        'Input': false // Disable input spam by default
    }
};

const LEVELS = {
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3
};

const COLORS = {
    'DEBUG': '#888888', // Gray
    'INFO': '#4287f5',  // Blue
    'WARN': '#f5a742',  // Orange
    'ERROR': '#f54242'  // Red
};

export class Logger {
    static shouldLog(tag, levelStr) {
        if (!LOG_CONFIG.enabled) return false;

        const configLevel = LEVELS[LOG_CONFIG.minLevel] || 0;
        const msgLevel = LEVELS[levelStr] || 0;

        if (msgLevel < configLevel) return false;

        // Default to true if category not explicitly false
        if (LOG_CONFIG.categories[tag] === false) return false;

        return true;
    }

    static info(tag, message, ...args) {
        if (this.shouldLog(tag, 'INFO')) {
            console.info(`%c[${tag}] ${message}`, `color: ${COLORS.INFO}; font-weight: bold;`, ...args);
        }
    }

    static debug(tag, message, ...args) {
        if (this.shouldLog(tag, 'DEBUG')) {
            // Debug logs are often verbose, so we might want lighter styling
            console.log(`%c[${tag}] ${message}`, `color: ${COLORS.DEBUG}`, ...args);
        }
    }

    static warn(tag, message, ...args) {
        if (this.shouldLog(tag, 'WARN')) {
            console.warn(`%c[${tag}] ${message}`, `color: ${COLORS.WARN}; font-weight: bold;`, ...args);
        }
    }

    static error(tag, message, ...args) {
        // Errors usually should always be shown unless master switch is off
        if (LOG_CONFIG.enabled) {
            console.error(`%c[${tag}] ${message}`, `color: ${COLORS.ERROR}; font-weight: bold;`, ...args);
        }
    }
}
