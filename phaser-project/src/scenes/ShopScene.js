// import { ITEMS } from '../config/items.js'; // REMOVED: Using DB data now
import { Scene } from 'phaser';
import io from 'socket.io-client';
import { CONFIG } from '../config/constants';
import { Logger } from '../utils/Logger';

export class ShopScene extends Scene {
    constructor() {
        super('ShopScene');
    }

    create(data) {
        this.socket = data.socket;

        // Background overlay
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.9);

        // Title
        this.add.text(this.scale.width / 2, 100, 'ITEM SHOP', {
            fontSize: '48px',
            fill: '#fff',
            fontFamily: '"Outfit", sans-serif'
        }).setOrigin(0.5);

        // Coin Display
        window.userCoins = data.coins || window.userCoins || 0;
        this.coinText = this.add.text(this.scale.width - 50, 50, `Coins: ${window.userCoins}`, {
            fontSize: '32px',
            fill: '#FFD700'
        }).setOrigin(1, 0.5);

        // Initialize Items Container (empty initially)
        this.itemGroup = this.add.group();

        // Show Loading Text
        this.loadingText = this.add.text(this.scale.width / 2, 250, 'Loading Shop Items...', {
            fontSize: '24px', fill: '#ccc'
        }).setOrigin(0.5);

        // Request items explicitly if socket is ready (handled in initPlayer response usually)
        // But if we already have items (re-opening shop), reusing them would be nice.
        // For now, wait for server.

        // Close Button
        const closeBtn = this.add.container(this.scale.width / 2, this.scale.height - 80);
        const closeBg = this.add.rectangle(0, 0, 200, 60, 0xff4444).setStrokeStyle(2, 0xffffff);
        const closeText = this.add.text(0, 0, 'CLOSE', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: '"Outfit", sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        closeBtn.add([closeBg, closeText]);
        closeBtn.setSize(200, 60).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerover', () => {
            closeBg.setFillStyle(0xff6666);
            this.tweens.add({ targets: closeBtn, scale: 1.05, duration: 100 });
        });
        closeBtn.on('pointerout', () => {
            closeBg.setFillStyle(0xff4444);
            this.tweens.add({ targets: closeBtn, scale: 1.0, duration: 100 });
        });

        closeBtn.on('pointerdown', () => {
            this.tweens.add({
                targets: closeBtn,
                scale: 0.95,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    this.scene.stop();
                    this.scene.resume('MainMenu');
                }
            });
        });

        // Listen for coin updates
        if (!this.socket) {
            // Connect if not passed (e.g. from MainMenu)
            this.socket = io(CONFIG.SERVER_URL);
            this.ownSocket = true; // Mark as owned

            this.socket.on('connect', () => {
                // Request data
                this.socket.emit('initPlayer', { name: data.username });
            });
        } else {
            this.ownSocket = false; // Shared socket
        }

        this.socket.on('playerState', (state) => {
            Logger.info('Shop', 'Received playerState:', state);
            if (state.coins !== undefined) {
                window.userCoins = state.coins;
                localStorage.setItem('coins', state.coins);
                this.coinText.setText(`Coins: ${state.coins}`);
            }
            if (state.inventory) {
                window.playerInventory = state.inventory;
                localStorage.setItem('inventory', JSON.stringify(state.inventory));
                this.updateInventoryUI();
            }
            if (state.highScore !== undefined) {
                localStorage.setItem('highScore', state.highScore);
            }
        });

        // Listen for updates
        this.socket.on('updateCoins', (coins) => {
            window.userCoins = coins;
            this.coinText.setText(`Coins: ${coins}`);
        });

        this.socket.on('updateInventory', (inventory) => {
            window.playerInventory = inventory;
            this.updateInventoryUI();
        });

        // ...

        // Listen for DB Items
        this.socket.on('shopItems', (items) => {
            Logger.info('Shop', 'Received Shop Items from DB:', items);
            this.loadingText.destroy(); // Remove loading text
            this.itemGroup.clear(true, true); // Clear old items
            this.itemQuantityTexts = {}; // Reset text references

            let y = 250;
            items.forEach(item => {
                this.createItemRow(this.scale.width / 2, y, item);
                y += 210; // 1.5x spacing
            });
            this.updateInventoryUI();
        });

        this.socket.on('disconnect', () => {
            // Handle disconnect if needed
        });

        // Cleanup listeners when scene stops to prevent errors
        this.events.on('shutdown', () => {
            if (this.socket) {
                this.socket.off('updateCoins');
                this.socket.off('updateInventory');
                this.socket.off('playerState');
                this.socket.off('shopItems');
                if (this.ownSocket) {
                    this.socket.disconnect();
                }
            }
        });
    }



    updateInventoryUI() {
        if (!this.itemQuantityTexts) return;
        const inventory = window.playerInventory || {};

        Object.keys(this.itemQuantityTexts).forEach(itemId => {
            const count = inventory[itemId] || 0;
            const textObj = this.itemQuantityTexts[itemId];
            if (textObj && textObj.active) {
                textObj.setText(`Owned: ${count}`);
            }
        });
    }

    createItemRow(x, y, item) {
        // Main Row Background (1.5x size: 1275x180)
        const bg = this.add.rectangle(x, y, 1275, 180, 0x1a1a1a).setOrigin(0.5);
        bg.setStrokeStyle(2, 0x444444);
        this.itemGroup.add(bg);

        // Icon Background (1.5x size: 120x120, offset -525)
        const iconBg = this.add.rectangle(x - 525, y, 120, 120, 0x000000).setOrigin(0.5);
        iconBg.setStrokeStyle(1, 0x666666);
        this.itemGroup.add(iconBg);

        // Icon
        const iconKey = item.id;
        if (this.textures.exists(iconKey)) {
            const icon = this.add.image(x - 525, y, iconKey);
            // Fit within 108x108 (approx 1.5x of 72)
            const scale = 108 / Math.max(icon.width, icon.height);
            icon.setScale(scale);
            this.itemGroup.add(icon);
        } else {
            // Fallback
            const icon = this.add.rectangle(x - 525, y, 96, 96, 0x888888).setOrigin(0.5);
            this.itemGroup.add(icon);
        }

        // Name (1.5x: x-435, y-37, 42px)
        const nameText = this.add.text(x - 435, y - 37, item.name, {
            fontSize: '42px',
            fill: '#ffffff',
            fontFamily: '"Outfit", sans-serif',
            fontStyle: 'bold'
        });
        this.itemGroup.add(nameText);

        // Description (1.5x: x-435, y+15, 24px, wrap 600)
        const descText = this.add.text(x - 435, y + 15, item.description, {
            fontSize: '24px',
            fill: '#aaaaaa',
            fontFamily: '"Outfit", sans-serif',
            wordWrap: { width: 600 }
        });
        this.itemGroup.add(descText);

        // Owned Count (1.5x: x+270, y+45, 27px)
        const currentQty = (window.playerInventory && window.playerInventory[item.id]) || 0;
        const ownedText = this.add.text(x + 270, y + 45, `Owned: ${currentQty}`, {
            fontSize: '27px',
            fill: '#00ffaa',
            fontFamily: '"Outfit", sans-serif'
        }).setOrigin(0.5);
        this.itemGroup.add(ownedText);

        // Store reference for updates
        if (!this.itemQuantityTexts) this.itemQuantityTexts = {};
        this.itemQuantityTexts[item.id] = ownedText;

        // Price (1.5x: x+270, y-30, 39px)
        const priceText = this.add.text(x + 270, y - 30, `${item.price} G`, {
            fontSize: '39px',
            fill: '#FFD700',
            fontFamily: '"Outfit", sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.itemGroup.add(priceText);

        // Buy Button (1.5x: x+480, 180x75, 36px)
        const btnWidth = 180;
        const btnHeight = 75;
        const btnX = x + 480;

        const btnBg = this.add.rectangle(btnX, y, btnWidth, btnHeight, 0x00cc00).setInteractive({ useHandCursor: true });
        const btnText = this.add.text(btnX, y, 'BUY', {
            fontSize: '36px',
            fill: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.itemGroup.add(btnBg);
        this.itemGroup.add(btnText);

        // Button Hover Effect
        btnBg.on('pointerover', () => btnBg.setFillStyle(0x00ff00));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x00cc00));

        btnBg.on('pointerdown', () => {
            if (this.socket) {
                this.tweens.add({
                    targets: [btnBg, btnText],
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 50,
                    yoyo: true
                });
                this.socket.emit('buyItem', item.id);
            }
        });
    }
}