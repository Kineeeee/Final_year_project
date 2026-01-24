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
        this.setupSystems();
        this.setupGameLoop();

        Logger.info('GameServer', `Server initialized in mode: ${this.config.mode || 'default'}`);
    }

    setupSystems() {
        const NetworkSystem = require('./systems/NetworkSystem');

        this.networkSystem = new NetworkSystem(this.io, this.container, this.config);
        this.container.register('networkSystem', this.networkSystem);

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

    setupGameLoop() {
        // Main Update Loop (Physics @ 60 FPS)
        setInterval(() => this.update(), 1000 / FPS);

        // Broadcast Loop (Network) - Delegated to NetworkSystem
        // 50% Reduction in traffic without affecting physics precision
        setInterval(() => this.networkSystem.broadcastGameUpdate(), 1000 / BROADCAST_FPS);

        // Food Refill Loop
        setInterval(() => this.foodManager.refillFood(), FOOD_REFILL_INTERVAL);

        // Leaderboard Loop (global)
        setInterval(() => this.networkSystem.broadcastLeaderboard(), 1000 / LEADERBOARD_FPS);
    }

    update() {
        // 1. Update Managers (Physics & Logic)
        if (this.quizManager) this.quizManager.update();
        if (this.botManager) this.botManager.update();
        this.playerManager.update(); // Handles physics for players & bots

        // 2. Network System update (if needed)
        this.networkSystem.update();
    }
}

module.exports = GameServer;
