import { Scene } from 'phaser';
import { COLORS, TEXT_STYLES, DIMENSIONS } from './UIConstants';

export class UIButton extends Phaser.GameObjects.Container {
    constructor(scene, x, y, text, callback, options = {}) {
        super(scene, x, y);

        this.scene = scene;
        this.callback = callback;
        this.enabled = true;
        this.isDown = false;
        this.currentTween = null;

        const width = options.width || 200;
        const height = options.height || DIMENSIONS.BUTTON.HEIGHT;
        const radius = DIMENSIONS.BUTTON.RADIUS;

        const type = options.type || 'primary';

        this.baseColor = COLORS.PRIMARY;
        this.hoverColor = COLORS.PRIMARY_HOVER;
        this.disabledColor = COLORS.DISABLED;

        if (options.color) {
            this.baseColor = options.color;
            this.hoverColor = Phaser.Display.Color
                .IntegerToColor(options.color)
                .brighten(15).color;
        } else {
            switch (type) {
                case 'secondary':
                    this.baseColor = COLORS.SECONDARY;
                    this.hoverColor = COLORS.SECONDARY_HOVER;
                    break;
                case 'danger':
                    this.baseColor = COLORS.DANGER;
                    this.hoverColor = COLORS.DANGER_HOVER;
                    break;
                case 'accent':
                    this.baseColor = COLORS.ACCENT;
                    this.hoverColor = COLORS.ACCENT_HOVER;
                    break;
            }
        }

        // Shadow
        const shadow = scene.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        // Background
        this.bg = scene.add.graphics();
        this._draw(this.baseColor, width, height, radius);

        // Hit Area
        this.hitArea = scene.add
            .rectangle(0, 0, width - 6, height - 6, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        // Label
        const style = { ...TEXT_STYLES.BUTTON };
        if (options.fontSize) style.fontSize = options.fontSize;

        this.label = scene.add.text(0, 0, text, style).setOrigin(0.5);

        this.add([shadow, this.bg, this.hitArea, this.label]);

        this._bindEvents();

        scene.add.existing(this);
    }

    _bindEvents() {
        this.hitArea.on('pointerover', () => {
            if (!this.enabled) return;
            this._draw(this.hoverColor);
            this._tweenScale(1.05);
        });

        this.hitArea.on('pointerout', () => {
            if (!this.enabled) return;
            this.isDown = false;
            this._draw(this.baseColor);
            this._tweenScale(1);
        });

        this.hitArea.on('pointerdown', () => {
            if (!this.enabled) return;
            this.isDown = true;
            this._tweenScale(0.95);
        });

        this.hitArea.on('pointerup', () => {
            if (!this.enabled || !this.isDown) return;

            this.isDown = false;
            this._tweenScale(1);

            if (this.callback) {
                this.callback();
            }
        });
    }

    _tweenScale(scale) {
        if (this.currentTween) {
            this.currentTween.stop();
        }

        this.currentTween = this.scene.tweens.add({
            targets: this,
            scale,
            duration: 100,
            ease: 'Back.easeOut'
        });
    }

    _draw(color, w = this.hitArea.width + 6, h = this.hitArea.height + 6, r = DIMENSIONS.BUTTON.RADIUS) {
        this.bg.clear();
        this.bg.fillStyle(color, 1);
        this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        this.bg.lineStyle(2, 0xffffff, 0.8);
        this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    }

    setEnabled(value) {
        this.enabled = value;

        if (!value) {
            this._draw(this.disabledColor);
            this.setScale(1);
            this.setAlpha(0.6);
            this.hitArea.disableInteractive();
        } else {
            this._draw(this.baseColor);
            this.setAlpha(1);
            this.hitArea.setInteractive({ useHandCursor: true });
        }
    }
}
