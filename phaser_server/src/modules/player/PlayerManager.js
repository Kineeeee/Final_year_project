// Core Modules
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
    PLAYER_SCALE_GROWTH
} = require('../../config/constants');
const UserRepository = require('../../repositories/UserRepository');
const Logger = require('../../utils/Logger');

class PlayerManager {
    constructor(io, container) {
        this.io = io;
        this.container = container;
        this.players = {};

        // Lazy getters for dependencies to avoid circular init issues
        // or resolve them in a 'init' method if preferred.
        // For now, we'll access them via Container.get() when needed
    }

    get foodManager() { return this.container.get('foodManager'); }
    get shopManager() { return this.container.get('shopManager'); }
    get quizManager() {
        if (this.container.has('quizManager')) {
            return this.container.get('quizManager');
        }
        return null;
    }

    addPlayer(socket, spawnPos) {
        this.players[socket.id] = {
            rotation: 0,
            targetRotation: 0,
            x: spawnPos.x,
            y: spawnPos.y,
            playerId: socket.id,
            team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
            score: 0, // Initial score/length
            path: [], // History of positions for body collision
            totalDistance: 0, // Track total distance for accurate path pruning
            name: "Player " + Math.floor(Math.random() * 1000),
            color: Math.floor(Math.random() * 0xFFFFFF),
            isBoosting: false,
            wantsToBoost: false,
            coins: 0, // Track session coins for Guest/Economy
            inventory: {}, // itemId -> count
            activeEffects: {}, // itemId -> expireTime (ms)
            boostTimer: 0 // Deterministic shrink counter
        };
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
            const foodBatch = [];
            for (let i = 0; i < player.path.length; i += 4 * 2) {
                const point = player.path[i];
                const fx = point.x + (Math.random() * 20 - 10);
                const fy = point.y + (Math.random() * 20 - 10);

                // TỈ LỆ RƠI COIN: 50% cơ hội mỗi đốt thân sẽ biến thành Coin
                const isCoin = Math.random() < 0.5;

                let newFood;
                if (isCoin) {
                    newFood = this.foodManager.spawnFood(fx, fy, null, 'coin', 10, null, false); // Batch: don't emit yet
                } else {
                    newFood = this.foodManager.spawnFood(fx, fy, null, 'regular', 1, null, false); // Batch: don't emit yet
                }

                if (newFood) {
                    foodBatch.push(newFood);
                }
            }

            if (foodBatch.length > 0) {
                this.io.emit('batchFood', foodBatch);
            }
        }

        // Remove player
        delete this.players[playerId];

        // Notify the dead player specifically (so they see Game Over)
        if (!player.isBot) {
            this.io.to(playerId).emit('playerDied', playerId);

            // Economy: Save coins one last time just in case
            if (player.username && !player.username.startsWith('Guest_')) {
                // Use Repository
                UserRepository.updateHighScore(player.username, player.score)
                    .then(user => {
                        if (user && user.highScore === player.score) {
                            // Only log/emit if it was actually a new high score (or equal)
                            // The Repo logic updates only if higher.
                            // To be perfectly faithful to original feedback:
                            // Original emitted 'updateHighScore' whenever it SAVED.
                            // Accessing user.highScore is safe.
                            Logger.info('PlayerManager', `High Score Check/Update for ${user.username}: ${user.highScore}`);
                            this.io.to(playerId).emit('updateHighScore', user.highScore);
                        }
                    })
                    .catch(err => Logger.error('PlayerManager', "Save High Score Error:", err));
            }
        }

        // Notify everyone else that this player is gone (so they remove the snake)
        this.io.emit('playerDisconnected', playerId);
    }

    handlePlayerInput(id, inputData) {
        try {
            if (this.players[id]) {
                // Store target rotation from client input
                this.players[id].targetRotation = inputData.angle;
                // Update boosting state (Input Request)
                this.players[id].wantsToBoost = inputData.isBoosting;
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
            const isGuest = !this.players[id].username || this.players[id].username.startsWith('Guest_');

            if (!isGuest) {
                Logger.info('PlayerManager', `handleInitPlayer: Loading DB for ${this.players[id].username}`);
                // Load from DB if verified user
                UserRepository.findByUsername(this.players[id].username).then(user => {
                    if (user) {
                        Logger.info('PlayerManager', `Found user in DB: ${user.username}, coins: ${user.coins}`);
                        this.players[id].coins = user.coins;

                        // Load Inventory (Array -> Object)
                        if (user.inventory && Array.isArray(user.inventory)) {
                            this.players[id].inventory = {};
                            user.inventory.forEach(item => {
                                this.players[id].inventory[item.itemId] = item.quantity;
                            });
                        }

                        // Emit updates
                        this.io.to(id).emit('updateCoins', this.players[id].coins);
                        this.io.to(id).emit('updateInventory', this.players[id].inventory);

                        this.io.to(id).emit('playerState', {
                            coins: this.players[id].coins,
                            inventory: this.players[id].inventory,
                            id: id,
                            color: this.players[id].color,
                            name: this.players[id].name,
                            highScore: user.highScore
                        });

                        // Send Shop Items from DB (delegated via ShopManager potentially, but here directly or via ShopManager)
                        if (this.shopManager) {
                            this.io.to(id).emit('shopItems', this.shopManager.getShopItems());
                        }

                    } else {
                        Logger.warn('PlayerManager', `User not found in DB: ${this.players[id].username}`);
                    }
                }).catch(err => Logger.error('PlayerManager', `DB Error: ${err}`));
            } else {
                // Guest: Use client sent data
                if (data.inventory) {
                    this.players[id].inventory = data.inventory;
                }
                if (data.coins) {
                    this.players[id].coins = parseInt(data.coins);
                }
            }

            // Broadcast the updated properties to everyone so they see the new color
            this.io.emit('playerProperties', {
                id: id,
                color: this.players[id].color,
                name: this.players[id].name
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

    update() {
        // NOTE: Bot spawning and AI Update is now handled by BotManager externally
        // This update() only handles physics, collision, and state for ALL players

        const segmentLength = 1;

        // Update all players positions
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            if (!player) return;

            // Apply rotation smoothing for everyone (Bots AND Players)
            this.updateRotation(player);

            // Determine current speed

            // Boost Logic with Hysteresis
            if (!player.isBoosting && player.wantsToBoost && player.score > 5) {
                player.isBoosting = true;
            } else if (player.isBoosting && (!player.wantsToBoost || player.score <= 2)) {
                player.isBoosting = false;
            }

            // Manage Active Effects
            const now = Date.now();
            Object.keys(player.activeEffects).forEach(effectId => {
                if (player.activeEffects[effectId] < now) {
                    delete player.activeEffects[effectId];
                    // BROADCAST deactivation
                    this.io.emit('itemDeactivated', { playerId: id, itemId: effectId });
                }
            });

            // Calculate Speed
            let currentSpeed = BASE_SPEED;

            // 1. Item Speed Buff
            if (player.activeEffects['speed']) {
                let buffValue = 4;
                if (this.shopManager) {
                    const item = this.shopManager.getShopItems().find(i => i.id === 'speed');
                    if (item) buffValue = item.buffValue;
                }
                currentSpeed += buffValue;
            }
            // 2. Manual Boost
            else if (player.isBoosting) {
                currentSpeed = BOOST_SPEED;

                // DETERMINISTIC: Shrink every 90 frames (1.5s at 60fps)
                player.boostTimer++;
                if (player.boostTimer > BOOST_COST_INTERVAL) {
                    player.boostTimer = 0; // Reset timer
                    player.score = Math.max(0, player.score - 1);

                    const dropPos = player.path.length > 0 ? player.path[player.path.length - 1] : { x: player.x, y: player.y };

                    // Spawn food at drop position (auto-emits 'newFood')
                    this.foodManager.spawnFood(dropPos.x, dropPos.y, player.color);
                }
            }

            // Simple movement logic based on rotation
            player.x += Math.cos(player.rotation) * currentSpeed;
            player.y += Math.sin(player.rotation) * currentSpeed;

            // Update Path for Body Collision
            player.totalDistance += currentSpeed;
            player.path.unshift({
                x: player.x,
                y: player.y,
                d: player.totalDistance
            });

            const neededHistoryDist = (player.score + INITIAL_LENGTH + 5) * PIXELS_PER_SEGMENT;

            // Prune old points
            while (player.path.length > 0 &&
                (player.totalDistance - player.path[player.path.length - 1].d > neededHistoryDist)) {
                player.path.pop();
            }

            // 1. Check Collision with World Bounds
            if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
                this.removePlayer(id);
                return;
            }

            // 2. Check Collision with Other Snakes
            if (!player.activeEffects['ghost']) {
                Object.keys(this.players).forEach(otherId => {
                    if (id === otherId) return;
                    const other = this.players[otherId];

                    const myRadius = this.getPlayerRadius(player.score);
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
                        for (let i = segmentLength; i < other.path.length; i++) {
                            const point = other.path[i];
                            const distFromHead = other.totalDistance - point.d;
                            if (distFromHead > validCollisionDistance) break;

                            const dist = Math.hypot(player.x - point.x, player.y - point.y);

                            if (dist < (myRadius + otherRadius) * HITBOX_SENSITIVITY) {
                                this.removePlayer(id);
                                return;
                            }
                        }
                    }
                });
            }

            // Check collision with food
            const allFood = this.foodManager.getAllFood();
            Object.keys(allFood).forEach(async foodId => {
                try {
                    const f = allFood[foodId];
                    if (!f) return;

                    const dx = player.x - f.x;
                    const dy = player.y - f.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    const myRadius = this.getPlayerRadius(player.score);

                    // Base magnet radius (increased for quiz food with larger bodies)
                    let magnetRadius = BASE_MAGNET_RADIUS;
                    if (player.activeEffects['magnet']) {
                        let buffValue = 200;
                        if (this.shopManager) {
                            const item = this.shopManager.getShopItems().find(i => i.id === 'magnet');
                            if (item) buffValue = item.buffValue;
                        }
                        magnetRadius = buffValue;
                    }

                    if (distance < myRadius + magnetRadius) {
                        // Eat food
                        this.foodManager.removeFood(foodId);

                        // QUIZ LOGIC
                        let quizHandled = false;
                        if (this.quizManager && f.type === 'text') {
                            const result = this.quizManager.checkAnswer(f);
                            if (result) {
                                quizHandled = true;
                                if (result.correct) {
                                    player.score += result.reward; // Big Bonus
                                } else {
                                    player.score = Math.max(0, player.score - result.penalty); // Penalty
                                }

                                // Emit Result for Visual Feedback
                                this.io.emit('answerResult', {
                                    playerId: id,
                                    correct: result.correct,
                                    scoreChange: result.correct ? result.reward : -result.penalty,
                                    x: player.x,
                                    y: player.y
                                });
                            }
                        }

                        if (quizHandled) {
                            // Already handled
                        }
                        // NORMAL LOGIC
                        else if (f.type === 'coin') {
                            if (!player.isBot) {
                                try {
                                    if (player.username && !player.username.startsWith('Guest_')) {
                                        const newBalance = await UserRepository.addCoins(player.username, f.value);
                                        this.io.to(id).emit('updateCoins', newBalance);
                                    } else {
                                        let currentCoins = parseInt(player.coins) || 0;
                                        player.coins = currentCoins + f.value;
                                        this.io.to(id).emit('updateCoins', player.coins);
                                    }
                                } catch (err) {
                                    Logger.error('PlayerManager', 'Error updating coins:', err);
                                }
                            }
                        } else {
                            // Ăn thức ăn thường -> Tăng điểm
                            // Reduced regular food score in Quiz Mode? Optional.
                            player.score += 1;
                        }

                        this.io.emit('foodEaten', { foodId: f.id, playerId: id, score: player.score, type: f.type });

                        // Spawn new food (auto-emits 'newFood' event)
                        if (f.type !== 'coin') {
                            this.foodManager.spawnFood(); // shouldEmit = true by default
                        }
                    }
                } catch (err) {
                    Logger.error('PlayerManager', `Collision Error for food ${foodId}:`, err);
                }
            });
        });
    }

    getAllPlayers() {
        return this.players;
    }

    resetScores() {
        Object.values(this.players).forEach(p => {
            p.score = 0;
            // Also reset length/sections if needed, but score=0 usually implies restart
            if (p.sections && p.sections.length > 0) {
                while (p.sections.length > 5) {
                    p.sections.pop(); // Reset to base length
                }
            }
        });
        // Notify all clients to reset local score display
        this.io.emit('resetScores'); // Helper event (Client needs to handle this)
    }

    killAllPlayers() {
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            player.alive = false;
            // Emit death event
            this.io.emit('playerDied', { playerId: id });

            // Clean up player from map (optional, or wait for them to reconnect?)
            // Usually we keep the socket connection but reset their state to 'dead'
            // In this game, death usually means respawn screen.

            // Note: We don't necessarily disconnect them, just kill their snake.
        });
        // Reset internal list? Or wait for disconnect?
        // If we clear this.players, we lose socket mapping. 
        // Better to just mark dead. The client will show GameOver scene.
    }
}

module.exports = PlayerManager;
