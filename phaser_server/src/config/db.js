const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Thay đổi chuỗi kết nối nếu bạn dùng MongoDB Atlas
        const MONGO_URI = 'mongodb+srv://snakeGame:YuMEH7LpCBx1AbPX@cluster0.fuf8svx.mongodb.net/?appName=Cluster0';
        
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1); // Dừng server nếu không kết nối được DB
    }
};

module.exports = connectDB;