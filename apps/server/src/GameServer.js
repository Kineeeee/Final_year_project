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
        this.closed = false;
        this.intervals = [];

        // Server-authoritative tick counter for snapshots/deltas
        this.serverTick = 0;

        this.setupManagers();
        this.setupSystems();
        this.setupGameLoop();

        Logger.info('GameServer', `Server initialized in mode: ${this.config.mode || 'default'}`);
    }

    setupSystems() {
        const NetworkSystem = require('./core/systems/NetworkSystem');
        const BroadcastSystem = require('./core/systems/BroadcastSystem');

        this.networkSystem = new NetworkSystem(this.io, this.container, this.config);
        this.broadcastSystem = new BroadcastSystem(this.io, this.container, this.config);

        this.container.register('networkSystem', this.networkSystem);
        this.container.register('broadcastSystem', this.broadcastSystem);

        this.networkSystem.initialize();
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

        // 1b. Initialize Spatial Grid (Before Managers use it)
        const { WORLD_SIZE } = require('./config/constants');
        const SpatialGrid = require('./core/SpatialGrid');
        this.spatialGrid = new SpatialGrid(WORLD_SIZE, 500);
        this.container.register('spatialGrid', this.spatialGrid);

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
        this.container.register('gameServer', this); // Register GameServer instance

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
        this.quizManager = new QuizManager(this.io, this.container, this.config.topic, {
            userQuiz: this.config.userQuiz,
            ownerUserId: this.config.ownerUserId,
            lockedSource: !!this.config.userQuiz
        });
        this.container.register('quizManager', this.quizManager);

        Logger.info('GameServer', `Quiz Mode Enabled: ${this.config.topic}`);
        this.quizManager.startRound();
    }

    shouldEnableBots() {
        const { BOT_COUNT } = require('./config/constants');
        return this.config.mode !== 'quiz' && BOT_COUNT > 0;
    }

    setupGameLoop() {
        // Main Update Loop (Physics @ 60 FPS)
        this.intervals.push(setInterval(() => this.update(), 1000 / FPS));

        // Broadcast Loop (Network) - Delegated to BroadcastSystem
        // 50% Reduction in traffic without affecting physics precision
        this.intervals.push(setInterval(() => this.broadcastSystem.broadcastGameUpdate(), 1000 / BROADCAST_FPS));

        // Food Refill Loop
        this.intervals.push(setInterval(() => this.foodManager.refillFood(), FOOD_REFILL_INTERVAL));

        // Leaderboard Loop (global)
        this.intervals.push(setInterval(() => this.broadcastSystem.broadcastLeaderboard(), 1000 / LEADERBOARD_FPS));
    }

    update() {
        // 1. Update Managers (Physics & Logic)
        if (this.quizManager) this.quizManager.update();
        if (this.botManager) this.botManager.update();
        this.playerManager.update(); // Handles physics for players & bots

        // 2. Network System update (if needed)
        this.networkSystem.update();
    }

    destroy() {
        if (this.closed) return;
        this.closed = true;
        this.intervals.forEach((h) => clearInterval(h));
        this.intervals = [];
        if (this.quizManager && this.quizManager.cleanupTimer) {
            clearInterval(this.quizManager.cleanupTimer);
        }
        this.io.disconnectSockets(true);
    }
}

module.exports = GameServer;
