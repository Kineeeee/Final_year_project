const Logger = require('../../utils/Logger');
const RedisClient = require('../../infra/database/RedisConnection');
const { SOCKET_EVENT } = require('../../events/EventTypes');

class NetworkSystem {
    constructor(io, container, config) {
        this.io = io;
        this.container = container;
        this.config = config;
    }

    get playerManager() { return this.container.get('playerManager'); }
    get foodManager() { return this.container.get('foodManager'); }
    get shopManager() { return this.container.get('shopManager'); }
    get spawnManager() { return this.container.get('spawnManager'); }
    get quizManager() { return this.container.has('quizManager') ? this.container.get('quizManager') : null; }

    async initialize() {
        await RedisClient.connect();
        this.io.on(SOCKET_EVENT.CONNECTION, (socket) => this.handleConnection(socket));
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        const bus = this.container.get('eventBus');

        // Player Events
        bus.on('playerDied', (data) => this.io.emit('playerDied', data));
        bus.on('playerDisconnected', (id) => this.io.emit('playerDisconnected', id));
        bus.on('playerProperties', (data) => this.io.emit('playerProperties', data));
        bus.on('resetScores', () => this.io.emit('resetScores'));

        // Private Player Events (Targeted)
        bus.on('updateHighScore', ({ socketId, highScore }) => this.io.to(socketId).emit('updateHighScore', highScore));
        bus.on('updateCoins', ({ socketId, coins }) => this.io.to(socketId).emit('updateCoins', coins));
        bus.on('updateInventory', ({ socketId, inventory }) => this.io.to(socketId).emit('updateInventory', inventory));
        bus.on('playerState', ({ socketId, data }) => this.io.to(socketId).emit('playerState', data));
        bus.on('shopItems', ({ socketId, items }) => this.io.to(socketId).emit('shopItems', items));

        // Food/Items
        bus.on('batchFood', (batch) => this.io.emit('batchFood', batch));
        bus.on('itemDeactivated', (data) => this.io.emit('itemDeactivated', data));
        bus.on('foodEaten', (data) => this.io.emit('foodEaten', data));
        bus.on('notifyPlayerDeath', ({ socketId, data }) => this.io.to(socketId).emit('playerDied', data));
    }

    handleConnection(socket) {
        Logger.info('NetworkSystem', `User connected: ${socket.id}`);

        // Per-socket interest tracking (used for worldDelta)
        if (!socket.data) socket.data = {};
        socket.data._interest = {
            players: new Set(),
            foods: new Set()
        };

        this.initializePlayer(socket);
        this.sendInitialState(socket);
        this.registerSocketEvents(socket);
    }

    initializePlayer(socket) {
        // Find safe spawn and create player
        const spawnPos = this.spawnManager.getSafeSpawnPosition();
        const player = this.playerManager.addPlayer(socket, spawnPos);

        // Broadcast to others
        socket.broadcast.emit(SOCKET_EVENT.NEW_PLAYER, player);
    }

    sendInitialState(socket) {
        // Send current game state to the new player
        socket.emit(SOCKET_EVENT.CURRENT_PLAYERS, this.playerManager.getAllPlayers());
        socket.emit(SOCKET_EVENT.CURRENT_FOOD, this.foodManager.getAllFood());
        socket.emit(SOCKET_EVENT.SHOP_ITEMS, this.shopManager.getShopItems());

        // Sync Quiz State if active
        if (this.quizManager && this.quizManager.currentQuestion) {
            socket.emit(SOCKET_EVENT.NEW_QUESTION, {
                text: this.quizManager.currentQuestion.questionText,
                difficulty: this.quizManager.currentQuestion.difficulty,
                endTime: this.quizManager.questionEndTime
            });
            socket.emit(SOCKET_EVENT.ROUND_START, {
                endTime: this.quizManager.roundEndTime,
                topic: this.config.topic
            });
        }
    }

    registerSocketEvents(socket) {
        // Disconnect
        socket.on(SOCKET_EVENT.DISCONNECT, () => {
            Logger.info('NetworkSystem', `User disconnected: ${socket.id}`);
            this.playerManager.removePlayer(socket.id);
        });

        // Ping/Pong
        socket.on(SOCKET_EVENT.PING, () => socket.emit(SOCKET_EVENT.PONG));

        // Gameplay
        socket.on(SOCKET_EVENT.PLAYER_INPUT, (inputData) => {
            // Anti-Spam: Rate Limit (60 packets/sec max)
            const now = Date.now();
            if (!socket.rateLimit) socket.rateLimit = { count: 0, lastCheck: now };

            if (now - socket.rateLimit.lastCheck > 1000) {
                socket.rateLimit.count = 0;
                socket.rateLimit.lastCheck = now;
            }

            socket.rateLimit.count++;
            if (socket.rateLimit.count > 60) {
                return;
            }

            this.playerManager.handlePlayerInput(socket.id, inputData);
        });

        socket.on(SOCKET_EVENT.INIT_PLAYER, (data) => {
            this.playerManager.handleInitPlayer(socket.id, data);
        });

        // Shop
        socket.on(SOCKET_EVENT.BUY_ITEM, (itemId) => {
            this.shopManager.handleBuyItem(socket.id, itemId);
        });

        socket.on(SOCKET_EVENT.USE_ITEM, (itemId) => {
            this.shopManager.handleUseItem(socket.id, itemId);
        });
    }

    update() {
        // Reserved for any input polling logic
    }
}

module.exports = NetworkSystem;
