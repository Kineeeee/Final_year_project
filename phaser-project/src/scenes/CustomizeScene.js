
import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { Snake } from '../objects/snake/Snake';

export class CustomizeScene extends Scene {
    constructor() {
        super('CustomizeScene');
    }

    create() {
        Logger.info('CustomizeScene', 'Creating Customize Scene');

        const { width, height } = this.scale;


        // Background - Dark Hexagon Pattern (Simulated with dark color for now)
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e); // Dark blue/black background
        this.add.image(width / 2, height / 2, 'background').setAlpha(0.2).setTint(0x000000); // Subtle texture

        // ---------------------------------------------------------
        // PREVIEW SNAKE — USING REAL SNAKE CLASS
        // ---------------------------------------------------------

        // Default color
        this.selectedColor = 0x9b59b6;

        // Instantiate the Snake
        // Position it at center initially
        this.previewSnake = new Snake(this, width / 2, height / 2, this.selectedColor);

        // Force grow to desired length immediately
        const desiredLength = 20;
        this.previewSnake.addSections(desiredLength);

        // We need to manually process the growth queue since we aren't running the full game loop with movement
        // Or we can just forcibly add body parts.
        // The Snake.grow() method adds one part at head position. 
        // To make a long snake instantly for preview, we might need to manually position them 
        // or let the animation loop spread them out.
        // Let's just call grow() loop and let our animation handle positions.
        for (let i = 0; i < desiredLength; i++) {
            this.previewSnake.grow();
        }

        // Set Scale
        this.previewSnake.setScale(0.8);

        // Center the snake visually
        // The head is at (width/2, height/2). Body parts are added at head position.
        // The animation loop below will spread them out horizontally.

        this.previewContainer = this.add.container(0, 0); // Dummy container if accessed elsewhere, or remove usage.
        // Note: Snake class adds items to scene directly (head container + bodyGroup).

        // ---------------------------------------------------------
        // ANIMATION — WIGGLE (Sine Wave)
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // ANIMATION — WIGGLE (Sine Wave)
        // ---------------------------------------------------------
        const segmentSpacing = 12 * 0.8; // Spacing * scale

        this.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 1500,
            loop: -1,
            onUpdate: (tween) => {
                const t = tween.getValue();
                const waveFreq = 10;
                const waveAmp = 10;

                // Center X for the whole snake
                const snakeLen = this.previewSnake.body.length * segmentSpacing;
                const startX = (width / 2) - (snakeLen / 2);

                // Animate Head
                const headX = startX + snakeLen;
                const headOffset = Math.sin(Phaser.Math.DegToRad(t * 3 + 20 * waveFreq)) * waveAmp;

                this.previewSnake.head.x = headX;
                this.previewSnake.head.y = (height / 2) + headOffset;
                this.previewSnake.head.rotation = 0; // Look right
                this.previewSnake.head.setDepth(1000); // Ensure head is always on top

                // Animate Body
                this.previewSnake.body.forEach((part, i) => {
                    const x = startX + (i * segmentSpacing);
                    const offset = Math.sin(Phaser.Math.DegToRad(t * 3 + i * waveFreq)) * waveAmp;

                    part.x = x;
                    part.y = (height / 2) + offset;
                    part.setDepth(5 + i);
                });

                // Shadow update
                if (this.previewSnake.shadow) {
                    this.previewSnake.shadow.update();
                }

                // Eyes update
                if (this.previewSnake.eyes) {
                    this.previewSnake.eyes.update();
                }
            }
        });


        // Title
        this.add.text(width / 2, 80, 'Customize Your Snake', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // ---------------------------------------------------------
        // UI CONTROLS
        // ---------------------------------------------------------

        // Left Arrow Button
        const leftBtn = this.add.container(width / 2 - 250, height / 2);
        const lBg = this.add.circle(0, 0, 40, 0xffffff, 0.2).setStrokeStyle(2, 0xffffff);
        const lText = this.add.text(0, 0, '<', { fontSize: '48px', color: '#fff', fontFamily: '"Outfit", sans-serif' }).setOrigin(0.5, 0.55);
        leftBtn.add([lBg, lText]);
        leftBtn.setSize(80, 80).setInteractive({ useHandCursor: true });

        // Right Arrow Button
        const rightBtn = this.add.container(width / 2 + 250, height / 2);
        const rBg = this.add.circle(0, 0, 40, 0xffffff, 0.2).setStrokeStyle(2, 0xffffff);
        const rText = this.add.text(0, 0, '>', { fontSize: '48px', color: '#fff', fontFamily: '"Outfit", sans-serif' }).setOrigin(0.5, 0.55);
        rightBtn.add([rBg, rText]);
        rightBtn.setSize(80, 80).setInteractive({ useHandCursor: true });

        // Color Palette Logic
        const colors = [
            0x9b59b6, // Purple
            0xe74c3c, // Red
            0x2ecc71, // Green
            0x3498db, // Blue
            0xf1c40f, // Yellow
            0xe67e22, // Orange
            0xecf0f1, // White
            0x34495e, // Dark Blue
            0xe91e63, // Pink
            0x00bcd4  // Cyan
        ];

        const savedColor = localStorage.getItem('preferredColor');
        this.selectedColor = savedColor ? parseInt(savedColor) : colors[0];
        let currentColorIndex = colors.indexOf(this.selectedColor);
        if (currentColorIndex === -1) { currentColorIndex = 0; this.selectedColor = colors[0]; }

        this.updatePreviewColor(this.selectedColor);

        const changeColor = (direction) => {
            if (direction === 'next') {
                currentColorIndex = (currentColorIndex + 1) % colors.length;
            } else {
                currentColorIndex = (currentColorIndex - 1 + colors.length) % colors.length;
            }
            this.selectedColor = colors[currentColorIndex];
            this.updatePreviewColor(this.selectedColor);

            // Button feedback
            const target = direction === 'next' ? rightBtn : leftBtn;
            this.tweens.add({
                targets: target,
                scale: 1.2,
                duration: 100,
                yoyo: true
            });
        };

        leftBtn.on('pointerdown', () => changeColor('prev'));
        rightBtn.on('pointerdown', () => changeColor('next'));

        // Save / Play Button
        const saveContainer = this.add.container(width / 2, height / 2 + 180);
        const saveBg = this.add.rectangle(0, 0, 200, 60, 0x4caf50).setStrokeStyle(2, 0xffffff);
        const saveText = this.add.text(0, 0, 'SAVE & PLAY', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        saveContainer.add([saveBg, saveText]);
        saveContainer.setSize(200, 60).setInteractive({ useHandCursor: true });

        saveContainer.on('pointerover', () => {
            saveBg.setFillStyle(0x66bb6a);
            this.tweens.add({ targets: saveContainer, scale: 1.05, duration: 100 });
        });
        saveContainer.on('pointerout', () => {
            saveBg.setFillStyle(0x4caf50);
            this.tweens.add({ targets: saveContainer, scale: 1.0, duration: 100 });
        });

        saveContainer.on('pointerdown', () => {
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

            // Click Anim
            this.tweens.add({
                targets: saveContainer,
                scale: 0.95,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    this.scene.start('Game', { name: username, color: this.selectedColor });
                }
            });
        });
    }

    updatePreviewColor(color) {
        if (this.previewSnake) {
            this.previewSnake.setColor(color);
        }
    }
}
