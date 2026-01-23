import { Scene } from 'phaser';

export class UIButton extends Phaser.GameObjects.Container {
    /**
     * @param {Scene} scene - The Scene to which this Game Object belongs.
     * @param {number} x - The horizontal position of this Game Object in the world.
     * @param {number} y - The vertical position of this Game Object in the world.
     * @param {string} text - The text to display on the button.
     * @param {Function} callback - The function to call when clicked.
     * @param {Object} [options] - Optional config
     * @param {number} [options.width=200]
     * @param {number} [options.height=60]
     * @param {number} [options.color=0x1e90ff]
     * @param {number} [options.fontSize=24]
     */
    constructor(scene, x, y, text, callback, options = {}) {
        super(scene, x, y);

        const width = options.width || 200;
        const height = options.height || 60;
        const color = options.color !== undefined ? options.color : 0x1e90ff;
        const fontSize = options.fontSize || 24;

        // Shadow
        const shadow = scene.add.rectangle(4, 6, width, height, 0x000000, 0.35);

        // Background
        const bg = scene.add.rectangle(0, 0, width, height, color)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true });

        // Label
        const label = scene.add.text(0, 0, text, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: fontSize,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add([shadow, bg, label]);

        // Interactions
        bg.on('pointerover', () => {
            bg.setFillStyle(0xffffff);
            label.setColor('#000000');
            scene.tweens.add({ targets: this, scale: 1.05, duration: 100 });
        });

        bg.on('pointerout', () => {
            bg.setFillStyle(color);
            label.setColor('#ffffff');
            scene.tweens.add({ targets: this, scale: 1, duration: 100 });
        });

        bg.on('pointerdown', () => {
            scene.tweens.add({
                targets: this,
                scale: 0.95,
                duration: 60,
                yoyo: true,
                onComplete: callback
            });
        });

        scene.add.existing(this);
    }
}
