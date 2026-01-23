const { MAX_FOOD, WORLD_SIZE, COIN_CONFIG, QUIZ_CONFIG } = require('../../config/constants');

class FoodManager {
    constructor(io, container) {
        this.io = io;
        this.container = container;
        this.food = {};
        this.foodIdCounter = 0;
        this.foodCount = 0; // Initialize food counter
    }

    spawnFood(x, y, color, type = 'regular', value = 1, data = null, shouldEmit = true) {
        // ID Generation: Use String to ensure network precision vs Float
        const id = `food_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        if (x === undefined) x = Math.floor(Math.random() * WORLD_SIZE);
        if (y === undefined) y = Math.floor(Math.random() * WORLD_SIZE);
        // Nếu là Coin thì mặc định màu vàng
        if (type === 'coin') {
            color = COIN_CONFIG.COLOR;
            value = COIN_CONFIG.VALUE;
        } else if (color === undefined) {
            color = Math.floor(Math.random() * 0xffffff);
        }
        this.food[id] = {
            id,
            x,
            y,
            color,
            type, // 'regular', 'coin', 'text'
            value,
            data, // Custom data (e.g. quiz text)
        };
        this.foodCount++;

        // DEFAULT: Emit to clients (unless explicitly disabled for batch operations)
        if (shouldEmit && this.io) {
            this.io.emit('newFood', this.food[id]);
        }

        return this.food[id];
    }

    setConfig(config) {
        this.mode = config.mode; // 'normal' or 'quiz'
    }

    spawnInitialFood(count = MAX_FOOD) {
        if (this.mode === 'quiz') {
            // In Quiz Mode, initial food is just a few coins
            count = QUIZ_CONFIG.INITIAL_FOOD_COUNT;
            for (let i = 0; i < count; i++) {
                this.spawnFood(
                    undefined,
                    undefined,
                    undefined,
                    'coin',
                    COIN_CONFIG.VALUE,
                    null,
                    false
                ); // Don't emit individually
            }
        } else {
            for (let i = 0; i < count; i++) {
                this.spawnFood(undefined, undefined, undefined, 'regular', 1, null, false); // Don't emit individually
            }
        }
        // Send all initial food in one batch after spawning
        if (this.io) {
            this.io.emit('currentFood', this.food);
        }
    }

    removeFood(id, shouldEmit = false) {
        if (this.food[id]) {
            delete this.food[id];
            this.foodCount--;

            // Emit removal event if requested
            if (shouldEmit && this.io) {
                this.io.emit('removeFood', id);
            }
        }
    }

    getAllFood() {
        return this.food;
    }

    getFood(id) {
        return this.food[id];
    }

    refillFood() {
        if (this.mode === 'quiz') {
            this.refillQuizMode();
        } else {
            this.refillNormalMode();
        }
    }

    refillQuizMode() {
        const COIN_TARGET = QUIZ_CONFIG.TARGET_COIN_COUNT;
        const ids = Object.keys(this.food);

        // Count current coins
        let coinCount = 0;
        ids.forEach((id) => {
            if (this.food[id].type === 'coin') coinCount++;
        });

        if (coinCount < COIN_TARGET) {
            const need = COIN_TARGET - coinCount;
            for (let i = 0; i < need; i++) {
                this.spawnFood(
                    undefined,
                    undefined,
                    undefined,
                    'coin',
                    COIN_CONFIG.VALUE,
                    null,
                    true
                );
            }
        }
    }

    refillNormalMode() {
        const TARGET = MAX_FOOD;
        let ids = Object.keys(this.food);
        const removedIds = [];

        // If too many, remove random
        if (ids.length > TARGET) {
            const toRemove = ids.length - TARGET;
            for (let i = 0; i < toRemove; i++) {
                const idx = Math.floor(Math.random() * ids.length);
                const id = ids[idx];
                delete this.food[id];
                this.foodCount--;
                removedIds.push(id);
                ids.splice(idx, 1);
            }

            if (removedIds.length > 0) {
                removedIds.forEach((id) => this.io.emit('removeFood', id));
            }
        }
        // If too few, spawn more
        else if (ids.length < TARGET) {
            const need = TARGET - ids.length;
            for (let i = 0; i < need; i++) {
                this.spawnFood();
            }
        }
    }
}

module.exports = FoodManager;
