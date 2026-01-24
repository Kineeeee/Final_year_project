import { Scene } from 'phaser';
import { UIManager } from '../ui/UIManager';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.uiManager = null;
        this._gameEventBindings = null;
        this._keyboardBindings = null;
    }

    create(data) {
        this.gameMode = data.mode || 'normal';

        // If UIScene is restarted/reused, ensure previous UI is fully torn down
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }

        // Scene instances are reused across restarts; ensure cleanup is bound each run.
        this.events.off('shutdown', this._onShutdown, this);
        this.events.off('destroy', this._onShutdown, this);
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        // Initialize UI Manager
        this.uiManager = new UIManager(this, this.gameMode);

        // Connect to Game Events
        const gameScene = this.scene.get('Game');

        // Defensive: avoid duplicating bindings if create() is called again
        this._unbindGameEvents();

        this._gameEventBindings = {
            updateLeaderboard: (payload) =>
                this.uiManager && this.uiManager.updateLeaderboard(payload),
            updatePing: (payload) => this.uiManager && this.uiManager.updatePing(payload),
            coinsChanged: (payload) => this.uiManager && this.uiManager.updateCoins(payload),
            updateQuestion: (payload) => this.uiManager && this.uiManager.updateQuestion(payload),
            roundStart: (payload) => this.uiManager && this.uiManager.startRoundTimer(payload),
            roundEnd: (payload) => this.uiManager && this.uiManager.showWinner(payload),
            updateInventory: (payload) => this.uiManager && this.uiManager.updateInventory(payload),
            itemActivated: (payload) => this.uiManager && this.uiManager.onItemActivated(payload),
            updateRank: (payload) => this.uiManager && this.uiManager.updateRank(payload.rank, payload.total),
            updateScore: (score) => this.uiManager && this.uiManager.updateScore(score),
        };

        Object.entries(this._gameEventBindings).forEach(([event, handler]) => {
            gameScene.events.on(event, handler);
        });

        // Keyboard Inputs (Desktop) - Keep here or move to Controls component?
        // Game.js handles 'keydown', but UIScene usually sets up listeners.
        if (this.sys.game.device.os.desktop && this.gameMode == 'normal') {
            this._unbindKeyboard();
            const one = () => this.tryUseItem(gameScene, 'speed');
            const two = () => this.tryUseItem(gameScene, 'magnet');
            const three = () => this.tryUseItem(gameScene, 'ghost');
            this._keyboardBindings = [
                ['keydown-ONE', one],
                ['keydown-TWO', two],
                ['keydown-THREE', three],
            ];
            this._keyboardBindings.forEach(([evt, fn]) => this.input.keyboard.on(evt, fn));
        }

    }

    _onShutdown() {
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }
        this._unbindGameEvents();
        this._unbindKeyboard();
    }

    _unbindGameEvents() {
        const gs = this.scene && this.scene.get ? this.scene.get('Game') : null;
        if (gs && this._gameEventBindings) {
            Object.entries(this._gameEventBindings).forEach(([event, handler]) => {
                gs.events.off(event, handler);
            });
        }
        this._gameEventBindings = null;
    }

    _unbindKeyboard() {
        if (!this._keyboardBindings) return;
        if (this.input && this.input.keyboard && this.input.keyboard.off) {
            this._keyboardBindings.forEach(([evt, fn]) => this.input.keyboard.off(evt, fn));
        }
        this._keyboardBindings = null;
    }

    tryUseItem(gameScene, itemId) {
        // Validation: Don't use if not allowed in this mode
        if (this.gameMode !== 'normal') {
            // Quiz modes (math, english, quiz) only allow speed and ghost
            if (itemId === 'magnet') return;
        }
        if (gameScene && gameScene.events) {
            gameScene.events.emit('intent:useItem', itemId);
        } else if (gameScene && gameScene.useItem) {
            // Fallback
            gameScene.useItem(itemId);
        }
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
