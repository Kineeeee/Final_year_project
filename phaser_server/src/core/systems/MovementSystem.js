const {
    BASE_SPEED,
    BOOST_SPEED,
    TURN_SPEED,
    PIXELS_PER_SEGMENT,
    INITIAL_LENGTH,
    BOOST_COST_INTERVAL,
    MAX_PLAYER_SCALE,
    PLAYER_SCALE_BASE,
    PLAYER_SCALE_GROWTH
} = require('../../config/constants');
const Logger = require('../../utils/Logger');

class MovementSystem {
    constructor(container) {
        this.container = container;
    }

    get spatialGrid() {
        return this.container.get('spatialGrid');
    }

    get shopManager() {
        return this.container.get('shopManager');
    }

    get foodManager() {
        return this.container.get('foodManager');
    }

    // Helper to calculate scale (moved from PlayerManager or duplicated for now)
    getPlayerScale(score) {
        let scale = PLAYER_SCALE_BASE + (INITIAL_LENGTH + score) * PLAYER_SCALE_GROWTH;
        if (scale > MAX_PLAYER_SCALE) scale = MAX_PLAYER_SCALE;
        return scale;
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

    updateMovement(player, playerManager) {
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

                // Callback to PlayerManager to handle score/length reduction
                // We shouldn't modify score directly here if we want strictly single source of truth?
                // But MovementSystem modifying physical state (which depends on score for length) is okay.
                // However, reduction of score is a Game Logic event.
                // Ideally: playerManager.reduceScore(player, 1);
                // For now, simpler to call playerManager.updatePlayerScore(player, -1)
                playerManager.updatePlayerScore(player, -1);

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
}

module.exports = MovementSystem;
