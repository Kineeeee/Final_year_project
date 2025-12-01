export class Logger {
    static enabled = true;
    static showTimestamp = true;

    // Log levels
    static LEVEL_DEBUG = 0;
    static LEVEL_INFO = 1;
    static LEVEL_WARN = 2;
    static LEVEL_ERROR = 3;
    
    static currentLevel = 0;

    static debug(tag, message, ...args) {
        if (this.shouldLog(this.LEVEL_DEBUG)) {
            console.log(this.format('DEBUG', tag, message), ...args);
        }
    }

    static info(tag, message, ...args) {
        if (this.shouldLog(this.LEVEL_INFO)) {
            console.info(`%c${this.format('INFO', tag, message)}`, 'color: #4287f5', ...args);
        }
    }

    static warn(tag, message, ...args) {
        if (this.shouldLog(this.LEVEL_WARN)) {
            console.warn(this.format('WARN', tag, message), ...args);
        }
    }

    static error(tag, message, ...args) {
        if (this.shouldLog(this.LEVEL_ERROR)) {
            console.error(this.format('ERROR', tag, message), ...args);
        }
    }

    static shouldLog(level) {
        return this.enabled && level >= this.currentLevel;
    }

    static format(levelStr, tag, message) {
        const timestamp = this.showTimestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
        return `${timestamp}[${levelStr}] [${tag}] ${message}`;
    }
}
