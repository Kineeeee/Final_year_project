import { Logger } from '../utils/Logger';
import { Food } from '../modules/food/Food';
import { PlayerSnake } from '../modules/snake/PlayerSnake';
import { Snake } from '../modules/snake/Snake';
import { Coin } from '../modules/food/Coin';
import { QuizFood } from '../modules/food/QuizFood';
import { effectManager } from '../core/effects/EffectManager';

export class EntityManager {
    constructor(scene, gameState) {
        this.scene = scene;
        this.gameState = gameState;

        // Entities (Owned by Manager now)
        this.snakes = [];
        this.otherSnakes = new Map(); // Map<playerId, Snake>

        // Food Groups
        this.regularFoodGroup = this.scene.add.group({
            classType: Food,
            runChildUpdate: true
        });
        this.specialFoodGroup = this.scene.add.group({
            runChildUpdate: true
        });

        // Snake Segment Pool
        this.segmentPool = this.scene.add.group({
            classType: Phaser.GameObjects.Image,
            maxSize: -1
        });

        // foodId -> timestamp (ms)
        this._pendingFoodRemoval = new Map();
        this._pendingFoodRemovalTtlMs = 10000;

        // How long we allow "foodEaten" visuals (magnet) to exist after the food is absent from server state.
        // This keeps visuals smooth but guarantees convergence (prevents long-lived ghosts).
        this._pendingFoodVisualGraceMs = 2000;
    }

    // --- Entity Lifecycle ---

    createPlayer(playerInfo) {
        const player = new PlayerSnake(this.scene, playerInfo.x, playerInfo.y, playerInfo.color, this.segmentPool);
        player.isRemote = false; // Local player controls itself (client-prediction)
        player.playerId = playerInfo.playerId;
        if (playerInfo.name) player.setName(playerInfo.name);

        if (playerInfo.score > 0) {
            player.addSections(playerInfo.score);
            player.score = playerInfo.score;
        }

        this.snakes.push(player);

        // Initial Effects
        if (playerInfo.activeEffects) {
            Object.keys(playerInfo.activeEffects).forEach(itemId => {
                effectManager.applyEffect(player, itemId, true, 0);
            });
        }

        return player;
    }

    addOtherPlayers(playerInfo) {
        const otherPlayer = new Snake(this.scene, playerInfo.x, playerInfo.y, playerInfo.color, 'snake-circle', this.segmentPool);
        otherPlayer.isRemote = true;
        otherPlayer.playerId = playerInfo.playerId;
        if (playerInfo.name) otherPlayer.setName(playerInfo.name);

        if (playerInfo.score > 0) {
            otherPlayer.addSections(playerInfo.score);
            otherPlayer.score = playerInfo.score;
        }

        if (playerInfo.activeEffects) {
            Object.keys(playerInfo.activeEffects).forEach(itemId => {
                effectManager.applyEffect(otherPlayer, itemId, true);
            });
        }

        this.otherSnakes.set(playerInfo.playerId, otherPlayer);
        this.snakes.push(otherPlayer);
        return otherPlayer;
    }

    spawnFood(x, y, color, id, type = 'regular', value = 1, data = null) {
        if (type === 'coin') {
            const coin = new Coin(this.scene, x, y, id, value);
            this.specialFoodGroup.add(coin);
            return;
        }

        if (type === 'text') {
            const quizFood = new QuizFood(this.scene, x, y, data);
            quizFood.id = id;
            this.specialFoodGroup.add(quizFood);
            return;
        }

        let food = this.regularFoodGroup.get(x, y);
        if (food) {
            food.onSpawn(x, y, color, type, value, data, id);
        } else {
            food = new Food(this.scene, x, y, color);
            food.id = id;
            food.onSpawn(x, y, color, type, value, data, id);
            this.regularFoodGroup.add(food);
        }

        food.setScale(1.0);
        food.setRotation(0);
    }

    update(time, delta) {
        this.snakes.forEach(snake => {
            if (snake.alive) {
                snake.update(time, delta);
            }
        });
    }

    killSnake(snake) {
        if (!snake || !snake.alive) return;
        snake.alive = false;
        snake.destroy();
        this.snakes = this.snakes.filter(s => s !== snake);

        if (snake.playerId && this.otherSnakes.has(snake.playerId)) {
            this.otherSnakes.delete(snake.playerId);
        }
    }

    findFoodById(id) {
        // Use group children
        const regular = this.regularFoodGroup.getChildren();
        const special = this.specialFoodGroup.getChildren();
        // Optimize: check regular first as it's most common
        let found = regular.find(f => f && f.id == id);
        if (!found) found = special.find(f => f && f.id == id);
        return found;
    }

    getFoodChildren() {
        return [...this.regularFoodGroup.getChildren(), ...this.specialFoodGroup.getChildren()];
    }

    cleanup() {
        if (this.snakes) {
            this.snakes.forEach(s => s.destroy());
            this.snakes = [];
        }
        this.otherSnakes.clear();
        if (this.regularFoodGroup) this.regularFoodGroup.destroy(true);
        if (this.specialFoodGroup) this.specialFoodGroup.destroy(true);
        if (this.segmentPool) this.segmentPool.destroy(true);
    }

    // --- Players Reconciliation ---

    resetPlayersFromState() {
        // Destroy existing entities
        if (this.snakes) {
            this.snakes.forEach((s) => s && s.destroy && s.destroy());
        }
        this.snakes = [];

        if (this.otherSnakes) {
            this.otherSnakes.forEach((s) => s && s.destroy && s.destroy());
            this.otherSnakes.clear();
        } else {
            this.otherSnakes = new Map();
        }

        if (this.scene.player) {
            this.scene.player.destroy();
            this.scene.player = null;
        }

        const localId = this.gameState?.localPlayerId;
        const players = this.gameState ? Array.from(this.gameState.players.values()) : [];

        players.forEach((p) => {
            if (p.playerId === localId) {
                // We still set scene.player for Camera/Game convenience logic
                this.scene.player = this.createPlayer(p);
                this.scene.cameraManager.startFollow(this.scene.player.head);
            } else {
                this.addOtherPlayers(p);
            }
        });
    }

    applyPlayerSnapshotsFromState() {
        if (!this.gameState) return;

        const scene = this.scene;
        const localId = this.gameState.localPlayerId;
        const players = this.gameState.players;

        // Remove entities not in state
        if (scene.player && scene.player.playerId && !players.has(scene.player.playerId)) {
            scene.player.destroy();
            scene.player = null;
            // Also remove from this.snakes
            this.snakes = this.snakes.filter(s => s.playerId !== localId);
        }

        if (this.otherSnakes) {
            for (const [id, snake] of this.otherSnakes.entries()) {
                if (!players.has(id)) {
                    snake.destroy();
                    this.otherSnakes.delete(id);
                    this.snakes = this.snakes.filter((s) => s !== snake);
                }
            }
        }

        // Create missing + update existing
        for (const [id, snapshot] of players.entries()) {
            if (id === localId) {
                if (!scene.player) {
                    scene.player = this.createPlayer(snapshot);
                    scene.cameraManager.startFollow(scene.player.head);
                } else {
                    this.updateSnakeState(scene.player, snapshot);
                }
            } else {
                if (!this.otherSnakes.has(id)) {
                    this.addOtherPlayers(snapshot);
                } else {
                    this.updateSnakeState(this.otherSnakes.get(id), snapshot);
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
        const existing = this.getFoodChildren();
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

            const existingFood = this.findFoodById(id);
            if (!existingFood) {
                this.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
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
        if (!data) return;

        const food = this.findFoodById(data.foodId);
        // Tombstone even if entity isn't found yet; prevents respawn on next reconcile.
        if (data.foodId) {
            this._pendingFoodRemoval.set(data.foodId, Date.now());
        }

        if (!food) return;

        // Mark so state reconciliation won't resurrect / snap it back
        food.__pendingRemoval = true;
        food.__pendingRemovalAt = Date.now();

        let eater = null;
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            eater = this.scene.player;
        } else if (this.otherSnakes && this.otherSnakes.has(data.playerId)) {
            eater = this.otherSnakes.get(data.playerId);
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
