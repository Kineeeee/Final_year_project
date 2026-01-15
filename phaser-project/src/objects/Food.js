import Phaser, { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class Food extends Phaser.GameObjects.Container {
    constructor(scene, x, y, color) {
        super(scene, x, y);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Child Sprite
        this.sprite = scene.add.image(0, 0, 'food');
        this.add(this.sprite);

        // Text (Hidden by default)
        this.textLabel = scene.add.text(0, 0, '', {
            fontSize: '24px', // Larger
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add(this.textLabel);
        this.textLabel.setVisible(false);

        // Set color
        this.applyColor(color);

        this.target = null;
        this.speed = 800;
        this.magnetDistance = 15;
        this.shineTimer = 0;

        // Physics Body Size (Container coordinates are relative to center)
        this.body.setCircle(10); // Radius 10 = Diameter 20
        this.body.setOffset(0, 0); // Center offset for Container
    }

    applyColor(color) {
        if (color === undefined) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
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

        // NO REUSE for Quiz Answers -> Destroy immediately
        if (this.type === 'text') {
            this.destroy();
        } else {
            this.setActive(false);
            this.setVisible(false);
            if (this.body) {
                this.body.stop();
                this.body.enable = false;
            }
        }
    }

    onSpawn(x, y, color, type, value, data, id) {
        this.id = id; // Update ID on reuse
        this.setActive(true);
        this.setVisible(true);

        if (this.body) {
            this.body.enable = true;
            this.body.reset(x, y);
        } else {
            this.setPosition(x, y);
        }

        this.applyColor(color);
        this.type = type;

        // Reset Visuals
        this.sprite.setVisible(true);
        this.sprite.setScale(1.0);
        this.textLabel.setVisible(false);
        if (this.tokenBg) this.tokenBg.setVisible(false);

        // Handle Coin Texture
        if (type === 'coin') {
            this.sprite.setTexture('coin');
            this.setScale(1.5);
        }
        // Handle Quiz/Text Food
        else if (data && data.text) {
            // "Token" Style
            this.sprite.setVisible(false); // Hide default food dot

            if (!this.tokenBg) {
                this.tokenBg = this.scene.add.circle(0, 0, 35, 0xffffff); // Radius 35 (Diameter 70)
                this.tokenBg.setStrokeStyle(4, 0x000000);
                this.addAt(this.tokenBg, 0); // Add behind text
            }
            this.tokenBg.setVisible(true);
            this.tokenBg.setRadius(35); // Ensure radius update
            // User might want "Find the answer", so creating color hints might make it too easy?
            // Let's stick to neutral or keep the random color?
            // Let's use WHITE for high contrast.
            this.tokenBg.setFillStyle(0xffffff);

            this.textLabel.setText(data.text);
            this.textLabel.setFontSize('40px'); // Much larger
            this.textLabel.setColor('#000000'); // Black text on White
            this.textLabel.setStroke('#000000', 6); // Thicker stroke (but white text has stroke black.. wait, black text on white usually no stroke or white stroke?)
            // Actually, black text on white circle doesn't need stroke, or maybe white stroke?
            // Let's remove stroke for clarity on white bg, or keep it thin.
            this.textLabel.setStroke('#ffffff', 0);
            // Wait, previous code had stroke black on white text.
            // Now text is black.

            this.textLabel.setVisible(true);

            // Bigger Body for easier eating (radius 35 = diameter 70)
            this.body.setCircle(35);
            // Container origin is at center, so offset should be 0
            // (not -35 which would shift body away from visual)
            this.body.setOffset(0, 0);

            // Add Pulse Animation (Save reference for cleanup)
            if (this.pulseTween) {
                this.pulseTween.remove();
            }
            this.pulseTween = this.scene.tweens.add({
                targets: this.tokenBg,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        // Regular Food
        else {
            this.sprite.setTexture('food');
            // Reset Body (radius 10)
            this.body.setCircle(10);
            this.body.setOffset(0, 0);
        }

        // Handle specific color override for regular food/coin
        if (type !== 'text' && !data) {
            // ... existing color logic usually handled by applyColor
        }
    }

    destroy(fromScene) {
        // Clean up tween before destroying to prevent memory leaks
        if (this.pulseTween) {
            this.pulseTween.remove();
            this.pulseTween = null;
        }
        super.destroy(fromScene);
    }
}
