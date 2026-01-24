const Logger = require('../utils/Logger');
const RedisClient = require('../config/RedisClient');
const { BROADCAST_FPS, LEADERBOARD_FPS, LEADERBOARD_TOP_N, INTEREST_VIEW_RADIUS } = require('../config/constants');

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
    ROUND_START: 'roundStart',
    LEADERBOARD: 'leaderboard'
};

class NetworkSystem {
    constructor(io, container, config) {
        this.io = io;
        this.container = container;
        this.config = config;

        // Tick state
        this.serverTick = 0;
    }

    get playerManager() { return this.container.get('playerManager'); }
    get foodManager() { return this.container.get('foodManager'); }
    get shopManager() { return this.container.get('shopManager'); }
    get spawnManager() { return this.container.get('spawnManager'); }
    get quizManager() { return this.container.has('quizManager') ? this.container.get('quizManager') : null; }
    get spatialGrid() { return this.container.get('spatialGrid'); }

    async initialize() {
        await RedisClient.connect();
        this.io.on(EVENT.CONNECTION, (socket) => this.handleConnection(socket));
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
            Logger.info('NetworkSystem', `User disconnected: ${socket.id}`);
            this.playerManager.removePlayer(socket.id);
        });

        // Ping/Pong
        socket.on(EVENT.PING, () => socket.emit(EVENT.PONG));

        // Gameplay
        socket.on(EVENT.PLAYER_INPUT, (inputData) => {
            // Anti-Spam: Rate Limit (60 packets/sec max)
            const now = Date.now();
            if (!socket.rateLimit) socket.rateLimit = { count: 0, lastCheck: now };

            if (now - socket.rateLimit.lastCheck > 1000) {
                socket.rateLimit.count = 0;
                socket.rateLimit.lastCheck = now;
            }

            socket.rateLimit.count++;
            if (socket.rateLimit.count > 60) {
                // Drop packet silently to punish flooding
                return;
            }

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

    // --- Broadcast Loops ---

    update() {
        // This is called every Game Loop tick (not used for broadcast currently, but reserved)
    }

    broadcastGameUpdate() {
        this.serverTick++;
        const serverTime = Date.now();

        // Broadcast World Delta (Binary Protocol)

        // Sync Scores to Redis (Throttled or Full Speed?)
        // Originally this ran at BROADCAST_FPS (30).
        // Let's keep it for now to ensure Leaderboard works, but purely for Redis.
        const players = this.playerManager.getAllPlayers();
        const lbKey = 'leaderboard:' + (this.config.topic || this.config.mode);

        // Optimization: Batch Redis zAdd? Or just loop. Loop is fine for <100 users.
        for (const id in players) {
            const p = players[id];
            // Only update if score > 0 to save bandwidth?
            RedisClient.zAdd(lbKey, p.score, p.name || `Player-${id}`);
        }

        // --- New: server-authoritative interest-managed delta (non-breaking, opt-in on client) ---
        this.broadcastWorldDelta({ serverTime });
    }

    async broadcastLeaderboard() {
        // Fetch from Redis
        try {
            const lbKey = 'leaderboard:' + (this.config.topic || this.config.mode);
            const topWithScores = await RedisClient.zRevRangeWithScores(lbKey, 0, LEADERBOARD_TOP_N - 1);

            // Map Redis format [{value, score}, ...] to internal format
            const top = topWithScores.map((entry, index) => ({
                id: `rank_${index}`, // Redis doesn't store ID easily unless member is "id:name"
                name: entry.value,
                score: entry.score
            }));

            this.io.emit(EVENT.LEADERBOARD, {
                serverTick: this.serverTick,
                serverTime: Date.now(),
                top
            });
        } catch (err) {
            Logger.error('NetworkSystem', 'Leaderboard Redis Error', err);
        }
    }

    broadcastWorldDelta({ serverTime }) {
        const players = this.playerManager.getAllPlayers();

        // We still need food list? No, we use Grid now.
        // const foods = this.foodManager.getAllFood();

        // Calculate Ranks
        const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
        sortedPlayers.forEach((p, i) => {
            p.rank = i + 1;
        });

        const r = INTEREST_VIEW_RADIUS;
        const r2 = r * r;

        try {
            const socketsIter = this.io?.sockets?.sockets?.values
                ? this.io.sockets.sockets.values()
                : (this.io?.sockets?.values ? this.io.sockets.values() : []);

            // DEBUG: Check socket count
            // if (this.serverTick % 300 === 0) Logger.info('NetworkSystem', `Broadcasting to sockets...`);

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

                const playersUpsert = [];
                const playersRemove = [];
                const foodsUpsert = [];
                const foodsRemove = [];

                // Spatial Grid Query
                // Note: If SpatialGrid is missing (not registered yet?), this will crash.
                // Assuming it is registered.
                if (!this.spatialGrid) {
                    // Fallback or skip?
                    Logger.warn('NetworkSystem', 'SpatialGrid missing in broadcastWorldDelta');
                    continue;
                }

                const nearbyEntities = this.spatialGrid.query(me.x, me.y, r);
                // DEBUG: Log query results for first player occasionally
                if (this.serverTick % 300 === 0 && Math.random() < 0.1) {
                    Logger.info('NetworkSystem', `Query for ${me.name}: found ${nearbyEntities.size || nearbyEntities.length} entities`);
                }

                for (const entity of nearbyEntities) {
                    // Determine if Player or Food based on properties
                    // Players have `playerId`
                    if (entity.playerId) {
                        const id = entity.playerId;

                        // Optimization: Check exact distance again to be precise with circle view
                        const dx = entity.x - me.x;
                        const dy = entity.y - me.y;
                        if (dx * dx + dy * dy > r2) continue;

                        nextPlayers.add(id);
                        const p = entity;

                        // Players - Pack as Binary Array [id, x, y, rot, score, boost, name, color, activeEffects]
                        playersUpsert.push([
                            id,
                            Math.round(p.x),
                            Math.round(p.y),
                            parseFloat(p.rotation.toFixed(2)),
                            p.score,
                            p.isBoosting ? 1 : 0,
                            p.name,
                            p.color,
                            p.activeEffects
                        ]);
                    }
                    // Foods - Pack as Binary Array [id, x, y, type, value, color, data]
                    else if (entity.id && entity.type) {
                        const f = entity;
                        const dx = f.x - me.x;
                        const dy = f.y - me.y;
                        if (dx * dx + dy * dy > r2) continue;

                        nextFoods.add(f.id);

                        // Binary Schema: [id, x, y, type, value, color, data]
                        foodsUpsert.push([
                            f.id,
                            f.x,
                            f.y,
                            f.type,
                            f.value,
                            f.color,
                            f.data
                        ]);
                    }
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

                // Send Binary Packet (Array)
                // Appending myRank and totalPlayers
                socket.emit(EVENT.WORLD_DELTA, [
                    this.serverTick,
                    serverTime,
                    playersUpsert,
                    playersRemove,
                    foodsUpsert,
                    foodsRemove,
                    me.rank || 0,
                    sortedPlayers.length
                ]);
                // DEBUG: Log emit for debug bot
                if (me.name === 'DebugBot') {
                    Logger.info('NetworkSystem', `Sent worldDelta to DebugBot. Upsert: ${playersUpsert.length}`);
                }
            }
        } catch (err) {
            Logger.error('NetworkSystem', 'broadcastWorldDelta Error', err);
        }
    }
}

module.exports = NetworkSystem;
