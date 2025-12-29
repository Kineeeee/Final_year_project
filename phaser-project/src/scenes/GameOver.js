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

        // Lấy kích thước màn hình hiện tại
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;


        this.cameras.main.setBackgroundColor(0xff0000);

        this.add.image(centerX, centerY - 134, 'logo').setScale(0.09);

        this.add.text(centerX, centerY - 50, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + 30, `Score: ${score}`, {
            fontFamily: 'Arial', fontSize: 32, color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + 70, `Coins Earned: ${coins}`, {
            fontFamily: 'Arial', fontSize: 24, color: '#FFD700', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);


        // Socket Handling
        this.socket = data.socket;
        if (this.socket) {
            this.socket.on('updateHighScore', (newHighScore) => {
                Logger.info('GameOver', `New High Score Received: ${newHighScore}`);
                localStorage.setItem('highScore', newHighScore);
                // Optional: Update UI to show "New Record!"
                this.add.text(centerX, centerY + 110, `New Record!`, {
                    fontFamily: 'Arial', fontSize: 24, color: '#00FF00'
                }).setOrigin(0.5);
            });
        }

        this.input.once('pointerdown', () => {
            Logger.info('GameOver', 'Restarting Game');
            if (this.socket) {
                this.socket.disconnect(); // Disconnect before going to MainMenu
            }
            this.scene.start('MainMenu');
        });
    }
}
