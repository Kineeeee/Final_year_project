import { Scene } from 'phaser';
import { NetworkManager } from '../network/NetworkManager';
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

export class Game extends Scene {
    constructor() {
        super('Game');
        this.controlMode = 'MOUSE'; // 'MOUSE' or 'GESTURE'
    }

    init(data) {
        data = data || {};
        this.myColor = data.color; // If undefined, will use server random color
        this.myName = data.name; // Use server generated name if not provided
        this.gameMode = data.mode || CONFIG.GAME_MODES.NORMAL; // 'normal', 'math', 'english'
    }

    create() {
        Logger.info('Game', 'Game Scene Created');

        // Detect device
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isMobile = !this.sys.game.device.os.desktop || isMobileUA;

        this.setupWorld();
        this.cameraManager = new CameraManager(this);
        this.cameraManager.setup();

        // UI is handled by UIScene
        this.scene.launch(CONFIG.SCENES.UI, { mode: this.gameMode });
        this.scene.bringToTop(CONFIG.SCENES.UI);

        // Initialize State
        this.snakes = [];
        this.coinsCollected = 0;
        this.otherSnakes = new Map(); // Map<playerId, Snake>
        this.foodGroup = this.add.group({
            classType: Food,
            runChildUpdate: true
        });

        // Initialize Network Manager
        this.networkManager = new NetworkManager(this);
        this.networkManager.connect(this.gameMode, {
            color: this.myColor,
            name: this.myName
        });
        this.setupGameLoops();

        // Initialize Gesture (but don't start loop until needed? Or always run but ignore?)
        // Better to always init to be ready, or init on demand. 
        // Let's init immediately but allow toggle.
        this.setupGestureControl();

        // Input Toggle
        this.input.keyboard.on('keydown-G', () => {
            this.toggleControlMode();
        });
    }

    async setupGestureControl() {
        this.gestureController = new GestureController();
        await this.gestureController.init();
    }


    shutdown() {
        if (this.cameraManager) {
            this.cameraManager.destroy();
        }
        if (this.networkManager) {
            this.networkManager.disconnect();
        }

        if (this.gestureController) {
            this.gestureController.cleanup();
        }
        this.keepSocketAlive = false; // Reset
        // Don't stop UIScene here if we want it to persist or if it handles its own input, 
        // but typically UIScene is tied to Game.
        this.scene.stop(CONFIG.SCENES.UI);
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





    setupGameLoops() {
        // Minimap Food Update Loop (1Hz)
        this.time.addEvent({
            delay: CONFIG.INTERVALS.MINIMAP_UPDATE,
            loop: true,
            callback: () => {
                const uiScene = this.scene.get(CONFIG.SCENES.UI);
                if (uiScene) {
                    // Convert Group to simple array of {x,y,type,color}
                    const foodData = this.foodGroup.getChildren().map(f => ({
                        x: f.x,
                        y: f.y,
                        type: f.type,
                        color: f.color
                    }));
                    uiScene.updateMinimapFood(foodData);
                }
            }
        });
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
            this.foodGroup.add(coin);
            return;
        }

        // 2. Quiz Answer Tokens
        if (type === 'text') {
            const quizFood = new QuizFood(this, x, y, data);
            quizFood.id = id;
            this.foodGroup.add(quizFood);
            return;
        }

        // 3. Regular Food (Pooled)
        let food = this.foodGroup.get(x, y);
        if (food) {
            // Check if we accidentally got a Coin/QuizFood from pool if mixed (shouldn't happen if properly destroyed/typed)
            // But to be safe, if the pooled object isn't 'Food', creating new one is safer, or explicit pool groups.
            // For now, assuming foodGroup might contain mixed types if we add them all there.
            // Actually, we added Coin/QuizFood to foodGroup.
            // When we call `get`, we might get a dead Coin.
            // Fix: Check instance type.
            if (!(food instanceof Food)) {
                // If we got the wrong type, ignore it and create new (or handle properly)
                // Better: Create Separate Groups?
                // For now: Just create new if type mismatch.
                food = new Food(this, x, y, color);
                this.foodGroup.add(food);
            }

            food.onSpawn(x, y, color, type, value, data, id);
        } else {
            food = new Food(this, x, y, color);
            food.id = id;
            food.onSpawn(x, y, color, type, value, data, id);
            this.foodGroup.add(food);
        }

        food.setScale(1.0);
        food.setRotation(0);
    }

    update(time, delta) {
        // Update Snakes
        this.snakes.forEach(snake => {
            if (snake.alive) {
                snake.update(time, delta);
            }
        });

        // Send Input
        if (this.player && this.player.alive) {
            let angle;
            let isBoosting = false;

            if (this.isMobile) {
                // MOBILE: Only use Joystick input
                // Default to current rotation if no input
                angle = this.player.rotation;

                // Get input from UIScene
                const uiScene = this.scene.get(CONFIG.SCENES.UI);
                if (uiScene && uiScene.getMobileInput) {
                    const mobileInput = uiScene.getMobileInput();
                    if (mobileInput) {
                        if (mobileInput.angle !== null) {
                            angle = mobileInput.angle;
                        }
                        isBoosting = mobileInput.isBoosting;
                    }
                }
            } else {
                // Check for Gesture Input
                let gestureActive = false;

                if (this.controlMode === 'GESTURE' && this.gestureController && this.gestureController.running) {
                    const gestureParams = this.gestureController.getParams();

                    // Only update if we have a valid angle (or keep last)
                    if (gestureParams.angle !== null) {
                        angle = gestureParams.angle;
                        isBoosting = gestureParams.isBoosting;
                        gestureActive = true;
                    } else {
                        // Lost hand tracking: Maintain last known angle (Cruise Control)
                        // logic is implicitly handled because 'angle' var holds previous value? 
                        // No, 'angle' needs to be defined each frame. 
                        // We should store lastAngle in Game class or rely on GestureController's persistence.
                        // GestureController persists 'angle'.
                        if (this.gestureController.angle !== null) {
                            angle = this.gestureController.angle;
                            isBoosting = false; // Safety: stop boosting if lost
                            gestureActive = true;
                        }
                    }
                }

                if (!gestureActive) {
                    // DESKTOP: Mouse + Space/Click
                    // Only use if Mode is MOUSE (or fallthrough?)
                    // Let's enforce mode strictly
                    if (this.controlMode === 'MOUSE') {
                        angle = this.player.getLookAngle();
                        isBoosting = (this.player.spaceKey.isDown || this.input.activePointer.isDown);
                    } else if (this.controlMode === 'GESTURE') {
                        // In Gesture Mode but no gesture? 
                        // Keep angle = player.rotation (Go Straight)
                        if (typeof angle === 'undefined') angle = this.player.rotation;
                    }
                }
            }

            this.networkManager.sendPlayerInput(angle, isBoosting);
        }




        this.cameraManager.update(this.player);
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
            this.scene.start(CONFIG.SCENES.GAME_OVER, { score: this.player.score, coins: this.coinsCollected });
        } else {
            // Remove from otherSnakes map if it's a remote snake
            if (snake.playerId && this.otherSnakes.has(snake.playerId)) {
                this.otherSnakes.delete(snake.playerId);
            }
        }
    }

    useItem(itemId) {
        if (this.networkManager) {
            this.networkManager.sendUseItem(itemId);
        }
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

