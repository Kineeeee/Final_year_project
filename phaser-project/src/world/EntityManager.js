import { Logger } from '../utils/Logger';
import { Food } from '../objects/Food';

export class EntityManager {
    constructor(scene, gameState) {
        this.scene = scene;
        this.gameState = gameState;

        // foodId -> timestamp (ms)
        this._pendingFoodRemoval = new Map();
        this._pendingFoodRemovalTtlMs = 10000;

        // How long we allow "foodEaten" visuals (magnet) to exist after the food is absent from server state.
        // This keeps visuals smooth but guarantees convergence (prevents long-lived ghosts).
        this._pendingFoodVisualGraceMs = 2000;
    }

    // --- Players ---

    resetPlayersFromState() {
        const scene = this.scene;

        // Destroy existing entities
        if (scene.snakes) {
            scene.snakes.forEach((s) => s && s.destroy && s.destroy());
        }
        scene.snakes = [];

        if (scene.otherSnakes) {
            scene.otherSnakes.forEach((s) => s && s.destroy && s.destroy());
            scene.otherSnakes.clear();
        } else {
            scene.otherSnakes = new Map();
        }

        if (scene.player) {
            scene.player.destroy();
            scene.player = null;
        }

        const localId = this.gameState?.localPlayerId;
        const players = this.gameState ? Array.from(this.gameState.players.values()) : [];

        players.forEach((p) => {
            if (p.playerId === localId) {
                scene.createPlayer(p);
            } else {
                scene.addOtherPlayers(p);
            }
        });
    }

    applyPlayerSnapshotsFromState() {
        const scene = this.scene;
        if (!this.gameState) return;

        const localId = this.gameState.localPlayerId;
        const players = this.gameState.players;

        // Remove entities not in state
        if (scene.player && scene.player.playerId && !players.has(scene.player.playerId)) {
            scene.player.destroy();
            scene.player = null;
        }

        if (scene.otherSnakes) {
            for (const [id, snake] of scene.otherSnakes.entries()) {
                if (!players.has(id)) {
                    snake.destroy();
                    scene.otherSnakes.delete(id);
                    scene.snakes = scene.snakes.filter((s) => s !== snake);
                }
            }
        }

        // Create missing + update existing
        for (const [id, snapshot] of players.entries()) {
            if (id === localId) {
                if (!scene.player) {
                    scene.createPlayer(snapshot);
                } else {
                    this.updateSnakeState(scene.player, snapshot);
                }
            } else {
                if (!scene.otherSnakes.has(id)) {
                    scene.addOtherPlayers(snapshot);
                } else {
                    this.updateSnakeState(scene.otherSnakes.get(id), snapshot);
                }
            }
        }

        // Minimap player update
        if (scene.player && scene.player.head) {
            const uiScene = scene.scene.get('UIScene');
            if (uiScene) uiScene.updateMinimapPlayer(scene.player.head.x, scene.player.head.y);
        }
    }

    updateSnakeState(snake, data) {
        if (!snake || !data) return;

        snake.targetX = typeof data.renderX === 'number' ? data.renderX : data.x;
        snake.targetY = typeof data.renderY === 'number' ? data.renderY : data.y;
        snake.targetRotation =
            typeof data.renderRotation === 'number' ? data.renderRotation : data.rotation;

        // Score/Length sync w/ smooth growth
        if (typeof data.score === 'number') {
            if (data.score > snake.score) {
                snake.addSections(data.score - snake.score);
                snake.score = data.score;
            } else if (data.score < snake.score) {
                const diff = snake.score - data.score;
                for (let i = 0; i < diff; i++) snake.shrink();
                snake.score = data.score;
            }
        }

        // Boosting visual
        if (data.isBoosting) {
            if (snake.shadow) snake.shadow.setLightingUp(true);
            snake.speed = snake.fastSpeed;
        } else {
            if (snake.shadow) snake.shadow.setLightingUp(false);
            snake.speed = snake.slowSpeed;
        }

        // Name/color live updates
        if (data.name && snake.name !== data.name) snake.setName(data.name);
        if (data.color && snake.color !== data.color && snake.setColor) snake.setColor(data.color);
    }

    // --- Foods ---

    _setDisplayPosition(entity, x, y) {
        if (!entity) return;

        if (entity.setPosition) entity.setPosition(x, y);
        else {
            entity.x = x;
            entity.y = y;
        }
    }

    reconcileFoodsFromState() {
        if (!this.gameState) return;

        const scene = this.scene;
        const desiredIds = new Set(this.gameState.foods.keys());

        // Prune pending tombstones that the server already removed or expired
        const now = Date.now();
        for (const [id, ts] of this._pendingFoodRemoval.entries()) {
            if (!desiredIds.has(id) || now - ts > this._pendingFoodRemovalTtlMs) {
                this._pendingFoodRemoval.delete(id);
            }
        }

        // Destroy entities not in state
        const existing = scene.getFoodChildren ? scene.getFoodChildren() : [];
        existing.forEach((f) => {
            if (!f || !f.id) return;
            if (desiredIds.has(f.id)) return;

            // Hard convergence rule:
            // If a food is not in server state, it must not persist indefinitely.
            // Allow a short grace window for magnet animations, then finalize it.
            const pendingAt = f.__pendingRemovalAt || 0;
            if ((f.__pendingRemoval || f.target) && pendingAt) {
                const age = now - pendingAt;
                if (age > this._pendingFoodVisualGraceMs) {
                    // Regular pooled Food should become reusable, not stuck with an old id.
                    if (f instanceof Food) {
                        if (f.target) f.target = null;
                        if (f.eat) f.eat();
                        f.__pendingRemoval = false;
                        f.__pendingRemovalAt = 0;
                        f.id = null;
                        return;
                    }

                    // Special foods (Coin/QuizFood) are not pooled; destroy them.
                    f.destroy();
                    return;
                }
            }

            // If this food is currently magneting / pending removal, let its own lifecycle finish.
            // (Coin/QuizFood will destroy; regular Food will hide.)
            if (f.__pendingRemoval || f.target) return;

            f.destroy();
        });

        // Upsert entities from state (spawn if missing)
        for (const [id, f] of this.gameState.foods.entries()) {
            // If this food was eaten locally (server event received) but server state hasn't removed it yet,
            // do NOT respawn it (prevents ghost food at original position).
            if (this._pendingFoodRemoval.has(id)) {
                continue;
            }

            const existingFood = scene.findFoodById ? scene.findFoodById(id) : null;
            if (!existingFood) {
                scene.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
            } else {
                // IMPORTANT:
                // - Don't fight magnet animation (foodEaten visual) by snapping back to server position.
                // - Don't resurrect consumed/inactive foods before server remove arrives.
                if (existingFood.__pendingRemoval || existingFood.target) {
                    continue;
                }

                if (existingFood.active === false || existingFood.visible === false) {
                    // Keep it hidden until server removes; prevents "ghost food" reappearing.
                    continue;
                }

                // Regular Food: use onSpawn() to keep arcade body aligned for pooled Container bodies
                if (existingFood instanceof Food && existingFood.onSpawn) {
                    existingFood.onSpawn(f.x, f.y, f.color, f.type, f.value, f.data, f.id);
                } else {
                    // Coin/QuizFood are Containers with circular bodies using negative offsets;
                    // calling body.reset(x,y) here can desync hitbox vs visuals and cause "ghost food".
                    this._setDisplayPosition(existingFood, f.x, f.y);
                }
            }
        }
    }

    onFoodEatenVisual(data) {
        const scene = this.scene;
        if (!data) return;

        const food = scene.findFoodById ? scene.findFoodById(data.foodId) : null;
        // Tombstone even if entity isn't found yet; prevents respawn on next reconcile.
        if (data.foodId) {
            this._pendingFoodRemoval.set(data.foodId, Date.now());
        }

        if (!food) return;

        // Mark so state reconciliation won't resurrect / snap it back
        food.__pendingRemoval = true;
        food.__pendingRemovalAt = Date.now();

        let eater = null;
        if (scene.player && scene.player.playerId === data.playerId) {
            eater = scene.player;
        } else if (scene.otherSnakes && scene.otherSnakes.has(data.playerId)) {
            eater = scene.otherSnakes.get(data.playerId);
        }

        if (eater && eater.head && eater.head.active) {
            if (food.magnetTo) food.magnetTo(eater.head);
        } else {
            // If we can't resolve an eater (race / entity not yet spawned), don't leave a non-collidable visible token.
            food.destroy();
        }
    }

    safeDebugDump() {
        try {
            const players = this.gameState ? this.gameState.players.size : 0;
            const foods = this.gameState ? this.gameState.foods.size : 0;
            Logger.debug('EntityManager', `state players=${players}, foods=${foods}`);
        } catch {
            // no-op
        }
    }
}
