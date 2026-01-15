import { Scene } from 'phaser';
import { UIManager } from '../ui/UIManager';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.uiManager = null;
    }

    create(data) {
        this.gameMode = data.mode || 'normal';
        // Initialize UI Manager
        this.uiManager = new UIManager(this, this.gameMode);

        // Cleanup on shutdown
        this.events.on('shutdown', () => {
            if (this.uiManager) this.uiManager.destroy();
        });

        // Connect to Game Events
        const gameScene = this.scene.get('Game');

        gameScene.events.on('updateLeaderboard', (data) => this.uiManager.updateLeaderboard(data));
        gameScene.events.on('updatePing', (data) => this.uiManager.updatePing(data));
        gameScene.events.on('coinsChanged', (data) => this.uiManager.updateCoins(data));

        // Quiz Events
        gameScene.events.on('updateQuestion', (data) => this.uiManager.updateQuestion(data));
        gameScene.events.on('roundStart', (data) => this.uiManager.startRoundTimer(data));
        gameScene.events.on('roundEnd', (data) => this.uiManager.showWinner(data));

        // Items and Inventory
        gameScene.events.on('updateInventory', (data) => this.uiManager.updateInventory(data));
        gameScene.events.on('itemActivated', (data) => this.uiManager.onItemActivated(data));

        // Keyboard Inputs (Desktop) - Keep here or move to Controls component?
        // Game.js handles 'keydown', but UIScene usually sets up listeners.
        if (this.sys.game.device.os.desktop) {
            this.input.keyboard.on('keydown-ONE', () => this.tryUseItem(gameScene, 'speed'));
            this.input.keyboard.on('keydown-TWO', () => this.tryUseItem(gameScene, 'magnet'));
            this.input.keyboard.on('keydown-THREE', () => this.tryUseItem(gameScene, 'ghost'));
        }
    }

    tryUseItem(gameScene, itemId) {
        // Validation: Don't use if not allowed in this mode
        if (this.gameMode !== 'normal') {
            // Quiz modes (math, english, quiz) only allow speed and ghost
            if (itemId === 'magnet') return;
        }
        gameScene.useItem(itemId);
    }

    // Public method called by Game.js
    getMobileInput() {
        return this.uiManager ? this.uiManager.getMobileInput() : null;
    }

    updateMinimapPlayer(x, y) {
        if (this.uiManager) this.uiManager.updateMinimapPlayer(x, y);
    }

    updateMinimapFood(foodData) {
        if (this.uiManager) this.uiManager.updateMinimapFood(foodData);
    }
}
