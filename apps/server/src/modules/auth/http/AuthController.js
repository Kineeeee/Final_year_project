const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const Logger = require('../../../utils/Logger');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const ensureEnv = (key) => {
    if (!process.env[key]) {
        throw new Error(`${key} must be defined in environment variables`);
    }
    return process.env[key];
};
const REFRESH_SECRET = ensureEnv('REFRESH_SECRET');

const resolveCookieSecure = () => {
    const raw = process.env.COOKIE_SECURE;
    if (raw === undefined) return process.env.NODE_ENV === 'production';
    return String(raw).toLowerCase() === 'true';
};

exports.register = async (req, res) => {
    Logger.info('Auth', 'Register Request:', req.body);
    try {
        const { username, password } = req.body;

        // Kiểm tra user tồn tại
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            Logger.warn('Auth', `Registration failed: Username ${username} already exists`);
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo user mới
        const newUser = new User({
            username,
            password: hashedPassword,
        });

        await newUser.save();
        Logger.info('Auth', `User ${username} registered successfully`);
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        Logger.error('Auth', 'Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm user
        const user = await User.findOne({ username });
        if (!user) {
            Logger.warn('Auth', `Login failed: Username ${username} not found`);
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            Logger.warn('Auth', `Login failed: Incorrect password for username ${username}`);
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Create Access Token
        const AuthService = require('../AuthService');
        const accessToken = AuthService.generateToken({ userId: user._id, username: user.username });

        // Create Refresh Token (separate secret)
        const refreshToken = jwt.sign(
            { userId: user._id, username: user.username },
            REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Save Refresh Token to DB
        user.refreshToken = refreshToken;
        await user.save();

        // Send Refresh Token as HttpOnly Cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: resolveCookieSecure(),
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        Logger.info('Auth', `User ${username} logged in successfully`);
        res.json({
            message: 'Login successful',
            token: accessToken,
            username: user.username,
            coins: user.coins,
            currentSkin: user.currentSkin,
            color: user.color,
            highScore: user.highScore,
            inventory: user.inventory,
        });
    } catch (error) {
        console.error('DEBUG: Login Error Stack:', error);
        Logger.error('Auth', 'Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message }); // Send error to client temporarily for debug
    }
};

exports.socialLogin = async (req, res) => {
    try {
        const { provider, token } = req.body;
        let socialId, email, name;

        if (provider === 'google') {
            const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            socialId = data.sub;
            email = data.email;
            name = data.name;
        } else if (provider === 'facebook') {
            const { data } = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`);
            socialId = data.id;
            email = data.email;
            name = data.name;
        } else {
            return res.status(400).json({ message: 'Invalid provider' });
        }

        // Find existing user by social ID or email
        let user;
        if (provider === 'google') {
            user = await User.findOne({ $or: [{ googleId: socialId }, { email: email }] });
        } else {
            user = await User.findOne({ $or: [{ facebookId: socialId }, { email: email }] });
        }

        if (user) {
            // Update social ID if linked by email but missing social ID
            if (provider === 'google' && !user.googleId) {
                user.googleId = socialId;
                await user.save();
            } else if (provider === 'facebook' && !user.facebookId) {
                user.facebookId = socialId;
                await user.save();
            }
        } else {
            // Create new user
            const baseUsername = email ? email.split('@')[0] : name.replace(/\s+/g, '').toLowerCase();
            let uniqueUsername = baseUsername;
            let counter = 1;
            
            // Ensure username is unique
            while (await User.findOne({ username: uniqueUsername })) {
                uniqueUsername = `${baseUsername}${counter}`;
                counter++;
            }

            user = new User({
                username: uniqueUsername,
                email: email,
                googleId: provider === 'google' ? socialId : undefined,
                facebookId: provider === 'facebook' ? socialId : undefined,
            });
            await user.save();
            Logger.info('Auth', `New user ${uniqueUsername} created via ${provider}`);
        }

        // Generate tokens same as standard login
        const AuthService = require('../AuthService');
        const accessToken = AuthService.generateToken({ userId: user._id, username: user.username });
        
        const refreshToken = jwt.sign(
            { userId: user._id, username: user.username },
            REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        user.refreshToken = refreshToken;
        await user.save();

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: resolveCookieSecure(),
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        Logger.info('Auth', `User ${user.username} logged in via ${provider} successfully`);
        res.json({
            message: 'Social login successful',
            token: accessToken,
            username: user.username,
            coins: user.coins,
            currentSkin: user.currentSkin,
            color: user.color,
            highScore: user.highScore,
            inventory: user.inventory,
        });

    } catch (error) {
        Logger.error('Auth', `Social login error (${req.body.provider}):`, error);
        res.status(500).json({ message: 'Authentication failed', error: error.message });
    }
};

// Cập nhật màu sắc người chơi
exports.updateColor = async (req, res) => {
    Logger.info('Auth', 'Update Color Request:', req.body);
    try {
        const { username, color } = req.body;

        // Tìm và cập nhật màu sắc
        const user = await User.findOneAndUpdate(
            { username },
            { color: color },
            { new: true } // Trả về document đã cập nhật
        );

        if (!user) {
            Logger.warn('Auth', `Update color failed: Username ${username} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        Logger.info('Auth', `User ${username} color updated to ${color}`);
        res.json({ message: 'Color updated successfully', color: user.color });
    } catch (error) {
        Logger.error('Auth', 'Update color error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken; // Read from Cookie
    if (!refreshToken) return res.status(401).json({ message: 'Refresh Token required' });

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid Refresh Token' });
        }

        const AuthService = require('../AuthService');
        const newAccessToken = AuthService.generateToken({ userId: user._id, username: user.username });

        res.json({
            token: newAccessToken,
            username: user.username,
            coins: user.coins,
            currentSkin: user.currentSkin,
            color: user.color,
            highScore: user.highScore,
            inventory: user.inventory,
        });
    } catch (error) {
        return res.status(403).json({ message: 'Invalid Refresh Token' });
    }
};

exports.logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            // best-effort revoke by token match
            await User.updateOne({ refreshToken }, { refreshToken: null });
        }
        const { username } = req.body || {};
        if (username) {
            await User.updateOne({ username }, { refreshToken: null });
        }
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: resolveCookieSecure(),
            sameSite: 'strict',
            path: '/',
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const email = (req.body?.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // TODO: integrate email provider and reset-token storage.
        // Security best-practice: always return success-like response to avoid account enumeration.
        Logger.info('Auth', `Forgot password requested for ${email}`);
        return res.json({ message: 'If this account exists, a reset link has been sent.' });
    } catch (error) {
        Logger.error('Auth', 'Forgot password error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
