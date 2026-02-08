const RedisClient = require('../../infra/database/RedisConnection');
const {
    WORLD_SIZE,
    BASE_SPEED,
    BOOST_SPEED,
    TURN_SPEED,
    PIXELS_PER_SEGMENT,
    INITIAL_LENGTH,
    ITEMS,
    // Cleanup Constants
    HITBOX_SENSITIVITY,
    BASE_MAGNET_RADIUS,
    BOOST_COST_INTERVAL,
    MAX_PLAYER_SCALE,
    PLAYER_SCALE_BASE,
    PLAYER_SCALE_GROWTH,
    COIN_CONFIG,
} = require('../../config/constants');
const UserRepository = require('../../repositories/UserRepository');
const Logger = require('../../utils/Logger');

class PlayerManager {
    constructor(io, container) {
        // this.io = io; // Decoupled: Use EventBus via container

        this.container = container;
        this.players = {};

        // Lazy getters for dependencies to avoid circular init issues
        // or resolve them in a 'init' method if preferred.
        // For now, we'll access them via Container.get() when needed

        // Initialize Systems
        const MovementSystem = require('../../core/systems/MovementSystem');
        const CollisionSystem = require('../../core/systems/CollisionSystem');

        this.movementSystem = new MovementSystem(container);
        this.collisionSystem = new CollisionSystem(container);
    }

    get foodManager() {
        return this.container.get('foodManager');
    }
    get shopManager() {
        return this.container.get('shopManager');
    }
    get quizManager() {
        if (this.container.has('quizManager')) {
            return this.container.get('quizManager');
        }
        return null;
    }

    get spatialGrid() {
        return this.container.get('spatialGrid');
    }

    async updatePlayerScore(player, delta) {
        player.score += delta;
        if (player.score < 0) player.score = 0;

        // Atomic update to Redis ZSET
        const lbKey = 'leaderboard:' + (this.container.get('gameServer').config.topic || this.container.get('gameServer').config.mode);
        const redisId = player.isBot ? `b:${player.id}` : `p:${player.id}`;

        try {
            // Optimistic: Fire and forget or quick await
            RedisClient.zIncrBy(lbKey, delta, redisId).catch(err => {
                Logger.warn('PlayerManager', `Redis Score Update Error for ${redisId}`, err.message);
            });
        } catch (err) {
            // Sync error check
        }
    }

    addPlayer(socket, spawnPos) {
        this.players[socket.id] = {
            rotation: 0,
            targetRotation: 0,
            x: spawnPos.x,
            y: spawnPos.y,
            id: socket.id, // Compatible with SpatialGrid
            playerId: socket.id,
            team: Math.floor(Math.random() * 2) == 0 ? 'red' : 'blue',
            score: 0, // Initial score/length
            path: [], // History of positions for body collision
            totalDistance: 0, // Track total distance for accurate path pruning
            name: 'Player ' + Math.floor(Math.random() * 1000),
            color: Math.floor(Math.random() * 0xffffff),
            isBoosting: false,
            wantsToBoost: false,
            coins: 0, // Track session coins for Guest/Economy
            inventory: {}, // itemId -> count
            activeEffects: {}, // itemId -> expireTime (ms)
            boostTimer: 0, // Deterministic shrink counter
        };

        // Register in Redis
        const gameConfig = this.container.get('gameServer').config;
        const metaKey = 'leaderboard:meta:' + (gameConfig.topic || gameConfig.mode);
        const redisId = `p:${socket.id}`;
        RedisClient.hSet(metaKey, redisId, this.players[socket.id].name).catch(err =>
            Logger.error('PlayerManager', `Meta Register Error for ${redisId}`, err)
        );

        // SPATIAL GRID: Add
        if (this.spatialGrid) {
            this.spatialGrid.add(this.players[socket.id]);
        }

        return this.players[socket.id];
    }

    addBot(botData) {
        const id = botData.id;
        this.players[id] = botData;

        // Register in Redis (Bot)
        const gameConfig = this.container.get('gameServer').config;
        const lbKey = 'leaderboard:' + (gameConfig.topic || gameConfig.mode);
        const metaKey = 'leaderboard:meta:' + (gameConfig.topic || gameConfig.mode);
        const redisId = `b:${id}`;

        RedisClient.hSet(metaKey, redisId, botData.name).catch(err =>
            Logger.error('PlayerManager', `Bot Meta Register Error for ${redisId}`, err)
        );
        // Initial Score for Bot
        RedisClient.zAdd(lbKey, botData.score, redisId).catch(err =>
            Logger.error('PlayerManager', `Bot ZSET Register Error for ${redisId}`, err)
        );

        // SPATIAL GRID: Add
        if (this.spatialGrid) {
            this.spatialGrid.add(this.players[id]);
        }

        // Broadcast New Player (Bot)
        // Access IO via networkSystem or just emit via container if possible?
        // PlayerManager doesn't have direct IO usually if decoupled, but constructor has io?
        // Constructor comment says: // this.io = io; // Decoupled: Use EventBus
        // But the original BotManager used `this.io.emit('newPlayer')`.
        // Let's see how `addPlayer` does it. `NetworkSystem` calls `addPlayer` then `socket.broadcast.emit(...)`.
        // So `PlayerManager` itself does NOT emit `newPlayer` in `addPlayer`.
        // We should emit `newPlayer` here if no one else does.
        // But `PlayerManager` has no `io`.
        // We can use `EventBus` to emit 'botSpawned'? No, `NetworkSystem` listens to EventBus?
        // `NetworkSystem` has `bus.on('playerDied', ...)` but not `newPlayer`.
        // Let's check `NetworkSystem` setup.
        // It has `socket.broadcast.emit(SOCKET_EVENT.NEW_PLAYER, player);` in `initializePlayer`.

        // So for Bots, we need a way to broadcast.
        // We can emit 'playerJoined' on EventBus and have NetworkSystem handle it?
        // `NetworkSystem` usually handles socket events.
        // Let's check `NetworkSystem.setupEventBusListeners`.
        // It does NOT have `playerJoined`.

        // WE need to add `playerJoined` to NetworkSystem or similar.
        // OR rely on `BroadcastSystem` to pick it up in next tick?
        // `BroadcastSystem` sends Deltas. `NEW_PLAYER` is for specific "Hello new player" or "Here is a new guy".
        // Actually `NEW_PLAYER` is helpful for clients to add sprite immediately.

        // I will emit an event on EventBus and assume I will update NetworkSystem to listen to it.
        this.container.get('eventBus').emit('botJoined', botData);

        return this.players[id];
    }

    removePlayer(playerId) {
        const player = this.players[playerId];
        if (!player) return;

        if (!player.isBot) {
            Logger.info('PlayerManager', `Player died: ${playerId}`);
        }

        // Convert body to food
        if (player.path) {
            this.convertBodyToFood(player);
        }

        // Remove player
        // SPATIAL GRID: Remove
        if (this.spatialGrid && this.players[playerId]) {
            this.spatialGrid.remove(this.players[playerId]);
        }
        delete this.players[playerId];

        // Notify the dead player specifically (so they see Game Over)
        if (!player.isBot) {
            this.container.get('eventBus').emit('notifyPlayerDeath', { socketId: playerId, data: playerId });

            // Economy: Save coins one last time just in case
            if (player.username && !player.username.startsWith('Guest_')) {
                // Use Repository
                UserRepository.updateHighScore(player.username, player.score)
                    .then((user) => {
                        if (user && user.highScore === player.score) {
                            // Only log/emit if it was actually a new high score (or equal)
                            // The Repo logic updates only if higher.
                            // To be perfectly faithful to original feedback:
                            // Original emitted 'updateHighScore' whenever it SAVED.
                            // Accessing user.highScore is safe.
                            Logger.info(
                                'PlayerManager',
                                `High Score Check/Update for ${user.username}: ${user.highScore}`
                            );
                            this.container.get('eventBus').emit('updateHighScore', { socketId: playerId, highScore: user.highScore });
                        }
                    })
                    .catch((err) => Logger.error('PlayerManager', 'Save High Score Error:', err));
            }
        }

        // Notify everyone else that this player is gone (so they remove the snake)
        this.container.get('eventBus').emit('playerDisconnected', playerId);
    }

    handlePlayerInput(id, inputData) {
        try {
            if (this.players[id]) {
                // DEBUG: Trace Input
                // if (Math.random() < 0.01) 
                Logger.info('PlayerManager', `Input from ${id}: angle=${inputData.angle}`);

                // Validate Input
                if (typeof inputData.angle === 'number' && !isNaN(inputData.angle)) {
                    this.players[id].targetRotation = inputData.angle;
                }
                // Update boosting state (Input Request)
                this.players[id].wantsToBoost = !!inputData.isBoosting;
            }
        } catch (error) {
            Logger.error('PlayerManager', 'Error handling playerInput:', error);
        }
    }

    handleInitPlayer(id, data) {
        if (this.players[id]) {
            if (data.color) {
                this.players[id].color = data.color;
            }
            if (data.name) {
                this.players[id].name = data.name;
            }

            // SECURITY: Use verified username if passed from NetworkSystem
            if (data.username) {
                this.players[id].username = data.username;
            } else if (data.name) {
                // Fallback/Legacy (likely Guest)
                this.players[id].username = data.name;
            }

            // Update Name in Redis
            if (this.players[id].username) {
                const gameConfig = this.container.get('gameServer').config;
                const metaKey = 'leaderboard:meta:' + (gameConfig.topic || gameConfig.mode);
                const redisId = this.players[id].isBot ? `b:${id}` : `p:${id}`;
                RedisClient.hSet(metaKey, redisId, this.players[id].name).catch(err =>
                    Logger.error('PlayerManager', `Meta Update Error for ${redisId}`, err)
                );
            }
            // Inventory Logic: Priority to DB for logged-in users
            const isGuest =
                !this.players[id].username || this.players[id].username.startsWith('Guest_');

            if (!isGuest) {
                Logger.info(
                    'PlayerManager',
                    `handleInitPlayer: Loading DB for ${this.players[id].username}`
                );
                // Load from DB if verified user
                UserRepository.findByUsername(this.players[id].username)
                    .then((user) => {
                        if (user) {
                            Logger.info(
                                'PlayerManager',
                                `Found user in DB: ${user.username}, coins: ${user.coins}`
                            );
                            this.players[id].coins = user.coins;

                            // Load Inventory (Array -> Object)
                            if (user.inventory && Array.isArray(user.inventory)) {
                                this.players[id].inventory = {};
                                user.inventory.forEach((item) => {
                                    this.players[id].inventory[item.itemId] = item.quantity;
                                });
                            }

                            // Emit updates
                            const bus = this.container.get('eventBus');
                            bus.emit('updateCoins', { socketId: id, coins: this.players[id].coins });
                            bus.emit('updateInventory', { socketId: id, inventory: this.players[id].inventory });

                            bus.emit('playerState', {
                                socketId: id,
                                data: {
                                    coins: this.players[id].coins,
                                    inventory: this.players[id].inventory,
                                    id: id,
                                    color: this.players[id].color,
                                    name: this.players[id].name,
                                    highScore: user.highScore,
                                }
                            });

                            // Send Shop Items from DB (delegated via ShopManager potentially, but here directly or via ShopManager)
                            if (this.shopManager) {
                                bus.emit('shopItems', { socketId: id, items: this.shopManager.getShopItems() });
                            }
                        } else {
                            Logger.warn(
                                'PlayerManager',
                                `User not found in DB: ${this.players[id].username}`
                            );
                        }
                    })
                    .catch((err) => Logger.error('PlayerManager', `DB Error: ${err}`));
            } else {
                // Guest: Use client sent data
                if (data.inventory) {
                    this.players[id].inventory = data.inventory;
                }
                if (data.coins) {
                    const parsed = parseInt(data.coins);
                    this.players[id].coins = isNaN(parsed) ? 0 : Math.max(0, parsed);
                }
            }

            // Broadcast the updated properties to everyone so they see the new color
            this.container.get('eventBus').emit('playerProperties', {
                id: id,
                color: this.players[id].color,
                name: this.players[id].name,
            });
        }
    }



    handleEffects(player, id) {
        const now = Date.now();

        // Boost Logic with Hysteresis
        if (!player.isBoosting && player.wantsToBoost && player.score > 5) {
            player.isBoosting = true;
        } else if (player.isBoosting && (!player.wantsToBoost || player.score <= 2)) {
            player.isBoosting = false;
        }

        // Manage Active Effects
        Object.keys(player.activeEffects).forEach((effectId) => {
            if (player.activeEffects[effectId] < now) {
                delete player.activeEffects[effectId];
                this.container.get('eventBus').emit('itemDeactivated', { playerId: id, itemId: effectId });
            }
        });
    }



    update() {
        // NOTE: Bot spawning and AI Update is now handled by BotManager externally
        // This update() only handles physics, collision, and state for ALL players

        Object.keys(this.players).forEach((id) => {
            const player = this.players[id];
            if (!player) return;

            // Apply rotation smoothing for everyone (Bots AND Players)
            this.movementSystem.updateRotation(player);

            // 1. Effects & State
            this.handleEffects(player, id);

            // 2. Physics & Movement
            this.movementSystem.updateMovement(player, this);

            // 3. Collisions
            this.collisionSystem.checkCollisions(player, id);
        });
    }

    getAllPlayers() {
        return this.players;
    }

    resetScores() {
        Object.values(this.players).forEach((p) => {
            p.score = 0;
            // Also reset length/sections if needed, but score=0 usually implies restart
            if (p.sections && p.sections.length > 0) {
                while (p.sections.length > 5) {
                    p.sections.pop(); // Reset to base length
                }
            }
        });
        // Notify all clients to reset local score display
        this.container.get('eventBus').emit('resetScores'); // Helper event (Client needs to handle this)
    }

    killAllPlayers() {
        Object.keys(this.players).forEach((id) => {
            const player = this.players[id];
            player.alive = false;
            // Emit death event
            this.container.get('eventBus').emit('playerDied', { playerId: id });

            // Clean up player from map (optional, or wait for them to reconnect?)
            // Usually we keep the socket connection but reset their state to 'dead'
            // In this game, death usually means respawn screen.

            // Note: We don't necessarily disconnect them, just kill their snake.
        });
        // Reset internal list? Or wait for disconnect?
        // If we clear this.players, we lose socket mapping.
        // Better to just mark dead. The client will show GameOver scene.
    }

    convertBodyToFood(player) {
        const foodBatch = [];
        for (let i = 0; i < player.path.length; i += 4 * 2) {
            const point = player.path[i];
            const fx = point.x + (Math.random() * 20 - 10);
            const fy = point.y + (Math.random() * 20 - 10);

            // 50% chance for Coin
            const isCoin = Math.random() < 0.5;

            let newFood;
            if (isCoin) {
                newFood = this.foodManager.spawnFood(
                    fx,
                    fy,
                    null,
                    'coin',
                    COIN_CONFIG.VALUE,
                    null,
                    false
                );
            } else {
                newFood = this.foodManager.spawnFood(fx, fy, null, 'regular', 1, null, false);
            }

            if (newFood) {
                foodBatch.push(newFood);
            }
        }

        if (foodBatch.length > 0) {
            this.container.get('eventBus').emit('batchFood', foodBatch);
        }
    }
}

module.exports = PlayerManager;
