import { Scene } from 'phaser';
import { COLORS, DIMENSIONS, TEXT_STYLES } from './UIConstants';
import { UIButton } from './UIButton';

export class UIPanel extends Phaser.GameObjects.Container {
    /**
     * @param {Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {string} [title]
     * @param {Function} [onClose] - If provided, shows a close button
     */
    constructor(scene, x, y, width, height, title, onClose) {
        super(scene, x, y);

        const radius = DIMENSIONS.PANEL.RADIUS;
        const border = DIMENSIONS.PANEL.BORDER_WIDTH;

        // Background
        const bg = scene.add.graphics();
        bg.fillStyle(COLORS.PANEL_BG, 0.95);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        bg.lineStyle(border, COLORS.PANEL_BORDER, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

        // Block clicks from passing through
        const hitArea = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
            .setInteractive(); // Blocks input

        this.add([bg, hitArea]);

        // Title
        if (title) {
            const titleText = scene.add.text(0, -height / 2 + 40, title, {
                ...TEXT_STYLES.SUBHEADER,
                color: COLORS.TEXT.ACCENT
            }).setOrigin(0.5);

            // Divider Line
            const line = scene.add.rectangle(0, -height / 2 + 75, width - 60, 2, COLORS.PANEL_BORDER);

            this.add([titleText, line]);
        }

        // Close Button
        if (onClose) {
            const btnSize = 50;
            const closeBtn = new UIButton(
                scene,
                width / 2 - 40,
                -height / 2 + 40,
                '✕',
                onClose,
                {
                    width: btnSize,
                    height: btnSize,
                    color: COLORS.DANGER,
                    fontSize: 24,
                    type: 'danger'
                }
            );
            this.add(closeBtn);
        }

        scene.add.existing(this);
    }
}
