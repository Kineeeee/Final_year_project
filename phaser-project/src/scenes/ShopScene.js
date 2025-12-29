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
        const closeBtn = this.add.text(this.scale.width / 2, this.scale.height - 100, 'CLOSE', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#FF0000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        closeBtn.on('pointerdown', () => {
            this.scene.stop();
            this.scene.resume('MainMenu'); // Resume MainMenu if paused
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
            }
            if (state.highScore !== undefined) {
                localStorage.setItem('highScore', state.highScore);
            }
        });

        // ...

        // Listen for DB Items
        this.socket.on('shopItems', (items) => {
            Logger.info('Shop', 'Received Shop Items from DB:', items);
            this.loadingText.destroy(); // Remove loading text
            this.itemGroup.clear(true, true); // Clear old items

            let y = 250;
            items.forEach(item => {
                this.createItemRow(this.scale.width / 2, y, item);
                y += 120;
            });
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

    createItemRow(x, y, item) {
        const bg = this.add.rectangle(x, y, 600, 100, 0x333333).setOrigin(0.5);

        // Icon (Placeholder)
        this.add.rectangle(x - 250, y, 60, 60, item.iconColor).setOrigin(0.5);

        // Name & Desc
        this.add.text(x - 200, y - 20, item.name, { fontSize: '24px', fill: '#fff' });
        this.add.text(x - 200, y + 15, item.description, { fontSize: '16px', fill: '#aaa' });

        // Price
        this.add.text(x + 100, y, `${item.price} G`, { fontSize: '24px', fill: '#FFD700' }).setOrigin(1, 0.5);

        // Buy Button
        const buyBtn = this.add.text(x + 200, y, 'BUY', {
            fontSize: '24px',
            fill: '#000',
            backgroundColor: '#00FF00',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setInteractive();

        buyBtn.on('pointerdown', () => {
            if (this.socket) {
                this.socket.emit('buyItem', item.id);
            }
        });
    }
}