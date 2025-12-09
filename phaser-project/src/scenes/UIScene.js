import { Scene } from 'phaser';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
    }

    create() {
        // Leaderboard
        this.leaderboardText = this.add.text(10, 10, 'Leaderboard', {
            fontFamily: 'Arial', fontSize: '16px', color: '#ffffff',
            backgroundColor: '#00000088', padding: { x: 10, y: 10 }
        });

        // Ping
        this.pingText = this.add.text(this.cameras.main.width - 10, 10, 'Ping: 0ms', {
            fontFamily: 'Arial', fontSize: '14px', color: '#00ff00',
            backgroundColor: '#00000088', padding: { x: 5, y: 5 }
        }).setOrigin(1, 0);

        // Get reference to Game Scene to listen for updates
        const gameScene = this.scene.get('Game');
        
        // Listen for events from Game Scene
        gameScene.events.on('updateLeaderboard', this.updateLeaderboard, this);
        gameScene.events.on('updatePing', this.updatePing, this);
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
}
