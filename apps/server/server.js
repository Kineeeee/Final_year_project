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

const { PORT } = require('./src/config/ServerConstants');
const GameServer = require('./src/GameServer');
const userQuizRoutes = require('./src/modules/quiz/UserQuizRoutes');
const roomRoutes = require('./src/modules/room/RoomRoutes');
const chatbotRoutes = require('./src/modules/bot/ChatbotRoutes');
const RoomRegistry = require('./src/modules/room/RoomRegistry');

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
const rawOrigins =
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

// Allow wildcard in dev by setting CORS_ORIGINS="*"
const corsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true); // mobile app / curl
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
        return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// 3.Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/questions', require('./src/modules/quiz/QuestionRoutes'));
app.use('/api/user-quiz', userQuizRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.get('/', function (req, res) {
    res.send('Server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
    parser,
    cors: {
        origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
        methods: ['GET', 'POST'],
    },
});

// Initialize Game Servers
// 1. Normal Mode
const normalServer = new GameServer(io, { mode: 'normal' });

// 2. Math Mode
const mathIO = io.of('/math');
const mathServer = new GameServer(mathIO, { mode: 'quiz', topic: 'math', lockedSource: true });

// 3. English Mode
const englishIO = io.of('/english');
const englishServer = new GameServer(englishIO, { mode: 'quiz', topic: 'english', lockedSource: true });

// 4. Custom Quiz Rooms (dynamic namespace per room code)
const customIO = io.of(/^\/custom\/[A-Za-z0-9_-]+$/);
customIO.on('connection', (socket) => {
    const nsp = socket.nsp;
    const code = nsp.name.split('/').pop();
    const room = RoomRegistry.getRoom(code);
    if (!room) {
        socket.emit('room_closed');
        socket.disconnect(true);
        return;
    }

    if (!RoomRegistry.canAcceptJoin(code)) {
        socket.emit('room_already_started');
        socket.disconnect(true);
        return;
    }

    // Create GameServer per room lazily
    let isNewServer = false;
    if (!room.gameServer) {
        room.gameServer = new GameServer(nsp, {
            mode: 'quiz',
            topic: room.category,
            userQuiz: room.quizDoc,
            isCustom: true,
            roomCode: code,
            ownerUserId: room.ownerUserId,
            ownerSocketId: socket.id,
            autoStart: false, // wait until owner presses Start
        });
        isNewServer = true;
    }

    const added = RoomRegistry.addSocket(code, socket.id);
    if (!added) {
        socket.emit('room_already_started');
        socket.disconnect(true);
        return;
    }

    socket.emit('room_meta', RoomRegistry.getMeta(code));

    // IMPORTANT: the first socket that triggers server creation won't hit the
    // NetworkSystem's connection listener (it was registered after this connect event fired).
    // Manually handle the initial connection to ensure the owner gets a player spawn.
    if (isNewServer && room.gameServer?.networkSystem?.handleConnection) {
        room.gameServer.networkSystem.handleConnection(socket);
    }

    // Push initial waiting snapshot
    if (room.gameServer?.broadcastWaiting) {
        room.gameServer.broadcastWaiting();
    }

    socket.on('disconnect', () => {
        const { ownerChanged, newOwnerId } = RoomRegistry.removeSocket(code, socket.id);
        if (ownerChanged) {
            nsp.emit('room_owner', { ownerId: newOwnerId });
            if (room.gameServer) {
                room.gameServer.config.ownerSocketId = newOwnerId;
            }
        }
        if (room.gameServer?.broadcastWaiting) {
            room.gameServer.broadcastWaiting();
        }
        if (room.gameServer && room.gameServer.closed && (!room.sockets || room.sockets.size === 0)) {
            RoomRegistry.closeRoom(code, 'round_end');
        }
    });
});

// Expose live game servers for routes (e.g., user quiz source switching)
app.locals.gameServers = {
    normal: normalServer,
    math: mathServer,
    english: englishServer,
};

// Helper endpoint to check custom room capacity (used by frontend to show/hide create button)
app.get('/api/rooms/custom/capacity', (_req, res) => {
    res.json({
        max: RoomRegistry.maxCustomRooms,
        current: RoomRegistry.rooms.size,
        available: Math.max(RoomRegistry.maxCustomRooms - RoomRegistry.rooms.size, 0),
    });
});

server.listen(PORT, () => {
    Logger.info('Server', `Server is running on port ${PORT}`);
});
process.on('unhandledRejection', (reason, p) => { console.error('Unhandled Rejection at:', p, 'reason:', reason); });
