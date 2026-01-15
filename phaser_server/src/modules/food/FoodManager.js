const { MAX_FOOD, WORLD_SIZE } = require('../../config/constants');

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
            color = 0xFFD700; // Gold color
            value = 10; // 1 Coin = 10 điểm tiền (hoặc tùy bạn chỉnh)
        } else if (color === undefined) {
            color = Math.floor(Math.random() * 0xFFFFFF);
        }
        this.food[id] = {
            id,
            x,
            y,
            color,
            type, // 'regular', 'coin', 'text'
            value,
            data // Custom data (e.g. quiz text)
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
            // In Quiz Mode, initial food is just a few coins (e.g., 20)
            // Answers are spawned by QuizManager later.
            count = 20;
            for (let i = 0; i < count; i++) {
                this.spawnFood(undefined, undefined, undefined, 'coin', 10, null, false); // Don't emit individually
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
        // Different logic for Quiz Mode
        if (this.mode === 'quiz') {
            // Maintain Coin Count (e.g. 20 coins)
            const COIN_TARGET = 30;
            const ids = Object.keys(this.food);

            // Count current coins
            let coinCount = 0;
            ids.forEach(id => {
                if (this.food[id].type === 'coin') coinCount++;
            });

            if (coinCount < COIN_TARGET) {
                const need = COIN_TARGET - coinCount;
                for (let i = 0; i < need; i++) {
                    this.spawnFood(undefined, undefined, undefined, 'coin', 10, null, true); // Emit new coins
                }
            }
            // Do not remove extra food (answers are managed by QuizManager or eaten)

            // Wait, if we don't remove, old answers might persist? 
            // QuizManager handles round reset.
        } else {
            const TARGET = MAX_FOOD;
            let ids = Object.keys(this.food);
            const removedIds = [];

            // Nếu thừa thì xóa bớt ngẫu nhiên
            if (ids.length > TARGET) {
                // Xóa bớt cho đúng số lượng
                const toRemove = ids.length - TARGET;
                // Lấy ngẫu nhiên các id để xóa
                for (let i = 0; i < toRemove; i++) {
                    const idx = Math.floor(Math.random() * ids.length);
                    const id = ids[idx];
                    delete this.food[id];
                    this.foodCount--;
                    removedIds.push(id);
                    ids.splice(idx, 1);
                }

                // Notify clients of removed food
                if (removedIds.length > 0) {
                    removedIds.forEach(id => this.io.emit('removeFood', id));
                }
            }
            // Nếu thiếu thì spawn thêm (shouldEmit = true by default)
            else if (ids.length < TARGET) {
                const need = TARGET - ids.length;
                for (let i = 0; i < need; i++) {
                    this.spawnFood(); // Will auto-emit 'newFood'
                }
            }
        }
    }
}

module.exports = FoodManager;
