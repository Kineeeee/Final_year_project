const { MAX_FOOD, WORLD_SIZE } = require('../config/constants');

class FoodManager {
    constructor(io) {
        this.io = io;
        this.food = {};
        this.foodIdCounter = 0;
    }

    spawnFood(x, y, color, type = 'regular', value = 1) {
        const id = Date.now() + Math.random();
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
            type, // 'regular' hoặc 'coin'
            value 
        };
        this.foodCount++;
        return this.food[id];
    }

    spawnInitialFood(count = MAX_FOOD) {
        for (let i = 0; i < count; i++) {
            this.spawnFood();
        }
    }

    removeFood(id) {
        if (this.food[id]) {
        delete this.food[id];
        this.foodCount--;
        }
    }

    getAllFood() {
        return this.food;
    }
    
    getFood(id) {
        return this.food[id];
    }

    refillFood() {
        const TARGET = MAX_FOOD;
        let ids = Object.keys(this.food);

        // Nếu thừa thì xóa bớt ngẫu nhiên
        if (ids.length > TARGET) {
            // Xóa bớt cho đúng số lượng
            const toRemove = ids.length - TARGET;
            // Lấy ngẫu nhiên các id để xóa
            for (let i = 0; i < toRemove; i++) {
                const idx = Math.floor(Math.random() * ids.length);
                const id = ids[idx];
                delete this.food[id];
                ids.splice(idx, 1);
            }
        }
        // Nếu thiếu thì spawn thêm
        else if (ids.length < TARGET) {
            const need = TARGET - ids.length;
            for (let i = 0; i < need; i++) {
                this.spawnFood();
            }
        }
        // Gửi cập nhật cho client
        this.io.emit('currentFood', this.food);
    }
}

module.exports = FoodManager;
