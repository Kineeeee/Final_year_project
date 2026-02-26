import { ITEMS } from '../../config/items.js';
import { COLORS, TEXT_STYLES } from '../../ui/UIConstants';

export class ItemSlots {
    constructor(scene, mode = 'normal') {
        this.scene = scene;
        this.mode = mode;

        if (this.mode !== 'normal') {
            this.slotKeys = ['speed', 'ghost'];
        } else {
            this.slotKeys = ['speed', 'magnet', 'ghost'];
        }

        this.slots = {};
        this.createElements();
    }

    createElements() {
        const keyMap = {
            'speed': 'SPEED_UP',
            'magnet': 'MAGNET',
            'ghost': 'GHOST'
        };

        const itemIds = this.slotKeys.map(key => {
            const itemKey = keyMap[key] || key.toUpperCase();
            return ITEMS[itemKey] ? ITEMS[itemKey].id : null;
        }).filter(id => id !== null);

        this.container = this.scene.add.container(0, 0);

        itemIds.forEach((id, index) => {
            const slotContainer = this.scene.add.container(0, 0);

            // Background (Rounded Graphics)
            const bg = this.scene.add.graphics();
            bg.fillStyle(COLORS.PANEL_BG, 0.8);
            bg.fillRoundedRect(-36, -36, 72, 72, 16);
            bg.lineStyle(2, COLORS.PANEL_BORDER, 1);
            bg.strokeRoundedRect(-36, -36, 72, 72, 16);
            slotContainer.add(bg);

            // Icon
            let icon;
            if (this.scene.textures.exists(id)) {
                icon = this.scene.add.image(0, 0, id);
                const scale = 48 / Math.max(icon.width, icon.height);
                icon.setScale(scale);
            } else {
                // Fallback
                const color = (ITEMS && Object.values(ITEMS).find(i => i.id === id)?.iconColor) || 0x888888;
                icon = this.scene.add.rectangle(0, 0, 48, 48, color);
            }
            slotContainer.add(icon);

            // Key Hint
            if (this.scene.sys.game.device.os.desktop) {
                const hintBg = this.scene.add.circle(-28, -28, 12, COLORS.PANEL_BG).setStrokeStyle(1, COLORS.TEXT.MUTED);
                const hint = this.scene.add.text(-28, -28, `${index + 1}`, {
                    fontSize: '14px', fill: '#ffffff', fontFamily: '"Outfit", sans-serif'
                }).setOrigin(0.5);
                slotContainer.add([hintBg, hint]);
            }

            // Badge (Quantity)
            const badge = this.scene.add.circle(28, 28, 14, COLORS.DANGER);
            slotContainer.add(badge);

            let initialQty = 0;
            try {
                const saved = JSON.parse(localStorage.getItem('inventory'));
                if (saved && saved[id]) initialQty = saved[id];
            } catch (e) { }

            const qtyText = this.scene.add.text(28, 28, initialQty.toString(), {
                fontSize: '16px', fill: '#ffffff', fontStyle: 'bold', fontFamily: '"Outfit", sans-serif'
            }).setOrigin(0.5);
            slotContainer.add(qtyText);

            // Interaction Zone
            const zone = this.scene.add.zone(0, 0, 72, 72).setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => {
                this.scene.scene.get('Game').useItem(id);
                this.scene.tweens.add({
                    targets: slotContainer,
                    scale: 0.9, duration: 50, yoyo: true
                });
            });
            slotContainer.add(zone);

            this.slots[id] = {
                container: slotContainer,
                qtyText,
                icon,
                bg, // Store ref if needed
                activeBar: null,
                cdOverlay: null,
                cdTimer: null
            };

            this.container.add(slotContainer);
        });
    }

    resize(safeArea) {
        const scale = safeArea.uiScale || 1;
        const gap = 100 * scale;
        const slotIds = Object.keys(this.slots);
        const startX = -((slotIds.length - 1) * gap) / 2;

        this.container.setDepth(90);
        // Position Top Center, slightly below the "top" margin to clear the HUD text
        this.container.setPosition(safeArea.centerX, safeArea.top + 90 * scale);
        this.container.setScale(scale);

        slotIds.forEach((id, index) => {
            const slot = this.slots[id];
            slot.container.setPosition(startX + (index * gap), 0);
        });
    }

    updateInventory(inventory) {
        Object.keys(this.slots).forEach(id => {
            const count = inventory[id] || 0;
            this.slots[id].qtyText.setText(count.toString());

            // Pop effect on badge
            this.scene.tweens.add({
                targets: this.slots[id].qtyText.parentContainer, // N/A, qtyText is in slotContainer
                // Let's target the badge circle if we had a ref, or just scaled the text
                targets: this.slots[id].qtyText,
                scale: 1.3, duration: 100, yoyo: true
            });
        });
    }

    onItemActivated(data) {
        const slot = this.slots[data.itemId];
        if (slot) {
            // ACTIVE BAR
            if (slot.activeBar) slot.activeBar.destroy();

            const barSize = 72;
            const bar = this.scene.add.graphics();
            slot.container.add(bar);
            slot.container.moveBelow(bar, slot.icon);
            slot.activeBar = bar;

            this.scene.tweens.addCounter({
                from: 1, to: 0, duration: data.duration,
                onUpdate: (tween) => {
                    if (!slot.container.scene) return;
                    const t = tween.getValue();
                    bar.clear();
                    bar.fillStyle(COLORS.PRIMARY, 0.6); // Greenish active state
                    // Fill from bottom up
                    const h = barSize * t;
                    // Draw inside rounded rect constraints roughly
                    // Simple rect clipped by standard shape? Or just draw rect.
                    // For simplicity, just draw rect behind icon.
                    bar.fillRect(-36, 36 - h, 72, h);
                },
                onComplete: () => {
                    if (slot.activeBar) slot.activeBar.destroy();
                    slot.activeBar = null;

                    const remainingCooldown = data.cooldown || 0;
                    if (remainingCooldown > 0) {
                        this.startCooldown(slot, remainingCooldown);
                    }
                }
            });
        }
    }

    startCooldown(slot, duration) {
        if (slot.cdOverlay) slot.cdOverlay.destroy();
        if (slot.cdText) slot.cdText.destroy();

        // Dark overlay with rounded mask effect (simple circle or rect)
        const cdOverlay = this.scene.add.graphics();
        cdOverlay.fillStyle(0x000000, 0.6);
        cdOverlay.fillRoundedRect(-36, -36, 72, 72, 16);
        slot.container.add(cdOverlay);
        slot.cdOverlay = cdOverlay;

        const cdText = this.scene.add.text(0, 0, Math.ceil(duration / 1000).toString(), {
            fontSize: '28px', fontStyle: 'bold', color: '#ffffff', fontFamily: '"Outfit", sans-serif'
        }).setOrigin(0.5);
        slot.container.add(cdText);
        slot.cdText = cdText;

        let timeLeft = duration;
        slot.cdTimer = this.scene.time.addEvent({
            delay: 100,
            repeat: Math.ceil(duration / 100) + 1,
            callback: () => {
                timeLeft -= 100;
                if (timeLeft <= 0) {
                    if (slot.cdText) slot.cdText.destroy();
                    if (slot.cdOverlay) slot.cdOverlay.destroy();
                    slot.cdText = null;
                    slot.cdOverlay = null;
                    if (slot.cdTimer) slot.cdTimer.remove();
                } else {
                    if (slot.cdText) slot.cdText.setText(Math.ceil(timeLeft / 1000).toString());
                }
            }
        });
    }

    destroy() {
        Object.values(this.slots).forEach(slot => {
            if (slot.cdTimer) slot.cdTimer.remove();
        });
    }
}
