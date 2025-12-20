const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.register = async (req, res) => {
    console.log('[SERVER] Register Request:', req.body); // Debug log
    try {
        const { username, password } = req.body;

        // Kiểm tra user tồn tại
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.warn(`[SERVER] Registration failed: Username ${username} already exists`); // Debug log
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
        console.log(`[SERVER] User ${username} registered successfully`); // Debug log
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('[SERVER] Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    console.log('[SERVER] Login Request:', req.body); // Debug log
    try {
        const { username, password } = req.body;

        // Tìm user
        const user = await User.findOne({ username });
        if (!user) {
            console.warn(`[SERVER] Login failed: Username ${username} not found`); // Debug log
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`[SERVER] Login failed: Incorrect password for username ${username}`); // Debug log
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Tạo Token (JWT)
        const token = jwt.sign(
            { userId: user._id, username: user.username }, 
            'YOUR_SECRET_KEY', // Nên đưa vào biến môi trường .env
            { expiresIn: '24h' }
        );

        console.log(`[SERVER] User ${username} logged in successfully`); // Debug log
        res.json({ 
            message: 'Login successful', 
            token, 
            username: user.username,
            coins: user.coins,
            currentSkin: user.currentSkin,
            color: user.color
        });
    } catch (error) {
        console.error('[SERVER] Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Cập nhật màu sắc người chơi
exports.updateColor = async (req, res) => {
    console.log('[SERVER] Update Color Request:', req.body); // Debug log
    try {
        const { username, color } = req.body;

        // Tìm và cập nhật màu sắc
        const user = await User.findOneAndUpdate(
            { username },
            { color: color },
            { new: true } // Trả về document đã cập nhật
        );

        if (!user) {
            console.warn(`[SERVER] Update color failed: Username ${username} not found`); // Debug log
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log(`[SERVER] User ${username} color updated to ${color}`); // Debug log
        res.json({ message: 'Color updated successfully', color: user.color });
    } catch (error) {
        console.error('[SERVER] Update color error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


