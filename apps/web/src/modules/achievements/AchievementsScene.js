import { Scene, Math as PhaserMath } from 'phaser';
import { UIPanel } from '../../ui/UIPanel';
import { UIButton } from '../../ui/UIButton';
import { COLORS, TEXT_STYLES } from '../../ui/UIConstants';
import { achievementManager } from './AchievementManager';
import { ACHIEVEMENTS } from './achievementsCatalog';
import { REWARDS } from './rewardsCatalog';

export class AchievementsScene extends Scene {
    constructor() {
        super('AchievementsScene');
        this.cardsContainer = null;
        this._wheelHandler = null;
        this._targetY = 0;
    }

    create() {
        this.scene.stop('UIScene');

        const snapshot = achievementManager.getSnapshot();
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        // Overlay
        const overlay = this.add.rectangle(centerX, centerY, width, height, COLORS.OVERLAY, 0).setInteractive();
        this.tweens.add({ targets: overlay, fillAlpha: COLORS.OVERLAY_ALPHA, duration: 200 });

        const isMobile = width < 1080;
        const panelW = Math.min(1260, width - (isMobile ? 20 : 40));
        const panelH = Math.min(900, height - (isMobile ? 16 : 28));

        const closeScene = () => {
            this.tweens.add({
                targets: panel,
                scale: 0.96,
                alpha: 0,
                duration: 180,
                onComplete: () => {
                    this.scene.stop();
                    this.scene.resume('MainMenu');
                }
            });
        };

        const panel = new UIPanel(this, centerX, centerY, panelW, panelH, 'ACHIEVEMENTS', closeScene);
        this.add.existing(panel);
        panel.setDepth(5).setScale(0.95).setAlpha(0);
        this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });

        // Currency display
        this.chipText = this.add.text(centerX + panelW / 2 - 88, centerY - panelH / 2 + 40, `🧠 ${snapshot.brainChips}`, {
            ...TEXT_STYLES.SUBHEADER,
            fontSize: isMobile ? 22 : 26,
            color: '#facc15'
        }).setOrigin(1, 0.5).setDepth(6);

        // Scroll area
        const scrollWidth = panelW - (isMobile ? 36 : 52);
        const scrollHeight = panelH - (isMobile ? 124 : 132);
        const scrollY = centerY + 24;

        const maskShape = this.make.graphics();
        maskShape.fillRect(centerX - scrollWidth / 2, scrollY - scrollHeight / 2, scrollWidth, scrollHeight);

        this.cardsContainer = this.add.container(centerX, scrollY - scrollHeight / 2);
        this.cardsContainer.setMask(maskShape.createGeometryMask());
        this.cardsContainer.setDepth(6);
        this._targetY = this.cardsContainer.y;

        this._wheelHandler = (_, __, ___, deltaY) => {
            const scrollSpeed = 0.8;
            const minY = scrollY - scrollHeight / 2;
            const maxY = minY - (this.maxScroll || 0);
            this._targetY = PhaserMath.Clamp(this._targetY - deltaY * scrollSpeed, maxY, minY);
        };
        this.input.on('wheel', this._wheelHandler);

        this.buildCards(snapshot, scrollWidth, scrollHeight);

        // Back button
        const backBtn = new UIButton(this, centerX - panelW / 2 + 96, centerY - panelH / 2 + 40, 'BACK', closeScene, {
            width: 140,
            height: 50,
            color: COLORS.SECONDARY,
            fontSize: 20
        });
        backBtn.setDepth(6);
    }

    update() {
        if (this.cardsContainer && Math.abs(this.cardsContainer.y - this._targetY) > 0.1) {
            this.cardsContainer.y = PhaserMath.Linear(this.cardsContainer.y, this._targetY, 0.18);
        }
    }

    buildCards(snapshot, scrollWidth, scrollHeight) {
        this.cardsContainer.removeAll(true);
        const progress = snapshot.progress || {};
        const unlocked = snapshot.unlocked || {};
        const owned = snapshot.rewardsOwned || {};
        const active = snapshot.activeCosmetics || {};

        const sorted = [...ACHIEVEMENTS].sort((a, b) => (a.category || '').localeCompare(b.category || ''));

        let yOffset = 16;
        const cardHeight = this.scale.width < 1080 ? 152 : 162;

        sorted.forEach((ach, index) => {
            const card = this.createCard(ach, { progress, unlocked, owned, active }, scrollWidth - 40, cardHeight);
            card.setY(yOffset);
            card.setAlpha(0).setX(80);
            this.tweens.add({ targets: card, alpha: 1, x: 0, duration: 300, delay: index * 25, ease: 'Sine.easeOut' });
            this.cardsContainer.add(card);
            yOffset += cardHeight + 12;
        });

        this.maxScroll = Math.max(0, yOffset - scrollHeight);
    }

    createCard(ach, { progress, unlocked, owned, active }, w, h) {
        const container = this.add.container(0, 0);
        const isMobile = this.scale.width < 1080;
        const bg = this.add.graphics();
        const baseY = 0;
        bg.fillStyle(0x1f2937, 0.9);
        bg.fillRoundedRect(-w / 2, baseY, w, h, 14);
        bg.lineStyle(3, 0x334155, 1);
        bg.strokeRoundedRect(-w / 2, baseY, w, h, 14);
        container.add(bg);

        const reward = REWARDS[ach.rewardId];
        // Fix: achievement is unlocked if explicitly stored, OR if the player already owns the unique reward it grants.
        const ownedReward = reward ? !!owned[ach.rewardId] : false;
        const isUnlocked = !!unlocked[ach.id] || ownedReward;
        
        const hideSecret = ach.secret && !isUnlocked;
        const displayName = hideSecret ? '???' : ach.name;
        const displayDesc = hideSecret ? 'Nhiệm vụ ẩn' : ach.description;

        const title = this.add.text(-w / 2 + 20, baseY + 14, displayName.toUpperCase(), { 
            fontFamily: '"Press Start 2P", monospace', 
            fontSize: isMobile ? 15 : 18,
            color: isUnlocked ? '#34dbcb' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);
        container.add(title);

        const desc = this.add.text(-w / 2 + 20, baseY + 42, displayDesc, { 
            fontFamily: '"Lexend", sans-serif', 
            fontSize: isMobile ? 16 : 18,
            color: '#cbd5e1' 
        }).setOrigin(0, 0).setWordWrapWidth(w - (isMobile ? 230 : 260));
        container.add(desc);

        const rewardLabel = hideSecret ? '???' : (reward ? reward.name : 'Brain Chips');
        const rewardText = this.add.text(-w / 2 + 20, baseY + 70, `Thưởng: ${rewardLabel.toUpperCase()}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: isMobile ? 11 : 12,
            color: '#f1c40f'
        }).setOrigin(0, 0);
        container.add(rewardText);

        const slot = reward ? this._slotForReward(reward.type) : null;
        const isActive = slot && active[slot] === ach.rewardId;

        const meterY = baseY + h - 36;
        this.drawProgress(container, ach, progress, isUnlocked, meterY, w - (isMobile ? 220 : 250));

        const statusText = this.add.text(w / 2 - (isMobile ? 136 : 162), baseY + 18, isUnlocked ? 'MỞ KHOÁ' : 'KHOÁ', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: isMobile ? 10 : 12,
            color: isUnlocked ? '#2ecc71' : '#e74c3c'
        }).setOrigin(1, 0);
        container.add(statusText);

        if (reward && isUnlocked) {
            // Replaced generic UI Button with a modern retro button drawing natively
            const btnBg = this.add.graphics();
            const btnW = isMobile ? 108 : 122;
            const btnH = isMobile ? 36 : 42;
            const btnCol = isActive ? 0x2ecc71 : 0x3498db;
            const btnX = w / 2 - (isMobile ? 128 : 158);
            const btnY = baseY + h - (isMobile ? 48 : 54);
            
            btnBg.fillStyle(0x000000, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
            btnBg.fillStyle(btnCol, 1);
            btnBg.fillRoundedRect(btnX + 2, btnY + 2, btnW - 4, btnH - 4, 3);
            
            const btnText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, ownedReward ? (isActive ? 'ĐANG DÙNG' : 'TRANG BỊ') : 'NHẬN', {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: isMobile ? '9px' : '10px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            const btnHit = this.add.rectangle(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    const success = achievementManager.requestEquipReward(this.scene?.get('Game')?.networkManager ?? null, ach.rewardId);
                    if (success) {
                        statusText.setText('ĐÃ TRANG BỊ');
                        btnText.setText('ĐANG DÙNG');
                        btnBg.clear();
                        btnBg.fillStyle(0x000000, 1);
                        btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
                        btnBg.fillStyle(0x2ecc71, 1);
                        btnBg.fillRoundedRect(btnX + 2, btnY + 2, btnW - 4, btnH - 4, 3);
                    }
                });

            container.add([btnBg, btnText, btnHit]);
        } else if (!reward) {
            // Chips reward placeholder
            const chipLabel = this.add.text(w / 2 - 90, baseY + h - 32, '+ Brain Chips', { ...TEXT_STYLES.BODY, fontSize: 14, color: '#facc15' }).setOrigin(1, 0.5);
            container.add(chipLabel);
        }

        return container;
    }

    drawProgress(container, ach, progress, isUnlocked, y, width) {
        const gfx = this.add.graphics();
        
        // Background track track
        gfx.fillStyle(0x0f172a, 1);
        gfx.fillRoundedRect(-width / 2, y, width, 18, 5);
        gfx.lineStyle(2, 0x334155, 1);
        gfx.strokeRoundedRect(-width / 2, y, width, 18, 5);

        let pct = 0;
        let labelStr = '';

        if (isUnlocked) {
            pct = 1;
            labelStr = ach.target ? `${ach.target}/${ach.target}` : '100%';
            
            // Neon Green Fill
            gfx.fillStyle(0x2ecc71, 1);
            gfx.fillRoundedRect(-width / 2 + 2, y + 2, (width - 4) * pct, 14, 4);
            
            // Glow
            gfx.lineStyle(2, 0x2ecc71, 0.5);
            gfx.strokeRoundedRect(-width / 2, y, width, 18, 5);
        } else {
            const current = this._progressValue(ach, progress);
            if (ach.type === 'rank') {
                pct = current ? PhaserMath.Clamp(ach.target / current, 0, 1) : 0;
            } else if (ach.target) {
                pct = PhaserMath.Clamp(current / ach.target, 0, 1);
            }
            labelStr = ach.target ? `${current}/${ach.target}` : `${Math.round(pct * 100)}%`;
            
            // Neon Cyan Fill
            gfx.fillStyle(0x34dbcb, 1);
            if (pct > 0) {
                gfx.fillRoundedRect(-width / 2 + 2, y + 2, (width - 4) * pct, 14, 4);
            }
        }
        
        const label = this.add.text(-width / 2, y - 8, labelStr, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: isUnlocked ? '#2ecc71' : '#e2e8f0'
        }).setOrigin(0, 1);
        
        container.add([gfx, label]);
    }

    _progressValue(ach, progress) {
        const metric = ach.metric;
        if (progress[metric] !== undefined && typeof progress[metric] === 'number') {
            return progress[metric];
        }
        if (metric === 'uniqueTopics') return (progress.uniqueTopics || []).length;
        if (metric === 'uniqueSubjects') return (progress.uniqueSubjects || []).length;
        if (metric === 'bestRank') {
            const val = progress.bestRank;
            if (!val || val >= 9000) return 0;
            return val;
        }
        return 0;
    }

    _slotForReward(type) {
        switch (type) {
            case 'skin': return 'skin';
            case 'trail': return 'trail';
            case 'glow': return 'glow';
            case 'aura': return 'aura';
            case 'headFx': return 'headFx';
            case 'title': return 'title';
            case 'spawnFx': return 'spawnFx';
            case 'deathFx': return 'deathFx';
            case 'theme': return 'theme';
            case 'decal': return 'decal';
            case 'shimmer': return 'shimmer';
            default: return null;
        }
    }

    _onShutdown() {
        if (this.input && this._wheelHandler) {
            this.input.off('wheel', this._wheelHandler);
        }
    }
}
