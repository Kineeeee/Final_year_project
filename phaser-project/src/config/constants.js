export const CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    BACKGROUND_COLOR: '#028af8',
    WORLD_WIDTH: 10000,
    WORLD_HEIGHT: 10000,
    INITIAL_LENGTH: 5,

    // Client Physics Mirror (Must match Server)
    PHYSICS: {
        BASE_SPEED_PPS: 180, // 3 * 60
        BOOST_SPEED_PPS: 360, // 6 * 60
        ROTATION_SPEED_PPS: 4.5, // 0.075 * 60
        PLAYER_SCALE_BASE: 0.6,
        PLAYER_SCALE_GROWTH: 0.005,
        PIXELS_PER_SEGMENT: 12,
        FOOD_RADIUS: 15 // Base radius scaled
    },

    // Food & Coins
    FOOD: {
        SPEED: 800,
        RADIUS_REGULAR: 10,
        RADIUS_QUIZ: 35,
        COLORS: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff],
        QUIZ_BG_COLOR: 0xffffff,
        QUIZ_TEXT_COLOR: '#000000'
    },
    COIN: {
        COLOR: 0xFFD700,
        STROKE_COLOR: 0xFFFFFF,
        RADIUS: 12,
        SPEED: 900
    },

    SERVER_URL: 'http://192.168.5.13:3000',

    // UI Constants
    UI: {
        CAMERA_BG: 0x444444,
        TOAST_SUCCESS: '#00ff00',
        TOAST_ERROR: '#ff0000',
        TEXT_CORRECT: 0x00ff00,
        TEXT_WRONG: 0xff0000,
        FALLBACK_FOOD_COLOR: 0xff0000
    },

    // Zoom & Camera
    ZOOM: {
        BASE: 1.0,
        MIN: 0.5,
        MAX: 1.0,
        TARGET_WIDTH: 1440,
        SMOOTH_FACTOR: 0.05
    },

    // Intervals (ms)
    INTERVALS: {
        PING: 1000,
        MINIMAP_UPDATE: 1000,
        FLOAT_TEXT_DURATION: 1000,
        BATCH_SPAWN: 16
    },

    // Game Modes
    GAME_MODES: {
        NORMAL: 'normal',
        MATH: 'math',
        ENGLISH: 'english'
    },

    // Item/Buff Keys
    ITEMS: {
        GHOST: 'ghost',
        MAGNET: 'magnet',
        SPEED: 'speed'
    },

    // Asset Keys
    ASSETS: {
        BACKGROUND: 'background'
    },

    // Batching
    BATCH: {
        SPAWN_SIZE: 20
    },

    // Text Styles
    STYLES: {
        FLOAT_TEXT: {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }
    },

    SCENES: {
        GAME: 'Game',
        UI: 'UIScene',
        GAME_OVER: 'GameOver',
        MAIN_MENU: 'MainMenu',
        PRELOADER: 'Preloader',
        BOOT: 'Boot',
        CUSTOMIZE: 'CustomizeScene',
        SHOP: 'ShopScene'
    }
};
