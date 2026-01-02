const { FPS } = require('./config/constants');
const PlayerManager = require('./managers/PlayerManager');
const FoodManager = require('./managers/FoodManager');
const SpawnManager = require('./managers/SpawnManager');
const ShopManager = require('./managers/ShopManager');
const BotManager = require('./managers/BotManager');
const Logger = require('./utils/Logger');

class GameServer {
    constructor(io) {
        this.io = io;

        // Initialize Managers
        this.foodManager = new FoodManager(io);
        this.playerManager = new PlayerManager(io, this.foodManager);
        this.spawnManager = new SpawnManager(this.playerManager);
        this.shopManager = new ShopManager(io, this.playerManager);
        this.botManager = new BotManager(io, this.playerManager, this.foodManager, this.spawnManager);

        // Circular Dependencies / Manual Injection

        this.playerManager.setShopManager(this.shopManager);

        // State Interaction
        // Initial Food
        this.foodManager.spawnInitialFood();

        this.setupSocketIO();
        this.startGameLoop();
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            Logger.info('GameServer', `User connected: ${socket.id}`);

            // Find safe spawn
            const spawnPos = this.spawnManager.getSafeSpawnPosition();

            // Create player
            const player = this.playerManager.addPlayer(socket, spawnPos);

            // Send initial state to this player
            socket.emit('currentPlayers', this.playerManager.getAllPlayers());
            socket.emit('currentFood', this.foodManager.getAllFood());
            // Send shop items (now handled via ShopManager but we can emit directly here too)
            socket.emit('shopItems', this.shopManager.getShopItems());

            // Broadcast new player to others
            socket.broadcast.emit('newPlayer', player);

            // Handle Disconnect
            socket.on('disconnect', () => {
                Logger.info('GameServer', `User disconnected: ${socket.id}`);
                this.playerManager.removePlayer(socket.id);
            });

            // Handle Ping
            socket.on('ping', () => {
                socket.emit('pong');
            });

            // Handle Input
            socket.on('playerInput', (inputData) => {
                this.playerManager.handlePlayerInput(socket.id, inputData);
            });

            // Handle Init Player (Name/Color)
            socket.on('initPlayer', (data) => {
                this.playerManager.handleInitPlayer(socket.id, data);
            });

            // Shop Events
            socket.on('buyItem', (itemId) => {
                this.shopManager.handleBuyItem(socket.id, itemId);
            });

            socket.on('useItem', (itemId) => {
                this.shopManager.handleUseItem(socket.id, itemId);
            });
        });
    }

    startGameLoop() {
        setInterval(() => {
            this.update();
        }, 1000 / FPS);

        // Food Refill Loop
        setInterval(() => {
            this.foodManager.refillFood();
        }, 15000); // Every 15 seconds
    }

    update() {
        // Update Bot Logic
        this.botManager.update();

        // Update Physics & Collision (PlayerManager now handles physics for AI bots too)
        this.playerManager.update();

        // Prepare lightweight update packet
        const players = this.playerManager.getAllPlayers();
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

        // Emit updates
        this.io.emit('playerUpdates', updatePacket);
    }
}

module.exports = GameServer;
