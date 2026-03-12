import { Scene } from 'phaser';
import { UIManager } from '../modules/ui/UIManager';
import { overlayBlocker } from '../core/services/OverlayBlocker';
import { achievementManager } from '../modules/achievements/AchievementManager';
import { GAME_PHASE } from '../core/state/GamePhases';
import { UISceneInputController } from './controllers/UISceneInputController';
import { UISceneWaitingController } from './controllers/UISceneWaitingController';
import { UISceneResultController } from './controllers/UISceneResultController';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.uiManager = null;
        this._gameEventBindings = null;
        this._keyboardBindings = null;

        this.waitingRoot = null;
        this.waitingListEl = null;
        this.waitingHeaderEl = null;
        this.waitingOwnerBadge = null;
        this.waitingStartEl = null;
        this.waitingLeaveEl = null;
        this.waitingBlockToken = null;
        this.waitingLastPayload = null;
        this.localSocketId = null;
        this.waitingStarted = false;
        this.customNamespace = null;
        this.roomMeta = null;

        this.resultOverlay = null;
        this.resultButtons = [];
        this.resultBlockToken = null;

        this.uiPhase = 'idle';
        this._leavingRoom = false;

        this.debugContainer = null;
        this.debugText = null;
        this.isDebugVisible = false;
        this.lastPing = 0;
        this._achievementToasts = [];

        this.inputController = new UISceneInputController();
        this.waitingController = new UISceneWaitingController();
        this.resultController = new UISceneResultController();
    }

    create(data) {
        this.gameMode = data.mode || 'normal';
        this.quizSource = (data.quizSource || 'SYSTEM').toUpperCase();
        this.customNamespace = data.customNamespace || null;
        this.roomMeta = data.roomMeta || null;
        this.waitingStarted = false;
        this.waitingLastPayload = null;
        this._leavingRoom = false;

        this._unsubOverlay = overlayBlocker.subscribe(() => {
            this._overlayBlocked = overlayBlocker.isBlocked();
            if (this.input && this.input.enabled !== undefined) {
                this.input.enabled = !this._overlayBlocked;
            }
        });

        achievementManager.attachUiScene(this);

        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }

        this.events.off('shutdown', this._onShutdown, this);
        this.events.off('destroy', this._onShutdown, this);
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);

        this.uiManager = new UIManager(this, this.gameMode, { onExit: () => this.forceExitToMenu() });
        this.uiManager.updateQuizSource(this.quizSource);

        const alreadyStarted = !!(this.roomMeta && this.roomMeta.started);
        if (this.customNamespace && !alreadyStarted) {
            this.createWaitingOverlay();
            this.uiPhase = 'waiting';
            this.setGamePhase(GAME_PHASE.WAITING_ROOM);
        } else {
            this._teardownWaitingOverlay();
            this.waitingStarted = false;
            this.uiPhase = 'idle';
            this.setGamePhase(GAME_PHASE.PLAYING);
        }

        if (this.gameMode === 'normal' && this.uiManager && this.uiManager.components?.hud) {
            this.uiManager.components.hud.questionText?.setVisible(false);
            this.uiManager.components.hud.timerText?.setVisible(false);
            this.uiManager.components.hud.roundTimerText?.setVisible(false);
        }

        const gameScene = this.scene.get('Game');
        this._unbindGameEvents();

        this._gameEventBindings = [
            ['updateLeaderboard', (payload) => this.uiManager && this.uiManager.updateLeaderboard(payload)],
            ['updatePing', (payload) => {
                this.lastPing = payload;
                if (this.uiManager) this.uiManager.updatePing(payload);
            }],
            ['coinsChanged', (payload) => this.uiManager && this.uiManager.updateCoins(payload)],
            ['updateQuestion', (payload) => {
                if (this._isQuizMode()) this.uiManager && this.uiManager.updateQuestion(payload);
            }],
            ['roundStart', (payload) => {
                if (this._isQuizMode()) this.uiManager && this.uiManager.startRoundTimer(payload);
                this.onRoundStart();
            }],
            ['roundEnd', (payload) => {
                if (this._isQuizMode()) this.uiManager && this.uiManager.showWinner(payload);
            }],
            ['updateInventory', (payload) => this.uiManager && this.uiManager.updateInventory(payload)],
            ['itemActivated', (payload) => this.uiManager && this.uiManager.onItemActivated(payload)],
            ['updateRank', (payload) => this.uiManager && this.uiManager.updateRank(payload.rank, payload.total)],
            ['updateScore', (score) => this.uiManager && this.uiManager.updateScore(score)],
            ['quizSourceChanged', (payload) => {
                const src = (payload?.source || 'SYSTEM').toUpperCase();
                this.uiManager && this.uiManager.updateQuizSource(src);
            }],
            ['room:meta', (meta) => this.updateRoomBadge(meta)],
            ['room:owner', (payload) => {
                const oldOwnerId = this.roomBadgeMeta?.ownerId;
                if (this.roomBadgeMeta) {
                    this.roomBadgeMeta.ownerId = payload.ownerId;
                    this.updateRoomBadge(this.roomBadgeMeta);
                }
                this.updateWaitingOverlay(this.waitingLastPayload, payload?.ownerId);
                if (oldOwnerId && oldOwnerId !== payload.ownerId && this.uiPhase === 'playing') {
                    const isNowMe = payload.ownerId === this.localSocketId;
                    const msg = isNowMe ? 'Host disconnected! You are now the Host.' : 'Host disconnected! Migrating Host...';
                    this.uiManager && this.uiManager.showToast({ message: msg, color: 0xf59e0b });
                }
            }],
            ['room:waiting', (payload) => this.updateWaitingOverlay(payload)],
            ['room:started', () => this.onRoomStarted()],
            ['room:closed', () => this.handleRoomClosed()],
            ['room:kicked', () => this.handleKicked()],
            ['room_left', () => this.handleRoomLeft()],
            ['network:connected', ({ socketId }) => {
                this.localSocketId = socketId;
                if (this.waitingLastPayload) this.updateWaitingOverlay(this.waitingLastPayload);
            }],
            ['match:result', (payload) => this.showResultOverlay(payload)],
            ['achievement:unlocked', (payload) => this.showAchievementToast(payload)],
        ];

        this._gameEventBindings.forEach(([event, handler]) => {
            gameScene.events.on(event, handler);
        });

        if (this.sys.game.device.os.desktop) {
            this.inputController.bindKeyboard(this, gameScene);
        }
    }

    update() {
        if (this.isDebugVisible) this.updateDebugOverlay();
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
        if (this._achievementToasts?.length) {
            this._achievementToasts.forEach(t => t.destroy());
            this._achievementToasts = [];
        }
        this._teardownWaitingOverlay();
        this.hideResultOverlay('menu');
        this._unbindGameEvents();
        this._unbindKeyboard();
        if (this.input && this.input.enabled !== undefined) {
            this.input.enabled = true;
        }
    }

    _unbindGameEvents() {
        const gs = this.scene && this.scene.get ? this.scene.get('Game') : null;
        if (gs && this._gameEventBindings) {
            this._gameEventBindings.forEach(([event, handler]) => {
                gs.events.off(event, handler);
            });
        }
        this._gameEventBindings = null;
    }

    _unbindKeyboard() {
        this.inputController.unbindKeyboard(this);
    }

    tryUseItem(gameScene, itemId) {
        if (overlayBlocker.isBlocked()) return;
        if (this._overlayBlocked) return;
        if (this.gameMode !== 'normal' && itemId === 'magnet') return;

        if (gameScene && gameScene.events) {
            gameScene.events.emit('intent:useItem', itemId);
        } else if (gameScene && gameScene.useItem) {
            gameScene.useItem(itemId);
        }
    }

    getMobileInput() {
        return this.uiManager ? this.uiManager.getMobileInput() : null;
    }

    onRoundStart() {
        this.hideResultOverlay();
        if (this.uiPhase !== 'waiting') {
            this.uiPhase = 'playing';
            this.setGamePhase(GAME_PHASE.PLAYING);
        }
    }

    onRoomStarted() {
        this.waitingStarted = true;
        this.uiPhase = 'playing';
        this.setGamePhase(GAME_PHASE.PLAYING);
        this.hideWaitingOverlay({ reason: 'start' });
    }

    handleRoomClosed() {
        if (this._leavingRoom) return;
        this.waitingStarted = false;
        this._teardownWaitingOverlay();
        this.returnToMenu('closed');
    }

    handleRoomLeft() {
        if (this._leavingRoom) return;
        this.waitingStarted = false;
        this._teardownWaitingOverlay();
        this.returnToMenu('room_left');
    }

    handleKicked() {
        if (this._leavingRoom) return;
        this.waitingStarted = false;
        this._teardownWaitingOverlay();
        this.uiManager && this.uiManager.showToast && this.uiManager.showToast({
            message: 'You were kicked from the room.',
            color: 0xef4444,
        });
        this.returnToMenu('kicked');
    }

    showAchievementToast(payload) {
        if (!payload) return;
        const { width } = this.scale;
        const baseY = 110;
        const maxVisible = 3;
        const rarityColors = {
            bronze: 0xcd7f32,
            silver: 0xc0c0c0,
            gold: 0xf59e0b,
            diamond: 0x7dd3fc,
            mythic: 0xa855f7
        };

        const y = baseY + this._achievementToasts.length * 78;
        const container = this.add.container(width - 20, y).setDepth(4000).setAlpha(0).setScale(0.95);
        const w = 360;
        const h = 64;
        const bg = this.add.graphics();
        const color = rarityColors[payload.rarity] || 0x10b981;
        bg.fillStyle(0x000000, 0.35);
        bg.fillRoundedRect(-w - 6, -h / 2 - 6, w + 12, h + 12, 14);
        bg.fillStyle(color, 0.9);
        bg.fillRoundedRect(-w, -h / 2, w, h, 12);
        bg.lineStyle(2, 0xffffff, 0.6);
        bg.strokeRoundedRect(-w, -h / 2, w, h, 12);
        container.add(bg);

        const title = this.add.text(-w + 18, -h / 2 + 10, payload.name || 'Achievement', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0, 0);

        const rewardLabel = (payload.rewards || [])
            .map((r) => r.duplicate ? `+${r.amount || 0}🧠` : (r.name || r.id || 'Reward'))
            .join(' · ') || 'Reward unlocked';

        const rewardText = this.add.text(-w + 18, 6, rewardLabel, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '14px',
            color: '#0b172a',
            stroke: '#ffffff',
            strokeThickness: 0,
        }).setOrigin(0, 0);

        const badge = this.add.text(-30, 0, '🏆', { fontSize: '28px' }).setOrigin(0.5);

        container.add([title, rewardText, badge]);

        this.add.existing(container);
        this._achievementToasts.push(container);

        this.tweens.add({ targets: container, alpha: 1, x: width - 28, scale: 1, duration: 220, ease: 'Back.out' });
        this.time.delayedCall(3600, () => this._removeAchievementToast(container));

        if (this._achievementToasts.length > maxVisible) {
            this._removeAchievementToast(this._achievementToasts[0]);
        }
    }

    _removeAchievementToast(toast) {
        if (!toast || !toast.scene) return;
        this._achievementToasts = this._achievementToasts.filter((t) => t !== toast);
        this.tweens.add({
            targets: toast,
            alpha: 0,
            x: this.scale.width + 40,
            duration: 200,
            onComplete: () => toast.destroy(),
        });

        const baseY = 110;
        this._achievementToasts.forEach((t, idx) => {
            this.tweens.add({ targets: t, y: baseY + idx * 78, duration: 160, ease: 'Sine.easeOut' });
        });
    }

    createWaitingOverlay() {
        this.waitingController.createWaitingOverlay(this);
    }

    _teardownWaitingOverlay() {
        this.waitingController.teardownWaitingOverlay(this);
    }

    hideWaitingOverlay({ reason = 'start' } = {}) {
        this.waitingController.hideWaitingOverlay(this, { reason });
    }

    updateWaitingOverlay(payload = {}, forcedOwnerId = null) {
        this.waitingController.updateWaitingOverlay(this, payload, forcedOwnerId);
    }

    renderWaitingPlayers(players = [], { ownerId = null, isOwner = false } = {}) {
        this.waitingController.renderWaitingPlayers(this, players, { ownerId, isOwner });
    }

    emitRoomStart() {
        this.waitingController.emitRoomStart(this);
    }

    leaveRoom() {
        this.waitingController.leaveRoom(this);
    }

    kickPlayer(targetId) {
        this.waitingController.kickPlayer(this, targetId);
    }

    showResultOverlay(payload = {}) {
        this.resultController.showResultOverlay(this, payload);
    }

    hideResultOverlay(reason = 'continue') {
        this.resultController.hideResultOverlay(this, reason);
    }

    forceExitToMenu() {
        this.returnToMenu('exit');
    }

    returnToMenu(reason = 'generic') {
        const allowedWhileWaiting = ['leave', 'kicked', 'closed', 'room_left', 'result', 'exit'];
        if (this.uiPhase === 'waiting' && !allowedWhileWaiting.includes(reason)) {
            if (!this._leavingRoom) this.leaveRoom();
            return;
        }
        if (!this._leavingRoom) {
            this._leavingRoom = true;
        }
        this.setGamePhase(GAME_PHASE.EXITING);

        this._teardownWaitingOverlay();
        this.hideResultOverlay('menu');

        const gameScene = this.scene.get('Game');
        if (gameScene) {
            const socket = gameScene.networkManager?.socket;
            if (socket) {
                if (this.customNamespace) {
                    socket.emit('leaveLobby');
                }
                if (socket.disconnect) socket.disconnect();
            }
            gameScene.scene.start('MainMenu');
        } else {
            this.scene.start('MainMenu');
        }
    }

    _isQuizMode() {
        return this.gameMode === 'math' || this.gameMode === 'english' || this.gameMode === 'quiz';
    }

    updateMinimapPlayer(x, y) {
        if (this.uiManager) this.uiManager.updateMinimapPlayer(x, y);
    }

    updateMinimapFood(foodData) {
        if (this.uiManager) this.uiManager.updateMinimapFood(foodData);
    }

    toggleDebugOverlay() {
        this.isDebugVisible = !this.isDebugVisible;

        if (this.isDebugVisible) {
            if (!this.debugContainer) this.createDebugOverlay();
            this.debugContainer.setVisible(true);
        } else if (this.debugContainer) {
            this.debugContainer.setVisible(false);
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

    setGamePhase(phase) {
        gameSceneSetPhase(this, phase);
    }
}

function gameSceneSetPhase(uiScene, phase) {
    const gameScene = uiScene?.scene?.get?.('Game');
    if (gameScene && typeof gameScene.setPhase === 'function') {
        gameScene.setPhase(phase);
    }
}
