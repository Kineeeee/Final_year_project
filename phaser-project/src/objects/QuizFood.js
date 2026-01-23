import Phaser, { Math as PhaserMath } from 'phaser';
import { CONFIG } from '../config/constants';

export class QuizFood extends Phaser.GameObjects.Container {
    constructor(scene, x, y, data) {
        super(scene, x, y);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.type = 'text';

        // 1. Background (White Token)
        this.tokenBg = scene.add.circle(0, 0, CONFIG.FOOD.RADIUS_QUIZ, CONFIG.FOOD.QUIZ_BG_COLOR);
        this.tokenBg.setStrokeStyle(4, 0x000000);
        this.add(this.tokenBg);

        // 2. Text Label
        const textValue = data && data.text ? data.text : '?';
        this.textLabel = scene.add.text(0, 0, textValue, {
            fontSize: '40px',
            fontFamily: 'Arial',
            color: '#000000', // Black text
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add(this.textLabel);

        // Physics Body
        this.body.setCircle(CONFIG.FOOD.RADIUS_QUIZ);
        this.body.setOffset(-CONFIG.FOOD.RADIUS_QUIZ, -CONFIG.FOOD.RADIUS_QUIZ);

        // Pulse Animation
        this.pulseTween = scene.tweens.add({
            targets: this.tokenBg,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.applyColor(); // Optional: apply color if needed, but usually fixed for Quiz
    }

    applyColor() {
        // Quiz tokens usually have fixed white bg, but if we want color hints later...
    }

    magnetTo(head) {
        this.target = head;
        if (this.body) this.body.enable = false;
        // Move logic
    }

    preUpdate(time, delta) {
        // Magnet Logic (Similar to Food/Coin)
        if (this.target) {
            if (!this.target.active) {
                this.destroy();
                return;
            }

            const angle = PhaserMath.Angle.Between(this.x, this.y, this.target.x, this.target.y);
            const velocity = new PhaserMath.Vector2();
            this.scene.physics.velocityFromRotation(angle, CONFIG.FOOD.SPEED, velocity);

            this.x += velocity.x * (delta / 1000);
            this.y += velocity.y * (delta / 1000);

            // Check if we reached the target
            const distance = PhaserMath.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (distance < 15) {
                this.eat();
            }
        }
    }

    eat() {
        this.destroy();
    }

    destroy(fromScene) {
        if (this.pulseTween) {
            this.pulseTween.remove();
            this.pulseTween = null;
        }
        super.destroy(fromScene);
    }
}
