import Phaser from 'phaser';
import { achievementManager } from '../modules/achievements/AchievementManager';
import { REWARDS, ensureSkinTextureForScene } from '../modules/achievements/rewardsCatalog';

export class RewardsInventoryModal extends Phaser.GameObjects.Container {
    constructor(scene, x, y, options = {}) {
        super(scene, x, y);
        this.scene = scene;
        this.onClose = options.onClose;
        
        const { width, height } = scene.scale;
        const isMobile = width < 980;
        const uiScale = Math.min(1.35, Math.max(1.0, Math.min(width / 1280, height / 900)));
        this.isMobile = isMobile;
        this.uiScale = uiScale;
        
        // Background overlay
        this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
        this.bg.setInteractive();
        this.add(this.bg);
        this.bg.setPosition(-x, -y);
        
        const panelW = Math.min(1200, width * (isMobile ? 0.99 : 0.97));
        const panelH = Math.min(980, height * 0.98);

        this.bg.on('pointerdown', (pointer) => {
            const insidePanel =
                pointer.x >= x - panelW / 2 &&
                pointer.x <= x + panelW / 2 &&
                pointer.y >= y - panelH / 2 &&
                pointer.y <= y + panelH / 2;
            if (insidePanel) return;
            this.close();
        });
        
        this.panelBg = scene.add.graphics();
        // Cyber panel background
        this.panelBg.fillStyle(0x000000, 0.7);
        this.panelBg.fillRoundedRect(-panelW/2 + 8, -panelH/2 + 8, panelW, panelH, 16);
        this.panelBg.fillStyle(0x0f172a, 1);
        this.panelBg.fillRoundedRect(-panelW/2, -panelH/2, panelW, panelH, 16);
        // Cyber glowing border
        this.panelBg.lineStyle(4, 0x34dbcb, 1);
        this.panelBg.strokeRoundedRect(-panelW/2, -panelH/2, panelW, panelH, 16);
        this.add(this.panelBg);

        const titleFontPx = Math.min(46, Math.round(38 * uiScale));
        this.title = scene.add.text(0, -panelH/2 + 35, 'KHO ĐỒ & PHẦN THƯỞNG', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${titleFontPx}px`,
            color: '#34dbcb',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        this.add(this.title);

        this.closeBtn = scene.add.text(panelW/2 - 25, -panelH/2 + 25, '✖', {
            fontFamily: 'Arial',
            fontSize: isMobile ? '34px' : '38px',
            color: '#e74c3c'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.closeBtn.on('pointerdown', () => {
            this.scene.tweens.add({ targets: this.closeBtn, scale: 0.8, yoyo: true, duration: 80 });
            this.close();
        });
        this.add(this.closeBtn);

        // Current Category State
        this.currentTab = 'skin'; 
        this.tabs = [
            { id: 'skin', name: 'SKINS' },
            { id: 'trail', name: 'HIỆU ỨNG' },
            { id: 'theme', name: 'SÂN ĐẤU' },
        ];

        // Setup Scrolling Area
        const scrollWidth = panelW - 24;
        const scrollHeight = panelH - 232;
        const maskY = -panelH/2 + 184; // Start Y of scroll area
        
        const maskShape = scene.make.graphics();
        maskShape.fillRect(scene.scale.width/2 - scrollWidth/2, scene.scale.height/2 + maskY, scrollWidth, scrollHeight);
        
        this.scrollContainer = scene.add.container(0, 0);
        this.scrollContainer.setMask(maskShape.createGeometryMask());
        this.add(this.scrollContainer);

        this._targetY = 0;
        this.maxScroll = 0;
        this._wheelHandler = (_, __, ___, deltaY) => {
            const scrollSpeed = 0.8;
            this._targetY = Phaser.Math.Clamp(this._targetY - deltaY * scrollSpeed, -this.maxScroll, 0);
        };
        scene.input.on('wheel', this._wheelHandler);

        // Required to animate scroll
        scene.events.on('update', this.updateScroll, this);

        this.tabTexts = [];
        this.renderTabs(panelW, panelH);
        this.renderContent(panelW, panelH);

        // Listen for server sync updates
        this.onCosmeticsUpdated = () => {
            if (!this.scene) return;
            this.renderTabs(panelW, panelH);
            this.renderContent(panelW, panelH);
            
            // Show toast popup
            this.scene.events.emit('showToast', {
                message: 'Đã lưu thay đổi!',
                color: '#34dbcb'
            });
        };
        this.scene.events.on('cosmetics:updated', this.onCosmeticsUpdated);

        scene.add.existing(this);
        this.setDepth(200);

        this.setScale(0.8);
        scene.tweens.add({ targets: this, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }

    renderTabs(panelW, panelH) {
        const uiScale = this.uiScale || 1;
        this.tabTexts.forEach(t => t.destroy());
        this.tabTexts = [];

        const tabWidth = Math.max(190, Math.floor((panelW - 140) / this.tabs.length));
        const totalTabsWidth = this.tabs.length * tabWidth;
        const startX = -totalTabsWidth / 2 + tabWidth / 2;
        const yPos = -panelH/2 + 132;

        // Custom tab background rail
        const rail = this.scene.add.graphics();
        rail.fillStyle(0x000000, 0.4);
        rail.fillRoundedRect(-totalTabsWidth/2, yPos - 20, totalTabsWidth, 40, 6);
        this.tabTexts.push(rail);
        this.add(rail);

        const tabFontPx = Math.min(28, Math.round(22 * uiScale));
        this.tabs.forEach((tab, index) => {
            const xPos = startX + (index * tabWidth);
            const isSelected = this.currentTab === tab.id;
            
            const color = isSelected ? '#34dbcb' : '#94a3b8';
            
            const txt = this.scene.add.text(xPos, yPos, tab.name, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: `${tabFontPx}px`,
                color: color
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            txt.on('pointerdown', () => {
                this.scene.tweens.add({ targets: txt, scale: 0.9, yoyo: true, duration: 60 });
                if (this.currentTab !== tab.id) {
                    this.currentTab = tab.id;
                    this.renderTabs(panelW, panelH);
                    this.renderContent(panelW, panelH);
                }
            });

            if (isSelected) {
                const underline = this.scene.add.rectangle(xPos, yPos + 18, tabWidth - 20, 2, 0x34dbcb);
                this.tabTexts.push(underline);
                this.add(underline);
            }

            this.tabTexts.push(txt);
            this.add(txt);
        });
    }

    renderContent(panelW, panelH) {
        const uiScale = this.uiScale || 1;
        this.scrollContainer.removeAll(true);
        
        const snap = achievementManager.getSnapshot();
        const owned = snap.rewardsOwned || {};
        const active = snap.activeCosmetics || {};

        // Filter rewards by category type mapped to tab
        let items = Object.values(REWARDS).filter(r => {
            if (this.currentTab === 'trail') return ['trail', 'glow', 'aura', 'spawnFx', 'deathFx', 'shimmer'].includes(r.type);
            return r.type === this.currentTab;
        });

        // Reset scroll when rendering new content
        this._targetY = 0;
        this.scrollContainer.y = 0;

        const startY = -panelH/2 + 222;
        const itemHeight = panelW < 760 ? 118 : 132;
        const nameFontPx = Math.min(30, Math.round((panelW < 760 ? 18 : 22) * uiScale));
        const rarityFontPx = Math.min(24, Math.round((panelW < 760 ? 14 : 18) * uiScale));
        const actionFontPx = Math.min(22, Math.round((panelW < 760 ? 12 : 16) * uiScale));

        items.forEach((item, index) => {
            const y = startY + (index * itemHeight);
            const isOwned = owned[item.id] || item.isDefault;
            
            const slot = achievementManager._slotForReward(item.type) || item.type;
            let isEquipped = active[slot] === item.id;
            
            // If it's a default item and nothing else is equipped in that slot, consider it equipped
            if (item.isDefault && (!active[slot] || active[slot] === item.id)) {
                isEquipped = true;
            }

            const rowBg = this.scene.add.graphics();
            rowBg.fillStyle(0x1e293b, isOwned ? 0.8 : 0.4);
            rowBg.fillRoundedRect(-panelW/2 + 20, y - itemHeight/2 + 2, panelW - 40, itemHeight - 4, 8);
            if (isEquipped) {
                rowBg.lineStyle(2, 0x34dbcb, 1);
                rowBg.strokeRoundedRect(-panelW/2 + 20, y - itemHeight/2 + 2, panelW - 40, itemHeight - 4, 8);
            }
            this.scrollContainer.add(rowBg);

            // Icon Placeholder
            const iconX = -panelW/2 + 86;
            const iconBg = this.scene.add.circle(iconX, y, panelW < 760 ? 32 : 40, 0x000000);
            iconBg.setStrokeStyle(2, isOwned ? 0x475569 : 0x111111);
            if (!isOwned) iconBg.setAlpha(0.3);
            this.scrollContainer.add(iconBg);

            let iconImage = null;
            if (item.type === 'skin') {
                const skinTexture = ensureSkinTextureForScene(this.scene, item);
                const textureKey = (skinTexture && this.scene.textures.exists(skinTexture)) ? skinTexture : 'snake-circle';
                iconImage = this.scene.add.image(iconX, y, textureKey);
                if (textureKey === 'snake-circle' && item.tint !== undefined) {
                    iconImage.setTint(item.tint);
                }
                iconImage.setDisplaySize(panelW < 760 ? 48 : 60, panelW < 760 ? 48 : 60);
            } else if (item.texture || item.bgTexture) {
                iconImage = this.scene.add.image(iconX, y, item.texture || item.bgTexture);
                iconImage.setDisplaySize(panelW < 760 ? 48 : 60, panelW < 760 ? 48 : 60);
            } else if (item.tint !== undefined) {
                iconImage = this.scene.add.image(iconX, y, 'snake-circle');
                iconImage.setTint(item.tint);
                iconImage.setDisplaySize(panelW < 760 ? 48 : 60, panelW < 760 ? 48 : 60);
            } else if (item.color !== undefined) {
                iconImage = this.scene.add.circle(iconX, y, panelW < 760 ? 16 : 20, item.color);
            }
            
            if (iconImage) {
                if (!isOwned) iconImage.setAlpha(0.3);
                this.scrollContainer.add(iconImage);
            }

            // Name
            const nameColor = isOwned ? '#ffffff' : '#64748b';
            const nameTxt = this.scene.add.text(-panelW/2 + 146, y - 16, item.name.toUpperCase(), {
                fontFamily: '"Press Start 2P", monospace', fontSize: `${nameFontPx}px`, color: nameColor
            }).setOrigin(0, 0.5);
            this.scrollContainer.add(nameTxt);

            // Rarity
            const rarityTxt = this.scene.add.text(-panelW/2 + 146, y + 22, item.rarity.toUpperCase(), {
                fontFamily: '"Press Start 2P", monospace', fontSize: `${rarityFontPx}px`, color: isOwned ? this.getRarityColor(item.rarity) : '#475569'
            }).setOrigin(0, 0.5);
            this.scrollContainer.add(rarityTxt);

            if (isOwned) {
                const btnW = panelW < 760 ? 150 : 190;
                const btnH = panelW < 760 ? 52 : 60;
                const btnX = panelW/2 - (panelW < 760 ? 118 : 148);
                
                // Set graphics position to the button's center so scaling works correctly
                const btnBg = this.scene.add.graphics();
                btnBg.setPosition(btnX, y);
                btnBg.fillStyle(0x000000, 1);
                btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 4);
                btnBg.fillStyle(isEquipped ? 0x242d42 : 0x3498db, 1); // Dark blue if equipped
                btnBg.fillRoundedRect(-btnW/2 + 2, -btnH/2 + 2, btnW - 4, btnH - 4, 3);
                if (isEquipped) {
                    btnBg.lineStyle(2, 0xe74c3c, 1);
                    btnBg.strokeRoundedRect(-btnW/2 + 2, -btnH/2 + 2, btnW - 4, btnH - 4, 3);
                }

                const btnTxt = this.scene.add.text(btnX, y, isEquipped ? 'BỎ TRANG BỊ' : 'TRANG BỊ', {
                    fontFamily: '"Press Start 2P", monospace', fontSize: `${actionFontPx}px`, color: isEquipped ? '#e74c3c' : '#ffffff'
                }).setOrigin(0.5);
                
                const btnHit = this.scene.add.rectangle(btnX, y, btnW, btnH, 0x000000, 0)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        this.scene.tweens.add({ targets: [btnBg, btnTxt], scale: 0.95, yoyo: true, duration: 60 });
                        if (isEquipped) {
                            this.handleUnequip(slot);
                        } else {
                            this.handleEquip(item.id);
                        }
                        // Visual fake update until server syncs
                        this.scene.time.delayedCall(100, () => {
                            if (this.scene) this.renderContent(panelW, panelH);
                        });
                    });
                
                this.scrollContainer.add(btnHit);
                this.scrollContainer.add([btnBg, btnTxt]);
            } else {
                const lockedBg = this.scene.add.graphics();
                lockedBg.fillStyle(0x000000, 0.5);
                const lockW = panelW < 760 ? 120 : 150;
                const lockH = panelW < 760 ? 36 : 44;
                const lockX = panelW/2 - (panelW < 760 ? 142 : 170);
                lockedBg.fillRoundedRect(lockX, y - lockH / 2, lockW, lockH, 4);
                
                const lockedTxt = this.scene.add.text(lockX + lockW / 2, y, 'KHOÁ', {
                    fontFamily: '"Press Start 2P", monospace', fontSize: `${actionFontPx}px`, color: '#e74c3c'
                }).setOrigin(0.5);
                this.scrollContainer.add([lockedBg, lockedTxt]);
            }
        });

        // Calculate max scroll depth based on total items height vs mask height
        const totalHeight = items.length * itemHeight;
        const maskHeight = panelH - 232;
        this.maxScroll = Math.max(0, totalHeight - maskHeight + 40); // 40px padding bottom
    }

    updateScroll() {
        if (this.scrollContainer && Math.abs(this.scrollContainer.y - this._targetY) > 0.1) {
            this.scrollContainer.y = Phaser.Math.Linear(this.scrollContainer.y, this._targetY, 0.2);
        }
    }

    getRarityColor(rarity) {
        switch(rarity) {
            case 'bronze': return '#cd7f32';
            case 'silver': return '#bdc3c7';
            case 'gold': return '#f1c40f';
            case 'diamond': return '#00d2ff';
            case 'mythic': return '#9b59b6';
            default: return '#ffffff';
        }
    }

    handleEquip(rewardId) {
        achievementManager.requestEquipReward(this.scene.networkManager ?? null, rewardId);
    }

    handleUnequip(category) {
        achievementManager.requestUnequipReward(this.scene.networkManager ?? null, category);
    }

    close() {
        this.scene.input.off('wheel', this._wheelHandler);
        this.scene.events.off('update', this.updateScroll, this);
        this.scene.tweens.add({
            targets: this,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                if (this.onCosmeticsUpdated) {
                    this.scene.events.off('cosmetics:updated', this.onCosmeticsUpdated);
                }
                if (this.onClose) this.onClose();
                this.destroy();
            }
        });
    }
}
