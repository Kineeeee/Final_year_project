import { Scene } from 'phaser';
import { CameraManager } from '../features/CameraManager';
import { effectManager } from '../features/EffectManager';
import { EntityManager } from '../world/EntityManager';
import { Logger } from '../utils/Logger';

import { CONFIG } from '../config/constants';
import { GameSession } from '../session/GameSession';

export class Game extends Scene {
    constructor() {
        super('Game');
        this._didShutdown = false;
    }

    init(data) {
        data = data || {};
        this.myColor = data.color;
        this.myName = data.name;
        this.gameMode = data.mode || CONFIG.GAME_MODES.NORMAL;
    }

    create() {
        Logger.info('Game', 'Game Scene Created');

        this._didShutdown = false;
        this._isExiting = false;

        this.events.once('shutdown', this.shutdown, this);
        this.events.once('destroy', this.shutdown, this);

        // Detect device
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isMobile = !this.sys.game.device.os.desktop || isMobileUA;

        this.setupWorld();
        this.cameraManager = new CameraManager(this);
        this.cameraManager.setup();

        // Entity Manager (Handles Snakes & Food)
        this.entityManager = new EntityManager(this);

        // UI is handled by UIScene
        this.scene.launch(CONFIG.SCENES.UI, { mode: this.gameMode });
        this.scene.bringToTop(CONFIG.SCENES.UI);

        this.coinsCollected = 0;

        // Start session-owned state/network/input
        this.session = new GameSession(this, {
            mode: this.gameMode,
            playerDetails: { color: this.myColor, name: this.myName }
        });
        this.session.start();


    }



    shutdown() {
        if (this._didShutdown) return;
        this._didShutdown = true;
        this._isExiting = true;

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

        this.networkManager = null;
        this.inputController = null;
        this.commandQueue = null;

        this.keepSocketAlive = false;
        this.scene.stop(CONFIG.SCENES.UI);

        // Usage of EntityManager for cleanup
        if (this.entityManager) {
            this.entityManager.cleanup();
            this.entityManager = null;
        }
        this.player = null; // Clear ref
    }

    setupWorld() {
        const WIDTH_WORLD = CONFIG.WORLD_WIDTH;
        const HEIGHT_WORLD = CONFIG.WORLD_HEIGHT;
        this.physics.world.setBounds(0, 0, WIDTH_WORLD, HEIGHT_WORLD);
        this.add.tileSprite(0, 0, WIDTH_WORLD, HEIGHT_WORLD, CONFIG.ASSETS.BACKGROUND).setOrigin(0);
    }

    createPlayer(playerInfo) {
        // Delegate to Entity Manager but keep logic reference
        this.player = this.entityManager.createPlayer(playerInfo);
        this.cameraManager.startFollow(this.player.head);
    }

    addOtherPlayers(playerInfo) {
        this.entityManager.addOtherPlayer(playerInfo);
    }

    // Proxy methods to maintain API compatibility with Session/NetworkManager
    spawnFood(x, y, color, id, type = 'regular', value = 1, data = null) {
        this.entityManager.spawnFood(x, y, color, id, type, value, data);
    }

    // Needed for session/network manager to find snake by ID
    findSnakeById(id) {
        // EntityManager doesn't expose a simple unified snake list by ID in the snippet I wrote?
        // Wait, EntityManager has `snakes` array and `otherSnakes` map.
        // I should probably add a helper in EntityManager.
        // For now, let's replicate logic or add method to EntityManager in next step?
        // Actually, this method is usually used by session.
        // Let's assume session can access it or I add `findSnakeById` to EntityManager.
        // I will add it to EntityManager in next step if missing.
        // Or implement it here using entityManager properties.
        if (!this.entityManager) return null;
        const player = this.entityManager.snakes.find(s => s.playerId === id);
        return player;
    }

    get snakes() {
        return this.entityManager ? this.entityManager.snakes : [];
    }

    get otherSnakes() {
        return this.entityManager ? this.entityManager.otherSnakes : new Map();
    }

    update(time, delta) {
        if (this._isExiting || !this.sys.isActive()) return;

        if (this.session) {
            this.session.tick(time, delta);
        }

        if (this.entityManager) {
            this.entityManager.update(time, delta);
        }

        if (this.cameraManager && this.player) this.cameraManager.update(this.player);
    }

    killSnake(snake) {
        if (!this.entityManager) return;

        // Check if player
        const isPlayer = (snake === this.player);

        this.entityManager.killSnake(snake);

        Logger.info('Game', `Snake died. Is Player: ${isPlayer}`);

        if (isPlayer) {
            this.player = null;
            const payload = { score: snake.score ?? 0, coins: this.coinsCollected };
            if (this.session && this.session.startGameOverOnce) {
                this.session.startGameOverOnce(payload);
            } else {
                this.scene.start(CONFIG.SCENES.GAME_OVER, payload);
            }
        }
    }

    useItem(itemId) {
        this.events.emit('intent:useItem', itemId);
    }

    showFloatingText(x, y, message, color) {
        const text = this.add.text(x, y - 50, message, CONFIG.STYLES.FLOAT_TEXT).setOrigin(0.5);
        if (typeof color === 'number') text.setTint(color);
        else text.setColor(color);

        this.tweens.add({
            targets: text,
            y: y - 100,
            alpha: 0,
            scale: 1.5,
            duration: CONFIG.INTERVALS.FLOAT_TEXT_DURATION,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }



    // Legacy support methods if needed by other components
    destroyFoodGroups() { } // Handled by EntityManager
    getFoodChildren() { return this.entityManager ? [...this.entityManager.regularFoodGroup.getChildren(), ...this.entityManager.specialFoodGroup.getChildren()] : []; }
    findFoodById(id) { return this.entityManager ? this.entityManager.findFoodById(id) : null; }
    clearAllFood() { if (this.entityManager) this.entityManager.cleanup(); }
}
