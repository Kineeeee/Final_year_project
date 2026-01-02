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

        // Fix for rapid updates: Kill ongoing tweens and reset scale
        this.tweens.killTweensOf(this.coinText);
        this.coinText.setScale(1);

        // Pop animation
        this.tweens.add({
            targets: this.coinText,
            scale: 1.2, // Reduced from 1.5 to be less jarring with rapid updates
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    createItemSlots(x, y) {
        const itemIds = [ITEMS.SPEED_UP.id, ITEMS.MAGNET.id, ITEMS.GHOST.id];
        // 1.2x Up-scaling
        const gap = 96; // 80 * 1.2
        let startX = x - gap;

        itemIds.forEach((id, index) => {
            const slotX = startX + (index * gap);

            // Container for slot
            const container = this.add.container(slotX, y);

            // Background (60 * 1.2 = 72)
            const bg = this.add.rectangle(0, 0, 72, 72, 0x000000, 0.5).setStrokeStyle(2, 0xffffff);
            container.add(bg);

            // Icon (40 * 1.2 = 48)
            let icon;
            if (this.textures.exists(id)) {
                icon = this.add.image(0, 0, id);
                const scale = 48 / Math.max(icon.width, icon.height);
                icon.setScale(scale);
            } else {
                const color = Object.values(ITEMS).find(i => i.id === id).iconColor;
                icon = this.add.rectangle(0, 0, 48, 48, color);
            }
            container.add(icon);

            // Key Hint (Desktop)
            if (this.sys.game.device.os.desktop) {
                const hint = this.add.text(-30, -30, `${index + 1}`, {
                    fontSize: '14px', fill: '#fff', backgroundColor: '#000000'
                }).setPadding(2);
                container.add(hint);
            }

            // Quantity Text (Circle Badge)
            const badge = this.add.circle(24, 24, 14, 0xff0000); // Scaled positions
            container.add(badge);

            let initialQty = 0;
            try {
                const savedInv = JSON.parse(localStorage.getItem('inventory'));
                if (savedInv && savedInv[id]) initialQty = savedInv[id];
            } catch (e) { }

            const qtyText = this.add.text(24, 24, initialQty.toString(), {
                fontSize: '16px', fill: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(qtyText);

            // Click Handler
            const zone = this.add.zone(0, 0, 72, 72).setInteractive();
            zone.on('pointerdown', () => {
                this.scene.get('Game').useItem(id);
                // Click anim
                this.tweens.add({
                    targets: container,
                    scale: 0.9,
                    duration: 50,
                    yoyo: true
                });
            });
            container.add(zone);

            // Store ref
            this.itemSlots[id] = { qtyText, container, icon };
        });
    }

    updateInventory(inventory) {
        // Inventory is object: { speed: 5, magnet: 2 }
        Object.keys(this.itemSlots).forEach(id => {
            const count = inventory[id] || 0;
            this.itemSlots[id].qtyText.setText(count.toString());

            // Pop badge
            this.tweens.add({
                targets: this.itemSlots[id].qtyText.parentContainer, // scale the whole container slightly? No, just the text maybe
                // Actually let's scale the badge text or container
                scale: 1.1,
                duration: 100,
                yoyo: true
            });
        });
    }

    onItemActivated(data) {
        // data: { itemId, duration, buffValue, cooldown }
        const slot = this.itemSlots[data.itemId];
        if (slot) {
            // 1. ACTIVE DURATION DISPLAY (Square bar)
            // User requested: "Square like background and under icon"
            // We'll create a filled square behind the icon that acts as a timer.

            // Remove old overlays if any
            if (slot.activeBar) slot.activeBar.destroy();

            const barSize = 72;
            const bar = this.add.graphics();
            slot.container.add(bar);
            slot.container.moveBelow(bar, slot.icon);

            slot.activeBar = bar;

            // Tween for Duration
            this.tweens.addCounter({
                from: 1,
                to: 0,
                duration: data.duration,
                onUpdate: (tween) => {
                    if (!slot.container.scene) return;
                    const t = tween.getValue();
                    bar.clear();
                    bar.fillStyle(0x00ffff, 0.8); // Cyan tint, clearer vs black
                    const h = barSize * t;
                    bar.fillRect(-36, 36 - h, 72, h);
                },
                onComplete: () => {
                    if (slot.activeBar) slot.activeBar.destroy();
                    slot.activeBar = null;

                    // 2. COOLDOWN DISPLAY (Triggered AFTER duration)
                    // Cooldown starts AFTER effect ends.
                    const remainingCooldown = data.cooldown || 0;

                    if (remainingCooldown > 0) {
                        // Overlay
                        if (slot.cdOverlay) slot.cdOverlay.destroy();
                        if (slot.cdText) slot.cdText.destroy();

                        const cdOverlay = this.add.rectangle(0, 0, 72, 72, 0x000000, 0.7);
                        slot.container.add(cdOverlay);
                        slot.cdOverlay = cdOverlay;

                        const cdText = this.add.text(0, 0, Math.ceil(remainingCooldown / 1000).toString(), {
                            fontSize: '24px', fontStyle: 'bold', color: '#ffffff'
                        }).setOrigin(0.5);
                        slot.container.add(cdText);
                        slot.cdText = cdText;

                        // Timer Event to update text
                        let timeLeft = remainingCooldown;
                        const timer = this.time.addEvent({
                            delay: 100,
                            repeat: Math.ceil(remainingCooldown / 100) + 1,
                            callback: () => {
                                timeLeft -= 100;
                                if (timeLeft <= 0) {
                                    if (slot.cdText) slot.cdText.destroy();
                                    if (slot.cdOverlay) slot.cdOverlay.destroy();
                                    slot.cdText = null;
                                    slot.cdOverlay = null;
                                    timer.remove();
                                } else {
                                    if (slot.cdText) slot.cdText.setText(Math.ceil(timeLeft / 1000).toString());
                                }
                            }
                        });
                    }
                }
            });
        }
    }
}
