import { Scene } from 'phaser';
import { UIManager } from '../modules/ui/UIManager';
import { overlayBlocker } from '../core/services/OverlayBlocker';
import { achievementManager } from '../modules/achievements/AchievementManager';

export class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.uiManager = null;
        this._gameEventBindings = null;
        this._keyboardBindings = null;
        this.waitingOverlay = null;
        this.waitingCountText = null;
        this.waitingListText = null;
        this.waitingStartBtn = null;
        this.waitingStartLabel = null;
        this.waitingLeaveBtn = null;
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

        // Debug Overlay
        this.debugContainer = null;
        this.debugText = null;
        this.isDebugVisible = false;
        this.lastPing = 0;
        this._achievementToasts = [];
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
            // disable all input when blocked
            if (this.input && this.input.enabled !== undefined) {
                this.input.enabled = !this._overlayBlocked;
            }
        });

        achievementManager.attachUiScene(this);

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
        this.uiManager = new UIManager(this, this.gameMode, { onExit: () => this.forceExitToMenu() });
        this.uiManager.updateQuizSource(this.quizSource);

        // Waiting overlay for custom rooms (skip if match already started)
        const alreadyStarted = !!(this.roomMeta && this.roomMeta.started);
        if (this.customNamespace && !alreadyStarted) {
            this.createWaitingOverlay();
            this.uiPhase = 'waiting';
        } else {
            this._teardownWaitingOverlay();
            this.waitingStarted = false;
            this.uiPhase = 'idle';
        }

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

        this._gameEventBindings = [
            ['updateLeaderboard', (payload) => this.uiManager && this.uiManager.updateLeaderboard(payload)],
            ['updatePing', (payload) => {
                this.lastPing = payload;
                if (this.uiManager) this.uiManager.updatePing(payload);
            }],
            ['coinsChanged', (payload) => this.uiManager && this.uiManager.updateCoins(payload)],
            ['updateQuestion', (payload) => {
                if (this._isQuizMode()) {
                    this.uiManager && this.uiManager.updateQuestion(payload);
                }
            }],
            ['roundStart', (payload) => {
                if (this._isQuizMode()) {
                    this.uiManager && this.uiManager.startRoundTimer(payload);
                }
                this.onRoundStart();
            }],
            ['roundEnd', (payload) => {
                if (this._isQuizMode()) {
                    this.uiManager && this.uiManager.showWinner(payload);
                }
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
                if (this.roomBadgeMeta) {
                    this.roomBadgeMeta.ownerId = payload.ownerId;
                    this.updateRoomBadge(this.roomBadgeMeta);
                }
                this.updateWaitingOverlay(this.waitingLastPayload, payload?.ownerId);
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

    onRoundStart() {
        this.hideResultOverlay();
        if (this.uiPhase !== 'waiting') {
            this.uiPhase = 'playing';
        }
    }

    onRoomStarted() {
        this.waitingStarted = true;
        this.uiPhase = 'playing';
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
        try {
            alert('You were kicked from the room.');
        } catch (e) {
            // ignore alert failures (e.g., non-browser env)
        }
        this.returnToMenu('kicked');
    }

    // --- Achievement Toasts ---
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

        // Re-stack remaining toasts
        const baseY = 110;
        this._achievementToasts.forEach((t, idx) => {
            this.tweens.add({ targets: t, y: baseY + idx * 78, duration: 160, ease: 'Sine.easeOut' });
        });
    }

    // --- Custom Room Waiting Overlay ---
    createWaitingOverlay() {
        if (!this.customNamespace || this.waitingRoot) return;
        if (!this.waitingBlockToken) {
            this.waitingBlockToken = overlayBlocker.block('waiting-room');
        }

        const root = document.createElement('div');
        root.className = 'waiting-overlay';
        root.innerHTML = `
            <div class=\"waiting-overlay__backdrop\"></div>
            <div class=\"waiting-overlay__panel\">
                <div class=\"waiting-overlay__header\">
                    <div>
                        <div class=\"waiting-overlay__eyebrow\">Waiting Room</div>
                        <div class=\"waiting-overlay__title\" data-room-title>Loading room…</div>
                    </div>
                    <div class=\"waiting-overlay__owner\" data-owner>Owner: —</div>
                </div>
                <div class=\"waiting-overlay__list\" data-player-list></div>
                <div class=\"waiting-overlay__controls\">
                    <button class=\"waiting-btn waiting-btn--danger\" data-action=\"leave\">Leave Room</button>
                    <div class=\"waiting-overlay__spacer\"></div>
                    <button class=\"waiting-btn waiting-btn--primary\" data-action=\"start\">Start Match</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        this.waitingRoot = root;
        this.waitingListEl = root.querySelector('[data-player-list]');
        this.waitingHeaderEl = root.querySelector('[data-room-title]');
        this.waitingOwnerBadge = root.querySelector('[data-owner]');
        this.waitingStartEl = root.querySelector('[data-action=\"start\"]');
        this.waitingLeaveEl = root.querySelector('[data-action=\"leave\"]');

        if (this.waitingLeaveEl) this.waitingLeaveEl.onclick = () => this.leaveRoom();
        if (this.waitingStartEl) this.waitingStartEl.onclick = () => this.emitRoomStart();
        this.uiPhase = 'waiting';
    }

    _teardownWaitingOverlay() {
        if (this.waitingRoot) {
            this.waitingRoot.remove();
        }
        this.waitingRoot = null;
        this.waitingListEl = null;
        this.waitingHeaderEl = null;
        this.waitingOwnerBadge = null;
        this.waitingStartEl = null;
        this.waitingLeaveEl = null;
        this.waitingLastPayload = null;
        if (this.waitingBlockToken) {
            overlayBlocker.unblock(this.waitingBlockToken);
            this.waitingBlockToken = null;
        }
    }

    hideWaitingOverlay({ reason = 'start' } = {}) {
        this.waitingStarted = true;
        this._teardownWaitingOverlay();
        if (reason === 'start') {
            this.uiPhase = 'playing';
        }
    }

    updateWaitingOverlay(payload = {}, forcedOwnerId = null) {
        if (!this.customNamespace) return;
        if (payload?.started || this.waitingStarted) {
            this.onRoomStarted();
            return;
        }
        this.waitingLastPayload = payload || this.waitingLastPayload || {};
        if (!this.waitingRoot) this.createWaitingOverlay();

        const players = payload.players || this.waitingLastPayload.players || [];
        const count = payload.count ?? players.length ?? 0;
        const ownerId = forcedOwnerId || payload.ownerId || this.waitingLastPayload.ownerId || null;
        const roomCode = payload.roomCode || this.waitingLastPayload.roomCode || this.customNamespace?.split('/')?.pop() || '';

        if (this.waitingHeaderEl) {
            this.waitingHeaderEl.textContent = `Room ${roomCode} · ${count}/30 players`;
        }
        if (this.waitingOwnerBadge) {
            this.waitingOwnerBadge.textContent = ownerId ? `Owner: ${ownerId}` : 'Owner: n/a';
        }

        const isOwner = !!(ownerId && this.localSocketId && ownerId === this.localSocketId);
        if (this.waitingStartEl) {
            const showBtn = isOwner && !this.waitingStarted;
            this.waitingStartEl.style.display = showBtn ? 'inline-flex' : 'none';
            this.waitingStartEl.disabled = this.waitingStarted;
        }

        this.renderWaitingPlayers(players, { ownerId, isOwner });

        if (!this.waitingBlockToken) {
            this.waitingBlockToken = overlayBlocker.block('waiting-room');
        }
        this.uiPhase = 'waiting';
    }

    renderWaitingPlayers(players = [], { ownerId = null, isOwner = false } = {}) {
        if (!this.waitingListEl) return;
        this.waitingListEl.innerHTML = '';
        if (!players || players.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'waiting-player waiting-player--empty';
            empty.textContent = 'Waiting for players...';
            this.waitingListEl.appendChild(empty);
            return;
        }

        players.forEach((p) => {
            const row = document.createElement('div');
            row.className = 'waiting-player';

            const avatar = document.createElement('div');
            avatar.className = 'waiting-player__avatar';
            avatar.textContent = (p.name || 'P')[0].toUpperCase();

            const meta = document.createElement('div');
            meta.className = 'waiting-player__meta';
            meta.innerHTML = `
                <div class=\"waiting-player__name\">${p.name || 'Player'}</div>
                <div class=\"waiting-player__id\">${p.id || ''}</div>
            `;

            row.appendChild(avatar);
            row.appendChild(meta);

            if (isOwner && p.id !== this.localSocketId) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'waiting-btn waiting-btn--ghost';
                kickBtn.textContent = 'Kick';
                kickBtn.onclick = () => this.kickPlayer(p.id);
                row.appendChild(kickBtn);
            } else if (ownerId && p.id === ownerId) {
                const badge = document.createElement('span');
                badge.className = 'waiting-player__owner-pill';
                badge.textContent = 'Owner';
                row.appendChild(badge);
            }

            this.waitingListEl.appendChild(row);
        });
    }

    emitRoomStart() {
        if (!this.customNamespace) return;
        if (this.waitingStartEl) {
            this.waitingStartEl.disabled = true;
            this.time.delayedCall(800, () => {
                if (this.waitingStartEl) this.waitingStartEl.disabled = false;
            });
        }
        const gameScene = this.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        socket?.emit('roomStart');
    }

    leaveRoom() {
        if (!this.customNamespace) {
            this.returnToMenu('leave');
            return;
        }
        if (this._leavingRoom) return;
        this._leavingRoom = true;

        const gameScene = this.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        if (socket) {
            socket.emit('leaveLobby');
        }
        // The server will disconnect us; also locally transition
        this.returnToMenu('leave');
    }

    kickPlayer(targetId) {
        if (!targetId || !this.customNamespace) return;
        const gameScene = this.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        socket?.emit('kickPlayer', targetId);
    }

    // --- Result Overlay ---
    showResultOverlay(payload = {}) {
        // Always block input
        this._teardownWaitingOverlay();
        this.uiPhase = 'result';
        this.resultBlockToken = overlayBlocker.block('result');

        if (this.resultOverlay) this.resultOverlay.destroy(true);
        this.resultButtons = [];

        const { width, height } = this.scale;
        const container = this.add.container(width / 2, height / 2).setDepth(3000);
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0.5);
        container.add(bg);

        const panelW = Math.min(600, width - 80);
        const panelH = 360;
        const panel = this.add.graphics();
        panel.fillStyle(0x111827, 0.95);
        panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        panel.lineStyle(2, 0x4b5563, 1);
        panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        container.add(panel);

        const title = this.add.text(0, -panelH / 2 + 30, 'RESULT', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#e5e7eb',
        }).setOrigin(0.5);
        container.add(title);

        const winner = payload.winner;
        const winnerText = this.add.text(0, -60, winner
            ? `Winner: ${winner.name || 'Unknown'} (${winner.questionsSolved || 0} solved)`
            : 'No winner', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '20px',
            color: '#fcd34d',
        }).setOrigin(0.5);
        container.add(winnerText);

        const myId = this.localSocketId;
        const me = (payload.players || []).find((p) => p.id === myId);
        const mySolved = me?.questionsSolved ?? 0;
        const myScore = me?.score ?? 0;

        const stats = this.add.text(0, 0, `Your solved: ${mySolved}\nYour score: ${myScore}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '18px',
            color: '#e5e7eb',
            align: 'center',
        }).setOrigin(0.5);
        container.add(stats);

        const listY = 80;
        const topList = (payload.players || []).slice(0, 5).map((p, idx) =>
            `${idx + 1}. ${p.name || 'Player'} — ${p.questionsSolved || 0} solved, ${p.score || 0} pts`
        ).join('\n');
        const listText = this.add.text(0, listY, topList || 'No players', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '16px',
            color: '#cbd5e1',
            align: 'center',
            lineSpacing: 4,
        }).setOrigin(0.5);
        container.add(listText);

        const btnY = panelH / 2 - 50;
        const makeBtn = (x, label, color, handler) => {
            const rect = this.add.rectangle(x, btnY, 150, 44, color, 0.9)
                .setStrokeStyle(2, Phaser.Display.Color.IntegerToColor(color).darken(20).color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', handler);
            const txt = this.add.text(x, btnY, label, {
                fontFamily: '"Outfit", sans-serif',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#0b0f16',
            }).setOrigin(0.5);
            container.add(rect);
            container.add(txt);
            this.resultButtons.push(rect, txt);
        };

        if (payload.mode === 'custom') {
            makeBtn(0, 'MAIN MENU', 0xf59e0b, () => this.returnToMenu('result'));
        } else {
            makeBtn(-90, 'PLAY AGAIN', 0x22c55e, () => this.hideResultOverlay('restart'));
            makeBtn(90, 'MAIN MENU', 0xf59e0b, () => this.returnToMenu('result'));
        }

        this.resultOverlay = container;
    }

    hideResultOverlay(reason = 'continue') {
        if (this.resultOverlay) {
            this.resultOverlay.destroy(true);
            this.resultOverlay = null;
            this.resultButtons = [];
        }
        if (this.resultBlockToken) {
            overlayBlocker.unblock(this.resultBlockToken);
            this.resultBlockToken = null;
        }
        if (reason === 'menu') {
            this.uiPhase = 'idle';
        } else {
            this.uiPhase = 'playing';
        }
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
