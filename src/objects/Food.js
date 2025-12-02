import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class Food extends Phaser.GameObjects.Image {
    constructor(scene, x, y, color) {
        super(scene, x, y, 'food');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set color (random if not provided)
        if (color === undefined) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
            this.setTint(colors[Math.floor(Math.random() * colors.length)]);
        } else {
            this.setTint(color);
        }

        this.target = null;
        this.speed = 400;
        this.magnetDistance = 5; // Distance to be considered "eaten"
    }

    preUpdate(time, delta) {
        // If we have a target (snake head), move towards it
        if (this.target && this.target.active) {
            const angle = PhaserMath.Angle.Between(this.x, this.y, this.target.x, this.target.y);
            const velocity = new PhaserMath.Vector2();
            this.scene.physics.velocityFromRotation(angle, this.speed, velocity);
            
            this.x += velocity.x * (delta / 1000);
            this.y += velocity.y * (delta / 1000);

            // Check if we reached the target
            const distance = PhaserMath.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (distance < this.magnetDistance) {
                this.eat();
            }
        }
    }

    magnetTo(head) {
        this.target = head;
        // Disable physics body to prevent multiple collisions/overlaps while moving
        if (this.body) {
            this.body.enable = false;
        }
    }

    eat() {
        Logger.debug('Food', 'Food eaten');
        if (this.target && this.target.parentContainer && this.target.parentContainer.snake) {
             this.target.parentContainer.snake.grow();
        } else if (this.target && this.target.snake) {
             this.target.snake.grow();
        }
        
        this.target = null; // Clear target immediately
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            this.body.stop(); // Stop velocity
            this.body.enable = false;
        }
    }

    onSpawn(x, y, color) {
        this.setActive(true);
        this.setVisible(true);
        
        if (this.body) {
            this.body.enable = true;
            this.body.reset(x, y); // Reset position and velocity
        } else {
            this.setPosition(x, y);
        }

        this.target = null;
        
        if (color === undefined) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
            this.setTint(colors[Math.floor(Math.random() * colors.length)]);
        } else {
            this.setTint(color);
        }
    }
}
