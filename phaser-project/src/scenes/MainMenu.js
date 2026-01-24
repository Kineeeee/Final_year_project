import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { playerState } from '../services/PlayerState';
import { UIButton } from '../ui/UIButton';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');

        // UIScene is session-scoped (Game only). Ensure it never leaks into menus.
        this.scene.stop('UIScene');

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // ===============================
        // BACKGROUND
        // ===============================
        this.bg = this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0);
        this.cameras.main.fadeIn(800, 0, 0, 0);

        // Root UI container
        const uiRoot = this.add.container(0, 0);

        // ===============================
        // USER DATA
        // ===============================
        const username = playerState.getUsername();
        const coins = playerState.getCoins();
        const highScore = playerState.getHighScore();

        // ===============================
        // HEADER
        // ===============================
        const header = this.add.container(centerX, centerY - 220);

        const logo = this.add.image(0, -40, 'logo').setScale(0.1);
        this.tweens.add({
            targets: logo,
            scale: 0.115,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const titleText = this.add.text(0, 40, 'SNAKE ARENA', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        const scoreText = this.add.text(0, 90, `Highest Score: ${highScore}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 20,
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        header.add([logo, titleText, scoreText]);
        uiRoot.add(header);

        // ===============================
        // USER INFO
        // ===============================
        const welcomeText = username.startsWith('Guest_')
            ? 'Welcome, Guest! (Login to save progress)'
            : `Welcome back, ${username}!`;

        uiRoot.add(
            this.add.text(centerX, centerY - 80, welcomeText, {
                fontFamily: '"Outfit", sans-serif',
                fontSize: 22,
                color: '#00ffaa'
            }).setOrigin(0.5)
        );

        uiRoot.add(
            this.add.text(centerX, centerY - 50, `Coins: ${coins}`, {
                fontFamily: '"Outfit", sans-serif',
                fontSize: 22,
                color: '#FFD700'
            }).setOrigin(0.5)
        );

        // ===============================
        // GAME MODES (GRID 2x2)
        // ===============================
        const modes = [
            { label: 'SURVIVAL', mode: 'normal', color: 0x1e90ff, primary: true },
            { label: 'MATH QUIZ', mode: 'math', color: 0xff8c00 },
            { label: 'ENGLISH QUIZ', mode: 'english', color: 0x8a2be2 },
            { label: 'SHOOTING QUIZ', mode: 'shooting', color: 0xdc143c }
        ];

        const startY = centerY + 10;
        const gapX = 170;
        const gapY = 90;

        modes.forEach((m, i) => {
            const x = centerX + (i % 2 === 0 ? -gapX : gapX);
            const y = startY + Math.floor(i / 2) * gapY;

            const btn = new UIButton(
                this,
                x, y,
                m.label,
                () => {
                    this.startGame(m.mode);
                },
                { width: 280, height: 60, color: m.color }
            );

            uiRoot.add(btn);

            if (m.primary) {
                this.tweens.add({
                    targets: btn,
                    scale: 1.08,
                    duration: 700,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        // ===============================
        // SECONDARY ACTIONS
        // ===============================
        // Customize Button
        uiRoot.add(
            new UIButton(
                this,
                centerX - 150,
                centerY + 220,
                '🎨 Customize',
                () => {
                    this.scene.start('CustomizeScene');
                },
                { width: 280, height: 60, color: 0x555555 }
            )
        );

        // Shop Button
        uiRoot.add(
            new UIButton(
                this,
                centerX + 150,
                centerY + 220,
                '🛒 Shop',
                () => {
                    // No need to pass socket or user data, ShopScene uses services
                    this.scene.launch('ShopScene', {
                        coins: playerState.getCoins() // Optional sync
                    });
                    this.scene.pause();
                },
                { width: 280, height: 60, color: 0x228b22 }
            )
        );

        // ===============================
        // LOGIN / LOGOUT
        // ===============================
        const isGuest = !localStorage.getItem('token');
        const authText = isGuest ? 'Login' : 'Logout';

        const authBtn = this.add.text(width - 80, height - 40, authText, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 18,
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 14, y: 8 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        authBtn.on('pointerdown', () => {
            localStorage.clear();
            location.reload();
        });

        uiRoot.add(authBtn);
    }

    update() {
        if (this.bg) {
            this.bg.tilePositionX += 0.4;
            this.bg.tilePositionY += 0.4;
        }
    }

    // ===============================
    // START GAME
    // ===============================
    startGame(mode) {
        Logger.info('MainMenu', `Starting Game Mode: ${mode}`);

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(
            Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
            () => {
                if (mode === 'shooting') {
                    this.scene.start('ShootingScene');
                    return;
                }

                const username = playerState.getUsername();
                const gameData = { name: username, mode };
                const savedColor = localStorage.getItem('preferredColor');
                if (savedColor) gameData.color = parseInt(savedColor);

                this.scene.start('Game', gameData);
            }
        );
    }
}
