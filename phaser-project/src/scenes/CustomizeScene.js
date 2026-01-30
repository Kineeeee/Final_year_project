import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { Snake } from '../modules/snake/Snake';
import { UIButton } from '../ui/UIButton';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class CustomizeScene extends Scene {
    constructor() {
        super('CustomizeScene');
        this._didShutdown = false;
        this._wiggleTween = null;
    }

    create() {
        Logger.info('CustomizeScene', 'Creating Customize Scene');
        this.scene.stop('UIScene');

        this._didShutdown = false;
        this.events.off('shutdown', this._onShutdown, this);
        this.events.off('destroy', this._onShutdown, this);
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        const { width, height } = this.scale;

        // Background
        this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0).setTint(0x444444);
        this.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.6).setOrigin(0);

        // Header
        this.add.text(width / 2, 80, 'CUSTOMIZE YOUR SNAKE', TEXT_STYLES.HEADER).setOrigin(0.5);

        // ---------------------------------------------------------
        // PREVIEW AREA (Center)
        // ---------------------------------------------------------

        // Instantiate the Snake Preview
        const previewY = height / 2;
        this.selectedColor = 0x9b59b6;

        if (this.previewSnake && this.previewSnake.destroy) {
            this.previewSnake.destroy();
        }

        // Create snake
        this.previewSnake = new Snake(this, width / 2, previewY, this.selectedColor);

        // Grow it
        const desiredLength = 20;
        this.previewSnake.addSections(desiredLength);
        for (let i = 0; i < desiredLength; i++) {
            this.previewSnake.grow();
        }

        this.previewSnake.setScale(0.8);

        // Animation (Wiggle)
        const segmentSpacing = 12 * 0.8;

        this._wiggleTween = this.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 1500,
            loop: -1,
            onUpdate: (tween) => {
                const t = tween.getValue();
                const waveFreq = 10;
                const waveAmp = 10;

                // Center calculations
                const snakeLen = this.previewSnake.body.length * segmentSpacing;
                const startX = (width / 2) - (snakeLen / 2);

                // Head
                const headX = startX + snakeLen;
                const headOffset = Math.sin(Phaser.Math.DegToRad(t * 3 + 20 * waveFreq)) * waveAmp;

                this.previewSnake.head.x = headX;
                this.previewSnake.head.y = previewY + headOffset;
                this.previewSnake.head.rotation = 0;
                this.previewSnake.head.setDepth(100);

                // Body
                this.previewSnake.body.forEach((part, i) => {
                    const x = startX + (i * segmentSpacing);
                    const offset = Math.sin(Phaser.Math.DegToRad(t * 3 + i * waveFreq)) * waveAmp;
                    part.x = x;
                    part.y = previewY + offset;
                    part.setDepth(5 + i);
                });

                if (this.previewSnake.shadow) this.previewSnake.shadow.update();
                if (this.previewSnake.eyes) this.previewSnake.eyes.update();
            }
        });

        // ---------------------------------------------------------
        // COLOR CONTROLS
        // ---------------------------------------------------------
        const colors = [
            0x9b59b6, 0xe74c3c, 0x2ecc71, 0x3498db,
            0xf1c40f, 0xe67e22, 0xecf0f1, 0x34495e,
            0xe91e63, 0x00bcd4
        ];

        // Load saved color
        const savedColor = localStorage.getItem('preferredColor');
        this.selectedColor = savedColor ? parseInt(savedColor) : colors[0];
        let currentColorIndex = colors.indexOf(this.selectedColor);
        if (currentColorIndex === -1) { currentColorIndex = 0; this.selectedColor = colors[0]; }

        this.updatePreviewColor(this.selectedColor);

        // Navigation Buttons
        const btnY = height / 2 + 100;

        // Prev Button (<)
        const prevBtn = new UIButton(
            this,
            width / 2 - 200, btnY,
            '<',
            () => changeColor('prev'),
            { width: 60, height: 60, color: COLORS.SECONDARY, fontSize: 32 }
        );

        // Next Button (>)
        const nextBtn = new UIButton(
            this,
            width / 2 + 200, btnY,
            '>',
            () => changeColor('next'),
            { width: 60, height: 60, color: COLORS.SECONDARY, fontSize: 32 }
        );

        this.add.existing(prevBtn);
        this.add.existing(nextBtn);

        const changeColor = (direction) => {
            if (direction === 'next') {
                currentColorIndex = (currentColorIndex + 1) % colors.length;
            } else {
                currentColorIndex = (currentColorIndex - 1 + colors.length) % colors.length;
            }
            this.selectedColor = colors[currentColorIndex];
            this.updatePreviewColor(this.selectedColor);
        };

        // ---------------------------------------------------------
        // PLAY BUTTON
        // ---------------------------------------------------------
        const playBtn = new UIButton(
            this,
            width / 2, height - 100,
            'SAVE & PLAY',
            () => this.saveAndPlay(),
            {
                width: 250,
                height: 70,
                color: COLORS.PRIMARY,
                fontSize: 28
            }
        );
        this.add.existing(playBtn);

        // Back Button (Top Left)
        const backBtn = new UIButton(
            this,
            80, 50,
            'BACK',
            () => this.scene.start('MainMenu'),
            { width: 100, height: 40, color: COLORS.DANGER, fontSize: 18, type: 'danger' }
        );
        this.add.existing(backBtn);
    }

    updatePreviewColor(color) {
        if (this.previewSnake) {
            this.previewSnake.setColor(color);
        }
    }

    saveAndPlay() {
        const username = localStorage.getItem('username') || 'Guest';

        // Save locally
        localStorage.setItem('preferredColor', this.selectedColor);

        // Save to server
        if (username !== 'Guest' && !username.startsWith('Guest_')) {
            const url = `${location.protocol}//${location.hostname}:3000/api/auth/update-color`;
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, color: this.selectedColor })
            }).catch(err => Logger.error('CustomizeScene', 'Failed to update color', err));
        }

        this.scene.start('Game', { name: username, color: this.selectedColor });
    }

    _onShutdown() {
        if (this._didShutdown) return;
        this._didShutdown = true;

        if (this._wiggleTween) {
            this._wiggleTween.stop();
            this._wiggleTween.remove();
            this._wiggleTween = null;
        }

        if (this.previewSnake && this.previewSnake.destroy) {
            this.previewSnake.destroy();
            this.previewSnake = null;
        }
    }
}
