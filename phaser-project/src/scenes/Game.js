import { Scene } from 'phaser';
import io from 'socket.io-client';
import { PlayerSnake } from '../objects/snake/PlayerSnake';
import { Snake } from '../objects/snake/Snake';
import { Food } from '../objects/Food';
import { Coin } from '../objects/Coin';
import { Logger } from '../utils/Logger';
import { CONFIG } from '../config/constants';

export class Game extends Scene {
    constructor() {
        super('Game');
    }

    init(data) {
        data = data || {};
        this.myColor = data.color; // If undefined, will use server random color
        this.myName = data.name; // Use server generated name if not provided
        this.gameMode = data.mode || 'normal'; // 'normal', 'math', 'english'
    }

    create() {
        Logger.info('Game', 'Game Scene Created');

        // Detect device
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isMobile = !this.sys.game.device.os.desktop || isMobileUA;

        const WIDTH_WORLD = CONFIG.WORLD_WIDTH;
        const HEIGHT_WORLD = CONFIG.WORLD_HEIGHT;

        // Set world bounds
        this.physics.world.setBounds(0, 0, WIDTH_WORLD, HEIGHT_WORLD);

        // Create a tiled background
        this.add.tileSprite(0, 0, WIDTH_WORLD, HEIGHT_WORLD, 'background').setOrigin(0);

        // Reference game.js: this.game.stage.backgroundColor = '#4444442e';
        this.cameras.main.setBackgroundColor(0x444444);

        // UI is now handled by UIScene
        this.scene.launch('UIScene', { mode: this.gameMode });
        this.scene.bringToTop('UIScene');

        // --- CAMERA ZOOM LOGIC ---
        this.baseZoom = 1.0;
        this.handleCameraZoom();
        this.scale.on('resize', this.handleCameraZoom, this);

        this.snakes = [];
        this.coinsCollected = 0; // Track coins for this session
        this.otherSnakes = new Map(); // Map<playerId, Snake>

        this.foodGroup = this.add.group({
            classType: Food,
            runChildUpdate: true
        });

        // Socket Connection
        let serverUrl = CONFIG.SERVER_URL;
        if (this.gameMode === 'math') serverUrl += '/math';
        if (this.gameMode === 'english') serverUrl += '/english';

        Logger.info('Game', `Connecting to Server: ${serverUrl}`);
        this.socket = io(serverUrl, { forceNew: true });

        // Listen for initial player state to sync High Score immediately
        this.socket.on('playerState', (state) => {
            if (state.highScore !== undefined) {
                Logger.info('Game', `Syncing High Score from Server: ${state.highScore}`);
                localStorage.setItem('highScore', state.highScore);
            }
            if (state.coins !== undefined) {
                localStorage.setItem('coins', state.coins);
                this.events.emit('coinsChanged', state.coins); // Sync coins too
            }
            if (state.inventory) {
                localStorage.setItem('inventory', JSON.stringify(state.inventory));
                this.events.emit('updateInventory', state.inventory);
            }
        });

        // Send initialization data (color, name) immediately upon connection
        this.socket.on('connect', () => {
            Logger.info('Game', 'Connected to Server');
            const initData = {
                color: this.myColor,
                name: this.myName
            };
            const savedInventory = localStorage.getItem('inventory');
            if (savedInventory) {
                try {
                    initData.inventory = JSON.parse(savedInventory);
                } catch (e) {
                    Logger.error('Game', 'Failed to parse inventory', e);
                }
            }

            this.socket.emit('initPlayer', initData);
        });

        if (this.socket) {
            // ...
            this.socket.on('updateHighScore', (newHighScore) => {
                Logger.info('Game', `New High Score: ${newHighScore}`);
                localStorage.setItem('highScore', newHighScore);
            });
        }


        // Handle Scene Shutdown
        this.events.on('shutdown', this.shutdown, this);
        this.events.on('destroy', this.shutdown, this);

        // Ping Logic
        this.lastPingTime = 0;
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.lastPingTime = Date.now();
                this.socket.emit('ping');
            },
            loop: true
        });

        this.socket.on('pong', () => {
            const latency = Date.now() - this.lastPingTime;
            this.events.emit('updatePing', latency);
        });

        this.socket.on('currentPlayers', (players) => {
            // Clear existing snakes on reconnect/init to prevent duplicates
            this.snakes.forEach(snake => snake.destroy());
            this.snakes = [];
            this.otherSnakes.clear();
            this.player = null;

            Object.keys(players).forEach((id) => {
                if (players[id].playerId === this.socket.id) {
                    this.createPlayer(players[id]);
                } else {
                    this.addOtherPlayers(players[id]);
                }
            });
        });

        // Minimap Food Update Loop (1Hz)
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const uiScene = this.scene.get('UIScene');
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

        this.socket.on('newPlayer', (playerInfo) => {
            this.addOtherPlayers(playerInfo);
        });

        this.socket.on('playerDisconnected', (playerId) => {
            if (this.otherSnakes.has(playerId)) {
                const snake = this.otherSnakes.get(playerId);
                snake.destroy();
                this.otherSnakes.delete(playerId);
                this.snakes = this.snakes.filter(s => s !== snake);
            }
        });

        this.socket.on('currentFood', (foodData) => {
            // Clear existing food to prevent ghost food on reconnect
            this.foodGroup.clear(true, true);

            Object.keys(foodData).forEach((id) => {
                const f = foodData[id];
                this.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
            });
        });

        this.socket.on('newFood', (f) => {
            this.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
        });

        // QUIZ HUD EVENTS
        this.socket.on('newQuestion', (data) => {
            this.events.emit('updateQuestion', data); // Emit to UIScene
        });

        this.socket.on('roundStart', (data) => {
            this.events.emit('roundStart', data); // Emit to UIScene
        });

        this.socket.on('roundEnd', (data) => {
            this.events.emit('roundEnd', data); // Emit to UIScene
        });

        this.socket.on('batchFood', (foodArray) => {
            // Cancel any previous staggered spawn
            if (this.staggeredSpawnTimer) {
                this.staggeredSpawnTimer.destroy();
                this.staggeredSpawnTimer = null;
            }

            // Stagger spawning to prevent frame drops
            const BATCH_SIZE = 20; // Spawn 20 items per frame
            let index = 0;

            const spawnBatch = () => {
                const end = Math.min(index + BATCH_SIZE, foodArray.length);
                for (let i = index; i < end; i++) {
                    const f = foodArray[i];
                    this.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
                }
                index = end;

                if (index < foodArray.length) {
                    // Continue next frame
                    this.staggeredSpawnTimer = this.time.delayedCall(16, spawnBatch); // ~1 frame delay (60fps)
                } else {
                    this.staggeredSpawnTimer = null;
                }
            };

            spawnBatch();
        });

        // Lắng nghe sự kiện cập nhật tiền
        this.socket.on('updateCoins', (newCoins) => {
            // Lưu vào localStorage
            localStorage.setItem('coins', newCoins);
            this.events.emit('coinsChanged', newCoins);
            Logger.info('Game', `Coins updated: ${newCoins}`);
        });

        this.socket.on('foodEaten', (data) => {
            // data = { foodId, playerId, score }
            const food = this.foodGroup.getChildren().find(f => f.id == data.foodId);
            if (food) {
                // Tìm người ăn để bay vào
                let eater = null;
                if (this.player && this.player.playerId === data.playerId) {
                    eater = this.player;
                } else if (this.otherSnakes.has(data.playerId)) {
                    eater = this.otherSnakes.get(data.playerId);
                }

                if (eater && eater.head) {
                    // Kích hoạt hiệu ứng nam châm bay vào đầu rắn
                    food.magnetTo(eater.head);

                    // Track coins collected by local player
                    if (eater === this.player && data.type === 'coin') {
                        this.coinsCollected += 10; // Value matches Server (10)
                    }
                } else {
                    // Nếu không thấy người ăn (hoặc lỗi), xoá ngay lập tức
                    food.destroy();
                }
            }
        });

        // Add explicit removal listener (for Quiz cleanup)
        this.socket.on('removeFood', (foodId) => {
            const food = this.foodGroup.getChildren().find(f => f.id == foodId);
            if (food) {
                food.destroy();
            }
        });

        // Batch removal for quiz food (PERFORMANCE OPTIMIZATION)
        this.socket.on('clearQuizFood', (foodIds) => {
            // CRITICAL: Cancel any ongoing staggered spawn to prevent ghost food
            if (this.staggeredSpawnTimer) {
                this.staggeredSpawnTimer.destroy();
                this.staggeredSpawnTimer = null;
            }

            // Instead of matching IDs (which can desync), clear ALL quiz food by type
            // CRITICAL: Create a COPY of the array because valid destroy() modifies the live array, breaking the loop
            const allFood = [...this.foodGroup.getChildren()];
            allFood.forEach(food => {
                if (food.type === 'text') {
                    food.destroy();
                }
            });
        });

        // Batch Remove (Efficient Cleanup)
        this.socket.on('batchRemove', (ids) => {
            // CRITICAL: Iterate COPY to allow safe destruction
            const allFood = [...this.foodGroup.getChildren()];
            const idSet = new Set(ids);

            allFood.forEach(food => {
                if (idSet.has(food.id)) {
                    food.destroy();
                }
            });
        });

        this.socket.on('playerDied', (playerId) => {
            if (this.player && this.player.playerId === playerId) {
                // Pass socket to GameOver to receive High Score update
                this.keepSocketAlive = true; // Prevent shutdown from killing socket
                this.scene.start('GameOver', {
                    score: this.player.score,
                    coins: this.coinsCollected,
                    socket: this.socket // Pass socket
                });
            }
        });

        // Listen for property updates (like color changes)
        this.socket.on('playerProperties', (data) => {
            // data = { id, color, name }
            let snake;
            if (this.player && this.player.playerId === data.id) {
                snake = this.player;
            } else if (this.otherSnakes.has(data.id)) {
                snake = this.otherSnakes.get(data.id);
            }

            if (snake) {
                if (data.color) snake.setColor(data.color);
                if (data.name) snake.setName(data.name);
            }
        });

        this.socket.on('updateInventory', (inventory) => {
            Logger.info('Game', 'Inventory Updated:', inventory);
            localStorage.setItem('inventory', JSON.stringify(inventory));
            this.events.emit('updateInventory', inventory);
        });

        this.socket.on('answerResult', (data) => {
            // data: { playerId, correct, scoreChange, x, y }
            this.showFloatingText(data.x, data.y, data.correct ? "CORRECT!" : "WRONG!", data.correct ? 0x00ff00 : 0xff0000);

            // If it's me, showed score change
            if (this.player && this.player.playerId === data.playerId) {
                this.events.emit('showToast', {
                    message: data.correct ? `Correct! +${data.scoreChange}` : `Wrong! ${data.scoreChange}`,
                    color: data.correct ? '#00ff00' : '#ff0000'
                });
            }
        });

        this.socket.on('itemActivated', (data) => {
            Logger.info('Game', 'Item Activated:', data);

            // Emit event for UI (only if it's me)
            if (this.player && this.player.playerId === data.playerId) {
                this.events.emit('itemActivated', data);
            }

            // Trigger visual effect for ANY player (Local or Remote)
            let snake;
            if (this.player && this.player.playerId === data.playerId) {
                snake = this.player;
            } else if (this.otherSnakes.has(data.playerId)) {
                snake = this.otherSnakes.get(data.playerId);
            }

            if (snake) {
                switch (data.itemId) {
                    case 'ghost': snake.setGhostEffect(true, data.buffValue); break;
                    case 'magnet': snake.setMagnetEffect(true, data.buffValue); break;
                    case 'speed': snake.setSpeedEffect(true, data.buffValue); break;
                }
            }
        });

        this.socket.on('itemDeactivated', (data) => {
            // Emit event for UI (only if it's me)
            if (this.player && this.player.playerId === data.playerId) {
                this.events.emit('itemDeactivated', data);
            }

            // Stop visual effect for ANY player
            let snake;
            if (this.player && this.player.playerId === data.playerId) {
                snake = this.player;
            } else if (this.otherSnakes.has(data.playerId)) {
                snake = this.otherSnakes.get(data.playerId);
            }

            if (snake) {
                switch (data.itemId) {
                    case 'ghost': snake.setGhostEffect(false); break;
                    case 'magnet': snake.setMagnetEffect(false); break;
                    case 'speed': snake.setSpeedEffect(false); break;
                }
            }
        });

        this.socket.on('playerUpdates', (players) => {
            // Update Leaderboard
            const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score).slice(0, 5);
            let text = 'Leaderboard:\n';
            sortedPlayers.forEach((p, index) => {
                text += `${index + 1}. ${p.name || 'Unknown'}: ${p.score}\n`;
            });
            this.events.emit('updateLeaderboard', text);

            Object.keys(players).forEach((id) => {
                if (this.player && id === this.socket.id) {
                    // Store target position for interpolation
                    this.player.targetX = players[id].x;
                    this.player.targetY = players[id].y;
                    this.player.targetRotation = players[id].rotation; // Sync rotation from server

                    // Sync Score/Length
                    if (players[id].score > this.player.score) {
                        this.player.addSections(players[id].score - this.player.score);
                        this.player.score = players[id].score;
                    } else if (players[id].score < this.player.score) {
                        // Handle shrinking (e.g. boosting cost)
                        const diff = this.player.score - players[id].score;
                        for (let i = 0; i < diff; i++) this.player.shrink();
                        this.player.score = players[id].score;
                    }

                    // Sync Boosting Visuals (Server Authoritative)
                    if (players[id].isBoosting) {
                        if (this.player.shadow) this.player.shadow.setLightingUp(true);
                        this.player.speed = this.player.fastSpeed;
                    } else {
                        if (this.player.shadow) this.player.shadow.setLightingUp(false);
                        this.player.speed = this.player.slowSpeed;
                    }

                    // Update Minimap
                    const uiScene = this.scene.get('UIScene');
                    if (uiScene) {
                        uiScene.updateMinimapPlayer(this.player.head.x, this.player.head.y);
                    }
                } else {
                    if (this.otherSnakes.has(id)) {
                        const otherSnake = this.otherSnakes.get(id);
                        // Store target position for interpolation
                        otherSnake.targetX = players[id].x;
                        otherSnake.targetY = players[id].y;
                        otherSnake.targetRotation = players[id].rotation;
                        // Sync Score/Length
                        if (players[id].score > otherSnake.score) {
                            otherSnake.addSections(players[id].score - otherSnake.score);
                            otherSnake.score = players[id].score;
                        } else if (players[id].score < otherSnake.score) {
                            // Handle shrinking
                            const diff = otherSnake.score - players[id].score;
                            for (let i = 0; i < diff; i++) otherSnake.shrink();
                            otherSnake.score = players[id].score;
                        }

                        // Sync Boosting Visuals
                        if (players[id].isBoosting) {
                            if (otherSnake.shadow) otherSnake.shadow.setLightingUp(true);
                            otherSnake.speed = otherSnake.fastSpeed;
                        } else {
                            if (otherSnake.shadow) otherSnake.shadow.setLightingUp(false);
                            otherSnake.speed = otherSnake.slowSpeed;
                        }
                    }
                }
            });
        });
    }

    shutdown() {
        if (this.socket) {
            // Always remove listeners to prevent them firing on a dead scene (Fixes crash on death)
            this.socket.removeAllListeners();

            if (!this.keepSocketAlive) {
                this.socket.disconnect();
            }
        }
        this.keepSocketAlive = false; // Reset
        // Don't stop UIScene here if we want it to persist or if it handles its own input, 
        // but typically UIScene is tied to Game.
        this.scene.stop('UIScene');
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
        this.cameras.main.startFollow(this.player.head);

        // Apply Initial Effects (if reconnection or late join)
        if (playerInfo.activeEffects) {
            Object.keys(playerInfo.activeEffects).forEach(itemId => {
                const buffValue = 0; // Trigger effect (visuals often don't need exact value, or we assume default)
                // If we need buffValue, Server should send it in playerInfo. For now, visual is enough.
                switch (itemId) {
                    case 'ghost': this.player.setGhostEffect(true); break;
                    case 'magnet': this.player.setMagnetEffect(true); break;
                    case 'speed': this.player.setSpeedEffect(true); break;
                }
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
                switch (itemId) {
                    case 'ghost': otherPlayer.setGhostEffect(true); break;
                    case 'magnet': otherPlayer.setMagnetEffect(true); break;
                    case 'speed': otherPlayer.setSpeedEffect(true); break;
                }
            });
        }

        this.otherSnakes.set(playerInfo.playerId, otherPlayer);
        this.snakes.push(otherPlayer);
    }

    spawnFood(x, y, color, id, type = 'regular', value = 1, data = null) {
        if (!this.textures.exists('food')) {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xff0000, 1);

            // Reference food.js uses 'asset/hex.png'.
            // Let's draw a hexagon.
            // Radius 10 approx.
            const radius = 10;
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = Phaser.Math.DegToRad(60 * i);
                points.push({
                    x: radius * Math.cos(angle),
                    y: radius * Math.sin(angle)
                });
            }
            graphics.fillPoints(points, true);
            graphics.generateTexture('food', 20, 20);
        }

        if (type === 'coin') {
            const coin = new Coin(this, x, y, id);
            this.foodGroup.add(coin);
            return;
        }

        let food;

        // DISABLE REUSE FOR ANSWER ORBS (User Request)
        if (type === 'text') {
            food = new Food(this, x, y, color);
            food.id = id;
            food.onSpawn(x, y, color, type, value, data, id);
            this.foodGroup.add(food);
        }
        // POOLING for Regular Food / Coins
        else {
            food = this.foodGroup.get(x, y);
            if (food) {
                food.onSpawn(x, y, color, type, value, data, id);
                food.id = id;
            } else {
                food = new Food(this, x, y, color);
                food.id = id;
                food.onSpawn(x, y, color, type, value, data, id);
                this.foodGroup.add(food);
            }
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
                const uiScene = this.scene.get('UIScene');
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
                // DESKTOP: Mouse + Space/Click
                angle = this.player.getLookAngle();
                isBoosting = (this.player.spaceKey.isDown || this.input.activePointer.isDown);
            }

            this.socket.emit('playerInput', { angle: angle, isBoosting: isBoosting });
        }




        this.updateCamera();
    }

    updateCamera() {
        if (!this.player || !this.player.alive) return;

        // Calculate target zoom based on player scale
        const scaleDiff = this.player.scale - 0.6;

        // Use calculated baseZoom instead of fixed 1.0
        let targetZoom = this.baseZoom - (scaleDiff * 0.4);

        // Limit zoom relative to baseZoom
        // Min zoom is half of baseZoom
        targetZoom = Phaser.Math.Clamp(targetZoom, this.baseZoom * 0.5, this.baseZoom);

        // Smoothly interpolate current zoom to target zoom
        this.cameras.main.setZoom(
            Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.05)
        );
    }

    handleCameraZoom() {
        const width = this.scale.width;
        // Target width is roughly what we expect on a standard desktop (e.g., 1440)
        // If the screen is smaller (mobile), we zoom out (reduce zoom value) to show more world.
        const targetWidth = 1440;

        let zoom = width / targetWidth;

        // Clamp zoom to reasonable limits
        // Min 0.5 (Mobile view) - Max 1.0 (Desktop view)
        this.baseZoom = Phaser.Math.Clamp(zoom, 0.5, 1.0);

        // Apply immediately if player not spawned yet
        if (!this.player) {
            this.cameras.main.setZoom(this.baseZoom);
        }
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
            this.scene.start('GameOver', { score: this.player.score, coins: this.coinsCollected });
        } else {
            // Remove from otherSnakes map if it's a remote snake
            if (snake.playerId && this.otherSnakes.has(snake.playerId)) {
                this.otherSnakes.delete(snake.playerId);
            }
        }
    }

    useItem(itemId) {
        if (this.socket) {
            this.socket.emit('useItem', itemId);
        }
    }

    showFloatingText(x, y, message, color) {
        // Offset Y by -50 to show above head
        const text = this.add.text(x, y - 50, message, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        if (typeof color === 'number') text.setTint(color);
        else text.setColor(color);

        this.tweens.add({
            targets: text,
            y: y - 100, // Move up further
            alpha: 0,
            scale: 1.5,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
}

