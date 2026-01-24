import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { socketService } from '../services/SocketService';
import { playerState } from '../services/PlayerState';
import { UIButton } from '../ui/UIButton';
import { UIPanel } from '../ui/UIPanel';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class ShopScene extends Scene {
    constructor() {
        super('ShopScene');
        this._didShutdown = false;
        this._wheelHandler = null;
    }

    create(data) {
        Logger.info('Shop', 'Open Shop');
        this.scene.stop('UIScene');

        this._didShutdown = false;
        this.events.off('shutdown', this._onShutdown, this);
        this.events.off('destroy', this._onShutdown, this);
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // Overlay
        this.add.rectangle(centerX, centerY, width, height, COLORS.OVERLAY, COLORS.OVERLAY_ALPHA).setInteractive();

        // Main Panel
        const panelWidth = 1000;
        const panelHeight = height - 100;

        // Ensure state is synced
        if (data.coins !== undefined) playerState.setCoins(data.coins);

        const closeShop = () => {
            this.scene.stop();
            this.scene.resume('MainMenu');
        };

        const panel = new UIPanel(this, centerX, centerY, panelWidth, panelHeight, 'ITEM SHOP', closeShop);
        this.add.existing(panel);

        // Coin Display (Top Right of Panel, simpler)
        this.coinText = this.add.text(
            centerX + panelWidth / 2 - 40,
            centerY - panelHeight / 2 + 40,
            `💰 ${playerState.getCoins()}`,
            { ...TEXT_STYLES.SUBHEADER, color: COLORS.TEXT.ACCENT }
        ).setOrigin(1, 0.5);
        this.add.existing(this.coinText);

        // ===============================
        // SCROLL AREA
        // ===============================
        const scrollWidth = panelWidth - 80;
        const scrollHeight = panelHeight - 140;
        const scrollY = centerY;

        const maskShape = this.make.graphics();
        maskShape.fillRect(centerX - scrollWidth / 2, scrollY - scrollHeight / 2, scrollWidth, scrollHeight);
        const mask = maskShape.createGeometryMask();

        this.itemsContainer = this.add.container(centerX, scrollY - scrollHeight / 2 + 60); // Start slightly offset
        this.itemsContainer.setMask(mask);

        this.itemsY = 0;
        this.itemCards = [];
        this.itemQuantityTexts = {};
        this.maxScroll = 0;

        this.loadingText = this.add.text(centerX, centerY, 'Loading items...', { ...TEXT_STYLES.BODY, color: COLORS.TEXT.MUTED }).setOrigin(0.5);

        // Scroll Logic
        if (this._wheelHandler) this.input.off('wheel', this._wheelHandler);

        this._wheelHandler = (_, __, ___, deltaY) => {
            if (!this.itemsContainer) return;
            this.itemsY -= deltaY * 0.5;
            this.itemsY = Phaser.Math.Clamp(this.itemsY, -this.maxScroll, 0);

            // Smooth scroll tween could be nice, but direct set is snappier for now
            this.itemsContainer.y = (scrollY - scrollHeight / 2 + 60) + this.itemsY;
        };
        this.input.on('wheel', this._wheelHandler);

        // Socket
        this.socket = socketService.connect();
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
        });

        socketService.on('shopItems', (items) => {
            Logger.info('Shop', 'Items received:', items);
            if (this.loadingText) this.loadingText.destroy();

            this.itemsContainer.removeAll(true);
            this.itemCards = [];
            this.itemQuantityTexts = {};

            let yOffset = 0;
            const cardHeight = 160;
            const cardGap = 20;

            items.forEach(item => {
                const card = this.createItemCard(0, yOffset, item, scrollWidth - 40, cardHeight);
                this.itemsContainer.add(card);
                yOffset += cardHeight + cardGap;
            });

            this.maxScroll = Math.max(0, yOffset - scrollHeight + 40);
        });

        socketService.emit('initPlayer', { name: playerState.getUsername() });
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

    createItemCard(x, y, item, w, h) {
        const card = this.add.container(x, y);

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x333333, 1);
        bg.fillRoundedRect(-w / 2, 0, w, h, 16);
        bg.lineStyle(2, 0x555555, 1);
        bg.strokeRoundedRect(-w / 2, 0, w, h, 16);

        // Icon Area
        const iconSize = 100;
        const iconX = -w / 2 + 80;
        const iconY = h / 2;

        const iconBg = this.add.circle(iconX, iconY, 50, 0x111111).setStrokeStyle(1, 0x666666);

        let icon;
        if (this.textures.exists(item.id)) {
            icon = this.add.image(iconX, iconY, item.id);
            const scale = 70 / Math.max(icon.width, icon.height);
            icon.setScale(scale);
        } else {
            icon = this.add.text(iconX, iconY, '?', { fontSize: 32 }).setOrigin(0.5);
        }

        // Texts
        const textX = -w / 2 + 160;
        const nameText = this.add.text(textX, 30, item.name, { ...TEXT_STYLES.SUBHEADER, fontSize: 28 });
        const descText = this.add.text(textX, 70, item.description, { ...TEXT_STYLES.BODY, fontSize: 18, color: COLORS.TEXT.MUTED, wordWrap: { width: 400 } });

        // Stats / Owned
        const owned = playerState.getItemCount(item.id);
        const ownedText = this.add.text(w / 2 - 180, h / 2 + 30, `Owned: ${owned}`, { ...TEXT_STYLES.BODY, fontSize: 18, color: COLORS.PRIMARY }).setOrigin(0.5);
        this.itemQuantityTexts[item.id] = ownedText;

        const priceText = this.add.text(w / 2 - 180, h / 2 - 20, `${item.price} G`, { ...TEXT_STYLES.SUBHEADER, color: COLORS.TEXT.ACCENT }).setOrigin(0.5);

        // Buy Button
        const buyBtn = new UIButton(
            this,
            w / 2 - 60, h / 2,
            'BUY',
            () => socketService.emit('buyItem', item.id),
            { width: 100, height: 50, color: COLORS.PRIMARY, fontSize: 20 }
        );

        card.add([bg, iconBg, icon, nameText, descText, ownedText, priceText, buyBtn]);
        return card;
    }

    updateInventoryUI() {
        if (!this.itemQuantityTexts) return;
        Object.keys(this.itemQuantityTexts).forEach(id => {
            const count = playerState.getItemCount(id);
            this.itemQuantityTexts[id].setText(`Owned: ${count}`);
        });
    }
}
