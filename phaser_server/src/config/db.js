const mongoose = require('mongoose');
const Logger = require('../utils/Logger');

const connectDB = async () => {
    try {
        // Thay đổi chuỗi kết nối nếu bạn dùng MongoDB Atlas
        const MONGO_URI =
            'mongodb+srv://snakeGame:YuMEH7LpCBx1AbPX@cluster0.fuf8svx.mongodb.net/?appName=Cluster0';

        await mongoose.connect(MONGO_URI);
        Logger.info('Database', '✅ MongoDB connected successfully');
    } catch (err) {
        Logger.error('Database', '❌ MongoDB connection error:', err);
        process.exit(1); // Dừng server nếu không kết nối được DB
    }
};

module.exports = connectDB;
