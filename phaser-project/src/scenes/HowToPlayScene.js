import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { UIPanel } from '../ui/UIPanel';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class HowToPlayScene extends Scene {
    constructor() {
        super('HowToPlayScene');
    }

    create() {
        Logger.info('HowToPlay', 'Showing How To Play');
        this.scene.stop('UIScene');

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // 1. Phông nền mờ ảo (Depth of Field effect)
        this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0).setTint(0x222222).setAlpha(0.6);
        this.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.85).setOrigin(0);

        // 2. Panel chính với hiệu ứng xuất hiện (Pop-up)
        const panelW = 1050;
        const panelH = height - 50;
        const closeAction = () => {
            this.tweens.add({
                targets: panel,
                scale: 0.9,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    this.scene.stop();
                    this.scene.resume('MainMenu');
                }
            });
        };

        const panel = new UIPanel(this, centerX, centerY, panelW, panelH, 'HOW TO PLAY', closeAction);
        this.add.existing(panel);
        panel.setScale(0.8).setAlpha(0);
        this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

        // Tạo container để quản lý nội dung bên trong panel cho dễ căn chỉnh
        const content = this.add.container(centerX, centerY);

        // --- SECTION 1: CONTROLS (Sử dụng biểu tượng trực quan) ---
        const controlsY = -panelH / 2 + 150;
        this.createSectionTitle(content, 0, controlsY - 40, '🎮 CONTROLS');

        const controlItems = [
            { icon: '🖱️', title: 'MOVE', desc: 'Move mouse to guide' },
            { icon: '⚡', title: 'DASH', desc: 'Left click to burst' },
            { icon: '⌨️', title: 'ITEMS', desc: 'Keys 1, 2, 3 to use' }
        ];

        controlItems.forEach((item, i) => {
            const x = -320 + (i * 320);
            this.createControlCard(content, x, controlsY + 40, item);
        });

        // --- SECTION 2: GAME MODES (Phân biệt bằng màu sắc) ---
        const modesY = 25;
        this.createSectionTitle(content, 0, modesY - 100, '🏆 GAME MODES');

        // Survival Card
        this.createModeCard(content, -250, modesY + 10, 450, 160, 'SURVIVAL',
            'Eat food to grow. Avoid other snakes.\nBecome the last survivor and grow\nas long as you can!', COLORS.PRIMARY);

        // Quiz Card
        this.createModeCard(content, 250, modesY + 10, 450, 160, 'QUIZ MODES',
            'Answer questions to get massive points.\nWrong answers deduct points! Compete\nfor the top score and leaderboard.', 0xff8c00);

        // --- SECTION 3: POWER-UPS (Hiển thị vật phẩm) ---
        const itemsY = panelH / 2 - 180;
        this.createSectionTitle(content, 0, itemsY - 40, '✨ POWER-UPS');

        const powerUps = [
            { key: 'magnet', name: 'MAGNET', desc: 'Attract food from afar', color: 0x3498db },
            { key: 'speed', name: 'SPEED', desc: 'Dash without point cost', color: 0xe74c3c },
            { key: 'ghost', name: 'GHOST', desc: 'Pass through snakes for 5s,\nbut you still die if your\nhead hits another snake head.', color: 0x9b59b6 }
        ];

        powerUps.forEach((p, i) => {
            const x = -300 + (i * 300);
            this.createPowerUpItem(content, x, itemsY + 40, p);
        });
    }

    // Helper: Tạo tiêu đề mục với đường kẻ trang trí
    createSectionTitle(container, x, y, text) {
        const title = this.add.text(x, y, text, {
            ...TEXT_STYLES.SUBHEADER,
            color: '#f1c40f',
            fontSize: '28px'
        }).setOrigin(0.5);

        const line = this.add.graphics();
        line.lineStyle(2, 0x444444, 0.5);
        line.lineBetween(x - 450, y, x - 150, y);
        line.lineBetween(x + 150, y, x + 450, y);

        container.add([title, line]);
    }

    // Helper: Tạo thẻ điều khiển
    createControlCard(container, x, y, data) {
        const bg = this.add.rectangle(x, y, 290, 110, 0x000000, 0.5).setStrokeStyle(1, 0x666666);
        const icon = this.add.text(x - 90, y, data.icon, { fontSize: '40px' }).setOrigin(0.5);
        const title = this.add.text(x + -30, y - 20, data.title, { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#4aff4a' }).setOrigin(0, 0.5);
        const desc = this.add.text(x + -30, y + 20, data.desc, { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff', wordWrap: { width: 170 } }).setOrigin(0, 0.5);
        container.add([bg, icon, title, desc]);
    }

    // Helper: Tạo thẻ chế độ chơi
    createModeCard(container, x, y, w, h, title, desc, color) {
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a1a, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
        bg.lineStyle(2, color, 0.5);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);

        const colorStr = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
        const t = this.add.text(x, y - h / 2 + 30, title, { ...TEXT_STYLES.SUBHEADER, color: colorStr, fontSize: '24px' }).setOrigin(0.5);
        const d = this.add.text(x, y + 20, desc, { ...TEXT_STYLES.BODY, fontSize: '18px', align: 'center', color: '#ffffff' }).setOrigin(0.5);

        container.add([bg, t, d]);
    }

    // Helper: Tạo biểu tượng vật phẩm
    createPowerUpItem(container, x, y, data) {
        const iconBg = this.add.graphics();
        iconBg.fillStyle(0x000000, 0.5);
        iconBg.fillRoundedRect(x - 40, y - 40, 80, 80, 12);
        iconBg.lineStyle(2, data.color, 1);
        iconBg.strokeRoundedRect(x - 40, y - 40, 80, 80, 12);

        let icon;
        if (this.textures.exists(data.key)) {
            icon = this.add.image(x, y, data.key);
            const scale = 70 / Math.max(icon.width, icon.height);
            icon.setScale(scale * 0.8); // 80% of circle size for padding
        } else {
            icon = this.add.text(x, y, '?', { fontSize: '24px' }).setOrigin(0.5);
        }

        const colorStr = typeof data.color === 'number' ? '#' + data.color.toString(16).padStart(6, '0') : data.color;
        const name = this.add.text(x, y + 55, data.name, { fontSize: '18px', fontWeight: 'bold', color: colorStr }).setOrigin(0.5);
        const desc = this.add.text(x, y + 100, data.desc, { fontSize: '14px', color: '#dddddd' }).setOrigin(0.5);

        container.add([iconBg, icon, name, desc]);
    }
}