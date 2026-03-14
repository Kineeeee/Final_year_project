import { Scene, Math as PhaserMath } from 'phaser';
import { Logger } from '../../utils/Logger';
import { socketService } from '../../core/services/SocketService';
import { playerState } from '../../core/services/PlayerState';
import { UIButton } from '../../ui/UIButton';
import { UIPanel } from '../../ui/UIPanel';
import { COLORS, TEXT_STYLES } from '../../ui/UIConstants';

export class ShopScene extends Scene {
    constructor() {
        super('ShopScene');
        this._didShutdown = false;
        this._wheelHandler = null;
        this._targetY = 0;
    }

    create(data) {
        Logger.info('Shop', 'Open Shop');
        this.scene.stop('UIScene');

        this._didShutdown = false;
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // 1. Overlay
        const overlay = this.add.rectangle(centerX, centerY, width, height, COLORS.OVERLAY, 0).setInteractive();
        this.tweens.add({ targets: overlay, fillAlpha: COLORS.OVERLAY_ALPHA, duration: 200 });

        // 2. Main Panel
        const panelWidth = 1000;
        const panelHeight = height - 100;
        if (data.coins !== undefined) playerState.setCoins(data.coins);

        const closeShop = () => {
            this.tweens.add({
                targets: panel,
                scale: 0.9,
                alpha: 0,
                duration: 150,
                onComplete: () => {
                    this.scene.stop();
                    this.scene.resume('MainMenu');
                }
            });
        };

        const panel = new UIPanel(this, centerX, centerY, panelWidth, panelHeight, 'ITEM SHOP', closeShop);
        this.add.existing(panel);
        panel.setScale(0.8).setAlpha(0);
        this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

        // 3. Coin Display
        this.coinText = this.add.text(
            centerX + panelWidth / 2 - 80,
            centerY - panelHeight / 2 + 45,
            `💰 ${playerState.getCoins()}`,
            { ...TEXT_STYLES.SUBHEADER, color: '#f1c40f', fontSize: 32, stroke: '#000', strokeThickness: 3 }
        ).setOrigin(1, 0.5);

        // 4. Scroll Area Setup
        const scrollWidth = panelWidth - 80;
        const scrollHeight = panelHeight - 160;
        const scrollY = centerY + 20;

        const maskShape = this.make.graphics();
        maskShape.fillRect(centerX - scrollWidth / 2, scrollY - scrollHeight / 2, scrollWidth, scrollHeight);

        this.itemsContainer = this.add.container(centerX, scrollY - scrollHeight / 2);
        this.itemsContainer.setMask(maskShape.createGeometryMask());
        this._targetY = this.itemsContainer.y;

        this.itemQuantityTexts = {};
        this.maxScroll = 0;

        // 5. Scroll Logic (Lerp)
        this._wheelHandler = (_, __, ___, deltaY) => {
            if (!this.itemsContainer) return;
            const scrollSpeed = 0.8;
            const minY = scrollY - scrollHeight / 2;
            const maxY = minY - this.maxScroll;
            this._targetY = PhaserMath.Clamp(this._targetY - deltaY * scrollSpeed, maxY, minY);
        };
        this.input.on('wheel', this._wheelHandler);

        // 6. Socket Events
        this.socket = socketService.connect();
        socketService.off('playerState');
        socketService.off('shopItems');

        socketService.on('playerState', (state) => {
            if (state.coins !== undefined) {
                playerState.setCoins(state.coins);
                this.coinText.setText(`💰 ${state.coins}`);
                this.updateItemCardsVisuals();
            }
            if (state.inventory) {
                playerState.setInventory(state.inventory);
                this.updateInventoryUI();
            }
        });

        socketService.on('shopItems', (items) => {
            this.itemsContainer.removeAll(true);
            let yOffset = 20;
            const cardHeight = 150;

            items.forEach((item, index) => {
                const card = this.createItemCard(0, yOffset, item, scrollWidth - 40, cardHeight);
                card.setAlpha(0).setX(100);
                this.tweens.add({
                    targets: card, alpha: 1, x: 0,
                    duration: 400, delay: index * 60, ease: 'Power2'
                });
                this.itemsContainer.add(card);
                yOffset += cardHeight + 15;
            });
            this.maxScroll = Math.max(0, yOffset - scrollHeight);
        });

        const token = localStorage.getItem('token');
        socketService.emit('initPlayer', {
            name: playerState.getUsername(),
            token,
        });
    }

    update() {
        if (this.itemsContainer && Math.abs(this.itemsContainer.y - this._targetY) > 0.1) {
            this.itemsContainer.y = PhaserMath.Linear(this.itemsContainer.y, this._targetY, 0.15);
        }
    }

    createItemCard(x, y, item, w, h) {
        const card = this.add.container(x, y);
        const canAfford = () => playerState.getCoins() >= item.price;

        // Background
        const bg = this.add.graphics();
        this.drawCardBg(bg, w, h, 0x2a2a2a, 0x444444);
        bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, 0, w, h), Phaser.Geom.Rectangle.Contains);
        card.add(bg);

        bg.on('pointerover', () => {
            this.tweens.add({ targets: card, scale: 1.02, duration: 100 });
            this.drawCardBg(bg, w, h, 0x333333, COLORS.TEXT.ACCENT);
        });
        bg.on('pointerout', () => {
            this.tweens.add({ targets: card, scale: 1, duration: 100 });
            this.drawCardBg(bg, w, h, 0x2a2a2a, 0x444444);
        });

        // Icon
        const iconX = -w / 2 + 75;
        const iconY = h / 2;
        const iconBg = this.add.graphics();
        iconBg.fillStyle(0x1a1a1a, 1);
        iconBg.fillRoundedRect(iconX - 40, iconY - 40, 80, 80, 10);
        iconBg.lineStyle(2, 0x555555, 1);
        iconBg.strokeRoundedRect(iconX - 40, iconY - 40, 80, 80, 10);
        card.add(iconBg);
        if (this.textures.exists(item.id)) {
            const icon = this.add.image(iconX, iconY, item.id);
            icon.setScale(70 / Math.max(icon.width, icon.height));
            card.add(icon);
        }

        // Texts
        const textX = -w / 2 + 150;
        card.add(this.add.text(textX, 25, item.name, { ...TEXT_STYLES.SUBHEADER, fontSize: 26 }));
        card.add(this.add.text(textX, 65, item.description, { ...TEXT_STYLES.BODY, fontSize: 16, color: '#bbb', wordWrap: { width: 380 } }));

        // Price & Owned
        const infoX = w / 2 - 200;
        const priceText = this.add.text(infoX, h / 2, `${item.price} G`, {
            ...TEXT_STYLES.SUBHEADER,
            color: canAfford() ? COLORS.TEXT.ACCENT : '#ff4d4d'
        }).setOrigin(0.5);

        const ownedText = this.add.text(infoX, h / 2 + 35, `Owned: ${playerState.getItemCount(item.id)}`, { fontSize: 15, color: '#888' }).setOrigin(0.5);
        this.itemQuantityTexts[item.id] = ownedText;

        // BUY BUTTON WITH EFFECTS
        const buyBtn = new UIButton(this, w / 2 - 80, h / 2, 'BUY', () => {
            if (!canAfford()) {
                this.cameras.main.shake(100, 0.002);
            } else {
                this.playBuyEffects(card, buyBtn, item.price, w, h, bg);
            }
            socketService.emit('buyItem', item.id);
        }, {
            width: 110, height: 45,
            color: canAfford() ? COLORS.PRIMARY : 0x555555,
            fontSize: 18
        });

        card.add([priceText, ownedText, buyBtn]);
        card.sendToBack(bg); // Ensure background is behind everything
        card.buyBtn = buyBtn;
        card.priceText = priceText;
        card.itemData = item;

        return card;
    }

    playBuyEffects(card, btn, price, w, h, bg) {
        // 1. Button Punch Effect
        this.tweens.add({
            targets: btn, scale: 0.85, duration: 50, yoyo: true, ease: 'Quad.easeOut'
        });

        // 2. Floating Text Effect (-G)
        const floatText = this.add.text(btn.x, btn.y - 20, `-${price}G`, {
            fontSize: 22, color: '#ff4d4d', fontWeight: 'bold', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        card.add(floatText);

        this.tweens.add({
            targets: floatText, y: floatText.y - 60, alpha: 0, duration: 800,
            onComplete: () => floatText.destroy()
        });

        // 3. Card Flash Effect
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.4);
        flash.fillRoundedRect(-w / 2, 0, w, h, 12);
        card.add(flash);
        // Đảm bảo flash nằm dưới text nhưng trên bg
        card.sendToBack(flash);
        card.sendToBack(bg);

        this.tweens.add({
            targets: flash, alpha: 0, duration: 400,
            onComplete: () => flash.destroy()
        });
    }

    drawCardBg(graphics, w, h, bgColor, strokeColor) {
        graphics.clear();
        graphics.fillStyle(bgColor, 1);
        graphics.fillRoundedRect(-w / 2, 0, w, h, 12);
        graphics.lineStyle(2, strokeColor, 1);
        graphics.strokeRoundedRect(-w / 2, 0, w, h, 12);
    }

    updateItemCardsVisuals() {
        if (!this.itemsContainer) return;
        this.itemsContainer.list.forEach(card => {
            if (card.buyBtn && card.itemData) {
                const canAfford = playerState.getCoins() >= card.itemData.price;
                card.priceText.setColor(canAfford ? COLORS.TEXT.ACCENT : '#ff4d4d');
            }
        });
    }

    updateInventoryUI() {
        Object.keys(this.itemQuantityTexts).forEach(id => {
            this.itemQuantityTexts[id].setText(`Owned: ${playerState.getItemCount(id)}`);
        });
    }

    _onShutdown() {
        if (this._didShutdown) return;
        this._didShutdown = true;
        this.input.off('wheel', this._wheelHandler);
        socketService.off('playerState');
        socketService.off('shopItems');
        socketService.disconnect();
    }
}