import { Scene } from 'phaser';
import { CameraManager } from '../features/CameraManager';
import { effectManager } from '../features/EffectManager';
import { PlayerSnake } from '../objects/snake/PlayerSnake';
import { Snake } from '../objects/snake/Snake';
import { Food } from '../objects/Food';
import { Coin } from '../objects/Coin';
import { QuizFood } from '../objects/QuizFood';
import { Logger } from '../utils/Logger';
import { GestureController } from '../input/GestureController';
import { CONFIG } from '../config/constants';
import { GameSession } from '../session/GameSession';

export class Game extends Scene {
    constructor() {
        super('Game');
        this.controlMode = 'MOUSE'; // 'MOUSE' or 'GESTURE'
        this._didShutdown = false;
        this._onToggleControlMode = null;
    }

    init(data) {
        data = data || {};
        this.myColor = data.color; // If undefined, will use server random color
        this.myName = data.name; // Use server generated name if not provided
        this.gameMode = data.mode || CONFIG.GAME_MODES.NORMAL; // 'normal', 'math', 'english'
    }

    create() {
        Logger.info('Game', 'Game Scene Created');

        // Scene instances are reused across restarts; reset teardown guards each run
        this._didShutdown = false;
        this._isExiting = false;

        // Ensure teardown always runs on Scene stop/restart
        this.events.once('shutdown', this.shutdown, this);
        this.events.once('destroy', this.shutdown, this);

        // Detect device
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isMobile = !this.sys.game.device.os.desktop || isMobileUA;

        this.setupWorld();
        this.cameraManager = new CameraManager(this);
        this.cameraManager.setup();

        // UI is handled by UIScene
        this.scene.launch(CONFIG.SCENES.UI, { mode: this.gameMode });
        this.scene.bringToTop(CONFIG.SCENES.UI);

        // Scene-owned collections (session will reconcile into these)
        this.snakes = [];
        this.coinsCollected = 0;
        this.otherSnakes = new Map(); // Map<playerId, Snake>

        // Food lifecycle: separate pooled regular foods from special (coin/quiz) to avoid mixed-type pooling bugs
        this.regularFoodGroup = this.add.group({
            classType: Food,
            runChildUpdate: true
        });
        this.specialFoodGroup = this.add.group({
            runChildUpdate: true
        });

        // Start session-owned state/network/input
        this.session = new GameSession(this, {
            mode: this.gameMode,
            playerDetails: { color: this.myColor, name: this.myName }
        });
        this.session.start();

        // Initialize Gesture (but don't start loop until needed? Or always run but ignore?)
        // Better to always init to be ready, or init on demand. 
        // Let's init immediately but allow toggle.
        this.setupGestureControl();

        // Input Toggle
        if (this.input && this.input.keyboard) {
            if (this._onToggleControlMode) {
                this.input.keyboard.off('keydown-G', this._onToggleControlMode);
            }
            this._onToggleControlMode = () => this.toggleControlMode();
            this.input.keyboard.on('keydown-G', this._onToggleControlMode);
        }
    }

    async setupGestureControl() {
        this.gestureController = new GestureController();
        await this.gestureController.init();
    }


    shutdown() {
        if (this._didShutdown) return;
        this._didShutdown = true;

        this._isExiting = true;
        // Session (socket listeners/state/timers)
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }

        if (this.staggeredSpawnTimer) {
            this.staggeredSpawnTimer.destroy();
            this.staggeredSpawnTimer = null;
        }

        if (this.cameraManager) {
            this.cameraManager.destroy();
        }

        if (this.input && this.input.keyboard && this._onToggleControlMode) {
            this.input.keyboard.off('keydown-G', this._onToggleControlMode);
            this._onToggleControlMode = null;
        }
        this.networkManager = null;
        this.entityManager = null;
        this.inputController = null;
        this.commandQueue = null;

        if (this.gestureController) {
            this.gestureController.cleanup();
        }
        this.keepSocketAlive = false; // Reset
        // Don't stop UIScene here if we want it to persist or if it handles its own input, 
        // but typically UIScene is tied to Game.
        this.scene.stop(CONFIG.SCENES.UI);

        // Destroy remaining entities owned by the scene
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        if (this.otherSnakes) {
            this.otherSnakes.forEach(s => s.destroy());
            this.otherSnakes.clear();
        }
        if (Array.isArray(this.snakes)) {
            this.snakes.forEach(s => s && s.destroy && s.destroy());
            this.snakes = [];
        }
        this.destroyFoodGroups();

        // gameState is owned by session; leave as-is
    }

    destroyFoodGroups() {
        const safeDestroyGroup = (group) => {
            if (!group) return;
            if (group.destroy) group.destroy(true);
        };

        safeDestroyGroup(this.regularFoodGroup);
        safeDestroyGroup(this.specialFoodGroup);
        this.regularFoodGroup = null;
        this.specialFoodGroup = null;
    }

    getFoodChildren() {
        const regular = this.regularFoodGroup ? this.regularFoodGroup.getChildren() : [];
        const special = this.specialFoodGroup ? this.specialFoodGroup.getChildren() : [];
        return [...regular, ...special];
    }

    findFoodById(id) {
        const all = this.getFoodChildren();
        return all.find(f => f && f.id == id);
    }

    clearAllFood() {
        // Note: during teardown, prefer destroyFoodGroups() to avoid clear() on a destroyed Group.
        if (this.regularFoodGroup && this.regularFoodGroup.clear) this.regularFoodGroup.clear(true, true);
        if (this.specialFoodGroup && this.specialFoodGroup.clear) this.specialFoodGroup.clear(true, true);
    }

    setupWorld() {
        const WIDTH_WORLD = CONFIG.WORLD_WIDTH;
        const HEIGHT_WORLD = CONFIG.WORLD_HEIGHT;

        // Set world bounds
        this.physics.world.setBounds(0, 0, WIDTH_WORLD, HEIGHT_WORLD);

        // Create a tiled background
        this.add.tileSprite(0, 0, WIDTH_WORLD, HEIGHT_WORLD, CONFIG.ASSETS.BACKGROUND).setOrigin(0);

        // Mobile scaling handled by Phaser Scale Manager in main.js
    }






    createPlayer(playerInfo) {
        this.player = new PlayerSnake(this, playerInfo.x, playerInfo.y, playerInfo.color);
        this.player.isRemote = true; // Server decides position (Interpolation)
        this.player.playerId = playerInfo.playerId; // Store ID
        if (playerInfo.name) this.player.setName(playerInfo.name);

        // Sync initial score
        if (playerInfo.score > 0) {
            this.player.addSections(playerInfo.score);
            this.player.score = playerInfo.score;
        }

        this.snakes.push(this.player);
        this.cameraManager.startFollow(this.player.head);

        // Apply Initial Effects (if reconnection or late join)
        if (playerInfo.activeEffects) {
            Object.keys(playerInfo.activeEffects).forEach(itemId => {
                const buffValue = 0; // Trigger effect (visuals often don't need exact value, or we assume default)
                // If we need buffValue, Server should send it in playerInfo. For now, visual is enough.
                effectManager.applyEffect(this.player, itemId, true, buffValue);
            });
        }
    }

    addOtherPlayers(playerInfo) {
        const otherPlayer = new Snake(this, playerInfo.x, playerInfo.y, playerInfo.color);
        otherPlayer.isRemote = true;
        otherPlayer.playerId = playerInfo.playerId; // Store ID
        if (playerInfo.name) otherPlayer.setName(playerInfo.name);

        // Sync initial score
        if (playerInfo.score > 0) {
            otherPlayer.addSections(playerInfo.score);
            otherPlayer.score = playerInfo.score;
        }

        // Apply Initial Effects
        if (playerInfo.activeEffects) {
            Object.keys(playerInfo.activeEffects).forEach(itemId => {
                effectManager.applyEffect(otherPlayer, itemId, true);
            });
        }

        this.otherSnakes.set(playerInfo.playerId, otherPlayer);
        this.snakes.push(otherPlayer);
    }

    spawnFood(x, y, color, id, type = 'regular', value = 1, data = null) {
        // Factory Pattern based on Type

        // 1. Coins
        if (type === 'coin') {
            const coin = new Coin(this, x, y, id, value);
            if (this.specialFoodGroup) this.specialFoodGroup.add(coin);
            return;
        }

        // 2. Quiz Answer Tokens
        if (type === 'text') {
            const quizFood = new QuizFood(this, x, y, data);
            quizFood.id = id;
            if (this.specialFoodGroup) this.specialFoodGroup.add(quizFood);
            return;
        }

        // 3. Regular Food (Pooled)
        let food = this.regularFoodGroup ? this.regularFoodGroup.get(x, y) : null;
        if (food) {
            food.onSpawn(x, y, color, type, value, data, id);
        } else {
            food = new Food(this, x, y, color);
            food.id = id;
            food.onSpawn(x, y, color, type, value, data, id);
            if (this.regularFoodGroup) this.regularFoodGroup.add(food);
        }

        food.setScale(1.0);
        food.setRotation(0);
    }

    update(time, delta) {
        // If we're transitioning out (death/restart), avoid running mid-frame updates on torn-down objects.
        if (this._isExiting || !this.sys.isActive()) return;

        if (this.session) {
            this.session.tick(time, delta);
        }

        // Update Snakes
        this.snakes.forEach(snake => {
            if (snake.alive) {
                snake.update(time, delta);
            }
        });

        if (this.cameraManager) this.cameraManager.update(this.player);
    }



    killSnake(snake) {
        if (!snake.alive) return;
        snake.alive = false;

        Logger.info('Game', `Snake died. Is Player: ${snake === this.player}`);

        // In Online Mode, we don't spawn food locally when dying (Server handles it)
        // But we do destroy the snake object to stop it from moving/rendering

        snake.destroy();
        this.snakes = this.snakes.filter(s => s !== snake);

        if (snake === this.player) {
            const payload = { score: this.player?.score ?? 0, coins: this.coinsCollected };
            if (this.session && this.session.startGameOverOnce) {
                this.session.startGameOverOnce(payload);
            } else {
                this.scene.start(CONFIG.SCENES.GAME_OVER, payload);
            }
        } else {
            // Remove from otherSnakes map if it's a remote snake
            if (snake.playerId && this.otherSnakes.has(snake.playerId)) {
                this.otherSnakes.delete(snake.playerId);
            }
        }
    }

    useItem(itemId) {
        // Backward compatible entrypoint: convert to intent
        this.events.emit('intent:useItem', itemId);
    }

    showFloatingText(x, y, message, color) {
        // Offset Y by -50 to show above head
        const text = this.add.text(x, y - 50, message, CONFIG.STYLES.FLOAT_TEXT).setOrigin(0.5);

        if (typeof color === 'number') text.setTint(color);
        else text.setColor(color);

        this.tweens.add({
            targets: text,
            y: y - 100, // Move up further
            alpha: 0,
            scale: 1.5,
            duration: CONFIG.INTERVALS.FLOAT_TEXT_DURATION,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    toggleControlMode() {
        this.controlMode = (this.controlMode === 'MOUSE') ? 'GESTURE' : 'MOUSE';
        const msg = `Control Mode: ${this.controlMode}`;
        if (this.player && this.player.head) {
            this.showFloatingText(this.player.head.x, this.player.head.y, msg, '#FFFF00');
        }
        Logger.info('Game', msg);

        // Show/Hide Overlay based on mode
        const overlay = document.getElementById('gesture-overlay');
        if (overlay) {
            overlay.style.display = (this.controlMode === 'GESTURE') ? 'block' : 'none';
        }
    }
}

