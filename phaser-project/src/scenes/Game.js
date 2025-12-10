import { Scene } from 'phaser';
import io from 'socket.io-client';
import { PlayerSnake } from '../objects/snake/PlayerSnake';
import { Snake } from '../objects/snake/Snake';
import { Food } from '../objects/Food';
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
        
        // Reference game.js: this.game.stage.backgroundColor = '#444';
        this.cameras.main.setBackgroundColor(0x444444);

        // UI is now handled by UIScene
        this.scene.launch('UIScene');
        this.scene.bringToTop('UIScene');

        // --- CAMERA ZOOM LOGIC ---
        this.baseZoom = 1.0;
        this.handleCameraZoom();
        this.scale.on('resize', this.handleCameraZoom, this);

        this.snakes = [];
        this.otherSnakes = new Map(); // Map<playerId, Snake>

        this.foodGroup = this.add.group({
            classType: Food,
            runChildUpdate: true
        }); 

        // Socket Connection
        this.socket = io(CONFIG.SERVER_URL, { forceNew: true });

        // Send initialization data (color, name) immediately upon connection
        this.socket.on('connect', () => {
            const initData = {};
            if (this.myColor !== undefined) initData.color = this.myColor;
            if (this.myName) initData.name = this.myName;
            
            this.socket.emit('initPlayer', initData);
        });

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
                const foodInfo = foodData[id];
                this.spawnFood(foodInfo.x, foodInfo.y, foodInfo.color, foodInfo.id);
            });
        });

        this.socket.on('newFood', (foodInfo) => {
            this.spawnFood(foodInfo.x, foodInfo.y, foodInfo.color, foodInfo.id);
        });

        this.socket.on('foodEaten', (data) => {
            // data = { foodId, playerId, score }
            // Remove food safely
            const foodToRemove = this.foodGroup.getChildren().find(food => food.id == data.foodId);
            if (foodToRemove) {
                foodToRemove.destroy();
            }
        });

        this.socket.on('playerDied', (playerId) => {
            if (this.player && this.player.playerId === playerId) {
                this.scene.start('GameOver');
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
                        for(let i=0; i<diff; i++) this.player.shrink();
                        this.player.score = players[id].score;
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
                            for(let i=0; i<diff; i++) otherSnake.shrink();
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
            this.socket.disconnect();
            this.socket.removeAllListeners();
        }
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

        this.otherSnakes.set(playerInfo.playerId, otherPlayer);
        this.snakes.push(otherPlayer);
    }

    spawnFood(x, y, color, id) {
        // if (x === undefined) x = Phaser.Math.Between(0, 3000);
        // if (y === undefined) y = Phaser.Math.Between(0, 3000);
        
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

        const food = this.foodGroup.get(x, y);
        if (food) {
            food.onSpawn(x, y, color);
            food.id = id; // Assign Server ID
        }
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
            
            // Visual feedback for local player immediately
            if (isBoosting && this.player.score > 2) {
                 if (this.player.shadow) this.player.shadow.setLightingUp(true);
                 this.player.speed = this.player.fastSpeed;
            } else {
                 if (this.player.shadow) this.player.shadow.setLightingUp(false);
                 this.player.speed = this.player.slowSpeed;
            }
        }

        // Update Food (for magnet effect)
        this.foodGroup.children.each(food => {
            if (food.active) {
                food.preUpdate(time, delta);
            }
        });
        
        // Respawn food if too low
        // if (this.foodGroup.countActive() < 100) {
        //     this.spawnFood();
        // }

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

    // checkCollisions removed for Server Authoritative Fairness
    // Client no longer predicts death. We wait for server 'playerDied' event.

    killSnake(snake) {
        if (!snake.alive) return;
        snake.alive = false;
        
        Logger.info('Game', `Snake died. Is Player: ${snake === this.player}`);

        // In Online Mode, we don't spawn food locally when dying (Server handles it)
        // But we do destroy the snake object to stop it from moving/rendering
        
        snake.destroy();
        this.snakes = this.snakes.filter(s => s !== snake);

        if (snake === this.player) {
            this.scene.start('GameOver');
        } else {
            // Remove from otherSnakes map if it's a remote snake
            if (snake.playerId && this.otherSnakes.has(snake.playerId)) {
                this.otherSnakes.delete(snake.playerId);
            }
        }
    }
}
