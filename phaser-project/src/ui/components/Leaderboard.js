export class Leaderboard {
    constructor(scene) {
        this.scene = scene;
        this.text = this.scene.add.text(0, 0, 'Leaderboard', {
            fontFamily: 'Arial', fontSize: '16px', color: '#ffffff',
            backgroundColor: '#00000088', padding: { x: 10, y: 10 }
        });
    }

    resize(safeArea) {
        // Top Left
        // If HUD Coins are also Top Left, we probably want Leaderboard at Top Left (most standard)
        // And Coins below it.
        this.text.setPosition(safeArea.left, safeArea.top);

        // Font size adjustment for mobile?
        const isMobile = !this.scene.sys.game.device.os.desktop;
        this.text.setFontSize(isMobile ? '20px' : '16px');
    }

    update(leaderboardText) {
        this.text.setText(leaderboardText);
    }
}
