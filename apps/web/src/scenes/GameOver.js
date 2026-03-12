import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { socketService } from '../core/services/SocketService';
import { playerState } from '../core/services/PlayerState';
import { UIButton } from '../ui/UIButton';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data) {
        Logger.info('GameOver', 'Showing Game Over Screen');
        this.scene.stop('UIScene');

        const score = data.score || 0;
        const coins = data.coins || 0;

        this.socket = socketService.getSocket();

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const baseW = 1280;
        const baseH = 720;
        const uiScale = Math.max(0.55, Math.min(Math.min(width / baseW, height / baseH) * 0.9, 1));

        // Background
        this.cameras.main.setBackgroundColor(0x120000);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.cameras.main.shake(250, 0.01);

        // --- 1. BACKGROUND ---
        if (this.textures.exists('gameover-bg')) {
            this.bg = this.add.image(centerX, centerY, 'gameover-bg').setOrigin(0.5);
            // Scale background to cover screen
            const scaleX = width / this.bg.width;
            const scaleY = height / this.bg.height;
            const scale = Math.max(scaleX, scaleY);
            this.bg.setScale(scale).setScrollFactor(0);
        } else {
            this.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.4).setOrigin(0);
        }

        const uiRoot = this.add.container(0, 0);
        // Scale down UI on mobile and re-center
        uiRoot.setScale(uiScale);
        uiRoot.setPosition((width - width * uiScale) / 2, (height - height * uiScale) / 2);

        // Logo
        const logo = this.add
            .image(centerX, centerY - 250, 'logo')
            .setScale(0.09 * uiScale)
            .setAlpha(0.6);

        this.tweens.add({
            targets: logo,
            alpha: 0.8,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        uiRoot.add(logo);

        // Title
        const title = this.add.text(centerX, centerY - 160, 'GAME OVER', {
            ...TEXT_STYLES.HEADER,
            fontSize: '64px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setScale(1.1 * uiScale).setAlpha(0);

        this.tweens.add({
            targets: title,
            scale: 1, alpha: 1, duration: 500, ease: 'Back.out'
        });
        uiRoot.add(title);

        // Result Panel (Custom graphics for emphasis)
        const panelY = centerY + 20;
        const panelContainer = this.add.container(centerX, panelY);

        const panelW = 480;
        const panelH = 220;

        const panelBg = this.add.graphics();
        panelBg.fillStyle(COLORS.PANEL_BG, 0.8);
        panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);
        panelBg.lineStyle(3, COLORS.DANGER, 1);
        panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);

        panelContainer.add(panelBg);

        // Score
        const scoreLabel = this.add.text(0, -50, 'FINAL SCORE', { ...TEXT_STYLES.SUBHEADER, color: COLORS.TEXT.MUTED }).setOrigin(0.5);
        const scoreValue = this.add.text(0, 0, score.toString(), { ...TEXT_STYLES.HEADER, fontSize: '64px' }).setOrigin(0.5);

        // Coins Earned
        const coinText = this.add.text(0, 60, `+ ${coins} COINS`, { ...TEXT_STYLES.BODY, color: COLORS.TEXT.ACCENT, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);

        panelContainer.add([scoreLabel, scoreValue, coinText]);
        uiRoot.add(panelContainer);

        // Animations
        panelContainer.setAlpha(0).setY(panelY + 20);
        this.tweens.add({
            targets: panelContainer,
            y: panelY, alpha: 1, duration: 500, delay: 300, ease: 'Sine.easeOut'
        });

        this.tweens.add({
            targets: coinText,
            alpha: 1, y: 60, duration: 400, delay: 700, ease: 'Sine.easeOut'
        });

        // High Score Logic
        const onUpdateHighScore = (newHighScore) => {
            Logger.info('GameOver', `New High Score: ${newHighScore}`);
            playerState.setHighScore(newHighScore);

            const record = this.add.text(centerX, centerY - 90, '🏆 NEW RECORD!', {
                ...TEXT_STYLES.SUBHEADER,
                color: '#00ff88',
            }).setOrigin(0.5).setScale(0);

            uiRoot.add(record);

            this.tweens.add({
                targets: record,
                scale: 1, duration: 500, ease: 'Back.out'
            });

            const socket = socketService.getSocket();
            if (socket && socket.off) socket.off('updateHighScore', onUpdateHighScore);
        };

        const socket = socketService.getSocket();
        if (socket) {
            socket.once('updateHighScore', onUpdateHighScore);
            this.events.once('shutdown', () => {
                socket.off('updateHighScore', onUpdateHighScore);
            });
        }

        // Buttons
        const isCustom = data.customNamespace != null;
        
        const playAgainBtn = new UIButton(
            this,
            centerX,
            centerY + 200,
            isCustom ? 'FIND NEW ROOM' : 'PLAY AGAIN',
            () => {
                socketService.disconnect();
                if (isCustom) {
                    this.scene.start('MainMenu');
                } else {
                    this.scene.start('Game', { 
                        mode: data.mode, 
                        quizSource: data.quizSource 
                    });
                }
            },
            { width: 300, height: 70, color: COLORS.PRIMARY, fontSize: 32 }
        );

        const mainMenuBtn = new UIButton(
            this,
            centerX,
            centerY + 280,
            'MAIN MENU',
            () => {
                socketService.disconnect();
                this.scene.start('MainMenu');
            },
            { width: 260, height: 60, color: COLORS.PANEL_BG, type: 'secondary' }
        );

        uiRoot.add([playAgainBtn, mainMenuBtn]);
    }
}
