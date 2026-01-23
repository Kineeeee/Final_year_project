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
    BOT_COUNT: 20,
    BOT_NAMES: [
        'Viper',
        'Python',
        'Anaconda',
        'Cobra',
        'Boa',
        'Mamba',
        'Sidewinder',
        'Rattler',
        'Nagini',
        'Kaa',
    ],

    // Gameplay Constants
    HITBOX_SENSITIVITY: 1.0,
    BASE_MAGNET_RADIUS: 80,
    BOOST_COST_INTERVAL: 90, // Frames (approx 1.5s at 60fps)
    MAX_PLAYER_SCALE: 1.2,
    PLAYER_SCALE_BASE: 0.6,
    PLAYER_SCALE_GROWTH: 0.005,

    // Timing & Network
    FOOD_REFILL_INTERVAL: 15000,
    BROADCAST_FPS: 30,

    // Leaderboard
    LEADERBOARD_FPS: 4,
    LEADERBOARD_TOP_N: 5,

    // Interest management (server-authoritative view)
    // Radius is in world units; tune based on camera + desired bandwidth.
    INTEREST_VIEW_RADIUS: 1600,

    // Food & Coins
    COIN_CONFIG: {
        COLOR: 0xffd700,
        VALUE: 10,
    },

    // Quiz Mode Specifics
    QUIZ_CONFIG: {
        INITIAL_FOOD_COUNT: 20,
        TARGET_COIN_COUNT: 30,
    },

    ITEMS: {
        SPEED_UP: {
            id: 'speed',
            price: 100,
            duration: 10000,
            cooldown: 10000,
            buffValue: 4,
            description: 'Speed +4 (10s)',
        },
        MAGNET: {
            id: 'magnet',
            price: 200,
            duration: 10000,
            cooldown: 15000,
            buffValue: 200,
            description: 'Magnet Radius 200 (10s)',
        },
        GHOST: {
            id: 'ghost',
            price: 300,
            duration: 5000,
            cooldown: 20000,
            buffValue: 0,
            description: 'Ghost Mode (5s)',
        },
    },
};
