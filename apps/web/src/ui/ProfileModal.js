import { achievementManager } from '../modules/achievements/AchievementManager';
import { playerState } from '../core/services/PlayerState';

export class ProfileModal extends Phaser.GameObjects.Container {
    constructor(scene, x, y, options = {}) {
        super(scene, x, y);
        this.scene = scene;
        this.onClose = options.onClose;
        
        const { width, height } = scene.scale;
        const isMobile = width < 980;
        const uiScale = Math.min(1.2, Math.max(0.9, Math.min(width / 1280, height / 900)));
        
        // Background overlay
        this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
        this.bg.setInteractive();
        this.add(this.bg);
        this.bg.setPosition(-x, -y);
        
        const panelW = Math.min(980, width * (isMobile ? 0.98 : 0.95));
        const panelH = Math.min(820, height * 0.95);

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

        const username = playerState.getUsername ? playerState.getUsername() : 'Guest';
        const titleFontPx = Math.min(40, Math.round(34 * uiScale));
        this.title = scene.add.text(0, -panelH/2 + 35, `HỒ SƠ: ${username.toUpperCase()}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${titleFontPx}px`,
            color: '#34dbcb',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        this.add(this.title);

        this.closeBtn = scene.add.text(panelW/2 - 25, -panelH/2 + 25, '✖', {
            fontFamily: 'Arial',
            fontSize: isMobile ? '28px' : '34px',
            color: '#e74c3c'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.closeBtn.on('pointerdown', () => {
            this.scene.tweens.add({ targets: this.closeBtn, scale: 0.8, yoyo: true, duration: 80 });
            this.close();
        });
        this.add(this.closeBtn);

        // Fetch Stats
        const snap = achievementManager.getSnapshot();
        const p = snap.progress || {};

        const totalAnswers = (p.totalCorrect || 0) + (p.totalWrong || 0);
        const winRate = totalAnswers > 0 ? Math.round(((p.totalCorrect || 0) / totalAnswers) * 100) : 0;
        
        const statsData = [
            { icon: '🎮', label: 'Số Trận Chơi', value: p.matchesPlayed || 0, color: '#34dbcb' },
            { icon: '🏆', label: 'Hạng Cao Nhất', value: (p.bestRank && p.bestRank <= 100) ? `#${p.bestRank}` : 'N/A', color: '#f1c40f' },
            { icon: '🔥', label: 'Chuỗi Tốt Nhất', value: `${p.bestStreak || 0}`, color: '#e74c3c' },
            { icon: '🎯', label: 'Chính Xác', value: `${winRate}%`, color: '#2ecc71' },
            { icon: '➕', label: 'Điểm Toán', value: p.mathCorrect || 0, color: '#9b59b6' },
            { icon: '🔠', label: 'Điểm Anh', value: p.englishCorrect || 0, color: '#e67e22' },
            { icon: '⏳', label: 'Sống Lâu Nhất', value: `${Math.round((p.survivalSeconds || 0)/60)}m`, color: '#cbd5e1' },
            { icon: '🧠', label: 'Não Vàng', value: snap.brainChips || 0, color: '#FFD700' },
        ];

        const cardGapX = isMobile ? 0 : 22;
        const cardGapY = isMobile ? 14 : 18;
        const cols = isMobile ? 1 : 2;
        const rows = Math.ceil(statsData.length / cols);
        const horizontalPadding = isMobile ? 28 : 36;
        const cardW = cols === 1
            ? panelW - horizontalPadding * 2
            : Math.floor((panelW - horizontalPadding * 2 - cardGapX) / 2);
        const topPadding = isMobile ? 102 : 120;
        const bottomPadding = isMobile ? 22 : 30;
        const availableH = panelH - topPadding - bottomPadding - cardGapY * (rows - 1);
        const cardH = Math.floor(availableH / rows);
        const startY = -panelH / 2 + topPadding;

        const iconFontPx = Math.min(40, Math.round(34 * uiScale));
        const labelFontPx = Math.min(40, Math.round((isMobile ? 20 : 24) * uiScale));
        const valueFontPx = Math.min(40, Math.round((isMobile ? 18 : 22) * uiScale));
        const labelYOffset = Math.round(Math.max(12, cardH * 0.2));
        const valueYOffset = Math.round(Math.max(12, cardH * 0.2));

        statsData.forEach((stat, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            
            const totalRowWidth = cols === 1 ? cardW : (cardW * cols + cardGapX);
            const rowStartX = -totalRowWidth / 2 + cardW / 2;
            const x = rowStartX + col * (cardW + cardGapX);
            const y = startY + row * (cardH + cardGapY);

            // Card BG
            const cardBg = scene.add.graphics();
            cardBg.fillStyle(0x1e293b, 0.8);
            cardBg.fillRoundedRect(x - cardW/2, y, cardW, cardH, 8);
            cardBg.lineStyle(2, 0x334155, 1);
            cardBg.strokeRoundedRect(x - cardW/2, y, cardW, cardH, 8);
            this.add(cardBg);

            // Icon
            const iconTxt = scene.add.text(x - cardW/2 + 15, y + cardH/2, stat.icon, { 
                     fontSize: `${iconFontPx}px`
            }).setOrigin(0, 0.5);
            
            // Label
                const labelTxt = scene.add.text(x - cardW/2 + 65, y + cardH/2 - labelYOffset, stat.label.toUpperCase(), {
                    fontFamily: '"Lexend", sans-serif', fontSize: `${labelFontPx}px`, color: '#94a3b8'
            }).setOrigin(0, 0.5);
            
            // Value
                const valTxt = scene.add.text(x - cardW/2 + 65, y + cardH/2 + valueYOffset, String(stat.value), {
                    fontFamily: '"Press Start 2P", monospace', fontSize: `${valueFontPx}px`, color: stat.color
            }).setOrigin(0, 0.5);

            this.add([iconTxt, labelTxt, valTxt]);
        });

        scene.add.existing(this);
        this.setDepth(200);

        this.setScale(0.8);
        scene.tweens.add({ targets: this, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }

    close() {
        this.scene.tweens.add({
            targets: this,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                if (this.onClose) this.onClose();
                this.destroy();
            }
        });
    }
}
