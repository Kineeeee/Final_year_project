import { Scene } from 'phaser';
import { PlayerSnake } from '../objects/PlayerSnake';
import { BotSnake } from '../objects/BotSnake';
import { Food } from '../objects/Food';
import { Logger } from '../utils/Logger';

export class Game extends Scene {
    constructor() {
        super('Game');
    }

    create() {
        Logger.info('Game', 'Game Scene Created');
        // Set world bounds
        this.physics.world.setBounds(0, 0, 3000, 3000);

        // Create a tiled background
        this.add.tileSprite(0, 0, 3000, 3000, 'background').setOrigin(0);

        // Set camera bounds - REMOVED to fix control issues at edges
        // When camera stops at edge, snake gets too close to mouse pointer, causing erratic movement
        // this.cameras.main.setBounds(0, 0, 3000, 3000);
        
        // Reference game.js: this.game.stage.backgroundColor = '#444';
        this.cameras.main.setBackgroundColor(0x444444);

        this.snakes = [];
        this.foodGroup = this.add.group({
            classType: Food,
            runChildUpdate: true
        }); 

        // Create Player
        this.player = new PlayerSnake(this, 1500, 1500);
        this.snakes.push(this.player);

        // Create Bots
        for (let i = 0; i < 10; i++) {
            const x = Phaser.Math.Between(100, 2900);
            const y = Phaser.Math.Between(100, 2900);
            const bot = new BotSnake(this, x, y);
            this.snakes.push(bot);
        }

        // Spawn initial food
        for (let i = 0; i < 300; i++) {
            this.spawnFood();
        }

        // Camera follow
        this.cameras.main.startFollow(this.player.head);
    }

    spawnFood(x, y, color) {
        if (x === undefined) x = Phaser.Math.Between(0, 3000);
        if (y === undefined) y = Phaser.Math.Between(0, 3000);
        
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
        }
    }

    update(time, delta) {
        // Update Snakes
        this.snakes.forEach(snake => {
            if (snake.alive) {
                snake.update(time, delta);
                this.checkCollisions(snake);
            }
        });

        // Update Food (for magnet effect)
        this.foodGroup.children.each(food => {
            if (food.active) {
                food.preUpdate(time, delta);
            }
        });
        
        // Respawn food if too low
        if (this.foodGroup.countActive() < 100) {
            this.spawnFood();
        }

        this.updateCamera();
    }

    updateCamera() {
        if (!this.player || !this.player.alive) return;

        // Calculate target zoom based on player scale
        // As player gets bigger (scale increases), zoom out (zoom value decreases)
        // Base scale 0.6 -> Zoom 1.0
        let targetZoom = 0.6 / this.player.scale;

        // Limit zoom (min 0.5, max 1.0)
        targetZoom = Phaser.Math.Clamp(targetZoom, 0.5, 1.0);

        // Smoothly interpolate current zoom to target zoom
        this.cameras.main.setZoom(
            Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.05)
        );
    }

    checkCollisions(snake) {
        // 1. Snake Head vs Food
        this.physics.overlap(snake.head, this.foodGroup, (head, food) => {
            if (food instanceof Food && !food.target) {
                food.magnetTo(snake.head);
            }
        });

        // 2. Snake Head vs World Bounds
        if (snake.head.x < 0 || snake.head.x > 3000 ||
            snake.head.y < 0 || snake.head.y > 3000) {
            this.killSnake(snake);
            return;
        }

        // 3. Snake Head vs Other Snakes (Body)
        for (const otherSnake of this.snakes) {
            if (otherSnake === snake || !otherSnake.alive) continue;

            this.physics.overlap(snake.head, otherSnake.bodyGroup, () => {
                this.killSnake(snake);
            });
        }
    }

    killSnake(snake) {
        if (!snake.alive) return;
        snake.alive = false;
        
        Logger.info('Game', `Snake died. Is Player: ${snake === this.player}`);

        // Convert body to food
        // Spawn food at every 2nd body part position
        for (let i = 0; i < snake.body.length; i += 2) {
            const part = snake.body[i];
            // Add some randomness
            this.spawnFood(
                part.x + Phaser.Math.Between(-10, 10), 
                part.y + Phaser.Math.Between(-10, 10),
                snake.color // Pass snake's color
            );
        }

        snake.destroy();

        if (snake === this.player) {
            this.scene.start('GameOver');
        } else {
            // Respawn bot after a delay? Or just leave it dead.
            // Let's respawn a new bot to keep the game lively
            this.time.delayedCall(2000, () => {
                const x = Phaser.Math.Between(100, 2900);
                const y = Phaser.Math.Between(100, 2900);
                const bot = new BotSnake(this, x, y);
                this.snakes.push(bot);
            });
        }
    }
}
