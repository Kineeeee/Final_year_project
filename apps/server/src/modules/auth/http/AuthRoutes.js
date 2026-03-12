const express = require('express');
const router = express.Router();
const authController = require('./AuthController');

const { authLimiter } = require('./rateLimitMiddleware');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/social-login', authLimiter, authController.socialLogin);
router.post('/refresh', authLimiter, authController.refreshToken);
router.post('/forgot', authLimiter, authController.forgotPassword);
router.post('/logout', authController.logout);
router.post('/update-color', authController.updateColor);

module.exports = router;
