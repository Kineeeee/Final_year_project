export class GameState {
    constructor({ mode = 'normal' } = {}) {
        this.mode = mode;
        this.sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Server clock (authoritative)
        this.serverTick = 0;
        this.serverTime = 0;
        this.serverTimeOffsetMs = 0;

        this.localPlayerId = null;

        // Authoritative snapshots (data-only)
        this.players = new Map(); // id -> { ...snapshot }
        this.foods = new Map(); // foodId -> { id,x,y,type,color,value,data }

        // Change counters (monotonic)
        this.foodsVersion = 0;

        // Session-scoped counters
        this.coinsCollected = 0;
    }

    setLocalPlayerId(id) {
        this.localPlayerId = id;
    }

    resetForNewRound({ mode } = {}) {
        if (mode) this.mode = mode;
        this.sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.localPlayerId = null;
        this.players.clear();
        this.foods.clear();
        this.coinsCollected = 0;
        this.foodsVersion++;

        this.serverTick = 0;
        this.serverTime = 0;
        this.serverTimeOffsetMs = 0;
    }

    setServerClock({ serverTick, serverTime, offsetAlpha } = {}) {
        if (typeof serverTick === 'number') this.serverTick = serverTick;

        if (typeof serverTime === 'number') {
            this.serverTime = serverTime;

            // Estimate offset for interpolation: serverTime - clientNow
            const sampleOffset = serverTime - Date.now();
            // Soft update (alpha is configured on client side; default 0.1)
            const alpha = typeof offsetAlpha === 'number' ? offsetAlpha : 0.1;
            this.serverTimeOffsetMs = this.serverTimeOffsetMs * (1 - alpha) + sampleOffset * alpha;
        }
    }

    upsertPlayer(id, snapshot) {
        if (!id) return;
        const prev = this.players.get(id) || {};
        this.players.set(id, { ...prev, ...snapshot, playerId: id });
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setAllPlayers(playersById) {
        this.players.clear();
        Object.keys(playersById || {}).forEach((id) => {
            const p = playersById[id];
            const pid = p.playerId || id;
            this.upsertPlayer(pid, p);
        });
    }

    setAllFoods(foodById) {
        this.foods.clear();
        Object.keys(foodById || {}).forEach((id) => {
            const f = foodById[id];
            const fid = f.id || id;
            this.upsertFood({ ...f, id: fid });
        });
        this.foodsVersion++;
    }

    upsertFood(food) {
        if (!food || !food.id) return;
        const prev = this.foods.get(food.id) || {};
        this.foods.set(food.id, { ...prev, ...food });
        this.foodsVersion++;
    }

    removeFood(id) {
        if (this.foods.delete(id)) {
            this.foodsVersion++;
        }
    }

    getFoodsVersion() {
        return this.foodsVersion;
    }

    getFoodsArray() {
        return Array.from(this.foods.values());
    }

    getPlayersArray() {
        return Array.from(this.players.values());
    }
}
