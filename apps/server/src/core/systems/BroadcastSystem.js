const Logger = require('../../utils/Logger');
const { BROADCAST_FPS, LEADERBOARD_FPS, LEADERBOARD_TOP_N, INTEREST_VIEW_RADIUS } = require('../../config/ServerConstants');
const { SOCKET_EVENT } = require('../../events/EventTypes');

class BroadcastSystem {
    constructor(io, container, config) {
        this.io = io;
        this.container = container;
        this.config = config;

        // Tick state
        this.serverTick = 0;
        
        // Cache for rank calculation (update every 5 ticks = ~6 FPS)
        this.cachedPlayerRanks = {};
        this.rankCacheTickInterval = 5;
    }

    get playerManager() { return this.container.get('playerManager'); }
    get foodManager() { return this.container.get('foodManager'); }
    get spatialGrid() { return this.container.get('spatialGrid'); }

    initialize() {
        // Listen to player disconnect events to clear rank cache
        const eventBus = this.container.get('eventBus');
        if (eventBus) {
            eventBus.on('playerDisconnected', (playerId) => {
                delete this.cachedPlayerRanks[playerId];
            });
        }
    }

    broadcastGameUpdate() {
        this.serverTick++;
        const serverTime = Date.now();

        // Broadcast World Delta (Binary Protocol)

        // Broadcast World Delta (Binary Protocol)

        // --- Server-authoritative interest-managed delta ---
        this.broadcastWorldDelta({ serverTime });
    }

    async broadcastLeaderboard() {
        try {
            const players = Object.values(this.playerManager.getAllPlayers() || {});
            if (players.length === 0) return;

            // Match-local leaderboard: always reflect active players in this game instance.
            const top = players
                .map((p) => ({
                    id: p.id,
                    name: p.name || 'Unknown',
                    score: p.score || 0,
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, LEADERBOARD_TOP_N);

            this.io.emit(SOCKET_EVENT.LEADERBOARD, {
                serverTick: this.serverTick,
                serverTime: Date.now(),
                top
            });
        } catch (err) {
            Logger.error('BroadcastSystem', 'Leaderboard Broadcast Error', err);
        }
    }

    broadcastWorldDelta({ serverTime }) {
        const players = this.playerManager.getAllPlayers();

        // Calculate Ranks (cache every N ticks to reduce CPU)
        if (this.serverTick % this.rankCacheTickInterval === 0) {
            const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
            sortedPlayers.forEach((p, i) => {
                p.rank = i + 1;
                this.cachedPlayerRanks[p.id] = i + 1;
            });
        } else {
            // Use cached ranks
            Object.keys(players).forEach((id) => {
                if (this.cachedPlayerRanks[id]) {
                    players[id].rank = this.cachedPlayerRanks[id];
                }
            });
        }
        
        const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

        const r = INTEREST_VIEW_RADIUS;
        const r2 = r * r;

        try {
            const socketsIter = this.io?.sockets?.sockets?.values
                ? this.io.sockets.sockets.values()
                : (this.io?.sockets?.values ? this.io.sockets.values() : []);

            for (const socket of socketsIter) {
                const me = players[socket.id];
                if (!me) continue;

                if (!socket.data) socket.data = {};
                if (!socket.data._interest) {
                    socket.data._interest = { players: new Set(), foods: new Set() };
                }

                const prevPlayers = socket.data._interest.players;
                const prevFoods = socket.data._interest.foods;

                const nextPlayers = new Set();
                const nextFoods = new Set();

                const playersUpsert = [];
                const playersRemove = [];
                const foodsUpsert = [];
                const foodsRemove = [];

                // Spatial Grid Query
                if (!this.spatialGrid) {
                    Logger.warn('BroadcastSystem', 'SpatialGrid missing in broadcastWorldDelta');
                    continue;
                }

                const nearbyEntities = this.spatialGrid.query(me.x, me.y, r);

                for (const entity of nearbyEntities) {
                    // Players
                    if (entity.playerId) {
                        const id = entity.playerId;

                        const dx = entity.x - me.x;
                        const dy = entity.y - me.y;
                        if (dx * dx + dy * dy > r2) continue;

                        nextPlayers.add(id);
                        const p = entity;

                        // Binary Array [id, x, y, rot, score, boost, name, color, activeEffects]
                        playersUpsert.push([
                            id,
                            Math.round(p.x),
                            Math.round(p.y),
                            Math.round(p.rotation * 100) / 100,
                            p.score,
                            p.isBoosting ? 1 : 0,
                            p.name,
                            p.color,
                            p.activeEffects
                        ]);
                    }
                    // Foods
                    else if (entity.id && entity.type) {
                        const f = entity;
                        const dx = f.x - me.x;
                        const dy = f.y - me.y;
                        if (dx * dx + dy * dy > r2) continue;

                        nextFoods.add(f.id);

                        // Binary Array [id, x, y, type, value, color, data]
                        foodsUpsert.push([
                            f.id,
                            f.x,
                            f.y,
                            f.type,
                            f.value,
                            f.color,
                            f.data
                        ]);
                    }
                }

                // Compute removals
                for (const id of prevPlayers) {
                    if (!nextPlayers.has(id)) playersRemove.push(id);
                }
                for (const id of prevFoods) {
                    if (!nextFoods.has(id)) foodsRemove.push(id);
                }

                // Update interest state
                socket.data._interest.players = nextPlayers;
                socket.data._interest.foods = nextFoods;

                // Send Binary Packet
                socket.emit(SOCKET_EVENT.WORLD_DELTA, [
                    this.serverTick,
                    serverTime,
                    playersUpsert,
                    playersRemove,
                    foodsUpsert,
                    foodsRemove,
                    me.rank || 0,
                    sortedPlayers.length
                ]);
            }
        } catch (err) {
            Logger.error('BroadcastSystem', 'broadcastWorldDelta Error', err);
        }
    }
}

module.exports = BroadcastSystem;
