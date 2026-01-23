import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { socketService } from '../services/SocketService';
import { playerState } from '../services/PlayerState';
import { UIButton } from '../ui/UIButton';

export class ShopScene extends Scene {
    constructor() {
        super('ShopScene');
        this._didShutdown = false;
        this._wheelHandler = null;
    }

    create(data) {
        Logger.info('Shop', 'Open Shop');

        // UIScene is session-scoped (Game only). Ensure it never leaks into the shop overlay.
        this.scene.stop('UIScene');

        // Scene instances are reused across restarts; reset per-run guards.
        this._didShutdown = false;

        this.events.off('shutdown', this._onShutdown, this);
        this.events.off('destroy', this._onShutdown, this);
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // ===============================
        // OVERLAY + PANEL
        // ===============================
        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.85);

        const panel = this.add.container(centerX, centerY);
        const panelBg = this.add.rectangle(0, 0, 1200, height - 120, 0x111111)
            .setStrokeStyle(2, 0xffffff, 0.2);
        panel.add(panelBg);

        // ===============================
        // HEADER
        // ===============================
        const title = this.add.text(0, -panelBg.height / 2 + 50, 'ITEM SHOP', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 42,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        panel.add(title);

        // ===============================
        // COIN DISPLAY
        // ===============================
        // Ensure state is synced if passed from previous scene, though PlayerState should handle it
        if (data.coins !== undefined) playerState.setCoins(data.coins);

        this.coinText = this.add.text(
            panelBg.width / 2 - 150,
            -panelBg.height / 2 + 40,
            `💰 ${playerState.getCoins()}`,
            {
                fontFamily: '"Outfit", sans-serif',
                fontSize: 28,
                color: '#FFD700',
                fontStyle: 'bold'
            }
        ).setOrigin(1, 0.5);

        panel.add(this.coinText);

        // ===============================
        // CLOSE BUTTON
        // ===============================
        const closeBtn = new UIButton(
            this,
            panelBg.width / 2 - 90,
            -panelBg.height / 2 + 40,
            '✕',
            () => {
                this.scene.stop();
                this.scene.resume('MainMenu');
            },
            { width: 60, height: 44, color: 0xaa3333 }
        );

        panel.add(closeBtn);

        // ===============================
        // SCROLLABLE ITEM AREA
        // ===============================
        const maskShape = this.make.graphics();
        maskShape.fillRect(
            centerX - 560,
            centerY - 260,
            1120,
            height - 240
        );

        const mask = maskShape.createGeometryMask();

        this.itemsContainer = this.add.container(centerX, centerY - 40);
        this.itemsContainer.setMask(mask);

        this.itemsY = 0;
        this.itemCards = [];
        this.itemQuantityTexts = {};

        this.loadingText = this.add.text(centerX, centerY, 'Loading items...', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 24,
            color: '#cccccc'
        }).setOrigin(0.5);

        // Scroll (ensure we don't stack listeners across opens)
        if (this._wheelHandler) {
            this.input.off('wheel', this._wheelHandler);
        }
        this._wheelHandler = (_, __, ___, deltaY) => {
            if (!this.itemsContainer) return;
            this.itemsY -= deltaY * 0.4;
            this.itemsY = Phaser.Math.Clamp(this.itemsY, -this.maxScroll, 0);
            this.itemsContainer.y = centerY - 40 + this.itemsY;
        };
        this.input.on('wheel', this._wheelHandler);

        // ===============================
        // SOCKET INIT
        // ===============================
        this.socket = socketService.connect();

        // Ensure we are identified (idempotent if already connected)
        socketService.emit('initPlayer', { name: playerState.getUsername() });

        // Defensive: ensure no stale handlers remain if shutdown didn't run (e.g., hot-reload)
        socketService.off('playerState');
        socketService.off('shopItems');

        socketService.on('playerState', (state) => {
            if (state.coins !== undefined) {
                playerState.setCoins(state.coins);
                this.coinText.setText(`💰 ${state.coins}`);
            }

            if (state.inventory) {
                playerState.setInventory(state.inventory);
                this.updateInventoryUI();
            }

            if (state.highScore !== undefined) {
                playerState.setHighScore(state.highScore);
            }
        });

        socketService.on('shopItems', (items) => {
            Logger.info('Shop', 'Items received:', items);
            if (this.loadingText) this.loadingText.destroy();

            this.itemsContainer.removeAll(true);
            this.itemCards = [];
            this.itemQuantityTexts = {};

            let y = 0;
            items.forEach(item => {
                const card = this.createItemCard(0, y, item);
                this.itemsContainer.add(card);
                y += 170;
            });

            this.maxScroll = Math.max(0, y - (height - 260));
        });
    }

    _onShutdown() {
        if (this._didShutdown) return;
        this._didShutdown = true;

        if (this._wheelHandler) {
            this.input.off('wheel', this._wheelHandler);
            this._wheelHandler = null;
        }

        socketService.off('playerState');
        socketService.off('shopItems');
        socketService.disconnect();
    }

    // ===============================
    // ITEM CARD
    // ===============================
    createItemCard(x, y, item) {
        const card = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 1080, 150, 0x1a1a1a)
            .setStrokeStyle(2, 0x444444);

        // Icon
        const iconBg = this.add.rectangle(-480, 0, 96, 96, 0x000000)
            .setStrokeStyle(1, 0x666666);

        let icon;
        if (this.textures.exists(item.id)) {
            icon = this.add.image(-480, 0, item.id);
            const scale = 80 / Math.max(icon.width, icon.height);
            icon.setScale(scale);
        } else {
            icon = this.add.rectangle(-480, 0, 72, 72, 0x777777);
        }

        // Text
        const nameText = this.add.text(-410, -30, item.name, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 28,
            color: '#ffffff',
            fontStyle: 'bold'
        });

        const descText = this.add.text(-410, 10, item.description, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 20,
            color: '#aaaaaa',
            wordWrap: { width: 500 }
        });

        const owned = playerState.getItemCount(item.id);
        const ownedText = this.add.text(220, 30, `Owned: ${owned}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 18,
            color: '#00ffaa'
        }).setOrigin(0.5);

        this.itemQuantityTexts[item.id] = ownedText;

        const priceText = this.add.text(220, -20, `${item.price} G`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: 26,
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // BUY BUTTON
        const buyBtn = new UIButton(
            this,
            420, 0,
            'BUY',
            () => {
                socketService.emit('buyItem', item.id);
            },
            { width: 120, height: 52, color: 0x00aa44 }
        );

        card.add([
            bg,
            iconBg,
            icon,
            nameText,
            descText,
            ownedText,
            priceText,
            buyBtn
        ]);

        return card;
    }

    // ===============================
    // UPDATE INVENTORY UI
    // ===============================
    updateInventoryUI() {
        if (!this.itemQuantityTexts) return;

        Object.keys(this.itemQuantityTexts).forEach(id => {
            const count = playerState.getItemCount(id);
            this.itemQuantityTexts[id].setText(`Owned: ${count}`);
        });
    }
}
