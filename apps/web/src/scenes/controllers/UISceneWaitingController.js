import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { GAME_PHASE } from '../../core/state/GamePhases';

export class UISceneWaitingController {
    createWaitingOverlay(uiScene) {
        if (!uiScene.customNamespace || uiScene.waitingRoot) return;
        if (!uiScene.waitingBlockToken) {
            uiScene.waitingBlockToken = overlayBlocker.block('waiting-room');
        }

        const root = document.createElement('div');
        root.className = 'waiting-overlay';
        root.innerHTML = `
            <div class="waiting-overlay__backdrop"></div>
            <div class="waiting-overlay__panel">
                <div class="waiting-overlay__header">
                    <div>
                        <div class="waiting-overlay__eyebrow">Waiting Room</div>
                        <div class="waiting-overlay__title" data-room-title>Loading room…</div>
                    </div>
                    <div class="waiting-overlay__owner" data-owner>Owner: —</div>
                </div>
                <div class="waiting-overlay__list" data-player-list></div>
                <div class="waiting-overlay__controls">
                    <button class="waiting-btn waiting-btn--danger" data-action="leave">Leave Room</button>
                    <div class="waiting-overlay__spacer"></div>
                    <button class="waiting-btn waiting-btn--primary" data-action="start">Start Match</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        uiScene.waitingRoot = root;
        uiScene.waitingListEl = root.querySelector('[data-player-list]');
        uiScene.waitingHeaderEl = root.querySelector('[data-room-title]');
        uiScene.waitingOwnerBadge = root.querySelector('[data-owner]');
        uiScene.waitingStartEl = root.querySelector('[data-action="start"]');
        uiScene.waitingLeaveEl = root.querySelector('[data-action="leave"]');

        if (uiScene.waitingLeaveEl) uiScene.waitingLeaveEl.onclick = () => this.leaveRoom(uiScene);
        if (uiScene.waitingStartEl) uiScene.waitingStartEl.onclick = () => this.emitRoomStart(uiScene);
        uiScene.uiPhase = 'waiting';
    }

    teardownWaitingOverlay(uiScene) {
        if (uiScene.waitingRoot) {
            uiScene.waitingRoot.remove();
        }
        uiScene.waitingRoot = null;
        uiScene.waitingListEl = null;
        uiScene.waitingHeaderEl = null;
        uiScene.waitingOwnerBadge = null;
        uiScene.waitingStartEl = null;
        uiScene.waitingLeaveEl = null;
        uiScene.waitingLastPayload = null;
        if (uiScene.waitingBlockToken) {
            overlayBlocker.unblock(uiScene.waitingBlockToken);
            uiScene.waitingBlockToken = null;
        }
    }

    hideWaitingOverlay(uiScene, { reason = 'start' } = {}) {
        uiScene.waitingStarted = true;
        this.teardownWaitingOverlay(uiScene);
        if (reason === 'start') {
            uiScene.uiPhase = 'playing';
        }
    }

    updateWaitingOverlay(uiScene, payload = {}, forcedOwnerId = null) {
        if (!uiScene.customNamespace) return;
        if (payload?.started || uiScene.waitingStarted) {
            uiScene.onRoomStarted();
            return;
        }
        uiScene.waitingLastPayload = payload || uiScene.waitingLastPayload || {};
        if (!uiScene.waitingRoot) this.createWaitingOverlay(uiScene);

        const players = payload.players || uiScene.waitingLastPayload.players || [];
        const count = payload.count ?? players.length ?? 0;
        const ownerId = forcedOwnerId || payload.ownerId || uiScene.waitingLastPayload.ownerId || null;
        const roomCode = payload.roomCode || uiScene.waitingLastPayload.roomCode || uiScene.customNamespace?.split('/')?.pop() || '';

        if (uiScene.waitingHeaderEl) {
            uiScene.waitingHeaderEl.textContent = `Room ${roomCode} · ${count}/30 players`;
        }
        if (uiScene.waitingOwnerBadge) {
            uiScene.waitingOwnerBadge.textContent = ownerId ? `Owner: ${ownerId}` : 'Owner: n/a';
        }

        const isOwner = !!(ownerId && uiScene.localSocketId && ownerId === uiScene.localSocketId);
        if (uiScene.waitingStartEl) {
            const showBtn = isOwner && !uiScene.waitingStarted;
            uiScene.waitingStartEl.style.display = showBtn ? 'inline-flex' : 'none';
            uiScene.waitingStartEl.disabled = uiScene.waitingStarted;
        }

        this.renderWaitingPlayers(uiScene, players, { ownerId, isOwner });

        if (!uiScene.waitingBlockToken) {
            uiScene.waitingBlockToken = overlayBlocker.block('waiting-room');
        }
        uiScene.uiPhase = 'waiting';
        uiScene.setGamePhase(GAME_PHASE.WAITING_ROOM);
    }

    renderWaitingPlayers(uiScene, players = [], { ownerId = null, isOwner = false } = {}) {
        if (!uiScene.waitingListEl) return;
        uiScene.waitingListEl.innerHTML = '';
        if (!players || players.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'waiting-player waiting-player--empty';
            empty.textContent = 'Waiting for players...';
            uiScene.waitingListEl.appendChild(empty);
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
                <div class="waiting-player__name">${p.name || 'Player'}</div>
                <div class="waiting-player__id">${p.id || ''}</div>
            `;

            row.appendChild(avatar);
            row.appendChild(meta);

            if (isOwner && p.id !== uiScene.localSocketId) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'waiting-btn waiting-btn--ghost';
                kickBtn.textContent = 'Kick';
                kickBtn.onclick = () => this.kickPlayer(uiScene, p.id);
                row.appendChild(kickBtn);
            } else if (ownerId && p.id === ownerId) {
                const badge = document.createElement('span');
                badge.className = 'waiting-player__owner-pill';
                badge.textContent = 'Owner';
                row.appendChild(badge);
            }

            uiScene.waitingListEl.appendChild(row);
        });
    }

    emitRoomStart(uiScene) {
        if (!uiScene.customNamespace) return;
        if (uiScene.waitingStartEl) {
            uiScene.waitingStartEl.disabled = true;
            uiScene.time.delayedCall(800, () => {
                if (uiScene.waitingStartEl) uiScene.waitingStartEl.disabled = false;
            });
        }
        const gameScene = uiScene.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        socket?.emit('roomStart');
    }

    leaveRoom(uiScene) {
        if (!uiScene.customNamespace) {
            uiScene.returnToMenu('leave');
            return;
        }
        if (uiScene._leavingRoom) return;
        uiScene._leavingRoom = true;

        const gameScene = uiScene.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        if (socket) {
            socket.emit('leaveLobby');
        }
        // The server will disconnect us; also locally transition
        uiScene.returnToMenu('leave');
    }

    kickPlayer(uiScene, targetId) {
        if (!targetId || !uiScene.customNamespace) return;
        const gameScene = uiScene.scene.get('Game');
        const socket = gameScene?.networkManager?.socket;
        socket?.emit('kickPlayer', targetId);
    }
}