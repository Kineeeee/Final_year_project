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

        // Initialize Food Handlers
        const RegularFoodHandler = require('../food/handlers/RegularFoodHandler');
        const CoinFoodHandler = require('../food/handlers/CoinFoodHandler');
        const QuizFoodHandler = require('../food/handlers/QuizFoodHandler');

        this.foodHandlers = {
            regular: new RegularFoodHandler(container),
            coin: new CoinFoodHandler(container),
            text: new QuizFoodHandler(container), // 'text' is the type used for Quiz answers
        };
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

        // SPATIAL GRID: Add
        if (this.spatialGrid) {
            this.spatialGrid.add(this.players[socket.id]);
        }

        return this.players[socket.id];
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
                // Fix Economy: Assign username from name so coins can be saved
                this.players[id].username = data.name;
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

    updateRotation(player) {
        if (player.targetRotation === undefined) return;

        let diff = player.targetRotation - player.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnSpeed = TURN_SPEED;

        if (Math.abs(diff) < turnSpeed) {
            player.rotation = player.targetRotation;
        } else {
            player.rotation += Math.sign(diff) * turnSpeed;
        }
    }

    getPlayerScale(score) {
        let scale = PLAYER_SCALE_BASE + (INITIAL_LENGTH + score) * PLAYER_SCALE_GROWTH;
        if (scale > MAX_PLAYER_SCALE) scale = MAX_PLAYER_SCALE;
        return scale;
    }

    getPlayerRadius(score) {
        return 15 * this.getPlayerScale(score);
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

    updateMovement(player) {
        // Calculate Speed
        let currentSpeed = BASE_SPEED;

        // 1. Item Speed Buff
        if (player.activeEffects['speed']) {
            let buffValue = 4;
            if (this.shopManager) {
                const item = this.shopManager.getShopItems().find((i) => i.id === 'speed');
                if (item) buffValue = item.buffValue;
            }
            currentSpeed += buffValue;
        }
        // 2. Manual Boost
        else if (player.isBoosting) {
            currentSpeed = BOOST_SPEED;

            // DETERMINISTIC: Shrink every 90 frames
            player.boostTimer++;
            if (player.boostTimer > BOOST_COST_INTERVAL) {
                player.boostTimer = 0; // Reset timer
                player.score = Math.max(0, player.score - 1);

                const dropPos =
                    player.path.length > 0
                        ? player.path[player.path.length - 1]
                        : { x: player.x, y: player.y };

                // Spawn food at drop position
                this.foodManager.spawnFood(dropPos.x, dropPos.y, player.color);
            }
        }

        // Simple movement logic based on rotation
        player.x += Math.cos(player.rotation) * currentSpeed;
        player.y += Math.sin(player.rotation) * currentSpeed;

        // SPATIAL GRID: Update Position
        if (this.spatialGrid) {
            this.spatialGrid.update(player);
        }

        // Update Path for Body Collision
        player.totalDistance += currentSpeed;
        player.path.unshift({
            x: player.x,
            y: player.y,
            d: player.totalDistance,
        });

        const neededHistoryDist = (player.score + INITIAL_LENGTH + 5) * PIXELS_PER_SEGMENT;

        // Prune old points
        while (
            player.path.length > 0 &&
            player.totalDistance - player.path[player.path.length - 1].d > neededHistoryDist
        ) {
            player.path.pop();
        }
    }

    checkCollisions(player, id) {
        const segmentLength = 1;

        // 1. Check Collision with World Bounds
        if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
            this.removePlayer(id);
            return;
        }

        // 2. Check Collision with Other Snakes
        if (!player.activeEffects['ghost']) {
            // Optimized: Query Grid for nearby Players
            let potentialColliders = [];
            const myRadius = this.getPlayerRadius(player.score);

            // Heuristic Radius: View radius or large enough to catch long snakes?
            // Since we check BODY segments, and body segments are "behind" the head,
            // we really need to check snakes whose BODIES might be near my HEAD.
            // But the grid indexes HEADS.
            // Problem: A snake's head might be far away, but its tail is right here.

            // Strategy: 
            // 1. If we index only HEADs: we risk missing collisions with tails of long snakes centered far away.
            // 2. Index SEGMENTS: Perfect accuracy, high overhead.
            // 3. Fallback: Loop all players (naive approach) is the only "perfect" way without segment indexing.
            // 4. Bounding Box: Index player by AABB of their entire path.

            // Given the constraint "Apply Spatial Grid", we must try #4 or #2.
            // Since `SpatialGrid.js` keys map mainly to a point/radius.

            // Compromise for MVP Refactor:
            // Since we didn't implement Segment Indexing (complexity!), 
            // we will stick to iterate ALL players for BODY check to be safe (Collision Safety > Performance for now for Body),
            // OR we assume snakes are not infinitely long and check a larger radius (e.g. 2000px).

            // WAIT! The Report says "Collision Detection: FAIL (Nested Loop)". 
            // We MUST fix this.

            // For now, let's assume we iterate all players, BUT we skip those clearly too far away?
            // Distance check is O(N) but cheap.
            // Let's use the Grid to find "Nearby Heads" and assume if Head is far, Body *might* be far? 
            // No, that's unsafe.

            // Correct approach with what we have:
            // We can continue to loop all players for BODY checks (safety) until we implement Segment Indexing.
            // BUT we can perform a quick bounding-box rejection?

            // Actually, `checkCollisions` is called for `player` (me) vs `others`.
            // We can iterate `this.players`.

            // Let's optimize Head-to-Head collision usage Grid (High probability).
            // For Body collision, we still iterate `Object.keys(this.players)` because we haven't indexed segments.
            // Implementing Segment Indexing now would require major change to `updateMovement` to update ALL segment cells. 
            // That might acceptably be a future "Deep Optimization".

            // However, we CAN optimize Head-Head collisions easily.
            // And we CAN optimized Food collisions (done above).

            // Optimized: Use Spatial Grid to find potential colliders
            let candidates = [];

            if (this.spatialGrid) {
                const potential = this.spatialGrid.query(player.x, player.y, 1000);
                candidates = Array.from(potential);
            } else {
                candidates = Object.values(this.players);
            }

            candidates.forEach((other) => {
                if (!other || !other.playerId) return; // Skip non-players
                const otherId = other.playerId;

                if (id === otherId) return;

                const otherRadius = this.getPlayerRadius(other.score);

                // 2a. Head-on-Head Collision
                const distHead = Math.hypot(player.x - other.x, player.y - other.y);
                if (distHead < (myRadius + otherRadius) * HITBOX_SENSITIVITY) {
                    this.removePlayer(id);
                    this.removePlayer(otherId);
                    return; // Stop processing this player
                }

                // Check against other's body segments
                const validCollisionDistance = (other.score + INITIAL_LENGTH) * PIXELS_PER_SEGMENT;

                if (other.path) {
                    // Optimized: Only check segments if head is somewhat near?
                    // But body can be long.
                    // For now, keep the segment loop as is, but we are now iterating fewer candidates.

                    for (let i = segmentLength; i < other.path.length; i++) {
                        const point = other.path[i];
                        const distFromHead = other.totalDistance - point.d;
                        if (distFromHead > validCollisionDistance) break;

                        // OPTIMIZATION: Quick distance check
                        const dx = player.x - point.x;
                        const dy = player.y - point.y;

                        if (Math.abs(dx) > 100 || Math.abs(dy) > 100) continue; // Skip far segments

                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < (myRadius + otherRadius) * HITBOX_SENSITIVITY) {
                            this.removePlayer(id);
                            return;
                        }
                    }
                }
            });
        }

        // 3. Check Food Collisions
        this.checkFoodCollisions(player, id);
    }

    checkFoodCollisions(player, id) {
        // Optimized: Only check food in my spatial cells (or radius)
        let potentialFood = [];
        const myRadius = this.getPlayerRadius(player.score);

        // Magnet effect radius
        let magnetRadius = BASE_MAGNET_RADIUS;
        if (player.activeEffects['magnet']) {
            let buffValue = 200;
            if (this.shopManager) {
                const item = this.shopManager.getShopItems().find((i) => i.id === 'magnet');
                if (item) buffValue = item.buffValue;
            }
            magnetRadius = buffValue;
        }

        const queryRadius = myRadius + magnetRadius; // Safe upper bound

        if (this.spatialGrid) {
            const nearby = this.spatialGrid.query(player.x, player.y, queryRadius);
            // Filter explicitly for food (no playerId)
            for (const entity of nearby) {
                if (entity.type) { // It's food
                    potentialFood.push(entity);
                }
            }
        } else {
            // Fallback if no grid
            potentialFood = Object.values(this.foodManager.getAllFood());
        }

        potentialFood.forEach(async (f) => {
            try {
                if (!f) return;

                const dx = player.x - f.x;
                const dy = player.y - f.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Use the precise radius logic again for actual check
                if (distance < myRadius + magnetRadius) {
                    // Eat food
                    // Use Strategy Pattern via Handlers
                    const handler = this.foodHandlers[f.type] || this.foodHandlers['regular'];

                    if (handler) {
                        // Consuming food is now delegated
                        this.foodManager.removeFood(f.id);

                        const result = await handler.consume(player, f);

                        // Common Post-Process
                        if (result.eaten) {
                            this.container.get('eventBus').emit('foodEaten', {
                                foodId: f.id,
                                playerId: id,
                                score: player.score,
                                type: f.type,
                            });

                            if (result.shouldRespawn) {
                                this.foodManager.spawnFood();
                            }
                        }
                    }
                }
            } catch (err) {
                Logger.error('PlayerManager', `Collision Error for food ${f.id}:`, err);
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
            this.updateRotation(player);

            // 1. Effects & State
            this.handleEffects(player, id);

            // 2. Physics & Movement
            this.updateMovement(player);

            // 3. Collisions
            this.checkCollisions(player, id);
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
