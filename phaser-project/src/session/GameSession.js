import { NetworkManager } from '../network/NetworkManager';
import { CONFIG } from '../config/constants';
import { GameState } from './GameState';
import { EntityManager } from '../world/EntityManager';
import { InputController } from '../realtime/InputController';
import { CommandQueue } from '../realtime/CommandQueue';
import { createPlayerInputCommand, createUseItemCommand } from '../realtime/commands';

export class GameSession {
    constructor(scene, { mode, playerDetails } = {}) {
        this.scene = scene;
        this.mode = mode || CONFIG.GAME_MODES.NORMAL;
        this.playerDetails = playerDetails || { color: undefined, name: undefined };

        this.gameState = null;
        this.entityManager = null;
        this.inputController = null;
        this.commandQueue = null;
        this.networkManager = null;

        this._reconcileFlags = null;
        this._bindings = [];

        this._lastFoodsVersionApplied = 0;

        // Server-authoritative GameOver watchdog
        this._didStartGameOver = false;
        this._hasSeenLocalPlayerInState = false;
        this._localMissingSinceMs = null;

        // Interpolation buffers (worldDelta)
        this._lastServerTickBuffered = 0;
        this._playerSamples = new Map(); // playerId -> [{t,x,y,r}]

        this.minimapTimer = null;
    }

    start() {
        // State + managers
        this.gameState = new GameState({ mode: this.mode });
        this.entityManager = new EntityManager(this.scene, this.gameState);
        this.inputController = new InputController(this.scene);
        this.commandQueue = new CommandQueue();

        // Expose for backward compatibility (other code expects these fields on the Scene)
        this.scene.gameState = this.gameState;
        this.scene.entityManager = this.entityManager;
        this.scene.inputController = this.inputController;
        this.scene.commandQueue = this.commandQueue;

        this.networkManager = new NetworkManager(this.scene, this.gameState);
        this.scene.networkManager = this.networkManager;
        this.networkManager.connect(this.mode, {
            color: this.playerDetails.color,
            name: this.playerDetails.name
        });

        // State-driven reconciliation
        this._reconcileFlags = {
            playersReset: false,
            playersUpdate: false,
            foods: false
        };

        this._lastFoodsVersionApplied = this.gameState ? this.gameState.getFoodsVersion() : 0;

        this._bind(this.scene.events, 'state:players:reset', () => {
            this._reconcileFlags.playersReset = true;
        });
        this._bind(this.scene.events, 'state:players:update', () => {
            this._reconcileFlags.playersUpdate = true;
        });
        this._bind(this.scene.events, 'state:foods:reconcile', () => {
            this._reconcileFlags.foods = true;
        });
        this._bind(this.scene.events, 'state:foodEaten', (payload) => this.entityManager.onFoodEatenVisual(payload));
        this._bind(this.scene.events, 'state:localDied', (payload) => {
            this.startGameOverOnce(payload);
        });

        // UI-driven intents
        this._bind(this.scene.events, 'intent:useItem', (itemId) => {
            if (!itemId) return;
            this.commandQueue.enqueue(createUseItemCommand({ itemId, ts: Date.now() }));
        });

        this._startMinimapLoop();
    }

    tick(time, delta) {
        this._tickLocalDeathWatchdog();

        // worldDelta smoothing (opt-in)
        this._tickWorldDeltaInterpolation();

        // Self-healing: if food state changed but the event was missed, still reconcile
        if (this.gameState) {
            const foodsVersion = this.gameState.getFoodsVersion();
            if (foodsVersion !== this._lastFoodsVersionApplied) {
                this._reconcileFlags.foods = true;
            }
        }

        // Apply state-driven reconciliation at most once per frame
        if (this.entityManager && this._reconcileFlags) {
            if (this._reconcileFlags.playersReset) {
                this.entityManager.resetPlayersFromState();
                this._reconcileFlags.playersReset = false;
                // Reset implies we should also apply latest snapshot right after
                this._reconcileFlags.playersUpdate = false;
            } else if (this._reconcileFlags.playersUpdate) {
                this.entityManager.applyPlayerSnapshotsFromState();
                this._reconcileFlags.playersUpdate = false;
            }

            if (this._reconcileFlags.foods) {
                this.entityManager.reconcileFoodsFromState();
                this._reconcileFlags.foods = false;
                this._lastFoodsVersionApplied = this.gameState ? this.gameState.getFoodsVersion() : 0;
            }
        }

        // Build input intent -> command queue -> network
        if (this.inputController && this.commandQueue && this.networkManager) {
            const intent = this.inputController.getPlayerInputIntent();
            if (intent) {
                this.commandQueue.enqueue(createPlayerInputCommand({
                    angle: intent.angle,
                    isBoosting: intent.isBoosting,
                    ts: time
                }));
            }
            this.commandQueue.flush({ networkManager: this.networkManager });
        }
    }

    destroy() {
        if (this.minimapTimer) {
            this.scene.time.removeEvent(this.minimapTimer);
            this.minimapTimer = null;
        }

        // Unbind scene event listeners
        for (const { emitter, event, handler } of this._bindings) {
            emitter.off(event, handler);
        }
        this._bindings = [];

        if (this.networkManager) {
            const disconnectSocket = !this.scene.keepSocketAlive;
            this.networkManager.disconnect({ disconnectSocket });
        }

        // Keep properties on scene consistent with previous shutdown behavior
        this.scene.networkManager = null;
        this.scene.entityManager = null;
        this.scene.inputController = null;
        this.scene.commandQueue = null;

        // Note: we don't force disconnect the underlying socket here to preserve existing GameOver flow.
        this.networkManager = null;

        if (this.gameState) {
            this.gameState.resetForNewRound({ mode: this.mode });
        }
        this.gameState = null;
        this.entityManager = null;
        this.inputController = null;
        this.commandQueue = null;
        this._reconcileFlags = null;
        this._lastFoodsVersionApplied = 0;

        this._didStartGameOver = false;
        this._hasSeenLocalPlayerInState = false;
        this._localMissingSinceMs = null;

        this._lastServerTickBuffered = 0;
        this._playerSamples.clear();
    }

    startGameOverOnce(payload = {}) {
        if (this._didStartGameOver) return;
        this._didStartGameOver = true;

        // Prevent Game scene update from continuing mid-frame after teardown
        if (this.scene) this.scene._isExiting = true;

        // Preserve existing GameOver flow
        if (this.scene) this.scene.keepSocketAlive = true;

        // UIScene runs in parallel with Game; ensure it stops during GameOver transition.
        if (this.scene && this.scene.scene && this.scene.scene.stop) {
            this.scene.scene.stop(CONFIG.SCENES.UI);
        }

        // If scene is already not active (shutdown in progress), don't attempt transition.
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) return;

        this.scene.scene.start(CONFIG.SCENES.GAME_OVER, payload);
    }

    _tickWorldDeltaInterpolation() {
        if (!this.gameState) return;
        if (!CONFIG.NETWORK || !CONFIG.NETWORK.USE_WORLD_DELTA) return;

        const serverTick = this.gameState.serverTick;
        const serverTime = this.gameState.serverTime;
        if (!serverTick || !serverTime) return;

        // Buffer new samples only when we receive a new authoritative tick
        if (serverTick !== this._lastServerTickBuffered) {
            this._lastServerTickBuffered = serverTick;

            for (const [id, p] of this.gameState.players.entries()) {
                if (!p) continue;
                const arr = this._playerSamples.get(id) || [];
                const last = arr.length ? arr[arr.length - 1] : null;
                if (!last || last.t !== serverTime) {
                    arr.push({
                        t: serverTime,
                        x: p.x,
                        y: p.y,
                        r: p.rotation
                    });
                    // Keep buffer small
                    if (arr.length > 30) arr.splice(0, arr.length - 30);
                    this._playerSamples.set(id, arr);
                }
            }

            // Remove buffers for players that are no longer in authoritative state
            for (const id of Array.from(this._playerSamples.keys())) {
                if (!this.gameState.players.has(id)) this._playerSamples.delete(id);
            }
        }

        // Compute render timestamp on server clock
        const delayMs = CONFIG.NETWORK.INTERPOLATION_DELAY_MS ?? 100;
        const estimatedServerNow = Date.now() + (this.gameState.serverTimeOffsetMs || 0);
        const renderT = estimatedServerNow - delayMs;

        for (const [id, p] of this.gameState.players.entries()) {
            const samples = this._playerSamples.get(id);
            if (!samples || samples.length === 0) continue;

            // Find a,b such that a.t <= renderT <= b.t
            let a = samples[0];
            let b = samples[samples.length - 1];

            for (let i = samples.length - 2; i >= 0; i--) {
                const s0 = samples[i];
                const s1 = samples[i + 1];
                if (s0.t <= renderT && renderT <= s1.t) {
                    a = s0;
                    b = s1;
                    break;
                }
                if (renderT > s1.t) {
                    a = s1;
                    b = s1;
                    break;
                }
            }

            const span = b.t - a.t;
            const t = span > 0 ? (renderT - a.t) / span : 0;
            const clampedT = t < 0 ? 0 : (t > 1 ? 1 : t);

            p.renderX = a.x + (b.x - a.x) * clampedT;
            p.renderY = a.y + (b.y - a.y) * clampedT;
            p.renderRotation = this._lerpAngle(a.r, b.r, clampedT);
        }
    }

    _lerpAngle(a, b, t) {
        if (typeof a !== 'number' || typeof b !== 'number') return b;
        let diff = b - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return a + diff * t;
    }

    _tickLocalDeathWatchdog() {
        // If we already moved to GameOver, do nothing.
        if (this._didStartGameOver) return;

        // If the scene isn't active anymore, don't attempt transitions.
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) return;

        if (!this.gameState) return;
        const localId = this.gameState.localPlayerId;
        if (!localId) return;

        const isLocalPresent = this.gameState.players.has(localId);
        if (isLocalPresent) {
            this._hasSeenLocalPlayerInState = true;
            this._localMissingSinceMs = null;
            return;
        }

        // Only act after we've actually seen the local player once.
        if (!this._hasSeenLocalPlayerInState) return;

        const now = Date.now();
        if (this._localMissingSinceMs == null) {
            this._localMissingSinceMs = now;
            return;
        }

        // Grace window for transient packet ordering; after that, treat as authoritative death/disconnect.
        if (now - this._localMissingSinceMs < 500) return;

        const score = this.scene.player?.score ?? 0;
        const coins = this.gameState?.coinsCollected ?? this.scene.coinsCollected ?? 0;

        this.startGameOverOnce({ score, coins });
    }

    _startMinimapLoop() {
        // Minimap Food Update Loop (1Hz)
        this.minimapTimer = this.scene.time.addEvent({
            delay: CONFIG.INTERVALS.MINIMAP_UPDATE,
            loop: true,
            callback: () => {
                const uiScene = this.scene.scene.get(CONFIG.SCENES.UI);
                if (!uiScene) return;

                const foodData = this.gameState
                    ? this.gameState.getFoodsArray().map(f => ({
                        x: f.x,
                        y: f.y,
                        type: f.type,
                        color: f.color
                    }))
                    : (this.scene.getFoodChildren ? this.scene.getFoodChildren().map(f => ({
                        x: f.x,
                        y: f.y,
                        type: f.type,
                        color: f.color
                    })) : []);

                uiScene.updateMinimapFood(foodData);
            }
        });

        // Expose for backward compatibility (existing shutdown removed minimapTimer)
        this.scene.minimapTimer = this.minimapTimer;
    }

    _bind(emitter, event, handler) {
        emitter.on(event, handler);
        this._bindings.push({ emitter, event, handler });
    }
}
