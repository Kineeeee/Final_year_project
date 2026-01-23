import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { socketService } from '../services/SocketService';
import { playerState } from '../services/PlayerState';
import { UIButton } from '../ui/UIButton';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data) {
        Logger.info('GameOver', 'Showing Game Over Screen');

        const score = data.score || 0;
        const coins = data.coins || 0;

        // In previous architecture, socket was passed. Now we use the service.
        // We verify if we have a connection, or just rely on the service.
        this.socket = socketService.getSocket();

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // ===============================
        // BACKGROUND + CAMERA EFFECT
        // ===============================
        this.cameras.main.setBackgroundColor(0x120000);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.cameras.main.shake(250, 0.01); // shock moment

        // Dark overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0);

        const uiRoot = this.add.container(0, 0);

        // ===============================
        // LOGO (FADED MEMORY FEEL)
        // ===============================
        const logo = this.add.image(centerX, centerY - 220, 'logo')
            .setScale(0.09)
            .setAlpha(0.6);

        this.tweens.add({
            targets: logo,
            alpha: 0.8,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        uiRoot.add(logo);

        // ===============================
        // GAME OVER TITLE (IMPACT)
        // ===============================
        const title = this.add.text(centerX, centerY - 140, 'GAME OVER', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 64,
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 10,
            fontStyle: 'bold'
        }).setOrigin(0.5).setScale(1.4).setAlpha(0);

        this.tweens.add({
            targets: title,
            scale: 1,
            alpha: 1,
            duration: 500,
            ease: 'Back.out'
        });

        uiRoot.add(title);

        // ===============================
        // RESULT PANEL
        // ===============================
        const panel = this.add.container(centerX, centerY + 10);

        const panelBg = this.add.rectangle(0, 0, 420, 200, 0x000000, 0.45)
            .setStrokeStyle(2, 0xffffff, 0.3);

        const scoreText = this.add.text(0, -40, `FINAL SCORE`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 20,
            color: '#bbbbbb'
        }).setOrigin(0.5);

        const scoreValue = this.add.text(0, -5, score.toString(), {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 48,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const coinText = this.add.text(0, 55, `+ ${coins} COINS`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 26,
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        panel.add([panelBg, scoreText, scoreValue, coinText]);
        uiRoot.add(panel);

        this.tweens.add({
            targets: panel,
            y: '-=10',
            alpha: 1,
            duration: 500,
            delay: 300,
            ease: 'Sine.easeOut'
        });

        this.tweens.add({
            targets: coinText,
            alpha: 1,
            y: '-=5',
            duration: 400,
            delay: 700,
            ease: 'Sine.easeOut'
        });

        // ===============================
        // HIGH SCORE SOCKET EVENT
        // ===============================
        socketService.on('updateHighScore', (newHighScore) => {
            Logger.info('GameOver', `New High Score: ${newHighScore}`);
            playerState.setHighScore(newHighScore);

            const record = this.add.text(centerX, centerY + 140, '🏆 NEW RECORD!', {
                fontFamily: '"Outfit", sans-serif',
                fontSize: 34,
                color: '#00ff88',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScale(0);

            this.tweens.add({
                targets: record,
                scale: 1,
                duration: 500,
                ease: 'Back.out'
            });
        });

        // ===============================
        // ACTION BUTTONS
        // ===============================
        // Play Again
        const playAgainBtn = new UIButton(
            this,
            centerX,
            centerY + 220,
            'PLAY AGAIN',
            () => {
                Logger.info('GameOver', 'Restart Game');
                socketService.disconnect();
                this.scene.start('Game');
            },
            { width: 260, height: 64, color: 0x1e90ff }
        );
        uiRoot.add(playAgainBtn);

        // Main Menu
        const mainMenuBtn = new UIButton(
            this,
            centerX,
            centerY + 290,
            'MAIN MENU',
            () => {
                socketService.disconnect();
                this.scene.start('MainMenu');
            },
            { width: 260, height: 64, color: 0x555555 }
        );
        uiRoot.add(mainMenuBtn);
    }
}
