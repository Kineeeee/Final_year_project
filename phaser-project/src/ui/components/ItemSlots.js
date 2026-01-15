import { ITEMS } from '../../config/items.js';

export class ItemSlots {
    constructor(scene, mode = 'normal') {
        this.scene = scene;
        this.mode = mode;

        // Define available slots based on mode
        // Define available slots based on mode
        // Any non-normal mode (quiz, math, english) gets limited items
        if (this.mode !== 'normal') {
            this.slotKeys = ['speed', 'ghost'];
        } else {
            this.slotKeys = ['speed', 'magnet', 'ghost'];
        }

        this.slots = {};

        this.createElements();
    }

    createElements() {
        // Map keys to ITEMS IDs
        // speed -> SPEED_UP
        // magnet -> MAGNET
        // ghost -> GHOST
        const keyMap = {
            'speed': 'SPEED_UP',
            'magnet': 'MAGNET',
            'ghost': 'GHOST'
        };

        const itemIds = this.slotKeys.map(key => {
            const itemKey = keyMap[key] || key.toUpperCase();
            return ITEMS[itemKey] ? ITEMS[itemKey].id : null;
        }).filter(id => id !== null);

        // Create container for all slots to manage centering easily
        this.container = this.scene.add.container(0, 0);

        itemIds.forEach((id, index) => {
            // Individual Slot Container
            const slotContainer = this.scene.add.container(0, 0);

            // Background
            const bg = this.scene.add.rectangle(0, 0, 72, 72, 0x000000, 0.5).setStrokeStyle(2, 0xffffff);
            slotContainer.add(bg);

            // Icon
            let icon;
            if (this.scene.textures.exists(id)) {
                icon = this.scene.add.image(0, 0, id);
                // Scale to fit 48x48 box
                const scale = 48 / Math.max(icon.width, icon.height);
                icon.setScale(scale);
            } else {
                const color = Object.values(ITEMS).find(i => i.id === id).iconColor;
                icon = this.scene.add.rectangle(0, 0, 48, 48, color);
            }
            slotContainer.add(icon);

            // Key Hint (Desktop only)
            if (this.scene.sys.game.device.os.desktop) {
                const hint = this.scene.add.text(-30, -30, `${index + 1}`, {
                    fontSize: '14px', fill: '#fff', backgroundColor: '#000000'
                }).setPadding(2);
                slotContainer.add(hint);
            }

            // Badge (Quantity)
            const badge = this.scene.add.circle(24, 24, 14, 0xff0000);
            slotContainer.add(badge);

            let initialQty = 0;
            // Try load initial (though Game scene syncs this too)
            try {
                const saved = JSON.parse(localStorage.getItem('inventory'));
                if (saved && saved[id]) initialQty = saved[id];
            } catch (e) { }

            const qtyText = this.scene.add.text(24, 24, initialQty.toString(), {
                fontSize: '16px', fill: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);
            slotContainer.add(qtyText);

            // Interaction
            const zone = this.scene.add.zone(0, 0, 72, 72).setInteractive();
            zone.on('pointerdown', () => {
                this.scene.scene.get('Game').useItem(id);
                this.scene.tweens.add({
                    targets: slotContainer,
                    scale: 0.9, duration: 50, yoyo: true
                });
            });
            slotContainer.add(zone);

            // Store Reference
            this.slots[id] = {
                container: slotContainer,
                qtyText,
                icon,
                activeBar: null,
                cdOverlay: null,
                cdTimer: null
            };

            // Add to Main Container
            // StartX will be calculated in resize
            this.container.add(slotContainer);
        });
    }

    resize(safeArea) {
        // Position: Top Center (below HUD) or Bottom Center?
        // Original was safeMargin + 80 (Top).
        // Let's put it Top Center, below Quiz Question/Timer?
        // Or Top Center, but if Quiz is active, Quiz pushes it down?
        // Safer: Put it Bottom Center for consistency, but Mobile has controls there.
        // Let's stick to Top Center, below the "Safe Top".

        // 3 slots, gap 96px
        const gap = 96;
        const totalWidth = gap * 2; // (0, 1, 2) * gap? index 0 is -gap, 1 is 0, 2 is +gap?

        // We want them centered.
        // Index 0: -96
        // Index 1: 0
        // Index 2: 96

        const slotIds = Object.keys(this.slots);
        const startX = -((slotIds.length - 1) * gap) / 2;

        this.container.setDepth(100);
        // Move UP to avoid Quiz UI (Swap positions)
        // Position at top + 80 (Original position)
        this.container.setPosition(safeArea.centerX, safeArea.top + 80);

        slotIds.forEach((id, index) => {
            const slot = this.slots[id];
            slot.container.setPosition(startX + (index * gap), 0);
        });
    }

    updateInventory(inventory) {
        Object.keys(this.slots).forEach(id => {
            const count = inventory[id] || 0;
            this.slots[id].qtyText.setText(count.toString());
            // Pop effect
            this.scene.tweens.add({
                targets: this.slots[id].qtyText.parentContainer, // Works if text is in container?
                // Actually target the badge or text
                scale: 1.1, duration: 100, yoyo: true
            });
        });
    }

    onItemActivated(data) {
        // data: { itemId, duration, buffValue, cooldown }
        const slot = this.slots[data.itemId];
        if (slot) {
            // 1. ACTIVE DURATION DISPLAY
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
                    bar.fillStyle(0x00ffff, 0.8);
                    const h = barSize * t;
                    bar.fillRect(-36, 36 - h, 72, h);
                },
                onComplete: () => {
                    if (slot.activeBar) slot.activeBar.destroy();
                    slot.activeBar = null;

                    // 2. COOLDOWN DISPLAY
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

        const cdOverlay = this.scene.add.rectangle(0, 0, 72, 72, 0x000000, 0.7);
        slot.container.add(cdOverlay);
        slot.cdOverlay = cdOverlay;

        const cdText = this.scene.add.text(0, 0, Math.ceil(duration / 1000).toString(), {
            fontSize: '24px', fontStyle: 'bold', color: '#ffffff'
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
