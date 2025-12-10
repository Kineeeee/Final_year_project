const { MAX_FOOD, WORLD_SIZE } = require('../config/constants');

class FoodManager {
    constructor(io) {
        this.io = io;
        this.food = {};
        this.foodIdCounter = 0;
    }

    spawnFood(x, y, color) {
        // If coordinates are provided (death/boost), ignore the limit.
        // Otherwise (random spawn), respect the limit.
        if ((x !== undefined && y !== undefined) || Object.keys(this.food).length < MAX_FOOD) {
            const id = this.foodIdCounter++;
            this.food[id] = {
                id: id,
                x: x !== undefined ? x : Math.floor(Math.random() * WORLD_SIZE),
                y: y !== undefined ? y : Math.floor(Math.random() * WORLD_SIZE),
                color: color !== undefined ? color : Math.floor(Math.random() * 0xFFFFFF)
            };
            return this.food[id];
        }
        return null;
    }

    spawnInitialFood(count = 50) {
        for (let i = 0; i < count; i++) {
            this.spawnFood();
        }
    }

    removeFood(id) {
        delete this.food[id];
    }

    getAllFood() {
        return this.food;
    }
    
    getFood(id) {
        return this.food[id];
    }
}

module.exports = FoodManager;
