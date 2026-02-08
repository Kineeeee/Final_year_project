import { socketService } from '../../core/services/SocketService';
import parser from 'socket.io-msgpack-parser';
import { Logger } from '../../utils/Logger';
import { CONFIG } from '../../config/constants';

export class NetworkManager {
    constructor(scene, gameState = null) {
        this.scene = scene;
        this.gameState = gameState;
        this.socket = null;
        this.pingTimer = null;
        this.lastPingTime = 0;
        this._didEmitLocalDied = false;
    }

    sendPlayerInput(angle, isBoosting) {
        if (this.socket) {
            // DEBUG: Trace Input Send
            // if (Math.random() < 0.01) 
            console.log(`Sending Input: angle=${angle}`);
            this.socket.emit('playerInput', { angle, isBoosting });
        }
    }

    sendUseItem(itemId) {
        if (this.socket) {
            this.socket.emit('useItem', itemId);
        }
    }

    connect(gameMode, playerDetails) {
        let serverUrl = CONFIG.SERVER_URL;
        if (gameMode === CONFIG.GAME_MODES.MATH) serverUrl += '/math';
        if (gameMode === CONFIG.GAME_MODES.ENGLISH) serverUrl += '/english';

        Logger.info('NetworkManager', `Connecting to Server: ${serverUrl}`);
        this.socket = socketService.connect(serverUrl, {
            forceNew: true,
            parser
        });

        this.setupConnectionEvents(playerDetails);
        this.setupGameplayEvents();
        this.setupPing();

        return this.socket;
    }

    disconnect({ disconnectSocket = false } = {}) {
        if (this.pingTimer) {
            this.scene.time.removeEvent(this.pingTimer);
        }

        if (this.socket) {
            this.socket.removeAllListeners();
            if (disconnectSocket) {
                socketService.disconnect();
                this.socket = null;
            }
            // We don't forcefully disconnect socketService here if we want to reuse it, 
            // but the Scene shutdown logic suggests we might want to.
            // For now, remove listeners is key.
            // logic from Game.js:
            /*
            if (!this.keepSocketAlive) {
                socketService.disconnect();
            }
            */
            // We will handle keepAlive logic in the caller or here if we pass flags.
        }
    }

    setupConnectionEvents(playerDetails) {
        // Send initialization data
        this.socket.on('connect', () => {
            Logger.info('NetworkManager', 'Connected to Server');
            const initData = {
                color: playerDetails.color,
                name: playerDetails.name,
                token: localStorage.getItem('token') // SECURITY: Send Token
            };

            const savedInventory = localStorage.getItem('inventory');
            if (savedInventory) {
                try {
                    initData.inventory = JSON.parse(savedInventory);
                } catch (e) {
                    Logger.error('NetworkManager', 'Failed to parse inventory', e);
                }
            }

            this.socket.emit('initPlayer', initData);
        });

        this.socket.on('playerState', (state) => {
            if (state.highScore !== undefined) {
                Logger.info('NetworkManager', `Syncing High Score: ${state.highScore}`);
                localStorage.setItem('highScore', state.highScore);
            }
            if (state.coins !== undefined) {
                localStorage.setItem('coins', state.coins);
                this.scene.events.emit('coinsChanged', state.coins);
            }
            if (state.inventory) {
                localStorage.setItem('inventory', JSON.stringify(state.inventory));
                this.scene.events.emit('updateInventory', state.inventory);
            }
        });
    }

    setupPing() {
        this.pingTimer = this.scene.time.addEvent({
            delay: CONFIG.INTERVALS.PING,
            callback: () => {
                this.lastPingTime = Date.now();
                this.socket.emit('ping');
            },
            loop: true
        });

        this.socket.on('pong', () => {
            const latency = Date.now() - this.lastPingTime;
            this.scene.events.emit('updatePing', latency);
        });
    }

    setupGameplayEvents() {
        // New: server-authoritative deltas (opt-in)
        this.socket.on('worldDelta', (delta) => this.handleWorldDelta(delta));

        // Player Updates
        this.socket.on('currentPlayers', (players) => this.handleCurrentPlayers(players));
        this.socket.on('newPlayer', (playerInfo) => this.handleNewPlayer(playerInfo));
        this.socket.on('playerDisconnected', (playerId) => this.handlePlayerDisconnect(playerId));
        this.socket.on('playerUpdates', (players) => this.handlePlayerUpdates(players));
        this.socket.on('playerDied', (playerId) => this.handlePlayerDeath(playerId));
        this.socket.on('playerProperties', (data) => this.handlePlayerProperties(data));

        // Food Updates
        this.socket.on('currentFood', (foodData) => this.handleCurrentFood(foodData));
        this.socket.on('newFood', (f) => this.handleNewFood(f));
        this.socket.on('foodEaten', (data) => this.handleFoodEaten(data));
        this.socket.on('removeFood', (foodId) => this.handleRemoveFood(foodId));
        this.socket.on('batchFood', (foodArray) => this.handleBatchFood(foodArray));
        this.socket.on('batchRemove', (ids) => this.handleBatchRemove(ids));

        // Items & Shop
        this.socket.on('updateCoins', (newCoins) => {
            localStorage.setItem('coins', newCoins);
            this.scene.events.emit('coinsChanged', newCoins);
        });
        this.socket.on('updateInventory', (inventory) => {
            localStorage.setItem('inventory', JSON.stringify(inventory));
            this.scene.events.emit('updateInventory', inventory);
        });
        this.socket.on('itemActivated', (data) => this.handleItemActivated(data));
        this.socket.on('itemDeactivated', (data) => this.handleItemDeactivated(data));

        // Quiz
        this.socket.on('newQuestion', (data) => this.scene.events.emit('updateQuestion', data));
        this.socket.on('roundStart', (data) => this.scene.events.emit('roundStart', data));
        this.socket.on('roundEnd', (data) => this.scene.events.emit('roundEnd', data));
        this.socket.on('clearQuizFood', (foodIds) => this.handleClearQuizFood(foodIds));
        this.socket.on('answerResult', (data) => this.handleAnswerResult(data));

        // Leaderboard (global, server-authoritative)
        this.socket.on('leaderboard', (payload) => this.handleLeaderboard(payload));
    }

    handleLeaderboard(payload) {
        const top = payload && Array.isArray(payload.top) ? payload.top : [];
        let text = 'Leaderboard:\n';
        top.slice(0, 5).forEach((p, index) => {
            text += `${index + 1}. ${p.name || 'Unknown'}: ${p.score || 0}\n`;
        });
        this.scene.events.emit('updateLeaderboard', text);
    }

    handleWorldDelta(delta) {
        if (!CONFIG.NETWORK || !CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (!this.gameState || !delta) return;

        // Unpack protocol (supports both Array and Object formats)
        let serverTick, serverTime, playersUpsert, playersRemove, foodsUpsert, foodsRemove;

        if (Array.isArray(delta)) {
            // Binary Protocol: [tick, time, pUp, pRem, fUp, fRem, myRank, totalPlayers]
            [serverTick, serverTime, playersUpsert, playersRemove, foodsUpsert, foodsRemove, this.myRank, this.totalPlayers] = delta;
        } else {
            // JSON Protocol (Fallback)
            serverTick = delta.serverTick;
            serverTime = delta.serverTime;
            playersUpsert = delta.playersUpsert;
            playersRemove = delta.playersRemove;
            foodsUpsert = delta.foodsUpsert;
            foodsRemove = delta.foodsRemove;
        }

        if (!this.gameState.localPlayerId && this.socket?.id) {
            this.gameState.setLocalPlayerId(this.socket.id);
        }

        this.gameState.setServerClock({
            serverTick: serverTick,
            serverTime: serverTime,
            offsetAlpha: CONFIG.NETWORK?.SERVER_TIME_OFFSET_ALPHA
        });

        // Players upsert/remove (interest-managed)
        if (playersUpsert) {
            if (Array.isArray(delta)) {
                // Array format: [id, x, y, rot, score, boost, name, color, activeEffects]
                playersUpsert.forEach(pData => {
                    const [id, x, y, rot, score, isBoosting, name, color, activeEffects] = pData;
                    this.gameState.upsertPlayer(id, {
                        playerId: id, x, y, rotation: rot, score, isBoosting, name, color, activeEffects
                    });

                    // Emit Score Update for Local Player
                    if (this.gameState && id === this.gameState.localPlayerId) {
                        this.scene.events.emit('updateScore', score);
                    }
                });
            } else {
                // Object format
                Object.keys(playersUpsert).forEach((id) => {
                    this.gameState.upsertPlayer(id, { playerId: id, ...playersUpsert[id] });
                });
            }
        }

        if (playersRemove) {
            playersRemove.forEach((id) => this.gameState.removePlayer(id));
        }

        // Foods upsert/remove (interest-managed)
        if (foodsUpsert) {
            if (Array.isArray(delta)) {
                // Array format: [id, x, y, type, value, color, data]
                foodsUpsert.forEach(fData => {
                    const [id, x, y, type, value, color, data] = fData;
                    this.gameState.upsertFood({ id, x, y, type, value, color, data });
                });
            } else {
                // Object format
                Object.keys(foodsUpsert).forEach((id) => {
                    const f = foodsUpsert[id];
                    if (!f) return;
                    this.gameState.upsertFood({
                        id: f.id || id,
                        x: f.x,
                        y: f.y,
                        color: f.color,
                        type: f.type,
                        value: f.value,
                        data: f.data
                    });
                });
            }
        }

        if (foodsRemove) {
            foodsRemove.forEach((id) => this.gameState.removeFood(id));
        }

        // Drive rendering via state events
        this.scene.events.emit('state:players:update');
        this.scene.events.emit('state:foods:reconcile');

        // Emit Rank Update
        if (this.myRank !== undefined) {
            this.scene.events.emit('updateRank', { rank: this.myRank, total: this.totalPlayers });
        }
    }

    _emitLeaderboardFromState() {
        if (!this.gameState) return;
        const players = Array.from(this.gameState.players.values());
        const top = players
            .map(p => ({ name: p.name || 'Unknown', score: p.score || 0 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        let text = 'Leaderboard:\n';
        top.forEach((p, index) => {
            text += `${index + 1}. ${p.name}: ${p.score}\n`;
        });
        this.scene.events.emit('updateLeaderboard', text);
    }

    // --- Handlers (Logic moved from Game.js) ---

    handleCurrentPlayers(players) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState) {
            this.gameState.setLocalPlayerId(this.socket.id);
            this.gameState.setAllPlayers(players);
        }

        // Rebuild entities from state
        this.scene.events.emit('state:players:reset');
    }

    handleNewPlayer(playerInfo) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState && playerInfo && playerInfo.playerId) {
            this.gameState.upsertPlayer(playerInfo.playerId, playerInfo);
        }
        this.scene.events.emit('state:players:update');
    }

    handlePlayerDisconnect(playerId) {
        const localId = this.gameState?.localPlayerId || this.socket?.id;
        const isLocal = playerId === localId;

        // Capture last-known score before removal for GameOver payload
        const lastScore = this.gameState?.players.get(playerId)?.score ?? this.scene.player?.score ?? 0;
        const coins = this.gameState?.coinsCollected ?? this.scene.coinsCollected ?? 0;

        if (this.gameState) {
            this.gameState.removePlayer(playerId);
        }

        // Fallback: if server couldn't deliver 'playerDied' (disconnect race), still transition to GameOver
        if (isLocal && !this._didEmitLocalDied) {
            this._didEmitLocalDied = true;
            this.scene.events.emit('state:localDied', { score: lastScore, coins, socket: this.socket });
            return;
        }

        this.scene.events.emit('state:players:update');
    }

    handlePlayerUpdates(players) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        const scene = this.scene;

        if (this.gameState) {
            Object.keys(players).forEach((id) => {
                this.gameState.upsertPlayer(id, players[id]);

                // Emit Score Update
                if (id === this.gameState.localPlayerId) {
                    this.scene.events.emit('updateScore', players[id].score);
                }
            });
        }

        // Leaderboard Construction
        // We map the update packet to a list that includes resolved names
        const playerList = Object.keys(players).map(id => {
            const data = players[id];
            let name = data.name || 'Unknown';

            // Try to resolve name from local entities if missing in packet
            if (scene.player && scene.player.playerId === id) {
                name = scene.player.name;
            } else if (scene.otherSnakes.has(id)) {
                name = scene.otherSnakes.get(id).name;
            }

            return { name, score: data.score };
        });

        const sortedPlayers = playerList.sort((a, b) => b.score - a.score).slice(0, 5);
        let text = 'Leaderboard:\n';
        sortedPlayers.forEach((p, index) => {
            text += `${index + 1}. ${p.name}: ${p.score}\n`;
        });
        scene.events.emit('updateLeaderboard', text);

        // Apply snapshot to entities via EntityManager
        scene.events.emit('state:players:update');
    }

    handlePlayerDeath(playerId) {
        const localId = this.gameState?.localPlayerId || this.socket?.id;
        if (playerId === localId) {
            this._didEmitLocalDied = true;
            const score = this.gameState?.players.get(localId)?.score ?? this.scene.player?.score ?? 0;
            const coins = this.gameState?.coinsCollected ?? this.scene.coinsCollected ?? 0;
            this.scene.events.emit('state:localDied', { score, coins, socket: this.socket });
        } else {
            if (this.gameState) this.gameState.removePlayer(playerId);
            this.scene.events.emit('state:players:update');
        }
    }

    handleCurrentFood(foodData) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState) {
            this.gameState.setAllFoods(foodData);
        }

        this.scene.events.emit('state:foods:reconcile');
    }

    handleNewFood(f) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState) {
            this.gameState.upsertFood({
                id: f.id,
                x: f.x,
                y: f.y,
                color: f.color,
                type: f.type,
                value: f.value,
                data: f.data
            });
        }
        this.scene.events.emit('state:foods:reconcile');
    }

    handleFoodEaten(data) {
        // Visual magnet is entity-side, but we keep it driven by server event
        this.scene.events.emit('state:foodEaten', data);

        // IMPORTANT: Server removes eaten food silently (doesn't emit removeFood).
        // So the client must remove it from GameState here to avoid accumulating stale foods.
        if (this.gameState && data && data.foodId) {
            this.gameState.removeFood(data.foodId);
            this.scene.events.emit('state:foods:reconcile');
        }

        // Session coin counter is state-owned
        const localId = this.gameState?.localPlayerId || this.socket?.id;
        if (this.gameState && data.playerId === localId && data.type === 'coin') {
            this.gameState.coinsCollected += 10;
            // Keep existing field for compatibility in GameOver payload
            this.scene.coinsCollected = this.gameState.coinsCollected;
        }
    }

    handleRemoveFood(foodId) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState) {
            this.gameState.removeFood(foodId);
        }
        this.scene.events.emit('state:foods:reconcile');
    }

    handleBatchFood(foodArray) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        // Cancel any previous staggered spawn
        if (this.scene.staggeredSpawnTimer) {
            this.scene.staggeredSpawnTimer.destroy();
            this.scene.staggeredSpawnTimer = null;
        }

        const BATCH_SIZE = CONFIG.BATCH.SPAWN_SIZE;
        let index = 0;

        const spawnBatch = () => {
            const end = Math.min(index + BATCH_SIZE, foodArray.length);
            for (let i = index; i < end; i++) {
                const f = foodArray[i];
                if (this.gameState) {
                    this.gameState.upsertFood({
                        id: f.id,
                        x: f.x,
                        y: f.y,
                        color: f.color,
                        type: f.type,
                        value: f.value,
                        data: f.data
                    });
                }
                // Defer entity creation to reconciliation
            }
            index = end;

            this.scene.events.emit('state:foods:reconcile');

            if (index < foodArray.length) {
                this.scene.staggeredSpawnTimer = this.scene.time.delayedCall(CONFIG.INTERVALS.BATCH_SPAWN, spawnBatch);
            } else {
                this.scene.staggeredSpawnTimer = null;
            }
        };

        spawnBatch();
    }

    handleBatchRemove(ids) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.gameState) {
            ids.forEach(id => this.gameState.removeFood(id));
        }
        this.scene.events.emit('state:foods:reconcile');
    }

    handleClearQuizFood(foodIds) {
        if (CONFIG.NETWORK && CONFIG.NETWORK.USE_WORLD_DELTA) return;
        if (this.scene.staggeredSpawnTimer) {
            this.scene.staggeredSpawnTimer.destroy();
            this.scene.staggeredSpawnTimer = null;
        }
        if (this.gameState) {
            // Best-effort: remove all quiz foods we know about by type
            for (const [id, f] of this.gameState.foods.entries()) {
                if (f.type === 'text') this.gameState.removeFood(id);
            }
        }
        this.scene.events.emit('state:foods:reconcile');
    }

    handlePlayerProperties(data) {
        if (this.gameState && data && data.id) {
            this.gameState.upsertPlayer(data.id, data);
        }
        this.scene.events.emit('state:players:update');
    }

    handleItemActivated(data) {
        Logger.info('NetworkManager', 'Item Activated:', data);
        this.scene.events.emit('game:itemActivated', data);
    }

    handleItemDeactivated(data) {
        this.scene.events.emit('game:itemDeactivated', data);
    }

    handleAnswerResult(data) {
        this.scene.events.emit('ui:floatingText', {
            x: data.x,
            y: data.y,
            message: data.correct ? "CORRECT!" : "WRONG!",
            color: data.correct ? CONFIG.UI.TEXT_CORRECT : CONFIG.UI.TEXT_WRONG
        });

        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            this.scene.events.emit('showToast', {
                message: data.correct ? `Correct! +${data.scoreChange}` : `Wrong! ${data.scoreChange}`,
                color: data.correct ? CONFIG.UI.TOAST_SUCCESS : CONFIG.UI.TOAST_ERROR
            });
        }
    }
}
