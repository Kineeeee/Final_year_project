const { FPS, FOOD_REFILL_INTERVAL, BROADCAST_FPS, INTEREST_VIEW_RADIUS, LEADERBOARD_FPS, LEADERBOARD_TOP_N } = require('./config/constants');
const PlayerManager = require('./modules/player/PlayerManager');
const FoodManager = require('./modules/food/FoodManager');
const SpawnManager = require('./modules/player/SpawnManager');
const ShopManager = require('./modules/shop/ShopManager');
const BotManager = require('./modules/bot/BotManager');
const QuizManager = require('./modules/quiz/QuizManager');
const Logger = require('./utils/Logger');

const EVENT = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    PING: 'ping',
    PONG: 'pong',
    PLAYER_INPUT: 'playerInput',
    INIT_PLAYER: 'initPlayer',
    BUY_ITEM: 'buyItem',
    USE_ITEM: 'useItem',
    NEW_PLAYER: 'newPlayer',
    PLAYER_UPDATES: 'playerUpdates',
    CURRENT_PLAYERS: 'currentPlayers',
    CURRENT_FOOD: 'currentFood',
    WORLD_DELTA: 'worldDelta',
    SHOP_ITEMS: 'shopItems',
    NEW_QUESTION: 'newQuestion',
    ROUND_START: 'roundStart'
    ,
    LEADERBOARD: 'leaderboard'
};



class GameServer {
    constructor(io, config = {}) {
        this.io = io;
        this.config = config; // { mode: 'normal'|'quiz', topic: 'math'|'english' }

        // Server-authoritative tick counter for snapshots/deltas
        this.serverTick = 0;

        this.setupManagers();
        this.setupGameLoop();
        this.setupSocketIO();

        Logger.info('GameServer', `Server initialized in mode: ${this.config.mode || 'default'}`);
    }

    /**
     * Initialize and wire up all game managers
     */
    setupManagers() {
        // Import Classes (Not Instances)
        const ServiceContainer = require('./core/ServiceContainer');
        const EventBus = require('./core/EventBus');

        // 1. Create Scoped Instances
        this.container = new ServiceContainer();
        this.eventBus = new EventBus();

        // 2. Initialize Managers (Pass Container)
        this.foodManager = new FoodManager(this.io, this.container);
        this.playerManager = new PlayerManager(this.io, this.container);
        this.shopManager = new ShopManager(this.io, this.container);
        this.spawnManager = new SpawnManager(this.container);

        // 3. Register Services to Scoped Container
        this.container.register('foodManager', this.foodManager);
        this.container.register('playerManager', this.playerManager);
        this.container.register('shopManager', this.shopManager);
        this.container.register('spawnManager', this.spawnManager);
        this.container.register('eventBus', this.eventBus);
        this.container.register('io', this.io); // Register IO service

        // 4. Configure Managers
        this.foodManager.setConfig(this.config);
        this.foodManager.spawnInitialFood();

        // 5. Optional Managers
        if (this.config.mode === 'quiz') {
            this.setupQuizManager();
        }

        if (this.shouldEnableBots()) {
            this.botManager = new BotManager(this.io, this.container);
            this.container.register('botManager', this.botManager);
        }
    }

    setupQuizManager() {
        const QuizManager = require('./modules/quiz/QuizManager'); // Ensure import if not global
        this.quizManager = new QuizManager(this.io, this.container, this.config.topic);
        this.container.register('quizManager', this.quizManager);

        Logger.info('GameServer', `Quiz Mode Enabled: ${this.config.topic}`);
        this.quizManager.startRound();
    }

    shouldEnableBots() {
        return this.config.mode !== 'quiz';
    }

    setupSocketIO() {
        this.io.on(EVENT.CONNECTION, (socket) => this.handleConnection(socket));
    }

    handleConnection(socket) {
        Logger.info('GameServer', `User connected: ${socket.id}`);

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
        socket.broadcast.emit(EVENT.NEW_PLAYER, player);
    }

    sendInitialState(socket) {
        // Send current game state to the new player
        socket.emit(EVENT.CURRENT_PLAYERS, this.playerManager.getAllPlayers());
        socket.emit(EVENT.CURRENT_FOOD, this.foodManager.getAllFood());
        socket.emit(EVENT.SHOP_ITEMS, this.shopManager.getShopItems());

        // Sync Quiz State if active
        if (this.quizManager && this.quizManager.currentQuestion) {
            socket.emit(EVENT.NEW_QUESTION, {
                text: this.quizManager.currentQuestion.questionText,
                difficulty: this.quizManager.currentQuestion.difficulty,
                endTime: this.quizManager.questionEndTime
            });
            socket.emit(EVENT.ROUND_START, {
                endTime: this.quizManager.roundEndTime,
                topic: this.config.topic
            });
        }
    }

    registerSocketEvents(socket) {
        // Disconnect
        socket.on(EVENT.DISCONNECT, () => {
            Logger.info('GameServer', `User disconnected: ${socket.id}`);
            this.playerManager.removePlayer(socket.id);
        });

        // Ping/Pong
        socket.on(EVENT.PING, () => socket.emit(EVENT.PONG));

        // Gameplay
        socket.on(EVENT.PLAYER_INPUT, (inputData) => {
            this.playerManager.handlePlayerInput(socket.id, inputData);
        });

        socket.on(EVENT.INIT_PLAYER, (data) => {
            this.playerManager.handleInitPlayer(socket.id, data);
        });

        // Shop
        socket.on(EVENT.BUY_ITEM, (itemId) => {
            this.shopManager.handleBuyItem(socket.id, itemId);
        });

        socket.on(EVENT.USE_ITEM, (itemId) => {
            this.shopManager.handleUseItem(socket.id, itemId);
        });
    }

    setupGameLoop() {
        // Main Update Loop (Physics @ 60 FPS)
        setInterval(() => this.update(), 1000 / FPS);

        // Broadcast Loop (Network) - Decoupled to save bandwidth
        // 50% Reduction in traffic without affecting physics precision
        setInterval(() => this.broadcastGameUpdate(), 1000 / BROADCAST_FPS);

        // Food Refill Loop
        setInterval(() => this.foodManager.refillFood(), FOOD_REFILL_INTERVAL);

        // Leaderboard Loop (global)
        setInterval(() => this.broadcastLeaderboard(), 1000 / LEADERBOARD_FPS);
    }

    update() {
        // 1. Update Managers (Physics & Logic)
        if (this.quizManager) this.quizManager.update();
        if (this.botManager) this.botManager.update();
        this.playerManager.update(); // Handles physics for players & bots

        // 2. Broadcast State
        // Moved to separate interval above
    }

    broadcastGameUpdate() {
        this.serverTick++;
        const serverTime = Date.now();

        const players = this.playerManager.getAllPlayers();
        const updatePacket = {};

        // Optimize payload: only send necessary data
        for (const id in players) {
            const p = players[id];
            updatePacket[id] = {
                x: Math.round(p.x),
                y: Math.round(p.y),
                rotation: parseFloat(p.rotation.toFixed(2)),
                score: p.score,
                isBoosting: p.isBoosting
            };
        }

        this.io.emit(EVENT.PLAYER_UPDATES, updatePacket);

        // --- New: server-authoritative interest-managed delta (non-breaking, opt-in on client) ---
        this.broadcastWorldDelta({ serverTime });
    }

    broadcastLeaderboard() {
        const players = this.playerManager.getAllPlayers();

        const list = Object.keys(players).map((id) => {
            const p = players[id];
            return {
                id,
                name: p.name || 'Unknown',
                score: p.score || 0
            };
        });

        list.sort((a, b) => b.score - a.score);
        const top = list.slice(0, LEADERBOARD_TOP_N);

        this.io.emit(EVENT.LEADERBOARD, {
            serverTick: this.serverTick,
            serverTime: Date.now(),
            top
        });
    }

    broadcastWorldDelta({ serverTime }) {
        const players = this.playerManager.getAllPlayers();
        const foods = this.foodManager.getAllFood();

        const r = INTEREST_VIEW_RADIUS;
        const r2 = r * r;

        const socketsIter = this.io?.sockets?.sockets?.values
            ? this.io.sockets.sockets.values()
            : (this.io?.sockets?.values ? this.io.sockets.values() : []);

        for (const socket of socketsIter) {
            const me = players[socket.id];
            if (!me) continue;

            if (!socket.data) socket.data = {};
            if (!socket.data._interest) {
                socket.data._interest = { players: new Set(), foods: new Set() };
            }

            const prevPlayers = socket.data._interest.players;
            const prevFoods = socket.data._interest.foods;

            const nextPlayers = new Set();
            const nextFoods = new Set();

            const playersUpsert = {};
            const playersRemove = [];
            const foodsUpsert = {};
            const foodsRemove = [];

            // Players in view
            for (const id in players) {
                const p = players[id];
                const dx = p.x - me.x;
                const dy = p.y - me.y;
                if (dx * dx + dy * dy > r2) continue;

                nextPlayers.add(id);
                playersUpsert[id] = {
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    rotation: parseFloat(p.rotation.toFixed(2)),
                    score: p.score,
                    isBoosting: p.isBoosting,

                    // Non-positional properties needed for correct client rendering
                    name: p.name,
                    color: p.color,
                    activeEffects: p.activeEffects
                };
            }

            // Foods in view (foods are static most of the time; full upsert for in-view is acceptable)
            for (const id in foods) {
                const f = foods[id];
                const dx = f.x - me.x;
                const dy = f.y - me.y;
                if (dx * dx + dy * dy > r2) continue;

                nextFoods.add(id);
                foodsUpsert[id] = {
                    id: f.id,
                    x: f.x,
                    y: f.y,
                    color: f.color,
                    type: f.type,
                    value: f.value,
                    data: f.data
                };
            }

            // Compute removals
            for (const id of prevPlayers) {
                if (!nextPlayers.has(id)) playersRemove.push(id);
            }
            for (const id of prevFoods) {
                if (!nextFoods.has(id)) foodsRemove.push(id);
            }

            // Update interest state
            socket.data._interest.players = nextPlayers;
            socket.data._interest.foods = nextFoods;

            socket.emit(EVENT.WORLD_DELTA, {
                serverTick: this.serverTick,
                serverTime,
                playersUpsert,
                playersRemove,
                foodsUpsert,
                foodsRemove
            });
        }
    }
}

module.exports = GameServer;
