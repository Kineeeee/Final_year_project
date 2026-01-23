import Phaser, { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';
import { CONFIG } from '../config/constants';

export class Food extends Phaser.GameObjects.Container {
    constructor(scene, x, y, color) {
        super(scene, x, y);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Child Sprite
        this.sprite = scene.add.image(0, 0, 'food');
        this.add(this.sprite);

        // Set color
        this.applyColor(color);

        this.target = null;
        this.speed = CONFIG.FOOD.SPEED;
        this.magnetDistance = 15;
        this.shineTimer = 0;

        // Physics Body Size (Container coordinates are relative to center)
        this.body.setCircle(CONFIG.FOOD.RADIUS_REGULAR); // Radius 10 = Diameter 20
        this.body.setOffset(0, 0); // Center offset for Container
    }

    applyColor(color) {
        if (color === undefined) {
            const colors = CONFIG.FOOD.COLORS;
            this.sprite.setTint(colors[Math.floor(Math.random() * colors.length)]);
        } else {
            this.sprite.setTint(color);
        }
    }

    setTint(color) {
        if (this.sprite) this.sprite.setTint(color);
    }

    setScale(scale) {
        super.setScale(scale);
        // Ensure text doesn't get weirdly scaled if not intended, but usually fine
    }

    preUpdate(time, delta) {
        // If we have a target (snake head), move towards it
        if (this.target) {
            if (!this.target.active) {
                this.destroy();
                return;
            }

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

        if (this.type === 'coin') {
            this.sprite.rotation += 0.05;
            this.shineTimer = (this.shineTimer || 0) + delta;
            const scalePulse = 1.5 + Math.sin(this.shineTimer * 0.005) * 0.1;
            this.setScale(scalePulse);
        }
    }

    magnetTo(head) {
        this.target = head;
        if (this.body) {
            this.body.enable = false;
        }
    }

    eat() {
        Logger.debug('Food', 'Food eaten');
        this.target = null;

        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            this.body.stop();
            this.body.enable = false;
        }
    }

    onSpawn(x, y, color, type, value, data, id) {
        this.id = id; // Update ID on reuse
        this.setActive(true);
        this.setVisible(true);

        if (this.body) {
            this.body.enable = true;
            this.body.reset(x, y);
            // Ensure Radius is correct (10)
            this.body.setCircle(CONFIG.FOOD.RADIUS_REGULAR);
            this.body.setOffset(0, 0);
        } else {
            this.setPosition(x, y);
        }

        this.applyColor(color);
        this.type = type;

        // Regular Food
        this.sprite.setTexture('food');
        this.sprite.setVisible(true);
        this.sprite.setScale(1.0);
    }

    destroy(fromScene) {
        super.destroy(fromScene);
    }
}
