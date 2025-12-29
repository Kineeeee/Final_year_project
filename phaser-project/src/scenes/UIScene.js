import { Scene } from 'phaser';
import { ITEMS } from '../config/items.js';
import { Logger } from '../utils/Logger';

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
        gameScene.events.on('coinsChanged', this.updateCoins, this);

        // Coin Display (Below Leaderboard)
        const savedCoins = localStorage.getItem('coins') || 0;
        this.coinText = this.add.text(safeMargin, safeMargin + 200, `Coins: ${savedCoins}`, {
            fontFamily: 'Arial', fontSize: fontSize, color: '#FFD700',
            backgroundColor: '#00000088', padding: padding
        });

        // MOBILE CONTROLS
        // Check if mobile device
        if (!this.sys.game.device.os.desktop) {
            this.createMobileControls();
        }

        const { width, height } = this.scale;

        // --- ITEM SLOTS ---
        this.itemSlots = {};
        this.createItemSlots(width / 2, safeMargin + 80); // Center Top

        // Game Listeners for Items
        gameScene.events.on('updateInventory', this.updateInventory, this);
        gameScene.events.on('itemActivated', this.onItemActivated, this);

        // Keyboard Inputs (Desktop)
        if (this.sys.game.device.os.desktop) {
            this.input.keyboard.on('keydown-ONE', () => gameScene.useItem('speed'));
            this.input.keyboard.on('keydown-TWO', () => gameScene.useItem('magnet'));
            this.input.keyboard.on('keydown-THREE', () => gameScene.useItem('ghost'));
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

    updateCoins(coins) {
        this.coinText.setText(`Coins: ${coins}`);
    }

    createItemSlots(x, y) {
        const itemIds = [ITEMS.SPEED_UP.id, ITEMS.MAGNET.id, ITEMS.GHOST.id];
        const gap = 80;
        let startX = x - gap;

        itemIds.forEach((id, index) => {
            const slotX = startX + (index * gap);

            // Background
            this.add.rectangle(slotX, y, 60, 60, 0x333333).setStrokeStyle(2, 0xffffff);

            // Icon (Placeholder Color)
            const color = Object.values(ITEMS).find(i => i.id === id).iconColor;
            this.add.rectangle(slotX, y, 40, 40, color);

            // Key Hint (Desktop)
            if (this.sys.game.device.os.desktop) {
                this.add.text(slotX - 25, y - 25, `${index + 1}`, { fontSize: '12px', fill: '#fff' });
            }

            // Quantity Text
            let initialQty = 0;
            try {
                const savedInv = JSON.parse(localStorage.getItem('inventory'));
                if (savedInv && savedInv[id]) initialQty = savedInv[id];
            } catch (e) { }

            const qtyText = this.add.text(slotX + 20, y + 20, initialQty.toString(), {
                fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 3
            }).setOrigin(1);

            // Click Handler (Mobile/Desktop)
            const zone = this.add.zone(slotX, y, 60, 60).setInteractive();
            zone.on('pointerdown', () => {
                this.scene.get('Game').useItem(id);
            });

            this.itemSlots[id] = { qtyText, bg: null }; // Store ref
        });
    }

    updateInventory(inventory) {
        // Inventory is object: { speed: 5, magnet: 2 }
        Object.keys(this.itemSlots).forEach(id => {
            const count = inventory[id] || 0;
            this.itemSlots[id].qtyText.setText(count.toString());
        });
    }

    onItemActivated(data) {
        // Show activation visual? For now just log
        Logger.info('UI', "Item activated UI:", data);
        // Maybe flash the slot?
    }
}
