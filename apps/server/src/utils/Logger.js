const winston = require('winston');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom format for local development (human readable)
const consoleFormat = winston.format.printf(({ level, message, timestamp, label, ...metadata }) => {
    let msg = `[${timestamp}] [${level.toUpperCase()}]`;
    if (label) msg += ` [${label}]`;
    msg += ` ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        process.env.NODE_ENV === 'production'
            ? winston.format.json() // JSON for Prod
            : consoleFormat          // Human Readable for Dev
    ),
    transports: [
        new winston.transports.Console()
    ],
});

// Adapter to match existing static API (Logger.info, Logger.error)
// This avoids refactoring 100+ files.
class LoggerAdapter {
    static info(tag, message, meta = {}) {
        logger.info(message, { label: tag, ...meta });
    }

    static error(tag, message, err) {
        // If err is an object, merge it
        const meta = err instanceof Error ? { stack: err.stack, error: err.message } : (err || {});
        logger.error(message, { label: tag, ...meta });
    }

    static warn(tag, message, meta = {}) {
        logger.warn(message, { label: tag, ...meta });
    }

    static debug(tag, message, meta = {}) {
        logger.debug(message, { label: tag, ...meta });
    }
}

module.exports = LoggerAdapter;
