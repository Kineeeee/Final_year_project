module.exports = {
    PORT: 3000,
    WORLD_SIZE: 10000,
    MAX_FOOD: 600,
    FPS: 60,
    SAFE_SPAWN_RADIUS: 300,
    FOOD_RADIUS: 10,
    BASE_SPEED: 3,
    BOOST_SPEED: 6,
    TURN_SPEED: 0.075,
    PIXELS_PER_SEGMENT: 12,
    INITIAL_LENGTH: 5,
    BOT_COUNT: 20,
    BOT_NAMES: ["Viper", "Python", "Anaconda", "Cobra", "Boa", "Mamba", "Sidewinder", "Rattler", "Nagini", "Kaa"],
    ITEMS: {
        SPEED_UP: { id: 'speed', price: 100, duration: 15000, description: "Speed up for 15s" },
        MAGNET: { id: 'magnet', price: 200, duration: 15000, description: "Magnet items for 15s" },
        GHOST: { id: 'ghost', price: 300, duration: 10000, description: "Ghost mode for 10s" }
    }
};
