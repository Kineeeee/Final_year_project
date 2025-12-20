const express = require('express');
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

// 1.Connect to Database
connectDB();


// 2.Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));


// 3.Routes
app.use('/api/auth', authRoutes);

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

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
