const Logger = require('../../utils/Logger');
const RedisClient = require('../../infra/database/RedisConnection');
const AuthService = require('../../modules/auth/AuthService');
const { SOCKET_EVENT } = require('../../events/EventTypes');
const UserQuiz = require('../../models/UserQuiz');
const RoomRegistry = require('../../modules/room/RoomRegistry');
const { ROOM_LIFECYCLE } = require('../GamePhases');
const {
    validatePlayerInput,
    validateInitPlayerPayload,
    validateEquipCosmeticPayload,
    validateSocketId,
} = require('../../utils/Validation');

class NetworkSystem {
    constructor(io, container, config) {
        this.io = io;
        this.container = container;
        this.config = config;
    }

    get playerManager() { return this.container.get('playerManager'); }
    get foodManager() { return this.container.get('foodManager'); }
    get shopManager() { return this.container.get('shopManager'); }
    get spawnManager() { return this.container.get('spawnManager'); }
    get quizManager() { return this.container.has('quizManager') ? this.container.get('quizManager') : null; }

    async initialize() {
        // Attach listeners immediately to avoid races; connect to Redis in background
        RedisClient.connect().catch((err) => {
            Logger.error('NetworkSystem', 'Redis connect failed', err);
        });

        this.io.on(SOCKET_EVENT.CONNECTION, (socket) => this.handleConnection(socket));
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        const bus = this.container.get('eventBus');

        // Player Events
        bus.on('playerDied', (data) => this.io.emit('playerDied', data));
        bus.on('playerDisconnected', (id) => this.io.emit('playerDisconnected', id));
        bus.on('playerProperties', (data) => this.io.emit('playerProperties', data));
        bus.on('resetScores', () => this.io.emit('resetScores'));

        // Private Player Events (Targeted)
        bus.on('updateHighScore', ({ socketId, highScore }) => this.io.to(socketId).emit('updateHighScore', highScore));
        bus.on('updateCoins', ({ socketId, coins }) => this.io.to(socketId).emit('updateCoins', coins));
        bus.on('updateInventory', ({ socketId, inventory }) => this.io.to(socketId).emit('updateInventory', inventory));
        bus.on('playerState', ({ socketId, data }) => this.io.to(socketId).emit('playerState', data));
        bus.on('shopItems', ({ socketId, items }) => this.io.to(socketId).emit('shopItems', items));

        // Food/Items
        bus.on('batchFood', (batch) => this.io.emit('batchFood', batch));
        bus.on('itemDeactivated', (data) => this.io.emit('itemDeactivated', data));
        bus.on('foodEaten', (data) => this.io.emit('foodEaten', data));
        bus.on('notifyPlayerDeath', ({ socketId, data }) => this.io.to(socketId).emit('playerDied', data));

        // NEW: Bot Events
        bus.on('botJoined', (botData) => this.io.emit(SOCKET_EVENT.NEW_PLAYER, botData));
    }

    handleConnection(socket) {
        Logger.info('NetworkSystem', `User connected: ${socket.id}`);

        const gameServer = this.container.get('gameServer');
        if (gameServer && gameServer.closed) {
            socket.emit('room_closed');
            socket.disconnect(true);
            return;
        }

        // Capacity guard: max 30 players per server instance
        const currentPlayers = Object.keys(this.playerManager.getAllPlayers() || {}).length;
        if (currentPlayers >= 30) {
            socket.emit('room_full');
            socket.disconnect(true);
            return;
        }

        // Room Start guard: Prevent mid-game joins for custom rooms
        if (gameServer && gameServer.config?.isCustom && gameServer.matchStarted) {
            socket.emit('room_already_started');
            socket.disconnect(true);
            return;
        }

        // Per-socket interest tracking (used for worldDelta)
        if (!socket.data) socket.data = {};
        socket.data._interest = {
            players: new Set(),
            foods: new Set()
        };

        this.initializePlayer(socket);
        this.sendInitialState(socket);
        this.registerSocketEvents(socket);
    }

    initializePlayer(socket) {
        // Find safe spawn and create player
        const spawnPos = this.spawnManager.getSafeSpawnPosition();
        const player = this.playerManager.addPlayer(socket, spawnPos);

        // Broadcast to others
        socket.broadcast.emit(SOCKET_EVENT.NEW_PLAYER, player);
    }

    sendInitialState(socket) {
        // Send current game state to the new player
        socket.emit(SOCKET_EVENT.CURRENT_PLAYERS, this.playerManager.getAllPlayers());
        socket.emit(SOCKET_EVENT.CURRENT_FOOD, this.foodManager.getAllFood());
        socket.emit(SOCKET_EVENT.SHOP_ITEMS, this.shopManager.getShopItems());

        // Sync Quiz State if active
        if (this.quizManager && this.quizManager.currentQuestion) {
            socket.emit(SOCKET_EVENT.NEW_QUESTION, {
                text: this.quizManager.currentQuestion.questionText,
                difficulty: this.quizManager.currentQuestion.difficulty,
                endTime: this.quizManager.questionEndTime
            });
            socket.emit(SOCKET_EVENT.ROUND_START, {
                endTime: this.quizManager.roundEndTime,
                topic: this.config.topic
            });
        }
    }

    registerSocketEvents(socket) {
        // Disconnect
        socket.on(SOCKET_EVENT.DISCONNECT, () => {
            Logger.info('NetworkSystem', `User disconnected: ${socket.id}`);
            RoomRegistry.clearSocketUser(socket.id);
            if (this.quizManager && socket.data?.user?.userId) {
                this.quizManager.clearUserQuizIfOwner(socket.data.user.userId);
            }
            this.playerManager.removePlayer(socket.id);
            const gameServer = this.container.get('gameServer');
            if (gameServer && gameServer.broadcastWaiting) {
                // RoomRegistry removal is handled at namespace level for custom rooms to avoid double removal
                gameServer.broadcastWaiting();
            }
        });

        // Ping/Pong
        socket.on(SOCKET_EVENT.PING, () => socket.emit(SOCKET_EVENT.PONG));

        // Gameplay
        socket.on(SOCKET_EVENT.PLAYER_INPUT, (inputData) => {
            const gameServer = this.container.get('gameServer');
            if (gameServer && gameServer.config.mode === 'quiz' && !gameServer.matchStarted) {
                return; // ignore inputs before match start/end
            }

            const validatedInput = validatePlayerInput(inputData);
            if (!validatedInput) return;

            // Anti-Spam: Rate Limit (60 packets/sec max)
            const now = Date.now();
            if (!socket.rateLimit) socket.rateLimit = { count: 0, lastCheck: now };

            if (now - socket.rateLimit.lastCheck > 1000) {
                socket.rateLimit.count = 0;
                socket.rateLimit.lastCheck = now;
            }

            socket.rateLimit.count++;
            if (socket.rateLimit.count > 60) {
                return;
            }

            this.playerManager.handlePlayerInput(socket.id, validatedInput);
        });

        socket.on(SOCKET_EVENT.INIT_PLAYER, async (data) => {
            const safeData = validateInitPlayerPayload(data);
            if (!safeData) {
                Logger.warn('NetworkSystem', `Rejected invalid initPlayer payload from ${socket.id}`);
                return;
            }

            // SECURITY: Verify Token if provided
            let finalData = { ...safeData };
            const requestedQuizSource = (safeData.quizSource || 'SYSTEM').toUpperCase();
            socket.data.quizSource = 'SYSTEM';

            const existingAuth = socket.data?.user;

            if (safeData.token) {
                const decoded = AuthService.verifyToken(safeData.token);

                if (decoded) {
                    Logger.info('NetworkSystem', `Authenticated User: ${decoded.username}`);
                    // TRUSTED: Use username from token
                    finalData.name = decoded.username;
                    finalData.username = decoded.username; // Explicitly set verified username

                    // Mark socket as authenticated (optional)
                    socket.data.user = decoded;
                    RoomRegistry.setUserSocket(decoded.userId, socket.id);
                    socket.data.quizSource = 'SYSTEM';

                    // Reclaim ownership if creator rejoins custom room
                    const gameServer = this.container.get('gameServer');
                    if (gameServer?.config?.isCustom && gameServer.config?.roomCode) {
                        try {
                            const RoomRegistry = require('../../modules/room/RoomRegistry');
                            const room = RoomRegistry.getRoom(gameServer.config.roomCode);
                            if (room && room.ownerUserId && room.ownerUserId.toString() === decoded.userId.toString()) {
                                if (room.ownerId !== socket.id) {
                                    room.ownerId = socket.id;
                                    gameServer.config.ownerSocketId = socket.id;
                                    this.io.emit('room_owner', { ownerId: socket.id });
                                }
                            }
                        } catch (err) {
                            Logger.error('NetworkSystem', 'Reclaim owner failed', err);
                        }
                    }

                    // If user requests personal quiz, validate before honoring
                    if (requestedQuizSource === 'USER' && this.config.topic) {
                        try {
                            const quizDoc = await UserQuiz.findOne({
                                userId: decoded.userId,
                                category: this.config.topic,
                            });
                            if (quizDoc && quizDoc.isValid) {
                                socket.data.quizSource = 'USER';
                                if (this.quizManager && typeof this.quizManager.setQuizSource === 'function') {
                                    this.quizManager.setQuizSource({
                                        source: 'user',
                                        userQuiz: quizDoc,
                                        ownerUserId: decoded.userId,
                                    });
                                }
                            } else {
                                socket.emit('quizSourceChanged', {
                                    source: 'SYSTEM',
                                    reason: 'User quiz missing hoặc không hợp lệ',
                                });
                            }
                        } catch (err) {
                            Logger.error('NetworkSystem', 'Error loading user quiz', err);
                            socket.emit('quizSourceChanged', {
                                source: 'SYSTEM',
                                reason: 'Không thể tải đề cá nhân',
                            });
                        }
                    }
                } else {
                    Logger.warn('NetworkSystem', `Invalid Token from ${socket.id}. Falling back to Guest.`);
                    // Invalid Token: Treat as Guest, but sanitize name to prevent spoofing
                    // If they tried to send a registered name without token, we should block or prefix it.
                    // For now, simpler approach: If invalid token, just treat name as display name but NOT username (DB key)
                    delete finalData.username;
                    finalData.name = `Guest_${Math.floor(Math.random() * 1000)}`;
                    if (requestedQuizSource === 'USER') {
                        socket.emit('quizSourceChanged', {
                            source: 'SYSTEM',
                            reason: 'Cần đăng nhập để dùng đề của bạn',
                        });
                    }
                }
            } else if (existingAuth && existingAuth.username) {
                // Keep authenticated identity for this socket when client re-sends initPlayer
                // from non-auth flows (e.g. ShopScene) without token.
                finalData.name = existingAuth.username;
                finalData.username = existingAuth.username;
            } else {
                // No Token: Guest Mode
                // Sanitize: If name looks like a real user, maybe prefix it?
                // Or just ensure PlayerManager treats it as Guest if no 'username' prop is set.
                // PlayerManager uses data.name to set player.username if we aren't careful.

                // We MUST ensure PlayerManager knows this is a Guest.
                // Current PlayerManager logic: 
                // if (data.name) this.players[id].username = data.name; -> THIS IS THE FLAW.

                // FIX: We FORCE a Guest name if no token.
                // Do not allow users to pass arbitrary string names as guest
                finalData.name = `Guest_${Math.floor(Math.random() * 1000)}`;
                delete finalData.username;
                
                if (requestedQuizSource === 'USER') {
                    socket.emit('quizSourceChanged', {
                        source: 'SYSTEM',
                        reason: 'Cần đăng nhập để dùng đề của bạn',
                    });
                }
            }

            this.playerManager.handleInitPlayer(socket.id, finalData);

            const gameServer = this.container.get('gameServer');
            if (gameServer && gameServer.broadcastWaiting) {
                gameServer.broadcastWaiting();
            }
        });

        // Shop
        socket.on(SOCKET_EVENT.BUY_ITEM, (itemId) => {
            this.shopManager.handleBuyItem(socket.id, itemId);
        });

        socket.on(SOCKET_EVENT.USE_ITEM, (itemId) => {
            this.shopManager.handleUseItem(socket.id, itemId);
        });

        // Cosmetics Equip Sync
        socket.on('equip_cosmetic', async (payload) => {
            const validated = validateEquipCosmeticPayload(payload);
            if (!validated) return;
            const { rewardId, category } = validated;

            const player = this.playerManager.players[socket.id];
            if (!player || !player.username || player.username.startsWith('Guest_')) return; // DB only
            
            // Verify Ownership (allow null to unequip)
            if (rewardId !== null && (!player.unlockedRewards || !player.unlockedRewards.includes(rewardId))) {
                Logger.warn('NetworkSystem', `Player ${player.username} attempted to equip unowned reward: ${rewardId}`);
                return;
            }

            try {
                const UserRepository = require('../../repositories/UserRepository');
                const updatedCosmetics = await UserRepository.equipCosmetic(player.username, category, rewardId);
                
                // Update Session State
                player.cosmetics = updatedCosmetics;
                
                // Acknowledge back to client to update their own activeCosmetics explicitly
                socket.emit('playerState', { cosmetics: player.cosmetics });

                // Broadcast change visually to the room Lobby
                this.io.emit('playerProperties', {
                    id: socket.id,
                    color: player.color,
                    name: player.name,
                    cosmetics: player.cosmetics,
                });
                
                Logger.info('NetworkSystem', `Equipped ${rewardId} to ${category} for ${player.username}`);
            } catch (err) {
                Logger.error('NetworkSystem', 'Error equipping cosmetic', err);
            }
        });

        // Leave lobby gracefully
        socket.on('leaveLobby', () => {
            const gameServer = this.container.get('gameServer');
            if (!gameServer || !gameServer.config?.isCustom) {
                socket.disconnect(true);
                return;
            }
            const roomCode = gameServer.config.roomCode;
            const RoomRegistry = require('../../modules/room/RoomRegistry');
            const { ownerChanged, newOwnerId } = RoomRegistry.removeSocket(roomCode, socket.id);
            if (ownerChanged) {
                gameServer.config.ownerSocketId = newOwnerId || null;
                this.io.emit('room_owner', { ownerId: newOwnerId || null });
            }
            socket.emit('room_left');
            socket.disconnect(true);
            if (gameServer.broadcastWaiting) gameServer.broadcastWaiting();
        });

        // Owner can kick players in custom lobby
        socket.on('kickPlayer', (targetId) => {
            const gameServer = this.container.get('gameServer');
            if (!gameServer || !gameServer.config?.isCustom) return;
            if (socket.id !== gameServer.config.ownerSocketId) return;
            const safeTargetId = validateSocketId(targetId);
            if (!safeTargetId) return;
            const targetSocket =
                this.io.sockets?.get?.(safeTargetId) ||
                this.io.sockets?.sockets?.get?.(safeTargetId);
            if (targetSocket) {
                targetSocket.emit('kicked');
                targetSocket.disconnect(true);
            }
            if (gameServer.broadcastWaiting) gameServer.broadcastWaiting();
        });

        // Custom room start (owner only)
        socket.on('roomStart', () => {
            const gameServer = this.container.get('gameServer');
            if (!gameServer || !gameServer.config?.isCustom) return;
            const roomCode = gameServer.config?.roomCode;
            const room = roomCode ? RoomRegistry.getRoom(roomCode) : null;
            if (!room || !room.sockets?.has(socket.id)) return;
            if (socket.id !== gameServer.config.ownerSocketId || socket.id !== room.ownerId) return;
            if (![ROOM_LIFECYCLE.CREATED, ROOM_LIFECYCLE.WAITING].includes(room.lifecycle)) return;
            if (gameServer.quizManager && gameServer.quizManager.isActive) return;
            if (roomCode) {
                RoomRegistry.setLifecycle(roomCode, ROOM_LIFECYCLE.STARTING);
            }
            gameServer.quizManager?.startRound();
            gameServer.io.emit('room_started');
        });
    }

    update() {
        // Reserved for any input polling logic
    }
}

module.exports = NetworkSystem;
