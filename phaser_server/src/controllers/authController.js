const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Logger = require('../utils/Logger');

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
            password: hashedPassword
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
    Logger.info('Auth', 'Login Request:', req.body);
    try {
        const { username, password } = req.body;

        // Tìm user
        const user = await User.findOne({ username });
        if (!user) {
            Logger.warn('Auth', `Login failed: Username ${username} not found`);
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            Logger.warn('Auth', `Login failed: Incorrect password for username ${username}`);
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Tạo Token (JWT)
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            'YOUR_SECRET_KEY', // Nên đưa vào biến môi trường .env
            { expiresIn: '24h' }
        );

        Logger.info('Auth', `User ${username} logged in successfully`);
        res.json({
            message: 'Login successful',
            token,
            username: user.username,
            coins: user.coins,
            currentSkin: user.currentSkin,
            color: user.color,
            highScore: user.highScore,
            inventory: user.inventory
        });
    } catch (error) {
        Logger.error('Auth', 'Login error:', error);
        res.status(500).json({ message: 'Server error' });
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


