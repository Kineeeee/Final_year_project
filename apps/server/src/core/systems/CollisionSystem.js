const {
    WORLD_SIZE,
    INITIAL_LENGTH,
    PIXELS_PER_SEGMENT,
    HITBOX_SENSITIVITY,
    BASE_MAGNET_RADIUS,
    PLAYER_SCALE_BASE,
    PLAYER_SCALE_GROWTH,
    MAX_PLAYER_SCALE,
    COIN_CONFIG
} = require('../../config/constants');
const Logger = require('../../utils/Logger');

class CollisionSystem {
    constructor(container) {
        this.container = container;

        // Initialize Food Handlers
        const RegularFoodHandler = require('../../modules/food/handlers/RegularFoodHandler');
        const CoinFoodHandler = require('../../modules/food/handlers/CoinFoodHandler');
        const QuizFoodHandler = require('../../modules/food/handlers/QuizFoodHandler');

        this.foodHandlers = {
            regular: new RegularFoodHandler(container),
            coin: new CoinFoodHandler(container),
            text: new QuizFoodHandler(container), // 'text' is the type used for Quiz answers
        };
    }

    get playerManager() {
        return this.container.get('playerManager');
    }

    get foodManager() {
        return this.container.get('foodManager');
    }

    get shopManager() {
        return this.container.get('shopManager');
    }

    get spatialGrid() {
        return this.container.get('spatialGrid');
    }

    getPlayerScale(score) {
        let scale = PLAYER_SCALE_BASE + (INITIAL_LENGTH + score) * PLAYER_SCALE_GROWTH;
        if (scale > MAX_PLAYER_SCALE) scale = MAX_PLAYER_SCALE;
        return scale;
    }

    getPlayerRadius(score) {
        return 15 * this.getPlayerScale(score);
    }

    checkCollisions(player, id) {
        const segmentLength = 1;

        // 1. Check Collision with World Bounds
        if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
            this.playerManager.removePlayer(id);
            return;
        }

        // 2. Check Collision with Other Snakes
        if (!player.activeEffects['ghost']) {
            // Optimized: Query Grid for nearby Players
            let candidates = [];

            if (this.spatialGrid) {
                const potential = this.spatialGrid.query(player.x, player.y, 1000); // 1000 is heuristic large radius
                candidates = Array.from(potential);
            } else {
                candidates = Object.values(this.playerManager.getAllPlayers());
            }

            const myRadius = this.getPlayerRadius(player.score);

            candidates.forEach((other) => {
                if (!other || !other.playerId) return; // Skip non-players (food)
                const otherId = other.playerId;

                if (id === otherId) return;

                const otherRadius = this.getPlayerRadius(other.score);

                // 2a. Head-on-Head Collision
                const distHead = Math.hypot(player.x - other.x, player.y - other.y);
                if (distHead < (myRadius + otherRadius) * HITBOX_SENSITIVITY) {
                    this.playerManager.removePlayer(id);
                    this.playerManager.removePlayer(otherId);
                    return; // Stop processing this player
                }

                // Check against other's body segments
                const validCollisionDistance = (other.score + INITIAL_LENGTH) * PIXELS_PER_SEGMENT;

                if (other.path) {
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
                            this.playerManager.removePlayer(id);
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
                Logger.error('CollisionSystem', `Collision Error for food ${f.id}:`, err);
            }
        });
    }
}

module.exports = CollisionSystem;
