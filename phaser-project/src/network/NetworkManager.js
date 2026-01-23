import { socketService } from '../services/SocketService';
import { Logger } from '../utils/Logger';
import { CONFIG } from '../config/constants';
import { effectManager } from '../features/EffectManager';

export class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.pingTimer = null;
        this.lastPingTime = 0;
    }

    sendPlayerInput(angle, isBoosting) {
        if (this.socket) {
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
        this.socket = socketService.connect(serverUrl, { forceNew: true });

        this.setupConnectionEvents(playerDetails);
        this.setupGameplayEvents();
        this.setupPing();

        return this.socket;
    }

    disconnect() {
        if (this.pingTimer) {
            this.scene.time.removeEvent(this.pingTimer);
        }

        if (this.socket) {
            this.socket.removeAllListeners();
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
                name: playerDetails.name
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
        // Player Updates
        this.socket.on('currentPlayers', (players) => this.handleCurrentPlayers(players));
        this.socket.on('newPlayer', (playerInfo) => this.scene.addOtherPlayers(playerInfo));
        this.socket.on('playerDisconnected', (playerId) => this.handlePlayerDisconnect(playerId));
        this.socket.on('playerUpdates', (players) => this.handlePlayerUpdates(players));
        this.socket.on('playerDied', (playerId) => this.handlePlayerDeath(playerId));
        this.socket.on('playerProperties', (data) => this.handlePlayerProperties(data));

        // Food Updates
        this.socket.on('currentFood', (foodData) => this.handleCurrentFood(foodData));
        this.socket.on('newFood', (f) => this.scene.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data));
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
    }

    // --- Handlers (Logic moved from Game.js) ---

    handleCurrentPlayers(players) {
        // Clear existing
        this.scene.snakes.forEach(snake => snake.destroy());
        this.scene.snakes = [];
        this.scene.otherSnakes.clear();
        this.scene.player = null;

        Object.keys(players).forEach((id) => {
            if (players[id].playerId === this.socket.id) {
                this.scene.createPlayer(players[id]);
            } else {
                this.scene.addOtherPlayers(players[id]);
            }
        });
    }

    handlePlayerDisconnect(playerId) {
        if (this.scene.otherSnakes.has(playerId)) {
            const snake = this.scene.otherSnakes.get(playerId);
            snake.destroy();
            this.scene.otherSnakes.delete(playerId);
            this.scene.snakes = this.scene.snakes.filter(s => s !== snake);
        }
    }

    handlePlayerUpdates(players) {
        const scene = this.scene;

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

        Object.keys(players).forEach((id) => {
            // Update Local Player
            if (scene.player && id === this.socket.id) {
                this.updateSnakeState(scene.player, players[id]);

                const uiScene = scene.scene.get(CONFIG.SCENES.UI);
                if (uiScene) {
                    uiScene.updateMinimapPlayer(scene.player.head.x, scene.player.head.y);
                }
            } else {
                // Update Remote Players
                if (scene.otherSnakes.has(id)) {
                    this.updateSnakeState(scene.otherSnakes.get(id), players[id]);
                }
            }
        });
    }

    updateSnakeState(snake, data) {
        snake.targetX = data.x;
        snake.targetY = data.y;
        snake.targetRotation = data.rotation;

        // Score/Length sync w/ smooth growth
        if (data.score > snake.score) {
            snake.addSections(data.score - snake.score);
            snake.score = data.score;
        } else if (data.score < snake.score) {
            const diff = snake.score - data.score;
            for (let i = 0; i < diff; i++) snake.shrink();
            snake.score = data.score;
        }

        // Boosting visual
        if (data.isBoosting) {
            if (snake.shadow) snake.shadow.setLightingUp(true);
            snake.speed = snake.fastSpeed;
        } else {
            if (snake.shadow) snake.shadow.setLightingUp(false);
            snake.speed = snake.slowSpeed;
        }
    }

    handlePlayerDeath(playerId) {
        if (this.scene.player && this.scene.player.playerId === playerId) {
            this.scene.keepSocketAlive = true;
            this.scene.scene.start(CONFIG.SCENES.GAME_OVER, {
                score: this.scene.player.score,
                coins: this.scene.coinsCollected,
                socket: this.socket
            });
        }
    }

    handleCurrentFood(foodData) {
        this.scene.foodGroup.clear(true, true);
        Object.keys(foodData).forEach((id) => {
            const f = foodData[id];
            this.scene.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
        });
    }

    handleFoodEaten(data) {
        const food = this.scene.foodGroup.getChildren().find(f => f.id == data.foodId);
        if (food) {
            let eater = null;
            if (this.scene.player && this.scene.player.playerId === data.playerId) {
                eater = this.scene.player;
            } else if (this.scene.otherSnakes.has(data.playerId)) {
                eater = this.scene.otherSnakes.get(data.playerId);
            }

            if (eater && eater.head) {
                food.magnetTo(eater.head);
                if (eater === this.scene.player && data.type === 'coin') {
                    this.scene.coinsCollected += 10;
                }
            } else {
                food.destroy();
            }
        }
    }

    handleRemoveFood(foodId) {
        const food = this.scene.foodGroup.getChildren().find(f => f.id == foodId);
        if (food) {
            food.destroy();
        }
    }

    handleBatchFood(foodArray) {
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
                this.scene.spawnFood(f.x, f.y, f.color, f.id, f.type, f.value, f.data);
            }
            index = end;

            if (index < foodArray.length) {
                this.scene.staggeredSpawnTimer = this.scene.time.delayedCall(CONFIG.INTERVALS.BATCH_SPAWN, spawnBatch);
            } else {
                this.scene.staggeredSpawnTimer = null;
            }
        };

        spawnBatch();
    }

    handleBatchRemove(ids) {
        const allFood = [...this.scene.foodGroup.getChildren()];
        const idSet = new Set(ids);
        allFood.forEach(food => {
            if (idSet.has(food.id)) {
                food.destroy();
            }
        });
    }

    handleClearQuizFood(foodIds) {
        if (this.scene.staggeredSpawnTimer) {
            this.scene.staggeredSpawnTimer.destroy();
            this.scene.staggeredSpawnTimer = null;
        }
        const allFood = [...this.scene.foodGroup.getChildren()];
        allFood.forEach(food => {
            if (food.type === 'text') {
                food.destroy();
            }
        });
    }

    handlePlayerProperties(data) {
        let snake;
        if (this.scene.player && this.scene.player.playerId === data.id) {
            snake = this.scene.player;
        } else if (this.scene.otherSnakes.has(data.id)) {
            snake = this.scene.otherSnakes.get(data.id);
        }

        if (snake) {
            if (data.color) snake.setColor(data.color);
            if (data.name) snake.setName(data.name);
        }
    }

    handleItemActivated(data) {
        Logger.info('NetworkManager', 'Item Activated:', data);
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            this.scene.events.emit('itemActivated', data);
        }
        let snake;
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            snake = this.scene.player;
        } else if (this.scene.otherSnakes.has(data.playerId)) {
            snake = this.scene.otherSnakes.get(data.playerId);
        }
        if (snake) {
            effectManager.applyEffect(snake, data.itemId, true, data.buffValue);
        }
    }

    handleItemDeactivated(data) {
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            this.scene.events.emit('itemDeactivated', data);
        }
        let snake;
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            snake = this.scene.player;
        } else if (this.scene.otherSnakes.has(data.playerId)) {
            snake = this.scene.otherSnakes.get(data.playerId);
        }
        if (snake) {
            effectManager.applyEffect(snake, data.itemId, false);
        }
    }

    handleAnswerResult(data) {
        this.scene.showFloatingText(data.x, data.y, data.correct ? "CORRECT!" : "WRONG!", data.correct ? CONFIG.UI.TEXT_CORRECT : CONFIG.UI.TEXT_WRONG);
        if (this.scene.player && this.scene.player.playerId === data.playerId) {
            this.scene.events.emit('showToast', {
                message: data.correct ? `Correct! +${data.scoreChange}` : `Wrong! ${data.scoreChange}`,
                color: data.correct ? CONFIG.UI.TOAST_SUCCESS : CONFIG.UI.TOAST_ERROR
            });
        }
    }
}
