import { Scene } from 'phaser';
import { UIManager } from '../modules/ui/UIManager';
import { overlayBlocker } from '../core/services/OverlayBlocker';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.uiManager = null;
        this._gameEventBindings = null;
        this._keyboardBindings = null;

        // Debug Overlay
        this.debugContainer = null;
        this.debugText = null;
        this.isDebugVisible = false;
        this.lastPing = 0;
    }

    create(data) {
        this.gameMode = data.mode || 'normal';
        this.quizSource = (data.quizSource || 'SYSTEM').toUpperCase();
        this._unsubOverlay = overlayBlocker.subscribe(() => {
            this._overlayBlocked = overlayBlocker.isBlocked();
            // disable all input when blocked
            if (this.input && this.input.enabled !== undefined) {
                this.input.enabled = !this._overlayBlocked;
            }
        });

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
        this.uiManager.updateQuizSource(this.quizSource);

        // In normal mode, hide quiz widgets proactively
        if (this.gameMode === 'normal' && this.uiManager && this.uiManager.components?.hud) {
            this.uiManager.components.hud.questionText?.setVisible(false);
            this.uiManager.components.hud.timerText?.setVisible(false);
            this.uiManager.components.hud.roundTimerText?.setVisible(false);
        }

        // Connect to Game Events
        const gameScene = this.scene.get('Game');

        // Defensive: avoid duplicating bindings if create() is called again
        this._unbindGameEvents();

        this._gameEventBindings = {
            updateLeaderboard: (payload) =>
                this.uiManager && this.uiManager.updateLeaderboard(payload),
            updatePing: (payload) => {
                this.lastPing = payload;
                if (this.uiManager) this.uiManager.updatePing(payload);
            },
            coinsChanged: (payload) => this.uiManager && this.uiManager.updateCoins(payload),
            updateQuestion: (payload) => {
                if (this.gameMode === 'math' || this.gameMode === 'english') {
                    this.uiManager && this.uiManager.updateQuestion(payload);
                }
            },
            roundStart: (payload) => {
                if (this.gameMode === 'math' || this.gameMode === 'english') {
                    this.uiManager && this.uiManager.startRoundTimer(payload);
                }
            },
            roundEnd: (payload) => {
                if (this.gameMode === 'math' || this.gameMode === 'english') {
                    this.uiManager && this.uiManager.showWinner(payload);
                }
            },
            updateInventory: (payload) => this.uiManager && this.uiManager.updateInventory(payload),
            itemActivated: (payload) => this.uiManager && this.uiManager.onItemActivated(payload),
            updateRank: (payload) => this.uiManager && this.uiManager.updateRank(payload.rank, payload.total),
            updateScore: (score) => this.uiManager && this.uiManager.updateScore(score),
            quizSourceChanged: (payload) => {
                const src = (payload?.source || 'SYSTEM').toUpperCase();
                this.uiManager && this.uiManager.updateQuizSource(src);
            },
            'room:meta': (meta) => this.updateRoomBadge(meta),
            'room:owner': (payload) => {
                if (this.roomBadgeMeta) {
                    this.roomBadgeMeta.ownerId = payload.ownerId;
                    this.updateRoomBadge(this.roomBadgeMeta);
                }
            }
        };

        Object.entries(this._gameEventBindings).forEach(([event, handler]) => {
            gameScene.events.on(event, handler);
        });

        // Keyboard Inputs (Desktop) - Keep here or move to Controls component?
        // Game.js handles 'keydown', but UIScene usually sets up listeners.
        if (this.sys.game.device.os.desktop) {
            this._unbindKeyboard();
            const one = () => this.tryUseItem(gameScene, 'speed');

            let two, three;
            // Quiz modes only have Speed and Ghost
            // Rebind: 1=Speed, 2=Ghost
            if (this.gameMode !== 'normal') {
                two = () => this.tryUseItem(gameScene, 'ghost');
                this._keyboardBindings = [
                    ['keydown-ONE', one],
                    ['keydown-TWO', two]
                ];
            } else {
                // Normal: 1=Speed, 2=Magnet, 3=Ghost
                two = () => this.tryUseItem(gameScene, 'magnet');
                three = () => this.tryUseItem(gameScene, 'ghost');
                this._keyboardBindings = [
                    ['keydown-ONE', one],
                    ['keydown-TWO', two],
                    ['keydown-THREE', three],
                ];
            }
            this._keyboardBindings.forEach(([evt, fn]) => this.input.keyboard.on(evt, fn));
        }

        // Debug Toggle (F3)
        this.input.keyboard.on('keydown-F3', () => {
            this.toggleDebugOverlay();
        });
    }

    update(time, delta) {
        if (this.isDebugVisible) {
            this.updateDebugOverlay();
        }
    }

    updateRoomBadge(meta) {
        if (!meta) return;
        this.roomBadgeMeta = meta;
        if (!this.roomBadgeText) {
            this.roomBadgeText = this.add.text(this.scale.width - 20, 16, '', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.35)',
                padding: { x: 8, y: 6 }
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(2000);
        }
        const label = meta.type === 'custom'
            ? `Custom ${meta.category || ''} · owner: ${meta.ownerUserId || meta.ownerId || 'n/a'} · code: ${meta.code || ''}`
            : 'System Room';
        this.roomBadgeText.setText(label);
    }

    // Hide quiz widgets when not in quiz mode
    preRender() {
        if (this.gameMode === 'normal' && this.uiManager && this.uiManager.components?.hud) {
            this.uiManager.components.hud.questionText?.setVisible(false);
            this.uiManager.components.hud.timerText?.setVisible(false);
            this.uiManager.components.hud.roundTimerText?.setVisible(false);
        }
    }

    _onShutdown() {
        if (this._unsubOverlay) this._unsubOverlay();
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }
        this._unbindGameEvents();
        this._unbindKeyboard();
        if (this.input && this.input.enabled !== undefined) {
            this.input.enabled = true;
        }
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
        if (overlayBlocker.isBlocked()) return;
        // Validation: Don't use if not allowed in this mode
        if (this._overlayBlocked) return;
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

    // --- DEBUG OVERLAY ---
    toggleDebugOverlay() {
        this.isDebugVisible = !this.isDebugVisible;

        if (this.isDebugVisible) {
            if (!this.debugContainer) {
                this.createDebugOverlay();
            }
            this.debugContainer.setVisible(true);
        } else {
            if (this.debugContainer) {
                this.debugContainer.setVisible(false);
            }
        }
    }

    createDebugOverlay() {
        this.debugContainer = this.add.container(10, 10).setDepth(1000);

        const bg = this.add.rectangle(0, 0, 200, 100, 0x000000, 0.5).setOrigin(0);
        this.debugText = this.add.text(10, 10, 'Debug Overlay', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#00ff00'
        });

        this.debugContainer.add([bg, this.debugText]);
    }

    updateDebugOverlay() {
        if (!this.debugText) return;

        const gameScene = this.scene.get('Game');
        const fps = Math.round(this.game.loop.actualFps);
        const ping = this.lastPing;

        let entities = 0;
        let foods = 0;

        if (gameScene && gameScene.entityManager) {
            entities = gameScene.entityManager.snakes.length;
            // Count foods
            foods = (gameScene.entityManager.regularFoodGroup?.getLength() || 0) +
                (gameScene.entityManager.specialFoodGroup?.getLength() || 0);
        }

        const info = [
            `FPS: ${fps}`,
            `Ping: ${ping}ms`,
            `Snakes: ${entities}`,
            `Food: ${foods}`,
            `Resolution: ${this.scale.width}x${this.scale.height}`
        ].join('\n');

        this.debugText.setText(info);
    }
}
