const express = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routers/authRouters.js');

const { PORT, FPS } = require('./src/config/constants');
const PlayerManager = require('./src/managers/PlayerManager');
const FoodManager = require('./src/managers/FoodManager');
const SpawnManager = require('./src/managers/SpawnManager');

const app = express();

// --- cấu hình rate limit ---
// giới hạn toàn bộ API để tránh spam request
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // giới hạn mỗi IP mỗi cửa sổ thời gian
    standardHeaders: true, // gửi thông tin giới hạn trong header `RateLimit-*`
    legacyHeaders: false, // không gửi header `X-RateLimit-*`
    message: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút.'
});
app.use('/api/', limiter);
// --- giới hạn cho login và đăng ký ---
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 10, // giới hạn mỗi IP mỗi cửa sổ thời gian
    message: 'too many login/signup attempts from this IP, please try again after an hour' 
});


// 1.Connect to Database
connectDB();


// 2.Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));


// 3.Routes
app.use('/api/auth', authLimiter, authRoutes);

app.get('/', function (req, res) {
    res.send('Server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Initialize Managers
const foodManager = new FoodManager(io);
const playerManager = new PlayerManager(io, foodManager);
const spawnManager = new SpawnManager(playerManager);

// Circular dependency resolution
playerManager.setSpawnManager(spawnManager);

// Initial Food
foodManager.spawnInitialFood();

io.on('connection', (socket) => {
    console.log('a user connected: ', socket.id);

    // Find safe spawn
    const spawnPos = spawnManager.getSafeSpawnPosition();
    
    // Create player
    const player = playerManager.addPlayer(socket, spawnPos);
    
    // Send initial state to this player
    socket.emit('currentPlayers', playerManager.getAllPlayers());
    socket.emit('currentFood', foodManager.getAllFood());
    
    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', player);

    // Handle Disconnect
    socket.on('disconnect', () => {
        console.log('user disconnected: ', socket.id);
        playerManager.removePlayer(socket.id);
    });

    // Handle Ping
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Handle Input
    socket.on('playerInput', (inputData) => {
        playerManager.handlePlayerInput(socket.id, inputData);
    });

    // Handle Init Player (Name/Color)
    socket.on('initPlayer', (data) => {
        playerManager.handleInitPlayer(socket.id, data);
    });
});

// Game Loop
setInterval(() => {
    // Update Game Logic (Movement, Collision, Bots)
    playerManager.update();

    // Prepare lightweight update packet to reduce bandwidth
    const players = playerManager.getAllPlayers();
    const updatePacket = {};
    Object.keys(players).forEach(id => {
        const p = players[id];
        updatePacket[id] = {
            x: Math.round(p.x),
            y: Math.round(p.y),
            rotation: parseFloat(p.rotation.toFixed(2)),
            score: p.score,
            isBoosting: p.isBoosting,
            name: p.name // Keep for leaderboard
        };
    });

    // Emit the updated state to all players
    io.emit('playerUpdates', updatePacket);
}, 1000 / FPS);

setInterval(() => {
    count = Object.keys(foodManager.getAllFood()).length;
    console.log('Current food count:', count);
},10000); // Every 10 seconds

setInterval(() => {
    foodManager.refillFood();
}, 60000); // Every 60 seconds


server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
