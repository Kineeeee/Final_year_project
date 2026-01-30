const express = require('express');
const router = express.Router();
const authController = require('./AuthController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/update-color', authController.updateColor);

module.exports = router;
