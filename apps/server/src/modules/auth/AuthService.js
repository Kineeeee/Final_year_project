const jwt = require('jsonwebtoken');
const Logger = require('../../utils/Logger');

class AuthService {
    constructor() {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET must be defined in environment variables');
        }
        this.secret = process.env.JWT_SECRET;
        this.expiresIn = '24h';
        // Separate signing key for refresh tokens is handled in controller via REFRESH_SECRET
    }

    /**
     * Generate a JWT token for a user
     * @param {Object} payload - Data to encode (e.g. { userId, username })
     * @returns {string} Token
     */
    generateToken(payload) {
        try {
            return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
        } catch (error) {
            Logger.error('AuthService', 'Error generating token', error);
            return null;
        }
    }

    /**
     * Verify a JWT token
     * @param {string} token
     * @returns {Object|null} Decoded payload or null if invalid
     */
    verifyToken(token) {
        try {
            if (!token) return null;
            return jwt.verify(token, this.secret);
        } catch (error) {
            Logger.warn('AuthService', 'Invalid token verification attempt', error.message);
            return null;
        }
    }
}

module.exports = new AuthService();
