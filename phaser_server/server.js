require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const parser = require('socket.io-msgpack-parser');
const cors = require('cors');
const connectDB = require('./src/infra/database/MongoConnection');
const authRoutes = require('./src/modules/auth/http/AuthRoutes.js');
const Logger = require('./src/utils/Logger');

const { PORT } = require('./src/config/constants');
const GameServer = require('./src/GameServer');

const app = express();

// --- cấu hình rate limit ---
// giới hạn toàn bộ API để tránh spam request
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // giới hạn mỗi IP mỗi cửa sổ thời gian
    standardHeaders: true, // gửi thông tin giới hạn trong header `RateLimit-*`
    legacyHeaders: false, // không gửi header `X-RateLimit-*`
    message: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút.',
});
app.use('/api/', limiter);
// --- giới hạn cho login và đăng ký ---
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many login prevention, please try again after an hour',
});

// 1.Connect to Database
connectDB();

const cookieParser = require('cookie-parser');

// 2.Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Allow Vite defaults
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// 3.Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/questions', require('./src/modules/quiz/QuestionRoutes'));

app.get('/', function (req, res) {
    res.send('Server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
    parser,
    cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST'],
    },
});

// Initialize Game Servers
// 1. Normal Mode
new GameServer(io, { mode: 'normal' });

// 2. Math Mode
const mathIO = io.of('/math');
new GameServer(mathIO, { mode: 'quiz', topic: 'math' });

// 3. English Mode
const englishIO = io.of('/english');
new GameServer(englishIO, { mode: 'quiz', topic: 'english' });

server.listen(PORT, () => {
    Logger.info('Server', `Server is running on port ${PORT}`);
});
process.on('unhandledRejection', (reason, p) => { console.error('Unhandled Rejection at:', p, 'reason:', reason); });
