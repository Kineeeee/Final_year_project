const AuthService = require('../AuthService');

/**
 * Express middleware to enforce JWT authentication.
 * Looks for token in Authorization: Bearer <token> or req.body.token.
 * Attaches decoded payload to req.user on success.
 */
module.exports = function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || req.body?.token || req.query?.token;

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = decoded;
    next();
};
