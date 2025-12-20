import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

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
        // PREVIEW SNAKE — CENTERED & HORIZONTAL
        // ---------------------------------------------------------
        this.previewContainer = this.add.container(width / 2, height / 2);
        this.previewBody = [];
        this.previewShadows = [];

        // Snake Configuration
        const totalSegments = 20; // Longer snake like in the image
        const segmentSpacing = 10;
        const snakeLengthPx = (totalSegments - 1) * segmentSpacing;
        const startX = -snakeLengthPx / 2; // Center the snake horizontally

        // Default color
        this.selectedColor = 0x9b59b6; // Purple like in the image

        // 1. SHADOWS (Bottom Layer)
        for (let i = 0; i < totalSegments; i++) {
            const x = startX + (i * segmentSpacing);
            const shadow = this.add.image(x, 0, 'snake-shadow')
                .setAlpha(0.3)
                .setScale(0.8);
            this.previewShadows.push(shadow);
            this.previewContainer.add(shadow);
        }

        // 2. BODY (Middle Layer)
        // Draw from tail (left) to head (right)
        for (let i = 0; i < totalSegments; i++) {
            const x = startX + (i * segmentSpacing);
            const segment = this.add.image(x, 0, 'snake-circle')
                .setTint(this.selectedColor)
                .setScale(0.8);
            
            this.previewBody.push(segment);
            this.previewContainer.add(segment);
        }

        // 3. HEAD (Top Layer - Rightmost)
        const headX = startX + ((totalSegments - 1) * segmentSpacing);
        this.previewHead = this.add.image(headX, 0, 'snake-circle')
            .setTint(this.selectedColor)
            .setScale(0.85); // Slightly bigger head
        this.previewContainer.add(this.previewHead);

        // 4. EYES (On the Head)
        // Eyes looking right
        const eyeOffsetX = 5; 
        const eyeOffsetY = 8;

        const leftEye = this.add.image(headX + eyeOffsetX, -eyeOffsetY, 'snake-eye').setScale(0.7);
        const rightEye = this.add.image(headX + eyeOffsetX, eyeOffsetY, 'snake-eye').setScale(0.7);
        const leftPupil = this.add.image(headX + eyeOffsetX + 2, -eyeOffsetY, 'snake-pupil').setScale(0.7);
        const rightPupil = this.add.image(headX + eyeOffsetX + 2, eyeOffsetY, 'snake-pupil').setScale(0.7);

        this.previewContainer.add([leftEye, rightEye, leftPupil, rightPupil]);

        // Scale up the whole container to match the reference image size
        this.previewContainer.setScale(1.5);


        // ---------------------------------------------------------
        // ANIMATION — WIGGLE (Sine Wave)
        // ---------------------------------------------------------
        this.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 1500,
            loop: -1,
            onUpdate: (tween) => {
                const t = tween.getValue();
                const waveFreq = 15; // Frequency of the wave
                const waveAmp = 15;  // Amplitude of the wave

                // Animate Body & Shadows
                this.previewBody.forEach((seg, index) => {
                    // Calculate wave offset based on index and time
                    // Head is at the end of the array (index = totalSegments - 1)
                    // We want the wave to travel from head (right) to tail (left).
                    
                    const offset = Math.sin(Phaser.Math.DegToRad(t * 3 + index * waveFreq)) * waveAmp;
                    
                    seg.y = offset;
                    
                    // Sync shadow
                    if (this.previewShadows[index]) {
                        this.previewShadows[index].y = offset + 5; // Shadow slightly below
                    }
                });

                // Animate Head
                const headIndex = totalSegments - 1;
                const headOffset = Math.sin(Phaser.Math.DegToRad(t * 3 + headIndex * waveFreq)) * waveAmp;
                this.previewHead.y = headOffset;

                // Sync Eyes
                leftEye.y = this.previewHead.y - eyeOffsetY;
                rightEye.y = this.previewHead.y + eyeOffsetY;
                leftPupil.y = leftEye.y;
                rightPupil.y = rightEye.y;
            }
        });


        // ---------------------------------------------------------
        // UI CONTROLS (Arrows & Save Button)
        // ---------------------------------------------------------
        
        // Left Arrow
        const leftArrow = this.add.text(width / 2 - 250, height / 2, '◀', {
            fontSize: '64px',
            color: '#4caf50', // Green arrow
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Right Arrow
        const rightArrow = this.add.text(width / 2 + 250, height / 2, '▶', {
            fontSize: '64px',
            color: '#4caf50', // Green arrow
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Color Palette Logic
        const colors = [
            0x9b59b6, // Purple (Default)
            0xe74c3c, // Red
            0x2ecc71, // Green
            0x3498db, // Blue
            0xf1c40f, // Yellow
            0xe67e22, // Orange
            0xecf0f1, // White
            0x34495e  // Dark Blue
        ];
        // lấy màu đã lưu
        const savedColor = localStorage.getItem('preferredColor');

        // xác định màu khởi tạo cho con rắn preview
        this.selectedColor = savedColor ? parseInt(savedColor) : colors[0];

        // tìm chỉ mục của màu hiện tại
        let currentColorIndex = colors.indexOf(this.selectedColor);

        // nếu màu lưu không có trong danh sách
        if (currentColorIndex === -1) {
            currentColorIndex = 0;
            this.selectedColor = colors[0];
        }
        
        // Cập nhật màu preview ban đầu
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
            const target = direction === 'next' ? rightArrow : leftArrow;
            this.tweens.add({
                targets: target,
                scale: 1.2,
                duration: 100,
                yoyo: true
            });
        };

        leftArrow.on('pointerdown', () => changeColor('prev'));
        rightArrow.on('pointerdown', () => changeColor('next'));


        // Save / Play Button
        const saveBtn = this.add.text(width / 2, height / 2 + 150, 'Save', {
            fontFamily: 'Arial',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#4caf50',
            padding: { x: 40, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
        
        saveBtn.on('pointerdown', () => {
            const username = localStorage.getItem('username') || 'Guest';

            // Save selected color to localStorage
            localStorage.setItem('preferredColor', this.selectedColor);

            // nếu không phải Guest thì cập nhật màu lên server
            if (username !== 'Guest' && !username.startsWith('Guest_')) {
                fetch('http://localhost:3000/api/update-color', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: username, color: this.selectedColor })
                }).catch(err => {
                    Logger.error('CustomizeScene', 'Failed to update color on server', err);

                });
            }

            this.scene.start('Game', { 
                name: username,
                color: this.selectedColor });
        });

        saveBtn.on('pointerover', () => saveBtn.setStyle({ backgroundColor: '#45a049' }));
        saveBtn.on('pointerout', () => saveBtn.setStyle({ backgroundColor: '#4caf50' }));

        // "Build a Slither" text (optional decoration)
        this.add.text(width - 100, height - 50, 'Build a Snake', {
            fontSize: '16px',
            color: '#aaaaaa'
        }).setOrigin(0.5);
    }

    updatePreviewColor(color) {
        this.previewHead.setTint(color);
        this.previewBody.forEach(seg => seg.setTint(color));
    }
}
