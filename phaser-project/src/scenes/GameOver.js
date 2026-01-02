import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';


export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data) {
        Logger.info('GameOver', 'Showing Game Over Screen');

        const score = data.score || 0;
        const coins = data.coins || 0;

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.cameras.main.setBackgroundColor(0x220000); // Darker red for premium feel

        // Logo
        this.add.image(centerX, centerY - 150, 'logo').setScale(0.1);

        // Title
        this.add.text(centerX, centerY - 60, 'GAME OVER', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '64px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Score
        this.add.text(centerX, centerY + 20, `Final Score: ${score}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Coins
        this.add.text(centerX, centerY + 60, `Coins Earned: ${coins}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '28px',
            color: '#FFD700'
        }).setOrigin(0.5);


        // Socket Handling: Listen for High Score Update *BEFORE* creating UI if possible, 
        // OR update UI dynamically.
        this.socket = data.socket;
        if (this.socket) {
            this.socket.on('updateHighScore', (newHighScore) => {
                Logger.info('GameOver', `New High Score Received: ${newHighScore}`);
                localStorage.setItem('highScore', newHighScore);

                // Show "New Record" text with animation
                const recordText = this.add.text(centerX, centerY + 100, `NEW RECORD!`, {
                    fontFamily: '"Outfit", sans-serif', fontSize: '36px', color: '#00FF00', fontStyle: 'bold'
                }).setOrigin(0.5).setScale(0);

                this.tweens.add({
                    targets: recordText,
                    scale: 1,
                    duration: 500,
                    ease: 'Back.out'
                });
            });
        }

        // Restart Button
        const restartBtn = this.add.container(centerX, centerY + 180);
        const rBg = this.add.rectangle(0, 0, 240, 70, 0x1e90ff).setStrokeStyle(4, 0xffffff);
        const rText = this.add.text(0, 0, 'PLAY AGAIN', {
            fontFamily: '"Outfit", sans-serif', fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        restartBtn.add([rBg, rText]);
        restartBtn.setSize(240, 70).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerover', () => {
            rBg.setFillStyle(0x3cb0ff);
            this.tweens.add({ targets: restartBtn, scale: 1.05, duration: 100 });
        });
        restartBtn.on('pointerout', () => {
            rBg.setFillStyle(0x1e90ff);
            this.tweens.add({ targets: restartBtn, scale: 1.0, duration: 100 });
        });

        restartBtn.on('pointerdown', () => {
            Logger.info('GameOver', 'Restarting Game');

            this.tweens.add({
                targets: restartBtn,
                scale: 0.95,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    if (this.socket) {
                        this.socket.disconnect();
                    }
                    this.scene.start('MainMenu');
                }
            });
        });
    }
}
