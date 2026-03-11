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

        const panelW = Math.min(1100, width - 80);
        const panelH = Math.min(780, height - 60);

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
        this.chipText = this.add.text(centerX + panelW / 2 - 120, centerY - panelH / 2 + 36, `🧠 ${snapshot.brainChips}`, {
            ...TEXT_STYLES.SUBHEADER,
            fontSize: 24,
            color: '#facc15'
        }).setOrigin(1, 0.5).setDepth(6);

        // Scroll area
        const scrollWidth = panelW - 80;
        const scrollHeight = panelH - 140;
        const scrollY = centerY + 20;

        const maskShape = this.make.graphics();
        maskShape.fillRect(centerX - scrollWidth / 2, scrollY - scrollHeight / 2, scrollWidth, scrollHeight);

        this.cardsContainer = this.add.container(centerX, scrollY - scrollHeight / 2);
        this.cardsContainer.setMask(maskShape.createGeometryMask());
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
        const backBtn = new UIButton(this, centerX - panelW / 2 + 80, centerY - panelH / 2 + 36, 'BACK', closeScene, {
            width: 120,
            height: 44,
            color: COLORS.SECONDARY,
            fontSize: 18
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

        let yOffset = 20;
        const cardHeight = 140;

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
        const bg = this.add.graphics();
        const baseY = 0;
        bg.fillStyle(0x1f2937, 0.9);
        bg.fillRoundedRect(-w / 2, baseY, w, h, 14);
        bg.lineStyle(3, 0x334155, 1);
        bg.strokeRoundedRect(-w / 2, baseY, w, h, 14);
        container.add(bg);

        const isUnlocked = !!unlocked[ach.id];
        const hideSecret = ach.secret && !isUnlocked;
        const displayName = hideSecret ? '???' : ach.name;
        const displayDesc = hideSecret ? 'Hidden objective' : ach.description;

        const title = this.add.text(-w / 2 + 14, baseY + 10, displayName, { ...TEXT_STYLES.SUBHEADER, fontSize: 22 }).setOrigin(0, 0);
        container.add(title);

        const desc = this.add.text(-w / 2 + 14, baseY + 44, displayDesc, { ...TEXT_STYLES.BODY, fontSize: 16, color: '#cbd5e1' })
            .setOrigin(0, 0)
            .setWordWrapWidth(w - 28);
        container.add(desc);

        const reward = REWARDS[ach.rewardId];
        const rewardLabel = hideSecret ? '???' : (reward ? reward.name : 'Brain Chips');
        const rewardText = this.add.text(-w / 2 + 14, baseY + 72, `Reward: ${rewardLabel}`, {
            ...TEXT_STYLES.BODY,
            fontSize: 15,
            color: '#fef3c7'
        }).setOrigin(0, 0);
        container.add(rewardText);

        const ownedReward = reward ? owned[ach.rewardId] : false;
        const slot = reward ? this._slotForReward(reward.type) : null;
        const isActive = slot && active[slot] === ach.rewardId;

        const meterY = baseY + h - 34;
        this.drawProgress(container, ach, progress, isUnlocked, meterY, w - 160);

        const statusText = this.add.text(w / 2 - 150, baseY + 16, isUnlocked ? 'Unlocked' : 'Locked', {
            ...TEXT_STYLES.BODY,
            fontSize: 16,
            color: isUnlocked ? '#10b981' : '#94a3b8'
        }).setOrigin(1, 0);
        container.add(statusText);

        if (reward && isUnlocked) {
            const btn = new UIButton(this, w / 2 - 90, baseY + h - 34, ownedReward ? (isActive ? 'EQUIPPED' : 'EQUIP') : 'CLAIM', () => {
                const success = achievementManager.equipReward(ach.rewardId);
                if (success) {
                    statusText.setText('Equipped');
                    btn.label.setText('EQUIPPED');
                }
            }, {
                width: 120,
                height: 40,
                color: isActive ? COLORS.ACCENT : COLORS.PRIMARY,
                fontSize: 16
            });
            container.add(btn);
        } else if (!reward) {
            // Chips reward placeholder
            const chipLabel = this.add.text(w / 2 - 90, baseY + h - 32, '+ Brain Chips', { ...TEXT_STYLES.BODY, fontSize: 14, color: '#facc15' }).setOrigin(1, 0.5);
            container.add(chipLabel);
        }

        return container;
    }

    drawProgress(container, ach, progress, isUnlocked, y, width) {
        const gfx = this.add.graphics();
        gfx.lineStyle(2, 0x475569, 1);
        gfx.strokeRoundedRect(-width / 2, y, width, 16, 6);

        if (isUnlocked) {
            gfx.fillStyle(0x22c55e, 1);
            gfx.fillRoundedRect(-width / 2, y, width, 16, 6);
        } else {
            const current = this._progressValue(ach, progress);
            let pct = 0;
            if (ach.type === 'rank') {
                pct = current ? PhaserMath.Clamp(ach.target / current, 0, 1) : 0;
            } else if (ach.target) {
                pct = PhaserMath.Clamp(current / ach.target, 0, 1);
            }
            gfx.fillStyle(0x38bdf8, 1);
            gfx.fillRoundedRect(-width / 2, y, width * pct, 16, 6);
            const label = this.add.text(-width / 2, y - 6, ach.target ? `${current}/${ach.target}` : `${Math.round(pct * 100)}%`, {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#e2e8f0'
            }).setOrigin(0, 1);
            container.add(label);
        }

        container.add(gfx);
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
