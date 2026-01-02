import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');

        // 1. Moving Background
        const { width, height } = this.scale;
        this.bg = this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0);

        // Darken background slightly to make UI pop
        this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0);

        // Fade In Effect
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        const centerX = width / 2;
        const centerY = height / 2;

        const username = localStorage.getItem('username') || 'Guest';
        Logger.info('MainMenu', `Welcome back, ${username}!`);
        const coins = localStorage.getItem('coins') || '0';
        const highScore = localStorage.getItem('highScore') || '0';

        // 2. Logo (Animated)
        const logo = this.add.image(centerX, centerY - 150, 'logo').setScale(0.1);
        this.tweens.add({
            targets: logo,
            scale: 0.11,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Title
        this.add.text(centerX, centerY - 40, 'Snake arena', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // High Score
        this.add.text(centerX, centerY - 80, `Highest Score: ${highScore}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 20,
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);


        // User Info
        let welcomeText = `Welcome back, ${username}!`;
        if (username.startsWith('Guest_')) {
            welcomeText = `Welcome, Guest! (Login to save progress)`;
        }

        this.add.text(centerX, centerY + 10, welcomeText, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 24,
            color: '#00ffaa'
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + 40, `Coins: ${coins}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 24,
            color: '#FFD700'
        }).setOrigin(0.5);


        // ------------------------------
        // NÚT START GAME (Pulsing)
        // ------------------------------
        const playBtn = this.createButton(centerX, centerY + 120, 'PLAY NOW', () => {
            Logger.info('MainMenu', 'Start Game clicked');
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, (cam, effect) => {
                const gameData = { name: username };
                const savedColor = localStorage.getItem('preferredColor');
                if (savedColor) gameData.color = parseInt(savedColor);
                this.scene.start('Game', gameData);
            });
        });

        // Pulse Effect for Play Button
        this.tweens.add({
            targets: playBtn,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ------------------------------
        // NÚT CUSTOMIZE SNAKE
        // ------------------------------
        this.createButton(centerX, centerY + 200, 'Customize', () => {
            this.scene.start('CustomizeScene');
        });

        // Shop Button
        const shopBtn = this.add.container(centerX + 350, centerY + 120);

        const shopBg = this.add.rectangle(0, 0, 160, 60, 0x00AA00)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });

        const shopText = this.add.text(0, 0, 'SHOP', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        shopBtn.add([shopBg, shopText]);

        shopBg.on('pointerover', () => {
            shopBg.setFillStyle(0x00cc00);
            this.tweens.add({ targets: shopBtn, scale: 1.1, duration: 100 });
        });
        shopBg.on('pointerout', () => {
            shopBg.setFillStyle(0x00AA00);
            this.tweens.add({ targets: shopBtn, scale: 1.0, duration: 100 });
        });
        shopBg.on('pointerdown', () => {
            const username = localStorage.getItem('username') || 'Guest';
            const currentCoins = localStorage.getItem('coins') || 0;
            this.scene.launch('ShopScene', { socket: this.socket, username: username, coins: currentCoins });
            this.scene.pause();
        });


        // LOGOUT BUTTON 
        const isGuest = !localStorage.getItem('token');
        const logoutText = isGuest ? 'Login' : 'Logout';

        // Small button at bottom right
        const logoutBtn = this.add.text(width - 80, height - 50, logoutText, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 15, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        logoutBtn.on('pointerdown', () => {
            localStorage.clear();
            location.reload();
        });
    }

    update() {
        // Move background
        if (this.bg) {
            this.bg.tilePositionX += 0.5;
            this.bg.tilePositionY += 0.5;
        }
    }

    // ---------------------------------------
    // REUSABLE BUTTON FUNCTION
    // ---------------------------------------
    createButton(x, y, text, callback) {
        // Container for better handling
        const container = this.add.container(x, y);

        const btn = this.add.rectangle(0, 0, 280, 70, 0x1e90ff)
            .setStrokeStyle(4, 0xffffff)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(0, 0, text, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        container.add([btn, btnText]);

        // Hover effect
        btn.on('pointerover', () => {
            btn.setFillStyle(0x3cb0ff);
            // Tween the container
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 100
            });
        });

        btn.on('pointerout', () => {
            btn.setFillStyle(0x1e90ff);
            this.tweens.add({
                targets: container,
                scale: 1.0,
                duration: 100
            });
        });

        if (callback) {
            btn.on('pointerdown', () => {
                // Click Animation
                this.tweens.add({
                    targets: container,
                    scale: 0.95,
                    duration: 50,
                    yoyo: true,
                    onComplete: callback
                });
            });
        }

        // Expose container for external tweens (like pulsing)
        return container;
    }
}