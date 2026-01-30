const mongoose = require('mongoose');
const Logger = require('../../utils/Logger');

const connectDB = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI;

        if (!MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        await mongoose.connect(MONGO_URI);
        Logger.info('Database', '✅ MongoDB connected successfully');
    } catch (err) {
        Logger.error('Database', '❌ MongoDB connection error:', err);
        process.exit(1); // Dừng server nếu không kết nối được DB
    }
};

module.exports = connectDB;
