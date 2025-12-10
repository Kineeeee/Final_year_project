import { Scene } from 'phaser';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.joystick = null;
        this.boostBtn = null;
        this.isBoostingMobile = false;
    }

    create() {
        const isMobile = !this.sys.game.device.os.desktop;
        
        // Safe Area Margin (for notch/rounded corners)
        const safeMargin = isMobile ? 60 : 10;
        
        // Font Size (Larger on mobile because of HD resolution scaling)
        const fontSize = isMobile ? '20px' : '16px';
        const padding = { x: 10, y: 10 };

        // Leaderboard (Top Left)
        this.leaderboardText = this.add.text(safeMargin, safeMargin, 'Leaderboard', {
            fontFamily: 'Arial', fontSize: fontSize, color: '#ffffff',
            backgroundColor: '#00000088', padding: padding
        });

        // Ping (Top Right)
        this.pingText = this.add.text(this.cameras.main.width - safeMargin, safeMargin, 'Ping: 0ms', {
            fontFamily: 'Arial', fontSize: isMobile ? '16px' : '14px', color: '#00ff00',
            backgroundColor: '#00000088', padding: { x: 5, y: 5 }
        }).setOrigin(1, 0);

        // Get reference to Game Scene to listen for updates
        const gameScene = this.scene.get('Game');
        
        // Listen for events from Game Scene
        gameScene.events.on('updateLeaderboard', this.updateLeaderboard, this);
        gameScene.events.on('updatePing', this.updatePing, this);

        // MOBILE CONTROLS
        // Check if mobile device
        if (!this.sys.game.device.os.desktop) {
            this.createMobileControls();
        }
    }

    createMobileControls() {
        const { width, height } = this.scale;

        // Enable multi-touch (Joystick + Button)
        this.input.addPointer(3);

        // Safe Area Margin
        const safeMarginX = 100; // Clear the notch/corners
        const safeMarginY = 60; // Clear the bottom bar

        // Larger controls for HD resolution
        const joyRadius = 130;
        const joyX = joyRadius + safeMarginX;
        const joyY = height - (joyRadius + safeMarginY);
        
        const btnRadius = 90;
        const btnX = width - (btnRadius + safeMarginX);
        const btnY = height - (btnRadius + safeMarginY);

        // Joystick (Bottom Left)
        // Ensure plugin is loaded in Game scene or globally
        if (this.plugins.get('rexvirtualjoystickplugin')) {
            this.joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyX,
                y: joyY,
                radius: joyRadius,
                base: this.add.circle(0, 0, joyRadius, 0x888888).setAlpha(0.5),
                thumb: this.add.circle(0, 0, joyRadius * 0.5, 0xcccccc).setAlpha(0.8),
                dir: '8dir',
                forceMin: 16,
                enable: true
            });
        }

        // Boost Button (Bottom Right)
        this.boostBtn = this.add.circle(btnX, btnY, btnRadius, 0xff0000)
            .setAlpha(0.5)
            .setInteractive()
            .setDepth(100); // Ensure button is on top

        this.boostBtn.on('pointerdown', () => { 
            this.isBoostingMobile = true; 
            this.boostBtn.setAlpha(1); // Visual feedback
        });
        this.boostBtn.on('pointerup', () => { 
            this.isBoostingMobile = false; 
            this.boostBtn.setAlpha(0.5); 
        });
        this.boostBtn.on('pointerout', () => { 
            this.isBoostingMobile = false; 
            this.boostBtn.setAlpha(0.5); 
        });
    }

    // Method for Game.js to poll input
    getMobileInput() {
        if (!this.joystick) return null;

        return {
            angle: this.joystick.force > 0 ? Phaser.Math.DegToRad(this.joystick.angle) : null,
            isBoosting: this.isBoostingMobile
        };
    }

    updateLeaderboard(text) {
        this.leaderboardText.setText(text);
    }

    updatePing(latency) {
        this.pingText.setText(`Ping: ${latency}ms`);
        if (latency < 100) this.pingText.setColor('#00ff00');
        else if (latency < 200) this.pingText.setColor('#ffff00');
        else this.pingText.setColor('#ff0000');
    }
}
