const rateLimit = require('express-rate-limit');
const Logger = require('../../../utils/Logger');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many login attempts from this IP, please try again after 15 minutes'
    },
    handler: (req, res, next, options) => {
        Logger.warn('RateLimit', `Ideally blocked request from ${req.ip}`);
        res.status(options.statusCode).send(options.message);
    }
});

module.exports = {
    authLimiter
};
