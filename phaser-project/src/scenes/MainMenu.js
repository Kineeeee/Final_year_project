import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { playerState } from '../core/services/PlayerState';
import { AuthService } from '../core/services/AuthService';
import { UIButton } from '../ui/UIButton';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');
        this.scene.stop('UIScene');

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // BACKGROUND
        this.bg = this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0);
        this.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.4).setOrigin(0);
        this.cameras.main.fadeIn(800, 0, 0, 0);

        const uiRoot = this.add.container(0, 0);

        // DATA
        const username = playerState.getUsername();
        const coins = playerState.getCoins();
        const highScore = playerState.getHighScore();

        // ----------------------------------------------------
        // HEADER
        // ----------------------------------------------------
        const headerY = centerY - 250;

        // Logo (Animated)
        const logo = this.add.image(centerX, headerY - 50, 'logo').setScale(0.1);
        this.tweens.add({
            targets: logo,
            scale: 0.11,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Title
        const titleText = this.add.text(centerX, headerY + 40, 'SNAKE ARENA', TEXT_STYLES.HEADER).setOrigin(0.5);

        // Subheader (Welcome & Stats)
        const welcomeText = username.startsWith('Guest_') ? 'Guest Player' : username;

        const infoBarY = headerY + 100;

        const userText = this.add.text(centerX - 200, infoBarY, `👤 ${welcomeText}`, { ...TEXT_STYLES.BODY, color: COLORS.TEXT.ACCENT }).setOrigin(0.5);
        const coinText = this.add.text(centerX, infoBarY, `💰 ${coins}`, { ...TEXT_STYLES.BODY, color: COLORS.TEXT.ACCENT }).setOrigin(0.5);
        const scoreText = this.add.text(centerX + 200, infoBarY, `🏆 Best: ${highScore}`, { ...TEXT_STYLES.BODY, color: COLORS.TEXT.ACCENT }).setOrigin(0.5);

        uiRoot.add([logo, titleText, userText, coinText, scoreText]);

        // ----------------------------------------------------
        // GAME MODES (Cards)
        // ----------------------------------------------------
        // We will layout 4 modes. 
        // 2x2 Grid is fine, but let's make them look like "Cards"

        const modes = [
            { label: 'SURVIVAL', mode: 'normal', icon: '🐍', color: 0x1e90ff, primary: true },
            { label: 'MATH QUIZ', mode: 'math', icon: '➗', color: 0xff8c00 },
            { label: 'ENGLISH QUIZ', mode: 'english', icon: 'ABC', color: 0x8a2be2 },
            { label: 'SHOOTING', mode: 'shooting', icon: '🔫', color: 0xdc143c }
        ];

        const gridStartY = centerY + 30;
        const gridGapX = 220;
        const gridGapY = 90;

        modes.forEach((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);

            const x = centerX + (col === 0 ? -110 : 110);
            const y = gridStartY + (row * gridGapY);

            // Using UIButton but styled as a wide card
            // Or just standard buttons but colored differently

            const btn = new UIButton(
                this,
                x, y,
                `${m.icon}  ${m.label}`,
                () => this.startGame(m.mode),
                {
                    width: 200, // Slightly smaller width to fit side-by-side
                    height: 70,
                    color: m.color,
                    fontSize: 22
                }
            );

            uiRoot.add(btn);

            // Pulse effect for primary mode
            if (m.primary) {
                this.tweens.add({
                    targets: btn,
                    scale: 1.05,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        // ----------------------------------------------------
        // BOTTOM ACTIONS (Shop, Customize, Login)
        // ----------------------------------------------------
        const bottomY = height - 80;

        // Shop
        const shopBtn = new UIButton(
            this,
            centerX - 120, bottomY,
            '🛒 SHOP',
            () => {
                this.scene.launch('ShopScene', { coins: playerState.getCoins() });
                this.scene.pause();
            },
            {
                type: 'secondary',
                width: 180,
                height: 55
            }
        );

        // Customize
        const customizeBtn = new UIButton(
            this,
            centerX + 120, bottomY,
            '🎨 SKINS',
            () => this.scene.start('CustomizeScene'),
            {
                type: 'secondary',
                width: 180,
                height: 55
            }
        );

        // Login / Logout
        const isGuest = !localStorage.getItem('token');
        const authLabel = isGuest ? 'Login' : 'Logout';
        const authColor = isGuest ? COLORS.PRIMARY : COLORS.DANGER;

        // Small button in corner
        const authBtn = new UIButton(
            this,
            width - 80, 50, // Top right corner now
            authLabel,
            async () => {
                if (isGuest) {
                    location.reload();
                } else {
                    const username = localStorage.getItem('username');
                    if (username) {
                        try {
                            const authService = new AuthService();
                            await authService.logout(username);
                        } catch (e) {
                            console.error('Logout failed:', e);
                        }
                    }
                    localStorage.clear();
                    location.reload();
                }
            },
            {
                width: 100,
                height: 40,
                fontSize: 18,
                color: authColor,
                type: isGuest ? 'primary' : 'danger'
            }
        );

        // Help Button (?)
        const helpBtn = new UIButton(
            this,
            width - 165, 50,
            '?',
            () => {
                this.scene.launch('HowToPlayScene');
                this.scene.pause();
            },
            {
                width: 50,
                height: 40,
                fontSize: 24,
                color: COLORS.SECONDARY,
                type: 'secondary'
            }
        );

        uiRoot.add([shopBtn, customizeBtn, helpBtn, authBtn]);
        this.add.existing(uiRoot);
    }

    update() {
        if (this.bg) {
            this.bg.tilePositionX += 0.5;
            this.bg.tilePositionY += 0.5;
        }
    }

    startGame(mode) {
        Logger.info('MainMenu', `Starting Game Mode: ${mode}`);
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            if (mode === 'shooting') {
                this.scene.start('ShootingScene');
            } else {
                const username = playerState.getUsername();
                const gameData = { name: username, mode };
                const savedColor = localStorage.getItem('preferredColor');
                if (savedColor) gameData.color = parseInt(savedColor);

                this.scene.start('Game', gameData);
            }
        });
    }
}
