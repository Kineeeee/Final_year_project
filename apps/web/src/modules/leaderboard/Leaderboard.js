import { COLORS, TEXT_STYLES } from '../../ui/UIConstants';

export class Leaderboard {
    constructor(scene) {
        this.scene = scene;
        this.container = this.scene.add.container(0, 0);

        // Background
        this.bg = this.scene.add.graphics();
        this.bg.fillStyle(COLORS.PANEL_BG, 0.6);
        this.bg.fillRoundedRect(0, 0, 200, 200, 12); // Initial size, will resize
        this.bg.lineStyle(2, COLORS.PANEL_BORDER, 0.8);
        this.bg.strokeRoundedRect(0, 0, 200, 200, 12);

        // Header
        this.header = this.scene.add.text(10, 10, '🏆 LEADERBOARD', {
            ...TEXT_STYLES.BODY,
            fontSize: '16px',
            color: COLORS.TEXT.ACCENT,
            fontStyle: 'bold'
        });

        // Content
        this.text = this.scene.add.text(10, 35, 'Loading...', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '14px',
            color: COLORS.TEXT.LIGHT,
            lineSpacing: 4,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        });

        this.container.add([this.bg, this.header, this.text]);
    }

    resize(safeArea) {
        const scale = safeArea.uiScale || 1;

        const x = safeArea.left;
        const y = safeArea.top + 40 * scale; // Gap for Coins

        this.container.setPosition(x, y);
        this.container.setScale(scale);

        // Resize Background based on text content? 
        // For now fixed width is okay, height dynamic?
        // Let's keep a reasonable fixed width for safety.

        this._updateBackground();
    }

    update(leaderboardText) {
        // The text often comes as "1. Name: Score\n2. Name: Score..."
        this.text.setText(leaderboardText);
        this._updateBackground();
    }

    _updateBackground() {
        const width = 220;
        const height = Math.max(100, this.text.height + 50);

        this.bg.clear();
        this.bg.fillStyle(COLORS.PANEL_BG, 0.6);
        this.bg.fillRoundedRect(0, 0, width, height, 16);
        this.bg.lineStyle(2, COLORS.PANEL_BORDER, 0.8);
        this.bg.strokeRoundedRect(0, 0, width, height, 16);
    }
}
